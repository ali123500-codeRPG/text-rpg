// W2 — Ruleset and gear maths. Part 1 §3–4, Part 3, Part 5 §2–6.
// Contract: the eight Ruleset methods plus the helpers below. Every number comes from CONFIG.
import type {
  Actor, AttackRequest, AttackResult, CheckRequest, CheckResult, ContestResult, Effect, GameState, Mod,
  PartState, Rng, RollRequest, RollResult, Ruleset, SituationResult, Tier, TierRoll, TierShift,
} from '../types';
import { CONFIG } from '../config';
import { TIERS } from '../scales';
import { actorBody, itemDef } from '../library';
import { actorById, isActive, hostile, shortestPath, zoneById } from '../engine/relations';
import { adjacent, healthLevel, hitTable, partPct, poolState, totalHp, woundsMods } from './body';
import { markUse } from './improve';
import { boostAdd, boostMult, boostRollMods, hasPerk } from './perks';
import { baneMods } from './bane';
import { markShifts } from '../engine/perkMarks';
import { blockItem, openHandArm, effectiveSkill, handsOf, modeSkill, pickTool, resolveMode, rollMods, rollTags, situational, situationMods, tagSign } from './gear';

export { totalHp, healthLevel, isDownLevel, SHOWN_LEVELS, shownLevel, partStates, woundsMods, hitTable } from './body';
export { improveMarked, markEndurance, markUse } from './improve';
export { MILESTONES, ALL_STEPS, PERKS_NEEDED, PERK_MOVES, ownPerkMoves, hasPerk, boostMult, boostAdd, ladderPerksIn, trueSkill, milestonePerk, milestoneState, canTake, takePerk, canUndo, undoPerk } from './perks';
export type { MilestoneState } from './perks';
export { defaultStandingDefense, effectiveSkill, usableModes, defaultMode, modeSkill, situationMods, pickTool, situational } from './gear';

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
  const eff = effectiveSkill(state, actor, req.skill, { itemId: req.itemId, fullValue: req.fullValue });
  const modifiers = [...req.modifiers];
  if (req.auto !== false) {
    modifiers.push(...woundsMods(state, actor, eff.skill, { itemId: req.itemId, roles: req.roles }));
    if (req.rollKind) modifiers.push(...rollMods(state, actor, req.rollKind, req.itemId));
    modifiers.push(...boostRollMods(actor, req.skill, req.rollKind === 'hit')); // 40/80/120 perks: Keen Edge, Steady Draw, Iron Grip
    modifiers.push(...baneMods(state, actor, req.against)); // D-111 Bane bonuses
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
  const ra = ruleset.roll(noAim({ ...a, against: a.against ?? b.actorId }), state, rng);
  const rb = ruleset.roll(noAim({ ...b, against: b.against ?? a.actorId }), state, rng);
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
  const ct = actorBody(state, D);
  const zoneA = zoneById(state, A.zone);
  const zoneD = zoneById(state, D.zone);

  // 2. attack roll
  const am: Mod[] = [];
  const skill = modeSkill(mode);
  const aimedPart = req.aimed && req.targetPart ? ct.parts.find((p) => p.id === req.targetPart) : undefined;
  if (aimedPart) am.push({ source: `aim: ${aimedPart.id}`, type: 'aim', value: CONFIG.AIM_PENALTY[aimedPart.size] * boostMult(A, skill, 'aimMult') }); // 40/80/120 perk aimMult (none uses it today)
  const cls = CONFIG.WEAPON_CLASSES[mode.class] ?? CONFIG.UNARMED_PROFILE;
  // GAP: the class hit has no modifier type of its own; it rides with the mode's hitAdj as one gear entry at full value
  const hit = cls.hit + (mode.hitAdj ?? 0);
  if (hit) am.push({ source: `weapon: ${name}`, type: 'gear', value: hit });
  if (ranged) {
    if (dist >= 1 && CONFIG.RANGE_MODS[dist]) am.push({ source: 'range', type: 'situational', value: CONFIG.RANGE_MODS[dist] });
    const crowded = [state.player, ...state.actors].some((o) => o.id !== A.id && o.zone === A.zone && isActive(o) && hostile(state, A, o));
    if (crowded && CONFIG.RANGE_MODS[0] && !hasPerk(A, 'point_blank')) am.push({ source: 'hostile in zone', type: 'situational', value: CONFIG.RANGE_MODS[0] });
  }
  am.push(...situational(state, skill, { light: zoneD }).modifiers); // ST21: light by tag (sight)
  am.push(...(req.context?.attackerMods ?? []));
  // A1 Hidden Strike: an attack on a target unaware of the owner lands one tier better
  const marks = markShifts(state, A, D, ranged, skill); // A2, A5, A10, B15
  const atkShifts: TierShift[] = [...(req.context?.defenderUnaware && hasPerk(A, 'hidden_strike') ? [{ source: 'Hidden Strike', value: 1 }] : []), ...marks.attack];
  const atk = ruleset.roll({ actorId: A.id, skill, modifiers: am, tierShifts: atkShifts, itemId: req.weaponId, rollKind: 'hit', against: D.id }, state, rng);
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
  const openArm = type === 'block' && !blocker ? openHandArm(state, D) : null; // A7 Open-Hand Guard
  if (!blocker && !openArm) type = 'dodge'; // GAP: no working arm holding a shield or melee weapon, so the free reaction falls back to dodge
  const dm: Mod[] = [];
  if ((req.context?.defensesThisTurn ?? 0) >= 1) dm.push({ source: 'outnumbered', type: 'situational', value: CONFIG.OUTNUMBERED_MOD });
  if (req.context?.defenderUnaware) dm.push({ source: 'unaware', type: 'situational', value: CONFIG.UNAWARE_MOD });
  if (ranged && type === 'dodge') dm.push({ source: 'dodge vs missile', type: 'situational', value: CONFIG.DODGE_VS_MISSILE });
  dm.push(...situational(state, type, { light: zoneA }).modifiers); // ST21: light by tag (sight)
  dm.push(...(req.context?.defenderMods ?? []));
  const def = ruleset.roll({ actorId: D.id, skill: type, modifiers: dm, tierShifts: marks.defense, itemId: blocker?.id, rollKind: type, against: A.id }, state, rng);
  const defEff = effectiveSkill(state, D, type, { itemId: blocker?.id });
  const defDeciding = decidingOf(def, defEff.value, defEff.gear);

  // 4. gap
  const gapShifts: TierShift[] = [];
  if (mode.class === 'heavy' && type === 'block') gapShifts.push({ source: 'heavy vs block', value: CONFIG.HEAVY_VS_BLOCK_GAP });
  // ST21: cover by tag (ranged): it hurts the attack, so it shifts the gap toward the defender
  const coverGap = zoneD ? -tagSign('cover', rollTags(skill)) * (CONFIG.COVER_GAP[zoneD.cover] ?? 0) : 0;
  if (coverGap) gapShifts.push({ source: 'cover', value: coverGap });
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

  // A7 Open-Hand Guard: a hit through an open-hand block lands split between the blocking arm and the general area
  if (openArm) {
    location = openArm;
    locationHow = 'open_hand';
  }

  // 6. damage step (Part 5 §6); armor pools drain in applyEffects
  const worn = D.core.inventory.find((i) => i.equippedIn?.includes('armor'));
  const armor = worn ? itemDef(state, worn.itemId).armor : undefined;
  const pierce = boostAdd(A, skill, 'armorPierce'); // 40/80/120 perk: Armor Piercer
  const afterArmor = (raw: number, at: string) => {
    let d = raw;
    for (const a of [armor, ct.naturalArmor]) if (a?.covers.includes(at)) d = (d - Math.max(0, a.reduction - pierce)) * a.multiplier;
    return Math.max(0, d); // fractions allowed, no rounding (OQ-25, decided by Ali 07/11/2026)
  };
  const raw = (cls.damage + (mode.damageAdj ?? 0)) * multiplier * boostMult(A, skill, 'damageMult'); // 40/80/120 perk: Heavy Hand
  const generalShare = openArm ? afterArmor(raw * (1 - CONFIG.OPEN_HAND_ARM_SHARE), 'general') : 0;
  const damage = location === 'shield' ? Math.max(0, raw) : afterArmor(openArm ? raw * CONFIG.OPEN_HAND_ARM_SHARE : raw, location) + generalShare;
  // A6 Leg Bolt: a medium or heavy ranged hit that does damage to a part with the move role
  const legBolt = ranged && (mode.class === 'medium' || mode.class === 'heavy') && damage > 0 && hasPerk(A, 'leg_bolt')
    && !!ct.parts.find((p) => p.id === location)?.roles.includes('move');
  return { ...base, defense: def, defenseType: type, gap, gapShifts, outcome, location, locationHow, multiplier, damage, deciding, ...(openArm ? { generalShare } : {}), ...(legBolt ? { legBolt } : {}), ...(location === 'shield' ? { shieldItemId: blocker!.id, ...(mode.tree === 'melee' && mode.class === 'heavy' && hasPerk(A, 'shield_breaker') ? { shieldMult: 2 } : {}) } : {}) };
}

