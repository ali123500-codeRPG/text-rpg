// Show rolls works on past turns too: every turn keeps its rolls on its story line whether the switch is on or off, and the
// switch only shows or hides them (the screen's no-rolls class).
import { describe, expect, it } from 'vitest';
import { wholeTurn, intent } from '../harness/turn';

describe('Show rolls, retroactively', () => {
  it('whole turn: a turn played with Show rolls off still keeps its rolls on its line', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    g.game.state()!.settings.showMechanics = false;
    await g.turn(intent({ action: { type: 'rest', skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance: 'normal' } }), 'I rest a while');
    const line = g.game.lines().filter((l) => l.kind === 'narration').at(-1)!;
    expect(line.mechanics?.length).toBeGreaterThan(0);
  });
});
