// NPC generation from templates (Part 4 §4) and player creation.
import { BT, RC } from './raceIds';
import type { Actor, CreationBuild, DefenseKind, GameState, ItemDef, ItemInstance, NpcTemplate, OwnedPerk, Personality, Rng, SkillEntry } from '../types';
import { CONFIG } from '../config';
import { bodyType, race, getLibrary, hasTemplate, itemDef, npcTemplate } from './index';
import { skillOpen } from '../ruleset/access';
import { grantThreadboundItem, syncThreadboundItemPerks } from '../ruleset/threadboundItems';
import { itemLevel, requirement, shortBy, skillToward } from '../ruleset/requirements';
import { CLASS_TIERS, EQUIP_LEVELS, LIFE_STAGES, type LifeStageKey } from '../scales';
import { rollBornDay } from '../ruleset/age';
import { DAY_MINUTES, now } from '../time';
import { createRng } from '../rng';
import { SK, DEFENSE_SKILL } from './skillIds';
import { skillName } from './skillNames';
import { CL } from './classIds';
import { IT } from './itemIds';

/** a fixed seed per template id, so every copy of a template spends its level points the same way */
const templateSeed = (id: string) => [...id].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7) || 1;

let seq = 0;
export function newInstanceId(prefix = 'it'): string {
  seq += 1;
  return `${prefix}_${seq}`;
}
export function resetInstanceIds(): void {
  seq = 0;
}

export function fullParts(state: GameState | null, bodyTypeId: string): Record<string, number> {
  return Object.fromEntries(bodyType(state, bodyTypeId).parts.map((p) => [p.id, 100]));
}

/** equip a loadout the obvious way: weapons/shields into free hands, armor worn. */
export function equipLoadout(state: GameState | null, items: string[], idPrefix: string): ItemInstance[] {
  const out: ItemInstance[] = [];
  const hands = ['grip:right_arm', 'grip:left_arm'];
  let n = 0;
  for (const itemId of items) {
    const d = itemDef(state, itemId);
    n += 1;
    const inst: ItemInstance = { id: `${idPrefix}_${itemId}_${n}` , itemId };
    if (d.slot === 'armor') inst.equippedIn = ['armor'];
    else if ((d.kind === 'weapon' || d.kind === 'shield') && hands.length) inst.equippedIn = [hands.shift()!];
    if (d.shield) inst.pools = { shield: 100 };
    if (d.armor?.pools) inst.pools = Object.fromEntries(Object.keys(d.armor.pools).map((k) => [k, 100]));
    out.push(inst);
  }
  return out;
}

export type SpawnOpts = { id: string; zone: string; placeId: string; bandId: string; label?: string; name?: string; storyId?: string; personality?: Personality /* PL12: replaces the template's points */; ageStage?: LifeStageKey /* AG14: the Weaver's life stage */ };

/** A class's skill floors: its own floors plus its unlock conditions (a character of the class must meet what unlocks it).
 * all = every skill must reach its value; any = either-of groups, one skill in each must reach its value. */
export function classFloors(classId: string | undefined): { all: Record<string, number>; any: Record<string, number>[] } {
  const c = classId ? getLibrary().classes[classId] : undefined;
  const all: Record<string, number> = { ...(c?.floors ?? {}) };
  for (const [id, v] of Object.entries(c?.unlock ?? {})) all[id] = Math.max(all[id] ?? 0, v);
  return { all, any: c?.unlockAny ?? [] };
}

/** a template's minimums raised to its class floors; an unmet either-of group raises the skill the template has most of (first listed on a tie) */
export function templateMinimums(t: NpcTemplate): Record<string, number> {
  const min = { ...t.minimums };
  const f = classFloors(t.classId);
  for (const [id, v] of Object.entries(f.all)) min[id] = Math.max(min[id] ?? 0, v);
  for (const g of f.any) {
    const ids = Object.keys(g);
    if (ids.some((id) => (min[id] ?? 0) >= g[id])) continue;
    const best = ids.reduce((b, id) => ((min[id] ?? 0) > (min[b] ?? 0) ? id : b), ids[0]);
    min[best] = g[best];
  }
  return min;
}

