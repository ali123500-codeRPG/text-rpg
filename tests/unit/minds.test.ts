import { TP } from '../../src/library/templateIds';
import { afterEach, describe, expect, it } from 'vitest';
import { makeVillage, actor, place, createRng, forcedRng } from '../harness';
import { CONFIG, resetConfig } from '../../src/config';
import { getLibrary } from '../../src/library';
import { spawnNpc } from '../../src/library/spawn';
import type { GameEvent, GameState } from '../../src/types';
import {
  desiredState, routineOrder, fallbackOrder, brokenOrder, bindTemplate, installRoutines, switchRoutine,
  updateAlarms, alertOrders, validateRoutineBank, calmBandmatesSwitch, UNREACHABLE,
} from '../../src/minds';
import { fakeView } from './minds-view';
import { SK } from '../../src/library/skillIds';

afterEach(() => resetConfig());

const ev = (state: GameState, kind: string, actorId: string, zone: string, perceivedBy: string[]): GameEvent => ({
  id: `e${Math.random()}`, turn: state.turn, actorId, kind, zone, effects: [], noise: 'normal', visibility: 'normal',
  perception: Object.fromEntries(perceivedBy.map((id) => [id, { level: 'full' as const, cue: 'sight' as const }])),
});
const belief = (zone: string, status: 'suspicious' | 'aware' = 'aware', turn = 1) => ({ status, lastKnownZone: zone, lastSeenTurn: turn, source: 'seen' as const, revealed: [] });
function companion(s: GameState, zone = 'tav_common') {
  const c = spawnNpc(null, TP.patron, { id: 'comp', zone, placeId: 'tavern', bandId: 'player_band', name: 'Pip' });
  installRoutines(c, 'companion', {}, undefined, s.turn, createRng(1));
  s.actors.push(c);
  return c;
}

describe('desired state', () => {
  it('schedule loops over expanded route stops', () => {
    const s = makeVillage();
    const sl = actor(s, 'slime_1'); // roam_field: route[field_mid, field_far] short ooze, post field_far medium rest
    sl.mind!.routine = { id: 'roam_field', anchorTurn: 0 };
    const at = (t: number) => { s.turn = t; return desiredState(fakeView(s, 'slime_1')); };
    expect(at(0)).toEqual({ zone: 'field_mid', activity: 'ooze' });
    expect(at(3)).toEqual({ zone: 'field_far', activity: 'ooze' });
    expect(at(6)).toEqual({ zone: 'field_far', activity: 'rest' });
    expect(at(12)).toEqual({ zone: 'field_mid', activity: 'ooze' });
  });
  it('non-looping schedule holds its last step', () => {
    const s = makeVillage();
    const p = actor(s, 'patron_1');
    p.mind!.routine = { id: 'leave_by_exit', anchorTurn: 0 };
    s.turn = 500;
    expect(desiredState(fakeView(s, 'patron_1'))).toEqual({ zone: 'street_door', activity: 'rest' });
  });
  it('reads DURATIONS at call time', () => {
    const s = makeVillage();
    actor(s, 'slime_1').mind!.routine = { id: 'roam_field', anchorTurn: 0 };
    CONFIG.DURATIONS.short = 5;
    s.turn = 4;
    expect(desiredState(fakeView(s, 'slime_1'))!.zone).toBe('field_mid');
  });
  it('follow reads the belief, wait reads here', () => {
    const s = makeVillage();
    const c = companion(s);
    c.mind!.knowledge.player = belief('street_square');
    expect(desiredState(fakeView(s, 'comp'))).toEqual({ zone: 'street_square', activity: 'walk' });
    expect(switchRoutine(s, c, 'wait', 'agent')).toBe(true);
    expect(c.mind!.slots!.here).toBe('tav_common');
    expect(desiredState(fakeView(s, 'comp'))).toEqual({ zone: 'tav_common', activity: 'rest' });
  });
});

describe('routineOrder', () => {
  it('moves one link, idles there, stays when unreachable', () => {
    const s = makeVillage();
    const g = place(s, 'guard_1', 'street_door');
    let o = routineOrder(fakeView(s, 'guard_1'));
    expect(o).toMatchObject({ type: 'move', target: 'street_square', source: 'routine', activity: 'stand_watch' });
    g.zone = 'gate_inner';
    o = routineOrder(fakeView(s, 'guard_1'));
    expect(o).toMatchObject({ type: 'idle', source: 'routine', activity: 'stand_watch' });
    s.stage.zoneIds = s.stage.zoneIds.filter((z) => z !== 'street_square');
    g.zone = 'street_door';
    o = routineOrder(fakeView(s, 'guard_1'));
    expect(o).toMatchObject({ type: 'idle', intent: UNREACHABLE, activity: 'stand_watch' });
  });
});

