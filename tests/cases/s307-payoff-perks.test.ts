// 307 CN1-CN7 payoff perks that count pieces (D-260). Perks carry theme tags (one table, any number per perk); a payoff
// perk counts owned perks with its tag, or quirks, whatever their source, each once (dormant ones too, for now: D-307).
// Its share is PAYOFF_SHARE × pieces^PAYOFF_EXP (RN4). Patient Knife (Combat
// Stealth 100): Combat Stealth augments attack rolls made while stealthy. Protagonist Mentality (Resolve 140): Resolve
// augments its own rolls, by quirks owned.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Actor, Intent, RollRequest } from '../../src/types';
import { createRng, makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { getLibrary } from '../../src/library';
import { effectiveSkill, ruleset } from '../../src/ruleset';
import { payoffShare, themeCount, trueSkill } from '../../src/ruleset/perks';
import { tierMult } from '../../src/ruleset/gear';
import { resolveTurn } from '../../src/engine';
import { BUILT_PERKS } from '../../src/library/builtPerks';
import { PERK_THEMES, themesOf } from '../../src/library/perkThemes';
import { SK } from '../../src/library/skillIds';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';
import { AM } from '../../src/library/tableIds';
import { auraReachM } from '../../src/engine/auras';

afterEach(() => vi.restoreAllMocks());
const give = (a: Actor, perkId: string, dormant = false) => a.core.perks.push({ perkId, source: 'mastery', gainedTurn: 0, ...(dormant ? { dormant } : {}) });
const knife = (a: Actor, s: ReturnType<typeof makeVillage>, when?: 'from_hiding') =>
  effectiveSkill(s, a, SK.melee_medium, { rollKind: 'hit', ...(when ? { when: [when] } : {}) }).gear.find((g) => g.source.includes('Patient Knife'))?.value ?? 0;

describe('307 payoff perks', () => {
  it('CN2: six themes, every member a real perk; CN5 the payoff perks sit on 100/140 ladder slots and are built', () => {
    makeVillage();
    const perks = getLibrary().perks;
    expect(Object.keys(PERK_THEMES)).toEqual(['ambush', 'counter', 'guard', 'shout', 'trick', 'shadow']);
    for (const ids of Object.values(PERK_THEMES)) for (const id of ids) expect(perks[id], id).toBeDefined();
    expect(themesOf(PK.battle_cry)).toEqual(['shout']);
    expect(perks[PK.patient_knife].ladder).toEqual({ skill: SK.combat_stealth, milestone: 100 });
    expect(perks[PK.protagonist_mentality].ladder).toEqual({ skill: SK.resolve, milestone: 140 });
    expect([BUILT_PERKS.has(PK.patient_knife), BUILT_PERKS.has(PK.protagonist_mentality)]).toEqual([true, true]);
  });

  it('CN3/CN4: pieces count once, any source, dormant too for now; the share is PAYOFF_SHARE × pieces^PAYOFF_EXP, no ceiling (RN4)', () => {
    const s = makeVillage();
    expect(themeCount(s.player, 'ambush')).toBe(0);
    give(s.player, PK.hidden_strike); give(s.player, PK.hidden_strike); give(s.player, PK.in_and_out, true);
    expect(themeCount(s.player, 'ambush')).toBe(2);
    give(s.player, PK.heavy_sleeper);
    expect(themeCount(s.player, 'quirk')).toBe(1);
    const p = CONFIG.PAYOFF_SHARE, e = CONFIG.PAYOFF_EXP;
    expect(payoffShare(0)).toBe(0);
    for (const n of [1, 2, 3, 5, 10]) expect(payoffShare(n)).toBeCloseTo(p * n ** e);
    expect(payoffShare(50)).toBeGreaterThan(payoffShare(10) + p); // keeps growing
  });

  it('CN6 Patient Knife: Combat Stealth augments an attack from hiding by its pieces, itself included; not in the open', () => {
    const s = makeVillage();
    s.player.core.skills[SK.combat_stealth] = { raw: 100, state: 'normal' };
    give(s.player, PK.patient_knife);
    const one = trueSkill(s.player, SK.combat_stealth) * payoffShare(1) * tierMult(SK.combat_stealth);
    expect(knife(s.player, s, 'from_hiding')).toBeCloseTo(one); // it is an ambush piece itself
    give(s.player, PK.hidden_strike); give(s.player, PK.opening_strike);
    const want = trueSkill(s.player, SK.combat_stealth) * payoffShare(3) * tierMult(SK.combat_stealth);
    expect(knife(s.player, s, 'from_hiding')).toBeCloseTo(want);
    expect(knife(s.player, s)).toBe(0);
  });

  it('CN6: a stealthy attacker\'s hit roll carries from_hiding; an open one\'s does not', () => {
    const hit = (stealthy: boolean) => {
      const s = makeVillage({ playerZone: 'field_mid', without: ['guard_1', 'trader', 'patron_1', 'slime_2'] });
      if (stealthy) s.player.posture = 'stealthy';
      const seen: RollRequest[] = [];
      const real = ruleset.roll;
      vi.spyOn(ruleset, 'roll').mockImplementation((req, st, rng) => { seen.push(req); return real(req, st, rng); });
      const intent: Intent = { move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
        action: { type: 'attack', skill: SK.melee_medium, target: 'slime_1', targetPart: null, item: `player_${IT.arming_sword}_1`, mode: AM.cut, approach: 'a cut', stance: 'normal' } };
      resolveTurn(s, { intent, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(s.rngState));
      vi.restoreAllMocks();
      return seen.find((r) => r.rollKind === 'hit' && r.actorId === s.player.id)?.when;
    };
    expect(hit(true)).toEqual(['from_hiding']);
    expect(hit(false)).toBeUndefined();
  });

  it('CN7 Protagonist Mentality: Resolve rolls add Resolve × the share of quirks owned', () => {
    const s = makeVillage();
    s.player.core.skills[SK.resolve] = { raw: 140, state: 'normal' };
    const base = effectiveSkill(s, s.player, SK.resolve).value;
    give(s.player, PK.protagonist_mentality);
    expect(effectiveSkill(s, s.player, SK.resolve).value).toBeCloseTo(base);
    give(s.player, PK.heavy_sleeper); give(s.player, PK.insomniac);
    expect(effectiveSkill(s, s.player, SK.resolve).value).toBeCloseTo(base + trueSkill(s.player, SK.resolve) * payoffShare(2) * tierMult(SK.resolve));
  });
  it('CN8 Chorus (Intimidation 120, with the 120 boosts): each shout piece adds 1 m of aura reach and grows the base reach by the payoff share', () => {
    const s = makeVillage();
    const def = getLibrary().perks[PK.chorus];
    expect(def.ladder).toEqual({ skill: SK.intimidation, milestone: 120 });
    expect([def.shareOwn, def.shareGroup, def.functionBoost]).toEqual([CONFIG.HIGH_PERK_SHARE, CONFIG.HIGH_PERK_SPREAD, 1]);
    expect(themesOf(PK.chorus)).toEqual(['shout']);
    expect(auraReachM(s.player)).toBe(CONFIG.AURA_REACH_M);
    give(s.player, PK.chorus);
    expect(auraReachM(s.player)).toBeCloseTo(CONFIG.AURA_REACH_M * (1 + payoffShare(1)) + CONFIG.CHORUS_REACH_M);
    give(s.player, PK.dread_presence); give(s.player, PK.battle_cry);
    expect(auraReachM(s.player)).toBeCloseTo(CONFIG.AURA_REACH_M * (1 + payoffShare(3)) + 3 * CONFIG.CHORUS_REACH_M);
  });
});
