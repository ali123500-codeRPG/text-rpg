// 47 Words beside an attack: the words are a bark, no dialogue call runs, and no NPC view contains them.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { selectSpokespeople } from '../../src/engine';
import { buildActorView } from '../../src/views';
import { intent, play } from './w4-kit';

it('47 Words beside an attack', () => {
  const s = makeVillage({ playerZone: 'field_mid' });
  const words = 'Back, you foul ooze';
  const i = intent({ action: { type: 'attack', target: 'slime_1', skill: 'melee_medium' }, spoken: words, addressees: ['slime_1'] });
  expect(selectSpokespeople(s, i)).toEqual([]); // not a dialogue turn: no dialogue call
  const ev = play(s, { intent: i });
  expect(ev.find((e) => e.actorId === 'player' && e.kind === 'attack')).toMatchObject({ bark: true, line: { text: words } });
  for (const a of s.actors) expect(JSON.stringify(buildActorView(s, a.id))).not.toContain(words);
});
