// 221 Search redesign, people part (SE1–SE24, BG-38: run 40's thief Tam could never be found on purpose). A search is
// a contest of the searcher's better sense after light against the stealth of everyone hiding in reach: a win finds
// them, a tie leaves "someone", a loss changes nothing; nothing hidden, nothing rolled. Look around is a weak search
// (one tier down). NPCs search by the same rule. The ground covered grows with skill and with searchArea/searchReach.
import { TP } from '../../src/library/templateIds';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeVillage, place, beside } from '../harness';
import { intent, play, act, plannerOut } from './w4-kit';
import { ruleset } from '../../src/ruleset';
import { spawnNpc } from '../../src/library/spawn';
import { searchAreaM2 } from '../../src/minds';
import { getLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import type { Actor, ContestResult, GameState, RollRequest } from '../../src/types';

/** forces each search contest's gap; records the watcher's side of each stealth contest */
function rig(gap: number) {
  const calls: RollRequest[] = [];
  const real = ruleset.contested;
  vi.spyOn(ruleset, 'contested').mockImplementation((a, b, st, rng) => {
    if (a.rollKind !== 'stealth') return real(a, b, st, rng);
    calls.push(b);
    const g = a.roles ? gap : -1; // a search rolls the hider with the hide tag; passive contests here go to the hider
    return { ...real(a, b, st, rng), gap: g, winner: g < 0 ? 'a' : g > 0 ? 'b' : 'tie' } as ContestResult;
  });
  return calls;
}
/** this turn's search contests (play() clears the log each turn) */
const searches = (s: GameState) => s.log.filter((l) => l.code === 'search_contest').map((l) => l.detail!);
function thief(s: GameState, zone: string): Actor {
  const t = spawnNpc(null, TP.thief, { id: 'thief_1', zone, placeId: 'street', bandId: 'thieves', name: 'Tam', storyId: 'test' });
  s.bands.push({ ...s.bands[0], id: 'thieves', name: 'the light-fingered', relations: {} });
  s.actors.push(t);
  place(s, 'thief_1', zone);
  t.posture = 'stealthy';
  return t;
}
const seen = (s: GameState) => s.player.journal?.stealthSeen?.thief_1;
const search = (target: string | null = null) => ({ intent: intent({ action: { type: 'search', target } }) });

afterEach(() => vi.restoreAllMocks());

describe('221 search', () => {
  it('SE3/SE6: a search won finds the hider, and only then shows its dice', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    thief(s, 'street_square');
    beside(s, 'thief_1', 'player', 2);
    rig(1);
    const ev = play(s, search()).find((e) => e.kind === 'search')!;
    expect(searches(s)).toEqual([{ actorId: 'player', hiderId: 'thief_1', gap: 1 }]);
    expect(seen(s)).toBe('aware');
    expect(ev.contest?.gap).toBe(1);
    expect(ev.effects).toContainEqual({ kind: 'found', actorId: 'thief_1', data: { by: 'player' } });
  });

  it('SE3/SE6: a tie leaves "someone"; a loss changes nothing and reads like an empty spot', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    thief(s, 'street_square');
    beside(s, 'thief_1', 'player', 2);
    rig(0);
    let ev = play(s, search()).find((e) => e.kind === 'search')!;
    expect(seen(s)).toBe('suspicious');
    expect(ev.contest).toBeUndefined();
    delete s.player.journal!.stealthSeen;
    rig(-1);
    ev = play(s, search()).find((e) => e.kind === 'search')!;
    expect(seen(s) ?? 'unaware').toBe('unaware');
    expect(ev.contest).toBeUndefined();
    expect(ev.effects.map((f) => f.kind)).toEqual(['found_nothing']); // BG-142: reads the same as an empty spot
  });

  it('SE6: nothing hidden in reach, nothing rolled', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    rig(1);
    play(s, search());
    expect(searches(s)).toHaveLength(0);
  });

  it('SE20/SE21: outside a fight a big area is searched only around you; a fight turn reaches area ÷ 120 m', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    const t = thief(s, 'street_square');
    const r = s.zones.find((z) => z.id === 'street_square')!.rect!;
    s.player.pos = { x: r.x - r.w / 2 + 0.5, y: r.y };
    t.pos = { x: r.x + r.w / 2 - 0.5, y: r.y }; // across a 400 m² square: beyond the 60 m² around a skill-50 searcher
    rig(1);
    play(s, search());
    expect(searches(s)).toHaveLength(0);
    beside(s, 'thief_1', 'player', 2);
    play(s, search());
    expect(searches(s)).toHaveLength(1);
    // a fight turn: 2 m is beyond the reach of anyone under skill 240 (240 m² ÷ 120 = 2 m)
    delete s.player.journal!.stealthSeen;
    s.mode = 'tactical';
    play(s, search());
    expect(searches(s)).toHaveLength(0);
  });

  it('SE21/SE24: the area grows in a straight line with skill; searchArea % and searchReach m add to it', () => {
    const s = makeVillage();
    const p = s.player;
    expect(searchAreaM2(p, 50)).toBe(60);
    expect(searchAreaM2(p, 100)).toBe(120);
    expect(searchAreaM2(p, 200)).toBe(240);
    const lib = getLibrary();
    lib.perks.test_wide = { id: 'test_wide', name: 'Wide Eyes', searchArea: 50, searchReach: 0.5 } as never;
    p.core.perks.push({ perkId: 'test_wide' } as never);
    try {
      expect(searchAreaM2(p, 50)).toBe(60 * 1.5 + 0.5 * CONFIG.SEARCH_M2_PER_FIGHT_M);
    } finally {
      delete lib.perks.test_wide;
    }
  });

  it('SE14: Look around is also a search against anyone hiding in its range, one tier down', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    thief(s, 'street_square');
    beside(s, 'thief_1', 'player', 10);
    const calls = rig(1);
    play(s, { intent: intent({ action: { type: 'observe', skill: SK.eyesight, target: null } }) });
    expect(searches(s)).toEqual([{ actorId: 'player', hiderId: 'thief_1', gap: 1, look: true }]);
    expect(calls.some((b) => b.tierShifts.some((t) => t.source === 'look around' && t.value === CONFIG.LOOK_SEARCH_SHIFT))).toBe(true);
    expect(seen(s)).toBe('aware');
  });

  it('SE16: an NPC searches by the same rule, and finds the hiding player', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    const g = spawnNpc(null, TP.guard, { id: 'guard_x', zone: 'street_square', placeId: 'street', bandId: 'village_watch', name: 'Bors', storyId: 'test' });
    s.actors.push(g);
    beside(s, 'guard_x', 'player', 2);
    s.player.posture = 'stealthy';
    rig(1);
    play(s, { agentOutputs: [plannerOut('guard_x', act('search'))] });
    expect(searches(s)).toContainEqual({ actorId: 'guard_x', hiderId: 'player', gap: 1 });
    expect(g.mind!.knowledge.player?.status).toBe('aware');
  });
});