/** Rolled generation (Part 4 §4): minimums, then level x POINTS_PER_LEVEL + bonusPoints in 5-point chunks, a seeded d3 per chunk. */
export function rollUniqueSkills(t: NpcTemplate, rng: Rng): Record<string, SkillEntry> {
  const raw: Record<string, number> = { [SK.resolve]: t.resolve, ...templateMinimums(t) }; // class floors included // MB30: the template sets starting Resolve
  let points = t.level * CONFIG.POINTS_PER_LEVEL + t.bonusPoints;
  while (points > 0 && t.focus.length) {
    const chunk = Math.min(5, points); // GAP: a remainder under 5 goes out as the last, smaller chunk
    points -= chunk;
    const pick = t.focus[rng.int(1, t.focus.length) - 1]; // d3 over the three picks
    // GAP: a preferred skill at 100 spills into the rest of its tree (tree order); points with nowhere to go are lost
    const tree = getLibrary().trees[pick.treeId]?.skills ?? [];
    let left = chunk;
    for (const sk of [pick.skill, ...tree.filter((x) => x !== pick.skill)]) {
      const add = Math.min(left, 100 - (raw[sk] ?? 0));
      if (add > 0) { raw[sk] = (raw[sk] ?? 0) + add; left -= add; }
      if (!left) break;
    }
  }
  const tagged = new Set(t.focus.map((f) => f.skill));
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, { raw: v, state: tagged.has(k) ? 'tagged' as const : 'normal' as const }]));
}

/** Copy NPC: minimums plus level points spent with the template's fixed seed (alike for every copy). Unique: rolled once, frozen. */
/** the perks a member of this race is born with: its innate perks and innate quirks */
export function racePerks(raceId: string | undefined, turn = 0): OwnedPerk[] {
  const r = raceId ? getLibrary().races?.[raceId] : undefined;
  return [...(r?.innatePerks ?? []), ...(r?.innateQuirks ?? [])].map((perkId) => ({ perkId, source: 'race', gainedTurn: turn }));
}

/** AG13, AG14: drawn once from the Weaver's stage or the template's stages, seeded by the actor's ID, and saved */
function npcBornDay(state: GameState | null, t: NpcTemplate, id: string, stage?: LifeStageKey): { bornDay?: number } {
  const d = rollBornDay(state, t.raceId, stage ? [stage] : t.ageStages, createRng(templateSeed(id)));
  return d === undefined ? {} : { bornDay: d };
}

export function spawnNpc(state: GameState | null, templateId: string, opts: SpawnOpts, rng?: Rng): Actor {
  const t = npcTemplate(state, templateId);
  if (t.generation === 'rolled' && !rng) throw new Error(`rolled template ${t.id} needs the seeded rng`);
  const skills = t.generation === 'rolled'
    ? rollUniqueSkills(t, rng!)
    // Q3: copies get their level points too, spent the same way but with a fixed seed, so every copy is alike
    : rollUniqueSkills(t, createRng(templateSeed(t.id)));
  const ct = bodyType(state, race(t.raceId).bodyTypeId); // BR5: the body type comes from the race
  return {
    id: opts.id,
    storyId: opts.storyId ?? state?.storyId ?? 'story',
    kind: 'npc',
    names: { current: opts.name ?? opts.label ?? t.label, past: [] },
    label: opts.label ?? t.label,
    placeId: opts.placeId,
    zone: opts.zone,
    bandId: opts.bandId,
    core: {
      bodyTypeId: ct.id,
      raceId: t.raceId,
      templateId: t.id,
      generation: t.generation,
      skills,
      classes: t.classId ? [{ classId: t.classId, state: 'current', level: t.level }] : [],
      perks: [...racePerks(t.raceId, state?.turn ?? 0), ...(t.perks ?? []).map((perkId) => ({ perkId, source: 'template' as const, gainedTurn: state?.turn ?? 0 }))],
      condition: { hpLostPct: 0, parts: fullParts(state, ct.id), status: [] },
      inventory: equipLoadout(state, t.loadout ?? [], opts.id),
      standingDefense: rawDefense((id) => skills[id]?.raw ?? 0, t.loadout ?? []), // GAP: raw skill; ties go block, parry, dodge like the player
      personality: opts.personality ?? structuredClone(t.personality), // PL11, PL12: the template's points, or the Weaver's pick on them
      ...npcBornDay(state, t, opts.id, opts.ageStage),
    },
    // GAP: rolled NPCs keep their level's perk points (one per even level, Part 1 §5) in a Progression module; NPC perks are deferred
    ...(t.generation === 'rolled' ? { progression: {
      startingTotal: Object.values(skills).filter((e) => e.state !== 'tagged').reduce((n, e) => n + e.raw, 0),
      potential: { base: t.potential ?? CONFIG.POTENTIAL, adjustments: [] }, xp: 0, unspentPerkPoints: Math.floor(t.level / 2), marks: [],
    } } : {}),
    mind: {
      control: t.control,
      knowledge: {},
      knows: [],
    },
  };
}

