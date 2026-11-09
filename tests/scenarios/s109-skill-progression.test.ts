// 109 Skill progression (Ali, 07/11/2026, SP1–SP11): a use marks a skill when the opposition is within MARK_WINDOW of
// raw or true skill; a big hit marks endurance; marked skills make the Part 1 §6 roll and the marks clear.
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { CONFIG } from '../../src/config';
import { improveMarked, markEndurance } from '../../src/ruleset';
import { markIfClose } from '../../src/ruleset/improve';
import { mechanicsLines } from '../../src/agents/game';
import { SK } from '../../src/library/skillIds';

describe('109 skill progression', () => {
  it('a use marks only when the opposition is close to raw or true skill, and only for the player', () => {
    const s = makeVillage();
    const p = s.player;
    p.core.skills[SK.eyesight] = { raw: 40, state: 'normal' };
    markIfClose(s, p, SK.eyesight, 40 + CONFIG.MARK_WINDOW + 1); // too hard
    markIfClose(s, p, SK.eyesight, 10); // too easy
    expect(p.progression!.marks).toEqual([]);
    markIfClose(s, p, SK.eyesight, 40 - CONFIG.MARK_WINDOW);
    markIfClose(s, p, SK.eyesight, 45); // once only
    expect(p.progression!.marks).toEqual([SK.eyesight]);
    const npc = s.actors.find((a) => a.kind === 'npc')!;
    markIfClose(s, npc, Object.keys(npc.core.skills)[0], 0); // NPCs keep no marks (SP7)
    expect(npc.progression?.marks ?? []).toEqual([]);
  });
  it('a hit costing ENDURANCE_MARK_PCT health or more marks endurance', () => {
    const s = makeVillage();
    s.player.core.skills[SK.endurance] ??= { raw: 20, state: 'normal' };
    markEndurance(s, s.player, CONFIG.ENDURANCE_MARK_PCT - 1);
    expect(s.player.progression!.marks).toEqual([]);
    markEndurance(s, s.player, CONFIG.ENDURANCE_MARK_PCT);
    expect(s.player.progression!.marks).toEqual([SK.endurance]);
  });
  it('marked skills roll once: a roll over the target adds 1d5 and shows; a failed roll shows nothing', () => {
    const s = makeVillage();
    const p = s.player;
    p.core.skills[SK.eyesight] = { raw: 38, state: 'tagged' };
    p.core.skills[SK.earshot] = { raw: 30, state: 'tagged' };
    p.progression!.marks = [SK.eyesight, SK.earshot];
    const gains = improveMarked(s, forcedRng([90, 3, 10])); // sight 90 > 38: +3; hearing 10 ≤ 30: nothing
    expect(gains).toEqual([{ skill: SK.eyesight, from: 38, to: 41, milestone: 40 }]);
    expect(p.core.skills[SK.eyesight].raw).toBe(41);
    expect(p.core.skills[SK.earshot].raw).toBe(30);
    expect(p.progression!.marks).toEqual([]);
    const lines = mechanicsLines(s, []);
    expect(lines).toContain('Eyesight 38 → 41');
    expect(lines).toContain('New perk unlocked: Eyesight 40');
    expect(lines.some((l) => l.startsWith('Earshot'))).toBe(false);
  });
});
