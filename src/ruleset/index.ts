// W2 — Ruleset and gear maths. Part 1 §3–4, Part 3, Part 5 §2–6.
// Contract: the eight Ruleset methods plus the helpers below. Every number comes from CONFIG.
import type {
  Actor, AttackRequest, AttackResult, CheckRequest, CheckResult, ContestResult, Effect, GameState, Mod,
  PartState, Rng, RollRequest, RollResult, Ruleset, SituationResult, Tier, TierRoll, TierShift,
} from '../types';
import { CONFIG } from '../config';
import { TIERS } from '../scales';
import { creatureType, itemDef } from '../library';
import { actorById, isActive, hostile, shortestPath, zoneById } from '../engine/relations';
import { adjacent, healthLevel, hitTable, partPct, poolState, totalHp, woundsMods } from './body';
import { markUse } from './improve';
import { hasPerk } from './perks';
import { markShifts } from '../engine/perkMarks';
import { blockItem, effectiveSkill, handsOf, modeSkill, pickTool, resolveMode, rollMods, situationMods } from './gear';

export { totalHp, healthLevel, partStates, woundsMods, hitTable } from './body';
export { improveMarked, markEndurance, markUse } from './improve';
export { MILESTONES, ALL_STEPS, PERKS_NEEDED, hasPerk, ladderPerksIn, trueSkill, milestonePerk, milestoneState, canTake, takePerk, canUndo, undoPerk } from './perks';
export type { MilestoneState } from './perks';
export { defaultStandingDefense, effectiveSkill, usableModes, defaultMode, modeSkill, situationMods, pickTool } from './gear';

// Tiers are keys of the TIERS table (src/scales.ts). Arithmetic (shifts, gaps) works on a tier's level: its row
// position plus `beyond`, the steps a shifted roll went past either end (Part 1 §4: shifted tiers are not clamped).
type Tiered = TierRoll;
/** just the tier part of a roll, for lines and views */
export const tierPart = (r: Tiered): Tiered => (r.beyond ? { tier: r.tier, beyond: r.beyond } : { tier: r.tier });
/** a tier's level: row position in TIERS plus any steps past the end */
export const tierLevel = (t: Tier | Tiered): number => (typeof t === 'string' ? TIERS.pos(t) : TIERS.pos(t.tier) + (t.beyond ?? 0));
/** the tier at a level; past either end it keeps the end tier and how far past it is */
export function tierAt(level: number): Tiered {
  const tier = TIERS.at(level);
  const beyond = level - TIERS.pos(tier);
  return beyond ? { tier, beyond } : { tier };
}
/** is tier `t` at or above tier `k` */
export const tierAtLeast = (t: Tier | Tiered, k: Tier): boolean => tierLevel(t) >= TIERS.pos(k);
/** display name; a tier past either end shows the end name with one + or − per step past it (Ali, 07/11/2026) */
export function tierName(t: Tier | Tiered): string {
  const tier = typeof t === 'string' ? t : t.tier;
  const past = typeof t === 'string' ? 0 : t.beyond ?? 0;
  return TIERS.name(tier) + (past > 0 ? '+'.repeat(past) : '−'.repeat(-past));
}

/** Stacking within one modifier type (Part 1 §4). */
export function stackType(values: number[]): number {
  const w = [1, CONFIG.STACK_2, CONFIG.STACK_3];
  const part = (xs: number[]) => xs.reduce((s, x, i) => s + x * (w[i] ?? 0), 0);
  return part(values.filter((v) => v > 0).sort((a, b) => b - a)) + part(values.filter((v) => v < 0).sort((a, b) => a - b));
}
/** sum of all modifiers, each type stacked within itself */
export function modTotal(mods: { type: string; value: number }[]): number {
  const byType = new Map<string, number[]>();
  for (const m of mods) byType.set(m.type, [...(byType.get(m.type) ?? []), m.value]);
  return [...byType.values()].reduce((s, vs) => s + stackType(vs), 0);
}

/** Layer 2b margin bands: the lowest margin for each tier above the worst */
const MARGIN_BANDS = [-75, -25, 0, 25, 75];
/** the tier level a margin reaches */
export function band(margin: number): number {
  return MARGIN_BANDS.filter((t) => margin >= t).length;
}
export function naturalEdge(d: number): -2 | -1 | 0 | 1 | 2 {
  return d === 1 ? -2 : d <= 5 ? -1 : d === 100 ? 2 : d >= 96 ? 1 : 0;
}
const sumShifts = (s: TierShift[]) => s.reduce((t, x) => t + x.value, 0);
function tierOf(d: number, skill: number, mods: Mod[], shifts: TierShift[]): number {
  return band(d + CONFIG.SKILL_WEIGHT * skill + modTotal(mods) - CONFIG.ROLL_NEEDED) + naturalEdge(d) + sumShifts(shifts);
}

