// 293 D-259 link rows LR1-LR5 and D-272 personality nudges PN1-PN6. Four grants: Ghost Blade (Hidden Strike on a
// suspicious target, once per target a fight), Combination (One-Two's mark +2), Blind Spot (Melt Away with no cover while a
// foe is blinded by Dirt in the Eyes), Bulwark (Cover Ally covers melee too). Perks with an attitude and current classes move
// one axis by ACH_PERSONALITY_STEP; a dormant perk adds none.
import { describe, expect, it } from 'vitest';
import type { Actor, AttackResult, GameState } from '../../src/types';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { CONFIG } from '../../src/config';
import { getLibrary } from '../../src/library';
import { PERK_LINKS } from '../../src/library/perkLinks';
import { BUILT_PERKS } from '../../src/library/builtPerks';
import { PK } from '../../src/library/perkIds';
import { PA } from '../../src/library/tableIds';
import { CL } from '../../src/library/classIds';
import { SK } from '../../src/library/skillIds';
import { actorById, zoneById } from '../../src/engine/relations';
import { afterAttack, coverFor, markShifts, markUntilNextTurn } from '../../src/engine/perkMarks';
import { syncPerkLinks } from '../../src/ruleset/perkLinks';
import { personalityOf } from '../../src/ruleset/personality';
import { trueSkill } from '../../src/ruleset/perks';
import { checkParserLegality } from '../../src/agents/legality';
import { buildPlayerView } from '../../src/views';

const give = (a: Actor, ...perks: string[]) => { for (const perkId of perks) a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 }); };
const owns = (a: Actor, perkId: string) => a.core.perks.some((p) => p.perkId === perkId);
/** the patron, hostile to the player, beside it in the common room */
const fight = (status: 'suspicious' | 'aware'): GameState => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  const m = actorById(s, 'patron_1')!.mind!;
  m.overrides = { player: 'hostile' };
  m.knowledge.player = { status, lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  return s;
};
const shifts = (s: GameState) => play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1' } }) })
  .filter((e) => e.actorId === 'player' && e.kind === 'attack').flatMap((e) => e.attack?.attack.tierShifts ?? []).map((x) => x.source);

