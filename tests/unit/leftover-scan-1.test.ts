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
import { xpFill } from '../../src/engine/xp';
import { questXp } from '../../src/engine/quests';
import { QUEST_REWARD_LEVELS, REWARD_LEVELS } from '../../src/scales';
import { perkPointAt, perkPointsUpTo } from '../../src/ruleset/levels';
import { validateStagePlan } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { PUSH_TYPES, speechSkill } from '../../src/engine/speech';
import { SPEECH_ACTIONS } from '../../src/types';
import { edgeFacing, reachesOver } from '../../src/scenario/geometry';
import { EK, RV, ZK } from '../../src/library/tableIds';
import { recoverDebt } from '../../src/engine/fatigue';
import { MOD_SOURCES } from '../../src/ruleset/modSources';
import type { Zone } from '../../src/types';

// files the leftover scan has covered (add each round's files)
const ROUND_1 = ['src/ui/play.ts', 'src/ruleset/index.ts', 'src/scenario/apply.ts', 'src/minds/state.ts', 'src/engine/heal.ts'];
const ROUND_2 = ['src/engine/resolve.ts', 'src/agents/prompts.ts', 'src/engine/merge.ts', 'src/ui/perks.ts'];
const ROUND_3 = ['src/views/index.ts', 'src/agents/game.ts', 'src/engine/effects.ts'];
const ROUND_4 = ['src/config.ts', 'src/types/views.ts', 'src/types/actor.ts', 'src/ui/fakeGame.ts', 'src/types/agents.ts', 'src/agents/schema.ts',
  'src/agents/legality.ts', 'src/engine/engagement.ts'];
const ROUND_5 = ['src/ui/libraryViewer.ts', 'src/types/library.ts', 'src/ruleset/equations.ts', 'src/ui/charsheet.ts', 'src/ui/sheet.ts'];
const ROUND_6 = ['src/ui/pages.ts', 'src/engine/xp.ts', 'src/scenario/validate.ts', 'src/engine/speech.ts', 'src/engine/position.ts', 'src/scales.ts',
  'src/agents/wrappers.ts'];
const ROUND_7 = ['src/ui/map.ts', 'src/library/perks.ts', 'src/perception/index.ts', 'src/engine/essence.ts', 'src/engine/gear.ts', 'src/engine/trade.ts',
  'src/engine/relations.ts', 'src/library/allPerks.ts'];
const ROUND_8 = ['src/save/index.ts', 'src/ruleset/gear.ts', 'src/ui/autopilot.ts', 'src/engine/scenarioEnd.ts', 'src/engine/quests.ts',
  'src/ruleset/improve.ts', 'src/engine/feats.ts', 'src/minds/routines.ts', 'src/engine/sleep.ts'];
const ROUND_9 = ['src/ui/mapPlan.ts', 'src/save/checks.ts', 'src/scenario/director.ts', 'src/ui/creation.ts', 'src/engine/offer.ts',
  'src/ruleset/body.ts', 'src/engine/chase.ts', 'src/ruleset/perks.ts', 'src/engine/growth.ts', 'src/engine/filch.ts'];
const ROUND_10 = ['src/ui/motion.ts', 'src/scenario/geometry.ts', 'src/ui/gains.ts', 'src/ui/gm.ts', 'src/ui/kit.ts', 'src/agents/call.ts',
  'src/agents/narration.ts', 'src/save/turnCheck.ts', 'src/agents/autopilot.ts', 'src/ruleset/personality.ts', 'src/engine/fatigue.ts',
  'src/ruleset/modSources.ts', 'src/engine/yield.ts', 'src/engine/auras.ts', 'src/engine/travel.ts', 'src/ui/doing.ts'];
