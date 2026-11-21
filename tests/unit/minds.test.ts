import { PK } from '../../src/library/perkIds';
import { afterEach, describe, expect, it } from 'vitest';
import { makeVillage, actor, place, createRng, putBarrier } from '../harness';
import { BK } from '../../src/library/tableIds';
import { CONFIG, resetConfig } from '../../src/config';
import { getLibrary } from '../../src/library';
import type { GameEvent, GameState, Order } from '../../src/types';
import {
  desiredState, routineOrder, fallbackOrder, brokenOrder, nerveHolds, bindTemplate, switchRoutine,
  updateAlarms, alertOrders, UNREACHABLE,
} from '../../src/minds';
import { fakeView } from './minds-view';
import { tick } from '../harness/time';

afterEach(() => resetConfig());

const ev = (state: GameState, kind: string, actorId: string, zone: string, perceivedBy: string[]): GameEvent => ({
  id: `e${Math.random()}`, turn: state.turn, actorId, kind, zone, effects: [], noise: 'normal', visibility: 'normal',
  perception: Object.fromEntries(perceivedBy.map((id) => [id, { level: 'full' as const, cue: 'sight' as const }])),
});
const belief = (zone: string, status: 'suspicious' | 'aware' = 'aware', turn = 1) => ({ status, lastKnownZone: zone, lastSeenTurn: turn, source: 'seen' as const, revealed: [] });

describe('desired state', () => {
  it('schedule loops over expanded route stops, each step as long as its DURATIONS id', () => {
    const s = makeVillage();
    const sl = actor(s, 'slime_1'); // roam_field: route[field_mid, field_far] short ooze, post field_far medium rest
    sl.mind!.routine = { id: 'roam_field', anchorTurn: 0, at: 420 };
    // NW10: steps run on the clock: short 30 minutes each route stop, medium 120 at the post, 180 in all
    const at = (m: number) => { s.clocks.time = 420 + m; return desiredState(fakeView(s, 'slime_1')); };
    expect(at(0)).toEqual({ zone: 'field_mid', activity: 'ooze' });
    expect(at(30)).toEqual({ zone: 'field_far', activity: 'ooze' });
    expect(at(60)).toEqual({ zone: 'field_far', activity: 'rest' });
    expect(at(180)).toEqual({ zone: 'field_mid', activity: 'ooze' });
    // s066: durations are ids: changing DURATIONS.short changes every short step, with no bank edit
    const bank = JSON.stringify(getLibrary().routines);
    CONFIG.DURATIONS.short = 50;
    expect(at(30)).toEqual({ zone: 'field_mid', activity: 'ooze' });
    expect(at(50)).toEqual({ zone: 'field_far', activity: 'ooze' });
    expect(JSON.stringify(getLibrary().routines)).toBe(bank);
  });
});

describe('routineOrder', () => {
  it('moves one way on, idles there, stays when there is no walk there', () => {
    const s = makeVillage();
    const g = place(s, 'guard_1', 'street_door');
    let o = routineOrder(fakeView(s, 'guard_1'));
    expect(o).toMatchObject({ type: 'move', target: 'street_square', source: 'routine', activity: 'stand_watch' });
    g.zone = 'gate_inner';
    o = routineOrder(fakeView(s, 'guard_1'));
    expect(o).toMatchObject({ type: 'idle', source: 'routine', activity: 'stand_watch' });
    // BG-1614: no walk there over the floor plan: its post is the cellar, whose one door is locked, and the guard knows it
    g.mind!.slots = { post: 'tav_cellar' };
    putBarrier(s, 'tav_counter', 'tav_cellar', { id: 'cellar_door', kind: BK.door, grade: 'minor', lock: { locked: true }, tried: ['guard_1'] });
    place(s, 'guard_1', 'tav_counter');
    o = routineOrder(fakeView(s, 'guard_1'));
    expect(o).toMatchObject({ type: 'idle', intent: UNREACHABLE, activity: 'stand_watch' });
  });
});

