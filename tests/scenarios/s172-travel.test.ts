// 172 Travel on the road (TV1–TV8): a move along a road with nothing going on is a trip walked in one turn, leg by leg at
// the pace; it stops on arrival, at dusk (setting off in the dark presses on, slow, with a worse event roll), or at an
// encounter, whose event roll becomes the next scene's tier.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { placeZones } from '../../src/scene/geometry';
import { roadShape } from '../../src/scene/apply';
import { placeAll } from '../../src/engine/position';
import { travelSpeed } from '../../src/engine/travel';
import { buildWeaverView } from '../../src/views';
import { replaySceneStart } from '../../src/scene/director';
import { createRng } from '../harness';
import { CONFIG } from '../../src/config';
import { ZK } from '../../src/library/tableIds';
import { now, timeOfDay } from '../../src/time';
import type { GameState, Zone } from '../../src/types';

/** the test village laid out on the map, with a road north out of the gate to Ashford (or to a frontier) */
function withRoad(km: number, danger: 'safe' | 'quiet' | 'wild' | 'dangerous' = 'safe', frontier = false): GameState {
  const s = makeVillage({ playerZone: 'gate_inner' });
  s.actors = s.actors.filter((a) => !a.id.startsWith('slime')); // the field's slimes would notice the player on the way
  const gate = s.places.flatMap((p) => p.zones).find((z) => z.id === 'gate_inner')!;
  const road: Zone = { id: 'north_road', placeId: 'gate', kind: ZK.road, name: 'the north road', look: 'a cart track', links: [{ to: 'gate_inner', label: 'back to the gate, south', sight: true }], cover: 'none', light: 'dark', outdoor: true, groundItems: [], ...roadShape(km, danger) };
  gate.links.push({ to: 'north_road', label: 'the north road', sight: true });
  const zones = [road];
  if (frontier) road.links.push({ to: 'onward', label: 'onward, north', sight: false, frontier: true });
  else {
    const ash: Zone = { id: 'ashford_gate', placeId: 'gate', kind: ZK.gate, name: 'Ashford gate', look: 'a stone arch', links: [{ to: 'north_road', label: 'the road south', sight: true }], cover: 'none', light: 'dark', outdoor: true, area: 100, groundItems: [] };
    road.links.push({ to: 'ashford_gate', label: 'Ashford, north', sight: true });
    zones.push(ash);
  }
  s.places.find((p) => p.id === 'gate')!.zones.push(...zones);
  s.stage.zoneIds.push(...zones.map((z) => z.id));
  const all = s.places.flatMap((p) => p.zones);
  for (const z of all) if (!z.area) z.area = CONFIG.ZONE_SIZE_M2[z.id.startsWith('field') ? 'open' : z.id.startsWith('street') || z.id.startsWith('gate') ? 'yard' : 'room'];
  placeZones(s, all);
  placeAll(s);
  s.clocks.time = 7 * 60; // day 1, morning
  return s;
}
const trip = (s: GameState) => s.log.find((l) => l.code === 'travelled')?.detail as { metres: number; minutes: number; pace: string; night: boolean; stop: string; companions: string[] } | undefined;
const go = (s: GameState, to: string, pace?: 'slow' | 'normal' | 'fast', seed = 1) => play(s, { intent: intent({ move: { toZone: to, ...(pace ? { pace } : {}) } }) }, seed);

