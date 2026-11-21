// 429 D-230 a: watchdogs. A dog on the watchdog routine set keeps its post and, each turn it is awake, unbroken and out of a
// fight, barks while it is at least Suspicious of a stranger (anyone outside its groups it is not warm toward). A bark is a call
// for help, a Loud noise: it wakes sleepers and alerts hearers by the hearing rules. Staying unsensed or silencing it gets past.
import { describe, expect, it } from 'vitest';
import type { GameState, Intent, ParserActionType } from '../../src/types';
import { beside, createRng, makeVillage } from '../harness';
import { resolveTurn } from '../../src/engine';
import { installRoutines } from '../../src/minds';
import { spawnNpc } from '../../src/library/spawn';
import { TP } from '../../src/library/templateIds';
import { fallAsleep } from '../../src/engine/sleep';
import { barkCalls } from '../../src/engine/watchdog';
import { now } from '../../src/time';

const act = (type: ParserActionType): Intent => ({
  move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
  action: { type, skill: '', target: null, targetPart: null, item: null, mode: null, approach: '' },
});
const knows = (s: GameState, who: string, status: 'suspicious' | 'aware') =>
  (s.actors.find((a) => a.id === 'dog')!.mind!.knowledge[who] = { status, lastKnownZone: 'gate_inner', lastSeenTurn: s.turn, source: 'seen', revealed: [] });
const setup = () => {
  const s = makeVillage({ playerZone: 'gate_inner', without: ['slime_1', 'slime_2', 'patron_1'] });
  const d = spawnNpc(null, TP.dog, { id: 'dog', zone: 'gate_inner', placeId: s.player.placeId, bandId: 'village_watch', name: 'Grip' });
  installRoutines(d, 'watchdog', { post: 'gate_inner' }, undefined, s.turn, createRng(1));
  s.actors.push(d);
  beside(s, 'dog', 'player', 3);
  return { s, d };
};

describe('429 watchdogs', () => {
  it('barks at a stranger it senses, never at its own group, a friend, or someone it has not sensed', () => {
    const { s, d } = setup();
    knows(s, 'guard_1', 'aware');
    expect(barkCalls(s)).toEqual([]); // its own watch is no stranger, and it has not sensed the player
    knows(s, 'player', 'suspicious');
    expect(barkCalls(s)).toEqual([expect.objectContaining({ actorId: 'dog', type: 'call_help', intent: 'bark at a stranger' })]);
    (d.mind!.overrides ??= {}).player = 'friendly';
    expect(barkCalls(s)).toEqual([]); // befriended: no stranger
    delete d.mind!.overrides!.player;
    fallAsleep(s, d, now(s) + 60);
    expect(barkCalls(s)).toEqual([]); // asleep
  });

  it('a dog on any other routine does not bark', () => {
    const { s, d } = setup();
    installRoutines(d, 'slime_wander', { route: ['gate_inner'], post: 'gate_inner' }, undefined, s.turn, createRng(1));
    knows(s, 'player', 'aware');
    expect(barkCalls(s)).toEqual([]);
  });

  it('the bark is a Loud call for help that wakes a sleeping guard', () => {
    const { s } = setup();
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    fallAsleep(s, g, now(s) + 480);
    const quiet = structuredClone(s);
    quiet.turn += 1;
    resolveTurn(quiet, { intent: act('wait'), aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1));
    expect(quiet.actors.find((a) => a.id === 'guard_1')!.asleep).toBeDefined(); // unsensed, the dog keeps quiet and the guard sleeps on
    knows(s, 'player', 'aware');
    s.turn += 1;
    resolveTurn(s, { intent: act('wait'), aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1));
    expect(s.events.some((e) => e.actorId === 'dog' && e.kind === 'call_help' && e.noise === 'loud')).toBe(true);
    expect(g.asleep).toBeUndefined();
  });
});
