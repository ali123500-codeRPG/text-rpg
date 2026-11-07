// The turn pipeline (Part 2, Architecture: one turn) behind GameApi.
// Order per turn: Parser → [dialogue calls] → BACKGROUND_WINDOW gate → collect Planners → resolveTurn → scene setup
// → plan updates → save → NarrationView → advance (turn N+1 pending, background Planners) → Narrator → [DIALOGUE_WINDOW] → display.
import type {
  AgentTurnLog, ClaudeClient, ClaudeErrorCode, Clock, CreationBuild, DialogueInput, GameApi, GameEvent, GameState,
  GmSnapshot, Intent, LineCheck, LogLine, NarrationView, Notice, OppositionView, PlannerOutput, Rng, TurnRecord, Actor,
} from '../types';
import { SPEECH_ACTIONS } from '../types';
import { CONFIG } from '../config';
import { createRng } from '../rng';
import * as engine from '../engine';
import type { AcceptedAgentOutput, ExchangeSpeech, TurnInput } from '../engine';
import * as views from '../views';
import * as save from '../save';
import type { Store } from '../save';
import { getLibrary, itemDef } from '../library';
import { equipLoadout, fullParts } from '../library/spawn';
import { defaultStandingDefense, healthLevel, tierIndexOf } from '../ruleset';
import { StopPlay, type AgentCtx, type RunResult } from './call';
import { callNarrator, callParser, callPlanner, callResponder, callVoice } from './wrappers';
import { buildLeakContext } from './narration';
import { isComm } from '../perception';
import { FIXED } from './prompts';
import { formatOppositionView } from './format';

/**
 * Scene setup and stage extension (W6, src/scene/director.ts, not built yet). The minimal surface the pipeline needs;
 * W6 makes its Weaver calls through callWeaver with the ctx handed in.
 */
export interface SceneDirector {
  /** story start (turn 0): place the player, situation roll, Weaver, apply plan or fallback stage; returns the opening events */
  startStory(state: GameState, rng: Rng, ctx: AgentCtx): Promise<GameEvent[]>;
  /** inside a turn, after resolveTurn and before the save: scene setup on sceneBreak, or a frontier crossing; returns added events */
  afterResolve(state: GameState, events: GameEvent[], rng: Rng, ctx: AgentCtx): Promise<GameEvent[]>;
  /** after the save: background Weaver calls for frontiers next to the player (not called while rate limited) */
  afterSave(state: GameState, ctx: AgentCtx): void;
}

export type GameDeps = { client: ClaudeClient; clock: Clock; store: Store; director?: SceneDirector };
export type Game = GameApi & {
  /** test / harness entry: take a state already at turn start (state.turn === state.pending.turn) */
  adopt(state: GameState): void;
  /** wait for every background call to finish (tests) */
  settle(): Promise<void>;
};

type Background = {
  actorId: string;
  controller: AbortController;
  view: OppositionView;
  startedAt: number;
  done: boolean;
  collected: boolean;
  run?: RunResult<PlannerOutput>;
  promise: Promise<void>;
};

const HELP_TEXT =
  'Type what you do in plain words. Commands: /stats, /inv, /quests, /undo (rewind one turn; dice are not rolled back), ' +
  '/help, /difficulty [setting], /aim [text] (this turn\'s attack is aimed). The story saves every turn.';

