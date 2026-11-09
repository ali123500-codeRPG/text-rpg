// Shared setup for W7's scenario tests: the village fixture, ScriptedClaude on a VirtualClock, the real pipeline.
import type { GameState, Intent, NarratorOutput } from '../../src/types';
import { makeVillage, ScriptedClaude, type VillageOpts } from '../harness';
import { createGame, VirtualClock } from '../../src/agents';
import { memoryStore } from '../../src/save';
import { SK } from '../../src/library/skillIds';

export function setupGame(opts: VillageOpts & { engaged?: string[] } = {}) {
  const clock = new VirtualClock();
  const claude = new ScriptedClaude(clock);
  const store = memoryStore();
  const game = createGame({ client: claude, clock, store });
  const state = makeVillage(opts);
  for (const a of state.actors) if (opts.engaged?.includes(a.id)) a.mind!.control = 'agent';
  state.pending = { turn: state.turn, mode: opts.engaged?.length ? 'tactical' : 'explore', engaged: opts.engaged ?? [], fired: [] };
  state.mode = state.pending.mode;
  return { clock, claude, store, game, state, start: () => game.adopt(state) };
}

export const intent = (over: Partial<Intent> = {}): Intent => ({
  move: null,
  action: { type: 'observe', skill: SK.eyesight, target: null, targetPart: null, item: null, mode: null, approach: 'quietly', stance: 'normal' },
  gear: null, spoken: null, addressees: null, deferred: [], clarify: null, ...over,
});

export const speech = (type: 'talk' | 'persuade' | 'deceive', to: string, spoken: string, over: Partial<NonNullable<Intent['action']>> = {}): Intent =>
  intent({
    action: { type, skill: SK.persuasion, target: to, targetPart: null, item: null, mode: null, approach: 'with a crooked grin', stance: 'normal', ...over },
    spoken, addressees: [to],
  });

/** a narration that lists every event of its NarrationView (read from the request) */
export function narrateAll(text = 'The room is quiet.') {
  return (req: { input: { content: string }[] }) => {
    const data = req.input[1].content;
    const view = JSON.parse(data.slice(data.indexOf('NARRATION_VIEW:\n') + 16)) as { events: { id: string }[] };
    const value: NarratorOutput = { text, narrated: view.events.map((e) => e.id) };
    return { ok: true as const, value };
  };
}

export function npcAction(type: string, target: string | null, over: Record<string, unknown> = {}) {
  return { type, target, skill: null, targetPart: null, aimed: false, defense: null, item: null, mode: null, intent: 'act', ...over };
}

export type { GameState };
