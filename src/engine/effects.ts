// Agent side effects, applied when the turn resolves. Every model output is a request; the engine decides.
import type { Actor, AgreementMade, GameEvent, GameState, Trigger } from '../types';
import { STANCES } from '../scales';
import { CONFIG } from '../config';
import { calmBandmatesSwitch, headTo, letSearch, switchRoutine } from '../minds';
import { actorById, allActors, countsInFight, hostile, isActive, isEngaged, knowsName, nameBook, stance } from './relations';
import { usableAgentOutputs } from './merge';
import { revealToPlayer } from './secrets';
import type { TurnInput } from './types';
import { applyMemoryOps, endAgreements, makeAgreement } from './memory';
import { agentQuestEnd, makeQuest } from './quests';
import { tally } from './xp';
import { seesClearlyNow } from '../views';
import { hearsWords } from '../perception';
import { falseName, nameSaid } from '../words';
import { sparOf, startSpar, yieldSpar } from './spar';
import { applyGoals } from './goals';

const TRIGGER_TYPES = ['player_seen_in_zone', 'turn_reached', 'actor_down', 'alarm_heard'];

export function logCode(state: GameState, code: string, detail?: Record<string, unknown>): void {
  state.log.push({ turn: state.turn, code, ...(detail ? { detail } : {}) });
}

/** BG-95: one rule for every speaker and listener, player and NPC, passing remarks included (NM6). Whoever hears a line's
 * words learns each name in it that the speaker knows, when they see clearly whom it belongs to right then (the speaker
 * naming themselves, or someone in view). A name said of someone out of sight is kept as heard of (NM2); it attaches when
 * its owner answers a line that called them by it (`earlier`: this turn's events so far). A false name the speaker gives
 * for themselves (NM3) is believed by every listener that sees them and did not see through the lie (seenThrough, a won
 * lie contest, Overheard), and becomes what that listener calls them until it learns the real one. A name counts when
 * the line holds it whole or its first word that is not a title (CONFIG.NAME_TITLE_WORDS), with capitals kept. */
export function learnNames(state: GameState, ev: GameEvent, earlier: GameEvent[] = []): void {
  const text = ev.line?.text;
  const speaker = actorById(state, ev.actorId);
  if (!text || !speaker) return;
  const named = [state.player, ...state.actors].filter((x) => knowsName(state, speaker, x) && nameSaid(text, x.names.current));
  const alias = falseName(speaker, text);
  const caught = new Set([...(ev.seenThrough ?? []), ...(ev.push?.tell ? [ev.push.listener] : []), ...(ev.overheard ?? [])]);
  for (const [id, p] of Object.entries(ev.perception)) {
    const listener = actorById(state, id);
    const book = listener && listener !== speaker && hearsWords(p) ? nameBook(state, listener) : undefined;
    if (!listener || !book) continue;
    const learn = (x: Actor) => {
      book.known.push(x.id);
      if (book.heardOf.includes(x.id)) book.heardOf.splice(book.heardOf.indexOf(x.id), 1);
      delete book.aliases[x.id];
    };
    for (const x of named) {
      if (knowsName(state, listener, x)) continue;
      if (seesClearlyNow(state, listener, x.id)) learn(x);
      else if (!book.heardOf.includes(x.id)) book.heardOf.push(x.id);
    }
    const sees = seesClearlyNow(state, listener, speaker.id);
    // NM2: the speaker answers to a heard-of name the listener just called them by
    if (sees && book.heardOf.includes(speaker.id) && earlier.some((e) => e.actorId === listener.id && e.line && nameSaid(e.line.text, speaker.names.current)
      && (e.target === speaker.id || !!e.speech?.addressees?.includes(speaker.id)))) learn(speaker);
    if (alias && sees && !caught.has(listener.id) && !knowsName(state, listener, speaker)) book.aliases[speaker.id] = alias;
  }
}
function sanitizeTriggers(triggers: Trigger[] | undefined, ownerId: string): Trigger[] {
  return (triggers ?? [])
    .filter((t) => t && typeof t.id === 'string' && TRIGGER_TYPES.includes(t.when?.type) && t.then && typeof t.then.type === 'string')
    .map((t) => ({ ...t, ownerId, once: !!t.once }));
}

export type EffectsCtx = {
  /** perceived speech by `toward` since the actor's last call */
  heardSpeech(actorId: string, toward: string): boolean;
  /** perceived this turn's exchange (player's speech or a spoken reply) */
  heardExchange(actorId: string): boolean;
  /** PM3: `listener` perceived a line spoken by `speaker` this turn */
  heardNow(listener: string, speaker: string): boolean;
};

/** one stance step toward `other`; a yielded actor steps from opposed: talked colder it fights again, warmer it lets the grudge go (Q1) */
/** a break or a surrender takes hold of an NPC: from fear (MB7), or said aloud in a real fight (BG-177). Q1/Q4: it replaces
 * hostile with yielded toward everyone it was fighting (broken shares the yielded stance so both tune together) */
export function loseNerve(state: GameState, a: Actor, r: 'broken' | 'surrendered'): void {
  if (hostile(state, a, state.player)) tally(state, 'yielded');
  a.mind!.moraleState = r;
  for (const x of allActors(state)) if (x !== a && hostile(state, a, x)) a.mind!.overrides = { ...(a.mind!.overrides ?? {}), [x.id]: 'yielded' };
}

/** actions that are only words or waiting: an answer made of them sets no errand going (BG-180) */
const WORDS_ONLY = new Set(['hold', 'talk', 'persuade', 'deceive', 'intimidate', 'barter']);

