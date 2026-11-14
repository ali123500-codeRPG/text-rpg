// Wires W6's ScenarioDirector (scenario setup, stage extension) into the pipeline's ScenarioDirector surface,
// with the real Agent Weaver. Each Weaver call is one agent-log entry, so replay can feed the outputs back in order.
import type { CheckinAnswer, Clock, GameEvent, GameState, Rng, StagePlan, WindowAnswer } from '../types';
import type { PlanError } from '../scenario';
import { ScenarioDirector as Director } from '../scenario/director';
import { openingEvents } from '../scenario';
import { applyCheckinPlan, checkinPlanErrors } from '../scenario/checkin';
import type { AgentCtx } from './call';
import type { ScenarioDirector } from './game';
import { runAgent } from './call';
import { FIXED } from './prompts';
import { checkCheckin, checkRegionBrief, checkStagePlan, checkWorldPlan, checkWindow } from './schema';
import { applyCheckin } from '../engine/scenarioEnd';
import { applyWindow } from '../engine/chase';
import { formatWeaverView, formatWorldView } from './format';
import { computePerception } from '../perception';

/** V11 switch: send the rejected plan back with the repair (set by the V11 test) */
export let REPAIR_WITH_PLAN = true;
export function setRepairWithPlan(on: boolean): void { REPAIR_WITH_PLAN = on; }
/** the validator's errors for a repair call, with the rejected plan (V11) */
const repairNote = (errors?: PlanError[], rejected?: StagePlan) => (errors?.length ? `\n\nREPAIR: your previous plan failed validation:\n${errors.filter((e) => !e.repaired).map((e) => `- ${e.code}: ${e.message}`).join('\n')}` +
  (REPAIR_WITH_PLAN && rejected ? `\n\nREJECTED_PLAN:\n${JSON.stringify(rejected)}\n\nReturn the whole plan again with only these errors fixed; keep everything else as it is.` : '') : '');
