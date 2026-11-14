// The Character page as one screen with pop-ups (CP1-CP5): a skill's pop-up lists what its number is made of, read from
// the same sum the rules use, so the parts always add up to the true skill shown on the sheet.
import { describe, expect, it } from 'vitest';
import { skillFacts } from '../../src/ui/charsheet';
import { essencesSummary } from '../../src/ui/essences';
import { wholeTurn } from '../harness/turn';
import { intent } from '../cases/w4-kit';
import { getLibrary } from '../../src/library';
import { trueSkill } from '../../src/ruleset';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { ES } from '../../src/library/essenceIds';

describe('Character page pop-ups', () => {
  it('whole turn: a skill pop-up lists raw plus every part, and they add up to the true skill the rules use', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const p = g.game.state()!.player;
    p.core.skills[SK.dodge] = { raw: 30, state: 'normal' };
    // an essence and a perk that raise Dodge, so the pop-up has parts to list
    p.progression!.essences = [{ essence: ES.street_instinct, grade: 'common', points: { [SK.dodge]: 3 }, turn: 1 }];
    const boost = Object.values(getLibrary().perks).find((d) => d.functionBoost && d.ladder?.skill === SK.dodge);
    if (boost) p.core.perks.push({ perkId: boost.id, source: 'level', gainedTurn: 1 });
    await g.turn(intent({ action: { type: 'wait' } }));
    const f = skillFacts(p, SK.dodge);
    expect(f.value).toBe(trueSkill(p, SK.dodge));
    expect((f.raw + f.parts.reduce((n, x) => n + x.adds, 0)) * f.mult).toBeCloseTo(f.value, 6);
    expect(f.parts.some((x) => x.label.includes('essence') && x.adds === 3)).toBe(true);
    if (boost) expect(f.parts.some((x) => x.label === boost.name)).toBe(true);
    // the next milestone is the first one above the true skill
    expect(f.next).toBeGreaterThan(f.value);
    expect(f.next % CONFIG.PERK_MILESTONE_EVERY).toBe(0);
    expect(f.next - CONFIG.PERK_MILESTONE_EVERY).toBeLessThanOrEqual(f.value);
  });

  it('BU3: Burden shows on an untagged skill only once it is above 0, and never on a tagged one', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    await g.turn(intent({ action: { type: 'wait' } }));
    const p = g.game.state()!.player;
    p.core.skills = { [SK.dodge]: { raw: 40, state: 'normal' }, [SK.insight]: { raw: 90, state: 'tagged' } };
    p.progression!.potential = { base: 40, adjustments: [] };
    expect(skillFacts(p, SK.dodge).burden.by).toBe(0); // at Potential: nothing to show
    p.core.skills[SK.dodge].raw = 40 + 2 * CONFIG.K;
    expect(skillFacts(p, SK.dodge).burden).toEqual({ by: 2, total: 40 + 2 * CONFIG.K, potential: 40 });
    expect(skillFacts(p, SK.insight).burden.by).toBe(0); // tagged: no Burden
  });

  it('a skill with nothing but raw lists no parts', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    await g.turn(intent({ action: { type: 'wait' } }));
    const p = g.game.state()!.player;
    p.core.skills[SK.insight] = { raw: 12, state: 'normal' };
    p.progression!.essences = [];
    const f = skillFacts(p, SK.insight);
    expect(f.value).toBe(trueSkill(p, SK.insight));
    if (f.value === 12) expect(f.parts).toEqual([]);
  });

  it('the Essences tile counts slots used and offers waiting', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    await g.turn(intent({ action: { type: 'wait' } }));
    const p = g.game.state()!.player;
    p.progression!.essenceOffers = [
      { essence: ES.street_instinct, grade: 'common', points: { [SK.dodge]: 1 }, turn: 1, source: 'ending', untilMin: 9e9, pair: 'end1' },
      { essence: ES.street_instinct, grade: 'common', points: { [SK.insight]: 1 }, turn: 1, source: 'ending', untilMin: 9e9, pair: 'end1' },
    ];
    const t = essencesSummary(p);
    expect(t.waiting).toBe(2);
    expect(t.used).toMatch(/^\d+ of \d+$/);
  });
});
