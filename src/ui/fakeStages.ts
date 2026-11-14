// The stage map's test stages (rpg-map MAP-52), for the fake preview only: ?fake=1&stage=bent-nail|one-room|long-names.
// Each is a stage as the Weaver hands it over (zones, sizes, places, links: no positions), placed by the same code the
// game uses (placeZones), with what the character knows of it. Not game content.
import type { Barrier, GameState, Zone } from '../types';
import { placeZones } from '../scenario/geometry';
import { inferHeights } from '../scenario/heights';
import { BK, EK, FU, ZK } from '../library/tableIds';
import { getLibrary } from '../library';
import { makeFurniture } from '../engine/furniture';

type Place = GameState['places'][number];
export type FakeStage = {
  places: Place[]; zone: string; placeId: string; seen: string[]; trail: string[];
  /** where you stand, metres from your zone's centre (east, north) */
  you: [number, number];
  /** who is about: a stranger label, their zone, and metres from its centre when the character sees exactly where */
  people: { id: string; label: string; zone: string; at?: [number, number] }[];
  barriers: { id: string; a: string; b: string; rec: Omit<Barrier, 'id'> }[];
};

const Z = (id: string, placeId: string, name: string, kind: string, area: number, links: [string, string, boolean?][], extra: Partial<Zone> = {}): Zone => {
  const edge = getLibrary().zoneKinds?.[kind]?.edge ?? EK.wall;
  return { id, placeId, name, look: '', kind, area, outdoor: [ZK.street, ZK.square, ZK.yard, ZK.field, ZK.woods, ZK.road, ZK.gate].includes(kind as never),
    links: links.map(([to, label, sight = false]) => ({ to, label, sight })), cover: 'some', light: 'dim', groundItems: [],
    edges: { n: edge, e: edge, s: edge, w: edge }, ...extra } as Zone;
};
const P = (id: string, kind: string, parentId: string | null, name: string, zones: Zone[]): Place =>
  ({ id, storyId: 'fake', kind, parentId, names: { current: name, past: [] }, zones, state: {}, headlines: [] }) as Place;
function placed(places: Place[]): Place[] {
  const st = { places } as GameState, zones = places.flatMap((p) => p.zones);
  inferHeights(st, zones);
  placeZones(st, zones);
  return places;
}

/** the rectangles the live story's save holds for the Bent Nail and Thornbury, placed before the layout fixes: the
 *  common room and the bar on either side of the high lane */
const SAVED: Record<string, [number, number, number, number]> = {
  'tavern.common': [0, -8.873, 7.746, 7.746], 'tavern.bar': [0, 7, 3, 3], 'tavern.kitchen': [-6.373, -8.873, 5, 5], 'tavern.yard': [13.873, -15, 20, 20],
  'tavern.upstairs': [0, -8.873, 10, 2.5], 'tavern.room1': [0, -6.123, 3, 3], 'tavern.room2': [0, -11.623, 3, 3], 'tavern.cellar': [-6.373, -8.873, 7.746, 7.746],
  high_lane: [0, 0, 40, 10], midden_yard: [22.5, 0, 5, 5],
};

/** (a) the Bent Nail beside the high lane, with the hidden midden yard and its locked plank gate (the live story's stage);
 *  `saved`: as the live save holds it, else placed fresh by today's layout code */
