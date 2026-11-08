import { describe, expect, it } from 'vitest';
import type { GameEvent, GameState } from '../../src/types';
import { makeVillage, actor, place, createRng } from '../harness';
import { applyBeliefDecay, computePerception, updateBeliefs } from '../../src/perception';
import { CONFIG } from '../../src/config';

let n = 0;
const ev = (e: Partial<GameEvent> & Pick<GameEvent, 'actorId' | 'kind' | 'zone'>): GameEvent =>
  ({ id: `e${++n}`, turn: 1, effects: [], noise: 'quiet', visibility: 'normal', perception: {}, ...e });
const run = (s: GameState, e: GameEvent) => {
  e.perception = computePerception(e, s, createRng(1));
  updateBeliefs(s, { kind: 'event', event: e });
  return e;
};

describe('computePerception', () => {
  it('sight: full in own and sight-linked zone at normal visibility; partial at 2 sight links', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    const p = computePerception(ev({ actorId: 'slime_1', kind: 'move', zone: 'gate_inner', noise: 'silent', visibility: 'normal' }), s, createRng(1));
    expect(p.player).toEqual({ level: 'full', cue: 'sight' });
    const far = computePerception(ev({ actorId: 'slime_1', kind: 'move', zone: 'field_edge', noise: 'silent', visibility: 'normal' }), s, createRng(1));
    expect(far.player).toEqual({ level: 'partial', cue: 'sight' });
  });
  it('sound from another zone is partial and stops after `noise` links; no sight through a closed link', () => {
    const s = makeVillage({ playerZone: 'street_door' });
    const e = ev({ actorId: 'trader', kind: 'move', zone: 'tav_counter', noise: 'normal', visibility: 'normal' });
    expect(computePerception(e, s, createRng(1)).player).toEqual({ level: 'partial', cue: 'sound' });
    expect(computePerception({ ...e, noise: 'quiet' }, s, createRng(1)).player).toBeUndefined();
  });
  it('NV1–NV6: hushed stays in its zone, deafening is clear one link away, close is seen in its zone only', () => {
    const s = makeVillage({ playerZone: 'street_door' });
    const e = ev({ actorId: 'trader', kind: 'speak', zone: 'tav_common', noise: 'hushed', visibility: 'unseen' });
    expect(computePerception(e, s, createRng(1)).player).toBeUndefined();
    expect(computePerception({ ...e, noise: 'deafening' }, s, createRng(1)).player).toEqual({ level: 'full', cue: 'sound' });
    expect(computePerception({ ...e, zone: 'street_door' }, s, createRng(1)).player).toEqual({ level: 'full', cue: 'sound' });
    const v = makeVillage({ playerZone: 'street_square' });
    const hid = ev({ actorId: 'slime_1', kind: 'idle', zone: 'gate_inner', noise: 'silent', visibility: 'close' });
    expect(computePerception(hid, v, createRng(1)).player).toBeUndefined();
    expect(computePerception({ ...hid, zone: 'street_square' }, v, createRng(1)).player).toEqual({ level: 'full', cue: 'sight' });
  });
  it('dark zone caps sight at partial', () => {
    const s = makeVillage({ playerZone: 'tav_cellar' });
    place(s, 'patron_1', 'tav_cellar');
    expect(computePerception(ev({ actorId: 'patron_1', kind: 'idle', zone: 'tav_cellar', noise: 'silent', visibility: 'normal' }), s, createRng(1)).player)
      .toEqual({ level: 'partial', cue: 'sight' });
  });
  it('inactive actors perceive nothing; the actor perceives its own event', () => {
    const s = makeVillage();
    actor(s, 'patron_1').core.condition.hpLostPct = 100;
    const p = computePerception(ev({ actorId: 'trader', kind: 'move', zone: 'tav_common' }), s, createRng(1));
    expect(p.patron_1).toBeUndefined();
    expect(p.trader).toEqual({ level: 'full', cue: 'sight' });
  });
  it("the player's events skip observers unaware of the player", () => {
    const s = makeVillage();
    const e = ev({ actorId: 'player', kind: 'move', zone: 'tav_common' });
    expect(computePerception(e, s, createRng(1)).patron_1).toBeUndefined();
    updateBeliefs(s, { kind: 'opening', observerId: 'patron_1', aboutId: 'player', status: 'suspicious', zone: 'tav_common' });
    expect(computePerception(e, s, createRng(1)).patron_1?.level).toBe('full');
  });
});

