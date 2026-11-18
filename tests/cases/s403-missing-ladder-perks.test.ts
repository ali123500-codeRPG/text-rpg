// 403 Missing 20 and 40 perks, round 2 (LG1-LG22, D-395; BG-254: the ladder gate stays, the gaps get perks). Deflect and
// In the Thick of It are tested beside parry (s153) and slipping away (s117). Here: where each perk sits, Unseen Strike's
// awareness table, Deep Reserves on the three bars, Fear Bites Deeper, Hear Me Out, Deeper Soak and Grit Your Teeth.
import { describe, expect, it } from 'vitest';
import type { Actor, ContestResult, GameState, RollResult } from '../../src/types';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { CONFIG } from '../../src/config';
import { getLibrary } from '../../src/library';
import { BUILT_PERKS } from '../../src/library/builtPerks';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';
import { awarenessMod, blowDamage } from '../../src/ruleset';
import { resolveMode } from '../../src/ruleset/gear';
import { PERK_MOVES } from '../../src/ruleset/perks';
import { maxMorale, moraleLost } from '../../src/ruleset/morale';
import { totalHp } from '../../src/ruleset/body';
import { barMax } from '../../src/ruleset/fatigue';
import { equipArmor } from '../../src/engine/gear';
import { perkMoveBlock } from '../../src/engine/perkMoves';
import { fearMult } from '../../src/engine/auras';
import { actorById } from '../../src/engine/relations';
import { landed, tiersToConvince } from '../../src/engine/offer';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const npc = (s: GameState, id: string) => actorById(s, id)!;
const set = (a: Actor, sk: string, raw: number) => { a.core.skills[sk] = { raw, state: 'normal' } as never; };

