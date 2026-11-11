// Part 1 §3 effective skill and substitution; Part 5 §2–5 active effects, tools and attack modes.
import type { Actor, AttackMode, DefenseKind, GameState, ItemDef, ItemEffect, ItemInstance, Mod, RollKind, SituationTag, SkillFunction, TierShift, Zone } from '../types';
import { zoneLight } from '../time';
import { LIGHT } from '../scales';
import { CONFIG } from '../config';
import { actorBody, getLibrary, itemDef } from '../library';
import { partPct, poolState, usableGrips, working } from './body';
import { hasPerk, perkSum, standInAdd, trueSkill } from './perks';
import { achievementStandIn, bestReward } from './achRewards';
import { skillOpen } from './access';
import { heldBy } from '../engine/relations';
import { SK, SENSE_SKILL, CLASS_SKILL, DEFENSE_SKILL } from '../library/skillIds';
import { requirement, requiredSkill } from './requirements';
import { PK } from '../library/perkIds';
import { FN } from '../library/functionIds';
import { skillName } from '../library/skillNames';
import { AM } from '../library/tableIds';

export const isHeld = (i: ItemInstance) => !!i.equippedIn?.some((s) => s.startsWith('hand:'));
export const isWorn = (i: ItemInstance) => !!i.equippedIn?.some((s) => s === 'armor' || s.startsWith('acc:'));
export const handsOf = (i: ItemInstance) => (i.equippedIn ?? []).filter((s) => s.startsWith('hand:')).map((s) => s.slice(5));

type Active = { inst: ItemInstance; def: ItemDef; e: ItemEffect; source: string };

/** active effects; one copy counts: each effect of an item id counts once however many instances apply it */
function activeEffects(state: GameState, actor: Actor, itemId?: string): Active[] {
  const seen = new Set<string>();
  const out: Active[] = [];
  for (const inst of actor.core.inventory) {
    const def = itemDef(state, inst.itemId);
    (def.effects ?? []).forEach((e, idx) => {
      const key = `${inst.itemId}#${idx}`;
      if (seen.has(key)) return;
      if (e.scope === 'withItem' && inst.id !== itemId) return;
      const on = e.active === 'worn' ? isWorn(inst) : e.active === 'held' ? isHeld(inst) : e.active === 'inUse' ? inst.id === itemId : true;
      if (!on) return;
      seen.add(key);
      out.push({ inst, def, e, source: `Gear (${e.active}): ${def.name}` });
    });
  }
  return out;
}

/** skill (tree + class; unarmed: mode.skill) */
export function modeSkill(mode: AttackMode): string {
  return mode.skill ?? (mode.tree === 'unarmed' ? SK.unarmed_strike : CLASS_SKILL[mode.tree]?.[mode.class]);
}

/** a standard-kit piece's bonus: EQUIP_FACTOR × the item's need; an item with no level keeps its own value */
export function kitBonus(def: ItemDef, e: ItemEffect): number {
  const r = requirement(def);
  return r ? CONFIG.EQUIP_FACTOR * r.need : e.value;
}

/** a mode's reach in metres: its own (a throw mode's is its throw range) + extra metres (a thrown weapon's perks). The
 * one reach equation: attacks, item value and the library all read it. */
export const modeReach = (mode: AttackMode, extraM = 0): number => mode.reachM + extraM;

/** an item's mode with its attack mode row's rules applied. Throw: its own throw range (+ perks' throwReach metres), and a combined roll of
 * the weapon's own skill and the same class's ranged skill at the row's blend shares. */
export function withRow(actor: Actor, def: ItemDef, mode: AttackMode): AttackMode {
  const row = getLibrary().attackModes?.[mode.id];
  if (!row?.blend && !mode.thrown) return mode;
  const own = requiredSkill(def) ?? modeSkill(mode), ranged = CLASS_SKILL.ranged[mode.class];
  return { ...mode, reach: modeReach(mode, mode.thrown ? perkSum(actor, 'throwReach') : 0),
    ...(row?.blend && ranged ? { skill: own, blend: [{ skill: own, share: row.blend.weapon }, { skill: ranged, share: row.blend.ranged }] } : {}) };
}