const SCANNED = [...ROUND_1, ...ROUND_2, ...ROUND_3, ...ROUND_4, ...ROUND_5, ...ROUND_6, ...ROUND_7, ...ROUND_8, ...ROUND_9, ...ROUND_10];
// config levers nothing reads yet, each waiting on a question (none now: CS8 put SHARED_ROLE_OFF_PCT to work)
const UNREAD_LEVERS: string[] = [];
// files whose GAP notes are settled into the spec (round 1: CS2; rounds 2 to 4: CS5, CS7, CS9)
const GAPS_SETTLED = [...ROUND_1, 'src/engine/resolve.ts', 'src/agents/prompts.ts', 'src/views/index.ts', 'src/agents/schema.ts', 'src/scenario/validate.ts', 'src/agents/wrappers.ts', 'src/engine/speech.ts', 'src/perception/index.ts', 'src/save/index.ts', 'src/scenario/director.ts', 'src/ruleset/body.ts'];
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

  it('CS2: settled files keep no GAP notes (each was settled into the spec)', () => {
    expect(GAPS_SETTLED.filter((f) => /\bGAP:/.test(readFileSync(f, 'utf8') as string))).toEqual([]);
  });

  it('round 2: walk distances use the one metres tolerance (M_EPS), not a 0.01 of their own', () => {
    expect(M_EPS).toBe(0.01);
    expect(['src/engine/resolve.ts', 'src/engine/merge.ts'].filter((f) => /\b0\.01\b/.test(readFileSync(f, 'utf8') as string))).toEqual([]);
  });

  it('round 2: the perk series key lists its milestones from MILESTONES', () => {
    expect(MILESTONES.filter((m) => perkSeries(m) === '20')).toEqual([20, 60, 100, 140]);
    expect(MILESTONES.filter((m) => perkSeries(m) === '40')).toEqual([40, 80, 120]);
    expect(readFileSync('src/ui/perks.ts', 'utf8') as string).not.toMatch(/'\s*20, 60, 100, 140'|'\s*40, 80, 120'/);
  });

  it('round 4: a list as a sentence says it has one helper', () => {
    expect([listWords([]), listWords(['a']), listWords(['a', 'b']), listWords(['a', 'b', 'c'], 'or')]).toEqual(['', 'a', 'a and b', 'a, b or c']);
    const copies = files('src').filter((f) => f !== 'src/words.ts' && f !== 'src/library/data.ts' && /slice\(0, -1\)\.join\(', '\)\} (and|or)/.test(readFileSync(f, 'utf8') as string));
    expect(copies).toEqual([]);
  });

  it('round 4: every CONFIG lever is read somewhere outside config.ts', () => {
    const code = [...files('src'), ...files('tests'), ...files('scripts')].filter((f) => f !== 'src/config.ts' && !f.endsWith('leftover-scan-1.test.ts')).map((f) => readFileSync(f, 'utf8') as string).join('\n');
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
    expect(SCANNED.filter((f) => /\*\/\n[ \t]*\/\*\*/.test(readFileSync(f, 'utf8') as string))).toEqual([]);
  });

  it('no copy of the capitalising helper is left (round 3: nor written inline)', () => {
    const inline = /const cap = \(|charAt\(0\)\.toUpperCase\(\) \+|\[0\]\.toUpperCase\(\)\}\$\{|replace\(\/\^\.\/, \(\w\) => \w\.toUpperCase\(\)\)/;
    const copies = files('src').filter((f) => f !== 'src/words.ts' && f !== 'src/library/data.ts' && inline.test(readFileSync(f, 'utf8') as string));
    expect(copies).toEqual([]);
  });

  it('round 3: one-decimal rounding has one helper (r1)', () => {
    expect([r1(2.345), r1(-0.06), r1(10)]).toEqual([2.3, -0.1, 10]);
    const copies = files('src').filter((f) => f !== 'src/words.ts' && f !== 'src/library/data.ts' && /Math\.round\([^)]*\* 10\) \/ 10/.test(readFileSync(f, 'utf8') as string));
    expect(copies).toEqual([]);
  });

  it('every code name the spec prose gives (UPPER_SNAKE) exists in the code (src, tests, scripts)', () => {
    const src = [...files('src'), ...files('tests'), ...files('scripts')].filter((f) => !f.endsWith('leftover-scan-1.test.ts')).map((f) => readFileSync(f, 'utf8') as string).join('\n');
    // tables of record (bug log, decisions, answers) keep the names of their day
    const prose = (readFileSync('docs/build-spec.md', 'utf8') as string).split('\n').filter((l) => !/^\| [A-Z]+[-0-9]/.test(l)).join('\n');
    const names = [...new Set(prose.match(/\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/g) ?? [])];
    const missing = names.filter((n) => !new RegExp(`\\b${n}\\b`).test(src) && !GONE_ON_PURPOSE.includes(n));
    expect(missing).toEqual([]);
  });
});

