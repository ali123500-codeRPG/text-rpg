// XP and levels (XP proposal X1–X10). Code only: no agent sees or sends XP.
import type { Actor, AchievementBy, AchievementDef, AchievementRule, GameEvent, GameState, XpAward, DefeatWhy } from '../types';
import { CONFIG } from '../config';
import { bodyType, getLibrary, hasTemplate, itemDef, npcTemplate } from '../library';
import { templateLevel } from '../library/spawn';
import { classMaxLevel, classPerks } from '../library/spawn';
import { hasPerk, trueSkill } from '../ruleset/perks';
import { blessedBy } from '../ruleset/blessings';
import { isActive, stance } from './relations';
import { logCode } from './effects';
import { callName } from '../views';
import { isHeld, isWorn, tierMult } from '../ruleset/gear';
import { itemValue } from '../ruleset/value';
import { ruleMet } from '../ruleset/access';
import { partStates, working } from '../ruleset/body';
import { functionName, groupName, groupsOf } from '../library/functionNames';
import { CLASS_TIERS, HEALTH_LEVELS, TIERS } from '../scales';
import { tierName } from '../ruleset';
import { PK } from '../library/perkIds';
import { skillName } from '../library/skillNames';
import { achLevel, achXp, bonusLevelsOwed, freeLevelsOwed, rewardLines, rewardName } from '../ruleset/achRewards';
import { ACH_RULE_ONE, ACH_RULE_TEXT } from '../library/achievementIds';
import { r1 } from '../words';
import { levelCost, perkPointAt, xpToReach } from '../ruleset/levels';
export { achLevel, achXp, bonusLevelsOwed, freeLevelsOwed };

/** character level: every class's level, plus bonus levels (levels no class gets) */
export const charLevel = (a: Actor) => a.core.classes.reduce((n, c) => n + c.level, 0) + (a.progression?.bonusLevelsTaken ?? 0);
/** XP for the next level: free levels don't count, so they never make the next level dearer (D-153) */
export const xpToNext = (a: Actor) => levelCost(charLevel(a) - (a.progression?.freeLevelsTaken ?? 0) - (a.progression?.bonusLevelsTaken ?? 0));
/** the XP bar as every screen shows it: level, XP, XP for the next level, and the bar's fill (XP debt, EG15, shows empty) */
export function xpFill(a: Actor): { level: number; xp: number; need: number; pct: number } {
  const need = xpToNext(a), xp = a.progression?.xp ?? 0;
  return { level: charLevel(a), xp, need, pct: need > 0 ? Math.max(0, Math.min(100, (xp / need) * 100)) : 100 };
}
export { levelCost, perkPointAt, perkPointsUpTo, xpToReach } from '../ruleset/levels';
/** Part 1 §6 Total: raw skills, Tagged excluded. */
export const skillTotal = (a: Actor) => Object.values(a.core.skills).reduce((n, s) => n + (s.state === 'tagged' ? 0 : s.raw), 0);