/** a combined roll's effective skill: each part's effectiveSkill (its own stand-ins and gear) × its share, summed */
export function blendedSkill(state: GameState, actor: Actor, blend: { skill: string; share: number }[], ctx: Parameters<typeof effectiveSkill>[3] = {}) {
  const parts = blend.map((b) => ({ ...effectiveSkill(state, actor, b.skill, ctx), share: b.share }));
  return { skill: parts[0].skill, value: parts.reduce((n, p) => n + p.value * p.share, 0), gear: parts.flatMap((p) => p.gear.map((g) => ({ ...g, value: g.value * p.share }))), parts: parts.map((p) => p.skill) };
}

/** gear skill bonuses for one skill; all kit effects share one bonus, the best of them */
function gearFor(state: GameState, actor: Actor, skill: string, ctx: { itemId?: string; modeId?: string }) {
  const out: { source: string; value: number }[] = [];
  let kit: { source: string; value: number } | null = null;
  for (const { def, e, source } of activeEffects(state, actor, ctx.itemId)) {
    if (e.kind !== 'skill') continue;
    const fits = e.skill === skill ||
      (e.skill === '$mode' && (def.weapon?.modes ?? []).some((m) => (!ctx.modeId || m.id === ctx.modeId) && modeSkill(withRow(actor, def, m)) === skill));
    if (!fits) continue;
    if (e.kit) { const v = kitBonus(def, e); if (!kit || v > kit.value) kit = { source, value: v }; }
    else out.push({ source, value: e.value });
  }
  if (kit) out.push(kit);
  return out;
}

/** ST21/ST22: a roll's situation tags: its skill's tags plus any an action adds (a Hide adds hide) */
export const rollTags = (skill: string, add: SituationTag[] = []): SituationTag[] => [...new Set([...(getLibrary().skills[skill]?.tags ?? []), ...add])];
/** the summed sign a situational table gives a roll's tags (+ helps the roll's owner) */
export const tagSign = (table: 'light' | 'cover', tags: SituationTag[]): number => tags.reduce((n, t) => n + (CONFIG.SITUATION_TAGS[table][t] ?? 0), 0);

/** ST21: the light modifier (light where the action is) and, for tags cover reaches on the roll itself, the cover tier
 * shift (the roller's zone) for one roll. A ranged attack's cover is a gap shift instead (ruleset attack). */
export function situational(state: GameState, skill: string, at: { light?: Zone; cover?: Zone; add?: SituationTag[]; actor?: Actor }): { modifiers: Mod[]; tierShifts: TierShift[] } {
  const tags = rollTags(skill, at.add);
  // All-50 Child of Night: light reads one step darker for the owner's stealth rolls
  // All-50 Night Eyes: light reads one step brighter for the owner's Eyesight rolls
  const darker = (tags.includes('stealth') && hasPerk(at.actor, PK.child_of_night) ? 1 : 0) - (skill === SK.eyesight && hasPerk(at.actor, PK.night_eyes) ? 1 : 0);
  const light = at.light ? tagSign('light', tags) * (CONFIG.LIGHT_MODS[LIGHT.at(Math.max(0, LIGHT.pos(zoneLight(state, at.light)) + darker))] ?? 0) : 0;
  const cover = at.cover ? tagSign('cover', tags.filter((t) => t !== 'ranged')) * (CONFIG.COVER_GAP[at.cover.cover] ?? 0) : 0;
  return { modifiers: light ? [{ source: 'light', type: 'situational', value: light }] : [], tierShifts: cover ? [{ source: 'cover', value: cover }] : [] };
}

/** a skill's final efficiency multiplier from its tier (1 for an unknown skill) */
export const tierMult = (skill: string): number => CONFIG.SKILL_TIER_MULT[getLibrary().skills[skill]?.tier ?? 'tier_2'] ?? 1;

/** Stand-ins: the functions that can stand in for a skill and the share each counts at. The skill's own table
 * (CONFIG.SUBSTITUTES) or its functions at the flat CONFIG.SUBSTITUTE_EFFICIENCY; the owner's perks move each share
 * (F4, PerkDef.standIn) and achievements (standIn) move each share, kept within 0–1. No actor: the shares before perks (the library viewer shows these). */
