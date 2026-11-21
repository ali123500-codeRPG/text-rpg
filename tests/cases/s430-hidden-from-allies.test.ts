// 430 BB9 b, BB4 b, BB5 a (D-1768 step 3): a hidden character is hidden from its own too. Its group and crew roll to
// notice it like anyone else, only easier (ALLY_NOTICE_TIERS: its group, or else its crew), and its actions reach only
// those who notice it. Back off and Draw into the pack look for a free ally among one's group or crew (BB4 b); Spotter
// tells its group or crew (BB5 a).
import { describe, expect, it } from 'vitest';
import { makeVillage, actor, createRng } from '../harness';
import type { GameEvent, GameState, Tie } from '../../src/types';
import { allyNoticeShift } from '../../src/minds/state';
import { computePerception } from '../../src/perception';
import { CONFIG } from '../../src/config';

const tie = (org: string): Tie => ({ to: { org }, status: 'member', commitment: 'sworn', cover: 'open' });

function world(): GameState {
  const s = makeVillage();
  s.organizations = [{ id: 'gang', name: 'the gang', kind: 'gang', closeKnit: true }];
  return s;
}

describe('430 hidden from allies too', () => {
  it('its group notices it ALLY_NOTICE_TIERS.group easier, its crew .crew easier, anyone else no easier', () => {
    const s = world(), p = actor(s, 'patron_1'), t = actor(s, 'trader'), g = actor(s, 'guard_1');
    expect(allyNoticeShift(s, t, p)).toEqual([{ source: 'One of yours', value: CONFIG.ALLY_NOTICE_TIERS.group }]); // same band
    expect(allyNoticeShift(s, g, p)).toEqual([]);
    g.ties = [tie('gang')]; p.ties = [tie('gang')];
    expect(allyNoticeShift(s, g, p)).toEqual([{ source: 'One of yours', value: CONFIG.ALLY_NOTICE_TIERS.crew }]);
    expect(Math.max(CONFIG.ALLY_NOTICE_TIERS.group, CONFIG.ALLY_NOTICE_TIERS.crew)).toBeLessThanOrEqual(2); // the owner's +2 at most
  });

  it("a stealthy character's action reaches its own group only if they notice it", () => {
    const s = world(), p = actor(s, 'patron_1'), t = actor(s, 'trader');
    p.posture = 'stealthy';
    t.mind!.knowledge[p.id] = { ...(t.mind!.knowledge[p.id] ?? { source: 'seen', revealed: [] }), status: 'unaware' } as never;
    const e: GameEvent = { id: 'e1', turn: 1, actorId: p.id, kind: 'move', zone: p.zone, effects: [], noise: 'quiet', visibility: 'normal', perception: {} };
    expect(computePerception(e, s, createRng(1))[t.id]).toBeUndefined();
    t.mind!.knowledge[p.id]!.status = 'aware';
    expect(computePerception(e, s, createRng(1))[t.id]).toBeDefined();
  });
});
