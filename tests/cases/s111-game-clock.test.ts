// 111 Game clock (T1–T11) and natural recovery (H12–H15). Code owns one clock in game minutes;
// each action's time is a durations row; the time of day lights outdoor zones and picks routine sets; waiting moves
// the clock and breaks the scenario; natural recovery heals endurance × 0.01 % an hour, never Crippled or worse.
import { HL } from '../../src/library/tableIds';
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { resolveTurn } from '../../src/engine';
import { mechanicsLines } from '../../src/agents/game';
import { buildNarrationView, buildWeaverView, zoneView } from '../../src/views';
import { validateStagePlan } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { clockSet, now, startClock, timeOfDay, timeView, zoneLight } from '../../src/time';
import { passiveHealing } from '../../src/engine/heal';
import { CONFIG } from '../../src/config';
import type { GameState, Intent, ParserActionType } from '../../src/types';
import { SK } from '../../src/library/skillIds';

const act = (type: ParserActionType, target: string | null = null): Intent => ({
  move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
  action: { type, skill: '', target, targetPart: null, item: null, mode: null, approach: '', stance: 'normal' },
});
const turn = (s: GameState, intent: Intent) => { s.turn += 1; return resolveTurn(s, { intent, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1)); };
const zone = (s: GameState, id: string) => s.zones.find((z) => z.id === id)!;

describe('111 game clock', () => {
  it('every turn costs its action time from the durations table', () => {
    const s = makeVillage();
    startClock(s, 'morning');
    const t0 = now(s);
    turn(s, act('observe'));
    expect(now(s) - t0).toBe(1);
    turn(s, act('barter'));
    expect(now(s) - t0).toBe(11);
  });
  it('waiting until dawn moves the clock to dawn and shows a line, never ending the scenario (SC9); a hostile in the zone blocks it', () => {
    const s = makeVillage();
    startClock(s, 'dusk');
    const ev = turn(s, act('wait', 'dawn'));
    expect(timeOfDay(now(s))).toBe('dawn');
    expect(timeView(s)).toEqual({ day: 2, timeOfDay: 'Dawn' });
    expect(s.stage.breakCause).toBeUndefined();
    expect(mechanicsLines(s, ev)).toContain('Time passes: 11 h (Day 2 · Dawn)');
    // Q2: waiting until the time of day it already is moves nothing
    const at = now(s);
    const again = turn(s, act('wait', 'dawn'));
    expect(now(s) - at).toBeLessThan(60);
    expect(mechanicsLines(s, again)).toContain("Wait: it's already dawn");

    const f = makeVillage();
    startClock(f, 'morning');
    f.player.zone = 'field_mid'; // slime_1 is here
    turn(f, act('sleep'));
    const fev = f.events.slice(-5);
    expect(f.log.some((l) => l.code === 'wait_blocked')).toBe(true);
    expect(mechanicsLines(f, fev)).toContain('Wait: not while someone hostile is near you');
    expect(f.stage.breakCause).toBeUndefined();
    turn(f, act('rest'));
    expect(mechanicsLines(f, f.events.slice(-5))).toContain('Rest: not while someone hostile is near you');
  });
  it('sleep takes the sleep row and heals a rest per 4 hours; a plain wait runs to the next time of day', () => {
    const s = makeVillage();
    startClock(s, 'morning');
    s.player.core.condition.hpLostPct = 80;
    const t0 = now(s);
    turn(s, act('sleep'));
    expect(now(s) - t0).toBe(480 + 1);
    expect(s.log.filter((l) => l.code === 'healed' && (l.detail as { source: string }).source === HL.rest)).toHaveLength(2);
    expect(s.player.core.condition.hpLostPct).toBeLessThan(80 - 2 * CONFIG.REST_HEAL_PCT);
    const w = makeVillage();
    startClock(w, 'morning');
    turn(w, act('wait'));
    expect(timeOfDay(now(w))).toBe('afternoon');
  });
  it('outdoor zones follow the sky unless their own light is brighter; indoors do not', () => {
    const s = makeVillage();
    const field = zone(s, 'field_mid');
    field.outdoor = true;
    field.light = 'dark'; // no lamps: only the sky lights it
    startClock(s, 'night');
    expect(zoneLight(s, field)).toBe('dark');
    expect(zoneView(s, field).light).toBe('dark');
    expect(zoneLight(s, zone(s, 'tav_common'))).toBe('bright');
    field.light = 'dim'; // torches
    expect(zoneLight(s, field)).toBe('dim');
    startClock(s, 'morning');
    expect(zoneLight(s, field)).toBe('bright');
  });
  it('the Narrator sees the day and time of day; the Weaver picks the hour only at story start', () => {
    const s = toStoryStart(makeVillage());
    delete s.clocks.time;
    expect(buildWeaverView(s, { kind: 'scenario', placeId: 'tavern' }).time).toBeNull();
    const ctx = { tier: 'success' as const, kind: 'scenario' as const, placeId: 'tavern' };
    expect(validateStagePlan(s, { ...villageStagePlan(), timeOfDay: 'night' }, ctx).filter((e) => e.code === 'bad_time')).toEqual([]);
    startClock(s, 'morning');
    expect(clockSet(s)).toBe(true);
    expect(validateStagePlan(s, { ...villageStagePlan(), timeOfDay: 'night' }, ctx).some((e) => e.code === 'bad_time')).toBe(true);
  });
  it('the Narrator sees the day and time of day', () => {
    const s = makeVillage();
    startClock(s, 'dusk');
    expect(buildNarrationView(s, []).time).toEqual({ day: 1, timeOfDay: 'Dusk' });
  });
  it('a routine set whose time tags do not fit the hour is a routine error', () => {
    const s = toStoryStart(makeVillage());
    startClock(s, 'morning');
    const p = villageStagePlan();
    p.cast[0].routineSetId = 'sleeper';
    expect(validateStagePlan(s, p, { tier: 'success', kind: 'scenario', placeId: 'tavern' }).some((e) => e.code === 'wrong_time' && e.routineOnly)).toBe(true);
  });
  it('rest cools down in game minutes', () => {
    const s = makeVillage();
    startClock(s, 'morning');
    s.player.core.condition.hpLostPct = 80;
    turn(s, act('rest'));
    turn(s, act('rest'));
    expect(s.log.some((l) => l.code === 'rest_blocked' && (l.detail as { reason: string }).reason === 'cooldown')).toBe(true);
    s.clocks.time = now(s) + CONFIG.REST_COOLDOWN_MIN;
    s.log = [];
    turn(s, act('rest'));
    expect(s.log.some((l) => l.code === 'rest_blocked')).toBe(false);
  });
});

describe('111 natural recovery', () => {
  it('heals endurance × 0.01 % an hour of HP and working parts, never a Crippled part', () => {
    const s = makeVillage();
    s.player.core.skills[SK.endurance].raw = 50;
    const c = s.player.core.condition;
    c.hpLostPct = 30;
    c.parts.left_leg = -30; // Crippled
    c.parts.right_leg = 20; // Damaged
    passiveHealing(s, 120);
    expect(c.hpLostPct).toBeCloseTo(29); // 0.5% an hour for 2 hours
    expect(c.parts.right_leg).toBeCloseTo(21);
    expect(c.parts.left_leg).toBe(-30);
  });
  it('runs during fights too, a little each fight turn', () => {
    const s = makeVillage();
    s.player.core.condition.hpLostPct = 30;
    s.player.zone = 'field_mid';
    s.mode = 'tactical';
    turn(s, act('observe'));
    expect(s.player.core.condition.hpLostPct).toBeLessThan(30);
  });
});
