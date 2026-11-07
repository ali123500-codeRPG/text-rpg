// The six agent wrappers: build the two-turn input from the agent's own view, validate, repair once, fall back.
import type {
  DialogueInput, DialogueView, Intent, NarrationView, NarratorOutput, NpcAction, OppositionView,
  PlannerOutput, PlayerView, ResponderOutput, StagePlan, VoiceOutput, WeaverView,
} from '../types';
import { FIXED } from './prompts';
import { checkIntent, checkNarrator, checkPlanner, checkResponder, checkStagePlan, checkVoice } from './schema';
import { formatDialogueView, formatNarrationView, formatOppositionView, formatPlayerView, formatResponderInput, formatWeaverView } from './format';
import { checkNpcLegality, checkParserLegality, illegalClarify, routineAllowed, type NpcViewBase } from './legality';
import { fallbackNarration, factCheck, leakScan, mentions, type LeakContext } from './narration';
import { runAgent, type AgentCtx, type Attempt, type RunResult } from './call';

export const GENERIC_CLARIFY = 'What do you do?';

// ---------------- Parser ----------------

export type ParserResult = { intent: Intent | null; clarify: string | null; run: RunResult<Intent> };

/** PlayerView only. A clarify, an illegal target/item/skill or a failed call stops the turn with a question. */
export async function callParser(text: string, view: PlayerView, ctx: AgentCtx, opts: { bandIds?: string[] } = {}): Promise<ParserResult> {
  const run = await runAgent<Intent>(ctx, { agent: 'parser', fixed: FIXED.parser, data: formatPlayerView(text, view), schema: checkIntent });
  if (!run.value) return { intent: null, clarify: GENERIC_CLARIFY, run };
  if (run.value.clarify) return { intent: null, clarify: run.value.clarify, run };
  const leg = checkParserLegality(run.value, view, opts.bandIds);
  if (leg.gearErrors.length) run.log.errors.push('invalid_gear');
  if (leg.illegal.length) {
    run.log.errors.push('illegal_intent', ...leg.illegal);
    return { intent: null, clarify: illegalClarify(leg.illegal, view) ?? GENERIC_CLARIFY, run };
  }
  run.log.output = leg.intent;
  return { intent: leg.intent, clarify: null, run };
}

// ---------------- Planner ----------------

/** shared NPC post-checks: target legality (drop), gear/stance/introduces, routine switch */
function npcAccept<T extends { action: NpcAction; gear: PlannerOutput['gear']; stance: PlannerOutput['stance'] }>(
  view: NpcViewBase, world: Set<string>, value: T, getIntro: (v: T) => string[] | undefined, setIntro: (v: T, ids: string[]) => void,
  alsoKnown: string[] = [],
): { orderError: string | null; errors: string[] } {
  const box = { action: value.action, gear: value.gear, stance: value.stance, introduces: getIntro(value) };
  const leg = checkNpcLegality(box, view, world, alsoKnown);
  value.gear = box.gear;
  value.stance = box.stance;
  if (box.introduces) setIntro(value, box.introduces);
  return leg;
}

export type PlannerCallOpts = { signal?: AbortSignal; world: Set<string> };

/** OppositionView. null = no usable order (the engine runs the type's combat list). */
export async function callPlanner(view: OppositionView, ctx: AgentCtx, opts: PlannerCallOpts): Promise<RunResult<PlannerOutput>> {
  let pending: string[] = [];
  const accept = (v: PlannerOutput): Attempt<PlannerOutput> => {
    const leg = npcAccept(view, opts.world, v, (x) => x.dialogue?.introduces, (x, ids) => x.dialogue && (x.dialogue.introduces = ids));
    if (leg.orderError) return { kind: 'fail', errors: [leg.orderError, ...leg.errors] };
    const errors = [...leg.errors];
    if (v.planUpdate) {
      if (!routineAllowed(view, v.planUpdate.routine)) {
        errors.push('invalid_routine');
        v.planUpdate.routine = null;
      }
      v.planUpdate.triggers = v.planUpdate.triggers.map((t) => ({ ...t, ownerId: view.self.id }));
    }
    pending = errors;
    return { kind: 'ok', value: v };
  };
  const run = await runAgent(ctx, {
    agent: 'planner', actorId: view.self.id, fixed: FIXED.planner, data: formatOppositionView(view), signal: opts.signal, schema: checkPlanner, accept,
  });
  if (run.value) run.log.errors.push(...pending);
  return run;
}

