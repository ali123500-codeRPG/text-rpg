// XP and levels (Ali, 07/11/2026, XP proposal X1–X10). Code only: no agent sees or sends XP.
import type { Actor, GameEvent, GameState, XpAward } from '../types';
import { CONFIG } from '../config';
import { creatureType, getLibrary, npcTemplate } from '../library';
import { isActive, wary } from './relations';
import { logCode } from './effects';

export const charLevel = (a: Actor) => a.core.classes.reduce((n, c) => n + c.level, 0);
export const xpToNext = (a: Actor) => CONFIG.LEVEL_XP * Math.max(1, charLevel(a));
/** Part 1 §6 Total: raw skills, Tagged excluded. */
export const skillTotal = (a: Actor) => Object.values(a.core.skills).reduce((n, s) => n + (s.state === 'tagged' ? 0 : s.raw), 0);

/** Award XP to the player with a trail entry; level up as often as the XP allows (X9: into the chosen class). */
export function awardXp(state: GameState, amount: number, source: string): void {
  const p = state.player, pr = p.progression;
  if (!pr || !(amount > 0)) return;
  pr.xp += amount;
  (pr.xpLog ??= []).push({ source, amount, turn: state.turn });
  while (pr.xp >= xpToNext(p)) {
    pr.xp -= xpToNext(p);
    const up = levelUp(p);
    pr.xpLog.push({ source: 'level', amount: 0, turn: state.turn, levelUp: up });
    logCode(state, 'level_up', up);
  }
}

function levelUp(p: Actor): XpAward['levelUp'] & {} {
  const pr = p.progression!;
  const cur = p.core.classes.find((c) => c.state === 'current');
  const pick = p.core.classes.find((c) => c.classId === pr.nextClass && c.state !== 'previous') ?? cur;
  if (!pick) return { classId: '', level: charLevel(p) };
  if (pick !== cur) { // Part 4: putting a level into an unlocked class makes it current
    if (cur) cur.state = 'previous';
    pick.state = 'current';
    delete pr.nextClass;
  }
  pick.level += 1;
  if (charLevel(p) % 2 === 0) pr.unspentPerkPoints += 1; // Part 1 §5: a perk point on every even level
  return { classId: pick.classId, level: charLevel(p) };
}

/** X4/X5: an opposed or hostile NPC that is down or surrendered pays once, if the player hit it or it surrendered. */
export function payDefeats(state: GameState, events: GameEvent[]): void {
  for (const e of events) {
    const a = e.attack;
    if (a && a.attackerId === state.player.id && a.damage > 0) {
      const t = state.actors.find((x) => x.id === a.targetId);
      if (t?.mind) t.mind.hitByPlayer = true;
    }
  }
  for (const t of state.actors) {
    const m = t.mind;
    if (!m || m.xpPaid || !wary(state, t, state.player)) continue;
    if (isActive(t) ? m.moraleState !== 'surrendered' : !m.hitByPlayer) continue; // fled or untouched: nothing
    m.xpPaid = true;
    awardXp(state, killXp(state, t), `defeat:${t.id}`);
    firstDefeat(state, t);
  }
}

/** Interim kill XP (X14) until X11 picks the measure: a template's own xp, else Total ÷ KILL_XP_DIV, tapered (X3). */
export function killXp(state: GameState, t: Actor): number {
  let tpl: { xp?: number } | undefined;
  try { tpl = t.core.templateId ? npcTemplate(state, t.core.templateId) : undefined; } catch { /* none */ }
  if (tpl?.xp !== undefined) return tpl.xp;
  const mine = skillTotal(state.player), theirs = skillTotal(t);
  const taper = mine > 0 ? Math.min(1, (CONFIG.KILL_XP_TAPER * theirs) / mine) : 1;
  return Math.round(((theirs / CONFIG.KILL_XP_DIV) * taper) * 10) / 10;
}

function firstDefeat(state: GameState, t: Actor): void {
  const def = getLibrary().achievements?.first_defeat;
  if (!def) return;
  const id = `first_defeat:${t.core.creatureTypeId}`;
  let creature = t.core.creatureTypeId;
  try { creature = (creatureType(state, creature) as { name?: string }).name ?? creature; } catch { /* keep the id */ }
  grantAchievement(state, id, def.name.replace('{creature}', creature.replace(/_/g, ' ')), def.xp);
}

/** Each achievement is granted once (B4). */
export function grantAchievement(state: GameState, id: string, name: string, xp: number): void {
  const pr = state.player.progression;
  if (!pr || pr.achievements?.some((x) => x.id === id)) return;
  (pr.achievements ??= []).push({ id, name, turn: state.turn });
  logCode(state, 'achievement', { id, xp });
  awardXp(state, xp, `achievement:${id}`);
}
