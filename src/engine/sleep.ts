// NW12, NW14, NW18–NW21: sleeping. An actor asleep (Actor.asleep) perceives nothing, does nothing and is struck as an
// unaware target. It wakes on a blow, on hearing a loud noise (a shout or louder), when its sleep runs out, or, with the
// Light Sleeper rule, on a passed hearing check when someone hostile comes near (their steps reach it). NPCs sleep by their routines (an
// activity of `sleep` where their routine puts them) and follow the same rules. A band member who is awake and notices
// someone hostile shouts to wake its sleeping bandmates (code, no Claude call). The player's sleep and night watch are
// run in src/engine/resolve.ts (runNight), which steps the clock and stops it when someone hostile comes near.
import type { Actor, GameEvent, GameState, Night, Order, Rng } from '../types';
import { CONFIG } from '../config';
import { NOISE, type NoiseKey } from '../scales';
import { now } from '../time';
import { PK } from '../library/perkIds';
import { FN } from '../library/functionIds';
import { SK } from '../library/skillIds';
import { hasPerk } from '../ruleset/perks';
import { fnRoller, gradeMod, ruleset, situational, tierAtLeast } from '../ruleset';
import { VOLUME_NOISE } from '../perception/noise';
import { beliefStatus, soundCarries, updateBeliefs } from '../perception';
import { buildActorView } from '../views';
import { desiredState } from '../minds';
import { stealthSkill } from '../minds/state';
import { actorById, allActors, atLeast, hostile, isActive, isAsleep, isEngaged, zoneById } from './relations';
import { logCode } from './effects';
import { matchedCritFeat, outmatchedOnce, type ActContest } from './feats';

/** NW14: the perk that lets a sleeper wake to a hearing check (Earshot's 60 perk) */
export const LIGHT_SLEEPER = PK.light_sleeper;
export const lightSleeper = (a: Actor): boolean => hasPerk(a, LIGHT_SLEEPER);

/** NW18: what wakes a sleeper. blow: struck; noise: a loud noise heard; heard: Light Sleeper's hearing check passed;
 * rested: its sleep ran out; watch: its turn on watch */
export type WakeWhy = 'blow' | 'noise' | 'heard' | 'rested' | 'watch';

export function fallAsleep(state: GameState, a: Actor, until?: number): void {
  if (a.asleep || !isActive(a)) return;
  a.asleep = { since: now(state), ...(until !== undefined ? { until } : {}) };
  logCode(state, 'fell_asleep', { actorId: a.id, ...(until !== undefined ? { until } : {}) });
}

/** wakes `a`. Woken out of a planned night (a blow, a noise, a hearing check), its night is over (NW18) */
export function wake(state: GameState, a: Actor, why: WakeWhy, by?: string): void {
  if (!a.asleep) return;
  delete a.asleep;
  a.wokeAt = now(state);
  logCode(state, 'woke', { actorId: a.id, why, ...(by ? { by } : {}) });
  const n = state.night;
  if (n && n.members.includes(a.id) && why !== 'rested' && why !== 'watch' && !n.woke.includes(a.id)) n.woke.push(a.id);
}

/** NW18: an event wakes the sleepers it touches: the one it strikes, and anyone who hears it when it is as loud as a
 * shout or louder (CONFIG.WAKE_NOISE; a Heavy Sleeper HEAVY_SLEEPER_STEPS louder, SS10). Runs before the event is
 * perceived, so the woken hear what woke them. */
export function wakeByEvent(state: GameState, ev: GameEvent): void {
  const loud = (x: Actor) => NOISE.pos(ev.noise) >= NOISE.pos(CONFIG.WAKE_NOISE) + (hasPerk(x, PK.heavy_sleeper) ? CONFIG.HEAVY_SLEEPER_STEPS : 0);
  for (const x of allActors(state)) {
    if (!isAsleep(x) || x.id === ev.actorId) continue;
    if (ev.target === x.id && CONFIG.WAKE_CONTACT.includes(ev.kind)) wake(state, x, 'blow', ev.actorId);
    else if (loud(x) && soundCarries(state, x, { zone: ev.zone, pos: ev.pos }, ev.noise)) wake(state, x, 'noise', ev.actorId);
  }
}

