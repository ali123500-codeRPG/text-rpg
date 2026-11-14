// NPC generation from templates (Part 4 §4) and player creation.
import { BT, RC } from './raceIds';
import type { Actor, CreationBuild, DefenseKind, GameState, ItemDef, ItemInstance, NpcTemplate, OwnedPerk, Personality, Rng, SkillEntry } from '../types';
import { CONFIG } from '../config';
import { bodyType, race, getLibrary, hasTemplate, itemDef, npcTemplate } from './index';
import { skillOpen } from '../ruleset/access';
import { skillCap } from '../ruleset/skillCap';
import { grantThreadboundItem, syncThreadboundItemPerks } from '../ruleset/threadboundItems';
import { itemLevel, requirement, shortBy, skillToward } from '../ruleset/requirements';
import { CLASS_TIERS, EQUIP_LEVELS, LIFE_STAGES, RANKS, type LifeStageKey, type RankKey, type TalentKey } from '../scales';
import { ageFloor, rollBornDay } from '../ruleset/age';
import { DAY_MINUTES, now } from '../time';
import { createRng } from '../rng';
import { SK, DEFENSE_SKILL } from './skillIds';
import { skillName } from './skillNames';
import { CL } from './classIds';
import { IT } from './itemIds';
import { perkPointsUpTo } from '../ruleset/levels';
import { milestonePerk, milestoneState, trueSkill } from '../ruleset/perks';
import { syncPerkLinks } from '../ruleset/perkLinks';
import { PK } from './perkIds';
import { TP } from './templateIds';

/** a fixed seed from a string (a template's ID, or a template and an actor's ID) */
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

/** equip a loadout the obvious way: weapons/shields into free grips, armor worn. */
export function equipLoadout(state: GameState | null, items: string[], idPrefix: string): ItemInstance[] {
  const out: ItemInstance[] = [];
  const grips = ['grip:right_arm', 'grip:left_arm'];
  let n = 0;
  for (const itemId of items) {
    const d = itemDef(state, itemId);
    n += 1;
    const inst: ItemInstance = { id: `${idPrefix}_${itemId}_${n}` , itemId };
    if (d.slot === 'armor') inst.equippedIn = ['armor'];
    else if ((d.kind === 'weapon' || d.kind === 'shield') && grips.length) inst.equippedIn = [grips.shift()!];
    if (d.shield) inst.pools = { shield: 100 };
    if (d.armor?.pools) inst.pools = Object.fromEntries(Object.keys(d.armor.pools).map((k) => [k, 100]));
    out.push(inst);
  }
  return out;
}

export type SpawnOpts = { id: string; zone: string; placeId: string; bandId: string; label?: string; name?: string; storyId?: string; personality?: Personality /* PL12: replaces the template's points */; ageStage?: LifeStageKey /* AG14: the Weaver's life stage */; talent?: TalentKey /* AG25: the Weaver's talent */ };

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

/** NG3: a rank's anchor skill, level and training years (AG12); past the last row each step adds CONFIG.RANK_BEYOND_STEP */
export function rankRow(rank: RankKey): { anchor: number; level: number; training: number } {
  const n = Number(rank.slice(5)), last = RANKS.keys.length - 1, top = CONFIG.RANK_ROWS[RANKS.keys[last]], step = CONFIG.RANK_BEYOND_STEP;
  if (n <= last) return CONFIG.RANK_ROWS[rank];
  return { anchor: top.anchor + (n - last) * step.anchor, level: top.level + (n - last) * step.level, training: top.training + (n - last) * step.training };
}
/** NG3: a rank's name, a theme's own title first; past the last row the last name gains a + per step (Divine+, Divine++) */
export function rankName(rank: RankKey, themeId?: string): string {
  const own = themeId ? getLibrary().themes?.[themeId]?.rankNames?.[rank] : undefined;
  if (own) return own;
  const n = Number(rank.slice(5)), last = RANKS.keys.length - 1;
  return n <= last ? RANKS.name(rank as (typeof RANKS.keys)[number]) : RANKS.name(RANKS.keys[last]) + '+'.repeat(n - last);
}
const rankNo = (r: string) => Number(r.slice(5));
/** NG13: a preset's rank, raised to its role's floor (CONFIG.RANK_FLOOR: a combat role is never under Trained, a civilian
 * under Novice; a beast has none) */
