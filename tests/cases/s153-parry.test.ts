// 153 Parry and the Block rework (PA1–PA12): Block is shields only, Parry turns melee blows with a held weapon,
// a parry at +3 stops the blow and earns a free strike back, failed parries let more through, Riposte augments Parry,
// Blade Dance augments Dodge, Answer the Blow brings the strike 2 gaps sooner with a medium weapon.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fit, forcedRng, makeVillage, place } from '../harness';
import { effectiveSkill, ruleset } from '../../src/ruleset';
import { defaultStandingDefense } from '../../src/ruleset/gear';
import { CONFIG } from '../../src/config';
import type { Actor, AttackResult, GameState } from '../../src/types';
import { intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';
import { CL } from '../../src/library/classIds';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const hold = (a: Actor, items: string[]) => {
  a.core.inventory = a.core.inventory.filter((i) => !i.id.startsWith(`${a.id}_h`));
  for (const i of a.core.inventory) if (i.equippedIn?.some((h) => h.startsWith('grip:'))) delete i.equippedIn;
  items.forEach((itemId, n) => {
    a.core.inventory.push({ id: `${a.id}_h${n}`, itemId, equippedIn: [n ? 'grip:left_arm' : 'grip:right_arm'] });
    fit(a, itemId);
  });
};
/** patron_1 swings at the player over a grid of attack and defense dice (a natural high die lifts a tier); every result */
const DICE = [6, 11, 21, 31, 41, 51, 61, 71, 81, 91, 95, 96, 98, 100];
const swings = (s: GameState) => DICE.flatMap((i) => DICE.map((k) =>
  ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'patron_1_h0', targetPart: null, aimed: false }, s, forcedRng([i, k, 50, 50]))));
const setup = () => {
  const s = makeVillage();
  place(s, 'patron_1', s.player.zone);
  hold(npc(s, 'patron_1'), [IT.dagger]);
  hold(s.player, [IT.arming_sword]);
  s.player.core.skills[SK.parry] = { raw: 100, state: 'normal' };
  npc(s, 'patron_1').core.skills[SK.melee_light] = { raw: 40, state: 'normal' };
  s.player.core.standingDefense = 'parry';
  return s;
};