/** Award XP to the player with a trail entry, then level up as often as the XP allows (X9: into the chosen class). */
export function awardXp(state: GameState, amount: number, source: string, why?: DefeatWhy): void {
  const p = state.player, pr = p.progression;
  if (!pr || !(amount > 0)) return;
  pr.xp += amount;
  (pr.xpLog ??= []).push({ source, amount, turn: state.turn, ...(why ? { why } : {}) });
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
  if (!pr || growthWaits(state)) return; // EG8: levels wait for the scenario's ending moment (flushGrowth spends then)
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
    if (perkPointAt(charLevel(p))) pr.unspentPerkPoints += 1;
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
  if (perkPointAt(charLevel(p))) pr.unspentPerkPoints += 1;
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
 * ClassDef.unlockAny is listed, at least one of those does, and when ClassDef.unlockPerk is listed, the player has that perk (for example Swordsman at Parry 40 and Medium or Heavy Weapons 40;
 * Sword-dancer at Dodge 40 and Light or Medium Weapons 40). An unlocked class sits at level 0 until a level goes into it (X9). */
export function unlockClasses(state: GameState): void {
  const p = state.player;
  openEveryClass(state);
  for (const c of Object.values(getLibrary().classes)) {
    if (!(c.unlock || c.unlockAny || c.unlockPerk || c.unlockPerkWith || c.unlockClass || c.blessedBy) || p.core.classes.some((x) => x.classId === c.id)) continue;
    if (c.blessedBy && !blessedBy(p, c.blessedBy)) continue; // DX1: a god's Blessed class opens on being blessed by that god
    if (c.unlockPerk && !p.core.perks.some((x) => x.perkId === c.unlockPerk && !x.dormant)) continue;
    const met = ([sk, need]: [string, number]) => trueSkill(p, sk) >= need;
    if (!Object.entries(c.unlock ?? {}).every(met)) continue;
    if (!(c.unlockAny ?? []).every((group) => Object.entries(group).some(met))) continue;
    if (c.unlockPerkWith && !Object.entries(c.unlockPerkWith).every(([k, n]) => p.core.perks.some((x) => !x.dormant && (getLibrary().perks[x.perkId]?.[k as 'hearingDb'] ?? 0) >= n))) continue;
    if (!Object.entries(c.unlockClass ?? {}).every(([id, lv]) => (p.core.classes.find((x) => x.classId === id)?.level ?? 0) >= (lv === 'max' ? classMaxLevel(id) : lv))) continue;
    openClass(state, c.id);
  }
}

/** X4/X5, RS7: an NPC pays once, whatever its stance, when it is down and the player hit it, or when it surrendered or
 * broke (fled) while it was fighting the player: both turn its stance toward the player to yielded (Q1, Q4).
 * Defeated means Down, yielding, a morale break or fleeing, for foes as for the player.
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
    // a foe that surrendered or broke while fighting the player has yielded to it (Q1, Q4); untouched: nothing
    if (isActive(t) ? (!m.moraleState || stance(state, t, state.player) !== 'yielded') : !m.hitByPlayer) continue;
    m.xpPaid = true;
    const why: DefeatWhy = isActive(t) ? (m.moraleState === 'surrendered' ? 'surrendered' : 'broken') : 'down';
    awardXp(state, defeatXp(state, t), `defeat:${t.id}`, why);
    if (why !== 'down') logCode(state, 'yielded_to_player', { actorId: t.id, why }); // BG-199: the turn says they gave up to you
    defeatAchievements(state, t);
    bested(state, t);
    defeated.push(t);
  }
  return defeated;
}

/** TF20 b, BS1-BS3: `t` is bested by the player: defeated (payDefeats), or talked or bribed out of a fight with the player
 * (offer.ts standDown). Once per person, ever. The running scenario lists it for its ending's essence offers (EB1), and
 * the Bested chain counts it. Being bested is not a defeat: it pays no XP of its own. */
export function bested(state: GameState, t: Actor): void {
  if (!t.mind || t.mind.bested || t === state.player) return;
  t.mind.bested = true;
  const f = state.stage.scenario;
  if (f) (f.bested ??= []).push(t.id);
  tally(state, 'bested');
}

/** LF15: a skill's worth in the rating, from what it does rather than what it cost to train: SKILL_RATING_AT_50 at 50,
 * growing as the SKILL_RATING_POWER power of the skill, with no cap. */
export const skillRating = (s: number) => CONFIG.SKILL_RATING_AT_50 * (Math.max(0, s) / 50) ** CONFIG.SKILL_RATING_POWER;

/** a skill group's XP factor: its level on the XP_FACTORS scale (CONFIG.XP_GROUP_FACTOR) × CONFIG.XP_FACTOR_MULT; no level counts 0 */
export const xpGroupFactor = (group: string): number => CONFIG.XP_FACTOR_MULT[CONFIG.XP_GROUP_FACTOR[group]] ?? 0;

/** one skill in the rating: its true skill × tier, its worth (skillRating), the share it counts at in its group (1, ½, ¼…)
 * and what it adds (worth × share × the group's factor) */
export type RatingSkill = { skill: string; value: number; worth: number; share: number; adds: number };
/** one skill group in the rating: its XP factor, its skills highest first, and what the group adds */
export type RatingGroup = { group: string; factor: number; skills: RatingSkill[]; adds: number };

/** X18–X23: the rating's skill part, group by group (a skill's first group; no group counts 0). In each group the skills'
 * worths, highest first, count at 1, ½, ¼…, × the group's XP factor. rating() and the character sheet both read this. */
export function ratingGroups(a: Actor): RatingGroup[] {
  const lib = getLibrary();
  const by: Record<string, { skill: string; value: number; worth: number }[]> = {};
  for (const id of Object.keys(a.core.skills)) {
    const value = trueSkill(a, id) * tierMult(id); // LF16: true skill × tier; a closed tree counts 0
    (by[groupsOf(lib.skills[id])[0] ?? ''] ??= []).push({ skill: id, value, worth: skillRating(value) });
  }
  return Object.entries(by).map(([group, es]) => {
    const factor = xpGroupFactor(group);
    const skills = es.sort((p, q) => q.worth - p.worth).map((e, i) => ({ ...e, share: 1 / 2 ** i, adds: factor * e.worth / 2 ** i }));
    return { group, factor, skills, adds: skills.reduce((n, k) => n + k.adds, 0) };
  });
}

/** X18–X23: an actor's stat rating, the same for the player and a foe: its level part plus its skill groups */
export function rating(a: Actor): number {
  return levelRating(a) + ratingGroups(a).reduce((n, g) => n + g.adds, 0);
}

/** an actor's level: its full character level (free and bonus levels count), else an NPC's template level */
export const actorLevel = (a: Actor): number => charLevel(a) || (a.core.templateId && hasTemplate(null, a.core.templateId) ? templateLevel(npcTemplate(null, a.core.templateId)) : 0);
/** levels in the rating (the thread the foe wove): LEVEL_RATING_SHARE × what the XP curve asks to reach that level */
export const levelRating = (a: Actor): number => CONFIG.LEVEL_RATING_SHARE * xpToReach(actorLevel(a));

/** a foe's gear in its rating: GEAR_RATING_FACTOR × the coin value of what it holds and wears (gear coin is priced at
 * about one coin per skill point of power). Carried spares and coin don't count. */
export function gearRating(state: GameState, a: Actor): number {
  return gearRatingItems(state, a).reduce((n, g) => n + g.adds, 0);
}
/** the gear rating item by item: each held or worn item's coin value and what it adds (GEAR_RATING_FACTOR × coin) */
export function gearRatingItems(state: GameState, a: Actor): { id: string; itemId: string; coin: number; adds: number }[] {
  return a.core.inventory.filter((i) => isHeld(i) || isWorn(i)).map((i) => {
    const coin = itemValue(state, itemDef(state, i.itemId));
    return { id: i.id, itemId: i.itemId, coin, adds: CONFIG.GEAR_RATING_FACTOR * coin };
  });
}

/** An actor's power: its rating plus its gear rating. The one measure of how strong someone is, used by defeat XP and by
 * the stronger-foe achievements, so a change here changes both. */
export const power = (state: GameState, a: Actor): number => rating(a) + gearRating(state, a);

/** power() in its parts, for the character sheet: level, each skill group, gear; the parts add up to power() */
export function powerParts(state: GameState, a: Actor) {
  return { level: actorLevel(a), levelAdds: levelRating(a), groups: ratingGroups(a), gear: gearRatingItems(state, a), total: power(state, a) };
}

/** XP shrinks for foes much weaker than the player: min(1, TAPER × theirs ÷ mine) (X19). Defeat XP and defeat quests (QX2) share it. */
export const weakFoeTaper = (theirs: number, mine: number) => (mine > 0 ? Math.min(1, (CONFIG.DEFEAT_XP_TAPER * theirs) / mine) : 1);

/** Defeat XP = foe power × taper (weak foes, X19) × DEFEAT_XP_MULT (X20). Stats only: no dice, no override (X13).
 * Power counts gear on both sides. */
export function defeatXp(state: GameState, t: Actor): number {
  const theirs = power(state, t), mine = power(state, state.player);
  const taper = weakFoeTaper(theirs, mine);
  return r1(theirs * taper * CONFIG.DEFEAT_XP_MULT);
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
    if (d.only && d.only !== o.of) continue; // a row for one kind only (healing from one source)
    if (d.every) for (let n = d.count; n <= t[k]; n += d.every) grantAchievement(state, key, String(n), n); // earned at every multiple
    else grantAchievement(state, key, o.of, t[k]);
  }
}

