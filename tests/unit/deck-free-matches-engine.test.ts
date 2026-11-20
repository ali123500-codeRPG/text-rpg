// AD (free mark): an entry carries the free mark (a lightning bolt: beside your action, not instead of it) exactly when
// the engine resolves its order beside the main action. The deck asks engine/beside.ts (ridesBeside); this guard does not,
// and derives the expectation from the engine's own order instead: fromIntent (the Order the
// turn resolves), resolve.ts (Order.type is the main action, doMain through useMain; a move or a way op takes the move slot,
// or the main time when nothing else is planned) and PERK_MOVES (which perk moves are free). Never from a list of kinds.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { buildPlayerView } from '../../src/views';
import { actorById } from '../../src/engine/relations';
import { fromIntent } from '../../src/engine/merge';
import { PERK_MOVES } from '../../src/ruleset';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';
import type { GameState, Intent, PlayerView } from '../../src/types';
import { deck, type Choice, type DeckAction } from '../../src/ui/deck';

const IDLE: Intent = { move: null, action: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null };

/** the engine's answer: the order takes no main action (its type is the idle order's), no move slot and no way op, and
 * still does something that rides along (a gear op, a warning, a perk move PERK_MOVES calls free) */
function engineFree(s: GameState, intent: Intent): boolean {
  const o = fromIntent(s, intent, false), idle = fromIntent(s, IDLE, false);
  if (o.type !== idle.type || o.move || o.way) return false;
  if (o.perkMove) return PERK_MOVES[o.perkMove.perk]?.free === true;
  return JSON.stringify(o) !== JSON.stringify(idle);
}

/** the first pick of each step, as the deck's own hover time does (deck.ts timeTip); null when a step has nothing to pick */
function firstChoice(a: DeckAction): Choice | null {
  const c: Choice = {};
  for (const st of a.steps) {
    if (st.key === 'words') { c.words = 'Hold on.'; continue; }
    const p = st.picks(c);
    if (!p.length) return null;
    c[st.key] = p[0].id;
  }
  return c;
}

const fight = (s: GameState = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] })) => {
  const m = actorById(s, 'patron_1')!.mind!;
  m.overrides = { player: 'hostile' };
  m.knowledge.player = { status: 'engaged', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  s.mode = 'tactical';
  return s;
};
/** a fight where the player owns every perk move (free and not) and has a foe to warn its side about */
const fightWithMoves = () => {
  const s = fight();
  for (const perkId of Object.keys(PERK_MOVES)) if (perkId !== PK.play_dead) s.player.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
  return s;
};

/** the player's sword put away (not in a hand), so Draw and Swap weapons show */
const sheathed = () => {
  const s = makeVillage();
  for (const i of s.player.core.inventory) if (i.itemId === IT.arming_sword) i.equippedIn = [];
  return s;
};

type Case = { name: string; s: GameState; pv: (s: GameState) => PlayerView; broken?: boolean };
const CASES: Case[] = [
  { name: 'calm, in the village', s: makeVillage(), pv: buildPlayerView },
  { name: 'calm, with the sword put away', s: sheathed(), pv: buildPlayerView },
  { name: 'in a fight', s: fight(), pv: buildPlayerView },
  // warnable comes from the engine's warnings (WN9 a); set on the view here so the Warn entry shows without staging a trick
  { name: 'in a fight with every perk move and someone to warn about', s: fightWithMoves(), pv: (s) => ({ ...buildPlayerView(s), player: { ...buildPlayerView(s).player, warnable: [{ id: 'patron_1', why: 'trick' }] } }) },
  { name: 'in a fight with a broken nerve', s: fight(), pv: buildPlayerView, broken: true },
];

describe('the free mark matches the engine (one rule, two places)', () => {
  const seen = new Map<string, boolean>();
  for (const c of CASES) {
    const all = deck({ pv: c.pv(c.s), s: c.s, broken: c.broken }).flatMap((g) => g.actions);
    for (const a of all) {
      const choice = firstChoice(a);
      if (!choice) continue;
      const free = engineFree(c.s, a.play(choice).intent);
      seen.set(`${a.kind}${a.kind === 'perk' ? `:${a.label}` : ''}`, free);
      it(`${c.name}: ${a.label} (${a.kind}) is ${free ? '' : 'not '}free in the engine, and the deck agrees`, () => {
        expect(!!a.free).toBe(free);
      });
    }
  }

  it('the states above reach free entries and entries that take the action, gear ops, a warning and both kinds of perk move', () => {
    const free = [...seen].filter(([, f]) => f).map(([k]) => k), taken = [...seen].filter(([, f]) => !f).map(([k]) => k);
    expect(free).toEqual(expect.arrayContaining(['draw', 'swap', 'stow', 'set_down', 'equip', 'warn']));
    expect(free.some((k) => k.startsWith('perk:'))).toBe(true);
    expect(taken).toEqual(expect.arrayContaining(['attack', 'search', 'listen', 'go']));
    expect(taken.some((k) => k.startsWith('perk:'))).toBe(true);
  });
});