export function templateRank(t: NpcTemplate): RankKey | undefined {
  if (!t.rank) return undefined;
  const kind = t.roleId ? getLibrary().npcRoles?.[t.roleId]?.kind : undefined;
  const floor = kind && kind !== 'beast' ? CONFIG.RANK_FLOOR[kind] : undefined;
  return floor && rankNo(floor) > rankNo(t.rank) ? floor : t.rank;
}
/** NG7: a template's level: its rank's (a preset), or its saved sheet's (a unique) */
export const templateLevel = (t: NpcTemplate): number => { const r = templateRank(t); return r ? rankRow(r).level : t.level ?? 0; };

type Band = keyof typeof CONFIG.ROLE_BAND_SHARE;
/** NG2, NG8: the band each skill sits in for this preset: its role's and theme's, the higher wins; then the skills every
 * NPC whose body can use them has (CONFIG.NPC_COMMON_SKILLS). Nothing else rises. */
function presetBands(t: NpcTemplate): Record<string, Band> {
  const lib = getLibrary(), out: Record<string, Band> = {};
  const order: Band[] = ['low', 'moderate', 'high'];
  const put = (id: string, b: Band) => { if (!out[id] || order.indexOf(b) > order.indexOf(out[id])) out[id] = b; };
  for (const bands of [t.roleId ? lib.npcRoles?.[t.roleId]?.bands : undefined, t.themeId ? lib.themes?.[t.themeId]?.bands : undefined])
    for (const b of order) for (const id of bands?.[b] ?? []) put(id, b);
  const body = { core: { raceId: t.raceId, bodyTypeId: race(t.raceId).bodyTypeId, classes: [], perks: [], skills: {} } } as unknown as Actor;
  for (const [id, b] of Object.entries(CONFIG.NPC_COMMON_SKILLS)) if (skillOpen(body, id)) put(id, b);
  return out;
}

/** NG2, NG5, NG8, NG9: a preset's skills: each banded skill at rank anchor × band share × NPC_BAND_MULT, moved by up to
 * ± COPY_SPREAD (seeded: an actor's ID, or none for the preset itself), capped as the player's are (SKILL_CAP, tagged + TAG_CAP_BONUS);
 * then the preset's minimums and class floors. High-band skills are tagged. Resolve comes from the preset (MB30). */
export function presetSkills(t: NpcTemplate, rng?: Rng): Record<string, SkillEntry> {
  const raw: Record<string, number> = {}, state: Record<string, 'tagged' | 'normal'> = {};
  const rank = templateRank(t), anchor = rank ? rankRow(rank).anchor * CONFIG.NPC_BAND_MULT : 0;
  for (const [id, b] of Object.entries(presetBands(t)).sort(([x], [y]) => (x < y ? -1 : 1))) {
    state[id] = b === 'high' ? 'tagged' : 'normal';
    const spread = rng ? 1 + (rng.next() * 2 - 1) * CONFIG.COPY_SPREAD : 1;
    raw[id] = Math.min(skillCap({ state: state[id] }), Math.round(anchor * CONFIG.ROLE_BAND_SHARE[b] * spread));
  }
  for (const [id, v] of Object.entries({ [SK.resolve]: t.resolve, ...templateMinimums(t) })) raw[id] = Math.max(raw[id] ?? 0, v); // class floors included
  if (raw[SK.endurance] && raw[SK.stamina] === undefined) raw[SK.stamina] = raw[SK.endurance]; // FB7: Stamina copies Endurance
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, { raw: v, state: state[k] ?? 'normal' }]));
}

/** a copy's skills: its preset's, spread by its own ID (NG9; the same copy always rebuilds the same way); with no ID, the
 * preset's centre values, which its essence list reads. A unique's are its saved sheet. */
export const templateSkills = (t: NpcTemplate, actorId?: string): Record<string, SkillEntry> =>
  t.unique ? t.unique.skills : presetSkills(t, actorId ? createRng(templateSeed(`${t.id}:${actorId}`)) : undefined);