/** Each achievement is granted once (B4). key is its row in the library table; of the body type, race or tree it names;
 * `reached`: the tally that earned it (shown as why it was earned); `at`: the turn it was reached on, when it was held for a
 * scenario's end (BF60). Saves keep only key and of, so renaming a row or moving
 * its reward level edits only the table. */
export function grantAchievement(state: GameState, key: string, of?: string, reached?: number, now = false, at?: number): void {
  const pr = state.player.progression;
  const d = getLibrary().achievements?.[key];
  if (!pr || !d) return;
  const id = of ? `${d.id}:${of}` : d.id;
  if (pr.achievements?.some((x) => x.id === id)) return;
  if (!now && growthWaits(state)) { // D-226: while a scenario runs, it is granted at the scenario's end (flushGrowth)
    const q = (pr.pendingAchievements ??= []);
    // BF60: it keeps the turn it was reached on, which its line names when it is handed over
    if (!q.some((x) => x.key === key && x.of === of)) q.push({ key, ...(of ? { of } : {}), ...(reached !== undefined ? { reached } : {}), turn: state.turn });
    return;
  }
  // growth lands at a scenario's end (D-226): an achievement granted anywhere else is flagged, filed as a bug report
  if (!flushing) logCode(state, 'achievement_outside_end', { id, why: !CONFIG.GROWTH_AT_SCENARIO_END ? 'growth_off' : now ? 'forced' : 'no_scenario' });
  // a higher level switches off every lower level of its chain, so only the highest one is checked
  const lib = getLibrary().achievements ?? {};
  for (let k = d.after, i = 0; k && i < 20; k = lib[k]?.after, i++)
    for (const x of pr.achievements ?? []) if (x.key === k && x.of === of && !x.replacedBy) x.replacedBy = id;
  (pr.achievements ??= []).push({ id, key, ...(of ? { of } : {}), ...(reached !== undefined ? { reached } : {}), turn: at ?? state.turn });
  if (d.perk && !state.player.core.perks.some((x) => x.perkId === d.perk)) state.player.core.perks.push({ perkId: d.perk, source: 'achievement', gainedTurn: state.turn });
  const xp = achXp(d, of);
  logCode(state, 'achievement', { id, xp });
  awardXp(state, xp, `achievement:${id}`);
  if (d.freeLevels || d.bonusLevels) spendXp(state); // free and bonus levels need no XP to arrive
  // achievements for the total earned: every other achievement counts, replaced levels too; scars and these totals do not
  if (!d.scar && d.rule !== 'achievements')
    tally(state, 'achievements', { to: pr.achievements!.filter((x) => { const k = lib[x.key ?? '']; return k && !k.scar && k.rule !== 'achievements'; }).length });
}

