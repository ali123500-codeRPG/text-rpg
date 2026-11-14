// Nerve and personality (PL1–PL19). Points are stored; lines, tiers, words, the archetype and tensions are read from them here.
// Nerve (risk) picks a line by its lean and a tier by raw Resolve; the personality axes and ranked values describe how
// the character behaves. Perks, the current class and achievements add points while held (PL15, PL16). The words go to
// the agents that play NPCs (CHARACTER) and to the player's sheet; nothing here changes a roll (numeric effects: D-205).
import type { Actor, GameState, Personality, PersonalityAdd, PersonalityTypeDef, TensionDef } from '../types';
import { CONFIG } from '../config';
import { getLibrary, npcTemplate } from '../library';
import { SK } from '../library/skillIds';
import { GR } from '../library/functionIds';
import { groupsOf } from '../library/functionNames';
import { NERVE_HINTS, NERVE_LINES, type NerveLine, type Scale } from '../scales';
import { chainRewards, currentAchievements } from './achRewards';
import { ageYears, lifeStage } from './age';
import { listWords } from '../words';

/** the skill groups that count as fighting, and as attacking, for the tensions' bestFight and bestAttack */
const ATTACK_GROUPS: string[] = [GR.melee, GR.ranged];
const FIGHT_GROUPS: string[] = [...ATTACK_GROUPS, GR.defense];

const NONE: Personality = { nerve: 0, traits: {}, values: [] };

/** the actor's points: its own, plus what its perks, current class and current achievements add (chains by reference) */
export function personalityOf(a: Actor): Personality {
  const base = a.core.personality ?? NONE;
  const out: Personality = { nerve: base.nerve, traits: { ...base.traits }, values: [...base.values] };
  const add = (x?: PersonalityAdd) => {
    for (const [k, v] of Object.entries(x ?? {})) if (k === 'nerve') out.nerve += v; else out.traits[k] = (out.traits[k] ?? 0) + v;
  };
  const lib = getLibrary();
  for (const p of a.core.perks) if (!p.dormant) add(lib.perks[p.perkId]?.personality); // PN6: a dormant perk adds none
  for (const c of a.core.classes) if (c.state === 'current') add(lib.classes[c.classId]?.personality);
  for (const x of currentAchievements(a)) for (const e of chainRewards(x.d)) {
    if (e.field === 'personality') add(e.from.personality);
    if (e.field === 'personalityByKind' && x.of) add(e.from.personalityByKind?.[x.of]); // AP12: e.g. speech wins with Lying
  }
  return out;
}

/** PL2: the Nerve line: cautious or daring once the points lean, else steady */
export function nerveLine(p: Personality): NerveLine {
  return p.nerve <= -CONFIG.PERSONALITY_LEAN ? 'cautious' : p.nerve >= CONFIG.PERSONALITY_LEAN ? 'daring' : 'steady';
}

const rawResolve = (a: Actor) => a.core.skills[SK.resolve]?.raw ?? 0;

/** PL3, PL20: the Nerve tier's name on the actor's line, from raw Resolve; past the last tier, a + per NERVE_BEYOND_STEP */
export function nerveTier(a: Actor, p = personalityOf(a)): string {
  const line: Scale<string> = NERVE_LINES[nerveLine(p)], r = rawResolve(a), from = CONFIG.NERVE_TIER_FROM;
  let i = 0;
  while (i + 1 < from.length && r >= from[i + 1]) i++;
  const plus = i === from.length - 1 ? Math.floor((r - from[i]) / CONFIG.NERVE_BEYOND_STEP) : 0;
  return line.name(line.at(i)) + '+'.repeat(plus);
}

/** PL9: the strength word before a trait ("very ", "", "a bit "), from its distance from 0 */
const strength = (v: number) => [...CONFIG.TRAIT_WORDS].reverse().find(([from]) => Math.abs(v) >= from)?.[1] ?? '';