function applyEffects(result: CheckResult | ContestResult | AttackResult, state: GameState): Effect[] {
  if (!('outcome' in result) || !result.location || result.damage <= 0) return [];
  const T = mustActor(state, result.targetId);
  const out: Effect[] = [];
  const changed = (part: string, from: PartState, to: PartState, extra: Record<string, unknown> = {}) => {
    if (from !== to) out.push({ kind: 'part_state_changed', actorId: T.id, data: { part, from, to, ...extra } });
  };
  const general = result.generalShare ?? 0; // A7 Open-Hand Guard
  let dmg = result.damage - general;

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

  const ct = actorBody(state, T);
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
  if (dmg <= 0 && general <= 0) return out;
  dmg = Math.max(0, dmg);

  const part = ct.parts.find((p) => p.id === result.location);
  let destroyedEssential = false;
  if (part) {
    const before = partPct(T, part.id);
    const after = before - ((dmg * (result.legBolt ? CONFIG.LEG_BOLT_PART_MULT : 1)) / (CONFIG.PART_SHARE[part.size] * hp)) * 100; // A6 Leg Bolt
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
  const counted = dmg * CONFIG.IMPACT_MULT[part?.impact ?? 'normal'] + general * CONFIG.IMPACT_MULT.normal;
  const add = T.core.condition.hpLostPct + (counted / hp) * 100;
  const lost = destroyedEssential ? CONFIG.HP_LOST_MAX : add; // a destroyed essential part kills (Ali, 08/11/2026)
  T.core.condition.hpLostPct = Math.min(CONFIG.HP_LOST_MAX, lost);
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
