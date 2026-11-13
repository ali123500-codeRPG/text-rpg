// W2 — Ruleset and gear maths. Part 1 §3–4, Part 3, Part 5 §2–6.
// Contract: the eight Ruleset methods plus the helpers below. Every number comes from CONFIG.
import { DU, RL } from '../library/tableIds';
import { actionRow, actionSeconds } from './actionTime';
import type {
  Actor, AttackRequest, DefenseKind, AttackResult, CheckRequest, CheckResult, ContestResult, Effect, GameState, Mod,
  PartState, Rng, RollRequest, RollResult, Ruleset, EventRollResult, Tier, TierRoll, TierShift,
} from '../types';
import { CONFIG } from '../config';
import { COVER, HIT_OUTCOMES, TIERS } from '../scales';
import { actorBody, getLibrary, itemDef } from '../library';
import { actorById, foe, isActive, hostile, zoneById } from '../engine/relations';
import { sightDistM, withinM } from '../engine/position';
import { adjacent, healthLevel, hitTable, partPct, poolState, totalHp, woundsMods } from './body';
import { markUse } from './improve';
import { boostAdd, boostMult, boostRollMods, hasPerk } from './perks';
import { baneMods, defeatsMods } from './bane';
import { pressureMods } from './pressure';
import { bestReward, deathsDoor, rallyMods, renownMods, tierReach } from './achRewards';
import { besidePlayer } from '../engine/engagement';
import { afterRollShifts, foeMods } from './allSteps';
import { markShifts } from '../engine/perkMarks';
import { rollFeats, tally } from '../engine/xp';
import { shortShifts } from './requirements';
import { blendedSkill, defenseItem, usableDefense, isHeld, openHandArm, effectiveSkill, fnSkills, rollFnSkills, handsOf, modeSkill, pickTool, resolveMode, rollMods, rollTags, situational, eventRollMods, tagSign } from './gear';
import { SK, DEFENSE_SKILL } from '../library/skillIds';
import { PK } from '../library/perkIds';
import { FN } from '../library/functionIds';

export { totalHp, healthLevel, isDownLevel, othersHealthWord, SHOWN_LEVELS, shownLevel, partStates, woundsMods, hitTable } from './body';
export { improveMarked, payRolls, growthRoll, skillCap, owedBySkill, burdenOf, clearMarkCounts, markEndurance, markUse } from './improve';
export { meltAwayHere } from './perks';
export { MILESTONES, ALL_STEPS, PERKS_NEEDED, PERK_MOVES, ownPerkMoves, hasPerk, boostMult, boostAdd, ladderPerksIn, trueSkill, milestonePerk, milestoneState, canTake, takePerk, canUndo, undoPerk } from './perks';
export type { MilestoneState } from './perks';
export { defaultStandingDefense, effectiveSkill, usableModes, defaultMode, modeSkill, eventRollMods, pickTool, situational, fnRoller, fnSkills, withRow, blendedSkill, modeReach, augmentsOf } from './gear';

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
/** display name; a tier past either end shows the end name with one + or − per step past it */
export function tierName(t: Tier | Tiered): string {
  const tier = typeof t === 'string' ? t : t.tier;
  const past = typeof t === 'string' ? 0 : t.beyond ?? 0;
  return TIERS.name(tier) + (past > 0 ? '+'.repeat(past) : '−'.repeat(-past));
}

/** Stacking within one modifier type (Part 1 §4). */
export function stackType(values: number[]): number {
  const part = (xs: number[]) => xs.reduce((s, x, i) => s + x * CONFIG.STACK_RATIO ** i, 0);
  return part(values.filter((v) => v > 0).sort((a, b) => b - a)) + part(values.filter((v) => v < 0).sort((a, b) => a - b));
}
/** sum of all modifiers, each type stacked within itself */
export function modTotal(mods: { type: string; value: number }[]): number {
  const byType = new Map<string, number[]>();
  for (const m of mods) byType.set(m.type, [...(byType.get(m.type) ?? []), m.value]);
  return [...byType.values()].reduce((s, vs) => s + stackType(vs), 0);
}

/** Layer 2b margin bands: the lowest margin for each tier above the worst */
export const MARGIN_BANDS = [-75, -25, 0, 25, 75];
/** the tier level a margin reaches */
export function band(margin: number): number {
  return MARGIN_BANDS.filter((t) => margin >= t).length;
}
type Reach = { up: number; down: number };
const NO_REACH: Reach = { up: 0, down: 0 };
/** D-211 on skill rolls (an extra band past the end): each tier a perk or achievement opens (tierUnlocks, tierReach) adds
 * a band CONFIG.TIER_EXTRA_BAND wider past the end of MARGIN_BANDS: Critical Success+ from margin 75 + 50, Critical
 * Failure− below −75 − 50. Without an unlock a roll reads the table as before. */