export function stepStance(state: GameState, a: Actor, other: Actor, step: 'friendlier' | 'colder'): void {
  if (!a.mind) return;
  const cur = stance(state, a, other);
  const i = STANCES.pos(cur === 'yielded' ? 'opposed' : cur) + (step === 'friendlier' ? 1 : -1);
  a.mind.overrides = { ...(a.mind.overrides ?? {}), [other.id]: STANCES.at(i) };
}

/** PM3/PM4: a deal; QT1/QT3/QT16: a job in a deal with the player becomes a quest once the giver heard the player accept */
function deal(state: GameState, a: Actor, made: AgreementMade, ctx: EffectsCtx): void {
  const id = makeAgreement(state, a, made, ctx.heardNow);
  if (id && made.job && made.with === state.player.id) makeQuest(state, a, id, made.job, ctx.heardSpeech(a.id, state.player.id));
}

export function applyAgentEffects(state: GameState, input: TurnInput, ctx: EffectsCtx): void {
  const spokes = new Set(input.spokespeople);
  for (const o of usableAgentOutputs(input)) {
    const a = actorById(state, o.actorId);
    if (!a || a.kind !== 'npc') continue;
    const st = o.output.stance;
    if (st) {
      const other = actorById(state, st.toward);
      if (!other || !ctx.heardSpeech(a.id, st.toward)) logCode(state, 'invalid_stance', { actorId: a.id, toward: st.toward });
      else {
        // N4b: a foe hostile to the player, never hit by them, talked out of hostility by their words
        const talkedDown = other === state.player && st.step === 'friendlier' && stance(state, a, other) === 'hostile' && !a.mind?.hitByPlayer;
        stepStance(state, a, other, st.step);
        if (talkedDown) tally(state, 'talked_down');
      }
    }
    // SP2/SP5: a spar agreed aloud this turn (every other fighter heard the maker), or giving one up
    const sp = o.output.spar;
    if (sp) {
      const others = sp.sides.flat().filter((id) => id !== a.id);
      if (!sp.sides.some((x) => x.includes(a.id)) || others.some((id) => !ctx.heardNow(id, a.id))) logCode(state, 'invalid_spar', { by: a.id, sides: sp.sides });
      else startSpar(state, sp.sides, !!sp.cruel, a.id);
    }
    // SP5: "I yield" in a spar leaves it; BG-177: in a real fight it surrenders, as a surrender from fear does (DEFEATED)
    if (o.output.yields) {
      if (sparOf(state, a.id) || !countsInFight(a) || !isEngaged(state, a)) yieldSpar(state, a);
      else { loseNerve(state, a, 'surrendered'); logCode(state, 'npc_yielded', { actorId: a.id }); }
    }
    letSearch(state, a, o.output.letsSearch); // BF16
    if (o.output.questEnd) agentQuestEnd(state, a, o.output.questEnd, ctx.heardSpeech(a.id, state.player.id), ctx.heardNow(state.player.id, a.id));
    let routineId: string | null = null;
    if (o.agent === 'voice') {
      routineId = o.output.routine;
      // PM3: the Voice can strike a deal with the player only
      if (o.output.agreement) deal(state, a, { ...o.output.agreement, with: state.player.id }, ctx);
    } else {
      const pu = o.output.planUpdate;
      if (pu) {
        state.hidden.plans[a.id] = { goal: pu.goal, steps: pu.steps, triggers: sanitizeTriggers(pu.triggers, a.id), createdTurn: state.turn };
        routineId = pu.routine;
      }
      applyMemoryOps(state, a, o.output.memory, pu?.memoryNote); // PM1/PM2
      endAgreements(state, a, o.output.endAgreements);
      if (o.output.agreement) deal(state, a, o.output.agreement, ctx); // PM3/PM4
    }
    if (o.agent === 'responder') {
      for (const id of o.output.reveals ?? []) {
        const s = state.hidden.secrets.find((x) => x.id === id);
        if (s && s.holderId === a.id) revealToPlayer(state, id);
        else logCode(state, 'invalid_reveal', { actorId: a.id, secretId: id });
      }
    }
    const switched = !!routineId && switchRoutine(state, a, routineId, 'agent');
    if (switched && spokes.has(a.id)) calmBandmatesSwitch(state, a.id, routineId!, ctx.heardExchange);
    // NW2: after any switch, so the walk goes back to the routine it just picked
    // BG-139: leading someone a single step (lead with no headTo) is a walk to where this turn's move goes, so it waits there
    const step = o.output.action.type === 'move' ? o.output.action.target : 'move' in o.output ? o.output.move?.toZone : null;
    const goal = o.output.headTo ?? (o.output.lead && step ? step : null);
    if (goal) headTo(state, a, goal, 'agent', o.output.lead ?? undefined);
    // BF11: a place its own agent moved it to holds AGENT_STAY_S, until its agent decides again
    if (a.mind) { if (!goal && step && step === a.zone) a.mind.stay = { zone: step, since: state.turn }; else delete a.mind.stay; }
    // BG-180: an answer with a deed under way (a walk to fetch, an open, a lead) keeps it thinking for ERRAND_TURNS; its own hold ends that
    const deed = !WORDS_ONLY.has(o.output.action.type) || !!step || !!goal;
    if (a.mind && o.agent !== 'planner' && deed) a.mind.errandUntil = state.turn + CONFIG.ERRAND_TURNS;
    else if (a.mind && o.agent === 'planner' && !deed) delete a.mind.errandUntil;
    // UG5/UG16: a goal holder's goals and next steps, last, so its queue's first step wins over this output's routine or walk
    if (o.agent !== 'voice') applyGoals(state, a, o.output.goals, o.output.steps);
  }
}
