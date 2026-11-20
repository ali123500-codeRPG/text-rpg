// Leftover-rule scan, round 1: one contest rule, one capitalising helper, one empty journal, margin bands in config, and
// spec prose that names only code names that still exist.
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { CONFIG, resetConfig } from '../../src/config';
import { band, ruleset, toContest } from '../../src/ruleset';
import { IT } from '../../src/library/itemIds';
import { getLibrary } from '../../src/library';
import { SK } from '../../src/library/skillIds';
import { makeVillage, place, forcedRng } from '../harness';
import { M_EPS } from '../../src/engine/position';
import { MILESTONES, allStepsUpTo, milestonesUpTo, perksNeeded } from '../../src/ruleset/perks';
import * as prompts from '../../src/agents/prompts';
import { roleOff } from '../../src/ruleset';
import { RL } from '../../src/library/tableIds';
import { PK } from '../../src/library/perkIds';
import { CODE_ENDINGS, PLAN_ENDINGS, SCENARIO_ENDINGS } from '../../src/types';
import { perkSeries } from '../../src/ui/perks';
import { cap, listWords, r1 } from '../../src/words';
import { journalOf } from '../../src/engine/trail';
import type { Actor, Quest, RollResult } from '../../src/types';
import { rewardXp, rewardXpAt } from '../../src/ruleset/achRewards';
import { poolState } from '../../src/ruleset/body';
import { accSlot, gripSlot, gripsOf, isHeld, isWorn } from '../../src/ruleset/slots';
import { xpFill, xpToNext } from '../../src/engine/xp';
import { questXp } from '../../src/engine/quests';
import { QUEST_REWARD_LEVELS, REWARD_LEVELS } from '../../src/scales';
import { perkPointAt, perkPointsUpTo } from '../../src/ruleset/levels';
import { validateStagePlan } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { PUSH_TYPES, speechSkill } from '../../src/engine/speech';
import { SPEECH_ACTIONS } from '../../src/types';
import { RV, ZK } from '../../src/library/tableIds';
import { recoverDebt } from '../../src/engine/fatigue';
import { MOD_SOURCES } from '../../src/ruleset/modSources';
import type { Zone } from '../../src/types';
import { freshId } from '../../src/ids';
import { partName } from '../../src/ruleset/body';
import { OPP_SIDE, SIDES, SIDE_STEP } from '../../src/types';
import { PLAN_TRIGGER_TYPES, TRIGGER_TYPES } from '../../src/scenario/triggers';
import { minuteOfDay, DAY_MINUTES } from '../../src/time';
import { actionSeconds } from '../../src/ruleset/actionTime';
import { CROSSROADS } from '../../src/agents/crossroads';
import { roman } from '../../src/scales';
import { readSpec } from '../harness/specDocs';

// config levers nothing reads yet, each waiting on a question (none now: CS8 put SHARED_ROLE_OFF_PCT to work)
const UNREAD_LEVERS: string[] = [];
// names the spec mentions only to say they are gone
const GONE_ON_PURPOSE = ['LINK_PACES'];
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

  it('margin bands are read from CONFIG', () => {
    CONFIG.MARGIN_BANDS = [-75, -25, 0, 25, 70];
    expect(band(72)).toBe(5);
    resetConfig();
    expect(band(72)).toBe(4);
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


  it('round 2: walk distances share one metres tolerance, M_EPS', () => {
    expect(M_EPS).toBe(0.01);
  });

  it('round 2: the perk series key lists its milestones from MILESTONES', () => {
    expect(MILESTONES.filter((m) => perkSeries(m) === '20')).toEqual([20, 60, 100, 140]);
    expect(MILESTONES.filter((m) => perkSeries(m) === '40')).toEqual([40, 80, 120]);
  });

  it('listWords joins a list as a sentence', () => {
    expect([listWords([]), listWords(['a']), listWords(['a', 'b']), listWords(['a', 'b', 'c'], 'or')]).toEqual(['', 'a', 'a and b', 'a, b or c']);
  });

  it('round 4: every CONFIG lever is read somewhere outside config.ts and its parts', () => {
    const code = [...files('src'), ...files('tests'), ...files('scripts')].filter((f) => f !== 'src/config.ts' && !f.startsWith('src/config/') && !f.endsWith('leftover-scan-1.test.ts')).map((f) => readFileSync(f, 'utf8') as string).join('\n');
    const unread = Object.keys(CONFIG).filter((k) => !new RegExp(`\\b${k}\\b`).test(code) && !UNREAD_LEVERS.includes(k));
    expect(unread).toEqual([]);
  });

  it('cap capitalises the first letter only', () => {
    expect(cap('the guard')).toBe('The guard');
    expect(cap('')).toBe('');
  });

  it('journalOf makes a whole empty journal once and keeps it', () => {
    const p = {} as Actor;
    const j = journalOf(p);
    expect(j).toEqual({ secretsKnown: [], factsWitnessed: [], remembered: {}, namesKnown: [] });
    expect(journalOf(p)).toBe(j);
  });

  it('scanned files have no doc comment stacked on another (one of them belongs elsewhere)', () => {
    expect(files('src').filter((f) => /\*\/\n[ \t]*\/\*\*/.test(readFileSync(f, 'utf8') as string))).toEqual([]);
  });


  it('r1 rounds to one decimal', () => {
    expect([r1(2.345), r1(-0.06), r1(10)]).toEqual([2.3, -0.1, 10]);
  });

  it('every code name the spec prose gives (UPPER_SNAKE) exists in the code (src, tests, scripts)', () => {
    const src = [...files('src'), ...files('tests'), ...files('scripts')].filter((f) => !f.endsWith('leftover-scan-1.test.ts')).map((f) => readFileSync(f, 'utf8') as string).join('\n');
    // tables of record (bug log, decisions, answers) keep the names of their day
    const prose = readSpec().split('\n').filter((l) => !/^\| [A-Z]+[-0-9]/.test(l)).join('\n');
    const names = [...new Set(prose.match(/\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/g) ?? [])];
    const missing = names.filter((n) => !new RegExp(`\\b${n}\\b`).test(src) && !GONE_ON_PURPOSE.includes(n));
    expect(missing).toEqual([]);
  });
});

