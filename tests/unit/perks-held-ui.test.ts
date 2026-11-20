// BG-331: the Perks tile counts every perk the character holds, so the Perks board must show every one of them. A class
// perk (and any other perk on no ladder: a Start's blessing, an achievement's, a Threadbound item's, an All-step's,
// Hollowed) was counted on the tile but drawn nowhere on the board.
import { describe, expect, it } from 'vitest';
import { wholeTurn, intent } from '../harness/turn';
import { PK } from '../../src/library/perkIds';
import { grantedPerks, heldPerks, treesOf } from '../../src/ui/perks';
import { getLibrary } from '../../src/library';
import { milestoneState } from '../../src/ruleset';

describe('Perks board: every perk the tile counts is shown', () => {
  it('whole turn: a class perk is counted on the tile and listed under Granted', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!;
    s.player.core.perks.push({ perkId: PK.blade_against_blade, source: 'class', gainedTurn: s.turn });
    await g.turn(intent(), 'I look around');
    const p = g.game.state()!.player;
    expect(heldPerks(p).map((o) => o.perkId)).toContain(PK.blade_against_blade);
    expect(grantedPerks(p).map((v) => [v.def.name, v.from])).toContainEqual(['Blade Against Blade', 'Class']);
  });

  it('each counted perk is on a ladder, in Linked or in Granted, and never in two of them', () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const p = g.game.state()!.player, lib = getLibrary();
    const ladder = Object.values(lib.perks).find((d) => d.ladder && treesOf(p).some((t) => t.skills.includes(d.ladder!.skill)))!;
    p.core.perks.push({ perkId: PK.blade_against_blade, source: 'class', gainedTurn: 0 },
      { perkId: PK.hollowed, source: 'inflicted', gainedTurn: 0 },
      { perkId: ladder.id, source: 'level', gainedTurn: 0 });
    const granted = new Set(grantedPerks(p).map((v) => v.def.id));
    for (const o of heldPerks(p)) {
      const d = lib.perks[o.perkId];
      const onLadder = !!d?.ladder && milestoneState(p, d.ladder.skill, d.ladder.milestone) === 'own' && treesOf(p).some((t) => t.skills.includes(d.ladder!.skill));
      const places = [onLadder, o.source === 'link', granted.has(o.perkId)].filter(Boolean).length;
      expect(places, o.perkId).toBe(1);
    }
    expect(granted.has(ladder.id)).toBe(false);
  });
});
