// PS-486 to PS-489: the play screen's backdrops: public-domain paintings shown behind the play screen, picked by where the player
// stands. Each row is one picture file, src/ui/assets/backdrops/<id>.webp (credits and sources: docs/assets.md). `kinds`
// lists the zone kinds (ZK) it suits, and ROAD for a road, which has no kind. `night`: a moonlit scene, kept for the
// open air after dark. `regions`: the region kinds (RK) whose open land it suits; on that land it is preferred.
// A new picture is one row here plus its file; nothing else changes.
import { RK, ZK } from './tableIds';

/** a road's title has no zone kind (PZ9); its pictures list this instead */
export const ROAD = 'road';

export type Backdrop = { id: string; kinds: readonly string[]; night?: true; regions?: readonly string[] };

export const BACKDROPS: readonly Backdrop[] = [
  { id: 'room-teniers-country-pub', kinds: [ZK.room] },
  { id: 'room-teniers-herberg', kinds: [ZK.room] },
  { id: 'stairs-rembrandt-philosopher', kinds: [ZK.stairs, ZK.room, ZK.corridor] },
  { id: 'corridor-dewitte-oude-kerk', kinds: [ZK.corridor, ZK.room] },
  { id: 'stairs-piranesi-well', kinds: [ZK.stairs, ZK.cellar, ZK.corridor] },
  { id: 'cellar-piranesi-shell-arch', kinds: [ZK.cellar, ZK.stairs, ZK.corridor] },
  { id: 'cellar-wright-cavern', kinds: [ZK.cellar] },
  { id: 'street-grimshaw-moonlight', kinds: [ZK.street, ZK.yard], night: true },
  { id: 'gate-perov-last-tavern', kinds: [ZK.gate, ZK.street] },
  { id: 'square-berckheyde-grote-markt', kinds: [ZK.square, ZK.street] },
  { id: 'gate-sandby-west-gate', kinds: [ZK.gate, ZK.square] },
  { id: 'gate-zais-vaulted-ruins', kinds: [ZK.gate, ZK.yard] },
  { id: 'yard-durrie-farmyard-winter', kinds: [ZK.yard] },
  { id: 'yard-rowlandson-farmyard', kinds: [ZK.yard] },
  { id: 'field-bruegel-harvesters', kinds: [ZK.field], regions: [RK.river_valley] },
  { id: 'field-constable-hay-wain', kinds: [ZK.field], regions: [RK.river_valley] },
  { id: 'field-friedrich-lonely-tree', kinds: [ZK.field], regions: [RK.upland_moor] },
  { id: 'moor-danby-heath-sunset', kinds: [ZK.field, ROAD], regions: [RK.upland_moor] },
  { id: 'moor-friedrich-dolmen-snow', kinds: [ZK.field, ZK.woods], regions: [RK.upland_moor] },
  { id: 'woods-hobbema-wooded-landscape', kinds: [ZK.woods], regions: [RK.forest, RK.river_valley] },
  { id: 'woods-constable-hampstead-storm', kinds: [ZK.woods, ZK.field], regions: [RK.forest] },
  { id: 'woods-friedrich-abbey-oakwood', kinds: [ZK.woods, ZK.yard], regions: [RK.forest] },
  { id: 'road-constable-wooded-slope', kinds: [ROAD, ZK.woods] },
  { id: 'night-vanderneer-moonlit-bridge', kinds: [ZK.field, ZK.woods, ROAD], night: true },
];
