// Wires W6's SceneDirector (scene setup, stage extension) into the pipeline's SceneDirector surface,
// with the real Agent Weaver. Each Weaver call is one agent-log entry, so replay can feed the outputs back in order.
import type { Clock, GameEvent, GameState, Rng, StagePlan } from '../types';
import { SceneDirector as Director } from '../scene/director';
import { openingEvents } from '../scene';
import type { AgentCtx } from './call';
import type { SceneDirector } from './game';
import { runAgent } from './call';
import { FIXED } from './prompts';
import { checkStagePlan } from './schema';
import { formatWeaverView } from './format';

/** V11 switch: send the rejected plan back with the repair (set by the V11 test) */
export let REPAIR_WITH_PLAN = true;
export function setRepairWithPlan(on: boolean): void { REPAIR_WITH_PLAN = on; }
export function createDirector(clock: Clock): SceneDirector {
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
      const note = errors?.length ? `\n\nREPAIR: your previous plan failed validation:\n${errors.filter((e) => !e.repaired).map((e) => `- ${e.code}: ${e.message}`).join('\n')}` +
        (REPAIR_WITH_PLAN && rejected ? `\n\nREJECTED_PLAN:\n${JSON.stringify(rejected)}\n\nReturn the whole plan again with only these errors fixed; keep everything else as it is.` : '') : '';
      const run = await runAgent<StagePlan>(own, { agent: 'weaver', fixed: FIXED.weaver, data: formatWeaverView(view) + note, schema: checkStagePlan });
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
    async afterResolve(state: GameState, _events: GameEvent[], rng: Rng, c: AgentCtx): Promise<GameEvent[]> {
      const key = state.scratch?.frontierCrossed as string | undefined;
      if (!key) {
        // sceneBreak (P7, D-30): rest, a beat that ends the scene, or a stall. A frontier crossing goes first; the break waits a turn.
        if (!state.stage.breakCause) return [];
        ctx = c;
        const r = await d.startScene(state, rng, 'open');
        (state.scratch ??= {}).eventRoll = r.eventRoll;
        return openingEvents(state, rng);
      }
      ctx = c;
      delete (state.scratch as Record<string, unknown>).frontierCrossed;
      await d.cross(state, key, rng, state.player.posture === 'stealthy' ? 'stealthy' : 'open');
      return [];
    },
    afterSave(state: GameState, c: AgentCtx): void {
      ctx = c;
      d.afterSave(state);
    },
  };
}
