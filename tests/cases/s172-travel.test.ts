// 172 Travel on the road (TV1–TV8): a move along a road with nothing going on is a trip walked in one turn, leg by leg at
// one pace (SR5); it stops on arrival, at dusk (setting off in the dark presses on, slower, with a worse event roll), or at an
// encounter, whose event roll becomes the next scenario's tier. Each hour of it adds strain to the long-term bar (SR5).
import { describe, expect, it } from 'vitest';
import { makeVillage, withRoad } from '../harness';
import { middle } from '../../src/plan/where';
import { intent, play } from './w4-kit';
import { roadShape } from '../../src/scenario/apply';
import { placeAll } from '../../src/engine/position';
import { travelSpeed } from '../../src/engine/travel';
import { buildWeaverView } from '../../src/views';
import { replayScenarioStart } from '../../src/scenario/director';
import { createRng } from '../harness';
import { CONFIG } from '../../src/config';
import { ZK } from '../../src/library/tableIds';
import { now, timeOfDay } from '../../src/time';
import { fatigueOf } from '../../src/ruleset/fatigue';
import type { GameState, Zone } from '../../src/types';

const trip = (s: GameState) => s.log.find((l) => l.code === 'travelled')?.detail as { metres: number; minutes: number; night: boolean; stop: string; companions: string[] } | undefined;
const go = (s: GameState, to: string, seed = 1) => play(s, { intent: intent({ move: { toZone: to } }) }, seed);

