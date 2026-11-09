// Dialogue turns: spokespeople, the player's speech check, impressions (Dialogue input table), SLIPS.
import type { Actor, ContestResult, GameState, Intent, Rng, RollResult, Secret, Tier } from '../types';
import { SPEECH_ACTIONS } from '../types';
import { CONFIG } from '../config';
import { hasPerk, markUse, ruleset, tierAtLeast, tierLevel } from '../ruleset';
import { getLibrary } from '../library';
import { isActive, shortestPath, wary } from './relations';
import type { ExchangeSpeech } from './types';

export const SPEECH_SKILL: Record<string, string> = {
  talk: 'persuasion', persuade: 'persuasion', deceive: 'persuasion', intimidate: 'intimidation', barter: 'barter',
};

// Dialogue input table (wording is a placeholder), keyed by tier; a roll past either end uses the end's words.
const CONVINCING: Record<Tier, string> = {
  critical_failure: 'insulting, plainly false', failure: 'unconvincing', near_miss: 'doubtful but possible',
  success: 'convincing', great_success: 'very convincing', critical_success: 'completely convincing',
};
const THREATENING: Record<Tier, string> = {
  critical_failure: 'laughable', failure: 'unimpressive', near_miss: 'unsettling',
  success: 'threatening', great_success: 'frightening', critical_success: 'terrifying',
};
export function impressionWords(actionType: string, tier: Tier): string {
  return (actionType === 'intimidate' ? THREATENING : CONVINCING)[tier];
}

export function isSpeech(type: string | undefined | null): boolean {
  return !!type && (SPEECH_ACTIONS as readonly string[]).includes(type);
}

/**
 * Dialogue turn step 2, with OQ-27 (c): for an addressed band, the sticky partner (state.stage.partner, the NPC the
 * player last spoke with this scene) answers if it is an active member in reach; else the nearest member.
 * GAP: "everyone in earshot" read as NPCs in the player's zone or one link away.
 */
/** A15 Quick Word: in a fight, a one-sentence line said beside a non-speech action resolves as talk without using the
 * action, and the NPCs' spoken replies to it are free too */
export function quickWord(state: GameState, intent: Intent): boolean {
  const line = intent.spoken?.trim() ?? '';
  return hasPerk(state.player, 'quick_word') && state.mode === 'tactical' && !!intent.action && !isSpeech(intent.action.type)
    && !!line && !/[.!?]["”’)]*\s+\S/.test(line) && !!intent.addressees?.length;
}

export function selectSpokespeople(state: GameState, intent: Intent): string[] {
  if ((!isSpeech(intent.action?.type) && !quickWord(state, intent)) || !intent.addressees?.length) return [];
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
    contest.winner === 'a' && tierAtLeast(contest.a, w.minTier);
}

/** check_passed secrets of `sp` that this speech contest meets [Proposed]. GAP: "meets" = the player wins the contest with that skill at minTier or better. */
export function slipsFor(state: GameState, sp: string, skills: string[], contest: ContestResult): string[] {
  const known = state.player.journal?.secretsKnown ?? [];
  return state.hidden.secrets.filter((s) => !known.includes(s.id) && meetsReveal(s, sp, skills, contest)).map((s) => s.id);
}

/** Exchange slot part 1: one player roll, contested separately against each spokesperson's roll with the same skill. */
export function resolveSpeech(state: GameState, intent: Intent, spokespeople: string[], rng: Rng): ExchangeSpeech {
  const type = isSpeech(intent.action?.type) ? intent.action!.type : 'talk'; // A15 Quick Word: the line is talk
  const named = SPEECH_SKILL[type] ?? 'persuasion';
  const req = (actorId: string) => ({ actorId, skill: named, modifiers: [], tierShifts: [] });
  const p = state.player;
  // A16 Threaten for Answers: against an opposed or hostile listener, intimidation counts as the named skill
  const threat = (sp: string) => {
    const b = state.actors.find((x) => x.id === sp);
    return !!b && hasPerk(p, 'threaten_for_answers') && wary(state, b, p);
  };
  const d = rng.d100();
  const die: Rng = { get state() { return rng.state; }, next: () => rng.next(), int: (lo, hi) => rng.int(lo, hi), d100: () => d };
  const a: RollResult = ruleset.roll(req(p.id), state, die);
  const aT: RollResult | null = spokespeople.some(threat) ? ruleset.roll({ ...req(p.id), fullValue: ['intimidation'] }, state, die) : null;
  const perSpokesperson: ExchangeSpeech['perSpokesperson'] = {};
  let shown = a;
  for (const sp of spokespeople) {
    const t = aT && threat(sp);
    const mine = t ? aT : a;
    if (t && spokespeople.every(threat)) shown = aT;
    // All-50 Easy Speaker (option a): a listener who owns it answers one outcome better
    const listener = state.actors.find((x) => x.id === sp);
    const b = ruleset.roll({ ...req(sp), tierShifts: hasPerk(listener, 'easy_speaker') ? [{ source: 'Easy Speaker', value: 1 }] : [] }, state, rng);
    const gap = tierLevel(b) - tierLevel(mine);
    const contest: ContestResult = { a: mine, b, gap, winner: gap < 0 ? 'a' : gap > 0 ? 'b' : 'tie' };
    const skills = [named, mine.skill, ...(t && mine.skill === 'intimidation' ? INFLUENCE() : [])];
    perSpokesperson[sp] = { contest, slips: slipsFor(state, sp, skills, contest) };
    markUse(state, p, mine.skill, contest); // SP2: talking to someone near your level marks the skill
  }
  return { skill: shown.skill, playerTier: shown.tier, impression: impressionWords(type, shown.tier) ?? null, perSpokesperson };
}

/** skills tagged influence (persuasion, intimidation, barter) */
const INFLUENCE = () => Object.entries(getLibrary().skills).filter(([, k]) => k.functions?.includes('influence')).map(([id]) => id);
