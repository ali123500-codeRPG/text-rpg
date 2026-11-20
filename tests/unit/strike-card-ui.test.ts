// The hit cards (PS-200): the turn's line lists every blow that landed with the player in it, whom, with what and what the
// player saw it change; only what the player perceives (the combat packet), never hidden state or a raw id.
import { describe, expect, it } from 'vitest';
import { wholeTurn, intent } from '../harness/turn';
import { place } from '../harness';
import { SK } from '../../src/library/skillIds';

describe('the hit cards', () => {
  it('whole turn: the player\'s blow at a leg lands and the line carries it, in words', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
    place(g.game.state()!, 'patron_1', 'tav_common');
    g.game.state()!.player.core.skills[SK.melee_medium] = { raw: 300, state: 'normal' }; // so the blow lands
    const atk = { type: 'attack' as const, skill: SK.melee_medium, target: 'patron_1', targetPart: 'right_leg', item: null, mode: null, approach: '' };
    await g.turn(intent({ action: atk }), 'I hit the patron in the right leg');
    const line = g.game.lines().filter((l) => l.kind === 'narration').at(-1)!;
    const k = line.hits?.[0];
    expect(k?.mine).toBe(true);
    expect(k!.target).not.toBe('patron_1'); // a name or label, never an id
    expect(k!.result).toMatch(/hit|grazed/);
    expect('weapon' in k!).toBe(true);
    // BG-334: a body part reaches the screen as words, never as its id
    const shown = JSON.stringify([line.check?.result, line.hits, line.changes?.map((c) => c.text)]);
    expect(shown).toContain('right leg');
    expect(shown).not.toMatch(/\b[a-z]+_[a-z]+\b/);
  });
});
