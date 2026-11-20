// CU3 a: one move this fight turn counts the time carried over from the last, as the engine walks it, so an NPC counts a
// foe within strike that a plain turn's move would not reach (views withinStrike, read by code-run NPCs' target pick).
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { buildActorView } from '../../src/views';
import { slotMetres } from '../../src/engine/speed';
import { meleeReachM } from '../../src/ruleset/gear';

describe('406 carried fight time counts in one move (CU3 a)', () => {
  it('a foe just past a plain move and a blow is within strike once the NPC carries move time in', () => {
    const s = makeVillage({ playerZone: 'field_mid', without: ['slime_1', 'slime_2', 'patron_1'] });
    s.mode = 'tactical';
    const g = place(s, 'guard_1', 'field_mid');
    g.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'field_mid', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    const plain = slotMetres(s, g, 'move') + meleeReachM(s, g);
    g.pos = { x: s.player.pos!.x + plain + 1, y: s.player.pos!.y };
    expect(buildActorView(s, 'guard_1').self.withinStrike).toBeUndefined();
    g.carry = [{ main: 0, move: 3, turn: s.turn - 1 }];
    expect(buildActorView(s, 'guard_1').self.withinStrike).toEqual(['player']);
  });
});
