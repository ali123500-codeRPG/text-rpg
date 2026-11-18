// PLACEHOLDER: the combat rating's fight model. An actor's combat level is the level of the reference fighter it fights
// evenly: the level L at which V(actor, Ref(L)) = 1, where V = (Ref's reaction + the time Ref needs to defeat the actor)
// ÷ (the actor's reaction + the time it needs to defeat Ref). Times come from a mean-field fight path on the actor's real
// sheet: every blow is the ruleset's own blow on average (ruleset/expect.ts), wounds and morale levels move the rolls
// as they do in play, health fears are paid at their average roll, a shield blocks until its pool is spent, and the side
// with the longer reach gets its free attacks while the other runs in. Defeat is Down or Broken. Each side may also
// break the other by threats alone. Left out for now: part damage and part fears, parry strike-backs, fatigue, the
// attacker's own wounds while it strikes, and situational modifiers (light, cover, numbers).
import type { Actor, DefenseKind, GameState, ItemDef, Mod } from '../types';
import { CONFIG } from '../config';
import { TIERS } from '../scales';
import { getLibrary, itemDef } from '../library';
import { equipLoadout } from '../library/spawn';
import { armorMultiplier, armorStop, shieldPool } from '../library/gearScale';
import { RC, BT } from '../library/raceIds';
import { SK } from '../library/skillIds';
import { FR, DU, IF } from '../library/tableIds';
import { PK } from '../library/perkIds';
import { hostileCloseMods, initiativeBonus, rangeMod, rangeMods } from '../ruleset';
import { healthLevel, isDownLevel, levelMaxPct, totalHp } from '../ruleset/body';
import { healthFear } from '../ruleset/morale';
import { fearCost, isBrokenLevel, maxMorale, moraleLevel, tierCostMult } from '../ruleset/morale';
import { blockItem, usableModes } from '../ruleset/gear';
import { hasPerk } from '../ruleset/perks';
import { actionRow, actionSeconds, reactSeconds } from '../ruleset/actionTime';
import { expectBlow, expectOver, rollOdds, type ModeRef } from '../ruleset/expect';
import { moveSpeed } from './speed';

const MODEL_A = '__model_a', MODEL_B = '__model_b';

/** a copy of the actor as it would start a fight: unhurt, calm, rested, shields whole, no marks, holds or pressure */
export function freshCopy(a: Actor, id: string): Actor {
  const c: Actor = structuredClone({ ...a, mind: undefined, journal: undefined, progression: a.progression ? { ...a.progression, xpLog: [] } : undefined });
  c.id = id;
  c.core.condition = { hpLostPct: 0, parts: {}, status: [], moraleLost: 0 };
  c.core.inventory = c.core.inventory.map((i) => (i.pools?.shield === undefined ? i : { ...i, pools: { ...i.pools, shield: 100 } }));
  for (const k of ['engagement', 'perkMarks', 'playingDead', 'playDeadOpen', 'feint', 'asleep', 'heldBy', 'holding', 'pressure', 'react', 'carry'] as const) delete (c as Record<string, unknown>)[k];
  c.posture = 'open' as never;
  return c;
}

/** GR40: a relic of a library piece: its requirement is `need` true skill whatever its level, and every stat that scales
 * with need follows it (the kit bonus through its requirement, armor and shield pool through gearScale) */
export function relicOf(base: ItemDef, need: number): ItemDef {
  const d: ItemDef = { ...structuredClone(base), id: `${base.id}_relic_${need}`, relicNeed: need, family: IF.relic };
  if (d.armor) { d.armor.reduction = armorStop(d.armor.weight, need); d.armor.multiplier = armorMultiplier(d.armor.weight, need); }
  if (d.shield) d.shield.pool = shieldPool(need);
  return d;
}

/** the reference fighter at level L (CONFIG.MODEL_REF_*): a human with the reference skills at L, carrying relics of the
 * reference kit whose requirement is L (GR40), and a state that knows those relics */
