// 403 Mind Over Body (Resolve's All-100 part): a quarter of Resolve adds to max health the way Endurance does, and
// whenever Endurance is marked for training, Resolve is marked too.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { markEndurance, totalHp } from '../../src/ruleset';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { PK } from '../../src/library/perkIds';
import { TR } from '../../src/library/treeIds';
import type { Actor, AttackResult } from '../../src/types';

const give = (a: Actor) => a.core.perks.push({ perkId: PK.mind_over_body, source: 'mastery', gainedTurn: 0, treeId: TR.fortitude, tier: 100 });

describe('403 Mind Over Body', () => {
  it('adds Resolve × MIND_OVER_BODY_SHARE to max health, the way Endurance adds', () => {
    const s = makeVillage();
    s.player.core.skills[SK.endurance] = { raw: 100, state: 'normal' };
    s.player.core.skills[SK.resolve] = { raw: 100, state: 'normal' };
    const before = totalHp(s, s.player);
    give(s.player);
    const parts: { label: string; adds?: number }[] = [];
    const after = totalHp(s, s.player, parts);
    const mult = before / (CONFIG.HP_BASE + CONFIG.HP_PER_END * 100); // body and prefix multipliers
    expect(after - before).toBeCloseTo(CONFIG.HP_PER_END * 100 * CONFIG.MIND_OVER_BODY_SHARE * mult, 9);
    expect(parts.some((p) => p.label.startsWith('Mind Over Body') && p.adds === CONFIG.HP_PER_END * 100 * CONFIG.MIND_OVER_BODY_SHARE)).toBe(true);
  });
  it('marks Resolve whenever Endurance is marked', () => {
    const s = makeVillage();
    s.player.core.skills[SK.endurance] = { raw: 20, state: 'normal' };
    const foe = s.actors.find((a) => a.kind === 'npc')!;
    foe.core.skills[SK.melee_medium] = { raw: 25, state: 'normal' };
    const hit = { attack: { actorId: foe.id, skill: SK.melee_medium } } as unknown as AttackResult;
    markEndurance(s, s.player, 1, hit);
    expect(s.player.progression!.marks).toEqual([SK.endurance]); // without the perk only Endurance
    s.player.progression!.marks = []; s.player.progression!.markCounts = {};
    give(s.player);
    markEndurance(s, s.player, 1, hit);
    expect(s.player.progression!.marks).toEqual([SK.endurance, SK.resolve]);
    s.player.progression!.marks = []; s.player.progression!.markCounts = {};
    markEndurance(s, s.player, 0, hit); // Endurance not marked: neither is Resolve
    expect(s.player.progression!.marks).toEqual([]);
  });
});
