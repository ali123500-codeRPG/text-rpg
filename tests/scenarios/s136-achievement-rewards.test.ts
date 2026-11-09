// 136 achievement rewards beyond XP: The Unseen Death (tier up on unaware targets, quieter moves), Death Keeps Waiting
// (a daily save from going Down), Bones Heal Later (the Past the Pain perk), Scourge of the {body_type} Hordes (reads
// that body type's health); and achievement tags.
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { actor } from '../harness/village';
import { ruleset } from '../../src/ruleset';
import { woundsMods } from '../../src/ruleset/body';
import { deathsDoor, readsHealthOf } from '../../src/ruleset/achRewards';
import { grantAchievement } from '../../src/engine/xp';
import { getLibrary } from '../../src/library';
import { ACH, ACH_TAGS } from '../../src/library/achievementIds';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import { CONFIG } from '../../src/config';

const sword = 'player_arming_sword_1';

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
  it('every achievement carries at least one known tag', () => {
    for (const d of Object.values(getLibrary().achievements ?? {})) {
      expect(d.tags.length).toBeGreaterThan(0);
      for (const t of d.tags) expect(ACH_TAGS[t]).toBeDefined();
    }
  });
});
