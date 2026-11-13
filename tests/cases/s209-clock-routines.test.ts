// 209 NW10, NW11: routines on the clock. A routine's steps last game minutes (brief 5, short 30, medium 120, long 360),
// and a routine may name other steps for one or more times of day (NW13: dawn, morning, afternoon, dusk, evening, night). The time a turn takes moves every NPC
// not in a fight toward where its routine puts it at the new time, as far as it could walk in that time at the travel
// pace, less what its own move already walked: one jump, no Claude calls. A long sleep no longer leaves the world one step on.
import { describe, expect, it } from 'vitest';
import type { GameState, Intent, ParserActionType, Routine } from '../../src/types';
import { createRng, makeVillage } from '../harness';
import { resolveTurn } from '../../src/engine';
import { desiredState, installRoutines } from '../../src/minds';
import { buildActorView } from '../../src/views';
import { getLibrary } from '../../src/library';
import { validateRoutineBank } from '../../src/minds';
import { now, startClock } from '../../src/time';
import { CONFIG } from '../../src/config';
import { travelSpeed } from '../../src/engine/travel';

const act = (type: ParserActionType): Intent => ({
  move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
  action: { type, skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance: 'normal' },
});
const turn = (s: GameState, intent: Intent) => { s.turn += 1; return resolveTurn(s, { intent, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1)); };
const quiet = (playerZone = 'tav_cellar') => makeVillage({ playerZone, without: ['slime_1', 'slime_2', 'patron_1'] });

describe('209 routines on the clock (NW10, NW11, NW13)', () => {
  it('NW10: a routine can name its own steps for a time of day; other times use its steps', () => {
    const s = quiet();
    const lib = getLibrary();
    // a night watch: the post by day, the gate by night
    const r: Routine = { id: 'test_watch', brief: 'watch', kind: 'schedule', loop: true, steps: [{ slot: 'post', duration: 'long', activity: 'stand_watch' }],
      times: [{ at: ['evening', 'night'], steps: [{ slot: 'route', duration: 'short', activity: 'walk' }] }], onAlert: null };
    lib.routines![r.id] = r;
    lib.routineSets!.test_watch = { id: 'test_watch', brief: 'watch', tags: { place: [], role: [], time: ['any'], event: ['ordinary'] }, slots: { post: { kind: 'zone', hint: '' }, route: { kind: 'route', hint: '' } }, routines: [r.id] };
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    startClock(s, 'morning');
    installRoutines(g, 'test_watch', { post: 'gate_inner', route: ['street_square', 'street_door'] }, undefined, s.turn, createRng(1), now(s));
    expect(desiredState(buildActorView(s, g.id))!.zone).toBe('gate_inner');
    // NW13: one entry covers both the evening and the night
    for (const k of ['evening', 'night']) {
      s.clocks.time = CONFIG.TIME_OF_DAY_FROM[k] + 5;
      expect(['street_square', 'street_door']).toContain(desiredState(buildActorView(s, g.id))!.zone);
    }
    expect(validateRoutineBank({ routines: lib.routines!, sets: lib.routineSets!, activities: lib.activities! }).errors).toEqual([]);
    lib.routines![r.id] = { ...r, times: [{ at: ['noon'], steps: r.times![0].steps }] as never };
    expect(validateRoutineBank({ routines: lib.routines!, sets: lib.routineSets!, activities: lib.activities! }).errors.join(' ')).toMatch(/noon is not a time of day/);
    lib.routines![r.id] = { ...r, times: [...r.times!, { at: ['night'], steps: r.steps }] };
    expect(validateRoutineBank({ routines: lib.routines!, sets: lib.routineSets!, activities: lib.activities! }).errors.join(' ')).toMatch(/night is named twice/);
    lib.routines![r.id] = r;
  });
  it('NW11: a long sleep moves every NPC to where its routine puts it at the new time', () => {
    const s = quiet();
    startClock(s, 'night');
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    // a patrol from the gate to the tavern door and back, 30 minutes a stop
    installRoutines(g, 'patrol_guard', { route: ['gate_inner', 'street_square', 'street_door'] }, 'route', s.turn, createRng(1), now(s));
    const before = now(s);
    turn(s, act('sleep'));
    expect(now(s) - before).toBe(481); // the sleep row, plus the action minute
    // 481 minutes into a 90-minute loop: 31 minutes in, the second stop
    expect(desiredState(buildActorView(s, g.id))!.zone).toBe('street_square');
    expect(g.zone).toBe('street_square');
  });
  it('NW11: it goes only as far as it could walk in the time; an action turn is a minute of walking', () => {
    const s = quiet();
    startClock(s, 'morning');
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    // its post is 110 m off, straight east across the field; a minute walks travelSpeed × 60 metres (about 76)
    installRoutines(g, 'gate_guard', { post: 'field_far' }, undefined, s.turn, createRng(1), now(s));
    const reach = travelSpeed(s, g, CONFIG.CATCH_UP_PACE) * 60;
    const from = g.pos!.x;
    turn(s, act('observe'));
    expect(g.zone).not.toBe('field_far');
    expect(g.pos!.x - from).toBeCloseTo(reach, 0);
  });
  it('NW11: a broken NPC is not moved on (nor one in a fight, held, or run by its agent this turn)', () => {
    const s = quiet();
    startClock(s, 'morning');
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    installRoutines(g, 'gate_guard', { post: 'tav_cellar' }, undefined, s.turn, createRng(1), now(s));
    g.mind!.moraleState = 'broken';
    turn(s, act('observe'));
    expect(g.zone).not.toBe('tav_cellar');
  });
});
