// 221 Search redesign, people part (SE1–SE24, BG-38: run 40's thief Tam could never be found on purpose). A search is
// a contest of the searcher's better sense after light against the stealth of everyone hiding in reach: a win finds
// them, a tie leaves "someone", a loss changes nothing; nothing hidden, nothing rolled. Look around is a weak search
// (one tier down). NPCs search by the same rule. The ground covered grows with skill and with searchArea/searchReach.
import { TP } from '../../src/library/templateIds';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeVillage, place, beside, westEdge } from '../harness';
import { intent, play, act, plannerOut } from './w4-kit';
import { ruleset } from '../../src/ruleset';
import { spawnNpc } from '../../src/library/spawn';
import { installRoutines, searchAreaM2, searchReach } from '../../src/minds';
import { createRng } from '../harness';
import { getLibrary } from '../../src/library';
import { CONFIG, resetConfig } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { FN } from '../../src/library/functionIds';
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

afterEach(() => { vi.restoreAllMocks(); resetConfig(); }); // smallVillage's radius must not reach other files

describe('221 search', () => {
  it('SE3/SE6: a search won finds the hider, and only then shows its dice', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    thief(s, 'street_square');
    beside(s, 'thief_1', 'player', 2);
    rig(1);
    const ev = play(s, search()).find((e) => e.kind === 'search')!;
    expect(searches(s)).toEqual([{ actorId: 'player', hiderId: 'thief_1', gap: 1, sense: FN.sight }]);
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

  it('LX8 a: inside its area a Search takes SEARCH_AREA_SHIFT, so it beats waiting; a Pat down takes none', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    thief(s, 'street_square');
    beside(s, 'thief_1', 'player', 2);
    let calls = rig(-1);
    play(s, search());
    expect(calls.flatMap((b) => b.tierShifts)).toContainEqual({ source: 'searching', value: CONFIG.SEARCH_AREA_SHIFT });
    vi.restoreAllMocks();
    calls = rig(-1);
    play(s, search('thief_1'));
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.flatMap((b) => b.tierShifts).some((x) => x.source === 'searching')).toBe(false);
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
    expect(searches(s)).toEqual([{ actorId: 'player', hiderId: 'thief_1', gap: -1, sense: FN.sight }]); // past two radii: ring two
    expect(calls[0].tierShifts).toContainEqual({ source: 'searching', value: CONFIG.SEARCH_RING_SHIFTS[1] });
    beside(s, 'thief_1', 'player', 2);
    rig(1);
    play(s, search());
    expect(searches(s)).toEqual([{ actorId: 'player', hiderId: 'thief_1', gap: 1, sense: FN.sight }]); // inside the area, once
    // LX3: a fight turn searches the same circle
    delete s.player.journal!.stealthSeen;
    s.mode = 'tactical';
    play(s, search());
    expect(searches(s)).toEqual([{ actorId: 'player', hiderId: 'thief_1', gap: 1, sense: FN.sight }]);
  });

  it('LX2: the search circle never has a radius under SEARCH_MIN_RADIUS_M, however small its area', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    thief(s, 'street_square');
    beside(s, 'thief_1', 'player', 1.5); // inside 2 m, body edge to body edge
    const r0 = CONFIG.SEARCH_RADIUS_AT_0_M;
    (CONFIG as { SEARCH_RADIUS_AT_0_M: number }).SEARCH_RADIUS_AT_0_M = 0.001; // a few cm of radius
    try {
      const calls = rig(1);
      play(s, search());
      expect(calls[0].tierShifts).toContainEqual({ source: 'searching', value: CONFIG.SEARCH_AREA_SHIFT }); // inside the 2 m floor
    } finally {
      (CONFIG as { SEARCH_RADIUS_AT_0_M: number }).SEARCH_RADIUS_AT_0_M = r0;
    }
  });

  it('LS9 (TL17\'s ladder): the search radius doubles every 50 points from 2 m at 0; searchArea % and searchReach m add to it', () => {
    const s = makeVillage();
    const p = s.player;
    const radius = (skill: number) => Math.sqrt(searchAreaM2(p, skill) / Math.PI);
    expect([0, 50, 100, 150, 200].map((k) => Math.round(radius(k) * 100) / 100)).toEqual([2, 4, 8, 16, 32]);
    const lib = getLibrary();
    lib.perks.test_wide = { id: 'test_wide', name: 'Wide Eyes', searchArea: 50, searchReach: 0.5 } as never;
    p.core.perks.push({ perkId: 'test_wide' } as never);
    try {
      expect(searchAreaM2(p, 50)).toBeCloseTo(Math.PI * 16 * 1.5 + 0.5 * CONFIG.SEARCH_M2_PER_REACH_M);
    } finally {
      delete lib.perks.test_wide;
    }
  });

  it('SE14: Look around is also a search against anyone hiding in its range, one tier down', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    thief(s, 'street_square');
    westEdge(s, 'player');
    beside(s, 'thief_1', 'player', 10);
    const calls = rig(1);
    play(s, { intent: intent({ action: { type: 'observe', skill: SK.eyesight, target: null } }) });
    expect(searches(s)).toEqual([{ actorId: 'player', hiderId: 'thief_1', gap: 1, sense: FN.sight, look: true }]);
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
    expect(searches(s)).toContainEqual({ actorId: 'guard_x', hiderId: 'player', gap: 1, sense: FN.sight });
    expect(g.mind!.knowledge.player?.status).toBe('aware');
  });

  it('SE16: a calm careful patrol searches its stop and finds the player lying in wait; a plain patrol only walks', () => {
    const run = (setId: string) => {
      const s = makeVillage({ playerZone: 'street_square' });
      const g = spawnNpc(null, TP.guard, { id: 'guard_x', zone: 'street_square', placeId: 'street', bandId: 'village_watch', name: 'Bors', storyId: 'test' });
      s.actors.push(g);
      installRoutines(g, setId, { route: ['street_square', 'gate_inner'] }, 'route', s.turn, createRng(1));
      beside(s, 'guard_x', 'player', 2);
      s.player.posture = 'stealthy';
      rig(1);
      play(s);
      vi.restoreAllMocks();
      return { s, g };
    };
    const careful = run('careful_patrol_guard');
    expect(searches(careful.s)).toContainEqual({ actorId: 'guard_x', hiderId: 'player', gap: 1, sense: FN.sight });
    expect(careful.g.mind!.knowledge.player?.status).toBe('aware');
    const plain = run('patrol_guard');
    expect(searches(plain.s).filter((d) => d.actorId === 'guard_x')).toEqual([]);
  });

  /** LX5 b: the village with every search radius at the 2 m floor, so ring one reaches SEARCH_RING1_RADII × 2 m and ring
   * two the look's 25 m; set after makeVillage, which resets CONFIG (afterEach resets it again) */
  function smallVillage(): GameState {
    const s = makeVillage({ playerZone: 'street_square' });
    (CONFIG as { SEARCH_RADIUS_AT_0_M: number }).SEARCH_RADIUS_AT_0_M = 0.001;
    return s;
  }
  const lookShift = (calls: RollRequest[]) => calls.flatMap((b) => b.tierShifts).find((x) => x.source === 'searching')?.value ?? 0; // a ±0 ring adds no shift

  it('LX5 b, LX8 a: past the search area a Search takes ring one\'s shift, past SEARCH_RING1_RADII radii ring two\'s', () => {
    const s = smallVillage();
    expect(searchReach(s, s.player).radiusM).toBe(CONFIG.SEARCH_MIN_RADIUS_M); // BG-341: the small radius really holds
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
  });

  it('LX7 a: an NPC\'s search has the rings too, so a guard finds the hiding player past its search area', () => {
    const s = smallVillage();
    const g = spawnNpc(null, TP.guard, { id: 'guard_x', zone: 'street_square', placeId: 'street', bandId: 'village_watch', name: 'Bors', storyId: 'test' });
    s.actors.push(g);
    beside(s, 'guard_x', 'player', 9); // its search radius is the 2 m floor, ring one ends at 4 m: 9 m is ring two
    s.player.posture = 'stealthy';
    const calls = rig(1);
    play(s, { agentOutputs: [plannerOut('guard_x', act('search'))] });
    expect(calls.flatMap((b) => b.tierShifts)).toContainEqual({ source: 'searching', value: CONFIG.SEARCH_RING_SHIFTS[1] });
    expect(searches(s)).toContainEqual({ actorId: 'guard_x', hiderId: 'player', gap: 1, sense: FN.sight });
    expect(searches(s).length).toBe(1);
    expect(g.mind!.knowledge.player?.status).toBe('aware');
  });

  it('WC1/WC2, LX8 a: inside its area a Search uses up waiting\'s contest; in either ring that contest still runs, and the better counts', () => {
    for (const [m, keeps] of [[1.5, false], [3, true], [9, true]] as const) { // in the 2 m area, ring one (to 4 m), ring two
      vi.restoreAllMocks();
      const s = smallVillage();
      const g = spawnNpc(null, TP.guard, { id: 'guard_x', zone: 'street_square', placeId: 'street', bandId: 'village_watch', name: 'Bors', storyId: 'test' });
      s.actors.push(g);
      beside(s, 'guard_x', 'player', m);
      s.player.posture = 'stealthy';
      let passive = 0;
      const real = ruleset.contested;
      vi.spyOn(ruleset, 'contested').mockImplementation((a, b, st, rng) => {
        if (a.rollKind !== 'stealth') return real(a, b, st, rng);
        if (!a.roles && b.actorId === 'guard_x') passive++;
        const gap = a.roles ? -1 : 1; // the search loses, the passive contest wins
        return { ...real(a, b, st, rng), gap, winner: gap < 0 ? 'a' : 'b' } as ContestResult;
      });
      play(s, { agentOutputs: [plannerOut('guard_x', act('search'))] }, 1); // seed 1: the guard's search goes before the hider's turn
      expect(searches(s).length, `${m} m`).toBeGreaterThan(0);
      expect(passive > 0, `${m} m`).toBe(keeps);
      expect(g.mind!.knowledge.player?.status === 'aware', `${m} m`).toBe(keeps);
    }
  });
});
