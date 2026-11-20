// The Action times table (AT1, AT11, AT12, AT72, D-248) and the stage 1 timers in game time (AT15, AT76, AT83, AT84).
import { describe, expect, it } from 'vitest';
import { getLibrary } from '../../src/library';
import { DU } from '../../src/library/tableIds';
import { actionRow, actionSeconds, engagementEndS } from '../../src/ruleset/actionTime';
import { CONFIG } from '../../src/config';
import { FOCUS } from '../../src/scales';
import { scaleFor } from '../../src/engine/scenarioEnd';
import { secondsSince } from '../../src/time';
import { makeVillage } from '../harness';
import { tick } from '../harness/time';

describe('the Action times table', () => {
  it('every row has seconds and keys from the scales; reloads name a real shot', () => {
    for (const r of Object.values(getLibrary().durations ?? {})) {
      expect(r.seconds, r.id).toBeGreaterThanOrEqual(0);
      if (r.focus) expect(FOCUS.has(r.focus), r.id).toBe(true);
      if (r.readies) expect(actionRow(r.readies)?.attack, r.id).toBe(true);
      for (const b of r.onBreak ?? []) expect(b.upTo).toBeLessThanOrEqual(1);
    }
  });
  it('AT72/TP10: an engagement ends after its minimum of fight turns', () => {
    expect(engagementEndS()).toBe(CONFIG.ENGAGEMENT_END_MIN_TURNS * CONFIG.FIGHT_TURN_S);
  });
  it('D-248: a row naming a speed function halves every N points above 50; one naming none ignores skill', () => {
    const pick = actionRow(DU.pick_lock)!;
    expect(actionSeconds(pick)).toBe(30);
    expect(actionSeconds(pick, 50 + pick.speed!.halving)).toBe(15);
    expect(actionSeconds(actionRow(DU.bandage)!, 200)).toBe(20);
    expect(actionSeconds(actionRow(DU.blow)!, 50, 2)).toBe(6); // the time factor multiplies
  });
});

describe('timers count game time', () => {
  it('AT15: seconds since a turn stamp follow the clock, not the turn count', () => {
    const s = makeVillage();
    const t = s.turn;
    tick(s, 2);
    tick(s, 60);
    expect(secondsSince(s, t)).toBeCloseTo(62, 3);
    expect(secondsSince(s, undefined)).toBe(Infinity);
  });
  it('AT83/AT84: journey sits between episode and venture', () => {
    expect(scaleFor(5, 'moment')).toBe('journey');
    expect(scaleFor(9, 'moment')).toBe('venture');
  });
});
