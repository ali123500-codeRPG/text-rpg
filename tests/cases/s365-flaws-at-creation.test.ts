// Flaws at character creation (hub page "Flaws at character creation"): FC1 exactly CREATION_FLAWS flaws, one per tag;
// FC3 a flawed skill takes at most CREATION_MAX_FLAWED points and is never tagged; FC4 (D-377) each flaw adds
// FLAW_BURDEN_GROUP_PCT to the Total share of every skill in its group, itself included.
import { afterEach, describe, expect, it } from 'vitest';
import { CONFIG, resetConfig } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { createPlayer, presetSkills, recommendedBuild, validateBuild } from '../../src/library/spawn';
import { npcTemplate } from '../../src/library';
import { TP } from '../../src/library/templateIds';
import { burdenShare, burdenTotal } from '../../src/ruleset/burdenTotal';

afterEach(() => resetConfig());

describe('FC1, FC3: choosing flaws', () => {
  const b = recommendedBuild();

  it('the recommended build flaws three skills it never uses, and the sheet keeps them at 0 as Flawed', () => {
    expect(b.flawed).toHaveLength(CONFIG.CREATION_FLAWS);
    expect(validateBuild(b)).toEqual([]);
    const p = createPlayer(b, 's1');
    for (const k of b.flawed) expect(p.core.skills[k]).toEqual({ raw: 0, state: 'flawed' });
  });

  it('needs exactly CREATION_FLAWS flaws, none tagged, each at most CREATION_MAX_FLAWED', () => {
    expect(validateBuild({ ...b, flawed: [SK.persuasion, SK.barter] })).toEqual([`Flaw exactly ${CONFIG.CREATION_FLAWS} skills (2 flawed)`]);
    expect(validateBuild({ ...b, flawed: [SK.persuasion, SK.barter, SK.parry] })).toEqual(['Parry cannot be both tagged and flawed']);
    const dodge25 = { ...b.skills, [SK.dodge]: 25, [SK.parry]: 10 }; // dodge flawed above its creation max
    expect(validateBuild({ ...b, skills: dodge25, flawed: [SK.persuasion, SK.barter, SK.dodge] })).toEqual(['Dodge is above 20 (flawed)']);
    expect(() => createPlayer({ ...b, flawed: [] }, 's1')).toThrow(/invalid build/);
  });
});

describe('FC4 (D-377): flaws raise their group\'s share of the Total', () => {
  const mate = CONFIG.FLAW_BURDEN_GROUP_PCT / 100, tag = CONFIG.TAG_BURDEN_GROUP_PCT / 100;

  it('every skill in a flaw\'s group, itself included, counts +5% per flaw; a tag and a flaw in one group cancel', () => {
    expect(burdenShare(SK.persuasion, [], [SK.persuasion])).toBeCloseTo(1 + mate);
    expect(burdenShare(SK.intimidation, [], [SK.persuasion])).toBeCloseTo(1 + mate); // Influence
    expect(burdenShare(SK.block, [], [SK.persuasion])).toBe(1);
    expect(burdenShare(SK.intimidation, [], [SK.persuasion, SK.barter, SK.intimidation])).toBeCloseTo(1 + 3 * mate);
    expect(burdenShare(SK.intimidation, [SK.barter], [SK.persuasion])).toBeCloseTo(1 - tag + mate);
  });

  it('the hub page example: Intimidation 60, Barter 40 beside a flawed Persuasion add 5 to the Total', () => {
    const n = (state: 'normal' | 'flawed', raw: number) => ({ raw, state });
    expect(burdenTotal({ [SK.persuasion]: n('flawed', 0), [SK.intimidation]: n('normal', 60), [SK.barter]: n('normal', 40) })).toBeCloseTo(100 * (1 + mate));
    expect(burdenTotal({ [SK.persuasion]: n('flawed', 0), [SK.intimidation]: n('flawed', 60), [SK.barter]: n('flawed', 40) })).toBeCloseTo(100 * (1 + 3 * mate));
  });
});

describe('FC8 b: NPCs mirror the tags: low-band skills are flawed', () => {
  it('a guard preset: high band tagged, moderate normal, low flawed', () => {
    const bandit = { ...npcTemplate(null, TP.guard), id: 'bandit', classId: undefined, generation: 'rolled' as const, minimums: {} };
    const s = presetSkills(bandit); // Soldier, Town watch, Trained (anchor 50), no class floors
    expect(s[SK.melee_medium].state).toBe('tagged');
    expect(s[SK.endurance].state).toBe('normal');
    expect([s[SK.parry], s[SK.earshot]]).toEqual([{ raw: 30, state: 'flawed' }, { raw: 30, state: 'flawed' }]);
  });
});
