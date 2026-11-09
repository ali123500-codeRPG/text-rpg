// 112 Coded 20-milestone perks, batch 2: Turn the Blade, Hunter's Mark, Make Them Stumble (marks
// that outlast the attack) and Cover Ally (a friend takes a ranged attack in the target's place; switchable).
import { describe, expect, it } from 'vitest';
import { makeVillage, place, forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { afterAttack, coverFor, expireMarks, markShifts } from '../../src/engine/perkMarks';
import type { Actor, AttackResult, GameState } from '../../src/types';
import { SK } from '../../src/library/skillIds';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const result = (over: Partial<AttackResult>): AttackResult => ({
  attack: { tierShifts: [] } as never, defense: { tierShifts: [] } as never, defenseType: 'block', gap: 2, gapShifts: [], outcome: 'blocked', location: null, locationHow: null,
  multiplier: 0, damage: 0, attackerId: 'x', targetId: 'y', weaponId: 'w', modeId: 'm', deciding: { attack: [], defense: [], gap: [] }, ...over,
});

describe('112 coded perks, batch 2', () => {
  it('Turn the Blade: a clean weapon block opens the attacker; the next melee attack spends it', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    for (const i of s.player.core.inventory) if (i.itemId.includes('shield')) delete i.equippedIn; // block with the sword
    give(s.player, 'turn_the_blade');
    s.player.engagement = { start: 1, last: 1, kinds: ['fight'] };
    afterAttack(s, wim, s.player, result({ defenseType: 'block', gap: 1 }), false);
    expect(s.player.perkMarks).toBeUndefined(); // not clean enough
    afterAttack(s, wim, s.player, result({ defenseType: 'block', gap: 2 }), false);
    expect(s.player.perkMarks).toEqual([{ perk: 'turn_the_blade', target: 'patron_1' }]);
    expect(markShifts(s, s.player, wim, false).attack).toEqual([{ source: 'Turn the Blade', value: 1 }]);
    expect(markShifts(s, s.player, wim, true).attack).toEqual([]); // melee only
    const r = ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: 'player_arming_sword_1', targetPart: null, aimed: false }, s, forcedRng([50, 30, 20]));
    expect(r.attack.tierShifts).toContainEqual({ source: 'Turn the Blade', value: 1 });
    afterAttack(s, s.player, wim, r, false);
    expect(s.player.perkMarks).toBeUndefined(); // spent
  });
  it('Turn the Blade: a shield block does not count, and the opening ends with the engagement', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    give(s.player, 'turn_the_blade');
    afterAttack(s, wim, s.player, result({ defenseType: 'block', gap: 3 }), false);
    expect(s.player.perkMarks).toBeUndefined(); // the round shield made the block
    for (const i of s.player.core.inventory) if (i.itemId.includes('shield')) delete i.equippedIn;
    afterAttack(s, wim, s.player, result({ defenseType: 'block', gap: 3 }), false);
    expireMarks(s, s.player); // not engaged: gone
    expect(s.player.perkMarks).toBeUndefined();
  });
  it('Hunter’s Mark: a ranged hit marks the target for the next ranged attack', () => {
    const s = makeVillage();
    const slime = npc(s, 'slime_1');
    give(s.player, 'hunters_mark');
    afterAttack(s, s.player, slime, result({ outcome: 'dodged' }), true);
    expect(s.player.perkMarks).toBeUndefined();
    afterAttack(s, s.player, slime, result({ outcome: 'grazed' }), true);
    expect(markShifts(s, s.player, slime, true).attack).toEqual([{ source: 'Hunter’s Mark', value: 1 }]);
  });
  it('Make Them Stumble: a clean dodge makes the attacker’s next defense one tier worse, until the end of its next turn', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    give(s.player, 'make_them_stumble');
    afterAttack(s, wim, s.player, result({ defenseType: 'dodge', gap: 2, outcome: 'dodged' }), false);
    expect(markShifts(s, s.player, wim, false).defense).toEqual([{ source: 'Make Them Stumble', value: -1 }]);
    s.turn += 2;
    expect(markShifts(s, s.player, wim, false).defense).toEqual([]);
    expireMarks(s, wim);
    expect(wim.perkMarks).toBeUndefined();
  });
  it('Cover Ally: a better blocker friendly to the target takes the ranged attack; it can be switched off', () => {
    const s = makeVillage();
    const guard = npc(s, 'guard_1');
    place(s, 'player', guard.zone);
    s.bands.find((b) => b.id === 'player_band')!.relations.village_watch = 'friendly';
    s.bands.find((b) => b.id === 'village_watch')!.relations.player_band = 'friendly';
    s.player.core.standingDefense = 'block';
    guard.core.standingDefense = 'dodge';
    guard.core.skills[SK.dodge] = { raw: 5, state: 'normal' };
    expect(coverFor(s, guard)).toBeUndefined(); // no perk
    give(s.player, 'cover_ally');
    expect(coverFor(s, guard)?.id).toBe('player');
    s.player.core.perksOff = ['cover_ally'];
    expect(coverFor(s, guard)).toBeUndefined();
    s.player.core.perksOff = [];
    guard.core.skills[SK.dodge] = { raw: 200, state: 'normal' }; // the ally defends better on its own
    expect(coverFor(s, guard)).toBeUndefined();
  });
});
