// BG-62: going over to talk to someone ends beside them, or on the player's side of a counter between them.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { talkMove } from '../../src/engine/merge';
import { EK } from '../../src/library/tableIds';
import { intent } from './w4-kit';
import { SK } from '../../src/library/skillIds';
import { CONFIG } from '../../src/config';
import { PARSER_INSTRUCTIONS } from '../../src/agents/prompts';

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

it('BG-74: talking to someone in view who would not hear the player clearly from here steps up to them first', () => {
  const s = village();
  CONFIG.HEARING_FLOOR_DB = 30; // a loud floor: a normal voice is clear to about 5.6 m
  const p = s.actors.find((a) => a.id === 'patron_1')!;
  p.zone = 'tav_common'; s.player.zone = 'tav_common';
  s.player.pos = { x: -3.5, y: -3.5 }; p.pos = { x: 3.5, y: 0.5 }; // 8.1 m: a normal voice is not clear
  expect(talkMove(s, { ...talk('patron_1', {}), move: null })).toMatchObject({ toZone: 'tav_common', spot: { near: 'patron_1' } });
  expect(talkMove(s, { ...talk('patron_1', {}), move: null, volume: 'shout' })).toBeNull(); // a shout carries
  p.pos = { x: -2.5, y: -3.5 }; // 1 m: clear
  expect(talkMove(s, { ...talk('patron_1', {}), move: null })).toBeNull();
});

it('BG-77: talking to someone beside you while going through a doorway to another room (following them in): the move stands', () => {
  const s = village();
  s.zones.find((x) => x.id === 'tav_common')!.edges!.n = EK.wall; // the counter zone is now through a doorway
  expect(talkMove(s, talk('patron_1', { toZone: 'tav_counter' }))).toMatchObject({ toZone: 'tav_counter' });
  expect(talkMove(s, talk('patron_1', { toZone: 'tav_counter', spot: { near: 'patron_1' } }))).toMatchObject({ toZone: 'tav_common', spot: { near: 'patron_1' } });
});

it('BG-78: buying from someone in view who would not hear the order clearly steps up to them first', () => {
  const s = village();
  CONFIG.HEARING_FLOOR_DB = 30; // a loud floor: a normal voice is clear to about 5.6 m
  const p = s.actors.find((a) => a.id === 'patron_1')!;
  p.zone = 'tav_common'; s.player.zone = 'tav_common';
  s.player.pos = { x: -3.5, y: -3.5 }; p.pos = { x: 3.5, y: 0.5 };
  const buy = intent({ action: { type: 'buy', target: 'patron_1', item: 'service:SV3' }, move: null as never });
  expect(talkMove(s, buy)).toMatchObject({ toZone: 'tav_common', spot: { near: 'patron_1' } });
});

it('BG-80: one approach rule for every actor: an NPC talking to the player from too far steps up the same way', async () => {
  const { approachMove } = await import('../../src/engine/merge');
  const s = village();
  CONFIG.HEARING_FLOOR_DB = 30; // a loud floor: a normal voice is clear to about 5.6 m
  const p = s.actors.find((a) => a.id === 'patron_1')!;
  p.zone = 'tav_common'; s.player.zone = 'tav_common';
  s.player.pos = { x: -3.5, y: -3.5 }; p.pos = { x: 3.5, y: 0.5 };
  expect(approachMove(s, p, { type: 'talk', target: s.player.id }, null)).toMatchObject({ toZone: 'tav_common', spot: { near: s.player.id } });
  expect(approachMove(s, p, { type: 'talk', target: s.player.id, volume: 'shout' }, null)).toBeNull();
});

it('FR2: handing something over is by grip reach in metres: over the counter from beside it, not from across the room', async () => {
  const { approachMove } = await import('../../src/engine/merge');
  const { giveItem, gripReachM } = await import('../../src/engine/gear');
  const s = village();
  s.player.zone = 'tav_common';
  const trader = s.actors.find((a) => a.id === 'trader')!; // behind the counter (tav_counter)
  trader.pos = { x: 0, y: 4.5 };
  expect(gripReachM(s, s.player)).toBe(0.7); // an arm, from the body type
  expect(approachMove(s, s.player, { type: 'give', target: 'trader' }, null)).toBeNull(); // closed in on when the give comes
  s.player.core.inventory.push({ id: 'coin_x', itemId: s.player.core.inventory[0]?.itemId ?? 'IT1' } as never);
  s.player.pos = { x: 0, y: -3 }; // 7.5 m away across the room
  expect(giveItem(s, s.player, 'coin_x', 'trader')).toBeNull();
  s.player.pos = { x: 0, y: 3.5 }; // at the counter: 1 m over it, within both arms (1.4 m)
  expect(giveItem(s, s.player, 'coin_x', 'trader')).not.toBeNull();
  expect(trader.core.inventory.some((i) => i.id === 'coin_x')).toBe(true);
});

it('BG-158: from behind the counter, coming out to someone in the room crosses it only with behind (the Parser sets it)', () => {
  const s = village();
  s.player.zone = 'tav_counter';
  expect(talkMove(s, talk('patron_1', { toZone: 'tav_common', spot: { near: 'patron_1' } }))).toMatchObject({ toZone: 'tav_counter', spot: { near: 'tav_common' } });
  expect(talkMove(s, talk('patron_1', { toZone: 'tav_common', spot: { near: 'patron_1' }, behind: true }))).toMatchObject({ toZone: 'tav_common', spot: { near: 'patron_1' } });
  expect(PARSER_INSTRUCTIONS).toContain('or out from behind it');
});
