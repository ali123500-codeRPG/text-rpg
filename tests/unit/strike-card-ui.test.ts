// The strike card: the player's own attack line carries whom it struck, with what, and what the player saw it change,
// for the card on Play; only what the player perceives (the combat packet), never hidden state.
import { describe, expect, it } from 'vitest';
import { wholeTurn, intent } from '../harness/turn';
import { place } from '../harness';
import { SK } from '../../src/library/skillIds';

describe('the strike card', () => {
  it('whole turn: the player attacks someone next to them and the line carries the strike', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
    place(g.game.state()!, 'patron_1', 'tav_common');
    const atk = { type: 'attack' as const, skill: SK.melee_medium, target: 'patron_1', targetPart: null, item: null, mode: null, approach: '', stance: 'normal' as const };
    await g.turn(intent({ action: atk }), 'I hit the patron');
    const line = g.game.lines().filter((l) => l.kind === 'narration').at(-1)!;
    expect(line.check?.kind).toBe('attack');
    const k = line.check!.strike!;
    expect(k.target.length).toBeGreaterThan(0);
    expect(k.target).not.toBe('patron_1'); // a name or label, never an id
    expect(Array.isArray(k.changes)).toBe(true);
    expect('weapon' in k).toBe(true);
  });
});
