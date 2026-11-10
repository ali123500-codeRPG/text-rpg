// XP and levels (XP proposal X1–X10). Code only: no agent sees or sends XP.
import type { Actor, AchievementBy, AchievementRule, GameEvent, GameState, XpAward } from '../types';
import { CONFIG } from '../config';
import { bodyType, getLibrary, itemDef, npcTemplate } from '../library';
import { classMaxLevel, classPerks } from '../library/spawn';
import { hasPerk, trueSkill } from '../ruleset/perks';
import { isActive, stance } from './relations';
import { logCode } from './effects';
import { isHeld, isWorn, tierMult } from '../ruleset/gear';
import { itemValue } from '../ruleset/value';
import { ruleMet, skillOpen } from '../ruleset/access';
import { partStates, working } from '../ruleset/body';
import { functionName, groupName, groupsOf } from '../library/functionNames';
import { CLASS_TIERS, REWARD_LEVELS, TIERS } from '../scales';
import { PK } from '../library/perkIds';
import { skillName } from '../library/skillNames';
import { achLevel, achXp, bonusLevelsOwed, freeLevelsOwed } from '../ruleset/achRewards';
export { achLevel, achXp, bonusLevelsOwed, freeLevelsOwed };

/** character level: every class's level, plus bonus levels (levels no class gets) */
export const charLevel = (a: Actor) => a.core.classes.reduce((n, c) => n + c.level, 0) + (a.progression?.bonusLevelsTaken ?? 0);
/** XP for the next level: free levels don't count, so they never make the next level dearer (D-153) */
export const xpToNext = (a: Actor) => levelCost(charLevel(a) - (a.progression?.freeLevelsTaken ?? 0) - (a.progression?.bonusLevelsTaken ?? 0));
/** the XP curve: what the step from level n to n + 1 costs. xpToNext and xpToReach both ask it, so changing it changes both. */
export const levelCost = (n: number) => CONFIG.LEVEL_XP * Math.max(1, n);
/** the XP the curve asks to reach level L from 0: the sum of every step on the way */
export const xpToReach = (l: number) => { let n = 0; for (let i = 0; i < l; i++) n += levelCost(i); return n; };
/** Part 1 §6 Total: raw skills, Tagged excluded. */
export const skillTotal = (a: Actor) => Object.values(a.core.skills).reduce((n, s) => n + (s.state === 'tagged' ? 0 : s.raw), 0);

/** Award XP to the player with a trail entry, then level up as often as the XP allows (X9: into the chosen class). */
export function awardXp(state: GameState, amount: number, source: string): void {
  const p = state.player, pr = p.progression;
  if (!pr || !(amount > 0)) return;
  pr.xp += amount;
  (pr.xpLog ??= []).push({ source, amount, turn: state.turn });
  spendXp(state);
}

const capped = (c: { classId: string; level: number }) => c.level >= classMaxLevel(c.classId);

/** the class the next level goes to: the picked one, else the current one; none when that class is at its top level */
export function levelTarget(p: Actor) {
  const cur = p.core.classes.find((c) => c.state === 'current');
  const pick = p.core.classes.find((c) => c.classId === p.progression?.nextClass && c.state !== 'previous') ?? cur;
  return pick && !capped(pick) ? pick : undefined;
}

/** Level up as often as free levels and XP allow: free levels first (they cost no XP), then XP. With no class to level
 * (the target is at its top level, classMaxLevel) both stay banked; picking a class with room (the sheet's picker) calls
 * this again and every banked level is taken. */
export function spendXp(state: GameState): void {
  const p = state.player, pr = p.progression;
  if (!pr) return;
  takeBonusLevels(state);
  for (let free = freeLevelsOwed(p) > 0; (free || pr.xp >= xpToNext(p)) && levelTarget(p); free = freeLevelsOwed(p) > 0) {
    if (free) pr.freeLevelsTaken = (pr.freeLevelsTaken ?? 0) + 1;
    else pr.xp -= xpToNext(p);
    const up = levelUp(p, state.turn);
    (pr.xpLog ??= []).push({ source: free ? 'free level' : 'level', amount: 0, turn: state.turn, levelUp: up });
    logCode(state, 'level_up', up);
  }
  takeBonusLevels(state); // a class perk can give bonus levels too
  classFeats(state);
  unlockClasses(state); // a class-level perk can unlock a class (Commoner 5 opens A Nobody)
  const cur = p.core.classes.find((c) => c.state === 'current');
  if (cur && capped(cur)) for (const c of Object.values(getLibrary().classes)) { // the default class opens at the top level
    if (!c.fallback || p.core.classes.some((x) => x.classId === c.id)) continue;
    openClass(state, c.id);
  }
}