// ---------- player creation (Part 4 §4) ----------
const PLAYER_CLASS: string = CL.swordsman; // the default starting class
/** a starting class's creation points and starting level (ClassDef.creation, else CONFIG) */
export const creationPoints = (classId = PLAYER_CLASS) => getLibrary().classes[classId]?.creation?.points ?? CONFIG.CREATION_POINTS;
/** AG15: the age picker: from the race's Youth start to its Venerable start; the start's default, else CREATION_AGE_DEFAULT */
export const creationAge = (classId = PLAYER_CLASS) => getLibrary().classes[classId]?.creation?.age ?? CONFIG.CREATION_AGE_DEFAULT;
export function creationAgeRange(raceId: string = RC.human): { min: number; max: number } | undefined {
  const st = getLibrary().races?.[raceId]?.ageStages;
  return st ? { min: st[LIFE_STAGES.at(1)] ?? 0, max: st[LIFE_STAGES.at(5)] ?? 0 } : undefined;
}
export const startLevel = (classId = PLAYER_CLASS) => getLibrary().classes[classId]?.creation?.level ?? CONFIG.START_LEVEL;
/** a class's top level: set by its tier (CLASS_TIER0_MAX_LEVEL + CLASS_LEVELS_PER_TIER × tier), at most CLASS_MAX_LEVEL */
export function classMaxLevel(classId: string): number {
  const c = getLibrary().classes[classId];
  return Math.min(CONFIG.CLASS_MAX_LEVEL, CONFIG.CLASS_TIER0_MAX_LEVEL + CONFIG.CLASS_LEVELS_PER_TIER * (c ? CLASS_TIERS.pos(c.tier) : 0));
}
/** class-level perks: the perks a class grants for reaching levels above `from` up to `to`; its capstone comes at its top level */
export function classPerks(classId: string, from: number, to: number, turn = 0): OwnedPerk[] {
  const c = getLibrary().classes[classId], top = classMaxLevel(classId);
  const lv: Record<number, string[]> = { ...c?.levelPerks };
  if (c?.capstone) lv[top] = [...(lv[top] ?? []), ...c.capstone];
  return Object.entries(lv).filter(([n]) => +n > from && +n <= to).flatMap(([, ids]) => ids.map((perkId) => ({ perkId, source: 'class' as const, gainedTurn: turn })));
}
/** who a new player is: body type, race, class and its perks. Tree access (TA1) reads these before the sheet exists. */
export const newPlayer = (classId = PLAYER_CLASS): Pick<Actor['core'], 'bodyTypeId' | 'raceId' | 'classes' | 'perks'> => ({
  bodyTypeId: BT.humanoid,
  raceId: RC.human, // GAP: no race choice at creation yet
  classes: [{ classId, state: 'current', level: startLevel(classId) }],
  perks: [...racePerks(RC.human), ...classPerks(classId, 0, startLevel(classId))],
});

