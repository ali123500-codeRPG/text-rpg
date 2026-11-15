// PW1 b, PW3 a, PW4 a, PW5 a (Wound and morale penalties as %): every wounds-type penalty is a % of the average
// roll (50.5 + SKILL_WEIGHT × effective skill), sized so skill 50 plays as the old flat numbers did, still one wounds pile
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { averageRoll, woundsOnRoll } from '../../src/ruleset/body';
import { effectiveSkill, ruleset } from '../../src/ruleset';
import { SK } from '../../src/library/skillIds';
import { makeVillage } from '../harness/village';
import { forcedRng } from '../../src/rng';

const wounded = (skill: number) => woundsOnRoll([{ source: 'health: Wounded', type: 'wounds', value: -20 }], skill)[0];

describe('333 wound penalties as % of the average roll', () => {
  it('Wounded 20% costs as much as the old −15 at skill 50, less below it and more past it, with no ceiling', () => {
    expect(averageRoll(50)).toBe(50.5 + CONFIG.SKILL_WEIGHT * 50);
    expect(wounded(50).value).toBeCloseTo(-15.1);
    expect(wounded(0).value).toBeCloseTo(-10.1); // the die's average keeps a wound biting at skill 0
    expect(wounded(200).value).toBeCloseTo(-30.1);
    expect(wounded(400).value).toBeCloseTo(-50.1);
    expect(wounded(50).pct).toBe(-20); // PW5 a: the % travels with the points
  });
  it('a roll carries each wound as its % and the points it came to at the roll’s effective skill', () => {
    const s = makeVillage();
    s.player.core.condition.hpLostPct = 50; // Wounded
    s.player.core.skills[SK.dodge] = { raw: 150, state: 'normal' };
    const r = ruleset.roll({ actorId: s.player.id, skill: SK.dodge, modifiers: [], tierShifts: [] }, s, forcedRng([50]));
    const m = r.modifiers.find((x) => x.source === 'health: Wounded')!;
    expect(m.pct).toBe(-20);
    expect(m.value).toBeCloseTo(-0.2 * averageRoll(effectiveSkill(s, s.player, SK.dodge).value));
  });
});
