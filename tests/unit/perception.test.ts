import { describe, expect, it } from 'vitest';
import type { GameEvent, GameState } from '../../src/types';
import { makeVillage, actor, place, createRng, byDoor } from '../harness';
import { applyBeliefDecay, computePerception, updateBeliefs } from '../../src/perception';
import { CONFIG } from '../../src/config';
import { IT } from '../../src/library/itemIds';

let n = 0;
const ev = (e: Partial<GameEvent> & Pick<GameEvent, 'actorId' | 'kind' | 'zone'>): GameEvent =>
  ({ id: `e${++n}`, turn: 1, effects: [], noise: 'quiet', visibility: 'normal', perception: {}, ...e });
const run = (s: GameState, e: GameEvent) => {
  e.perception = computePerception(e, s, createRng(1));
  updateBeliefs(s, { kind: 'event', event: e });
  return e;
};

describe('computePerception', () => {
  it('sight from real distances: normal is made out to 25 m and glimpsed beyond; low (still) to 15 m', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    const p = s.player.pos!;
    /** an event `m` metres east of the player, down the street toward the gate (the square ends 10 m east, the gate 30 m) */
    const at = (m: number, visibility: GameEvent['visibility']) => computePerception(ev({ actorId: 'slime_1', kind: 'move',
      zone: m < 10 ? 'street_square' : m < 30 ? 'gate_inner' : 'field_edge', pos: { x: p.x + m, y: p.y }, noise: 'silent', visibility }), s, createRng(1)).player;
    expect(at(20, 'normal')).toEqual({ level: 'full', cue: 'sight' });
    expect(at(24, 'normal')).toEqual({ level: 'full', cue: 'sight' });
    expect(at(32, 'normal')).toEqual({ level: 'partial', cue: 'sight' });
    expect(at(14, 'low')).toEqual({ level: 'full', cue: 'sight' });
    expect(at(20, 'low')).toEqual({ level: 'partial', cue: 'sight' });
  });
  it('sound from another zone, 16 m and a shut door off, is partial when loud and lost when normal; no sight through a closed link', () => {
    const s = makeVillage({ playerZone: 'street_door' });
    const e = ev({ actorId: 'trader', kind: 'move', zone: 'tav_counter', noise: 'loud', visibility: 'normal' });
    expect(computePerception(e, s, createRng(1)).player).toEqual({ level: 'partial', cue: 'sound' }); // 34 dB: a voice, not its words
    expect(computePerception({ ...e, noise: 'normal' }, s, createRng(1)).player).toBeUndefined();
  });
  it('BG-57: through the shut front door 8 m off, loud and deafening are clear, raised only partly, normal lost; a whisper beside you not meant for you is heard without its words; close is made out in its zone only', () => {
    const s = makeVillage({ playerZone: 'street_door' });
    const p = byDoor(s, 'player', 'street_door', 'tav_common', 4).pos!; // 4 m out from the front door: 8 m from the common room's middle
    const e = ev({ actorId: 'trader', kind: 'speak', zone: 'tav_common', noise: 'hushed', visibility: 'unseen' });
    expect(computePerception(e, s, createRng(1)).player).toBeUndefined();
    expect(computePerception({ ...e, noise: 'deafening' }, s, createRng(1)).player).toEqual({ level: 'full', cue: 'sound', heard: true });
    expect(computePerception({ ...e, noise: 'loud' }, s, createRng(1)).player).toEqual({ level: 'full', cue: 'sound', heard: true });
    expect(computePerception({ ...e, noise: 'raised' }, s, createRng(1)).player).toEqual({ level: 'partial', cue: 'sound' }); // heard only partly: no words
    expect(computePerception({ ...e, noise: 'normal' }, s, createRng(1)).player).toBeUndefined();
    const beside = { zone: 'street_door', pos: { x: p.x + 0.5, y: p.y } };
    expect(computePerception({ ...e, ...beside }, s, createRng(1)).player).toEqual({ level: 'partial', cue: 'sound' });
    expect(computePerception({ ...e, ...beside, target: 'player' }, s, createRng(1)).player).toEqual({ level: 'full', cue: 'sound', heard: true }); // HB8: leaning in
    const v = makeVillage({ playerZone: 'street_square' });
    const q = v.player.pos!;
    const hid = ev({ actorId: 'slime_1', kind: 'idle', zone: 'street_square', pos: { x: q.x + 8, y: q.y }, noise: 'silent', visibility: 'close' });
    expect(computePerception(hid, v, createRng(1)).player).toEqual({ level: 'partial', cue: 'sight' }); // a nod 8 m off: glimpsed, not read
    expect(computePerception({ ...hid, zone: 'gate_inner', pos: { x: q.x + 24, y: q.y } }, v, createRng(1)).player).toBeUndefined(); // 24 m: past 20 m
    expect(computePerception({ ...hid, pos: { x: q.x + 2, y: q.y } }, v, createRng(1)).player).toEqual({ level: 'full', cue: 'sight' });
  });
  it('BG-72: words said to you through a shut door are not felt (no touch); a blow aimed at you from out of sight still is', () => {
    const s = makeVillage({ playerZone: 'street_door' });
    const said = ev({ actorId: 'trader', kind: 'speak', zone: 'tav_common', noise: 'normal', visibility: 'unseen', target: 'player' });
    expect(computePerception(said, s, createRng(1)).player).toBeUndefined();
    expect(computePerception({ ...said, kind: 'talk' }, s, createRng(1)).player).toBeUndefined();
    expect(computePerception({ ...said, kind: 'attack' }, s, createRng(1)).player).toEqual({ level: 'partial', cue: 'touch' });
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
    run(s, ev({ actorId: 'trader', kind: 'move', zone: 'tav_counter', noise: 'raised' })); // with the guard's Keen Ear: 26 dB
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
    run(s, ev({ actorId: 'trader', kind: 'speak', zone: 'tav_counter', noise: 'normal', line: { text: 'Slimes!', volume: 'normal' } })); // a normal voice: clear one link away
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
    actor(s, 'trader').core.inventory.push({ id: 'blade_1', itemId: IT.hidden_blade, equippedIn: ['grip:right_arm'] });
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
