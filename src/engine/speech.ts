// Dialogue turns: spokespeople, the player's speech check, impressions (Dialogue input table), SLIPS.
import { FN } from '../library/functionIds';
import type { Actor, ContestResult, GameEvent, GameState, Intent, Rng, RollResult, Secret, Tier } from '../types';
import { SPEECH_ACTIONS } from '../types';
import { CONFIG } from '../config';
import { hasPerk, markUse, ruleset, tierAtLeast, tierLevel } from '../ruleset';
import { getLibrary } from '../library';
import { isActive, shortestPath, wary } from './relations';
import type { ExchangeSpeech } from './types';
import { SK } from '../library/skillIds';
import { PK } from '../library/perkIds';
import { tally } from './xp';
import { contestFeat } from './feats';
import { applyHaggle, isSeller } from './trade';
import { countTry, repeatTryMods } from '../ruleset/pressure';
import { hearsClearly, hearsWords } from '../perception';
import { VOLUME_NOISE } from '../perception/noise';

export const SPEECH_SKILL: Record<string, string> = {
  talk: SK.persuasion, persuade: SK.persuasion, deceive: SK.lying, intimidate: SK.intimidation, barter: SK.barter,
};
/** what the listener answers with: the speaker's skill, except a lie, which Insight answers (NT17) */
export const answerSkill = (type: string): string => type === 'deceive' ? SK.insight : SPEECH_SKILL[type] ?? SK.persuasion;

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

/** BG-50: what a Responder voicing a beat hears from the player: nothing yet; it speaks first */
export const BEAT_OPENING = '(the player has said nothing to you: you speak first, as COMMITTED says)';

/** what the listener hears for a talk action that has no words: only that the player wants a word with them */
export const NO_WORDS = '(no words yet: they only catch your eye to talk)';

export function isSpeech(type: string | undefined | null): boolean {
  return !!type && (SPEECH_ACTIONS as readonly string[]).includes(type);
}

/** run 24: a speech action the Parser left without words or listeners ("can you do it for one copper?" as a barter with
 * spoken and addressees null) never reached the listener. The player's own line stands in for the words, and the
 * action's target, when it is a character, for the listener. */
/** BG-55: who the player was just talking with: NPCs whose words at the player reached them last turn, and those the
 * player spoke to, still active */
export function talkingWith(state: GameState): string[] {
  const recent = state.recentEvents ?? [];
  const last = Math.max(-1, ...recent.map((e) => e.turn));
  const p = state.player, ids = new Set<string>();
  for (const e of recent) {
    if (e.turn !== last || e.kind !== 'speak' || !e.line) continue;
    if (e.actorId === p.id) for (const id of [e.target, ...(e.speech?.addressees ?? [])]) { if (id && id !== p.id) ids.add(id); }
    else if (e.target === p.id && e.perception[p.id]?.heard) ids.add(e.actorId);
  }
  return [...ids].filter((id) => { const a = state.actors.find((x) => x.id === id); return !!a && isActive(a); });
}

export function fillSpeech(state: GameState, intent: Intent, text: string): Intent {
  // BG-46: words with no action at all (the Parser kept "Hello? Who's there?" in spoken but gave no action) are a talk to
  // whoever they are for, so they are said instead of lost
  if (!intent.action && !intent.perkMove && intent.spoken?.trim() && !intent.yields) {
    const to = intent.addressees?.find((x) => state.actors.some((y) => y.id === x)) ?? null;
    const talk = talkingWith(state);
    return { ...intent, action: { type: 'talk', skill: '', target: to, targetPart: null, item: null, mode: null, approach: '', stance: 'normal' }, addressees: intent.addressees?.length ? intent.addressees : talk.length ? talk : ['everyone'] };
  }
  const a = intent.action;
  if (!a || !isSpeech(a.type)) return intent;
  const out = { ...intent };
  // a plain "talk to someone" with no words of its own is an opening, not a line: the command text is never spoken
  if (!out.spoken?.trim()) out.spoken = a.type === 'talk' ? null : text.trim();
  if (!out.addressees?.length && a.target && state.actors.some((x) => x.id === a.target)) out.addressees = [a.target];
  // BG-55: words that name no one, right after an exchange, are for whoever the player was just talking with
  if (!out.addressees?.length && !a.target && out.spoken?.trim() && talkingWith(state).length) out.addressees = talkingWith(state);
  return out;
}

/**
 * Dialogue turn step 2, with OQ-27 (c): for an addressed band, the sticky partner (state.stage.partner, the NPC the
 * player last spoke with this scenario) answers if it is an active member in reach; else the nearest member.
 * "everyone": those who hear the player's voice clearly where they stand (hearsClearly).
 */
/** A15 Quick Word: in a fight, a one-sentence line said beside a non-speech action resolves as talk without using the
 * action, and the NPCs' spoken replies to it are free too */
