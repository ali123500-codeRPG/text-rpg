// W3 — Perception per event, the single belief writer, communication events, belief decay.
import type { Actor, Belief, BeliefStatus, CheckResult, ContestResult, AttackResult, Cue, GameEvent, GameState, Perception, Rng } from '../types';
import { SPEECH_ACTIONS } from '../types';
import { CONFIG } from '../config';
import { AWARENESS, GRADE_LEVELS, HIT_OUTCOMES, NOISE, type GradeLevel, type NoiseKey } from '../scales';
import { hearingOf, soundDb, VOLUME_NOISE } from './noise';
import { seeingM, type Located } from '../engine/position';
import { sightLevel } from './sight';
export { hearingOf, openAirReachM, soundDb } from './noise';
import { now, turnTime, zoneLight } from '../time';
import { actorById, allActors, atLeast, isActive, isAsleep, zoneById } from '../engine/relations';
import { getLibrary, itemDef, resolveAlias } from '../library';
import { hasPerk, perkSum } from '../ruleset/perks';
import { PK } from '../library/perkIds';

export type BeliefUpdate =
  | { kind: 'event'; event: GameEvent; result?: CheckResult | ContestResult | AttackResult }
  | { kind: 'detection'; observerId: string; aboutId: string; status: BeliefStatus; event: GameEvent }
  | { kind: 'opening'; observerId: string; aboutId: string; status: BeliefStatus; zone?: string; source?: 'seen' | 'heard' | 'told' }
  | { kind: 'reveal'; observerId: string; aboutId: string; fact: string }
  | { kind: 'lost'; observerId: string; aboutId: string; zone?: string }
  | { kind: 'told'; observerId: string; aboutId: string; status: BeliefStatus; zone?: string }; // an ally passes it on (All-50 Spotter); only raises

/** communication events copy the sender's beliefs (Information model); barks never do */
export const isComm = (e: GameEvent) =>
  !e.bark && (['call_help', 'alarm', 'report'].includes(e.kind) || (['speak', 'talk'].includes(e.kind) && !!e.line));

type Seen = { level: Perception; cue: Cue; heard?: true };
/** BG-59: a bark is a line said beside a deed. Only a bark that is nothing but words is left out of NPC views and history;
 * a deed with a bark (a give, an attack) still counts, its line dropped (eventView) */
export const barkOnly = (e: { bark?: boolean; kind: string }): boolean => !!e.bark && ['speak', 'talk'].includes(e.kind);
/** the words of a line reach only those its sound reaches: seeing someone talk across a field gives no words */
export const hearsWords = (p: { heard?: true } | undefined): boolean => !!p?.heard;
const better = (a: Seen | null, b: Seen | null): Seen | null => (!a ? b : !b ? a : b.level === 'full' && a.level !== 'full' ? b : a);

// Each VISIBILITY level is seen out to its metres (CONFIG.SIGHT_M) measured with sight from where the event happened
// (seeingM); a sound is heard by its decibels where the listener stands against the hearing floor (hearingOf). Dark zone: sight at most partial.
// Sound heard only partly gives something, not who (test 4).
// The event is perceived at its own zone (a move: the destination zone).
/** NS2: how many metres a figure keeping still is made out clearly (the Low visibility level's clear metres) */
const stillSeen = (): number => CONFIG.SIGHT_M.low![0];
/** BG-164: the player would make out someone standing still at this spot now (awake, in sight, not in the dark): an empty
 * spot there is seen to be empty */
export function spotInSight(state: GameState, at: Located): boolean {
  const p = state.player, d = isActive(p) && !isAsleep(p) ? seeingM(state, p, at) : null;
  return d !== null && d <= stillSeen() && zoneLight(state, zoneById(state, at.zone)) !== 'dark';
}
/** Q17: a careful look makes out a still figure as far as a moving one is (the Normal visibility level's clear metres) */
const lookReach = (): number => CONFIG.SIGHT_M.normal![0];

