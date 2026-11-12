// Agent side effects, applied when the turn resolves. Every model output is a request; the engine decides.
import type { Actor, AgreementMade, GameState, Trigger } from '../types';
import { STANCES } from '../scales';
import { CONFIG } from '../config';
import { calmBandmatesSwitch, headTo, switchRoutine } from '../minds';
import { actorById, isActive, isEngaged, stance } from './relations';
import { usableAgentOutputs } from './merge';
import { revealToPlayer } from './secrets';
import type { TurnInput } from './types';
import { applyMemoryOps, endAgreements, makeAgreement } from './memory';
import { agentQuestEnd, makeQuest } from './quests';
import { tally } from './xp';
import { startSpar, yieldSpar } from './spar';

const TRIGGER_TYPES = ['player_seen_in_zone', 'turn_reached', 'actor_down', 'alarm_heard'];

export function logCode(state: GameState, code: string, detail?: Record<string, unknown>): void {
  state.log.push({ turn: state.turn, code, ...(detail ? { detail } : {}) });
}

/** introduces: only the speaker, or actors in its knows (a knows fact with that id, or naming that actor). */
export function applyIntroduces(state: GameState, speaker: Actor, ids: string[] | undefined): void {
  const j = state.player.journal;
  for (const id of ids ?? []) {
    const who = actorById(state, id);
    const ok = !!who && (id === speaker.id || !!speaker.mind?.knows.some((f) => f.id === id || f.text.includes(who.names.current)));
    if (!ok) logCode(state, 'invalid_introduce', { actorId: speaker.id, id });
    else if (j && !j.namesKnown.includes(id)) j.namesKnown.push(id);
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
    if (o.output.yields) yieldSpar(state, a);
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
    if (o.output.headTo) headTo(state, a, o.output.headTo);
  }
}
