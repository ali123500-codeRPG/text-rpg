// 153 Parry and the Block rework (PA1–PA12): Block is shields only, Parry turns melee blows with a held weapon,
// a parry at +3 stops the blow and earns a free strike back, failed parries let more through, Riposte augments Parry,
// Blade Dance augments Dodge, Answer the Blow brings the strike 2 gaps sooner with a medium weapon.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fit, forcedRng, makeVillage, place, beside } from '../harness';
import { effectiveSkill, hasPerk, ruleset } from '../../src/ruleset';
import { syncPerkLinks } from '../../src/ruleset/perkLinks';
import { strikeBackAllowed, strikeBackLimit } from '../../src/engine/resolve';
import { defaultStandingDefense } from '../../src/ruleset/gear';
import { CONFIG } from '../../src/config';
import type { Actor, AttackResult, GameState } from '../../src/types';
import { intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';
import { CL } from '../../src/library/classIds';
import { waysOut } from '../../src/plan/where';

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
  beside(s, 'patron_1');
  hold(npc(s, 'patron_1'), [IT.dagger]);
  hold(s.player, [IT.arming_sword]);
  s.player.core.skills[SK.parry] = { raw: 100, state: 'normal' };
  npc(s, 'patron_1').core.skills[SK.melee_light] = { raw: 40, state: 'normal' };
  s.player.core.standingDefense = 'parry';
  return s;
};