/** how well a sound of this noise made there reaches the observer (null: not heard). Perks with hearingDb (A14 Keen Ear)
 * make every sound that many dB louder for the owner (RD4). */
function soundReach(state: GameState, observer: Actor, at: Located, noise: GameEvent['noise'], leanIn = false): Perception | null {
  return hearingOf(state, noise, at, observer, perkSum(observer, 'hearingDb'), leanIn);
}

/** BG-88: `listener` hears words said at this noise from `from` clearly (who and what): the same reach as perception, with
 * the listener's hearing perks (Keen Ear), and a whisper said to them leaning in (HB8). One rule for orders, stepping up
 * to speak and who answers. */
export function hearsClearly(state: GameState, from: Located, listener: Actor, noise: GameEvent['noise']): boolean {
  return !isAsleep(listener) && soundReach(state, listener, from, noise, noise === 'hushed') === 'full';
}

/** BF3: a whisper to someone it does not reach is said low instead: the quietest sound from a whisper up to normal
 * speech that the listener hears clearly from where it is said (normal speech when none does) */
export function carryingNoise(state: GameState, from: Located, listener: Actor): NoiseKey {
  for (let i = NOISE.pos(VOLUME_NOISE.whisper); i <= NOISE.pos(VOLUME_NOISE.normal); i++) if (hearsClearly(state, from, listener, NOISE.keys[i])) return NOISE.keys[i];
  return VOLUME_NOISE.normal;
}

/** C1 Never Surprised: the owner can hear a sound of this noise made there (a person or a point), stealth aside */
export function hears(state: GameState, observer: Actor, at: Located, noise: GameEvent['noise']): boolean {
  return !isAsleep(observer) && soundCarries(state, observer, at, noise);
}
/** NW18: a sound of this noise made there reaches the observer's ears, awake or asleep (what wakes a sleeper) */
export function soundCarries(state: GameState, observer: Actor, at: Located, noise: GameEvent['noise']): boolean {
  return isActive(observer) && soundReach(state, observer, at, noise) !== null;
}

/** what `observer` makes out by sight of something of this visibility at a point: by metres and walls (seeingM, the sight
 * table), and at most partial in a dark zone. One rule for events, filching and anything else seen. */
export function sightAt(state: GameState, observer: Actor, at: Located, visibility: GameEvent['visibility']): 'full' | 'partial' | null {
  const sl = sightLevel(visibility, seeingM(state, observer, at));
  return sl && (zoneLight(state, zoneById(state, at.zone)) === 'dark' ? 'partial' : sl);
}

/** BG-89: event kinds that touch their target */
const CONTACT = new Set(['attack', 'give', 'break_free', 'restrain']);

/** the event carries words (speech, a line said) */
export const hasWords = (event: GameEvent): boolean => event.kind === 'speak' || (SPEECH_ACTIONS as readonly string[]).includes(event.kind) || !!event.speech || !!event.line;
/** HB8: a whisper said to this observer (its target or one it was addressed to) is said leaning in */
const leansIn = (event: GameEvent, observer: Actor): boolean =>
  event.noise === 'hushed' && hasWords(event) && (event.target === observer.id || !!event.speech?.addressees.includes(observer.id) || event.line?.to === observer.id);

/** PG4 a: how hard it is for `observer` to make out an event it only half perceives by this sense, as a task grade, or
 * null when that sense gets nothing of it. Sight: how far past the visibility's clear range it is, as a share of the way to
 * its glimpse range (MAKE_OUT_SIGHT_GRADES), MAKE_OUT_DARK_STEPS harder in the dark (Night Eyes cancels it); the easier of
 * where it happened and where a leg set off (BG-23). Sound: the decibels it reaches above the hearing floor
 * (MAKE_OUT_SOUND_GRADES). */
