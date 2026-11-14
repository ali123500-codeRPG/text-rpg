// The coming-near check (AT67, AT68): while time runs on in a stretch (a rest, a wait, a long turn), what makes it stop and
// give the watcher the turn. Run on what the watcher perceives now, about people outside its band, never on hostility.
import type { Actor, GameEvent, GameState } from '../types';
import { CONFIG } from '../config';
import { NOISE, type BodyPoseKey } from '../scales';
import { itemDef } from '../library';
import { isHeld } from '../ruleset/gear';
import { allActors, atLeast, isActive, isAsleep } from './relations';
import { perceivesNow } from './yield';
import { distOrNull, type Located } from './position';
import { moveSpeed } from './speed';

/** what the watcher noted about someone it accepted: a change from this fires the check again */
type Seen = { sneaking: boolean; closing: boolean; armed: number };
/** a stretch's watch: the watcher's pose, and everyone it accepted (perceived at the start, or carried on past) */
export type NearWatch = { watcher: string; pose: BodyPoseKey; accepted: Map<string, Seen> };
/** why the check fired, and who fired it */
export type NearStop = { why: 'contact' | 'closing' | 'change' | 'appeared'; by: string[] };

/** AT67: seconds the watcher needs to see it coming and get ready: READY_S for its pose + DECIDE_S */
export const warnS = (w: NearWatch): number => CONFIG.READY_S[w.pose] + CONFIG.DECIDE_S;

/** people outside the watcher's band, up and about */
const outsiders = (state: GameState, w: Actor): Actor[] =>
  allActors(state).filter((x) => x !== w && isActive(x) && !(w.bandId && x.bandId === w.bandId));
/** asleep, the watcher notices only contact (what would wake it, AT61/AT71) */
const perceived = (state: GameState, w: Actor, x: Actor): boolean => !isAsleep(w) && perceivesNow(state, w, x, 'faint');
/** weapons held in a Grip part */
const armed = (state: GameState, x: Actor): number =>
  x.core.inventory.filter((i) => isHeld(i) && itemDef(state, i.itemId).kind === 'weapon').length;
/** someone whose path ends at the watcher: it is tracking, hunting or engaging them */
const comingFor = (x: Actor, w: Actor): boolean => atLeast(x.mind?.knowledge?.[w.id]?.status, 'tracking');
const seen = (state: GameState, x: Actor, closing = false): Seen => ({ sneaking: x.posture === 'stealthy', closing, armed: armed(state, x) });
/** metres between two spots; Infinity where an old map's zone has no rectangle */
const safeDistM = (state: GameState, a: Located, b: Located): number => distOrNull(state, a, b) ?? Infinity;
/** metres from where the watcher stands at which someone closing at `speed` m/s fires the check */
const triggerM = (w: NearWatch, speed: number): number => CONFIG.HOSTILE_NEAR_M + speed * warnS(w);

/** BG-231: everyone outside the watcher's band it perceives now (a wait until someone appears stops when this gains anyone) */
export const inSenses = (state: GameState, w: Actor): Set<string> => new Set(outsiders(state, w).filter((x) => perceived(state, w, x)).map((x) => x.id));

/** AT67: the watch at a stretch's start: everyone the watcher perceives is accepted */
export function startWatch(state: GameState, w: Actor, pose: BodyPoseKey): NearWatch {
  return { watcher: w.id, pose, accepted: new Map(outsiders(state, w).filter((x) => perceived(state, w, x)).map((x) => [x.id, seen(state, x)])) };
}

/** AT67: contact: an attack aimed at the watcher, words to it, a touch, or a noise at WAKE_NOISE or louder that it hears */
export function contact(w: Actor, events: GameEvent[]): NearStop | null {
  const by = events.filter((e) => e.actorId !== w.id && (
    (e.kind === 'attack' && e.target === w.id) ||
    (!!e.line && (e.target === w.id || e.line.to === w.id) && !!e.perception[w.id]?.heard) ||
    (!!e.perception[w.id] && NOISE.pos(e.noise) >= NOISE.pos(CONFIG.WAKE_NOISE))
  )).map((e) => e.actorId);
  return by.length ? { why: 'contact', by: [...new Set(by)] } : null;
}