export function standInTable(skill: string, actor?: Actor, extraFns: string[] = []): { fn: string; k: number }[] {
  const base = CONFIG.SUBSTITUTES[skill] ?? (getLibrary().skills[skill]?.functions ?? []).map((fn) => ({ fn, k: CONFIG.SUBSTITUTE_EFFICIENCY }));
  return [...base, ...extraFns.filter((fn) => !base.some((t) => t.fn === fn)).map((fn) => ({ fn, k: CONFIG.SUBSTITUTE_EFFICIENCY }))]
    .map((t) => ({ fn: t.fn, k: Math.min(1, Math.max(0, t.k + (actor ? standInAdd(actor, t.fn) + achievementStandIn(actor, skill) : 0))) }));
}
/** the share skill `id` counts at when a roll needs `skill`: 1 for the skill itself (or a full-value skill), else the best
 * share among the table's functions that `id` has, 0 when it can't stand in */
export function standInShare(skill: string, id: string, table = standInTable(skill), fullValue?: string[]): number {
  const skills = getLibrary().skills;
  if (id !== skill && CONFIG.NO_STAND_IN.some(([x, y]) => (x === skill && y === id) || (x === id && y === skill))) return 0; // a named exception pair
  return id === skill || (fullValue?.includes(id) && skills[id]) ? 1 : Math.max(0, ...table.filter((t) => (skills[id]?.functions as string[] ?? []).includes(t.fn)).map((t) => t.k));
}

/** the skills that have function `fn` (a function roll counts them all at full value) */
export const fnSkills = (fn: string): string[] => Object.values(getLibrary().skills).filter((s) => ((s.functions ?? []) as string[]).includes(fn)).map((s) => s.id);
/** the skill a function roll will use: the best effective skill with `fn`. Callers read situational modifiers from it,
 * so light and Night Eyes follow the skill that rolls (Q3): Tremor ignores light. */
/** the skills a function roll counts at full value: the function's skills; for an owner of the Perception All-150 Every
 * Sense One, a sight or hearing roll counts both senses' skills */
export const rollFnSkills = (actor: Actor, fn: string): string[] => {
  const senses: string[] = [FN.sight, FN.hearing];
  return senses.includes(fn) && hasPerk(actor, PK.one_sense) ? senses.flatMap(fnSkills) : fnSkills(fn);
};
export const fnRoller = (state: GameState, actor: Actor, fn: SkillFunction): string => effectiveSkill(state, actor, (SENSE_SKILL as Record<string, string>)[fn] ?? fn, { fullValue: rollFnSkills(actor, fn) }).skill;

/** Effective skill (Part 1 §3), with substitution: returns the skill actually used. */
export function effectiveSkill(state: GameState, actor: Actor, skill: string, ctx: { itemId?: string; modeId?: string; fullValue?: string[]; standInFns?: string[]; rollKind?: RollKind } = {}) {
  const skills = getLibrary().skills;
  const table = standInTable(skill, actor, ctx.standInFns);
  const share = (id: string) => standInShare(skill, id, table, ctx.fullValue);
  const cands = [skill, ...Object.keys(skills).filter((id) => id !== skill && share(id) > 0)];
  let best: { skill: string; value: number; gear: { source: string; value: number }[] } | null = null;
  for (const id of cands) {
    const k = share(id);
    const entry = actor.core.skills[id];
    const gear = (skillOpen(actor, id) ? gearFor(state, actor, id, ctx) : []).map((g) => ({ ...g, value: g.value * k }));
    // true skill (S3) and gear, × the skill's tier multiplier (final efficiency)
    const tier = tierMult(id);
    const value = ((entry && !entry.dormant ? trueSkill(actor, id) : 0) * k + gear.reduce((s, g) => s + g.value, 0)) * tier;
    for (const g of gear) g.value *= tier;
    if (!best || value > best.value) best = { skill: id, value, gear };
  }
  for (const a of augmentsOf(actor, skill, ctx.rollKind)) { best!.value += a.value; best!.gear.push(a); } // skills that augment this one
  return best!; // GAP: hard cap (D-3) and condition effects not designed yet
}

