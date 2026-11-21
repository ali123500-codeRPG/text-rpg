// 213 RT1–RT9: routines through the day. Each routine set says what its people do at each time of day: the barkeep
// tends the bar from morning to evening and sleeps at night, guards go off duty in the evening, a night guard sleeps by
// day. Beds, seats and ways out are optional slots: the Weaver may leave them unbound, and the actor then stays where it
// is at the times that read them.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { validateRoutineBank } from '../../src/minds';
import { getLibrary } from '../../src/library';
import { validateStagePlan } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';

describe('213 routines through the day (RT1–RT9)', () => {
  it('the bank is valid, and no routine set is for one half of the day only', () => {
    const lib = getLibrary();
    expect(validateRoutineBank({ routines: lib.routines!, sets: lib.routineSets!, activities: lib.activities! }).errors).toEqual([]);
    expect(Object.values(lib.routineSets!).filter((s) => s.tags.time.includes('day') || s.tags.time.includes('night'))).toEqual([]);
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
