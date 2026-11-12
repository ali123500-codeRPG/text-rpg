// run 24: a barter the Parser left with spoken and addressees null never reached the seller
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent } from '../cases/w4-kit';
import { fillSpeech, selectSpokespeople } from '../../src/engine';

it('a speech action with no words or listeners takes the player line and its target', () => {
  const s = makeVillage({ playerZone: 'tav_counter' });
  const bare = { ...intent({ action: { type: 'barter', target: 'trader' } }), spoken: null, addressees: null };
  expect(selectSpokespeople(s, bare)).toEqual([]);
  const filled = fillSpeech(s, bare, ' Can you do it for one copper? ');
  expect([filled.spoken, filled.addressees]).toEqual(['Can you do it for one copper?', ['trader']]);
  expect(selectSpokespeople(s, filled)).toEqual(['trader']);
  // words and listeners the Parser gave stand; non-speech actions are left alone
  const said = { ...bare, spoken: 'One copper?', addressees: ['everyone'] };
  expect(fillSpeech(s, said, 'x')).toEqual(said);
  const atk = { ...intent({ action: { type: 'attack', target: 'trader' } }), spoken: null, addressees: null };
  expect(fillSpeech(s, atk, 'x')).toBe(atk);
});

it('a plain talk with no words reaches the listener as an opening, never as the command text', () => {
  const s = makeVillage({ playerZone: 'tav_counter' });
  const bare = { ...intent({ action: { type: 'talk', target: 'trader' } }), spoken: null, addressees: null };
  const filled = fillSpeech(s, bare, 'I talk to the trader');
  expect([filled.spoken, filled.addressees]).toEqual([null, ['trader']]);
});

it('BG-46: words with no action are a talk to whoever they are for, so they are said', () => {
  const s = makeVillage({ playerZone: 'tav_counter' });
  const lone = { ...intent({}), action: null, spoken: "Hello? Who's there?", addressees: ['everyone'] };
  const filled = fillSpeech(s, lone, 'I call out');
  expect(filled.action).toMatchObject({ type: 'talk', target: null });
  expect(filled.addressees).toEqual(['everyone']);
  const named = fillSpeech(s, { ...lone, addressees: ['trader'] }, 'x');
  expect(named.action).toMatchObject({ type: 'talk', target: 'trader' });
  // no words: still a turn with no action
  expect(fillSpeech(s, { ...lone, spoken: null }, 'x').action).toBeNull();
});