/** NG13: a template patrols when a routine set for it has the patrol routine. A set's role tags name templates by their
 * TP key ('guard'), or by ID. */
export function patrols(t: NpcTemplate): boolean {
  const lib = getLibrary(), key = Object.entries(TP).find(([, id]) => id === t.id)?.[0];
  return Object.values(lib.routineSets ?? {}).some((r) => r.tags.role.some((x) => x === t.id || x === key) && r.routines.some((id) => id === 'patrol' || lib.routines?.[id]?.id === 'patrol'));
}

/** NG12: how many traits a rank draws (CONFIG.RANK_TRAITS; past the last row, + RANK_TRAITS_BEYOND per step) */
export function rankTraitCount(rank: RankKey | undefined): number {
  if (!rank) return 0;
  const n = rankNo(rank), last = CONFIG.RANK_TRAITS.length - 1;
  return n <= last ? CONFIG.RANK_TRAITS[n] : CONFIG.RANK_TRAITS[last] + (n - last) * CONFIG.RANK_TRAITS_BEYOND;
}

/** A preset's own perks: those it lists, the generator's rules (NG13: a patrolling preset has Keen Ear) and its rank traits
 * (NG12: drawn from its theme's and role's pools, perks and quirks alike, seeded by the actor's ID; none without an ID) */
export function templatePerks(t: NpcTemplate, actorId?: string): string[] {
  const lib = getLibrary(), own = [...(t.perks ?? []), ...(patrols(t) ? [PK.keen_ear] : [])];
  const n = actorId ? rankTraitCount(templateRank(t)) : 0;
  const pool = [...new Set([...(t.roleId ? lib.npcRoles?.[t.roleId]?.traits ?? [] : []), ...(t.themeId ? lib.themes?.[t.themeId]?.traits ?? [] : [])])]
    .filter((id) => lib.perks[id] && lib.perks[id].built !== false && !own.includes(id)).sort();
  const rng = createRng(templateSeed(`${t.id}:${actorId}:traits`));
  for (let i = 0; i < n && pool.length; i++) own.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  return [...new Set(own)];
}

/** NG11: an NPC spends its level's perk points on milestone perks by the player's rules (reached by true skill, a perk
 * written there and in the game, enough perks below it in that skill), its role's High skills first, then Moderate, Low and
 * the rest, highest first; each skill from its lowest milestone up. Taken as 'level' perks. Returns the perks taken. */
export function npcMilestonePerks(a: Actor, t: NpcTemplate, points: number, turn: number): string[] {
  const bands = presetBands(t), at = { high: 0, moderate: 1, low: 2 } as Record<string, number>, took: string[] = [];
  const order = Object.keys(a.core.skills).sort((x, y) => (at[bands[x]] ?? 3) - (at[bands[y]] ?? 3) || a.core.skills[y].raw - a.core.skills[x].raw || (x < y ? -1 : 1));
  for (const skill of order) {
    for (let m = CONFIG.PERK_MILESTONE_EVERY; m <= trueSkill(a, skill) && took.length < points; m += CONFIG.PERK_MILESTONE_EVERY) {
      const d = milestonePerk(skill, m);
      if (!d || d.built === false || milestoneState(a, skill, m) !== 'open') continue;
      a.core.perks.push({ perkId: d.id, source: 'level', gainedTurn: turn });
      took.push(d.id);
    }
  }
  if (took.length) syncPerkLinks(a, turn);
  return took;
}

/** NG14: a preset's personality: its theme's lean, then its role's, then its own pins (a later layer wins per axis; values
 * strongest first: its own, the role's, the theme's, up to DRIVES_SHOWN). An actor's ID adds a seeded spread of up to
 * ± PERSONALITY_SPREAD on every trait (not Nerve), except for a beast. The Weaver's pick goes on top (personalityFrom). */
