// BG-253 (NV7, npc-value study branch-F2 turn 6): the gate guard's Planner picked "That one's near done, finish it" from the
// turn's start, but the guard said it at his step, after the player's blow had killed that slime. An NPC's words beside its
// action are now said as its turn starts, before anyone's step; words it keeps for after a walk still come at the end (s303).
import { expect, it } from 'vitest';
import { beside, makeVillage, place } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';
import { buildNarrationView } from '../../src/views';
import type { GameEvent } from '../../src/types';

const LINE = "That one's near done, finish it.";
const setup = () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_2', 'guard_1'] });
  beside(s, 'patron_1', 'player', 2);
  const slime = place(s, 'slime_1', 'tav_common');
  beside(s, 'slime_1', 'player', 1);
  slime.core.condition.hpLostPct = 95;
  return s;
};
const at = (ev: GameEvent[], f: (e: GameEvent) => boolean) => ev.findIndex(f);
const said = (e: GameEvent) => e.actorId === 'patron_1' && e.line?.text === LINE;

for (const seed of [1, 2, 3, 4, 5]) it(`the line comes before the blow that ends what it is about (seed ${seed})`, () => {
  const s = setup();
  const ev = play(s, { intent: intent({ action: { type: 'attack', target: 'slime_1' } }), agentOutputs: [plannerOut('patron_1', act('hold'), { dialogue: { line: LINE, volume: 'shout' } })] }, seed);
  expect(at(ev, said)).toBeGreaterThanOrEqual(0);
  expect(at(ev, said)).toBeLessThan(at(ev, (e) => e.actorId === 'player' && ['attack', 'wasted'].includes(e.kind)));
  expect(ev.filter((e) => e.actorId === 'patron_1' && e.kind === 'hold')).toHaveLength(1); // no second, wordless hold
  expect(buildNarrationView(s, ev).events.some((e) => e.line?.text === LINE)).toBe(true);
});

it('words beside an attack are said before anyone strikes, and the blow still lands', () => {
  const s = setup();
  const ev = play(s, { intent: intent({ action: { type: 'attack', target: 'slime_1' } }), agentOutputs: [plannerOut('patron_1', act('attack', 'slime_1'), { dialogue: { line: LINE, volume: 'shout' } })] });
  expect(at(ev, said)).toBeLessThan(at(ev, (e) => ['attack', 'wasted'].includes(e.kind)));
  expect(ev.some((e) => e.actorId === 'patron_1' && ['attack', 'wasted'].includes(e.kind) && !e.line)).toBe(true);
});
