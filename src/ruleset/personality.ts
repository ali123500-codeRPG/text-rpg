// Nerve and personality (PL1–PL19). Points are stored; lines, tiers, words and named types are read from them here.
// Nerve (risk) picks a line by its lean and a tier by raw Resolve; six personality axes and one or two values describe how
// the character behaves. Perks, the current class and achievements add points while held (PL15, PL16). The words go to
// the agents that play NPCs (CHARACTER) and to the player's sheet; nothing here changes a roll (numeric effects: D-205).
import type { Actor, Personality, PersonalityAdd, PersonalityTypeDef } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { SK } from '../library/skillIds';
import { NERVE_LINES, type NerveLine, type Scale } from '../scales';
import { chainRewards, currentAchievements } from './achRewards';

const NONE: Personality = { nerve: 0, traits: {}, values: [] };

/** the actor's points: its own, plus what its perks, current class and current achievements add (chains by reference) */
export function personalityOf(a: Actor): Personality {
  const base = a.core.personality ?? NONE;
  const out: Personality = { nerve: base.nerve, traits: { ...base.traits }, values: [...base.values] };
  const add = (x?: PersonalityAdd) => {
    for (const [k, v] of Object.entries(x ?? {})) if (k === 'nerve') out.nerve += v; else out.traits[k] = (out.traits[k] ?? 0) + v;
  };
  const lib = getLibrary();
  for (const p of a.core.perks) add(lib.perks[p.perkId]?.personality);
  for (const c of a.core.classes) if (c.state === 'current') add(lib.classes[c.classId]?.personality);
  for (const x of currentAchievements(a)) for (const e of chainRewards(x.d)) if (e.field === 'personality') add(e.from.personality);
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

/** PL9: the trait words, strongest first; a trait under PERSONALITY_LEAN from 0 is left out */
export function traitWords(p: Personality): string[] {
  const axes = getLibrary().personalityAxes ?? {};
  return Object.entries(p.traits).filter(([k, v]) => axes[k] && Math.abs(v) >= CONFIG.PERSONALITY_LEAN)
    .sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))
    .map(([k, v]) => {
      const w = [...CONFIG.TRAIT_WORDS].reverse().find(([from]) => Math.abs(v) >= from)?.[1] ?? '';
      return w + (v < 0 ? axes[k].low : axes[k].high);
    });
}

/** PL10: the named types the actor meets, strongest first (by the smallest margin past a condition), at most PERSONALITY_TYPES_SHOWN */
export function personalityTypes(a: Actor, p = personalityOf(a)): PersonalityTypeDef[] {
  const value = (k: string) => (k === 'nerve' ? p.nerve : k === SK.resolve ? rawResolve(a) : p.traits[k] ?? 0);
  const margin = (t: PersonalityTypeDef) => Math.min(...Object.entries(t.when).map(([k, c]) =>
    Math.min(c.min !== undefined ? value(k) - c.min : Infinity, c.max !== undefined ? c.max - value(k) : Infinity)));
  return Object.values(getLibrary().personalityTypes ?? {}).map((t) => ({ t, m: margin(t) })).filter((x) => x.m >= 0)
    .sort((x, y) => y.m - x.m).slice(0, CONFIG.PERSONALITY_TYPES_SHOWN).map((x) => x.t);
}

/** PL4, PL9: the line the agent reads, e.g. "Nerve: Timid (Calm right now). Honest, a bit talkative. Values: duty.
 * Type: Mature (thinks before acting…)." The morale level is the mood; the tier never moves with it. */
export function personalityText(a: Actor, morale: string): string {
  const p = personalityOf(a), lib = getLibrary();
  const words = traitWords(p), values = p.values.map((v) => lib.values?.[v]?.name).filter(Boolean), types = personalityTypes(a, p);
  return [
    `Nerve: ${nerveTier(a, p)} (${morale} right now).`,
    ...(words.length ? [`${words.join(', ').replace(/^./, (c) => c.toUpperCase())}.`] : []),
    ...(values.length ? [`Values: ${values.join(', ')}.`] : []),
    ...types.map((t) => `Type: ${t.name} (${t.hint}).`),
  ].join(' ');
}

/** PL12, PL14: points for a named Nerve line, named types and values (from the Weaver or the creation screen), on top of
 * `base`: a line sets Nerve to ±NERVE_LINE_POINTS (steady 0); each type sets every trait it names to its threshold if not
 * already past it. Unknown names are ignored. */
export function personalityFrom(base: Personality, pick: { nerve?: string; types?: string[]; values?: string[] }): Personality {
  const lib = getLibrary(), out: Personality = { nerve: base.nerve, traits: { ...base.traits }, values: [...base.values] };
  if (pick.nerve && pick.nerve in NERVE_LINES) out.nerve = { cautious: -1, steady: 0, daring: 1 }[pick.nerve as NerveLine] * CONFIG.NERVE_LINE_POINTS;
  for (const id of pick.types ?? []) for (const [k, c] of Object.entries(lib.personalityTypes?.[id]?.when ?? {})) {
    if (!lib.personalityAxes?.[k]) continue; // Resolve and Nerve conditions are not set by a pick
    const v = out.traits[k] ?? 0;
    if (c.min !== undefined && v < c.min) out.traits[k] = c.min;
    if (c.max !== undefined && v > c.max) out.traits[k] = c.max;
  }
  const values = (pick.values ?? []).filter((v) => lib.values?.[v]);
  if (values.length) out.values = values.slice(0, 2);
  return out;
}