describe('fallback list', () => {
  it('broken flees one link away from its foe, cowers when cornered or at Cowering (BF79); surrendered holds; a broken slime flees too', () => {
    const s = makeVillage();
    const p = place(s, 'patron_1', 'tav_counter');
    p.mind!.moraleState = 'broken';
    p.mind!.overrides = { player: 'yielded' };
    p.mind!.knowledge.player = belief('tav_common');
    expect(brokenOrder(fakeView(s, 'patron_1'))).toMatchObject({ type: 'flee', target: 'tav_cellar', source: 'broken' });
    expect(fallbackOrder(fakeView(s, 'patron_1'), createRng(1))).toMatchObject({ type: 'flee', target: 'tav_cellar', source: 'fallback' });
    place(s, 'patron_1', 'tav_cellar');
    p.mind!.knowledge.player = belief('tav_counter');
    expect(brokenOrder(fakeView(s, 'patron_1'))).toMatchObject({ type: 'idle', intent: 'cower', activity: 'cowering' }); // cornered
    place(s, 'patron_1', 'tav_counter');
    p.mind!.knowledge.player = belief('tav_common');
    expect(brokenOrder(fakeView(s, 'patron_1', { cowering: true }))).toMatchObject({ activity: 'cowering' }); // Cowering: no flight
    p.mind!.moraleState = 'surrendered';
    expect(brokenOrder(fakeView(s, 'patron_1')).type).toBe('hold');
    const sl = actor(s, 'slime_1');
    sl.mind!.moraleState = 'broken';
    sl.mind!.knowledge.player = belief('field_mid');
    place(s, 'slime_1', 'field_edge');
    place(s, 'player', 'field_mid');
    expect(fallbackOrder(fakeView(s, 'slime_1'), createRng(1))).toMatchObject({ type: 'flee', target: 'gate_inner' });
  });
  it('a broken nerve takes away the attack and keeps the rest, its walk too (BF37, BF79); at Cowering the walk goes', () => {
    const o = (x: Partial<Order>): Order => ({ actorId: 'a', type: 'idle', target: null, skill: null, intent: '', source: 'agent', ...x });
    expect(nerveHolds(o({ type: 'give', target: 'player', item: 'charm_1', move: 'tav_common' }))).toEqual({ order: o({ type: 'give', target: 'player', item: 'charm_1', move: 'tav_common' }), blocked: false });
    expect(nerveHolds(o({ type: 'give', target: 'player', item: 'charm_1', move: 'tav_common' }), true)).toEqual({ order: o({ type: 'give', target: 'player', item: 'charm_1' }), blocked: true });
    expect(nerveHolds(o({ type: 'attack', target: 'player', line: { text: 'Stay back!', volume: 'shout' } })).order).toMatchObject({ type: 'idle', activity: 'cowering', line: { text: 'Stay back!' } });
    expect(nerveHolds(o({ type: 'attack', target: 'player', move: 'tav_common' })).order.move).toBeUndefined(); // an attack's walk goes with it
    expect(nerveHolds(o({ type: 'flee', target: 'street_door' })).order.type).toBe('flee');
    expect(nerveHolds(o({ type: 'flee', target: 'street_door' }), true).order.type).toBe('idle');
    expect(nerveHolds(o({ type: 'talk', perkMove: { perk: 'PK1', target: null } })).order).toEqual(o({ type: 'talk' }));
    expect(nerveHolds(o({ type: 'filch', target: 'player' })).blocked).toBe(true);
    // Battle Cry is the one perk move a broken nerve keeps
    expect(nerveHolds(o({ type: 'attack', target: 'player', perkMove: { perk: PK.battle_cry, target: null } })).order).toMatchObject({ activity: 'cowering', perkMove: { perk: PK.battle_cry } });
    expect(nerveHolds(o({ type: 'talk', perkMove: { perk: PK.battle_cry, target: null } }))).toEqual({ order: o({ type: 'talk', perkMove: { perk: PK.battle_cry, target: null } }), blocked: false });
    expect(nerveHolds(o({ type: 'use_item', item: 'bandage_1' }))).toEqual({ order: o({ type: 'use_item', item: 'bandage_1' }), blocked: false });
  });
});

