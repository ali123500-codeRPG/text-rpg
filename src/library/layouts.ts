// CO7/CO17 prebuilt layouts: a common building's zones, sizes, sides and exits, ready made so the Weaver only picks one
// by id (and may rename its zones). Exit labels carry compass words, so code places the zones (src/scenario/geometry.ts);
// up and down words set heights. A building type can have several layouts; add a row to add one.
import type { LayoutDef } from '../types';
import { EK, LY, ZK } from './tableIds';

export const LAYOUTS: Record<string, LayoutDef> = Object.fromEntries(([
  { id: LY.tavern, name: 'Village tavern', building: 'tavern', entry: 'common', zones: [
    { key: 'common', kind: ZK.room, name: 'common room', look: 'Benches and tables around a hearth; a counter runs along the north side.', size: 'room', background: 'busy', edges: { n: EK.low },
      links: [['bar', 'behind the counter, north', true], ['kitchen', 'the kitchen door, west', false], ['yard', 'the back door, east', false], ['upstairs', 'the stairs up', false]] },
    { key: 'bar', kind: ZK.room, name: 'behind the counter', look: 'Kegs, cups and a shelf of bottles behind the counter.', size: 'cramped', background: 'busy', edges: { s: EK.low },
      links: [['common', 'over the counter, south', true]] },
    { key: 'kitchen', kind: ZK.room, name: 'kitchen', look: 'Pots over a fire, a long table, onions hanging from the beams.', size: 'small',
      links: [['common', 'the common room, east', false], ['cellar', 'the cellar hatch, down', false]] },
    { key: 'yard', kind: ZK.yard, name: 'back yard', look: 'Stacked firewood and a rain barrel inside a fence.', size: 'yard', edges: { n: EK.low, e: EK.low, s: EK.low },
      links: [['common', 'the back door, west', false]] },
    { key: 'upstairs', kind: ZK.corridor, name: 'upstairs landing', look: 'A narrow landing with doors to the rooms let for the night.', size: 'small',
      links: [['common', 'the stairs down', false], ['room1', 'the first door, north', false], ['room2', 'the second door, south', false]] },
    // BG-56: the landing's doors lead somewhere: two rooms let for the night
    { key: 'room1', kind: ZK.room, name: 'front room', look: 'A narrow bed, a stool and a shuttered window over the lane.', size: 'cramped',
      links: [['upstairs', 'the door to the landing, south', false]] },
    { key: 'room2', kind: ZK.room, name: 'back room', look: 'A narrow bed and a chest under the eaves, a window over the yard.', size: 'cramped',
      links: [['upstairs', 'the door to the landing, north', false]] },
    { key: 'cellar', kind: ZK.cellar, name: 'cellar', look: 'Barrels and sacks in the damp dark.', size: 'room',
      links: [['kitchen', 'the hatch, up', false]] },
  ] },
  { id: LY.cottage, name: 'Cottage', building: 'house', entry: 'main', zones: [
    { key: 'main', kind: ZK.room, name: 'main room', look: 'A hearth, a table and a bench in one low room.', size: 'small', edges: { s: EK.window },
      links: [['bed', 'the curtain, north', false], ['garden', 'the back door, east', false]] },
    { key: 'bed', kind: ZK.room, name: 'sleeping nook', look: 'A straw bed and a chest behind a curtain.', size: 'cramped',
      links: [['main', 'the curtain, south', false]] },
    { key: 'garden', kind: ZK.yard, name: 'garden', look: 'Rows of cabbages and beans behind a wattle fence.', size: 'small', edges: { n: EK.low, e: EK.low, s: EK.low },
      links: [['main', 'the back door, west', false]] },
  ] },
  { id: LY.shop, name: 'Shop', building: 'shop', entry: 'floor', zones: [
    { key: 'floor', kind: ZK.room, name: 'shop floor', look: 'Goods on shelves and hooks; a counter across the back.', size: 'small', edges: { n: EK.low, s: EK.window },
      links: [['counter', 'behind the counter, north', true]] },
    { key: 'counter', kind: ZK.room, name: 'behind the counter', look: 'A strongbox, scales and a ledger behind the counter.', size: 'cramped', edges: { s: EK.low },
      links: [['floor', 'over the counter, south', true], ['store', 'the storeroom door, north', false]] },
    { key: 'store', kind: ZK.room, name: 'storeroom', look: 'Crates and sacks stacked to the rafters.', size: 'small',
      links: [['counter', 'the shop, south', false]] },
  ] },
  { id: LY.smithy, name: 'Smithy', building: 'smithy', entry: 'forge', zones: [
    { key: 'forge', kind: ZK.room, name: 'forge', look: 'An anvil, a glowing forge and tools on the wall; the south side stands open to the street.', size: 'room', edges: { s: EK.open },
      links: [['coal', 'the coal store, east', false]] },
    { key: 'coal', kind: ZK.room, name: 'coal store', look: 'Heaps of charcoal and iron bar stock.', size: 'cramped',
      links: [['forge', 'the forge, west', false]] },
  ] },
  { id: LY.gatehouse, name: 'Gatehouse', building: 'gate', entry: 'passage', zones: [
    { key: 'passage', kind: ZK.gate, name: 'gate passage', look: 'A stone passage under the gatehouse, gates at both ends.', size: 'small',
      links: [['guard', 'the guard room door, east', false], ['walk', 'the stairs up to the wall', false]] },
    { key: 'guard', kind: ZK.room, name: 'guard room', look: 'A table, a brazier and a rack of spears.', size: 'small', edges: { w: EK.window },
      links: [['passage', 'the passage, west', false]] },
    { key: 'walk', kind: ZK.corridor, name: 'wall walk', look: 'A walkway behind the battlements above the gate.', size: 'small', edges: { n: EK.low, s: EK.low },
      links: [['passage', 'the stairs down', false]] },
  ] },
] as LayoutDef[]).map((l) => [l.id, l]));