export function faintness(state: GameState, event: GameEvent, observer: Actor, cue: 'sight' | 'sound'): GradeLevel | null {
  const pick = (rows: [number, GradeLevel][], ok: (n: number) => boolean) => rows.find(([n]) => ok(n))?.[1] ?? rows.at(-1)![1];
  if (cue === 'sound') {
    const db = soundDb(state, event.noise, { zone: event.zone, pos: event.pos }, observer, perkSum(observer, 'hearingDb'), leansIn(event, observer));
    const above = db === null ? null : db - CONFIG.HEARING_FLOOR_DB;
    return above === null || above < 0 ? null : pick(CONFIG.MAKE_OUT_SOUND_GRADES, (n) => above >= n);
  }
  const band = CONFIG.SIGHT_M[event.visibility];
  const at = (p: Located): number | null => {
    const m = seeingM(state, observer, p);
    if (!band || m === null || m > band[1]) return null;
    const share = Math.max(0, (m - band[0]) / (band[1] - band[0]));
    const dark = zoneLight(state, zoneById(state, p.zone)) === 'dark' && !hasPerk(observer, PK.night_eyes);
    const g = GRADE_LEVELS.pos(pick(CONFIG.MAKE_OUT_SIGHT_GRADES, (n) => share <= n)) + (dark ? CONFIG.MAKE_OUT_DARK_STEPS : 0);
    return Math.min(g, GRADE_LEVELS.keys.length - 1);
  };
  const ps = [at({ zone: event.zone, pos: event.pos }), event.fromZone ? at({ zone: event.fromZone, pos: event.fromPos }) : null].filter((g): g is number => g !== null);
  return ps.length ? GRADE_LEVELS.at(Math.min(...ps)) : null;
}

/** raw perception of an event by one observer, ignoring the unaware-of-player rule (detectPlayer uses this). */
export function perceptionOf(event: GameEvent, state: GameState, observer: Actor): Seen | null {
  if (!isActive(observer)) return null;
  if (observer.id === event.actorId) return { level: 'full', cue: 'sight' };
  // NW12/NW20: a sleeper perceives nothing; a blow on it is felt (and wakes it, src/engine/sleep.ts)
  if (isAsleep(observer)) return event.target === observer.id && CONTACT.has(event.kind) ? { level: 'partial', cue: 'touch' } : null;
  const at = { zone: event.zone, pos: event.pos };
  /** what is seen of it at one point: step 2, metres from where it happened, half seen in the dark */
  const seenAt = (p: { zone: string; pos?: { x: number; y: number } }): Seen | null => {
    const level = sightAt(state, observer, p, event.visibility);
    return level ? { level, cue: 'sight' } : null;
  };
  let sight = seenAt(at);
  // BG-23: a leg out of a zone is seen where it set off as well as where it ended (someone walking out through a door
  // in plain sight is seen going, though the room beyond is out of sight)
  if (event.fromZone) sight = better(sight, seenAt({ zone: event.fromZone, pos: event.fromPos }));
  // Q17: someone the player saw clearly stays seen while they stay put (within the zones the player can see)
  if (observer.kind === 'player' && event.kind !== 'move' && event.kind !== 'flee' && observer.journal?.clearSight?.[event.actorId] === event.zone) {
    const d = seeingM(state, observer, at);
    if (d !== null && d <= lookReach()) sight = { level: 'full', cue: 'sight' };
  }
  const nl = soundReach(state, observer, at, event.noise, leansIn(event, observer));
  const sound: Seen | null = nl ? { level: nl, cue: 'sound' } : null;
  let best = better(sight, sound);
  // Perception All-150 Every Sense One: what the owner hears it sees, and what it sees it hears. The better sense sets the
  // level for both: a full perception shows everything (read as sight), a partial one is heard too (its words come through)
  const oneSense = !!best && hasPerk(observer, PK.one_sense);
  if (best && oneSense) best = { level: best.level, cue: best.level === 'full' ? 'sight' : 'sound' };
  // the target of a blow, a hand-over or a grip broken always feels it (at least partial, touch), e.g. a missile from an
  // unseen zone. BG-72/BG-89: only contact is felt; words, a walk toward them, a trade or a wasted action reach them only by
  // sound or sight
  // BG-251: a shot or throw is felt only when it meets them (a shield or the body); a miss reaches them by its impact
  const felt = !event.ranged || !event.attack || HIT_OUTCOMES.pos(event.attack.outcome) >= HIT_OUTCOMES.pos('blocked');
  if (event.target === observer.id && CONTACT.has(event.kind) && felt) best = better(best, { level: 'partial', cue: 'touch' });
  // words need the sound heard clearly (CLEAR_ABOVE_FLOOR_DB over the hearing floor: who and what; a sound heard only partly is a voice without its
  // words), or Every Sense One
  return best && (sound?.level === 'full' || oneSense) ? { ...best, heard: true } : best;
}

