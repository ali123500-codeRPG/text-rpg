// Case-test fixture: the prototype village built directly (no Weaver call), deterministic.
// Gate, street, tavern and a slime field outside the gate. Tests mutate the returned state freely.
import { TP } from '../../src/library/templateIds';
import { BT } from '../../src/library/raceIds';
import { RC } from '../../src/library/raceIds';
import type { Actor, Band, Barrier, Furniture, Rect, ItemInstance, Light, GameState, Place, PlanFurniture, TitleSpec, WaySpec, WayKind } from '../../src/types';
import { spawnNpc, equipLoadout, fullParts } from '../../src/library/spawn';
import { resetLibrary } from '../../src/library';
import { CONFIG, resetConfig } from '../../src/config';
import { getLibrary, itemDef, routineSet } from '../../src/library';
import { requirement } from '../../src/ruleset/requirements';
import { floorGap } from '../../src/engine/position';
import { drawTitles } from '../../src/plan/draw';
import { inTitle, middle, wayTo } from '../../src/plan/where';
import { boxOf } from '../../src/plan/geom';
import { placeAll } from '../../src/engine/position';
import { SK } from '../../src/library/skillIds';
import { WK } from '../../src/library/tableIds';
import { fitBarrier, makeFurniture, setTitleLight } from '../../src/plan/draw';
import { CL } from '../../src/library/classIds';
import { IT } from '../../src/library/itemIds';

/** a way: where to, its words, seen through (an open way; else a door), a kind where it climbs, and frontier (off the stage) */
const L = (to: string, label: string, sight = true, frontier = false, kind?: WayKind): WaySpec =>
  ({ to, label, kind: kind ?? (sight ? 'open' : 'door'), ...(frontier ? { frontier: true as const } : {}) });
/** a title of the village; light is the word its lamps are drawn to: bright indoors, none out under the sky (the sky lights it
 * by the clock) */
const Z = (id: string, placeId: string, name: string, look: string, ways: WaySpec[], light?: Light): TitleSpec =>
  ({ id, placeId, name, look, ways, light: light ?? (OUTDOOR.has(placeId) ? 'dark' : 'bright'), roof: !OUTDOOR.has(placeId), area: CONFIG.ZONE_SIZE_M2[placeId === 'field' ? 'open' : placeId === 'tavern' ? 'room' : 'yard'] });
/** the village's titles under the sky */
const OUTDOOR = new Set(['street', 'gate', 'field']);

export function villagePlaces(storyId = 'test'): Place[] {
  const P = (id: string, kind: string, parentId: string | null, name: string): Place =>
    ({ id, storyId, kind, parentId, names: { current: name, past: [] }, zones: [], state: {}, headlines: [] });
  return [
    P('village', 'settlement', null, 'Brookmere'), P('tavern', 'place', 'village', 'The Crooked Kettle'), P('street', 'place', 'village', 'Market Street'),
    P('gate', 'place', 'village', 'the village gate'), P('field', 'place', 'village', 'the slime field'),
  ];
}
/** PZ14 a: the village's titles as a plan hands them over (ways, sizes, light: no positions); drawn by plan/draw */
export function villageTitles(): TitleSpec[] {
  return [
    Z('tav_common', 'tavern', 'common room', 'a low smoky room of benches and tables', [L('tav_counter', 'behind the bar'), L('street_door', 'out the front door', false)]),
    Z('tav_counter', 'tavern', 'behind the bar', 'a scarred counter with kegs behind it', [L('tav_common', 'the common room'), L('tav_cellar', 'down the cellar steps', false, false, 'down')]),
    Z('tav_cellar', 'tavern', 'cellar', 'a damp cellar of barrels', [L('tav_counter', 'up the cellar steps', false, false, 'up')], 'dark'),
    Z('street_door', 'street', 'outside the tavern', 'a muddy street before the tavern door', [L('tav_common', 'inside the tavern', false), L('street_square', 'down the street')]),
    Z('street_square', 'street', 'the square', 'a small square around a well', [L('street_door', 'up the street'), L('gate_inner', 'toward the gate')]),
    Z('gate_inner', 'gate', 'the gate', 'a timber gate in the palisade', [L('street_square', 'back toward the square'), L('field_edge', 'through the gate')]),
    Z('field_edge', 'field', 'edge of the field', 'trampled grass outside the palisade', [L('gate_inner', 'back through the gate'), L('field_mid', 'out across the field')]),
    Z('field_mid', 'field', 'the open field', 'wet grass streaked with slime trails', [L('field_edge', 'toward the gate'), L('field_far', 'the far side of the field')]),
    Z('field_far', 'field', 'far side of the field', 'long grass by a line of trees', [L('field_mid', 'back across the field'), L('woods', 'into the woods', false, true)]),
  ];
}