/** NW14/NW19: a light sleeper's hearing check against someone near. Someone sneaking: the sleeper's hearing against
 * their stealth, the contest an awake listener makes. Someone moving openly (making `noise`): a hearing check whose
 * difficulty comes from that noise (CONFIG.WAKE_GRADE: louder is easier). Either way their steps (`noise`, a sneaker's
 * own quieter steps) must reach the sleeper, or there is no roll. Passed, the sleeper wakes aware of them. A sneak's
 * contest joins `act` when given (CS25: the caller counts Against the Odds once for the act), else counts on its own. */
export function wakeCheck(state: GameState, sleeper: Actor, other: Actor, noise: NoiseKey, rng: Rng, act?: ActContest[]): boolean {
  if (!isAsleep(sleeper) || !lightSleeper(sleeper) || !soundCarries(state, sleeper, other, noise)) return false;
  let pass = false;
  if (other.posture === 'stealthy') {
    const skill = stealthSkill(other);
    const zone = zoneById(state, other.zone);
    const r = ruleset.contested(
      { actorId: other.id, skill, ...situational(state, skill, { cover: zone, actor: other }), rollKind: 'stealth' as const },
      { actorId: sleeper.id, skill: SK.earshot, ...situational(state, fnRoller(state, sleeper, FN.hearing), { actor: sleeper }), rollKind: 'perception' as const, fn: FN.hearing },
      state, rng);
    matchedCritFeat(state, r); // D-292
    const won: ActContest = { c: r, fns: sleeper === state.player ? [FN.hearing] : undefined };
    if (act) act.push(won); else outmatchedOnce(state, [won]);
    pass = r.gap > 0;
  } else {
    const target = CONFIG.DIFFICULTY[CONFIG.WAKE_GRADE[noise] ?? 'moderate'];
    const r = ruleset.roll({ actorId: sleeper.id, skill: SK.earshot, modifiers: [{ source: 'how quietly they came', type: 'situational', value: gradeMod(target) }], tierShifts: [], fn: FN.hearing }, state, rng);
    pass = tierAtLeast(r.tier, 'success');
  }
  logCode(state, 'wake_check', { actorId: sleeper.id, other: other.id, sneaking: other.posture === 'stealthy', pass });
  if (pass) {
    wake(state, sleeper, 'heard', other.id);
    updateBeliefs(state, { kind: 'opening', observerId: sleeper.id, aboutId: other.id, status: 'aware', zone: other.zone, source: 'heard' });
  }
  return pass;
}

/** CS20: someone awake and active, hostile to `a`, whose steps reach it: their movement sound (noiseOf, a sneaker's at
 * its sneaking noise) carries to `a` as it would to a listener awake (soundCarries: metres, walls and doors). A zone
 * is never the distance. */
export const hostilesNear = (state: GameState, a: Actor, noiseOf: (x: Actor) => NoiseKey): Actor[] =>
  allActors(state).filter((x) => x !== a && isActive(x) && !isAsleep(x) && hostile(state, x, a) && soundCarries(state, a, x, noiseOf(x)));

/** NW18: at the start of a turn, every light sleeper rolls against each hostile near it, until one wakes it */
export function wakeChecksNear(state: GameState, noiseOf: (x: Actor) => NoiseKey, rng: Rng): void {
  const act: ActContest[] = [];
  for (const s of allActors(state).filter(isAsleep)) for (const x of hostilesNear(state, s, noiseOf)) if (wakeCheck(state, s, x, noiseOf(x), rng, act)) break;
  outmatchedOnce(state, act); // CS25: once per turn's sneak, for the strongest sleeper beaten
}

/** NW21: a band member who is awake and aware of someone hostile (to it or to a sleeping bandmate) shouts to wake the
 * bandmates asleep within reach of its shout. Code does this, with no Claude call: the shout is its action this turn. */
export function wakeCalls(state: GameState): Order[] {
  const out: Order[] = [];
  for (const w of state.actors) {
    if (!w.mind || !isActive(w) || isAsleep(w) || w.mind.moraleState) continue;
    const sleepers = allActors(state).filter((x) => x !== w && isAsleep(x) && x.bandId === w.bandId && soundCarries(state, x, w, VOLUME_NOISE.shout));
    if (!sleepers.length) continue;
    const threat = allActors(state).find((t) => isActive(t) && !isAsleep(t) && (hostile(state, t, w) || sleepers.some((s) => hostile(state, t, s))) && atLeast(beliefStatus(state, w, t), 'aware'));
    if (threat) out.push({ actorId: w.id, type: 'call_help', target: null, skill: null, intent: 'wake the sleepers', source: 'routine' });
  }
  return out;
}

