// A clarifying question's names can be tapped: the people, places and things the player's view names, matched with or
// without articles, longest first, never overlapping.
import { describe, expect, it } from 'vitest';
import { clarifyPicks } from '../../src/ui/play';
import { buildPlayerView } from '../../src/views';
import { wholeTurn, intent } from '../harness/turn';

describe('tappable names in a clarifying question', () => {
  it('whole turn: the question the game asks back names someone in view, and that name is a pick', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    await g.turn(intent(), 'I look around');
    const guard = buildPlayerView(g.game.state()!).actors.find((a) => a.level === 'full')!;
    const who = (guard.name ?? guard.label).replace(/^an?\s+/i, 'the ');
    g.claude.push('parser', intent({ action: null, clarify: `Which man do you mean to punch: ${who} by the door? And where is the charm?` }));
    await g.game.submit('I punch the man', { aimed: false });
    await g.game.settle();
    const q = g.game.lines().at(-1)!;
    expect(q.kind).toBe('clarify');
    const picks = clarifyPicks(q.text, buildPlayerView(g.game.state()!));
    expect(picks.map((p) => p.phrase)).toContain(who);
    const p = picks.find((x) => x.phrase === who)!;
    expect(q.text.slice(p.start, p.end)).toBe(who);
  });

  it('articles inside a name differ, the longest name wins, and nothing overlaps', () => {
    const pv = { actors: [{ label: 'a lean man in a patched coat' }, { label: 'a man' }], zones: [{ name: 'midden yard' }], zone: { groundItems: [] }, player: { inventory: [{ name: 'charm' }] } } as never;
    const t = 'Which man do you mean: the lean man in the patched coat in the midden yard? Who has the charm?';
    expect(clarifyPicks(t, pv).map((p) => p.phrase)).toEqual(['man', 'the lean man in the patched coat', 'the midden yard', 'the charm']);
  });
});
