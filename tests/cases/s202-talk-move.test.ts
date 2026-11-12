// BG-62: going over to talk to someone ends beside them, or on the player's side of a counter between them.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { talkMove } from '../../src/engine/merge';
import { EK } from '../../src/library/tableIds';
import { intent } from './w4-kit';
import { SK } from '../../src/library/skillIds';

const village = () => {
  const s = makeVillage({ without: ['slime_1', 'slime_2'] });
  const z = (id: string) => s.zones.find((x) => x.id === id)!;
  z('tav_common').rect = { x: 0, y: 0, w: 8, d: 8 }; z('tav_common').edges = { n: EK.low, e: EK.wall, s: EK.wall, w: EK.wall };
  z('tav_counter').rect = { x: 0, y: 5.5, w: 3, d: 3 }; z('tav_counter').edges = { n: EK.wall, e: EK.wall, s: EK.low, w: EK.wall };
  return s;
};
const talk = (target: string, move: object) => intent({ action: { type: 'talk', skill: SK.persuasion, target }, spoken: 'Hello.', addressees: [target], move: move as never });

it('BG-62: someone in the player\'s own zone: a spot beside them, never another zone', () => {
  const s = village();
  expect(talkMove(s, talk('patron_1', { toZone: 'tav_counter', spot: { near: 'tav_common' } }))).toMatchObject({ toZone: 'tav_common', spot: { near: 'patron_1' } });
});

it('BG-62: someone behind a counter: the player\'s side of it, unless the player goes behind', () => {
  const s = village();
  expect(talkMove(s, talk('trader', { toZone: 'tav_counter', spot: { near: 'trader' } }))).toMatchObject({ toZone: 'tav_common', spot: { near: 'tav_counter' } });
  expect(talkMove(s, talk('trader', { toZone: 'tav_counter', behind: true }))).toMatchObject({ toZone: 'tav_counter' });
});

it('BG-62: a doorway is walked through: only a counter, fence or rail keeps the player on their side', () => {
  const s = village();
  s.zones.find((x) => x.id === 'tav_common')!.edges!.n = EK.wall;
  expect(talkMove(s, talk('trader', { toZone: 'tav_counter' }))).toMatchObject({ toZone: 'tav_counter' });
  expect(talkMove(s, { ...talk('trader', { toZone: 'tav_counter' }), move: null })).toBeNull();
});