/** augments the actor's perks give (PerkDef.augments, All-50 Grit), for `skill` on a roll of this kind: the augmenting
 * skill's tree must be open and the skill not dormant, as for a skill's own augments */
export function perkAugments(actor: Actor, skill: string, rollKind?: RollKind): { from: string; share?: number; perk: string }[] {
  const perks = getLibrary().perks, out: { from: string; share?: number; perk: string }[] = [];
  for (const p of actor.core.perks) {
    const def = perks[p.perkId];
    if (p.dormant || !def?.augments) continue;
    for (const g of def.augments) {
      if (g.skill !== skill || (g.rollKinds && (!rollKind || !g.rollKinds.includes(rollKind))) || !skillOpen(actor, g.from) || actor.core.skills[g.from]?.dormant) continue;
      out.push({ from: g.from, share: g.share, perk: def.name });
    }
  }
  return out;
}

/** skills augmenting `skill` on this roll (SkillDef.augments): each adds true skill × share × its tier, when its tree is
 * open and the roll kind fits (no kinds listed: every roll and check of the skill) */
export function augmentsOf(actor: Actor, skill: string, rollKind?: RollKind): { source: string; value: number }[] {
  const skills = getLibrary().skills, out: { source: string; value: number }[] = [];
  for (const id of Object.keys(actor.core.skills)) {
    for (const g of skills[id]?.augments ?? []) {
      if (g.skill !== skill || (g.rollKinds && (!rollKind || !g.rollKinds.includes(rollKind))) || !skillOpen(actor, id) || actor.core.skills[id].dormant) continue;
      const value = trueSkill(actor, id) * (g.share ?? 1) * tierMult(id);
      if (value) out.push({ source: `${skillName(id)} (augments)`, value });
    }
  }
  for (const g of perkAugments(actor, skill, rollKind)) {
    const value = trueSkill(actor, g.from) * (g.share ?? 1) * tierMult(g.from);
    if (value) out.push({ source: `${skillName(g.from)} (augments, ${g.perk})`, value });
  }
  return out;
}

/** noted roll modifiers (type gear) for one roll kind */
export function rollMods(state: GameState, actor: Actor, kind: RollKind, itemId?: string): Mod[] {
  return activeEffects(state, actor, itemId)
    .filter(({ e }) => e.kind === 'rollMod' && e.roll === kind)
    .map(({ e, source }) => ({ source, type: 'gear' as const, value: e.value }));
}

/** event-roll modifiers from perks, gear and statuses naming the event roll (one copy counts). */
export function eventRollMods(state: GameState, actor: Actor): { source: string; type: 'perk' | 'gear' | 'status' | 'achievement'; value: number }[] {
  const perks = getLibrary().perks;
  const out: { source: string; type: 'perk' | 'gear' | 'status' | 'achievement'; value: number }[] = [];
  for (const p of actor.core.perks) {
    const def = perks[p.perkId];
    if (!p.dormant && def?.eventRoll) out.push({ source: def.name, type: 'perk', value: def.eventRoll });
  }
  for (const m of rollMods(state, actor, 'event')) out.push({ ...m, type: 'gear' });
  const ach = bestReward(actor, 'eventRoll'); // an achievement reward (Old Blood)
  if (ach) out.push({ source: ach.name, type: 'achievement', value: ach.value });
  // GAP: statuses have no library entries yet, so none can name the event roll
  return out;
}