function mustActor(state: GameState, id: string): Actor {
  const a = actorById(state, id);
  if (!a) throw new Error(`unknown actor ${id}`);
  return a;
}

/** gap ladder (Part 3, Defense); a gap past ±5 uses the ±5 entry */
export function ladder(type: 'dodge' | 'block', gap: number): number {
  return CONFIG.GAP_LADDER[type][Math.max(-5, Math.min(5, gap))];
}
type LocRule = 'any' | 'no_essential' | 'non_essential_only';
function locRule(type: 'dodge' | 'block', g: number): LocRule {
  if (type === 'dodge') return g >= 0 ? 'no_essential' : 'any'; // +1 graze: never essential, like the tie (OQ-17 settled 07/11/2026)
  return g >= 0 ? 'non_essential_only' : g === -1 ? 'no_essential' : 'any'; // GAP: block +1..+5 off-shield keep the gap-0 limit
}
function rowKey(type: 'dodge' | 'block', gap: number, shield: boolean): string {
  const g = Math.max(-5, Math.min(5, gap));
  return [ladder(type, g), locRule(type, g), g <= -3 ? 'anywhere' : g === -2 ? 'adjacent' : '', shield && g >= 0].join('|');
}

/** sources whose removal alone changes the roll's tier index; natural edges listed as lucky/fumble */
function decidingOf(r: RollResult, skill: number, gear: { source: string; value: number }[]): string[] {
  const out: string[] = [];
  if (r.natural) out.push(r.natural > 0 ? 'lucky' : 'fumble');
  r.modifiers.forEach((m, i) => {
    if (tierOf(r.d100, skill, r.modifiers.filter((_, j) => j !== i), r.tierShifts) !== tierLevel(r)) out.push(m.source);
  });
  for (const g of gear) if (tierOf(r.d100, skill - g.value, r.modifiers, r.tierShifts) !== tierLevel(r)) out.push(g.source);
  r.tierShifts.forEach((s, i) => {
    if (tierOf(r.d100, skill, r.modifiers, r.tierShifts.filter((_, j) => j !== i)) !== tierLevel(r)) out.push(s.source);
  });
  return out;
}

function roll(req: RollRequest, state: GameState, rng: Rng): RollResult {
  const actor = mustActor(state, req.actorId);
  const eff = effectiveSkill(state, actor, req.skill, { itemId: req.itemId });
  const modifiers = [...req.modifiers];
  if (req.auto !== false) {
    modifiers.push(...woundsMods(state, actor, eff.skill, { itemId: req.itemId }));
    if (req.rollKind) modifiers.push(...rollMods(state, actor, req.rollKind, req.itemId));
  }
  const d = rng.d100();
  const margin = d + CONFIG.SKILL_WEIGHT * eff.value + modTotal(modifiers) - CONFIG.ROLL_NEEDED;
  const level = band(margin) + naturalEdge(d) + sumShifts(req.tierShifts); // unclamped (Part 1 §4)
  return { actorId: actor.id, skill: eff.skill, d100: d, margin, ...tierAt(level), natural: naturalEdge(d), modifiers, tierShifts: [...req.tierShifts] };
}

function check(req: CheckRequest, state: GameState, _rng: Rng): CheckResult {
  const actor = mustActor(state, req.actorId);
  const tool = pickTool(state, actor, req.skill).itemId ?? undefined;
  const eff = effectiveSkill(state, actor, req.skill, { itemId: tool });
  const target = CONFIG.DIFFICULTY[state.hidden.stage.challenge];
  const passed = eff.value + req.modifiers.reduce((s, m) => s + m.value, 0) >= target;
  return { actorId: actor.id, skill: eff.skill, target, passed, modifiers: req.modifiers };
}

function contested(a: RollRequest, b: RollRequest, state: GameState, rng: Rng): ContestResult {
  const noAim = (r: RollRequest) => ({ ...r, modifiers: r.modifiers.filter((m) => m.type !== 'aim') });
  const ra = ruleset.roll(noAim(a), state, rng);
  const rb = ruleset.roll(noAim(b), state, rng);
  const gap = tierLevel(rb) - tierLevel(ra);
  return { a: ra, b: rb, gap, winner: gap < 0 ? 'a' : gap > 0 ? 'b' : 'tie' };
}

