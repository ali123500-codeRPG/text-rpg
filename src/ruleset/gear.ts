// Part 1 §3 effective skill and substitution; Part 5 §2–5 active effects, tools and attack modes.
import type { Actor, AttackMode, GameState, ItemDef, ItemEffect, ItemInstance, Mod, RollKind } from '../types';
import { CONFIG } from '../config';
import { creatureType, getLibrary, itemDef } from '../library';
import { partPct, poolState, usableGrips, working } from './body';
import { hasPerk, trueSkill } from './perks';
import { heldBy } from '../engine/relations';

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
  return mode.skill ?? (mode.tree === 'unarmed' ? 'unarmed_strike' : `${mode.tree}_${mode.class}`);
}

/** gear skill bonuses for one skill; all kit effects share one KIT_BONUS */
function gearFor(state: GameState, actor: Actor, skill: string, ctx: { itemId?: string; modeId?: string }) {
  const out: { source: string; value: number }[] = [];
  let kit: string | null = null;
  for (const { def, e, source } of activeEffects(state, actor, ctx.itemId)) {
    if (e.kind !== 'skill') continue;
    const fits = e.skill === skill ||
      (e.skill === '$mode' && (def.weapon?.modes ?? []).some((m) => (!ctx.modeId || m.id === ctx.modeId) && modeSkill(m) === skill));
    if (!fits) continue;
    if (e.kit) kit ??= source;
    else out.push({ source, value: e.value });
  }
  if (kit) out.push({ source: kit, value: CONFIG.KIT_BONUS });
  return out;
}

/** a skill's final efficiency multiplier from its tier (1 for an unknown skill) */
export const tierMult = (skill: string): number => CONFIG.SKILL_TIER_MULT[getLibrary().skills[skill]?.tier ?? 'tier_2'] ?? 1;

/** Effective skill (Part 1 §3), with substitution: returns the skill actually used. */
export function effectiveSkill(state: GameState, actor: Actor, skill: string, ctx: { itemId?: string; modeId?: string; fullValue?: string[] } = {}) {
  const skills = getLibrary().skills;
  // substitutes: skills sharing a function at the flat efficiency, or the skill's own table (CONFIG.SUBSTITUTES)
  const table = CONFIG.SUBSTITUTES[skill] ?? (skills[skill]?.functions ?? []).map((fn) => ({ fn, k: CONFIG.SUBSTITUTE_EFFICIENCY }));
  const share = (id: string) => (id === skill || (ctx.fullValue?.includes(id) && skills[id]) ? 1 : Math.max(0, ...table.filter((t) => (skills[id]?.functions as string[] ?? []).includes(t.fn)).map((t) => t.k)));
  const cands = [skill, ...Object.keys(skills).filter((id) => id !== skill && share(id) > 0)];
  let best: { skill: string; value: number; gear: { source: string; value: number }[] } | null = null;
  for (const id of cands) {
    const k = share(id);
    const entry = actor.core.skills[id];
    const gear = gearFor(state, actor, id, ctx).map((g) => ({ ...g, value: g.value * k }));
    // true skill (S3) and gear, × the skill's tier multiplier (final efficiency, Ali 08/11/2026)
    const tier = tierMult(id);
    const value = ((entry && !entry.dormant ? trueSkill(actor, id) : 0) * k + gear.reduce((s, g) => s + g.value, 0)) * tier;
    for (const g of gear) g.value *= tier;
    if (!best || value > best.value) best = { skill: id, value, gear };
  }
  return best!; // GAP: hard cap (D-3) and condition effects not designed yet
}

/** noted roll modifiers (type gear) for one roll kind */
export function rollMods(state: GameState, actor: Actor, kind: RollKind, itemId?: string): Mod[] {
  return activeEffects(state, actor, itemId)
    .filter(({ e }) => e.kind === 'rollMod' && e.roll === kind)
    .map(({ e, source }) => ({ source, type: 'gear' as const, value: e.value }));
}

