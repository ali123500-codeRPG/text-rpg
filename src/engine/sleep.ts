// NW12, NW14, NW18–NW21: sleeping. An actor asleep (Actor.asleep) perceives nothing, does nothing and is struck as an
// unaware target. It wakes on a blow, on hearing a loud noise (a shout or louder), when its sleep runs out, or, with the
// Light Sleeper rule, on a passed hearing check when someone hostile comes near (their steps reach it). NPCs sleep by their routines (an
// activity of `sleep` where their routine puts them) and follow the same rules. A band member who is awake and notices
// someone hostile shouts to wake its sleeping bandmates (code, no Claude call). The player's sleep and night watch are
// run in src/engine/resolve.ts (runNight), which steps the clock and stops it when someone hostile comes near.
import type { Actor, Furniture, GameEvent, GameState, Night, Order, Rng } from '../types';
import { ofOurs } from './belonging';
import { CONFIG } from '../config';
import { NOISE, type NoiseKey } from '../scales';
import { now } from '../time';
import { PK } from '../library/perkIds';
import { FN } from '../library/functionIds';
import { SK } from '../library/skillIds';
import { hasPerk } from '../ruleset/perks';
import { fnRoller, gradeMod, markUse, ruleset, situational, tierAtLeast } from '../ruleset';
import { VOLUME_NOISE } from '../perception/noise';
import { beliefStatus, soundCarries, updateBeliefs } from '../perception';
import { routineView } from '../views';
import { desiredState } from '../minds';
import { stealthSkill } from '../minds/state';
import { actorById, allActors, atLeast, hostile, isActive, isAsleep, isEngaged, zoneById } from './relations';
import { logCode } from './effects';
import { furnitureIn } from './furniture';
import { boxGap, pieceBox } from '../ruleset/objectCover';
import { FU } from '../library/tableIds';
import { actorBody } from '../library';
import { matchedCritFeat, outmatchedOnce, type ActContest } from './feats';
import { floorOf, spotAt } from './position';
import { crossings, seesNow } from '../plan/line';

/** NW18: what wakes a sleeper. blow: struck; noise: a loud noise heard; heard: its hearing check passed (every sleeper sleeps light, NW14);
 * rested: its sleep ran out; watch: its turn on watch */
export type WakeWhy = 'blow' | 'noise' | 'heard' | 'rested' | 'watch';

/** FT8, MQ13 a: metres from `a`'s point to a bed's footprint (its kind's size, PC1), its floor's height apart counted too;
 * Infinity with a wall (a counter too) between them that has no open way through (BG-1736: a bed is reached by metres and
 * walls, whatever title it stands in) */
export function bedGap(state: GameState, a: Actor, f: Furniture): number {
  const z = zoneById(state, f.zone), box = z && pieceBox(state, z, f);
  if (!box || !a.pos) return Infinity;
  const h = floorOf(state, a) + 0.3; // the walking line (ringSpots' line)
  const walled = crossings(state, { ...a.pos, z: h }, { ...f.pos, z: f.floor + 0.3 }).some((c) => c.kind === 'roof' || !c.opening || !seesNow(state, c.opening));
  return walled ? Infinity : Math.hypot(boxGap(a.pos, box), floorOf(state, a) - f.floor);
}
/** MQ18: who lies asleep on bed `id`, first to lie down first */
export const sleepersOn = (state: GameState, id: string): Actor[] =>
  allActors(state).filter((x) => x.asleep?.bed === id).sort((x, y) => x.asleep!.since - y.asleep!.since || x.id.localeCompare(y.id));
/** MQ17 b: who a bed is booked for now (SV3), if anyone: a booking ends at its `until` */
export const bookedFor = (state: GameState, f: Furniture): string | undefined => (f.booked && (f.booked.until === undefined || f.booked.until > now(state)) ? f.booked.by : undefined);
/** MQ18, MQ17 b: `a` may lie down on bed `f`: fewer than BED_SLEEPERS others asleep on it, and not booked for someone else */
export const bedHasRoom = (state: GameState, f: Furniture, a: Actor): boolean =>
  sleepersOn(state, f.id).filter((x) => x !== a).length < CONFIG.BED_SLEEPERS && (bookedFor(state, f) ?? a.id) === a.id;
