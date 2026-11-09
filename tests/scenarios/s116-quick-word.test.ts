// 116 Quick Word (A15; trial perk; action economy AE7). In a fight, a one-sentence line said beside a
// non-speech action resolves as talk without using the action, and an NPC's spoken reply to it is free as well.
import { expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { quickWord, resolveSpeech, selectSpokespeople } from '../../src/engine';
import type { AcceptedAgentOutput } from '../../src/engine';
import type { Actor } from '../../src/types';
import { act, intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';
import { PK } from '../../src/library/perkIds';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });

it('116 Quick Word: the line and the reply are free; both actions still happen', () => {
  const s = makeVillage();
  const wim = s.actors.find((a) => a.id === 'patron_1')!;
  wim.zone = s.player.zone;
  s.mode = 'tactical';
  const i = intent({ action: { type: 'attack', skill: SK.unarmed_strike, target: wim.id }, spoken: 'Drop it and live!', addressees: [wim.id] });
  expect(quickWord(s, i)).toBe(false); // no perk: the line is a bark
  give(s.player, PK.quick_word);
  expect(quickWord(s, i)).toBe(true);
  expect(quickWord(s, { ...i, spoken: 'Drop it. Then run.' })).toBe(false); // one sentence only
  expect(quickWord(s, { ...i, action: { ...i.action!, type: 'talk' } })).toBe(false); // talk is the main action anyway
  s.mode = 'explore';
  expect(quickWord(s, i)).toBe(false); // fights only
  s.mode = 'tactical';

  const spokespeople = selectSpokespeople(s, i);
  expect(spokespeople).toEqual([wim.id]);
  const exchange = resolveSpeech(s, i, spokespeople, createRng(3));
  expect(exchange.skill).toBe(SK.persuasion);
  const reply = { agent: 'voice', actorId: wim.id, output: { action: act('attack', 'player'), line: 'Never!', volume: 'shout', shares: [], gear: null, stance: null, routine: null } } as AcceptedAgentOutput;
  const ev = play(s, { intent: i, spokespeople, exchange, quickWord: true, agentOutputs: [reply] });
  const said = ev.filter((e) => e.kind === 'speak' && !e.bark).map((e) => [e.actorId, e.line?.text]);
  expect(said).toEqual([['player', 'Drop it and live!'], [wim.id, 'Never!']]);
  expect(ev.some((e) => e.kind === 'attack' && e.actorId === 'player')).toBe(true);
  expect(ev.some((e) => e.kind === 'attack' && e.actorId === wim.id)).toBe(true);
  expect(ev.filter((e) => e.bark).length).toBe(0); // neither line is said twice
});