/** The starter kit: after creation the player gets, for each gear class, the highest-level item tagged 'starter'
 * whose equip requirement their skills meet (every class has a Common 25 and a Fine 50 piece). Held: the weapon whose required skill is highest (then the higher level), and a met shield unless
 * that weapon takes two hands; worn: the highest-level armor met, and a plain pack (CT7) that holds the rest. */
export function starterKit(a: Actor): ItemInstance[] {
  const lib = getLibrary();
  const lvl = (d: ItemDef) => EQUIP_LEVELS.pos(itemLevel(d) ?? 'crude');
  const top = new Map<string, ItemDef>(); // per gear class, only the highest level met
  for (const d of Object.values(lib.items)) if (d.tags?.includes('starter') && !shortBy(a, d)) {
    const k = d.gearClass ?? d.id, b = top.get(k);
    if (!b || lvl(d) > lvl(b)) top.set(k, d);
  }
  const met = [...top.values()];
  const score = (d: ItemDef) => { const r = requirement(d); return (r ? skillToward(a, r.skill) : 0) * 10 + lvl(d); };
  const best = (ds: ItemDef[]) => ds.reduce<ItemDef | undefined>((b, d) => (!b || score(d) > score(b) ? d : b), undefined);
  const weapon = best(met.filter((d) => d.kind === 'weapon'));
  const shield = (weapon?.hands ?? 1) < 2 ? best(met.filter((d) => d.kind === 'shield')) : undefined;
  const armor = met.filter((d) => d.armor).reduce<ItemDef | undefined>((b, d) => (!b || lvl(d) > lvl(b) || (lvl(d) === lvl(b) && score(d) > score(b)) ? d : b), undefined);
  return met.map((d, n) => {
    const inst: ItemInstance = { id: `player_${d.id}_${n + 1}`, itemId: d.id };
    if (d === weapon) inst.equippedIn = (d.hands ?? 1) > 1 ? ['grip:right_arm', 'grip:left_arm'] : ['grip:right_arm'];
    if (d === shield) inst.equippedIn = ['grip:left_arm'];
    if (d === armor) inst.equippedIn = ['armor'];
    if (d.shield) inst.pools = { shield: 100 };
    if (d.armor?.pools) inst.pools = Object.fromEntries(Object.keys(d.armor.pools).map((k) => [k, 100]));
    return inst;
  }).concat({ id: 'player_pack', itemId: IT.pack, equippedIn: ['pack'] }); // CT7: a worn pack holds what they carry
}

/** a new sheet's standing defense from raw skill: the highest of block, parry and dodge (ties in that order). With a
 * known loadout, block needs a shield in it and parry a melee weapon. */
function rawDefense(raw: (id: string) => number, loadout?: string[]): DefenseKind {
  const has = (f: (d: ItemDef) => boolean) => !loadout || loadout.some((id) => { const d = getLibrary().items[id]; return !!d && f(d); });
  const kinds = (['block', 'parry', 'dodge'] as DefenseKind[]).filter((t) => t === 'dodge'
    || (t === 'block' ? has((d) => !!d.shield) : has((d) => !!d.weapon?.modes.some((m) => m.tree === 'melee' && !m.thrown))));
  return kinds.reduce((best, t) => (raw(DEFENSE_SKILL[t]) > raw(DEFENSE_SKILL[best]) ? t : best), kinds[0]);
}

/** The creation screen's opening build: satisfies every creation rule and meets the starting gear's requirements
 * (EQ13: Light Armor for the gambeson, taken from the Swordsman skills; tags medium weapons, parry, endurance). */
export function recommendedBuild(classId = PLAYER_CLASS): CreationBuild {
  if (classId === CL.late_bloomer || classId === CL.a_nobody || classId === CL.threadbounded) return { // 50 points; the same kit, so its gear is short at the start
    name: 'Aldric', classId,
    skills: { [SK.melee_medium]: 15, [SK.parry]: 10, [SK.dodge]: 5, [SK.endurance]: 10, [SK.eyesight]: 5, [SK.earshot]: 5 },
    tagged: [SK.melee_medium, SK.parry, SK.endurance],
  };
  return {
    name: 'Aldric',
    skills: { [SK.melee_medium]: 50, [SK.parry]: 40, [SK.dodge]: 25, [SK.endurance]: 50, [SK.eyesight]: 30, [SK.earshot]: 30, [SK.light_armor]: 25 },
    tagged: [SK.melee_medium, SK.parry, SK.endurance],
  };
}

