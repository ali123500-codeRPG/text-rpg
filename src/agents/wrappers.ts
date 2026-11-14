// The six agent wrappers: build the two-turn input from the agent's own view, validate, repair once, fall back.
import type {
  DialogueInput, DialogueView, Intent, NarrationView, NarratorOutput, NpcAction, OppositionView,
  PlannerOutput, PlayerView, ResponderOutput, StagePlan, VoiceOutput, WeaverView,
} from '../types';
import { FIXED } from './prompts';
import { checkIntent, checkNarrator, checkPlanner, checkResponder, checkStagePlan, checkVoice } from './schema';
import { formatDialogueView, formatNarrationView, formatOppositionView, formatPlayerView, formatResponderInput, formatWeaverView } from './format';
import { checkNpcLegality, checkParserLegality, spokenOnly, illegalClarify, routineAllowed, type NpcViewBase } from './legality';
import { fallbackNarration, factCheck, leakScan, mentions, type LeakContext } from './narration';
import { runAgent, type AgentCtx, type Attempt, type RunResult } from './call';

export const GENERIC_CLARIFY = 'What do you do?';

/** BG-213: an action held back for arrival, written as the player would type it next turn, with the names the player
 * knows ("give Corwin the lucky charm", "search the lean man") */
export function actionWords(a: NonNullable<Intent['action']>, view: PlayerView): string {
  const people = [...view.actors, ...(view.lastSeen ?? []), ...(view.talkingWith ?? [])];
  const who = (id: string | null) => (id && people.find((p) => p.id === id)?.name) || (id ? 'them' : '');
  const wares = (view.lastSeen ?? []).flatMap((p) => p.wares ?? []);
  const what = (id: string | null) => (id && (view.player.inventory.find((x) => x.id === id || x.itemId === id)?.name ?? wares.find((w) => w.id === id)?.name)) || '';
  const t = who(a.target), it = what(a.item), the = it ? `the ${it}` : '';
  const line: Partial<Record<string, string>> = {
    give: `give ${t} ${the || 'it'}`, take: `take ${the || 'it'} from ${t}`, buy: `buy ${it || 'something'} from ${t}`, sell: `sell ${the || 'it'} to ${t}`,
    use_item: `use ${the || 'it'} on ${t}`, filch: `filch ${the || 'something'} from ${t}`, restrain: `hold ${t} back`,
    search: `search ${t}`, attack: `attack ${t}`, observe: `look at ${t}`,
    talk: `talk to ${t}`, persuade: `persuade ${t}`, deceive: `lie to ${t}`, barter: `haggle with ${t}`, intimidate: `threaten ${t}`,
  };
  return (line[a.type] ?? `${a.type.replace('_', ' ')} ${t}`).replace(/\s+/g, ' ').trim();
}

// ---------------- Parser ----------------

export type ParserResult = { intent: Intent | null; clarify: string | null; run: RunResult<Intent> };

/** PlayerView only. A clarify, an illegal target/item/skill or a failed call stops the turn with a question. */
export async function callParser(text: string, view: PlayerView, ctx: AgentCtx, opts: { bandIds?: string[] } = {}): Promise<ParserResult> {
  const run = await runAgent<Intent>(ctx, { agent: 'parser', fixed: FIXED.parser, data: formatPlayerView(text, view), schema: checkIntent });
  if (!run.value) return { intent: null, clarify: GENERIC_CLARIFY, run };
  if (run.value.clarify) return { intent: null, clarify: run.value.clarify, run };
  const leg = checkParserLegality(run.value, view, opts.bandIds);
  if (leg.gearErrors.length) run.log.errors.push('invalid_gear');
  // Q16: walking over to someone out of sight moves now; what was meant for them waits for arrival
  const outOfSight = (x: string) => x.startsWith('addressee') || x.startsWith('action.target');
  if (leg.illegal.length && leg.intent.move && leg.illegal.every(outOfSight)) {
    const i = leg.intent;
    // BG-213: words wait as said; an action with no words waits as the line the player would type for it
    const later = i.spoken ?? (i.action ? actionWords(i.action, view) : '');
    leg.intent = { ...i, action: null, spoken: null, addressees: null, deferred: [...(later ? [later] : []), ...(i.deferred ?? [])] };
    run.log.errors.push('deferred_to_arrival', ...leg.illegal);
    leg.illegal = [];
  }
  if (leg.illegal.length) {
    run.log.errors.push('illegal_intent', ...leg.illegal);
    run.log.output = leg.intent; // kept so the GM view shows what was asked for
    return { intent: null, clarify: illegalClarify(leg.illegal, view) ?? GENERIC_CLARIFY, run };
  }
  run.log.output = leg.intent;
  // BF32: a blow with the hand while both hands are full is not made with what they hold: the player is told to put it away
  const a = leg.intent.action, blow = a?.type === 'attack' && !a.item ? view.player.bodyAttacks?.find((b) => b.mode === a.mode && b.handsFull) : undefined;
  if (blow) {
    run.log.errors.push('hands_full', blow.mode);
    return { intent: null, clarify: `Your hands are full with the ${blow.handsFull}. Put it away or drop it first, then make the ${blow.name === 'fists' ? 'punch' : blow.name}.`, run };
  }
  return { intent: leg.intent, clarify: null, run };
}