describe('bindTemplate', () => {
  it('binds $player, $lastKnownZone, $triggerZone, $slot', () => {
    const s = makeVillage();
    const sl = actor(s, 'slime_1');
    sl.mind!.knowledge.player = belief('field_edge');
    const v = fakeView(s, 'slime_1');
    const t = { type: 'move', skill: null, intent: 'x' };
    expect(bindTemplate({ ...t, target: '$player' }, v, { source: 'trigger', triggerId: 't1' })).toMatchObject({ actorId: 'slime_1', target: 'player', source: 'trigger', triggerId: 't1' });
    expect(bindTemplate({ ...t, target: '$lastKnownZone' }, v, { source: 'trigger' }).target).toBe('field_edge');
    expect(bindTemplate({ ...t, target: '$triggerZone' }, v, { source: 'trigger', triggerZone: 'gate_inner' }).target).toBe('gate_inner');
    expect(bindTemplate({ ...t, target: '$slot:route' }, v, { source: 'onAlert' }).target).toBe('field_mid');
  });
});

describe('install and switch', () => {
  it('invalid switches log and keep the routine', () => {
    const s = makeVillage();
    const t = actor(s, 'trader');
    expect(switchRoutine(s, t, 'leave_by_exit', 'agent')).toBe(false);
    expect(switchRoutine(s, t, 'leave_by_exit', 'bandmate')).toBe(false);
    expect(t.mind!.routine!.id).toBe('tend_bar');
    expect(s.log.map((l) => l.code)).toEqual(['invalid_routine', 'routine_skip']);
    delete t.mind!.slots!.refuge;
    expect(switchRoutine(s, t, 'flee_to_refuge_alert', 'agent')).toBe(false);
    s.turn = 9;
    expect(switchRoutine(s, t, 'wait', 'agent')).toBe(true);
    expect(t.mind!.routine).toEqual({ id: 'wait', anchorTurn: 9, at: 420 });
  });
});

describe('alarm', () => {
  it('onAlert once, alert variant, calm return with saved anchor', () => {
    const s = makeVillage();
    const g = actor(s, 'guard_1');
    g.mind!.routine = { id: 'guard_post', anchorTurn: 3, at: 420 };
    s.turn = 10;
    updateAlarms(s, [ev(s, 'attack', 'player', 'gate_inner', ['guard_1'])]);
    expect(g.mind!.routine).toEqual({ id: 'hold_post_alert', anchorTurn: 10, at: 420 });
    expect(g.mind!.alarm!.returnTo).toEqual({ id: 'guard_post', anchorTurn: 3, at: 420 });
    const orders = alertOrders(s, [fakeView(s, 'guard_1')]);
    expect(orders).toEqual([expect.objectContaining({ actorId: 'guard_1', type: 'call_help', source: 'onAlert' })]);
    expect(alertOrders(s, [fakeView(s, 'guard_1')])).toEqual([]);
    tick(s, 60);
    updateAlarms(s, [ev(s, 'attack', 'player', 'gate_inner', ['guard_1'])]);
    expect(alertOrders(s, [fakeView(s, 'guard_1')])).toEqual([]);
    tick(s, CONFIG.DECAY_AWARE_S - 1);
    updateAlarms(s, []);
    expect(g.mind!.routine!.id).toBe('hold_post_alert');
    tick(s, 1);
    updateAlarms(s, []);
    expect(g.mind!.routine).toEqual({ id: 'guard_post', anchorTurn: 3, at: 420 });
    expect(g.mind!.alarm!.armed).toBe(false);
  });
});
