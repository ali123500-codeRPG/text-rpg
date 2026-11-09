// XP and levels (XP proposal X1–X10). Code only: no agent sees or sends XP.
import type { Actor, AchievementBy, AchievementRule, GameEvent, GameState, XpAward } from '../types';
import { CONFIG } from '../config';
import { bodyType, getLibrary } from '../library';
import { classPerks } from '../library/spawn';
import { trueSkill } from '../ruleset/perks';
import { isActive, stance, wary } from './relations';
import { logCode } from './effects';
import { tierMult } from '../ruleset/gear';
import { skillOpen } from '../ruleset/access';
import { partStates, working } from '../ruleset/body';
import { groupName, groupsOf } from '../library/functionNames';
import { TIERS } from '../scales';

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
    const up = levelUp(p, state.turn);
    pr.xpLog.push({ source: 'level', amount: 0, turn: state.turn, levelUp: up });
    logCode(state, 'level_up', up);
  }
}

function levelUp(p: Actor, turn: number): XpAward['levelUp'] & {} {
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
  p.core.perks.push(...classPerks(pick.classId, pick.level - 1, pick.level, turn)); // class-level perks
  if (charLevel(p) % 2 === 0) pr.unspentPerkPoints += 1; // Part 1 §5: a perk point on every even level
  return { classId: pick.classId, level: charLevel(p) };
}

/** Classes the player doesn't have unlock once every skill in ClassDef.unlock reaches its true skill (for example
 * Swordsman at Medium Weapons 40 and Block 40). An unlocked class sits at level 0 until a level goes into it (X9). */
export function unlockClasses(state: GameState): void {
  const p = state.player;
  for (const c of Object.values(getLibrary().classes)) {
    if (!c.unlock || p.core.classes.some((x) => x.classId === c.id)) continue;
    if (!Object.entries(c.unlock).every(([sk, need]) => trueSkill(p, sk) >= need)) continue;
    p.core.classes.push({ classId: c.id, state: 'unlocked', level: 0 });
    tally(state, 'class_unlock', { by: 'class', of: c.id });
    logCode(state, 'class_unlocked', { classId: c.id });
  }
}

/** X4/X5: an opposed or hostile NPC that is down or surrendered pays once, if the player hit it or it surrendered. */
export function payDefeats(state: GameState, events: GameEvent[]): void {
  for (const e of events) {
    const a = e.attack;
    if (a && a.attackerId === state.player.id && a.damage > 0) {
      const t = state.actors.find((x) => x.id === a.targetId);
      if (t?.mind) {
        t.mind.hitByPlayer = true;
        if (a.unaware) t.mind.hitUnaware = true;
        else delete t.mind.hitUnaware;
      }
    }
  }
  for (const t of state.actors) {
    const m = t.mind;
    // a surrendered foe has yielded (Q1): it still pays
    if (!m || m.xpPaid || !(wary(state, t, state.player) || stance(state, t, state.player) === 'yielded')) continue;
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
    (by[cat] ??= []).push(effort(skillOpen(a, id) ? e.raw * tierMult(id) : 0)); // the tier counts in the rating
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
  tally(state, 'defeats', { by: 'body_type', of: t.core.bodyTypeId });
  if (t.core.raceId) tally(state, 'defeats', { by: 'race', of: t.core.raceId });
  tally(state, 'defeats');
  if (t.mind?.hitUnaware) tally(state, 'unaware_defeats');
  if (partStates(state, state.player).some((p) => !working(p.state))) tally(state, 'crippled_defeats');
}

/** every roll the player makes: Critical Success or better counts for each group of the rolled skill, and each step
 * past Critical Success counts once in general and per group */
export function rollFeats(state: GameState, r: { skill: string; tier: string; beyond?: number }): void {
  const beyond = TIERS.pos(r.tier as 'success') + (r.beyond ?? 0) - TIERS.pos('critical_success');
  if (beyond < 0) return;
  const groups = groupsOf(getLibrary().skills[r.skill]);
  for (const g of groups) tally(state, 'crits', { by: 'group', of: g });
  if (beyond === 0) return;
  tally(state, 'beyond_crit', { to: beyond });
  for (const g of groups) tally(state, 'beyond_crit', { by: 'group', of: g, to: beyond });
}

/** Adds 1 to the player's tally for an achievement rule (with `to`: raises it to `to`), then grants every achievement
 * of that rule the tally reaches. With `by`, the tally and the achievement are per body type, race, group or class `of`. */
export function tally(state: GameState, rule: AchievementRule, o: { by?: AchievementBy; of?: string; to?: number } = {}): void {
  const pr = state.player.progression;
  if (!pr || (o.by && !o.of)) return;
  const t = (pr.tally ??= {});
  const k = o.by ? `${rule}:${o.by}:${o.of}` : rule;
  t[k] = o.to === undefined ? (t[k] ?? 0) + 1 : Math.max(t[k] ?? 0, o.to);
  for (const [key, d] of Object.entries(getLibrary().achievements ?? {}))
    if (d.rule === rule && d.by === o.by && d.count !== undefined && t[k] >= d.count) grantAchievement(state, key, o.of);
}

/** Each achievement is granted once (B4). key is its row in the library table; of the body type, race or tree it names.
 * Saves keep only key and of, so renaming a row or moving its reward level edits only the table. */
export function grantAchievement(state: GameState, key: string, of?: string): void {
  const pr = state.player.progression;
  const d = getLibrary().achievements?.[key];
  if (!pr || !d) return;
  const id = of ? `${d.id}:${of}` : d.id;
  if (pr.achievements?.some((x) => x.id === id)) return;
  // a higher level switches off every lower level of its chain, so only the highest one is checked
  const lib = getLibrary().achievements ?? {};
  for (let k = d.after, i = 0; k && i < 20; k = lib[k]?.after, i++)
    for (const x of pr.achievements ?? []) if (x.key === k && x.of === of && !x.replacedBy) x.replacedBy = id;
  (pr.achievements ??= []).push({ id, key, ...(of ? { of } : {}), turn: state.turn });
  const xp = CONFIG.REWARD_XP[d.level] ?? 0;
  logCode(state, 'achievement', { id, xp });
  awardXp(state, xp, `achievement:${id}`);
}

/** Display name of an earned achievement, read from the library table now. */
export function achievementName(state: GameState, a: { id: string; key?: string; of?: string; name?: string }): string {
  const lib = getLibrary();
  const d = a.key ? lib.achievements?.[a.key] : undefined;
  if (!d) return a.name ?? a.id;
  let what = a.of ?? '';
  if (d.by === 'body_type' && a.of) try { what = (bodyType(state, a.of) as { name?: string }).name ?? a.of; } catch { /* keep the id */ }
  if (d.by === 'race' && a.of) what = lib.races?.[a.of]?.name ?? a.of;
  if (d.rule === 'mastery' && a.of) what = lib.trees?.[a.of]?.name ?? a.of;
  if (d.by === 'group' && a.of) what = groupName(a.of);
  if (d.by === 'class' && a.of) what = lib.classes?.[a.of]?.name ?? a.of;
  return d.name.replace(/\{(body_type|race|tree|group|class)\}/g, title(what));
}