// Part 1 §4 table on totals (d100 + modifiers), read on the margin: total − 50 with the placeholder base
const SITUATION_BANDS = [-50, -25, 0, 25, 50];
function situation(actor: Actor, state: GameState, rng: Rng): SituationResult {
  const modifiers = situationMods(state, actor);
  const d = rng.d100();
  const margin = d + CONFIG.SITUATION_BASE + modTotal(modifiers) - 100;
  const tier = TIERS.at(SITUATION_BANDS.filter((t) => margin >= t).length + naturalEdge(d));
  return { actorId: actor.id, roll: d, tier, modifiers };
}

function attack(req: AttackRequest, state: GameState, rng: Rng): AttackResult {
  const A = mustActor(state, req.attackerId);
  const D = mustActor(state, req.targetId);
  const path = A.zone === D.zone ? [] : shortestPath(state, A.zone, D.zone, true);
  const dist = path ? path.length : Infinity;
  const { mode, name } = resolveMode(state, A, req.weaponId, req.modeId, dist);
  const ranged = mode.tree === 'ranged';
  const ct = creatureType(state, D.core.creatureTypeId);
  const zoneA = zoneById(state, A.zone);
  const zoneD = zoneById(state, D.zone);

  // 2. attack roll
  const am: Mod[] = [];
  const aimedPart = req.aimed && req.targetPart ? ct.parts.find((p) => p.id === req.targetPart) : undefined;
  if (aimedPart) am.push({ source: `aim: ${aimedPart.id}`, type: 'aim', value: CONFIG.AIM_PENALTY[aimedPart.size] });
  const cls = CONFIG.WEAPON_CLASSES[mode.class] ?? CONFIG.UNARMED_PROFILE;
  // GAP: the class hit has no modifier type of its own; it rides with the mode's hitAdj as one gear entry at full value
  const hit = cls.hit + (mode.hitAdj ?? 0);
  if (hit) am.push({ source: `weapon: ${name}`, type: 'gear', value: hit });
  if (ranged) {
    if (dist >= 1 && CONFIG.RANGE_MODS[dist]) am.push({ source: 'range', type: 'situational', value: CONFIG.RANGE_MODS[dist] });
    const crowded = [state.player, ...state.actors].some((o) => o.id !== A.id && o.zone === A.zone && isActive(o) && hostile(state, A, o));
    if (crowded && CONFIG.RANGE_MODS[0] && !hasPerk(A, 'point_blank')) am.push({ source: 'hostile in zone', type: 'situational', value: CONFIG.RANGE_MODS[0] });
  }
  const lightA = CONFIG.LIGHT_MODS[zoneD?.light ?? 'bright'];
  if (lightA) am.push({ source: 'light', type: 'situational', value: lightA });
  am.push(...(req.context?.attackerMods ?? []));
  const skill = modeSkill(mode);
  // A1 Hidden Strike: an attack on a target unaware of the owner lands one tier better
  const marks = markShifts(state, A, D, ranged); // A2, A5, A10
  const atkShifts: TierShift[] = [...(req.context?.defenderUnaware && hasPerk(A, 'hidden_strike') ? [{ source: 'Hidden Strike', value: 1 }] : []), ...marks.attack];
  const atk = ruleset.roll({ actorId: A.id, skill, modifiers: am, tierShifts: atkShifts, itemId: req.weaponId, rollKind: 'hit' }, state, rng);
  const atkEff = effectiveSkill(state, A, skill, { itemId: req.weaponId });
  const atkDeciding = decidingOf(atk, atkEff.value, atkEff.gear);

  const base: Omit<AttackResult, 'outcome' | 'deciding'> = {
    attack: atk, defense: null, defenseType: null, gap: null, gapShifts: [], location: null, locationHow: null,
    multiplier: 0, damage: 0, attackerId: A.id, targetId: D.id, weaponId: req.weaponId, modeId: mode.id,
  };
  if (!tierAtLeast(atk, 'near_miss')) return { ...base, outcome: 'missed', deciding: { attack: atkDeciding, defense: [], gap: [] } };

  // 3. defense roll with the standing defense
  let type: 'dodge' | 'block' = D.core.standingDefense;
  const blocker = type === 'block' ? blockItem(state, D) : null;
  if (!blocker) type = 'dodge'; // GAP: no working arm holding a shield or melee weapon, so the free reaction falls back to dodge
  const dm: Mod[] = [];
  if ((req.context?.defensesThisTurn ?? 0) >= 1) dm.push({ source: 'outnumbered', type: 'situational', value: CONFIG.OUTNUMBERED_MOD });
  if (req.context?.defenderUnaware) dm.push({ source: 'unaware', type: 'situational', value: CONFIG.UNAWARE_MOD });
  if (ranged && type === 'dodge') dm.push({ source: 'dodge vs missile', type: 'situational', value: CONFIG.DODGE_VS_MISSILE });
  const lightD = CONFIG.LIGHT_MODS[zoneA?.light ?? 'bright'];
  if (lightD) dm.push({ source: 'light', type: 'situational', value: lightD });
  dm.push(...(req.context?.defenderMods ?? []));
  const def = ruleset.roll({ actorId: D.id, skill: type, modifiers: dm, tierShifts: marks.defense, itemId: blocker?.id, rollKind: type }, state, rng);
  const defEff = effectiveSkill(state, D, type, { itemId: blocker?.id });
  const defDeciding = decidingOf(def, defEff.value, defEff.gear);

  // 4. gap
  const gapShifts: TierShift[] = [];
  if (mode.class === 'heavy' && type === 'block') gapShifts.push({ source: 'heavy vs block', value: CONFIG.HEAVY_VS_BLOCK_GAP });
  if (ranged && zoneD && CONFIG.COVER_GAP[zoneD.cover]) gapShifts.push({ source: 'cover', value: CONFIG.COVER_GAP[zoneD.cover] });
  const gap = tierLevel(def) - tierLevel(atk) + sumShifts(gapShifts);
  const g = Math.max(-5, Math.min(5, gap));
  const multiplier = ladder(type, g);
  const shield = !!(blocker && itemDef(state, blocker.itemId).shield);
  const deciding = {
    attack: atkDeciding,
    defense: defDeciding,
    gap: gapShifts.filter((s) => rowKey(type, gap - s.value, shield) !== rowKey(type, gap, shield)).map((s) => s.source),
  };
  const outcome: AttackResult['outcome'] =
    multiplier === 0 ? 'dodged' : type === 'dodge' && g === 1 ? 'grazed' : type === 'block' && (g >= 1 || (g === 0 && shield)) ? 'blocked'
      : g <= -5 ? 'crushing_hit' : g === -4 ? 'heavy_hit' : 'full_hit';
  if (multiplier === 0) return { ...base, defense: def, defenseType: type, gap, gapShifts, outcome, deciding };

  // 5. location
  let location: string;
  let locationHow: AttackResult['locationHow'];
  if (shield && g >= 0) {
    location = 'shield';
    locationHow = 'shield';
  } else {
    const table = hitTable(state, D);
    const exists = (p: string | null): p is string => !!p && table.some((t) => t.part === p);
    if (req.aimed && exists(req.targetPart)) {
      location = req.targetPart;
      locationHow = 'aimed';
    } else {
      const r = rng.d100();
      location = table.find((t) => r >= t.from && r <= t.to)!.part;
      locationHow = 'rolled';
    }
    const named = req.targetPart;
    if (exists(named) && named !== location && (g <= -3 || (g === -2 && adjacent(state, D, location, named)))) {
      location = named;
      locationHow = 'redirected';
    }
    const rule = locRule(type, g);
    const impact = ct.parts.find((p) => p.id === location)?.impact;
    if (impact && ((rule === 'no_essential' && impact === 'essential') || (rule === 'non_essential_only' && impact !== 'non_essential'))) {
      location = 'general';
      locationHow = 'restricted';
    }
  }

  // 6. damage step (Part 5 §6); armor pools drain in applyEffects
  let dmg = (cls.damage + (mode.damageAdj ?? 0)) * multiplier;
  if (location !== 'shield') {
    const worn = D.core.inventory.find((i) => i.equippedIn?.includes('armor'));
    const armor = worn ? itemDef(state, worn.itemId).armor : undefined;
    for (const a of [armor, ct.naturalArmor]) if (a?.covers.includes(location)) dmg = (dmg - a.reduction) * a.multiplier;
  }
  const damage = Math.max(0, dmg); // fractions allowed, no rounding (OQ-25, decided by Ali 07/11/2026)
  return { ...base, defense: def, defenseType: type, gap, gapShifts, outcome, location, locationHow, multiplier, damage, deciding, ...(location === 'shield' ? { shieldItemId: blocker!.id, ...(mode.tree === 'melee' && mode.class === 'heavy' && hasPerk(A, 'shield_breaker') ? { shieldMult: 2 } : {}) } : {}) };
}

