// Part 3: total HP, health track, body parts, roles, hit table.
import { RL } from '../library/tableIds';
import type { Actor, GameState, HealthLevel, Mod, PartState, RoleId } from '../types';
import { CONFIG } from '../config';
import { actorBody, getLibrary, itemDef } from '../library';
import { hasPerk } from './perks';
import { skillOpen } from './access';
import { SK } from '../library/skillIds';
import { PK } from '../library/perkIds';
import { moraleMods } from './morale';
import { fatigueMods } from './fatigue';
import { HEALTH_LEVELS, PART_STATES } from '../scales';

export function totalHp(state: GameState, actor: Actor): number {
  const end = actor.core.skills[SK.endurance];
  const raw = end && !end.dormant && skillOpen(actor, SK.endurance) ? end.raw : 0;
  return (CONFIG.HP_BASE + CONFIG.HP_PER_END * raw) * actorBody(state, actor).hpMultiplier;
}

export function healthLevel(actor: Actor): HealthLevel {
  const lost = actor.core.condition.hpLostPct;
  return CONFIG.HEALTH_TRACK.find(([, max]) => lost <= max)![0];
}
/** levels from Incapacitated on are "down" (by position on the health scale) */
export const isDownLevel = (l: HealthLevel) => HEALTH_LEVELS.pos(l) >= HEALTH_LEVELS.pos('incapacitated');
/** the levels the UI shows: Dead is never shown; a Dead actor shows as Incapacitated */
export const SHOWN_LEVELS = () => CONFIG.HEALTH_TRACK.filter(([l]) => l !== 'dead');
export const shownLevel = (l: HealthLevel): HealthLevel => (l === 'dead' ? 'incapacitated' : l);
/** someone else's health as the screen names it: Down once they fall, Dead when the player sees them clearly and they are dead */
export const othersHealthWord = (l: HealthLevel, clear: boolean): string => (l === 'dead' && clear ? HEALTH_LEVELS.name('dead') : isDownLevel(l) ? 'Down' : HEALTH_LEVELS.name(l));
export function woundsOfLevel(level: HealthLevel): number {
  return CONFIG.HEALTH_TRACK.find(([l]) => l === level)?.[2] ?? 0;
}

/** state of a pool by % left: Healthy >50, Damaged 50..>0, Crippled 0..>−100, Destroyed ≤ −100 */
export function poolState(pct: number): PartState {
  return pct > 50 ? 'healthy' : pct > 0 ? 'damaged' : pct > -100 ? 'crippled' : 'destroyed';
}
/** Healthy or Damaged: the part still does its job */
export const working = (s: PartState) => PART_STATES.pos(s) <= PART_STATES.pos('damaged');
export const partPct = (actor: Actor, id: string) => actor.core.condition.parts[id] ?? 100;

export function partStates(state: GameState, actor: Actor): { id: string; state: PartState }[] {
  return actorBody(state, actor).parts.map((p) => ({ id: p.id, state: poolState(partPct(actor, p.id)) }));
}

/** Part 3 shared roles: an on/off effect of a role (no running, can't fly) switches on when the role's Crippled and Destroyed
 * parts reach SHARED_ROLE_OFF_PCT of its parts, a Destroyed part counting twice (one Crippled leg of two still runs; one
 * Destroyed leg does not; a spider needs 5 of 8 legs Crippled). An actor with no part in the role is never switched off. */
export function roleOff(state: GameState, actor: Actor, role: RoleId): boolean {
  const parts = actorBody(state, actor).parts.filter((p) => p.roles.includes(role));
  if (!parts.length) return false;
  const hurt = parts.reduce((n, p) => {
    const at = PART_STATES.pos(poolState(partPct(actor, p.id)));
    return n + (at >= PART_STATES.pos('destroyed') ? 2 : at >= PART_STATES.pos('crippled') ? 1 : 0);
  }, 0);
  return hurt >= CONFIG.SHARED_ROLE_OFF_PCT * parts.length;
}

/** FR2: how far the actor reaches to take or hand over something: its longest working grip part (metres, from its body
 * type); 0 with none, as an amorphous body */
export function gripReachM(state: GameState, actor: Actor): number {
  const parts = new Set(usableGrips(state, actor));
  return Math.max(0, ...actorBody(state, actor).parts.filter((p) => parts.has(p.id)).map((p) => p.reachM ?? 0));
}

/** the actor can speak: its race talks (tag 'speaks') and a part with the speech role is not Destroyed */
export function canSpeak(state: GameState, actor: Actor): boolean {
  return !!getLibrary().races?.[actor.core.raceId ?? '']?.tags?.includes('speaks') &&
    actorBody(state, actor).parts.some((p) => p.roles.includes(RL.speech) && poolState(partPct(actor, p.id)) !== 'destroyed');
}

/** Grip parts that can still use a hand (Healthy or Damaged). */
export function usableGrips(state: GameState, actor: Actor): string[] {
  return actorBody(state, actor).parts
    .filter((p) => p.roles.includes(RL.grip) && working(poolState(partPct(actor, p.id))))
    .map((p) => p.id);
}