/** AT67: how long the next step may be: half the shortest time anyone perceived and not accepted would need to fire the
 * check if they ran at the watcher, within STEP_MIN_S and STEP_MAX_S */
export function stepS(state: GameState, watch: NearWatch): number {
  const w = allActors(state).find((a) => a.id === watch.watcher)!;
  let least = Infinity;
  for (const x of outsiders(state, w)) {
    if (watch.accepted.has(x.id) || !perceived(state, w, x)) continue;
    const run = moveSpeed(state, x).run;
    if (run > 0) least = Math.min(least, (safeDistM(state, w, x) - triggerM(watch, run)) / run);
  }
  return Math.min(CONFIG.STEP_MAX_S, Math.max(CONFIG.STEP_MIN_S, least / 2));
}

/** AT67/AT47: an NPC at a long action in a fight runs the same check each turn, on what it perceives: its watch is kept
 * on its busy state (started the turn it first runs). Contact or the check firing alerts it, so it is asked for a new
 * order next turn instead of carrying on. */
export function busyCheck(state: GameState, a: Actor, before: Map<string, Located>, seconds: number, events: GameEvent[]): NearStop | null {
  const b = a.busy!;
  if (!b.watch) { b.watch = Object.fromEntries(startWatch(state, a, 'standing').accepted); return contact(a, events); }
  const watch: NearWatch = { watcher: a.id, pose: 'standing', accepted: new Map(Object.entries(b.watch)) };
  const stop = contact(a, events) ?? checkNear(state, watch, before, seconds);
  b.watch = Object.fromEntries(watch.accepted);
  return stop;
}

/** AT67/AT68: after a step of `seconds`, given where everyone stood before it: someone not accepted closing in (their path
 * ends at the watcher, or they rush in at over RUSH_SHARE × their walk) within the warning time; or someone accepted who
 * starts closing in, readies a weapon, or is seen sneaking. Someone newly perceived who does not fire it is a passer-by:
 * listed (accepted) from then on, so only a change fires it again (reading choice: the steps stay long). Accepted people
 * out of the senses, or more than REARM_FACTOR × their trigger distance away, stop being accepted. */
export function checkNear(state: GameState, watch: NearWatch, before: Map<string, Located>, seconds: number): NearStop | null {
  const w = allActors(state).find((a) => a.id === watch.watcher)!;
  const closing: string[] = [], changed: string[] = [];
  for (const x of outsiders(state, w)) {
    const was = watch.accepted.get(x.id);
    if (!perceived(state, w, x)) { watch.accepted.delete(x.id); continue; }
    const d = safeDistM(state, w, x), from = before.get(x.id);
    const d0 = from ? safeDistM(state, before.get(w.id) ?? w, from) : Infinity;
    const speed = Number.isFinite(d0) && Number.isFinite(d) && seconds > 0 ? (d0 - d) / seconds : 0; // the watcher may have walked too
    const walk = moveSpeed(state, x).walk;
    const coming = speed > 0 && (comingFor(x, w) || speed > CONFIG.RUSH_SHARE * walk);
    if (was) {
      const now = seen(state, x, coming);
      if ((now.sneaking && !was.sneaking) || (now.closing && !was.closing) || now.armed > was.armed) changed.push(x.id);
      else if (d > CONFIG.REARM_FACTOR * triggerM(watch, Math.max(walk, speed))) watch.accepted.delete(x.id);
      else watch.accepted.set(x.id, now);
      continue;
    }
    if (coming && d <= triggerM(watch, speed)) closing.push(x.id);
    else watch.accepted.set(x.id, seen(state, x, coming));
  }
  if (changed.length) return { why: 'change', by: changed };
  return closing.length ? { why: 'closing', by: closing } : null;
}