function applyEffects(result: CheckResult | ContestResult | AttackResult, state: GameState): Effect[] {
  if (!('outcome' in result) || !result.location || result.damage <= 0) return [];
  const T = mustActor(state, result.targetId);
  const out: Effect[] = [];
  const changed = (part: string, from: PartState, to: PartState, extra: Record<string, unknown> = {}) => {
    if (from !== to) out.push({ kind: 'part_state_changed', actorId: T.id, data: { part, from, to, ...extra } });
  };
  let dmg = result.damage;

  if (result.location === 'shield') {
    const inst = T.core.inventory.find((i) => i.id === result.shieldItemId);
    if (!inst) return [];
    const before = inst.pools?.shield ?? 100;
    const after = before - ((dmg * (result.shieldMult ?? 1)) / itemDef(state, inst.itemId).shield!.pool) * 100; // A3 Shield Breaker
    inst.pools = { ...inst.pools, shield: after };
    changed('shield', poolState(before), poolState(after), { itemId: inst.id });
    if (poolState(after) === 'Destroyed') T.core.inventory = T.core.inventory.filter((i) => i !== inst); // a Destroyed shield is lost
    return out;
  }

  const ct = creatureType(state, T.core.creatureTypeId);
  const hp = totalHp(state, T);
  const levelBefore = healthLevel(T);
  // armor pool on the struck part drains first; it never counts on the health track
  const worn = T.core.inventory.find((i) => i.equippedIn?.includes('armor'));
  const poolPts = worn ? itemDef(state, worn.itemId).armor?.pools?.[result.location] : undefined;
  if (worn && poolPts) {
    const left = ((worn.pools?.[result.location] ?? 100) / 100) * poolPts;
    const absorbed = Math.max(0, Math.min(dmg, left));
    worn.pools = { ...worn.pools, [result.location]: ((left - absorbed) / poolPts) * 100 };
    dmg -= absorbed;
  }
  // GAP: natural-armor pools have no saved state yet, so they absorb nothing
  if (dmg <= 0) return out;

  const part = ct.parts.find((p) => p.id === result.location);
  let destroyedEssential = false;
  if (part) {
    const before = partPct(T, part.id);
    const after = before - (dmg / (CONFIG.PART_SHARE[part.size] * hp)) * 100;
    T.core.condition.parts = { ...T.core.condition.parts, [part.id]: after };
    const [from, to] = [poolState(before), poolState(after)];
    changed(part.id, from, to);
    if (to === 'Destroyed' && from !== 'Destroyed') {
      destroyedEssential = part.impact === 'essential';
      if (part.roles.includes('grip')) {
        const zone = zoneById(state, T.zone);
        for (const inst of T.core.inventory.filter((i) => handsOf(i).includes(part.id))) {
          T.core.inventory = T.core.inventory.filter((i) => i !== inst);
          const { equippedIn: _, ...loose } = inst;
          zone?.groundItems.push(loose);
          out.push({ kind: 'item_dropped', actorId: T.id, data: { itemId: inst.id, zone: T.zone, part: part.id } });
        }
      }
    }
  }
  const counted = dmg * CONFIG.IMPACT_MULT[part?.impact ?? 'normal'];
  const lost = destroyedEssential ? 100 : T.core.condition.hpLostPct + (counted / hp) * 100;
  T.core.condition.hpLostPct = Math.min(100, lost);
  const levelAfter = healthLevel(T);
  if (levelAfter !== levelBefore) out.push({ kind: 'threshold_crossed', actorId: T.id, data: { who: T.id, from: levelBefore, to: levelAfter } });
  return out;
}