export function presetPersonality(t: NpcTemplate, actorId?: string): Personality {
  const lib = getLibrary(), role = t.roleId ? lib.npcRoles?.[t.roleId] : undefined, theme = t.themeId ? lib.themes?.[t.themeId] : undefined;
  const out: Personality = { nerve: 0, traits: {}, values: [] };
  for (const l of [theme?.leans, role?.leans, t.personality]) {
    if (l?.nerve !== undefined) out.nerve = l.nerve;
    Object.assign(out.traits, l?.traits ?? {});
  }
  out.values = [...new Set([...(t.personality?.values ?? []), ...(role?.leans?.values ?? []), ...(theme?.leans?.values ?? [])])].slice(0, CONFIG.DRIVES_SHOWN);
  if (actorId && role?.kind !== 'beast') {
    const rng = createRng(templateSeed(`${t.id}:${actorId}:personality`));
    for (const k of Object.keys(lib.personalityAxes ?? {}).sort()) {
      const v = Math.max(-100, Math.min(100, (out.traits[k] ?? 0) + Math.round((rng.next() * 2 - 1) * CONFIG.PERSONALITY_SPREAD)));
      if (v) out.traits[k] = v; else delete out.traits[k];
    }
  }
  return out;
}

/** NG10: a preset's gear: its pinned items (NpcTemplate.loadout), then for each gear class its role uses, the highest-level
 * library item its skills meet, up to its theme's wealth (a starter item first on a tie, then by ID). The starter kit's
 * rule, without the starter tag. A slot a pin already fills (weapon, shield, armor) gets no pick, nor does a shield beside
 * a two-handed weapon. */
export function templateLoadout(t: NpcTemplate, skills: Record<string, SkillEntry>): string[] {
  const lib = getLibrary(), pins = [...(t.loadout ?? [])];
  const role = t.roleId ? lib.npcRoles?.[t.roleId] : undefined, wealth = t.themeId ? lib.themes?.[t.themeId]?.wealth : undefined;
  if (!role?.gear?.length || !wealth) return pins;
  const who = { core: { raceId: t.raceId, bodyTypeId: race(t.raceId).bodyTypeId, classes: [], perks: [], skills } } as unknown as Actor;
  const slot = (d: ItemDef) => (d.armor ? 'armor' : d.shield ? 'shield' : d.kind === 'weapon' ? 'weapon' : undefined);
  const lvl = (d: ItemDef) => EQUIP_LEVELS.pos(itemLevel(d) ?? 'crude');
  const filled = new Set(pins.map((id) => lib.items[id]).filter(Boolean).map(slot));
  let twoHanded = pins.some((id) => (lib.items[id]?.grips ?? 1) > 1);
  const out = [...pins];
  for (const gc of role.gear) {
    const best = Object.values(lib.items).filter((d) => d.gearClass === gc && !d.threadbound && slot(d) && lvl(d) <= EQUIP_LEVELS.pos(wealth) && !shortBy(who, d))
      .sort((x, y) => lvl(y) - lvl(x) || Number(!!y.tags?.includes('starter')) - Number(!!x.tags?.includes('starter')) || (x.id < y.id ? -1 : 1))[0];
    const s = best && slot(best);
    if (!best || filled.has(s) || (s === 'shield' && twoHanded)) continue;
    filled.add(s);
    if ((best.grips ?? 1) > 1) twoHanded = true;
    out.push(best.id);
  }
  return out;
}

/** NG15: a composed preset (race, role, theme, rank, optional class), as the Weaver names it from the catalog: a copy, with
 * Resolve, control and chase range from its role's kind (CONFIG.COMPOSED_NPC). Its ID names its parts, so the same
 * composition is one story blueprint. */
export function composeTemplate(c: { race: string; role: string; theme: string; rank: string; class?: string }, label: string): NpcTemplate {
  const kind = getLibrary().npcRoles?.[c.role]?.kind ?? 'civilian', d = CONFIG.COMPOSED_NPC[kind];
  return { id: composedId(c), raceId: c.race, ...(c.class ? { classId: c.class } : {}), generation: 'copy', minimums: {},
    roleId: c.role, themeId: c.theme, rank: rankKeyOf(c.rank) ?? 'rank_0', resolve: d.resolve, control: d.control, chase: d.chase, label };
}
/** NG15: a rank as the Weaver may write it: its key (rank_3, rank_10), or its name (Veteran, Divine++) */
export function rankKeyOf(w: unknown): RankKey | undefined {
  if (typeof w !== 'string') return undefined;
  if (/^rank_\d+$/.test(w)) return w as RankKey;
  const k = RANKS.keyOf(w);
  if (k) return k;
  const last = RANKS.keys.length - 1, m = w.trim().match(/^(.*?)(\++)$/);
  return m && RANKS.keyOf(m[1]) === RANKS.keys[last] ? (`rank_${last + m[2].length}` as RankKey) : undefined;
}