export function extraBands(margin: number, reach: Reach): number {
  const top = MARGIN_BANDS[MARGIN_BANDS.length - 1], bottom = MARGIN_BANDS[0];
  let n = 0;
  for (let k = 1; k <= reach.up; k++) if (margin >= top + CONFIG.TIER_EXTRA_BAND * k) n++;
  for (let k = 1; k <= reach.down; k++) if (margin < bottom - CONFIG.TIER_EXTRA_BAND * k) n--;
  return n;
}
/** a natural low roll drops one tier and a natural high roll raises one (CONFIG.NATURAL_EDGE at each end); never two */
export function naturalEdge(d: number): -1 | 0 | 1 {
  return d <= CONFIG.NATURAL_EDGE ? -1 : d > 100 - CONFIG.NATURAL_EDGE ? 1 : 0;
}
const sumShifts = (s: TierShift[]) => s.reduce((t, x) => t + x.value, 0);
/** SE23: a solo roll against a task grade moves by (moderate − grade) at the roll's skill weight, so a task graded at
 * the roller's own skill plays the same at every level (62% Success or better at 50 and at 300) */
export function gradeMod(target: number): number {
  return CONFIG.SKILL_WEIGHT * (CONFIG.DIFFICULTY.moderate - target);
}
/** Part 1 §4: the margin of a skill roll */
export const rollMargin = (d: number, skill: number, mods: Mod[]) => d + CONFIG.SKILL_WEIGHT * skill + modTotal(mods) - CONFIG.ROLL_NEEDED;
/** the tier level of a skill roll: the margin's band, any unlocked extra bands, the natural edge and tier shifts. Rolls and
 * the Equations tab's tables both read it. */
export function tierOf(d: number, skill: number, mods: Mod[], shifts: TierShift[], reach: Reach = NO_REACH): number {
  const margin = rollMargin(d, skill, mods);
  return band(margin) + extraBands(margin, reach) + naturalEdge(d) + sumShifts(shifts);
}

function mustActor(state: GameState, id: string): Actor {
  const a = actorById(state, id);
  if (!a) throw new Error(`unknown actor ${id}`);
  return a;
}

/** gap ladder (Part 3, Defense); a gap past ±5 uses the ±5 entry */
export function ladder(type: DefenseKind, gap: number): number {
  return CONFIG.GAP_LADDER[type][Math.max(CONFIG.GAP_MIN, Math.min(CONFIG.GAP_MAX, gap))];
}
type LocRule = 'any' | 'no_essential' | 'non_essential_only';
function locRule(type: DefenseKind, g: number): LocRule {
  if (type === 'dodge') return g >= 0 ? 'no_essential' : 'any'; // +1 graze: never essential, like the tie (OQ-17 settled)
  return g >= 0 ? 'non_essential_only' : g === -1 ? 'no_essential' : 'any'; // GAP: block and parry +1..+5 off-shield keep the gap-0 limit
}
function rowKey(type: DefenseKind, gap: number, shield: boolean): string {
  const g = Math.max(CONFIG.GAP_MIN, Math.min(CONFIG.GAP_MAX, gap));
  return [ladder(type, g), locRule(type, g), g <= -3 ? 'anywhere' : g === -2 ? 'adjacent' : '', shield && g >= 0].join('|');
}

/** sources whose removal alone changes the roll's tier index; natural edges listed as lucky/fumble */
function decidingOf(r: RollResult, skill: number, gear: { source: string; value: number }[], reach: Reach = NO_REACH): string[] {
  const out: string[] = [];
  if (r.natural) out.push(r.natural > 0 ? 'lucky' : 'fumble');
  r.modifiers.forEach((m, i) => {
    if (tierOf(r.d100, skill, r.modifiers.filter((_, j) => j !== i), r.tierShifts, reach) !== tierLevel(r)) out.push(m.source);
  });
  for (const g of gear) if (tierOf(r.d100, skill - g.value, r.modifiers, r.tierShifts, reach) !== tierLevel(r)) out.push(g.source);
  r.tierShifts.forEach((s, i) => {
    if (tierOf(r.d100, skill, r.modifiers, r.tierShifts.filter((_, j) => j !== i), reach) !== tierLevel(r)) out.push(s.source);
  });
  return out;
}

