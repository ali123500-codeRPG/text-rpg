// PLACEHOLDER: the combat rating's equation. An actor's combat level is the level of the standard soldier it fights evenly
// (the reference fighter: MODEL_REF_SKILLS at the level, relics of MODEL_REF_KIT whose requirement is the level). A fight
// is even when each side needs the same time to defeat the other:
//
//   seconds to defeat = blows to defeat × seconds a blow
//   blows to defeat   = the other's health × nerve ÷ the average blow        (a shield's pool first takes what it blocks)
//   average blow      = Σ chance × max(0, ladder × damage × armor share − soak)   (over both rolls' tiers and the hit table)
//
// The average is exact: every pair of tiers the two rolls can give, by its chance (ruleset/expect.ts tierOdds: every d100
// face once, tiers with no end as in every balance model), on every body part by how often it is hit, through the
// ruleset's own gap shifts, gap ladder and armor. No dice, no staged fight, no turns. The level is the soldier's level
// where the two times are equal, found by halving between whole levels; between two whole levels the balance is read on
// a straight line. Nothing is measured at one level and used at another, so the standard soldier comes out at its own
// level at every level whatever the rules are, and the equation has no lever of its own.
//
// Left out (D-400, D-401): reaction time, threats, wounds and morale penalties on rolls, damage to single parts and the
// limits on where a blow may land, parry strike-backs, fatigue, and situational modifiers (light, cover, numbers). A
// missile is read against the standing defense as if it could stop it; the blows a longer reach lands while the soldier
// closes count through `range`.
import type { Actor, AttackMode, DefenseKind, GameState, ItemDef, ItemInstance } from '../types';
import { CONFIG } from '../config';
import { HEALTH_LEVELS, TIERS, type HealthLevelKey } from '../scales';
import { getLibrary, itemDef } from '../library';
import { equipLoadout } from '../library/spawn';
import { armorMultiplier, armorStop, shieldPool } from '../library/gearScale';
import { RC, BT } from '../library/raceIds';
import { SK, DEFENSE_SKILL } from '../library/skillIds';
import { IF } from '../library/tableIds';
import { PK } from '../library/perkIds';
import { armorLayers, blowDamage, defenseOwnMods, gapShiftsOf, hostileCloseMods, ladder, sumShifts, rollSetup, throughArmor, weaponHitMods, type ArmorLayer } from '../ruleset';
import { freeGrips, hitTable, totalHp } from '../ruleset/body';
import { fearCost, healthFear, maxMorale, tierCostMult } from '../ruleset/morale';
import { blockItem, defenseItem, gripSlot, isGripSlot, isHeld, isWorn, modeSkill, usableDefense, usableModes } from '../ruleset/gear';
import { boostAdd, hasPerk } from '../ruleset/perks';
import { chainRewards } from '../ruleset/achRewards';
import { attackSecs, rollOdds, tierOdds } from '../ruleset/expect';
import { moveSpeed } from './speed';

/** a copy of the actor as it would start a fight: unhurt, calm, rested, shields whole, no marks, holds or pressure, and
 * with its weapons drawn (BG-1583): the most-full set of the weapons and shields it carries that rates highest is in hand */
export function freshCopy(state: GameState, a: Actor, id: string): Actor {
  const c: Actor = structuredClone({ ...a, mind: undefined, journal: undefined, progression: a.progression ? { ...a.progression, xpLog: [] } : undefined });
  c.id = id;
  c.core.condition = { hpLostPct: 0, parts: {}, status: [], moraleLost: 0 };
  c.core.inventory = c.core.inventory.map((i) => (i.pools?.shield === undefined ? i : { ...i, pools: { ...i.pools, shield: 100 } }));
  for (const k of ['engagement', 'perkMarks', 'playingDead', 'playDeadOpen', 'feint', 'asleep', 'heldBy', 'holding', 'pressure', 'react', 'carry'] as const) delete (c as Record<string, unknown>)[k];
  c.posture = 'open' as never;
  return readied(state, c);
}