/** PL9: the trait words, strongest first; a trait under PERSONALITY_LEAN from 0 is left out */
export function traitWords(p: Personality): string[] {
  const axes = getLibrary().personalityAxes ?? {};
  return Object.entries(p.traits).filter(([k, v]) => axes[k] && Math.abs(v) >= CONFIG.PERSONALITY_LEAN)
    .sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))
    .map(([k, v]) => strength(v) + (v < 0 ? axes[k].low : axes[k].high));
}

/** how far the ranked values are from a type's: 0 = the type's values are the top ones held, 100 = none of them */
function driveGap(values: string[], typeValues: string[] | undefined): number {
  if (!typeValues?.length) return CONFIG.ARCHETYPE_NO_VALUES_GAP;
  const W = CONFIG.DRIVE_RANK_WEIGHT, w = (i: number) => W[Math.min(i, W.length - 1)];
  const got = typeValues.reduce((s, v) => s + (values.includes(v) ? w(values.indexOf(v)) : 0), 0);
  const best = Array.from({ length: Math.min(typeValues.length, values.length) }, (_, i) => w(i)).reduce((x, y) => x + y, 0);
  return best ? 100 * (1 - got / best) : CONFIG.ARCHETYPE_NO_VALUES_GAP;
}

/** PL10: the archetype: the nearest type by the average gap over every axis, Nerve, and the drive fit counted
 * ARCHETYPE_VALUE_WEIGHT times; a tie goes to the earlier row */
export function archetypeOf(p: Personality): PersonalityTypeDef {
  const lib = getLibrary(), axes = Object.keys(lib.personalityAxes ?? {}), W = CONFIG.ARCHETYPE_VALUE_WEIGHT;
  const gap = (t: PersonalityTypeDef) => (axes.reduce((s, ax) => s + Math.abs((p.traits[ax] ?? 0) - (t.target[ax] ?? 0)), 0)
    + Math.abs(p.nerve - (t.nerve ?? 0)) + W * driveGap(p.values, t.values)) / (axes.length + 1 + W);
  return Object.values(lib.personalityTypes ?? {}).reduce((best, t) => (gap(t) < gap(best) ? t : best));
}

/** the traits the archetype doesn't explain ("but"): BUT_MIN points or more, BUT_GAP or more from its target, and not
 * just a weaker version of it; widest gap first, at most BUTS_SHOWN */
export function butsOf(p: Personality, t: PersonalityTypeDef): { axis: string; v: number }[] {
  return Object.keys(getLibrary().personalityAxes ?? {}).map((axis, i) => ({ axis, i, v: p.traits[axis] ?? 0, t: t.target[axis] ?? 0 }))
    .filter((b) => Math.abs(b.v) >= CONFIG.BUT_MIN && Math.abs(b.v - b.t) >= CONFIG.BUT_GAP && (Math.sign(b.v) !== Math.sign(b.t) || Math.abs(b.v) > Math.abs(b.t)))
    .sort((x, y) => Math.abs(y.v - y.t) - Math.abs(x.v - x.t) || x.i - y.i).slice(0, CONFIG.BUTS_SHOWN).map(({ axis, v }) => ({ axis, v }));
}

/** the tensions the actor meets, in table order (all of them; the line shows TENSIONS_SHOWN) */
export function tensionsOf(state: GameState, a: Actor, p = personalityOf(a)): TensionDef[] {
  const lib = getLibrary(), years = ageYears(state, a), stage = years === undefined ? undefined : lifeStage(a.core.raceId, years)?.key;
  // Resolve is the Nerve tier's own measure, never a craft
  const best = (groups: string[] | null) => Math.max(0, ...Object.entries(a.core.skills)
    .filter(([id]) => id !== SK.resolve && (!groups || groupsOf(lib.skills[id]).some((g) => groups.includes(g)))).map(([, e]) => e.raw));
  const fact: Record<string, number> = { ...p.traits, [SK.resolve]: rawResolve(a), bestSkill: best(null), bestFight: best(FIGHT_GROUPS), bestAttack: best(ATTACK_GROUPS) };
  const v = (k: string) => fact[k] ?? 0;
  return Object.values(lib.tensions ?? {}).filter(({ when: w }) =>
    Object.entries(w.min ?? {}).every(([k, n]) => v(k) >= n) && Object.entries(w.max ?? {}).every(([k, n]) => v(k) <= n)
    && (!w.nerveLine || w.nerveLine === nerveLine(p)) && (!w.ageStage || w.ageStage === stage)
    && (w.drives ?? []).every((d) => p.values.includes(d)) && (!w.anyDrive || w.anyDrive.some((d) => p.values.includes(d))));
}