/** NG15: what is wrong with a composition, or undefined: every part an ID from the catalog, the rank a rank */
export function composeError(c: { race: string; role: string; theme: string; rank: string; class?: string }): string | undefined {
  const lib = getLibrary(), list = (o: Record<string, { name: string }> | undefined) => Object.entries(o ?? {}).map(([id, d]) => `${id} (${d.name})`).join(', ');
  if (!lib.races?.[c.race]) return `compose race ${c.race} unknown; known: ${list(lib.races)}`;
  if (!lib.npcRoles?.[c.role]) return `compose role ${c.role} unknown; known: ${list(lib.npcRoles)}`;
  if (!lib.themes?.[c.theme]) return `compose theme ${c.theme} unknown; known: ${list(lib.themes)}`;
  if (!rankKeyOf(c.rank)) return `compose rank ${c.rank} unknown; ranks: ${RANKS.list()}, then Divine+, Divine++ …`;
  if (c.class !== undefined && !lib.classes[c.class]) return `compose class ${c.class} unknown`;
  return undefined;
}

export const composedId = (c: { race: string; role: string; theme: string; rank: string; class?: string }) =>
  ['NC', c.race, c.role, c.theme, rankKeyOf(c.rank) ?? c.rank, ...(c.class ? [c.class] : [])].join('_');

/** the perks a member of this race is born with: its innate perks and innate quirks */

export function racePerks(raceId: string | undefined, turn = 0): OwnedPerk[] {
  const r = raceId ? getLibrary().races?.[raceId] : undefined;
  return [...(r?.innatePerks ?? []), ...(r?.innateQuirks ?? [])].map((perkId) => ({ perkId, source: 'race', gainedTurn: turn }));
}

/** SS12: one quirk rolled for each of the template's quirk tags, seeded by the actor's ID, from the quirks that carry it */
function tagQuirks(t: NpcTemplate, id: string, turn: number): OwnedPerk[] {
  const rng = createRng(templateSeed(`${id}:quirks`)), perks = Object.values(getLibrary().perks ?? {});
  return (t.quirkTags ?? []).flatMap((tag) => {
    const pool = perks.filter((p) => p.quirk && p.tags?.includes(tag) && !t.perks?.includes(p.id)).map((p) => p.id).sort();
    return pool.length ? [{ perkId: pool[rng.int(0, pool.length - 1)], source: 'template' as const, gainedTurn: turn }] : [];
  });
}

/** AG25: an NPC's talent: the Weaver's, else its preset's, else its theme's, else CONFIG.NPC_TALENT_DEFAULT */
export const presetTalent = (t: NpcTemplate, own?: TalentKey): TalentKey =>
  own ?? t.talent ?? (t.themeId ? getLibrary().themes?.[t.themeId]?.talent : undefined) ?? CONFIG.NPC_TALENT_DEFAULT;
/** AG12, AG21: the youngest age a preset's rank allows at a talent; undefined for an ageless race or a preset with no rank */
export const presetAgeFloor = (t: NpcTemplate, talent: TalentKey): number | undefined => {
  const rank = templateRank(t); // NG13: the rank after its role's floor, as the level reads it
  return rank ? ageFloor(t.raceId, rankRow(rank).training, talent) : undefined;
};

/** AG13, AG14: drawn once from the Weaver's stage or the template's stages, seeded by the actor's ID, never under its rank's
 * youngest age (AG12), and saved with the talent that set that age (AG25) */
function npcBornDay(state: GameState | null, t: NpcTemplate, id: string, stage?: LifeStageKey, own?: TalentKey): { bornDay?: number; talent?: TalentKey } {
  const talent = presetTalent(t, own);
  const d = rollBornDay(state, t.raceId, stage ? [stage] : t.ageStages, createRng(templateSeed(id)), presetAgeFloor(t, talent));
  return d === undefined ? {} : { bornDay: d, ...(templateRank(t) ? { talent } : {}) };
}

