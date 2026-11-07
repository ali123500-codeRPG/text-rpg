// Wires W6's SceneDirector (scene setup, stage extension) into the pipeline's SceneDirector surface,
// with the real Agent Weaver. Each Weaver call is one agent-log entry, so replay can feed the outputs back in order.
import type { Clock, GameEvent, GameState, Rng, StagePlan } from '../types';
import { SceneDirector as Director } from '../scene/director';
import type { AgentCtx } from './call';
import type { SceneDirector } from './game';
import { runAgent } from './call';
import { FIXED } from './prompts';
import { checkStagePlan } from './schema';
import { formatWeaverView } from './format';

export function createDirector(clock: Clock): SceneDirector {
  let ctx: AgentCtx | null = null; // the context of the turn that owns the next Weaver call
  const d = new Director({
    clock,
    weave: async (view, errors) => {
      if (!ctx) return null;
      // the validator's errors go into the repair call's input (Agent Weaver: Failed stage plan)
      const note = errors?.length ? `\n\nREPAIR: your previous plan failed validation:\n${errors.map((e) => `- ${e.code}: ${e.message}`).join('\n')}` : '';
      const run = await runAgent<StagePlan>(ctx, { agent: 'weaver', fixed: FIXED.weaver, data: formatWeaverView(view) + note, schema: checkStagePlan });
      return run.value;
    },
  });
  return {
    async startStory(state: GameState, rng: Rng, c: AgentCtx): Promise<GameEvent[]> {
      ctx = c;
      return (await d.storyStart(state, rng)).events;
    },
    async afterResolve(state: GameState, _events: GameEvent[], rng: Rng, c: AgentCtx): Promise<GameEvent[]> {
      const key = state.scratch?.frontierCrossed as string | undefined;
      if (!key) return []; // sceneBreak has no caller yet (D-30): a story is one scene
      ctx = c;
      delete (state.scratch as Record<string, unknown>).frontierCrossed;
      await d.cross(state, key, rng);
      return [];
    },
    afterSave(state: GameState, c: AgentCtx): void {
      ctx = c;
      d.afterSave(state);
    },
  };
}
