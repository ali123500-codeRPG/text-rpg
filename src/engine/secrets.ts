// Secrets: revealWhen against resolved events, Responder reveals (own secrets only).
import type { GameEvent, GameState } from '../types';
import type { ExchangeSpeech } from './types';
import { slipsFor } from './speech';
import { tierAtLeast } from '../ruleset';

export function revealToPlayer(state: GameState, secretId: string): void {
  const j = state.player.journal;
  if (j && !j.secretsKnown.includes(secretId)) j.secretsKnown.push(secretId);
}

/** A secret becomes player knowledge only when a resolved event meets revealWhen. */
export function checkSecrets(state: GameState, events: GameEvent[], exchange?: ExchangeSpeech, speechSkill?: string): void {
  const known = state.player.journal?.secretsKnown ?? [];
  for (const s of state.hidden.secrets) {
    if (known.includes(s.id)) continue;
    const w = s.revealWhen;
    let met = false;
    if (w.type === 'event_in_zone') {
      // the player must perceive the event (or make it) for it to become player knowledge.
      met = events.some((e) => e.kind === w.kind && e.zone === w.zone && (e.actorId === state.player.id || !!e.perception[state.player.id]));
    } else {
      const sp = exchange?.perSpokesperson[w.againstActorId];
      if (sp) met = slipsFor(state, w.againstActorId, [exchange!.skill, ...(speechSkill ? [speechSkill] : [])], sp.contest).includes(s.id);
      // OD11 a: an act aimed at againstActorId with the skill (a roll, or sure with no roll: Success) at minTier or better
      met ||= events.some((e) => e.actorId === state.player.id && e.target === w.againstActorId && e.obstacle?.skill === w.skill && !!e.tier && tierAtLeast(e.tier, w.minTier));
    }
    if (met) revealToPlayer(state, s.id);
  }
}
