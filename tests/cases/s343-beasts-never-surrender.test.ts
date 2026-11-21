// BG-268: in the deck playtest a slime (an Unintelligent race) "surrendered": a break on a morale roll of Critical Failure or worse,
// or an Overwhelm, made any actor give itself up. Now an Intelligent or Semi-intelligent race (people, wolves) can give itself up
// and an Unintelligent one (a slime) never does: a break that would be a surrender just breaks (BF78).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { actorById } from '../../src/engine/relations';
import { payFear } from '../../src/engine/morale';
import { moraleLevel } from '../../src/ruleset/morale';
import { createRng, forcedRng } from '../../src/rng';
import { getLibrary } from '../../src/library';
import { FR } from '../../src/library/tableIds';

describe('343 BG-268: a slime breaks, it never surrenders', () => {
  it('an Overwhelm makes a person surrender and a slime break', () => {
    const s = makeVillage();
    const slime = actorById(s, 'slime_1')!, patron = actorById(s, 'patron_1')!;
    expect(getLibrary().races![slime.core.raceId!].intelligence).toBe('unintelligent');
    expect(payFear(s, createRng(1), patron, FR.dread_presence, { gap: -3, overwhelm: true })).toBe('surrendered');
    expect(moraleLevel(patron)).toBe('broken'); // all its morale lost
    expect(payFear(s, createRng(1), slime, FR.dread_presence, { gap: -3, overwhelm: true })).toBe('broken');
    expect(moraleLevel(slime)).toBe('broken');
  });

  it('a break on a Critical Failure morale roll: a person surrenders, a slime only breaks', () => {
    const got: Record<string, Set<string>> = { patron_1: new Set(), slime_1: new Set() };
    for (const id of ['patron_1', 'slime_1']) {
      const s = makeVillage();
      const a = actorById(s, id)!;
      a.core.skills = Object.fromEntries(Object.entries(a.core.skills).map(([k, v]) => [k, { ...v, raw: 0 }])); // a weak will, so rolls fail often
      a.core.condition.moraleLost = 0;
      const rng = forcedRng(Array(40).fill(1)); // every morale roll a natural 1, so a break comes on a Critical Failure
      for (let i = 0; i < 40 && !a.mind?.moraleState; i++) {
        const r = payFear(s, rng, a, FR.bandmate_down);
        if (r) { got[id].add(r); a.mind!.moraleState = r; }
      }
    }
    expect(got.patron_1.has('surrendered')).toBe(true);
    expect(got.slime_1.has('surrendered')).toBe(false);
    expect(got.slime_1.has('broken')).toBe(true);
  });
});