function roll(req: RollRequest, state: GameState, rng: Rng): RollResult {
  const actor = mustActor(state, req.actorId);
  const ctx = { itemId: req.itemId, fullValue: [...(req.fullValue ?? []), ...(req.fn ? rollFnSkills(actor, req.fn) : [])], standInFns: req.standInFns, rollKind: req.rollKind };
  const eff: { skill: string; value: number; parts?: string[] } = req.blend ? blendedSkill(state, actor, req.blend, ctx) : effectiveSkill(state, actor, req.skill, ctx); // a combined roll (Throw)
  const modifiers = [...req.modifiers];
  if (req.auto !== false) {
    modifiers.push(...woundsMods(state, actor, eff.skill, { itemId: req.itemId, roles: req.roles }));
    if (req.rollKind) modifiers.push(...rollMods(state, actor, req.rollKind, req.itemId));
    modifiers.push(...boostRollMods(actor, req.skill, req.rollKind === 'hit')); // 40/80/120 perks: Keen Edge, Steady Draw, Iron Grip
    modifiers.push(...baneMods(state, actor, req.against)); // D-111 Bane bonuses
    modifiers.push(...defeatsMods(actor, req.rollKind)); // D-119 total-defeats achievements
    modifiers.push(...pressureMods(actor, req.against)); // OQ-29 Shaken and Swayed
    modifiers.push(...foeMods(req.against ? [state.player, ...state.actors].find((x) => x.id === req.against) : undefined, req.rollKind)); // All-50: Dodgy
  }
  const d = rng.d100();
  const margin = rollMargin(d, eff.value, modifiers);
  const shifts = [...req.tierShifts];
  if (req.auto !== false) shifts.push(...shortShifts(state, actor, req.rollKind, req.itemId)); // EQ12 c: gear you fall short on
  let level = tierOf(d, eff.value, modifiers, shifts, tierReach(actor, req.rollKind)); // unclamped (Part 1 §4)
  if (req.auto !== false) for (const s of afterRollShifts(actor, eff.skill, level, req.nearMissUp)) { shifts.push(s); level += s.value; } // All-50: Curiouser and Curiouser
  const out: RollResult = { actorId: actor.id, skill: eff.skill, ...(eff.skill !== req.skill && !req.fn ? { asked: req.skill } : {}), ...(eff.parts ? { parts: eff.parts } : {}), ...(req.rollKind ? { rollKind: req.rollKind } : {}), d100: d, margin, ...tierAt(level), natural: naturalEdge(d), modifiers, tierShifts: shifts };
  if (actor === state.player) rollFeats(state, out); // D-120 Critical Success achievements, per skill group
  return out;
}

function check(req: CheckRequest, state: GameState, _rng: Rng): CheckResult {
  const actor = mustActor(state, req.actorId);
  const tool = pickTool(state, actor, req.skill).itemId ?? undefined;
  const eff = effectiveSkill(state, actor, req.skill, { itemId: tool });
  const target = CONFIG.DIFFICULTY[state.hidden.stage.challenge];
  const passed = eff.value + req.modifiers.reduce((s, m) => s + m.value, 0) >= target;
  return { actorId: actor.id, skill: eff.skill, ...(eff.skill !== req.skill ? { asked: req.skill } : {}), target, passed, modifiers: req.modifiers };
}

function contested(a: RollRequest, b: RollRequest, state: GameState, rng: Rng): ContestResult {
  const noAim = (r: RollRequest) => ({ ...r, modifiers: r.modifiers.filter((m) => m.type !== 'aim') });
  const ra = ruleset.roll(noAim({ ...a, against: a.against ?? b.actorId }), state, rng);
  const rb = ruleset.roll(noAim({ ...b, against: b.against ?? a.actorId }), state, rng);
  const gap = tierLevel(rb) - tierLevel(ra);
  return { a: ra, b: rb, gap, winner: gap < 0 ? 'a' : gap > 0 ? 'b' : 'tie' };
}

