// Test fixture: the test village with a road north out of the gate to Ashford (or to a frontier), drawn on the floor plan.
import type { GameState, TitleSpec } from '../../src/types';
import { ZK } from '../../src/library/tableIds';
import { roadShape } from '../../src/scenario/apply';
import { makeVillage, withWays } from './village';

/** the village with a road of `km` north out of the gate (danger as given) to Ashford's gate, or to a frontier; no slimes
 * (the field's slimes would notice the player on the way); day 1, morning */
export function withRoad(km: number, danger: 'safe' | 'quiet' | 'wild' | 'dangerous' = 'safe', frontier = false): GameState {
  const road: TitleSpec = { id: 'north_road', placeId: 'gate', name: 'the north road', look: 'a cart track', light: 'dark', roof: false, ...roadShape(km, danger),
    ways: [{ to: 'gate_inner', label: 'back to the gate, south', kind: 'open' }, frontier ? { to: 'onward', label: 'onward, north', kind: 'door', frontier: true } : { to: 'ashford_gate', label: 'Ashford, north', kind: 'open' }] };
  const ash: TitleSpec = { id: 'ashford_gate', placeId: 'gate', kind: ZK.gate, name: 'Ashford gate', look: 'a stone arch', light: 'dark', roof: false, area: 100,
    ways: [{ to: 'north_road', label: 'the road south', kind: 'open' }] };
  const s = makeVillage({ playerZone: 'gate_inner', without: ['slime_1', 'slime_2'], shape: { gate_inner: withWays('gate_inner', { to: 'north_road', label: 'the north road', kind: 'open' }) },
    add: frontier ? [road] : [road, ash] });
  s.clocks.time = 7 * 60;
  return s;
}
