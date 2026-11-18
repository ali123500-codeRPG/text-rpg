// PLACEHOLDER: the combat rating's equation. An actor's combat level is the level of the standard soldier it fights evenly
// (the reference fighter: MODEL_REF_SKILLS at the level, relics of MODEL_REF_KIT whose requirement is the level). A fight
// is even when each side defeats the other in the same time, and a side's time is the health it must remove ÷ the health
// its average blow removes a second. Around the standard soldier at COMBAT_PIVOT the average blow moves with five
// numbers: the attack total and the defense total of the two rolls, the soak share (soak ÷ what a blow brings), the blow's
// damage and the armor's share. Writing the even fight with those rates (measured between the soldiers COMBAT_SPAN levels
// either side of the pivot) and solving it for the soldier's level gives the equation, with no fight staged:
//
//   base  = (bA × attack total + bD × defense total + c × soak share) ÷ K          (each total as the rolls add it up)
//   level = base + ln(health ÷ its health × its seconds ÷ seconds × (damage ÷ its damage)^e × its share ÷ share × range)
//                  ÷ (K + health a level ÷ its health)                              ("its": the standard soldier's at base)
//
// The standard soldier comes out at its own level at every level. Left out: reaction time, threats, wounds and morale
// penalties on rolls, part damage, parry strike-backs, fatigue, the dodge and block ladders' own shapes past the shield,
// a defender's gap-shift perks (Turn Aside, Slip the Blow), and situational modifiers (light, cover, numbers).
import type { Actor, DefenseKind, GameState, ItemDef } from '../types';
import { CONFIG } from '../config';
import { HEALTH_LEVELS, TIERS, type HealthLevelKey } from '../scales';
import { getLibrary, itemDef } from '../library';
import { equipLoadout } from '../library/spawn';
import { armorMultiplier, armorStop, shieldPool } from '../library/gearScale';
import { RC, BT } from '../library/raceIds';
import { SK, DEFENSE_SKILL } from '../library/skillIds';
import { IF } from '../library/tableIds';
import { PK } from '../library/perkIds';
import { armorOn, blowDamage, defenseOwnMods, hostileCloseMods, ladder, modTotal, sumShifts, rollSetup, weaponHitMods } from '../ruleset';
import { hitTable, totalHp } from '../ruleset/body';
import { fearCost, healthFear, maxMorale, tierCostMult } from '../ruleset/morale';
import { blockItem, defenseItem, modeSkill, usableDefense, usableModes } from '../ruleset/gear';
import { hasPerk } from '../ruleset/perks';
import { chainRewards } from '../ruleset/achRewards';
import { attackSecs, rollOdds, tierOdds } from '../ruleset/expect';
import { moveSpeed } from './speed';

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

/** the chance of each tier level on a roll whose skill and modifiers add up to `total` (SKILL_WEIGHT × skill + modifiers),
 * by a roller with no perks of its own: every d100 face once, tiers with no end as in every balance model */
const tierChances = (bare: Actor, total: number): [number, number][] =>
  [...tierOdds({ actor: bare, eff: { skill: '', value: total / CONFIG.SKILL_WEIGHT }, modifiers: [], shifts: [], reach: { up: 0, down: 0 } })];
/** the chance of each gap (defense tier − attack tier, moved by `shift`) between two roll totals; an attack under a Near
 * Miss never lands and is left out */
function gapChances(bare: Actor, attack: number, defense: number, shift = 0): [number, number][] {
  const out = new Map<number, number>(), nearMiss = TIERS.pos('near_miss'), def = tierChances(bare, defense);
  for (const [la, pa] of tierChances(bare, attack)) if (la >= nearMiss) for (const [ld, pd] of def) out.set(ld - la + shift, (out.get(ld - la + shift) ?? 0) + pa * pd);
  return [...out];
}
/** the average blow as a multiple of what it brings (damage × the armor's share): the gap ladder's multiplier less the
 * soak share, never under 0, over a contest's gaps */
const through = (gaps: [number, number][], kind: DefenseKind, soakShare: number): number =>
  gaps.reduce((n, [g, p]) => n + p * Math.max(0, ladder(kind, g) - soakShare), 0);

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

/** one attack as the equation reads it: its roll total, its tier shifts, its damage at a multiplier of 1, its seconds and its reach */
type Attack = { total: number; shifts: number; damage: number; secs: number; reach: number; heavy: boolean };
/** a sheet as the equation reads it: its attacks, its defense roll, its armor over its hit table, its health and nerve,
 * and the shield it blocks with */
type Sheet = { attacks: Attack[]; defense: number; defShifts: number; share: number; soak: number; health: number; nerve: number; pool: number; resolve: number; morale: number };

