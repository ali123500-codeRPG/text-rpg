// Library viewer colour coding: one colour per value, never shared by two values of a group on one tab,
// assigned in names-table order. The real-data walk over every tab runs in the browser smoke check.
import { describe, expect, it } from 'vitest';
import { FIXED, PALETTE, toneTable } from '../../src/ui/libraryTones';

const occ = (tabs: Record<string, Record<string, string[]>>) =>
  new Map(Object.entries(tabs).map(([t, gs]) => [t, new Map(Object.entries(gs).map(([g, vs]) => [g, new Set(vs)]))]));

describe('library tones', () => {
  it('palette and fixed tables have no repeated colour', () => {
    expect(new Set(PALETTE).size).toBe(PALETTE.length);
    for (const t of Object.values(FIXED)) expect(new Set(Object.values(t)).size).toBe(Object.values(t).length);
  });

  it('values sharing a tab never share a colour, and a value keeps one colour on every tab', () => {
    const table = toneTable(occ({
      gear: { Kind: ['weapon', 'armor', 'misc'], Effect: ['attack', 'defense'] },
      perks: { Effect: ['attack', 'defense', 'stealth', 'speed'] },
      classes: { Kind: ['weapon', 'class', 'title'] },
    }));
    const kind = table.get('Kind')!;
    expect(new Set(['weapon', 'armor', 'misc'].map((v) => kind.get(v))).size).toBe(3);
    expect(new Set(['weapon', 'class', 'title'].map((v) => kind.get(v))).size).toBe(3);
    const eff = table.get('Effect')!;
    expect(eff.get('stealth')).not.toBe(eff.get('defense'));
    expect(eff.get('defense')).toBe(FIXED.Effect.defense);
  });

  it('follows the names table order', () => {
    const t = toneTable(occ({ a: { Level: ['Level III', 'Level I', 'Level II'] } }), { Level: ['Level I', 'Level II', 'Level III'] });
    expect([...t.get('Level')!.values()]).toEqual(PALETTE.slice(0, 3));
  });

  it('leaves a group uncoloured when one tab has more values than colours', () => {
    const many = Array.from({ length: PALETTE.length + 1 }, (_, i) => `v${i}`);
    expect(toneTable(occ({ a: { Tree: many } })).has('Tree')).toBe(false);
  });
});
