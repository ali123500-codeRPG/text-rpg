// Agent side effects, applied when the turn resolves. Every model output is a request; the engine decides.
import type { Actor, GameState, Trigger } from '../types';
import { STANCES } from '../scales';
import { CONFIG } from '../config';
import { calmBandmatesSwitch, switchRoutine } from '../minds';
import { actorById, isActive, isEngaged, stance } from './relations';
import { usableAgentOutputs } from './merge';
import { revealToPlayer } from './secrets';
import type { TurnInput } from './types';

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
};

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
        // a yielded actor steps from opposed: talked colder it fights again, warmer it lets the grudge go (Q1)
        const cur = stance(state, a, other);
        const i = STANCES.pos(cur === 'yielded' ? 'opposed' : cur) + (st.step === 'friendlier' ? 1 : -1);
        a.mind!.overrides = { ...(a.mind!.overrides ?? {}), [other.id]: STANCES.at(i) };
      }
    }
    let routineId: string | null = null;
    if (o.agent === 'voice') routineId = o.output.routine;
    else {
      const pu = o.output.planUpdate;
      if (pu) {
        state.hidden.plans[a.id] = { goal: pu.goal, steps: pu.steps, triggers: sanitizeTriggers(pu.triggers, a.id), createdTurn: state.turn };
        state.hidden.memory[a.id] = pu.memoryNote;
        routineId = pu.routine;
      }
    }
    if (o.agent === 'responder') {
      for (const id of o.output.reveals ?? []) {
        const s = state.hidden.secrets.find((x) => x.id === id);
        if (s && s.holderId === a.id) revealToPlayer(state, id);
        else logCode(state, 'invalid_reveal', { actorId: a.id, secretId: id });
      }
    }
    if (!routineId || !switchRoutine(state, a, routineId, 'agent')) continue;
    if (!spokes.has(a.id)) continue;
    calmBandmatesSwitch(state, a.id, routineId, ctx.heardExchange);
  }
}
