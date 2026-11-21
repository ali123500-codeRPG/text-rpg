// The turn pipeline (Part 2, Architecture: one turn) behind GameApi.
// Order per turn: Parser → [dialogue calls] → BACKGROUND_WINDOW gate → collect Planners → resolveTurn → scenario setup
// → plan updates → save → NarrationView → advance (turn N+1 pending, background Planners) → Narrator → [DIALOGUE_WINDOW] → display.
import { waysOut } from '../plan/where';
import { gripWord, gripsOf } from '../ruleset/gear';
import { coinWords, coins, countWords } from '../engine/trade';
import { isBrokenLevel, isCoweringLevel, moraleLevel } from '../ruleset/morale';
import { IT } from '../library/itemIds';
import type { AgentName, StoryOwner, TierRoll, DefeatWhy, XpAward, TierShift,
  AgentTurnLog, ClaudeClient, ClaudeErrorCode, Clock, CreationBuild, DialogueInput, GameApi, GameEvent, GameState,
  GmSnapshot, HealNote, Intent, LineCheck, LogLine, NarrationView, Notice, OppositionView, PartState, HealthLevel, PlannerOutput, Rng, TurnRecord, Actor, WayDid,
} from '../types';
import { SCENARIO_ENDING_NAMES, SPEECH_ACTIONS, type HitNote, type ScenarioEndNote } from '../types';
import { pendingEnding } from '../engine/scenarioEnd';
import type { ScenarioRecord } from '../types';
import { callChronicler } from './chronicler';
import { callWitness } from './witness';
import { renounceVow, swearVow } from '../engine/vows';
import { barrierName } from '../engine/barriers';
import { scenarioGainsNow } from '../engine/growth';
import { CONFIG, defaultSettings } from '../config';
import { clockText, dayOf, durationText, noteTurnEnd, now, now as gameNow, timeOfDay, timeView } from '../time';
import { outcomeText, struck } from '../ruleset/hits';
import { GRADE_LEVELS, HEALTH_LEVELS, PART_STATES, TIME_OF_DAY, type TimeOfDay } from '../scales';
import { createRng } from '../rng';
import * as engine from '../engine';
import { hasAgenda } from '../engine/relations';
import type { AcceptedAgentOutput, ExchangeSpeech, TurnInput } from '../engine';
import { busyNow } from '../engine/busy';
import { NERVE_BLOCKED, NERVE_MOVES } from '../minds';
import * as views from '../views';
import * as save from '../save';
import type { Store } from '../save';
import { actorBody, getLibrary, hasTemplate, itemDef, npcTemplate } from '../library';
import { RO } from '../library/npcLayerIds';
import { fightingWith, onFightSide } from '../engine/engagement';
import { actorById, allActors, isActive, zoneById } from '../engine/relations';
import { skillName } from '../library/skillNames';
import { createPlayer, refreshCopies, validateBuild } from '../library/spawn';
import { threadboundInWorld } from '../ruleset/threadboundItems';
import { achievementName, wearable, wornTitle } from '../engine/xp';
import { defaultStandingDefense, healthLevel, isDownLevel, partStates, FLAW_MARK, TAG_MARK, takePerk, tierAt, tierAtLeast, tierLevel, tierName, tierPart, undoPerk, usedOffSheet } from '../ruleset';
import { partName } from '../ruleset/body';
import { StopPlay, callGate, modelFor, type AgentCtx, type RunResult } from './call';
import { echoPast, fameEntry } from './fame';
import { echoSheet } from '../library/echo';
import { deedSendId, deedSends, librarySends, saveDeedSends, saveSend, sendId } from '../save/sends';
import { AUTOPILOT_BRIEF, autopilotTurn, readMove } from './autopilot';
import type { GuidedCtx } from './crossroads';

import { acceptIntent, callNarrator, callParser, callPlanner, callResponder, callVoice } from './wrappers';
import { visitedZoneIds } from '../engine/trail';
import { buildLeakContext } from './narration';
import { barkOnly, keptBy, noticeCue } from '../perception';
import { FIXED } from './prompts';
import { formatOppositionView } from './format';
import { QUEST_STATE_NAME, abandonQuest, dueText, isOpen, payText, pinQuest } from '../engine/quests';
import { setSignatures } from '../ruleset/personality';
import { fileBug, isBugCode, openBugs } from '../save/bugs';
import { answering } from './answering';
import { TURN_CHECK, checkTurn, snapTurn } from '../save/turnCheck';
import { cap, listWords, r1 } from '../words';
import { addWant, ruleWant, wantKey } from '../scenario/wants';

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

/** NB5/BF37/BF79: what the game says when only what a broken nerve blocks was asked (an attack, a grab, a filch, a perk
 * move, a walk toward a foe); the order is turned away and no time passes */
export const NERVE_REFUSED = "Your nerve is broken: you can't bring yourself to attack or go toward a foe. Nothing happened and no time passed. You can still back away or run, talk, beg, yield, give, use an item such as a bandage, pick something up, or open a door or container within reach.";
/** BF79: the same at Cowering, below Broken, where not even flight is left */
export const NERVE_COWERING_REFUSED = "You are cowering: you can't bring yourself to move or attack. Nothing happened and no time passed. You can still talk, beg, yield, give, use an item such as a bandage, pick something up, or open a door or container within reach. With nothing else to do, you cower where you stand.";
/** BF37/BF79: the intent asks only for what a broken nerve blocks (an attack, a grab, a filch, a perk move, a walk it turns
 * back: toward a foe, or any walk at Cowering) and no words */
