// NPC generation from templates (Part 4 §4) and player creation.
import type { Actor, CreationBuild, GameState, ItemInstance, NpcTemplate, Rng, SkillEntry } from '../types';
import { CONFIG } from '../config';
import { creatureType, getLibrary, itemDef, npcTemplate } from './index';

let seq = 0;
export function newInstanceId(prefix = 'it'): string {
  seq += 1;
  return `${prefix}_${seq}`;
}
export function resetInstanceIds(): void {
  seq = 0;
}

export function fullParts(state: GameState | null, creatureTypeId: string): Record<string, number> {
  return Object.fromEntries(creatureType(state, creatureTypeId).parts.map((p) => [p.id, 100]));
}

/** equip a loadout the obvious way: weapons/shields into free hands, armor worn. */
export function equipLoadout(state: GameState | null, items: string[], idPrefix: string): ItemInstance[] {
  const out: ItemInstance[] = [];
  const hands = ['hand:right_arm', 'hand:left_arm'];
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

export type SpawnOpts = { id: string; zone: string; placeId: string; bandId: string; label?: string; name?: string; storyId?: string };

/** Copy NPC: skills are the template's minimums (read live in principle; copied here for the sheet). */
/** Unique generation (Part 4 §4): minimums, then level x POINTS_PER_LEVEL + bonusPoints in 5-point chunks, a seeded d3 per chunk. */
export function rollUniqueSkills(t: NpcTemplate, rng: Rng): Record<string, SkillEntry> {
  const raw: Record<string, number> = { ...t.minimums };
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

/** Copy NPC: skills are the template's minimums (read live in principle; copied here for the sheet). Unique: rolled once, frozen. */
export function spawnNpc(state: GameState | null, templateId: string, opts: SpawnOpts, rng?: Rng): Actor {
  const t = npcTemplate(state, templateId);
  if (t.generation === 'unique' && !rng) throw new Error(`unique template ${t.id} needs the seeded rng`);
  const skills = t.generation === 'unique'
    ? rollUniqueSkills(t, rng!)
    : Object.fromEntries(Object.entries(t.minimums).map(([k, v]) => [k, { raw: v, state: 'normal' as const }]));
  const ct = creatureType(state, t.creatureTypeId);
  const morale = CONFIG.PERSONALITY_MORALE[t.personality];
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
      creatureTypeId: ct.id,
      templateId: t.id,
      generation: t.generation,
      skills,
      classes: t.classId ? [{ classId: t.classId, state: 'current', level: t.level }] : [],
      perks: [],
      condition: { hpLostPct: 0, parts: fullParts(state, ct.id), status: [] },
      inventory: equipLoadout(state, t.loadout ?? [], opts.id),
      standingDefense: (skills.block?.raw ?? 0) > (skills.dodge?.raw ?? 0) ? 'block' : 'dodge',
    },
    // GAP: unique NPCs keep their level's perk points (one per even level, Part 1 §5) in a Progression module; NPC perks are deferred
    ...(t.generation === 'unique' ? { progression: {
      startingTotal: Object.values(skills).filter((e) => e.state !== 'tagged').reduce((n, e) => n + e.raw, 0),
      potential: { base: t.potential ?? CONFIG.POTENTIAL, adjustments: [] }, xp: 0, unspentPerkPoints: Math.floor(t.level / 2), marks: [],
    } } : {}),
    mind: {
      control: t.control,
      behavior: t.personality,
      morale: morale ?? CONFIG.MORALE_DEFAULT,
      fearless: t.personality === 'fearless',
      knowledge: {},
      knows: [],
    },
  };
}

// ---------- player creation (Part 4 §4) ----------
const PLAYER_CLASS = 'swordsman'; // first build: the player's class
const STARTING_GEAR = ['arming_sword', 'round_shield', 'gambeson'];

