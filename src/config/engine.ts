// CONFIG defaults: Part 2: the engine and the agents. src/config.ts spreads every part into one DEFAULTS in file order,
// so a key keeps its place: moving keys between parts, or reordering them, changes CONFIG's key order.
import type { DurationId } from '../types';
import type { HealthLevelKey, MoraleLevel, NarrationBand, NarrationScale } from '../scales';

export const ENGINE = {
  // ---- Part 2 engine ----
  ERRAND_TURNS: 3, // BG-180: after an NPC answers someone with a deed under way, it gets Planner calls this many turns (a hold ends it)
  AGENT_STAY_S: 180, // BF11/AT33: a place an NPC's own agent moved it to holds this many game seconds, unless its agent decides again
  /** AT73/AT80/AT85: with no new sight or sound, a belief steps down from tracking after DECAY_TRACKING_S game seconds (a hunter
   * on a trail keeps at it longer), from aware after DECAY_AWARE_S, and from suspicious to unaware after DECAY_SUSPICIOUS_S;
   * an alarm stands down after DECAY_AWARE_S with no new alarm */
  DECAY_TRACKING_S: 600,
  DECAY_AWARE_S: 120,
  DECAY_SUSPICIOUS_S: 900,
  MAX_PLANNER_CALLS: 3, // Q2 (D-18)
  UNIQUE_THINKS_PER_TURN: 1, // UG8: goal holders' thinks per turn, after fight calls, nearest the player first (placeholder)
  GOALS_HELD: 3, // UG5: goals one actor holds at most (placeholder)
  STEPS_QUEUED: 3, // UG16: steps a think may queue (placeholder)
  STEP_MAX_DAYS: 3, // UG17: a step with no end given stops after this many days (placeholder)
  /** Claude calls the viewer runs at once (unconfirmed, the spec's "a couple"); background calls keep one free for the turn's own (Q4) */
  CALL_SLOTS: 2,
  MAX_SPOKESPEOPLE: 2, // Q2
  BACKGROUND_WINDOW_MS: 8_000, // Q2 (D-39)
  DIALOGUE_WINDOW_MS: 10_000, // Q2
  WEAVER_TIMEOUT_MS: 120_000, // Q2
  REGION_TIMEOUT_MS: 120_000, // BG-311: a new world's first region call at story start (placeholder); the Weaver's wait starts after it
  NPC_BUILDS_PER_TURN: 1, // NW3: background builds NPCs waiting at unbuilt frontiers may start per turn
  GUIDED_COIN_SHARE: 0.25, // GA9: the guided agent asks before spending more than this share of the coin in one go
  AUTOPILOT_INFO_EVERY: 8, // BG-25: the autopilot looks at /stats, /inv or /quests at most once in this many moves
  AUTOPILOT_SAID_KEPT: 6, // the agent's last commentary lines it is shown, so it doesn't repeat its words
  RPG_VOICE_ON: false, // the RPG Voice connector in the agent bar's Speaker list; parked, Claude's voices only for now
  AUTOPILOT_VOICE_WAIT_MS: 6000, // the agent's command waits up to this long for its spoken line to start, so voice and move line up
  AUTOPILOT_TIMEOUT_MS: 60_000, // a Watch-an-agent-play move that takes longer is given up and asked again, so the bar never hangs
  MAX_ROUTE_ZONES: 4, // Q2
  PLAN_CAPS: { cast: 8, zones: 8, frontiers: 4, places: 4, bands: 3, knows: 5 }, // Q2
  TEXT_CAP: 200, // Q2: free-text length cap for public text (names, looks, labels, knows)
  WORLD_TITLE_CAP: 60, // WP5: the most characters a world's title keeps
  NAME_CAP: 40, // the most characters the creation screen takes for the character's name
  NOTE_CAP: 400, // V6: hidden-only notes (summary, goals, motive, Weaver note, secret facts) are trimmed to this
  SCENARIO_CAPS: { promotions: 3, minted: 2 }, // Q2
  DURATIONS: { brief: 5, short: 30, medium: 120, long: 360 } as Record<DurationId, number>, // NW10: game minutes a routine step lasts (placeholders)
  RECENT_EVENTS: 8, // compact views: last few relevant events
  HEADLINES_PER_PLACE: 3, // CS7: the Weaver sees this many top headlines of each ancestor place (placeholder)
  MEMORY_ENTRIES: 8, // PM1: an NPC's memory list holds at most this many entries (placeholder)
  EARLIER_LINES: 6, // PM6: code-made lines about events older than RECENT_EVENTS (placeholder)
  SAID_LINES: 6, // P5: an NPC's own last lines in its view, so it stops repeating itself
  STORY_PREMISE: 'A swordsman arrives at a village troubled by slimes',
  STORY_START_PLACE: 'tavern', // First build: the place id a new story's first plan fills in (BG-32); the plan's arriveAt says where the player starts (PQ1 a)
  SHOW_MECHANICS: true, // master switch: false removes Show rolls everywhere
  SHOW_ROLLS_DEFAULT: false, // a new story starts with Show rolls off; the player turns it on from the play header
  /** M-33: reaching this health level or worse pulses the play screen's edge red once; from MOTION_EDGE_STEADY on the edge keeps a steady tint */
  MOTION_EDGE_FROM: 'wounded' as HealthLevelKey,
  MOTION_EDGE_STEADY: 'critical' as HealthLevelKey,
  /** MW1: the player's morale reaching this level or worse pulses the edge violet once; from MOTION_NERVE_STEADY on it keeps a
   * steady violet tint (Broken included). Where the red health edge shows too, the red one wins (placeholders) */
  MOTION_NERVE_FROM: 'terrified' as MoraleLevel,
  MOTION_NERVE_STEADY: 'panicking' as MoraleLevel,
  /** Audio for the game (src/ui/sound.ts; all placeholders). VOLUME_DEFAULT: the volume slider's start. CLICK_GAP_MS: clicks
   * closer together than this make one sound. TIER (AU8): the player's own roll, one note per tier row from Critical Failure
   * to Critical Success (HZ), ringing DUR_S[0] in the middle up to DUR_S[1] at either end; failures sag to FALL of their pitch;
   * each step past either end adds a voice an octave out. SWISH: a swing that met nothing. DEATH: the falling tone of the
   * death scene. GAIN: each code-made sound's loudness before the slider. */
  SOUND: {
    VOLUME_DEFAULT: 0.6,
    CLICK_GAP_MS: 60,
    TIER: { HZ: [110, 147, 196, 330, 440, 660], DUR_S: [0.18, 0.7], FALL: 0.7, GAIN: 0.25 },
    SWISH: { HZ: [2400, 600], DUR_S: 0.22, GAIN: 0.18 },
    DEATH: { HZ: [196, 55], DUR_S: 2.4, GAIN: 0.3 },
  },
  TRAIL_ZONES: 3, // the player's last places left, shown to the parser so "go back" has somewhere to mean (placeholder)
  /** agents that name a model and effort; the others run on their MODEL_TIERS tier, which is also the fallback when the
   * named model can't answer. Narrator on Fable 5.2 low: won 15 of 16 blind judgements against the complex tier in playtests */
  AGENT_MODELS: {
    weaver: { model: 'claude-opus-5-5', effort: 'high' },
    world: { model: 'claude-opus-5-5', effort: 'high' }, // WB1: the World builder, the Weaver's other half
    narrator: { model: 'claude-fable-5-2', effort: 'low' },
    // Opus 5.5 low beat the default tier 48 of 60 in blind judging: fewer unmarked lies, repeats and format slips
    responder: { model: 'claude-opus-5-5', effort: 'low' },
    voice: { model: 'claude-opus-5-5', effort: 'low' },
    planner: { model: 'claude-opus-5-5', effort: 'low' },
    // Sonnet 5.5 at its own effort ranked well above the quick tier (Haiku) in blind judging, and answered faster
    parser: { model: 'claude-sonnet-5-5' },
    // AA-108: Fable 5.2 high gave the most and sharpest deed ideas in the comparison with Opus 5.5 high and Fable 5.2 medium
    chronicler: { model: 'claude-fable-5-2', effort: 'high' },
    witness: { model: 'claude-sonnet-5-5' }, // D-141 VW2: a chat beside play, on the Parser's model
  } as Record<string, { model: string; effort?: 'low' | 'medium' | 'high' }>,
  MODEL_TIERS: { parser: 'quick', planner: 'default', responder: 'default', voice: 'default', narrator: 'complex', weaver: 'complex', world: 'complex', autopilot: 'default', chronicler: 'complex', witness: 'quick' } as Record<string, 'quick' | 'default' | 'complex'>,
  STYLE: { tone: 'grounded dark fantasy, told close on the hero\'s shoulder: short, dry lines that size everything up as threat, price or use; big moments count the odds, then one brutal act and one flat line; dark things are told fast and plainly, never lingered on, with no wry line added after; a fight the hero far outclasses is a fast chore of a few lines' }, // TL1 a, TL2 d, TL3 d, TL5, TL28 a (was flavor voice V5)
  /** LN3 narration length per band (placeholders): words from-to and paragraphs; spoken lines come on top (LN8 b) */
  NARRATION_LENGTH: { quick: { words: [25, 60], paragraphs: '1' }, normal: { words: [60, 110], paragraphs: '1 or 2' }, big: { words: [110, 180], paragraphs: '2 or 3' } } as Record<NarrationBand, { words: [number, number]; paragraphs: string }>,
  /** LN6 the story's Narration length setting multiplies the band's words (placeholders) */
  NARRATION_LENGTH_SCALE: { shorter: 0.6, normal: 1, longer: 1.5 } as Record<NarrationScale, number>,
  /** LN4: a turn is Big with at least this many perceived events, Quick with at most NARRATION_QUICK_EVENTS and no change on anyone */
  NARRATION_BIG_EVENTS: 6,
  NARRATION_QUICK_EVENTS: 2,
  /** LN7: playtest reports flag a narration over this many times its band's top */
  NARRATION_OVER: 1.5,
};
