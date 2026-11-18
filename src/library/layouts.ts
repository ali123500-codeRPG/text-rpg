// CO7/CO17, PZ14 a: prebuilt layouts, small floor plans: a common building's titles, sizes, walls and ways, ready made so
// the Weaver only picks one by id (and may rename its titles). Way labels carry compass words, so code places the titles
// (src/scenario/geometry.ts); a way's kind (up, down) sets floors. A building type can have several layouts; add a row.
import type { LayoutDef } from '../types';
import { FU, LY, WK, ZK } from './tableIds';
import type { PlanFurniture } from '../types';

/** FR1/FR4: a piece of furniture; edge: it stands on that side's edge (a counter), shown on both sides of it */
const f = (kind: string, name: string, at?: string, edge?: true): PlanFurniture => ({ kind, name, ...(at ? { at } : {}), ...(edge ? { edge } : {}) });

export const LAYOUTS: Record<string, LayoutDef> = Object.fromEntries(([
  { id: LY.tavern, name: 'Village tavern', building: 'tavern', entry: 'common', zones: [
    { key: 'common', kind: ZK.room, name: 'common room', look: 'Benches and tables around a hearth; a counter runs along the north side.', size: 'room', walls: { n: WK.low },
      furniture: [f(FU.counter, 'bar counter', 'n', true), f(FU.hearth, 'hearth', 'e'), f(FU.table, 'tables'), f(FU.bench, 'benches', 'sw')],
      ways: [['bar', 'behind the counter, north', 'open'], ['kitchen', 'the kitchen door, west', 'door'], ['yard', 'the back door, east', 'door'], ['upstairs', 'the stairs up', 'up']] },
    { key: 'bar', kind: ZK.room, name: 'behind the counter', look: 'Kegs, cups and a shelf of bottles behind the counter.', size: 'cramped', walls: { s: WK.low },
      furniture: [f(FU.barrels, 'kegs', 'n'), f(FU.shelves, 'shelf of bottles', 'e')],
      ways: [['common', 'over the counter, south', 'open']] },
    { key: 'kitchen', kind: ZK.room, name: 'kitchen', look: 'Pots over a fire, a long table, onions hanging from the beams.', size: 'small',
      furniture: [f(FU.hearth, 'cooking fire', 'w'), f(FU.table, 'long table'), f(FU.shelves, 'pot shelf', 'n')],
      ways: [['common', 'the common room, east', 'door'], ['cellar', 'the cellar hatch, down', 'down']] },
    { key: 'yard', kind: ZK.yard, name: 'back yard', look: 'Stacked firewood and a rain barrel inside a fence.', size: 'yard', walls: { n: WK.fence, e: WK.fence, s: WK.fence },
      furniture: [f(FU.woodpile, 'stacked firewood', 'e'), f(FU.water_barrel, 'rain barrel', 'nw')],
      ways: [['common', 'the back door, west', 'door']] },
    { key: 'upstairs', kind: ZK.corridor, name: 'upstairs landing', look: 'A narrow landing with doors to the rooms let for the night.', size: 'small',
      furniture: [],
      ways: [['common', 'the stairs down', 'down'], ['room1', 'the first door, north', 'door'], ['room2', 'the second door, south', 'door']] },
    // BG-56: the landing's doors lead somewhere: two rooms let for the night
    { key: 'room1', kind: ZK.room, name: 'front room', look: 'A narrow bed, a stool and a shuttered window over the lane.', size: 'cramped',
      furniture: [f(FU.bed, 'narrow bed', 'e'), f(FU.stool, 'stool', 'w')],
      ways: [['upstairs', 'the door to the landing, south', 'door']] },
    { key: 'room2', kind: ZK.room, name: 'back room', look: 'A narrow bed and a chest under the eaves, a window over the yard.', size: 'cramped',
      furniture: [f(FU.bed, 'narrow bed', 'w')],
      ways: [['upstairs', 'the door to the landing, north', 'door']] },
    { key: 'cellar', kind: ZK.cellar, name: 'cellar', look: 'Barrels and sacks in the damp dark.', size: 'room',
      furniture: [f(FU.barrels, 'barrels', 'n'), f(FU.sacks, 'sacks', 'e')],
      ways: [['kitchen', 'the hatch, up', 'up']] },
  ] },
  { id: LY.cottage, name: 'Cottage', building: 'house', entry: 'main', zones: [
    { key: 'main', kind: ZK.room, name: 'main room', look: 'A hearth, a table and a bench in one low room.', size: 'small', walls: { s: WK.glazed },
      furniture: [f(FU.hearth, 'hearth', 'n'), f(FU.table, 'table'), f(FU.bench, 'bench', 'w')],
      ways: [['bed', 'the curtain, north', 'door'], ['garden', 'the back door, east', 'door']] },
    { key: 'bed', kind: ZK.room, name: 'sleeping nook', look: 'A straw bed and a chest behind a curtain.', size: 'cramped',
      furniture: [f(FU.bed, 'straw bed', 'n')],
      ways: [['main', 'the curtain, south', 'door']] },
    { key: 'garden', kind: ZK.yard, name: 'garden', look: 'Rows of cabbages and beans behind a wattle fence.', size: 'small', walls: { n: WK.fence, e: WK.fence, s: WK.fence },
      furniture: [],
      ways: [['main', 'the back door, west', 'door']] },
  ] },
  { id: LY.shop, name: 'Shop', building: 'shop', entry: 'floor', zones: [
    { key: 'floor', kind: ZK.room, name: 'shop floor', look: 'Goods on shelves and hooks; a counter across the back.', size: 'small', walls: { n: WK.low, s: WK.glazed },
      furniture: [f(FU.counter, 'shop counter', 'n', true), f(FU.shelves, 'shelves', 'e'), f(FU.rack, 'hooks of goods', 'w')],
      ways: [['counter', 'behind the counter, north', 'open']] },
    { key: 'counter', kind: ZK.room, name: 'behind the counter', look: 'A strongbox, scales and a ledger behind the counter.', size: 'cramped', walls: { s: WK.low },
      furniture: [f(FU.cupboard, 'strongbox', 'n'), f(FU.table, 'scales and ledger')],
      ways: [['floor', 'over the counter, south', 'open'], ['store', 'the storeroom door, north', 'door']] },
    { key: 'store', kind: ZK.room, name: 'storeroom', look: 'Crates and sacks stacked to the rafters.', size: 'small',
      furniture: [f(FU.crates, 'crates', 'n'), f(FU.sacks, 'sacks', 'e')],
      ways: [['counter', 'the shop, south', 'door']] },
  ] },
  { id: LY.smithy, name: 'Smithy', building: 'smithy', entry: 'forge', zones: [
    { key: 'forge', kind: ZK.room, name: 'forge', look: 'An anvil, a glowing forge and tools on the wall; the south side stands open to the street.', size: 'room', walls: { s: WK.open },
      furniture: [f(FU.forge, 'forge', 'n'), f(FU.anvil, 'anvil'), f(FU.rack, 'tool wall', 'w')],
      ways: [['coal', 'the coal store, east', 'door']] },
    { key: 'coal', kind: ZK.room, name: 'coal store', look: 'Heaps of charcoal and iron bar stock.', size: 'cramped',
      furniture: [f(FU.sacks, 'charcoal heaps', 'e'), f(FU.rack, 'iron bar stock', 'n')],
      ways: [['forge', 'the forge, west', 'door']] },
  ] },
  { id: LY.gatehouse, name: 'Gatehouse', building: 'gate', entry: 'passage', zones: [
    { key: 'passage', kind: ZK.gate, name: 'gate passage', look: 'A stone passage under the gatehouse, gates at both ends.', size: 'small',
      furniture: [],
      ways: [['guard', 'the guard room door, east', 'door'], ['walk', 'the stairs up to the wall', 'up']] },
    { key: 'guard', kind: ZK.room, name: 'guard room', look: 'A table, a brazier and a rack of spears.', size: 'small', walls: { w: WK.glazed },
      furniture: [f(FU.table, 'table'), f(FU.brazier, 'brazier', 'e'), f(FU.rack, 'spear rack', 'n')],
      ways: [['passage', 'the passage, west', 'door']] },
    { key: 'walk', kind: ZK.corridor, name: 'wall walk', look: 'A walkway behind the battlements above the gate.', size: 'small', walls: { n: WK.low, s: WK.low },
      furniture: [],
      ways: [['passage', 'the stairs down', 'down']] },
  ] },
] as LayoutDef[]).map((l) => [l.id, l]));