/** a part's state for its penalties: Tough It Out counts each one step milder (D6) */
export const effectiveState = (a: Actor, s: PartState): PartState => PART_STATES.at(PART_STATES.pos(s) - (hasPerk(a, PK.tough_it_out) ? 1 : 0));
const rolePenaltyOf = (s: PartState) =>
  s === 'healthy' ? 0 : s === 'damaged' ? CONFIG.ROLE_PENALTY.damaged : CONFIG.ROLE_PENALTY.crippled; // GAP: Destroyed counts as Crippled
/** Iron Frame (A12): an effective state at the Damaged position or milder gives no role penalty */
function rolePenalty(a: Actor, raw: PartState): number {
  const s = effectiveState(a, raw);
  return hasPerk(a, PK.iron_frame) && PART_STATES.pos(s) <= PART_STATES.pos('damaged') ? 0 : rolePenaltyOf(s);
}

/**
 * wounds-type roll modifiers for a skill: health-track level plus body-part role penalties.
 * ctx.itemId picks the limb (the grips holding that item, worse arm for two grips; 'natural:<mode>' its Strike part);
 * without an item, the best Grip arm is used.
 */
export function woundsMods(state: GameState, actor: Actor, skill: string, ctx: { itemId?: string; roles?: RoleId[] } = {}): Mod[] {
  const out: Mod[] = [];
  const level = healthLevel(actor);
  const lv = woundsOfLevel(level);
  if (lv) out.push({ source: `health: ${HEALTH_LEVELS.name(level)}`, type: 'wounds', value: lv });
  out.push(...moraleMods(actor)); // MB3: the morale level's penalty is wounds too
  out.push(...fatigueMods(actor)); // FT3: so is the fatigue level's
  const lib = getLibrary();
  const ct = actorBody(state, actor);
  const uses = ctx.roles ?? lib.skills[skill]?.roles ?? [];
  const st = (id: string) => poolState(partPct(actor, id));
  // any essential part Crippled or worse: one flat penalty on every roll (Tough It Out counts the part one step milder)
  const crip = ct.parts.find((p) => p.impact === 'essential' && PART_STATES.pos(effectiveState(actor, st(p.id))) >= PART_STATES.pos('crippled'));
  if (crip) out.push({ source: `essential part crippled: ${crip.id.replace(/_/g, ' ')}`, type: 'wounds', value: CONFIG.ESSENTIAL_CRIPPLED_PENALTY });
  // Past the Pain: the first Crippled part in body order gives no role penalty
  const spared = hasPerk(actor, PK.past_the_pain) ? ct.parts.find((p) => st(p.id) === 'crippled')?.id : undefined;
  const pen = (id: string) => (id === spared ? 0 : rolePenalty(actor, st(id)));
  const inst = actor.core.inventory.find((i) => i.id === ctx.itemId);
  for (const role of Object.keys(lib.roles) as RoleId[]) {
    const parts = ct.parts.filter((p) => p.roles.includes(role));
    if (!parts.length) continue;
    let v = 0;
    if (lib.roles[role].shared) {
      for (const p of parts) {
        const s = st(p.id);
        // Sense Crippled applies to every check, not only Sense-tagged ones
        if (uses.includes(role) || (role === RL.sense && !working(s))) v += pen(p.id) / parts.length;
      }
    } else if (uses.includes(role)) {
      if (role === RL.grip) {
        const held = inst?.equippedIn?.filter((h) => h.startsWith('grip:')).map((h) => h.slice(5)) ?? [];
        const pens = (held.length ? held : parts.map((p) => p.id)).map((id) => pen(id));
        v = held.length ? Math.min(...pens) : Math.max(...pens);
      } else if (role === RL.strike && ctx.itemId?.startsWith('natural:')) {
        const partId = ct.naturalAttacks.find((m) => m.id === ctx.itemId!.slice(8))?.partId;
        if (partId) v = pen(partId);
      }
    }
    if (v) out.push({ source: `${getLibrary().roles[role]?.name ?? role} wounds`, type: 'wounds', value: v });
  }
  // a Damaged shield: −10 to block (wounds type)
  if (inst && skill === SK.block && itemDef(state, inst.itemId).shield && poolState(inst.pools?.shield ?? 100) === 'damaged') {
    out.push({ source: 'shield damaged', type: 'wounds', value: CONFIG.ROLE_PENALTY.damaged });
  }
  return out;
}

/** d100 bands, database order, general area last; Destroyed parts removed. */
export function hitTable(state: GameState, actor: Actor): { part: string; from: number; to: number }[] {
  const ct = actorBody(state, actor);
  const live = ct.parts.filter((p) => poolState(partPct(actor, p.id)) !== 'destroyed');
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
  const parts = actorBody(state, actor).parts;
  return !!(parts.find((p) => p.id === a)?.adjacent?.includes(b) || parts.find((p) => p.id === b)?.adjacent?.includes(a));
}
