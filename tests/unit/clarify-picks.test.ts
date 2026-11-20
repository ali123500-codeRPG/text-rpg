// A clarifying question's names can be tapped: the people, places and things the player's view names, matched with or
// without articles, longest first, never overlapping.
import { describe, expect, it } from 'vitest';
import { clarifyPicks } from '../../src/ui/play';

describe('tappable names in a clarifying question', () => {

  it('articles inside a name differ, the longest name wins, and nothing overlaps', () => {
    const pv = { actors: [{ label: 'a lean man in a patched coat' }, { label: 'a man' }], zones: [{ name: 'midden yard' }], zone: { groundItems: [] }, player: { inventory: [{ name: 'charm' }] } } as never;
    const t = 'Which man do you mean: the lean man in the patched coat in the midden yard? Who has the charm?';
    expect(clarifyPicks(t, pv).map((p) => p.phrase)).toEqual(['man', 'the lean man in the patched coat', 'the midden yard', 'the charm']);
  });
});
