// 373 Never Flat-Footed (TC35 b, Battle Sense 100): a foe the owner has seen this fight can never catch it unaware.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { getLibrary } from '../../src/library';
import { BUILT_PERKS } from '../../src/library/builtPerks';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import { neverFlatFooted, noteSeen } from '../../src/engine/flatFooted';
import type { Actor, GameState } from '../../src/types';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const fight = (s: GameState, a: Actor, seen?: string[]) => { a.engagement = { start: s.turn, last: s.turn, kinds: ['fight'], ...(seen ? { seen } : {}) }; };

/** a hostile, code-run patron hiding beside the player, far stronger than the player's senses (a natural roll can still tie its ambush) */
function hiddenFoe(s: GameState): Actor {
  const patron = place(s, 'patron_1', s.player.zone);
  patron.mind!.overrides = { player: 'hostile' };
  patron.mind!.control = 'code';
  patron.mind!.knowledge.player = { status: 'engaged', source: 'seen', revealed: [], lastKnownZone: s.player.zone, lastSeenTurn: s.turn };
  for (const sk of Object.values(SK)) if (patron.core.skills[sk]) patron.core.skills[sk] = { raw: 200, state: 'normal' };
  for (const sk of [SK.unarmed_improvised, SK.sneaking, SK.combat_stealth]) patron.core.skills[sk] = { raw: 200, state: 'normal' }; // its template has no stealth skills
  patron.posture = 'stealthy';
  for (const sk of [SK.eyesight, SK.earshot]) s.player.core.skills[sk] = { raw: 0, state: 'normal' };
  s.player.journal!.stealthSeen = { patron_1: 'unaware' };
  return patron;
}

describe('373 Never Flat-Footed', () => {
  it('is built as the Battle Sense 100 perk', () => {
    expect(getLibrary().perks[PK.never_flat_footed]?.ladder).toEqual({ skill: SK.battle_sense, milestone: 100 });
    expect(BUILT_PERKS.has(PK.never_flat_footed)).toBe(true);
  });

  it('notes who the owner sees in a fight, only for owners of the perk', () => {
    const s = makeVillage();
    const patron = place(s, 'patron_1', s.player.zone);
    fight(s, s.player);
    noteSeen(s);
    expect(s.player.engagement!.seen).toBeUndefined(); // no perk, nothing kept
    give(s.player, PK.never_flat_footed);
    noteSeen(s);
    expect(s.player.engagement!.seen).toContain('patron_1');
    expect(neverFlatFooted(s.player, patron)).toBe(true);
    delete s.player.engagement; // out of a fight, nothing is remembered
    expect(neverFlatFooted(s.player, patron)).toBe(false);
  });

  it('a hidden foe the owner saw earlier in the fight lands no ambush; one never seen still does', async () => {
    const { play, intent } = await import('./w4-kit');
    const blow = (perk: boolean, seen: string[], seed: number) => {
      const s = makeVillage();
      hiddenFoe(s);
      if (perk) give(s.player, PK.never_flat_footed);
      fight(s, s.player, seen);
      return play(s, { intent: intent() }, seed).find((e) => e.kind === 'attack' && e.actorId === 'patron_1');
    };
    const seeds = [1, 2, 3, 4, 5];
    expect(seeds.some((n) => blow(false, ['patron_1'], n)?.attack?.unaware)).toBe(true); // without the perk: an ambush
    expect(seeds.some((n) => blow(true, [], n)?.attack?.unaware)).toBe(true); // with it, but never seen: still an ambush
    for (const n of seeds) {
      const b = blow(true, ['patron_1'], n);
      expect(b).toBeDefined();
      expect(b?.attack?.unaware).toBeUndefined(); // seen earlier in the fight: never an ambush, whatever the dice
    }
  }, 20000); // fifteen fresh villages
});