/** NW20: NPCs sleep by their routines. One whose routine has it asleep where it stands falls asleep (no sooner than
 * FALL_ASLEEP_MIN after it last woke); one whose routine no longer has it asleep wakes. A planned sleep (`until`) ends
 * when its time comes. Not while it is engaged, alarmed, broken or held. */
export function settleSleepers(state: GameState): void {
  const t = now(state);
  for (const a of allActors(state)) {
    if (a.asleep?.until !== undefined) {
      if (a.asleep.until <= t && !(state.night && a.id === state.player.id)) wake(state, a, 'rested');
      continue;
    }
    const m = a.mind;
    if (!m?.routine || !isActive(a)) continue;
    const d = desiredState(buildActorView(state, a.id));
    const sleepy = d?.activity === 'sleep' && d.zone === a.zone;
    // BF68: a sleep step with nowhere given runs where it stands; the gap is filed once as a bug
    if (sleepy && d.unbound && !state.log.some((l) => l.code === 'bed_missing' && l.detail?.actorId === a.id)) logCode(state, 'bed_missing', { actorId: a.id, routineId: m.routine.id });
    if (a.asleep && !sleepy) wake(state, a, 'rested');
    else if (!a.asleep && sleepy && mayDropOff(state, a)) fallAsleep(state, a);
  }
}

/** NW20, BF69: the guards on falling asleep, by routine or by exhaustion (fatigue.ts collapse): not while engaged, alarmed,
 * broken or held, and no sooner than FALL_ASLEEP_MIN after it last woke */
export function mayDropOff(state: GameState, a: Actor): boolean {
  const m = a.mind;
  return !isEngaged(state, a) && !m?.alarm?.armed && !m?.moraleState && !a.heldBy && (a.wokeAt === undefined || now(state) - a.wokeAt >= CONFIG.FALL_ASLEEP_MIN);
}

/** NW15/NW22: the night the player starts by sleeping. Alone, it lasts the sleep row. With companions in the zone (those
 * following the player), the night is split into one equal watch each and everyone else sleeps: everyone gets the sleep
 * row's hours, so the night lasts that × n ÷ (n − 1), capped at NIGHT_MAX_MIN. The player takes the middle watch. */
export function planNight(state: GameState, sleepMin: number, companions: Actor[]): Night {
  const p = state.player;
  const start = now(state);
  const others = [...companions].sort((x, y) => x.id.localeCompare(y.id)).map((x) => x.id);
  const n = others.length + 1;
  const length = n === 1 ? sleepMin : Math.min(Math.round((sleepMin * n) / (n - 1)), CONFIG.NIGHT_MAX_MIN);
  const members = [...others];
  members.splice(Math.floor(n / 2), 0, p.id);
  const watch = length / n;
  const watches = n === 1 ? [] : members.map((id, i) => ({ actorId: id, from: Math.round(start + i * watch), to: Math.round(start + (i + 1) * watch) }));
  return { start, end: start + length, members, watches, slept: 0, heals: 0, woke: [] };
}

/** who is on watch at minute t of the night */
export const onWatch = (n: Night, id: string, t: number): boolean => n.watches.some((w) => w.actorId === id && t >= w.from && t < w.to);

/** NW15: everyone sleeps but the one on watch: the watcher wakes for its watch, the others fall asleep until the night
 * ends. Someone woken out of the plan (a blow, a noise) stays awake. */
export function applyNightPhase(state: GameState): void {
  const n = state.night;
  if (!n) return;
  const t = now(state);
  for (const id of n.members) {
    const a = actorById(state, id);
    if (!a || !isActive(a) || n.woke.includes(id)) continue;
    if (onWatch(n, id, t)) wake(state, a, 'watch');
    else fallAsleep(state, a, n.end);
  }
}

/** the next minute something changes in the night: a watch starts or ends, or the night ends */
export const nextChange = (n: Night, t: number): number =>
  Math.min(n.end, ...n.watches.flatMap((w) => [w.from, w.to]).filter((x) => x > t));