export function refFighter(state: GameState, L: number, id: string): { S: GameState; ref: Actor } {
  const relics = CONFIG.MODEL_REF_KIT.map((k) => relicOf(itemDef(state, k), L));
  const S: GameState = { ...state, blueprints: [...relics.map((d) => ({ storyId: state.storyId, id: d.id, kind: 'item' as const, data: d as unknown as Record<string, unknown> })), ...(state.blueprints ?? [])] };
  const ref: Actor = {
    id, storyId: state.storyId, kind: 'npc', names: { current: 'reference fighter', past: [] }, label: 'reference fighter', placeId: '', zone: '', bandId: '',
    core: {
      raceId: RC.human, bodyTypeId: BT.humanoid, skills: Object.fromEntries(CONFIG.MODEL_REF_SKILLS.map((k) => [k, { raw: L, state: 'normal' as const }])),
      classes: [], perks: [], condition: { hpLostPct: 0, parts: {}, status: [], moraleLost: 0 },
      inventory: equipLoadout(S, relics.map((d) => d.id), id), standingDefense: CONFIG.MODEL_REF_DEFENSE as DefenseKind,
    },
  };
  return { S, ref };
}

/** a state the two model fighters can be looked up in (rolls name each other), the real actors left untouched */
const withPair = (state: GameState, a: Actor, b: Actor): GameState => ({ ...state, actors: [...state.actors, a, b] });

/** the average reaction when a fight starts (seconds): reactSeconds over every d100 of the initiative roll */
export function avgReact(state: GameState, a: Actor): number {
  const bonus = initiativeBonus(state, a);
  let s = 0;
  for (let d = 1; d <= 100; d++) s += reactSeconds(d + bonus) / 100;
  return s;
}

/** the fear a health level sets off, on average: its cost × the average tier multiplier of the owner's morale roll now */
function healthFearCost(state: GameState, b: Actor): number {
  const f = healthFear(b, healthLevel(b));
  if (!f) return 0;
  const cost = fearCost(b, f);
  if (!(cost > 0) || !f.rolled) return cost;
  return cost * expectOver(rollOdds({ actorId: b.id, skill: SK.resolve, modifiers: [], tierShifts: [] }, state, b), tierCostMult);
}

const out = (b: Actor) => isDownLevel(healthLevel(b)) || isBrokenLevel(moraleLevel(b));
type Track = { lost: number; moraleLost: number; t: number };
const setTrack = (b: Actor, k: Track) => { b.core.condition.hpLostPct = k.lost; b.core.condition.moraleLost = k.moraleLost; };

/** one blow's worth of the path at the track's state: health lost, morale paid at each new level, the shield's pool;
 * `n` blows (fractional) of the same average */
function strike(state: GameState, A: Actor, B: Actor, k: Track, m: ModeRef, extra: Mod[], hp: number, oneOnly: boolean): boolean {
  setTrack(B, k);
  const blow = expectBlow(state, A, B, m, { attack: extra });
  const shield = blow.defense === 'block' ? blockItem(state, B) : null;
  const pool = shield ? itemDef(state, shield.itemId).shield!.pool : 0;
  const dPct = (100 * blow.body) / hp, sPct = shield ? (100 * blow.shield) / pool : 0;
  if (!(dPct > 0) && !(sPct > 0)) return false;
  // blows until the next change: the health level's top passed, or the shield's pool spent
  const hNeed = dPct > 0 ? (levelMaxPct(healthLevel(B)) - k.lost) / dPct : Infinity;
  const sNeed = sPct > 0 ? (shield!.pools?.shield ?? 100) / sPct : Infinity;
  const n = oneOnly ? 1 : Math.max(1e-6, Math.min(hNeed, sNeed));
  const before = healthLevel(B);
  k.t += n * blow.secs;
  k.lost += n * dPct + (!oneOnly && hNeed <= sNeed ? 1e-6 : 0);
  if (shield) shield.pools = { ...shield.pools, shield: (shield.pools?.shield ?? 100) - n * sPct };
  setTrack(B, k);
  if (healthLevel(B) !== before) k.moraleLost += healthFearCost(state, B);
  return true;
}

/** the time (seconds) A needs to defeat B by blows: `free` attacks first (B running in), then `contact` blows until B is
 * Down or Broken; Infinity when the blows do nothing */
function blowPath(state: GameState, A: Actor, B: Actor, free: { m: ModeRef; extra: Mod[]; at: number }[], contact: ModeRef | undefined, closeS: number): number {
  const hp = totalHp(state, B), k: Track = { lost: 0, moraleLost: 0, t: 0 };
  for (const f of free) {
    strike(state, A, B, k, f.m, f.extra, hp, true);
    setTrack(B, k);
    if (out(B)) return f.at;
  }
  k.t = closeS;
  if (!contact) return Infinity;
  for (let i = 0; i < 500; i++) {
    setTrack(B, k);
    if (out(B)) return k.t;
    if (!strike(state, A, B, k, contact, contactMods(state, A, contact), hp, false)) return Infinity;
  }
  return Infinity;
}

