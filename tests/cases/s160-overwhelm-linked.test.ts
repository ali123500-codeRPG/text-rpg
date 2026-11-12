// 160 Overwhelm (MR2–MR4; Resolve 100) and linked perks. Any of the owner's auras that wins by 3 tiers or more against
// a target whose max morale is at most half the owner's breaks the target at once, and it surrenders. Linked perks: owning
// a set of perks grants one more ('grant') or merges the set into one ('merge'); Dread Presence + Overwhelm grant
// Crushing Presence, +5 true skill to every aura skill.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { getLibrary } from '../../src/library';
import { BUILT_PERKS } from '../../src/library/builtPerks';
import { PERK_LINKS } from '../../src/library/perkLinks';
import { AURA_SKILLS } from '../../src/library/auras';
import { hasPerk, trueSkill } from '../../src/ruleset/perks';
import { syncPerkLinks } from '../../src/ruleset/perkLinks';
import { maxMorale, moraleLevel } from '../../src/ruleset/morale';
import { overwhelms } from '../../src/engine/auras';
import { payFear } from '../../src/engine/morale';
import { createRng } from '../../src/rng';
import { buildNarrationView } from '../../src/views';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import { FR, LK } from '../../src/library/tableIds';
import type { Actor, ContestResult, GameState } from '../../src/types';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const drop = (a: Actor, perkId: string) => { a.core.perks = a.core.perks.filter((p) => p.perkId !== perkId); };
const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const resolve = (a: Actor, raw: number) => { a.core.skills[SK.resolve] = { raw, state: 'normal' }; };
const won = (gap: number) => ({ winner: 'a', gap: -gap }) as ContestResult;

describe('160 Overwhelm and linked perks', () => {
  it('Overwhelm is the Resolve 100 perk; Crushing Presence is a linked perk; both built', () => {
    expect(getLibrary().perks[PK.overwhelm]?.ladder).toEqual({ skill: SK.resolve, milestone: 100 });
    expect(getLibrary().perks[PK.crushing_presence]?.linked).toBe(true);
    expect(BUILT_PERKS.has(PK.overwhelm) && BUILT_PERKS.has(PK.crushing_presence)).toBe(true);
    expect(PERK_LINKS.find((l) => l.id === LK.crushing_presence)).toMatchObject({ needs: [PK.dread_presence, PK.overwhelm], kind: 'grant' });
    expect(AURA_SKILLS).toEqual([SK.intimidation]);
  });

  it('overwhelms only with the perk, a win by 3+ tiers and a target at half the owner\'s max morale or less', () => {
    const s = makeVillage();
    const foe = npc(s, 'patron_1');
    resolve(s.player, 100); // max morale 150
    resolve(foe, 0); // max morale 50
    expect(overwhelms(s.player, foe, won(4))).toBe(false); // no perk
    give(s.player, PK.overwhelm);
    expect(overwhelms(s.player, foe, won(3))).toBe(true);
    expect(overwhelms(s.player, foe, won(2))).toBe(false);
    resolve(foe, 30); // 80 > 75
    expect(maxMorale(foe)).toBeGreaterThan(maxMorale(s.player) / 2);
    expect(overwhelms(s.player, foe, won(5))).toBe(false);
  });

  it('an overwhelmed target loses all its morale and surrenders', () => {
    const s = makeVillage();
    const foe = npc(s, 'patron_1');
    expect(payFear(s, createRng(1), foe, FR.dread_presence, { gap: -3, overwhelm: true })).toBe('surrendered');
    expect(moraleLevel(foe)).toBe('broken');
  });

  it('in play: a Battle Cry from an Overwhelm owner makes a weak-willed foe give up', () => {
    let seen = false;
    for (let seed = 1; seed <= 40 && !seen; seed++) {
      const s = makeVillage();
      give(s.player, PK.battle_cry);
      give(s.player, PK.overwhelm);
      s.player.core.skills[SK.intimidation] = { raw: 140, state: 'normal' };
      resolve(s.player, 100);
      const foe = npc(s, 'patron_1');
      place(s, 'patron_1', s.player.zone);
      foe.mind!.overrides = { player: 'opposed' };
      resolve(foe, 0);
      const ev = play(s, { intent: intent({ perkMove: { perk: PK.battle_cry, target: null } } as never) }, seed);
      const roar = ev.find((e) => e.kind === 'battle_cry' && e.actorId === 'player')!;
      const f = roar.effects.find((x) => x.actorId === 'patron_1')!;
      if (!f.data.overwhelmed) continue;
      seen = true;
      expect(foe.mind!.moraleState).toBe('surrendered');
      expect(buildNarrationView(s, [roar]).events.find((x) => x.id === roar.id)?.changes?.join(' ')).toMatch(/overwhelmed by .*roar and gives up/);
    }
    expect(seen).toBe(true);
  });

  it('linked grant: Dread Presence + Overwhelm give Crushing Presence, +5 true skill to aura skills only, while both are owned', () => {
    const s = makeVillage();
    s.player.core.skills[SK.intimidation] = { raw: 100, state: 'normal' };
    s.player.core.skills[SK.persuasion] = { raw: 40, state: 'normal' };
    give(s.player, PK.dread_presence);
    syncPerkLinks(s.player, 0);
    expect(hasPerk(s.player, PK.crushing_presence)).toBe(false);
    const intim = trueSkill(s.player, SK.intimidation), pers = trueSkill(s.player, SK.persuasion);
    give(s.player, PK.overwhelm);
    syncPerkLinks(s.player, 0);
    expect(s.player.core.perks.find((p) => p.perkId === PK.crushing_presence)?.source).toBe('link');
    expect(hasPerk(s.player, PK.dread_presence)).toBe(true); // a grant keeps the set
    expect(trueSkill(s.player, SK.intimidation)).toBe(intim + 5);
    expect(trueSkill(s.player, SK.persuasion)).toBe(pers);
    drop(s.player, PK.overwhelm);
    syncPerkLinks(s.player, 1);
    expect(hasPerk(s.player, PK.crushing_presence)).toBe(false);
  });

  it('linked merge: the set goes dormant and the merged perk replaces it; undone when the set breaks', () => {
    const row = { id: 'LK_test', needs: [PK.dread_presence, PK.overwhelm], kind: 'merge' as const, perk: PK.battle_cry };
    PERK_LINKS.push(row);
    try {
      const s = makeVillage();
      give(s.player, PK.dread_presence);
      give(s.player, PK.overwhelm);
      syncPerkLinks(s.player, 0);
      expect(hasPerk(s.player, PK.battle_cry)).toBe(true);
      expect(hasPerk(s.player, PK.dread_presence)).toBe(false);
      expect(hasPerk(s.player, PK.overwhelm)).toBe(false);
      syncPerkLinks(s.player, 1); // stable: merged inputs still count for the link
      expect(hasPerk(s.player, PK.battle_cry)).toBe(true);
      drop(s.player, PK.overwhelm);
      syncPerkLinks(s.player, 2);
      expect(hasPerk(s.player, PK.battle_cry)).toBe(false);
      expect(hasPerk(s.player, PK.dread_presence)).toBe(true);
    } finally { PERK_LINKS.splice(PERK_LINKS.indexOf(row), 1); }
  });
});