export function villageBands(): Band[] {
  const B = (id: string, name: string, relations: Band['relations'], lethal = true): Band =>
    ({ id, name, goals: '', temperament: '', lethal, relations });
  return [
    B('player_band', 'the player', { slimes: 'hostile' }),
    B('village_watch', 'the village watch', { slimes: 'hostile' }),
    B('tavern_folk', 'tavern folk', {}),
    B('slimes', 'slimes', { player_band: 'hostile', village_watch: 'hostile', tavern_folk: 'hostile' }),
  ];
}

/** The recommended swordsman build (250 points, 3 tags, nothing above 60, class floors met). */
export function recommendedPlayer(storyId = 'test', zone = 'tav_common', placeId = 'tavern'): Actor {
  const skills: Record<string, number> = { [SK.melee_medium]: 50, [SK.block]: 40, [SK.dodge]: 25, [SK.endurance]: 40, [SK.eyesight]: 25, [SK.earshot]: 20, [SK.persuasion]: 25, [SK.intimidation]: 15, [SK.barter]: 10 };
  const tagged: string[] = [SK.melee_medium, SK.block, SK.endurance];
  return {
    id: 'player', storyId, kind: 'player', names: { current: 'Aldric', past: [] }, label: 'a swordsman',
    placeId, zone, posture: 'open', bandId: 'player_band',
    core: {
      bodyTypeId: BT.humanoid, raceId: RC.human,
      skills: Object.fromEntries(Object.entries(skills).map(([k, v]) => [k, { raw: v, state: tagged.includes(k) ? 'tagged' as const : 'normal' as const }])),
      classes: [{ classId: CL.swordsman, state: 'current', level: 1 }],
      perks: [],
      condition: { hpLostPct: 0, parts: fullParts(null, BT.humanoid), status: [] },
      inventory: [
        ...equipLoadout(null, [IT.arming_sword, IT.round_shield, IT.gambeson], 'player'),
        { id: 'player_coin', itemId: IT.coin, qty: 20 },
      ],
      standingDefense: 'block',
    },
    progression: { startingTotal: 0, potential: { base: 300, adjustments: [] }, xp: 0, unspentPerkPoints: 0, marks: [] },
    journal: { secretsKnown: [], factsWitnessed: [], remembered: {}, namesKnown: [] },
  };
}

/** at: the game minute it started (NW10; the test clock is unset, so it reads as the start of day) */
function withRoutine(a: Actor, setId: string, slots: Record<string, string | string[]>, anchorTurn = 0, at = CONFIG.TIME_OF_DAY_FROM.morning): Actor {
  const set = routineSet(setId)!;
  a.mind!.routineSetId = setId;
  a.mind!.routines = [...set.routines];
  a.mind!.slots = slots;
  a.mind!.routine = { id: set.routines[0], anchorTurn, at };
  return a;
}

/** shape: changes to a title's spec before it is drawn (a footprint, walls, light …), by title id */
export type VillageOpts = { seed?: number; playerZone?: string; without?: string[]; shape?: Record<string, Partial<TitleSpec>>; add?: TitleSpec[] };
/** a village title's spec with more ways (fixture setup: a way to a title added with `add`) */
export const withWays = (id: string, ...ways: WaySpec[]): Partial<TitleSpec> => ({ ways: [...villageTitles().find((t) => t.id === id)!.ways, ...ways] });
/** FR4: the counter village: an 8 m common room with the bar's 3 m floor north of it behind a counter (a low wall) */
export const COUNTER_SHAPE: Record<string, Partial<TitleSpec>> = {
  tav_common: { rect: { x: 0, y: 0, w: 8, d: 8 }, walls: { n: WK.low, e: WK.wall, s: WK.wall, w: WK.wall } },
  tav_counter: { rect: { x: 0, y: 5.5, w: 3, d: 3 }, walls: { n: WK.wall, e: WK.wall, s: WK.low, w: WK.wall } },
};

