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
/** zone cover (V1) */
export const COVER = scale([['none', 'none'], ['some', 'some'], ['heavy', 'heavy']]);
