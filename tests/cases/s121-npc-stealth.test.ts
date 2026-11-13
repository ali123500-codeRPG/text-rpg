// 121 NPC stealth (NS1–NS10): NPCs sneak, hide and vanish by the player's rules. The player is an observer
// like any other and keeps a belief about each stealthy NPC; a stealthy NPC can ambush the player; a companion following
// the player copies the player's posture; the village thief prowls stealthily.
import { TP } from '../../src/library/templateIds';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRng, makeVillage, place, byDoor, beside } from '../harness';
import { resolveTurn } from '../../src/engine';
import { ruleset } from '../../src/ruleset';
import { spawnNpc } from '../../src/library/spawn';
import { installRoutines } from '../../src/minds';
import { buildPlayerView } from '../../src/views';
import type { Actor, ContestResult, GameState, Intent, NpcAction, RollRequest } from '../../src/types';
import { SK } from '../../src/library/skillIds';
import { PK } from '../../src/library/perkIds';

const hold: Intent = { move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, action: null };
const act = (type: NpcAction['type'], target: string | null = null, extra: Partial<NpcAction> = {}): NpcAction =>
  ({ type, target, skill: null, targetPart: null, aimed: false, defense: null, item: null, mode: null, intent: '', ...extra });
const turn = (s: GameState, orders: Record<string, NpcAction> = {}, i: Intent = hold) => {
  s.turn += 1;
  const agentOutputs = Object.entries(orders).map(([actorId, action]) =>
    ({ agent: 'planner', actorId, output: { action, dialogue: null, gear: null, stance: null, planUpdate: null } }) as never);
  return resolveTurn(s, { intent: i, aimed: false, agentOutputs, spokespeople: [] }, createRng(1));
};
/** forces each stealth contest's gap by observer id (others: the sneak wins); records the requests */
function rig(gaps: Record<string, number | number[]> = {}) {
  const calls: [RollRequest, RollRequest][] = [];
  const real = ruleset.contested;
  vi.spyOn(ruleset, 'contested').mockImplementation((a, b, st, rng) => {
    if (a.rollKind !== 'stealth') return real(a, b, st, rng);
    calls.push([a, b]);
    const r = real(a, b, st, rng);
    const g = gaps[b.actorId] ?? -1;
    const gap = Array.isArray(g) ? g.shift() ?? -1 : g;
    return { ...r, gap, winner: gap < 0 ? 'a' : gap > 0 ? 'b' : 'tie' } as ContestResult;
  });
  return calls;
}
function thief(s: GameState, zone: string, routineSet?: string): Actor {
  const t = spawnNpc(null, TP.thief, { id: 'thief_1', zone, placeId: 'street', bandId: 'thieves', name: 'Nell', storyId: 'test' });
  s.bands.push({ ...s.bands[0], id: 'thieves', name: 'the light-fingered', relations: {} });
  if (routineSet) installRoutines(t, routineSet, { route: ['street_square', 'street_door'], refuge: 'street_door' }, undefined, s.turn, createRng(1));
  s.actors.push(t);
  return place(s, 'thief_1', zone);
}
const seen = (s: GameState) => s.player.journal?.stealthSeen?.thief_1;
const inView = (s: GameState) => buildPlayerView(s).actors.find((x) => x.id === 'thief_1');

afterEach(() => vi.restoreAllMocks());