export function createGame(deps: GameDeps): Game {
  const { client, clock, store, director } = deps;
  const owner = `window_${clock.now().toString(36)}`;
  let state: GameState | null = null;
  let lines: LogLine[] = [];
  let notices: Notice[] = [];
  let busy = false;
  let stopped = false;
  let rateLimited = false;
  let aimNext = false;
  let lastDisplayAt = clock.now();
  let turnLog: AgentTurnLog[] = [];
  let lastLog: AgentTurnLog[] = [];
  let background = new Map<string, Background>();
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((cb) => cb());
  let calls = 0; // Claude calls this session, shown on the Play screen
  const counted: ClaudeClient = { call: (req) => { calls++; return client.call(req); } };

  const notice = (n: Notice) => {
    notices = [...notices.filter((x) => x.kind !== n.kind), n];
    emit();
  };
  const stop = (code: ClaudeErrorCode) => {
    stopped = true;
    for (const bg of background.values()) bg.controller.abort();
    notice({ kind: 'stop_play', text: `Claude can't be used in this view (${code}). Allow Claude for this page or sign in again, then reload.` });
  };
  const ctxFor = (turn: number, sink: AgentTurnLog[]): AgentCtx => ({
    client: counted, clock, turn,
    log: (e) => sink.push(e),
    onError: (code) => {
      if (code === 'rate_limited') {
        rateLimited = true;
        notice({ kind: 'rate_limited', text: 'Claude is busy: some characters act on instinct this turn.' });
      }
    },
  });

  // ---------------- background Planners ----------------

  function startBackground(): void {
    const s = state;
    if (!s || rateLimited || stopped) return;
    const world = worldIds(s);
    const ctx = ctxFor(s.turn, []);
    for (const actorId of plannerActors(s).slice(0, CONFIG.MAX_PLANNER_CALLS)) {
      const controller = new AbortController();
      const view = views.buildOppositionView(s, actorId); // from saved state, before submit
      const bg: Background = { actorId, controller, view, startedAt: clock.now(), done: false, collected: false, promise: Promise.resolve() };
      bg.promise = (async () => {
        try {
          bg.run = await callPlanner(view, { ...ctx, log: () => {} }, { signal: controller.signal, world });
        } catch (e) {
          if (e instanceof StopPlay) stop(e.code);
        } finally {
          bg.done = true;
        }
      })();
      background.set(actorId, bg);
    }
  }

  /** a call that can no longer be used: abort it and log it once, as unused (dialogue cancel) or late (window passed) */
  function drop(bg: Background, how: 'unused' | 'late'): void {
    bg.collected = true;
    if (!bg.done) bg.controller.abort();
    const entry: AgentTurnLog = bg.run?.log ?? {
      turn: state!.turn, agent: 'planner', actorId: bg.actorId,
      input: [{ role: 'user', content: FIXED.planner }, { role: 'user', content: formatOppositionView(bg.view) }],
      output: null, rawOutputs: [], status: how, errors: [], startedAt: bg.startedAt,
    };
    entry.status = how;
    entry.output = null;
    if (how === 'late') entry.errors.push('planner_late');
    entry.endedAt = clock.now();
    turnLog.push(entry);
  }

  /** at resolution: done calls give their output; calls still running are late (combat list, whole output discarded) */
  function collectPlanners(skip: string[]): AcceptedAgentOutput[] {
    const out: AcceptedAgentOutput[] = [];
    for (const bg of background.values()) {
      if (bg.collected || skip.includes(bg.actorId)) continue;
      if (!bg.done) {
        drop(bg, 'late');
        continue;
      }
      bg.collected = true;
      if (bg.run) {
        turnLog.push(bg.run.log);
        if (bg.run.value) out.push({ agent: 'planner', actorId: bg.actorId, output: bg.run.value });
      }
    }
    return out;
  }

  function abortBackground(): void {
    for (const bg of background.values()) bg.controller.abort();
    background = new Map();
  }

  // ---------------- turn ----------------

  /** after turn N is saved: compute N+1 (triggers, engaged set, mode), then start its background calls */
  function advance(): void {
    const s = state!;
    const p = engine.computePending(s);
    // GAP: the pipeline owns the turn counter: state.turn moves to pending.turn once turn N is saved
    s.turn = p.turn;
    s.pending = p;
    s.mode = p.mode;
    s.events = []; // this turn's events already went into recentEvents before the save (finishTurn)
    s.agentLog = [];
    s.log = [];
    turnLog = [];
    abortBackground();
    startBackground();
    if (director && !rateLimited && !stopped) director.afterSave(s, ctxFor(s.turn, turnLog));
  }

  async function dialogueCall(s: GameState, id: string, input: DialogueInput, exchange: ExchangeSpeech, agenda: boolean, ctx: AgentCtx, world: Set<string>): Promise<AcceptedAgentOutput> {
    if (agenda) {
      const view = views.buildOppositionView(s, id);
      const fired = s.hidden.firedLog.filter((f) => f.turn === s.turn && f.ownerId === id).map((f) => f.triggerId);
      // GAP: COMMITTED names the fired trigger by id (the trigger's bound order lives with the engine)
      const r = await callResponder(view, input, ctx, { world, committed: fired.length ? `trigger ${fired[0]}` : null, slips: exchange.perSpokesperson[id]?.slips ?? [] });
      return { agent: 'responder', actorId: id, output: r.output };
    }
    const view = views.buildDialogueView(s, id, input);
    const r = await callVoice(view, ctx, { world, names: knownNames(s) });
    return { agent: 'voice', actorId: id, output: r.output };
  }

  async function playTurn(text: string, aimed: boolean): Promise<void> {
    const s = state!;
    const submitAt = clock.now();
    lines.push({ turn: s.turn, kind: 'player', text });
    emit();
    if (!(await store.acquireLease(`stories/${s.storyId}/control/lock`, owner, CONFIG.LOCK_LEASE_MS))) {
      notice({ kind: 'read_only', text: 'This story is open in another window; this one is read-only.' });
      return;
    }
    const ctx = ctxFor(s.turn, turnLog);
    const pv = views.buildPlayerView(s);
    const parsed = await callParser(text, pv, ctx, { bandIds: pv.actors.map((a) => s.actors.find((x) => x.id === a.id)?.bandId ?? '').filter(Boolean) });
    if (parsed.clarify !== null || !parsed.intent) {
      // the turn stops: no resolution, turn unchanged, Planner outputs kept for this same turn
      lines.push({ turn: s.turn, kind: 'clarify', text: parsed.clarify ?? 'What do you do?' });
      return;
    }
    const intent = parsed.intent;
    // OQ-27 (c): ask who is meant, from code: no Claude call, no turn spent
    const unclear = engine.unclearAddressee(s, intent, pv.actors.map((a) => a.id));
    if (unclear) {
      lines.push({ turn: s.turn, kind: 'clarify', text: `Who do you speak to: ${orList(unclear.map((id) => seenName(pv, id)))}?` });
      return;
    }
    const rngBefore = s.rngState;
    const rng = createRng(s.rngState);
    const speech = !!intent.action && (SPEECH_ACTIONS as readonly string[]).includes(intent.action.type) && !!intent.addressees?.length;
    const spokespeople = speech ? engine.selectSpokespeople(s, intent) : [];
    if (spokespeople.length) s.stage.partner = spokespeople[0]; // OQ-27 (c): sticky partner for the next lines
    const agentOutputs: AcceptedAgentOutput[] = [];
    let exchange: ExchangeSpeech | undefined;
    if (spokespeople.length) {
      s.mode = 'dialogue';
      for (const id of spokespeople) {
        const bg = background.get(id);
        if (bg && !bg.collected) drop(bg, 'unused');
      }
      const agenda = new Map(spokespeople.map((id) => [id, hasAgenda(s, id)])); // from turn-start state
      exchange = engine.resolveSpeech(s, intent, spokespeople, rng);
      const input: DialogueInput = [{ spoken: intent.spoken ?? '', impression: exchange.impression }];
      const world = worldIds(s);
      agentOutputs.push(...(await Promise.all(spokespeople.map((id) => dialogueCall(s, id, input, exchange!, agenda.get(id)!, ctx, world)))));
    }
    // timing rule: resolution never before the previous display plus BACKGROUND_WINDOW, in every mode
    await clock.sleep(lastDisplayAt + CONFIG.BACKGROUND_WINDOW_MS - clock.now());
    if (stopped) return;
    agentOutputs.push(...collectPlanners(spokespeople));
    agentOutputs.sort((a, b) => (a.actorId < b.actorId ? -1 : a.actorId > b.actorId ? 1 : 0));
    const input: TurnInput = { intent, aimed, agentOutputs, spokespeople, ...(exchange ? { exchange } : {}) };
    const events = engine.resolveTurn(s, input, rng);
    s.rngState = rng.state; // plan updates were applied (with triggers sanitized) inside resolveTurn
    if (director) {
      events.push(...(await director.afterResolve(s, events, rng, ctx)));
      s.rngState = rng.state;
    }
    aimNext = false;
    await finishTurn(s, events, { playerInput: text, rngBefore, aimed, intent }, spokespeople.length ? submitAt : null);
  }

  /** save → NarrationView → advance → Narrator → display (shared by every turn and by story start) */
  async function finishTurn(s: GameState, events: GameEvent[], rec: { playerInput: string; rngBefore: number; aimed: boolean; intent: Intent | null }, dialogueSubmitAt: number | null): Promise<void> {
    s.events = events;
    // saved with the engine page, so a reloaded story resolves the next turn exactly as continuous play would
    s.recentEvents = pruneRecent(s, [...(s.recentEvents ?? []), ...events]);
    s.agentLog = [...turnLog];
    const record: TurnRecord = {
      storyId: s.storyId, turn: s.turn, libraryVersion: s.libraryVersion, rngBefore: rec.rngBefore, playerInput: rec.playerInput,
      agentLog: s.agentLog, events, factsAdded: [], log: s.log, aimed: rec.aimed,
      ...(s.scratch?.situation ? { situation: s.scratch.situation as TurnRecord['situation'] } : {}),
    };
    if (s.scratch) delete s.scratch.situation;
    // save step 1: hold the turn lock. Re-acquiring renews the lease, so a long turn (Weaver wait, slow calls) or the
    // first save of a new story still writes under the lock.
    if (!(await store.acquireLease(`stories/${s.storyId}/control/lock`, owner, CONFIG.LOCK_LEASE_MS))) {
      notice({ kind: 'read_only', text: 'This story is open in another window; this one is read-only.' });
      stopped = true;
      return;
    }
    try {
      await save.saveTurn(store, s, record);
    } catch (e) {
      const err = e as { code?: string; message: string; committed?: boolean };
      if (err.code === 'quota_exceeded' && !err.committed) {
        // spec save flow: on quota_exceeded stop, keep the last good head, and tell the player
        stopped = true;
        for (const bg of background.values()) bg.controller.abort();
        notice({ kind: 'stop_play', text: err.message });
        return;
      }
      // committed: the head was written and only cleanup or backups failed, so the turn is saved
      if (!err.committed) notice({ kind: 'save_failed', text: `The turn could not be saved (${err.message}); the last good save is kept.` });
    }
    const nv = views.buildNarrationView(s, events, rec.intent);
    const leak = buildLeakContext(s);
    const mechanics = mechanicsLines(s, events);
    const turn = s.turn;
    const narrLog = turnLog;
    advance();
    const narr = await callNarrator(nv, ctxFor(turn, narrLog), leak);
    if (dialogueSubmitAt !== null) await clock.sleep(dialogueSubmitAt + CONFIG.DIALOGUE_WINDOW_MS - clock.now());
    lines.push({ turn, kind: 'narration', text: narr.output.text, ...(CONFIG.SHOW_MECHANICS && s.settings.showMechanics && mechanics.length ? { mechanics } : {}),
      ...lineExtras(s, events, nv, narr.output.text) });
    lastLog = narrLog;
    lastDisplayAt = clock.now();
  }

  // ---------------- commands (code only, no Claude call, no time passes) ----------------

  async function command(text: string, opts: { aimed: boolean }): Promise<void> {
    const s = state!;
    const [cmd, ...rest] = text.slice(1).split(/\s+/);
    const arg = rest.join(' ').trim();
    const say = (t: string) => {
      lines.push({ turn: s.turn, kind: 'command', text: t });
      emit();
    };
    switch (cmd.toLowerCase()) {
      case 'stats': {
        const p = s.player;
        const skills = Object.entries(p.core.skills).map(([k, v]) => `${k} ${v.raw}${v.state === 'tagged' ? '+' : v.state === 'flawed' ? '−' : ''}`);
        return say(`${p.names.current}, ${p.core.classes.map((c) => `${c.classId} ${c.level}`).join(', ')}. Health: ${safeHealth(p)}. Skills: ${skills.join(', ')}.`);
      }
      case 'inv':
        return say(s.player.core.inventory.map((i) => `${nameOf(s, i.itemId)}${i.qty ? ` ×${i.qty}` : ''}${i.equippedIn?.length ? ` (${i.equippedIn.join(', ')})` : ''}`).join('; ') || 'You carry nothing.');
      case 'quests': {
        const active = s.quests.filter((q) => q.state === 'active');
        return say(active.length ? active.map((q) => q.text).join('\n') : 'No active quests.');
      }
      case 'help': {
        const recap = lines.filter((l) => l.kind === 'narration').slice(-3).map((l) => l.text);
        return say([HELP_TEXT, ...(recap.length ? ['Recently:', ...recap] : [])].join('\n'));
      }
      case 'difficulty':
        // GAP: the spec names no difficulty settings; the word is stored as given and saved with the next turn
        if (arg) s.settings.difficulty = arg;
        return say(`Difficulty: ${s.settings.difficulty}.`);
      case 'aim':
        aimNext = true;
        if (arg) return submit(arg, opts);
        return say('Your next attack is aimed.');
      case 'undo':
        if (busy) return;
        busy = true;
        try {
          try {
            await save.undoTurn(store, s.storyId);
          } catch (e) {
            if (!(e instanceof save.SaveError) || e.committed) throw e;
            lines.push({ turn: s.turn, kind: 'command', text: 'Undo goes back one turn only, and there is no turn to undo.' });
            return;
          }
          abortBackground();
          state = (await save.loadStory(store, s.storyId, getLibrary())).state;
          advance();
          lastDisplayAt = clock.now();
          lines.push({ turn: state.turn, kind: 'command', text: 'Turn undone.' });
        } finally {
          busy = false;
          emit();
        }
        return;
      default:
        return say(`Unknown command /${cmd}. Type /help.`);
    }
  }

  async function submit(text: string, opts: { aimed: boolean }): Promise<void> {
    const t = text.trim();
    if (!state || busy || stopped || !t) return;
    if (t.startsWith('/')) return command(t, opts);
    rateLimited = false; // background calls resume after the next player action
    notices = notices.filter((n) => n.kind !== 'rate_limited');
    busy = true;
    emit();
    try {
      await playTurn(t, opts.aimed || aimNext);
    } catch (e) {
      if (e instanceof StopPlay) stop(e.code);
      else throw e;
    } finally {
      busy = false;
      emit();
    }
  }

  // ---------------- story lifecycle ----------------

  async function newStory(build: CreationBuild): Promise<void> {
    const errs = validateBuild(build);
    if (errs.length) throw new Error(errs.join('; '));
    // GAP: W6's director is injected; without it there is no way to set up turn 0
    if (!director) throw new Error('scene director not wired (W6)');
    abortBackground();
    const now = clock.now();
    const storyId = `story_${now.toString(36)}`;
    const seed = (now >>> 0) || 1;
    state = newState(storyId, seed, buildPlayer(storyId, build), new Date(now).toISOString());
    state.player.core.standingDefense = defaultStandingDefense(state, state.player); // same rule as the creation preview
    lines = [];
    notices = [];
    turnLog = [];
    busy = true;
    emit();
    try {
      const rng = createRng(seed);
      const events = await director.startStory(state, rng, ctxFor(0, turnLog));
      state.rngState = rng.state;
      await finishTurn(state, events, { playerInput: '', rngBefore: seed, aimed: false, intent: null }, null);
    } catch (e) {
      if (e instanceof StopPlay) stop(e.code);
      else throw e;
    } finally {
      busy = false;
      emit();
    }
  }

  async function resume(): Promise<boolean> {
    // GAP: the save contract has no "latest story"; we take the last story id under stories/ in sort order
    const ids = [...new Set((await store.list('stories')).map((p) => p.split('/')).map((seg) => seg[seg.indexOf('stories') + 1]).filter(Boolean))].sort();
    const storyId = ids[ids.length - 1];
    if (!storyId) return false;
    try {
      const loaded = await save.loadStory(store, storyId, getLibrary());
      state = loaded.state;
    } catch (e) {
      notice({ kind: 'load_refused', text: `The story could not be loaded: ${(e as Error).message}` });
      return false;
    }
    lines = [];
    turnLog = [];
    advance();
    lastDisplayAt = clock.now();
    emit();
    return true;
  }

  const api: Game = {
    state: () => state,
    lines: () => lines,
    notices: () => {
      const st = state?.stage;
      const marker: Notice[] = st && (st.fallback || st.routineFallback) ? [{ kind: 'scene_fallback', text: 'Scene planning failed: placeholder area' }] : [];
      return [...notices, ...marker];
    },
    busy: () => busy,
    fell: () => !!state && safeHealth(state.player) === 'Incapacitated',
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    validateBuild,
    newStory,
    resume,
    submit,
    async reset() {
      abortBackground();
      if (state) await store.releaseLease(`stories/${state.storyId}/control/lock`, owner).catch(() => {});
      state = null;
      lines = [];
      notices = notices.filter((n) => n.kind === 'stop_play');
      turnLog = [];
      lastLog = [];
      emit();
    },
    calls: () => calls,
    gm: (): GmSnapshot => ({
      state,
      agentLog: lastLog,
      log: state?.log ?? [],
      fallbackBanner: !!(state?.stage.fallback || state?.stage.routineFallback),
      backups: [], // GAP: the save contract has no backup listing yet
    }),
    async restoreBackup() {
      throw new Error('restore is not available: the save module exposes no restore yet'); // GAP (W1)
    },
    adopt(s) {
      abortBackground();
      state = s;
      turnLog = [];
      lastDisplayAt = clock.now();
      startBackground();
    },
    async settle() {
      await Promise.all([...background.values()].map((b) => b.promise));
    },
  };
  return api;
}