/** BG-1583: `c` holding, of every most-full set of the weapons and shields it carries that its grips can hold, the one
 * whose combat level is highest (the first on a tie); with one such set, that set */
function readied(state: GameState, c: Actor): Actor {
  for (const i of c.core.inventory) if (isHeld(i)) delete i.equippedIn;
  const grips = freeGrips(state, c).map(gripSlot), need = (i: ItemInstance) => itemDef(state, i.itemId).grips ?? 1;
  const arms = c.core.inventory.filter((i) => { const d = itemDef(state, i.itemId); return (!!d.weapon || !!d.shield) && !isWorn(i) && need(i) <= grips.length; });
  const sets = new Map<string, ItemInstance[]>(); // keyed by the pieces' ids, so two of the same piece are one set
  const grow = (from: number, set: ItemInstance[], used: number): void => {
    for (let k = from; k < arms.length; k++) if (used + need(arms[k]) <= grips.length) grow(k + 1, [...set, arms[k]], used + need(arms[k]));
    if (arms.every((i) => set.includes(i) || used + need(i) > grips.length)) sets.set(set.map((i) => i.itemId).sort().join(), set);
  };
  grow(0, [], 0);
  const put = (set: ItemInstance[]) => { let g = 0; for (const i of arms) delete i.equippedIn; for (const i of set) i.equippedIn = grips.slice(g, (g += need(i))); };
  let best: ItemInstance[] = [], top = -Infinity;
  if (sets.size > 1) for (const set of sets.values()) { put(set); const L = combatParts(state, c).level; if (L > top) { top = L; best = set; } }
  else best = [...sets.values()][0] ?? [];
  put(best);
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

/** the fears a falling health sets off for an actor, in order: the share of health lost where each level starts, the
 * fear's cost and whether a morale roll scales it */
function healthFears(a: Actor): { from: number; cost: number; rolled: boolean }[] {
  const track = CONFIG.HEALTH_TRACK, out: { from: number; cost: number; rolled: boolean }[] = [];
  for (let i = 1; i < track.length; i++) {
    const f = healthFear(a, track[i][0]);
    if (f && HEALTH_LEVELS.pos(track[i][0] as HealthLevelKey) < HEALTH_LEVELS.pos('incapacitated')) out.push({ from: track[i - 1][1] / 100, cost: fearCost(a, f), rolled: !!f.rolled });
  }
  return out;
}
/** the share of its health an actor still has to lose, on average, before it is out of the fight: all of it when its nerve
 * holds, less when a health fear breaks it first. `odds`: the tier chances of its morale roll; `max`: its max morale. */
function nerve(odds: [number, number][], max: number, fears: { from: number; cost: number; rolled: boolean }[]): number {
  let left = max, holds = 1, share = 0;
  for (const f of fears) {
    const cost = (l: number) => (f.rolled ? f.cost * tierCostMult(l) : f.cost);
    const breaks = odds.reduce((n, [l, p]) => n + (cost(l) >= left ? p : 0), 0);
    share += holds * breaks * f.from;
    holds *= 1 - breaks;
    if (!(holds > 0)) return share;
    left -= odds.reduce((n, [l, p]) => n + (cost(l) >= left ? 0 : p * cost(l)), 0) / (1 - breaks); // what it paid, on average, when it held
  }
  return share + holds;
}

/** one attack as the equation reads it: its mode, its roll's tier chances, its damage at a multiplier of 1 (the damage step
 * on a shield: no armor), the soak it pierces, what it does to a shield's pool, its seconds and its reach */
type Attack = { mode: AttackMode; odds: [number, number][]; damage: number; pierce: number; onPool: number; secs: number; reach: number; ranged: boolean };
/** a defense as the equation reads it: its kind and its roll's tier chances */
type Guard = { kind: DefenseKind; odds: [number, number][] };
/** a sheet as the equation reads it: its attacks, its defense (and the one it falls back on once its shield is broken),
 * its armor over its hit table, its health and nerve, its shield's pool and its run */
type Sheet = {
  actor: Actor; attacks: Attack[]; guard: Guard; after?: Guard;
  parts: { w: number; layers: ArmorLayer[] }[]; rows: Map<number, { w: number; share: number; soak: number }[]>; hide: number; frame: number;
  health: number; nerve: number; pool: number; run: number;
};

/** reads a fresh actor's sheet: every number is one the ruleset already works out (roll set-ups, the damage step, armor) */
function readSheet(state: GameState, a: Actor): Sheet {
  const attacks = usableModes(state, a).map((m): Attack => {
    const { mode } = m, ranged = mode.tree === 'ranged', skill = modeSkill(mode);
    // a ranged mode is read with its foe in reach (the hostile-close modifier): the equation's fight is the contact fight
    const su = rollSetup({ actorId: a.id, skill, modifiers: [...weaponHitMods(mode, mode.id), ...(ranged ? hostileCloseMods(a) : [])], tierShifts: [], itemId: m.itemId, rollKind: 'hit', contest: true, standInFns: mode.standInFns, blend: mode.blend, attackKind: ranged ? 'ranged' : 'melee' }, state, a);
    return {
      mode, odds: [...tierOdds(su)], damage: blowDamage(state, a, a, mode, 'shield', 1, null, m.itemId).damage, pierce: boostAdd(a, skill, 'armorPierce', ranged ? 'ranged' : 'melee'),
      onPool: mode.tree === 'melee' && mode.class === 'heavy' && hasPerk(a, PK.shield_breaker) ? CONFIG.SHIELD_BREAKER_MULT : 1,
      secs: attackSecs(state, a, m), reach: mode.reach, ranged,
    };
  });
  const guardOf = (d: Actor): Guard => {
    const kind = usableDefense(state, d, false);
    return { kind, odds: [...tierOdds(rollSetup({ actorId: d.id, skill: DEFENSE_SKILL[kind], modifiers: defenseOwnMods(state, d, kind, false), tierShifts: [], itemId: defenseItem(state, d, kind)?.id, rollKind: kind, contest: true }, state, d))] };
  };
  const guard = guardOf(a), shield = guard.kind === 'block' ? blockItem(state, a) : null;
  const pool = shield ? itemDef(state, shield.itemId).shield!.pool / (hasPerk(a, PK.iron_rim) ? CONFIG.IRON_RIM_MULT : 1) : 0;
  // once the pool is gone the shield blocks nothing: the defense the same actor falls back on
  const after = shield ? guardOf({ ...a, core: { ...a.core, inventory: a.core.inventory.map((i) => (i.id === shield.id ? { ...i, pools: { ...i.pools, shield: 0 } } : i)) } }) : undefined;
  return {
    actor: a, attacks, guard, after,
    parts: hitTable(state, a).map((row) => ({ w: (row.to - row.from + 1) / 100, layers: armorLayers(state, a, row.part) })), rows: new Map(),
    hide: hasPerk(a, PK.thick_hide) ? CONFIG.THICK_HIDE_MULT : 1, frame: hasPerk(a, PK.fighters_frame) ? CONFIG.FIGHTERS_FRAME_MULT : 1,
    health: totalHp(state, a), nerve: nerve([...rollOdds({ actorId: a.id, skill: SK.resolve, modifiers: [], tierShifts: [] }, state, a)], maxMorale(a), healthFears(a)),
    pool, run: moveSpeed(state, a).run,
  };
}

/** a sheet's armor over its hit table against a blow that pierces this much soak: each part's share and soak, by how often it is hit */
function rowsOf(s: Sheet, pierce: number) {
  let rows = s.rows.get(pierce);
  if (!rows) s.rows.set(pierce, rows = s.parts.map((p) => ({ w: p.w, ...throughArmor(p.layers, pierce) })));
  return rows;
}
/** the chance of each gap (defense tier − attack tier, moved by the ruleset's own gap shifts) when this attack meets this
 * guard; an attack under a Near Miss never lands and is left out */
function gapChances(state: GameState, att: Attack, def: Sheet, guard: Guard): [number, number][] {
  const out = new Map<number, number>(), nearMiss = TIERS.pos('near_miss');
  for (const [la, pa] of att.odds) {
    if (la < nearMiss) continue;
    for (const [ld, pd] of guard.odds) {
      const g = ld - la + sumShifts(gapShiftsOf(state, def.actor, att.mode, guard.kind, ld - la));
      out.set(g, (out.get(g) ?? 0) + pa * pd);
    }
  }
  return [...out];
}
/** the health an attack's average blow removes, as the damage step works it out: over the gaps (those under `below` only)
 * and the defender's hit table, ladder × damage, Thick Hide, the armor's share, less its soak, then Fighter's Frame */
function averageBlow(att: Attack, def: Sheet, kind: DefenseKind, gaps: [number, number][], below = Infinity): number {
  const one = (share: number, soak: number) => gaps.reduce((n, [g, p]) => n + (g < below ? p * Math.max(0, ladder(kind, g) * att.damage * def.hide * share - soak) : 0), 0);
  return rowsOf(def, att.pierce).reduce((n, r) => n + r.w * one(r.share, r.soak), 0) * (att.ranged ? 1 : def.frame);
}
/** the blows this attack needs to defeat this sheet: its health × nerve ÷ the average blow. A blocker's shield first takes
 * the blows it blocks (gap HIT_GAPS.shieldFrom and up) until its pool is gone; then it defends as it can without it. */
function blowsToDefeat(state: GameState, att: Attack, def: Sheet): number {
  const health = def.health * def.nerve, gaps = gapChances(state, att, def, def.guard);
  if (!def.after || !(def.pool > 0)) return health / averageBlow(att, def, def.guard.kind, gaps);
  const from = CONFIG.HIT_GAPS.shieldFrom;
  const past = averageBlow(att, def, 'block', gaps, from); // what gets past the shield, a blow
  const onPool = gaps.reduce((n, [g, p]) => n + (g >= from ? p * ladder('block', g) * att.damage * att.onPool : 0), 0); // what its pool takes, a blow
  const lasts = onPool > 0 ? def.pool / onPool : Infinity; // the blows until it breaks
  if (health <= past * lasts) return health / past;
  return lasts + (health - past * lasts) / averageBlow(att, def, def.after.kind, gapChances(state, att, def, def.after));
}

let soldiers: { lib: unknown; at: Map<number, Sheet> } | undefined;
/** the standard soldier's sheet at a whole level, read once per library */
function soldier(state: GameState, n: number): Sheet {
  if (soldiers?.lib !== getLibrary()) soldiers = { lib: getLibrary(), at: new Map() };
  let s = soldiers.at.get(n);
  if (!s) { const { S, ref } = refFighter(state, n, '__ref'); soldiers.at.set(n, s = readSheet(S, ref)); }
  return s;
}

/** the two sides of the even fight against the standard soldier of a whole level: the seconds each needs to defeat the
 * other with its best attack, and `lead` = ln(mine ÷ its): under 0 the actor is ahead, over 0 the soldier is */
function fight(state: GameState, me: Sheet, n: number) {
  const sol = soldier(state, n);
  let its = Infinity, itsReach = sol.attacks[0]?.reach ?? 0;
  for (const m of sol.attacks) { const t = blowsToDefeat(state, m, me) * m.secs; if (t < its) { its = t; itsReach = m.reach; } }
  let mine = Infinity, attack: Attack | undefined = me.attacks[0], range = 1;
  for (const m of me.attacks) {
    const r = 1 + Math.max(0, m.reach - itsReach) / (sol.run * its); // the blows it lands while the soldier runs in
    const t = (blowsToDefeat(state, m, sol) * m.secs) / r;
    if (t < mine) { mine = t; attack = m; range = r; }
  }
  const lead = mine === Infinity ? (its === Infinity ? 0 : Infinity) : its === Infinity ? -Infinity : Math.log(mine / its);
  return { mine, its, lead, attack, range };
}

/** the even fight of a fresh sheet against the standard soldier of one whole level (tests read it) */
export const fightAt = (state: GameState, a: Actor, n: number) => fight(state, readSheet(state, a), n);

/** the whole level the search stops at when nothing the soldier grows into can beat the sheet (the equation has no ceiling of its own) */
const SEARCH_END = 2 ** 20;
/** the equation's parts for one sheet (see the top of the file): the two whole soldier levels the even fight lies
 * between, the level on the straight line between them, and the fight against the lower one */
export function combatParts(state: GameState, a: Actor) {
  const me = readSheet(state, a), seen = new Map<number, ReturnType<typeof fight>>();
  const at = (n: number) => { let f = seen.get(n); if (!f) seen.set(n, f = fight(state, me, n)); return f; };
  let lo = 0, hi = 64;
  if (at(0).lead > 0) return { level: 0, below: 0, ...at(0) };
  while (!(at(hi).lead > 0) && hi < SEARCH_END) { lo = hi; hi *= 2; }
  while (hi - lo > 1) { const mid = (lo + hi) / 2; if (at(mid).lead > 0) hi = mid; else lo = mid; }
  const l = at(lo).lead, h = at(hi).lead;
  const part = h > 0 ? (Number.isFinite(l) ? (Number.isFinite(h) ? -l / (h - l) : 0) : Number.isFinite(h) ? 1 : 0.5) : 1;
  return { level: lo + part, below: lo, ...at(lo) };
}

const cache = new Map<string, number>();
/** the sheet the combat level reads: true skills to the nearest whole point, so a skill's slow growth in play does not
 * work the level out afresh every turn (a fraction of a point moves it by a fraction of a level) */
function wholeSkills(a: Actor): Actor {
  const sk = a.core.skills;
  if (Object.values(sk).every((x) => Number.isInteger(x.raw))) return a;
  return { ...a, core: { ...a.core, skills: Object.fromEntries(Object.entries(sk).map(([k, x]) => [k, { ...x, raw: Math.round(x.raw) }])) } };
}
/** the sheet that sets a combat level: everything but the moment (condition, marks, holds, what is in hand) and XP-only achievements */
const sheetKey = (a: Actor): string => JSON.stringify([a.core.raceId, a.core.bodyTypeId, a.core.prefix, a.core.skills, a.core.perks, a.core.classes, a.core.inventory.map((i) => [i.itemId, i.equippedIn?.filter((e) => !isGripSlot(e)), i.boundTo]), a.core.standingDefense, a.core.bornDay, a.core.hollowed, (a.progression?.achievements ?? []).filter((x) => !x.replacedBy && countsInFight(x.key)).map((x) => x.key).sort()]);
/** an achievement that can change a fight: one with a reward beyond XP, or a defeats row (Bane and total-defeats roll
 * bonuses). XP-only rows leave the sheet's combat level as it was, so earning one does not work it out afresh. */
function countsInFight(key: string | undefined): boolean {
  const d = key ? getLibrary().achievements?.[key] : undefined;
  return !!d && (d.rule === 'defeats' || chainRewards(d).length > 0);
}

/** PLACEHOLDER: the combat level: the level of the standard soldier this actor fights evenly, by the equation at the top
 * of the file, on the actor as it would start a fight. Read at whole skill points and cached by sheet. */
export function combatLevel(state: GameState, a0: Actor): number {
  const a = wholeSkills(a0), key = sheetKey(a);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const L = combatParts(state, freshCopy(state, a, a.id)).level;
  cache.set(key, L);
  return L;
}
/** forget every cached combat level (a model setting changed) */
export const clearCombatLevels = (): void => { cache.clear(); soldiers = undefined; };
