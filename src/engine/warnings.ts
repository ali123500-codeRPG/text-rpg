// Foes share what they notice (WN1-WN13, Questions hub page "Foes sharing what they notice").
//   WN1 a: only by a warning actually given: a shout (words) or a cry, heard by everyone in range, the trickster included.
//   WN2 a: it carries where the foe is (capped at suspicious, as any told belief) and, for a trick, the fact "it's a
//     trick" (a revealed fact ruse:<trick> on the warner's belief about the trickster, as concealed gear once seen).
//   WN3 a / WN11 a / WN13 a: whoever knows a trick (saw through it, or was warned) answers that trick by that person
//     CONFIG.WARNED_SHIFT tiers better, from then on; a believer that first learns it rolls again at once (turn end), once,
//     however many warn it, and a win takes it off the trick's believers. The memory never changes how a really Down
//     actor is treated: it only helps the roll.
//   WN4 b: about someone hidden, the listener turns suspicious at the spot and its next notice or search roll at that foe
//     is CONFIG.POINTED_SHIFT tiers better (no extra roll; ST4 holds).
//   WN5 a: intelligent beings warn in words (where and tricks); semi-intelligent ones cry (where only); unintelligent never.
//   WN6 a: plain talk, so no time: said beside the turn's action and move. It ends Stealthy (resolve.ts setPosture).
//   WN7 a: words reach whoever hears them clearly; a cry whoever hears it at all.
//   WN8 a: a code-run NPC warns by fight row W1 (FIGHT_RULES, Battle Sense 10) on its own roll only, never on hearsay,
//     once per foe and trick a fight, when an ally that hears it doesn't know yet. Agent-run NPCs share by their lines
//     (any line copies revealed facts, perception updateBeliefs).
//   WN9 a: the player warns its allies the same way (the deck's Warn act sets Order.warn).
//   D-51 b: outside a fight, a code-run companion following the player gives the same warning, once per foe and trick.
import type { Actor, Effect, GameEvent, GameState, Order, RollResult, Rng, TierShift } from '../types';
import { ofOurs } from './belonging';
import { CONFIG } from '../config';
import { INTELLIGENCE, type IntelligenceKey } from '../scales';
import { getLibrary } from '../library';
import { SK } from '../library/skillIds';
import { FX } from '../library/tableIds';
import { actorById, allActors, atLeast, foe, isActive, stance, warm } from './relations';
import { beliefStatus, hears, hearsClearly, hearsWords, updateBeliefs } from '../perception';
import { canSpeak } from '../ruleset/body';
import { markUse, ruleset, toContest } from '../ruleset';
import { contestFeat } from './feats';
import { HIDDEN, RUSE, TRICK, isTrick, knowsTrick, learn, queueLearned, tricksKnown, warnedShift, type Trick } from './ruses';
import { answerRoll, answerSkill } from './speech';
import { bodyLie, rejudgePlayDead } from './playDead';
import { fooledByFeint } from './feint';
import { bluffedBy, drawnTo, spendBluff, undraw } from './perkMarks';
import { rowsOf } from '../views/tactics';
import { placeOf } from './position';

/** WN1: the words a warning is shouted with (the narration tells the rest) */
const WARN_LINE = { trick: "It's a trick!", hidden: 'There! Someone hiding!', foe: 'Over here!' } as const;

/** WN5 a: how a warns: words (intelligent and able to speak), a cry (semi-intelligent), or not at all. No race: a person. */
export function warnVoice(state: GameState, a: Actor): 'words' | 'cry' | null {
  const mind: IntelligenceKey = (a.core.raceId ? getLibrary().races?.[a.core.raceId]?.intelligence : undefined) ?? 'intelligent';
  if (mind === 'intelligent') return canSpeak(state, a) ? 'words' : null;
  return INTELLIGENCE.pos(mind) >= INTELLIGENCE.pos('semi') ? 'cry' : null;
}

/** who takes a's warning in: its allies (same band, or friendly either way for the player, who holds no stances) */
const allyOf = (state: GameState, x: Actor, a: Actor): boolean =>
  x !== a && isActive(x) && !foe(state, x, a) && (ofOurs(state, x, a) || warm(stance(state, x, a)) || (x.kind === 'player' && warm(stance(state, a, x))));