/** MQ13 a, MQ18: the beds in title `zone` with room for `a`, nearest to `a` first */
export const freeBeds = (state: GameState, a: Actor, zone: string): Furniture[] =>
  furnitureIn(state, zone).filter((f) => f.kind === FU.bed && bedHasRoom(state, f, a)).sort((x, y) => bedGap(state, a, x) - bedGap(state, a, y));
/** FT8, MQ13 a: the bed with room `a` would lie down on going to sleep where it stands: one within BED_REACH_M */
export const bedToLieOn = (state: GameState, a: Actor): Furniture | undefined => state.furniture
  .filter((f) => f.kind === FU.bed && bedHasRoom(state, f, a) && bedGap(state, a, f) <= CONFIG.BED_REACH_M).sort((x, y) => bedGap(state, a, x) - bedGap(state, a, y))[0];
/** MQ17 b: a bed in place `placeId` nobody lies asleep on and nobody has booked, for SV3 to book */
export const bedToBook = (state: GameState, placeId: string): Furniture | undefined =>
  state.furniture.find((f) => f.kind === FU.bed && f.placeId === placeId && !sleepersOn(state, f.id).length && !bookedFor(state, f));

/** MQ18: the sleepers on bed `f` side by side across it: its width (pieceBox) shared by their body widths, each at the
 * middle of its share and of the bed's length; one alone lies at the bed's middle */
function layBed(state: GameState, f: Furniture): void {
  const z = zoneById(state, f.zone), box = z && pieceBox(state, z, f), on = sleepersOn(state, f.id);
  if (!box) return;
  const across = box.hi.x - box.lo.x < box.hi.y - box.lo.y ? 'x' : 'y', along = across === 'x' ? 'y' : 'x';
  const widths = on.map((x) => actorBody(state, x).size.widthM), total = widths.reduce((n, w) => n + w, 0);
  let used = 0;
  on.forEach((x, i) => {
    const c = box.lo[across] + ((used + widths[i] / 2) / total) * (box.hi[across] - box.lo[across]);
    used += widths[i];
    x.pos = { [across]: c, [along]: (box.lo[along] + box.hi[along]) / 2 } as { x: number; y: number };
  });
}

/** falls asleep; `lie` (not a collapse, FT10): beside a bed with room it lies down on it, beside anyone already there, and
 * holds its place while asleep (MQ13 a, MQ18) */
export function fallAsleep(state: GameState, a: Actor, until?: number, lie = true): void {
  if (a.asleep || !isActive(a)) return;
  const bed = lie ? bedToLieOn(state, a) : undefined;
  a.asleep = { since: now(state), ...(until !== undefined ? { until } : {}), ...(bed ? { bed: bed.id } : {}) };
  if (bed) { a.pos = { ...bed.pos }; layBed(state, bed); }
  logCode(state, 'fell_asleep', { actorId: a.id, ...(until !== undefined ? { until } : {}), ...(bed ? { bed: bed.id } : {}) });
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
    else if (loud(x) && soundCarries(state, x, spotAt(ev.zone, ev.pos), ev.noise)) wake(state, x, 'noise', ev.actorId);
  }
}

/** NW14/NW19: a sleeper's hearing check (every sleeper sleeps light: the Light Sleeper perk became everyone's rule) against someone near. Someone sneaking: the sleeper's hearing against
 * their stealth, the contest an awake listener makes. Someone moving openly (making `noise`): a hearing check whose
 * difficulty comes from that noise (CONFIG.WAKE_GRADE: louder is easier). Either way their steps (`noise`, a sneaker's
 * own quieter steps) must reach the sleeper, or there is no roll. Passed, the sleeper wakes aware of them. A sneak's
 * contest joins `act` when given (CS25: the caller counts Against the Odds once for the act), else counts on its own.
 * Both rolls learn (BG-249): the contest marks both sides, the check learns like any check. */