describe('293 link rows and personality nudges', () => {
  it('LR1-LR5: four grant rows; each perk comes with its pair and leaves with it', () => {
    makeVillage();
    const rows = PERK_LINKS.filter((l) => [PK.ghost_blade, PK.combination, PK.blind_spot, PK.bulwark].includes(l.perk as never));
    expect(rows.map((l) => l.kind)).toEqual(['grant', 'grant', 'grant', 'grant']);
    for (const l of rows) expect(BUILT_PERKS.has(l.perk) && getLibrary().perks[l.perk]?.linked).toBe(true);
    const s = makeVillage();
    give(s.player, PK.shield_wall, PK.cover_ally);
    syncPerkLinks(s.player, 0);
    expect(owns(s.player, PK.bulwark)).toBe(true);
    s.player.core.perks = s.player.core.perks.filter((p) => p.perkId !== PK.shield_wall);
    syncPerkLinks(s.player, 0);
    expect(owns(s.player, PK.bulwark)).toBe(false);
  });

  it('LR1 Ghost Blade: Hidden Strike lands on a suspicious target, once per target per engagement; not on an aware one', () => {
    const s = fight('suspicious');
    give(s.player, PK.hidden_strike, PK.strike_and_fade, PK.ghost_blade);
    expect(shifts(s)).toContain('Ghost Blade');
    actorById(s, 'patron_1')!.mind!.knowledge.player.status = 'suspicious';
    expect(shifts(s)).not.toContain('Ghost Blade');
    const a = fight('aware');
    give(a.player, PK.hidden_strike, PK.strike_and_fade, PK.ghost_blade);
    expect(shifts(a)).not.toContain('Ghost Blade');
    const n = fight('suspicious'); // without the link
    give(n.player, PK.hidden_strike, PK.strike_and_fade);
    expect(shifts(n)).not.toContain('Ghost Blade');
  });

  it('LR2 Combination: the mark One-Two\'s free Strike leaves gives +2; any other Strike\'s mark +1', () => {
    const run = (oneTwo: boolean, link: boolean) => {
      const s = fight('aware');
      const t = actorById(s, 'patron_1')!;
      give(s.player, PK.set_them_up, PK.one_two, ...(link ? [PK.combination] : []));
      const r = { attack: { tierShifts: [] }, gap: null } as unknown as AttackResult;
      afterAttack(s, s.player, t, r, false, SK.unarmed_strike, oneTwo);
      return markShifts(s, s.player, t, false, SK.unarmed_improvised).attack.find((x) => x.source === 'Set Them Up')?.value;
    };
    expect(run(true, true)).toBe(2);
    expect(run(false, true)).toBe(1);
    expect(run(true, false)).toBe(1);
  });

  it('LR3 Blind Spot: with a foe blinded by Dirt in the Eyes, Melt Away works in a bare, bright zone', () => {
    const run = (dirt: boolean) => {
      const s = makeVillage({ playerZone: 'tav_counter' });
      zoneById(s, 'tav_counter')!.cover = 'none';
      give(s.player, PK.dirt_in_the_eyes, PK.melt_away, PK.blind_spot);
      const foe = place(s, 'patron_1', 'tav_counter');
      foe.mind!.overrides = { player: 'hostile' };
      if (dirt) markUntilNextTurn(s, foe, PK.dirt_in_the_eyes);
      const i = intent({ action: { type: 'vanish' } });
      const legal = checkParserLegality(i, buildPlayerView(s)).illegal;
      const ev = play(s, { intent: i });
      return { legal, vanished: ev.some((e) => e.actorId === 'player' && e.kind === 'hide' && e.vanish) };
    };
    expect(run(false).legal).toContain('action.vanish');
    const r = run(true);
    expect(r.legal).not.toContain('action.vanish');
    expect(r.vanished).toBe(true);
  });

  it('LR4 Bulwark: Cover Ally covers a melee attack on a friend too', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    const ally = place(s, 'patron_1', s.player.zone);
    ally.pos = { x: s.player.pos!.x + 0.5, y: s.player.pos!.y };
    s.bands.find((b) => b.id === 'player_band')!.relations.tavern_folk = 'friendly';
    s.bands.find((b) => b.id === 'tavern_folk')!.relations.player_band = 'friendly';
    s.player.core.standingDefense = 'block';
    ally.core.standingDefense = 'dodge';
    ally.core.skills[SK.dodge] = { raw: 5, state: 'normal' };
    give(s.player, PK.cover_ally);
    expect(coverFor(s, ally)?.id).toBe('player');
    expect(coverFor(s, ally, false)).toBeUndefined();
    give(s.player, PK.bulwark);
    expect(coverFor(s, ally, false)?.id).toBe('player');
  });

  it('PN1/PN4/PN5: attitude perks and current classes move one axis by the step; others none', () => {
    const s = makeVillage();
    const p = s.player;
    p.core.personality = { nerve: 0, traits: {}, values: [] };
    p.core.classes = [];
    give(p, PK.bluff, PK.dread_presence, PK.hidden_strike);
    expect(personalityOf(p).traits).toEqual({ [PA.honesty]: -CONFIG.ACH_PERSONALITY_STEP, [PA.pride]: CONFIG.ACH_PERSONALITY_STEP });
    const lib = getLibrary();
    expect([lib.classes[CL.swordsman].personality, lib.classes[CL.a_nobody].personality])
      .toEqual([{ [PA.discipline]: CONFIG.ACH_PERSONALITY_STEP }, { [PA.pride]: -CONFIG.ACH_PERSONALITY_STEP }]);
    expect(lib.classes[CL.commoner].personality).toBeUndefined();
    for (const id of [PK.takes_one_to_know_one, PK.battle_cry, PK.cover_ally, PK.quick_study, PK.curiouser]) expect(lib.perks[id].personality, id).toBeDefined();
  });

  it('PN6: a dormant perk adds no points', () => {
    const s = makeVillage();
    const p = s.player;
    p.core.personality = { nerve: 0, traits: {}, values: [] };
    give(p, PK.bluff);
    p.core.perks.find((x) => x.perkId === PK.bluff)!.dormant = true;
    expect(personalityOf(p).traits[PA.honesty] ?? 0).toBe(0);
  });

  it('SH1-SH4/SH7: a 120 perk adds 5% of its skill (not +5), and +1 and 1% of it to its group; shares read flat skill and add in full (RN3)', () => {
    const s = makeVillage();
    const p = s.player;
    p.core.skills[SK.stamina] = { raw: 200, state: 'normal' };
    const flat = trueSkill(p, SK.stamina);
    give(p, PK.bottomless);
    // own: 5% and the group's 1% (Stamina is alone in its group), both in full; and the +1
    const f = flat + 1;
    expect(trueSkill(p, SK.stamina)).toBeCloseTo(f + CONFIG.HIGH_PERK_SHARE * f + CONFIG.HIGH_PERK_SPREAD * f);
    expect(getLibrary().perks[PK.bottomless].trueSkill).toBeUndefined();
    expect(getLibrary().perks[PK.deep_lungs].trueSkill).toBe(5); // the 80 stays flat (SH3)
  });
});
