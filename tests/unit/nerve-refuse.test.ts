// NB5: with a broken nerve, an attack is turned away before the turn runs: the game says why, nothing happens and no time
// passes. Anything else (walking, hiding, talking) still plays.
import { describe, expect, it } from 'vitest';
import { wholeTurn, intent } from '../harness/turn';
import { place } from '../harness';
import { maxMorale, setMoraleLost, moraleLevel } from '../../src/ruleset/morale';
import { SK } from '../../src/library/skillIds';
import { NERVE_COWERING_REFUSED, NERVE_REFUSED } from '../../src/agents/game';
import { CONFIG } from '../../src/config';

describe('an attack with a broken nerve', () => {
  it('whole turn: the attack is refused before the turn and no time passes; a look still plays', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
    const s = g.game.state()!;
    place(s, 'patron_1', 'tav_common');
    setMoraleLost(s.player, maxMorale(s.player));
    expect(moraleLevel(s.player)).toBe('broken');
    const turn = s.turn;
    const atk = { type: 'attack' as const, skill: SK.melee_medium, target: 'patron_1', targetPart: null, item: null, mode: null, approach: '' };
    await expect(g.turn(intent({ action: atk }), 'I hit the patron')).rejects.toThrow(/did not advance/); // the harness: no turn passed
    expect(g.game.state()!.turn).toBe(turn);
    expect(g.game.lines().at(-1)).toMatchObject({ kind: 'clarify', text: NERVE_REFUSED });
    await g.turn(intent(), 'I look around');
    expect(g.game.state()!.turn).toBe(turn + 1);
  });
  it('whole turn (BF79): a walk toward a foe is refused before the turn; a walk away plays; at Cowering every walk is refused', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_2', 'guard_1'] });
    const s = g.game.state()!;
    const sl = place(s, 'slime_1', 'tav_counter');
    sl.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    setMoraleLost(s.player, maxMorale(s.player));
    const turn = s.turn;
    await expect(g.turn(intent({ move: { toZone: 'tav_counter' }, action: null }), 'I go behind the bar')).rejects.toThrow(/did not advance/);
    expect(g.game.lines().at(-1)).toMatchObject({ kind: 'clarify', text: NERVE_REFUSED });
    setMoraleLost(s.player, CONFIG.MORALE_COWER_AT * maxMorale(s.player));
    await expect(g.turn(intent({ move: { toZone: 'street_door' }, action: null }), 'I run out the door')).rejects.toThrow(/did not advance/);
    expect(g.game.lines().at(-1)).toMatchObject({ kind: 'clarify', text: NERVE_COWERING_REFUSED });
    setMoraleLost(s.player, maxMorale(s.player));
    await g.turn(intent({ move: { toZone: 'street_door' }, action: null }), 'I run out the door');
    expect(g.game.state()!.turn).toBe(turn + 1);
    expect(g.game.state()!.player.zone).toBe('street_door');
  });
});
