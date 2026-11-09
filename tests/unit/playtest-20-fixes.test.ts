// Fixes from the 30-turn Unwritten Legend playtest: JSON with a full-width comma, "you say" in the fallback,
// the player's gear in the Narrator's view, and people last seen in the Parser's view.
import { describe, expect, it } from 'vitest';
import { makeVillage, actor } from '../harness';
import { parseTolerant, fallbackNarration } from '../../src/agents';
import { buildNarrationView, buildPlayerView } from '../../src/views';
import type { NarrationView } from '../../src/types';

describe('playtest run 20 fixes', () => {
  it('reads JSON with a full-width comma between values, and keeps one inside a string', () => {
    const r = parseTolerant('{"text":"a，b"，"narrated":["t1"]}');
    expect(r).toEqual({ ok: true, value: { text: 'a，b', narrated: ['t1'] } });
  });
  it('the fallback says "You say", not "You says"', () => {
    const view = { events: [{ id: 'e1', kind: 'speak', actor: 'player', level: 'full', cue: 'sight', line: { text: 'Hello', volume: 'normal' } }],
      surroundings: [], player: { zone: 'z' } } as unknown as NarrationView;
    expect(fallbackNarration(view).text).toContain('You say: "Hello"');
  });
  it('the Narrator sees all the gear the player character has', () => {
    const s = makeVillage();
    const gear = buildNarrationView(s, []).player.gear ?? [];
    expect(gear.length).toBe(s.player.core.inventory.length);
    expect(gear.some((g) => g.endsWith('(held)'))).toBe(true);
  });
  it('someone seen clearly who is out of sight now is listed with where they were last seen', () => {
    const s = makeVillage(), trader = actor(s, 'trader');
    s.player.journal!.clearSight = { trader: trader.zone };
    s.player.zone = 'field_far';
    const pv = buildPlayerView(s);
    expect(pv.actors.some((a) => a.id === 'trader')).toBe(false);
    expect(pv.lastSeen?.map((x) => x.id)).toContain('trader');
  });
});
