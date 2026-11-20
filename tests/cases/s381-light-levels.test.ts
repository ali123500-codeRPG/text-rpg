// LT1-LT3: six light levels by real lux; a sight roll loses LIGHT_DECADE_MOD for each tenfold drop below FULL_SIGHT_LUX;
// nothing is seen in pitch black; nights are one flat level (moon phases parked).
import { describe, expect, it } from 'vitest';
import { makeVillage, beside } from '../harness';
import { LIGHT } from '../../src/scales';
import { CONFIG } from '../../src/config';
import { isDark, lightMod, startClock, zoneLight } from '../../src/time';
import { sightAt } from '../../src/perception';
import { zoneById } from '../../src/engine/relations';
import { setTitleLight } from '../../src/plan/draw';
import type { Light } from '../../src/types';

describe('381 light levels (LT1-LT3)', () => {
  it('each level reads its lux: 0 down to a lit room, then −7% a tenfold drop; pitch black reads the floor', () => {
    expect(LIGHT.keys).toEqual(['bright', 'lamplit', 'dim', 'moonlit', 'dark', 'black']);
    expect(LIGHT.keys.map((k) => lightMod(k))).toEqual([0, 0, -9, -17, -31, -40]);
    expect(lightMod('dark', 1)).toBe(-24); // Night Eyes: ten times brighter
    expect(lightMod('lamplit', -1)).toBe(-7); // Child of Night: ten times darker
    expect(LIGHT.keys.filter(isDark)).toEqual(['moonlit', 'dark', 'black']);
  });

  it('nothing is seen in pitch black; in the dark, at most half seen', () => {
    const s = makeVillage({ without: ['slime_1', 'slime_2'] });
    const p = beside(s, 'patron_1', 'player', 1);
    const light = (w: Light) => { for (const z of s.zones) setTitleLight(s, z, w); }; // the whole tavern, so no lamp next door lights them
    light('lamplit');
    expect(sightAt(s, s.player, p, 'normal')).toBe('full');
    light('dark');
    expect(sightAt(s, s.player, p, 'normal')).toBe('partial');
    light('black');
    expect(sightAt(s, s.player, p, 'normal')).toBeNull();
  });

  it('LT3: evening and night outdoors are one flat level, moonlit', () => {
    const s = makeVillage();
    const field = zoneById(s, 'field_mid')!;
    setTitleLight(s, field, 'black');
    for (const t of ['evening', 'night'] as const) { startClock(s, t); expect(zoneLight(s, field)).toBe(CONFIG.SKY_LIGHT[t]); }
  });
});
