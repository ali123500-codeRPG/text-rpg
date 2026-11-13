// The turn pipeline (Part 2, Architecture: one turn) behind GameApi.
// Order per turn: Parser → [dialogue calls] → BACKGROUND_WINDOW gate → collect Planners → resolveTurn → scenario setup
// → plan updates → save → NarrationView → advance (turn N+1 pending, background Planners) → Narrator → [DIALOGUE_WINDOW] → display.
import { gripWord } from '../ruleset/gear';
import type { AgentName, StoryOwner, TierRoll,
  AgentTurnLog, ClaudeClient, ClaudeErrorCode, Clock, CreationBuild, DialogueInput, GameApi, GameEvent, GameState,
  GmSnapshot, HealNote, Intent, LineCheck, LogLine, NarrationView, Notice, OppositionView, PartState, HealthLevel, PlannerOutput, Rng, TurnRecord, Actor, WayDid,
} from '../types';
import { SCENARIO_ENDING_NAMES, SPEECH_ACTIONS, type ScenarioEndNote } from '../types';
import { pendingEnding } from '../engine/scenarioEnd';
import { barrierName } from '../engine/barriers';
import { scenarioGainsNow } from '../engine/growth';
import { CONFIG, defaultSettings } from '../config';
import { clockText, durationText, now, timeOfDay, timeView } from '../time';
import { outcomeText } from '../ruleset/hits';
import { HEALTH_LEVELS, PART_STATES, TIME_OF_DAY, type TimeOfDay } from '../scales';
import { createRng } from '../rng';
import * as engine from '../engine';
import { hasAgenda } from '../engine/relations';
import type { AcceptedAgentOutput, ExchangeSpeech, TurnInput } from '../engine';
import * as views from '../views';
import * as save from '../save';
import type { Store } from '../save';
import { actorBody, getLibrary, itemDef } from '../library';
import { LIGHT_SLEEPER } from '../engine/sleep';
import { actorById, zoneById } from '../engine/relations';
import { skillName } from '../library/skillNames';
import { createPlayer, refreshCopies, validateBuild } from '../library/spawn';
import { achievementName, wearable, wornTitle } from '../engine/xp';
import { defaultStandingDefense, healthLevel, isDownLevel, partStates, TAG_MARK, takePerk, tierAtLeast, tierLevel, tierName, tierPart, undoPerk, usedOffSheet } from '../ruleset';
import { StopPlay, callGate, modelFor, type AgentCtx, type RunResult } from './call';
import { fameEntry } from './fame';
import { AUTOPILOT_BRIEF, autopilotTurn, readMove } from './autopilot';
import type { GuidedCtx } from './crossroads';

import { callNarrator, callParser, callPlanner, callResponder, callVoice } from './wrappers';
import { buildLeakContext } from './narration';
import { barkOnly, isComm, noticeCue } from '../perception';
import { FIXED } from './prompts';
import { formatOppositionView } from './format';
import { QUEST_STATE_NAME, abandonQuest, dueText, isOpen, payText, pinQuest } from '../engine/quests';
import { fileBug, isBugCode, openBugs } from '../save/bugs';
import { checkTurn, snapTurn } from '../save/turnCheck';

const INFO_COMMAND = /^\/(stats|inv|quests)\b/i; // the autopilot's sheet, gear and quest looks (BG-25)

/**
 * Scenario setup and stage extension (W6, src/scenario/director.ts). The minimal surface the pipeline needs; the director
 * makes its Weaver calls through callWeaver with the ctx handed in.
 */
export interface ScenarioDirector {
  /** story start (turn 0): place the player, event roll, Weaver, apply plan or fallback stage; returns the opening events */
  startStory(state: GameState, rng: Rng, ctx: AgentCtx): Promise<GameEvent[]>;
  /** inside a turn, after resolveTurn and before the save: scenario setup on scenarioBreak, or a frontier crossing; returns added events */
  afterResolve(state: GameState, events: GameEvent[], rng: Rng, ctx: AgentCtx): Promise<GameEvent[]>;
  /** after the save: background Weaver calls for frontiers next to the player (not called while rate limited) */
  afterSave(state: GameState, ctx: AgentCtx): void;
}

export type GameDeps = { client: ClaudeClient; clock: Clock; store: Store; director?: ScenarioDirector };
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
  'Type what you do in plain words. Commands: /stats, /inv, /quests, /achievements, /undo (rewind one turn; dice are not rolled back), ' +
  '/help, /strike <who> [at <body part>] (a blow with what you hold), /shoot <who> [at <body part>], /throw <what> at <who> [at <body part>], /aim (put it in front of an attack that names a body part, e.g. /aim /strike the guard at his left leg: a harder roll that, if it hits, lands on that part; aiming never picks a person), /title [number or off] (wear an achievement as your title), /essence (essences on offer and held: take, pass, remove), /yield [words] (give up the fight you are in), /stuck [what is wrong] (the scenario can go nowhere: the story finds a way forward, and a bug is filed). The story saves every turn.';

/** NW18: a turn played while the player sleeps */
export const ASLEEP_TEXT = '(asleep)';
const ASLEEP_INTENT = { move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, action: null };