export function spawnNpc(state: GameState | null, templateId: string, opts: SpawnOpts, rng?: Rng): Actor {
  const t = npcTemplate(state, templateId);
  if (t.generation === 'unique') return spawnUnique(state, t, opts);
  if (t.generation === 'rolled' && !rng) throw new Error(`rolled template ${t.id} needs the seeded rng`);
  const skills = t.generation === 'rolled' ? presetSkills(t, rng!) : templateSkills(t, opts.id); // NG9: a copy's spread is seeded by its ID
  const ct = bodyType(state, race(t.raceId).bodyTypeId); // BR5: the body type comes from the race
  const loadout = templateLoadout(t, skills); // NG10: its pinned items, then gear by role, skill and theme wealth
  const a: Actor = {
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
      classes: t.classId ? [{ classId: t.classId, state: 'current', level: Math.min(templateLevel(t), classMaxLevel(t.classId)) }] : [], // NG7: capped by the class's top level
      perks: [...racePerks(t.raceId, state?.turn ?? 0), ...templatePerks(t, opts.id).map((perkId) => ({ perkId, source: 'template' as const, gainedTurn: state?.turn ?? 0 })), ...tagQuirks(t, opts.id, state?.turn ?? 0)],
      condition: { hpLostPct: 0, parts: fullParts(state, ct.id), status: [] },
      inventory: equipLoadout(state, loadout, opts.id),
      standingDefense: rawDefense((id) => skills[id]?.raw ?? 0, loadout), // GAP: raw skill; ties go block, parry, dodge like the player
      personality: opts.personality ?? presetPersonality(t, opts.id), // NG14: the layers and the copy's spread, or the Weaver's pick on them (PL12)
      ...npcBornDay(state, t, opts.id, opts.ageStage, opts.talent),
    },
    // a rolled NPC keeps its level's perk points (one per even level, Part 1 §5) in a Progression module; NG11 spends them below
    ...(t.generation === 'rolled' ? { progression: {
      startingTotal: Object.values(skills).filter((e) => e.state !== 'tagged').reduce((n, e) => n + e.raw, 0),
      potential: { base: t.potential ?? CONFIG.POTENTIAL, adjustments: [] }, xp: 0, unspentPerkPoints: perkPointsUpTo(templateLevel(t)), marks: [],
    } } : {}),
    mind: {
      control: t.control,
      knowledge: {},
      knows: [],
    },
  };
  const took = npcMilestonePerks(a, t, perkPointsUpTo(templateLevel(t)), state?.turn ?? 0); // NG11
  if (a.progression) a.progression.unspentPerkPoints -= took.length;
  return a;
}

/** HF15, HF18–HF21: a unique NPC, exactly as its sheet was saved, at full health. Its own name, pronouns, personality and
 * age stand (the Weaver's label and band are used). Its gear is soulbound to it (items made in its own story are library
 * items, from its sheet's itemDefs). It keeps its achievements, scars, title and essences; an echo never learns (D-243). */