// ---------------- helpers (code only) ----------------

/** hasAgenda is derived, never stored: a secret, a plan or a memory note */
export function hasAgenda(s: GameState, id: string): boolean {
  return s.hidden.secrets.some((x) => x.holderId === id) || !!s.hidden.plans[id] || !!s.hidden.memory[id];
}

function zoneDistances(s: GameState, from: string): Map<string, number> {
  const dist = new Map([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const z = queue.shift()!;
    for (const l of s.zones.find((x) => x.id === z)?.links ?? []) {
      if (l.frontier || dist.has(l.to)) continue;
      dist.set(l.to, dist.get(z)! + 1);
      queue.push(l.to);
    }
  }
  return dist;
}

/** engaged significant actors, not broken, nearest the player first (ties by id). Minor and over-cap actors use combat lists. */
export function plannerActors(s: GameState): string[] {
  const dist = zoneDistances(s, s.player.zone);
  return s.pending.engaged
    .map((id) => s.actors.find((a) => a.id === id))
    .filter((a): a is Actor => !!a && a.mind?.control === 'agent' && a.mind.moraleState !== 'broken')
    .sort((a, b) => (dist.get(a.zone) ?? Infinity) - (dist.get(b.zone) ?? Infinity) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((a) => a.id);
}

/** every real id, to tell view_leak (real but outside the view) from invalid_target (does not exist) */
export function worldIds(s: GameState): Set<string> {
  const all = [s.player, ...s.actors];
  return new Set([
    ...all.map((a) => a.id),
    ...s.zones.map((z) => z.id),
    ...s.zones.flatMap((z) => [...z.links.map((l) => l.to), ...z.groundItems.map((i) => i.id)]),
    ...all.flatMap((a) => a.core.inventory.map((i) => i.id)),
    ...s.places.map((p) => p.id),
  ]);
}

/** names the Voice's line is checked against (allowed only where its own view holds them) */
/** how the player sees an actor: its name if known, else its label, plus the zone when labels repeat */
function seenName(pv: ReturnType<typeof views.buildPlayerView>, id: string): string {
  const a = pv.actors.find((x) => x.id === id)!;
  const base = a.name ?? a.label;
  const twin = pv.actors.some((x) => x.id !== id && (x.name ?? x.label) === base);
  const zone = pv.zones.find((z) => z.id === a.zone)?.name ?? (pv.zone.id === a.zone ? pv.zone.name : undefined);
  return twin && zone ? `${base} at ${zone}` : base;
}
const orList = (xs: string[]) => (xs.length < 3 ? xs.join(' or ') : `${xs.slice(0, -1).join(', ')} or ${xs.at(-1)}`);

/**
 * Events kept for NPC views (spec: OppositionView holds the events it perceived, incl. the last few exchanges heard):
 * per actor, its last RECENT_EVENTS perceived non-bark events, its last RECENT_EVENTS communication events, and the
 * last hit on it. Bounded by actors × 2 × RECENT_EVENTS.
 */
export function pruneRecent(s: GameState, all: GameEvent[]): GameEvent[] {
  const keep = new Set<GameEvent>();
  const n = CONFIG.RECENT_EVENTS;
  for (const a of [s.player, ...s.actors]) {
    const seen = all.filter((e) => e.perception[a.id]);
    for (const e of seen.filter((e) => !e.bark).slice(-n)) keep.add(e);
    for (const e of seen.filter(isComm).slice(-n)) keep.add(e);
    const hit = [...seen].reverse().find((e) => e.kind === 'attack' && e.target === a.id);
    if (hit) keep.add(hit);
  }
  return all.filter((e) => keep.has(e));
}

function knownNames(s: GameState): string[] {
  return [s.player, ...s.actors].flatMap((a) => [a.names.current, ...a.names.past.map((p) => p.name)])
    .concat(s.places.map((p) => p.names.current));
}

function safeHealth(a: Actor): string {
  try {
    return healthLevel(a);
  } catch {
    return 'unknown';
  }
}
function nameOf(s: GameState, itemId: string): string {
  try {
    return itemDef(s, itemId).name;
  } catch {
    return itemId;
  }
}

/**
 * Play screen extras for a narration line, from what the player perceived (no numbers): the player's own check this
 * turn, the lines heard (word for word, unless the narration already quotes them) and the turn's visible changes.
 */
export function lineExtras(s: GameState, events: GameEvent[], nv: NarrationView, narration: string): Pick<LogLine, 'check' | 'speech' | 'changes'> {
  const out: Pick<LogLine, 'check' | 'speech' | 'changes'> = {};
  const who = (n: string, start: boolean) => (n === 'player' ? (start ? 'You' : 'you') : start ? n.charAt(0).toUpperCase() + n.slice(1) : n);
  const words = (x: string) => x.replace(/_/g, ' ');
  let check: LineCheck | undefined;
  for (const e of events) {
    if (check) break;
    if (e.attack && e.attack.attackerId === 'player') {
      const a = e.attack;
      const pk = nv.events.find((x) => x.id === e.id)?.packet;
      const loc = pk?.location?.part ?? (a.location ? words(a.location) : '');
      check = {
        skill: a.attack.skill, tier: a.attack.tier,
        ...(a.defense && a.defenseType ? { against: { what: `${views.callName(s, 'player', a.targetId)}’s ${a.defenseType}`, tier: a.defense.tier } } : {}),
        result: `${pk?.outcome ?? words(a.outcome)}${loc ? `, ${loc}` : ''}`,
      };
    } else if (e.contest && (e.contest.a.actorId === 'player' || e.contest.b.actorId === 'player')) {
      const c = e.contest;
      const mine = c.a.actorId === 'player' ? c.a : c.b, other = mine === c.a ? c.b : c.a;
      const result = c.winner === 'tie' ? 'a tie' : (c.winner === 'a') === (mine === c.a) ? 'you win' : 'you lose';
      check = { skill: mine.skill, tier: mine.tier, against: { what: views.callName(s, 'player', other.actorId), tier: other.tier }, result };
    }
  }
  if (check) out.check = check;
  const speech = nv.heard.filter((l) => !narration.includes(l.text)).map((l) => ({ speaker: l.speaker, volume: l.volume, text: l.text }));
  if (speech.length) out.speech = speech;
  const changes: NonNullable<LogLine['changes']> = [];
  for (const ev of nv.events) {
    const p = ev.packet;
    if (!p) continue;
    changes.push({ kind: 'combat', text: `${who(p.actor, true)} → ${who(p.target, false)} · ${words(p.outcome)}${p.location ? `, ${p.location.part}` : ''}` });
    for (const c of p.changes) {
      const own = c.startsWith('player ') || c.startsWith("player's ");
      changes.push({ kind: own && c.startsWith('player is ') ? 'health' : 'condition', text: own ? c.replace(/^player is /, 'You are ').replace(/^player's /, 'Your ') : who(c, true) });
    }
  }
  if (changes.length) out.changes = changes;
  return out;
}
/** how far apart two tiers are, in words ("1 tier ahead") */
export function tierGap(mine: string, theirs: string): string {
  const d = tierIndexOf(mine) - tierIndexOf(theirs);
  return d === 0 ? 'same tier' : `${Math.abs(d)} tier${Math.abs(d) === 1 ? '' : 's'} ${d > 0 ? 'ahead' : 'behind'}`;
}

/** mechanics panel: dice, modifiers and damage of events the player took part in or perceived (never sent to an agent) */
export function mechanicsLines(s: GameState, events: GameEvent[]): string[] {
  const label = (id: string) => (id === 'player' ? 'You' : s.actors.find((a) => a.id === id)?.label ?? id);
  const mods = (m: { source: string; value: number }[]) => (m.length ? ` [${m.map((x) => `${x.source} ${x.value >= 0 ? '+' : ''}${x.value}`).join(', ')}]` : '');
  const out: string[] = [];
  for (const e of events) {
    if (e.actorId !== 'player' && !e.perception.player) continue;
    if (e.attack) {
      const a = e.attack;
      const def = a.defense ? `; ${a.defenseType} d100 ${a.defense.d100} → ${a.defense.tier}${mods(a.defense.modifiers)}` : '';
      out.push(`${label(a.attackerId)} → ${label(a.targetId)}: ${a.attack.skill} d100 ${a.attack.d100} → ${a.attack.tier}${mods(a.attack.modifiers)}${def}` +
        `${a.gap !== null ? `; gap ${a.gap}` : ''}; ${a.outcome.replace(/_/g, ' ')}${a.location ? ` (${a.location})` : ''}${a.damage ? `, damage ${a.damage}` : ''}`);
    } else if (e.contest) {
      const c = e.contest;
      out.push(`${label(c.a.actorId)} ${c.a.skill} d100 ${c.a.d100} → ${c.a.tier} vs ${label(c.b.actorId)} d100 ${c.b.d100} → ${c.b.tier}: ${c.winner}`);
    } else if (e.check) {
      out.push(`${label(e.check.actorId)} ${e.check.skill} vs ${e.check.target}: ${e.check.passed ? 'passed' : 'failed'}${mods(e.check.modifiers)}`);
    }
  }
  return out;
}

// ---------------- player creation (Part 4 §4) ----------------

const START_KIT = ['arming_sword', 'round_shield', 'gambeson'];
const START_CLASS = 'swordsman'; // first build: the player is a swordsman

export function validateBuild(build: CreationBuild): string[] {
  const lib = getLibrary();
  const errs: string[] = [];
  if (!build.name.trim()) errs.push('name is empty');
  let total = 0;
  for (const [k, v] of Object.entries(build.skills)) {
    if (!lib.skills[k]?.playerOpen) errs.push(`${k} is not open to the player`);
    if (!Number.isInteger(v) || v < 0) errs.push(`${k}: points must be a whole number`);
    if (v > CONFIG.CREATION_MAX_SKILL) errs.push(`${k} is above ${CONFIG.CREATION_MAX_SKILL}`);
    total += v;
  }
  if (total !== CONFIG.CREATION_POINTS) errs.push(`${total} of ${CONFIG.CREATION_POINTS} points spent`);
  for (const [k, floor] of Object.entries(lib.classes[START_CLASS]?.floors ?? {}))
    if ((build.skills[k] ?? 0) < floor) errs.push(`${k} is below the class floor ${floor}`);
  if (new Set(build.tagged).size !== CONFIG.CREATION_TAGS) errs.push(`exactly ${CONFIG.CREATION_TAGS} skills must be tagged`);
  for (const t of build.tagged) if (!(t in build.skills)) errs.push(`tagged skill ${t} has no points`);
  return errs;
}

function buildPlayer(storyId: string, build: CreationBuild): Actor {
  const sk = build.skills;
  return {
    id: 'player', storyId, kind: 'player', names: { current: build.name.trim(), past: [] }, label: 'a swordsman',
    placeId: 'tavern', zone: '', posture: 'open', bandId: 'player_band', // the director places the player; the first build starts in the village tavern (Story start)
    core: {
      creatureTypeId: 'humanoid',
      skills: Object.fromEntries(Object.entries(sk).map(([k, v]) => [k, { raw: v, state: build.tagged.includes(k) ? 'tagged' as const : 'normal' as const }])),
      classes: [{ classId: START_CLASS, state: 'current', level: 1 }],
      perks: [],
      condition: { hpLostPct: 0, parts: fullParts(null, 'humanoid'), status: [] },
      inventory: [...equipLoadout(null, START_KIT, 'player'), { id: 'player_coin', itemId: 'coin', qty: CONFIG.STARTING_COIN }],
      standingDefense: 'block', // set from effective skill once the state exists (newGame)
    },
    progression: {
      startingTotal: Object.entries(sk).filter(([k]) => !build.tagged.includes(k)).reduce((n, [, v]) => n + v, 0),
      potential: { base: CONFIG.POTENTIAL, adjustments: [] }, xp: 0, unspentPerkPoints: 0, marks: [],
    },
    journal: { secretsKnown: [], factsWitnessed: [], remembered: {}, namesKnown: [] },
  };
}

function newState(storyId: string, seed: number, player: Actor, createdAt: string): GameState {
  const settings = { difficulty: 'normal', showMechanics: CONFIG.SHOW_MECHANICS, tone: CONFIG.STYLE.tone };
  return {
    storyId, turn: 0, mode: 'explore', zones: [], player, actors: [],
    bands: [{ id: 'player_band', name: 'the player', goals: '', temperament: '', tacticsLevel: 1, lethal: true, relations: {} }],
    hidden: { plans: {}, memory: {}, secrets: [], firedLog: [], weaverNote: '', stage: { eventSummary: '', challenge: 'none', gain: 'none', hiddenTerms: [] } },
    events: [], agentLog: [], log: [], rngSeed: seed, rngState: seed,
    pending: { turn: 0, mode: 'explore', engaged: [], fired: [] },
    places: [], facts: [], stage: { zoneIds: [], tier: '', sceneNumber: 0, sceneStartTurn: 0 },
    sceneCaps: { promotions: 0, minted: 0 }, clocks: {}, flags: {}, quests: [], settings,
    libraryVersion: getLibrary().version, blueprints: [],
    meta: { storyId, title: CONFIG.STORY_PREMISE, schemaVersion: CONFIG.SCHEMA_VERSION, createdAt, settings },
  };
}
