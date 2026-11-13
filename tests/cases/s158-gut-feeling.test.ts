// 158 Gut Feeling (LI5b, LI6 b): at the start of each turn the owner rolls Insight against the stealth of each hidden
// watcher (opposed or hostile to the owner, aware of it, in its zone or one sight link away, unseen by it). A win is a
// hunch from the watcher's zone, never who: the owner turns suspicious of the watcher. Once per watcher a scenario.
import { CONFIG } from '../../src/config';
import { tick } from '../harness/time';
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage, place } from '../harness';
import { gutFeelings, hiddenWatcher } from '../../src/engine/hunches';
import { buildNarrationView } from '../../src/views';
import { beliefStatus } from '../../src/perception';
import { BUILT_PERKS } from '../../src/library/builtPerks';
import { PK } from '../../src/library/perkIds';
import type { Actor, GameState } from '../../src/types';
import { play } from './w4-kit';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
/** guard_1 hides in the player's zone, opposed to the player and aware of them; the player owns Gut Feeling */
const setup = (zone?: string) => {
  const s = makeVillage();
  give(s.player, PK.gut_feeling);
  const g = npc(s, 'guard_1');
  place(s, 'guard_1', zone ?? s.player.zone);
  g.posture = 'stealthy';
  g.mind!.overrides = { player: 'opposed' };
  g.mind!.knowledge.player = { ...({ source: 'seen', revealed: [] } as const), ...(g.mind!.knowledge.player ?? {}), status: 'aware', lastKnownZone: s.player.zone };
  return { s, g };
};

describe('158 Gut Feeling', () => {
  it('is coded but not takeable until it has a place on the Insight ladder (LI7)', () => expect(BUILT_PERKS.has(PK.gut_feeling)).toBe(false));

  it('a hidden watcher is wary of the owner, aware of it, close, and unseen by it', () => {
    const { s, g } = setup();
    expect(hiddenWatcher(s, s.player, g)).toBe(true);
    g.mind!.overrides = {};
    expect(hiddenWatcher(s, s.player, g)).toBe(false); // not opposed or hostile (LI6 b)
    const u = setup();
    u.g.mind!.knowledge.player = { ...u.g.mind!.knowledge.player!, status: 'unaware' };
    expect(hiddenWatcher(u.s, u.s.player, u.g)).toBe(false); // not watching the owner
    const v = setup();
    v.s.player.journal!.stealthSeen = { guard_1: 'aware' };
    expect(hiddenWatcher(v.s, v.s.player, v.g)).toBe(false); // the owner already sees them
    const w = setup('tav_cellar');
    expect(hiddenWatcher(w.s, w.s.player, w.g)).toBe(false); // out of sight
  });

  it('a win is a hunch, once per watcher a scenario; a loss rolls again HUNCH_EVERY_ROUNDS rounds later (AT74)', () => {
    const { s } = setup();
    const lost = gutFeelings(s, forcedRng([95, 5])); // the watcher's stealth 95, the owner's Insight 5
    expect(lost).toHaveLength(1);
    expect(lost[0].felt).toBe(false);
    tick(s);
    expect(gutFeelings(s, forcedRng([5, 95]))).toEqual([]); // too soon to roll again
    tick(s, CONFIG.HUNCH_EVERY_ROUNDS * CONFIG.ROUND_S);
    const won = gutFeelings(s, forcedRng([5, 95]));
    expect(won[0].felt).toBe(true);
    expect(gutFeelings(s, forcedRng([5, 95]))).toEqual([]); // already set off this scenario
    s.stage.scenarioStartTurn += 1; // a new scenario
    tick(s, CONFIG.HUNCH_EVERY_ROUNDS * CONFIG.ROUND_S);
    expect(gutFeelings(s, forcedRng([5, 95]))).toHaveLength(1);
  });

  it('nobody without the perk rolls', () => {
    const { s } = setup();
    s.player.core.perks = s.player.core.perks.filter((p) => p.perkId !== PK.gut_feeling);
    expect(gutFeelings(s, forcedRng([5, 95]))).toEqual([]);
  });

  it('in play: a hunch event from the watcher\'s zone, and the owner suspects the watcher', () => {
    let found = false;
    for (let seed = 1; seed <= 30 && !found; seed++) {
      const { s, g } = setup();
      const where = g.zone;
      const ev = play(s, {}, seed * 17);
      const h = ev.find((e) => e.kind === 'hunch');
      if (!h) continue;
      found = true;
      expect(h.actorId).toBe('player');
      expect(h.zone).toBe(where); // where the watcher was at the start of the turn
      expect(beliefStatus(s, s.player, g)).not.toBe('unaware');
      const nv = buildNarrationView(s, ev).events.find((e) => e.id === h.id);
      expect(nv?.actor).toBeUndefined(); // never who
    }
    expect(found).toBe(true);
  });
});