// Part 1 §4: read on the normal roll table (MARGIN_BANDS, ER3), the margin being total − 50 with the placeholder base
function eventRoll(actor: Actor, state: GameState, rng: Rng, extra: EventRollResult['modifiers'] = []): EventRollResult {
  const modifiers = [...eventRollMods(state, actor), ...extra];
  // D-218 variance perks (Threadbound items): wider natural edges and a spread die
  const perks = actor.core.perks.filter((p) => !p.dormant).map((p) => getLibrary().perks[p.perkId]).filter((x) => !!x);
  const edges = perks.reduce((n, x) => n + (x.eventEdges ?? 0), 0);
  const spread = Math.max(1, ...perks.map((x) => x.eventSpread ?? 1));
  const d = rng.d100();
  const margin = 50.5 + (d - 50.5) * spread + CONFIG.EVENT_BASE + modTotal(modifiers) - 100;
  // past the Critical tiers only as far as perks and achievements open (tierUnlocks). Each tier opened widens the natural
  // critical range by EVENT_CRIT_NATURALS: with one opened above, 96-100 is Critical Success+ and 91-95 Critical Success
  const reach = tierReach(actor, 'event');
  const top = TIERS.keys.length - 1, B = CONFIG.EVENT_CRIT_NATURALS;
  // D-218 Loose Odds: the `edges` naturals just inside the critical range (however wide opened tiers make it) shift a tier outward
  const hi = 100 - (reach.up ? B * (reach.up + 1) : CONFIG.NATURAL_EDGE), lo = reach.down ? B * (reach.down + 1) : CONFIG.NATURAL_EDGE;
  const loose = d > hi - edges && d <= hi ? 1 : d > lo && d <= lo + edges ? -1 : 0;
  let level = band(margin) + naturalEdge(d) + loose;
  if (reach.up && d > 100 - B * (reach.up + 1)) level = Math.max(level, top + reach.up - Math.floor((100 - d) / B));
  if (reach.down && d <= B * (reach.down + 1)) level = Math.min(level, -reach.down + Math.floor((d - 1) / B));
  level = Math.max(-reach.down, Math.min(top + reach.up, level));
  const { tier, beyond } = tierAt(level);
  // the chains count how far past Critical you have reached: 1 = Critical, 2 = one + or −, and so on
  if (actor === state.player && tier === TIERS.keys[top]) tally(state, 'event_crits', { to: 1 + (beyond ?? 0) });
  if (actor === state.player && tier === TIERS.keys[0]) tally(state, 'event_crit_fails', { to: 1 - (beyond ?? 0) });
  return { actorId: actor.id, roll: d, tier, ...(beyond ? { beyond } : {}), modifiers };
}

/** a ranged attack's range penalty: the first RANGE_SHARE_MODS band that the target's distance fits in, as a share of the
 * mode's reach (both in metres) */
export function rangeMod(dist: number, reach: number): number {
  if (dist <= 0 || reach <= 0) return 0;
  return CONFIG.RANGE_SHARE_MODS.find(([share]) => dist / reach <= share)?.[1] ?? CONFIG.RANGE_SHARE_MODS.at(-1)![1];
}

