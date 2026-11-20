// BF72 (BG-248): answering a question the game asked. A tapped name takes the place of the name the question was about,
// built from the first order (taps never pile up); a question that came with its own answers has no tappable names; and
// the Parser reads the answer beside its own question and the order it was about.
import { describe, expect, it } from 'vitest';
import { answering } from '../../src/agents/answering';
import type { LogLine } from '../../src/types';


describe('BF72: answering a question', () => {

  it('the order a question is about is the first order of its run, so a second answer is read against it', () => {
    const ls: LogLine[] = [
      { turn: 5, kind: 'narration', text: 'x' } as LogLine,
      { turn: 5, kind: 'player', text: 'I attack hob' },
      { turn: 5, kind: 'clarify', text: 'Hob is in the garden. Do you mean Osric Fell?' },
      { turn: 5, kind: 'player', text: 'I attack Osric Fell' },
      { turn: 5, kind: 'clarify', text: 'Osric or Corwin?' },
    ];
    expect(answering(ls, 5)).toEqual({ question: 'Osric or Corwin?', order: 'I attack hob' });
    expect(answering(ls.slice(0, 2), 5)).toBeNull(); // no question pending
    expect(answering(ls, 6)).toBeNull(); // a question from an earlier turn is not answered by a new order
  });

});