/** Q17: the player's clear sightings. A full sight of an actor records its zone; a move the player did not see clearly forgets it.
 * NS2: a stealthy actor's move the player does not perceive at all loses it: aware drops to suspicious. */
export function noteSightings(event: GameEvent, state: GameState): void {
  const p = state.player;
  if (!p.journal || event.actorId === p.id) return;
  const per = event.perception[p.id];
  const cs = (p.journal.clearSight ??= {});
  if (per) (p.journal.lastKnown ??= {})[event.actorId] = event.zone; // BG-28: seen or heard, the last place known
  if (per) { const ls = (p.journal.lastSpot ??= {}); if (event.pos) ls[event.actorId] = { ...event.pos }; else delete ls[event.actorId]; } // BG-125
  if (per?.level === 'full' && per.cue === 'sight') cs[event.actorId] = event.zone;
  else if (event.kind === 'move' || event.kind === 'flee') delete cs[event.actorId];
  if (!per && (event.kind === 'move' || event.kind === 'flee') && actorById(state, event.actorId)?.posture === 'stealthy') updateBeliefs(state, { kind: 'lost', observerId: p.id, aboutId: event.actorId });
}

/** NS2–NS4: what `o` believes about `about`. NPCs read their knowledge; the player simply sees open actors and
 * keeps a belief (journal.stealthSeen) only about stealthy ones. */
export function beliefStatus(_state: GameState, o: Actor, about: Actor): BeliefStatus {
  if (o.kind !== 'player') return o.mind?.knowledge[about.id]?.status ?? 'unaware';
  // an entry outlives the posture until stealthEnd (a melee blow from stealth is resolved as an ambush first)
  return o.journal?.stealthSeen?.[about.id] ?? (about.posture === 'stealthy' ? 'unaware' : 'aware');
}

/** NS2: an actor turning stealthy shakes off no one who sees it (ST12). The player keeps it as far as they see it now:
 * as far as a still figure is made out (stillSeen), half seen in the dark. NPC observers keep their knowledge as it is. */
export function stealthStart(state: GameState, a: Actor): void {
  const p = state.player;
  if (!p.journal || a.id === p.id) return;
  const d = isActive(p) ? seeingM(state, p, a) : null;
  const status: BeliefStatus = d === null || d > stillSeen() ? 'unaware' : zoneLight(state, zoneById(state, a.zone)) === 'dark' ? 'suspicious' : 'aware';
  (p.journal.stealthSeen ??= {})[a.id] = status;
}
/** NS2: an actor turning open is simply seen again */
export function stealthEnd(state: GameState, a: Actor): void {
  delete state.player.journal?.stealthSeen?.[a.id];
}

/** Q17: is this a notice skill read by sight or sound (sight, hearing) */
export function noticeCue(skill: string): 'sight' | 'sound' | undefined {
  return getLibrary().skills[resolveAlias(skill)]?.cue;
}

/** Q17: a successful look shows everyone in the player's zone and in sight of it, out to lookReach, clearly. */
export function lookAround(state: GameState): string[] {
  const p = state.player;
  if (!p.journal) return [];
  const cs = (p.journal.clearSight ??= {});
  const shown: string[] = [];
  for (const a of allActors(state)) {
    if (a.id === p.id) continue;
    const d = seeingM(state, p, a);
    if (d !== null && d <= lookReach()) { cs[a.id] = a.zone; (p.journal.lastKnown ??= {})[a.id] = a.zone; if (a.pos) (p.journal.lastSpot ??= {})[a.id] = { ...a.pos }; shown.push(a.id); }
  }
  return shown;
}