describe('121 NPC stealth', () => {
  it('NS7: the village thief has the stealth skills and a stealthy prowl', () => {
    const s = makeVillage();
    place(s, 'player', 'gate_inner');
    const t = thief(s, 'street_square', 'thief');
    expect(t.core.skills[SK.sneaking]?.raw).toBeGreaterThanOrEqual(40);
    expect(t.mind?.routine?.id).toBe('prowl');
    rig({ player: -1 });
    turn(s);
    expect(t.posture).toBe('stealthy');
  });

  it('NS2: an NPC that sneaks while you see it stays seen; one that sneaks out of sight is not', () => {
    const s = makeVillage();
    place(s, 'player', 'street_square');
    const t = thief(s, 'street_square');
    rig({ player: -1 });
    turn(s, { thief_1: act('sneak') });
    expect(t.posture).toBe('stealthy');
    expect(seen(s)).toBe('aware'); // ST12: going stealthy shakes off no one who sees you
    expect(inView(s)?.level).toBe('full');
    place(s, 'player', 'tav_cellar');
    t.posture = 'open';
    delete s.player.journal!.stealthSeen;
    turn(s, { thief_1: act('sneak') });
    expect(seen(s)).toBe('unaware');
  });

  it('NS3: you contest a stealthy NPC that comes into view; lose and it is not shown, win and it is', () => {
    const s = makeVillage();
    place(s, 'player', 'street_square');
    const t = thief(s, 'gate_inner');
    byDoor(s, 'thief_1', 'gate_inner', 'street_square', 1); // a step from the square
    t.posture = 'stealthy';
    s.player.journal!.stealthSeen = { thief_1: 'unaware' };
    const calls = rig({ player: -1 });
    const ev = turn(s, { thief_1: act('move', 'street_square') });
    expect(t.zone).toBe('street_square');
    expect(calls.some(([a, b]) => a.actorId === 'thief_1' && a.skill === SK.sneaking && b.actorId === 'player')).toBe(true);
    expect(seen(s)).toBe('unaware');
    expect(inView(s)).toBeUndefined();
    expect(ev.find((e) => e.actorId === 'thief_1')?.perception.player).toBeUndefined();
    vi.restoreAllMocks();
    rig({ player: 1 });
    const won = turn(s, { thief_1: act('hide') });
    expect(seen(s)).toBe('aware');
    expect(inView(s)?.level).toBe('full');
    expect(won.find((e) => e.actorId === 'thief_1' && e.kind === 'hide')?.perception.player).toBeDefined(); // BG-64: the deed you spot them by is told
  });

  it('NS4: a tie leaves you suspicious: you half see someone', () => {
    const s = makeVillage();
    place(s, 'player', 'street_square');
    const t = thief(s, 'street_square');
    t.posture = 'stealthy';
    s.player.journal!.stealthSeen = { thief_1: 'unaware' };
    rig({ player: 0 });
    turn(s, { thief_1: act('hide') });
    expect(seen(s)).toBe('suspicious');
    expect(inView(s)).toMatchObject({ label: 'someone', level: 'partial' });
  });

  it('NS10: an NPC vanishes from you; with Unblinking you also need beating at Sneaking', () => {
    const s = makeVillage();
    place(s, 'player', 'street_square');
    thief(s, 'street_square');
    byDoor(s, 'thief_1', 'street_square', 'street_door', 1); // a step from the street outside the tavern
    rig({ player: -1 });
    turn(s, { thief_1: act('vanish', 'street_door') });
    expect(s.actors.find((a) => a.id === 'thief_1')!.zone).toBe('street_door');
    expect(seen(s)).toBe('suspicious');

    const s2 = makeVillage();
    place(s2, 'player', 'street_square');
    thief(s2, 'street_square');
    byDoor(s2, 'thief_1', 'street_square', 'street_door', 1);
    s2.player.core.perks.push({ perkId: PK.unblinking, source: 'level', gainedTurn: 0 });
    const calls = rig({ player: [-1, 1] });
    turn(s2, { thief_1: act('vanish', 'street_door') });
    expect(calls.filter(([, b]) => b.actorId === 'player').map(([a]) => a.skill)).toEqual([SK.vanishing, SK.sneaking]);
    expect(seen(s2)).toBe('aware');
  });

  it('NS5: guards contest a stealthy NPC too; speaking aloud ends its stealth', () => {
    const s = makeVillage();
    place(s, 'player', 'tav_cellar');
    const t = thief(s, 'street_square');
    t.posture = 'stealthy';
    const calls = rig({ guard_1: -1 });
    turn(s, { thief_1: act('move', 'gate_inner') });
    expect(calls.some(([, b]) => b.actorId === 'guard_1')).toBe(true);
    expect(s.actors.find((a) => a.id === 'guard_1')!.mind!.knowledge.thief_1?.status ?? 'unaware').toBe('unaware');
    s.player.journal!.stealthSeen = { thief_1: 'unaware' };
    s.turn += 1;
    resolveTurn(s, { intent: hold, aimed: false, spokespeople: [], agentOutputs: [
      { agent: 'planner', actorId: 'thief_1', output: { action: act('hold'), dialogue: { line: 'Evening!', volume: 'normal' }, gear: null, stance: null, planUpdate: null } } as never,
    ] }, createRng(1));
    expect(t.posture).toBe('open');
    expect(seen(s)).toBeUndefined();
  });

  it('NS6: a stealthy NPC ambushes you; the blow shows it', () => {
    const s = makeVillage();
    place(s, 'player', 'street_square');
    const t = thief(s, 'street_square');
    beside(s, 'thief_1'); // within a blade's reach
    t.posture = 'stealthy';
    s.player.journal!.stealthSeen = { thief_1: 'unaware' };
    rig({ player: -1 });
    const real = ruleset.roll;
    vi.spyOn(ruleset, 'roll').mockImplementation((req, st, rng) => {
      const r = real(req, st, rng);
      return req.rollKind === 'perception' && req.actorId === 'player' ? { ...r, tier: 'critical_failure' } : req.actorId === 'thief_1' ? { ...r, tier: 'critical_success' } : r;
    });
    const atk = vi.spyOn(ruleset, 'attack');
    turn(s, { thief_1: act('attack', 'player') });
    expect(atk.mock.calls[0][0].context?.defenderUnaware).toBe(true);
    expect(t.posture).toBe('open');
    expect(seen(s)).toBeUndefined();
    expect(inView(s)?.level).toBe('full');
  });

  it('NS9: a companion following you goes stealthy with you', () => {
    const s = makeVillage();
    place(s, 'player', 'street_square');
    const c = spawnNpc(null, TP.guard, { id: 'friend', zone: 'street_square', placeId: 'street', bandId: s.player.bandId, name: 'Rook', storyId: 'test' });
    installRoutines(c, 'companion', {}, undefined, s.turn, createRng(1));
    s.actors.push(c);
    rig();
    turn(s, {}, { ...hold, action: { type: 'sneak', skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance: 'normal' } });
    expect(s.player.posture).toBe('stealthy');
    expect(c.posture).toBe('stealthy');
    turn(s, {}, { ...hold, spoken: 'Now!' , action: { type: 'other', skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance: 'normal' } });
    expect(s.player.posture).toBe('open');
    expect(c.posture).toBe('open');
  });
});