function recordUse(actor: Actor, skill: string, result: CheckResult | ContestResult | AttackResult, state: GameState): void {
  state.log.push({ turn: state.turn, code: 'skill_use', detail: { actorId: actor.id, skill } });
  markUse(state, actor, skill, result);
}

export const ruleset: Ruleset = {
  initiative: (_actor, _state, rng) => rng.d100(), // INIT_UNAWARE for unaware actors is the engine's call
  check,
  contested,
  roll,
  attack,
  situation,
  applyEffects,
  recordUse,
};

/** morale check (Part 3, Morale): roll() with Mind.morale. Fearless never checks; reaching Critical always breaks. */
export function moraleCheck(state: GameState, actor: Actor, rng: Rng, reason: 'level' | 'bandmate_down'): 'steady' | 'broken' | 'surrendered' {
  void reason;
  if (actor.kind === 'player' || !actor.mind || actor.mind.fearless) return 'steady';
  if (healthLevel(actor) === 'Critical') return 'broken';
  const d = rng.d100();
  const morale = actor.mind.morale ?? CONFIG.MORALE_DEFAULT;
  const level = tierOf(d, morale, woundsMods(state, actor, 'morale'), []);
  return level < TIERS.pos('failure') ? 'surrendered' : level < TIERS.pos('near_miss') ? 'broken' : 'steady';
}