export function createGame(deps: GameDeps): Game {
  const { client, clock, store, director } = deps;
  const owner = `window_${clock.now().toString(36)}`;
  let state: GameState | null = null;
  let lines: LogLine[] = [];
  let savedLines = 0; // Q18: lines[0..savedLines) are in the story's saved history
  let notices: Notice[] = [];
  let busy = false;
  let endingNow: ScenarioEndNote | null = null; // SD1: a turn that ended a scenario, while its next scenario's calls run
  let agentSaid: string[] = [], agentCmds: string[] = []; // the autopilot's recent commentary, shown back to it so it varies its words
  let stopped = false;
  let rateLimited = false;
  let aimNext = false;
  let yieldNext = false; // MB40: /yield
  let lastDisplayAt = clock.now();
  let turnLog: AgentTurnLog[] = [];
  let lastLog: AgentTurnLog[] = [];
  let backups: { turn: number; path: string }[] = []; // the GM view's list, read again after each save
  /** CS12: a change between turns, saved at once: the same change is made on the saved turn, at the turn now being played
   * (so a perk taken now stays undoable after a reload, K3). Amends run one after another; a turn, undo or restore waits
   * for them. A failure keeps the change in play and saves it with the next turn. */
  let amending: Promise<void> = Promise.resolve();
  const amend = (change: (s: GameState) => void) => {
    const s = state;
    if (!s) return;
    const { storyId, turn } = s;
    amending = amending.then(async () => {
      if (!(await save.acquireTurnLock(store, storyId, owner))) throw new Error('the story is open in another window');
      await save.amendHead(store, storyId, getLibrary(), (x) => { const saved = x.turn; x.turn = turn; change(x); x.turn = saved; });
    }).catch((e) => notice({ kind: 'save_failed', text: `That change could not be saved yet (${(e as Error).message}); it is saved with your next turn.` }));
  };
  /** BG-123: the GM view's backups list, newest first; read in the background so the view stays synchronous */
  const refreshBackups = (storyId: string) => {
    void Promise.resolve().then(() => save.listBackups(store, storyId)).then((b) => { if (state?.storyId === storyId) { backups = b; emit(); } }).catch(() => {});
  };
  let background = new Map<string, Background>();
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((cb) => cb());
  let calls = 0; // Claude calls this session, shown on the Play screen
  // calls in flight, so the Play screen can show that Claude is working and on what
  const running = new Map<number, { agent: AgentName; since: number }>();
  let callId = 0;
  const gate = callGate(); // Q4: the turn's own calls go ahead of background calls in the viewer's call slots
  const counted: ClaudeClient = {
    call: async (req) => {
      calls++;
      const id = callId++;
      running.set(id, { agent: req.agent, since: Date.now() });
      emit();
      try { return await client.call(req); } finally { running.delete(id); emit(); }
    },
  };

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
    client: counted, clock, turn, gate,
    log: (e) => sink.push(e),
    // an agent that wrote something outside the options it was given: filed as a numbered bug for the build threads
    reportBug: (code, detail) => { if (state) void fileBug(store, clock.now(), { code, storyId: state.storyId, turn, ...detail }); },
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
          bg.run = await callPlanner(view, { ...ctx, log: () => {}, background: true }, { signal: controller.signal, world });
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
    fileLogBugs(s); // background scenario work since the save may have logged some
    s.log = [];
    turnLog = [];
    abortBackground();
    startBackground();
    if (director && !rateLimited && !stopped) director.afterSave(s, { ...ctxFor(s.turn, turnLog), background: true });
  }

  /** COMMITTED: the fired trigger's bound order, as its type and target label (hidden-side, so names are fine) */
  function committedText(s: GameState, id: string, triggerId: string): string {
    const o = engine.firedOrders(s).find((x) => x.actorId === id && x.triggerId === triggerId);
    if (!o) return `trigger ${triggerId}`;
    const t = o.target;
    const label = !t ? '' : s.actors.some((a) => a.id === t) || t === s.player.id ? views.callName(s, id, t) : s.zones.find((z) => z.id === t)?.name ?? t;
    return `trigger ${triggerId}: ${o.type}${label ? ` ${label}` : ''}`;
  }

  /** Q3: a Responder said a secret without listing it; logged and filed as a bug for the build threads to review */
  function reportUnlisted(s: GameState, actorId: string, secretIds: string[], line: string): void {
    const detail = { actorId, secretIds, line };
    s.log.push({ turn: s.turn, code: 'unlisted_reveal', detail });
  }

  /** every bug code in the state log is filed once, numbered (src/save/bugs.ts) */
  const filedLog = new WeakSet<object>();
  function fileLogBugs(s: GameState): void {
    for (const l of s.log) {
      if (!isBugCode(l.code) || filedLog.has(l)) continue;
      filedLog.add(l);
      void fileBug(store, clock.now(), { code: l.code, storyId: s.storyId, turn: l.turn, ...(l.detail ?? {}) });
    }
  }

  /** Q9: a late or failed call keeps its fallback, and it, or any call whose output broke a rule, is filed as a bug */
  function reportFallbacks(s: GameState, log: AgentTurnLog[]): void {
    for (const e of log) {
      // a slip the state log also holds (unlisted_reveal, invalid_reveal...) is filed from there, not twice
      const slip = e.errors.find((c) => isBugCode(c) && !s.log.some((l) => l.code === c));
      const fell = e.status === 'fallback' || e.status === 'failed';
      if (e.status !== 'late' && !fell && !slip) continue;
      const code = e.status === 'late' ? 'planner_late' : fell ? 'agent_fallback' : slip!;
      void fileBug(store, clock.now(), { code, storyId: s.storyId, turn: s.turn, agent: e.agent, actorId: e.actorId, errors: e.errors });
    }
  }

  async function dialogueCall(s: GameState, id: string, input: DialogueInput, exchange: ExchangeSpeech, agenda: boolean, ctx: AgentCtx, world: Set<string>): Promise<AcceptedAgentOutput> {
    if (agenda) {
      const view = views.buildOppositionView(s, id);
      const fired = s.hidden.firedLog.filter((f) => f.turn === s.turn && f.ownerId === id).map((f) => f.triggerId);
      const r = await callResponder(view, input, ctx, { world, committed: fired.length ? committedText(s, id, fired[0]) : null, slips: exchange.perSpokesperson[id]?.slips ?? [] });
      if (r.unlisted.length) reportUnlisted(s, id, r.unlisted, r.output.dialogue?.line ?? '');
      return { agent: 'responder', actorId: id, output: r.output };
    }
    const view = views.buildDialogueView(s, id, input);
    const r = await callVoice(view, ctx, { world, names: knownNames(s), terms: buildLeakContext(s).terms });
    return { agent: 'voice', actorId: id, output: r.output };
  }

  async function playTurn(text: string, aimed: boolean): Promise<void> {
    const s = state!;
    const submitAt = clock.now();
    const before = snapTurn(s); // TQ1: the turn checker compares the world after the turn with this
    lines.push({ turn: s.turn, kind: 'player', text, ...(aimed ? { aimed: true } : {}) });
    const gearBefore = gearSnap(s, s.player);
    const partsBefore = partStates(s, s.player);
    emit();
    if (!(await save.acquireTurnLock(store, s.storyId, owner))) {
      notice({ kind: 'read_only', text: 'This story is open in another window; this one is read-only.' });
      return;
    }
    const ctx = ctxFor(s.turn, turnLog);
    const pv = views.buildPlayerView(s);
    // NW18: asleep, the turn passes with you doing nothing; nothing you type is read
    const parsed = s.player.asleep ? { clarify: null, intent: ASLEEP_INTENT }
      : await callParser(text, pv, ctx, { bandIds: pv.actors.map((a) => s.actors.find((x) => x.id === a.id)?.bandId ?? '').filter(Boolean) });
    if (parsed.clarify !== null || !parsed.intent) {
      // the turn stops: no resolution, turn unchanged, Planner outputs kept for this same turn
      lines.push({ turn: s.turn, kind: 'clarify', text: parsed.clarify ?? 'What do you do?' });
      lastLog = [...turnLog]; // the GM view (and playtests) can see why the Parser asked
      return;
    }
    const intent = engine.fillSpeech(s, parsed.intent, text);
    if (yieldNext) intent.yields = true;
    // OQ-27 (c): ask who is meant, from code: no Claude call, no turn spent
    const unclear = engine.unclearAddressee(s, intent, pv.actors.map((a) => a.id));
    if (unclear) {
      lines.push({ turn: s.turn, kind: 'clarify', text: `Who do you speak to: ${orList(unclear.map((id) => seenName(pv, id)))}?` });
      return;
    }
    const rngBefore = s.rngState;
    const rng = createRng(s.rngState);
    const quick = engine.quickWord(s, intent); // A15: a line beside a fight action, replied to for free
    const speech = !!intent.action && ((SPEECH_ACTIONS as readonly string[]).includes(intent.action.type) || quick) && !!intent.addressees?.length;
    const spokespeople = speech ? engine.selectSpokespeople(s, intent) : [];
    if (spokespeople.length) s.stage.partner = spokespeople[0]; // OQ-27 (c): sticky partner for the next lines
    const agentOutputs: AcceptedAgentOutput[] = [];
    let exchange: ExchangeSpeech | undefined;
    if (spokespeople.length) {
      if (!quick) s.mode = 'dialogue';
      for (const id of spokespeople) {
        const bg = background.get(id);
        if (bg && !bg.collected) drop(bg, 'unused');
      }
      const agenda = new Map(spokespeople.map((id) => [id, hasAgenda(s, id)])); // from turn-start state
      exchange = engine.resolveSpeech(s, intent, spokespeople, rng);
      const input: DialogueInput = [{ spoken: intent.spoken?.trim() || engine.NO_WORDS, impression: exchange.impression }];
      const world = worldIds(s);
      // NT7: a listener that saw through a lie hears the impression with a tell (plainly with Plain as Day, LI2a)
      // BG-84: a listener who heard only the voice (no contest) is told so, not given the words
      const inputFor = (id: string): DialogueInput => (!exchange!.perSpokesperson[id] ? [{ spoken: engine.MUFFLED, impression: null }] : exchange!.perSpokesperson[id].tell ? [{ ...input[0], impression: `${input[0].impression ?? 'none'}, but ${engine.tellFor(s.actors.find((x) => x.id === id))}` }] : input);
      agentOutputs.push(...(await Promise.all(spokespeople.map((id) => dialogueCall(s, id, inputFor(id), exchange!, agenda.get(id)!, ctx, world)))));
    }
    // BG-50: a beat that has an agent-run NPC speak to the player gets its words from that NPC's Responder (COMMITTED: the beat)
    const beat = engine.beatSpeakers(s, spokespeople);
    if (beat.length) {
      for (const id of beat) {
        const bg = background.get(id);
        if (bg && !bg.collected) drop(bg, 'unused');
      }
      const world = worldIds(s);
      const opening: DialogueInput = [{ spoken: engine.BEAT_OPENING, impression: null }];
      agentOutputs.push(...(await Promise.all(beat.map(async (id): Promise<AcceptedAgentOutput> => {
        const fired = s.hidden.firedLog.filter((f) => f.turn === s.turn && f.ownerId === id).map((f) => f.triggerId);
        const r = await callResponder(views.buildOppositionView(s, id), opening, ctx, { world, committed: fired.length ? committedText(s, id, fired[0]) : null });
        if (r.unlisted.length) reportUnlisted(s, id, r.unlisted, r.output.dialogue?.line ?? '');
        return { agent: 'responder', actorId: id, output: r.output };
      }))));
    }
    // timing rule: resolution never before the previous display plus BACKGROUND_WINDOW, in every mode
    await clock.sleep(lastDisplayAt + CONFIG.BACKGROUND_WINDOW_MS - clock.now());
    if (stopped) return;
    agentOutputs.push(...collectPlanners([...spokespeople, ...beat]));
    agentOutputs.sort((a, b) => (a.actorId < b.actorId ? -1 : a.actorId > b.actorId ? 1 : 0));
    const input: TurnInput = { intent, aimed, agentOutputs, spokespeople, ...(beat.length ? { beatSpeakers: beat } : {}), ...(exchange ? { exchange } : {}), ...(quick && exchange ? { quickWord: true } : {}) };
    const events = engine.resolveTurn(s, input, rng);
    s.rngState = rng.state; // plan updates were applied (with triggers sanitized) inside resolveTurn
    // SD1: the play page can start the ending moment now, while the next scenario's Weaver and the Narrator run
    const ended = pendingEnding(s);
    if (ended) { endingNow = { as: ended, name: SCENARIO_ENDING_NAMES[ended] }; emit(); }
    if (director) {
      events.push(...(await director.afterResolve(s, events, rng, ctx)));
      s.rngState = rng.state;
    }
    // TQ1: a broken world rule is filed as a bug (turn_check); play goes on (tests and playtests run it strict, and stop)
    for (const b of checkTurn(s, before, events)) s.log.push({ turn: s.turn, code: 'turn_check', detail: { ...b } });
    aimNext = false;
    yieldNext = false;
    await finishTurn(s, events, { playerInput: text, rngBefore, aimed, intent, gearBefore, partsBefore, ...(ended ? { ended } : {}) }, spokespeople.length ? submitAt : null);
  }

  /** save → NarrationView → advance → Narrator → display (shared by every turn and by story start) */
  async function finishTurn(s: GameState, events: GameEvent[], rec: { playerInput: string; rngBefore: number; aimed: boolean; intent: Intent | null; gearBefore?: GearSnap; partsBefore?: { id: string; state: PartState }[]; ended?: import('../types').ScenarioEnding }, dialogueSubmitAt: number | null): Promise<void> {
    s.events = events;
    // saved with the engine page, so a reloaded story resolves the next turn exactly as continuous play would
    s.recentEvents = pruneRecent(s, [...(s.recentEvents ?? []), ...events]);
    s.agentLog = [...turnLog];
    const record: TurnRecord = {
      storyId: s.storyId, turn: s.turn, libraryVersion: s.libraryVersion, schemaVersion: CONFIG.SCHEMA_VERSION, rngBefore: rec.rngBefore, playerInput: rec.playerInput,
      agentLog: s.agentLog, events, factsAdded: [], log: s.log, aimed: rec.aimed,
      ...(s.scratch?.eventRoll ? { eventRoll: s.scratch.eventRoll as TurnRecord['eventRoll'] } : {}),
    };
    if (s.scratch) delete s.scratch.eventRoll;
    await amending; // CS12: a perk pick or quest change made before this turn is in the save first
    // save step 1: hold the turn lock. Re-acquiring renews the lease, so a long turn (Weaver wait, slow calls) or the
    // first save of a new story still writes under the lock.
    if (!(await save.acquireTurnLock(store, s.storyId, owner))) {
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
    refreshBackups(s.storyId);
    reportFallbacks(s, turnLog);
    // every bug code logged this turn (an "other" quest goal, QT27, among them) is filed for the build threads
    fileLogBugs(s);
    const nv = views.buildNarrationView(s, events, rec.intent);
    if (rec.ended) nv.scenarioEnded = SCENARIO_ENDING_NAMES[rec.ended];
    const leak = buildLeakContext(s);
    const mechanics = mechanicsLines(s, events, record.eventRoll);
    const turn = s.turn;
    const narrLog = turnLog;
    // D-226: the turn that ended a scenario carries its gains summary, and then not the same achievements, unlocks and levels again
    const scenarioGains = rec.ended ? scenarioGainsNow(s) : undefined;
    const allNotes = turnNotes(s);
    const { achievements: _a, unlocks: _u, levelUps: _l, ...notesRest } = allNotes;
    const notes = scenarioGains ? { ...notesRest, scenarioGains } : allNotes;
    // shown again after a reload: what the turn changed in the gear, and where the player ended it
    const gear = rec.gearBefore ? gearRows(rec.gearBefore, gearSnap(s, s.player)) : [];
    // M-30: the player's body parts that got worse this turn, so the play screen can name them (shown again after a reload)
    const wounds = rec.partsBefore ? partsWorse(rec.partsBefore, partStates(s, s.player)) : [];
    const ways = wayRows(s, events);
    const where = { ...(gear.length ? { gear } : {}), ...(ways.length ? { ways } : {}), ...(wounds.length ? { wounds } : {}), place: { id: s.player.placeId, name: placeName(s), ...zoneOf(s) }, scenario: s.stage.scenarioNumber };
    advance();
    const narr = await callNarrator(nv, ctxFor(turn, narrLog), leak);
    if (dialogueSubmitAt !== null) await clock.sleep(dialogueSubmitAt + CONFIG.DIALOGUE_WINDOW_MS - clock.now());
    const closing = rec.ended && narr.output.closing?.trim();
    // the Gains page shows the scenario's closing line beside its gains (saved with the next turn)
    const kept = closing ? s.player.progression?.gainsLog?.at(-1) : undefined;
    if (kept && kept.endTurn === turn && closing) kept.closing = closing;
    const scenarioEnd = rec.ended ? { scenarioEnd: { as: rec.ended, name: SCENARIO_ENDING_NAMES[rec.ended], ...(closing ? { closing } : {}) } } : {};
    endingNow = null;
    lines.push({ turn, kind: 'narration', text: narr.output.text, ...scenarioEnd, ...(CONFIG.SHOW_MECHANICS && s.settings.showMechanics && mechanics.length ? { mechanics } : {}),
      ...lineExtras(s, events, nv, narr.output.text), ...notes, ...where, ...(rec.intent?.deferred?.length ? { next: rec.intent.deferred.join('. ') } : {}) });
    lastLog = narrLog;
    lastDisplayAt = clock.now();
    await storeHistory(s.storyId);
  }

  /** Q18: save the story column after each turn; a failure keeps play going and only costs text. */
  async function storeHistory(storyId: string): Promise<void> {
    const upTo = lines.length;
    try {
      await save.saveHistory(store, storyId, lines, savedLines);
      savedLines = upTo;
    } catch (e) {
      console.warn('story text not saved', e);
    }
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
        // ✦ marks a tagged skill, as on the Character page (the play screen shows "Tagged" on hover); − a flawed one
        const sheet = Object.entries(p.core.skills);
        const skills = sheet.map(([k, v]) => `${skillName(k)} ${v.raw}${v.state === 'tagged' ? TAG_MARK : v.state === 'flawed' ? '−' : ''}`);
        const off = usedOffSheet(p).map((k) => `${skillName(k)} 0`); // rolled but not on the sheet yet, e.g. fists use Strike
        const key = [sheet.some(([, v]) => v.state === 'tagged') ? `${TAG_MARK} tagged` : '', sheet.some(([, v]) => v.state === 'flawed') ? '− flawed' : ''].filter(Boolean).join(', ');
        return say(`${p.names.current}, ${p.core.classes.map((c) => `${getLibrary().classes[c.classId]?.name ?? c.classId} ${c.level}`).join(', ')}. Health: ${healthWord(p)}. Skills: ${skills.join(', ')}.`
          + (off.length ? ` Also used, not on your sheet yet: ${off.join(', ')}.` : '') + (key ? ` (${key})` : ''));
      }
      case 'inv':
        return say(s.player.core.inventory.map((i) => `${nameOf(s, i.itemId)}${i.qty ? ` ×${i.qty}` : ''}${i.equippedIn?.length ? ` (${i.equippedIn.join(', ')})` : ''}`).join('; ') || 'You carry nothing.');
      case 'quests': {
        const open = s.quests.filter(isOpen);
        return say(open.length ? open.map((q) => [q.text, views.questGoalText(s, q), q.state === 'ready' ? QUEST_STATE_NAME.ready : '', dueText(q), payText(s, q)].filter(Boolean).join(' · ')).join('\n') : 'No active quests.');
      }
      case 'help': {
        const recap = lines.filter((l) => l.kind === 'narration').slice(-3).map((l) => l.text);
        return say([HELP_TEXT, ...(recap.length ? ['Recently:', ...recap] : [])].join('\n'));
      }
      case 'stuck': {
        // SC15: the player says the scenario can go nowhere: a numbered bug, and a Weaver check-in now (no gap or limit)
        if (!s.stage.scenario) return say('There is no scenario to check on yet.');
        ctxFor(s.turn, turnLog).reportBug?.('player_stuck', { scenario: s.stage.scenario.question, note: arg.slice(0, 500) });
        s.stage.checkinDue = 'stuck';
        if (director && !rateLimited && !stopped) director.afterSave(s, { ...ctxFor(s.turn, turnLog), background: true });
        return say('Noted. The story will find a way forward over the next turns; a bad situation stays bad, though.');
      }
      case 'title': {
        // T18: wear one current achievement as a title; it reaches only people who see you (src/views/index.ts)
        const pr = s.player.progression, list = wearable(s);
        if (!pr) return say('You have no achievements to wear.');
        if (arg.toLowerCase() === 'off') { delete pr.title; return say('You wear no title now.'); }
        const n = Number(arg);
        const pick = arg ? (Number.isInteger(n) ? list[n - 1] : list.find((x) => achievementName(s, x).toLowerCase() === arg.toLowerCase())) : undefined;
        if (pick) { pr.title = pick.id; return say(`You now go by ${achievementName(s, pick)}. Only people who see you will know it.`); }
        if (!list.length) return say('You have no achievements to wear yet.');
        return say([`Title: ${wornTitle(s) ?? 'none'}. Type /title and a number to wear one, or /title off.`,
          ...list.map((x, i) => `${i + 1}. ${achievementName(s, x)}`)].join('\n'));
      }
      case 'essence': case 'essences': {
        // growth proposal 2.5: /essence lists offers and held essences; take N [give up M], pass N, remove M (at rest)
        const pr = s.player.progression;
        const [verb, a1, , a3] = arg.toLowerCase().split(/\s+/);
        const n = (x?: string) => (x && /^\d+$/.test(x) ? Number(x) - 1 : -1);
        const done = (err: string | null, ok: string) => say(err ?? ok);
        if (verb === 'take') return done(engine.takeEssence(s, n(a1), engine.playerAtRest(s), a3 !== undefined ? n(a3) : undefined), 'Taken. It is part of you now.');
        if (verb === 'pass') return done(engine.passEssence(s, n(a1)), 'You let it go.');
        if (verb === 'remove') return done(engine.removeEssence(s, n(a1), engine.playerAtRest(s)), 'Gone, and it cost you: one level\'s worth of XP.');
        const offers = pr?.essenceOffers ?? [], held = pr?.essences ?? [];
        return say([
          `Essences: ${held.length} of ${engine.essenceSlots(s.player)} slots.`,
          ...held.map((e, i) => `${i + 1}. ${engine.essenceText(e, skillName)}`),
          ...(offers.length ? ['On offer:', ...offers.map((o, i) => `${i + 1}. ${engine.essenceText(o, skillName)}, until turn ${o.until}`)] : ['Nothing on offer.']),
          'Type /essence take 1 (with every slot full: /essence take 1 give 2), /essence pass 1, or /essence remove 1 (at rest; costs one level of XP).',
        ].join('\n'));
      }
      case 'yield':
        // MB40: yield as a command; the words go to the Parser as the player's line
        yieldNext = true;
        return submit(arg || 'I yield.', opts);
      // attack commands: the words go to the Parser as "I strike …", so no one has to guess what /aim is for
      case 'strike': case 'shoot': case 'throw':
        if (!arg) return say(`/${cmd.toLowerCase()} needs someone to attack, e.g. /${cmd.toLowerCase()} the guard, or /${cmd.toLowerCase()} the guard at his left arm. Put /aim in front to aim at that part.`);
        return submit(`I ${cmd.toLowerCase()} ${arg}`, opts);
      case 'aim':
        aimNext = true;
        if (arg) return submit(arg, opts);
        return say('Your next attack is aimed.');
      case 'undo':
        if (busy) return;
        busy = true;
        await amending;
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
          refreshCopies(state);
          advance();
          lastDisplayAt = clock.now();
          lines.push({ turn: state.turn, kind: 'command', text: 'Turn undone.' });
        } finally {
          busy = false;
          endingNow = null;
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
      await playTurn(state.player.asleep ? ASLEEP_TEXT : t, opts.aimed || aimNext);
      // NW18: while you stay asleep the game plays your turns, up to ASLEEP_AUTO_TURNS before it waits for you
      for (let i = 0; i < CONFIG.ASLEEP_AUTO_TURNS && state?.player.asleep && !stopped; i++) await playTurn(ASLEEP_TEXT, false);
    } catch (e) {
      if (e instanceof StopPlay) stop(e.code);
      else throw e;
    } finally {
      busy = false;
      endingNow = null;
      emit();
    }
  }

  // ---------------- story lifecycle ----------------

  async function newStory(build: CreationBuild, opts: { owner?: StoryOwner } = {}): Promise<void> {
    const owner = opts.owner ?? 'player';
    const errs = validateBuild(build);
    if (errs.length) throw new Error(errs.join('; '));
    // GAP: W6's director is injected; without it there is no way to set up turn 0
    if (!director) throw new Error('scenario director not wired (W6)');
    abortBackground();
    const now = clock.now();
    const storyId = `story_${now.toString(36)}`;
    const seed = (now >>> 0) || 1;
    state = newState(storyId, seed, { ...createPlayer(build, storyId), placeId: CONFIG.STORY_START_PLACE }, new Date(now).toISOString());
    state.player.core.standingDefense = defaultStandingDefense(state, state.player); // same rule as the creation preview
    if (owner === 'agent') state.meta.owner = 'agent'; // the autopilot's own save: one story per owner
    lines = [];
    savedLines = 0;
    notices = [];
    turnLog = [];
    busy = true;
    emit();
    // the build is kept until turn 0 is saved, so closing the game during the opening doesn't lose it (resume restarts it)
    await save.savePendingStart(store, { storyId, build, at: new Date(now).toISOString(), ...(owner === 'agent' ? { owner } : {}) }).catch(() => {});
    try {
      const rng = createRng(seed);
      const events = await director.startStory(state, rng, ctxFor(0, turnLog));
      state.rngState = rng.state;
      await finishTurn(state, events, { playerInput: '', rngBefore: seed, aimed: false, intent: null }, null);
      if (await save.storySaved(store, storyId).catch(() => false)) await save.clearPendingStart(store, owner).catch(() => {});
    } catch (e) {
      if (e instanceof StopPlay) stop(e.code);
      else throw e;
    } finally {
      busy = false;
      endingNow = null;
      emit();
    }
  }

  async function resume(owner: StoryOwner = 'player'): Promise<boolean> {
    // BG-63: switching stories while an opening or a turn is still being written would land that turn on the other story
    if (busy) throw new Error('the story is still being written; switch once it has finished');
    // the owner's newest story runs (same order as save.listStories): one story per owner, the player's and the autopilot's
    const latest = (await save.listStories(store)).find((m) => (m.owner ?? 'player') === owner);
    // a story closed during its opening (turn 0 never saved): start that opening again from the kept build
    const pending = await save.loadPendingStart(store, owner).catch(() => null);
    const pendingLive = !!pending && !(await save.storySaved(store, pending.storyId).catch(() => false)) && !(latest && latest.createdAt > pending.at);
    if (pending && pendingLive) {
      void newStory(pending.build, { owner }).catch((e) => notice({ kind: 'load_refused', text: `The story could not start: ${(e as Error).message}` }));
      return true;
    }
    if (pending) await save.clearPendingStart(store, owner).catch(() => {});
    const storyId = latest?.storyId;
    if (!storyId) return false;
    abortBackground(); // switching stories (the autopilot's own save and back): the old story's background calls stop
    try {
      const loaded = await save.loadStory(store, storyId, getLibrary());
      state = loaded.state;
      refreshCopies(state); // copies follow their template and the level lever
    } catch (e) {
      notice({ kind: 'load_refused', text: `The story could not be loaded: ${(e as Error).message}` });
      return false;
    }
    lines = await save.loadHistory(store, storyId).catch(() => []);
    savedLines = lines.length;
    turnLog = [];
    backups = [];
    refreshBackups(storyId);
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
      const marker: Notice[] = st && (st.fallback || st.routineFallback) ? [{ kind: 'scenario_fallback', text: 'Scenario planning failed: placeholder area' }] : [];
      return [...notices, ...marker];
    },
    busy: () => busy,
    scenarioEnding: () => endingNow,
    fell: () => !!state && downNow(state.player),
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    validateBuild,
    newStory,
    resume,
    hallOfFame: () => save.listFallen(store),
    reportBug: (note) => fileBug(store, clock.now(), { code: 'player_report', storyId: state?.storyId ?? '', turn: state?.turn ?? 0, note: note.slice(0, 2000),
      lastLines: lines.slice(-6).map((l) => `[${l.kind}] ${l.text}`.slice(0, 400)) }),
    openBugs: () => openBugs(store),
    async agentMove(persona = '', style = '', guided?: GuidedCtx) {
      const r = await counted.call({ agent: 'autopilot', input: [{ role: 'user', content: AUTOPILOT_BRIEF }, { role: 'user', content: autopilotTurn(lines, persona, style, agentSaid, guided ? { state, ctx: guided } : undefined, state) }], json: true, signal: AbortSignal.timeout(CONFIG.AUTOPILOT_TIMEOUT_MS), ...modelFor('autopilot') });
      let mv = r.ok ? readMove(r.value, guided?.mustAsk?.kind) : null;
      // BG-25/BG-26: it kept checking its sheet instead of acting. It is told its condition every move, so /stats is always
      // asked again once, and /inv or /quests when it looked within AUTOPILOT_INFO_EVERY moves
      if (mv && (/^\/stats\b/i.test(mv.command) || (INFO_COMMAND.test(mv.command) && agentCmds.some((c) => INFO_COMMAND.test(c))))) {
        const again = await counted.call({ agent: 'autopilot', input: [{ role: 'user', content: AUTOPILOT_BRIEF }, { role: 'user', content: `${autopilotTurn(lines, persona, style, agentSaid, guided ? { state, ctx: guided } : undefined, state)}\n\nYou already know how you are (it is above) and looked at your sheet recently: do not check it now. Act.` }], json: true, signal: AbortSignal.timeout(CONFIG.AUTOPILOT_TIMEOUT_MS), ...modelFor('autopilot') });
        mv = again.ok ? readMove(again.value, guided?.mustAsk?.kind) ?? mv : mv;
      }
      if (mv?.command) agentCmds = [...agentCmds, mv.command].slice(-CONFIG.AUTOPILOT_INFO_EVERY);
      if (mv?.say) agentSaid = [...agentSaid, mv.ja ? `${mv.ja} (${mv.say})` : mv.say].slice(-CONFIG.AUTOPILOT_SAID_KEPT);
      return mv;
    },
    submit,
    endScenario() {
      // SC15: the GM view's End scenario button (testing): the scenario ends after the next turn, recorded as interrupted
      if (!state?.stage.scenario || state.stage.breakCause) return;
      engine.endScenario(state, 'interrupted', 'ended from the GM view');
      emit();
    },
    async reset() {
      abortBackground();
      if (state) {
        // D-73: archive, so a reload starts fresh instead of loading the old story again
        const at = new Date(clock.now()).toISOString();
        // hall of fame: a character archived while down is kept as they fell
        await save.archiveStory(store, state.storyId, at, downNow(state.player) ? fameEntry(state, lines, placeName(state), at) : undefined);
        await save.releaseTurnLock(store, state.storyId, owner).catch(() => {});
      }
      state = null;
      lines = [];
      backups = [];
      savedLines = 0;
      notices = notices.filter((n) => n.kind === 'stop_play');
      turnLog = [];
      lastLog = [];
      emit();
    },
    calls: () => calls,
    working: () => [...running.values()],
    gm: (): GmSnapshot => ({
      state,
      agentLog: lastLog,
      log: state?.log ?? [],
      fallbackBanner: !!(state?.stage.fallback || state?.stage.routineFallback),
      backups,
    }),
    /** BG-123: the GM view's Restore: the save checks the backup, writes a new head on it and keeps the current head as the
     * safety bookmark; play goes on from the restored turn, as after /undo */
    async restoreBackup(turn) {
      const s = state;
      if (!s || busy) return;
      busy = true;
      emit();
      await amending;
      try {
        abortBackground();
        state = (await save.restoreBackup(store, s.storyId, turn, getLibrary())).state;
        refreshCopies(state);
        advance();
        lastDisplayAt = clock.now();
        lines.push({ turn: state.turn, kind: 'command', text: `Restored the backup from turn ${turn}.` });
      } catch (e) {
        notice({ kind: 'load_refused', text: `The backup could not be restored: ${(e as Error).message}` });
      } finally {
        busy = false;
        endingNow = null;
        refreshBackups(s.storyId);
        emit();
      }
    },
    // CS12: each of these is saved at once (amend), so a reload keeps it; a perk pick stays undoable until the next turn (K3)
    takePerk(id) { if (state && !busy) { takePerk(state, state.player, id); amend((x) => takePerk(x, x.player, id)); emit(); } },
    undoPerk(id) { if (state && !busy) { undoPerk(state, state.player, id); amend((x) => undoPerk(x, x.player, id)); emit(); } },
    abandonQuest(id) { if (state && !busy && abandonQuest(state, id)) { amend((x) => { abandonQuest(x, id); }); emit(); } },
    pinQuest(id) { if (state && !busy) { pinQuest(state, id); amend((x) => pinQuest(x, id)); emit(); } },
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

