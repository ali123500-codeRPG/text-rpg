// 109 Skill progression (SP1–SP11): a use marks a skill when the opposition is within MARK_WINDOW of
// raw or true skill; a hit from a foe inside Endurance's window marks it; marked skills make the Part 1 §6 roll and the marks clear.
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { CONFIG } from '../../src/config';
import { improveMarked, markEndurance } from '../../src/ruleset';
import { markIfClose } from '../../src/ruleset/improve';
import { mechanicsLines } from '../../src/agents/game';
import { SK } from '../../src/library/skillIds';
import type { AttackResult } from '../../src/types';

describe('109 skill progression', () => {
  it('a use marks only when the opposition is close to raw or true skill, and only for the player', () => {
    const s = makeVillage();
    const p = s.player;
    p.core.skills[SK.eyesight] = { raw: 40, state: 'normal' };
    markIfClose(s, p, SK.eyesight, 40 + CONFIG.MARK_WINDOW + 1); // too hard
    markIfClose(s, p, SK.eyesight, 10); // too easy
    expect(p.progression!.marks).toEqual([]);
    markIfClose(s, p, SK.eyesight, 40 - CONFIG.MARK_WINDOW);
    markIfClose(s, p, SK.eyesight, 45); // every mark owes a roll (MARK_STACK_EVERY 1)
    expect(p.progression!.marks).toEqual([SK.eyesight, SK.eyesight]);
    const npc = s.actors.find((a) => a.kind === 'npc')!;
    markIfClose(s, npc, Object.keys(npc.core.skills)[0], 0); // NPCs keep no marks (SP7)
    expect(npc.progression?.marks ?? []).toEqual([]);
  });
  it('a hit that costs health marks Endurance when the attacker is inside its learning window', () => {
    const s = makeVillage();
    s.player.core.skills[SK.endurance] = { raw: 20, state: 'normal' };
    const foe = s.actors.find((a) => a.kind === 'npc')!;
    const hit = { attack: { actorId: foe.id, skill: SK.melee_medium } } as unknown as AttackResult;
    foe.core.skills[SK.melee_medium] = { raw: 5, state: 'normal' }; // below 20 − MARK_WINDOW: too weak to teach
    markEndurance(s, s.player, 15, hit);
    expect(s.player.progression!.marks).toEqual([]);
    foe.core.skills[SK.melee_medium] = { raw: 25, state: 'normal' };
    markEndurance(s, s.player, 0, hit); // no health lost: nothing to learn
    expect(s.player.progression!.marks).toEqual([]);
    markEndurance(s, s.player, 1, hit); // even a small hit teaches
    expect(s.player.progression!.marks).toEqual([SK.endurance]);
  });
  it('marked skills roll once: the tier sets the gain (SG1 C) and shows; a failed roll shows nothing', () => {
    const s = makeVillage();
    const p = s.player;
    p.core.skills[SK.eyesight] = { raw: 38, state: 'tagged' };
    p.core.skills[SK.earshot] = { raw: 30, state: 'normal' };
    p.progression!.marks = [SK.eyesight, SK.earshot];
    // sight: 50 + (120 − 38) − 100 = 32: ⌈32 ÷ 15⌉ = +3; hearing: 10 + (100 − 30 − burden) − 100 is below 0: nothing
    const gains = improveMarked(s, forcedRng([50, 10]));
    expect(gains).toEqual([{ skill: SK.eyesight, from: 38, to: 41, milestone: 40 }]);
    expect(p.core.skills[SK.eyesight].raw).toBe(41);
    expect(p.core.skills[SK.earshot].raw).toBe(30);
    expect(p.progression!.marks).toEqual([]);
    const lines = mechanicsLines(s, []);
    expect(lines).toContain('Eyesight 38 → 41');
    expect(lines).toContain('New perk unlocked: Eyesight 40');
    expect(lines.some((l) => l.startsWith('Earshot'))).toBe(false);
  });
  it('no hard limit (D-374 TB7, D-383): raw stops exactly at the cap because margin 0 gains nothing', () => {
    const s = makeVillage();
    const p = s.player;
    p.core.skills = { [SK.eyesight]: { raw: 99, state: 'normal' }, [SK.dodge]: { raw: 119, state: 'tagged' } }; // different groups: no group bonus
    p.progression!.marks = [SK.eyesight, SK.dodge];
    expect(improveMarked(s, forcedRng([100, 100]))).toMatchObject([{ skill: SK.eyesight, from: 99, to: 100 }, { skill: SK.dodge, from: 119, to: 120 }]); // margin 1: +1
    p.progression!.marks = [SK.eyesight, SK.dodge];
    expect(improveMarked(s, forcedRng([100, 100]))).toEqual([]); // margin 0: nothing
  });
});