function attack(req: AttackRequest, state: GameState, rng: Rng): AttackResult {
  const A = mustActor(state, req.attackerId);
  const D = mustActor(state, req.targetId);
  const dist = sightDistM(state, A, D);
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
    const far = rangeMod(dist, mode.reach);
    if (far) am.push({ source: 'range', type: 'situational', value: far });
    // RD5: a hostile within HOSTILE_NEAR_M, close enough to strike or grab; either way: the player holds no stances of its own
    const crowded = [state.player, ...state.actors].some((o) => o.id !== A.id && isActive(o) && (foe(state, A, o) || foe(state, o, A)) && withinM(sightDistM(state, A, o), CONFIG.HOSTILE_NEAR_M));
    if (crowded && CONFIG.HOSTILE_NEAR_MOD && !hasPerk(A, PK.point_blank)) am.push({ source: 'hostile close', type: 'situational', value: CONFIG.HOSTILE_NEAR_MOD });
  }
  am.push(...situational(state, skill, { light: zoneD }).modifiers); // ST21: light by tag (sight)
  am.push(...(req.context?.attackerMods ?? []));
  // A1 Hidden Strike: an attack on a target unaware of the owner lands one tier better
  const marks = markShifts(state, A, D, ranged, skill); // A2, A5, A10, B15
  const unseen = req.context?.defenderUnaware ? bestReward(A, 'unawareShift') : undefined; // an achievement reward
  const atkShifts: TierShift[] = [...(req.context?.defenderUnaware && hasPerk(A, PK.hidden_strike) ? [{ source: 'Hidden Strike', value: 1 }] : []),
    ...(unseen ? [{ source: unseen.name, value: unseen.value }] : []), ...marks.attack, ...(req.context?.attackerShifts ?? [])];
  const atk = ruleset.roll({ actorId: A.id, skill, modifiers: am, tierShifts: atkShifts, itemId: req.weaponId, rollKind: 'hit', against: D.id, standInFns: mode.standInFns, blend: mode.blend }, state, rng);
  const atkEff = mode.blend ? blendedSkill(state, A, mode.blend, { itemId: req.weaponId, standInFns: mode.standInFns }) : effectiveSkill(state, A, skill, { itemId: req.weaponId });
  const atkDeciding = decidingOf(atk, atkEff.value, atkEff.gear, tierReach(A, 'hit'));

  const base: Omit<AttackResult, 'outcome' | 'deciding'> = {
    attack: atk, ...(req.context?.defenderUnaware ? { unaware: true as const } : {}), defense: null, defenseType: null, gap: null, gapShifts: [], location: null, locationHow: null,
    multiplier: 0, damage: 0, attackerId: A.id, targetId: D.id, weaponId: req.weaponId, modeId: mode.id,
  };
  if (!tierAtLeast(atk, 'near_miss')) return { ...base, outcome: 'missed', deciding: { attack: atkDeciding, defense: [], gap: [] } };

  // 3. defense roll with the standing defense
  // a standing defense that can't work here falls back to the best one that can (no shield, no block; parry can't stop missiles)
  const type = usableDefense(state, D, ranged);
  const blocker = defenseItem(state, D, type); // the shield that blocks or the weapon that parries
  const openArm = type === 'parry' && !blocker ? openHandArm(state, D) : null; // A7 Open-Hand Guard (PA10): a barehanded parry
  const parryClass = (c: string) => type === 'parry' && !!blocker && !!itemDef(state, blocker.itemId).weapon?.modes.some((x) => x.tree === 'melee' && x.class === c);
  const mediumParry = parryClass('medium');
  const bladeParry = mediumParry || parryClass('heavy'); // B19 Blade Wall: a medium or heavy blade
  const dm: Mod[] = [];
  // never outnumbered: B19 Blade Wall (Parry 60, a medium or heavy weapon), B9 Shield Wall (Block 60), B8 Slip the Crowd (Dodge 60)
  const noCrowd = (bladeParry && hasPerk(D, PK.blade_wall)) || (type === 'block' && hasPerk(D, PK.shield_wall)) || (type === 'dodge' && hasPerk(D, PK.slip_the_crowd));
  if ((req.context?.defensesThisTurn ?? 0) >= 1 && !noCrowd) dm.push({ source: 'outnumbered', type: 'situational', value: CONFIG.OUTNUMBERED_MOD });
  if (req.context?.defenderUnaware) dm.push({ source: 'unaware', type: 'situational', value: CONFIG.UNAWARE_MOD });
  if (ranged && type === 'dodge') dm.push({ source: 'dodge vs missile', type: 'situational', value: CONFIG.DODGE_VS_MISSILE });
  dm.push(...situational(state, DEFENSE_SKILL[type], { light: zoneA }).modifiers); // ST21: light by tag (sight)
  // All-50 Steady Guard: Parry rolls made with a medium melee weapon
  if (mediumParry && hasPerk(D, PK.steady_guard)) {
    dm.push({ source: 'Steady Guard', type: 'roll_perk', value: CONFIG.SKILL_WEIGHT * CONFIG.STEADY_GUARD });
  }
  // All-50 Bare-Handed Guard: Dodge rolls while the owner holds no weapon
  if (type === 'dodge' && hasPerk(D, PK.bare_handed_guard) && !D.core.inventory.some((i) => isHeld(i) && !!itemDef(state, i.itemId).weapon)) {
    dm.push({ source: 'Bare-Handed Guard', type: 'roll_perk', value: CONFIG.SKILL_WEIGHT * CONFIG.BARE_HANDED_GUARD });
  }
  dm.push(...(req.context?.defenderMods ?? []));
  const def = ruleset.roll({ actorId: D.id, skill: DEFENSE_SKILL[type], modifiers: dm, tierShifts: [...marks.defense, ...(req.context?.defenderShifts ?? [])], itemId: blocker?.id, rollKind: type, against: A.id }, state, rng);
  const defEff = effectiveSkill(state, D, DEFENSE_SKILL[type], { itemId: blocker?.id });
  const defDeciding = decidingOf(def, defEff.value, defEff.gear, tierReach(D, type));

  // 4. gap
  const gapShifts: TierShift[] = [];
  // PA11: Parry too; All-50 Against the Grain (Parry's part) takes it off the owner's parries
  if (mode.class === 'heavy' && type !== 'dodge' && !(type === 'parry' && hasPerk(D, PK.against_the_grain))) gapShifts.push({ source: `heavy vs ${type}`, value: CONFIG.HEAVY_VS_BLOCK_GAP }); // PA11: Parry too
  // ST21: cover by tag (ranged): it hurts the attack, so it shifts the gap toward the defender
  const coverKey = zoneD && ranged && hasPerk(A, PK.past_the_cover) ? COVER.at(COVER.pos(zoneD.cover) - 1) : zoneD?.cover; // All-50: Past the Cover
  const coverGap = zoneD ? -tagSign('cover', rollTags(skill)) * (CONFIG.COVER_GAP[coverKey!] ?? 0) : 0;
  if (coverGap) gapShifts.push({ source: 'cover', value: coverGap });
  // A20 Slip the Blow: in light armor, a Dodge that ties counts as a graze
  const wornArmor = D.core.inventory.find((i) => i.equippedIn?.includes('armor'));
  const armor = wornArmor ? itemDef(state, wornArmor.itemId).armor : undefined;
  if (type === 'dodge' && armor?.weight === 'light' && hasPerk(D, PK.slip_the_blow) && tierLevel(def) - tierLevel(atk) + sumShifts(gapShifts) === 0) {
    gapShifts.push({ source: 'Slip the Blow', value: 1 });
  }
  const gap = tierLevel(def) - tierLevel(atk) + sumShifts(gapShifts);
  const g = Math.max(CONFIG.GAP_MIN, Math.min(CONFIG.GAP_MAX, gap));
  let multiplier = ladder(type, g);
  const shield = type === 'block';
  const deciding = {
    attack: atkDeciding,
    defense: defDeciding,
    gap: gapShifts.filter((s) => rowKey(type, gap - s.value, shield) !== rowKey(type, gap, shield)).map((s) => s.source),
  };
  let outcome: AttackResult['outcome'] =
    multiplier === 0 ? (type === 'parry' ? 'parried' : 'dodged') : type === 'dodge' && g === 1 ? 'grazed' : type !== 'dodge' && (g >= 1 || (g === 0 && shield)) ? 'blocked'
      : g <= -5 ? 'crushing_hit' : g === -4 ? 'heavy_hit' : 'full_hit';
  // PA4: a parry at PARRY_STRIKE_GAP or better earns a free strike back (the engine makes it); PA7 Answer the Blow lowers it with a medium weapon
  const strikeAt = CONFIG.PARRY_STRIKE_GAP - (mediumParry && hasPerk(D, PK.answer_the_blow) ? CONFIG.ANSWER_THE_BLOW_DROP : 0);
  const strike = type === 'parry' && !ranged && gap >= strikeAt ? { strikeBack: true as const } : {};
  if (multiplier === 0) return { ...base, defense: def, defenseType: type, gap, gapShifts, outcome, deciding, ...strike };

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

  // A22 Turn Aside: heavy armor turns a heavy or crushing hit on a part it covers into a full hit
  if (HIT_OUTCOMES.pos(outcome) >= HIT_OUTCOMES.pos('heavy_hit') && armor?.weight === 'heavy' && armor.covers.includes(location) && hasPerk(D, PK.turn_aside)) {
    outcome = 'full_hit';
    multiplier = 1;
  }

  // 6. damage step (Part 5 §6); armor pools drain in applyEffects
  const pierce = boostAdd(A, skill, 'armorPierce'); // 40/80/120 perk: Armor Piercer
  const afterArmor = (raw: number, at: string) => {
    let d = raw;
    for (const a of [armor, ct.naturalArmor]) if (a?.covers.includes(at)) d = (d - Math.max(0, a.reduction - pierce)) * a.multiplier;
    return Math.max(0, d); // fractions allowed, no rounding (OQ-25, decided)
  };
  const frame = !ranged && hasPerk(D, PK.fighters_frame) ? CONFIG.FIGHTERS_FRAME_MULT : 1; // All-50: Fighter's Frame, on health lost (after armor)
  const knuckles = mode.tree === 'unarmed' && hasPerk(A, PK.iron_knuckles) ? CONFIG.IRON_KNUCKLES_MULT : 1; // All-50: Iron Knuckles
  const improvised = skill === SK.unarmed_improvised || !!mode.blend?.some((b) => b.skill === SK.unarmed_improvised);
  const junk = improvised && hasPerk(A, PK.junk_arsenal) ? CONFIG.JUNK_ARSENAL_MULT : 1; // All-50: Junk Arsenal
  const raw = (cls.damage + (mode.damageAdj ?? 0)) * multiplier * boostMult(A, skill, 'damageMult') * knuckles * junk; // 40/80/120 perk: Heavy Hand
  const hide = location !== 'shield' && hasPerk(D, PK.thick_hide) ? CONFIG.THICK_HIDE_MULT : 1; // All-50: Thick Hide, on the body hit before armor
  const body = raw * hide;
  const generalShare = openArm ? afterArmor(body * (1 - CONFIG.OPEN_HAND_ARM_SHARE), 'general') * frame : 0;
  const damage = location === 'shield' ? Math.max(0, raw) : (afterArmor(openArm ? body * CONFIG.OPEN_HAND_ARM_SHARE : body, location) * frame + generalShare);
  // A6 Leg Bolt: a medium or heavy ranged hit that does damage to a part with the move role
  const legBolt = ranged && (mode.class === 'medium' || mode.class === 'heavy') && damage > 0 && hasPerk(A, PK.leg_bolt)
    && !!ct.parts.find((p) => p.id === location)?.roles.includes(RL.move);
  return { ...base, defense: def, defenseType: type, gap, gapShifts, outcome, location, locationHow, multiplier, damage, deciding, ...strike, ...(openArm ? { generalShare } : {}), ...(legBolt ? { legBolt } : {}), ...(location === 'shield' ? { shieldItemId: blocker!.id, ...(mode.tree === 'melee' && mode.class === 'heavy' && hasPerk(A, PK.shield_breaker) ? { shieldMult: CONFIG.SHIELD_BREAKER_MULT } : {}) } : {}) };
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
    const rim = hasPerk(T, PK.iron_rim) ? CONFIG.IRON_RIM_MULT : 1; // All-50 Iron Rim (Block's part)
    const after = before - ((dmg * (result.shieldMult ?? 1) * rim) / itemDef(state, inst.itemId).shield!.pool) * 100; // A3 Shield Breaker
    inst.pools = { ...inst.pools, shield: after };
    changed('shield', poolState(before), poolState(after), { itemId: inst.id });
    if (poolState(after) === 'destroyed') T.core.inventory = T.core.inventory.filter((i) => i !== inst); // a Destroyed shield is lost
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
    if (to === 'destroyed' && from !== 'destroyed') {
      destroyedEssential = part.impact === 'essential';
      if (part.roles.includes(RL.grip)) {
        const zone = zoneById(state, T.zone);
        for (const inst of T.core.inventory.filter((i) => handsOf(i).includes(part.id))) {
          if (inst.soulbound) { delete inst.equippedIn; continue; } // HF18: soulbound gear never leaves its owner
          T.core.inventory = T.core.inventory.filter((i) => i !== inst);
          const { equippedIn: _, ...loose } = inst;
          zone?.groundItems.push(T.pos ? { ...loose, at: { ...T.pos } } : loose); // FR2: it falls where they stand
          out.push({ kind: 'item_dropped', actorId: T.id, data: { itemId: inst.id, zone: T.zone, part: part.id } });
        }
      }
    }
  }
  const counted = dmg * CONFIG.IMPACT_MULT[part?.impact ?? 'normal'] + general * CONFIG.IMPACT_MULT.normal;
  const lostBefore = T.core.condition.hpLostPct;
  const add = lostBefore + (counted / hp) * 100;
  const lost = destroyedEssential ? CONFIG.HP_LOST_MAX : deathsDoor(state, T, T.core.condition.hpLostPct, add); // a destroyed essential part kills
  T.core.condition.hpLostPct = Math.min(CONFIG.HP_LOST_MAX, lost);
  if (counted > 0) delete T.core.condition.tended; // BG-181: a new wound is not tended
  // achievements count the player's HP lost as a flat number (the health % lost of total HP)
  if (T === state.player && T.core.condition.hpLostPct > lostBefore) tally(state, 'hp_lost', { add: ((T.core.condition.hpLostPct - lostBefore) / 100) * hp });
  const levelAfter = healthLevel(T);
  if (levelAfter !== levelBefore) out.push({ kind: 'threshold_crossed', actorId: T.id, data: { who: T.id, from: levelBefore, to: levelAfter } });
  return out;
}

