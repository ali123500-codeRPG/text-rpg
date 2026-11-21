// BG-62: going over to talk to someone ends beside them, or on the player's side of a counter between them.
import { expect, it } from 'vitest';
import { makeVillage, COUNTER_SHAPE } from '../harness';
import { talkMove } from '../../src/engine/merge';
import { WK } from '../../src/library/tableIds';
import { intent } from './w4-kit';
import { SK } from '../../src/library/skillIds';
import { CONFIG } from '../../src/config';

const village = (counter = true) => makeVillage({ without: ['slime_1', 'slime_2'],
  shape: counter ? COUNTER_SHAPE : { ...COUNTER_SHAPE, tav_common: { ...COUNTER_SHAPE.tav_common, walls: { n: WK.wall, e: WK.wall, s: WK.wall, w: WK.wall } } } });
const talk = (target: string, move: object) => intent({ action: { type: 'talk', skill: SK.persuasion, target }, spoken: 'Hello.', addressees: [target], move: move as never });

it('BG-62/BG-158: going over to talk ends beside them in the player\'s own zone, never another; across a counter on the player\'s side, either way, unless they go behind', () => {
  const s = village();
  expect(talkMove(s, talk('patron_1', { toZone: 'tav_counter', spot: { near: 'tav_common' } }))).toMatchObject({ toZone: 'tav_common', spot: { near: 'patron_1' } });
  expect(talkMove(s, talk('trader', { toZone: 'tav_counter', spot: { near: 'trader' } }))).toMatchObject({ toZone: 'tav_common', spot: { near: 'tav_counter' } });
  expect(talkMove(s, talk('trader', { toZone: 'tav_counter', behind: true }))).toMatchObject({ toZone: 'tav_counter' });
  // BG-158: from behind the counter, coming out to someone in the room crosses it only with behind (the Parser sets it)
  s.player.zone = 'tav_counter';
  expect(talkMove(s, talk('patron_1', { toZone: 'tav_common', spot: { near: 'patron_1' } }))).toMatchObject({ toZone: 'tav_counter', spot: { near: 'tav_common' } });
  expect(talkMove(s, talk('patron_1', { toZone: 'tav_common', spot: { near: 'patron_1' }, behind: true }))).toMatchObject({ toZone: 'tav_common', spot: { near: 'patron_1' } });
});

it('BG-62/BG-77: a doorway is walked through (only a counter, fence or rail keeps the player on their side), also following someone beside you into another room', () => {
  const s = village(false); // the counter zone is now through a doorway
  expect(talkMove(s, talk('trader', { toZone: 'tav_counter' }))).toMatchObject({ toZone: 'tav_counter' });
  expect(talkMove(s, { ...talk('trader', { toZone: 'tav_counter' }), move: null })).toBeNull();
  expect(talkMove(s, talk('patron_1', { toZone: 'tav_counter' }))).toMatchObject({ toZone: 'tav_counter' });
  expect(talkMove(s, talk('patron_1', { toZone: 'tav_counter', spot: { near: 'patron_1' } }))).toMatchObject({ toZone: 'tav_common', spot: { near: 'patron_1' } });
});

it('BG-74/78/80: one approach rule: talking or buying from someone in view who would not hear clearly steps up first, and so does an NPC talking to the player', async () => {
  const { approachMove } = await import('../../src/engine/merge');
  const s = village();
  CONFIG.HEARING_FLOOR_DB = 30; // a loud floor: a normal voice is clear to about 5.6 m
  const p = s.actors.find((a) => a.id === 'patron_1')!;
  p.zone = 'tav_common'; s.player.zone = 'tav_common';
  s.player.pos = { x: -3.5, y: -3.5 }; p.pos = { x: 3.5, y: 0.5 }; // 8.1 m: a normal voice is not clear
  expect(talkMove(s, { ...talk('patron_1', {}), move: null })).toMatchObject({ toZone: 'tav_common', spot: { near: 'patron_1' } });
  expect(talkMove(s, { ...talk('patron_1', {}), move: null, volume: 'shout' })).toBeNull(); // a shout carries
  expect(talkMove(s, intent({ action: { type: 'buy', target: 'patron_1', item: 'service:SV3' }, move: null as never }))).toMatchObject({ toZone: 'tav_common', spot: { near: 'patron_1' } });
  expect(approachMove(s, p, { type: 'talk', target: s.player.id }, null)).toMatchObject({ toZone: 'tav_common', spot: { near: s.player.id } });
  expect(approachMove(s, p, { type: 'talk', target: s.player.id, volume: 'shout' }, null)).toBeNull();
  p.pos = { x: -2.5, y: -3.5 }; // 1 m: clear
  expect(talkMove(s, { ...talk('patron_1', {}), move: null })).toBeNull();
});



it('FR2: handing something over is by grip reach in metres: over the counter from beside it, not from across the room', async () => {
  const { approachMove } = await import('../../src/engine/merge');
  const { giveItem, gripReachM } = await import('../../src/engine/gear');
  const s = village();
  s.player.zone = 'tav_common';
  const trader = s.actors.find((a) => a.id === 'trader')!; // behind the counter (tav_counter)
  trader.pos = { x: 0, y: 4.5 };
  expect(gripReachM(s, s.player)).toBe(0.625); // an arm, from the body type
  expect(approachMove(s, s.player, { type: 'give', target: 'trader' }, null)).toBeNull(); // closed in on when the give comes
  s.player.core.inventory.push({ id: 'coin_x', itemId: s.player.core.inventory[0]?.itemId ?? 'IT1' } as never);
  s.player.pos = { x: 0, y: -3 }; // 7.5 m away across the room
  expect(giveItem(s, s.player, 'coin_x', 'trader')).toBeNull();
  s.player.pos = { x: 0, y: 3.5 }; // at the counter: 1 m over it, within both arms (1.4 m)
  expect(giveItem(s, s.player, 'coin_x', 'trader')).not.toBeNull();
  expect(trader.core.inventory.some((i) => i.id === 'coin_x')).toBe(true);
});