/** bonus levels: character levels no class gets, taken at once (they never wait for a class). Each gives the perk point
 * of an even character level like any level, but no class perks, and none of them raise XP costs. */
function takeBonusLevels(state: GameState): void {
  const p = state.player, pr = p.progression!;
  while (bonusLevelsOwed(p) > 0) {
    pr.bonusLevelsTaken = (pr.bonusLevelsTaken ?? 0) + 1;
    if (charLevel(p) % 2 === 0) pr.unspentPerkPoints += 1; // Part 1 §5: a perk point on every even level
    const up = { classId: '', level: charLevel(p) };
    (pr.xpLog ??= []).push({ source: 'bonus level', amount: 0, turn: state.turn, levelUp: up });
    logCode(state, 'level_up', up);
  }
}

/** a class the player doesn't have unlocks at level 0, however it opens, and earns {class} Awakened */
function openClass(state: GameState, classId: string): void {
  state.player.core.classes.push({ classId, state: 'unlocked', level: 0 });
  tally(state, 'class_unlock', { by: 'class', of: classId });
  logCode(state, 'class_unlocked', { classId });
}

/** class and level achievements: classes at their top level (in all, per class tier, tiers covered) and every 10 levels */
function classFeats(state: GameState): void {
  const p = state.player;
  const top = p.core.classes.filter((c) => c.level > 0 && capped(c));
  const tierOf = (id: string) => getLibrary().classes[id]?.tier;
  const byTier = new Map<string, number>();
  for (const c of top) { const t = tierOf(c.classId); if (t) byTier.set(t, (byTier.get(t) ?? 0) + 1); }
  if (top.length) tally(state, 'class_max', { to: top.length });
  for (const [t, n] of byTier) tally(state, 'class_max', { by: 'class_tier', of: t, to: n });
  if (byTier.size) tally(state, 'class_max_tiers', { to: byTier.size });
  tally(state, 'char_level', { to: charLevel(p) });
}

function levelUp(p: Actor, turn: number): XpAward['levelUp'] & {} {
  const pr = p.progression!;
  const cur = p.core.classes.find((c) => c.state === 'current');
  const pick = levelTarget(p);
  if (!pick) return { classId: '', level: charLevel(p) };
  if (pick !== cur) { // Part 4: putting a level into an unlocked class makes it current
    if (cur) cur.state = 'previous';
    pick.state = 'current';
    delete pr.nextClass;
  }
  pick.level += 1;
  if (pick.level === classMaxLevel(pick.classId)) offerCapstones(p, pick.classId);
  p.core.perks.push(...classPerks(pick.classId, pick.level - 1, pick.level, turn).filter((x) => !p.core.perks.some((o) => o.perkId === x.perkId))); // class-level perks, once each
  if (pr.capstoneOptions?.[pick.classId]) for (const x of capstonePerks(p, pick.classId)) x.dormant = true; // inactive until the player picks
  if (charLevel(p) % 2 === 0) pr.unspentPerkPoints += 1; // Part 1 §5: a perk point on every even level
  return { classId: pick.classId, level: charLevel(p) };
}

/** Alternate capstones: when a class reaches its top level, every alternate whose conditions hold right then is
 * offered in place of the default capstone (ClassDef.capstone). While an offer stands the default
 * is held dormant (it does nothing); the player either keeps it (keepCapstone) or swaps in an alternate (swapCapstone).
 * Either choice is final. With nothing on offer the default is active at once. */
function offerCapstones(p: Actor, classId: string): void {
  const ok = (getLibrary().classes[classId]?.capstones ?? []).filter((c) => ruleMet(p, c.needs)).map((c) => c.perk);
  if (ok.length) (p.progression!.capstoneOptions ??= {})[classId] = ok;
}

/** the owned default capstone perks of a class (ClassDef.capstone) */
function capstonePerks(p: Actor, classId: string) {
  const base = getLibrary().classes[classId]?.capstone ?? [];
  return p.core.perks.filter((x) => x.source === 'class' && base.includes(x.perkId));
}

/** keep a class's default capstone: it becomes active and the offer closes. False when nothing is on offer. */
export function keepCapstone(p: Actor, classId: string): boolean {
  const pr = p.progression;
  if (!pr?.capstoneOptions?.[classId]) return false;
  for (const x of capstonePerks(p, classId)) delete x.dormant;
  delete pr.capstoneOptions[classId];
  return true;
}

