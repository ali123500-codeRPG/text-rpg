// 106 XP and levels (Ali, 07/11/2026, X1–X10): a defeat pays once, a first defeat earns an achievement,
// fled or untouched foes pay nothing, and a level-up goes to the chosen class.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { actor } from '../harness/village';
import { awardXp, effort, killXp, payDefeats, rating, xpToNext } from '../../src/engine/xp';
import { CONFIG } from '../../src/config';
import type { GameEvent } from '../../src/types';

const hit = (target: string): GameEvent => ({ id: 'e1', turn: 1, actorId: 'player', kind: 'attack', zone: 'field_mid', effects: [], noise: 1, visibility: 1, perception: {},
  attack: { attackerId: 'player', targetId: target, damage: 5 } as never });

describe('106 XP and levels', () => {
  it('rating: categories ranked 1, ½, ¼, weighted; weak foes taper (X18–X23)', () => {
    const s = makeVillage();
    const slime = actor(s, 'slime_1');
    expect(rating(slime)).toBeCloseTo(effort(30), 5); // one offensive skill
    const g = actor(s, 'guard_1');
    expect(rating(g)).toBeGreaterThan(rating(slime));
    const t = Math.min(1, CONFIG.KILL_XP_TAPER * rating(slime) / rating(s.player));
    expect(killXp(s, slime)).toBeCloseTo(rating(slime) * t * CONFIG.KILL_XP_MULT, 1);
    s.player.core.skills.barter = { raw: 90, state: 'normal' }; // influence counts at 0.25×
    const before = rating(s.player);
    s.player.core.skills.lockpicking = { raw: 90, state: 'normal' }; // misc counts 0
    expect(rating(s.player)).toBe(before);
  });
  it('ten defeats earn defeats_10 and defeats_10:<creature> once each, named for what was defeated', () => {
    const s = makeVillage();
    for (let i = 0; i < 11; i++) {
      const a = structuredClone(actor(s, 'slime_1'));
      a.id = `slime_x${i}`;
      a.mind!.moraleState = 'surrendered';
      s.actors.push(a);
      payDefeats(s, []);
    }
    const ids = s.player.progression!.achievements!.map((a) => a.id);
    expect(ids).toEqual(['first_defeat:slime', 'defeats_10:slime', 'defeats_10']);
    expect(s.player.progression!.achievements!.map((a) => a.name)).toEqual(['Slimebane', 'Scourge of the Slime Hordes', 'Tenfold Reaper']);
  });
  it('a foe with a race also earns the first race defeat', () => {
    const s = makeVillage();
    const a = actor(s, 'slime_1');
    a.core.raceId = 'elf';
    a.mind!.moraleState = 'surrendered';
    payDefeats(s, []);
    const got = s.player.progression!.achievements!;
    expect(got.map((x) => [x.id, x.name])).toEqual([['first_defeat:slime', 'Slimebane'], ['first_defeat_race:elf', 'Bane of Elfkind']]);
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
    expect(pr.achievements!.map((a) => a.id)).toEqual(['first_defeat:slime']);
    expect(pr.xpLog!.map((x) => x.source)).toEqual(['defeat:slime_1', 'achievement:first_defeat:slime', 'level']); // 100 XP: level 2
    expect(pr.xpLog![0].amount).toBe(xp);
    expect(pr.xpLog![1].amount).toBe(100);
    const other = actor(s, 'slime_2');
    other.core.condition.hpLostPct = 100; // downed by someone else: nothing
    payDefeats(s, []);
    expect(pr.xpLog).toHaveLength(3);
  });
  it('a surrender pays; a fleeing (broken) foe does not', () => {
    const s = makeVillage();
    actor(s, 'slime_1').mind!.moraleState = 'surrendered';
    actor(s, 'slime_2').mind!.moraleState = 'broken';
    payDefeats(s, []);
    expect(s.player.progression!.xpLog!.filter((x) => x.source.startsWith('defeat')).map((x) => x.source)).toEqual(['defeat:slime_1']);
  });
  it('levels need LEVEL_XP × level and go to the chosen class', () => {
    const s = makeVillage();
    const p = s.player, pr = p.progression!;
    expect(xpToNext(p)).toBe(CONFIG.LEVEL_XP);
    p.core.classes.push({ classId: 'slime', state: 'unlocked', level: 0 });
    pr.nextClass = 'slime';
    awardXp(s, CONFIG.LEVEL_XP + 5, 'test');
    expect(pr.xp).toBe(5);
    expect(p.core.classes.map((c) => [c.classId, c.state, c.level])).toEqual([['swordsman', 'previous', 1], ['slime', 'current', 1]]);
    expect(pr.unspentPerkPoints).toBe(1); // level 2 is even
    expect(pr.xpLog!.at(-1)!.levelUp).toEqual({ classId: 'slime', level: 2 });
  });
});
