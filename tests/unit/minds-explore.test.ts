// detectPlayer and resolveAmbush with local fakes for W3's updateBeliefs and W2's roll.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { GameEvent, GameState, RollRequest } from '../../src/types';

const tiers: Record<string, number> = {};
vi.mock('../../src/perception', () => ({
  computePerception: vi.fn(() => ({})),
  perceptionOf: vi.fn(() => null), // unit tests give levels through event.perception
  updateBeliefs: vi.fn((state: GameState, u: { kind: string; observerId: string; aboutId: string; status: 'aware' }) => {
    const a = state.actors.find((x) => x.id === u.observerId)!;
    a.mind!.knowledge[u.aboutId] = { status: u.status, source: 'seen', revealed: [] };
  }),
}));
vi.mock('../../src/ruleset', async (orig) => {
  const real = await orig<typeof import('../../src/ruleset')>();
  return {
    ...real,
    usableModes: () => [],
    defaultMode: () => ({ itemId: 'player_arming_sword_1', mode: { id: 'cut', tree: 'melee', class: 'medium', reach: 0, hands: 1 } }),
    modeSkill: () => 'melee_medium',
    ruleset: { ...real.ruleset, roll: vi.fn((req: RollRequest) => ({ actorId: req.actorId, skill: req.skill, tier: tiers[req.actorId] ?? -1 })) },
  };
});

import { makeVillage, actor, createRng } from '../harness';
import { detectPlayer, resolveAmbush, alertOrders } from '../../src/minds';
import { ruleset } from '../../src/ruleset';
import { updateBeliefs } from '../../src/perception';
import { fakeView } from './minds-view';

const ev = (perception: GameEvent['perception'], target?: string): GameEvent => ({
  id: 'e1', turn: 1, actorId: 'player', kind: target ? 'attack' : 'move', zone: 'gate_inner', target, effects: [], noise: 2, visibility: 2, perception,
});

beforeEach(() => {
  vi.mocked(ruleset.roll).mockClear();
  vi.mocked(updateBeliefs).mockClear();
  for (const k of Object.keys(tiers)) delete tiers[k];
});

describe('detectPlayer', () => {
  it('open player: full → aware, partial → suspicious, no roll', () => {
    const s = makeVillage();
    const rng = createRng(3);
    const before = rng.state;
    detectPlayer(s, ev({ guard_1: { level: 'full', cue: 'sight' }, trader: { level: 'partial', cue: 'sound' } }), rng);
    expect(actor(s, 'guard_1').mind!.knowledge.player.status).toBe('aware');
    expect(actor(s, 'trader').mind!.knowledge.player.status).toBe('suspicious');
    expect(actor(s, 'patron_1').mind!.knowledge.player).toBeUndefined();
    expect(rng.state).toBe(before);
    expect(ruleset.roll).not.toHaveBeenCalled();
  });
  it('skips observers already aware', () => {
    const s = makeVillage();
    actor(s, 'guard_1').mind!.knowledge.player = { status: 'aware', source: 'seen', revealed: [] };
    detectPlayer(s, ev({ guard_1: { level: 'partial', cue: 'sight' } }), createRng(1));
    expect(updateBeliefs).not.toHaveBeenCalled();
  });
});

describe('resolveAmbush', () => {
  it('player beats the target: surprise, nothing changes', () => {
    const s = makeVillage();
    tiers.player = 1; tiers.guard_1 = -1;
    expect(resolveAmbush(s, 'player', 'guard_1', ev({ guard_1: { level: 'full', cue: 'sight' } }, 'guard_1'), createRng(1))).toEqual({ surprised: true });
    expect(vi.mocked(ruleset.roll).mock.calls.map((c) => c[0].skill)).toEqual(['melee_medium', 'sight']);
    expect(actor(s, 'guard_1').mind!.knowledge.player).toBeUndefined();
  });
  it('target wins: aware and onAlert due; a witness wins too', () => {
    const s = makeVillage();
    tiers.player = -1; tiers.guard_1 = 0; tiers.trader = 1;
    const r = resolveAmbush(s, 'player', 'guard_1', ev({ guard_1: { level: 'full', cue: 'sight' }, trader: { level: 'partial', cue: 'sound' } }, 'guard_1'), createRng(1));
    expect(r.surprised).toBe(false);
    expect(vi.mocked(ruleset.roll).mock.calls.map((c) => c[0].skill)).toEqual(['melee_medium', 'sight', 'hearing']);
    expect(actor(s, 'guard_1').mind!.knowledge.player.status).toBe('aware');
    expect(actor(s, 'trader').mind!.knowledge.player.status).toBe('aware');
    expect(alertOrders(s, [fakeView(s, 'guard_1')])).toEqual([expect.objectContaining({ type: 'call_help', source: 'onAlert' })]);
  });
  it('tie: not surprised, stays unaware', () => {
    const s = makeVillage();
    tiers.player = -1; tiers.guard_1 = -1;
    expect(resolveAmbush(s, 'player', 'guard_1', ev({}, 'guard_1'), createRng(1)).surprised).toBe(false);
    expect(actor(s, 'guard_1').mind!.knowledge.player).toBeUndefined();
  });
});
