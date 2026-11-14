// 213 RT1–RT9: routines through the day. Each routine set says what its people do at each time of day: the barkeep
// tends the bar from morning to evening and sleeps at night, guards go off duty in the evening, a night guard sleeps by
// day. Beds, seats and ways out are optional slots: the Weaver may leave them unbound, and the actor then stays where it
// is at the times that read them.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { desiredState, validateRoutineBank } from '../../src/minds';
import { buildActorView } from '../../src/views';
import { getLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';
import { validateStagePlan } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import type { GameState } from '../../src/types';

const at = (s: GameState, k: string) => { s.clocks.time = CONFIG.TIME_OF_DAY_FROM[k] + 10; };
const want = (s: GameState, id: string) => desiredState(buildActorView(s, id));

describe('213 routines through the day (RT1–RT9)', () => {
  it('the bank is valid, and no routine set is for one half of the day only', () => {
    const lib = getLibrary();
    expect(validateRoutineBank({ routines: lib.routines!, sets: lib.routineSets!, activities: lib.activities! }).errors).toEqual([]);
    expect(Object.values(lib.routineSets!).filter((s) => s.tags.time.includes('day') || s.tags.time.includes('night'))).toEqual([]);
  });
  it('RT3: the barkeep tends the bar by day and goes to bed at night', () => {
    const s = makeVillage();
    const b = s.actors.find((a) => a.id === 'trader')!;
    b.mind!.slots = { ...b.mind!.slots, bed: 'tav_cellar' };
    at(s, 'afternoon');
    expect(want(s, b.id)).toEqual({ zone: 'tav_counter', activity: 'tend_counter' });
    at(s, 'night');
    expect(want(s, b.id)).toEqual({ zone: 'tav_cellar', activity: 'sleep' });
  });
  it('an optional slot left unbound: the actor stays where it is at those times; BF68: a sleep step sleeps there', () => {
    const s = makeVillage();
    const b = s.actors.find((a) => a.id === 'trader')!;
    delete b.mind!.slots!.bed;
    at(s, 'night');
    expect(want(s, b.id)).toEqual({ zone: b.zone, activity: 'sleep', unbound: true });
    at(s, 'morning');
    expect(want(s, b.id)!.zone).toBe('tav_counter');
  });
  it('RT1: a gate guard drinks in the evening; a night guard holds the post at night and sleeps by day', () => {
    const lib = getLibrary();
    const steps = (id: string, k: string) => (lib.routines![id].times?.find((t) => t.at.includes(k as never))?.steps ?? lib.routines![id].steps).map((x) => x.activity);
    expect(steps('guard_post', 'afternoon')).toEqual(['stand_watch']);
    expect(steps('guard_post', 'evening')).toEqual(['drink', 'chat']);
    expect(steps('guard_post', 'night')).toEqual(['sleep']);
    expect(steps('night_guard_post', 'night')).toEqual(['stand_watch']);
    expect(steps('night_guard_post', 'morning')).toEqual(['sleep']);
  });
  it('the Weaver may leave an optional slot out, but not a required one', () => {
    const s = toStoryStart(makeVillage());
    const ctx = { tier: 'success' as const, kind: 'scenario' as const, placeId: 'tavern' };
    const p = villageStagePlan();
    const bk = p.cast.find((c) => c.routineSetId === 'barkeep')!;
    bk.slots = { counter: 'tav_counter', refuge: 'tav_cellar' };
    expect(validateStagePlan(s, p, ctx).filter((e) => e.code === 'missing_slot')).toEqual([]);
    bk.slots = { refuge: 'tav_cellar' };
    expect(validateStagePlan(s, p, ctx).some((e) => e.code === 'missing_slot')).toBe(true);
  });
});
