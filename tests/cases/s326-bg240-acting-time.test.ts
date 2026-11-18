// 326 BG-240 (SW9 a): an 8-hour wait ended a Situation as "worn out", because its budget counted all game time. Moment,
// Situation and Episode budgets now count only acting time: waiting, resting, sleeping and trips (a road walked in one turn,
// a long walk) are left out, noted on the scenario as idle minutes (and on the outer one). The budgets are sized for turns
// of about 30 seconds (Moment 5, Situation 15, Episode 45 acting minutes); Journey and Venture still count all game time.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { placeZones } from '../../src/scenario/geometry';
import { roadShape } from '../../src/scenario/apply';
import { placeAll } from '../../src/engine/position';
import { budgetUsed, checkScenarioEnd, frameOf, noteIdle } from '../../src/engine/scenarioEnd';
import { buildWeaverView } from '../../src/views';
import { FIXED } from '../../src/agents/prompts';
import { CONFIG } from '../../src/config';
import { ZK } from '../../src/library/tableIds';
import { advanceClock, now } from '../../src/time';
import type { GameState, PlanEnding, Zone } from '../../src/types';

const judged: PlanEnding[] = [{ when: { kind: 'judged' }, as: 'resolved', text: 'x' }, { when: { kind: 'judged' }, as: 'lost', text: 'y' }];
const frame = (s: GameState, scale = 'situation') => { s.stage.scenario = frameOf(s, { question: 'q', stake: 's', scale, endings: judged }, 'success', (_k, r) => r); s.stage.scenario.lastCheckin = s.turn; return s.stage.scenario; };
const tavern = () => makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
/** the test village laid out on the map, with a road north out of the gate to Ashford (or to a frontier) */
function withRoad(km: number, danger: 'safe' | 'quiet' | 'wild' | 'dangerous' = 'safe', frontier = false): GameState {
  const s = makeVillage({ playerZone: 'gate_inner' });
  s.actors = s.actors.filter((a) => !a.id.startsWith('slime')); // the field's slimes would notice the player on the way
  const gate = s.places.flatMap((p) => p.zones).find((z) => z.id === 'gate_inner')!;
  const road: Zone = { id: 'north_road', placeId: 'gate', kind: ZK.road, name: 'the north road', look: 'a cart track', ways: [{ to: 'gate_inner', label: 'back to the gate, south' }], cover: 'none', light: 'dark', outdoor: true, groundItems: [], ...roadShape(km, danger) };
  gate.links.push({ to: 'north_road', label: 'the north road' });
  const zones = [road];
  if (frontier) road.links.push({ to: 'onward', label: 'onward, north', sight: false, frontier: true });
  else {
    const ash: Zone = { id: 'ashford_gate', placeId: 'gate', kind: ZK.gate, name: 'Ashford gate', look: 'a stone arch', ways: [{ to: 'north_road', label: 'the road south' }], cover: 'none', light: 'dark', outdoor: true, area: 100, groundItems: [] };
    road.links.push({ to: 'ashford_gate', label: 'Ashford, north' });
    zones.push(ash);
  }
  s.places.find((p) => p.id === 'gate')!.zones.push(...zones);
  s.zones.push(...zones);
  const all = s.places.flatMap((p) => p.zones);
  for (const z of all) if (!z.area) z.area = CONFIG.ZONE_SIZE_M2[z.id.startsWith('field') ? 'open' : z.id.startsWith('street') || z.id.startsWith('gate') ? 'yard' : 'room'];
  placeZones(s, all);
  placeAll(s);
  s.clocks.time = 7 * 60; // day 1, morning
  return s;
}

describe('326 scenario budgets count acting time (BG-240)', () => {
  it('the budgets fit 30-second turns; the small scales count acting time only, Journey and Venture all game time', () => {
    expect(CONFIG.SCENARIO_SCALE.moment).toMatchObject({ budgetMin: 5, actingOnly: true });
    expect(CONFIG.SCENARIO_SCALE.situation).toMatchObject({ budgetMin: 15, actingOnly: true });
    expect(CONFIG.SCENARIO_SCALE.episode).toMatchObject({ budgetMin: 45, actingOnly: true });
    expect(CONFIG.SCENARIO_SCALE.journey.actingOnly).toBeUndefined();
    expect(CONFIG.SCENARIO_SCALE.venture.actingOnly).toBeUndefined();
    expect(FIXED.weaver).toContain('situation (about 15 min of acting time, not counting waits, rest, sleep or trips');
  });
  it('a long wait inside a Situation leaves it running and uses none of its budget', () => {
    const s = tavern();
    const f = frame(s);
    const t = now(s);
    play(s, { intent: intent({ action: { type: 'wait' } }) });
    expect(now(s) - t).toBeGreaterThan(60);
    expect(f.idleMin).toBeCloseTo(now(s) - t, 0);
    expect(budgetUsed(s, f)).toBeLessThan(0.2);
    checkScenarioEnd(s, []);
    expect(s.stage.ending).toBeUndefined();
    expect(s.log.some((l) => l.code === 'scenario_overrun')).toBe(false);
  });
  it('a rest is left out too', () => {
    const s = tavern();
    const f = frame(s);
    s.player.core.condition.hpLostPct = 50;
    play(s, { intent: intent({ action: { type: 'rest' } }) });
    expect(f.idleMin ?? 0).toBeGreaterThan(0);
    expect(budgetUsed(s, f)).toBeLessThan(0.2);
  });
  it('a road trip is left out, for the outer scenario too', () => {
    const s = withRoad(9);
    const outer = frame(s, 'episode');
    s.stage.outer = outer;
    const f = frame(s, 'moment');
    const t = now(s);
    play(s, { intent: intent({ move: { toZone: 'ashford_gate' } }) });
    expect(s.player.zone).toBe('ashford_gate');
    expect(now(s) - t).toBeGreaterThan(60);
    expect(f.idleMin).toBeGreaterThan(60);
    expect(outer.idleMin).toBe(f.idleMin);
    expect(budgetUsed(s, f)).toBeLessThan(1);
  });
  it('acting time still counts: past the budget the check-in comes, at twice it code ends the scenario', () => {
    const s = tavern();
    const f = frame(s);
    noteIdle(s, 8 * 60);
    advanceClock(s, 8 * 60 + 16);
    expect(budgetUsed(s, f)).toBeCloseTo(16 / 15);
    checkScenarioEnd(s, []);
    expect(s.stage.ending).toBeUndefined();
    advanceClock(s, 15);
    checkScenarioEnd(s, []);
    expect(s.log.find((l) => l.code === 'scenario_overrun')?.detail).toMatchObject({ scale: 'situation' });
  });
  it('a Journey counts its nights and trips', () => {
    const s = tavern();
    const f = frame(s, 'journey');
    noteIdle(s, 24 * 60);
    advanceClock(s, 24 * 60);
    expect(budgetUsed(s, f)).toBeCloseTo(1 / 3);
  });
  it('the check-in sees the budget as acting time', () => {
    const s = tavern();
    frame(s);
    const v = buildWeaverView(s, { kind: 'checkin', placeId: s.player.placeId, reason: 'budget' });
    expect(v.target.scenario!.budget).toBe('15 min of acting time (waits, rest, sleep and trips not counted)');
  });
});
