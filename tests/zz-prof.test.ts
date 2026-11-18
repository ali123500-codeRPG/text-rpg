import { it } from 'vitest';
import { makeVillage } from './harness';
import { boxOf } from '../src/plan/geom';
it('dbg', () => {
  for (const shape of [{ street_door: { rect: { x: 0, y: 0, w: 40, d: 10 } }, street_square: { rect: { x: 40, y: 0, w: 20, d: 20 } } }, { field_mid: { rect: { x: 0, y: 0, w: 200, d: 20 } } }]) {
    const s = makeVillage({ shape });
    for (const z of s.zones) console.log('Z', z.id, JSON.stringify(boxOf(z.outline)), z.floor);
  }
});