/** WN7 a: x hears a's warning: words clearly, a cry at all */
const reaches = (state: GameState, a: Actor, x: Actor, voice: 'words' | 'cry'): boolean => {
  const at = placeOf(a);
  return voice === 'words' ? hearsClearly(state, at, x, 'loud') : hears(state, x, at, 'loud');
};
/** x does not yet know what a warning about `about` would tell it */
function news(state: GameState, x: Actor, about: Actor, what: string): boolean {
  if (what === HIDDEN) return about.posture === 'stealthy' && !atLeast(beliefStatus(state, x, about), 'aware');
  return isTrick(what) && !knowsTrick(x, about.id, what);
}
const warnKey = (about: string, what: string) => `${about}:${what}`;
const warnedThisFight = (a: Actor, key: string): boolean => {
  const at = a.mind?.warned?.[key];
  return at !== undefined && !!a.engagement && at >= a.engagement.start;
};
/** WN8 a: once per foe and trick a fight; D-51 b: outside a fight (a companion's warning), once per foe and trick */
const warnedBefore = (a: Actor, key: string): boolean => (a.engagement ? warnedThisFight(a, key) : a.mind?.warned?.[key] !== undefined);

/** WN8 a, row W1: a code-run NPC adds a warning to the order its fight list gave, when it has news an ally in earshot lacks.
 * Not while it lies still (a shout would get it up); a cry carries no trick (WN5 a). */
export function codeWarn(state: GameState, a: Actor, o: Order): Order {
  const q = a.mind?.toWarn;
  if (o.warn || !q?.length || a.playingDead || !rowsOf(state, a).includes(FX.warn)) return o;
  const voice = warnVoice(state, a);
  if (!voice) return o;
  for (const w of q) {
    const about = actorById(state, w.about);
    if (!about || !isActive(about) || warnedBefore(a, warnKey(w.about, w.trick)) || (voice === 'cry' && w.trick !== HIDDEN)) continue;
    if (allActors(state).some((x) => allyOf(state, x, a) && reaches(state, a, x, voice) && news(state, x, about, w.trick))) return { ...o, warn: w.about };
  }
  return o;
}

/** the warning's event fields: its words (none for a cry) */
export function warnEvent(state: GameState, a: Actor, aboutId: string): Partial<GameEvent> {
  const about = actorById(state, aboutId);
  if (warnVoice(state, a) !== 'words' || !about) return {};
  const text = about.posture === 'stealthy' ? WARN_LINE.hidden : tricksKnown(a, aboutId).length ? WARN_LINE.trick : WARN_LINE.foe;
  return { line: { text, volume: 'shout' } };
}

/** WN2-WN5, WN7: the warning `ev` (already perceived) reaches a's allies. Returns its effects. */
export function giveWarning(state: GameState, a: Actor, aboutId: string, ev: GameEvent): Effect[] {
  const about = actorById(state, aboutId);
  const voice = warnVoice(state, a);
  if (!about || !voice) return [];
  const tricks = voice === 'words' ? tricksKnown(a, aboutId) : [];
  const hidden = about.posture === 'stealthy';
  const where = a.kind === 'player' ? about.zone : a.mind?.knowledge[aboutId]?.lastKnownZone ?? about.zone;
  const out: Effect[] = [];
  for (const x of allActors(state)) {
    const p = ev.perception[x.id];
    if (x.id === aboutId || !p || !allyOf(state, x, a) || (voice === 'words' ? !hearsWords(p) : false)) continue;
    updateBeliefs(state, { kind: 'told', observerId: x.id, aboutId, status: 'suspicious', zone: where }); // only raises
    // the shout's words may already have passed the tricks on (any line copies revealed facts: perception updateBeliefs)
    for (const t of tricks) if (learn(state, x, aboutId, t)) queueLearned(state, x.id, aboutId, RUSE + t);
    const learned = tricks;
    const pointed = hidden && !atLeast(beliefStatus(state, x, about), 'aware');
    if (pointed) {
      if (x.kind === 'player') ((x.journal ??= {} as NonNullable<Actor['journal']>).pointed ??= {})[aboutId] = state.turn;
      else if (x.mind) (x.mind.pointed ??= {})[aboutId] = state.turn;
    }
    out.push({ kind: 'warned', actorId: x.id, data: { by: a.id, about: aboutId, ...(learned.length ? { tricks: learned } : {}), ...(pointed ? { pointed: true } : {}) } });
  }
  if (a.mind) { // given: not again this fight, and off its list
    for (const what of [...tricks, ...(hidden ? [HIDDEN] : [])]) (a.mind.warned ??= {})[warnKey(aboutId, what)] = state.turn;
    a.mind.toWarn = (a.mind.toWarn ?? []).filter((w) => w.about !== aboutId || !(tricks as string[]).concat(hidden ? [HIDDEN] : []).includes(w.trick));
    if (!a.mind.toWarn.length) delete a.mind.toWarn;
  }
  return out;
}