/** what initiative adds to its d100: the best skill with the Initiative function (full value, like a function roll; 0 when
 * none) × SKILL_WEIGHT, plus roll modifiers naming initiative (rollMod roll 'initiative') */
export function initiativeBonus(state: GameState, actor: Actor): number {
  const fns = fnSkills(FN.initiative);
  const best = Math.max(0, ...fns.map((id) => effectiveSkill(state, actor, id, { fullValue: fns }).value));
  return CONFIG.SKILL_WEIGHT * best + modTotal(rollMods(state, actor, 'initiative'));
}

function recordUse(actor: Actor, skill: string, result: CheckResult | ContestResult | AttackResult, state: GameState): void {
  state.log.push({ turn: state.turn, code: 'skill_use', detail: { actorId: actor.id, skill } });
  const pr = actor.progression;
  if (pr && !pr.used?.includes(skill)) (pr.used ??= []).push(skill);
  markUse(state, actor, skill, result);
}

export const ruleset: Ruleset = {
  initiative: (actor, state, rng) => rng.d100() + initiativeBonus(state, actor), // the engine gives INIT_UNAWARE to an actor unaware of its attacker (initiativeOrder)
  check,
  contested,
  roll,
  attack,
  eventRoll,
  applyEffects,
  recordUse,
};