/** swap a class's default capstone for an offered alternate; once per class. False when it isn't on offer. */
export function swapCapstone(state: GameState, classId: string, perkId: string): boolean {
  const p = state.player, turn = state.turn, pr = p.progression, opts = pr?.capstoneOptions?.[classId];
  if (!pr || !opts?.includes(perkId)) return false;
  const base = getLibrary().classes[classId]?.capstone ?? [];
  p.core.perks = p.core.perks.filter((x) => !(x.source === 'class' && base.includes(x.perkId)));
  p.core.perks.push({ perkId, source: 'class', gainedTurn: turn });
  delete pr.capstoneOptions![classId];
  openEveryClass(state);
  return true;
}

/** Write Your Own Ending: every class in the library the owner doesn't have unlocks at level 0, its conditions
 * ignored. Returns the ids it unlocked. */
function openEveryClass(state: GameState): void {
  const p = state.player;
  if (!hasPerk(p, PK.write_your_own_ending)) return;
  for (const id of Object.keys(getLibrary().classes)) if (!p.core.classes.some((x) => x.classId === id)) openClass(state, id);
}

/** Classes the player doesn't have unlock once every skill in ClassDef.unlock reaches its true skill and, when
 * ClassDef.unlockAny is listed, at least one of those does, and when ClassDef.unlockPerk is listed, the player has that perk (for example Swordsman at Medium Weapons 40 and Block 40;
 * Sword-dancer at Dodge 40 and Light or Medium Weapons 40). An unlocked class sits at level 0 until a level goes into it (X9). */
export function unlockClasses(state: GameState): void {
  const p = state.player;
  openEveryClass(state);
  for (const c of Object.values(getLibrary().classes)) {
    if (!(c.unlock || c.unlockAny || c.unlockPerk || c.unlockClass) || p.core.classes.some((x) => x.classId === c.id)) continue;
    if (c.unlockPerk && !p.core.perks.some((x) => x.perkId === c.unlockPerk && !x.dormant)) continue;
    const met = ([sk, need]: [string, number]) => trueSkill(p, sk) >= need;
    if (!Object.entries(c.unlock ?? {}).every(met)) continue;
    if (c.unlockAny && !Object.entries(c.unlockAny).some(met)) continue;
    if (!Object.entries(c.unlockClass ?? {}).every(([id, lv]) => (p.core.classes.find((x) => x.classId === id)?.level ?? 0) >= (lv === 'max' ? classMaxLevel(id) : lv))) continue;
    openClass(state, c.id);
  }
}

/** X4/X5, RS7: an NPC pays once, whatever its stance, when it is down and the player hit it, or when it surrendered to the player.
 * Returns the actors the player defeated this turn. */
