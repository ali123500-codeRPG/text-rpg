// Whole-turn tests (TQ5): the village fixture, ScriptedClaude on a VirtualClock, the real pipeline (createGame: views,
// agents, legality, resolve, save, narration, scenario hooks). Rule: a change that touches a view, an agent call or narration
// adds one whole-turn test, and never sets by hand what the turn itself sets. wholeTurn is the short way to write one.
import type { GameEvent, GameState, Intent, NarratorOutput } from '../../src/types';
import { makeVillage, type VillageOpts } from './village';
import { ScriptedClaude } from './scripted';
import { createGame, VirtualClock } from '../../src/agents';
import { memoryStore, readTurnRecord } from '../../src/save';
import { SK } from '../../src/library/skillIds';

export function setupGame(opts: VillageOpts & { engaged?: string[] } = {}) {
  const clock = new VirtualClock();
  const claude = new ScriptedClaude(clock);
  const store = memoryStore();
  const game = createGame({ client: claude, clock, store });
  const state = makeVillage(opts);
  for (const a of state.actors) if (opts.engaged?.includes(a.id)) a.mind!.control = 'agent';
  state.pending = { turn: state.turn, mode: opts.engaged?.length ? 'tactical' : 'explore', engaged: opts.engaged ?? [], fired: [] };
  state.mode = state.pending.mode;
  return { clock, claude, store, game, state, start: () => game.adopt(state) };
}

export const intent = (over: Partial<Intent> = {}): Intent => ({
  move: null,
  action: { type: 'observe', skill: SK.eyesight, target: null, targetPart: null, item: null, mode: null, approach: 'quietly', stance: 'normal' },
  gear: null, spoken: null, addressees: null, deferred: [], clarify: null, ...over,
});

export const speech = (type: 'talk' | 'persuade' | 'deceive', to: string, spoken: string, over: Partial<NonNullable<Intent['action']>> = {}): Intent =>
  intent({
    action: { type, skill: SK.persuasion, target: to, targetPart: null, item: null, mode: null, approach: 'with a crooked grin', stance: 'normal', ...over },
    spoken, addressees: [to],
  });

/** a narration that lists every event of its NarrationView (read from the request) */
export function narrateAll(text = 'The room is quiet.') {
  return (req: { input: { content: string }[] }) => {
    const data = req.input[1].content;
    const view = JSON.parse(data.slice(data.indexOf('NARRATION_VIEW:\n') + 16)) as { events: { id: string }[] };
    const value: NarratorOutput = { text, narrated: view.events.map((e) => e.id) };
    return { ok: true as const, value };
  };
}

export function npcAction(type: string, target: string | null, over: Record<string, unknown> = {}) {
  return { type, target, skill: null, targetPart: null, aimed: false, defense: null, item: null, mode: null, intent: 'act', ...over };
}

export type { GameState };

/** a game on the village where every agent has a default: the Narrator narrates every event; the Planner, Responder,
 *  Voice and Weaver calls fail unless queued, so NPCs run on their code minds, as when Claude is down. `turn` plays one
 *  whole turn from a Parser intent and returns that turn's events and the narration shown. */
export function wholeTurn(opts: VillageOpts & { engaged?: string[] } = {}) {
  const g = setupGame(opts);
  g.claude.defaults.narrator = narrateAll();
  g.start();
  return {
    ...g,
    async turn(i: Intent, line = 'test input'): Promise<{ events: GameEvent[]; narration: string }> {
      const t = g.game.state()!.turn;
      g.claude.push('parser', i);
      await g.game.submit(line, { aimed: false });
      await g.game.settle();
      const rec = await readTurnRecord(g.store, g.state.storyId, t);
      return { events: rec?.events ?? [], narration: g.game.lines().filter((l) => l.kind === 'narration').at(-1)?.text ?? '' };
    },
  };
}
