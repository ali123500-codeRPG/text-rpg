// AT11a on the play screen: the long actions the player saw each turn (LogLine.actions), in game seconds and minutes, and
// BG-182: no screen code may sit inside a line comment (the Who's here row lost every name that way).
import { describe, expect, it } from 'vitest';
import { secsText, doneShare } from '../../src/ui/doing';
import { actionNotes, type DoingSnap } from '../../src/agents/game';
import { makeVillage } from '../harness';

const snap = (rows: [string, string, { what: string; done: number; left: number }?][]): DoingSnap =>
  new Map(rows.map(([id, who, doing]) => [id, { who, ...(doing ? { doing } : {}) }]));

describe('AT11a long actions on the play screen', () => {
  it('times read in seconds and minutes only', () => {
    expect([secsText(0), secsText(40), secsText(60), secsText(90), secsText(125.4)]).toEqual(['0 s', '40 s', '1 min', '1 min 30 s', '2 min 5 s']);
    expect(doneShare({ done: 10, left: 30 })).toBe(0.25);
    expect(doneShare({ done: 0, left: 0 })).toBe(1);
  });

  it('an action seen going on ends as done, broken off or set aside; one out of sight after the turn is left out', () => {
    const s = makeVillage();
    s.log.push({ turn: s.turn, code: 'busy_broken', detail: { actorId: 'b' } }, { turn: s.turn, code: 'busy_set_aside', detail: { actorId: 'c' } });
    const bandage = { what: 'Bandage', done: 15, left: 25 };
    const before = snap([['player', 'You', bandage], ['a', 'Hild', { what: 'Span a crossbow', done: 6, left: 6 }], ['b', 'Osk', bandage], ['c', 'Mara', bandage], ['d', 'Tam', bandage]]);
    const after = snap([['player', 'You', { what: 'Bandage', done: 30, left: 10 }], ['a', 'Hild'], ['b', 'Osk'], ['c', 'Mara', { what: 'Pick a lock', done: 3, left: 27 }], ['e', 'Ivo', { what: 'Bandage', done: 5, left: 35 }]]);
    expect(actionNotes(s, before, after)).toEqual([
      { who: 'You', what: 'Bandage', done: 30, left: 10, state: 'going' },
      { who: 'Hild', what: 'Span a crossbow', done: 12, left: 0, state: 'done' },
      { who: 'Osk', what: 'Bandage', done: 15, left: 25, state: 'broken' },
      { who: 'Mara', what: 'Bandage', done: 15, left: 25, state: 'stopped' },
      { who: 'Mara', what: 'Pick a lock', done: 3, left: 27, state: 'going' },
      { who: 'Ivo', what: 'Bandage', done: 5, left: 35, state: 'going' },
    ]); // Tam left full sight: nothing said about them
  });

});