function spawnUnique(state: GameState | null, t: NpcTemplate, opts: SpawnOpts): Actor {
  const u = t.unique;
  if (!u) throw new Error(`unique template ${t.id} has no sheet`);
  const ct = bodyType(state, race(t.raceId).bodyTypeId);
  const skills = structuredClone(u.skills);
  return {
    id: opts.id,
    storyId: opts.storyId ?? state?.storyId ?? 'story',
    kind: 'npc',
    names: { current: u.name, past: [] },
    label: opts.label ?? t.label,
    ...(u.pronouns ? { pronouns: u.pronouns } : {}),
    ...(u.appearance ? { appearance: u.appearance } : {}),
    placeId: opts.placeId,
    zone: opts.zone,
    bandId: opts.bandId,
    core: {
      bodyTypeId: ct.id,
      raceId: t.raceId,
      templateId: t.id,
      generation: 'unique',
      origin: u.origin,
      skills,
      classes: structuredClone(u.classes),
      perks: structuredClone(u.perks),
      condition: { hpLostPct: 0, parts: fullParts(state, ct.id), status: [] },
      inventory: u.gear.map((g, n) => ({ ...structuredClone(g), id: `${opts.id}_${g.itemId}_${n + 1}`, boundTo: opts.id, soulbound: true as const })),
      standingDefense: u.standingDefense,
      personality: structuredClone(u.personality),
      ...(u.ageDays !== undefined && state ? { bornDay: now(state) / DAY_MINUTES - u.ageDays } : {}),
    },
    progression: {
      startingTotal: Object.values(skills).filter((e) => e.state !== 'tagged').reduce((n, e) => n + e.raw, 0),
      potential: { base: CONFIG.POTENTIAL, adjustments: [] }, xp: 0, unspentPerkPoints: 0, marks: [],
      achievements: structuredClone(u.achievements), ...(u.title ? { title: u.title } : {}),
      ...(u.essences ? { essences: structuredClone(u.essences) } : {}),
    },
    mind: { control: t.control, knowledge: {}, knows: [] },
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
 * that weapon takes two grips; worn: the highest-level armor met, and a plain pack (CT7) that holds the rest. */
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
  const shield = (weapon?.grips ?? 1) < 2 ? best(met.filter((d) => d.kind === 'shield')) : undefined;
  const armor = met.filter((d) => d.armor).reduce<ItemDef | undefined>((b, d) => (!b || lvl(d) > lvl(b) || (lvl(d) === lvl(b) && score(d) > score(b)) ? d : b), undefined);
  return met.map((d, n) => {
    const inst: ItemInstance = { id: `player_${d.id}_${n + 1}`, itemId: d.id };
    if (d === weapon) inst.equippedIn = (d.grips ?? 1) > 1 ? ['grip:right_arm', 'grip:left_arm'] : ['grip:right_arm'];
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
/** `world`: the world a new character carries on in (HF28: their Threadbound item is one not already there) */
export function createPlayer(build: CreationBuild, storyId: string, opts: { preview?: boolean; world?: GameState } = {}): Actor {
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
      potential: { base: CONFIG.POTENTIAL, adjustments: [] }, xp: 0, unspentPerkPoints: perkPointsUpTo(startLevel(build.classId)), marks: [],
    },
    journal: { secretsKnown: [], factsWitnessed: [], remembered: {}, namesKnown: [] },
  };
  p.core.inventory.unshift(...starterKit(p)); // the starter kit reads the finished sheet's skills
  grantThreadboundItem(p, opts.world); // TB7: the Threadbound start's level 1 perk
  syncThreadboundItemPerks(p, 0);
  return p;
}

/** Copy NPCs follow their template live (the rank table and NPC_BAND_MULT must reach existing
 * templates and NPCs). On load, each copy's skills are rebuilt from its template with the current CONFIG, and the
 * template's perks are added if missing. Unique NPCs keep what they rolled. */
export function refreshCopies(state: GameState): void {
  for (const a of state.actors) {
    if (a.kind !== 'npc' || a.core.generation !== 'copy' || !a.core.templateId) continue;
    if (!hasTemplate(state, a.core.templateId)) continue;
    const t = npcTemplate(state, a.core.templateId);
    a.core.skills = templateSkills(t, a.id); // NG9: its own spread, the same every load
    for (const perkId of templatePerks(t, a.id)) if (!a.core.perks.some((p) => p.perkId === perkId)) a.core.perks.push({ perkId, source: 'template', gainedTurn: state.turn });
    a.core.perks = a.core.perks.filter((p) => p.source !== 'level'); // NG11: a copy's milestone perks follow its rebuilt skills
    npcMilestonePerks(a, t, perkPointsUpTo(templateLevel(t)), state.turn);
  }
  // AG2: a save from before ages gets them on load, as a new spawn would; a birth day once set is never re-rolled (AG13)
  for (const a of [state.player, ...state.actors]) {
    if (a.core.bornDay !== undefined) continue;
    if (a.kind === 'player') { if (creationAgeRange(a.core.raceId)) a.core.bornDay = Math.floor(now(state) / DAY_MINUTES - creationAge(a.core.classes[0]?.classId) * CONFIG.YEAR_DAYS); }
    else if (a.core.templateId && hasTemplate(state, a.core.templateId)) Object.assign(a.core, npcBornDay(state, npcTemplate(state, a.core.templateId), a.id));
  }
}
