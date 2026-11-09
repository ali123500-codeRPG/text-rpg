// Scenario-test fixture: the prototype village built directly (no Weaver call), deterministic.
// Gate, street, tavern and a slime field outside the gate. Tests mutate the returned state freely.
import { TP } from '../../src/library/templateIds';
import { BT } from '../../src/library/raceIds';
import { RC } from '../../src/library/raceIds';
import type { Actor, Band, Cover, Light, GameState, Place, Zone, ZoneLink } from '../../src/types';
import { spawnNpc, equipLoadout, fullParts } from '../../src/library/spawn';
import { resetLibrary } from '../../src/library';
import { resetConfig } from '../../src/config';
import { getLibrary, itemDef, routineSet } from '../../src/library';
import { requirement } from '../../src/ruleset/requirements';
import { SK } from '../../src/library/skillIds';
import { CL } from '../../src/library/classIds';
import { IT } from '../../src/library/itemIds';

const L = (to: string, label: string, sight = true, frontier = false): ZoneLink => ({ to, label, sight, ...(frontier ? { frontier: true as const } : {}) });
const Z = (id: string, placeId: string, name: string, look: string, links: ZoneLink[], cover: Cover = 'none', light: Light = 'bright'): Zone =>
  ({ id, placeId, name, look, links, cover, light, groundItems: [] });

export function villagePlaces(storyId = 'test'): Place[] {
  const P = (id: string, kind: string, parentId: string | null, name: string, zones: Zone[]): Place =>
    ({ id, storyId, kind, parentId, names: { current: name, past: [] }, zones, state: {}, headlines: [] });
  return [
    P('village', 'settlement', null, 'Brookmere', []),
    P('tavern', 'place', 'village', 'The Crooked Kettle', [
      Z('tav_common', 'tavern', 'common room', 'a low smoky room of benches and tables', [L('tav_counter', 'behind the bar'), L('street_door', 'out the front door', false)]),
      Z('tav_counter', 'tavern', 'behind the bar', 'a scarred counter with kegs behind it', [L('tav_common', 'the common room'), L('tav_cellar', 'down the cellar steps', false)]),
      Z('tav_cellar', 'tavern', 'cellar', 'a damp cellar of barrels', [L('tav_counter', 'up the cellar steps', false)], 'some', 'dark'),
    ]),
    P('street', 'place', 'village', 'Market Street', [
      Z('street_door', 'street', 'outside the tavern', 'a muddy street before the tavern door', [L('tav_common', 'inside the tavern', false), L('street_square', 'down the street')]),
      Z('street_square', 'street', 'the square', 'a small square around a well', [L('street_door', 'up the street'), L('gate_inner', 'toward the gate')]),
    ]),
    P('gate', 'place', 'village', 'the village gate', [
      Z('gate_inner', 'gate', 'the gate', 'a timber gate in the palisade', [L('street_square', 'back toward the square'), L('field_edge', 'through the gate')]),
    ]),
    P('field', 'place', 'village', 'the slime field', [
      Z('field_edge', 'field', 'edge of the field', 'trampled grass outside the palisade', [L('gate_inner', 'back through the gate'), L('field_mid', 'out across the field')]),
      Z('field_mid', 'field', 'the open field', 'wet grass streaked with slime trails', [L('field_edge', 'toward the gate'), L('field_far', 'the far side of the field')]),
      Z('field_far', 'field', 'far side of the field', 'long grass by a line of trees', [L('field_mid', 'back across the field'), L('woods', 'into the woods', false, true)], 'some'),
    ]),
  ];
}

export function villageBands(): Band[] {
  const B = (id: string, name: string, relations: Band['relations'], lethal = true): Band =>
    ({ id, name, goals: '', temperament: '', tactics: 'simple', lethal, relations });
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

function withRoutine(a: Actor, setId: string, slots: Record<string, string | string[]>, anchorTurn = 0): Actor {
  const set = routineSet(setId)!;
  a.mind!.routineSetId = setId;
  a.mind!.routines = [...set.routines];
  a.mind!.slots = slots;
  a.mind!.routine = { id: set.routines[0], anchorTurn };
  return a;
}

export type VillageOpts = { seed?: number; playerZone?: string; without?: string[] };

export function makeVillage(opts: VillageOpts = {}): GameState {
  resetConfig();
  resetLibrary();
  const storyId = 'test';
  const places = villagePlaces(storyId);
  const zoneOf = (id: string) => places.flatMap((p) => p.zones).find((z) => z.id === id)!;
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
  actors = actors.filter((a) => !opts.without?.includes(a.id));
  const zoneIds = places.flatMap((p) => p.zones.map((z) => z.id));
  const seed = opts.seed ?? 12345;
  const state: GameState = {
    storyId, turn: 1, mode: 'explore',
    zones: places.flatMap((p) => p.zones),
    player: recommendedPlayer(storyId, playerZone, zoneOf(playerZone).placeId),
    actors,
    bands: villageBands(),
    hidden: { plans: {}, memory: {}, secrets: [], firedLog: [], weaverNote: '', stage: { eventSummary: 'slimes trouble the village', challenge: 'moderate', gain: 'moderate', hiddenTerms: [] } },
    events: [], agentLog: [], log: [],
    rngSeed: seed, rngState: seed,
    pending: { turn: 1, mode: 'explore', engaged: [], fired: [] },
    places, facts: [],
    stage: { zoneIds, tier: 'success', sceneNumber: 1, sceneStartTurn: 0 },
    sceneCaps: { promotions: 0, minted: 0 }, clocks: {}, flags: {}, quests: [],
    settings: { difficulty: 'normal', showMechanics: true, tone: 'grounded low fantasy' },
    libraryVersion: getLibrary().version,
    blueprints: [],
    meta: { storyId, title: 'Test story', schemaVersion: 5, createdAt: '2026-11-07', settings: { difficulty: 'normal', showMechanics: true, tone: 'grounded low fantasy' } },
  };
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
