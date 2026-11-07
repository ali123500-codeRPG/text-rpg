// Part 3: total HP, health track, body parts, roles, hit table.
import type { Actor, GameState, HealthLevel, Mod, PartState, RoleId } from '../types';
import { CONFIG } from '../config';
import { creatureType, getLibrary, itemDef } from '../library';

export function totalHp(state: GameState, actor: Actor): number {
  const end = actor.core.skills.endurance;
  const raw = end && !end.dormant ? end.raw : 0;
  return (CONFIG.HP_BASE + CONFIG.HP_PER_END * raw) * creatureType(state, actor.core.creatureTypeId).hpMultiplier;
}

export function healthLevel(actor: Actor): HealthLevel {
  const lost = actor.core.condition.hpLostPct;
  if (lost >= 100) return 'Incapacitated';
  return CONFIG.HEALTH_TRACK.find(([, max]) => lost <= max)![0] as HealthLevel;
}
export function woundsOfLevel(level: HealthLevel): number {
  return CONFIG.HEALTH_TRACK.find(([l]) => l === level)?.[2] ?? 0;
}

/** state of a pool by % left: Healthy >50, Damaged 50..>0, Crippled 0..>−100, Destroyed ≤ −100 */
export function poolState(pct: number): PartState {
  return pct > 50 ? 'Healthy' : pct > 0 ? 'Damaged' : pct > -100 ? 'Crippled' : 'Destroyed';
}
export const working = (s: PartState) => s === 'Healthy' || s === 'Damaged';
export const partPct = (actor: Actor, id: string) => actor.core.condition.parts[id] ?? 100;

export function partStates(state: GameState, actor: Actor): { id: string; state: PartState }[] {
  return creatureType(state, actor.core.creatureTypeId).parts.map((p) => ({ id: p.id, state: poolState(partPct(actor, p.id)) }));
}

/** Grip parts that can still use a hand (Healthy or Damaged). */
export function usableGrips(state: GameState, actor: Actor): string[] {
  return creatureType(state, actor.core.creatureTypeId).parts
    .filter((p) => p.roles.includes('grip') && working(poolState(partPct(actor, p.id))))
    .map((p) => p.id);
}

const rolePenalty = (s: PartState) =>
  s === 'Healthy' ? 0 : s === 'Damaged' ? CONFIG.ROLE_PENALTY.damaged : CONFIG.ROLE_PENALTY.crippled; // GAP: Destroyed counts as Crippled

/**
 * wounds-type roll modifiers for a skill: health-track level plus body-part role penalties.
 * ctx.itemId picks the limb (the hands holding that item, worse arm for two hands; 'natural:<mode>' its Strike part);
 * without an item, the best Grip arm is used.
 */
export function woundsMods(state: GameState, actor: Actor, skill: string, ctx: { itemId?: string } = {}): Mod[] {
  const out: Mod[] = [];
  const level = healthLevel(actor);
  const lv = woundsOfLevel(level);
  if (lv) out.push({ source: `health: ${level}`, type: 'wounds', value: lv });
  const lib = getLibrary();
  const ct = creatureType(state, actor.core.creatureTypeId);
  const uses = lib.skills[skill]?.roles ?? [];
  const st = (id: string) => poolState(partPct(actor, id));
  const inst = actor.core.inventory.find((i) => i.id === ctx.itemId);
  for (const role of Object.keys(lib.roles) as RoleId[]) {
    const parts = ct.parts.filter((p) => p.roles.includes(role));
    if (!parts.length) continue;
    let v = 0;
    if (lib.roles[role].shared) {
      for (const p of parts) {
        const s = st(p.id);
        // Sense Crippled applies to every check, not only Sense-tagged ones
        if (uses.includes(role) || (role === 'sense' && !working(s))) v += rolePenalty(s) / parts.length;
      }
    } else if (uses.includes(role)) {
      if (role === 'grip') {
        const hands = inst?.equippedIn?.filter((h) => h.startsWith('hand:')).map((h) => h.slice(5)) ?? [];
        const pens = (hands.length ? hands : parts.map((p) => p.id)).map((id) => rolePenalty(st(id)));
        v = hands.length ? Math.min(...pens) : Math.max(...pens);
      } else if (role === 'strike' && ctx.itemId?.startsWith('natural:')) {
        const partId = ct.naturalAttacks.find((m) => m.id === ctx.itemId!.slice(8))?.partId;
        if (partId) v = rolePenalty(st(partId));
      }
    }
    if (v) out.push({ source: `${role} wounds`, type: 'wounds', value: v });
  }
  // a Damaged shield: −10 to block (wounds type)
  if (inst && skill === 'block' && itemDef(state, inst.itemId).shield && poolState(inst.pools?.shield ?? 100) === 'Damaged') {
    out.push({ source: 'shield damaged', type: 'wounds', value: CONFIG.ROLE_PENALTY.damaged });
  }
  return out;
}

/** d100 bands, database order, general area last; Destroyed parts removed. */
export function hitTable(state: GameState, actor: Actor): { part: string; from: number; to: number }[] {
  const ct = creatureType(state, actor.core.creatureTypeId);
  const live = ct.parts.filter((p) => poolState(partPct(actor, p.id)) !== 'Destroyed');
  const entries = [
    ...live.map((p) => ({ part: p.id, w: CONFIG.HIT_WEIGHT[p.size], min: 0 })),
    { part: 'general', w: ct.general.size === 'big' ? CONFIG.GENERAL_BIG_WEIGHT : 0, min: CONFIG.GENERAL_MIN_PCT },
  ];
  const W = entries.reduce((s, e) => s + e.w, 0);
  const exact = entries.map((e) => (W ? e.min + (e.w / W) * (100 - CONFIG.GENERAL_MIN_PCT) : e.part === 'general' ? 100 : 0));
  const n = exact.map(Math.floor);
  const frac = (i: number) => Math.round((exact[i] - n[i]) * 1e6);
  // largest remainder; ties: bigger weight, then later part (reproduces both spec tables; GAP: spec gives no tie rule)
  const order = entries.map((_, i) => i).sort((a, b) => frac(b) - frac(a) || entries[b].w - entries[a].w || b - a);
  let left = 100 - n.reduce((s, x) => s + x, 0);
  for (const i of order) if (left-- > 0) n[i]++;
  let from = 1;
  return entries.map((e, i) => {
    const row = { part: e.part, from, to: from + n[i] - 1 };
    from += n[i];
    return row;
  });
}

export function adjacent(state: GameState, actor: Actor, a: string, b: string): boolean {
  if (a === 'general' || b === 'general') return true;
  const parts = creatureType(state, actor.core.creatureTypeId).parts;
  return !!(parts.find((p) => p.id === a)?.adjacent?.includes(b) || parts.find((p) => p.id === b)?.adjacent?.includes(a));
}