describe('fallback list', () => {
  it('attacks the last hitter, else the player, with the type attack skill', () => {
    const s = makeVillage();
    const c = companion(s, 'field_mid');
    place(s, 'player', 'field_mid');
    const sl = actor(s, 'slime_1');
    sl.mind!.knowledge.player = belief('field_mid');
    sl.mind!.knowledge.comp = belief('field_mid');
    void c;
    expect(fallbackOrder(fakeView(s, 'slime_1'), createRng(1))).toMatchObject({ type: 'attack', target: 'player', skill: SK.unarmed_natural, targetPart: null, aimed: false, source: 'fallback' });
    expect(fallbackOrder(fakeView(s, 'slime_1', { lastHitBy: 'comp' }), createRng(1)).target).toBe('comp');
  });
  it('rng pick among non-player targets', () => {
    const s = makeVillage();
    companion(s, 'field_mid');
    const c2 = spawnNpc(null, TP.patron, { id: 'comp2', zone: 'field_mid', placeId: 'field', bandId: 'player_band' });
    s.actors.push(c2);
    const sl = actor(s, 'slime_1');
    sl.mind!.knowledge.comp = belief('field_mid');
    sl.mind!.knowledge.comp2 = belief('field_mid');
    expect(fallbackOrder(fakeView(s, 'slime_1'), forcedRng([1])).target).toBe('comp2');
  });
  it('closes in one link, never through a frontier, then searches', () => {
    const s = makeVillage();
    const sl = place(s, 'slime_1', 'field_far');
    sl.mind!.knowledge.player = belief('field_edge', 'suspicious');
    expect(fallbackOrder(fakeView(s, 'slime_1'), createRng(1))).toMatchObject({ type: 'move', target: 'field_mid', source: 'fallback' });
    sl.zone = 'field_edge';
    expect(fallbackOrder(fakeView(s, 'slime_1'), createRng(1))).toMatchObject({ type: 'search', target: 'field_edge' });
    sl.zone = 'field_far';
    sl.mind!.knowledge.player = belief('woods', 'suspicious');
    expect(fallbackOrder(fakeView(s, 'slime_1'), createRng(1)).type).toBe('hold');
  });
  it('broken flees to exit and holds; surrendered holds; a broken slime flees too (fearless is Resolve 90, MB4)', () => {
    const s = makeVillage();
    const p = place(s, 'patron_1', 'tav_counter');
    p.mind!.moraleState = 'broken';
    expect(brokenOrder(fakeView(s, 'patron_1'))).toMatchObject({ type: 'flee', target: 'tav_common', source: 'broken' });
    expect(fallbackOrder(fakeView(s, 'patron_1'), createRng(1))).toMatchObject({ type: 'flee', source: 'fallback' });
    p.zone = 'street_door';
    expect(brokenOrder(fakeView(s, 'patron_1')).type).toBe('hold');
    p.mind!.moraleState = 'surrendered';
    p.zone = 'tav_counter';
    expect(brokenOrder(fakeView(s, 'patron_1')).type).toBe('hold');
    const sl = actor(s, 'slime_1');
    sl.mind!.moraleState = 'broken';
    sl.mind!.knowledge.player = belief('field_mid');
    place(s, 'player', 'field_mid');
    expect(fallbackOrder(fakeView(s, 'slime_1'), createRng(1)).type).toBe('flee');
  });
  it('broken with no exit or refuge moves away from the threat', () => {
    const s = makeVillage();
    const g = place(s, 'guard_1', 'street_square');
    g.mind!.moraleState = 'broken';
    g.mind!.knowledge.slime_1 = belief('gate_inner');
    expect(brokenOrder(fakeView(s, 'guard_1'))).toMatchObject({ type: 'flee', target: 'street_door' });
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
  it('startAt, seeded phase, plain anchor', () => {
    const s = makeVillage();
    const g = actor(s, 'guard_1');
    installRoutines(g, 'patrol_guard', { route: ['street_square', 'gate_inner', 'street_door'] }, 'route', 20, createRng(1));
    expect(g.mind!.routine).toEqual({ id: 'patrol', anchorTurn: 20 });
    const sl = actor(s, 'slime_1');
    installRoutines(sl, 'slime_wander', { route: ['field_mid', 'field_far'], post: 'field_edge' }, 'post', 20, createRng(1));
    expect(sl.mind!.routine).toEqual({ id: 'roam_field', anchorTurn: 14 });
    installRoutines(g, 'gate_guard', { post: 'gate_inner' }, undefined, 20, forcedRng([5]));
    expect(g.mind!.routine).toEqual({ id: 'guard_post', anchorTurn: 15 });
  });
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
    expect(t.mind!.routine).toEqual({ id: 'wait', anchorTurn: 9 });
  });
  it('calm bandmates who heard switch; others keep theirs; skip logs', () => {
    const s = makeVillage();
    const p2 = spawnNpc(null, TP.patron, { id: 'patron_2', zone: 'tav_common', placeId: 'tavern', bandId: 'tavern_folk' });
    installRoutines(p2, 'patron', { seat: 'tav_common', refuge: 'tav_cellar', exit: 'street_door' }, undefined, 1, createRng(2));
    s.actors.push(p2);
    switchRoutine(s, actor(s, 'patron_1'), 'leave_by_exit', 'agent');
    const e = ev(s, 'speak', 'patron_1', 'tav_common', ['patron_2', 'trader']);
    expect(calmBandmatesSwitch(s, 'patron_1', 'leave_by_exit', (id) => !!e.perception[id])).toEqual(['patron_2']);
    expect(actor(s, 'trader').mind!.routine!.id).toBe('tend_bar');
    expect(s.log.map((l) => l.code)).toEqual(['routine_skip']);
  });
});