/** Empty = valid. Every point spent, skills in trees open to a new player only (TA1), none above the cap, class floors met, exactly CREATION_TAGS tags. */
export function validateBuild(build: CreationBuild): string[] {
  const lib = getLibrary();
  const errs: string[] = [];
  const cls = build.classId ?? PLAYER_CLASS;
  if (!lib.classes[cls]?.creation && cls !== PLAYER_CLASS) errs.push(`${cls} is not a starting class`);
  const who = { core: newPlayer(cls) } as Actor;
  if (!build.name?.trim()) errs.push('Name the character');
  let spent = 0;
  for (const [id, v] of Object.entries(build.skills)) {
    if (!lib.skills[id] || !skillOpen(who, id)) errs.push(`${skillName(id)} is not open to the point-buy`);
    if (!Number.isInteger(v) || v < 0) errs.push(`${skillName(id)} must be a whole number of points, 0 or more`);
    else if (v > CONFIG.CREATION_MAX_SKILL) errs.push(`${skillName(id)} is above ${CONFIG.CREATION_MAX_SKILL}`);
    spent += v;
  }
  const floors = classFloors(cls);
  for (const [id, min] of Object.entries(floors.all))
    if ((build.skills[id] ?? 0) < min) errs.push(`${skillName(id)} must be at least ${min} (class floor)`);
  for (const g of floors.any)
    if (!Object.entries(g).some(([id, min]) => (build.skills[id] ?? 0) >= min)) errs.push(`One of ${Object.entries(g).map(([id, min]) => `${skillName(id)} ${min}`).join(', ')} (class floor)`);
  if (spent !== creationPoints(cls)) errs.push(`Spend exactly ${creationPoints(cls)} points (${spent} spent)`);
  const tags = new Set(build.tagged);
  if (tags.size !== build.tagged.length) errs.push('A skill is tagged twice');
  if (tags.size !== CONFIG.CREATION_TAGS) errs.push(`Tag exactly ${CONFIG.CREATION_TAGS} skills (${tags.size} tagged)`);
  for (const id of tags) if (!lib.skills[id] || !skillOpen(who, id)) errs.push(`${skillName(id)} cannot be tagged`);
  const range = creationAgeRange(newPlayer(cls).raceId);
  if (build.age !== undefined && range && (!Number.isInteger(build.age) || build.age < range.min || build.age > range.max)) errs.push(`Age must be a whole number from ${range.min} to ${range.max}`);
  const pe = build.personality; // PL14: points run −100 to +100; up to two values from the library
  if (pe) {
    const inRange = (n: number) => Number.isFinite(n) && n >= -100 && n <= 100;
    if (!inRange(pe.nerve)) errs.push('Nerve must be between −100 and 100');
    for (const [k, v] of Object.entries(pe.traits)) if (!lib.personalityAxes?.[k] || !inRange(v)) errs.push(`${lib.personalityAxes?.[k]?.name ?? k} must be a personality trait between −100 and 100`);
    if (pe.values.length > CONFIG.DRIVES_SHOWN || new Set(pe.values).size !== pe.values.length || pe.values.some((v) => !lib.values?.[v])) errs.push(`Pick up to ${CONFIG.DRIVES_SHOWN} different values`);
  }
  return errs;
}

/**
 * The player's sheet from a build: the one builder for the game and the creation preview. zone and placeId stay empty
 * until the story-start setup places the player. `preview` skips the build check (the creation screen previews
 * unfinished builds).
 */