/** D-226: the player's growth waits for the running scenario's end (CONFIG.GROWTH_AT_SCENARIO_END); in free roam, for the next
 * scenario's end (BG-217) */
export const growthWaits = (state: GameState): boolean => CONFIG.GROWTH_AT_SCENARIO_END && (!!state.stage.scenario || !!state.stage.roam) && !flushing;
let flushing = 0;
/** runs `fn` as the scenario's ending moment: growth granted inside it lands at once (flushGrowth) */
export function atScenarioEnd<T>(fn: () => T): T { flushing++; try { return fn(); } finally { flushing--; } }

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

/** Display name of an earned achievement, read from the library table now. */
export function achievementName(state: GameState, a: { id: string; key?: string; of?: string; name?: string }): string {
  const lib = getLibrary();
  const d = a.key ? lib.achievements?.[a.key] : undefined;
  if (!d) return a.name ?? a.id;
  if (a.of && d.names?.[a.of]) return d.names[a.of]; // a name of its own for this earning
  return d.name.replace(/\{(body_type|race|tree|group|class|tier|level|function|skill|size|giver|source|place_kind|health_level)\}/g, title(kindName(state, d, a.of)));
}

/** what a per-kind achievement was earned for, by name (a body type, race, tree, group, class, tier, skill, giver…) */
export function kindName(state: GameState, d: AchievementDef, of?: string): string {
  const lib = getLibrary(), a = { of };
  let what = a.of ?? '';
  if (d.by === 'body_type' && a.of) try { what = (bodyType(state, a.of) as { name?: string }).name ?? a.of; } catch { /* keep the id */ }
  if (d.by === 'race' && a.of) what = lib.races?.[a.of]?.name ?? a.of;
  if (d.rule === 'mastery' && a.of) what = lib.trees?.[a.of]?.name ?? a.of;
  if (d.by === 'group' && a.of) what = groupName(a.of);
  if (d.by === 'class' && a.of) what = lib.classes?.[a.of]?.name ?? a.of;
  if (d.by === 'class_tier' && a.of && CLASS_TIERS.has(a.of)) what = CLASS_TIERS.name(a.of);
  if (d.by === 'function' && a.of) what = functionName(a.of);
  if (d.by === 'health_level' && a.of && HEALTH_LEVELS.has(a.of)) what = HEALTH_LEVELS.name(a.of);
  if (d.by === 'skill' && a.of) what = skillName(a.of);
  if ((d.by === 'heal_source' || d.by === 'morale_source') && a.of) what = sourceRowName(d, a.of);
  if (d.by === 'giver' && a.of) { // the giver's name once the player knows it, else how the player sees them
    what = state.actors.some((x) => x.id === a.of) ? callName(state, state.player.id, a.of) : 'someone';
  }
  return what;
}

