// CONFIG defaults: Part 5: gear, scenario scales and endings. src/config.ts spreads every part into one DEFAULTS in file order,
// so a key keeps its place: moving keys between parts, or reordering them, changes CONFIG's key order.
import type { QualityKey } from '../scales';
import { ES } from '../library/essenceIds';
import { PAST_100, PAST_100_STEP } from './past100';

export const GEAR = {
  // ---- Part 5 ----
  ACCESSORY_SLOTS: 5,
  /** AX1/AX2: an accessory's bonus = this × EQUIP_NEED of its level: Common 5, Fine 10, Superior 15, Masterwork 20 */
  ACCESSORY_FACTOR: 0.2,
  /** GD3: a code-run guard asks someone it suspects to open their locked container once every this many turns (placeholder) */
  SUSPECT_ASK_TURNS: 3,
  /** armor multiplier by weight; the damage it stops comes from ARMOR_FACTOR × need (QE4) */
  ARMOR_MULTIPLIER: { light: 0.8, medium: 0.65, heavy: 0.55 } as Record<string, number>,
  /** MD1 (D-368): the flat soak grows with weight: reduction = ARMOR_FACTOR × need × this (placeholders) */
  ARMOR_WEIGHT_SOAK: { light: 1, medium: 1.5, heavy: 2 } as Record<string, number>,
  /** EQ9: true skill each equipment level needs (placeholders); IR3: past Masterwork (100) the task grade steps, Divine 400 */
  EQUIP_NEED: { crude: 0, common: 25, fine: 50, superior: 75, masterwork: 100, ...PAST_100 } as Record<string, number>,
  /** IR3: each step past Divine (Divine+, Divine++ …) needs this much more true skill (placeholder) */
  EQUIP_BEYOND_STEP: PAST_100_STEP,
  /** EQ12 c: every roll with an item you fall short on is one outcome step worse per this many points short (or part of it) */
  EQUIP_SHORT_STEP: 10,
  /** CG2: a gear-class skill's own points on a new sheet at or above this give that class's Crude piece (starterKit) */
  CRUDE_KIT_MIN_SKILL: 2,
  /** LG23 a: worn armor lowers Dodge and Parry alike by this × the piece's requirement (its need), by weight: a Fine (need 50)
   * piece costs −5 light, −10 medium, −20 heavy; a Masterwork one twice that (placeholders) */
  ARMOR_DEFENSE_COST: { light: -0.1, medium: -0.2, heavy: -0.4 } as Record<string, number>,
  // AN1–AN4 (values are placeholders): worn armor makes body-moving events this many NOISE steps louder, per
  // ARMOR_WEIGHTS key. Moving stealthily doesn't cancel it. Quiet Mail (AN5) takes one step off.
  ARMOR_NOISE_STEPS: { light: 0, medium: 1, heavy: 2 } as Record<string, number>,
  QUALITY_TABLE: {
    tool: { quality_1: 5, quality_2: 10, quality_3: 15, quality_4: 20 } as Record<QualityKey, number>,
  },
  /** EQ11: a minted item of this quality or better is one equip level above its base */
  QUALITY_LEVEL_UP_FROM: 'quality_3' as QualityKey,
  STALL_TURNS: 8, // placeholder (P7c): quiet turns with no beat left before a new scenario
  /** SC2/AT83/AT84 levers per scenario scale (placeholders), keyed by SCENARIO_SCALES key: the budget in game minutes (fights
   * count like any other time; a long action uses it by its real length) and how many places a plan of that scale may hold
   * (code raises the scale to fit). A place is one location the Weaver builds (a tavern, a farmstead, a stretch of road) */
  // BG-240 (SW9 a): the smaller scales count only acting time (actingOnly: waiting, rest, sleep and trips are left out),
  // sized for turns of about 30 seconds; Journey and Venture count all game time, being made of travel and nights
  SCENARIO_SCALE: {
    moment: { budgetMin: 5, places: 1, actingOnly: true },
    situation: { budgetMin: 15, places: 2, actingOnly: true },
    episode: { budgetMin: 45, places: 4, actingOnly: true },
    journey: { budgetMin: 3 * 24 * 60, places: 8 },
    venture: { budgetMin: 7 * 24 * 60, places: Infinity },
  } as Record<string, { budgetMin: number; places: number; actingOnly?: true }>,
  /** SC4: scales from this one up hold smaller scenarios inside them, one level deep */
  SCENARIO_HOLDS_FROM: 'episode',
  /** SC7: how many endings a scenario plan lists */
  SCENARIO_ENDINGS_MIN: 2,
  SCENARIO_ENDINGS_MAX: 3,
  /** SC6: scenario records kept in the save, and how many the next Weaver gets */
  SCENARIO_RECORDS_SAVED: 30,
  SCENARIO_RECORDS_SHOWN: 5,
  /** SC8 Weaver check-ins (placeholders): at least this many turns apart, and at most this many per scenario (/stuck and the over-time check-in excepted, BG-42) */
  CHECKIN_GAP_TURNS: 5,
  CHECKIN_MAX_PER_SCENARIO: 6,
  /** SC12: at this many times its budget, code ends the scenario as worn out (after any fight or chase) and files a bug */
  SCENARIO_OVERRUN_MULT: 2,
  /** SD2 a: scenario endings (SCENARIO_ENDINGS) after which free roam starts instead of the next scenario. Every ending for now, so
   * players can explore the world; broken_off is a knock-out, whose wake-up is always a new scenario */
  ROAM_AFTER: ['resolved', 'lost', 'left', 'escaped', 'interrupted', 'worn_out'] as string[],
  /** WB7: the rest after a scenario ends, in game minutes by its challenge grade (placeholders): only danger and the player's
   * own acts open a scenario window during it */
  ROAM_REST_MIN: { none: 0, minor: 30, moderate: 60, major: 120, extreme: 240 } as Record<string, number>,
  /** WB6: a quiet stretch of free roam past the rest that opens a scenario window (game minutes, placeholder) */
  ROAM_QUIET_MIN: 120,
  /** WB6: an active job older than this (game minutes since taken, placeholder) is a stale thread: past the rest it opens a window */
  THREAD_STALE_MIN: 240,
  /** WB6: after the Weaver declines a window, no quiet or stale window for this long (game minutes, placeholder) */
  WINDOW_DECLINED_MIN: 60,
  /** BF4/AT34 (placeholder): game seconds an NPC that led someone somewhere (head_to with lead) waits there for them before going back to its routine */
  LEAD_WAIT_S: 90,
  /** D-226 (LF3): while a scenario runs, the player's achievements and All-XXX steps wait for the scenario's end and are
   * granted there together (one gains summary for the ending moment); in free roam they come at once. false: at once always */
  GROWTH_AT_SCENARIO_END: true,
  /** EG7/EG13 (growth proposal): improvement rolls a scenario pays at its end = round(owed rolls marked in it × this share, by
   * the scenario's event-roll tier, × the ending's factor), plus GROWTH_ROLLS_PAST_CRIT per step past Critical Success
   * (placeholders). Marks never roll on their own while GROWTH_AT_SCENARIO_END is on. */
  GROWTH_TIER_SHARE: { critical_failure: 0.5, failure: 0.6, near_miss: 0.7, success: 0.8, great_success: 0.9, critical_success: 1 } as Record<string, number>,
  GROWTH_ROLLS_PAST_CRIT: 1,
  /** EG5 b: what each ending pays (judged endings too: by which ending it was). EG17 a: every factor is kept between
   * ENDING_FACTOR_MIN and ENDING_FACTOR_MAX, so no ending the Weaver writes or picks can pay outside them (placeholders) */
  ENDING_FACTOR: { resolved: 1, lost: 0.75, broken_off: 0.75, left: 0.5, escaped: 0.5, interrupted: 0.5, worn_out: 0.5 } as Record<string, number>,
  ENDING_FACTOR_MIN: 0.5,
  ENDING_FACTOR_MAX: 1.25,
  /** EG10 b: a scenario that marked anything pays this many extra rolls while the character level is below GROWTH_LOW_LEVEL_BELOW */
  GROWTH_LOW_LEVEL_BONUS: 1,
  GROWTH_LOW_LEVEL_BELOW: 5,
  /** growth proposal 2 (essences; placeholders). Points = max(1, round(ESSENCE_SHARE × source skill × grade multiplier)) */
  ESSENCE_SHARE: 0.07,
  /** Imbra's Tier I blessing (Imbra's Measure): the true skill held essences give is raised by this share */
  IMBRA_ESSENCE_BOOST: 0.1,
  ESSENCE_GRADE_MULT: { common: 1, fine: 1.5, rare: 2.5, epic: 4, legendary: 6 } as Record<string, number>,
  /** each grade past the last row multiplies the last row's multiplier by this */
  ESSENCE_GRADE_PAST_MULT: 1.5,
  /** EN1 a: an essence row is on a template's list when the template's weighted average in the row's skills (raw × tier) is
   * at least this share of its best skill [placeholder] */
  ESSENCE_FIT_SHARE: 0.4,
  /** an essence's appearance roll: one appears when d100 ≤ this % (by source: a notable foe, any other foe (mob), or the
   * ending's tier). D-274: a notable foe always has one and a mob 5%, so for a foe only the quality roll fails. Placeholders */
  ESSENCE_APPEAR_CHANCE: { foe: 100, mob: 5, great_success: 60, critical_success: 70 } as Record<string, number>,
  /** an appeared essence's quality roll: margin = d100 + base − ESSENCE_ROLL_NEEDED on the tier table; Near Miss or worse,
   * it fades (the growth proposal's d100 + base − 100: base 80 holds 81%, mostly Fine; base 100 holds 95%) */
  ESSENCE_ROLL_NEEDED: 100,
  ESSENCE_ROLL_BASE: { foe: 80, great_success: 80, critical_success: 100 } as Record<string, number>,
  /** HF18, HF29 a: a beaten echo always offers an essence (no appearance roll); its quality roll goes this many tiers up,
   * and a result below Success still gives ECHO_ESSENCE_FLOOR */
  ECHO_ESSENCE_TIERS: 2,
  ECHO_ESSENCE_FLOOR: 'common' as import('../scales').EssenceGradeKey,
  /** WP6 a: when a world is carried on, each foe who downed its last character (standing, hostile, in that place) takes
   * at most this many of the body's things, the most valuable first; coin goes whole to the first and isn't counted. Placeholder */
  LOOT_TAKE_MAX: 6,
  /** D-253 b: an NPC carrying less coin than this is poor, and loots a body it found at a scenario's end. Placeholder */
  POOR_COIN: 10,
  /** EG2: room for essences = ESSENCE_SLOTS_BASE + one per ESSENCE_SLOT_EVERY character levels (2 at 7, 3 at 14), no top */
  ESSENCE_SLOTS_BASE: 1,
  ESSENCE_SLOT_EVERY: 7,
  /** AT75: an offer waits this many rounds of game time (ROUND_S each: 10 min), or until a new scenario starts */
  ESSENCE_OFFER_ROUNDS: 200,
  /** ES5 a: an essence's coin value = its points × ITEM_VALUE.skillPoint × this (its points are permanent true skill, gear's
   * only last while worn; placeholder) */
  ESSENCE_VALUE_MULT: 10,
  /** EG3 b + EG15 b: removing a held essence (at rest) costs this many levels' worth of XP; the bar may go into debt */
  ESSENCE_REMOVE_LEVELS: 1,
  /** DX5: Hollowed (essence extraction) takes this many times the essence's share from each of its skills, and this share
   * of every skill, both from true skill, for good */
  HOLLOWED_SHARE_MULT: 2,
  HOLLOWED_ALL_LOSS: 0.1,
  /** EB3: the first this many essence changes (letting one go, or swapping one out for an offer) cost no XP */
  ESSENCE_FREE_CHANGES: 3,
  /** EB1: an ending's second offer comes from one of this many bested people with the highest power (placeholder) */
  ESSENCE_TOP_BESTED: 3,
  /** EG9 a, NE3: every essence row's pick weight. Of the rows an NPC carries, one is picked with chance weight ÷ the sum of
   * theirs (a guard carrying Gate-Warden's Habit 1 and Lookout's Eyes 0.25 gives Lookout's Eyes 1 time in 5). Every row has
   * one (test s341); placeholders but Lookout's Eyes, which fits every person so is picked rarely */
  ESSENCE_PICK_WEIGHT: {
    [ES.gel_patience]: 1, [ES.gate_habit]: 1, [ES.street_instinct]: 1, [ES.hard_won_habit]: 1, [ES.haggler_ear]: 1, [ES.tavern_brawler]: 1,
    [ES.fang_nose]: 1, [ES.horn_hide]: 1, [ES.claw_pounce]: 1, [ES.lashing_tail]: 1, [ES.lookout_eyes]: 0.25, [ES.cornered_nerve]: 1,
  } as Record<string, number>,
  /** BG-41: lines of what happened kept per scenario for the Weaver check-in (newest kept; placeholder) */
  SCENARIO_HAPPENED_MAX: 30,
  /** CH7/SC18/AT31: a chase is lost when no pursuer has seen or heard the player for this many game seconds (placeholder) */
  CHASE_LOST_S: 60,
  /** CH5: the chase range of a code-run NPC whose band and template give none (a CHASE_RANGES key; placeholder) */
  CHASE_RANGE_DEFAULT: 'ground',
  /** ZR12: how far past the edge of the scenario's ground, by the walking path, a pursuer with chase range near follows the
   * player before it turns back (placeholder: about a village street or two; a game number, not a real-world reference) */
  CHASE_NEAR_M: 200,
  /** WI8 a, BG-305: a planner's or NPC agent's view holds the zones within this many metres of where it looks, by the walking
   * path (placeholder: about a village street or two, as CHASE_NEAR_M) */
  PLAN_VIEW_M: 200,
  IMPROVISED_HIT_ADJ: -10,
  /** RD7 worn armor's slowing by weight: flat m/s off the body type's speeds, then a share off what is left (an armor item's
   * own `speed` overrides). Placeholders: no study gives speed loss directly; heavy is about a fifth, as asked */
  ARMOR_SPEED: { light: { flat: 0, pct: 0 }, medium: { flat: 0.1, pct: 0.05 }, heavy: { flat: 0.2, pct: 0.15 } } as Record<string, { flat: number; pct: number }>,
  /** CO14 the range unit: one pace in metres, the one lever every range and move scales by (about one stride) */
  PACE_M: 1,
  /** AD8/AD9 the play screen's minimap: how many metres across it shows at first; the widths the minimap and the Map zoom
   * through (closest first; OM7 a, D-1558; the Map's fitted width joins them; the widest also bounds the reach ring); and
   * the nearest point a click plans a move to (closer is where you stand) */
  MINIMAP_VIEW_M: 25,
  MINIMAP_ZOOM_M: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000],
  MINIMAP_MIN_M: 0.5,
  /** MAP-14 (RM28 a): a barrier badge's diameter over its door's drawn width, both to scale at every zoom: the 16 px badge
   *  that sat on a 1 m door at zoom 1 (12 px a metre) */
  MAP_DOOR_BADGE_SHARE: 16 / 12,
  /** MAP-14 (OM12 b): the widest a badge is drawn, in screen pixels: its size at the old closest zoom, kept from there in */
  MAP_BADGE_MAX_PX: 40,
  /** MAP-76 (OM2; placeholder): far out, a settlement's icon covering it, in screen pixels (the World view's size) */
  MAP_SITE_ICON_PX: 24,
  /** MAP-76 (OM11 a; placeholder): far out, the plain round mark of a place with no settlement size, in screen pixels */
  MAP_SITE_DOT_PX: 10,
  /** MAP-76 (placeholder): a landmark's diamond on the land, in screen pixels across */
  MAP_LANDMARK_PX: 8,
  /** MAP-14 (RM31 b): how far a badge for a barrier that opens from one side only (a bar) sits off its door's line toward
   *  that side, as a share of the badge's diameter: at 0.5 the whole badge is on that side, its edge on the line */
  MAP_BADGE_LEAN: 0.5,
  /** MAP-87 (TD1 a): the Map's 3D view draws a wall's height this share of its metres up the screen and this share to the
   *  right, so north stays up and the plan keeps its layout; placeholders */
  MAP_3D_RISE: 0.55,
  MAP_3D_LEAN: 0.3,
  /** MQ7 a: how long a touch is held on the map before it opens the zone's card. Android's long-press timeout is 400 ms
   * (ViewConfiguration.getLongPressTimeout), iOS's long-press gesture 0.5 s (UILongPressGestureRecognizer) */
  MAP_LONG_PRESS_MS: 500,
  /** CO16 floor area in m² of each zone size (ZONE_SIZES); placeholders */
  ZONE_SIZE_M2: { cramped: 9, small: 25, room: 60, hall: 225, yard: 400, open: 1600, vast: 10000 } as Record<string, number>,
};