/** WN3 a / WN13 a: at turn end, each believer that learned a trick this turn rolls again at it, knowing it (WARNED_SHIFT);
 * a win takes it off that trick's believers. One roll per believer and trick, however many warned it. */
export function warnedChecks(state: GameState, rng: Rng): { x: Actor; owner: Actor; effect: Effect }[] {
  const q = (state.scratch?.rusesLearned ?? []) as { x: string; owner: string; t: Trick }[];
  if (state.scratch) delete state.scratch.rusesLearned;
  const out: { x: Actor; owner: Actor; effect: Effect }[] = [];
  for (const { x: xi, owner: oi, t } of q) {
    const x = actorById(state, xi), owner = actorById(state, oi);
    if (!x || !owner || !isActive(x) || !isActive(owner)) continue;
    const effect = recheck(state, owner, x, t, rng);
    if (effect) out.push({ x, owner, effect });
  }
  return out;
}

function recheck(state: GameState, owner: Actor, x: Actor, t: Trick, rng: Rng): Effect | null {
  if (t === TRICK.play_dead) return owner.playingDead?.believers.includes(x.id) ? rejudgePlayDead(state, owner, x, rng) : null;
  if (t === TRICK.feint) {
    if (!fooledByFeint(state, x, owner) || bodyLie(state, owner, x, rng, TRICK.feint, false)) return null;
    owner.feint!.believers = owner.feint!.believers.filter((id) => id !== x.id);
    return { kind: 'feint_seen_through', actorId: x.id, data: { by: owner.id } };
  }
  // the second look, as the first was rolled: Bluff is Falsehood against the answer to a lie, Draw Them In Stratagem against Insight
  const seen = (skill: string, theirs: RollResult): boolean => {
    const c = toContest(ruleset.roll({ actorId: owner.id, skill, modifiers: [], tierShifts: [], against: x.id, contest: true }, state, rng), theirs);
    markUse(state, owner, c.a.skill, c);
    contestFeat(state, c);
    markUse(state, x, c.b.skill, c);
    return c.winner === 'b';
  };
  if (t === TRICK.bluff) {
    if (!bluffedBy(state, x, owner.id) || !seen(SK.falsehood, answerRoll(state, x, answerSkill('deceive'), owner.id, rng, warnedShift(x, owner.id, t)))) return null;
    spendBluff(x);
    return { kind: 'bluff_seen_through', actorId: x.id, data: { by: owner.id } };
  }
  if (drawnTo(state, x) !== owner.id) return null;
  const insight = ruleset.roll({ actorId: x.id, skill: SK.insight, modifiers: [], tierShifts: warnedShift(x, owner.id, t), against: owner.id, contest: true }, state, rng);
  if (!seen(SK.stratagem, insight)) return null;
  undraw(owner, x);
  return { kind: 'draw_seen_through', actorId: x.id, data: { by: owner.id } };
}

/** WN9 a: the foes the player can warn its allies about now (the deck's Warn act, the Parser's warn): a trick it knows,
 * or someone hidden it sees, that an ally hearing its shout doesn't know yet */
export function warnableOf(state: GameState, p: Actor): { id: string; why: 'trick' | 'hidden' }[] {
  if (warnVoice(state, p) !== 'words') return [];
  const allies = allActors(state).filter((x) => allyOf(state, x, p) && reaches(state, p, x, 'words'));
  const out: { id: string; why: 'trick' | 'hidden' }[] = [];
  for (const f of allActors(state)) {
    if (f === p || !isActive(f) || !(foe(state, p, f) || foe(state, f, p))) continue;
    const t = tricksKnown(p, f.id).find((k) => allies.some((x) => news(state, x, f, k)));
    if (t) out.push({ id: f.id, why: 'trick' });
    else if (atLeast(beliefStatus(state, p, f), 'aware') && allies.some((x) => news(state, x, f, HIDDEN))) out.push({ id: f.id, why: 'hidden' });
  }
  return out;
}