describe('leftover scan answers (CS6, CS8, CS11)', () => {
  it('CS6: the agents\' fixed instructions have one copy, in prompts.ts; the spec names each and copies none', () => {
    const spec = readFileSync('docs/build-spec.md', 'utf8') as string;
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

describe('leftover scan round 5', () => {
  it('one XP curve: only ruleset/levels.ts reads LEVEL_XP, and the Equations tab totals come from it', () => {
    const readers = files('src').filter((f) => f !== 'src/config.ts' && f !== 'src/ruleset/levels.ts' && /CONFIG\.LEVEL_XP\b/.test(readFileSync(f, 'utf8') as string));
    expect(readers).toEqual(['src/ruleset/equations.ts']); // it only names the lever in the formula text
    expect(readFileSync('src/ruleset/equations.ts', 'utf8')).not.toMatch(/LEVEL_XP \* l/);
  });
});

describe('answers CS15 to CS17', () => {
  it('CS15: one equation gives every reward level its XP, with no top; only achRewards reads it', () => {
    expect(['minus_1', 'zero', 'i', 'ii', 'iii', 'iv', 'vi', 'x', 'xv'].map(rewardXp)).toEqual([6, 50, 169, 400, 781, 1350, 3200, 10800, 30706]);
    expect(rewardXpAt(20)).toBeGreaterThan(rewardXpAt(15)); // past XV it keeps growing
    const readers = files('src').filter((f) => f !== 'src/config.ts' && /CONFIG\.REWARD_XP_CURVE/.test(readFileSync(f, 'utf8') as string));
    expect(readers).toEqual(['src/ruleset/achRewards.ts']);
  });
  it('CS16: a quest pays the same XP as an achievement of its reward level', () => {
    const s = makeVillage();
    for (const level of QUEST_REWARD_LEVELS.keys) {
      const q = { level, goal: { kind: 'deliver' } } as unknown as Quest;
      expect(questXp(s, q)).toBe(rewardXp(level));
    }
  });
  it('CS17: items and attack modes count grips, never hands', () => {
    const offenders = files('src').filter((f) => /([{,]|^)\s*hands\??:|\.hands\b|'hands'/m.test(readFileSync(f, 'utf8') as string));
    expect(offenders).toEqual([]);
    const lib = getLibrary();
    expect(lib.items![IT.greatsword].grips).toBe(2);
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
    for (const f of ['src/engine/xp.ts', 'src/library/spawn.ts']) expect(readFileSync(f, 'utf8')).not.toMatch(/% 2 === 0|[lL]evel\)? \/ 2\)/);
  });
  it('the Weaver may give awareness up to aware, from the AWARENESS scale', () => {
    const s = makeVillage();
    const plan = villageStagePlan('success');
    plan.cast[0].awarenessOfPlayer = 'tracking' as never;
    expect(validateStagePlan(toStoryStart(s), plan, { tier: 'success', kind: 'scenario', placeId: 'tavern' }).map((e) => e.message).join(' ')).toContain('unaware, suspicious, aware');
  });
  it('NPC speech rolls are every speech type but plain talk; one speech-skill lookup', () => {
    expect([...PUSH_TYPES].sort()).toEqual(SPEECH_ACTIONS.filter((t) => t !== 'talk').sort());
    expect(speechSkill('deceive')).toBe(SK.lying);
    expect(speechSkill('wave')).toBe(SK.persuasion);
  });
  it('grips, not hands, in code names: a grip passes bars, reaches into a zone, searches someone open to it', () => {
    const offenders = files('src').filter((f) => /\b(handsPass|handsReach|openToHands|handsOn)\b/.test(readFileSync(f, 'utf8') as string));
    expect(offenders).toEqual([]);
  });
});

describe('answers CS18 and CS19', () => {
  it('CS18: secret slips are settled as built; the spec says the contest must be won', () => {
    const spec = readFileSync('docs/build-spec.md', 'utf8') as string;
    expect(spec).not.toMatch(/SLIPS[^\n]*\\\[Proposed\\\]/);
    expect(spec).not.toMatch(/Secret slips \\\[Proposed\\\]/);
    expect(spec).toMatch(/wins a speech contest against a spokesperson/);
    expect(readFileSync('src/engine/speech.ts', 'utf8') as string).not.toMatch(/\[Proposed\]/);
  });
  it('CS19: a minted reward is checked for hidden terms as whole words, like every other public text', () => {
    expect(readFileSync('src/scenario/validate.ts', 'utf8') as string).not.toMatch(/toLowerCase\(\)\.includes\(t\)/);
  });
});

describe('leftover scan round 7', () => {
  it('perk rules text reads its numbers from config: no number typed beside the config name it copies', () => {
    for (const f of ['src/library/perks.ts', 'src/library/allPerks.ts']) {
      const t = readFileSync(f, 'utf8') as string;
      expect(t.match(/[0-9][0-9.]*\s*\((?:a foe_perk modifier, )?CONFIG\.[A-Z_]+/g) ?? []).toEqual([]);
    }
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
  it('held and worn gear: one isHeld and one isWorn test, no copies of the slot prefixes in engine code', () => {
    const offenders = files('src/engine').filter((f) => /equippedIn\?\.some\(\(s\) => !?s\.startsWith\('grip:'\)\)|s === 'armor' \|\| s\.startsWith\('acc:'\)/.test(readFileSync(f, 'utf8') as string));
    expect(offenders).toEqual([]);
  });
  it('grip, not hands, in code names', () => {
    expect(files('src').filter((f) => /\b(handsOf|usableFreeHands)\b/.test(readFileSync(f, 'utf8') as string))).toEqual([]);
  });
});

describe('leftover scan round 8', () => {
  it('the endings a plan may name come from one list: every scenario ending but the two code sets', () => {
    expect([...PLAN_ENDINGS].sort()).toEqual(SCENARIO_ENDINGS.filter((e) => !(CODE_ENDINGS as readonly string[]).includes(e)).sort());
    expect(PLAN_ENDINGS).not.toContain('worn_out');
    for (const f of ['src/engine/scenarioEnd.ts', 'src/scenario/validate.ts']) expect(readFileSync(f, 'utf8') as string).not.toMatch(/'worn_out' && e !== 'broken_off'|\['resolved', 'lost'/);
  });
  it('the save names its page limit from PAGE_LIMIT, and the world title cap is a config lever', () => {
    const t = readFileSync('src/save/index.ts', 'utf8') as string;
    expect(t).not.toMatch(/256 KiB|slice\(0, 60\)/);
    expect(CONFIG.WORLD_TITLE_CAP).toBeGreaterThan(0);
  });
  it('a quest run is walked back by one helper', () => {
    const t = readFileSync('src/engine/quests.ts', 'utf8') as string;
    expect(t.match(/for \(let [^;]*;\s*\w+\.after/g)?.length).toBe(1);
    expect(t).not.toMatch(/quests' own reward table/);
  });
  it('the defense choice reads one usable-defense test and one tie order', () => {
    const t = readFileSync('src/ruleset/gear.ts', 'utf8') as string;
    expect(t.match(/\['block', 'parry', 'dodge'\]/g)?.length).toBe(1);
  });
});

describe('answers CS20 to CS22', () => {
  it('CS20: sleep checks who is near by sound; no sleeper loop reads the zone as the distance', () => {
    const sleep = readFileSync('src/engine/sleep.ts', 'utf8') as string, resolve = readFileSync('src/engine/resolve.ts', 'utf8') as string;
    expect(sleep).not.toMatch(/x\.zone === a\.zone && hostile/);
    expect(resolve).not.toMatch(/isAsleep\(x\) && x\.zone === p\.zone/);
  });
  it('CS21: D-3 is settled; effective skill has no hard cap step', () => {
    expect(readFileSync('src/ruleset/gear.ts', 'utf8') as string).not.toMatch(/GAP: hard cap/);
    const spec = readFileSync('docs/build-spec.md', 'utf8') as string;
    expect(spec).not.toMatch(/apply hard cap/);
    expect(spec).toMatch(/\| D-3 \| Soft cap and hard cap \| 1 \| Built \|/);
  });
  it('CS22: routine_unreachable is logged, not promised', () => {
    expect(readFileSync('src/minds/routines.ts', 'utf8') as string).not.toMatch(/routine_unreachable \[Proposed\]/);
  });
});

describe('leftover scan round 9', () => {
  it('slot names are spelled in one place: no other code builds or tests a grip or accessory slot by hand', () => {
    const own = ['src/ruleset/slots.ts', 'src/save/checks.ts', 'src/library/data.ts']; // checks.ts: the v7 -> v8 migration keeps its fixed spelling
    const offenders = files('src').filter((f) => !own.includes(f) && /startsWith\('(grip|acc):'\)|`(grip|acc):\$\{|replace\(\/\^grip:/.test(readFileSync(f, 'utf8') as string));
    expect(offenders).toEqual([]);
    const sword = { equippedIn: [gripSlot('right_arm'), gripSlot('left_arm')] }, ring = { equippedIn: [accSlot(0)] };
    expect([isHeld(sword), isWorn(sword), isHeld(ring), isWorn(ring)]).toEqual([true, false, false, true]);
    expect(gripsOf(sword)).toEqual(['right_arm', 'left_arm']);
  });
  it('a part\'s state reads its floors from config', () => {
    expect([51, 50, 1, 0, -99, -100].map(poolState)).toEqual(['healthy', 'damaged', 'damaged', 'crippled', 'crippled', 'destroyed']);
    expect(readFileSync('src/ruleset/body.ts', 'utf8') as string).not.toMatch(/pct > 50|pct > -100/);
  });
  it('one XP bar: every screen reads xpFill, and XP debt shows an empty bar', () => {
    const offenders = files('src').filter((f) => f !== 'src/engine/xp.ts' && /\((pr\.)?xp \/ need\)/.test(readFileSync(f, 'utf8') as string));
    expect(offenders).toEqual([]);
    const s = makeVillage();
    s.player.progression!.xp = -5;
    expect(xpFill(s.player).pct).toBe(0);
  });
  it('one rule for what is seen at a point (dark: at most partial)', () => {
    const offenders = files('src').filter((f) => f !== 'src/perception/index.ts' && /=== 'dark' \? 'partial'/.test(readFileSync(f, 'utf8') as string));
    expect(offenders).toEqual([]);
  });
  it('stale creation notes and placeholders are gone; scale positions are read by key', () => {
    const t = readFileSync('src/ui/creation.ts', 'utf8') as string;
    expect(t).not.toMatch(/Swordsman skills have no effects yet|Not chosen yet|'Stealth'/);
    expect(readFileSync('src/ruleset/perks.ts', 'utf8') as string).not.toMatch(/\.pos\([^)]*\)\) >= 1/);
  });
});

describe('leftover scan round 10', () => {
  const read = (f: string) => readFileSync(f, 'utf8') as string;
  it('one edge rule: an unnamed side is its zone kind\'s default edge, for sound and for reaching over alike', () => {
    const z = (id: string, x: number, kind: string, edges?: Zone['edges']) => ({ id, kind, rect: { x, y: 0, w: 4, d: 4 }, links: [], ...(edges ? { edges } : {}) }) as unknown as Zone;
    const room = z('a', 0, ZK.room), yard = z('b', 4, ZK.yard), bar = z('c', 0, ZK.room, { e: EK.low });
    expect([edgeFacing(room, yard), edgeFacing(yard, room), edgeFacing(bar, yard)]).toEqual([EK.wall, EK.open, EK.low]);
    const kinds = getLibrary().edgeKinds ?? {};
    expect([reachesOver(room, yard, kinds), reachesOver(bar, yard, kinds)]).toEqual([false, true]);
    expect(read('src/perception/noise.ts')).not.toMatch(/zoneKinds\?\.\[z\.kind\]\?\.edge/);
    expect(read('src/scenario/geometry.ts').match(/const chain = \(id/g)).toBeNull();
  });
  it('every long-term clear lowers the hours-awake count in one place', () => {
    const s = makeVillage(), p = s.player;
    p.core.condition.fatigue = { debt: 40, line: 0, awake: 40 };
    const got = recoverDebt(p, RV.sleep, 10);
    expect(got).toBeGreaterThan(0);
    expect(p.core.condition.fatigue!.awake).toBeCloseTo(40 - got);
    expect(read('src/engine/fatigue.ts').match(/awake - got/g)?.length).toBe(1);
  });
  it('one contest for engagement auras and Battle Cry; allies by stance position; one each-perceives rule', () => {
    const a = read('src/engine/auras.ts');
    expect(a.match(/toContest\(/g)?.length).toBe(1);
    expect(a).not.toMatch(/'friend', 'loyal'/);
    expect(read('src/engine/travel.ts')).not.toMatch(/perceivesNow/);
  });
  it('the Stacking tab names noise, attention, light and pace by their scale names', () => {
    const v = (src: string) => MOD_SOURCES.find((m) => m.source === src)!.value;
    expect(v('Waking')).toMatch(/^Faint /);
    expect(v('Light')).toMatch(/dim -5/);
    expect(v('Travel pace')).toMatch(/slow \+10 · fast -10/);
  });
  it('no literal durations in motion, one walk chip, one plural, packet words used as they come', () => {
    expect(read('src/ui/motion.ts')).not.toMatch(/dur: Math\.min\(\d|\+ \d+ \* strength/);
    expect(read('src/ui/styles.css')).toMatch(/--m-pulse-step: \d+ms; --m-pulse-max: \d+ms/);
    expect(read('src/ui/doing.ts').match(/const chip =/g)?.length).toBe(1);
    expect(read('src/ui/gains.ts')).not.toMatch(/const plural =|proposed M-39/);
    expect(read('src/agents/narration.ts')).not.toMatch(/p\.(action|outcome)\.replace/);
  });
});

describe('answers CS23 to CS25', () => {
  const read = (f: string) => readFileSync(f, 'utf8') as string;
  it('CS24: Destroyed weighs DESTROYED_PART_WEIGHT Crippled ones in the role penalty and in no running alike', () => {
    const b = read('src/ruleset/body.ts');
    expect(b.match(/CONFIG\.DESTROYED_PART_WEIGHT/g)?.length).toBe(2);
    expect(b).not.toMatch(/'destroyed'\) \? 2 :/);
    expect(read('docs/build-spec.md')).not.toMatch(/Destroyed part counting twice/);
  });
  it('CS25: filch, ambush and sneaking past sleepers count Against the Odds once per act', () => {
    for (const f of ['src/engine/filch.ts', 'src/minds/state.ts', 'src/engine/sleep.ts', 'src/engine/resolve.ts']) expect(read(f)).toMatch(/outmatchedOnce\(state, /);
  });
});