/** Part 5 §2 Tools: best carried tool for a skill; may stow the off-hand item (free). */
export function pickTool(state: GameState, actor: Actor, skill: string): { itemId: string | null; stowed: string | null } {
  let best: ItemInstance | null = null;
  let bestV = -Infinity;
  for (const inst of actor.core.inventory) {
    for (const e of itemDef(state, inst.itemId).effects ?? []) {
      if (e.kind === 'skill' && e.active === 'inUse' && e.skill === skill && e.value > bestV) {
        best = inst;
        bestV = e.value;
      }
    }
  }
  if (!best) return { itemId: null, stowed: null };
  if (isHeld(best)) return { itemId: best.id, stowed: null };
  const hands = usableGrips(state, actor);
  if (!hands.length) return { itemId: null, stowed: null }; // GAP: no usable hand, so no tool
  const holder = (h: string) => actor.core.inventory.find((i) => i.equippedIn?.includes(`hand:${h}`));
  if (hands.some((h) => !holder(h))) return { itemId: best.id, stowed: null };
  const items = hands.map(holder) as ItemInstance[];
  // off-hand: a held non-weapon (shield, torch), else the last hand's item
  const off = items.find((i) => itemDef(state, i.itemId).kind !== 'weapon') ?? items[items.length - 1];
  return { itemId: best.id, stowed: off.id };
}

/** fallback unarmed mode for a body type with no natural attacks (UNARMED_PROFILE = class punch) */
/** an attack mode's display name: its own (natural attacks) or its attackModes row's */
export const modeName = (m: AttackMode) => m.name ?? getLibrary().attackModes?.[m.id]?.name ?? m.id;

/** the attack mode ID an agent wrote: an AM id as is, or a mode name (any case) mapped to its id */
export function modeIdOf(word: string): string {
  const w = word.trim().toLowerCase();
  return Object.values(getLibrary().attackModes ?? {}).find((m) => m.id.toLowerCase() === w || m.name.toLowerCase() === w)?.id ?? word;
}

export const UNARMED_MODE: AttackMode = { id: AM.unarmed, tree: 'unarmed', class: 'punch', skill: SK.unarmed_strike, reachM: 0.7, reach: 0.7, hands: 0, name: 'fists' };

/** attack modes the actor can use now: held weapon modes, then natural/unarmed. */
export function usableModes(state: GameState, actor: Actor): { itemId: string; mode: AttackMode }[] {
  const grips = usableGrips(state, actor);
  const maxHands = heldBy(state, actor) ? 1 : grips.length; // A8 Hold: a held actor can't use a two-handed mode
  const out: { itemId: string; mode: AttackMode }[] = [];
  for (const inst of actor.core.inventory) {
    if (!isHeld(inst) || !handsOf(inst).every((h) => grips.includes(h))) continue;
    const def = itemDef(state, inst.itemId);
    for (const mode of def.weapon?.modes ?? []) if (mode.hands <= maxHands) out.push({ itemId: inst.id, mode: withRow(actor, def, mode) });
  }
  const ct = actorBody(state, actor);
  for (const mode of ct.naturalAttacks) {
    if (!mode.partId || working(poolState(partPct(actor, mode.partId)))) out.push({ itemId: `natural:${mode.id}`, mode });
  }
  if (!ct.naturalAttacks.length) out.push({ itemId: 'unarmed', mode: UNARMED_MODE });
  return out;
}

/** Part 5 §5 default mode: first held mode whose reach covers `distance` links, else the unarmed mode. */
export function defaultMode(state: GameState, actor: Actor, distance: number): { itemId: string; mode: AttackMode } | null {
  return usableModes(state, actor).find((m) => m.mode.reach >= distance) ?? null;
}

/** the mode an attack request names (item instance, 'natural:<id>' or 'unarmed') */
export function resolveMode(state: GameState, actor: Actor, weaponId: string, modeId: string | undefined, distance: number): { mode: AttackMode; name: string } {
  const ct = actorBody(state, actor);
  if (weaponId === 'unarmed' || weaponId.startsWith('natural:')) {
    const id = weaponId === 'unarmed' ? modeId : weaponId.slice(8);
    const mode = ct.naturalAttacks.find((m) => m.id === id) ?? (weaponId === 'unarmed' ? ct.naturalAttacks.find((m) => !m.partId) ?? UNARMED_MODE : undefined);
    if (!mode) throw new Error(`no natural attack ${weaponId}`);
    return { mode, name: modeName(mode) };
  }
  const inst = actor.core.inventory.find((i) => i.id === weaponId);
  if (!inst) throw new Error(`${actor.id} has no item ${weaponId}`);
  const def = itemDef(state, inst.itemId);
  const modes = (def.weapon?.modes ?? []).map((m) => withRow(actor, def, m));
  const mode = modeId ? modes.find((m) => m.id === modeId) : modes.find((m) => m.reach >= distance) ?? modes[0];
  if (!mode) throw new Error(`no attack mode ${modeId ?? ''} on ${weaponId}`);
  return { mode, name: def.name };
}