describe('172 travel', () => {
  it('TV1/TV2: a move along a road walks the whole road in one turn at one pace; the clock moves by distance ÷ speed', () => {
    const s = withRoad(9);
    const t0 = now(s);
    const ev = go(s, 'ashford_gate');
    expect(s.player.zone).toBe('ashford_gate');
    const d = trip(s)!;
    expect(d.stop).toBe('arrived');
    expect(d.metres).toBeGreaterThan(9000);
    const speed = travelSpeed(s, s.player);
    expect(speed * 3.6).toBeCloseTo(4.5, 1); // a 1.4 m/s walker travels 4.5 km/h
    expect(now(s) - t0).toBeGreaterThanOrEqual(d.metres / speed / 60 - 1);
    expect(ev.filter((e) => e.kind === 'travel')).toHaveLength(1);
    expect(ev.some((e) => e.kind === 'move' && e.actorId === 'player')).toBe(false);
  });

  it('SR5: each hour of travel adds TRAVEL_STRAIN_PER_HOUR to the long-term bar, whatever the armour, on top of hours awake', () => {
    const s = withRoad(9);
    s.player.core.condition.fatigue = { debt: 0, line: 0 };
    go(s, 'ashford_gate');
    const hours = trip(s)!.minutes / 60;
    const awake = (CONFIG.SLEEP_DEBT_FLAT + (CONFIG.SLEEP_DEBT_PCT / 100) * CONFIG.STAMINA_BASE) * hours;
    expect(hours).toBeGreaterThan(1);
    expect(fatigueOf(s.player).debt).toBeCloseTo(awake + CONFIG.TRAVEL_STRAIN_PER_HOUR * hours, 1);
  });

  it('TV5: a trip that reaches dusk stops there; setting off in the dark presses on, slower, through the dark', () => {
    const s = withRoad(30);
    s.clocks.time = CONFIG.TIME_OF_DAY_FROM.dusk - 30;
    go(s, 'ashford_gate');
    expect(trip(s)!.stop).toBe('nightfall');
    expect(s.player.zone).toBe('north_road');
    expect(timeOfDay(now(s))).toBe('dusk');
    expect(trip(s)!.minutes).toBe(30);
    go(s, 'ashford_gate', 2); // a seed with no encounter on the night road
    expect(trip(s)!).toMatchObject({ night: true, stop: 'arrived' });
    expect(trip(s)!.metres / (trip(s)!.minutes * 60)).toBeCloseTo(travelSpeed(s, s.player, true), 1); // walked slower in the dark
    expect(s.player.zone).toBe('ashford_gate');
  });

  it('TV4: a leg on a road can meet something, by its danger; the encounter\'s event roll is the next scenario\'s, worse in the dark', () => {
    const s = withRoad(9, 'dangerous');
    CONFIG.ROAD_ENCOUNTER_PCT = { ...CONFIG.ROAD_ENCOUNTER_PCT, dangerous: 100 };
    go(s, 'ashford_gate');
    expect(trip(s)!.stop).toBe('encounter');
    expect(s.player.zone).toBe('north_road');
    expect(s.stage.breakCause).toBe('encounter');
    expect(s.stage.encounter!.zone).toBe('north_road');
    expect(buildWeaverView(s, { kind: 'scenario', placeId: s.player.placeId }).target.encounter).toMatchObject({ zone: 'north_road', danger: 'dangerous' });
    const n = withRoad(9, 'dangerous');
    n.clocks.time = CONFIG.TIME_OF_DAY_FROM.night + 60;
    CONFIG.ROAD_ENCOUNTER_PCT = { ...CONFIG.ROAD_ENCOUNTER_PCT, dangerous: 100 }; // makeVillage resets the config
    go(n, 'ashford_gate');
    expect(n.stage.encounter!.eventRoll.modifiers).toContainEqual({ source: 'night travel', type: 'situational', value: CONFIG.NIGHT_TRAVEL_EVENT_MOD });
    // the next scenario starts with the encounter's own roll, not a new one
    const rolled = s.stage.encounter!.eventRoll;
    expect(replayScenarioStart(s, [null], createRng(5)).eventRoll).toBe(rolled);
    expect(s.stage.tier).toBe(rolled.tier);
    // RE6: the encounter's people stand on the road ahead of the player where a still figure is first glimpsed (60 m)
    n.actors[0].zone = 'north_road'; delete n.actors[0].pos;
    placeAll(n);
    const p = n.player.pos!, q = n.actors[0].pos!;
    expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(CONFIG.SIGHT_M[CONFIG.ENCOUNTER_VISIBILITY]![1] - 5);
    expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeLessThan(CONFIG.SIGHT_M[CONFIG.ENCOUNTER_VISIBILITY]![1] + 5);
  });

  it('RE1 (BG-291): road minutes carry over from trip to trip; each full leg of them rolls once, then the count starts again', () => {
    // a 3 km road is 40 min: one trip never fills a leg, the second one meets something 20 min in
    const s = withRoad(3, 'dangerous');
    CONFIG.ROAD_ENCOUNTER_PCT = { ...CONFIG.ROAD_ENCOUNTER_PCT, dangerous: 100 };
    go(s, 'ashford_gate');
    expect(trip(s)!.stop).toBe('arrived');
    expect(s.player.roadMin).toBeCloseTo(40, 0);
    s.log.length = 0;
    go(s, 'gate_inner', 2);
    expect(trip(s)!.stop).toBe('encounter');
    expect(trip(s)!.minutes).toBe(20);
    expect(s.player.zone).toBe('north_road');
    expect(s.player.roadMin).toBe(0);
    // the roll is the road's chance for a full leg: at 0% nothing meets you and the count still starts again
    const q = withRoad(3, 'dangerous');
    CONFIG.ROAD_ENCOUNTER_PCT = { ...CONFIG.ROAD_ENCOUNTER_PCT, dangerous: 0 };
    q.player.roadMin = 50;
    go(q, 'ashford_gate');
    expect(trip(q)!.stop).toBe('arrived');
    expect(q.player.roadMin).toBeCloseTo(30, 0);
  });

  it('a safe road can still be walked without stopping; the mechanics line and the Narrator get one passage', () => {
    const s = withRoad(4.5);
    const ev = go(s, 'ashford_gate');
    const t = ev.find((e) => e.kind === 'travel')!;
    expect(t.effects[0]).toMatchObject({ kind: 'travelled', actorId: 'player' });
    expect(s.log.some((l) => l.code === 'time_passed')).toBe(true);
  });

  it('TV1: with someone hostile who perceives the player it is a normal move, a step at a time', () => {
    const s = withRoad(9);
    const foe = s.actors.find((a) => a.id === 'patron_1')!;
    foe.zone = 'gate_inner'; foe.placeId = 'gate'; delete foe.pos; placeAll(s);
    foe.mind!.overrides = { player: 'hostile' };
    foe.mind!.knowledge.player = { status: 'aware', source: 'seen', revealed: [], lastKnownZone: 'gate_inner' } as never;
    go(s, 'ashford_gate');
    expect(trip(s)).toBeUndefined();
    expect(s.player.zone).not.toBe('ashford_gate');
  });

  it('RE5: a trip runs on the world clock: someone new seen on the road ahead stops it there, as a rest or a walk stops', () => {
    const s = withRoad(9);
    const x = s.actors.find((a) => a.id === 'patron_1')!;
    const road = s.zones.find((z) => z.id === 'north_road')!;
    x.zone = 'north_road'; x.placeId = 'gate'; x.pos = middle(road);
    const t0 = now(s);
    const ev = go(s, 'ashford_gate');
    const d = trip(s)!;
    expect(d.stop).toBe('met');
    expect(s.player.zone).toBe('north_road');
    expect(s.log.find((l) => l.code === 'stretch_stopped')?.detail).toMatchObject({ kind: 'trip', why: 'appeared', by: ['patron_1'] });
    expect(ev.find((e) => e.kind === 'travel')!.effects).toContainEqual(expect.objectContaining({ kind: 'stopped', actorId: 'player' }));
    const p = s.player.pos!, q = x.pos!;
    expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeLessThan(500); // stopped where they came into sight, not past them
    expect(now(s) - t0).toBeLessThan(9000 / travelSpeed(s, s.player) / 60); // the clock ran only that far
  });

  it('TV3: a frontier off the road is at the road\'s far end: the trip walks there, then crosses', () => {
    const s = withRoad(4.5, 'safe', true);
    go(s, 'north_road');
    expect(s.player.zone).toBe('north_road');
    go(s, 'onward');
    expect(trip(s)!.metres).toBeGreaterThan(4000);
    expect(s.scratch?.frontierCrossed).toBe('onward');
  });

  it('TV6: a bandmate together with the player travels along, at the slower of the two speeds', () => {
    const s = withRoad(9);
    const mate = s.actors.find((a) => a.id === 'patron_1')!;
    mate.bandId = s.player.bandId; mate.zone = 'gate_inner'; mate.placeId = 'gate'; delete mate.pos; placeAll(s);
    mate.core.inventory = []; // no armor: the same speed
    go(s, 'ashford_gate');
    expect(trip(s)!.companions).toEqual(['patron_1']);
    expect(mate.zone).toBe('ashford_gate');
  });
});
