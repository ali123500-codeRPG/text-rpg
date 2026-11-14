// 207 NW2, NW7, NW1: an agent's "go there" survives the hand-off. The Planner, Responder or Voice names headTo (a zone
// or frontier further than one move); code switches the NPC to the shared head_to routine, walks it there one way at a
// time with no more calls, then puts it back on the routine it had. A Weaver plan never makes a reused actor jump (NW7),
// and a yielded foe walks to its exit at the scenario's end (NW1).
import { describe, expect, it } from 'vitest';
import type { GameState, Intent, PlannerOutput } from '../../src/types';
import { createRng, makeVillage } from '../harness';
import { resolveTurn } from '../../src/engine';
import { buildActorView } from '../../src/views';
import { headTo, routineOrder, HEAD_TO } from '../../src/minds';
import { checkPlanner, checkVoice } from '../../src/agents/schema';
import { applyStagePlan } from '../../src/scenario/apply';
import type { StagePlan } from '../../src/types';

const away = () => makeVillage({ playerZone: 'field_edge', without: ['slime_1', 'slime_2', 'patron_1'] });
const idle: Intent = { move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, action: null };
const turn = (s: GameState, outputs: { actorId: string; output: Partial<PlannerOutput> }[] = []) => {
  s.turn += 1;
  return resolveTurn(s, {
    intent: idle, aimed: false, spokespeople: [],
    agentOutputs: outputs.map((o) => ({ agent: 'planner' as const, actorId: o.actorId, output: { action: { type: 'hold', target: null, skill: null, targetPart: null, aimed: false, defense: null, item: null, mode: null, intent: 'hold' }, dialogue: null, gear: null, stance: null, planUpdate: null, ...o.output } })),
  }, createRng(1));
};
const guard = (s: GameState) => s.actors.find((a) => a.id === 'guard_1')!;

describe('207 head_to (NW2, NW7, NW1)', () => {
  it('NW2: the agent names headTo; code walks the guard there on later turns, then it goes back to its routine', () => {
    const s = away();
    const g = guard(s);
    const before = { ...g.mind!.routine! };
    turn(s, [{ actorId: g.id, output: { headTo: 'tav_cellar' } }]);
    expect(g.mind!.routine!.id).toBe(HEAD_TO);
    expect(g.mind!.slots!.dest).toBe('tav_cellar');
    expect(g.mind!.headBack).toEqual(before);
    // NW11: a minute's turn is time enough to walk the five ways there (the village's zones have no size, so each way is
    // one link of metres); it arrives within the turn
    expect(g.zone).toBe('gate_inner');
    for (let i = 0; i < 3 && !s.log.some((l) => l.code === 'head_to_arrived'); i++) turn(s);
    expect(s.log.some((l) => l.code === 'head_to_arrived' && l.detail?.zone === 'tav_cellar')).toBe(true);
    // arrived: back on its own routine (the old anchor kept), dest unbound; from there the routine walks it home
    expect(g.mind!.routine).toEqual(before);
    expect(g.mind!.slots!.dest).toBeUndefined();
    expect(g.mind!.headBack).toBeUndefined();
    expect(s.log.some((l) => l.code === 'head_to_arrived')).toBe(true);
  });
  it('NW2: a place not on the stage is refused and logged; the routine is kept', () => {
    const s = away();
    const g = guard(s);
    const before = { ...g.mind!.routine! };
    expect(headTo(s, g, 'the_moon')).toBe(false);
    expect(g.mind!.routine).toEqual(before);
    expect(s.log.some((l) => l.code === 'invalid_head_to')).toBe(true);
  });
  it('NW2: bound for a frontier, it walks to the zone with the way in and steps into it from there', () => {
    const s = away();
    const g = guard(s);
    g.zone = 'field_mid'; g.placeId = 'field';
    expect(headTo(s, g, 'woods')).toBe(true);
    expect(routineOrder(buildActorView(s, g.id))).toMatchObject({ type: 'move', target: 'field_far' });
    g.zone = 'field_far';
    expect(routineOrder(buildActorView(s, g.id))).toMatchObject({ type: 'move', target: 'woods' });
  });
  it('NW2: headTo is part of the Planner, Responder and Voice outputs', () => {
    const action = { type: 'hold', target: null, skill: null, targetPart: null, aimed: false, defense: null, item: null, mode: null, intent: 'hold' };
    expect(checkPlanner({ action, dialogue: null, gear: null, stance: null, planUpdate: null, headTo: 'tav_cellar' }).value.headTo).toBe('tav_cellar');
    expect(checkVoice({ action, line: 'off I go', volume: 'normal', shares: [], gear: null, stance: null, routine: null, headTo: 'woods' }).value.headTo).toBe('woods');
  });
  it('NW7: a reused actor out of the player\'s perception walks to its new start; one in view stays put', () => {
    const s = makeVillage({ playerZone: 'tav_cellar', without: ['slime_1', 'slime_2', 'patron_1'] }); // far from the gate
    const g = guard(s);
    const plan = (zone: string): StagePlan => ({
      event: { summary: 's', challenge: 'minor', gain: 'minor' }, places: [], zones: [], frontiers: [], bands: [], rewards: [], hiddenTerms: [], weaverNote: '',
      seeds: { plans: [], triggers: [], secrets: [] },
      cast: [{ actor: 'guard_1', key: 'guard_1', label: 'a village guard', name: 'Bertram', appearance: 'stocky', band: 'village_watch', routineSetId: 'gate_guard',
        slots: { post: zone }, awarenessOfPlayer: 'unaware', motive: 'keeps the peace' }],
    } as unknown as StagePlan);
    const p = plan('tav_common');
    applyStagePlan(s, p, { kind: 'scenario', tier: 'success', placeId: 'tavern' }, { entry: 'open' }, createRng(1));
    expect(g.zone).toBe('gate_inner'); // no jump
    expect(g.mind!.routine!.id).toBe(HEAD_TO);
    expect(g.mind!.slots!.dest).toBe('tav_common');
    // the player stands by the gate and sees the guard: no head_to, and still no jump
    const s2 = makeVillage({ playerZone: 'gate_inner', without: ['slime_1', 'slime_2', 'patron_1'] });
    applyStagePlan(s2, plan('tav_common'), { kind: 'scenario', tier: 'success', placeId: 'tavern' }, { entry: 'open' }, createRng(1));
    expect(guard(s2).zone).toBe('gate_inner');
    expect(guard(s2).mind!.routine!.id).toBe('guard_post');
  });
  it('NW1: a yielded foe walks to its exit at the scenario\'s end instead of appearing there', async () => {
    const s = away();
    const g = guard(s);
    (g.mind!.overrides ??= {}).player = 'yielded';
    g.mind!.slots = { ...g.mind!.slots, exit: 'street_door' };
    const { beginScenario } = await import('../../src/scenario/apply');
    beginScenario(s, 'success');
    expect(g.zone).toBe('gate_inner');
    expect(g.mind!.routine!.id).toBe(HEAD_TO);
    expect(g.mind!.slots!.dest).toBe('street_door');
  });
});
