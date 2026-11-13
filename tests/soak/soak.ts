// TQ2 soak run: a seeded random player plays whole turns through the real game (createGame: views, legality, resolve,
// save, narration view) with no Claude calls. Its Parser answers are random legal-looking intents built from its own
// PlayerView; every other agent call fails, so NPCs run on code routines and fallbacks, and new ground is fallback ground. The turn checker runs every turn
// (strict in tests), and any throw is re-thrown with the world, seed and the inputs so far, so it replays exactly.
import type { ClaudeClient, ClaudeRequest, ClaudeResponse, GameState, Intent, PlayerView } from '../../src/types';
import type { Game } from '../../src/agents/game';
import { PARSER_ACTIONS } from '../../src/types';
import { createGame, VirtualClock } from '../../src/agents';
import { createDirector } from '../../src/agents/director';
import { memoryStore } from '../../src/save/store';
import { buildPlayerView } from '../../src/views';
import { createRng } from '../../src/rng';

type Rng = ReturnType<typeof createRng>;
const pick = <T>(r: Rng, xs: T[]): T | undefined => (xs.length ? xs[Math.floor((r.d100() - 1) * xs.length / 100)] : undefined);
const LINES = ['Hello there.', 'What happened here?', 'I need work.', 'Stand back!', 'Have you seen anything strange?', 'Help!'];
const GEAR_OPS = ['draw', 'stow', 'swap', 'wear_acc', 'remove_acc', 'pick_up'] as const;
/** a reload from the save every this many turns played, so "fine until you reload" bugs show */
export const RELOAD_EVERY = 10;

const base = (p: Partial<Intent>): Intent => ({ move: null, action: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, ...p });
const act = (type: NonNullable<Intent['action']>['type'], p: Partial<NonNullable<Intent['action']>> = {}): Intent['action'] =>
  ({ type, skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance: 'normal', ...p });

/** one random thing a player could try, from what the player sees (legality still has the last word, as with the Parser) */
export function randomIntent(v: PlayerView, r: Rng): Intent {
  const seen = v.actors.filter((a) => a.level === 'full');
  const who = pick(r, seen)?.id ?? null;
  const ways = v.zone.links.map((l) => l.to);
  const known = [...ways, ...(v.known ?? []).map((k) => k.id)];
  const own = v.player.inventory;
  const seller = pick(r, seen.filter((a) => a.wares?.length));
  const skill = pick(r, v.player.skills)?.id ?? '';
  const box = pick(r, [v.zone, ...v.zones].flatMap((z) => z.groundItems.filter((g) => g.container)));
  const options: (() => Intent)[] = [
    () => base({ action: act('observe') }),
    () => base({ move: { toZone: pick(r, ways) ?? v.zone.id } }),
    () => base({ move: { toZone: pick(r, known) ?? v.zone.id } }),
    () => base({ move: { toZone: v.zone.id, spot: who ? { near: who } : { side: 'north' } } }),
    () => base({ action: act('talk', { target: who }), spoken: pick(r, LINES)!, addressees: who ? [who] : null }),
    () => base({ spoken: pick(r, LINES)!, volume: 'shout', addressees: ['everyone'] }),
    () => base({ action: act('attack', { target: who, skill }) }),
    () => base({ action: act('give', { target: who, item: pick(r, own)?.id ?? null, qty: 1 }) }),
    () => base({ action: act('buy', { target: seller?.id ?? null, item: seller ? pick(r, seller.wares!)?.id ?? null : null }) }),
    () => base({ action: act('open', { target: box?.id ?? null }) }),
    () => base({ action: act(pick(r, ['search', 'hide', 'sneak', 'rest'] as const)!) }),
    () => base({ move: { toZone: pick(r, ways) ?? v.zone.id }, action: act('attack', { target: who, skill }) }),
    // every Parser action (new ones too), on someone, something or a way out, with an item of one's own
    () => base({ action: act(pick(r, [...PARSER_ACTIONS])!, { target: pick(r, [who, box?.id ?? null, pick(r, ways) ?? null]) ?? null, item: pick(r, own)?.id ?? null, skill, targetPart: pick(r, [null, 'head', 'left_arm', 'right_leg']) ?? null }), spoken: pick(r, [null, pick(r, LINES)!]) ?? null }),
    () => base({ gear: [{ op: pick(r, [...GEAR_OPS])!, item: pick(r, [...own, ...[v.zone, ...v.zones].flatMap((z) => z.groundItems)])?.id ?? '' }], action: act('observe') }),
    () => base({ spoken: pick(r, LINES)!, volume: 'whisper', addressees: who ? [who] : ['everyone'], deferred: ['then look around'] }),
  ];
  return pick(r, options)!();
}

/** a ClaudeClient for the soak: the Parser gets `next()`, every other call fails (fallbacks, code minds) */
function soakClient(next: () => Intent): ClaudeClient {
  return {
    async call(req: ClaudeRequest): Promise<ClaudeResponse> {
      if (req.agent === 'parser') return { ok: true, value: next() };
      return { ok: false, error: 'upstream_error', message: 'soak run: no Claude' };
    },
  };
}

export type World = { name: string; load: (store: ReturnType<typeof memoryStore>) => GameState | null };
export type SoakResult = { played: number; lives: number; reloads: number; fingerprint: string };

/** plays `turns` random turns on a world: when the player falls (or play stops) the world starts again, with the rng
 *  going on, until the turns are spent; every RELOAD_EVERY turns the game is reopened from its save. Throws with the
 *  seed and the inputs that led there. */
export async function soak(world: World, seed: number, turns: number): Promise<SoakResult> {
  const r = createRng(seed);
  const clock = new VirtualClock();
  let current: Intent = base({});
  const inputs: Intent[] = [];
  const client = soakClient(() => current);
  let store = memoryStore(() => clock.now());
  let game: Game = null!;
  const open = async (fresh: boolean) => {
    if (fresh) store = memoryStore(() => clock.now());
    game = createGame({ client, clock, store, director: createDirector(clock) }); // Weaver calls fail: fallback ground
    const adopted = fresh ? world.load(store) : null;
    if (adopted) game.adopt(adopted);
    else if (!(await game.resume())) throw new Error(`soak ${world.name}: the world did not ${fresh ? 'load' : 'reload from its save'}`);
  };
  let played = 0, lives = 0, reloads = 0, sinceLoad = 0;
  const marks: string[] = [];
  try {
    await open(true);
    lives = 1;
    while (played < turns) {
      if (game.fell() || game.notices().some((n) => n.kind === 'stop_play')) {
        if (lives >= turns) break; // the world can't keep a player alive at all
        await open(true); lives++; sinceLoad = 0;
      } else if (sinceLoad >= RELOAD_EVERY) {
        await open(false); reloads++; sinceLoad = 0;
      }
      const s = game.state()!;
      current = randomIntent(buildPlayerView(s), r);
      inputs.push(current);
      await game.submit(`soak ${played}`, { aimed: false });
      await game.settle();
      played++; sinceLoad++;
      const t = game.state()!;
      marks.push(`${t.turn}:${t.player.zone}:${t.player.core.condition.hpLostPct}:${t.actors.map((a) => `${a.id}@${a.zone}`).join(',')}`);
    }
  } catch (e) {
    throw new Error(`soak ${world.name} seed ${seed} failed on input ${inputs.length} (life ${lives}, replay: soak(world, ${seed}, ${inputs.length}))\n${(e as Error).message}\nlast inputs: ${JSON.stringify(inputs.slice(-3))}`);
  }
  return { played, lives, reloads, fingerprint: marks.join('|') };
}
