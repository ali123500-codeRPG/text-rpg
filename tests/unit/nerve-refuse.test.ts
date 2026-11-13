// NB5: with a broken nerve, an attack is turned away before the turn runs: the game says why, nothing happens and no time
// passes. Anything else (walking, hiding, talking) still plays.
import { describe, expect, it } from 'vitest';
import { wholeTurn, intent } from '../harness/turn';
import { place } from '../harness';
import { setMoraleLost, moraleLevel } from '../../src/ruleset/morale';
import { SK } from '../../src/library/skillIds';
import { NERVE_REFUSED } from '../../src/agents/game';

describe('an attack with a broken nerve', () => {
  it('whole turn: the attack is refused before the turn and no time passes; a look still plays', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
    const s = g.game.state()!;
    place(s, 'patron_1', 'tav_common');
    setMoraleLost(s.player, 100);
    expect(moraleLevel(s.player)).toBe('broken');
    const turn = s.turn;
    const atk = { type: 'attack' as const, skill: SK.melee_medium, target: 'patron_1', targetPart: null, item: null, mode: null, approach: '', stance: 'normal' as const };
    await expect(g.turn(intent({ action: atk }), 'I hit the patron')).rejects.toThrow(/did not advance/); // the harness: no turn passed
    expect(g.game.state()!.turn).toBe(turn);
    expect(g.game.lines().at(-1)).toMatchObject({ kind: 'clarify', text: NERVE_REFUSED });
    await g.turn(intent(), 'I look around');
    expect(g.game.state()!.turn).toBe(turn + 1);
  });
});
