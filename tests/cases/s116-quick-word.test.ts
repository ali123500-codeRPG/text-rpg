// 116 Quick Word (A15; action economy AE7), everyone's rule since TP6 c (the Persuasion 20 perk is retired). In a fight,
// a one-sentence line said beside a non-speech action resolves as talk without using the action, and an NPC's spoken
// reply to it is free as well. Plain talk in a fight is no action at all: its time stays and carries.
import { expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { quickWord, resolveSpeech, selectSpokespeople } from '../../src/engine';
import type { AcceptedAgentOutput } from '../../src/engine';
import { act, intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';
import { DU } from '../../src/library/tableIds';
import { getLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';
import { now } from '../../src/time';

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

it('116b TP6 c, TK1 c: plain talk in a fight takes no time; persuading, lying or threatening takes the Speech row\'s fixed time', () => {
  const short = 'Put it down.', long = 'Put the knife down now, friend, and nobody here gets hurt today, I promise you that on my name.';
  for (const mode of ['tactical', 'explore'] as const) for (const [type, spoken] of [['talk', long], ['intimidate', short], ['intimidate', long], ['persuade', long], ['deceive', short]] as const) {
    const s = makeVillage();
    const wim = s.actors.find((a) => a.id === 'patron_1')!;
    wim.zone = s.player.zone;
    s.mode = mode;
    const i = intent({ action: { type, skill: SK.persuasion, target: wim.id }, spoken, addressees: [wim.id] });
    const spokespeople = selectSpokespeople(s, i);
    const exchange = resolveSpeech(s, i, spokespeople, createRng(3));
    const t0 = now(s);
    play(s, { intent: i, spokespeople, exchange, agentOutputs: [] });
    const secs = Math.round((now(s) - t0) * 600) / 10, kept = (s.player.carry ?? []).reduce((n, c) => n + c.main, 0);
    const words = spoken.split(/\s+/).length;
    if (type === 'talk' && mode === 'tactical') { expect(kept).toBeGreaterThan(0); expect(secs).toBe(CONFIG.FIGHT_TURN_MIN_S); } // no time: it carries
    else if (type === 'talk') expect(secs).toBeCloseTo(words * getLibrary().durations![DU.talk].seconds, 5); // outside a fight: its words
    else { expect(kept).toBe(0); expect(secs).toBe(getLibrary().durations![DU.speech].seconds); } // however long the words
  }
});