/** a ranged mode at a foe within reach takes the hostile-close modifier (Point Blank removes it) */
const contactMods = (state: GameState, A: Actor, m: ModeRef): Mod[] =>
  m.mode.tree === 'ranged' ? hostileCloseMods(A) : [];

/** the time A needs to break B by threats alone: Intimidation against B's Intimidation each threat, a win costing B the
 * lost-to-intimidation fear per tier of the gap; Infinity when A cannot win */
function threatPath(state: GameState, A: Actor, B: Actor): number {
  const row = actionRow(DU.talk);
  if (!row || !(A.core.skills[SK.intimidation]?.raw ?? 0)) return Infinity;
  const secs = actionSeconds(row) * CONFIG.MODEL_THREAT_WORDS, f = getLibrary().fears?.[FR.lost_intimidation];
  if (!f) return Infinity;
  const k: Track = { lost: 0, moraleLost: 0, t: 0 };
  const odds = rollOdds({ actorId: A.id, skill: SK.intimidation, modifiers: [], tierShifts: [], against: B.id, contest: true }, state, A);
  for (let i = 0; i < 500; i++) {
    setTrack(B, k);
    if (out(B)) return k.t;
    const ans = rollOdds({ actorId: B.id, skill: SK.intimidation, modifiers: [], tierShifts: [], against: A.id, contest: true }, state, B);
    let cost = 0;
    for (const [la, pa] of odds) for (const [lb, pb] of ans) if (lb < la) cost += pa * pb * fearCost(B, f, { gap: lb - la });
    if (!(cost > 0)) return Infinity;
    k.moraleLost += cost; k.t += secs;
  }
  return Infinity;
}

/** each side's usable attack modes with their reach (metres) */
const modesOf = (state: GameState, a: Actor): ModeRef[] => usableModes(state, a);
const reachOf = (ms: ModeRef[]) => Math.max(0, ...ms.map((m) => m.mode.reach));

/** the free attacks the longer-reach side gets while the other runs in from that reach to its own: one every attack's
 * seconds, the first after one, each at its range modifier */
function freeAttacks(state: GameState, A: Actor, B: Actor, m: ModeRef, from: number, to: number, run: number): { list: { m: ModeRef; extra: Mod[]; at: number }[]; closeS: number } {
  const closeS = run > 0 ? Math.max(0, from - to) / run : Infinity;
  const secs = expectBlow(state, A, B, m).secs, list: { m: ModeRef; extra: Mod[]; at: number }[] = [];
  if (!(secs > 0) || !Number.isFinite(closeS)) return { list, closeS };
  for (let t = secs; t <= closeS; t += secs) {
    const dist = from - run * t, far = m.mode.tree === 'ranged' ? rangeMod(dist, m.mode.reach) : 0;
    list.push({ m, extra: rangeMods(far), at: t });
  }
  return { list, closeS };
}

/** the fight between two fresh fighters: each side's time to defeat the other and V = (b's reaction + b's time) ÷ (a's reaction + a's time) */
export function duel(state: GameState, a0: Actor, b0: Actor): { v: number; aTime: number; bTime: number; aReact: number; bReact: number } {
  const A = freshCopy(a0, MODEL_A), B = freshCopy(b0, MODEL_B), S = withPair(state, A, B);
  const am = modesOf(S, A), bm = modesOf(S, B);
  const contactOf = (X: Actor, Y: Actor, ms: ModeRef[]) => best(ms, (m) => blowPath(S, freshCopy(X, X.id), freshCopy(Y, Y.id), [], m, 0));
  const aContact = contactOf(A, B, am), bContact = contactOf(B, A, bm);
  // the longer reach holds its ground and attacks while the other runs in to its own best reach
  const ar = reachOf(am), br = reachOf(bm);
  const aLong = ar > br, bLong = br > ar;
  const aFar = aLong ? am.find((m) => m.mode.reach === ar)! : undefined, bFar = bLong ? bm.find((m) => m.mode.reach === br)! : undefined;
  const aFree = aFar ? freeAttacks(S, A, B, aFar, ar, bContact.m?.mode.reach ?? 0, moveSpeed(S, B).run) : { list: [], closeS: 0 };
  const bFree = bFar ? freeAttacks(S, B, A, bFar, br, aContact.m?.mode.reach ?? 0, moveSpeed(S, A).run) : { list: [], closeS: 0 };
  const close = Math.max(aFree.closeS, bFree.closeS);
  // with no free attacks and nobody running in, the fight is the contact fight already worked out
  const path = (X: Actor, Y: Actor, free: { m: ModeRef; extra: Mod[]; at: number }[], c: { m?: ModeRef; t: number }) =>
    !free.length && !close ? c.t : blowPath(S, freshCopy(X, X.id), freshCopy(Y, Y.id), free, c.m, close);
  const aTime = Math.min(path(A, B, aFree.list, aContact), threatPath(S, freshCopy(A, A.id), freshCopy(B, B.id)));
  const bTime = Math.min(path(B, A, bFree.list, bContact), threatPath(S, freshCopy(B, B.id), freshCopy(A, A.id)));
  const aReact = avgReact(S, A), bReact = avgReact(S, B), v = (bReact + bTime) / (aReact + aTime);
  return { v: Number.isNaN(v) ? 1 : v, aTime, bTime, aReact, bReact };
}
function best(ms: ModeRef[], f: (m: ModeRef) => number): { m?: ModeRef; t: number } {
  let r: { m?: ModeRef; t: number } = { t: Infinity };
  for (const m of ms) { const t = f(m); if (t < r.t || !r.m) r = { m, t }; }
  return r;
}