/** SD7: a fall's flat damage from the drop in metres, moved `step` bands by the landing roll (0 below the first band) */
export function fallDamage(metres: number, step = 0): number {
  const bands = CONFIG.FALL_BANDS;
  const at = bands.filter((b) => metres > b.over).length + step;
  return at <= 0 ? 0 : bands[Math.min(at, bands.length) - 1].damage;
}

/** SD7: how many bands a landing of tier t moves the fall (negative: lighter). Each tier past Critical Success lightens it
 * more; a tier past Critical Failure reads Critical Failure's row */
/** BA2: seconds to pick a lock at effective Thievery `skill`: the Action times pick_lock row with its speed function */
export const pickSeconds = (skill: number): number => actionSeconds(actionRow(DU.pick_lock)!, skill);
export const landingStep = (t: Tiered): number => (CONFIG.FALL_LANDING_STEP[t.tier] ?? 0) - Math.max(0, t.beyond ?? 0) * CONFIG.FALL_LANDING_PAST_STEP;

/** SD7: a jump down a drop: a Dodge roll on landing (rollKind dodge) moves the fall a band (FALL_LANDING_STEP), and the damage
 * lands on a leg (a part with the move role) like a hit, so armor and health tracks work as for any wound */
export function landFall(state: GameState, actor: Actor, metres: number, rng: Rng): { damage: number; landing: string; effects: Effect[] } {
  const r = roll({ actorId: actor.id, skill: SK.dodge, modifiers: [], tierShifts: [], rollKind: 'dodge' }, state, rng);
  const t = tierAt(tierLevel(r));
  const damage = fallDamage(metres, landingStep(t));
  const legs = actorBody(state, actor).parts.filter((p) => p.roles.includes(RL.move));
  const leg = legs.length ? legs[Math.floor(rng.next() * legs.length)] : undefined;
  const effects = damage > 0 && leg ? applyEffects({ outcome: 'hit', location: leg.id, damage, targetId: actor.id } as unknown as AttackResult, state) : [];
  return { damage, landing: tierName(t), effects };
}

