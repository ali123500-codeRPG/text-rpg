// Leftover-rule scan, round 1: one contest rule, one capitalising helper, one empty journal, margin bands in config, and
// spec prose that names only code names that still exist.
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { CONFIG, resetConfig } from '../../src/config';
import { ruleset, toContest } from '../../src/ruleset';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';
import { makeVillage, place, forcedRng } from '../harness';
import { MILESTONES, allStepsUpTo, milestonesUpTo, perksNeeded } from '../../src/ruleset/perks';
import { roleOff } from '../../src/ruleset';
import { RL } from '../../src/library/tableIds';
import type { Quest, RollResult } from '../../src/types';
import { rewardXp, rewardXpAt } from '../../src/ruleset/achRewards';
import { poolState } from '../../src/ruleset/body';
import { xpToNext } from '../../src/engine/xp';
import { questXp } from '../../src/engine/quests';
import { QUEST_REWARD_LEVELS, REWARD_LEVELS } from '../../src/scales';
import { perkPointAt, perkPointsUpTo } from '../../src/ruleset/levels';
import { PUSH_TYPES, speechSkill } from '../../src/engine/speech';
import { SPEECH_ACTIONS } from '../../src/types';
import { RV, ZK } from '../../src/library/tableIds';
import { recoverDebt } from '../../src/engine/fatigue';
import type { Zone } from '../../src/types';
import { freshId } from '../../src/ids';
import { OPP_SIDE, SIDES, SIDE_STEP } from '../../src/types';

// config levers nothing reads yet, each waiting on a question (none now: CS8 put SHARED_ROLE_OFF_PCT to work)
const UNREAD_LEVERS: string[] = [];
const roll = (tier: RollResult['tier'], beyond?: number) => ({ tier, ...(beyond ? { beyond } : {}) }) as RollResult;
const files = (dir: string): string[] => (readdirSync(dir) as string[]).flatMap((f) => {
  const p = `${dir}/${f}`;
  return statSync(p).isDirectory() ? files(p) : /\.(ts|mjs)$/.test(p) ? [p] : [];
});

afterEach(() => resetConfig());

describe('leftover scan round 1', () => {
  it('a contest is b’s tier level minus a’s; the acting side wins below 0', () => {
    expect(toContest(roll('success'), roll('failure'))).toMatchObject({ gap: -2, winner: 'a' });
    expect(toContest(roll('near_miss'), roll('near_miss'))).toMatchObject({ gap: 0, winner: 'tie' });
    expect(toContest(roll('critical_success'), roll('critical_success', 1))).toMatchObject({ gap: 1, winner: 'b' });
  });

  it('CS3: the hit outcome thresholds are read from CONFIG.HIT_GAPS', () => {
    // the s078 blow: gap −6 against the slime's dodge (makeVillage resets CONFIG, so the change comes after it)
    const blow = (gaps: Partial<typeof CONFIG.HIT_GAPS>) => {
      const s = makeVillage();
      place(s, 'player', 'field_mid');
      s.player.core.skills[SK.melee_medium].raw = 60;
      CONFIG.HIT_GAPS = { ...CONFIG.HIT_GAPS, ...gaps };
      return ruleset.attack({ attackerId: 'player', targetId: 'slime_1', weaponId: `player_${IT.arming_sword}_1`, targetPart: null, aimed: false }, s, forcedRng([100, 3, 50]));
    };
    expect(blow({})).toMatchObject({ gap: -6, outcome: 'crushing_hit' });
    expect(blow({ crushing: -7 })).toMatchObject({ gap: -6, outcome: 'heavy_hit' });
    expect(blow({ heavy: -7, crushing: -8 })).toMatchObject({ gap: -6, outcome: 'full_hit' });
  });


  it('round 4: every CONFIG lever is read somewhere outside config.ts and its parts', () => {
    const code = [...files('src'), ...files('tests'), ...files('scripts')].filter((f) => f !== 'src/config.ts' && !f.startsWith('src/config/') && !f.endsWith('leftover-scan-1.test.ts')).map((f) => readFileSync(f, 'utf8') as string).join('\n');
    const unread = Object.keys(CONFIG).filter((k) => !new RegExp(`\\b${k}\\b`).test(code) && !UNREAD_LEVERS.includes(k));
    expect(unread).toEqual([]);
  });


});

