// CONFIG defaults: Part 3: health, bodies and perception ranges. src/config.ts spreads every part into one DEFAULTS in file order,
// so a key keeps its place: moving keys between parts, or reordering them, changes CONFIG's key order.
import type { DefenseKind } from '../types';
import type { HealthLevelKey, MoraleLevel } from '../scales';

export const BODY = {
  // ---- Part 3 ----
  HP_BASE: 50,
  HP_PER_END: 1,
  HEALTH_SHOWN_FROM: 'wounded' as HealthLevelKey, // others' health level shows from this level down (Voyage C2)
  /** health % lost stops here: Dead at 150% */
  HP_LOST_MAX: 150,
  HEALTH_TRACK: [
    // [HEALTH_LEVELS key, max % lost, wounds modifier in % of the average roll (PW1 b)], in the scale's order
    ['unhurt', 0, 0], ['bruised', 15, 0], ['hurt', 30, -7], ['injured', 45, -13],
    ['wounded', 60, -20], ['mauled', 75, -27], ['critical', 99.999, -40], ['incapacitated', 149.999, 0],
    ['dead', Infinity, 0], // dead at 150% lost (was 200%); the player's own Dead is never shown; others clearly seen show Dead
  ] as [HealthLevelKey, number, number][],
  PART_SHARE: { tiny: 0.15, extra_small: 0.15, small: 0.2, normal: 0.3, big: 0.5 } as Record<string, number>,
  HIT_WEIGHT: { tiny: 0.25, extra_small: 0.5, small: 1, normal: 2, big: 4 } as Record<string, number>,
  AIM_PENALTY: { tiny: -40, extra_small: -35, small: -30, normal: -20, big: -10, general: 0 } as Record<string, number>,
  AIM_EASE_PCT: 10, // TM26: each aimed-hits-by-size achievement row takes this % off the aim penalty for its size (carried up the chain)
  GENERAL_MIN_PCT: 30,
  GENERAL_BIG_WEIGHT: 4,
  IMPACT_MULT: { non_essential: 0, normal: 1, essential: 1.5 } as Record<string, number>,
  ROLE_PENALTY: { damaged: -13, crippled: -27 }, // % of the average roll (PW1 b, PW3 a)
  /** a part or pool is in a state while its % left is above that state's floor: Healthy >50, Damaged >0, Crippled >−100; else Destroyed */
  PART_STATE_ABOVE: { healthy: 50, damaged: 0, crippled: -100 } as Record<string, number>,
  ESSENTIAL_CRIPPLED_PENALTY: -7, // % of the average roll (PW3 a); wounds on every roll while any essential part (head, neck …) is Crippled or worse; once, however many
  SHARED_ROLE_OFF_PCT: 0.6,
  // CS24: a Destroyed part counts this many times a Crippled one, alike for its role penalty and for switching a shared
  // role off (no running, can't fly)
  DESTROYED_PART_WEIGHT: 1.2,
  WEAPON_CLASSES: {
    light: { damage: 20, hit: 10 }, medium: { damage: 25, hit: 0 }, heavy: { damage: 30, hit: -10 },
    punch: { damage: 15, hit: 10 }, slam: { damage: 20, hit: 10 },
    grapple: { damage: 5, hit: 0 }, // grab and wrench (placeholder): anyone can grapple; Hold (A8) locks on
  } as Record<string, { damage: number; hit: number }>,
  UNARMED_PROFILE: { damage: 15, hit: 10 },
  HEAVY_VS_BLOCK_GAP: -1, // a heavy melee blow is harder to stop: gap shift against Block and Parry
  TURN_ASIDE_GAP: 2, // A22 Turn Aside: a heavy or crushing hit on the owner counts this much better, never past gap 0 (placeholder)
  CLEAN_GAP: 2, // A2 Turn the Blade, A10 Make Them Stumble: a parry or dodge at this gap or better is clean (the whole blow stopped)
  PARRY_STRIKE_GAP: 3, // PA4: a full parry, at this gap or better, earns a free strike back
  ANSWER_THE_BLOW_DROP: 2, // PA7: Answer the Blow lowers the strike's gap by this much when parrying with a medium weapon
  /** D-337: parry strike-backs (PA4) and the All-50 Counter each come at most this many times per round (counted apart;
   * placeholder). Scaling it by speed is parked (D-338) */
  STRIKE_BACK_LIMIT: 1,
  /** D-337: Ceaseless Guard (Parry 100) raises that limit to this many (placeholder) */
  CEASELESS_GUARD_LIMIT: 5,
  // the ladder's rows run GAP_MIN..GAP_MAX; −6..−10 are placeholders (+0.5 a step). A gap past GAP_MAX uses that row; past
  // GAP_MIN each further step adds GAP_PAST_STEP, with no top (CS10)
  GAP_MIN: -10,
  GAP_MAX: 5,
  GAP_PAST_STEP: 0.5,
  GAP_LADDER: {
    dodge: { [-10]: 4.5, [-9]: 4, [-8]: 3.5, [-7]: 3, [-6]: 2.5, [-5]: 2, [-4]: 1.5, [-3]: 1.375, [-2]: 1.25, [-1]: 1.1, 0: 1, 1: 0.8, 2: 0, 3: 0, 4: 0, 5: 0 },
    block: { [-10]: 4.5, [-9]: 4, [-8]: 3.5, [-7]: 3, [-6]: 2.5, [-5]: 2, [-4]: 1.5, [-3]: 1, [-2]: 1, [-1]: 1, 0: 1, 1: 0.75, 2: 0.5, 3: 0.25, 4: 0.2, 5: 0.15 },
    // PA3 (placeholders): cuts less than Block at +1, stops the blow fully from CLEAN_GAP (+2, a clean parry); a failed parry punishes harder
    parry: { [-10]: 5, [-9]: 4.5, [-8]: 4, [-7]: 3.5, [-6]: 3, [-5]: 2.5, [-4]: 2, [-3]: 1.5, [-2]: 1.25, [-1]: 1.1, 0: 1, 1: 0.85, 2: 0, 3: 0, 4: 0, 5: 0 },
  } as Record<DefenseKind, Record<number, number>>,
  /** the gap ladder's outcome and location thresholds (Part 3, Defense), beside GAP_LADDER's multipliers */
  HIT_GAPS: {
    graze: 1, // a dodge that wins by this or more (and still takes a share of the blow) is grazed
    blockFrom: 1, // a block or parry at this gap or better is blocked ...
    shieldFrom: 0, // ... and a block with a shield from this gap, which then takes the hit
    heavy: -4, // a hit at this gap or worse is a heavy hit
    crushing: -5, // ... and at this gap or worse a crushing hit
    movesAdjacent: -2, // at this gap or worse a hit moves to the named part if it is adjacent ...
    movesAnywhere: -3, // ... and at this gap or worse to the named part anywhere
    noEssentialFrom: { dodge: 0, block: -1, parry: -1 }, // from this gap up a hit never lands on an essential part
    nonEssentialOnlyFrom: { block: 0, parry: 0 }, // from this gap up a block or parry lets it land on non-essential parts only
  } as { graze: number; blockFrom: number; shieldFrom: number; heavy: number; crushing: number; movesAdjacent: number; movesAnywhere: number;
    noEssentialFrom: Record<DefenseKind, number>; nonEssentialOnlyFrom: Record<'block' | 'parry', number> },
  /** D-76: situational roll modifiers below are % of the roller's average roll (50.5 + SKILL_WEIGHT × effective skill), as wounds are */
  DODGE_VS_MISSILE: 13,
  OUTNUMBERED_MOD: -7, // Q2, D-76
  /** LG11: a defense roll's modifier by the defender's awareness of the attacker, read by step: aware 0, suspicious
   * AWARENESS_STEP.suspicious, unaware AWARENESS_STEP.unaware (Q2, D-76: −13% when unaware); Unseen Strike moves both one step on */
  AWARENESS_DEFENSE: [0, -13, -27],
  AWARENESS_STEP: { suspicious: 0, unaware: 1 } as Record<'suspicious' | 'unaware', number>,
  INIT_UNAWARE: 0, // Q2: unaware actors act last
  /** AT11: the skill at which an Action times row (or a reaction) takes its listed seconds; faster above, slower below */
  ACTION_SPEED_PIVOT: 50,
  /** AT58/AT60: reaction time when a fight starts for an actor: REACT_BASE_S seconds at an initiative total of
   * ACTION_SPEED_PIVOT, halving every REACT_HALVING points above (doubling below), times the time factor; a hesitation waits it out again */
  REACT_BASE_S: 2,
  REACT_HALVING: 50,
  /** AT74: Gut Feeling rolls once every this many rounds for each hidden watcher */
  HUNCH_EVERY_ROUNDS: 20,
  /** AT74: perk marks that lasted "the next turn" (Leg Bolt's slow, Make Them Stumble, Dirt in the Eyes) last this many rounds */
  PERK_MARK_ROUNDS: 2,
  OVERWHELM_TIERS: 3, // MR4 Overwhelm: an aura roll lost by this many tiers or more can overwhelm
  OVERWHELM_MORALE_SHARE: 0.5, // ... a target whose max morale is at most this share of the owner's
  /** TC37 a: a projected aura (Battle Cry, later Rally) also reaches anyone within this × the owner's aura reach, heard or not */
  PROJECTED_AURA_MULT: 2,
  /** TC50 a: S3 feigned flight ends after this many seconds of game time with no lone follower (three fight turns) [placeholder] */
  FEINT_S: 18,
  /** TC41 a: Rallied, from any rally: this bonus on every roll for the rest of the fight; a second rally adds nothing */
  RALLIED_MOD: 5,
  /** TC43 a: a rally roll is the rallied one's morale check plus this share of the rallier's rallying skill (augment equation) [placeholder] */
  RALLY_SHARE: 0.5,
  /** TC55 a: a code-run NPC with Rally uses it when an ally it would reach is at this morale level or worse [placeholder] */
  RALLY_AT: 'afraid' as MoraleLevel,
  /** TC58 a: a code-run NPC plays dead (window open) when at this morale level or worse [placeholder] ... */
  PLAY_DEAD_AT: 'afraid' as MoraleLevel,
  /** ... or when this many foes or more are within one move of it [placeholder] */
  PLAY_DEAD_FOES: 2,
  AURA_REACH_M: 8, // I3/RD1: metres an engagement aura reaches (placeholder); the aura skill sets it once RD9's formula is chosen (D-193)
  SPAR_LIMIT: 'critical' as HealthLevelKey, // SP4 (placeholder): a fighter at this health level or worse is out of the spar; a cruel spar uses Incapacitated
  /** ranged attacks: the penalty by how far the target is as a share of the mode's reach (both from real metres), first
   * band the share fits in; a longbow at 50 m is barely stretched, a shortbow at 50 m is at its limit */
  RANGE_SHARE_MODS: [[0.25, 0], [0.5, -7], [0.75, -13], [1, -20]] as [number, number][],
  HOSTILE_NEAR_MOD: -13, // a ranged attack with a hostile near the shooter (HOSTILE_NEAR_STEP_M + its reach) (Point Blank removes it)
  /** BG-267, IC7 a: every reach check (withinM) allows this many metres past the reach for a step's rounding */
  REACH_MARGIN_M: 0.1,
  /** SZ8: arm span (fingertip to fingertip) as a share of height; about 1 for people (placeholder). An arm reaches
   * (height × this − width) ÷ 2 past the body's edge (library/bodySize armReachM), and a held weapon reaches that plus its length */
  ARM_SPAN_SHARE: 1,
  /** RD5, SZ19: a hostile is near the shooter (close enough to strike or grab) within this step plus its own melee reach,
   * between bodies: a knife 1.7 m, a longsword 2.3 m, a horse's kick 2.6 m. The step is the far end of Hall's personal distance */
  HOSTILE_NEAR_STEP_M: 0.75,
  /** LT1 (placeholders): each LIGHT level's light in lux (Wikipedia "Lux": overcast day 1,000; living room 50; civil
   * twilight ends at 3.4; full moon 0.05-0.3; moonless clear night 0.002; a shut cellar 0) */
  LIGHT_LUX: { bright: 1000, lamplit: 50, dim: 3, moonlit: 0.2, dark: 0.002, black: 0 } as Record<string, number>,
  /** LT2: a sight roll takes −LIGHT_DECADE_MOD for each tenfold drop below FULL_SIGHT_LUX (the eye works on a log scale) */
  LIGHT_DECADE_MOD: 7, // % of the average roll (D-76)
  FULL_SIGHT_LUX: 50,
  /** LT2 (placeholder, open question): the lux a roll in pitch black reads, so its modifier stays a number (an overcast
   * moonless night, 0.0001 lux: −28); in pitch black nothing is seen at all (perception) */
  LIGHT_FLOOR_LUX: 0.0001,
  /** the rules that once read "dark" (sight at most partial, a still figure only half seen) hold from this level down */
  DARK_FROM: 'moonlit' as string,
  /** CV1 (placeholders): the share of a standing person each COVER level hides from a shooter (D&D 5e SRD half and
   * three-quarters cover; light and dense added at either end) */
  COVER_HIDDEN: { none: 0, light: 0.25, some: 0.5, heavy: 0.75, dense: 0.875 } as Record<string, number>,
  /** CV6, CV7 (placeholder): a shot loses, and a hide gains, this much for each halving of what shows of the body: the step
   * AIM_PENALTY takes between big, normal and small parts, each half the hit weight of the last (in points at skill 50: cover is a % of
   * the average roll, D-76, aim stays flat) */
  COVER_HALVING_MOD: 13,
  /** PC2: a viewer's eye stands this share of its body's height above its floor (eye height ÷ stature, ANSUR II) */
  EYE_SHARE: 0.94,
  /** PC2: hiding with nobody in particular to hide from, a piece of furniture this near the body (metres, floor gap) hides
   * its own height (placeholder) */
  OBJECT_COVER_M: 1,
  /** CV8 b: Past the Cover counts the target as showing 2^this times as much (two halvings back) */
  PAST_THE_COVER_HALVINGS: 2,
  /** loudness of each NOISE level in decibels at 1 m, from real references (the library's noiseLevels rows); null = no sound */
  NOISE_DB: { silent: null, faint: 20, hushed: 30, quiet: 40, murmur: 50, normal: 60, raised: 70, loud: 88, blaring: 100, deafening: 120 } as Record<string, number | null>,
  /** BG-251: how loud a missile's impact is where it lands: on armour, a shield or a hard surface like an axe biting wood
   * (3M Noise Navigator: chopping wood 66-71 dBA at 5 m, pounding tent stakes 66 dBA at 15.2 m, about 80-90 dB at 1 m);
   * on flesh, clothing or soft ground some 20 dB less (Brüel: soft-material impacts peak 20-25 dB below metal; an estimate) */
  IMPACT_NOISE: { hard: 'loud', soft: 'raised' } as const,
  /** hearing (perception/noise.ts, BG-57, HB1–HB5): a sound weakens 20·log10(metres) with distance (the inverse-square
   * law, never nearer than NEAREST_M) and loses SOUND_LOSS_DB at each crossing on its way, by the least-loss route. It is
   * heard while at least HEARING_FLOOR_DB and heard clearly (who and what) from CLEAR_ABOVE_FLOOR_DB over it: ANSI/ASA S12.60
   * asks a classroom's speech to stand 15 dB over its background. */
  NEAREST_M: 1, // the nearest any sight or sound is measured: the 1 m every decibel level is given at
  CLEAR_ABOVE_FLOOR_DB: 15,
  /** D-231: one hearing floor everywhere while per-zone background noise is parked: a quiet place (40 dB, a library or a quiet
   * street at night, Québec) at the old 0.5 game share. A [Proposed] lever. */
  HEARING_FLOOR_DB: 20,
  /** HB8: a whisper to someone within WHISPER_REACH_M is said leaning in, WHISPER_LEAN_M from their ear (an estimate:
   * no measured leaning distance was found) */
  WHISPER_REACH_M: 1,
  WHISPER_LEAN_M: 0.3,
  /** HB4: decibels lost at each crossing, by SOUND_LOSS level: an open gap nothing; a shut window about 30, a shut door about
   * 30, a wall about 35 (their sound transmission class, STC) */
  SOUND_LOSS_DB: { open: 0, window: 30, door: 30, wall: 35 } as Record<string, number>,
  /** sight (perception sightLevel): how far each VISIBILITY level is made out clearly (who and what) and glimpsed
   * (something, not who), in metres, in daylight with a clear view, from real references (the library's
   * visibilityLevels rows); null = nothing to see. Sight distance is never under NEAREST_M (seeingM), so a level made
   * out only nearer than that (faint) is at most glimpsed. A dark zone caps sight at partial. */
  SIGHT_M: { unseen: null, faint: [0.5, 2], slight: [2, 6], close: [6, 20], low: [15, 60], normal: [25, 200], high: [50, 500], bright: [100, 1000], glaring: [200, 2000] } as Record<string, [number, number] | null>,
};
