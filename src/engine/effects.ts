// Agent side effects, applied when the turn resolves. Every model output is a request; the engine decides.
import type { Actor, GameState, Stance, Trigger } from '../types';
import { CONFIG } from '../config';
import { switchRoutine } from '../minds';
import { actorById, isActive, isEngaged, stance } from './relations';
import { usableAgentOutputs } from './merge';
import { revealToPlayer } from './secrets';
import type { TurnInput } from './types';

const STANCES: Stance[] = ['opposed', 'neutral', 'friendly'];
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

function isCalm(state: GameState, a: Actor): boolean {
  const last = a.mind?.alarm?.lastAlarmTurn;
  // GAP: "calm" read as not engaged and no attack or alarm perceived within DECAY_TURNS.
  return !isEngaged(state, a) && (last === undefined || state.turn - last >= CONFIG.DECAY_TURNS);
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
        const i = STANCES.indexOf(stance(state, a, other)) + (st.step === 'friendlier' ? 1 : -1);
        a.mind!.overrides = { ...(a.mind!.overrides ?? {}), [other.id]: STANCES[Math.max(0, Math.min(2, i))] };
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
    // Calm bandmates [Proposed]: calm, code-run bandmates who perceived the exchange follow next turn.
    for (const m of state.actors) {
      if (m === a || m.bandId !== a.bandId || !isActive(m) || m.mind?.control !== 'code') continue;
      if (isCalm(state, m) && ctx.heardExchange(m.id)) switchRoutine(state, m, routineId, 'bandmate');
    }
  }
}
