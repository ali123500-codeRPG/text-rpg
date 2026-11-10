// 106 XP and levels (X1–X10): a defeat pays once, a first defeat earns an achievement,
// fled or untouched foes pay nothing, and a level-up goes to the chosen class.
import { TP } from '../../src/library/templateIds';
import { BT, RC } from '../../src/library/raceIds';
import { ACH } from '../../src/library/achievementIds';
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { actor } from '../harness/village';
import { achievementName, awardXp, effort, gearRating, killXp, payDefeats, rating, xpGroupFactor, xpToNext } from '../../src/engine/xp';
import { CONFIG } from '../../src/config';
import { REWARD_LEVELS } from '../../src/scales';
import { getLibrary } from '../../src/library';
import type { GameEvent } from '../../src/types';
import { SK } from '../../src/library/skillIds';
import { GR } from '../../src/library/functionIds';
import { CL } from '../../src/library/classIds';

const hit = (target: string): GameEvent => ({ id: 'e1', turn: 1, actorId: 'player', kind: 'attack', zone: 'field_mid', effects: [], noise: 'quiet', visibility: 'low', perception: {},
  attack: { attackerId: 'player', targetId: target, damage: 5 } as never });

describe('106 XP and levels', () => {
  it('rating: categories ranked 1, ½, ¼, weighted; weak foes taper (X18–X23)', () => {
    const s = makeVillage();
    const slime = actor(s, 'slime_1');
    // one offensive skill, plus tremor (50, tier 0 so read as 25) at the notice weight (Taste removed), plus steady Resolve 50 (Will)
    expect(rating(slime)).toBeCloseTo(effort(30) + xpGroupFactor(GR.notice) * effort(25) + xpGroupFactor(GR.will) * effort(50), 5);
    const g = actor(s, 'guard_1');
    expect(rating(g)).toBeGreaterThan(rating(slime));
    const t = Math.min(1, CONFIG.KILL_XP_TAPER * rating(slime) / (rating(s.player) + gearRating(s, s.player))); // the player's gear counts too
    expect(killXp(s, slime)).toBeCloseTo(rating(slime) * t * CONFIG.KILL_XP_MULT, 1);
    s.player.core.skills[SK.barter] = { raw: 90, state: 'normal' }; // influence counts at 0.25×
    const before = rating(s.player);
    s.player.core.skills[SK.lockpicking] = { raw: 90, state: 'normal' }; // misc counts 0
    expect(rating(s.player)).toBe(before);
  });
  it('ten defeats earn defeats_10 and defeats_10:<body type> once each, named for what was defeated', () => {
    const s = makeVillage();
    for (let i = 0; i < 11; i++) {
      const a = structuredClone(actor(s, 'slime_1'));
      a.id = `slime_x${i}`;
      a.mind!.moraleState = 'surrendered'; a.mind!.overrides = { player: 'yielded' }; // a surrender yields to its foes (Q1)
      s.actors.push(a);
      payDefeats(s, []);
    }
    const ids = s.player.progression!.achievements!.map((a) => a.id);
    // BR8: a slime counts for its body type (amorphous) and its race (Slime)
    expect(ids).toEqual([`${ACH.first_defeat_body_type}:${BT.amorphous}`, `${ACH.first_defeat_race}:${RC.slime}`, `${ACH.defeats_10_body_type}:${BT.amorphous}`, `${ACH.defeats_10_race}:${RC.slime}`, ACH.defeats_10]);
    expect(s.player.progression!.achievements!.map((a) => achievementName(s, a)).filter((n) => !n.includes('kind'))).toEqual(['First Amorphous Felled', 'Amorphousbane', 'Blooded Fighter']);
    getLibrary().achievements![ACH.defeats_10_body_type].name = 'Hunter of the {body_type}'; // renaming edits only the table
    expect(achievementName(s, s.player.progression!.achievements![2])).toBe('Hunter of the Amorphous');
    getLibrary().achievements![ACH.defeats_10_body_type].name = '{body_type}bane';
  });
  it('every achievement row is keyed by its own fixed AC-prefixed ID', () => {
    const lib = getLibrary().achievements!;
    expect(Object.entries(lib).every(([k, d]) => k === d.id && /^AC\d+$/.test(k))).toBe(true);
    expect(new Set(Object.values(ACH)).size).toBe(Object.values(ACH).length);
    expect(Object.keys(lib).sort()).toEqual([...Object.values(ACH)].sort());
  });
  it('every achievement pays the XP of its reward level', () => {
    const lib = getLibrary().achievements!;
    for (const d of Object.values(lib)) expect(REWARD_LEVELS.has(d.level)).toBe(true);
    expect(REWARD_LEVELS.keys.map((k) => CONFIG.REWARD_XP[k])).toEqual([25, 50, 100, 250, 1000, 2000, 5000, 10000]);
    expect(CONFIG.REWARD_XP[lib[ACH.mastery_150].level]).toBe(2000);
  });
  it('a foe with a race also earns the first race defeat', () => {
    const s = makeVillage();
    expect(s.actors.filter((x) => x.core.templateId === TP.guard).every((x) => x.core.raceId === RC.human)).toBe(true);
    const a = actor(s, 'slime_1');
    a.core.raceId = RC.elf;
    a.mind!.moraleState = 'surrendered'; a.mind!.overrides = { player: 'yielded' };
    payDefeats(s, []);
    const got = s.player.progression!.achievements!;
    expect(got.map((x) => [x.id, achievementName(s, x)])).toEqual([[`${ACH.first_defeat_body_type}:${BT.amorphous}`, 'First Amorphous Felled'], [`${ACH.first_defeat_race}:${RC.elf}`, 'First of Elfkind Felled']]);
  });
  it('a slime the player hit and downed pays its kill XP once, plus a first-defeat achievement', () => {
    const s = makeVillage();
    const slime = actor(s, 'slime_1');
    const xp = killXp(s, slime);
    payDefeats(s, [hit('slime_1')]);
    expect(s.player.progression!.xp).toBe(0); // still up: nothing yet
    slime.core.condition.hpLostPct = 100;
    payDefeats(s, []);
    payDefeats(s, []);
    const pr = s.player.progression!;
    expect(pr.achievements!.map((a) => a.id)).toEqual([`${ACH.first_defeat_body_type}:${BT.amorphous}`, `${ACH.first_defeat_race}:${RC.slime}`]);
    expect(pr.xpLog!.map((x) => x.source)).toEqual(['defeat:slime_1', `achievement:${ACH.first_defeat_body_type}:${BT.amorphous}`, 'level', `achievement:${ACH.first_defeat_race}:${RC.slime}`]); // 100 XP: level 2
    expect(pr.xpLog![0].amount).toBe(xp);
    expect(pr.xpLog![1].amount).toBe(100);
    const other = actor(s, 'slime_2');
    other.core.condition.hpLostPct = 100; // downed by someone else: nothing
    payDefeats(s, []);
    expect(pr.xpLog).toHaveLength(4);
  });
  it('RS7: a downed NPC the player hit pays whatever its stance; a surrender to someone else does not', () => {
    const s = makeVillage();
    const p = actor(s, 'patron_1');
    Object.assign(p.mind!, { overrides: { player: 'friendly' }, hitByPlayer: true });
    p.core.condition.hpLostPct = 100;
    Object.assign(actor(s, 'trader').mind!, { moraleState: 'surrendered', overrides: { guard_1: 'yielded' } });
    payDefeats(s, []);
    expect(s.player.progression!.xpLog!.filter((x) => x.source.startsWith('defeat')).map((x) => x.source)).toEqual(['defeat:patron_1']);
  });
  it('a surrender pays; a fleeing (broken) foe does not', () => {
    const s = makeVillage();
    Object.assign(actor(s, 'slime_1').mind!, { moraleState: 'surrendered', overrides: { player: 'yielded' } });
    actor(s, 'slime_2').mind!.moraleState = 'broken';
    payDefeats(s, []);
    expect(s.player.progression!.xpLog!.filter((x) => x.source.startsWith('defeat')).map((x) => x.source)).toEqual(['defeat:slime_1']);
  });
  it('levels need LEVEL_XP × level and go to the chosen class', () => {
    const s = makeVillage();
    const p = s.player, pr = p.progression!;
    expect(xpToNext(p)).toBe(CONFIG.LEVEL_XP);
    p.core.classes.push({ classId: CL.trader, state: 'unlocked', level: 0 });
    pr.nextClass = CL.trader;
    awardXp(s, CONFIG.LEVEL_XP + 5, 'test');
    expect(pr.xp).toBe(5);
    expect(p.core.classes.map((c) => [c.classId, c.state, c.level])).toEqual([[CL.swordsman, 'previous', 1], [CL.trader, 'current', 1]]);
    expect(pr.unspentPerkPoints).toBe(1); // level 2 is even
    expect(pr.xpLog!.at(-1)!.levelUp).toEqual({ classId: CL.trader, level: 2 });
  });
});