/** who perceives `event`, at the moment it happens (level and cue). The player's own events reach observers unaware of the player only through detection. */
export function computePerception(event: GameEvent, state: GameState, _rng: Rng): GameEvent['perception'] {
  const out: GameEvent['perception'] = {};
  const s = actorById(state, event.actorId);
  for (const a of allActors(state)) {
    // the player's events reach only those who already know of them; while stealthy, only those who see them (ST4)
    const min = state.player.posture === 'stealthy' ? 'aware' : 'suspicious';
    if (event.actorId === state.player.id && a.id !== state.player.id && !atLeast(a.mind?.knowledge[state.player.id]?.status, min)) continue;
    // NS2: a stealthy NPC's events reach only its band and those who see it
    if (s && s.kind !== 'player' && s.posture === 'stealthy' && a.id !== s.id && a.bandId !== s.bandId && !atLeast(beliefStatus(state, a, s), 'aware')) continue;
    const p = perceptionOf(event, state, a);
    if (p) out[a.id] = p;
  }
  return out;
}

const raise = (cur: BeliefStatus | undefined, to: BeliefStatus): BeliefStatus =>
  AWARENESS.pos(to) > AWARENESS.pos(cur ?? 'unaware') ? to : (cur ?? 'unaware');

function write(observer: Actor, aboutId: string, b: Partial<Belief>): Belief | undefined {
  if (!observer.mind || aboutId === observer.id) return undefined;
  const cur = observer.mind.knowledge[aboutId];
  const next: Belief = { ...(cur ?? { status: 'unaware', source: 'seen' }), ...b, revealed: [...(cur?.revealed ?? []), ...(b.revealed ?? [])].filter((x, i, arr) => arr.indexOf(x) === i) };
  observer.mind.knowledge[aboutId] = next;
  return next;
}