export function payDefeats(state: GameState, events: GameEvent[]): Actor[] {
  const defeated: Actor[] = [];
  for (const e of events) {
    const a = e.attack;
    if (a && !e.spar && a.attackerId === state.player.id && a.damage > 0) { // SP8: a sparring blow defeats no one
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
    if (!m || m.xpPaid) continue;
    // a foe that surrendered to the player has yielded to it (Q1); fled or untouched: nothing
    if (isActive(t) ? m.moraleState !== 'surrendered' || stance(state, t, state.player) !== 'yielded' : !m.hitByPlayer) continue;
    m.xpPaid = true;
    awardXp(state, killXp(state, t), `defeat:${t.id}`);
    defeatAchievements(state, t);
    defeated.push(t);
  }
  return defeated;
}

/** Training effort to raise a skill from 0 to s (Part 1 §6: a point at s costs about 100 ÷ (3 × (100 − s)) trainings;
 * the roll ≥ 99 rule keeps the chance at 2% or more). */
export const effort = (s: number) => (100 / 3) * Math.log(100 / Math.max(100 - Math.max(0, s), 2));

/** X18–X23: a foe's stat rating. Per skill group (a skill's first group) the skills' efforts, highest first, count at 1, ½, ¼…, × XP_GROUP_WEIGHT. */
export function rating(a: Actor): number {
  const lib = getLibrary();
  const by: Record<string, number[]> = {};
  for (const [id, e] of Object.entries(a.core.skills)) {
    const cat = groupsOf(lib.skills[id])[0] ?? ''; // the skill's first group; no group counts 0
    (by[cat] ??= []).push(effort(skillOpen(a, id) ? e.raw * tierMult(id) : 0)); // the tier counts in the rating
  }
  return levelRating(a) + Object.entries(by).reduce((n, [cat, es]) =>
    n + (CONFIG.XP_GROUP_WEIGHT[cat] ?? 0) * es.sort((p, q) => q - p).reduce((m, v, i) => m + v / 2 ** i, 0), 0);
}

/** an actor's level: its full character level (free and bonus levels count), else an NPC's template level */
export const actorLevel = (a: Actor): number => charLevel(a) || (a.core.templateId ? npcTemplate(null, a.core.templateId)?.level ?? 0 : 0);
/** levels in the rating (the thread the foe wove): LEVEL_RATING_SHARE × what the XP curve asks to reach that level */
export const levelRating = (a: Actor): number => CONFIG.LEVEL_RATING_SHARE * xpToReach(actorLevel(a));

/** a foe's gear in its rating: GEAR_RATING_FACTOR × the coin value of what it holds and wears (gear coin is priced at
 * about one coin per skill point of power). Carried spares and coin don't count. */
export function gearRating(state: GameState, a: Actor): number {
  return CONFIG.GEAR_RATING_FACTOR * a.core.inventory.filter((i) => isHeld(i) || isWorn(i)).reduce((n, i) => n + itemValue(state, itemDef(state, i.itemId)), 0);
}

/** Kill XP = (rating + gear rating) × taper (weak foes, X19) × KILL_XP_MULT (X20). Stats only: no dice, no override (X13).
 * Gear counts on the foe's side only: the player's own gear never shrinks the taper. */
export function killXp(state: GameState, t: Actor): number {
  const theirs = rating(t) + gearRating(state, t), mine = rating(state.player);
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

/** Adds 1 (or `add`) to the player's tally for an achievement rule (with `to`: raises it to `to`), then grants every
 * achievement of that rule the tally reaches. With `by`, the tally and the achievement are per body type, race, group,
 * class, function, skill, part size or quest giver `of`. */
export function tally(state: GameState, rule: AchievementRule, o: { by?: AchievementBy; of?: string; to?: number; add?: number } = {}): void {
  const pr = state.player.progression;
  if (!pr || (o.by && !o.of)) return;
  const t = (pr.tally ??= {});
  const k = o.by ? `${rule}:${o.by}:${o.of}` : rule;
  t[k] = o.to === undefined ? (t[k] ?? 0) + (o.add ?? 1) : Math.max(t[k] ?? 0, o.to);
  for (const [key, d] of Object.entries(getLibrary().achievements ?? {})) {
    if (d.rule !== rule || d.by !== o.by || d.count === undefined || t[k] < d.count) continue;
    if (d.every) for (let n = d.count; n <= t[k]; n += d.every) grantAchievement(state, key, String(n)); // earned at every multiple
    else grantAchievement(state, key, o.of);
  }
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
  if (d.perk && !state.player.core.perks.some((x) => x.perkId === d.perk)) state.player.core.perks.push({ perkId: d.perk, source: 'achievement', gainedTurn: state.turn });
  const xp = achXp(d, of);
  logCode(state, 'achievement', { id, xp });
  awardXp(state, xp, `achievement:${id}`);
  if (d.freeLevels || d.bonusLevels) spendXp(state); // free and bonus levels need no XP to arrive
  // achievements for the total earned: every other achievement counts, replaced levels too; scars and these totals do not
  if (!d.scar && d.rule !== 'achievements')
    tally(state, 'achievements', { to: pr.achievements!.filter((x) => { const k = lib[x.key ?? '']; return k && !k.scar && k.rule !== 'achievements'; }).length });
}

/** Display name of an earned achievement, read from the library table now. */
/** T18: the title the player wears, by its name: the worn achievement, or the level that replaced it (a title moves up
 * its chain); never a scar */
export function wornTitle(state: GameState): string | undefined {
  const pr = state.player.progression, lib = getLibrary().achievements ?? {};
  const find = (id?: string) => (id ? pr?.achievements?.find((x) => x.id === id) : undefined);
  let a = find(pr?.title);
  for (let n = 0; a?.replacedBy && n < 20; n++) a = find(a.replacedBy);
  return a && !lib[a.key ?? '']?.scar ? achievementName(state, a) : undefined;
}
/** the achievements the player can wear as a title: current ones that are not scars */
export const wearable = (state: GameState) => {
  const lib = getLibrary().achievements ?? {};
  return (state.player.progression?.achievements ?? []).filter((x) => !x.replacedBy && x.key && lib[x.key] && !lib[x.key].scar);
};

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
  if (d.by === 'class_tier' && a.of && CLASS_TIERS.has(a.of)) what = CLASS_TIERS.name(a.of);
  if (d.by === 'function' && a.of) what = functionName(a.of);
  if (d.by === 'skill' && a.of) what = skillName(a.of);
  if (d.by === 'giver' && a.of) { // the giver's name once the player knows it, else how the player sees them
    const g = state.actors.find((x) => x.id === a.of);
    what = !g ? 'someone' : g.knownOnSight || state.player.journal?.namesKnown.includes(g.id) ? g.names.current : g.label;
  }
  return d.name.replace(/\{(body_type|race|tree|group|class|tier|level|function|skill|size|giver)\}/g, title(what));
}