// ---------------- Planner ----------------

/** shared NPC post-checks: target legality (drop), gear/stance, routine switch */
function npcAccept<T extends { action: NpcAction; gear: PlannerOutput['gear']; stance: PlannerOutput['stance'] }>(
  view: NpcViewBase, world: Set<string>, value: T,
  alsoKnown: string[] = [],
): { orderError: string | null; errors: string[] } {
  const box = { action: value.action, gear: value.gear, stance: value.stance };
  const leg = checkNpcLegality(box, view, world, alsoKnown);
  // BG-93: one rule for every NPC agent: a line is only the words spoken
  const v = value as { dialogue?: { line: string } | null; line?: string };
  const words = (line: string) => { if (/[*[]/.test(line)) leg.errors.push('stage_direction'); return spokenOnly(line); };
  if (v.dialogue) {
    const line = words(v.dialogue.line);
    if (line) v.dialogue.line = line;
    else v.dialogue = null;
  }
  if (typeof v.line === 'string') v.line = words(v.line);
  value.gear = box.gear;
  value.stance = box.stance;
  return leg;
}

/** an NPC's plan update: a routine it may not switch to is dropped (invalid_routine), and its triggers are its own */
function planUpdateFor(view: OppositionView, v: { planUpdate: PlannerOutput['planUpdate'] }, errors: string[]): void {
  if (!v.planUpdate) return;
  if (!routineAllowed(view, v.planUpdate.routine)) {
    errors.push('invalid_routine');
    v.planUpdate.routine = null;
  }
  v.planUpdate.triggers = v.planUpdate.triggers.map((t) => ({ ...t, ownerId: view.self.id }));
}

export type PlannerCallOpts = { signal?: AbortSignal; world: Set<string> };

/** OppositionView. null = no usable order (the engine runs the type's combat list). */
export async function callPlanner(view: OppositionView, ctx: AgentCtx, opts: PlannerCallOpts): Promise<RunResult<PlannerOutput>> {
  let pending: string[] = [];
  const accept = (v: PlannerOutput): Attempt<PlannerOutput> => {
    const leg = npcAccept(view, opts.world, v);
    if (leg.orderError) return { kind: 'fail', errors: [leg.orderError, ...leg.errors] };
    const errors = [...leg.errors];
    planUpdateFor(view, v, errors);
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

/** the fallback line when a Responder or Voice call fails: one fixed placeholder (an NPC's sheet has no neutral line of its own) */
export const NEUTRAL_LINE = 'I have nothing to say about that.';

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
    const leg = npcAccept(view, opts.world, v, ['player']); // a spokesperson answers the speaker it just heard
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
    planUpdateFor(view, v, extra);
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
  view: DialogueView, ctx: AgentCtx, opts: { world: Set<string>; names?: string[]; terms?: string[]; signal?: AbortSignal },
): Promise<DialogueResult<VoiceOutput>> {
  const viewText = JSON.stringify(view);
  let extra: string[] = [];
  const accept = (v: VoiceOutput): Attempt<VoiceOutput> => {
    const leg = npcAccept(view, opts.world, v, ['player']); // a spokesperson answers the speaker it just heard
    if (leg.orderError) return { kind: 'fail', errors: [leg.orderError, ...leg.errors] };
    const knows = new Set(view.knows.map((f) => f.id));
    const badShares = v.shares.filter((id) => !knows.has(id));
    const badNames = (opts.names ?? []).filter((n) => mentions(v.line, n) && !mentions(viewText, n));
    const badTerms = (opts.terms ?? []).filter((t) => mentions(v.line, t) && !mentions(viewText, t)); // F5: unrevealed secrets and hidden terms
    if (badShares.length || badNames.length || badTerms.length) {
      const errors = [...(badShares.length ? ['invalid_share', ...badShares] : []), ...(badNames.length || badTerms.length ? ['voice_leak'] : [])];
      const note = [
        badShares.length ? `"shares" lists ids not in KNOWS (${badShares.join(', ')})` : '',
        badNames.length || badTerms.length ? 'the line names someone or something that is not in DIALOGUE_VIEW or KNOWS' : '',
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
    if (!view.scenarioEnded) delete v.closing; // SD1: a closing line only on a turn that ended a scenario
    const leaks = leakScan(v.closing ? `${v.closing}\n${v.text}` : v.text, viewText, leak);
    const facts = factCheck(v, view);
    if (!leaks.length && !facts.length) return { kind: 'ok', value: v };
    // the note never repeats a leaked word: that would hand hidden text to the Narrator. BG-138: a hidden term can be an
    // everyday word the Narrator used innocently ("lift" the lid), so the note asks for new wording, not just the view
    const terms = leaks.some((x) => x.startsWith('term:'));
    const note = [
      leaks.length && !terms ? 'the text named someone or something that is not in NARRATION_VIEW; use only what NARRATION_VIEW holds' : '',
      terms ? 'a word in the text may not be used here: write it again in different words, taking names and nouns only from NARRATION_VIEW' : '',
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