describe('leftover scan answers (CS6, CS8, CS11)', () => {
  it('CS6: the agents\' fixed instructions have one copy, in prompts.ts; the spec names each and copies none', () => {
    const spec = readSpec();
    const texts = Object.entries(prompts).filter(([k, v]) => k.endsWith('_INSTRUCTIONS') && typeof v === 'string') as [string, string][];
    expect(texts.length).toBeGreaterThanOrEqual(6);
    for (const [k, v] of texts) {
      expect(spec.includes(v.split('\n')[0]), k).toBe(false); // the opening line would come back with a copy
      if (k !== 'WEAVER_CHECKIN_INSTRUCTIONS') expect(spec, k).toContain(`${k} in src/agents/prompts.ts`);
    }
  });

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
  it('quest reward levels are rows of REWARD_LEVELS, keys and names from there', () => {
    expect(QUEST_REWARD_LEVELS.keys).toEqual(['zero', 'i', 'ii', 'iii', 'iv']);
    expect(QUEST_REWARD_LEVELS.keys.map((k) => QUEST_REWARD_LEVELS.name(k))).toEqual(QUEST_REWARD_LEVELS.keys.map((k) => REWARD_LEVELS.name(k)));
  });
  it('one perk-point rule: every PERK_POINT_EVERY levels, read by levelling and spawn alike', () => {
    expect([1, 2, 3, 4, 5, 6].filter(perkPointAt)).toEqual([2, 4, 6]);
    expect(perkPointsUpTo(7)).toBe(3);
  });
  it('the Weaver may give awareness up to aware, from the AWARENESS scale', () => {
    const s = makeVillage();
    const plan = villageStagePlan('success');
    plan.cast[0].awarenessOfPlayer = 'tracking' as never;
    expect(validateStagePlan(toStoryStart(s), plan, { tier: 'success', kind: 'scenario', placeId: 'tavern' }).map((e) => e.message).join(' ')).toContain('unaware, suspicious, aware');
  });
  it('NPC speech rolls are every speech type but plain talk; one speech-skill lookup', () => {
    expect([...PUSH_TYPES].sort()).toEqual(SPEECH_ACTIONS.filter((t) => t !== 'talk').sort());
    expect(speechSkill('deceive')).toBe(SK.falsehood);
    expect(speechSkill('wave')).toBe(SK.persuasion);
  });
});

describe('answer CS18', () => {
  it('CS18: secret slips are settled as built; the spec says the contest must be won', () => {
    const spec = readSpec();
    expect(spec).not.toMatch(/SLIPS[^\n]*\\\[Proposed\\\]/);
    expect(spec).not.toMatch(/Secret slips \\\[Proposed\\\]/);
    expect(spec).toMatch(/wins a speech contest against a spokesperson/);
  });
});

describe('leftover scan round 7', () => {
  it('perk rules text reads its numbers from config', () => {
    const perks = getLibrary().perks ?? {};
    const rules = (id: string) => `${perks[id]?.rules?.conditions?.join(' ')} ${perks[id]?.rules?.effect}`;
    expect(rules(PK.leg_bolt)).toContain(`${CONFIG.LEG_BOLT_PART_MULT}×`);
    expect(rules(PK.open_hand_guard)).toContain(`${CONFIG.OPEN_HAND_ARM_SHARE}× of its damage`);
    expect(rules(PK.slip_the_blow)).toContain(`${CONFIG.GAP_LADDER.dodge[CONFIG.HIT_GAPS.graze]}× damage`);
    expect(rules(PK.haggler)).toContain(`×${CONFIG.HARD_BARGAIN_BUY}`);
  });
  it('Turn Aside names the multiplier of each defense column it replaces', () => {
    const t = getLibrary().perks?.[PK.turn_aside]?.rules?.effect ?? '';
    for (const k of ['dodge', 'block', 'parry'] as const) expect(t).toContain(`${CONFIG.GAP_LADDER[k][CONFIG.HIT_GAPS.heavy]}×`);
    expect(t).toContain(`${CONFIG.GAP_LADDER.parry[CONFIG.HIT_GAPS.crushing]}×`);
  });
  it('Hard Bargain still pays: a sale with it pays less than buying the same item with it', () => {
    expect(CONFIG.SELL_SHARE * CONFIG.HARD_BARGAIN_SELL).toBeLessThan(CONFIG.TRADE_MARKUP * CONFIG.HARD_BARGAIN_BUY);
  });
});