export function makeVillage(opts: VillageOpts = {}): GameState {
  resetConfig();
  resetLibrary();
  const storyId = 'test';
  const places = villagePlaces(storyId), titles = [...villageTitles().map((t) => ({ ...t, ...opts.shape?.[t.id] })), ...(opts.add ?? [])];
  const zoneOf = (id: string) => titles.find((z) => z.id === id)!;
  const playerZone = opts.playerZone ?? 'tav_common';
  const npc = (tpl: string, id: string, zone: string, bandId: string, name: string) =>
    spawnNpc(null, tpl, { id, zone, placeId: zoneOf(zone).placeId, bandId, name, storyId });
  let actors: Actor[] = [
    withRoutine(npc(TP.guard, 'guard_1', 'gate_inner', 'village_watch', 'Bertram'), 'gate_guard', { post: 'gate_inner' }),
    withRoutine(npc(TP.trader, 'trader', 'tav_counter', 'tavern_folk', 'Mags'), 'barkeep', { counter: 'tav_counter', refuge: 'tav_cellar' }),
    withRoutine(npc(TP.patron, 'patron_1', 'tav_common', 'tavern_folk', 'Old Wim'), 'patron', { seat: 'tav_common', refuge: 'tav_cellar', exit: 'street_door' }),
    withRoutine(npc(TP.slime, 'slime_1', 'field_mid', 'slimes', 'slime'), 'slime_wander', { route: ['field_mid', 'field_far'], post: 'field_far' }),
    withRoutine(npc(TP.slime, 'slime_2', 'field_far', 'slimes', 'slime'), 'slime_wander', { route: ['field_far', 'field_mid'], post: 'field_mid' }),
  ];
  // pronouns as every stage plan gives them, so the turn checker's view_pronouns rule has something to check (TQ1, F7)
  for (const a of actors) a.pronouns = ({ guard_1: 'he', trader: 'she', patron_1: 'he' } as const)[a.id as 'trader'] ?? 'it';
  actors = actors.filter((a) => !opts.without?.includes(a.id));
  const seed = opts.seed ?? 12345;
  const state: GameState = {
    storyId, turn: 1, mode: 'explore',
    zones: [], walls: [], openings: [], roofs: [], lights: [], furniture: [], ground: [],
    player: { ...recommendedPlayer(storyId, playerZone, zoneOf(playerZone).placeId), pronouns: 'he' },
    actors,
    bands: villageBands(),
    hidden: { plans: {}, memory: {}, secrets: [], firedLog: [], weaverNote: '', stage: { eventSummary: 'slimes trouble the village', challenge: 'moderate', gain: 'moderate', hiddenTerms: [] } },
    events: [], agentLog: [], log: [],
    rngSeed: seed, rngState: seed,
    pending: { turn: 1, mode: 'explore', engaged: [], fired: [] },
    places, facts: [],
    stage: { tier: 'success', scenarioNumber: 1, scenarioStartTurn: 0 },
    scenarioCaps: { promotions: 0, minted: 0 }, clocks: {}, quests: [],
    settings: { showMechanics: true, tone: 'grounded low fantasy' },
    libraryVersion: getLibrary().version,
    blueprints: [],
    meta: { storyId, title: 'Test story', schemaVersion: CONFIG.SCHEMA_VERSION, createdAt: '2026-11-07', settings: { showMechanics: true, tone: 'grounded low fantasy' } },
  };
  // PZ1: titles on a floor plan, so everyone stands at a point in metres, as in every world the game builds
  drawTitles(state, titles);
  placeAll(state);
  return state;
}

export function actor(state: GameState, id: string): Actor {
  const a = id === 'player' ? state.player : state.actors.find((x) => x.id === id);
  if (!a) throw new Error(`no actor ${id}`);
  return a;
}
/** move an actor directly (fixture setup only) */
export function place(state: GameState, id: string, zone: string): Actor {
  const a = actor(state, id);
  a.zone = zone;
  a.placeId = state.places.find((p) => p.zones.some((z) => z.id === zone))!.id;
  delete a.pos;
  placeAll(state);
  return a;
}

/** gives an actor the skill each item asks for (equip requirements, EQ1–EQ13), so a test about something else rolls clean */
export function fit(a: Actor, ...itemIds: string[]): Actor {
  for (const id of itemIds) {
    const r = requirement(itemDef(null, id));
    if (r && (a.core.skills[r.skill]?.raw ?? 0) < r.need) a.core.skills[r.skill] = { raw: r.need, state: a.core.skills[r.skill]?.state ?? 'normal' };
  }
  return a;
}

/** stands `id` in `near`'s zone, `m` metres east of it (west when that leaves the zone), so tests about reach stand
 * within it (fixture setup only) */
