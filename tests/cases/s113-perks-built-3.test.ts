// 113 Coded 20-milestone perks, batch 3: Open-Hand Guard (parry with empty hands; a hit through is
// split between the parrying arm and the general area) and Threaten for Answers (intimidation counts at full value
// against an opposed or hostile listener, and can win information).
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { resolveSpeech, selectSpokespeople } from '../../src/engine';
import { CONFIG } from '../../src/config';
import type { Actor, GameState } from '../../src/types';
import { intent } from './w4-kit';
import { SK } from '../../src/library/skillIds';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;

describe('113 coded perks, batch 3', () => {
  it('Open-Hand Guard: empty hands can parry, and a hit through lands half on the arm, half general', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    for (const i of wim.core.inventory) delete i.equippedIn;
    wim.core.standingDefense = 'parry';
    const req = { attackerId: 'player', targetId: 'patron_1', weaponId: `player_${IT.arming_sword}_1`, targetPart: null, aimed: false };
    const plain = ruleset.attack(req, s, forcedRng([60, 40, 50]));
    expect(plain.defenseType).toBe('dodge'); // no weapon: falls back to dodge
    give(wim, PK.open_hand_guard);
    const og = ruleset.attack(req, s, forcedRng([60, 40, 50]));
    expect(og.defenseType).toBe('parry');
    expect(og.damage).toBeGreaterThan(0);
    expect(og.locationHow).toBe('open_hand');
    expect(['right_arm', 'left_arm']).toContain(og.location);
    expect(og.generalShare).toBeGreaterThan(0);
    expect(og.generalShare).toBeLessThan(og.damage);
    const hpBefore = wim.core.condition.hpLostPct;
    ruleset.applyEffects(og, s);
    expect(wim.core.condition.parts[og.location!]).toBeLessThan(100);
    expect(wim.core.condition.hpLostPct).toBeGreaterThan(hpBefore);
    // holding a weapon or shield turns it off (the weapon parries)
    wim.core.inventory.push({ id: 'wim_club', itemId: IT.arming_sword, equippedIn: ['grip:right_arm'] });
    expect(ruleset.attack(req, s, forcedRng([60, 40, 50])).locationHow).not.toBe('open_hand');
    expect(CONFIG.OPEN_HAND_ARM_SHARE).toBe(0.5);
  });
  const setup = (stance: 'opposed' | 'hostile' | 'neutral') => {
    const s = makeVillage({ playerZone: 'tav_counter' });
    s.player.core.skills[SK.persuasion] = { ...s.player.core.skills[SK.persuasion], raw: 10 };
    s.player.core.skills[SK.intimidation] = { ...s.player.core.skills[SK.intimidation], raw: 60 };
    const t = npc(s, 'trader');
    t.mind = { ...t.mind, overrides: { ...t.mind?.overrides, player: stance } } as never;
    s.hidden.secrets.push({ id: 'informant', holderId: 'trader', fact: 'the captain is the informant', leakTerms: ['informant'],
      revealWhen: { type: 'check_passed', skill: SK.persuasion, minTier: 'success', againstActorId: 'trader' } });
    return s;
  };
  const talk = (s: GameState, type: 'persuade' | 'intimidate', dice: number[]) => {
    const i = intent({ action: { type, skill: type === 'intimidate' ? SK.intimidation : SK.persuasion }, spoken: 'Who sold us out?', addressees: ['trader'] });
    return resolveSpeech(s, i, selectSpokespeople(s, i), forcedRng(dice)).perSpokesperson.trader;
  };
  it('Threaten for Answers: intimidation counts at full value against an opposed listener', () => {
    const s = setup('opposed');
    const plain = talk(s, 'persuade', [50, 50]).contest.a;
    expect(plain.skill).toBe(SK.intimidation); // stand-in at 0.3 (18) beats persuasion 10
    give(s.player, PK.threaten_for_answers);
    delete s.player.speechTries; // a fresh try, not a repeat (NT3)
    const full = talk(s, 'persuade', [50, 50]).contest.a;
    expect(full.skill).toBe(SK.intimidation);
    expect(full.margin - plain.margin).toBeCloseTo(CONFIG.SKILL_WEIGHT * 60 * (1 - CONFIG.SUBSTITUTE_EFFICIENCY));
  });
  it('Threaten for Answers: a winning threat gets information a persuasion check guards', () => {
    const s = setup('hostile');
    expect(talk(s, 'intimidate', [100, 1]).slips).toEqual([]);
    give(s.player, PK.threaten_for_answers);
    expect(talk(s, 'intimidate', [100, 1]).slips).toEqual(['informant']);
  });
  it('Threaten for Answers: no effect on a neutral listener', () => {
    const s = setup('neutral');
    give(s.player, PK.threaten_for_answers);
    expect(talk(s, 'intimidate', [100, 1]).slips).toEqual([]);
    const a = talk(s, 'persuade', [50, 50]).contest.a;
    const s2 = setup('neutral');
    expect(talk(s2, 'persuade', [50, 50]).contest.a.margin).toBeCloseTo(a.margin);
  });
});