describe('leftover scan round 8', () => {
  it('the endings a plan may name come from one list: every scenario ending but the two code sets', () => {
    expect([...PLAN_ENDINGS].sort()).toEqual(SCENARIO_ENDINGS.filter((e) => !(CODE_ENDINGS as readonly string[]).includes(e)).sort());
    expect(PLAN_ENDINGS).not.toContain('worn_out');
  });
  it('the world title cap is a config lever', () => {
    expect(CONFIG.WORLD_TITLE_CAP).toBeGreaterThan(0);
  });
});

describe('leftover scan round 9', () => {
  it('a grip slot is held and an accessory slot is worn', () => {
    const sword = { equippedIn: [gripSlot('right_arm'), gripSlot('left_arm')] }, ring = { equippedIn: [accSlot(0)] };
    expect([isHeld(sword), isWorn(sword), isHeld(ring), isWorn(ring)]).toEqual([true, false, false, true]);
    expect(gripsOf(sword)).toEqual(['right_arm', 'left_arm']);
  });
  it('a part\'s state reads its floors from config', () => {
    expect([51, 50, 1, 0, -99, -100].map(poolState)).toEqual(['healthy', 'damaged', 'damaged', 'crippled', 'crippled', 'destroyed']);
  });
  it('XP debt shows an empty bar', () => {
    const s = makeVillage();
    s.player.progression!.xp = -5;
    expect(xpFill(s.player).pct).toBe(0);
  });
});

describe('leftover scan round 10', () => {
  it('one edge rule: a side is a wall on the floor plan, for sound and for reaching over alike (PZ2 replaced edge kinds)', () => {
    expect(getLibrary()).not.toHaveProperty('edgeKinds');
  });
  it('every long-term clear lowers the hours-awake count in one place', () => {
    const s = makeVillage(), p = s.player;
    p.core.condition.fatigue = { debt: 40, line: 0, awake: 40 };
    const got = recoverDebt(p, RV.sleep, 10);
    expect(got).toBeGreaterThan(0);
    expect(p.core.condition.fatigue!.awake).toBeCloseTo(40 - got);
  });
  it('the Stacking tab names noise, attention and light by their scale names', () => {
    const v = (src: string) => MOD_SOURCES.find((m) => m.source === src)!.value;
    expect(v('Waking')).toMatch(/^Faint /);
    expect(v('Light')).toMatch(/Dim -9%/i);
    expect(MOD_SOURCES.some((m) => m.source === 'Travel pace')).toBe(false); // SR5: one travel pace
  });
});

describe('answer CS24', () => {
  it('CS24: the spec no longer says a Destroyed part counts twice', () => {
    expect(readSpec()).not.toMatch(/Destroyed part counting twice/);
  });
});

describe('leftover scan round 11', () => {
  it('the opposite of a side turns back to it, with the opposite step', () => {
    expect(SIDES.map((d) => OPP_SIDE[OPP_SIDE[d]])).toEqual([...SIDES]);
    for (const d of SIDES) expect(SIDE_STEP[OPP_SIDE[d]].map((v) => 0 - v)).toEqual([...SIDE_STEP[d]]);
  });
  it('roman numerals', () => {
    expect(roman(4)).toBe('IV');
  });
  it('partName names a body part', () => {
    expect(partName('left_arm')).toBe('Left arm');
  });
  it('freshId takes the next free number', () => {
    const taken = new Set(['a', 'a_2']);
    expect(freshId('a', taken)).toBe('a_3');
    expect(taken.has('a_3')).toBe(true);
  });
  it('plans name every trigger type but quiet_turns, from the one list', () => {
    expect(PLAN_TRIGGER_TYPES).toEqual(TRIGGER_TYPES.filter((t) => t !== 'quiet_turns'));
  });
  it('time of day, action speed and the hurt crossroads read their tables', () => {
    expect([minuteOfDay(-1), minuteOfDay(DAY_MINUTES + 5)]).toEqual([DAY_MINUTES - 1, 5]);
    expect(actionSeconds({ id: 'x', name: 'x', effort: 'base', seconds: 4, speed: { fn: 'FN1', halving: 25 } }, CONFIG.ACTION_SPEED_PIVOT, 1)).toBe(4);
    expect(CROSSROADS.find((c) => c.kind === 'badly_hurt')!.rule).toBe('your health first reaches Wounded, Mauled or Critical, or a body part becomes Crippled or Destroyed (GA4)');
  });
  it('the spec names no removed rule', () => {
    expect(readSpec()).not.toMatch(/agents that return JSON call sample\.json/);
  });
});