// ---------------- Responder and Voice ----------------

export const NEUTRAL_LINE = 'I have nothing to say about that.'; // GAP: the sheet has no neutral line; one fixed placeholder

function neutralAction(view: NpcViewBase): NpcAction {
  const target = view.beliefs.some((b) => b.about === 'player') ? 'player' : null;
  return { type: 'talk', target, skill: null, targetPart: null, aimed: false, defense: null, item: null, mode: null, intent: 'reply' };
}
export function fallbackResponder(view: NpcViewBase): ResponderOutput {
  return { action: neutralAction(view), dialogue: { line: NEUTRAL_LINE, volume: 'normal' }, gear: null, stance: null, planUpdate: null, reveals: [] };
}
export function fallbackVoice(view: NpcViewBase): VoiceOutput {
  return { action: neutralAction(view), line: NEUTRAL_LINE, volume: 'normal', shares: [], gear: null, stance: null, routine: null };
}

export type DialogueResult<T> = { output: T; run: RunResult<T> };

/** OppositionView + this turn's words and impression; COMMITTED and SLIPS from code. Never fails: a neutral reply. */
export async function callResponder(
  view: OppositionView, dialogue: DialogueInput, ctx: AgentCtx,
  opts: { world: Set<string>; committed?: string | null; slips?: string[]; signal?: AbortSignal },
): Promise<DialogueResult<ResponderOutput> & { unlisted: string[] }> {
  let extra: string[] = [];
  let unlisted: string[] = [];
  const accept = (v: ResponderOutput): Attempt<ResponderOutput> => {
    const leg = npcAccept(view, opts.world, v, (x) => x.dialogue?.introduces, (x, ids) => x.dialogue && (x.dialogue.introduces = ids), ['player']); // a spokesperson answers the speaker it just heard
    if (leg.orderError) return { kind: 'fail', errors: [leg.orderError, ...leg.errors] };
    extra = [...leg.errors];
    const own = new Set(view.secrets.map((s) => s.id));
    if (v.reveals.some((id) => !own.has(id))) extra.push('invalid_reveal');
    v.reveals = v.reveals.filter((id) => own.has(id));
    // Q3: a line that says an own secret's leak terms reveals it even when unlisted (slips are revealed by code anyway)
    const line = v.dialogue?.line ?? '';
    unlisted = view.secrets.filter((x) => !v.reveals.includes(x.id) && !(opts.slips ?? []).includes(x.id) && x.leakTerms.some((t) => mentions(line, t))).map((x) => x.id);
    if (unlisted.length) {
      extra.push('unlisted_reveal');
      v.reveals = [...v.reveals, ...unlisted];
    }
    if (v.planUpdate) {
      if (!routineAllowed(view, v.planUpdate.routine)) {
        extra.push('invalid_routine');
        v.planUpdate.routine = null;
      }
      v.planUpdate.triggers = v.planUpdate.triggers.map((t) => ({ ...t, ownerId: view.self.id }));
    }
    return { kind: 'ok', value: v };
  };
  const run = await runAgent(ctx, {
    agent: 'responder', actorId: view.self.id, fixed: FIXED.responder,
    data: formatResponderInput(view, dialogue, opts.committed ?? null, opts.slips ?? []),
    signal: opts.signal, schema: checkResponder, accept,
  });
  if (run.value) {
    run.log.errors.push(...extra);
    return { output: run.value, run, unlisted };
  }
  const output = fallbackResponder(view);
  run.log.output = output;
  return { output, run, unlisted: [] };
}

/**
 * DialogueView only. shares must be ⊆ KNOWS and the line may name no one outside the view: regenerate once, then a neutral line.
 * names: actor and place names the code knows of (checked against the view's own text).
 */