export function wakeCheck(state: GameState, sleeper: Actor, other: Actor, noise: NoiseKey, rng: Rng, act?: ActContest[]): boolean {
  if (!isAsleep(sleeper) || !soundCarries(state, sleeper, other, noise)) return false;
  let pass = false;
  if (other.posture === 'stealthy') {
    const skill = stealthSkill(other);
    const zone = zoneById(state, other.zone);
    const r = ruleset.contested(
      { actorId: other.id, skill, ...situational(state, skill, { cover: zone, actor: other, body: other, from: sleeper }), rollKind: 'stealth' as const },
      { actorId: sleeper.id, skill: SK.earshot, ...situational(state, fnRoller(state, sleeper, FN.hearing), { actor: sleeper }), rollKind: 'perception' as const, fn: FN.hearing },
      state, rng);
    matchedCritFeat(state, r); // D-292
    markUse(state, other, r.a.skill, r); // BG-249: both sides learn, as in an awake listener's contest
    markUse(state, sleeper, r.b.skill, r);
    const won: ActContest = { c: r, fns: sleeper === state.player ? [FN.hearing] : undefined };
    if (act) act.push(won); else outmatchedOnce(state, [won]);
    pass = r.gap > 0;
  } else {
    const target = CONFIG.DIFFICULTY[CONFIG.WAKE_GRADE[noise] ?? 'moderate'];
    const r = ruleset.roll({ actorId: sleeper.id, skill: SK.earshot, modifiers: [{ source: 'how quietly they came', type: 'situational', value: gradeMod(target) }], tierShifts: [], fn: FN.hearing }, state, rng);
    pass = tierAtLeast(r.tier, 'success');
    ruleset.recordUse(sleeper, r.skill, { actorId: sleeper.id, skill: r.skill, target, passed: pass, modifiers: [] }, state); // BG-249: learns like a check
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
    const sleepers = allActors(state).filter((x) => x !== w && isAsleep(x) && ofOurs(state, w, x) && soundCarries(state, x, w, VOLUME_NOISE.shout));
    if (!sleepers.length) continue;
    const threat = allActors(state).find((t) => isActive(t) && !isAsleep(t) && (hostile(state, t, w) || sleepers.some((s) => hostile(state, t, s))) && atLeast(beliefStatus(state, w, t), 'aware'));
    if (threat) out.push({ actorId: w.id, type: 'call_help', target: null, skill: null, intent: 'wake the sleepers', source: 'routine' });
  }
  return out;
}

/** NW20: NPCs sleep by their routines. One whose routine has it asleep where it stands falls asleep (no sooner than
 * FALL_ASLEEP_MIN after it last woke), on a free bed of that title once it is beside one (MQ13 a: the clock walks it
 * there, catchUp), anywhere in it when none is free; one whose routine no longer has it asleep wakes. A planned sleep (`until`) ends
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
    const d = desiredState(routineView(state, a));
    const sleepy = d?.activity === 'sleep' && d.zone === a.zone && (!!a.asleep || !!bedToLieOn(state, a) || !freeBeds(state, a, a.zone).length);
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
  // MQ13 a: the player lies down first, so the bed they walked to is theirs
  for (const id of [...n.members].sort((x, y) => Number(y === state.player.id) - Number(x === state.player.id))) {
    const a = actorById(state, id);
    if (!a || !isActive(a) || n.woke.includes(id)) continue;
    if (onWatch(n, id, t)) wake(state, a, 'watch');
    else fallAsleep(state, a, n.end);
  }
}

/** the next minute something changes in the night: a watch starts or ends, or the night ends */
export const nextChange = (n: Night, t: number): number =>
  Math.min(n.end, ...n.watches.flatMap((w) => [w.from, w.to]).filter((x) => x > t));