export function createDirector(clock: Clock): ScenarioDirector {
  let ctx: AgentCtx | null = null; // the context of the turn that owns the next Weaver call
  const ctxOf = new WeakMap<object, AgentCtx>();
  const d = new Director({
    clock,
    weave: async (view, errors, rejected) => {
      // a repair call gets the same view object as its first call: log it under the turn that started that plan,
      // not whatever turn is current when a background extension's repair runs
      const own = ctxOf.get(view) ?? ctx;
      if (!own) return null;
      ctxOf.set(view, own);
      // the validator's errors go into the repair call's input (Agent Weaver: Failed stage plan)
      // V11: the rejected plan comes back with its errors, so the repair edits it instead of starting over
      // a plan that failed validation went outside the options it was given (catalogs, scales, ids): a numbered bug,
      // even when the repair call fixes it
      if (errors?.length) own.reportBug?.('weaver_off_catalog', { errors: errors.filter((e) => !e.repaired).map((e) => ({ code: e.code, message: e.message })) });
      const run = await runAgent<StagePlan>(own, { agent: 'weaver', fixed: FIXED.weaver, data: formatWeaverView(view) + repairNote(errors, rejected), schema: checkStagePlan });
      // SC7: an ending code cannot check is numbered as a bug, so we can look at making it checkable
      const judged = Array.isArray(run.value?.scenario?.endings) ? run.value!.scenario!.endings.filter((e) => e?.when?.kind === 'judged') : [];
      if (judged.length && !errors?.length) own.reportBug?.('scenario_ending_judged', { question: run.value!.scenario!.question, endings: judged.map((e) => ({ as: e.as, text: e.text })) });
      return run.value;
    },
    // WB1: the World builder builds the ground beyond a frontier, with no tier; repairs as for the Weaver
    build: async (view, errors, rejected) => {
      const own = ctxOf.get(view) ?? ctx;
      if (!own) return null;
      ctxOf.set(view, own);
      if (errors?.length) own.reportBug?.('weaver_off_catalog', { agent: 'world', errors: errors.filter((e) => !e.repaired).map((e) => ({ code: e.code, message: e.message })) });
      const run = await runAgent<StagePlan>(own, { agent: 'world', fixed: FIXED.world, data: formatWorldView(view) + repairNote(errors, rejected), schema: checkWorldPlan });
      return run.value;
    },
    // WZ2/WB8: the region brief, the World builder's first call, once per region, logged under the turn that needed the land
    region: async (view) => {
      const own = ctx;
      if (!own) return null;
      const run = await runAgent<Record<string, unknown>>(own, { agent: 'world', fixed: FIXED.region, data: `REGION_VIEW:\n${JSON.stringify(view)}`, schema: checkRegionBrief });
      return run.value;
    },
    // SC8: a background check-in, logged under the turn whose save started it
    checkin: async (view) => {
      const own = ctx;
      if (!own) return null;
      const run = await runAgent<CheckinAnswer>(own, { agent: 'weaver', fixed: FIXED.checkin, data: formatWeaverView(view), schema: checkCheckin });
      return run.value;
    },
    // WB6: a background window call, logged under the turn whose save started it
    window: async (view) => {
      const own = ctx;
      if (!own) return null;
      const run = await runAgent<WindowAnswer>(own, { agent: 'weaver', fixed: FIXED.window, data: formatWeaverView(view), schema: checkWindow });
      return run.value;
    },
  });
  return {
    async startStory(state: GameState, rng: Rng, c: AgentCtx): Promise<GameEvent[]> {
      ctx = c;
      const r = await d.storyStart(state, rng);
      (state.scratch ??= {}).eventRoll = r.eventRoll; // put on the turn record by the pipeline (spec: record holds the event roll)
      return r.events;
    },
    async afterResolve(state: GameState, events: GameEvent[], rng: Rng, c: AgentCtx): Promise<GameEvent[]> {
      const key = state.scratch?.frontierCrossed as string | undefined;
      if (!key) {
        d.applyBuiltAhead(state, rng); // NW3: ground an NPC is heading into, built in the background, goes on the stage
        d.applyRegionsDrawn(state); // WZ18: the land beyond the edge, asked for in the background
        // SC8: a check-in that came back since the last turn: applied now, to the scenario it was about
        const ci = d.takeCheckin();
        if (ci) applyCheckin(state, ci.number, ci.answer, events, { errors: (a) => checkinPlanErrors(state, a), apply: (a) => applyCheckinPlan(state, a, rng) });
        const w = d.takeWindow(); // WB6: the Weaver's answer to the last window: start now, or not now
        if (w !== undefined) applyWindow(state, w);
        // scenarioBreak (P7, D-30): rest, a beat that ends the scenario, or a stall. A frontier crossing goes first; the break waits a turn.
        if (!state.stage.breakCause) return [];
        ctx = c;
        const r = await d.startScenario(state, rng, 'open');
        (state.scratch ??= {}).eventRoll = r.eventRoll;
        return openingEvents(state, rng);
      }
      ctx = c;
      delete (state.scratch as Record<string, unknown>).frontierCrossed;
      const r = await d.cross(state, key, rng, state.player.posture === 'stealthy' ? 'stealthy' : 'open');
      d.applyBuiltAhead(state, rng); // NW3
      d.applyRegionsDrawn(state); // WZ18
      // BG-73: the crossing's move event ends where the player now stands, so it reads as leaving for the new zone
      const crossed = events.find((e) => e.kind === 'move' && e.actorId === state.player.id && e.effects.some((f) => f.kind === 'frontier_crossed' && f.data.frontier === key));
      if (crossed && state.player.zone !== crossed.zone) Object.assign(crossed, { fromZone: crossed.zone, fromPos: crossed.pos, zone: state.player.zone, pos: state.player.pos, target: state.player.zone });
      // BG-90: those who followed the player through come in with them: a move event each, so the story shows them along
      const follows = (r.followed ?? []).map((id): GameEvent => {
        const ev: GameEvent = { id: `t${state.turn}_follow_${id}`, turn: state.turn, actorId: id, kind: 'move', zone: state.player.zone, ...(crossed?.fromZone ? { fromZone: crossed.fromZone } : {}), effects: [], noise: 'quiet', visibility: 'normal', perception: {} };
        ev.perception = computePerception(ev, state, rng);
        return ev;
      });
      if (!r.eventRoll) return follows;
      // a crossing that also started a scenario (none does now: WB5), kept so one could
      (state.scratch ??= {}).eventRoll = r.eventRoll;
      return [...follows, ...openingEvents(state, rng)];
    },
    afterSave(state: GameState, c: AgentCtx): void {
      ctx = c;
      d.afterSave(state);
    },
  };
}