export async function callVoice(
  view: DialogueView, ctx: AgentCtx, opts: { world: Set<string>; names?: string[]; signal?: AbortSignal },
): Promise<DialogueResult<VoiceOutput>> {
  const viewText = JSON.stringify(view);
  let extra: string[] = [];
  const accept = (v: VoiceOutput): Attempt<VoiceOutput> => {
    const leg = npcAccept(view, opts.world, v, (x) => x.introduces, (x, ids) => (x.introduces = ids), ['player']); // a spokesperson answers the speaker it just heard
    if (leg.orderError) return { kind: 'fail', errors: [leg.orderError, ...leg.errors] };
    const knows = new Set(view.knows.map((f) => f.id));
    const badShares = v.shares.filter((id) => !knows.has(id));
    const badNames = (opts.names ?? []).filter((n) => mentions(v.line, n) && !mentions(viewText, n));
    if (badShares.length || badNames.length) {
      const errors = [...(badShares.length ? ['invalid_share', ...badShares] : []), ...(badNames.length ? ['voice_leak'] : [])];
      const note = [
        badShares.length ? `"shares" lists ids not in KNOWS (${badShares.join(', ')})` : '',
        badNames.length ? 'the line names someone or something that is not in DIALOGUE_VIEW or KNOWS' : '',
      ].filter(Boolean).join('; ');
      return { kind: 'retry', errors, note };
    }
    extra = [...leg.errors];
    if (!routineAllowed(view, v.routine)) {
      extra.push('invalid_routine');
      v.routine = null;
    }
    return { kind: 'ok', value: v };
  };
  const run = await runAgent(ctx, { agent: 'voice', actorId: view.self.id, fixed: FIXED.voice, data: formatDialogueView(view), signal: opts.signal, schema: checkVoice, accept });
  if (run.value) {
    run.log.errors.push(...extra);
    return { output: run.value, run };
  }
  const output = fallbackVoice(view);
  run.log.output = output;
  return { output, run };
}

// ---------------- Narrator ----------------

/** NarrationView only. Leak scan + fact check; regenerate once with a note; then the templated fallback. */
export async function callNarrator(view: NarrationView, ctx: AgentCtx, leak: LeakContext): Promise<DialogueResult<NarratorOutput>> {
  const viewText = JSON.stringify(view);
  const accept = (v: NarratorOutput): Attempt<NarratorOutput> => {
    const leaks = leakScan(v.text, viewText, leak);
    const facts = factCheck(v, view);
    if (!leaks.length && !facts.length) return { kind: 'ok', value: v };
    // the note never repeats a leaked word: that would hand hidden text to the Narrator
    const note = [
      leaks.length ? 'the text named someone or something that is not in NARRATION_VIEW; use only what NARRATION_VIEW holds' : '',
      facts.length ? `"narrated" problems: ${facts.join(', ')}` : '',
    ].filter(Boolean).join('; ');
    return { kind: 'retry', errors: [...(leaks.length ? ['narrator_leak', ...leaks] : []), ...facts], note };
  };
  const run = await runAgent(ctx, { agent: 'narrator', fixed: FIXED.narrator, data: formatNarrationView(view), schema: checkNarrator, accept });
  if (run.value) return { output: run.value, run };
  const output = fallbackNarration(view);
  run.log.output = output;
  return { output, run };
}

// ---------------- Weaver ----------------

export type WeaverResult = { plan: StagePlan | null; rejected: StagePlan | null; run: RunResult<StagePlan> };

/**
 * WeaverView. validate: the stage-plan validator (W6); its errors go into the single repair retry.
 * plan null = use the fallback stage; rejected = the last schema-clean plan that failed validate (for routine-only degrade).
 */
export async function callWeaver(
  view: WeaverView, ctx: AgentCtx, opts: { validate?: (plan: StagePlan) => string[]; signal?: AbortSignal } = {},
): Promise<WeaverResult> {
  let rejected: StagePlan | null = null;
  const accept = (v: StagePlan): Attempt<StagePlan> => {
    const errs = opts.validate?.(v) ?? [];
    if (!errs.length) return { kind: 'ok', value: v };
    rejected = v;
    return { kind: 'retry', errors: ['plan_invalid', ...errs], note: errs.join('; ') };
  };
  const run = await runAgent(ctx, { agent: 'weaver', fixed: FIXED.weaver, data: formatWeaverView(view), signal: opts.signal, schema: checkStagePlan, accept });
  return { plan: run.value, rejected: run.value ? null : rejected, run };
}