/** reads a fresh actor's sheet: every number is one the ruleset already works out (roll set-ups, the damage step, armor) */
function readSheet(state: GameState, a: Actor): Sheet {
  const total = (su: { eff: { value: number }; modifiers: { type: string; value: number }[] }) => CONFIG.SKILL_WEIGHT * su.eff.value + modTotal(su.modifiers);
  const attacks = usableModes(state, a).map((m): Attack => {
    const { mode } = m, ranged = mode.tree === 'ranged';
    // a ranged mode is read with its foe in reach (the hostile-close modifier): the equation's fight is the contact fight
    const su = rollSetup({ actorId: a.id, skill: modeSkill(mode), modifiers: [...weaponHitMods(mode, mode.id), ...(ranged ? hostileCloseMods(a) : [])], tierShifts: [], itemId: m.itemId, rollKind: 'hit', contest: true, standInFns: mode.standInFns, blend: mode.blend, attackKind: ranged ? 'ranged' : 'melee' }, state, a);
    // the raw blow: the damage step on a shield (no armor), whoever holds it
    return { total: total(su), shifts: sumShifts(su.shifts), damage: blowDamage(state, a, a, mode, 'shield', 1, null).damage, secs: attackSecs(state, a, m), reach: mode.reach, heavy: !ranged && mode.class === 'heavy' };
  });
  const type = usableDefense(state, a, false), blocker = defenseItem(state, a, type);
  const def = rollSetup({ actorId: a.id, skill: DEFENSE_SKILL[type], modifiers: defenseOwnMods(state, a, type, false), tierShifts: [], itemId: blocker?.id, rollKind: type, contest: true }, state, a);
  // armor over the hit table: each part's share and soak by how often it is hit (All-50 Thick Hide and Fighter's Frame scale the blow)
  const hide = hasPerk(a, PK.thick_hide) ? CONFIG.THICK_HIDE_MULT : 1, frame = hasPerk(a, PK.fighters_frame) ? CONFIG.FIGHTERS_FRAME_MULT : 1;
  let share = 0, soak = 0;
  for (const row of hitTable(state, a)) { const w = (row.to - row.from + 1) / 100, on = armorOn(state, a, row.part); share += w * on.share * hide * frame; soak += w * on.soak * frame; }
  const shield = type === 'block' ? blockItem(state, a) : null;
  const pool = shield ? itemDef(state, shield.itemId).shield!.pool / (hasPerk(a, PK.iron_rim) ? CONFIG.IRON_RIM_MULT : 1) : 0;
  const res = rollSetup({ actorId: a.id, skill: SK.resolve, modifiers: [], tierShifts: [] }, state, a);
  const morale = maxMorale(a);
  return { attacks, defense: total(def), defShifts: sumShifts(def.shifts), share, soak, health: totalHp(state, a), nerve: nerve([...rollOdds({ actorId: a.id, skill: SK.resolve, modifiers: [], tierShifts: [] }, state, a)], morale, healthFears(a)), pool, resolve: total(res), morale };
}

/** the equation's rates, read once per library off the standard soldier and the tier and gap tables */
export type Rates = {
  attack: number; defense: number; soakShare: number; resolve: number; // the standard soldier's roll totals and soak share for each level
  damage: number; secs: number; share: number; reach: number; run: number; // its blow, its armor's share, its reach and its run
  health: (L: number) => number; healthStep: number; nerve: (L: number) => number;
  gaps: [number, number][]; kind: DefenseKind; // the pivot contest's gaps and the ladder they are read on
  bA: number; bD: number; c: number; e: number; K: number; // the average blow's rates of change (see the top of the file)
  tierA: number; tierD: number; // what one tier of shift on an attack or a defense is worth in roll total
  fightS: number; // how long the pivot's own fight lasts
};
let rates: { lib: unknown; r: Rates } | undefined;
export function combatRates(state: GameState): Rates {
  if (rates?.lib === getLibrary()) return rates.r;
  const p = CONFIG.COMBAT_PIVOT, h = CONFIG.COMBAT_SPAN, kind = CONFIG.MODEL_REF_DEFENSE;
  const at = (L: number) => { const { S, ref } = refFighter(state, L, '__ref'); return { S, ref, s: readSheet(S, ref) }; };
  const P = at(p), Z = at(0), s = P.s, hit = s.attacks[0];
  const attack = hit.total / p, defense = s.defense / p, soakShare = s.soak / (hit.damage * s.share) / p, resolve = s.resolve / p;
  const avg = (dA: number, dD: number, dS: number, shift = 0) => through(gapChances(Z.ref, attack * (p + dA), defense * (p + dD), shift), kind, soakShare * (p + dS));
  const rate = (hi: number, lo: number, span: number) => (Math.log(hi) - Math.log(lo)) / span;
  const now = avg(0, 0, 0);
  const bA = rate(avg(h, 0, 0), avg(-h, 0, 0), 2 * h * attack), bD = -rate(avg(0, h, 0), avg(0, -h, 0), 2 * h * defense), c = -rate(avg(0, 0, h), avg(0, 0, -h), 2 * h * soakShare);
  const healthStep = (P.s.health - Z.s.health) / p, moraleStep = (P.s.morale - Z.s.morale) / p, fears = healthFears(Z.ref);
  const r: Rates = {
    attack, defense, soakShare, resolve, damage: hit.damage, secs: hit.secs, share: s.share, reach: hit.reach, run: moveSpeed(P.S, P.ref).run,
    health: (L) => Z.s.health + healthStep * L, healthStep, nerve: (L) => nerve(tierChances(Z.ref, resolve * L), Z.s.morale + moraleStep * L, fears),
    gaps: gapChances(Z.ref, attack * p, defense * p), kind, bA, bD, c, e: 1 + c * soakShare * p, K: bA * attack + bD * defense + c * soakShare,
    tierA: rate(avg(0, 0, 0, -1), now, bA), tierD: rate(now, avg(0, 0, 0, 1), bD),
    fightS: (P.s.health * hit.secs) / (hit.damage * s.share * now),
  };
  rates = { lib: getLibrary(), r };
  return r;
}