export function quickWord(state: GameState, intent: Intent): boolean {
  const line = intent.spoken?.trim() ?? '';
  return hasPerk(state.player, PK.quick_word) && state.mode === 'tactical' && !!intent.action && !isSpeech(intent.action.type)
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
      const heard = live.filter((a) => hearsClearly(state, state.player, a, VOLUME_NOISE[intent.volume ?? 'normal'])); // who hears the player's voice clearly (BG-57, BG-71, BG-88)
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
  const named = SPEECH_SKILL[type] ?? SK.persuasion;
  // one player roll for every spokesperson: per-listener modifiers (Bane, Shaken, Swayed) count when there is one listener
  const p = state.player;
  const tries = repeatTryMods(p, spokespeople, type); // NT3
  const req = (actorId: string) => ({ actorId, skill: named, modifiers: tries, tierShifts: [], ...(actorId === state.player.id && spokespeople.length === 1 ? { against: spokespeople[0] } : {}) });
  // A16 Threaten for Answers: against an opposed or hostile listener, intimidation counts as the named skill
  const threat = (sp: string) => {
    const b = state.actors.find((x) => x.id === sp);
    return !!b && hasPerk(p, PK.threaten_for_answers) && wary(state, b, p);
  };
  const d = rng.d100();
  const die: Rng = { get state() { return rng.state; }, next: () => rng.next(), int: (lo, hi) => rng.int(lo, hi), d100: () => d };
  const a: RollResult = ruleset.roll(req(p.id), state, die);
  const aT: RollResult | null = spokespeople.some(threat) ? ruleset.roll({ ...req(p.id), fullValue: [SK.intimidation] }, state, die) : null;
  const perSpokesperson: ExchangeSpeech['perSpokesperson'] = {};
  let shown = a;
  for (const sp of spokespeople) {
    const t = aT && threat(sp);
    const mine = t ? aT : a;
    if (t && spokespeople.every(threat)) shown = aT;
    const b = answerRoll(state, state.actors.find((x) => x.id === sp)!, answerSkill(type), p.id, rng);
    const contest = toContest(mine, b);
    const skills = [named, mine.skill, ...(t && mine.skill === SK.intimidation ? INFLUENCE() : [])];
    perSpokesperson[sp] = { contest, slips: slipsFor(state, sp, skills, contest), ...(type === 'deceive' && contest.winner === 'b' ? { tell: true as const } : {}) };
    // N4a/N4c: a speech contest won counts for the influence skill used, and against a better speaker
    if (contest.winner === 'a' && INFLUENCE().includes(mine.skill)) tally(state, 'speech_won', { by: 'skill', of: mine.skill });
    contestFeat(state, contest);
    markUse(state, p, mine.skill, contest); // SP2: talking to someone near your level marks the skill
    countTry(p, sp, type);
  }
  return { skill: shown.skill, playerTier: shown.tier, impression: impressionWords(type, shown.tier) ?? null, perSpokesperson };
}

/** skills with the Influence function (persuasion, intimidation, barter, lying) */
const INFLUENCE = () => Object.entries(getLibrary().skills).filter(([, k]) => k.functions?.includes(FN.influence)).map(([id]) => id);

export const toContest = (a: RollResult, b: RollResult): ContestResult => {
  const gap = tierLevel(b) - tierLevel(a);
  return { a, b, gap, winner: gap < 0 ? 'a' : gap > 0 ? 'b' : 'tie' };
};

/** OQ-29: the speech types that roll when an NPC aims them at the player; plain talk does not */
export const PUSH_TYPES = ['persuade', 'deceive', 'intimidate', 'barter'];
/** added to a listener's impression when it saw through a lie */
export const TELL = 'something about it does not sit right';
/** LI2a Plain as Day: a lie the listener saw through, said plainly */
export const PLAIN = 'it is a lie';
/** what a listener that saw through a lie is told: the hint, or plainly with Plain as Day */
export const tellFor = (listener: Actor | undefined): string => hasPerk(listener, PK.plain_as_day) ? PLAIN : TELL;

/** a listener's answering roll (answerSkill), against the speaker; All-50 Easy Speaker answers one outcome better;
 * Takes One to Know One (LI1a) answers a lie with the better of Insight and Lying */
export function answerRoll(state: GameState, listener: Actor, skill: string, speakerId: string, rng: Rng): RollResult {
  const knows = skill === SK.insight && hasPerk(listener, PK.takes_one_to_know_one);
  return ruleset.roll({ actorId: listener.id, skill, modifiers: [], tierShifts: hasPerk(listener, PK.easy_speaker) ? [{ source: 'Easy Speaker', value: 1 }] : [], against: speakerId, ...(knows ? { fullValue: [SK.lying] } : {}) }, state, rng);
}

