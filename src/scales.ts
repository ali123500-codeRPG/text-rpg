// Ordered scales (Ali, 07/11/2026). Each scale is one table of [key, display name] rows, lowest first.
// Code and saves use only the key; a level's order is its row position; display names live only here.
// Adding or renaming a level edits only its table.

export type Scale<K extends string> = {
  /** keys, lowest first */
  keys: readonly K[];
  /** row position of a key, 0 = lowest */
  pos(k: K): number;
  /** key at a position, clamped to the ends */
  at(i: number): K;
  /** display name of a key */
  name(k: K): string;
  /** key for a key or display name in any case (text from Claude or an old save); undefined if unknown */
  keyOf(word: unknown): K | undefined;
  /** is this one of the scale's keys */
  has(x: unknown): x is K;
  /** text for prompts and errors: "a, b or c" */
  list(): string;
};

export function scale<const K extends string>(rows: readonly (readonly [K, string])[]): Scale<K> {
  const keys = rows.map((r) => r[0]);
  const names = new Map<K, string>(rows.map((r) => [r[0], r[1]]));
  const has = (x: unknown): x is K => typeof x === 'string' && names.has(x as K);
  return {
    keys,
    pos: (k) => keys.indexOf(k),
    at: (i) => keys[Math.max(0, Math.min(keys.length - 1, i))],
    name: (k) => names.get(k) ?? String(k),
    keyOf: (w) => {
      if (has(w)) return w;
      if (typeof w !== 'string') return undefined;
      const s = w.trim().toLowerCase();
      return rows.find(([k, n]) => k === s || n.toLowerCase() === s)?.[0];
    },
    has,
    list: () => rows.map((r) => r[1]).join(', ').replace(/, ([^,]*)$/, ' or $1'),
  };
}

/** check tiers, worst first (Part 1 §4); renamed by Ali 07/11/2026 */
export const TIERS = scale([
  ['critical_failure', 'Critical Failure'], ['failure', 'Failure'], ['near_miss', 'Near Miss'],
  ['success', 'Success'], ['great_success', 'Great Success'], ['critical_success', 'Critical Success'],
]);
/** band tactics (V2) */
export const TACTICS = scale([['simple', 'simple'], ['competent', 'competent'], ['cunning', 'cunning']]);
/** zone light, brightest first (V1) */
export const LIGHT = scale([['bright', 'bright'], ['dim', 'dim'], ['dark', 'dark']]);
/** stance of one actor toward another, coldest first (Ali, 07/11/2026: hostile = attacks on sight; opposed = at odds, won't strike first) */
export const STANCES = scale([['hostile', 'hostile'], ['opposed', 'opposed'], ['neutral', 'neutral'], ['friendly', 'friendly']]);
/** XP reward levels for achievements and quests (Ali, 07/11/2026); XP per level is CONFIG.REWARD_XP */
export const REWARD_LEVELS = scale([['i', 'I'], ['ii', 'II'], ['iii', 'III'], ['iv', 'IV']]);
export type RewardLevel = (typeof REWARD_LEVELS.keys)[number];
/** time of day, in the order a day runs from dawn (T2, Ali 07/11/2026); each starts at CONFIG.TIME_OF_DAY_FROM */
export const TIME_OF_DAY = scale([['dawn', 'Dawn'], ['day', 'Day'], ['dusk', 'Dusk'], ['night', 'Night']]);
export type TimeOfDay = (typeof TIME_OF_DAY.keys)[number];
/** body-part states, best first; ruleset/body.ts poolState names them (H12: healing reach is a key here, so perks shift it by steps) */
export const PART_STATES = scale([['healthy', 'Healthy'], ['damaged', 'Damaged'], ['crippled', 'Crippled'], ['destroyed', 'Destroyed']]);
export type PartStateKey = (typeof PART_STATES.keys)[number];
/** the player's posture (ST5, Ali 08/11/2026: not named like the Sneaking skill) */
export const POSTURES = scale([['open', 'Open'], ['stealthy', 'Stealthy']]);
/** zone cover (V1) */
export const COVER = scale([['none', 'none'], ['some', 'some'], ['heavy', 'heavy']]);