describe('153 Parry', () => {
  afterEach(() => vi.restoreAllMocks());

  it('the parry table: harsher failures, partial turns at +1 and +2, a full stop with a strike from +3', () => {
    const s = setup();
    const seen = new Set<number>();
    for (const r of swings(s)) {
      if (r.outcome === 'missed') continue;
      expect(r.defenseType).toBe('parry');
      const g = Math.max(-5, Math.min(5, r.gap!));
      seen.add(g);
      expect(r.multiplier).toBe(CONFIG.GAP_LADDER.parry[g]);
      if (g >= 3) expect(r.outcome).toBe('parried');
      else if (g >= 1) expect(r.outcome).toBe('blocked');
      expect(!!r.strikeBack).toBe(g >= 3);
    }
    expect([...seen].some((g) => g >= 3) && [...seen].some((g) => g < 0)).toBe(true);
    expect(CONFIG.GAP_LADDER.parry[-1]).toBeGreaterThan(CONFIG.GAP_LADDER.block[-1]);
    expect(CONFIG.GAP_LADDER.parry[1]).toBeGreaterThan(CONFIG.GAP_LADDER.block[1]);
  });

  it('Block is shields only; a weapon parries; parry never stops a missile', () => {
    const s = setup();
    s.player.core.standingDefense = 'block';
    expect(swings(s).find((r) => r.defense)!.defenseType).not.toBe('block'); // a sword can't block
    hold(s.player, [IT.arming_sword, IT.round_shield]);
    expect(swings(s).find((r) => r.defense)!.defenseType).toBe('block');
    // a shot at a parrying player: it falls back to the best other defense (the shield here)
    s.player.core.standingDefense = 'parry';
    const p = npc(s, 'patron_1');
    hold(p, [IT.shortbow]);
    s.player.zone = s.zones.find((z) => z.links.length && z.id !== p.zone && s.zones.find((y) => y.id === p.zone)!.links.some((l) => l.to === z.id))?.id ?? s.player.zone;
    const shot = ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'patron_1_h0', targetPart: null, aimed: false }, s, forcedRng([90, 50, 50, 50]));
    expect(shot.defenseType).toBe('block');
    hold(s.player, [IT.arming_sword]);
    expect(ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'patron_1_h0', targetPart: null, aimed: false }, s, forcedRng([90, 50, 50, 50])).defenseType).toBe('dodge');
  });

  it('a heavy weapon is −1 gap against a parry', () => {
    const s = setup();
    const p = npc(s, 'patron_1');
    hold(p, [IT.greataxe]);
    p.core.inventory.find((i) => i.id === 'patron_1_h0')!.equippedIn = ['grip:right_arm', 'grip:left_arm'];
    p.core.skills[SK.melee_heavy] = { raw: 60, state: 'normal' };
    const r = swings(s).find((x) => x.defense);
    expect(r?.gapShifts).toContainEqual({ source: 'heavy vs parry', value: CONFIG.HEAVY_VS_BLOCK_GAP });
  });

  it('Answer the Blow: with a medium weapon the strike comes 2 gaps sooner; not with a light weapon', () => {
    const strikesAt = (perk: boolean, weapon: string) => {
      const s = setup();
      hold(s.player, [weapon]);
      if (perk) give(s.player, PK.answer_the_blow);
      return Math.min(...swings(s).filter((r) => r.strikeBack).map((r) => r.gap!));
    };
    expect(strikesAt(false, IT.arming_sword)).toBe(CONFIG.PARRY_STRIKE_GAP);
    expect(strikesAt(true, IT.arming_sword)).toBe(CONFIG.PARRY_STRIKE_GAP - CONFIG.ANSWER_THE_BLOW_DROP);
    expect(strikesAt(true, IT.dagger)).toBe(CONFIG.PARRY_STRIKE_GAP);
  });

  it('a strike back is a free melee attack with the parrying weapon, once per turn', () => {
    const s = setup();
    const p = npc(s, 'patron_1');
    hold(p, [IT.arming_sword]);
    p.core.skills[SK.parry] = { raw: 30, state: 'normal' };
    p.core.standingDefense = 'parry';
    const calls: { by: string; at: string; weapon: string }[] = [];
    const real = ruleset.attack;
    vi.spyOn(ruleset, 'attack').mockImplementation((req, st) => {
      calls.push({ by: req.attackerId, at: req.targetId, weapon: req.weaponId });
      const r = real(req, st, forcedRng([50, 50, 50, 50]));
      // every attack on the patron is parried cleanly; it may strike back only once this turn
      return req.targetId === 'patron_1' ? { ...r, defenseType: 'parry', gap: 3, outcome: 'parried', multiplier: 0, damage: 0, location: null, strikeBack: true } as AttackResult : r;
    });
    play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', item: 'player_h0' } }) });
    expect(calls[1]).toEqual({ by: 'patron_1', at: 'player', weapon: 'patron_1_h0' });
    expect(calls.filter((c, i) => i > 0 && calls[i - 1].by === 'player' && c.by === 'patron_1' && calls[i - 1].at === 'patron_1').length).toBeLessThanOrEqual(1);
  });

  it('Riposte adds its full value to Parry rolls, and Blade Dance to Dodge rolls', () => {
    const s = setup();
    const parry = effectiveSkill(s, s.player, SK.parry).value;
    const dodge = effectiveSkill(s, s.player, SK.dodge).value;
    s.player.core.skills[SK.riposte] = { raw: 20, state: 'normal' };
    s.player.core.skills[SK.blade_dance] = { raw: 15, state: 'normal' };
    s.player.core.classes.push({ classId: CL.sword_dancer, state: 'previous', level: 1 }); // Blade Dance's tree opens with a level in the class
    expect(effectiveSkill(s, s.player, SK.parry).value).toBeCloseTo(parry + 20);
    expect(effectiveSkill(s, s.player, SK.dodge).value).toBeCloseTo(dodge + 15);
  });

  it('the default defense: the highest usable of block, parry and dodge; the village guard parries', () => {
    const s = setup();
    s.player.core.skills[SK.block] = { raw: 60, state: 'normal' };
    s.player.core.skills[SK.parry] = { raw: 40, state: 'normal' };
    expect(defaultStandingDefense(s, s.player)).toBe('parry'); // no shield, so Block can't be chosen
    hold(s.player, [IT.arming_sword, IT.round_shield]);
    expect(defaultStandingDefense(s, s.player)).toBe('block');
    expect(npc(makeVillage(), 'guard_1').core.standingDefense).toBe('parry');
  });
});
