// detectPlayer with local fakes for W3's updateBeliefs and W2's roll. The ambush is the attack's own stealth contests
// (BG-342): tests/cases/s412-ambush-combat-stealth.test.ts.
import { AM } from '../../src/library/tableIds';
import { IT } from '../../src/library/itemIds';
import type { Tier } from '../../src/types';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Actor, GameEvent, GameState, RollRequest } from '../../src/types';
import { SK } from '../../src/library/skillIds';

const tiers: Record<string, Tier> = {};
vi.mock('../../src/perception', () => ({
  computePerception: vi.fn(() => ({})),
  perceptionOf: vi.fn(() => null), // unit tests give levels through event.perception
  beliefStatus: (_s: GameState, o: Actor, about: Actor) => (o.kind === 'player' ? 'aware' : o.mind?.knowledge[about.id]?.status ?? 'unaware'),
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
    defaultMode: () => ({ itemId: `player_${IT.arming_sword}_1`, mode: { id: AM.cut, tree: 'melee', class: 'medium', reach: 0, grips: 1 } }),
    modeSkill: () => SK.melee_medium,
    ruleset: { ...real.ruleset, roll: vi.fn((req: RollRequest) => ({ actorId: req.actorId, skill: req.skill, tier: tiers[req.actorId] ?? 'near_miss' })) },
  };
});

import { makeVillage, actor, createRng } from '../harness';
import { detectPlayer } from '../../src/minds';
import { ruleset } from '../../src/ruleset';
import { updateBeliefs } from '../../src/perception';

const ev = (perception: GameEvent['perception'], target?: string): GameEvent => ({
  id: 'e1', turn: 1, actorId: 'player', kind: target ? 'attack' : 'move', zone: 'gate_inner', target, effects: [], noise: 'normal', visibility: 'normal', perception,
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