describe('403 missing 20 and 40 perks', () => {
  it('each sits on its skill\'s ladder at its milestone, and is built', () => {
    makeVillage();
    const perks = getLibrary().perks;
    for (const [id, sk, m] of [
      [PK.deflect, SK.parry, 20], [PK.grit_your_teeth, SK.resolve, 20], [PK.hear_me_out, SK.persuasion, 20],
      [PK.guarded_answer, SK.riposte, 40], [PK.dancers_feet, SK.blade_dance, 40], [PK.deep_reserves, SK.resolve, 40],
      [PK.silver_tongue, SK.persuasion, 40], [PK.unseen_strike, SK.combat_stealth, 40], [PK.fear_bites_deeper, SK.intimidation, 40],
      [PK.shadow_work, SK.sneaking, 40], [PK.thick_of_it, SK.vanishing, 40], [PK.free_movement, SK.light_armor, 40],
      [PK.deeper_soak, SK.heavy_armor, 40], [PK.honest_face, SK.lying, 40],
    ] as const) {
      expect(perks[id]?.ladder, id).toEqual({ skill: sk, milestone: m });
      expect(BUILT_PERKS.has(id), id).toBe(true);
    }
  });

  it('LG11 Unseen Strike: awareness defense is one table; the perk moves unaware to −20 and suspicious to −10', () => {
    const s = makeVillage(), a = s.player;
    expect(awarenessMod(a, undefined)).toBeUndefined();
    expect(awarenessMod(a, 'suspicious')).toBeUndefined(); // step 0: no change
    expect(awarenessMod(a, 'unaware')?.value).toBe(-10);
    give(a, PK.unseen_strike);
    expect(awarenessMod(a, 'suspicious')?.value).toBe(-10);
    expect(awarenessMod(a, 'unaware')?.value).toBe(-20);
  });

  it('LG8 Deep Reserves: Endurance, Stamina and Resolve count ×1.2 toward health, stamina and morale', () => {
    const grows = (perk: boolean, sk: string, bar: (s: GameState, a: Actor) => number) => {
      const s = makeVillage(), a = s.player;
      if (perk) give(a, PK.deep_reserves);
      set(a, sk, 0);
      const lo = bar(s, a);
      set(a, sk, 50);
      return bar(s, a) - lo;
    };
    for (const [sk, bar] of [[SK.endurance, (s: GameState, a: Actor) => totalHp(s, a)], [SK.stamina, (_: GameState, a: Actor) => barMax(a)], [SK.resolve, (_: GameState, a: Actor) => maxMorale(a)]] as const) {
      expect(grows(false, sk, bar), sk).toBeGreaterThan(0);
      expect(grows(true, sk, bar), sk).toBeCloseTo(CONFIG.DEEP_RESERVES_MULT * grows(false, sk, bar), 6);
    }
  });

  it('LG12 Fear Bites Deeper: a Battle Cry costs the foe ×1.2 the morale', () => {
    expect(fearMult(makeVillage().player)).toBe(1);
    const lost = (perk: boolean) => {
      const s = makeVillage();
      give(s.player, PK.battle_cry);
      if (perk) give(s.player, PK.fear_bites_deeper);
      set(s.player, SK.intimidation, perk ? 135 : 140); // the 40 perk's own +5 true skill would change the contest
      const foe = npc(s, 'patron_1');
      place(s, 'patron_1', s.player.zone);
      foe.mind!.overrides = { player: 'opposed' };
      set(foe, SK.resolve, 0);
      const ev = play(s, { intent: intent({ perkMove: { perk: PK.battle_cry, target: null } } as never) }, 1);
      expect(ev.find((e) => e.kind === 'battle_cry')!.effects.find((f) => f.actorId === 'patron_1')?.kind).toBe('cry_took');
      return moraleLost(foe);
    };
    expect(lost(false)).toBeGreaterThan(0);
    expect(lost(true)).toBeCloseTo(CONFIG.FEAR_BITES_MULT * lost(false), 6);
  });

  it('LG9 Hear Me Out: to the owner\'s persuasion offers a fresh foe counts as shaken; not to another skill', () => {
    const s = makeVillage(), foe = npc(s, 'patron_1');
    const roll = (actorId: string, skill: string) => ({ actorId, skill, tier: 'success', margin: 0 }) as unknown as RollResult;
    const won = (by: number, skill: string): ContestResult => ({ a: roll('player', skill), b: roll('patron_1', SK.insight), gap: -by, winner: 'a' });
    expect(tiersToConvince(foe)).toBe(CONFIG.OFFER_WIN_TIERS);
    expect(landed(won(CONFIG.OFFER_WIN_TIERS_SHAKEN, SK.persuasion), foe, 'stand_down', s)).toBe('tempted');
    give(s.player, PK.hear_me_out);
    expect(landed(won(CONFIG.OFFER_WIN_TIERS_SHAKEN, SK.persuasion), foe, 'stand_down', s)).toBe('convinced');
    expect(landed(won(CONFIG.OFFER_WIN_TIERS_SHAKEN, SK.lying), foe, 'stand_down', s)).toBe('tempted');
  });

  it('LG18 Deeper Soak: worn heavy armor soaks ×1.5 flat; medium armor does not', () => {
    const dmg = (armor: string, perk: boolean) => {
      const s = makeVillage(), p = s.player, foe = npc(s, 'guard_1');
      p.core.inventory = p.core.inventory.filter((i) => !getLibrary().items[i.itemId]?.armor);
      p.core.inventory.push({ id: armor, itemId: armor });
      expect(equipArmor(s, p, armor)).toBe(true);
      if (perk) give(p, PK.deeper_soak);
      const weapon = foe.core.inventory.find((i) => i.itemId === IT.arming_sword)!;
      const { mode } = resolveMode(s, foe, weapon.id, undefined, 1);
      return blowDamage(s, foe, p, mode, 'general', 3, null).damage;
    };
    expect(dmg(IT.plate_harness, true)).toBeLessThan(dmg(IT.plate_harness, false));
    expect(dmg(IT.mail_hauberk, true)).toBe(dmg(IT.mail_hauberk, false));
  });

  it('LG7 Grit Your Teeth: steadying is a free move in a fight, and at Rattled it steadies itself at once, once a fight', () => {
    expect(PERK_MOVES[PK.grit_your_teeth]).toMatchObject({ free: true, untargeted: true });
    const steadies = (perk: boolean) => {
      const s = makeVillage();
      give(s.player, PK.battle_cry);
      set(s.player, SK.intimidation, 60);
      const foe = npc(s, 'patron_1');
      place(s, 'patron_1', s.player.zone);
      foe.mind!.overrides = { player: 'hostile' };
      foe.mind!.knowledge.player = { status: 'engaged', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
      set(foe, SK.resolve, 30);
      if (perk) give(foe, PK.grit_your_teeth);
      play(s, {}, 2); // the fight starts: the once-a-fight use is kept on the engagement
      foe.core.condition.moraleLost = 0.4 * maxMorale(foe); // Rattled: the roar's loss leaves it Rattled or worse
      const ev = play(s, { intent: intent({ perkMove: { perk: PK.battle_cry, target: null } } as never) }, 2);
      expect(ev.find((e) => e.kind === 'battle_cry')!.effects.find((f) => f.actorId === 'patron_1')?.kind).toBe('cry_took');
      if (perk) expect(perkMoveBlock(s, foe, PK.grit_your_teeth, null)).toBe('too_soon'); // it was a real steady: the cooldown runs
      return ev.filter((e) => e.kind === 'steady' && e.actorId === 'patron_1').length;
    };
    expect(steadies(false)).toBe(0);
    expect(steadies(true)).toBe(1);
  });
});
