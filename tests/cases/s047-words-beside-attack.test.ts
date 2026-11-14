// 47 Words beside an attack: the words are a bark and no dialogue call runs. BF67: a bark is real speech, so only those who
// heard it get its words, and the one who said it finds it in its own "said" list (so it does not shout it again).
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { selectSpokespeople } from '../../src/engine';
import { buildActorView } from '../../src/views';
import { intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';

it('47 Words beside an attack', () => {
  const s = makeVillage({ playerZone: 'field_mid' });
  const words = 'Back, you foul ooze';
  const i = intent({ action: { type: 'attack', target: 'slime_1', skill: SK.melee_medium }, spoken: words, addressees: ['slime_1'] });
  expect(selectSpokespeople(s, i)).toEqual([]); // not a dialogue turn: no dialogue call
  const ev = play(s, { intent: i });
  const bark = ev.find((e) => e.actorId === 'player' && e.kind === 'attack')!;
  expect(bark).toMatchObject({ bark: true, line: { text: words } });
  // nobody but the player perceived it here: no NPC view holds the words
  for (const a of s.actors) expect(JSON.stringify(buildActorView(s, a.id))).not.toContain(words);
  // BF67: one who heard it gets the words; one who only saw it does not
  bark.perception.slime_2 = { level: 'full', cue: 'sound', heard: true };
  bark.perception.guard_1 = { level: 'full', cue: 'sight' };
  expect(JSON.stringify(buildActorView(s, 'slime_2').perceived)).toContain(words);
  expect(JSON.stringify(buildActorView(s, 'guard_1'))).not.toContain(words);
  // BF67: the one who barked sees the line in what it said
  const shout = 'Stand and fight';
  s.events.push({ ...bark, id: 't1.99', actorId: 'patron_1', line: { ...bark.line!, text: shout }, perception: {} });
  expect(buildActorView(s, 'patron_1').said).toContain(shout);
});
