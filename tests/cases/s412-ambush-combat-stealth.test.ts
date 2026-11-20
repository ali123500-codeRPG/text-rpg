// 412 BG-342: an ambush is the attack's own Combat Stealth contests, one per sense that reaches each watcher, once per
// turn, from hiding or not; only the outcome is special: the target is caught off guard when every sense it rolled lost.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beside, createRng, makeVillage, place } from '../harness';
import { resolveTurn } from '../../src/engine';
import { ruleset } from '../../src/ruleset';
import { resolveAmbush } from '../../src/minds';
import { SK } from '../../src/library/skillIds';
import { FN } from '../../src/library/functionIds';
import type { ContestResult, GameEvent, GameState, Intent, RollRequest } from '../../src/types';

const stab = (target: string): Intent => ({
  move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
  action: { type: 'attack', skill: '', target, targetPart: null, item: null, mode: null, approach: '' },
});
const turn = (s: GameState, i: Intent) => { s.turn += 1; return resolveTurn(s, { intent: i, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1)); };
/** forces each stealth contest's gap, in order, for one watcher (others: the attacker wins); records every stealth contest */
function rig(gaps: Record<string, number[]> = {}) {
  const calls: [RollRequest, RollRequest][] = [];
  const real = ruleset.contested;
  vi.spyOn(ruleset, 'contested').mockImplementation((a, b, st, rng) => {
    const r = real(a, b, st, rng);
    if (a.rollKind !== 'stealth') return r;
    calls.push([a, b]);
    const gap = gaps[b.actorId]?.shift() ?? -1;
    return { ...r, gap, winner: gap < 0 ? 'a' : gap > 0 ? 'b' : 'tie' } as ContestResult;
  });
  return calls;
}
const unawareGuard = (s: GameState) => { place(s, 'player', 'gate_inner'); beside(s, 'guard_1'); delete s.actors.find((a) => a.id === 'guard_1')!.mind!.knowledge.player; };
const attackOn = (s: GameState, target: string): GameEvent => ({ id: 'e1', turn: s.turn, actorId: 'player', kind: 'attack', zone: s.player.zone, pos: s.player.pos, target, effects: [], noise: 'normal', visibility: 'normal', perception: {} });
const against = (calls: [RollRequest, RollRequest][], id: string) => calls.filter(([, b]) => b.actorId === id).map(([a, b]) => `${a.skill} ${b.fn}`);

afterEach(() => vi.restoreAllMocks());

describe('412 ambush as Combat Stealth (BG-342)', () => {
  it('a blow from hiding rolls Combat Stealth against each sense, never the weapon; every sense lost: caught off guard', () => {
    const s = makeVillage();
    unawareGuard(s);
    s.player.posture = 'stealthy';
    const calls = rig();
    const rolls = vi.spyOn(ruleset, 'roll');
    const atk = vi.spyOn(ruleset, 'attack');
    turn(s, stab('guard_1'));
    const vsGuard = against(calls, 'guard_1');
    expect(vsGuard.length).toBeGreaterThan(1); // sight and hearing at least, one contest each
    expect(new Set(vsGuard).size).toBe(vsGuard.length);
    expect(vsGuard.every((k) => k.startsWith(`${SK.combat_stealth} `))).toBe(true);
    // no separate ambush roll: the player's only contest rolls besides the blow's own hit roll are Combat Stealth
    expect(rolls.mock.calls.filter(([r]) => r.contest && r.actorId === 'player' && r.rollKind !== 'hit').every(([r]) => r.skill === SK.combat_stealth)).toBe(true);
    expect(atk.mock.calls[0][0].context?.defenderUnaware).toBe(true);
  });

  it('caught off guard only when every sense loses: a tie on any one is no surprise', () => {
    const ambush = (gaps: number[]) => {
      const s = makeVillage();
      unawareGuard(s);
      s.player.posture = 'stealthy';
      rig({ guard_1: gaps });
      const r = resolveAmbush(s, 'player', 'guard_1', attackOn(s, 'guard_1'), createRng(1)).surprised;
      vi.restoreAllMocks();
      return r;
    };
    expect(ambush([-1, -1, -1])).toBe(true);
    expect(ambush([-1, 0, -1])).toBe(false);
    expect(ambush([0, -1, -1])).toBe(false);
  });

  it('an attacker who is not sneaking rolls the same Combat Stealth contests against someone unaware of it (OQ-4)', () => {
    const s = makeVillage();
    unawareGuard(s);
    const calls = rig();
    const atk = vi.spyOn(ruleset, 'attack');
    turn(s, stab('guard_1'));
    expect(against(calls, 'guard_1')).toContain(`${SK.combat_stealth} ${FN.sight}`);
    expect(atk.mock.calls[0][0].context?.defenderUnaware).toBe(true);
  });

  it('a later blow in the same turn keeps the first result and rolls nothing new', () => {
    const s = makeVillage();
    unawareGuard(s);
    s.player.posture = 'stealthy';
    const calls = rig();
    const ev = attackOn(s, 'guard_1');
    expect(resolveAmbush(s, 'player', 'guard_1', ev, createRng(1)).surprised).toBe(true);
    const n = calls.length;
    expect(n).toBeGreaterThan(0);
    expect(resolveAmbush(s, 'player', 'guard_1', { ...ev, id: 'e2' }, createRng(2)).surprised).toBe(true);
    expect(calls.length).toBe(n);
  });
});
