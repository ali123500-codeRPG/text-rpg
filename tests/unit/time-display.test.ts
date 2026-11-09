// Time of day display: T1 coloured icon in the header, T2 b "N hours later" divider, T3 b natural
// recovery as a quiet line (the DOM parts are checked in the browser). Turn notes carry the time that passed, because the code log is cleared before display.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { turnNotes } from '../../src/agents/game';
import { advanceClock } from '../../src/time';

describe('time of day display', () => {
  it('turn notes keep how long a wait or sleep took and where the clock is now', () => {
    const s = makeVillage();
    advanceClock(s, 11 * 60);
    s.log.push({ turn: s.turn, code: 'time_passed', detail: { actorId: 'player', minutes: 660 } });
    const n = turnNotes(s).timePassed!;
    expect(n.minutes).toBe(660);
    expect(n.day).toBeGreaterThanOrEqual(1);
    expect(['dawn', 'day', 'dusk', 'night']).toContain(n.timeOfDay);
    s.log = [];
    expect(turnNotes(s).timePassed).toBeUndefined();
  });
});