/** the health a shield's pool is worth: while it lasts it takes the blows a block stops (gap HIT_GAPS.shieldFrom and up),
 * and each pool point saves what those blows would have cost the body, at the pivot contest's gaps */
function shieldWorth(k: Rates, s: Sheet, soakShare: number): number {
  if (!s.pool) return 0;
  const from = CONFIG.HIT_GAPS.shieldFrom, body = (kind: DefenseKind, g: number) => Math.max(0, ladder(kind, g) - soakShare);
  const taken = k.gaps.reduce((n, [g, p]) => n + (g >= from ? p * ladder('block', g) : 0), 0);
  const saved = k.gaps.reduce((n, [g, p]) => n + p * (body(k.kind, g) - (g >= from ? 0 : body('block', g))), 0);
  return taken > 0 ? Math.max(0, (s.pool * s.share * saved) / taken) : 0;
}

/** the equation's parts for one sheet (see the top of the file): the best of its attacks */
export function combatParts(state: GameState, a: Actor) {
  const k = combatRates(state), s = readSheet(state, a);
  const share = Math.max(s.share, 1e-9), soakShare = s.soak / (k.damage * share); // soak as a share of what the soldier's blow brings
  const health = s.health * s.nerve + shieldWorth(k, s, soakShare);
  const defense = s.defense + k.tierD * s.defShifts;
  let best = { level: 0, base: 0, attackLevel: 0, defenseLevel: defense / k.defense, soakLevel: soakShare / k.soakShare, ratio: 0, perDoubling: 0, health, damage: 0, secs: 0, range: 1 };
  for (const m of s.attacks) {
    // a heavy blow is harder to parry or block (HEAVY_VS_BLOCK_GAP), a tier shift in its favor
    const attack = m.total + k.tierA * (m.shifts - (m.heavy && k.kind !== 'dodge' ? CONFIG.HEAVY_VS_BLOCK_GAP : 0));
    const base = Math.max(0, (k.bA * attack + k.bD * defense + k.c * soakShare) / k.K);
    const range = 1 + Math.max(0, m.reach - k.reach) / (k.run * k.fightS); // the blows it lands while the soldier runs in
    const ratio = (health / (k.health(base) * k.nerve(base))) * (k.secs / m.secs) * (m.damage / k.damage) ** k.e * (k.share / share) * range;
    const per = 1 / (k.K + k.healthStep / k.health(base));
    const level = ratio > 0 ? Math.max(0, base + per * Math.log(ratio)) : 0;
    if (level > best.level || !best.secs) best = { ...best, level, base, attackLevel: attack / k.attack, ratio, perDoubling: per * Math.LN2, damage: m.damage, secs: m.secs, range };
  }
  return best;
}

const cache = new Map<string, number>();
/** the sheet the combat level reads: true skills to the nearest whole point, so a skill's slow growth in play does not
 * work the level out afresh every turn (a fraction of a point moves it by a fraction of a level) */
function wholeSkills(a: Actor): Actor {
  const sk = a.core.skills;
  if (Object.values(sk).every((x) => Number.isInteger(x.raw))) return a;
  return { ...a, core: { ...a.core, skills: Object.fromEntries(Object.entries(sk).map(([k, x]) => [k, { ...x, raw: Math.round(x.raw) }])) } };
}
/** the sheet that sets a combat level: everything but the moment (condition, marks, holds) and XP-only achievements */
const sheetKey = (a: Actor): string => JSON.stringify([a.core.raceId, a.core.bodyTypeId, a.core.prefix, a.core.skills, a.core.perks, a.core.classes, a.core.inventory.map((i) => [i.itemId, i.equippedIn, i.boundTo]), a.core.standingDefense, a.core.bornDay, a.core.hollowed, (a.progression?.achievements ?? []).filter((x) => !x.replacedBy && countsInFight(x.key)).map((x) => x.key).sort()]);
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
  const L = combatParts(state, freshCopy(a, a.id)).level;
  cache.set(key, L);
  return L;
}
/** forget every cached combat level (a model setting changed) */
export const clearCombatLevels = (): void => { cache.clear(); rates = undefined; };