function bentNail(saved = false): FakeStage {
  const withSaved = (ps: Place[]) => { if (saved) for (const z of ps.flatMap((p) => p.zones)) { const r = SAVED[z.id]; if (r) z.rect = { x: r[0], y: r[1], w: r[2], d: r[3] }; } return ps; };
  const places = placed(withSaved([
    P('tavern', 'tavern', 'thornbury', 'the Bent Nail', [
      Z('tavern.common', 'tavern', 'common room', ZK.room, 60, [['tavern.bar', 'behind the counter, north', true], ['tavern.kitchen', 'the kitchen door, west'], ['tavern.yard', 'the back door, east'], ['tavern.upstairs', 'the stairs up'], ['high_lane', 'the high lane']],
        { edges: { n: EK.low, e: EK.wall, s: EK.wall, w: EK.wall }, furniture: makeFurniture('tavern.common', [{ kind: FU.counter, name: 'bar counter', at: 'n' }, { kind: FU.hearth, name: 'hearth', at: 'w' }, { kind: FU.table, name: 'long table' }]) }),
      Z('tavern.bar', 'tavern', 'behind the counter', ZK.room, 9, [['tavern.common', 'over the counter, south', true]], { edges: { n: EK.wall, e: EK.wall, s: EK.low, w: EK.wall }, furniture: makeFurniture('tavern.bar', [{ kind: FU.barrels, name: 'ale barrels', at: 'n' }]) }),
      Z('tavern.kitchen', 'tavern', 'kitchen', ZK.room, 25, [['tavern.common', 'the common room, east'], ['tavern.cellar', 'the cellar hatch, down']]),
      Z('tavern.yard', 'tavern', 'back yard', ZK.yard, 400, [['tavern.common', 'the back door, west'], ['midden_yard', 'the midden yard']]),
      Z('tavern.upstairs', 'tavern', 'upstairs landing', ZK.corridor, 25, [['tavern.common', 'the stairs down'], ['tavern.room1', 'the first door, north'], ['tavern.room2', 'the second door, south']], { aspect: 4, height: 3 }),
      Z('tavern.room1', 'tavern', 'front room', ZK.room, 9, [['tavern.upstairs', 'the door to the landing, south']], { height: 3 }),
      Z('tavern.room2', 'tavern', 'back room', ZK.room, 9, [['tavern.upstairs', 'the door to the landing, north']], { height: 3 }),
      Z('tavern.cellar', 'tavern', 'cellar', ZK.cellar, 60, [['tavern.kitchen', 'the hatch, up']], { height: -3 }),
    ]),
    P('thornbury', 'village', null, 'Thornbury', [
      Z('high_lane', 'thornbury', 'the high lane', ZK.street, 400, [['tavern.common', 'the Bent Nail\'s front door'], ['midden_yard', 'a narrow gap between houses, round the back', true], ['lane_square', 'the lane on toward the village square', true]], { aspect: 4 }),
      Z('midden_yard', 'thornbury', 'the midden yard', ZK.yard, 25, [['high_lane', 'the gap back out to the lane', true], ['tavern.yard', 'the plank gate into the tavern\'s back yard']]),
    ]),
  ]));
  return {
    places, zone: 'midden_yard', placeId: 'thornbury', seen: ['high_lane', 'midden_yard', 'tavern.common', 'tavern.bar', 'tavern.kitchen'], trail: ['high_lane', 'tavern.common', 'tavern.kitchen'],
    you: [-2, -1],
    people: [{ id: 'f_guard', label: 'an off-duty guard', zone: 'high_lane', at: [0, 1] }, { id: 'f_wren', label: 'a lean man in a patched coat', zone: 'midden_yard', at: [1, 1] }, { id: 'f_keep', label: 'the barkeep', zone: 'tavern.bar' }],
    barriers: [
      { id: 'fb_front', a: 'high_lane', b: 'tavern.common', rec: { kind: BK.door, grade: 'minor' } },
      { id: 'fb_plank', a: 'midden_yard', b: 'tavern.yard', rec: { kind: BK.gate, grade: 'moderate', lock: { locked: true }, tried: ['player'] } },
    ],
  };
}

/** (b) a single room with one way out */
function oneRoom(): FakeStage {
  const places = placed([P('cell', 'building', null, 'the old watch-house', [
    Z('cell.store', 'cell', 'storeroom', ZK.room, 20, [['cell.hall', 'the door, south']], { aspect: 1.25, furniture: makeFurniture('cell.store', [{ kind: FU.shelves, name: 'empty shelves', at: 'n' }, { kind: FU.crates, name: 'broken crates', at: 'se' }]) }),
  ])]);
  return { places, zone: 'cell.store', placeId: 'cell', seen: ['cell.store'], trail: [], you: [0, 0], people: [],
    barriers: [{ id: 'fb_cell', a: 'cell.store', b: 'cell.hall', rec: { kind: BK.door, grade: 'moderate', lock: { locked: true }, tried: ['player'] } }] };
}

