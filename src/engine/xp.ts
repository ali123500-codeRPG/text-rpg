// XP and levels (Ali, 07/11/2026, XP proposal X1–X10). Code only: no agent sees or sends XP.
import type { Actor, GameEvent, GameState, XpAward } from '../types';
import { CONFIG } from '../config';
import { creatureType, getLibrary } from '../library';
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
    defeatAchievements(state, t);
  }
}

/** Training effort to raise a skill from 0 to s (Part 1 §6: a point at s costs about 100 ÷ (3 × (100 − s)) trainings;
 * the roll ≥ 99 rule keeps the chance at 2% or more). */
export const effort = (s: number) => (100 / 3) * Math.log(100 / Math.max(100 - Math.max(0, s), 2));

/** X18–X23: a foe's stat rating. Per category the skills' efforts, highest first, count at 1, ½, ¼…, × the category weight. */
export function rating(a: Actor): number {
  const lib = getLibrary();
  const by: Record<string, number[]> = {};
  for (const [id, e] of Object.entries(a.core.skills)) {
    const cat = lib.skills[id]?.xpCategory ?? 'misc';
    (by[cat] ??= []).push(effort(e.raw));
  }
  return Object.entries(by).reduce((n, [cat, es]) =>
    n + (CONFIG.XP_CATEGORY_WEIGHT[cat] ?? 0) * es.sort((p, q) => q - p).reduce((m, v, i) => m + v / 2 ** i, 0), 0);
}

/** Kill XP = rating × taper (weak foes, X19) × KILL_XP_MULT (X20). Stats only: no dice, no override (X13). */
export function killXp(state: GameState, t: Actor): number {
  const theirs = rating(t), mine = rating(state.player);
  const taper = mine > 0 ? Math.min(1, (CONFIG.KILL_XP_TAPER * theirs) / mine) : 1;
  return Math.round(theirs * taper * CONFIG.KILL_XP_MULT * 10) / 10;
}

const title = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function defeatAchievements(state: GameState, t: Actor): void {
  const pr = state.player.progression;
  if (!pr) return;
  const type = t.core.creatureTypeId, race = t.core.raceId;
  let creature = type;
  try { creature = (creatureType(state, type) as { name?: string }).name ?? type; } catch { /* keep the id */ }
  const n = (pr.defeats ??= {});
  const keys = ['all', `creature:${type}`, ...(race ? [`race:${race}`] : [])];
  for (const k of keys) n[k] = (n[k] ?? 0) + 1;
  for (const d of Object.values(getLibrary().achievements ?? {})) {
    if (d.rule !== 'defeats' || d.count === undefined) continue;
    if (d.by === 'race' && !race) continue;
    const of = d.by === 'race' ? race! : type;
    if ((n[d.by ? `${d.by}:${of}` : 'all'] ?? 0) < d.count) continue;
    const name = d.name.replace('{creature}', title(creature)).replace('{race}', title(race ?? ''));
    grantAchievement(state, d.by ? `${d.id}:${of}` : d.id, name, d.xp);
  }
}

/** Each achievement is granted once (B4). */
export function grantAchievement(state: GameState, id: string, name: string, xp: number): void {
  const pr = state.player.progression;
  if (!pr || pr.achievements?.some((x) => x.id === id)) return;
  (pr.achievements ??= []).push({ id, name, turn: state.turn });
  logCode(state, 'achievement', { id, xp });
  awardXp(state, xp, `achievement:${id}`);
}