function nerveBlocksAll(s: GameState, i: Intent): boolean {
  const cowering = isCoweringLevel(moraleLevel(s.player));
  const stops = cowering ? [...NERVE_BLOCKED, ...NERVE_MOVES] : NERVE_BLOCKED;
  const blocked = (t?: string) => !!t && stops.includes(t);
  const walkBack = !!i.move && engine.nerveTurnsBack(s, s.player, engine.fromIntent(s, i, false));
  const wants = walkBack || !!i.perkMove || blocked(i.action?.type);
  const allowed = !!i.spoken || !!i.gear?.length || !!i.way || (!!i.move && !walkBack) || (!!i.action && !blocked(i.action.type) && !NERVE_MOVES.includes(i.action.type));
  return wants && !allowed;
}
export const ASLEEP_TEXT = '(asleep)';
export const READY_TEXT = '(waiting)'; // AE6 (RQ2 a): a fight turn the game plays while a readied step waits
export const DOWN_TEXT = '(down)'; // D-239: the turn the foes decide whether to spare the downed player
/** IQ7 a: said when Finish the fight is asked for with no fight far below the player */
export const FINISH_REFUSED = 'There is no fight here so far below you that it can be played out in one go.';
/** IQ4 a: a finished fight's blow each round: an attack on that foe with what is in hand */
const finishAttack = (target: string): Intent => ({ move: null, action: { type: 'attack', skill: '', target, targetPart: null, item: null, mode: null, approach: '' }, gear: null, spoken: null, addressees: null, deferred: [], clarify: null });
/** the bands of the people the player can see (the Parser's legality reads them) */
const bandsOf = (s: GameState, pv: import('../types').PlayerView) => pv.actors.map((a) => s.actors.find((x) => x.id === a.id)?.bandId ?? '').filter(Boolean);
/** NW18: a turn played while the player sleeps */
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
  let readyStops = false; // AE6: something new happened in the last turn while a readied step waited (orderStops)
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
  /** NV1 b: each fighter's fightKey when last checked, by story and actor id; a change is a turning point */
  const fightSeen = new Map<string, string>();
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
  /** a throw caught so play goes on is still a bug: filed as code_error; under the strict turn checker (tests) it throws */
  const codeError = (where: string, e: unknown) => {
    if (state) void fileBug(store, clock.now(), { code: 'code_error', storyId: state.storyId, turn: state.turn, where, message: String((e as Error)?.message ?? e).slice(0, 500) });
    if (TURN_CHECK.strict) throw e;
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
    const fights = plannerActors(s).filter((id) => {
      const a = actorById(s, id)!, key = `${s.storyId}:${id}`;
      if (!inFight(s, a) || plansEveryTurn(s, a)) { fightSeen.delete(key); return true; }
      const k = fightKey(s, a), turning = fightSeen.get(key) !== k || answerDue(s, a);
      fightSeen.set(key, k);
      return turning; // NV1 b: between turning points code runs its deeds (merge.ts: combat list)
    });
    for (const actorId of [...fights.slice(0, CONFIG.MAX_PLANNER_CALLS), ...goalThinkers(s, new Set(fights)).slice(0, CONFIG.UNIQUE_THINKS_PER_TURN)]) {
      const controller = new AbortController();
      const view = views.buildOppositionView(s, actorId); // from saved state, before submit
      const bg: Background = { actorId, controller, view, startedAt: clock.now(), done: false, collected: false, promise: Promise.resolve() };
      bg.promise = (async () => {
        try {
          bg.run = await callPlanner(view, { ...ctx, log: () => {}, background: true }, { signal: controller.signal, world });
        } catch (e) {
          if (e instanceof StopPlay) stop(e.code);
          else codeError('background planner', e);
        } finally {
          bg.done = true;
        }
      })();
      background.set(actorId, bg);
    }
  }

  /** IAA-108: the Chronicler's deed ideas for an ended scenario, added to the Wanted list when they come; no turn waits on it */
  const chronicles = new Set<Promise<void>>();
  function chronicle(s: GameState, r: ScenarioRecord): void {
    if (rateLimited || stopped) return;
    const { storyId } = s;
    const p: Promise<void> = callChronicler(s, r, lines, { ...ctxFor(s.turn, []), background: true })
      .then((wants) => {
        if (!wants.length || !state || state.storyId !== storyId) return;
        for (const w of wants) addWant(state.hidden, 'templateWants', w);
        amend((x) => { for (const w of wants) addWant(x.hidden, 'templateWants', w); });
        emit();
      })
      .catch((e) => { if (e instanceof StopPlay) stop(e.code); else codeError('chronicler', e); })
      .finally(() => { chronicles.delete(p); });
    chronicles.add(p);
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
    // the pipeline owns the turn counter: state.turn moves to pending.turn once turn N is saved
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

  /** given: AD7, an order code built from a clicked action: it skips the Parser and passes the same checks; rest (D-20 b):
   * the steps of the player's order still queued after this one */
  async function playTurn(text: string, aimed: boolean, given?: Intent, rest: string[] = []): Promise<void> {
    const s = state!;
    const submitAt = clock.now();
    const before = snapTurn(s); // TQ1: the turn checker compares the world after the turn with this
    const answer = answering(lines, s.turn); // BF72: read before this order joins the story
    lines.push({ turn: s.turn, kind: 'player', text, ...(aimed ? { aimed: true } : {}) });
    const gearBefore = gearSnap(s, s.player), coinBefore = coins(s.player), brokenBefore = isBrokenLevel(moraleLevel(s.player));
    const partsBefore = partStates(s, s.player), zonesBefore = [...visitedZoneIds(s)];
    emit();
    if (!(await save.acquireTurnLock(store, s.storyId, owner))) {
      notice({ kind: 'read_only', text: 'This story is open in another window; this one is read-only.' });
      return;
    }
    const ctx = ctxFor(s.turn, turnLog);
    const pv = views.buildPlayerView(s);
    const doingBefore = doingSnap(pv);
    // NW18: asleep, the turn passes with you doing nothing; nothing you type is read
    const parsed = s.player.asleep || s.mercy ? { clarify: null, intent: ASLEEP_INTENT } // D-239: down, likewise
      : given ? acceptIntent(structuredClone(given), pv, bandsOf(s, pv), [])
      : await callParser(text, pv, ctx, { bandIds: bandsOf(s, pv), answering: answer });
    if (parsed.clarify !== null || !parsed.intent) {
      // the turn stops: no resolution, turn unchanged, Planner outputs kept for this same turn
      lines.push({ turn: s.turn, kind: 'clarify', text: parsed.clarify ?? 'What do you do?', ...('answers' in parsed && parsed.answers?.length ? { answers: parsed.answers } : {}) });
      lastLog = [...turnLog]; // the GM view (and playtests) can see why the Parser asked
      return;
    }
    // OA4: looking at one's own sheet or what one carries, and nothing else, never costs a turn: it answers as /stats or /inv
    const pi = parsed.intent as Intent;
    if (pi.look && !pi.action && !pi.move && !pi.gear?.length && !pi.spoken && !pi.perkMove && !pi.way) {
      lastLog = [...turnLog];
      return command(`/${pi.look}`, { aimed: false });
    }
    const intent = engine.fillSpeech(s, parsed.intent, text);
    if (yieldNext) intent.yields = true;
    // IQ7 a: Finish the fight only while the fight is far below the player (IQ6 a); else nothing happens and no time passes
    if (intent.finish && !engine.farBelow(s)) {
      lines.push({ turn: s.turn, kind: 'clarify', text: FINISH_REFUSED });
      lastLog = [...turnLog];
      return;
    }
    // OQ-27 (c): ask who is meant, from code: no Claude call, no turn spent
    const unclear = engine.unclearAddressee(s, intent, pv.actors.map((a) => a.id));
    if (unclear) {
      lines.push({ turn: s.turn, kind: 'clarify', text: `Who do you speak to: ${orList(unclear.map((id) => seenName(pv, id)))}?` });
      lastLog = [...turnLog]; // BG-143: every clarify keeps the turn's log, so the Parser output that led here can be seen
      return;
    }
    // NB5/BF37: with a broken nerve, an order of only what it blocks is turned away before the turn: nothing happens and no
    // time passes. Words or an allowed action beside it go ahead, and the engine takes the blocked part away (nerveHolds)
    if (isBrokenLevel(moraleLevel(s.player)) && nerveBlocksAll(s, intent)) {
      lines.push({ turn: s.turn, kind: 'clarify', text: isCoweringLevel(moraleLevel(s.player)) ? NERVE_COWERING_REFUSED : NERVE_REFUSED });
      lastLog = [...turnLog];
      return;
    }
    // a deed no skill fits is flagged every time, so the missing skills show up in play
    if (intent.action?.noSkillFits) s.log.push({ turn: s.turn, code: 'skill_gap', detail: { words: text.slice(0, 300), type: intent.action.type, skill: intent.action.skill, target: intent.action.target } });
    const rngBefore = s.rngState;
    const rng = createRng(s.rngState);
    const watch = engine.watchOrder(s); // D-20 b: what is news to the player after the turn
    const quick = engine.quickWord(s, intent); // A15 in a fight, OA1 asides outside one: a line beside a deed, replied to for free
    const speech = !!intent.action && ((SPEECH_ACTIONS as readonly string[]).includes(intent.action.type) || quick) && !!intent.addressees?.length;
    const spokespeople = speech ? engine.selectSpokespeople(s, intent) : [];
    if (spokespeople.length) s.stage.partner = spokespeople[0]; // OQ-27 (c): sticky partner for the next lines
    const agentOutputs: AcceptedAgentOutput[] = [];
    let exchange: ExchangeSpeech | undefined;
    if (spokespeople.length) {
      if (!quick || s.mode !== 'tactical') s.mode = 'dialogue';
      for (const id of spokespeople) {
        const bg = background.get(id);
        if (bg && !bg.collected) drop(bg, 'unused');
      }
      const agenda = new Map(spokespeople.map((id) => [id, hasAgenda(s, id)])); // from turn-start state
      exchange = engine.resolveSpeech(s, intent, spokespeople, rng);
      const input: DialogueInput = [{ spoken: intent.spoken?.trim() || engine.NO_WORDS, impression: exchange.impression }];
      const world = worldIds(s);
      // NT7: a listener that saw through a lie hears the impression with a tell (plainly on a win, LG25 c)
      // BG-84: a listener who heard only the voice (no contest) is told so, not given the words
      // TF15: words that are an offer to stop fighting say how the offer landed (an AI-run listener answers standDown)
      const offerOf = (id: string) => { const a = s.actors.find((x) => x.id === id), r = exchange!.perSpokesperson[id]; return a && r ? engine.offerNote(s, intent, a, r.contest) : undefined; };
      const withOffer = (id: string, d: DialogueInput): DialogueInput => (offerOf(id) ? [{ ...d[0], impression: `${d[0].impression ?? 'none'}; ${offerOf(id)}` }] : d);
      const inputFor = (id: string): DialogueInput => (!exchange!.perSpokesperson[id] ? [{ spoken: engine.MUFFLED, impression: null }] : withOffer(id, exchange!.perSpokesperson[id].tell ? [{ ...input[0], impression: `${input[0].impression ?? 'none'}, but ${engine.tellFor(exchange!.perSpokesperson[id].contest.gap)}` }] : input));
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
    // IQ4 a: a finished fight plays its rounds on code in this one turn, the player striking each round (finishAttack)
    const events = intent.finish ? engine.finishFight(s, input, rng, (t) => acceptIntent(finishAttack(t), views.buildPlayerView(s), bandsOf(s, views.buildPlayerView(s)), []).intent).events
      : engine.resolveTurn(s, input, rng);
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
    const queue = [...(intent.deferred ?? []), ...rest];
    const queueStops = queue.length > 0 && engine.orderStops(s, watch, events, spokespeople);
    readyStops = !!s.player.readied && engine.orderStops(s, watch, events, spokespeople);
    await finishTurn(s, events, { playerInput: text, rngBefore, aimed, intent, gearBefore, coinBefore, brokenBefore, partsBefore, zonesBefore, doingBefore, queue, queueStops, ...(ended ? { ended } : {}) }, spokespeople.length ? submitAt : null);
  }

  /** save → NarrationView → advance → Narrator → display (shared by every turn and by story start) */
  async function finishTurn(s: GameState, events: GameEvent[], rec: { playerInput: string; rngBefore: number; aimed: boolean; intent: Intent | null; gearBefore?: GearSnap; coinBefore?: number; brokenBefore?: boolean; doingBefore?: DoingSnap; queue?: string[]; queueStops?: boolean; partsBefore?: { id: string; state: PartState }[]; zonesBefore?: string[]; ended?: import('../types').ScenarioEnding; opening?: true }, dialogueSubmitAt: number | null): Promise<void> {
    s.events = events;
    views.keepClearSight(s, events); // BG-1545: before the save, so a reloaded story starts the next turn the same
    // saved with the engine page, so a reloaded story resolves the next turn exactly as continuous play would
    s.recentEvents = pruneRecent(s, [...(s.recentEvents ?? []), ...events]);
    s.agentLog = [...turnLog];
    const record: TurnRecord = {
      storyId: s.storyId, turn: s.turn, libraryVersion: s.libraryVersion, rngBefore: rec.rngBefore, playerInput: rec.playerInput,
      agentLog: s.agentLog, events, factsAdded: [], log: s.log, aimed: rec.aimed, ...(rec.opening ? { opening: true as const } : {}),
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
    let committed = true;
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
      if (!err.committed) { committed = false; notice({ kind: 'save_failed', text: `The turn could not be saved (${err.message}); the last good save is kept.` }); }
    }
    refreshBackups(s.storyId);
    reportFallbacks(s, turnLog);
    // every bug code logged this turn (an "other" quest goal, QT27, among them) is filed for the build threads
    fileLogBugs(s);
    const nv = views.buildNarrationView(s, events, rec.intent);
    if (rec.ended) nv.scenarioEnded = SCENARIO_ENDING_NAMES[rec.ended];
    // LN2-LN4: code picks the turn's length band; a zone stood in for the first time is a Big turn
    const band = views.narrationBand(s, events, nv, { opening: rec.opening, ended: !!rec.ended, newZone: !!rec.zonesBefore && !rec.zonesBefore.includes(s.player.zone) });
    nv.style.length = views.lengthText(s, band);
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
    // the turn's change in coin, shown as its own row (coin is left out of the gear rows)
    const coin = rec.coinBefore === undefined ? 0 : coins(s.player) - rec.coinBefore;
    // MB12: the player's nerve broke this turn, or a walk or attack was taken away because it is broken (shown again after a reload)
    const nerveBroke = rec.brokenBefore === false && isBrokenLevel(moraleLevel(s.player));
    const nerveRefused = events.some((e) => e.actorId === s.player.id && e.kind === 'wasted' && e.reason === 'nerve_broken') || s.log.some((l) => l.code === 'broken_cowers' || (l.code === 'nerve_turned_back' && l.detail?.actorId === s.player.id)); // BF37, BF79
    // AT11a: the long actions the player saw: going on (seconds to go), finished, broken off or set aside
    const actions = rec.doingBefore ? actionNotes(s, rec.doingBefore, doingSnap(views.buildPlayerView(s))) : [];
    const where = { ...(gear.length ? { gear } : {}), ...(coin ? { coin } : {}), ...(actions.length ? { actions } : {}), ...(nerveBroke ? { nerveBroke: true as const } : {}), ...(nerveRefused ? { nerveRefused: true as const } : {}), ...(ways.length ? { ways } : {}), ...(wounds.length ? { wounds } : {}), place: { id: s.player.placeId, name: placeName(s), ...zoneOf(s) }, scenario: s.stage.scenarioNumber };
    advance();
    const narr = await callNarrator(nv, ctxFor(turn, narrLog), leak);
    if (dialogueSubmitAt !== null) await clock.sleep(dialogueSubmitAt + CONFIG.DIALOGUE_WINDOW_MS - clock.now());
    const closing = rec.ended && narr.output.closing?.trim();
    // the Gains page shows the scenario's closing line beside its gains (saved with the next turn)
    const kept = closing ? s.player.progression?.gainsLog?.at(-1) : undefined;
    if (kept && kept.endTurn === turn && closing) kept.closing = closing;
    const scenarioEnd = rec.ended ? { scenarioEnd: { as: rec.ended, name: SCENARIO_ENDING_NAMES[rec.ended], ...(closing ? { closing } : {}) } } : {};
    endingNow = null;
    // rolls are kept on every line, so Show rolls also shows past turns' (the screen hides them while it is off)
    lines.push({ turn, kind: 'narration', text: narr.output.text, ...scenarioEnd, ...(CONFIG.SHOW_MECHANICS && mechanics.length ? { mechanics } : {}),
      ...lineExtras(s, events, nv, narr.output.text), ...notes, ...where, ...(rec.queue?.length ? (rec.queueStops ? { next: rec.queue.join('. ') } : { queue: rec.queue }) : {}),
      length: { band, words: wordCount(narr.output.text), top: views.lengthTop(s, band) } }); // LN7: measured, never re-asked
    lastLog = narrLog;
    lastDisplayAt = clock.now();
    // IAA-108: each scenario that ended this turn gets one Chronicler call in the background, once its last line is in
    for (const r of s.hidden.scenarios?.filter((x) => x.endTurn === turn) ?? []) chronicle(s, r);
    // BG-337: the story text follows the commit; a turn the save does not hold keeps its lines in memory for the next good turn
    if (committed) await storeHistory(s.storyId);
  }

  /** Q18: save the story column after each turn; a failure keeps play going and only costs text. */
  async function storeHistory(storyId: string): Promise<void> {
    const upTo = lines.length;
    try {
      await save.saveHistory(store, storyId, lines, savedLines);
      savedLines = upTo;
    } catch (e) {
      console.warn('story text not saved', e);
      codeError('story text save', e);
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
        const skills = sheet.map(([k, v]) => `${skillName(k)} ${v.raw}${v.state === 'tagged' ? TAG_MARK : v.state === 'flawed' ? FLAW_MARK : ''}`);
        const off = usedOffSheet(p).map((k) => `${skillName(k)} 0`); // rolled but not on the sheet yet, e.g. fists use Strike
        const key = [sheet.some(([, v]) => v.state === 'tagged') ? `${TAG_MARK} tagged` : '', sheet.some(([, v]) => v.state === 'flawed') ? `${FLAW_MARK} flawed` : ''].filter(Boolean).join(', ');
        return say(`${p.names.current}, ${p.core.classes.map((c) => `${getLibrary().classes[c.classId]?.name ?? c.classId} ${c.level}`).join(', ')}. Health: ${healthWord(p)}. Skills: ${skills.join(', ')}.`
          + (off.length ? ` Also used, not on your sheet yet: ${off.join(', ')}.` : '') + (key ? ` (${key})` : ''));
      }
      case 'inv':
        return say(s.player.core.inventory.map((i) => `${countWords(i.itemId, nameOf(s, i.itemId), i.qty)}${i.equippedIn?.length ? ` (${i.equippedIn.join(', ')})` : ''}`).join('; ') || 'You carry nothing.');
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
        if (arg.toLowerCase() === 'off') { delete pr.title; amend((x) => { delete x.player.progression?.title; }); return say('You wear no title now.'); } // BF40: saved at once
        const n = Number(arg);
        const pick = arg ? (Number.isInteger(n) ? list[n - 1] : list.find((x) => achievementName(s, x).toLowerCase() === arg.toLowerCase())) : undefined;
        if (pick) { pr.title = pick.id; amend((x) => { if (x.player.progression) x.player.progression.title = pick.id; }); return say(`You now go by ${achievementName(s, pick)}. Only people who see you will know it.`); }
        if (!list.length) return say('You have no achievements to wear yet.');
        return say([`Title: ${wornTitle(s) ?? 'none'}. Type /title and a number to wear one, or /title off.`,
          ...list.map((x, i) => `${i + 1}. ${achievementName(s, x)}`)].join('\n'));
      }
      case 'essence': case 'essences': {
        // growth proposal 2.5: /essence lists offers and held essences; take N [give up M], pass N, remove M (at rest)
        const pr = s.player.progression;
        const [verb, a1, , a3] = arg.toLowerCase().split(/\s+/);
        const n = (x?: string) => (x && /^\d+$/.test(x) ? Number(x) - 1 : -1);
        // BF40 (BG-208): a change to the character saves at once, as a perk pick does: made here, then on the saved story
        const kept = (change: (x: GameState) => string | null, ok: string) => { const err = change(s); if (!err) amend((x) => { change(x); }); return say(err ?? ok); };
        const atRest = engine.playerAtRest(s);
        if (verb === 'take') return kept((x) => engine.takeEssence(x, n(a1), atRest, a3 !== undefined ? n(a3) : undefined), 'Taken. It is part of you now.');
        if (verb === 'pass') return kept((x) => engine.passEssence(x, n(a1)), 'You let it go.');
        if (verb === 'remove') { const cost = engine.removeCostText(s.player); return kept((x) => engine.removeEssence(x, n(a1), atRest), cost.startsWith('free') ? 'Gone. That change was free.' : `Gone, and it cost you: ${cost}.`); }
        // ES1–ES6: give or sell an offer to someone you can see, by name ("/essence give 1 to Marta", "/essence sell 1 Mags")
        if (verb === 'give' || verb === 'sell') {
          const pv = views.buildPlayerView(s);
          const who = arg.split(/\s+/).slice(2).join(' ').replace(/^to\s+/i, '').trim().toLowerCase();
          const id = who ? pv.actors.find((x) => (x.name ?? x.label).toLowerCase() === who)?.id ?? pv.actors.find((x) => (x.name ?? x.label).toLowerCase().includes(who))?.id : undefined;
          const to = id ? s.actors.find((x) => x.id === id) : undefined;
          if (!to) return say(`Whom to? Type /essence ${verb} ${a1 ?? '1'} to and a name you can see.`);
          const them = (x: GameState) => x.actors.find((y) => y.id === to.id);
          if (verb === 'give') return kept((x) => engine.giveEssence(x, n(a1), them(x)), `It passes to ${seenName(pv, to.id)}.`);
          const r = engine.sellEssence(s, n(a1), to);
          if (!('error' in r)) amend((x) => { engine.sellEssence(x, n(a1), them(x)); });
          return say('error' in r ? r.error : `Sold to ${seenName(pv, to.id)} for ${coinWords(r.price)}.`);
        }
        const offers = pr?.essenceOffers ?? [], held = pr?.essences ?? [];
        return say([
          `Essences: ${held.length} of ${engine.essenceSlots(s.player)} slots.`,
          ...held.map((e, i) => `${i + 1}. ${engine.essenceText(e, skillName)}`),
          ...(offers.length ? ['On offer:', ...offers.map((o, i) => `${i + 1}. ${engine.essenceText(o, skillName)}, for ${durationText(Math.max(0, o.untilMin - now(s)))} more${o.pair ? ' (one of two from the ending: taking one lets the other go)' : ''}`)] : ['Nothing on offer.']),
          `Type /essence take 1 (with every slot full: /essence take 1 give 2), /essence pass 1, /essence give 1 to a name, /essence sell 1 to a name, or /essence remove 1 (at rest; ${engine.removeCostText(s.player)}).`,
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
            // committed: the head went back and only the tidy-up failed, so the turn is undone (BG-338)
            if (!(e instanceof save.SaveError)) throw e;
            if (!e.committed) {
              const none = e.code === 'nothing_to_undo' || e.code === 'no_save';
              lines.push({ turn: s.turn, kind: 'command', text: none ? 'Undo goes back one turn only, and there is no turn to undo.' : `The undo could not be saved (${e.message}); nothing changed.` });
              return;
            }
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

  async function submit(text: string, opts: { aimed: boolean }, given?: Intent): Promise<void> {
    const t = text.trim();
    if (!state || busy || stopped || !t) return;
    if (!given && t.startsWith('/')) return command(t, opts);
    rateLimited = false; // background calls resume after the next player action
    notices = notices.filter((n) => n.kind !== 'rate_limited');
    busy = true;
    emit();
    try {
      // D-20 b: sending the next queued step of the player's order plays it and keeps the rest; anything else drops the rest
      const queued = engine.queuedSteps(lines), rest = !given && queued[0] === t ? queued.slice(1) : [];
      await playTurn(state.player.asleep ? ASLEEP_TEXT : t, opts.aimed || aimNext, state.player.asleep ? undefined : given, rest);
      // NW18/AT42: while you stay asleep the game plays your turns: the night runs on as one stretch between them, so each
      // moves the clock on; a turn that doesn't (nothing left to run) waits for you
      for (let t = -1; state?.player.asleep && !stopped && gameNow(state) > t; ) { t = gameNow(state); await playTurn(ASLEEP_TEXT, false, undefined, engine.queuedSteps(lines)); }
      if (state?.mercy && !stopped) await playTurn(DOWN_TEXT, false); // D-239: the foes answer while you lie there
      // AE6 (RY4 a): in a fight the game plays a readied order's held turns by itself until the step fires, it has waited
      // CONFIG.READY_MAX_S (the engine drops it) or something new stops it (orderStops, as a queued order)
      for (let t = -1; state?.player.readied && state.mode === 'tactical' && !readyStops && !stopped && state.turn > t; ) { t = state.turn; await playTurn(READY_TEXT, false, ASLEEP_INTENT); }
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

  async function newStory(build: CreationBuild, opts: { owner?: StoryOwner; worldId?: string } = {}): Promise<void> {
    const owner = opts.owner ?? 'player';
    const errs = validateBuild(build);
    if (errs.length) throw new Error(errs.join('; '));
    // W6's director is injected; without it there is no way to set up turn 0
    if (!director) throw new Error('scenario director not wired (W6)');
    abortBackground();
    // HF31: a free world picked on the creation screen: the new character carries on its last save
    const free = opts.worldId ? await save.freeWorld(store, opts.worldId, owner) : undefined;
    if (opts.worldId && !free) throw new Error('that world is no longer free');
    const world = free && (await save.loadStory(store, free.lastStoryId, getLibrary())).state;
    const now = clock.now();
    const storyId = `story_${now.toString(36)}`;
    const seed = (now >>> 0) || 1;
    const player = createPlayer(build, storyId, { world });
    // WP2 b: a Threadbound start needs a Threadbound item free in that world
    if (player.core.perks.some((k) => getLibrary().perks[k.perkId]?.grantsThreadboundItem && !k.granted)) throw new Error('No Threadbound item is free in this world');
    state = newState(storyId, seed, { ...player, placeId: CONFIG.STORY_START_PLACE }, new Date(now).toISOString());
    if (world) state = { ...save.carryOn(world, state, free!.past.at(-1)!.fell), meta: { ...state.meta, worldId: free!.worldId } };
    state.player.core.standingDefense = defaultStandingDefense(state, state.player); // same rule as the creation preview
    if (owner === 'agent') state.meta.owner = 'agent'; // the autopilot's own save: one story per owner
    lines = [];
    savedLines = 0;
    notices = [];
    turnLog = [];
    busy = true;
    emit();
    // a new world starts on day 1; CW4 a: a world carried on keeps the minute it was left. The new character's birth day
    // moves with the day they start on, so their age is the one picked.
    if (state.player.core.bornDay !== undefined) state.player.core.bornDay += dayOf(gameNow(state)) - 1;
    // the build is kept until turn 0 is saved, so closing the game during the opening doesn't lose it (resume restarts it)
    await save.savePendingStart(store, { storyId, build, at: new Date(now).toISOString(), ...(owner === 'agent' ? { owner } : {}), ...(free ? { worldId: free.worldId } : {}) }).catch(() => {});
    try {
      const rng = createRng(seed);
      const events = await director.startStory(state, rng, ctxFor(0, turnLog));
      state.rngState = rng.state;
      noteTurnEnd(state); // BG-275: the opening is a turn too: timers and the turn check count from its end
      await finishTurn(state, events, { playerInput: '', rngBefore: seed, aimed: false, intent: null, opening: true }, null);
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
      void newStory(pending.build, { owner, ...(pending.worldId ? { worldId: pending.worldId } : {}) }).catch((e) => notice({ kind: 'load_refused', text: `The story could not start: ${(e as Error).message}` }));
      return true;
    }
    if (pending) await save.clearPendingStart(store, owner).catch(() => {});
    const storyId = latest?.storyId;
    if (!storyId) return false;
    abortBackground(); // switching stories (the autopilot's own save and back): the old story's background calls stop
    try {
      state = (await save.loadStory(store, storyId, getLibrary())).state;
    } catch (e) {
      await refusedLoad(storyId, e, 'The story could not be loaded');
      return false;
    }
    await opened(storyId);
    return true;
  }

  /** YS1 c: a load the checks refused offers its ways back: one turn back when the save has an undo bookmark, and its
   * backups. Starting a new save is the creation screen the player is on. */
  async function refusedLoad(storyId: string, e: unknown, what: string): Promise<void> {
    const back = e instanceof save.LoadRefusedError && e.canGoBack;
    const backups = (await save.listBackups(store, storyId).catch(() => [])).map((b) => b.turn);
    notice({ kind: 'load_refused', text: `${what}: ${(e as Error).message}`, recovery: { storyId, back, backups } });
  }

  /** a story just loaded into `state`: its story text, backups and the next turn */
  async function opened(storyId: string): Promise<void> {
    refreshCopies(state!); // copies follow their template and the level lever
    lines = await save.loadHistory(store, storyId).catch(() => []);
    savedLines = lines.length;
    turnLog = [];
    backups = [];
    refreshBackups(storyId);
    advance();
    lastDisplayAt = clock.now();
    emit();
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
    fell: () => !!state && downNow(state.player) && !state.mercy, // D-239: not while a foe decides
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    validateBuild,
    newStory,
    resume,
    async hallOfFame() {
      const [fallen, sends] = await Promise.all([save.listFallen(store), librarySends(store).catch(() => [])]);
      const inLib = new Set(Object.values(getLibrary().templates).map((t) => t.unique?.from).filter(Boolean));
      const sent = new Set(sends.map((x) => x.storyId));
      return fallen.map((f) => ({ ...f, ...(inLib.has(f.storyId) ? { inLibrary: true as const } : sent.has(f.storyId) ? { sent: true as const } : {}) }));
    },
    fallenSheet: (storyId) => save.loadStory(store, storyId, getLibrary(), true).then((r) => r.state, () => null),
    async sendBlueprint(id) {
      const b = state?.blueprints.find((x) => x.id === id);
      if (!state || !b) return { error: 'Nothing with that id was made in this story.' };
      const sid = sendId(b.kind, state.storyId, b.id);
      await saveSend(store, { id: sid, kind: b.kind, storyId: state.storyId, name: String(b.data.name ?? b.data.label ?? b.id), at: new Date(clock.now()).toISOString(), data: structuredClone(b.data) });
      return { id: sid };
    },
    librarySends: () => librarySends(store),
    deedSends: async () => (state ? deedSends(store, state.storyId) : []),
    async markDeedsSent(ideas) {
      if (!state) return;
      const storyId = state.storyId, at = new Date(clock.now()).toISOString();
      await saveDeedSends(store, ideas.map((w) => ({ id: deedSendId(storyId, w), storyId, name: w.label, at })));
    },
    async clearRuledDeeds() {
      const s = state, ruled = s ? (await deedSends(store, s.storyId)).filter((d) => d.verdict && !d.cleared) : [];
      await saveDeedSends(store, ruled.map((d) => ({ ...d, cleared: true as const })));
      // WT9: an approved idea leaves the story; a turned-down one keeps only its count
      const rule = (x: GameState) => { for (const d of ruled) { const w = x.hidden.templateWants?.find((g) => g.of === 'deed' && deedSendId(x.storyId, g) === d.id); if (w) ruleWant(x.hidden, 'templateWants', wantKey.templateWants(w), d.verdict!); } };
      if (s && ruled.length) { rule(s); amend(rule); emit(); }
      return ruled.length;
    },
    ruleWant(list, key, verdict) {
      if (!state || !ruleWant(state.hidden, list, key, verdict)) return;
      amend((x) => { ruleWant(x.hidden, list, key, verdict); });
      emit();
    },
    async sendHero(storyId) {
      const f = (await save.listFallen(store)).find((x) => x.storyId === storyId);
      if (!f) return { error: 'That character is not in the Hall of fame.' };
      const st = await save.loadStory(store, storyId, getLibrary()).then((r) => r.state).catch(() => null);
      if (!st) return { error: 'Their story no longer loads, so their sheet can’t be read.' };
      const id = sendId('unique', storyId);
      const sheet = { ...echoSheet(st, st.player, id, echoPast(f)), from: storyId };
      await saveSend(store, { id, kind: 'unique', storyId, name: f.name, at: new Date(clock.now()).toISOString(), data: { raceId: st.player.core.raceId, label: st.player.label, sheet } });
      return { id };
    },
    worlds: () => save.listWorlds(store),
    titleWorld: (worldId, name) => save.titleWorld(store, worldId, name),
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
      // BG-232: what its command had the character say aloud counts too, so a signature saying isn't said every move
      const aloud = [...(mv?.command ?? '').matchAll(/["“]([^"”]+)["”]/g)].map((x) => x[1].trim()).filter(Boolean);
      const flat = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      const again = [...(mv?.say ? [mv.say] : []), ...aloud].find((x) => agentSaid.some((y) => flat(y) === flat(x)));
      if (again && state) void fileBug(store, clock.now(), { code: 'agent_repeat', storyId: state.storyId, turn: state.turn, line: again.slice(0, 500) });
      if (mv?.say || aloud.length) agentSaid = [...agentSaid, ...(mv?.say ? [mv.say] : []), ...aloud].slice(-CONFIG.AUTOPILOT_SAID_KEPT);
      return mv;
    },
    submit: (text: string, opts: { aimed: boolean }) => submit(text, opts),
    act: (order: { intent: Intent; line: string }, opts: { aimed: boolean }) => submit(order.line, opts, order.intent),
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
        // HF31: how it ended, for the world list: who, the day, and the Threadbound items left in the world (WP1 b: a
        // character reset while standing leaves with what they carry)
        const fell = downNow(state.player), p = state.player;
        const end = { name: p.names.current, day: dayOf(now(state)), threadbound: threadboundInWorld(fell ? state : { ...state, player: { ...p, core: { ...p.core, inventory: [] } } }) };
        await save.archiveStory(store, state.storyId, at, fell ? fameEntry(state, lines, placeName(state), at) : undefined, end);
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
    async agentHistory(actorId) {
      const s = state;
      if (!s) return [];
      const turns = Array.from({ length: CONFIG.TURN_RECORDS_KEPT }, (_, i) => s.turn - i).filter((t) => t > 0);
      // this turn's calls from memory (a saved record trims big inputs), older turns from their records
      const logs = await Promise.all(turns.map((t) => (t === s.turn && lastLog.length ? Promise.resolve(lastLog)
        : save.readTurnRecord(store, s.storyId, t).then((r) => r?.agentLog ?? [], () => []))));
      return logs.flatMap((l) => l.filter((x) => x.actorId === actorId).reverse()).slice(0, CONFIG.GM_AGENT_CALLS_SHOWN);
    },
    /** BG-123: the GM view's Restore: the save checks the backup, backs up the current save and writes a new head on the
     * backup; play goes on from the restored turn, as after /undo */
    async recoverLoad(choice) {
      const n = notices.find((x) => x.kind === 'load_refused');
      const r = n?.kind === 'load_refused' ? n.recovery : undefined;
      if (!r || busy || state) return;
      busy = true;
      emit();
      try {
        state = (choice === 'back' ? await save.goBackOneTurn(store, r.storyId, getLibrary()) : await save.restoreBackup(store, r.storyId, choice, getLibrary())).state;
        // BG-161: a restored backup's later turns never happened, so their story text goes
        if (choice !== 'back') await save.cutHistory(store, r.storyId, choice).catch((e) => console.warn('story text not cut', e));
        notices = notices.filter((x) => x !== n);
        await opened(r.storyId);
      } catch (e) {
        state = null;
        await refusedLoad(r.storyId, e, choice === 'back' ? 'Going back one turn did not work' : `The backup from turn ${choice} could not be restored`);
      } finally {
        busy = false;
        emit();
      }
    },
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
        // BG-161: the turns after the backup never happened now: their story text goes, in memory and in the saved story
        lines = lines.filter((l) => l.turn <= turn);
        await save.cutHistory(store, s.storyId, turn).catch((e) => console.warn('story text not cut', e));
        savedLines = lines.length;
        lines.push({ turn: state.turn, kind: 'command', text: `Restored the backup from turn ${turn}.` });
        await storeHistory(state.storyId);
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
    // D-141: the Witness talks outside the turn; Swear and renounce are saved at once, like a quest given up
    async witness(chat) {
      if (!state || stopped) return null;
      try { return await callWitness(state, chat, ctxFor(state.turn, [])); }
      catch (e) { if (e instanceof StopPlay) stop(e.code); else codeError('witness', e); return null; }
    },
    swearVow(form) {
      if (!state || busy) return 'Wait for the turn to finish.';
      const err = swearVow(state, form);
      if (!err) { amend((x) => { swearVow(x, form); }); emit(); }
      return err;
    },
    renounceVow(id) { if (state && !busy && renounceVow(state, id)) { amend((x) => { renounceVow(x, id); }); emit(); } },
    setSignatures(lines) { if (state && !busy) { setSignatures(state.player, lines); amend((x) => setSignatures(x.player, lines)); emit(); } },
    setDefense(kind) { if (state && !busy) { state.player.core.standingDefense = kind; amend((x) => { x.player.core.standingDefense = kind; }); emit(); } },
    cancelReady() { if (state?.player.readied && !busy) { delete state.player.readied; amend((x) => { delete x.player.readied; }); emit(); } },
    adopt(s) {
      abortBackground();
      state = s;
      turnLog = [];
      lastDisplayAt = clock.now();
      startBackground();
    },
    async settle() {
      await Promise.all([...background.values()].map((b) => b.promise));
      await Promise.all([...chronicles]);
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
    for (const l of waysOut(s, z)) {
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
  const errand = (a: Actor) => (a.mind?.errandUntil ?? -Infinity) > s.turn; // BG-180: a deed it said it was doing, run by code or not
  const errands = s.actors.filter((a) => errand(a) && isActive(a)).map((a) => a.id);
  const startled = s.actors.filter((a) => (a.mind?.startled ?? -Infinity) >= s.turn - 1 && isActive(a)).map((a) => a.id); // BF65: struck unseen, saw it, or found a body
  return [...new Set([...(s.mercy?.pending ?? []), ...s.pending.engaged, ...dealt, ...errands, ...startled])] // D-239: those deciding the player's fate
    .map((id) => s.actors.find((a) => a.id === id))
    .filter((a): a is Actor => !!a && (a.mind?.control === 'agent' || errand(a)) && a.mind?.moraleState !== 'broken' && !a.asleep && (!busyNow(a) || !!a.busy!.alert)) // NW20: a sleeper is not asked; AT47: nor one at a long action, unless its coming-near check fired (AT67)
    .sort((a, b) => +!!s.mercy?.pending.includes(b.id) - +!!s.mercy?.pending.includes(a.id) || (dist.get(a.zone) ?? Infinity) - (dist.get(b.zone) ?? Infinity) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((a) => a.id);
}

/** NV1 b: a's own side (itself and everyone on its side of the fight, BEL-27) and their foes, while a fights someone */
function fightSides(s: GameState, a: Actor): Actor[] {
  const all = allActors(s);
  const side = all.filter((x) => x === a || onFightSide(s, a, x));
  return all.filter((x) => side.includes(x) || side.some((m) => fightingWith(s, m, x) || fightingWith(s, x, m)));
}
export const inFight = (s: GameState, a: Actor): boolean => fightSides(s, a).length > 1;
/** NV1 b: what a fighter sees of its fight, as a key that changes at a turning point: a newcomer joins, someone in it goes down
 * (an ally falls), a nerve breaks or someone surrenders, or someone yields */
export function fightKey(s: GameState, a: Actor): string {
  const yielded = (x: Actor) => (x === s.player ? !!s.yielding && !s.yielding.ended : Object.values(x.mind?.overrides ?? {}).includes('yielded'));
  return fightSides(s, a).map((x) => `${x.id}:${isActive(x) ? 'up' : 'down'}:${x.mind?.moraleState ?? (isBrokenLevel(moraleLevel(x)) ? 'broken' : '')}:${yielded(x) ? 'yielded' : ''}`).sort().join('|');
}
/** NV1 b: an offer to stand down, a demand to surrender or the player's yield waits for this AI-run foe's answer */
const answerDue = (s: GameState, a: Actor): boolean => !!s.yielding?.pending.includes(a.id) || !!s.offers?.pending.some((o) => o.to === a.id);
/** NV1 b / NV2: who keeps a Planner call every turn of a fight: those deciding the player's fate, in a deal, on an errand or
 * startled (plannerActors' other reasons), goal holders and uniques, and schemers: a secret holder or a Sneak role [Proposed] */
export function plansEveryTurn(s: GameState, a: Actor): boolean {
  const tpl = a.core.templateId && hasTemplate(s, a.core.templateId) ? npcTemplate(s, a.core.templateId) : undefined;
  return !!s.mercy?.pending.includes(a.id) || !!s.hidden.agreements?.some((g) => g.parties.includes(a.id))
    || (a.mind?.errandUntil ?? -Infinity) > s.turn || (a.mind?.startled ?? -Infinity) >= s.turn - 1
    || !!s.hidden.drives?.[a.id]?.goals.length || tpl?.generation === 'unique'
    || s.hidden.secrets.some((x) => x.holderId === a.id) || tpl?.roleId === RO.sneak;
}

/** UG7/UG8/UG9: goal holders due to think (their queue ran out or a step failed, they noticed what a goal names, or they
 * were just cast), not already getting a Planner call, awake, active and not broken; nearest the player first, anywhere */
export function goalThinkers(s: GameState, taken: Set<string>): string[] {
  const dist = zoneDistances(s, s.player.zone);
  return Object.entries(s.hidden.drives ?? {})
    .filter(([id, d]) => d.think && !taken.has(id))
    .map(([id]) => s.actors.find((a) => a.id === id))
    .filter((a): a is Actor => !!a && isActive(a) && !a.asleep && a.mind?.moraleState !== 'broken')
    .sort((a, b) => (dist.get(a.zone) ?? Infinity) - (dist.get(b.zone) ?? Infinity) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((a) => a.id);
}

/** every real id, to tell view_leak (real but outside the view) from invalid_target (does not exist) */
export function worldIds(s: GameState): Set<string> {
  const all = [s.player, ...s.actors];
  return new Set([
    ...all.map((a) => a.id),
    ...s.zones.map((z) => z.id),
    ...s.openings.flatMap((o) => o.joins), ...s.ground.map((i) => i.id),
    ...all.flatMap((a) => a.core.inventory.map((i) => i.id)),
    ...s.places.map((p) => p.id),
  ]);
}

/** AT11a: the long actions the player perceives, keyed by actor id: the player's own, and every fully seen actor's */
export type DoingSnap = Map<string, { who: string; doing?: import('../types').DoingView }>;
export function doingSnap(pv: ReturnType<typeof views.buildPlayerView>): DoingSnap {
  const m: DoingSnap = new Map([['player', { who: 'You', ...(pv.player.doing ? { doing: pv.player.doing } : {}) }]]);
  for (const a of pv.actors) if (a.level === 'full') m.set(a.id, { who: cap(a.name ?? a.label), ...(a.doing ? { doing: a.doing } : {}) });
  return m;
}
/** AT11a: before and after the turn, as the player saw them. An action seen going on before ends as broken (busy_broken this
 * turn), set aside (busy_set_aside) or done; one whose actor is out of full sight after the turn is left out (no leak). */
export function actionNotes(s: GameState, before: DoingSnap, after: DoingSnap): import('../types').ActionNote[] {
  const out: import('../types').ActionNote[] = [];
  const ended = (id: string, code: string) => s.log.some((l) => l.turn === s.turn && l.code === code && l.detail?.actorId === id);
  for (const [id, b] of before) {
    if (!b.doing) continue;
    const a = after.get(id);
    if (!a) continue;
    if (a.doing && a.doing.what === b.doing.what) { out.push({ who: a.who, ...a.doing, state: 'going' }); continue; }
    const state = ended(id, 'busy_broken') ? 'broken' : ended(id, 'busy_set_aside') ? 'stopped' : 'done';
    out.push({ who: a.who, what: b.doing.what, done: state === 'done' ? b.doing.done + b.doing.left : b.doing.done, left: state === 'done' ? 0 : b.doing.left, state });
  }
  for (const [id, a] of after) if (a.doing && before.get(id)?.doing?.what !== a.doing.what) out.push({ who: a.who, ...a.doing, state: 'going' });
  return out.sort((x, y) => Number(y.who === 'You') - Number(x.who === 'You'));
}

/** how the player sees an actor: its name if known, else its label, plus the zone when labels repeat */
function seenName(pv: ReturnType<typeof views.buildPlayerView>, id: string): string {
  const a = pv.actors.find((x) => x.id === id)!;
  const base = a.name ?? a.label;
  const twin = pv.actors.some((x) => x.id !== id && (x.name ?? x.label) === base);
  const zone = pv.zones.find((z) => z.id === a.zone)?.name ?? (pv.zone.id === a.zone ? pv.zone.name : undefined);
  return twin && zone ? `${base} at ${zone}` : base;
}
const orList = (xs: string[]) => listWords(xs, 'or');

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
    if (a.mind) noteEarlier(s, a, all.filter((e) => e.perception[a.id] && !barkOnly(e)).slice(0, -n));
    for (const e of keptBy(a.id, all)) keep.add(e);
  }
  return all.filter((e) => keep.has(e));
}

/** names the Voice's line is checked against (allowed only where its own view holds them) */
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

/** the player's gear (coin aside) as code saw it: item id → name, where it sits ("held:right hand", "worn", "pack") and how many */
export type GearSnap = Map<string, { name: string; where: string; qty: number }>;
export function gearSnap(s: GameState, p: Actor): GearSnap {
  const gear: GearSnap = new Map();
  for (const i of p.core.inventory) {
    if (i.itemId === IT.coin) continue; // coin has its own row: LogLine.coin
    const grips = gripsOf(i);
    let name = i.itemId;
    try { name = itemDef(s, i.itemId).name; } catch { /* an unknown item keeps its id */ }
    gear.set(i.id, { name, qty: i.qty ?? 1, where: grips.length ? `held:${grips.map(gripWord).join(' and ')}` : i.equippedIn?.length ? 'worn' : 'pack' });
  }
  return gear;
}
/** ready-to-show rows for what a turn changed in the player's gear: "Picked up: …", "Now held: right hand · …" */
export function gearRows(a: GearSnap, b: GearSnap): string[] {
  // A1: rows for the same item merge and say how many ("Picked up: arrow ×3"), in the order they first come
  const rows = new Map<string, { head: string; name: string; n: number }>();
  const add = (head: string, name: string, n: number) => {
    const r = rows.get(`${head}\0${name}`);
    if (r) r.n += n; else rows.set(`${head}\0${name}`, { head, name, n });
  };
  for (const [id, x] of b) {
    const was = a.get(id);
    if (!was || x.qty > was.qty) add('Picked up', x.name, x.qty - (was?.qty ?? 0));
    else if (x.qty < was.qty) add('Used', x.name, was.qty - x.qty);
    if (was && was.where === x.where) continue;
    if (x.where.startsWith('held:')) add(`Now held: ${x.where.slice(5)}`, x.name, x.qty);
    else if (x.where === 'worn') add('Now worn', x.name, x.qty);
    else if (was) add('Put away', x.name, x.qty);
  }
  for (const [id, x] of a) if (!b.has(id)) add('Gone', x.name, x.qty);
  return [...rows.values()].map((r) => `${r.head}${r.head.startsWith('Now held') ? ' ·' : ':'} ${r.name}${r.n > 1 ? ` ×${r.n}` : ''}`);
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
    const row = `${cap(what)} to ${to}: ${WAY_ROW[e.way.did]}`;
    if (!rows.includes(row)) rows.push(row);
  }
  return rows;
}

/** the zone the player ended the turn in, as the play header names it */
const zoneOf = (s: GameState): { zone?: string } => { const z = zoneById(s, s.player.zone)?.name; return z ? { zone: z } : {}; };

/** where the player is: "River path · the Riverside" (the place and the place around it) */
export function placeName(s: GameState): string {
  const place = s.places.find((x) => x.id === s.player.placeId);
  const parent = place?.parentId ? s.places.find((x) => x.id === place.parentId) : undefined;
  const t = [place?.names.current, parent?.names.current].filter(Boolean).join(' · ');
  return cap(t);
}

/** BG-257: the roll line's words for a pick, by what happened at the lock (WayDid) */
const PICK_WORDS: Partial<Record<string, string>> = { picked: 'the lock opens', picking: 'still at it', not_yet: 'not yet', beyond: 'beyond you for now', pick_broke: 'the pick snaps' };

/**
 * Play screen extras for a narration line, from what the player perceived (no numbers): the player's own check this
 * turn, the lines heard (word for word, unless the narration already quotes them) and the turn's visible changes.
 */
export function lineExtras(s: GameState, events: GameEvent[], nv: NarrationView, narration: string): Pick<LogLine, 'check' | 'speech' | 'changes' | 'incomingChecks' | 'downedBy' | 'hits'> {
  const out: Pick<LogLine, 'check' | 'speech' | 'changes' | 'incomingChecks' | 'downedBy' | 'hits'> = {};
  const who = (n: string, start: boolean) => (n === 'player' ? (start ? 'You' : 'you') : start ? cap(n) : n);
  const words = (x: string) => x.replace(/_/g, ' ');
  const packetOf = (e: GameEvent) => nv.events.find((x) => x.id === e.id)?.packet;
  /** a blow's result as the roll line and the hit card say it, "full hit, right arm"; an unseen blow is still felt where it lands */
  const blowResult = (a: NonNullable<GameEvent['attack']>, pk: ReturnType<typeof packetOf>) => {
    const loc = pk?.location?.part ?? (a.location && a.location !== 'general' && a.location !== 'shield' ? partName(a.location).toLowerCase() : '');
    return `${pk?.outcome ?? words(a.outcome)}${loc ? `, ${loc}` : ''}`;
  };
  /** a change the packet names from the player's side as the screen says it: "player is Wounded" is "You are Wounded" */
  const shown = (c: string) => c.startsWith('player ') || c.startsWith("player's ") ? c.replace(/^player is /, 'You are ').replace(/^player's /, 'Your ') : who(c, true);
  let check: LineCheck | undefined, checkEv: string | undefined;
  for (const e of events) {
    if (check) break;
    checkEv = e.id;
    if (e.attack && e.attack.attackerId === 'player') {
      const a = e.attack;
      const pk = packetOf(e);
      check = {
        kind: 'attack', skill: a.attack.skill, ...tierPart(a.attack),
        ...(a.defense && a.defenseType ? { against: { what: `${views.callName(s, 'player', a.targetId)}’s`, skill: a.defense.skill, ...tierPart(a.defense) } } : {}),
        ...shiftsPart(s, a.gapShifts, 'player', a.targetId),
        result: blowResult(a, pk),
      };
    } else if (e.contest && (e.contest.a.actorId === 'player' || e.contest.b.actorId === 'player')) {
      const c = e.contest;
      const mine = c.a.actorId === 'player' ? c.a : c.b, other = mine === c.a ? c.b : c.a;
      const result = c.winner === 'tie' ? 'a tie' : (c.winner === 'a') === (mine === c.a) ? 'you win' : 'you lose';
      check = { kind: 'contest', skill: mine.skill, ...tierPart(mine), against: { what: views.callName(s, 'player', other.actorId), ...tierPart(other) }, result };
    } else if (e.roll && e.obstacle && e.roll.actorId === 'player') {
      // OD1 b: an act on a graded thing; the story tells what the tier meant (OD5)
      check = { kind: 'roll', skill: e.roll.skill, ...tierPart(e.roll), result: tierAtLeast(e.roll.tier, 'success') ? 'done' : e.roll.tier === 'near_miss' ? 'not yet' : 'not done' };
    } else if (e.roll && e.roll.actorId === 'player') {
      // BG-257: each roll says only what it did: a look (a Search's, LX1) who it made out, a pick what happened at the lock, a break
      // whether it gave way; any other roll has no words of its own (the story tells it)
      const said = e.kind === 'observe' || e.glance ? (tierAtLeast(e.roll.tier, 'success') ? 'you make out who is there' : 'nothing clearer')
        : e.kind === 'pick' && e.way ? PICK_WORDS[e.way.did] ?? '' : e.kind === 'break_open' && e.breakOpen ? (e.breakOpen.opened ? 'it breaks open' : 'it holds') : '';
      check = { kind: 'roll', skill: e.roll.skill, ...tierPart(e.roll), result: said };
    }
  }
  if (check) out.check = check;
  // rolls others made against the player: attacks on them, and contests they were drawn into beyond their own check
  const incoming: NonNullable<LogLine['incomingChecks']> = [];
  for (const e of events) {
    const pk = packetOf(e);
    if (e.attack && e.attack.targetId === 'player' && e.attack.attackerId !== 'player') {
      const a = e.attack;
      incoming.push({ by: pk?.actor ?? 'someone', kind: 'attack', skill: a.attack.skill, ...tierPart(a.attack),
        ...(a.defense && a.defenseType ? { against: { what: 'your', skill: a.defense.skill, ...tierPart(a.defense) } } : {}),
        ...shiftsPart(s, a.gapShifts, a.attackerId, 'player'),
        result: blowResult(a, pk) });
    } else if (e.contest && e.actorId !== 'player' && e.id !== checkEv) {
      const c = e.contest;
      const mine = c.a.actorId === 'player' ? c.a : c.b.actorId === 'player' ? c.b : null;
      if (!mine) continue;
      const other = mine === c.a ? c.b : c.a;
      const result = c.winner === 'tie' ? 'a tie' : (c.winner === 'a') === (mine === c.a) ? 'you win' : 'you lose';
      incoming.push({ by: views.callName(s, 'player', other.actorId), kind: 'contest', skill: other.skill, ...tierPart(other), against: { what: 'your', skill: mine.skill, ...tierPart(mine) }, result });
    }
  }
  if (incoming.length) out.incomingChecks = incoming;
  // PS-200: every blow that landed with the player in it, hitting or hit, in the order it fell (the hit cards)
  const hits: HitNote[] = [];
  for (const e of events) {
    const a = e.attack;
    if (!a || (a.attackerId !== 'player' && a.targetId !== 'player') || a.attackerId === a.targetId || !struck(a.outcome)) continue;
    const pk = packetOf(e), mine = a.attackerId === 'player';
    hits.push({ mine, by: mine ? 'you' : pk?.actor ?? 'someone', target: mine ? pk?.target ?? views.callName(s, 'player', a.targetId) : 'you',
      weapon: pk?.weapon ?? null, result: blowResult(a, pk), changes: (pk?.changes ?? []).map(shown) });
  }
  if (hits.length) out.hits = hits;
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
      changes.push({ kind: own && c.startsWith('player is ') ? 'health' : 'condition', text: shown(c) });
    }
  }
  // BG-199: a foe who broke or surrendered to the player this turn (defeat XP paid) says so
  for (const l of s.log) {
    if (l.turn !== s.turn || l.code !== 'yielded_to_player') continue;
    const d = l.detail as { actorId: string; why: DefeatWhy };
    changes.push({ kind: 'condition', text: `${who(views.callName(s, 'player', d.actorId), true)} ${d.why === 'surrendered' ? 'surrenders' : 'breaks and yields'} to you` });
  }
  // D-141 VW12 a: a vow kept or broken this turn says so plainly, with what it gave or took
  for (const l of s.log) {
    if (l.turn !== s.turn || (l.code !== 'vow_kept' && l.code !== 'vow_broken')) continue;
    const v = s.vows?.find((x) => x.id === (l.detail as { id: string }).id);
    if (!v) continue;
    const got = (v.items ?? []).map((r) => { try { return countWords(r.item, getLibrary().items[r.item].name, r.qty); } catch { return r.item; } });
    changes.push({ kind: 'condition', text: l.code === 'vow_kept' ? `Vow kept: ${v.text} (+${v.xp} Thread${got.length ? `; ${got.join(', ')} in your pack` : ''})` : `Vow broken: ${v.text} (−${v.xp} Thread)` });
  }
  if (changes.length) out.changes = changes;
  return out;
}
/** BG-200: what moved an attack's gap besides the two tiers, each as "cover: 1 tier his way", toward whoever it helped
 * (a shift up helps the defender) */
function shiftsPart(s: GameState, shifts: TierShift[] | undefined, attackerId: string, defenderId: string): Pick<LineCheck, 'shifts'> {
  const whose = (id: string) => id === 'player' ? 'your' : ({ he: 'his', she: 'her', it: 'its' } as Record<string, string>)[actorById(s, id)?.pronouns ?? ''] ?? 'their';
  const out = (shifts ?? []).filter((x) => x.value).map((x) => `${x.source}: ${Math.abs(x.value)} tier${Math.abs(x.value) === 1 ? '' : 's'} ${whose(x.value > 0 ? defenderId : attackerId)} way`);
  return out.length ? { shifts: out } : {};
}
/** BG-199: what an XP award was for, in words: "Wren Tallow defeated (broke)", "job done: find the charm",
 * "achievement: First Blood"; the one wording for the mechanics panel and the turn's XP row */
export function xpSourceWords(s: GameState, x: XpAward): string {
  const [kind, id] = x.source.split(/:(.*)/);
  if (kind === 'defeat') return `${cap(views.callName(s, s.player.id, id))} defeated${x.why ? ` (${({ down: 'down', broken: 'broke', surrendered: 'surrendered' } as const)[x.why]})` : ''}`;
  if (kind === 'achievement') return `achievement: ${engine.achievementName(s, s.player.progression?.achievements?.find((a) => a.id === id) ?? { id })}`;
  if (kind === 'quest') return `job done: ${s.quests.find((q) => q.id === id)?.text ?? 'a job'}`;
  if (kind === 'essence removed') return `essence given up: ${getLibrary().essences?.[id]?.name ?? id}`;
  if (kind === 'vow') return `vow kept: ${s.vows?.find((v) => v.id === id)?.text ?? 'a vow'}`;
  if (kind === 'vow broken') return `vow broken: ${s.vows?.find((v) => v.id === id)?.text ?? 'a vow'}`;
  return x.source;
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
  const name = (id: string) => (id === me ? 'You' : clear.has(id) ? cap(views.callName(s, me, id)) : 'Someone');
  const whose = (id: string) => (id === me ? 'Your' : `${name(id)}’s`);
  const num = (n: number) => String(r1(n));
  const sgn = (n: number) => `${n >= 0 ? '+' : ''}${num(n)}`;
  // PW5 a: a wound shows its % and the points it came to, "health: Wounded -20% (-15.1)"
  const mods = (m: { source: string; value: number; pct?: number }[]) => (m.length ? ` [${m.map((x) => `${x.source} ${x.pct !== undefined ? `${sgn(x.pct)}% (${sgn(x.value)})` : sgn(x.value)}`).join(', ')}]` : '');
  // BF70: a roll moved by outcome steps (short of gear, cover, fear, perks) shows the outcome before them, the steps and what
  // moved it, then the outcome they made: "Near Miss [weapon +9], 8 steps down [Short of … −8] → Critical Failure−−−−−−"
  const tiered = (r: TierRoll & { modifiers?: { source: string; value: number }[]; tierShifts?: { source: string; value: number }[] }) => {
    const sh = (r.tierShifts ?? []).filter((x) => x.value), total = sh.reduce((t, x) => t + x.value, 0);
    if (!total) return `${tierName(r)}${mods(r.modifiers ?? [])}`;
    const n = Math.abs(total);
    return `${tierName(tierAt(tierLevel(r) - total))}${mods(r.modifiers ?? [])}, ${n} step${n === 1 ? '' : 's'} ${total < 0 ? 'down' : 'up'}${mods(sh)} → ${tierName(r)}`;
  };
  const roll = (r: TierRoll & { actorId: string; skill: string; d100: number; tierShifts?: { source: string; value: number }[] }) => `${whose(r.actorId)} ${skillName(r.skill).toLowerCase()} d100 ${r.d100} → ${tiered(r)}`;
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
    // PG9: the player's make-out roll on something half seen or half heard
    if (e.madeOut) out.push(`${roll(e.madeOut.roll)} to make out ${name(e.actorId).toLowerCase() === 'someone' ? 'someone' : name(e.actorId)} vs difficulty ${e.madeOut.target}: ${e.madeOut.passed ? 'made out' : 'not made out'}`);
    const target = e.attack?.targetId ?? e.target;
    if (e.actorId !== me && target !== me && e.perception[me]?.level !== 'full') continue;
    if (e.attack) {
      const a = e.attack;
      const def = a.defense ? `; ${a.defenseType} d100 ${a.defense.d100} → ${tiered(a.defense)}` : '';
      const where = part(a);
      out.push(`${name(a.attackerId)} → ${a.targetId === me ? 'you' : name(a.targetId)}: ${skillName(a.attack.skill)} d100 ${a.attack.d100} → ${tiered(a.attack)}${def}` +
        `${a.gap !== null ? `; gap ${a.gap}` : ''}; ${outcomeText(a.outcome)}${where ? ` (${where})` : ''}${a.damage ? `, damage ${num(a.damage)}` : ''}`);
    } else if (e.contest) {
      const c = e.contest;
      if ((sense(c.a.skill) || sense(c.b.skill)) && (unseen(c.a.actorId) || unseen(c.b.actorId))) continue;
      const won = c.winner === 'tie' ? 'a tie' : (c.winner === 'a' ? c.a : c.b).actorId === me ? 'you win' : `${name((c.winner === 'a' ? c.a : c.b).actorId)} wins`;
      out.push(`${roll(c.a)} vs ${roll(c.b).replace(/^Your/, 'your')}: ${won}`);
    } else if (e.roll) {
      if (sense(e.roll.asked ?? e.roll.skill) && unseen(e.target)) continue;
      out.push(`${roll(e.roll)}${e.obstacle ? ` (${GRADE_LEVELS.name(e.obstacle.grade)})` : ''}`);
    } else if (e.obstacle) {
      // OD1 b: an act on a graded thing that was sure, or out of reach, has no dice
      const k = e.obstacle;
      if (sense(k.skill) && unseen(e.target)) continue;
      out.push(`${whose(e.actorId)} ${skillName(k.skill).toLowerCase()} vs ${GRADE_LEVELS.name(k.grade)}: ${k.gate === 'sure' ? 'sure, no roll' : 'out of reach, no roll'}`);
    }
  }
  // X9: XP awards and level-ups this turn
  const turn = events[0]?.turn ?? s.turn;
  for (const x of s.player.progression?.xpLog ?? []) {
    if (x.turn !== turn) continue;
    if (x.levelUp) { out.push(`Level ${x.levelUp.level}! (${x.levelUp.classId ? getLibrary().classes[x.levelUp.classId]?.name ?? x.levelUp.classId : 'bonus level'})`); continue; }
    out.push(`+${num(x.amount)} XP (${xpSourceWords(s, x)})`);
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
    out.push(`${engine.healingName(d.source)}: nothing to heal, so you keep it`);
  }
  // D-254 a: an item that does not fit in a container (or the pack worn) says so, and stays where it was
  for (const l of s.log) {
    if (l.turn !== turn || l.code !== 'no_room') continue;
    const d = l.detail as { actorId: string; itemId: string; into?: string };
    if (d.actorId !== s.player.id) continue;
    const into = d.into ? [...s.player.core.inventory, ...s.ground].find((i) => i.id === d.into) : undefined;
    out.push(`${cap(itemDef(s, d.itemId).name)}: no room in ${into ? `the ${itemDef(s, into.itemId).name}` : 'your pack'}`);
  }
  // run 17: a rest or wait that the rules refuse says why, so the player doesn't keep trying
  for (const l of s.log) {
    if (l.turn !== turn || (l.code !== 'rest_blocked' && l.code !== 'wait_blocked')) continue;
    const d = l.detail as { actorId: string; reason: string; timeOfDay?: string };
    if (d.actorId !== s.player.id) continue;
    const what = l.code === 'rest_blocked' ? 'Rest' : d.reason === 'bed_taken' ? 'Sleep' : 'Wait';
    const why = d.reason === 'cooldown' ? 'too soon after your last rest' : d.reason === 'bed_taken' ? 'that bed is full'
      : d.reason === 'already' ? `it's already ${TIME_OF_DAY.name(d.timeOfDay as TimeOfDay).toLowerCase()}` : 'not while a fight is going on around you';
    out.push(`${what}: ${why}`);
  }
  // TV7: a trip says how far it went and why it stopped
  for (const l of s.log) {
    if (l.turn !== turn || l.code !== 'travelled') continue;
    const d = l.detail as { actorId: string; metres: number; night: boolean; stop: string };
    if (d.actorId !== s.player.id) continue;
    out.push(`Travelled ${views.distText(d.metres)} ${d.night ? ' in the dark' : ''}${d.stop === 'nightfall' ? ' · stopped at nightfall' : d.stop === 'encounter' ? ' · stopped by an encounter' : ''}`);
  }
  // T6: a wait or sleep says how long it took and where the clock is now
  for (const l of s.log) {
    if (l.turn !== turn || l.code !== 'time_passed') continue;
    const t = timeView(s);
    out.push(`Time passes: ${durationText((l.detail as { minutes: number }).minutes)} (Day ${t.day} · ${t.timeOfDay})`);
  }
  // AT65: a rest, wait, walk or long action the world clock stopped says when and why
  for (const l of s.log) {
    if (l.turn !== turn || l.code !== 'stretch_stopped') continue;
    const d = l.detail as { actorId: string; kind: string; why: string; seconds: number; row?: string };
    if (d.actorId !== s.player.id) continue;
    const why = ({ contact: 'someone or something reached you', closing: 'someone is coming at you', change: 'someone near changed what they were doing', fight: 'a fight in sight or hearing', appeared: 'someone came into sight or hearing', encounter: 'something met you on the way' } as Record<string, string>)[d.why] ?? d.why;
    const what = (d.row && getLibrary().durations?.[d.row]?.name) || ({ rest: 'Rest', wait: 'Wait', walk: 'Walk', trip: 'Trip' } as Record<string, string>)[d.kind] || d.kind; // AT45: a long action by its row's name
    out.push(`${what} stopped ${d.seconds < 60 ? 'at once' : `after ${durationText(d.seconds / 60)}`}: ${why}`);
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
      const why = { blow: 'a blow wakes you', noise: 'a loud noise wakes you', heard: 'you hear someone come', rested: 'you wake rested', watch: 'you wake for your watch' }[d.why ?? 'rested'];
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
    bands: [{ id: 'player_band', name: 'the player', goals: '', temperament: '', lethal: true, relations: {} }],
    hidden: { plans: {}, memory: {}, secrets: [], firedLog: [], weaverNote: '', stage: { eventSummary: '', challenge: 'none', gain: 'none', hiddenTerms: [] } },
    events: [], agentLog: [], log: [], rngSeed: seed, rngState: seed,
    pending: { turn: 0, mode: 'explore', engaged: [], fired: [] },
    places: [], facts: [], stage: { tier: 'success', scenarioNumber: 0, scenarioStartTurn: 0 },
    scenarioCaps: { promotions: 0, minted: 0 }, clocks: {}, quests: [], settings,
    libraryVersion: getLibrary().version, blueprints: [],
    walls: [], openings: [], roofs: [], lights: [], furniture: [], ground: [],
    meta: { storyId, title: CONFIG.STORY_PREMISE, schemaVersion: CONFIG.SCHEMA_VERSION, createdAt, settings },
  };
}

/** LN7: words in a narration, as the length bands count them */
export const wordCount = (text: string): number => text.split(/\s+/).filter(Boolean).length;