/** V against the reference fighter at level L */
export function vAt(state: GameState, a: Actor, L: number): number {
  const { S, ref } = refFighter(state, L, '__ref');
  return duel(S, a, ref).v;
}

const cache = new Map<string, number>();
/** the sheet that sets a combat level: everything but the moment (condition, marks, holds) */
const sheetKey = (a: Actor): string => JSON.stringify([a.core.raceId, a.core.bodyTypeId, a.core.prefix, a.core.skills, a.core.perks, a.core.classes, a.core.inventory.map((i) => [i.itemId, i.equippedIn, i.boundTo]), a.core.standingDefense, a.core.bornDay, a.core.hollowed, a.progression?.achievements]);

/** PLACEHOLDER: the combat level: the level of the reference fighter this actor fights evenly (V = 1). V falls as the
 * reference's level rises, so the search brackets V = 1 (doubling from MODEL_LEVEL_FIRST up to MODEL_LEVEL_TOP) and closes
 * in by false position on ln V (Illinois) until the bracket is under MODEL_LEVEL_TOL. Cached by sheet. */
export function combatLevel(state: GameState, a: Actor): number {
  const key = sheetKey(a);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const L = searchLevel((L) => Math.log(vAt(state, a, L)));
  cache.set(key, L);
  return L;
}
/** the root of a falling f between 0 and MODEL_LEVEL_TOP (0 when f(0) < 0, the top when f never drops below 0) */
function searchLevel(f: (L: number) => number): number {
  let lo = 0, flo = f(0);
  if (!(flo >= 0)) return 0;
  let hi = Math.min(CONFIG.MODEL_LEVEL_FIRST, CONFIG.MODEL_LEVEL_TOP), fhi = f(hi);
  while (fhi >= 0) {
    if (hi >= CONFIG.MODEL_LEVEL_TOP) return CONFIG.MODEL_LEVEL_TOP;
    lo = hi; flo = fhi; hi = Math.min(2 * hi, CONFIG.MODEL_LEVEL_TOP); fhi = f(hi);
  }
  let side = 0;
  for (let i = 0; i < 60 && hi - lo > CONFIG.MODEL_LEVEL_TOL; i++) {
    // false position, falling back to halving when a side is endless (a fight one side never wins)
    const mid = Number.isFinite(flo) && Number.isFinite(fhi) ? Math.min(hi - 1e-9, Math.max(lo + 1e-9, lo + (flo * (hi - lo)) / (flo - fhi))) : (lo + hi) / 2;
    const fm = f(mid);
    if (fm === 0) return mid;
    if (fm > 0) { lo = mid; flo = fm; if (side === 1) fhi /= 2; side = 1; } else { hi = mid; fhi = fm; if (side === -1) flo /= 2; side = -1; }
  }
  return Number.isFinite(flo) && Number.isFinite(fhi) && flo !== fhi ? lo + (flo * (hi - lo)) / (flo - fhi) : (lo + hi) / 2;
}
/** forget every cached combat level (a model setting changed) */
export const clearCombatLevels = (): void => cache.clear();
