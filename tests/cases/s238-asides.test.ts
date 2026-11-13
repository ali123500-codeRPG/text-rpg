// 238 Asides (OA1, OA3; playtest cases A1–A5). Outside a fight, words said beside a deed (a buy, a give, a knock) are
// heard and answered this same turn, and the deed is still done; an attack's words stay a bark. Words for someone last
// seen in the zone the player walks into are said once there, not put off.
import { expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { fillSpeech, quickWord, resolveSpeech, selectSpokespeople } from '../../src/engine';
import type { AcceptedAgentOutput } from '../../src/engine';
import { buildPlayerView } from '../../src/views';
import { checkParserLegality } from '../../src/agents/legality';
import { actorById } from '../../src/engine/relations';
import { act, intent, play } from './w4-kit';
import { SV } from '../../src/library/serviceIds';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';

it('238a a question said while buying is answered this turn, and the buy still happens', () => {
  const s = makeVillage({ playerZone: 'tav_counter' });
  const mags = actorById(s, 'trader')!;
  mags.wares = { items: [], services: [SV.drink] };
  s.player.core.inventory.push({ id: 'purse', itemId: IT.coin, qty: 20 });
  // the words name no one: they are for the seller (fillSpeech)
  const i = fillSpeech(s, intent({ action: { type: 'buy', target: 'trader', item: `service:${SV.drink}` }, spoken: 'Who does Harl work for?' }), '');
  expect(i.addressees).toEqual(['trader']);
  expect(quickWord(s, i)).toBe(true);
  const spokespeople = selectSpokespeople(s, i);
  expect(spokespeople).toEqual(['trader']);
  const exchange = resolveSpeech(s, i, spokespeople, createRng(5));
  const reply = { agent: 'voice', actorId: 'trader', output: { action: act('give', 'player'), line: 'The miller, last I heard.', volume: 'normal', shares: [], gear: null, stance: null, routine: null } } as AcceptedAgentOutput;
  const ev = play(s, { intent: i, spokespeople, exchange, quickWord: true, agentOutputs: [reply] });
  const said = ev.filter((e) => e.kind === 'speak' && !e.bark).map((e) => [e.actorId, e.line?.text]);
  expect(said).toEqual([['player', 'Who does Harl work for?'], ['trader', 'The miller, last I heard.']]);
  expect(ev.some((e) => e.kind === 'buy' && e.actorId === 'player')).toBe(true);
  expect(ev.filter((e) => e.bark).length).toBe(0); // the line is said once, not again as a bark on the buy
});

it('238b an attack\'s words stay a bark; in a fight a line beside a deed still needs Quick Word', () => {
  const s = makeVillage();
  const hit = intent({ action: { type: 'attack', skill: SK.unarmed_strike, target: 'patron_1' }, spoken: 'Take that!', addressees: ['patron_1'] });
  expect(quickWord(s, hit)).toBe(false);
  const give = intent({ action: { type: 'give', target: 'patron_1', item: 'x' }, spoken: 'Here, for the trouble.', addressees: ['patron_1'] });
  expect(quickWord(s, give)).toBe(true);
  s.mode = 'tactical';
  expect(quickWord(s, give)).toBe(false); // no Quick Word perk
});

it('238c walking in to ask someone last seen there is legal; asking them without going there is not', () => {
  const s = makeVillage({ playerZone: 'street_door' });
  const view = buildPlayerView(s);
  const wim = actorById(s, 'patron_1')!;
  view.lastSeen = [{ id: wim.id, name: 'Old Wim', zone: wim.zone }];
  view.actors = view.actors.filter((a) => a.id !== wim.id);
  const ask = (move: { toZone: string } | null) => checkParserLegality(intent({ move, action: { type: 'talk', target: wim.id }, spoken: 'Did you see the ring taken?', addressees: [wim.id] }), view).illegal;
  expect(ask({ toZone: wim.zone })).toEqual([]);
  expect(ask(null)).toContain(`action.target ${wim.id}`);
});

it('238d an aside with a walk: the player walks over first and speaks from there', () => {
  const s = makeVillage({ playerZone: 'tav_cellar' });
  const i = intent({ move: { toZone: 'tav_common' }, action: { type: 'observe', target: null }, spoken: 'Evening, Wim.', addressees: ['patron_1'] });
  expect(quickWord(s, i)).toBe(true);
  const spokespeople = selectSpokespeople(s, i);
  expect(spokespeople).toEqual(['patron_1']);
  const exchange = resolveSpeech(s, i, spokespeople, createRng(2));
  const ev = play(s, { intent: i, spokespeople, exchange, quickWord: true });
  const line = ev.find((e) => e.kind === 'speak' && e.actorId === 'player')!;
  expect(line.zone).toBe('tav_common');
  expect(s.player.zone).toBe('tav_common');
});
