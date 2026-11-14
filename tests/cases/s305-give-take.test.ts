// 305 BF34: giving and taking are trades at no price. A give holds the item out (from hand, pack or the giver's own bag)
// and it changes hands only when the other side takes it, by the end of the next turn. A take is the taker's at once when
// the item is held out to them, or the owner yielded or surrendered, is down or asleep; anyone else refuses. BG-195: Wren
// gave the charm from his sack and nothing happened.
import { expect, it } from 'vitest';
import { beside, makeVillage } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';
import { IT } from '../../src/library/itemIds';
import { buildPlayerView } from '../../src/views';
import { ideas } from '../../src/ui/play';

const tavern = () => makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
const has = (a: { core: { inventory: { id: string; contents?: { id: string }[] }[] } }, id: string): boolean =>
  a.core.inventory.some((i) => i.id === id || has({ core: { inventory: i.contents ?? [] } }, id));

it('Wren holds the charm out from his sack; it stays his until the player takes it', () => {
  const s = tavern();
  const w = beside(s, 'patron_1', 'player', 1);
  w.core.inventory.push({ id: 'sack_1', itemId: IT.sack, contents: [{ id: 'charm_1', itemId: IT.lucky_charm }] });
  const ev = play(s, { agentOutputs: [plannerOut(w.id, act('give', 'player', { item: 'charm_1' }))] });
  expect(ev.some((e) => e.actorId === w.id && e.kind === 'offer')).toBe(true);
  expect(has(w, 'charm_1')).toBe(true);
  expect(has(s.player, 'charm_1')).toBe(false);
  expect(buildPlayerView(s).actors.find((a) => a.id === w.id)?.holdsOut?.item).toBe('charm_1');
  expect(ideas(buildPlayerView(s)).flatMap((g) => g.items.map((i) => i.text)).some((t) => /^Take the .+ from /.test(t))).toBe(true);
  play(s, { intent: intent({ action: { type: 'take', target: w.id, item: 'charm_1' } }) });
  expect(has(s.player, 'charm_1')).toBe(true);
  expect(has(w, 'charm_1')).toBe(false);
});

it('an offer not taken by the end of the next turn is withdrawn', () => {
  const s = tavern();
  const w = beside(s, 'patron_1', 'player', 1);
  w.core.inventory.push({ id: 'charm_1', itemId: IT.lucky_charm });
  play(s, { agentOutputs: [plannerOut(w.id, act('give', 'player', { item: 'charm_1' }))] });
  play(s);
  play(s);
  expect(w.offer).toBeUndefined();
  play(s, { intent: intent({ action: { type: 'take', target: w.id, item: 'charm_1' } }) });
  expect(has(w, 'charm_1')).toBe(true);
});

it('a take from a surrendered or downed man works at once; a man still standing refuses', () => {
  const s = tavern();
  const w = beside(s, 'patron_1', 'player', 1);
  w.core.inventory.push({ id: 'charm_1', itemId: IT.lucky_charm });
  const refused = play(s, { intent: intent({ action: { type: 'take', target: w.id, item: 'charm_1' } }) });
  expect(refused.some((e) => e.kind === 'take_refused')).toBe(true);
  expect(has(w, 'charm_1')).toBe(true);
  w.mind!.moraleState = 'surrendered';
  play(s, { intent: intent({ action: { type: 'take', target: w.id, item: 'charm_1' } }) });
  expect(has(s.player, 'charm_1')).toBe(true);

  const s2 = tavern();
  const d = beside(s2, 'patron_1', 'player', 1);
  d.core.inventory.push({ id: 'charm_2', itemId: IT.lucky_charm });
  d.core.condition.hpLostPct = 105; // down
  play(s2, { intent: intent({ action: { type: 'take', target: d.id, item: 'charm_2' } }) });
  expect(has(s2.player, 'charm_2')).toBe(true);
});

it('an NPC who is not set against the giver takes a gift held out to it at the end of the turn', () => {
  const s = tavern();
  const w = beside(s, 'patron_1', 'player', 1);
  s.player.core.inventory.push({ id: 'charm_1', itemId: IT.lucky_charm });
  play(s, { intent: intent({ action: { type: 'give', target: w.id, item: 'charm_1' } }) });
  expect(has(w, 'charm_1')).toBe(true);
  expect(has(s.player, 'charm_1')).toBe(false);
});