/** The creation screen's opening build: satisfies every creation rule. */
export function recommendedBuild(): CreationBuild {
  return {
    name: 'Aldric',
    skills: { melee_medium: 50, block: 40, dodge: 25, endurance: 40, sight: 25, hearing: 20, persuasion: 25, intimidation: 15, barter: 10 },
    tagged: ['melee_medium', 'block', 'endurance'],
  };
}

/** Empty = valid. Every point spent, open skills only, none above the cap, class floors met, exactly CREATION_TAGS tags. */
export function validateBuild(build: CreationBuild): string[] {
  const lib = getLibrary();
  const errs: string[] = [];
  if (!build.name?.trim()) errs.push('Name the character');
  let spent = 0;
  for (const [id, v] of Object.entries(build.skills)) {
    if (!lib.skills[id]?.playerOpen) errs.push(`${id} is not open to the point-buy`);
    if (!Number.isInteger(v) || v < 0) errs.push(`${id} must be a whole number of points, 0 or more`);
    else if (v > CONFIG.CREATION_MAX_SKILL) errs.push(`${id} is above ${CONFIG.CREATION_MAX_SKILL}`);
    spent += v;
  }
  for (const [id, min] of Object.entries(lib.classes[PLAYER_CLASS]?.floors ?? {}))
    if ((build.skills[id] ?? 0) < min) errs.push(`${id} must be at least ${min} (class floor)`);
  if (spent !== CONFIG.CREATION_POINTS) errs.push(`Spend exactly ${CONFIG.CREATION_POINTS} points (${spent} spent)`);
  const tags = new Set(build.tagged);
  if (tags.size !== build.tagged.length) errs.push('A skill is tagged twice');
  if (tags.size !== CONFIG.CREATION_TAGS) errs.push(`Tag exactly ${CONFIG.CREATION_TAGS} skills (${tags.size} tagged)`);
  for (const id of tags) if (!lib.skills[id]?.playerOpen) errs.push(`${id} cannot be tagged`);
  return errs;
}

/** The player's sheet from a valid build. zone and placeId stay empty until the story-start setup places the player. */
export function createPlayer(build: CreationBuild, storyId: string): Actor {
  const errs = validateBuild(build);
  if (errs.length) throw new Error(`invalid build: ${errs.join('; ')}`);
  const skills = Object.fromEntries(Object.entries(build.skills).filter(([k, v]) => v > 0 || build.tagged.includes(k))
    .map(([k, v]) => [k, { raw: v, state: build.tagged.includes(k) ? 'tagged' as const : 'normal' as const }]));
  return {
    id: 'player', storyId, kind: 'player', names: { current: build.name.trim(), past: [] },
    label: 'a swordsman', // GAP: the player's public stranger label is not specified
    placeId: '', zone: '', // GAP: set by story-start scene setup (the village tavern, Part 2 Scene setup)
    posture: 'open', bandId: 'player_band',
    core: {
      creatureTypeId: 'humanoid',
      skills,
      classes: [{ classId: PLAYER_CLASS, state: 'current', level: 1 }],
      perks: [],
      condition: { hpLostPct: 0, parts: fullParts(null, 'humanoid'), status: [] },
      inventory: [...equipLoadout(null, STARTING_GEAR, 'player'), { id: 'player_coin', itemId: 'coin', qty: CONFIG.STARTING_COIN }],
      // GAP: [Proposed] default is the higher effective skill; effective skill is W2's, so raw is compared here
      standingDefense: (build.skills.block ?? 0) >= (build.skills.dodge ?? 0) ? 'block' : 'dodge',
    },
    progression: {
      startingTotal: Object.entries(build.skills).filter(([k]) => !build.tagged.includes(k)).reduce((n, [, v]) => n + v, 0),
      potential: { base: CONFIG.POTENTIAL, adjustments: [] }, xp: 0, unspentPerkPoints: 0, marks: [],
    },
    journal: { secretsKnown: [], factsWitnessed: [], remembered: {}, namesKnown: [] },
  };
}