export { hasAgenda };

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

/** engaged significant actors, not broken, nearest the player first (ties by id), then (PM8) agent actors in an open deal,
 * so a companion can act on one instead of only following. Minor and over-cap actors use combat lists. */
export function plannerActors(s: GameState): string[] {
  const dist = zoneDistances(s, s.player.zone);
  const dealt = (s.hidden.agreements ?? []).flatMap((g) => g.parties).filter((id) => id !== s.player.id && !s.pending.engaged.includes(id));
  return [...s.pending.engaged, ...new Set(dealt)]
    .map((id) => s.actors.find((a) => a.id === id))
    .filter((a): a is Actor => !!a && a.mind?.control === 'agent' && a.mind.moraleState !== 'broken' && !a.asleep) // NW20: a sleeper is not asked
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
const eventOrd = (id: string) => {
  const m = /^t(\d+)(?:\.(\d+))?/.exec(id);
  return m ? Number(m[1]) * 1e5 + Number(m[2] ?? 0) : -1;
};
const EARLIER = /^turn (\d+)(?:–(\d+))?: (.*?)(?: ×(\d+))?$/;
/** PM6: events an NPC perceived that fall out of its recent window become short code-made lines
 * (no Claude call). A line that repeats the one before it is counted instead (×n); only the last EARLIER_LINES stay. */
function noteEarlier(s: GameState, a: Actor, dropping: GameEvent[]): void {
  const m = a.mind;
  if (!m || !dropping.length) return;
  const upTo = eventOrd(m.earlier?.upTo ?? '');
  const lines = [...(m.earlier?.lines ?? [])];
  for (const e of dropping.filter((x) => eventOrd(x.id) > upTo)) {
    const text = views.earlierLine(s, a, e);
    if (!text) continue;
    const last = lines.length ? EARLIER.exec(lines[lines.length - 1]) : null;
    if (last && last[3] === text) lines[lines.length - 1] = `turn ${last[1]}${String(e.turn) === last[1] ? '' : `–${e.turn}`}: ${text} ×${Number(last[4] ?? 1) + 1}`;
    else lines.push(`turn ${e.turn}: ${text}`);
  }
  m.earlier = { upTo: dropping[dropping.length - 1].id, lines: lines.slice(-CONFIG.EARLIER_LINES) };
}

export function pruneRecent(s: GameState, all: GameEvent[]): GameEvent[] {
  const keep = new Set<GameEvent>();
  const n = CONFIG.RECENT_EVENTS;
  for (const a of [s.player, ...s.actors]) {
    const seen = all.filter((e) => e.perception[a.id]);
    if (a.mind) noteEarlier(s, a, seen.filter((e) => !barkOnly(e)).slice(0, -n));
    for (const e of seen.filter((e) => !barkOnly(e)).slice(-n)) keep.add(e);
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

function safeHealth(a: Actor): HealthLevel | undefined {
  try {
    return healthLevel(a);
  } catch {
    return undefined;
  }
}
const downNow = (a: Actor) => { const l = safeHealth(a); return !!l && isDownLevel(l); };
const healthWord = (a: Actor) => { const l = safeHealth(a); return l ? HEALTH_LEVELS.name(l) : 'unknown'; };
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
/** H11, V1b, V2a: the player's healing, skill gains and milestones from this turn's code log, kept on the story line
 * because advance() clears the log. Failed improvement rolls log nothing, so they show nothing. X9: level-ups and
 * achievements from the player's progression, so the play screen can show them with mechanics off. */
export function turnNotes(s: GameState): Pick<LogLine, 'heals' | 'unlocks' | 'gains' | 'timePassed' | 'levelUps' | 'achievements'> {
  const heals: HealNote[] = [], unlocks: { skill: string; milestone: number }[] = [], gains: Record<string, number> = {};
  let minutes = 0;
  for (const l of s.log) {
    if (l.turn !== s.turn) continue;
    if (l.code === 'healed') {
      const d = l.detail as HealNote & { actorId: string };
      if (d.actorId === s.player.id) heals.push({ source: d.source, from: d.from, to: d.to, parts: d.parts, ...(d.better ? { better: true } : {}) });
    } else if (l.code === 'skill_improved') {
      const d = l.detail as { skill: string; from: number; to: number; milestone?: number };
      gains[d.skill] = (gains[d.skill] ?? 0) + d.to - d.from;
      if (d.milestone) unlocks.push({ skill: d.skill, milestone: d.milestone });
    } else if (l.code === 'time_passed') minutes += (l.detail as { minutes: number }).minutes;
  }
  const timePassed = minutes > 0 ? { minutes: Math.round(minutes), day: timeView(s).day, timeOfDay: timeOfDay(now(s)) } : undefined;
  const pr = s.player.progression;
  const levelUps = (pr?.xpLog ?? []).filter((x) => x.turn === s.turn && x.levelUp).map((x) => ({ ...x.levelUp! }));
  const achievements = (pr?.achievements ?? []).filter((a) => a.turn === s.turn).map((a) => engine.achievementInfo(s, a));
  return { ...(heals.length ? { heals } : {}), ...(unlocks.length ? { unlocks } : {}), ...(Object.keys(gains).length ? { gains } : {}), ...(timePassed ? { timePassed } : {}),
    ...(levelUps.length ? { levelUps } : {}), ...(achievements.length ? { achievements } : {}) };
}

/** body parts whose state got worse between two snapshots, worst first in body order (M-30) */
export function partsWorse(before: { id: string; state: PartState }[], after: { id: string; state: PartState }[]): { id: string; from: PartState; to: PartState }[] {
  const was = new Map(before.map((p) => [p.id, p.state]));
  return after.filter((p) => was.has(p.id) && PART_STATES.pos(p.state) > PART_STATES.pos(was.get(p.id)!))
    .map((p) => ({ id: p.id, from: was.get(p.id)!, to: p.state }));
}

/** the player's gear as code saw it: item id → name, where it sits ("held:right hand", "worn", "pack") and how many */
export type GearSnap = Map<string, { name: string; where: string; qty: number }>;
const handWord = (slot: string) => gripWord(slot.replace(/^grip:/, ''));
export function gearSnap(s: GameState, p: Actor): GearSnap {
  const gear: GearSnap = new Map();
  for (const i of p.core.inventory) {
    const hands = (i.equippedIn ?? []).filter((x) => x.startsWith('grip:'));
    let name = i.itemId;
    try { name = itemDef(s, i.itemId).name; } catch { /* an unknown item keeps its id */ }
    gear.set(i.id, { name, qty: i.qty ?? 1, where: hands.length ? `held:${hands.map(handWord).join(' and ')}` : i.equippedIn?.length ? 'worn' : 'pack' });
  }
  return gear;
}
/** ready-to-show rows for what a turn changed in the player's gear: "Picked up: …", "Now held: right hand · …" */
export function gearRows(a: GearSnap, b: GearSnap): string[] {
  const rows: string[] = [];
  for (const [id, x] of b) {
    const was = a.get(id);
    if (!was || x.qty > was.qty) rows.push(`Picked up: ${x.name}`);
    else if (x.qty < was.qty) rows.push(`Used: ${x.name}`);
    if (was && was.where === x.where) continue;
    if (x.where.startsWith('held:')) rows.push(`Now held: ${x.where.slice(5)} · ${x.name}`);
    else if (x.where === 'worn') rows.push(`Now worn: ${x.name}`);
    else if (was) rows.push(`Put away: ${x.name}`);
  }
  for (const [id, x] of a) if (!b.has(id)) rows.push(`Gone: ${x.name}`);
  return rows;
}

/** what the player did at a barrier, as the play screen's Way row words it (BG-65: a way with nothing on it says "way") */
const WAY_ROW: Record<WayDid, string> = {
  unlocked: 'unlocked with your key on the way through', unbarred: 'you slid its bar back on the way through',
  found_locked: 'locked', found_barred: 'barred from the other side', found_blocked: 'blocked, no way through',
  lock: 'you locked it', unlock: 'you unlocked it', bar: 'you slid its bar across', unbar: 'you slid its bar back',
  open: 'you left it standing open', shut: 'you shut it',
  picked: 'lock picked, it opens', picking: 'picking the lock, not open yet', not_yet: 'picking the lock, not open yet',
  beyond: 'this lock is beyond you for now', pick_broke: 'your pick snapped in the lock',
  found_open: 'nothing locks it', found_opens: 'shut, but you can open it',
};
/** ready-to-show rows for what the player did at barriers this turn: "Door to the cellar: locked" */
export function wayRows(s: GameState, events: GameEvent[]): string[] {
  const rows: string[] = [];
  for (const e of events) {
    if (e.actorId !== s.player.id || !e.way) continue;
    const b = e.way.barrier ? s.barriers?.[e.way.barrier] : undefined;
    const what = b ? barrierName(b) : 'way';
    const to = zoneById(s, e.way.to)?.name ?? e.way.to;
    const row = `${what.charAt(0).toUpperCase()}${what.slice(1)} to ${to}: ${WAY_ROW[e.way.did]}`;
    if (!rows.includes(row)) rows.push(row);
  }
  return rows;
}

/** where the player is: "River path · the Riverside" (the place and the place around it) */
/** the zone the player ended the turn in, as the play header names it */
const zoneOf = (s: GameState): { zone?: string } => { const z = zoneById(s, s.player.zone)?.name; return z ? { zone: z } : {}; };

export function placeName(s: GameState): string {
  const place = s.places.find((x) => x.id === s.player.placeId);
  const parent = place?.parentId ? s.places.find((x) => x.id === place.parentId) : undefined;
  const t = [place?.names.current, parent?.names.current].filter(Boolean).join(' · ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function lineExtras(s: GameState, events: GameEvent[], nv: NarrationView, narration: string): Pick<LogLine, 'check' | 'speech' | 'changes' | 'incomingChecks' | 'downedBy'> {
  const out: Pick<LogLine, 'check' | 'speech' | 'changes' | 'incomingChecks' | 'downedBy'> = {};
  const who = (n: string, start: boolean) => (n === 'player' ? (start ? 'You' : 'you') : start ? n.charAt(0).toUpperCase() + n.slice(1) : n);
  const words = (x: string) => x.replace(/_/g, ' ');
  let check: LineCheck | undefined, checkEv: string | undefined;
  for (const e of events) {
    if (check) break;
    checkEv = e.id;
    if (e.attack && e.attack.attackerId === 'player') {
      const a = e.attack;
      const pk = nv.events.find((x) => x.id === e.id)?.packet;
      const loc = pk?.location?.part ?? (a.location ? words(a.location) : '');
      check = {
        kind: 'attack', skill: a.attack.skill, ...tierPart(a.attack),
        ...(a.defense && a.defenseType ? { against: { what: `${views.callName(s, 'player', a.targetId)}’s ${a.defenseType}`, ...tierPart(a.defense) } } : {}),
        result: `${pk?.outcome ?? words(a.outcome)}${loc ? `, ${loc}` : ''}`,
      };
    } else if (e.contest && (e.contest.a.actorId === 'player' || e.contest.b.actorId === 'player')) {
      const c = e.contest;
      const mine = c.a.actorId === 'player' ? c.a : c.b, other = mine === c.a ? c.b : c.a;
      const result = c.winner === 'tie' ? 'a tie' : (c.winner === 'a') === (mine === c.a) ? 'you win' : 'you lose';
      check = { kind: 'contest', skill: mine.skill, ...tierPart(mine), against: { what: views.callName(s, 'player', other.actorId), ...tierPart(other) }, result };
    } else if (e.roll && e.roll.actorId === 'player') {
      check = { kind: 'roll', skill: e.roll.skill, ...tierPart(e.roll), result: tierAtLeast(e.roll.tier, 'success') ? 'you make out who is there' : 'nothing clearer' };
    }
  }
  if (check) out.check = check;
  // rolls others made against the player: attacks on them, and contests they were drawn into beyond their own check
  const incoming: NonNullable<LogLine['incomingChecks']> = [];
  for (const e of events) {
    const pk = nv.events.find((x) => x.id === e.id)?.packet;
    if (e.attack && e.attack.targetId === 'player' && e.attack.attackerId !== 'player') {
      const a = e.attack;
      const loc = pk?.location?.part ?? '';
      incoming.push({ by: pk?.actor ?? 'someone', kind: 'attack', skill: a.attack.skill, ...tierPart(a.attack),
        ...(a.defense && a.defenseType ? { against: { what: `your ${a.defenseType}`, ...tierPart(a.defense) } } : {}),
        result: `${pk?.outcome ?? words(a.outcome)}${loc ? `, ${loc}` : ''}` });
    } else if (e.contest && e.actorId !== 'player' && e.id !== checkEv) {
      const c = e.contest;
      const mine = c.a.actorId === 'player' ? c.a : c.b.actorId === 'player' ? c.b : null;
      if (!mine) continue;
      const other = mine === c.a ? c.b : c.a;
      const result = c.winner === 'tie' ? 'a tie' : (c.winner === 'a') === (mine === c.a) ? 'you win' : 'you lose';
      incoming.push({ by: views.callName(s, 'player', other.actorId), kind: 'contest', skill: other.skill, ...tierPart(other), against: { what: `your ${skillName(mine.skill).toLowerCase()}`, ...tierPart(mine) }, result });
    }
  }
  if (incoming.length) out.incomingChecks = incoming;
  // the turn left the player down: name the last blow that hurt them (only hits lower health), as they perceived it
  if (s.player.id === 'player' && downNow(s.player)) {
    const hit = [...events].reverse().find((e) => e.attack && e.attack.targetId === 'player' && e.attack.damage > 0);
    if (hit?.attack) {
      const pk = nv.events.find((x) => x.id === hit.id)?.packet;
      const by = pk?.actor && pk.actor !== 'player' ? pk.actor : 'someone';
      const loc = hit.attack.location; // an unseen blow is still felt where it lands
      out.downedBy = { by, weapon: pk ? pk.weapon : null, part: pk?.location?.part ?? (loc && loc !== 'general' && loc !== 'shield' ? words(loc) : null),
        outcome: pk?.outcome ?? words(hit.attack.outcome),
        ...(by === 'someone' ? { unseen: true as const } : {}) };
    }
  }
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
export function tierGap(mine: TierRoll, theirs: TierRoll): string {
  const d = tierLevel(mine) - tierLevel(theirs);
  return d === 0 ? 'same tier' : `${Math.abs(d)} tier${Math.abs(d) === 1 ? '' : 's'} ${d > 0 ? 'ahead' : 'behind'}`;
}

/** mechanics panel: dice, modifiers and damage of events the player took part in or perceived clearly (never sent to an
 * agent). Someone the player doesn't clearly perceive stays "someone", an event only heard or glimpsed shows no dice,
 * and a sight or hearing roll shows only once its target is perceived (UI5). */
export function mechanicsLines(s: GameState, events: GameEvent[], eventRoll?: TurnRecord['eventRoll']): string[] {
  const me = s.player.id;
  const pv = views.buildPlayerView(s).actors;
  const seen = new Set(pv.map((a) => a.id)), clear = new Set(pv.filter((a) => a.level === 'full').map((a) => a.id));
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  const name = (id: string) => (id === me ? 'You' : clear.has(id) ? cap(views.callName(s, me, id)) : 'Someone');
  const whose = (id: string) => (id === me ? 'Your' : `${name(id)}’s`);
  const num = (n: number) => String(Math.round(n * 10) / 10);
  const mods = (m: { source: string; value: number }[]) => (m.length ? ` [${m.map((x) => `${x.source} ${x.value >= 0 ? '+' : ''}${num(x.value)}`).join(', ')}]` : '');
  const roll = (r: TierRoll & { actorId: string; skill: string; d100: number }) => `${whose(r.actorId)} ${skillName(r.skill).toLowerCase()} d100 ${r.d100} → ${tierName(r)}`;
  const sense = (skill: string) => !!noticeCue(skill);
  const unseen = (id: string | undefined) => !!id && id !== me && s.actors.some((a) => a.id === id) && !seen.has(id);
  const part = (a: { location: string | null; targetId: string }) => {
    const t = a.location === 'general' ? actorById(s, a.targetId) : undefined;
    return t ? actorBody(s, t).general.name : a.location?.replace(/_/g, ' ');
  };
  const out: string[] = [];
  // ER5: a scenario's event roll, first, when it was made this turn (only ever shown here, with Show rolls on)
  if (eventRoll) out.push(`Event roll d100 ${eventRoll.roll} → ${tierName(eventRoll)}${mods(eventRoll.modifiers)}`);
  for (const e of events) {
    const target = e.attack?.targetId ?? e.target;
    if (e.actorId !== me && target !== me && e.perception[me]?.level !== 'full') continue;
    if (e.attack) {
      const a = e.attack;
      const def = a.defense ? `; ${a.defenseType} d100 ${a.defense.d100} → ${tierName(a.defense)}${mods(a.defense.modifiers)}` : '';
      const where = part(a);
      out.push(`${name(a.attackerId)} → ${a.targetId === me ? 'you' : name(a.targetId)}: ${skillName(a.attack.skill)} d100 ${a.attack.d100} → ${tierName(a.attack)}${mods(a.attack.modifiers)}${def}` +
        `${a.gap !== null ? `; gap ${a.gap}` : ''}; ${outcomeText(a.outcome)}${where ? ` (${where})` : ''}${a.damage ? `, damage ${num(a.damage)}` : ''}`);
    } else if (e.contest) {
      const c = e.contest;
      if ((sense(c.a.skill) || sense(c.b.skill)) && (unseen(c.a.actorId) || unseen(c.b.actorId))) continue;
      const won = c.winner === 'tie' ? 'a tie' : (c.winner === 'a' ? c.a : c.b).actorId === me ? 'you win' : `${name((c.winner === 'a' ? c.a : c.b).actorId)} wins`;
      out.push(`${roll(c.a)} vs ${roll(c.b).replace(/^Your/, 'your')}: ${won}`);
    } else if (e.roll) {
      if (sense(e.roll.asked ?? e.roll.skill) && unseen(e.target)) continue;
      out.push(`${roll(e.roll)}${mods(e.roll.modifiers)}`);
    } else if (e.check) {
      const k = e.check;
      if (sense(k.asked ?? k.skill) && unseen(e.target)) continue;
      out.push(`${whose(k.actorId)} ${skillName(k.skill).toLowerCase()} vs difficulty ${k.target}: ${k.passed ? 'passed' : 'failed'}${mods(k.modifiers)}`);
    }
  }
  // X9: XP awards and level-ups this turn
  const turn = events[0]?.turn ?? s.turn;
  const ach = s.player.progression?.achievements ?? [];
  for (const x of s.player.progression?.xpLog ?? []) {
    if (x.turn !== turn) continue;
    if (x.levelUp) { out.push(`Level ${x.levelUp.level}! (${x.levelUp.classId ? getLibrary().classes[x.levelUp.classId]?.name ?? x.levelUp.classId : 'bonus level'})`); continue; }
    const [kind, id] = x.source.split(/:(.*)/);
    const what = kind === 'defeat' ? name(id) : kind === 'achievement' ? `achievement: ${engine.achievementName(s, ach.find((a) => a.id === id) ?? { id })}` : x.source;
    out.push(`+${num(x.amount)} XP (${what})`);
  }
  // H11: healing; the look is the designer's (plain text for now)
  for (const l of s.log) {
    if (l.turn !== turn || l.code !== 'healed') continue;
    const d = l.detail as HealNote & { actorId: string };
    if (d.actorId !== s.player.id) continue;
    const H = HEALTH_LEVELS.name, P = PART_STATES.name;
    const bits = [...(d.from !== d.to ? [`${H(d.from)} → ${H(d.to)}`] : []), ...d.parts.map((p) => `${p.id.replace(/_/g, ' ')} ${P(p.from)} → ${P(p.to)}`)];
    out.push(`${engine.healingName(d.source)}: ${bits.length ? bits.join(', ') : d.better ? 'a little better' : 'no change'}`);
  }
  // a healing item the rules refuse says why, and stays in the pack (Q3)
  for (const l of s.log) {
    if (l.turn !== turn || l.code !== 'heal_blocked') continue;
    const d = l.detail as { actorId: string; source: string; reason: string };
    if (d.actorId !== s.player.id) continue;
    out.push(`${engine.healingName(d.source)}: ${d.reason === 'nothing_to_heal' ? 'nothing to heal, so you keep it' : 'not while someone hostile is near you'}`);
  }
  // run 17: a rest or wait that the rules refuse says why, so the player doesn't keep trying
  for (const l of s.log) {
    if (l.turn !== turn || (l.code !== 'rest_blocked' && l.code !== 'wait_blocked')) continue;
    const d = l.detail as { actorId: string; reason: string; timeOfDay?: string };
    if (d.actorId !== s.player.id) continue;
    const what = l.code === 'rest_blocked' ? 'Rest' : 'Wait';
    const why = d.reason === 'cooldown' ? 'too soon after your last rest'
      : d.reason === 'already' ? `it's already ${TIME_OF_DAY.name(d.timeOfDay as TimeOfDay).toLowerCase()}` : 'not while someone hostile is near you';
    out.push(`${what}: ${why}`);
  }
  // TV7: a trip says how far it went and why it stopped
  for (const l of s.log) {
    if (l.turn !== turn || l.code !== 'travelled') continue;
    const d = l.detail as { actorId: string; metres: number; pace: string; night: boolean; stop: string };
    if (d.actorId !== s.player.id) continue;
    out.push(`Travelled ${views.distText(d.metres)} at a ${d.pace} pace${d.night ? ' in the dark' : ''}${d.stop === 'nightfall' ? ' · stopped at nightfall' : d.stop === 'encounter' ? ' · stopped by an encounter' : ''}`);
  }
  // T6: a wait or sleep says how long it took and where the clock is now
  for (const l of s.log) {
    if (l.turn !== turn || l.code !== 'time_passed') continue;
    const t = timeView(s);
    out.push(`Time passes: ${durationText((l.detail as { minutes: number }).minutes)} (Day ${t.day} · ${t.timeOfDay})`);
  }
  // NW15/NW18: the night watch, and what woke you
  for (const l of s.log) {
    if (l.turn !== turn) continue;
    const d = l.detail as { actorId: string; why?: string; watches?: { actorId: string; from: number; to: number }[] };
    if (d.actorId !== s.player.id) continue;
    if (l.code === 'night_started' && d.watches?.length) {
      const i = d.watches.findIndex((w) => w.actorId === s.player.id);
      out.push(`Night watch: ${d.watches.length} watches; yours is ${clockText(d.watches[i].from)} to ${clockText(d.watches[i].to)}`);
    } else if (l.code === 'woke') {
      const why = { blow: 'a blow wakes you', noise: 'a loud noise wakes you', heard: `you hear someone come (${getLibrary().perks[LIGHT_SLEEPER]?.name ?? 'Light Sleeper'})`, rested: 'you wake rested', watch: 'you wake for your watch' }[d.why ?? 'rested'];
      out.push(`Awake: ${why}`);
    }
  }
  if (s.player.asleep) out.push('Asleep');
  // AG16: the player's life stage changed as time passed
  for (const l of s.log) {
    if (l.turn !== turn || l.code !== 'stage_changed') continue;
    const d = l.detail as { actorId: string; stage: string; years: number };
    if (d.actorId === s.player.id) out.push(`You are now ${d.stage} (age ${d.years})`);
  }
  // SP10/SP11: skill gains and newly reached milestones; failed improvement rolls show nothing
  for (const l of s.log) {
    if (l.turn !== turn || l.code !== 'skill_improved') continue;
    const d = l.detail as { skill: string; from: number; to: number; milestone?: number };
    const name = skillName(d.skill);
    out.push(`${name} ${d.from} → ${d.to}`);
    if (d.milestone) out.push(`New perk unlocked: ${name} ${d.milestone}`);
  }
  return out;
}

// Player creation and build checks live in src/library/spawn.ts (createPlayer, validateBuild), shared with the creation preview.

function newState(storyId: string, seed: number, player: Actor, createdAt: string): GameState {
  const settings = defaultSettings();
  return {
    storyId, turn: 0, mode: 'explore', zones: [], player, actors: [],
    bands: [{ id: 'player_band', name: 'the player', goals: '', temperament: '', tactics: 'simple', lethal: true, relations: {} }],
    hidden: { plans: {}, memory: {}, secrets: [], firedLog: [], weaverNote: '', stage: { eventSummary: '', challenge: 'none', gain: 'none', hiddenTerms: [] } },
    events: [], agentLog: [], log: [], rngSeed: seed, rngState: seed,
    pending: { turn: 0, mode: 'explore', engaged: [], fired: [] },
    places: [], facts: [], stage: { zoneIds: [], tier: 'success', scenarioNumber: 0, scenarioStartTurn: 0 },
    scenarioCaps: { promotions: 0, minted: 0 }, clocks: {}, flags: {}, quests: [], settings,
    libraryVersion: getLibrary().version, blueprints: [],
    meta: { storyId, title: CONFIG.STORY_PREMISE, schemaVersion: CONFIG.SCHEMA_VERSION, createdAt, settings },
  };
}