const list = (xs: string[]) => listWords(xs);

/** PL4, PL9: the line the agent reads in CHARACTER: Nerve with its hint and the mood, a rolled NPC's signatures, the
 * archetype with its "but" traits, the top drives and the tensions. The morale level is the mood; the tier never moves with it. */
export function personalityText(state: GameState, a: Actor, morale: string): string {
  const p = personalityOf(a), lib = getLibrary(), axes = lib.personalityAxes ?? {}, line = nerveLine(p);
  const t = a.core.generation === 'rolled' && a.core.templateId ? npcTemplate(state, a.core.templateId) : undefined;
  const arch = archetypeOf(p), buts = butsOf(p, arch).map(({ axis, v }) => `${strength(v)}${v < 0 ? axes[axis].low : axes[axis].high} (${v < 0 ? axes[axis].lowHint : axes[axis].highHint})`);
  const drives = p.values.slice(0, CONFIG.DRIVES_SHOWN).filter((v) => lib.values?.[v]);
  const tensions = tensionsOf(state, a, p).slice(0, CONFIG.TENSIONS_SHOWN);
  return [
    `Nerve: ${nerveTier(a, p)} (${NERVE_HINTS[line]}; ${morale} right now).`,
    ...(t?.signatures ?? []),
    `${arch.name} at heart (${arch.hint})${buts.length ? `, but ${list(buts)}` : ''}.`,
    ...(drives.length ? [`Drives: ${drives.map((v, i) => `${lib.values![v].name}${i === 0 && drives.length > 1 ? ' first' : ''} (${lib.values![v].hint})`).join(', then ')}.`] : []),
    ...(tensions.length ? [`Tensions: ${tensions.map((x) => `${x.name} (${x.hint})`).join('; ')}.`] : []),
  ].join(' ');
}

/** BG-183: each pick as a table id, by its id or its name (any case); unknown ones dropped */
const ids = (table: Record<string, { id: string; name: string }>, picks: string[] = []): string[] =>
  picks.map((x) => (table[x] ? x : Object.values(table).find((e) => e.name.toLowerCase() === x.trim().toLowerCase())?.id)).filter((x): x is string => !!x);

/** PL12, PL14: points for a named Nerve line, archetypes and ranked values (from the Weaver or the creation screen), on top
 * of `base`: a line sets Nerve to ±NERVE_LINE_POINTS (steady 0); each archetype sets every trait it names to its target if
 * not already past it. A type or value may be given by id or by name; unknown ones are ignored. */
export function personalityFrom(base: Personality, pick: { nerve?: string; types?: string[]; values?: string[] }): Personality {
  const lib = getLibrary(), out: Personality = { nerve: base.nerve, traits: { ...base.traits }, values: [...base.values] };
  if (pick.nerve && pick.nerve in NERVE_LINES) out.nerve = { cautious: -1, steady: 0, daring: 1 }[pick.nerve as NerveLine] * CONFIG.NERVE_LINE_POINTS;
  for (const id of ids(lib.personalityTypes ?? {}, pick.types)) for (const [k, t] of Object.entries(lib.personalityTypes?.[id]?.target ?? {})) {
    const v = out.traits[k] ?? 0;
    if (t > 0 ? v < t : v > t) out.traits[k] = t;
  }
  const values = ids(lib.values ?? {}, pick.values);
  if (values.length) out.values = values.slice(0, CONFIG.DRIVES_SHOWN);
  return out;
}
