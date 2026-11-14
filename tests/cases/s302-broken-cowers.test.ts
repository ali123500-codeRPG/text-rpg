// BF37: a broken nerve blocks only walking (fleeing too, for now) and attacking. On turn 24 Wren broke, and the game threw
// away his give and made him flee instead (BG-201). Now a broken NPC keeps what its mind chose, less the walk and the
// attack, and with nothing allowed left it cowers where it stands; a broken player's walk and attack come to nothing while
// their words are heard.
import { expect, it } from 'vitest';
import { beside, makeVillage, place } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';
import { IT } from '../../src/library/itemIds';
import { maxMorale } from '../../src/ruleset/morale';

it('a broken NPC who chose to give and walk off holds it out and stays put', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const w = beside(s, 'patron_1', 'player', 1);
  w.mind!.moraleState = 'broken';
  w.core.inventory.push({ id: 'charm_1', itemId: IT.lucky_charm });
  const from = { zone: w.zone, pos: { ...w.pos! } };
  const ev = play(s, { agentOutputs: [plannerOut(w.id, act('give', 'player', { item: 'charm_1' }), { move: { toZone: 'street_door' } })] });
  expect(w.zone).toBe(from.zone);
  expect(w.pos).toEqual(from.pos);
  expect(ev.some((e) => e.actorId === w.id && e.kind === 'offer')).toBe(true);
});

it('a broken NPC with nothing allowed to do cowers where it stands, never flees', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const w = place(s, 'patron_1', 'tav_counter');
  w.mind!.overrides = { player: 'hostile' };
  w.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  w.mind!.moraleState = 'broken';
  const ev = play(s);
  expect(w.zone).toBe('tav_counter');
  expect(ev.find((e) => e.actorId === w.id)?.kind).not.toBe('flee');
});

it("a broken player's walk and attack come to nothing, and their words are heard", () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const w = beside(s, 'patron_1', 'player', 1);
  s.player.core.condition.moraleLost = maxMorale(s.player); // broken
  const at = { ...s.player.pos! };
  const ev = play(s, { intent: intent({ move: { toZone: 'street_door' }, action: { type: 'attack', target: w.id }, spoken: 'Stay back!', addressees: [w.id] }) });
  expect(s.player.zone).toBe('tav_common');
  expect(s.player.pos).toEqual(at);
  expect(ev.some((e) => e.actorId === s.player.id && e.kind === 'attack')).toBe(false);
  expect(ev.some((e) => e.actorId === s.player.id && e.line?.text === 'Stay back!')).toBe(true);
  expect(s.log.some((l) => l.code === 'broken_cowers')).toBe(true);
});
