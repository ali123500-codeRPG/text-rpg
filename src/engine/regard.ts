// D-206 (BN1–BN5): the regard score under a personal stance. An override (Mind.overrides) names the step; Mind.regard
// keeps where in that step it sits, on a score from −100 to +100 whose steps are bands (CONFIG.REGARD_EDGES). A stance set
// whole (a cast, an attack) sits at its step's middle; one step said or done moves the score CONFIG.REGARD_STEP, scaled by
// Attachment. A grudge (colder than the band's stance) fades back after a pause, at a rate set by Forgivingness; bonds
// never fade. The step is what code acts on; the strength word (slight, plain, strong) goes to the agents and the Insight read.
import type { Actor, GameState, Regard, Stance } from '../types';
import { CONFIG } from '../config';
import { REGARD_STRENGTH, STANCES, type RegardStrength, type StanceKey } from '../scales';
import { PA } from '../library/tableIds';
import { personalityOf } from '../ruleset/personality';
import { DAY_MINUTES, now } from '../time';
import { actorById, baseStance } from './relations';

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
/** a personality trait, held to −100…+100 so perks past it never flip a factor */
const trait = (a: Actor, id: string): number => clamp(personalityOf(a).traits[id] ?? 0, -100, 100);

/** the step a regard score falls in: one step warmer per edge it is past (a score on an edge counts toward neutral) */
export function stepOfRegard(v: number): StanceKey {
  const n = CONFIG.REGARD_EDGES.filter((e) => (e < 0 ? v >= e : v > e)).length;
  return STANCES.at(n);
}
/** the middle of a step on the score; yielded (off the scale) reads as opposed, as a stance step does from it */
export const midOf = (s: Stance): number => CONFIG.REGARD_MID[s === 'yielded' ? 'opposed' : s];

/** the score a fades back to toward `id`: its band's stance's middle */
function baseRegard(state: GameState, a: Actor, id: string): number | undefined {
  const b = actorById(state, id);
  return b ? midOf(baseStance(state, a, b)) : undefined;
}

/** BN2 a, BN4 a: r's score now: a grudge fades GRUDGE_FADE a day × (1 + F / FORGIVENESS_DIVISOR) once FADE_PAUSE_DAYS
 * pass after the last move, back to the band's stance, or no warmer than ATTACK_GRUDGE_FLOOR's middle for an attack */
function fadedScore(state: GameState, a: Actor, id: string, r: Regard): number {
  const base = baseRegard(state, a, id);
  if (base === undefined || r.v >= base) return r.v; // a bond, or nothing to fade toward
  const top = r.attacked ? Math.min(base, CONFIG.REGARD_MID[CONFIG.ATTACK_GRUDGE_FLOOR]) : base;
  if (r.v >= top) return r.v;
  const days = (now(state) - r.at) / DAY_MINUTES - CONFIG.FADE_PAUSE_DAYS;
  const rate = CONFIG.GRUDGE_FADE * Math.max(0, 1 + trait(a, PA.forgivingness) / CONFIG.FORGIVENESS_DIVISOR);
  return days > 0 ? Math.min(top, r.v + rate * days) : r.v;
}

/** a's score toward `id` under its own stance: the kept score, faded, while it was kept for that same step, else the step's
 * middle (a stance another writer set whole); none with no override, or yielded */
export function regardOf(state: GameState, a: Actor, id: string): number | undefined {
  const s = a.mind?.overrides?.[id];
  if (!s || s === 'yielded') return undefined;
  const r = a.mind!.regard?.[id];
  return r?.step === s ? fadedScore(state, a, id, r) : midOf(s);
}

/** BN5 a: how deep a's own stance toward `id` sits in its step, by thirds from the side nearer neutral; none for neutral or
 * a stance that is only its band's */
export function strengthOf(state: GameState, a: Actor, id: string): RegardStrength | undefined {
  const v = regardOf(state, a, id);
  if (v === undefined) return undefined;
  const k = STANCES.pos(stepOfRegard(v)), mid = STANCES.pos('neutral');
  if (k === mid) return undefined;
  const e = CONFIG.REGARD_EDGES, inner = k > mid ? e[k - 1] : e[k], outer = k > mid ? (e[k] ?? 100) : (e[k - 1] ?? -100);
  const third = Math.min(2, Math.floor((3 * Math.abs(v - inner)) / Math.abs(outer - inner)));
  return REGARD_STRENGTH.at(third);
}

