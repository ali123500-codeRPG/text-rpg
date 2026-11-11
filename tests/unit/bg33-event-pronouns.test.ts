// BG-33: the Narrator called a cloth merchant "he": she had spoken this turn but was out of sight by its end, so she
// was not in the view's actors and her pronouns were nowhere. Events now carry their actor's and target's pronouns.
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage, actor } from '../harness';
import { buildNarrationView } from '../../src/views';

describe('BG-33 pronouns on events', () => {
  it('an event fully seen gives its actor\'s and target\'s pronouns', () => {
    const s = makeVillage();
    actor(s, 'trader').pronouns = 'she';
    actor(s, 'guard_1').pronouns = 'he';
    const e = { id: 't1.1', turn: s.turn, kind: 'speak', actorId: 'trader', target: 'guard_1', zone: actor(s, 'trader').zone, effects: [], noise: 'normal', visibility: 'normal',
      perception: { player: { level: 'full', cue: 'sight' } } } as unknown as GameEvent;
    actor(s, 'trader').zone = 'field_edge'; // gone from sight by the turn's end
    const ev = buildNarrationView(s, [e]).events[0];
    expect(ev.pronouns).toBe('she');
  });
});
