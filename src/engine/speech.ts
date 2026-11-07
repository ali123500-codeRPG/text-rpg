// Dialogue turns: spokespeople, the player's speech check, impressions (Dialogue input table), SLIPS.
import type { Actor, ContestResult, GameState, Intent, Rng, RollResult, Secret, Tier } from '../types';
import { SPEECH_ACTIONS } from '../types';
import { CONFIG } from '../config';
import { ruleset } from '../ruleset';
import { TIER_MAX, TIER_MIN } from '../config';
import { isActive, shortestPath } from './relations';
import type { ExchangeSpeech } from './types';

export const SPEECH_SKILL: Record<string, string> = {
  talk: 'persuasion', persuade: 'persuasion', deceive: 'persuasion', intimidate: 'intimidation', barter: 'barter',
};

// Dialogue input table (wording is a placeholder). Keyed by tier ID; an ID past either end uses the end's words.
const CONVINCING: Record<number, string> = {
  [-3]: 'insulting, plainly false', [-2]: 'unconvincing', [-1]: 'doubtful but possible',
  0: 'convincing', 1: 'very convincing', 2: 'completely convincing',
};
const THREATENING: Record<number, string> = {
  [-3]: 'laughable', [-2]: 'unimpressive', [-1]: 'unsettling',
  0: 'threatening', 1: 'frightening', 2: 'terrifying',
};
export function impressionWords(actionType: string, tier: Tier): string {
  return (actionType === 'intimidate' ? THREATENING : CONVINCING)[Math.max(TIER_MIN, Math.min(TIER_MAX, tier))];
}

export function isSpeech(type: string | undefined | null): boolean {
  return !!type && (SPEECH_ACTIONS as readonly string[]).includes(type);
}

/**
 * Dialogue turn step 2, with OQ-27 (c): for an addressed band, the sticky partner (state.stage.partner, the NPC the
 * player last spoke with this scene) answers if it is an active member in reach; else the nearest member.
 * GAP: "everyone in earshot" read as NPCs in the player's zone or one link away.
 */
export function selectSpokespeople(state: GameState, intent: Intent): string[] {
  if (!isSpeech(intent.action?.type) || !intent.addressees?.length) return [];
  const dist = (a: Actor) => shortestPath(state, state.player.zone, a.zone)?.length ?? Infinity;
  const live = state.actors.filter(isActive);
  const nearest = (members: Actor[]) =>
    [...members].sort((a, b) => dist(a) - dist(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).find((a) => dist(a) < Infinity);
  const out: string[] = [];
  const used = new Set<string>();
  const take = (bandId: string, member: Actor | undefined) => {
    if (!member || used.has(bandId) || out.length >= CONFIG.MAX_SPOKESPEOPLE) return;
    used.add(bandId);
    out.push(member.id);
  };
  for (const ad of intent.addressees) {
    if (ad === 'everyone') {
      const heard = live.filter((a) => dist(a) <= 1);
      const bands = [...new Set(heard.map((a) => a.bandId))].map((b) => ({ b, m: nearest(heard.filter((a) => a.bandId === b))! }));
      bands.sort((x, y) => dist(x.m) - dist(y.m) || (x.m.id < y.m.id ? -1 : 1));
      for (const { b, m } of bands) take(b, m);
      continue;
    }
    const named = state.actors.find((a) => a.id === ad);
    if (named) {
      if (isActive(named)) take(named.bandId, named); // inactive actors are never picked
      continue;
    }
    if (state.bands.some((b) => b.id === ad)) {
      const members = live.filter((a) => a.bandId === ad);
      const partner = members.find((a) => a.id === state.stage.partner && dist(a) < Infinity);
      take(ad, partner ?? nearest(members));
    }
  }
  return out;
}

/**
 * OQ-27 (c) clarify: a band is addressed without a name, no sticky partner of it is in reach, and the player can see
 * more than one of its members. Returns the ids to ask between (only actors the player sees), else null.
 */
export function unclearAddressee(state: GameState, intent: Intent, seen: string[]): string[] | null {
  if (!isSpeech(intent.action?.type) || !intent.addressees?.length) return null;
  const live = state.actors.filter(isActive);
  for (const ad of intent.addressees) {
    if (ad === 'everyone' || !state.bands.some((b) => b.id === ad)) continue;
    const members = live.filter((a) => a.bandId === ad && seen.includes(a.id));
    if (members.some((a) => a.id === state.stage.partner)) continue;
    if (members.length > 1) return members.map((a) => a.id).sort();
  }
  return null;
}

function meetsReveal(s: Secret, sp: string, skills: string[], contest: ContestResult): boolean {
  const w = s.revealWhen;
  return w.type === 'check_passed' && w.againstActorId === sp && skills.includes(w.skill) &&
    contest.winner === 'a' && contest.a.tier >= w.minTier;
}

/** check_passed secrets of `sp` that this speech contest meets [Proposed]. GAP: "meets" = the player wins the contest with that skill at minTier or better. */
export function slipsFor(state: GameState, sp: string, skills: string[], contest: ContestResult): string[] {
  const known = state.player.journal?.secretsKnown ?? [];
  return state.hidden.secrets.filter((s) => !known.includes(s.id) && meetsReveal(s, sp, skills, contest)).map((s) => s.id);
}

/** Exchange slot part 1: one player roll, contested separately against each spokesperson's roll with the same skill. */
export function resolveSpeech(state: GameState, intent: Intent, spokespeople: string[], rng: Rng): ExchangeSpeech {
  const type = intent.action?.type ?? 'talk';
  const named = SPEECH_SKILL[type] ?? 'persuasion';
  const req = (actorId: string) => ({ actorId, skill: named, modifiers: [], tierShifts: [] });
  const a: RollResult = ruleset.roll(req(state.player.id), state, rng);
  const perSpokesperson: ExchangeSpeech['perSpokesperson'] = {};
  for (const sp of spokespeople) {
    const b = ruleset.roll(req(sp), state, rng);
    const gap = b.tier - a.tier;
    const contest: ContestResult = { a, b, gap, winner: gap < 0 ? 'a' : gap > 0 ? 'b' : 'tie' };
    perSpokesperson[sp] = { contest, slips: slipsFor(state, sp, [named, a.skill], contest) };
  }
  return { skill: a.skill, playerTier: a.tier, impression: impressionWords(type, a.tier) ?? null, perSpokesperson };
}