/** D-54 survival roll: roll() with no skill and no modifiers; Near Miss or better survives */
export function survivalRoll(rng: Rng): { d100: number; tier: string; survived: boolean } {
  const d = rng.d100();
  const level = tierOf(d, 0, [], []);
  return { d100: d, tier: tierName(tierAt(level).tier), survived: level >= TIERS.pos('near_miss') };
}

/** the morale roll (MB4, MB30): the actor's Resolve (the Morale function), with wounds (health and morale, MB35),
 * the player's renown on every morale roll of a foe fighting the player (MB24) and rally on allies beside the player */
export function moraleRoll(state: GameState, actor: Actor, rng: Rng, shift = 0): RollResult {
  const mods = [...renownMods(state, actor, actor !== state.player && hostile(state, actor, state.player)), ...rallyMods(state, actor, besidePlayer(state, actor))];
  return roll({ actorId: actor.id, skill: SK.resolve, modifiers: mods, tierShifts: shift ? [{ source: 'fear', value: shift }] : [] }, state, rng);
}

/** skills the actor has rolled that are not on its sheet: shown with raw 0 so a fist fighter sees Unarmed strike */
export function usedOffSheet(actor: Actor): string[] {
  return (actor.progression?.used ?? []).filter((k) => actor.core.skills[k] === undefined);
}
/** the mark for a tagged skill, in /stats text and on the sheets (the play screen explains it on hover) */
export const TAG_MARK = '✦';