/** the name of a source row a by-source achievement counts under: a healing row (heal_source) or a composure row (morale_source) */
export function sourceRowName(d: AchievementDef, id: string): string {
  const lib = getLibrary();
  return (d.by === 'morale_source' ? lib.composure?.[id]?.name : lib.healing?.[id]?.name) ?? id;
}

const fmtCount = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** what an achievement asks for, in words: its count and what it counts (ACH_RULE_TEXT), for one earning. The one text
 * every screen shows for "earned at" (a row pinned to one healing source names it; an every-N row names its level). */
export function earnedAtText(state: GameState, d: AchievementDef, of?: string): string {
  const n = d.every && of && Number.isFinite(+of) ? +of : d.count;
  // a tier past Critical Success or Failure reads as the tier's own name ("an event roll at Critical Success+"), not as a
  // count of steps
  const end = d.rule === 'event_crits' ? TIERS.keys[TIERS.keys.length - 1] : d.rule === 'event_crit_fails' ? TIERS.keys[0] : null;
  if (end && n !== undefined && !d.every) return `an event roll at ${tierName({ tier: end, beyond: (end === TIERS.keys[0] ? -1 : 1) * Math.max(0, n - 1) })}`;
  let what = (n === 1 ? ACH_RULE_ONE[d.rule] : undefined) ?? ACH_RULE_TEXT[d.rule] ?? d.rule;
  if (d.only) what = what.replace(/ \(.*\)$/, '').replace(/\bone source$/, sourceRowName(d, d.only));
  if (d.every) what = what.replace(/, again at every multiple$/, '');
  const kind = d.by && !d.only && of ? ` (${title(kindName(state, d, of))})` : d.rule === 'mastery' && of ? ` (${kindName(state, d, of)})` : '';
  return `${n !== undefined ? `${fmtCount(n)} ` : ''}${what}${kind}`;
}

/** An earned achievement for display: its name, reward level (key and name), XP, whether it is a scar, what it asks for,
 * why it was earned (the count reached, when the tally is known) and its rewards. Play and the achievements page read this. */
export function achievementInfo(state: GameState, a: { id: string; key?: string; of?: string; name?: string; turn: number; reached?: number }) {
  const d = a.key ? getLibrary().achievements?.[a.key] : undefined;
  const name = achievementName(state, a);
  if (!d) return { id: a.id, name, level: '', levelName: '', xp: 0, scar: false, earnedAt: '', why: '', rewards: [] as string[] };
  const level = achLevel(d, a.of), earnedAt = earnedAtText(state, d, a.of);
  // the value reached is named only when it went past what the row needs (a high-water mark like a 137-point power gap)
  const reached = a.reached === undefined ? undefined : r1(a.reached);
  const why = reached !== undefined && !d.every && reached !== d.count
    ? `Turn ${a.turn}: you reached ${fmtCount(reached)}; this needs ${earnedAt}.`
    : `Turn ${a.turn}: you reached ${earnedAt}.`;
  return { id: a.id, name, level, levelName: rewardName(level), xp: achXp(d, a.of), scar: !!d.scar, earnedAt, why, rewards: rewardLines(d) };
}
export type AchievementInfo = ReturnType<typeof achievementInfo>;
