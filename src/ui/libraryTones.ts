// Library viewer colour coding: one colour per filter value, the same on every tab, in every session.
// A group's values take palette colours in their names-table order; a value never shares a colour with
// another value of its group that shows on the same tab. A group with more values on one tab than there are
// colours gets none (it stays a filter). Pure, so tests/unit/library-tones.test.ts can check it.

/** the categorical hues from styles.css, in assignment order; --c3 (grey) last */
export const PALETTE = ['--c1', '--c2', '--c7', '--c5', '--c12', '--c4', '--c15', '--c10', '--c14', '--c3'] as const;

/** values whose colour carries a meaning of its own */
export const FIXED: Record<string, Record<string, string>> = {
  Effect: { attack: '--c10', defense: '--c1', health: '--c2', senses: '--c5', speech: '--c4', stealth: '--c12', speed: '--c15' },
  State: { built: '--ok', 'not built': '--warn', 'written only': '--c3', quirk: '--danger' },
};

/** occurrences: for each tab, each group's values on it. order: a group's names table (position = order); others sort by name */
export function toneTable(occurrences: Map<string, Map<string, Set<string>>>, order: Record<string, readonly string[]> = {}): Map<string, Map<string, string>> {
  const byGroup = new Map<string, { values: Set<string>; tabs: Set<string>[] }>();
  for (const groups of occurrences.values()) for (const [g, vals] of groups) {
    const e = byGroup.get(g) ?? byGroup.set(g, { values: new Set(), tabs: [] }).get(g)!;
    vals.forEach((v) => e.values.add(v));
    e.tabs.push(vals);
  }
  const out = new Map<string, Map<string, string>>();
  for (const [g, { values, tabs }] of byGroup) {
    if (tabs.some((t) => t.size > PALETTE.length)) continue; // too many to tell apart by colour: filter only
    const pos = (v: string) => { const i = order[g]?.indexOf(v) ?? -1; return i < 0 ? Infinity : i; };
    const sorted = [...values].sort((a, b) => pos(a) - pos(b) || a.localeCompare(b, undefined, { numeric: true }));
    const tones = new Map<string, string>(Object.entries(FIXED[g] ?? {}).filter(([v]) => values.has(v)));
    for (const v of sorted) {
      if (tones.has(v)) continue;
      const taken = new Set(tabs.filter((t) => t.has(v)).flatMap((t) => [...t].map((x) => tones.get(x))));
      tones.set(v, PALETTE.find((c) => !taken.has(c)) ?? PALETTE[PALETTE.length - 1]);
    }
    out.set(g, tones);
  }
  return out;
}
