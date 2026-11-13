// FT17 on screen: Who's here shows how worn out someone looks only from Exhausted down, as the level word; Tired or
// Weary shows nothing, and no points or breath line ever reach the screen.
import { describe, expect, it } from 'vitest';
import { buildPlayerView } from '../../src/views';
import { barMax } from '../../src/ruleset/fatigue';
import { wholeTurn, intent } from '../harness/turn';

describe("others' fatigue on Who's here", () => {
  it('whole turn: someone Exhausted shows the word; someone Tired shows nothing', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!;
    await g.turn(intent(), 'I look around');
    const seen = buildPlayerView(s).actors.filter((a) => a.level === 'full').map((a) => s.actors.find((x) => x.id === a.id)!).filter((a) => a.id !== s.player.id);
    expect(seen.length).toBeGreaterThanOrEqual(2);
    const [worn, tired] = seen;
    worn.core.condition.fatigue = { debt: barMax(worn) * 0.65, line: 0 };
    tired.core.condition.fatigue = { debt: barMax(tired) * 0.35, line: 0 };
    await g.turn(intent(), 'I look around');
    const pv = buildPlayerView(s);
    const v = (id: string) => pv.actors.find((a) => a.id === id)!;
    expect(v(worn.id).fatigue).toBe('Exhausted');
    expect(v(tired.id).fatigue).toBeUndefined();
    expect(JSON.stringify(pv.actors)).not.toMatch(/lineLeft|debt/);
  });
});
