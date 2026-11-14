// 116 Quick Word (A15; action economy AE7), everyone's rule since TP6 c (the Persuasion 20 perk is retired). In a fight,
// a one-sentence line said beside a non-speech action resolves as talk without using the action, and an NPC's spoken
// reply to it is free as well. Plain talk in a fight is no action at all: its time stays and carries.
import { expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { quickWord, resolveSpeech, selectSpokespeople } from '../../src/engine';
import type { AcceptedAgentOutput } from '../../src/engine';
import { act, intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';

it('116 Quick Word: the line and the reply are free; both actions still happen', () => {
  const s = makeVillage();
  const wim = s.actors.find((a) => a.id === 'patron_1')!;
  wim.zone = s.player.zone;
  s.mode = 'tactical';
  const i = intent({ action: { type: 'attack', skill: SK.unarmed_strike, target: wim.id }, spoken: 'Drop it and live!', addressees: [wim.id] });
  expect(quickWord(s, i)).toBe(true); // no perk needed
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

it('116b TP6 c: plain talk in a fight takes no time; words that use a skill (a threat) take their words\' time', () => {
  for (const [type, free] of [['talk', true], ['intimidate', false]] as const) {
    const s = makeVillage();
    const wim = s.actors.find((a) => a.id === 'patron_1')!;
    wim.zone = s.player.zone;
    s.mode = 'tactical';
    const i = intent({ action: { type, skill: SK.persuasion, target: wim.id }, spoken: 'Put the knife down now, friend, and nobody here gets hurt today.', addressees: [wim.id] });
    const spokespeople = selectSpokespeople(s, i);
    const exchange = resolveSpeech(s, i, spokespeople, createRng(3));
    play(s, { intent: i, spokespeople, exchange, agentOutputs: [] });
    const kept = (s.player.carry ?? []).reduce((n, c) => n + c.main, 0);
    if (free) expect(kept).toBeGreaterThan(0); // the turn's time was not spent: it carries
    else expect(kept).toBe(0);
  }
});
