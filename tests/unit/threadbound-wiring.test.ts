// TB8: Threadbound items keep their parts apart. The item row says which perk each achievement opens; the perks are
// ordinary perk rows that only the item gives; the achievements are ordinary achievement rows; the class that hands one
// out names only a Myth rank, never an item. This guards that wiring so the four never get mixed up.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { getLibrary } from '../../src/library';
import { MYTH_RANKS } from '../../src/scales';

describe('Threadbound wiring (TB8)', () => {
  makeVillage();
  const lib = getLibrary();
  const items = Object.values(lib.items).filter((d) => d.threadbound);
  const grantPerks = items.flatMap((d) => d.threadbound!.grants.map((g) => g.perk));
  const classPerks = Object.values(lib.classes ?? {}).flatMap((c) => [...Object.values(c.levelPerks ?? {}).flat(), ...(c.capstone ?? [])]);

  it('every Threadbound item has a Myth rank, and each grant names a real perk and a real achievement', () => {
    expect(items.length).toBeGreaterThan(0);
    for (const d of items) {
      expect(MYTH_RANKS.keys).toContain(d.threadbound!.myth);
      for (const g of d.threadbound!.grants) {
        expect(lib.perks[g.perk], `${d.id} grant perk ${g.perk}`).toBeDefined();
        expect(lib.achievements?.[g.achievement], `${d.id} grant achievement ${g.achievement}`).toBeDefined();
      }
    }
  });

  it('an item ability is given by exactly one item and no other way (no class, milestone, All-step or race)', () => {
    expect(new Set(grantPerks).size).toBe(grantPerks.length);
    const races = Object.values(lib.races ?? {}).flatMap((r) => [...(r.innatePerks ?? []), ...(r.innateQuirks ?? [])]);
    for (const id of grantPerks) {
      const p = lib.perks[id];
      expect(p.classLevel ?? p.ladder ?? p.allStep, id).toBeUndefined();
      expect(classPerks, id).not.toContain(id);
      expect(races, id).not.toContain(id);
    }
  });

  it('a perk that hands out Threadbound items names a Myth rank only, is a class perk, and is never an item ability', () => {
    const givers = Object.values(lib.perks).filter((p) => p.grantsThreadbound);
    expect(givers.length).toBeGreaterThan(0);
    for (const p of givers) {
      expect(MYTH_RANKS.keys).toContain(p.grantsThreadbound!.minMyth);
      expect(p.classLevel, p.id).toBeDefined();
      expect(grantPerks).not.toContain(p.id);
      expect(items.some((d) => MYTH_RANKS.pos(d.threadbound!.myth) >= MYTH_RANKS.pos(p.grantsThreadbound!.minMyth)), `${p.id} has an item to give`).toBe(true);
    }
  });
});