/** writes a's score toward `id` and the step it falls in (both kept in step); the override goes once the score is back at
 * the band's stance's middle, so the stance follows the band again */
function keep(state: GameState, a: Actor, id: string, r: Regard): void {
  const m = a.mind!;
  if (r.v === baseRegard(state, a, id) && !r.attacked) {
    if (m.overrides) delete m.overrides[id];
    if (m.regard) delete m.regard[id];
    return;
  }
  m.overrides = { ...(m.overrides ?? {}), [id]: r.step };
  m.regard = { ...(m.regard ?? {}), [id]: r };
}

/** BN1 a, BN3 a: one stance step from a toward `other` (said by an agent or done by a deed). The score moves REGARD_STEP:
 * friendlier × (1 + A / ATTACHMENT_DIVISOR), colder on a friendly or warmer stance × (1 − A / ATTACHMENT_DIVISOR). A yielded
 * actor moves from opposed's middle (Q1). Warmed to the attack floor or past it, an attack's grudge is let go */
export function moveRegard(state: GameState, a: Actor, other: Actor, step: 'friendlier' | 'colder'): void {
  if (!a.mind) return;
  const v = regardOf(state, a, other.id) ?? midOf(a.mind.overrides?.[other.id] ?? baseStance(state, a, other));
  const att = trait(a, PA.attachment) / CONFIG.ATTACHMENT_DIVISOR;
  const warm = STANCES.pos(stepOfRegard(v)) >= STANCES.pos('friendly');
  const size = CONFIG.REGARD_STEP * (step === 'friendlier' ? 1 + att : warm ? 1 - att : 1);
  const next = clamp(v + (step === 'friendlier' ? size : -size), -100, 100);
  const attacked = a.mind.regard?.[other.id]?.attacked && next < CONFIG.REGARD_MID[CONFIG.ATTACK_GRUDGE_FLOOR];
  keep(state, a, other.id, { v: next, at: now(state), step: stepOfRegard(next), ...(attacked ? { attacked: true as const } : {}) });
}

/** a stance set whole by code (an attack): the step's middle, the clock started now. attacked: an attack on a itself (BN2 a) */
export function setStanceWhole(state: GameState, a: Actor, id: string, s: StanceKey, attacked?: boolean): void {
  if (!a.mind) return;
  a.mind.overrides = { ...(a.mind.overrides ?? {}), [id]: s };
  a.mind.regard = { ...(a.mind.regard ?? {}), [id]: { v: CONFIG.REGARD_MID[s], at: now(state), step: s, ...(attacked ? { attacked: true as const } : {}) } };
}

/** BN2 a: at each turn's end every personal stance takes its faded score's step. An override another writer set whole (a
 * cast, a yield turned opposed) starts its clock now at its step's middle, so its grudge fades from here. A grudge faded
 * back to the band's stance is gone */
export function fadeStances(state: GameState): void {
  for (const a of state.actors) {
    const m = a.mind;
    if (!m?.overrides) continue;
    for (const [id, s] of Object.entries(m.overrides)) {
      if (s === 'yielded') continue;
      const r = m.regard?.[id];
      if (r?.step !== s) { // set whole by another writer (a cast; a yield's opposed at a scenario's end keeps its attack)
        const attacked = r?.attacked && midOf(s) < CONFIG.REGARD_MID[CONFIG.ATTACK_GRUDGE_FLOOR];
        m.regard = { ...(m.regard ?? {}), [id]: { v: midOf(s), at: now(state), step: s, ...(attacked ? { attacked: true as const } : {}) } };
        continue;
      }
      const v = fadedScore(state, a, id, r);
      if (v === r.v) continue;
      if (v === baseRegard(state, a, id)) { delete m.overrides[id]; delete m.regard![id]; continue; }
      if (stepOfRegard(v) !== s) m.overrides[id] = r.step = stepOfRegard(v);
    }
  }
}
