// 406 Search by sound (D-411: LS1–LS8). Each sense reaches a hider by its own rule and makes its own test (LS6): sight a
// clear line out to the look's 25 m, hearing the hider's own sound above the hearing floor (a step, else the faint sound
// of keeping still, LS2) with the search's own dB (LS3), smell its usual reach (LS8). The same rings by distance for
// every sense (LS7). A hider found by sound and still heard shows where they are, as someone (LS4).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TP } from '../../src/library/templateIds';
import { makeVillage, place, beside } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';
import { ruleset } from '../../src/ruleset';
import { spawnNpc } from '../../src/library/spawn';
import { CONFIG } from '../../src/config';
import { FN } from '../../src/library/functionIds';
import { SK } from '../../src/library/skillIds';
import { drawTitles } from '../../src/plan/draw';
import { WK } from '../../src/library/tableIds';
import type { Actor, ContestResult, GameEvent, GameState } from '../../src/types';

/** forces every search contest's gap */
function rig(gap: number) {
  const real = ruleset.contested;
  vi.spyOn(ruleset, 'contested').mockImplementation((a, b, st, rng) => {
    if (a.rollKind !== 'stealth') return real(a, b, st, rng);
    const g = a.roles ? gap : -1; // passive contests here go to the hider
    return { ...real(a, b, st, rng), gap: g, winner: g < 0 ? 'a' : g > 0 ? 'b' : 'tie' } as ContestResult;
  });
}
const tests = (s: GameState) => s.log.filter((l) => l.code === 'search_contest').map((l) => l.detail!.sense);
function thief(s: GameState, zone: string): Actor {
  const t = spawnNpc(null, TP.thief, { id: 'thief_1', zone, placeId: 'street', bandId: 'thieves', name: 'Tam', storyId: 'test' });
  s.bands.push({ ...s.bands[0], id: 'thieves', name: 'the light-fingered', relations: {} });
  s.actors.push(t);
  place(s, 'thief_1', zone);
  t.posture = 'stealthy';
  return t;
}
const search = () => ({ intent: intent({ action: { type: 'search', target: null } }) });
/** the thief's step in the turn just played, kept as the game keeps last turn's events */
const stepped = (s: GameState, noise: GameEvent['noise']) => { s.recentEvents = [{ id: 'm', turn: s.pending.turn - 1, actorId: 'thief_1', kind: 'move', zone: 'y1', effects: [], noise, visibility: 'normal', perception: {} } as GameEvent]; };
/** two rooms side by side, a wall between them with an open doorway near its middle; the player and the thief stand off
 * its line, so no sight passes, but a step's sound goes round through the doorway */
function roundTheCorner(): { s: GameState; t: Actor } {
  const s = makeVillage();
  drawTitles(s, [0, 1].map((i) => ({ id: `y${i}`, placeId: 'street', name: `room ${i}`, look: '', roof: false, light: 'bright',
    rect: { x: 200 + 10 * i, y: 200, w: 10, d: 10 }, ...(i === 0 ? { walls: { e: WK.wall } } : {}), ways: i === 0 ? [{ to: 'y1', label: 'the next room', kind: 'door', doorless: true }] : [] })) as never);
  Object.assign(s.player, { zone: 'y0', placeId: 'street', pos: { x: 203, y: 203.5 } });
  const t = thief(s, 'y1');
  t.pos = { x: 207, y: 203.5 };
  return { s, t };
}

afterEach(() => vi.restoreAllMocks());

describe('406 search by sound', () => {
  it('LS2 a: a still hider is heard only at arm\'s length (faint); past it only sight tests', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    thief(s, 'street_square');
    s.player.core.skills[SK.earshot] = { raw: 50, state: 'normal' } as never; // the search's own dB is 0 at skill 50 (LS3)
    beside(s, 'thief_1', 'player', 0.8);
    rig(-1);
    play(s, search());
    expect(tests(s)).toEqual([FN.sight, FN.hearing]); // LS6: each sense that reaches is its own test
    beside(s, 'thief_1', 'player', 3);
    play(s, search());
    expect(tests(s)).toEqual([FN.sight]);
  });

  it('LS1/LS2: a step round the corner is heard through the doorway though no sight passes; a still hider there is not', () => {
    const { s } = roundTheCorner();
    rig(1);
    stepped(s, 'quiet');
    play(s, search());
    expect(tests(s)).toEqual([FN.hearing]);
    expect(s.player.journal?.stealthSeen?.thief_1).toBe('aware'); // LS4 a: a find by sound makes you aware
    delete s.player.journal!.stealthSeen;
    s.recentEvents = [];
    play(s, search());
    expect(tests(s)).toEqual([]);
  });

  it('LS3 a: the search hears further with skill: 10·log10(area ÷ SEARCH_AREA_M2) dB', () => {
    const { s } = roundTheCorner();
    rig(-1);
    stepped(s, 'faint'); // 20 dB: not heard round the corner at skill 50
    play(s, search());
    expect(tests(s)).toEqual([]);
    s.player.core.skills[SK.earshot] = { ...s.player.core.skills[SK.earshot], raw: 5000 } as never; // +20 dB
    stepped(s, 'faint');
    play(s, search());
    expect(tests(s)).toEqual([FN.hearing]);
  });

  it('LS6: each sense is its own test and the best counts; LS8 a: smell is one where it reaches (a wolf\'s nose)', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    const w = spawnNpc(null, TP.wolf, { id: 'wolf_x', zone: 'street_square', placeId: 'street', bandId: 'wolves', name: 'Grey', storyId: 'test' });
    s.bands.push({ ...s.bands[0], id: 'wolves', name: 'the pack', relations: {} });
    s.actors.push(w);
    beside(s, 'wolf_x', 'player', 3);
    s.player.posture = 'stealthy';
    rig(1);
    play(s, { agentOutputs: [plannerOut('wolf_x', act('search'))] });
    const mine = s.log.filter((l) => l.code === 'search_contest' && l.detail?.actorId === 'wolf_x').map((l) => l.detail!.sense);
    expect(mine).toContain(FN.smell);
    expect(mine.length).toBeGreaterThan(1);
    expect(w.mind!.knowledge.player?.status).toBe('aware');
  });

  it('LS7 a: hearing takes the same rings by distance as sight', () => {
    const { s } = roundTheCorner();
    const calls: number[] = [];
    const real = ruleset.contested;
    vi.spyOn(ruleset, 'contested').mockImplementation((a, b, st, rng) => {
      if (a.rollKind === 'stealth' && a.roles) calls.push((b.tierShifts ?? []).find((x) => x.source === 'searching')?.value ?? 0);
      return real(a, b, st, rng);
    });
    stepped(s, 'loud');
    play(s, search());
    // 5.2 m round through the doorway; Earshot 20 gives a 2.8 m search radius, so ring one (out to 5.5 m)
    expect(calls).toEqual([CONFIG.SEARCH_RING_SHIFTS[0]]);
    vi.restoreAllMocks();
    calls.length = 0;
    vi.spyOn(ruleset, 'contested').mockImplementation((a, b, st, rng) => {
      if (a.rollKind === 'stealth' && a.roles) calls.push((b.tierShifts ?? []).find((x) => x.source === 'searching')?.value ?? 0);
      return real(a, b, st, rng);
    });
    s.player.core.skills[SK.earshot] = { raw: 100, state: 'normal' } as never; // a 6.2 m radius
    delete s.player.journal?.stealthSeen;
    stepped(s, 'loud');
    play(s, search());
    expect(calls).toEqual([CONFIG.SEARCH_AREA_SHIFT]);
  });

});