/** the ONLY writer of Belief. */
export function updateBeliefs(state: GameState, update: BeliefUpdate): void {
  if (update.kind === 'opening') {
    const o = actorById(state, update.observerId);
    if (o) write(o, update.aboutId, { status: update.status, source: update.source ?? 'seen', lastKnownZone: update.zone, lastSeenTurn: state.turn });
    return;
  }
  if (update.kind === 'reveal') {
    const o = actorById(state, update.observerId);
    if (o) write(o, update.aboutId, { revealed: [update.fact] });
    return;
  }
  const ss = (o: Actor | undefined) => (o?.kind === 'player' && o.journal ? (o.journal.stealthSeen ??= {}) : undefined);
  if (update.kind === 'lost') {
    // ST15: someone who saw you loses you when you vanish from them: suspicious, at the zone they last saw you in
    const o = actorById(state, update.observerId);
    const seen = ss(o); // NS2: the player loses a stealthy NPC the same way
    if (seen) { if (atLeast(seen[update.aboutId], 'aware')) seen[update.aboutId] = 'suspicious'; return; }
    if (o && atLeast(o.mind?.knowledge[update.aboutId]?.status, 'aware')) write(o, update.aboutId, { status: 'suspicious', ...(update.zone ? { lastKnownZone: update.zone } : {}) });
    return;
  }
  if (update.kind === 'told') {
    const o = actorById(state, update.observerId);
    if (!o || update.status === 'unaware') return;
    const seen = ss(o);
    if (seen) { seen[update.aboutId] = raise(seen[update.aboutId], update.status); return; }
    write(o, update.aboutId, { status: raise(o.mind?.knowledge[update.aboutId]?.status, update.status), ...(update.zone ? { lastKnownZone: update.zone } : {}), source: 'told' });
    return;
  }
  if (update.kind === 'detection') {
    const o = actorById(state, update.observerId);
    if (!o || update.status === 'unaware') return;
    const seen = ss(o);
    if (seen) { seen[update.aboutId] = raise(seen[update.aboutId], update.status); return; }
    const cue = perceptionOf(update.event, state, o)?.cue;
    write(o, update.aboutId, {
      status: raise(o.mind?.knowledge[update.aboutId]?.status, update.status),
      lastKnownZone: update.event.zone, lastSeenTurn: update.event.turn, source: cue === 'sound' ? 'heard' : 'seen',
    });
    return;
  }
  const e = update.event;
  if (e.bark) return; // a bark copies nothing and never enters an NPC's knowledge
  const sender = actorById(state, e.actorId);
  for (const [obsId, p] of Object.entries(e.perception)) {
    const o = actorById(state, obsId);
    if (!o || o.id === e.actorId) continue;
    // names heard in a line are learned by learnNames (engine, BG-95)
    if (!o.mind || !sender) continue;
    const cur = o.mind.knowledge[e.actorId]?.status;
    write(o, e.actorId, {
      status: raise(cur, p.level === 'full' ? (atLeast(cur, 'aware') ? 'tracking' : 'aware') : 'suspicious'), // hunting and engaged stay (YD6)
      lastKnownZone: e.zone, lastSeenTurn: e.turn, source: p.cue === 'sound' ? 'heard' : 'seen',
    });
    if (e.kind === 'attack' && e.target) {
      const target = actorById(state, e.target);
      if (target && !e.spar && (target.id === o.id || target.bandId === o.bandId)) (o.mind.overrides ??= {})[e.actorId] = 'hostile'; // SP1: not a sparring blow
      const inst = e.attack?.weaponId ?? e.itemId;
      const item = inst ? sender.core.inventory.find((i) => i.id === inst) : undefined;
      if (p.level === 'full' && item && itemDef(state, item.itemId).concealed) write(o, e.actorId, { revealed: [`item:${item.id}`] });
    }
    if (isComm(e) && sender.mind && hearsWords(p)) {
      for (const [about, sb] of Object.entries(sender.mind.knowledge)) {
        if (about === o.id || sb.status === 'unaware') continue;
        const mine = o.mind.knowledge[about];
        if (atLeast(mine?.status, 'aware')) continue; // own sight beats hearsay
        write(o, about, {
          status: raise(mine?.status, 'suspicious'), // told is capped at suspicious
          source: 'told', lastKnownZone: sb.lastKnownZone, lastSeenTurn: sb.lastSeenTurn, revealed: sb.revealed,
        });
      }
    }
  }
}

/** AT73/AT80/AT85: with no new sight or sound, a belief steps down one level after its level's wait: DECAY_TRACKING_S
 * (tracking, left by a lost chase or a quiet fight), DECAY_AWARE_S (aware) or DECAY_SUSPICIOUS_S (suspicious), each step
 * counted from the one before; any new sign (lastSeenTurn) restarts it. Only the alertness fades: what it learned stays.
 * Hunting and engaged are noteFighting's. */
const DECAY_S = { tracking: () => CONFIG.DECAY_TRACKING_S, aware: () => CONFIG.DECAY_AWARE_S, suspicious: () => CONFIG.DECAY_SUSPICIOUS_S };
export function applyBeliefDecay(state: GameState): void {
  for (const a of allActors(state)) {
    for (const b of Object.values(a.mind?.knowledge ?? {})) {
      if (b.lastSeenTurn === undefined || b.status === 'unaware' || atLeast(b.status, 'hunting')) continue; // YD6: noteFighting drops those
      let from = Math.max(turnTime(state, b.lastSeenTurn), b.fadedAt ?? -Infinity);
      for (;;) {
        if (b.status === 'unaware') break;
        const wait = DECAY_S[b.status as keyof typeof DECAY_S]() / 60;
        if (now(state) - from < wait) break;
        from += wait;
        b.status = AWARENESS.at(AWARENESS.pos(b.status) - 1);
        b.fadedAt = from;
      }
    }
  }
}
