// BF72 (BG-248): answering a question the game asked. A tapped name takes the place of the name the question was about,
// built from the first order (taps never pile up); a question that came with its own answers has no tappable names; and
// the Parser reads the answer beside its own question and the order it was about.
import { describe, expect, it } from 'vitest';
import { answerWith } from '../../src/ui/play';
import { answering } from '../../src/agents/answering';
import { sentText } from '../harness/scripted';
import { wholeTurn, intent } from '../harness/turn';
import type { LogLine } from '../../src/types';

const pv = { actors: [{ name: 'Osric Fell', label: 'an off-duty guard' }, { name: 'Corwin Ash', label: 'a red-faced drover' }, { label: 'a tall man' }],
  lastSeen: [{ name: 'Hob Mercer' }], zones: [{ name: 'the physic garden' }], zone: { groundItems: [], links: [] }, player: { inventory: [] } } as never;

describe('BF72: answering a question', () => {
  it('a tapped name replaces the one the order named, whole or by one of its words, and never piles up', () => {
    expect(answerWith('I attack hob', 'Osric Fell', pv)).toBe('I attack Osric Fell');
    expect(answerWith('I attack Hob Mercer hard', 'Osric Fell', pv)).toBe('I attack Osric Fell hard');
    expect(answerWith('I punch the tall man', 'Corwin Ash', pv)).toBe('I punch Corwin Ash');
    // no name the view knows: the answer follows the order
    expect(answerWith('I attack him.', 'Osric Fell', pv)).toBe('I attack him, I mean Osric Fell');
  });

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

  it('whole turn: the words after a question reach the Parser beside the question and the order it was about', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    g.claude.push('parser', intent({ action: null, clarify: 'Which one do you mean?' }));
    await g.game.submit('I punch the man', { aimed: false });
    await g.game.settle();
    expect(g.game.lines().at(-1)?.kind).toBe('clarify');
    expect(sentText(g.claude.callsFor('parser')[0])).not.toContain('ANSWERING:');
    await g.turn(intent(), 'the one by the door');
    const sent = sentText(g.claude.callsFor('parser')[1]);
    expect(sent).toContain('ANSWERING:\n{"yourQuestion":"Which one do you mean?","earlierOrder":"I punch the man"}');
    expect(sent).toContain('PLAYER_INPUT:\nthe one by the door');
  });
});