describe('alarm', () => {
  it('onAlert once, alert variant, calm return with saved anchor', () => {
    const s = makeVillage();
    const g = actor(s, 'guard_1');
    g.mind!.routine = { id: 'guard_post', anchorTurn: 3 };
    s.turn = 10;
    updateAlarms(s, [ev(s, 'attack', 'player', 'gate_inner', ['guard_1'])]);
    expect(g.mind!.routine).toEqual({ id: 'hold_post_alert', anchorTurn: 10 });
    expect(g.mind!.alarm!.returnTo).toEqual({ id: 'guard_post', anchorTurn: 3 });
    const orders = alertOrders(s, [fakeView(s, 'guard_1')]);
    expect(orders).toEqual([expect.objectContaining({ actorId: 'guard_1', type: 'call_help', source: 'onAlert' })]);
    expect(alertOrders(s, [fakeView(s, 'guard_1')])).toEqual([]);
    s.turn = 11;
    updateAlarms(s, [ev(s, 'attack', 'player', 'gate_inner', ['guard_1'])]);
    expect(alertOrders(s, [fakeView(s, 'guard_1')])).toEqual([]);
    for (s.turn = 12; s.turn < 17; s.turn++) updateAlarms(s, []);
    expect(g.mind!.routine!.id).toBe('hold_post_alert');
    s.turn = 17;
    updateAlarms(s, []);
    expect(g.mind!.routine).toEqual({ id: 'guard_post', anchorTurn: 3 });
    expect(g.mind!.alarm!.armed).toBe(false);
  });
  it('first leaving unaware of an opposed actor raises the alarm', () => {
    const s = makeVillage();
    const g = actor(s, 'guard_1');
    g.mind!.knowledge.slime_1 = belief('field_edge', 'suspicious');
    updateAlarms(s, []);
    expect(g.mind!.alarm!.armed).toBe(true);
    expect(g.mind!.routine!.id).toBe('hold_post_alert');
  });
  it('agent switch while alarmed clears returnTo', () => {
    const s = makeVillage();
    const g = actor(s, 'guard_1');
    updateAlarms(s, [ev(s, 'alarm', 'trader', 'gate_inner', ['guard_1'])]);
    switchRoutine(s, g, 'wait', 'agent');
    expect(g.mind!.alarm!.returnTo).toBeUndefined();
  });
});

describe('routine bank import', () => {
  it('the prototype bank passes', () => {
    const L = getLibrary();
    expect(validateRoutineBank({ routines: L.routines, sets: L.routineSets, activities: L.activities })).toEqual({ ok: true, errors: [] });
  });
  it('rejects bad entries', () => {
    const L = structuredClone(getLibrary());
    L.routines.bad_follow = { ...L.routines.follow, id: 'bad_follow', steps: [{ slot: 'post', duration: 'brief', activity: 'walk' }], alert: 'nope' };
    L.routines.empty = { ...L.routines.patrol, id: 'empty', steps: [], alert: undefined, onAlert: { type: 'move', skill: null, intent: '', target: '$slot:cellar' } };
    L.routineSets.gate_guard.routines.push('empty', 'missing');
    const r = validateRoutineBank({ routines: L.routines, sets: L.routineSets, activities: L.activities });
    expect(r.ok).toBe(false);
    for (const frag of ['steps on a follow', 'unknown alert routine nope', 'schedule with no steps', 'slot cellar not declared', 'unknown routine missing'])
      expect(r.errors.some((e) => e.includes(frag)), frag).toBe(true);
  });
});