const heldInGrips = (state: GameState, actor: Actor): ItemInstance[] => {
  const grips = usableGrips(state, actor);
  return actor.core.inventory.filter((i) => isHeld(i) && handsOf(i).every((h) => grips.includes(h)));
};

/** the item a block uses: a held shield (not Crippled) in working Grip hands. Block is shields only (PA1). */
export function blockItem(state: GameState, actor: Actor): ItemInstance | null {
  return heldInGrips(state, actor).find((i) => itemDef(state, i.itemId).shield && working(poolState(i.pools?.shield ?? 100))) ?? null;
}

/** the weapon a parry uses: a held melee weapon in working Grip hands (PA1, PA2) */
export function parryItem(state: GameState, actor: Actor): ItemInstance | null {
  return heldInGrips(state, actor).find((i) => itemDef(state, i.itemId).weapon?.modes.some((m) => m.tree === 'melee' && !m.thrown)) ?? null;
}

/** A7 Open-Hand Guard (PA10): an owner holding no shield or weapon parries with a working Grip arm whose hand is empty; returns that arm. */
export function openHandArm(state: GameState, actor: Actor): string | null {
  if (!hasPerk(actor, PK.open_hand_guard)) return null;
  const held = actor.core.inventory.filter(isHeld);
  if (held.some((i) => { const d = itemDef(state, i.itemId); return !!d.shield || !!d.weapon; })) return null;
  const busy = new Set(held.flatMap(handsOf));
  return usableGrips(state, actor).find((h) => !busy.has(h)) ?? null;
}

/** whether the actor can block at all: a held shield */
export const canBlock = (state: GameState, actor: Actor) => !!blockItem(state, actor);
/** whether the actor can parry at all: a held melee weapon, or Open-Hand Guard with an empty hand */
export const canParry = (state: GameState, actor: Actor) => !!parryItem(state, actor) || !!openHandArm(state, actor);

/** the item a defense rolls with (shield for block, weapon for parry), for gear bonuses on the roll */
export function defenseItem(state: GameState, actor: Actor, type: DefenseKind): ItemInstance | null {
  return type === 'block' ? blockItem(state, actor) : type === 'parry' ? parryItem(state, actor) : null;
}

/** the defense an actor can use against this attack: its standing defense if it works, else the best one that does
 * (no shield, no block; no weapon or open hand, no parry; parry can't stop missiles, PA11) */
export function usableDefense(state: GameState, actor: Actor, ranged: boolean): DefenseKind {
  const can = (t: DefenseKind) => t === 'dodge' || (t === 'block' ? canBlock(state, actor) : !ranged && canParry(state, actor));
  return can(actor.core.standingDefense) ? actor.core.standingDefense : bestDefense(state, actor, (['block', 'parry', 'dodge'] as DefenseKind[]).filter(can));
}

const bestDefense = (state: GameState, actor: Actor, kinds: DefenseKind[]): DefenseKind => {
  const value = (t: DefenseKind) => effectiveSkill(state, actor, DEFENSE_SKILL[t], { itemId: defenseItem(state, actor, t)?.id }).value;
  return kinds.reduce((best, t) => (value(t) > value(best) ? t : best), kinds[0] ?? 'dodge');
};

/** Default standing defense (Part 2, Agent Planner): whichever usable defense has the highest effective skill; ties go block, parry, dodge. */
export function defaultStandingDefense(state: GameState, actor: Actor): DefenseKind {
  const kinds: DefenseKind[] = ['block', 'parry', 'dodge'];
  return bestDefense(state, actor, kinds.filter((t) => t === 'dodge' || (t === 'block' ? canBlock(state, actor) : canParry(state, actor))));
}
