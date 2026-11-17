// WI2 a test land: the test village (Brookmere) on its site with a small drawn region around it (s362, s363)
import type { GameState } from '../../src/types';
import { makeVillage } from './village';
import { makeLandWays } from '../../src/scenario/ways';
import { zoneById } from '../../src/engine/relations';
import { RK, ZK } from '../../src/library/tableIds';

const road = (id: string, a: string, b: string) => ({ id, kind: 'road', danger: 'quiet', ends: [a, b], pts: [], length: 2000, crossings: [] });
const site = (id: string, name: string, at: { x: number; y: number }) => ({ id, size: 'village', name, look: '', at, why: '' });
/** Brookmere (the test village) on site s1; a fork at n2 with roads west to Ashwell and north to Hob End; a road east
 * from the village to the region's east edge, where the next region is drawn with the road running on to Eastby */
export function landed(): GameState {
  const s = makeVillage({ playerZone: 'gate_inner' });
  zoneById(s, 'gate_inner')!.kind = ZK.gate;
  s.places.find((p) => p.id === 'village')!.site = 'rg_s1';
  const R = { kind: RK.river_valley, look: '', seed: 1, size: 10000, cell: 100, features: [], heights: [], cover: '', waters: [] };
  s.regions = [{ ...R, id: 'rg', name: 'the Vale', gx: 0, gy: 0, beyond: {},
    nodes: [{ id: 'rg_n1', kind: 'site', at: { x: 5000, y: 5000 }, site: 'rg_s1' }, { id: 'rg_n2', kind: 'junction', at: { x: 4000, y: 6000 } },
      { id: 'rg_n3', kind: 'site', at: { x: 2000, y: 6000 }, site: 'rg_s2' }, { id: 'rg_n4', kind: 'site', at: { x: 4000, y: 8000 }, site: 'rg_s3' },
      { id: 'rg_n5', kind: 'edge', at: { x: 10000, y: 5000 }, side: 'e' }],
    roads: [road('rg_r1', 'rg_n1', 'rg_n2'), road('rg_r2', 'rg_n2', 'rg_n3'), road('rg_r3', 'rg_n2', 'rg_n4'), road('rg_r4', 'rg_n1', 'rg_n5')],
    sites: [{ ...site('rg_s1', 'Brookmere', { x: 5000, y: 5000 }), placeId: 'village' }, site('rg_s2', 'Ashwell', { x: 2000, y: 6000 }), site('rg_s3', 'Hob End', { x: 4000, y: 8000 })] },
  { ...R, id: 'rge', name: 'the Fells', gx: 1, gy: 0, beyond: {},
    nodes: [{ id: 'rge_n1', kind: 'edge', at: { x: 10000, y: 5040 }, side: 'w' }, { id: 'rge_n2', kind: 'site', at: { x: 13000, y: 5000 }, site: 'rge_s1' }],
    roads: [road('rge_r1', 'rge_n1', 'rge_n2')], sites: [site('rge_s1', 'Eastby', { x: 13000, y: 5000 })] }] as never;
  makeLandWays(s, [], [s.places.find((p) => p.id === 'village')!]); // the village, as if just set on its site
  return s;
}