/** situation-roll modifiers from perks, gear and statuses naming the situation roll (one copy counts). */
export function situationMods(state: GameState, actor: Actor): { source: string; type: 'perk' | 'gear' | 'status'; value: number }[] {
  const perks = getLibrary().perks;
  const out: { source: string; type: 'perk' | 'gear' | 'status'; value: number }[] = [];
  for (const p of actor.core.perks) {
    const def = perks[p.perkId];
    if (!p.dormant && def?.situation) out.push({ source: def.name, type: 'perk', value: def.situation });
  }
  for (const m of rollMods(state, actor, 'situation')) out.push({ ...m, type: 'gear' });
  // GAP: statuses have no library entries yet, so none can name the situation roll
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

/** fallback unarmed mode for a creature with no natural attacks (UNARMED_PROFILE = class punch) */
export const UNARMED_MODE: AttackMode = { id: 'unarmed', tree: 'unarmed', class: 'punch', skill: 'unarmed_strike', reach: 0, hands: 0, name: 'fists' };

/** attack modes the actor can use now: held weapon modes, then natural/unarmed. */
export function usableModes(state: GameState, actor: Actor): { itemId: string; mode: AttackMode }[] {
  const grips = usableGrips(state, actor);
  const maxHands = heldBy(state, actor) ? 1 : grips.length; // A8 Hold: a held actor can't use a two-handed mode
  const out: { itemId: string; mode: AttackMode }[] = [];
  for (const inst of actor.core.inventory) {
    if (!isHeld(inst) || !handsOf(inst).every((h) => grips.includes(h))) continue;
    for (const mode of itemDef(state, inst.itemId).weapon?.modes ?? []) if (mode.hands <= maxHands) out.push({ itemId: inst.id, mode });
  }
  const ct = creatureType(state, actor.core.creatureTypeId);
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
  const ct = creatureType(state, actor.core.creatureTypeId);
  if (weaponId === 'unarmed' || weaponId.startsWith('natural:')) {
    const id = weaponId === 'unarmed' ? modeId : weaponId.slice(8);
    const mode = ct.naturalAttacks.find((m) => m.id === id) ?? (weaponId === 'unarmed' ? ct.naturalAttacks.find((m) => !m.partId) ?? UNARMED_MODE : undefined);
    if (!mode) throw new Error(`no natural attack ${weaponId}`);
    return { mode, name: mode.name ?? mode.id };
  }
  const inst = actor.core.inventory.find((i) => i.id === weaponId);
  if (!inst) throw new Error(`${actor.id} has no item ${weaponId}`);
  const def = itemDef(state, inst.itemId);
  const modes = def.weapon?.modes ?? [];
  const mode = modeId ? modes.find((m) => m.id === modeId) : modes.find((m) => m.reach >= distance) ?? modes[0];
  if (!mode) throw new Error(`no attack mode ${modeId ?? ''} on ${weaponId}`);
  return { mode, name: def.name };
}

/** the item a block uses: a held shield (not Crippled) in working Grip hands, else a held melee weapon. */
export function blockItem(state: GameState, actor: Actor): ItemInstance | null {
  const grips = usableGrips(state, actor);
  const held = actor.core.inventory.filter((i) => isHeld(i) && handsOf(i).every((h) => grips.includes(h)));
  return (
    held.find((i) => itemDef(state, i.itemId).shield && working(poolState(i.pools?.shield ?? 100))) ??
    held.find((i) => itemDef(state, i.itemId).weapon?.modes.some((m) => m.tree === 'melee' && !m.thrown)) ??
    null
  );
}

/** A7 Open-Hand Guard: an owner holding no shield or weapon blocks with a working Grip arm whose hand is empty; returns that arm. */
export function openHandArm(state: GameState, actor: Actor): string | null {
  if (!hasPerk(actor, 'open_hand_guard')) return null;
  const held = actor.core.inventory.filter(isHeld);
  if (held.some((i) => { const d = itemDef(state, i.itemId); return !!d.shield || !!d.weapon; })) return null;
  const busy = new Set(held.flatMap(handsOf));
  return usableGrips(state, actor).find((h) => !busy.has(h)) ?? null;
}

/** whether the actor can block at all: a held shield or melee weapon, or Open-Hand Guard */
export const canBlock = (state: GameState, actor: Actor) => !!blockItem(state, actor) || !!openHandArm(state, actor);

/** Default standing defense (Part 2, Agent Planner): whichever of dodge and block has the higher effective skill; a tie goes to block. */
export function defaultStandingDefense(state: GameState, actor: Actor): 'block' | 'dodge' {
  const shield = blockItem(state, actor);
  if (!shield && !openHandArm(state, actor)) return 'dodge';
  const block = effectiveSkill(state, actor, 'block', { itemId: shield?.id }).value;
  return block >= effectiveSkill(state, actor, 'dodge').value ? 'block' : 'dodge';
}
