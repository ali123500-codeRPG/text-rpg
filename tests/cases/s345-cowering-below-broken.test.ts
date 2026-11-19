// BF79: a morale level below Broken. Morale lost can now pass max morale, up to CONFIG.MORALE_COWER_AT × max (a balance
// lever, 1.2); there the actor is Cowering: it cowers and cannot even flee. A broken one keeps paying fears on its way down;
// one that surrendered pays no more. Broken runs from 100 % lost up to Cowering, and every Broken rule holds at Cowering too.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { actorById } from '../../src/engine/relations';
import { payFear } from '../../src/engine/morale';
import { isBrokenLevel, maxMorale, moraleLevel, moraleLost, setMoraleLost } from '../../src/ruleset/morale';
import { CONFIG } from '../../src/config';
import { MORALE_LEVELS } from '../../src/scales';
import { createRng } from '../../src/rng';
import { FR } from '../../src/library/tableIds';

describe('345 BF79: Cowering, below Broken', () => {
  it('Cowering is the last level; morale lost stops at MORALE_COWER_AT × max, and Broken spans 100 % up to it', () => {
    const s = makeVillage();
    const p = s.player, max = maxMorale(p);
    expect(MORALE_LEVELS.keys.at(-1)).toBe('cowering');
    expect(CONFIG.MORALE_COWER_AT).toBe(1.2);
    setMoraleLost(p, max);
    expect(moraleLevel(p)).toBe('broken');
    setMoraleLost(p, 1.1 * max);
    expect(moraleLevel(p)).toBe('broken');
    setMoraleLost(p, 5 * max);
    expect(moraleLost(p)).toBeCloseTo(CONFIG.MORALE_COWER_AT * max, 6);
    expect(moraleLevel(p)).toBe('cowering');
    expect(isBrokenLevel('cowering')).toBe(true);
  });

  it('a broken NPC keeps paying fears down to Cowering; a surrendered one pays no more', () => {
    const s = makeVillage();
    const slime = actorById(s, 'slime_1')!, patron = actorById(s, 'patron_1')!;
    slime.mind!.moraleState = 'broken';
    setMoraleLost(slime, maxMorale(slime));
    expect(payFear(s, createRng(1), slime, FR.bandmate_down, { cost: maxMorale(slime) })).toBeUndefined(); // no second break
    expect(moraleLevel(slime)).toBe('cowering');
    patron.mind!.moraleState = 'surrendered';
    setMoraleLost(patron, maxMorale(patron));
    payFear(s, createRng(1), patron, FR.bandmate_down, { cost: maxMorale(patron) });
    expect(moraleLevel(patron)).toBe('broken');
  });

  it('an Overwhelm never lifts a Cowering one back to Broken', () => {
    const s = makeVillage();
    const slime = actorById(s, 'slime_1')!;
    setMoraleLost(slime, CONFIG.MORALE_COWER_AT * maxMorale(slime));
    expect(payFear(s, createRng(1), slime, FR.dread_presence, { gap: -3, overwhelm: true })).toBeUndefined();
    expect(moraleLevel(slime)).toBe('cowering');
  });
});