describe('leftover scan answers (CS6, CS8, CS11)', () => {

  it('CS8: running stops at SHARED_ROLE_OFF_PCT of the move parts hurt, a Destroyed part counting twice', () => {
    const s = makeVillage(), p = s.player;
    expect(roleOff(s, p, RL.move)).toBe(false);
    p.core.condition.parts.left_leg = -30; // one Crippled leg of two: 50%
    expect(roleOff(s, p, RL.move)).toBe(false);
    p.core.condition.parts.right_leg = -30; // both: 100%
    expect(roleOff(s, p, RL.move)).toBe(true);
    p.core.condition.parts = { left_leg: -100 }; // one Destroyed: counts twice
    expect(roleOff(s, p, RL.move)).toBe(true);
  });

  it('CS11: milestones every 20 and All steps every 50 with no top; the gating pattern goes on', () => {
    expect(MILESTONES).toEqual([20, 40, 60, 80, 100, 120, 140]);
    expect(milestonesUpTo(200).slice(-3)).toEqual([160, 180, 200]);
    expect(allStepsUpTo(300)).toEqual([50, 100, 150, 200, 250, 300]);
    expect([20, 40, 60, 80, 100, 120, 140, 160, 180].map(perksNeeded)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4]);
  });
});

describe('answers CS15 to CS17', () => {
  it('CS15: one equation gives every reward level its XP, with no top', () => {
    expect(['minus_1', 'zero', 'i', 'ii', 'iii', 'iv', 'vi', 'x', 'xv'].map((k) => rewardXp(k))).toEqual([6, 50, 169, 400, 781, 1350, 3200, 10800, 30706]);
    expect(rewardXpAt(20)).toBeGreaterThan(rewardXpAt(15)); // past XV it keeps growing
  });
  it('CS16: a quest pays the same XP as an achievement two reward levels higher (quest 0 = achievement II)', () => {
    const s = makeVillage();
    for (const level of QUEST_REWARD_LEVELS.keys) {
      const q = { level, goal: { kind: 'deliver' } } as unknown as Quest;
      expect(questXp(s, q)).toBe(rewardXp(REWARD_LEVELS.at(REWARD_LEVELS.pos(level) + 2), xpToNext(s.player))); // AL4: the level share too
    }
    expect(questXp(s, { level: 'zero', goal: { kind: 'deliver' } } as unknown as Quest)).toBe(rewardXp('ii', xpToNext(s.player)));
  });
});

describe('leftover scan round 6', () => {
  it('one perk-point rule: every PERK_POINT_EVERY levels, read by levelling and spawn alike', () => {
    expect([1, 2, 3, 4, 5, 6].filter(perkPointAt)).toEqual([2, 4, 6]);
    expect(perkPointsUpTo(7)).toBe(3);
  });
  it('NPC speech rolls are every speech type but plain talk; one speech-skill lookup', () => {
    expect([...PUSH_TYPES].sort()).toEqual(SPEECH_ACTIONS.filter((t) => t !== 'talk').sort());
    expect(speechSkill('deceive')).toBe(SK.falsehood);
    expect(speechSkill('wave')).toBe(SK.persuasion);
  });
});

describe('leftover scan round 7', () => {
  it('Hard Bargain still pays: a sale with it pays less than buying the same item with it', () => {
    expect(CONFIG.SELL_SHARE * CONFIG.HARD_BARGAIN_SELL).toBeLessThan(CONFIG.TRADE_MARKUP * CONFIG.HARD_BARGAIN_BUY);
  });
});

describe('leftover scan round 9', () => {
  it('a part\'s state reads its floors from config', () => {
    expect([51, 50, 1, 0, -99, -100].map(poolState)).toEqual(['healthy', 'damaged', 'damaged', 'crippled', 'crippled', 'destroyed']);
  });
});

describe('leftover scan round 10', () => {
  it('every long-term clear lowers the hours-awake count in one place', () => {
    const s = makeVillage(), p = s.player;
    p.core.condition.fatigue = { debt: 40, line: 0, awake: 40 };
    const got = recoverDebt(p, RV.sleep, 10);
    expect(got).toBeGreaterThan(0);
    expect(p.core.condition.fatigue!.awake).toBeCloseTo(40 - got);
  });
});

describe('leftover scan round 11', () => {
  it('the opposite of a side turns back to it, with the opposite step', () => {
    expect(SIDES.map((d) => OPP_SIDE[OPP_SIDE[d]])).toEqual([...SIDES]);
    for (const d of SIDES) expect(SIDE_STEP[OPP_SIDE[d]].map((v) => 0 - v)).toEqual([...SIDE_STEP[d]]);
  });
  it('freshId takes the next free number', () => {
    const taken = new Set(['a', 'a_2']);
    expect(freshId('a', taken)).toBe('a_3');
    expect(taken.has('a_3')).toBe(true);
  });
});
