// What a roll or a blow does on average, taken over every d100 (no dice): the combat rating's fight model reads it.
// It calls the ruleset's own roll setup (rollSetup), tier step (rollLevel), gap ladder, hit table and damage step
// (blowDamage), so dice and expectation share one set of rules. Like every balance model, tiers have no end
// (MODEL_TIER_REACH extra bands each way), whatever the roller has unlocked.
import type { Actor, AttackMode, DefenseKind, GameState, Mod, RollRequest } from '../types';
import { CONFIG } from '../config';
import { TIERS } from '../scales';
import { itemDef } from '../library';
import { DEFENSE_SKILL } from '../library/skillIds';
import { blowDamage, defenseOwnMods, rollMargin, sumShifts, gapShiftsOf, ladder, restricted, rollLevel, rollSetup, weaponHitMods, type RollSetup } from '.';
import { defenseItem, modeSkill, openHandArm, usableDefense } from './gear';
import { hitTable } from './body';
import { actionRow, actionSeconds, attackRowIds } from './actionTime';
import { hasPerk } from './perks';
import { PK } from '../library/perkIds';

const ENDLESS = { up: CONFIG.MODEL_TIER_REACH, down: CONFIG.MODEL_TIER_REACH };

/** a set-up roll's odds hang on its margin before the die (skill and modifiers), its shifts, the skill (after-roll shifts)
 * and the roller's perks; the model asks the same ones many times, so they are kept (cleared when the store fills) */
const oddsMemo = new Map<string, Map<number, number>>();
const atkMemo = new WeakMap<Actor, Map<string, Map<number, number>>>();
/** the chance of each tier level on a set-up roll, over d100 = 1..100 (after-roll shifts included, tiers endless) */
export function tierOdds(su: RollSetup): Map<number, number> {
  const key = `${rollMargin(0, su.eff.value, su.modifiers)}|${sumShifts(su.shifts)}|${su.eff.skill}|${su.actor.core.perks.map((p) => (p.dormant ? '' : p.perkId)).join(',')}`;
  const hit = oddsMemo.get(key);
  if (hit) return hit;
  const out = new Map<number, number>();
  for (let d = 1; d <= 100; d++) {
    const { level } = rollLevel(su, d, true, undefined, ENDLESS);
    out.set(level, (out.get(level) ?? 0) + 0.01);
  }
  if (oddsMemo.size > 20000) oddsMemo.clear();
  oddsMemo.set(key, out);
  return out;
}
/** the chance of each tier level on a roll as the request asks it (the actor's own modifiers added, as roll() does) */
export const rollOdds = (req: RollRequest, state: GameState, actor: Actor): Map<number, number> => tierOdds(rollSetup(req, state, actor));
/** E[f(tier level)] over a roll's odds */
export const expectOver = (odds: Map<number, number>, f: (level: number) => number): number => [...odds].reduce((n, [l, p]) => n + p * f(l), 0);

/** one attack mode an actor can use: the item instance id ('unarmed', 'natural:<mode>') and the mode */
export type ModeRef = { itemId: string; mode: AttackMode };
/** a blow on average: health the target loses, raw damage its shield takes (before its pool), and the blow's seconds */
export type BlowAvg = { body: number; shield: number; secs: number; defense: DefenseKind };

/** the seconds one attack with this mode takes (its Action times rows: a blow, a throw, a span and a shot) */
export function attackSecs(state: GameState, A: Actor, m: ModeRef): number {
  const inst = A.core.inventory.find((i) => i.id === m.itemId);
  return attackRowIds(inst ? itemDef(state, inst.itemId) : undefined, m.mode).reduce((n, id) => { const r = actionRow(id); return n + (r ? actionSeconds(r) : 0); }, 0);
}

/** A's blow on D with this mode, on average over every d100 pair and every part of D's hit table, as attack() resolves it
 * with no situation (open ground, good light, no cover, nobody else near). `extra` adds roll modifiers to either side. */
export function expectBlow(state: GameState, A: Actor, D: Actor, m: ModeRef, extra: { attack?: Mod[]; defense?: Mod[] } = {}): BlowAvg {
  const { mode } = m, ranged = mode.tree === 'ranged';
  const name = m.itemId.startsWith('natural:') || m.itemId === 'unarmed' ? mode.id : itemDef(state, A.core.inventory.find((i) => i.id === m.itemId)?.itemId ?? '')?.name ?? mode.id;
  // the model's attacker strikes many times unchanged: its roll is set up once per actor object and condition
  const aKey = `${m.itemId}|${m.mode.id}|${D.id}|${A.core.condition.hpLostPct}|${A.core.condition.moraleLost}|${JSON.stringify(extra.attack ?? [])}`;
  const aMemo = atkMemo.get(A) ?? new Map<string, Map<number, number>>();
  atkMemo.set(A, aMemo);
  const atk = aMemo.get(aKey) ?? tierOdds(rollSetup({ actorId: A.id, skill: modeSkill(mode), modifiers: [...weaponHitMods(mode, name), ...(extra.attack ?? [])], tierShifts: [], itemId: m.itemId, rollKind: 'hit', against: D.id, contest: true, standInFns: mode.standInFns, blend: mode.blend, attackKind: ranged ? 'ranged' : 'melee' }, state, A));
  aMemo.set(aKey, atk);
  const type = usableDefense(state, D, ranged);
  const blocker = defenseItem(state, D, type);
  const openArm = type === 'parry' && !blocker ? openHandArm(state, D) : null;
  const def = tierOdds(rollSetup({ actorId: D.id, skill: DEFENSE_SKILL[type], modifiers: [...defenseOwnMods(state, D, type, ranged), ...(extra.defense ?? [])], tierShifts: [], itemId: blocker?.id, rollKind: type, against: A.id, contest: true }, state, D));
  const table = hitTable(state, D), H = CONFIG.HIT_GAPS, nearMiss = TIERS.pos('near_miss');
  const shieldMult = type === 'block' && mode.tree === 'melee' && mode.class === 'heavy' && hasPerk(A, PK.shield_breaker) ? CONFIG.SHIELD_BREAKER_MULT : 1;
  const rim = hasPerk(D, PK.iron_rim) ? CONFIG.IRON_RIM_MULT : 1;
  // one damage step per (place, multiplier): the same blow lands at many tier pairs
  const memo = new Map<string, number>();
  const dmg = (at: string, mult: number, arm: string | null): number => {
    const k = `${at}|${mult}|${arm}`;
    let v = memo.get(k);
    if (v === undefined) memo.set(k, (v = blowDamage(state, A, D, mode, at, mult, arm).damage));
    return v;
  };
  let body = 0, shield = 0;
  for (const [al, pa] of atk) {
    if (al < nearMiss) continue;
    for (const [dl, pd] of def) {
      const diff = dl - al, gap = diff + gapShiftsOf(state, D, mode, type, diff).reduce((n, s) => n + s.value, 0);
      const g = Math.min(CONFIG.GAP_MAX, gap), mult = ladder(type, g);
      if (!mult) continue;
      const p = pa * pd;
      if (type === 'block' && g >= H.shieldFrom) { shield += p * dmg('shield', mult, null) * shieldMult * rim; continue; }
      for (const row of table) {
        const w = (row.to - row.from + 1) / 100;
        const at = openArm ?? (restricted(state, D, type, g, row.part) ? 'general' : row.part);
        body += p * w * dmg(at, mult, openArm);
      }
    }
  }
  return { body, shield, secs: attackSecs(state, A, m), defense: type };
}
