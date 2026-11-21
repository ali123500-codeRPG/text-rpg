// CONFIG defaults: the land, zones, floors and falls. src/config.ts spreads every part into one DEFAULTS in file order,
// so a key keeps its place: moving keys between parts, or reordering them, changes CONFIG's key order.
import type { Tier } from '../types';
import type { FragilityKey } from '../scales';

export const LAND = {
  // ---- land first (WZ1-WZ12): a region's land, drawn once by code (src/land); placeholders unless a source is given ----
  /** WZ3 a region is a square this many metres across: one market town, a few villages and hamlets, two to three hours'
   * walk from side to side */
  REGION_SIZE_M: 10000,
  /** a region's land is stored on a grid of cells this many metres across (heights and cover per cell) */
  REGION_CELL_M: 100,
  /** WZ18 how far into a new region its ground eases into a drawn neighbour's heights along the shared edge (a
   * placeholder: a long valley side, so moor meets vale as a hillside, not a cliff) */
  REGION_EDGE_BLEND_M: 2500,
  /** the nearest two settlements of a size sit to another settlement: lowland English parishes were mostly 4 to 12 km² (1,000
   * to 3,000 acres), each round one village, which puts villages about 2 to 3.5 km apart */
  SITE_SPACING_M: { town: 3000, village: 2000, hamlet: 900 } as Record<string, number>,
  /** how far a settlement's houses and yards reach from its middle: a small market town of 1,000 to 2,000 people covered
   * about 20 ha; a village of about 40 houses (Wharram Percy, English Heritage) strung along a street of 250 to 300 m */
  SITE_BUILT_M: { town: 250, village: 130, hamlet: 50 } as Record<string, number>,
  /** how far a settlement's farmland reaches from its middle (its parish fields, from the parish sizes above) */
  SITE_FIELDS_M: { town: 1400, village: 1000, hamlet: 400 } as Record<string, number>,
  /** the widest water a road fords; wider is bridged (a placeholder: medieval fords were usually knee deep, on broad
   * shallow stretches) */
  FORD_MAX_WIDTH_M: 20,
  /** a stream's width in metres, least and most: a brook a few metres across */
  STREAM_WIDTH_M: [2, 5] as [number, number],
  /** WZ4 an eye this many metres above the ground (a standing adult) */
  LAND_EYE_M: 1.6,
  /** TV3 road lengths in km (ROAD_LENGTHS): a walk of about 4.5 km an hour gives the time words their lengths */
  ROAD_LENGTH_KM: { short_walk: 0.5, half_hour: 2, hour: 4.5, half_day: 15, day: 30, two_days: 60 } as Record<string, number>,
  /** TV3 a road's width in metres: a cart track or Roman road, about 4 m (Roman viae ran about 4 to 6 m with the verges) */
  ROAD_WIDTH_M: 4,
  /** TV4 the chance in % per hour on the road that something meets you, by ROAD_DANGERS (placeholders) */
  ROAD_ENCOUNTER_PCT: { safe: 5, quiet: 10, wild: 20, dangerous: 35 } as Record<string, number>, // RE3: per hour on a road (placeholders)
  /** NR21 a: rank weights (RANKS keys) for rostered people. crowd: a crowd person the player picks out (made a Commoner then);
   * face: services, traders, the watch and people in need; lead: leaders and rivals, one step up; threat: by settlement size
   * (hamlet and village up to Elite, town up to Paragon, city and court up to Beyond); seat: the seat of the Great's lowest rank
   * by size (TL24 minimums: village Veteran or Elite, town Paragon, city Beyond, court Mythic), one
   * step higher on SEAT_STEP_UP_PCT. Roads by danger and the wild use their own rows. Transcendent only by region brief. */
  ROSTER_RANKS: {
    crowd: { rank_1: 70, rank_2: 30 },
    face: { rank_2: 50, rank_3: 40, rank_4: 10 },
    lead: { rank_3: 50, rank_4: 40, rank_5: 10 },
    threat: { hamlet: { rank_2: 40, rank_3: 40, rank_4: 20 }, village: { rank_2: 40, rank_3: 40, rank_4: 20 }, town: { rank_2: 20, rank_3: 40, rank_4: 30, rank_5: 10 }, city: { rank_3: 20, rank_4: 40, rank_5: 30, rank_6: 10 }, court: { rank_3: 20, rank_4: 40, rank_5: 30, rank_6: 10 } },
    seat: { hamlet: { rank_3: 50, rank_4: 50 }, village: { rank_3: 50, rank_4: 50 }, town: { rank_5: 100 }, city: { rank_6: 100 }, court: { rank_7: 100 } },
    road: { safe: { rank_2: 60, rank_3: 40 }, quiet: { rank_2: 60, rank_3: 40 }, wild: { rank_2: 30, rank_3: 50, rank_4: 20 }, dangerous: { rank_3: 50, rank_4: 40, rank_5: 10 } },
    wild: { rank_2: 30, rank_3: 50, rank_4: 20 },
  } as { crowd: Record<string, number>; face: Record<string, number>; lead: Record<string, number>; threat: Record<string, Record<string, number>>; seat: Record<string, Record<string, number>>;
    road: Record<string, Record<string, number>>; wild: Record<string, number> },
  SEAT_STEP_UP_PCT: 20,
  /** NR38 a: the chance a beast in a group rolls the Dire prefix, outside safe and quiet roads */
  DIRE_PCT: 10,
  /** NR31 a (placeholder): the share of rostered people who are elves; everyone else is human (dragonkin join once their race exists) */
  ROSTER_ELF_PCT: 5,
  /** TV2/SR5: travel is one pace, a share of the walking speed: a body that walks 1.4 m/s (an everyday walk) travels 4.5 km/h
   * (US Army FM 21-18: about 4 km/h on a day march); NPCs keep it too while a turn's time moves them on (NW11) */
  TRAVEL_SPEED_SHARE: 0.9,
  /** TV5: pressing on in the dark, the travel speed is this share of the walking speed instead (3 km/h) */
  TRAVEL_DARK_SPEED_SHARE: 0.6,
  /** SR5: each hour of travel adds this many points of strain straight to the long-term bar, whatever the armour (placeholder) */
  TRAVEL_STRAIN_PER_HOUR: 1,
  LONG_TURN_LINES: 5, // BF2e4: a long turn's summary names at most this many people; the rest are "others came and went"
  /** TV4 a trip is walked in legs of this many game minutes; each leg on a road rolls for an encounter */
  OUTCLASS_EACH: 0.25, // IQ6 a: a fight is far below the player when each foe's power (defeat XP rating + gear) is at most this share of the player's (placeholder)
  OUTCLASS_ALL: 1, // IQ6 a: ...and all the foes' power together is at most this share of the player's (placeholder)
  FINISH_MAX_ROUNDS: 60, // IQ4: a finished fight (Finish the fight) plays at most this many rounds on code in one turn
  SIDE_WAY_M: 800, // RE8: a side way an encounter opens with no landmark or settlement to lead to ends this far off the road (placeholder)
  TRAVEL_LEG_MIN: 60,
  TRAVEL_MAX_LEGS: 96, // a safety stop: four days on the road in one turn
  /** TV4/TV5 pressing on in the dark: the event roll's modifier and the encounter chance's multiplier (placeholders) */
  NIGHT_TRAVEL_EVENT_MOD: -15,
  NIGHT_ENCOUNTER_MULT: 2,
  /** RE6: an encounter starts where its people are first glimpsed standing still: this visibility's glimpse range in the
   * sight table (CONFIG.SIGHT_M low: 60 m), the one sight rule; dark makes them only half seen, hiders use their stealth */
  ENCOUNTER_VISIBILITY: 'low' as import('../scales').VisibilityKey,
  /** ZP1, SZ19: how far apart code places people in a zone when nothing says where they stand, between their bodies: arm's
   * length, the far end of Hall's close personal distance (0.45–0.75 m) */
  PLACE_SPACING_M: 0.75, // BF71: the grid code places people on, how far a walk up to someone stops
  PLACE_GAP_M: 0.15, // BF71, SZ19: the room a walk's end keeps from everyone but the one it closes in on (Hall: intimate distance starts at 0.15 m)
  RING_STEPS: 24, // BF71: the spots round someone a walk closing in on them tries when the straight-line spot is taken
  /** SZ7: a doorway, width × height in metres: a house door about 0.9 × 2 m (interior doors are commonly 0.8–0.9 m by
   * 2.0 m). Every way into or out of an indoor zone with no barrier of its own has it; ways between outdoor zones have none */
  DOORWAY_M: [0.9, 2] as [number, number],
  /** SZ7: a body passes an opening when the narrower of its length and width fits the width (it turns sideways) and its
   * height ducked to this share fits the height; ducking takes no extra time. Crawling lower is parked (D-369) */
  DUCK_SHARE: 0.5,
  /** ZP2 how far into a zone a move to it walks past the doorway (a step clear of the door); BG-12 a move to a spot by a
   * wall or a way out stops this far inside it. SZ19: measured to the body's near edge, so a whole horse stands inside */
  ENTER_M: 1,
  /** BF35 following someone: the distance kept when none is said, sneaking or not (real metres: a tail stays back, a
   * companion keeps close), and at range how much of the weapon's reach is used (a little margin inside it) */
  FOLLOW_SNEAK_M: 5,
  FOLLOW_M: 2,
  FOLLOW_RANGE_SHARE: 0.8,
  /** VS5: a Vanishing roll against a foe fighting you within this many metres (placeholder; by distance, not weapon reach,
   * so a ranged weapon gets no help from its reach) takes this tier shift (placeholder) */
  VANISH_NEAR_M: 5,
  VANISH_NEAR_SHIFT: -1,
  /** VS8: a stealthy actor's time factor (timeFactor): every action takes this many times as long, and it moves at 1 / this
   * of its speed (1.2: about 83% speed) */
  SNEAK_TIME_MULT: 1.2,
  /** BF34: an NPC no agent answered for takes a thing held out to it from anyone it is at least this toward (a STANCES key) */
  TAKE_FROM_STANCE: 'neutral' as import('../scales').StanceKey,
  /** SD7 fall damage (placeholders): flat damage by drop, landing on a leg, so tough characters power through. Each band
   * applies above its metres (real falls: little harm up to about 2 m, serious from about 6 m, often deadly from 10 m) */
  // scaling: the bands go on to about terminal speed (most of a body's falling speed is reached by about
  // 50 m), so a tower jump hurts more than a roof jump; past the last band the damage stays (placeholders)
  FALL_BANDS: [{ over: 2, damage: 15 }, { over: 5, damage: 40 }, { over: 9, damage: 80 }, { over: 15, damage: 120 }, { over: 30, damage: 160 }, { over: 50, damage: 200 }] as { over: number; damage: number }[],
  /** SD7: the Dodge roll on landing moves the fall this many bands (by tier key; a tier past either end uses the end's row) */
  FALL_LANDING_STEP: { critical_failure: 1, failure: 1, near_miss: 0, success: 0, great_success: -1, critical_success: -1 } as Record<string, number>,
  /** scaling: each tier a landing goes past Critical Success (Critical Success+, ++) moves the fall this
   * many more bands lighter, so a supernatural dodger can land a tower jump unhurt (past Critical Failure: its own row) */
  FALL_LANDING_PAST_STEP: 1,
  /** OD1 b: an act on a graded thing (today a lock: picking, BA2) rolls only when in doubt: a grade this many points or more
   * below the actor's effective skill is a sure Success with no roll; more than OBSTACLE_REACH_GAP above it is out of reach.
   * Placeholders: points or a share of the grade is D-343. Only the gap counts, so it reads the same at 50 and at 300 */
  OBSTACLE_SURE_GAP: 25,
  OBSTACLE_REACH_GAP: 25,
  /** BK1/BK2: the best break roll that still breaks an item inside the container, by its fragility (placeholders). One roll
   * checks everything inside; a tier past Critical Failure is that tier with beyond −1, −2 (Critical Failure−, −−), which a
   * roll reaches only once an achievement unlocks it. null: never breaks. */
  FRAGILITY_BREAKS_AT: {
    fragile: { tier: 'near_miss' }, delicate: { tier: 'failure' }, sturdy: { tier: 'critical_failure' },
    tough: { tier: 'critical_failure', beyond: -1 }, solid: { tier: 'critical_failure', beyond: -2 }, unbreakable: null,
  } as Record<FragilityKey, { tier: Tier; beyond?: number } | null>,
  /** BK1 (with the extra tier between armor and weapons): an item's fragility when its row sets none, by kind (placeholders) */
  FRAGILITY_BY_KIND: { weapon: 'solid', armor: 'sturdy', shield: 'sturdy', accessory: 'delicate', tool: 'tough', consumable: 'fragile', misc: 'sturdy' } as Record<string, FragilityKey>,
  /** BK3: a broken item is worth this share of what it was worth whole (scrap; placeholder) */
  BROKEN_VALUE_SHARE: 0.1,
  /** D-89 repair (RP13 a, RP14 a, RP15 b; src/engine/repair.ts; placeholders). E = effective Handiwork × FORGE_MULT at a
   * forge (1 elsewhere); r = the item's need ÷ E. r ≤ 1 is a sure Success; past REPAIR_REACH it is not tried; between, the
   * margin is d100 − REPAIR_RISK × (r − 1) on the usual bands. Time = REPAIR_S × r^REPAIR_TIME_POWER × the share of the
   * pools put back (1 = empty to full). At a forge Near Miss puts back REPAIR_NEAR_MISS_SHARE of what is missing; in the
   * field each tier puts back REPAIR_FIELD_SHARE of the full pool */
  FORGE_MULT: 2,
  REPAIR_RISK: 100,
  REPAIR_REACH: 2,
  REPAIR_S: 30,
  REPAIR_TIME_POWER: 2,
  REPAIR_NEAR_MISS_SHARE: 0.5,
  REPAIR_FIELD_SHARE: { near_miss: 0.1, success: 0.2, great_success: 0.3, critical_success: 0.5 } as Record<string, number>,
  /** BA2: picking a lock (the Action times pick_lock row, about a minute for a common lock at effective skill 50) is halved
   * for every PICK_HALVING_PER points above 50 and doubled for every PICK_HALVING_PER below */
  PICK_HALVING_PER: 25,
  /** scaling: picking keeps halving forever (150: about 4 s, 200: about 1 s, so supernatural fingers open locks at a touch);
   * a number stops the halving at that skill instead */
  PICK_FAST_CAP: null as number | null,
};