/** (c) twelve zones with long names: a manor house and its grounds */
function longNames(): FakeStage {
  const M = 'manor', G = 'grounds';
  const places = placed([
    P(G, 'estate', null, 'the Ashcombe estate', [
      Z('g.drive', G, 'the long gravel carriage drive', ZK.road, 300, [['m.hall', 'the great front doors, north'], ['g.garden', 'the walled kitchen garden, east', true], ['g.lodge', 'the gatekeeper\'s lodge, south', true]], { aspect: 6 }),
      Z('g.garden', G, 'the walled kitchen garden and glasshouses', ZK.yard, 400, [['g.drive', 'the carriage drive, west', true], ['g.orchard', 'the old orchard beyond the wall, east']]),
      Z('g.orchard', G, 'the old orchard of crooked apple trees', ZK.field, 600, [['g.garden', 'the kitchen garden, west'], ['g.woods', 'the dark woods past the ha-ha, east', true]]),
      Z('g.lodge', G, 'the gatekeeper\'s cramped stone lodge', ZK.room, 16, [['g.drive', 'the carriage drive, north', true]]),
    ]),
    P(M, 'manor', G, 'Ashcombe Manor', [
      Z('m.hall', M, 'the great entrance hall with its galleried stair', ZK.room, 120, [['g.drive', 'the front doors, south'], ['m.gallery', 'the long portrait gallery, west'], ['m.library', 'the oak-panelled library, east'], ['m.dining', 'the formal dining room, north']]),
      Z('m.gallery', M, 'the long portrait gallery', ZK.corridor, 90, [['m.hall', 'the entrance hall, east'], ['m.chapel', 'the private family chapel, north'], ['m.music', 'the music room, west']], { aspect: 5 }),
      Z('m.library', M, 'the oak-panelled library and reading nook', ZK.room, 80, [['m.hall', 'the entrance hall, west'], ['m.study', 'the master\'s private study, north']]),
      Z('m.dining', M, 'the formal dining room', ZK.room, 70, [['m.hall', 'the entrance hall, south'], ['m.servery', 'the servants\' servery, north']]),
      Z('m.study', M, 'the master\'s private study', ZK.room, 20, [['m.library', 'the library, south']]),
      Z('m.chapel', M, 'the private family chapel of Saint Ewan', ZK.room, 50, [['m.gallery', 'the gallery, south']]),
      Z('m.music', M, 'the music room with the harpsichord', ZK.room, 40, [['m.gallery', 'the gallery, east']]),
      Z('m.servery', M, 'the servants\' servery and pass-through', ZK.room, 15, [['m.dining', 'the dining room, south'], ['m.kitchens', 'the back stairs to the kitchens, down']]),
    ]),
  ]);
  const all = places.flatMap((p) => p.zones.map((z) => z.id));
  return {
    places, zone: 'm.hall', placeId: M, seen: all, trail: ['g.drive', 'g.garden', 'm.gallery', 'm.library', 'm.dining'], you: [2, -3],
    people: [{ id: 'f_butler', label: 'a stooped butler', zone: 'm.hall', at: [-3, 2] }, { id: 'f_maid', label: 'a young maid', zone: 'm.dining' }, { id: 'f_gard', label: 'a gardener with a barrow', zone: 'g.garden', at: [4, 0] }],
    barriers: [{ id: 'fb_study', a: 'm.library', b: 'm.study', rec: { kind: BK.door, grade: 'moderate', lock: { locked: true }, tried: ['player'] } }],
  };
}

export const FAKE_STAGES: Record<string, () => FakeStage> = { 'bent-nail': () => bentNail(), 'bent-nail-saved': () => bentNail(true), 'one-room': oneRoom, 'long-names': longNames };