/** OQ-29: an NPC's speech roll at the player; the player answers (answerSkill; the speaker is side a) */
export function pushContest(state: GameState, speaker: Actor, type: string, rng: Rng): ContestResult {
  const skill = SPEECH_SKILL[type] ?? SK.persuasion;
  const p = state.player;
  const contest = toContest(ruleset.roll({ actorId: speaker.id, skill, modifiers: repeatTryMods(speaker, [p.id], type), tierShifts: [], against: p.id }, state, rng), answerRoll(state, p, answerSkill(type), speaker.id, rng));
  countTry(speaker, p.id, type);
  contestFeat(state, contest);
  markUse(state, p, contest.b.skill, contest);
  return contest;
}

/** LI5a Overheard: a lie (`ev`, a speak event) told to someone else, heard by an owner of Overheard (the words or the
 * voice's sound), gets the speaker's Lying against the owner's answer to a lie (answerRoll). `answered` already rolled
 * against it; `lie` is the speaker's roll when it made one, else it rolls once. An owner that wins is listed in
 * ev.overheard and sees through it (tellFor). */
export function overhearLie(state: GameState, ev: GameEvent, answered: string[], rng: Rng, lie?: RollResult): void {
  const speaker = state.actors.find((a) => a.id === ev.actorId);
  if (!speaker) return;
  let roll = lie;
  for (const o of [state.player, ...state.actors.filter((a) => a !== state.player)]) {
    if (o.id === speaker.id || answered.includes(o.id) || !isActive(o) || !hasPerk(o, PK.overheard)) continue;
    const heard = ev.perception?.[o.id];
    if (!hearsWords(heard)) continue;
    roll ??= ruleset.roll({ actorId: speaker.id, skill: SK.lying, modifiers: [], tierShifts: [] }, state, rng);
    const contest = toContest(roll, answerRoll(state, o, SK.insight, speaker.id, rng));
    contestFeat(state, contest);
    markUse(state, o, contest.b.skill, contest);
    if (contest.winner === 'b') (ev.overheard ??= []).push(o.id);
  }
}

/** OQ-29: what a speech contest leaves, whoever spoke (the speaker is side a). A lost intimidation leaves the listener
 * Shaken toward the speaker, a lost persuasion Swayed, by CONFIG.SHAKEN_PER_TIER / SWAYED_PER_TIER × the tier gap; the
 * bigger penalty stands. Barter with a Trader sets prices (PY6). A listener that beats a lie sees through it. */
export function applySpeech(speaker: Actor, listener: Actor, type: string, contest: ContestResult): { status?: 'shaken' | 'swayed'; tell?: true } {
  if (type === 'barter') {
    if (isSeller(listener)) applyHaggle(speaker, listener, contest);
    else if (isSeller(speaker)) applyHaggle(listener, speaker, { a: contest.b, b: contest.a, gap: -contest.gap, winner: contest.winner === 'a' ? 'b' : contest.winner === 'b' ? 'a' : 'tie' });
    return {};
  }
  if (type === 'deceive') return contest.winner === 'b' ? { tell: true } : {};
  const status = type === 'intimidate' ? 'shaken' : type === 'persuade' ? 'swayed' : undefined;
  if (!status || contest.winner !== 'a') return {};
  const value = -contest.gap * (status === 'shaken' ? CONFIG.SHAKEN_PER_TIER : CONFIG.SWAYED_PER_TIER);
  const p = ((listener.pressure ??= {})[speaker.id] ??= {});
  p[status] = Math.max(p[status] ?? 0, value);
  return { status };
}

/** OQ-29: an NPC's speech roll at the player, in words for the Narrator: how it strikes the player (from the speaker's
 * tier), and how the player takes it. A lie the player did not see through gets no hint. */
export function pressedWords(e: GameEvent, listener?: Actor): { how: string; took?: string } | undefined {
  const p = e.push, c = e.contest;
  if (!p || !c) return undefined;
  const took = p.status === 'shaken' ? 'it shakes you' : p.status === 'swayed' ? 'you find yourself swayed'
    : p.tell ? tellFor(listener) : p.type === 'deceive' ? undefined : p.landed ? 'the haggling goes their way' : 'you hold firm';
  return { how: impressionWords(p.type, c.a.tier), ...(took ? { took } : {}) };
}

/** NT10: how the speaker saw the player take its speech roll; nothing when it could not see them */
export function tookWords(e: GameEvent): string | undefined {
  const p = e.push;
  if (!p?.seen) return undefined;
  if (p.type === 'deceive') return p.tell ? 'they seem doubtful' : 'they seem to believe you';
  return p.status === 'shaken' ? 'they look shaken' : p.status === 'swayed' ? 'they seem swayed' : p.landed ? 'they give ground' : 'they seem unmoved';
}
