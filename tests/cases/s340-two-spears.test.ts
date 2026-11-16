// BG-262, IC4/IC6 a: no attack mode may need more grips than its item takes to hold (the spear held in one grip thrust with
// two, so it thrust two-handed beside a shield). The spear now thrusts in one grip; the war spear takes both.
import { describe, expect, it } from 'vitest';
import { getLibrary } from '../../src/library';

describe('340 two spears', () => {
  it('every attack mode fits in the grips its item takes', () => {
    const over = Object.values(getLibrary().items).flatMap((d) =>
      (d.weapon?.modes ?? []).filter((m) => m.grips > (d.grips ?? 1)).map((m) => `${d.id} ${d.name}: ${m.id} needs ${m.grips}`));
    expect(over).toEqual([]);
  });
});
