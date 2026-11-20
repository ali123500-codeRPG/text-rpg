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
import { boxOf } from '../../src/plan/geom';

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

  it('SE20/SE21, LX2/LX3: the full contest covers only the area around you, the same in a fight; beyond it the look is the weak one', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    const t = thief(s, 'street_square');
    const r = boxOf(s.zones.find((z) => z.id === 'street_square')!.outline);
    s.player.pos = { x: r.x - r.w / 2 + 0.5, y: r.y };
    t.pos = { x: r.x + r.w / 2 - 0.5, y: r.y }; // across a 400 m² square: beyond the 60 m² around a skill-50 searcher
    const calls = rig(-1);
    play(s, search());
    expect(searches(s)).toEqual([{ actorId: 'player', hiderId: 'thief_1', gap: -1, look: true }]); // LX1: only the look's weak check
    expect(calls[0].tierShifts.some((x) => x.source === 'look around')).toBe(true);
    beside(s, 'thief_1', 'player', 2);
    rig(1);
    play(s, search());
    expect(searches(s)).toEqual([{ actorId: 'player', hiderId: 'thief_1', gap: 1 }]); // inside the area: the full contest, once
    // LX3: a fight turn searches the same circle
    delete s.player.journal!.stealthSeen;
    s.mode = 'tactical';
    play(s, search());
    expect(searches(s)).toEqual([{ actorId: 'player', hiderId: 'thief_1', gap: 1 }]);
  });

  it('LX2: the search circle never has a radius under SEARCH_MIN_RADIUS_M, however small its area', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    thief(s, 'street_square');
    beside(s, 'thief_1', 'player', 1.5); // inside 2 m, body edge to body edge
    const area = CONFIG.SEARCH_AREA_M2;
    (CONFIG as { SEARCH_AREA_M2: number }).SEARCH_AREA_M2 = 0.01; // a few cm of radius
    try {
      rig(1);
      play(s, search());
      expect(searches(s)).toEqual([{ actorId: 'player', hiderId: 'thief_1', gap: 1 }]);
    } finally {
      (CONFIG as { SEARCH_AREA_M2: number }).SEARCH_AREA_M2 = area;
    }
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
      expect(searchAreaM2(p, 50)).toBe(60 * 1.5 + 0.5 * CONFIG.SEARCH_M2_PER_REACH_M);
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

  /** LX5 b: with a 2 m search radius (the floor), ring one reaches SEARCH_RING1_RADII × 2 m, ring two the look's 25 m */
  function tinyArea<T>(f: () => T): T {
    const area = CONFIG.SEARCH_AREA_M2;
    (CONFIG as { SEARCH_AREA_M2: number }).SEARCH_AREA_M2 = 0.01;
    try { return f(); } finally { (CONFIG as { SEARCH_AREA_M2: number }).SEARCH_AREA_M2 = area; }
  }
  const lookShift = (calls: RollRequest[]) => calls.flatMap((b) => b.tierShifts).find((x) => x.source === 'look around')?.value;

  it('LX5 b: past the search area a Search takes ring one\'s shift, past SEARCH_RING1_RADII radii ring two\'s', () => tinyArea(() => {
    const s = makeVillage({ playerZone: 'street_square' });
    const t = thief(s, 'street_square');
    beside(s, 'thief_1', 'player', 3.2); // past 2 m, inside 4 m
    let calls = rig(-1);
    play(s, search());
    expect(lookShift(calls)).toBe(CONFIG.SEARCH_RING_SHIFTS[0]);
    const r = boxOf(s.zones.find((z) => z.id === 'street_square')!.outline);
    s.player.pos = { x: r.x - r.w / 2 + 0.5, y: r.y };
    t.pos = { x: r.x + r.w / 2 - 0.5, y: r.y }; // across the square, well past 4 m
    vi.restoreAllMocks();
    calls = rig(-1);
    play(s, search());
    expect(lookShift(calls)).toBe(CONFIG.SEARCH_RING_SHIFTS[1]);
  }));

  it('LX7 a: an NPC\'s search has the rings too, so a guard finds the hiding player past its search area', () => tinyArea(() => {
    const s = makeVillage({ playerZone: 'street_square' });
    const g = spawnNpc(null, TP.guard, { id: 'guard_x', zone: 'street_square', placeId: 'street', bandId: 'village_watch', name: 'Bors', storyId: 'test' });
    s.actors.push(g);
    beside(s, 'guard_x', 'player', 9); // its perks' searchReach (120 m²) give it a radius of 6.2 m
    s.player.posture = 'stealthy';
    rig(1);
    play(s, { agentOutputs: [plannerOut('guard_x', act('search'))] });
    expect(searches(s)).toContainEqual({ actorId: 'guard_x', hiderId: 'player', gap: 1, look: true });
    expect(g.mind!.knowledge.player?.status).toBe('aware');
  }));
});