describe('updateBeliefs', () => {
  it('full perception: aware, then tracking, source seen', () => {
    const s = makeVillage();
    run(s, ev({ actorId: 'trader', kind: 'move', zone: 'tav_common' }));
    expect(actor(s, 'patron_1').mind!.knowledge.trader).toMatchObject({ status: 'aware', source: 'seen', lastKnownZone: 'tav_common', lastSeenTurn: 1 });
    run(s, ev({ actorId: 'trader', kind: 'idle', zone: 'tav_common' }));
    expect(actor(s, 'patron_1').mind!.knowledge.trader.status).toBe('tracking');
  });
  it('partial sound makes an unaware observer suspicious, source heard', () => {
    const s = makeVillage();
    place(s, 'guard_1', 'street_door');
    run(s, ev({ actorId: 'trader', kind: 'move', zone: 'tav_counter', noise: 'normal' }));
    expect(actor(s, 'guard_1').mind!.knowledge.trader).toMatchObject({ status: 'suspicious', source: 'heard' });
  });
  it('an attack on a bandmate sets an override to opposed toward the attacker', () => {
    const s = makeVillage();
    place(s, 'slime_1', 'tav_common');
    run(s, ev({ actorId: 'patron_1', kind: 'attack', zone: 'tav_common', target: 'trader' }));
    expect(actor(s, 'trader').mind!.overrides?.patron_1).toBe('hostile');
    expect(actor(s, 'slime_1').mind!.overrides?.patron_1).toBeUndefined();
  });
  it('communication copies the sender belief as told, capped at suspicious, dated by the sender', () => {
    const s = makeVillage();
    actor(s, 'trader').mind!.knowledge.slime_1 = { status: 'tracking', lastKnownZone: 'field_mid', lastSeenTurn: 0, source: 'seen', revealed: ['has_acid'] };
    run(s, ev({ actorId: 'trader', kind: 'speak', zone: 'tav_counter', line: { text: 'Slimes!', volume: 'normal' } }));
    expect(actor(s, 'patron_1').mind!.knowledge.slime_1).toEqual({ status: 'suspicious', source: 'told', lastKnownZone: 'field_mid', lastSeenTurn: 0, revealed: ['has_acid'] });
  });
  it('a bark copies nothing', () => {
    const s = makeVillage();
    actor(s, 'trader').mind!.knowledge.slime_1 = { status: 'tracking', lastKnownZone: 'field_mid', lastSeenTurn: 0, source: 'seen', revealed: [] };
    run(s, ev({ actorId: 'trader', kind: 'speak', zone: 'tav_counter', bark: true, line: { text: 'Slimes!', volume: 'shout' } }));
    expect(actor(s, 'patron_1').mind!.knowledge).toEqual({});
  });
  it('a concealed item used in a perceived attack is revealed', () => {
    const s = makeVillage();
    actor(s, 'trader').core.inventory.push({ id: 'blade_1', itemId: 'hidden_blade', equippedIn: ['hand:right_arm'] });
    place(s, 'trader', 'tav_common');
    run(s, ev({ actorId: 'trader', kind: 'attack', zone: 'tav_common', target: 'slime_1', itemId: 'blade_1' }));
    expect(actor(s, 'patron_1').mind!.knowledge.trader.revealed).toContain('item:blade_1');
  });
  it('detection writes the status; unaware writes nothing', () => {
    const s = makeVillage();
    const e = ev({ actorId: 'player', kind: 'move', zone: 'tav_common' });
    updateBeliefs(s, { kind: 'detection', observerId: 'trader', aboutId: 'player', status: 'unaware', event: e });
    expect(actor(s, 'trader').mind!.knowledge.player).toBeUndefined();
    updateBeliefs(s, { kind: 'detection', observerId: 'patron_1', aboutId: 'player', status: 'aware', event: e });
    expect(actor(s, 'patron_1').mind!.knowledge.player).toMatchObject({ status: 'aware', lastKnownZone: 'tav_common', source: 'seen' });
  });
});

describe('applyBeliefDecay', () => {
  it('steps down one level per DECAY_TURNS past lastSeenTurn', () => {
    const s = makeVillage();
    const D = CONFIG.DECAY_TURNS;
    actor(s, 'trader').mind!.knowledge.slime_1 = { status: 'tracking', lastSeenTurn: 0, source: 'seen', revealed: [] };
    const seq: string[] = [];
    for (let t = 1; t <= 2 * D + 1; t++) {
      s.turn = t;
      applyBeliefDecay(s);
      seq.push(actor(s, 'trader').mind!.knowledge.slime_1.status);
    }
    expect(seq[D - 1]).toBe('tracking');
    expect(seq[D]).toBe('aware');
    expect(seq[2 * D - 1]).toBe('aware');
    expect(seq[2 * D]).toBe('suspicious');
  });
});