export function beside(state: GameState, id: string, near = 'player', m = 0.5): Actor {
  const a = actor(state, id), b = actor(state, near);
  a.zone = b.zone;
  a.placeId = b.placeId;
  const z = state.zones.find((q) => q.id === b.zone)!;
  // SZ5: m metres between their bodies (each turned as it stands): the centres sit farther apart by both bodies' extents
  for (const side of [1, -1]) {
    a.pos = { x: b.pos!.x + side * m, y: b.pos!.y };
    a.pos.x += side * (m - floorGap(state, b, a));
    if (inTitle(z, a.pos)) break;
  }
  // shortcut: when neither side fits it stays outside the title, and the next placeAll stands it near the middle (8 tests ask
  // for that today); make it throw once they are fixed. tests/harness/measure.ts checks the gap it got
  return a;
}

/** stands `id` in `zone`, `m` metres in from its doorway to `other`, toward the zone's centre (fixture setup only) */
export function byDoor(state: GameState, id: string, zone: string, other: string, m: number): Actor {
  const a = place(state, id, zone);
  const z = state.zones.find((x) => x.id === zone)!, d = wayTo(state, zone, other)!.opening.at, c = middle(z);
  const dx = c.x - d.x, dy = c.y - d.y, len = Math.hypot(dx, dy);
  a.pos = { x: d.x + dx / len * m, y: d.y + dy / len * m };
  return a;
}

/** SD3: puts a barrier on the way between titles a and b (fixture setup only); the barrier record, made if new */
export function putBarrier(state: GameState, a: string, b: string, rec: Barrier): Barrier {
  (state.barriers ??= {})[rec.id] = rec;
  const o = state.openings.find((x) => (x.joins[0] === a && x.joins[1] === b) || (x.joins[0] === b && x.joins[1] === a));
  if (!o) throw new Error(`no way between ${a} and ${b}`);
  if (o.barrier && o.barrier !== rec.id) delete state.barriers[o.barrier]; // BG-312: it takes the plain door's place
  o.barrier = rec.id;
  fitBarrier(state, o);
  return rec;
}
/** the village with title `id`'s footprint changed by `f` (from its usual one), the titles named in `pin` kept where
 * they usually are; the rest are drawn around them (fixture setup only) */
export function makeVillageResized(opts: VillageOpts, id: string, f: (r: Rect) => Rect, pin: string[] = []): GameState {
  const base = makeVillage(opts);
  const rectOf = (z: string): Rect => { const b = boxOf(base.zones.find((q) => q.id === z)!.outline); return { x: b.x, y: b.y, w: b.w, d: b.d }; };
  const shape: Record<string, Partial<TitleSpec>> = { ...opts.shape };
  for (const z of pin) shape[z] = { ...shape[z], rect: rectOf(z) };
  shape[id] = { ...shape[id], rect: f(rectOf(id)) };
  return makeVillage({ ...opts, shape });
}
/** lays an item on the ground at a point of a title (`at`, else its own `at`, else the title's middle), on its floor; the
 * same object, so a test can keep it (fixture setup only) */
export function lay(state: GameState, zone: string, item: ItemInstance, at?: { x: number; y: number }): ItemInstance {
  const z = state.zones.find((q) => q.id === zone)!, p = at ?? item.at ?? middle(z);
  item.at = { x: p.x, y: p.y, floor: z.floor };
  state.ground.push(item);
  return item;
}
/** lays items on the ground in a title (each at its own `at`, else the title's middle) */
export const layAll = (state: GameState, zone: string, ...items: ItemInstance[]): void => { for (const i of items) lay(state, zone, i); };
/** PZ5: draws every title's lights to one word (so no lamp next door lights the title a test darkens; fixture setup only) */
export function lightAll(state: GameState, word: Light): void {
  for (const z of state.zones) setTitleLight(state, z, word);
}
/** FR2: replaces a title's furniture with a list (fixture setup only) */
export function furnish(state: GameState, zone: string, list: PlanFurniture[]): Furniture[] {
  const z = state.zones.find((q) => q.id === zone)!;
  const made = makeFurniture(state, z, list);
  state.furniture = state.furniture.filter((f) => f.zone !== zone).concat(made);
  return made;
}
/** FR2: adds one piece of furniture to a title, with id `id` (fixture setup only) */
export function addPiece(state: GameState, zone: string, piece: PlanFurniture, id: string): Furniture {
  const f = { ...makeFurniture(state, state.zones.find((q) => q.id === zone)!, [piece])[0], id };
  state.furniture.push(f);
  return f;
}
/** puts barrier `id` (already in state.barriers) on the way between titles a and b, fitted to it (fixture setup only) */
export function setBarrier(state: GameState, a: string, b: string, id: string): void {
  const o = state.openings.find((x) => (x.joins[0] === a && x.joins[1] === b) || (x.joins[0] === b && x.joins[1] === a));
  if (!o) throw new Error(`no way between ${a} and ${b}`);
  o.barrier = id;
  fitBarrier(state, o);
}