export function createPlayer(build: CreationBuild, storyId: string, opts: { preview?: boolean } = {}): Actor {
  const errs = opts.preview ? [] : validateBuild(build);
  if (errs.length) throw new Error(`invalid build: ${errs.join('; ')}`);
  const skills = Object.fromEntries(Object.entries(build.skills).filter(([k, v]) => v > 0 || build.tagged.includes(k))
    .map(([k, v]) => [k, { raw: v, state: build.tagged.includes(k) ? 'tagged' as const : 'normal' as const }]));
  const p: Actor = {
    id: 'player', storyId, kind: 'player', names: { current: build.name.trim(), past: [] }, ...(build.pronouns ? { pronouns: build.pronouns } : {}),
    label: getLibrary().classes[build.classId ?? PLAYER_CLASS]?.label ?? 'a stranger', // the starting class's stranger label
    placeId: '', zone: '', // GAP: set by story-start scenario setup (the village tavern, Part 2 Scenario setup)
    posture: 'open', bandId: 'player_band',
    core: {
      ...newPlayer(build.classId ?? PLAYER_CLASS),
      skills,
      condition: { hpLostPct: 0, parts: fullParts(null, BT.humanoid), status: [] },
      inventory: [{ id: 'player_coin', itemId: IT.coin, qty: CONFIG.STARTING_COIN }, { id: 'player_bandage', itemId: IT.bandage, qty: CONFIG.STARTING_BANDAGES }],
      // GAP: [Proposed] default is the higher effective skill; effective skill is W2's, so raw is compared here (the game re-picks at start)
      standingDefense: rawDefense((id) => build.skills[id] ?? 0),
      personality: structuredClone(build.personality ?? { nerve: 0, traits: {}, values: [] }), // PL14
      bornDay: -Math.round((build.age ?? creationAge(build.classId)) * CONFIG.YEAR_DAYS), // AG2, AG15: the story starts on day 1
    },
    progression: {
      startingTotal: Object.entries(build.skills).filter(([k]) => !build.tagged.includes(k)).reduce((n, [, v]) => n + v, 0),
      potential: { base: CONFIG.POTENTIAL, adjustments: [] }, xp: 0, unspentPerkPoints: Math.floor(startLevel(build.classId) / 2), marks: [], // a perk point per even level passed (xp.ts)
    },
    journal: { secretsKnown: [], factsWitnessed: [], remembered: {}, namesKnown: [] },
  };
  p.core.inventory.unshift(...starterKit(p)); // the starter kit reads the finished sheet's skills
  grantThreadboundItem(p); // TB7: the Threadbound start's level 1 perk
  syncThreadboundItemPerks(p, 0);
  return p;
}

/** Copy NPCs follow their template live (the level × POINTS_PER_LEVEL lever must reach existing
 * templates and NPCs). On load, each copy's skills are rebuilt from its template with the current CONFIG, and the
 * template's perks are added if missing. Unique NPCs keep what they rolled. */
export function refreshCopies(state: GameState): void {
  for (const a of state.actors) {
    if (a.kind !== 'npc' || a.core.generation !== 'copy' || !a.core.templateId) continue;
    if (!hasTemplate(state, a.core.templateId)) continue;
    const t = npcTemplate(state, a.core.templateId);
    a.core.skills = rollUniqueSkills(t, createRng(templateSeed(t.id)));
    for (const perkId of t.perks ?? []) if (!a.core.perks.some((p) => p.perkId === perkId)) a.core.perks.push({ perkId, source: 'template', gainedTurn: state.turn });
  }
  // AG2: a save from before ages gets them on load, as a new spawn would; a birth day once set is never re-rolled (AG13)
  for (const a of [state.player, ...state.actors]) {
    if (a.core.bornDay !== undefined) continue;
    if (a.kind === 'player') { if (creationAgeRange(a.core.raceId)) a.core.bornDay = Math.floor(now(state) / DAY_MINUTES - creationAge(a.core.classes[0]?.classId) * CONFIG.YEAR_DAYS); }
    else if (a.core.templateId && hasTemplate(state, a.core.templateId)) Object.assign(a.core, npcBornDay(state, npcTemplate(state, a.core.templateId), a.id));
  }
}