describe('172 travel', () => {
  it('TV1/TV2: a move along a road walks the whole road in one turn at the pace; the clock moves by distance ÷ speed', () => {
    const s = withRoad(9);
    const t0 = now(s);
    const ev = go(s, 'ashford_gate');
    expect(s.player.zone).toBe('ashford_gate');
    const d = trip(s)!;
    expect(d.stop).toBe('arrived');
    expect(d.metres).toBeGreaterThan(9000);
    const speed = travelSpeed(s, s.player, 'normal');
    expect(speed * 3.6).toBeCloseTo(4.5, 1); // a 1.4 m/s walker travels 4.5 km/h at a normal pace
    expect(now(s) - t0).toBeGreaterThanOrEqual(d.metres / speed / 60 - 1);
    expect(ev.filter((e) => e.kind === 'travel')).toHaveLength(1);
    expect(ev.some((e) => e.kind === 'move' && e.actorId === 'player')).toBe(false);
  });

  it('TV2: a fast pace gets there sooner than a slow one', () => {
    const a = withRoad(9), b = withRoad(9);
    go(a, 'ashford_gate', 'fast');
    go(b, 'ashford_gate', 'slow');
    expect(trip(a)!.pace).toBe('fast');
    expect(now(a)).toBeLessThan(now(b));
  });

  it('TV5: a trip that reaches dusk stops there; setting off in the dark presses on, slow, through the dark', () => {
    const s = withRoad(30);
    s.clocks.time = CONFIG.TIME_OF_DAY_FROM.dusk - 30;
    go(s, 'ashford_gate');
    expect(trip(s)!.stop).toBe('nightfall');
    expect(s.player.zone).toBe('north_road');
    expect(timeOfDay(now(s))).toBe('dusk');
    expect(trip(s)!.minutes).toBe(30);
    go(s, 'ashford_gate', 'fast');
    expect(trip(s)!).toMatchObject({ pace: 'fast', night: true, stop: 'arrived' }); // the asked pace, walked slow in the dark
    expect(s.player.zone).toBe('ashford_gate');
  });

  it('TV4: a leg on a road can meet something, by its danger; the encounter\'s event roll is the next scene\'s, worse in the dark', () => {
    const s = withRoad(9, 'dangerous');
    CONFIG.ROAD_ENCOUNTER_PCT = { ...CONFIG.ROAD_ENCOUNTER_PCT, dangerous: 100 };
    go(s, 'ashford_gate');
    expect(trip(s)!.stop).toBe('encounter');
    expect(s.player.zone).toBe('north_road');
    expect(s.stage.breakCause).toBe('encounter');
    expect(s.stage.encounter!.zone).toBe('north_road');
    expect(buildWeaverView(s, { kind: 'scene', placeId: s.player.placeId }).target.encounter).toMatchObject({ zone: 'north_road', danger: 'dangerous' });
    const n = withRoad(9, 'dangerous');
    n.clocks.time = CONFIG.TIME_OF_DAY_FROM.night + 60;
    CONFIG.ROAD_ENCOUNTER_PCT = { ...CONFIG.ROAD_ENCOUNTER_PCT, dangerous: 100 }; // makeVillage resets the config
    go(n, 'ashford_gate');
    expect(n.stage.encounter!.eventRoll.modifiers).toContainEqual({ source: 'night travel', type: 'situational', value: CONFIG.NIGHT_TRAVEL_EVENT_MOD });
    // the next scene starts with the encounter's own roll, not a new one
    const rolled = s.stage.encounter!.eventRoll;
    expect(replaySceneStart(s, [null], createRng(5)).eventRoll).toBe(rolled);
    expect(s.stage.tier).toBe(rolled.tier);
    // the encounter's people stand on the road ahead of the player, not at the road's middle
    n.actors[0].zone = 'north_road'; delete n.actors[0].pos;
    placeAll(n);
    const p = n.player.pos!, q = n.actors[0].pos!;
    expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeLessThan(CONFIG.ENCOUNTER_M + 5);
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
    foe.zone = 'gate_inner'; delete foe.pos; placeAll(s);
    foe.mind!.overrides = { player: 'hostile' };
    foe.mind!.knowledge.player = { status: 'aware', source: 'seen', revealed: [], lastKnownZone: 'gate_inner' } as never;
    go(s, 'ashford_gate');
    expect(trip(s)).toBeUndefined();
    expect(s.player.zone).not.toBe('ashford_gate');
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
    mate.bandId = s.player.bandId; mate.zone = 'gate_inner'; delete mate.pos; placeAll(s);
    mate.core.inventory = []; // no armor: the same speed
    go(s, 'ashford_gate');
    expect(trip(s)!.companions).toEqual(['patron_1']);
    expect(mate.zone).toBe('ashford_gate');
  });
});