describe('153 Parry', () => {
  afterEach(() => vi.restoreAllMocks());

  it('the parry table: harsher failures, a partial turn at +1, a full stop (clean) from +2 and a strike back from +3', () => {
    const s = setup();
    const seen = new Set<number>();
    for (const r of swings(s)) {
      if (r.outcome === 'missed') continue;
      expect(r.defenseType).toBe('parry');
      const g = Math.max(-5, Math.min(5, r.gap!));
      seen.add(g);
      expect(r.multiplier).toBe(CONFIG.GAP_LADDER.parry[g]);
      if (g >= CONFIG.CLEAN_GAP) expect(r.outcome).toBe('parried');
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
    s.player.zone = s.zones.find((z) => waysOut(s, z.id).length && z.id !== p.zone && waysOut(s, p.zone).some((l) => l.to === z.id))?.id ?? s.player.zone;
    const shot = ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'patron_1_h0', targetPart: null, aimed: false }, s, forcedRng([90, 50, 50, 50]));
    expect(shot.defenseType).toBe('block');
    hold(s.player, [IT.arming_sword]);
    expect(ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'patron_1_h0', targetPart: null, aimed: false }, s, forcedRng([90, 50, 50, 50])).defenseType).toBe('dodge');
  });

  it('Deflect (Parry 20, LG1): with a melee weapon in hand a shot can be parried, never answered with a strike back', () => {
    const s = setup();
    s.player.core.standingDefense = 'parry';
    const p = npc(s, 'patron_1');
    hold(p, [IT.shortbow]);
    s.player.zone = s.zones.find((z) => waysOut(s, z.id).length && z.id !== p.zone && waysOut(s, p.zone).some((l) => l.to === z.id))?.id ?? s.player.zone;
    hold(s.player, [IT.arming_sword]);
    const shoot = (d: number) => ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'patron_1_h0', targetPart: null, aimed: false }, s, forcedRng([60, d, 50, 50]));
    expect(shoot(100).defenseType).toBe('dodge'); // without the perk: no parry against a missile
    give(s.player, PK.deflect);
    for (const d of DICE) {
      const r = shoot(d);
      expect(r.defenseType).toBe('parry');
      expect(r.strikeBack).toBeFalsy();
    }
    hold(s.player, []); // no weapon in hand: nothing to deflect with
    expect(shoot(100).defenseType).toBe('dodge');
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

  /** the player throws a strike and Flurry's free strike in one round, and patron_1 parries both cleanly; who swung at whom */
  const parriedTwice = (perks: string[]) => {
    const s = setup();
    const p = npc(s, 'patron_1');
    hold(p, [IT.arming_sword]);
    p.core.skills[SK.parry] = { raw: 30, state: 'normal' };
    p.core.standingDefense = 'parry';
    for (const k of perks) give(p, k);
    syncPerkLinks(p, 0);
    hold(s.player, []); // Flurry: every unarmed strike brings a free strike at once, in the same round
    give(s.player, PK.flurry);
    const calls: { by: string; at: string; weapon: string }[] = [];
    const real = ruleset.attack;
    vi.spyOn(ruleset, 'attack').mockImplementation((req, st) => {
      calls.push({ by: req.attackerId, at: req.targetId, weapon: req.weaponId });
      const r = real(req, st, forcedRng([50, 50, 50, 50]));
      // every attack on the patron is parried cleanly, and every strike back misses (this counts strikes, not wounds: the
      // player's armor and nerve stay out of it)
      return req.targetId === 'patron_1' ? { ...r, defenseType: 'parry', gap: 3, outcome: 'parried', multiplier: 0, damage: 0, location: null, strikeBack: true } as AttackResult
        : { ...r, outcome: 'missed', multiplier: 0, damage: 0, location: null } as AttackResult;
    });
    play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', skill: SK.unarmed_strike } }) });
    vi.restoreAllMocks();
    return { p, blows: calls.filter((c) => c.by === 'player'), backs: calls.filter((c) => c.by === 'patron_1') };
  };

  it('a strike back is a free melee attack with the parrying weapon, one per round by default (D-337)', () => {
    const { blows, backs } = parriedTwice([]);
    // a 6 s turn holds three strikes, each with Flurry's free strike, across two 3 s rounds: only the first of each round is
    // answered
    expect(blows.length).toBe(6);
    expect(backs).toEqual([0, 1].map(() => ({ by: 'patron_1', at: 'player', weapon: 'patron_1_h0' })));
  });

  it('Ceaseless Guard (Parry 100) raises the limit to 5, and with Every Answer merges into Endless Answer: no limit (D-337)', () => {
    const guard = parriedTwice([PK.ceaseless_guard]);
    expect(guard.backs.length).toBe(guard.blows.length); // two blows, both under 5
    const both = parriedTwice([PK.every_answer, PK.ceaseless_guard]);
    expect(hasPerk(both.p, PK.endless_answer)).toBe(true);
    expect(hasPerk(both.p, PK.every_answer) || hasPerk(both.p, PK.ceaseless_guard)).toBe(false); // merged: asleep
    expect(both.backs.length).toBe(both.blows.length);
    expect(strikeBackLimit(npc(setup(), 'patron_1'))).toBe(CONFIG.STRIKE_BACK_LIMIT);
    expect(strikeBackLimit(guard.p)).toBe(CONFIG.CEASELESS_GUARD_LIMIT);
    expect(strikeBackLimit(both.p)).toBe(Infinity);
  });

  it('Sharp Answer (Parry 40, LG2): the strike back after a parry, and only it, deals ×SHARP_ANSWER_MULT damage', () => {
    const s = setup();
    const p = npc(s, 'patron_1');
    hold(p, [IT.arming_sword]);
    p.core.standingDefense = 'parry';
    hold(s.player, []);
    const marked: boolean[] = [];
    const real = ruleset.attack;
    vi.spyOn(ruleset, 'attack').mockImplementation((req, st) => {
      const r = real(req, st, forcedRng([50, 50, 50, 50]));
      if (req.attackerId === 'patron_1') marked.push(!!req.context?.strikeBack);
      return req.targetId === 'patron_1' ? { ...r, defenseType: 'parry', gap: 3, outcome: 'parried', multiplier: 0, damage: 0, location: null, strikeBack: true } as AttackResult
        : { ...r, outcome: 'missed', multiplier: 0, damage: 0, location: null } as AttackResult;
    });
    play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', skill: SK.unarmed_strike } }) });
    vi.restoreAllMocks();
    expect(marked.length).toBeGreaterThan(0);
    expect(marked.every(Boolean)).toBe(true); // every blow back: the engine tells the attack it is a strike back
    s.player.core.inventory = s.player.core.inventory.filter((i) => !i.equippedIn?.includes('armor'));
    const blow = (back: boolean) => ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'patron_1_h0', targetPart: null, aimed: false, ...(back ? { context: { strikeBack: true } } : {}) }, s, forcedRng([95, 5, 50, 50])).damage;
    const plain = blow(true);
    expect(plain).toBeGreaterThan(0);
    give(p, PK.sharp_answer);
    expect(blow(true)).toBeCloseTo(plain * CONFIG.SHARP_ANSWER_MULT, 6);
    expect(blow(false)).toBeCloseTo(plain, 6); // any other blow: unchanged
  });

  it('Every Answer (Riposte 20) counts the limit per attacker; parry strike-backs and Counters count apart (D-337)', () => {
    const s = setup();
    const owner = npc(s, 'patron_1'), a = s.player, b = npc(s, 'guard_1');
    const ctx = () => ({ at: 1, strikeBacks: new Map<string, number>() }) as never;
    const plain = ctx();
    expect([strikeBackAllowed(plain, owner, a, 'parry'), strikeBackAllowed(plain, owner, b, 'parry'), strikeBackAllowed(plain, owner, a, 'counter')]).toEqual([true, false, true]);
    give(owner, PK.every_answer);
    const each = ctx();
    expect([strikeBackAllowed(each, owner, a, 'parry'), strikeBackAllowed(each, owner, b, 'parry'), strikeBackAllowed(each, owner, a, 'parry')]).toEqual([true, true, false]);
  });

  it('a strike back earns no strike back of its own, so two parriers never trade them forever (D-336, D-337)', () => {
    const s = setup();
    const p = npc(s, 'patron_1');
    hold(p, [IT.arming_sword]);
    p.core.skills[SK.parry] = { raw: 30, state: 'normal' };
    p.core.standingDefense = 'parry';
    const calls: { by: string; at: string }[] = [];
    const real = ruleset.attack;
    vi.spyOn(ruleset, 'attack').mockImplementation((req, st) => {
      calls.push({ by: req.attackerId, at: req.targetId });
      const r = real(req, st, forcedRng([50, 50, 50, 50]));
      // both sides parry every blow cleanly
      return { ...r, defenseType: 'parry', gap: 3, outcome: 'parried', multiplier: 0, damage: 0, location: null, strikeBack: true } as AttackResult;
    });
    play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', item: 'player_h0' } }) });
    expect(calls[0].by).toBe('player');
    expect(calls[1]).toEqual({ by: 'patron_1', at: 'player' }); // the patron's strike back ...
    expect(calls.length).toBeLessThan(12); // ... is parried and ends there: no endless exchange
  });

  it('Riposte adds its full value to Parry rolls, and Blade Dance to Dodge rolls', () => {
    const s = setup();
    const parry = effectiveSkill(s, s.player, SK.parry).value;
    const dodge = effectiveSkill(s, s.player, SK.dodge).value;
    s.player.core.skills[SK.riposte] = { raw: 20, state: 'normal' };
    s.player.core.skills[SK.blade_dance] = { raw: 15, state: 'normal' };
    s.player.core.classes.push({ classId: CL.sword_dancer, state: 'previous', level: 1 });
    for (const perkId of [PK.blade_against_blade, PK.first_steps_of_the_dance]) s.player.core.perks.push({ perkId, source: 'class', gainedTurn: 0 }); // the level 1 perks open Riposte and Blade Dance
    expect(effectiveSkill(s, s.player, SK.parry).value).toBeCloseTo(parry + 20);
    expect(effectiveSkill(s, s.player, SK.dodge).value).toBeCloseTo(dodge + 15);
  });

  it('the default defense: the highest usable of block, parry and dodge; the village guard blocks with its shield', () => {
    const s = setup();
    s.player.core.skills[SK.block] = { raw: 60, state: 'normal' };
    s.player.core.skills[SK.parry] = { raw: 40, state: 'normal' };
    expect(defaultStandingDefense(s, s.player)).toBe('parry'); // no shield, so Block can't be chosen
    hold(s.player, [IT.arming_sword, IT.round_shield]);
    expect(defaultStandingDefense(s, s.player)).toBe('block');
    expect(npc(makeVillage(), 'guard_1').core.standingDefense).toBe('block');
  });
});
