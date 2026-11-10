// 136 achievement rewards beyond XP: The Unseen Death (tier up on unaware targets, quieter moves), Death Keeps Waiting
// (a daily save from going Down), Bones Heal Later (the Past the Pain perk), Scourge of the {body_type} Hordes (reads
// that body type's health); and achievement tags.
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { actor } from '../harness/village';
import { ruleset } from '../../src/ruleset';
import { woundsMods } from '../../src/ruleset/body';
import { deathsDoor, firstSightOf, readsHealthOf, renownMods, rewardLines } from '../../src/ruleset/achRewards';
import { stance } from '../../src/engine/relations';
import { RC } from '../../src/library/raceIds';
import { trueSkill } from '../../src/ruleset/perks';
import { grantAchievement } from '../../src/engine/xp';
import { getLibrary } from '../../src/library';
import { ACH, ACH_TAGS } from '../../src/library/achievementIds';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import { CONFIG } from '../../src/config';
import { IT } from '../../src/library/itemIds';

const sword = `player_${IT.arming_sword}_1`;

describe('136 achievement rewards', () => {
  it('The Unseen Death: an attack on an unaware target lands one tier better', () => {
    const s = makeVillage();
    const req = { attackerId: 'player', targetId: 'patron_1', weaponId: sword, targetPart: null, aimed: false, context: { defenderUnaware: true } };
    const plain = ruleset.attack(req, s, forcedRng([50, 30, 20]));
    grantAchievement(s, ACH.unaware_100);
    const r = ruleset.attack(req, s, forcedRng([50, 30, 20]));
    expect(r.attack.tierShifts).toEqual([{ source: 'The Unseen Death', value: 1 }]);
    expect(r.gap).toBe(plain.gap! - 1);
    expect(ruleset.attack({ ...req, context: {} }, s, forcedRng([50, 30, 20])).attack.tierShifts).toEqual([]);
  });
  it('Death Keeps Waiting: once a game day, a hit that would take you Down leaves you at Critical', () => {
    const s = makeVillage();
    const top = CONFIG.HEALTH_TRACK.find(([l]) => l === 'Critical')![1];
    expect(deathsDoor(s, s.player, 50, 120)).toBe(120);
    grantAchievement(s, ACH.brink_5);
    expect(deathsDoor(s, s.player, 50, 120)).toBe(top);
    expect(deathsDoor(s, s.player, 50, 120)).toBe(120); // spent for today
    expect(deathsDoor(s, s.player, 50, 80)).toBe(80); // not a fall: nothing to save
    s.player.progression!.charges![ACH.brink_5] -= 1; // a day later
    expect(deathsDoor(s, s.player, 50, 120)).toBe(top);
  });
  it('Not Yet: the same save, refilled once every 7 game days', () => {
    const s = makeVillage();
    const top = CONFIG.HEALTH_TRACK.find(([l]) => l === 'Critical')![1];
    grantAchievement(s, ACH.brink_3);
    expect(deathsDoor(s, s.player, 50, 120)).toBe(top);
    s.player.progression!.charges![ACH.brink_3] -= 6;
    expect(deathsDoor(s, s.player, 50, 120)).toBe(120);
    s.player.progression!.charges![ACH.brink_3] -= 1;
    expect(deathsDoor(s, s.player, 50, 120)).toBe(top);
  });
  it('Shadow\'s Edge (50 unaware defeats) gives XP only; The Unseen Death makes your moves one step quieter', () => {
    const lib = getLibrary().achievements!;
    const { id: _i, name: _n, level: _l, rule: _r, tags: _t, count: _c, after: _a, ...rest } = lib[ACH.unaware_50];
    expect(rest).toEqual({});
    expect(lib[ACH.unaware_100].quieter).toBe(1);
  });
  it('Bones Heal Later grants Past the Pain: one Crippled part gives no role penalty', () => {
    const s = makeVillage();
    s.player.core.condition.parts.right_arm = -10; // Crippled
    const pen = () => woundsMods(s, s.player, SK.melee_medium, { itemId: sword }).reduce((n, m) => n + m.value, 0);
    const before = pen();
    expect(before).toBeLessThan(0);
    grantAchievement(s, ACH.crippled_10);
    expect(s.player.core.perks.some((p) => p.perkId === PK.past_the_pain && p.source === 'achievement')).toBe(true);
    expect(pen()).toBeGreaterThan(before);
  });
  it('Scourge of the {body_type} Hordes: you read that body type\'s health', () => {
    const s = makeVillage();
    const slime = actor(s, 'slime_1');
    expect(readsHealthOf(s.player, slime)).toBe(false);
    grantAchievement(s, ACH.defeats_100_body_type, slime.core.bodyTypeId);
    expect(readsHealthOf(s.player, slime)).toBe(true);
    expect(readsHealthOf(s.player, actor(s, 'patron_1'))).toBe(slime.core.bodyTypeId === actor(s, 'patron_1').core.bodyTypeId);
  });
  it('The Name That Ends Fights: every foe fighting you takes 10 off every morale roll (MB24)', () => {
    const s = makeVillage();
    const foe = actor(s, 'slime_1');
    expect(renownMods(s, foe, true)).toEqual([]);
    grantAchievement(s, ACH.yielded_50);
    expect(renownMods(s, foe, false)).toEqual([]); // not fighting you
    expect(renownMods(s, foe, true)).toEqual([{ source: 'renown: The Name That Ends Fights', type: 'achievement', value: -10 }]);
    expect(renownMods(s, foe, true)).toHaveLength(1); // every roll, not only the first
  });
  it('a level carries up its lower levels\' rewards, read from their rows: Breaker of Wills +5 Intimidation', () => {
    const s = makeVillage();
    s.player.core.skills[SK.intimidation] = { ...Object.values(s.player.core.skills)[0], raw: 10 };
    const ach = getLibrary().achievements!;
    grantAchievement(s, ACH.yielded_1);
    expect(trueSkill(s.player, SK.intimidation)).toBe(10); // Yield or Fall: XP only
    grantAchievement(s, ACH.yielded_10);
    expect(trueSkill(s.player, SK.intimidation)).toBe(15);
    grantAchievement(s, ACH.yielded_50);
    expect(s.player.progression!.achievements!.find((x) => x.key === ACH.yielded_10)?.replacedBy).toBeDefined();
    expect(trueSkill(s.player, SK.intimidation)).toBe(15); // carried up from Breaker of Wills
    expect(rewardLines(ach[ACH.yielded_50])).toEqual([
      '+5 true skill in Intimidation (from Breaker of Wills)',
      'every foe fighting you takes -10 on its morale rolls']);
    const was = ach[ACH.yielded_10].skillAdd;
    try {
      ach[ACH.yielded_10].skillAdd = { [SK.intimidation]: 2 }; // nerf the lower level: every level above follows
      expect(trueSkill(s.player, SK.intimidation)).toBe(12);
    } finally { ach[ACH.yielded_10].skillAdd = was; }
  });
  it('a level drops an inherited reward only through its own excludes: Death Keeps Waiting', () => {
    const ach = getLibrary().achievements!;
    expect(rewardLines(ach[ACH.brink_5])).toEqual(['once every game day, a hit that would take you Down leaves you at Critical']);
    const was = ach[ACH.brink_5].excludes;
    try {
      delete ach[ACH.brink_5].excludes;
      expect(rewardLines(ach[ACH.brink_5])[0]).toMatch(/every 7 game days.*\(from Not Yet\)$/);
    } finally { ach[ACH.brink_5].excludes = was; }
  });
  it('first sight: a hunted unintelligent kind meets you wary until you attack it', () => {
    const s = makeVillage();
    const slime = actor(s, 'slime_1');
    expect(stance(s, slime, s.player)).toBe('hostile');
    grantAchievement(s, ACH.defeats_10_body_type, slime.core.bodyTypeId); // {body_type}bane
    expect(stance(s, slime, s.player)).toBe('opposed');
    slime.mind!.overrides = { [s.player.id]: 'hostile' }; // what an attack on it sets
    expect(stance(s, slime, s.player)).toBe('hostile');
  });
  it('first sight: Scourge covers one intelligence step more, and drops the lower level\'s own first sight', () => {
    const s = makeVillage();
    const foe = actor(s, 'slime_1');
    foe.core.raceId = RC.dragon; // semi-intelligent
    grantAchievement(s, ACH.defeats_10_race, RC.dragon);
    expect(firstSightOf(s.player, foe)).toBeUndefined();
    grantAchievement(s, ACH.defeats_100_race, RC.dragon);
    expect(firstSightOf(s.player, foe)).toBe(ACH.defeats_100_race);
    foe.core.raceId = RC.human; // intelligent: never covered
    grantAchievement(s, ACH.defeats_100_race, RC.human);
    expect(firstSightOf(s.player, foe)).toBeUndefined();
    const lines = rewardLines(getLibrary().achievements![ACH.defeats_100_race]);
    expect(lines.filter((l) => l.includes('wary'))).toEqual(['unintelligent and semi-intelligent members of that race meet you wary (opposed), not hostile']);
  });
  it('every achievement carries at least one known tag', () => {
    for (const d of Object.values(getLibrary().achievements ?? {})) {
      expect(d.tags.length).toBeGreaterThan(0);
      for (const t of d.tags) expect(ACH_TAGS[t]).toBeDefined();
    }
  });
});
