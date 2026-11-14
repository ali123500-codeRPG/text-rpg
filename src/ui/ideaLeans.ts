import { CONFIG } from '../config';
import { PA, VL } from '../library/tableIds';
import type { Personality } from '../types';

/** what an idea is, as a stable key: the Ideas panel orders by these and never by its wording */
export const IDEA_KINDS = ['attack', 'steady', 'yield', 'flee', 'sneak', 'vanish', 'talk', 'go', 'go_new', 'stow', 'draw',
  'pick_up', 'summon', 'look', 'search', 'perk'] as const;
export type IdeaKind = (typeof IDEA_KINDS)[number];
export const IDEA_GROUPS = ['getaway', 'fight', 'talk', 'move', 'stealth', 'use', 'perks'] as const;
export type IdeaGroup = (typeof IDEA_GROUPS)[number];

/** one pull on an idea: `on` is 'nerve', a personality axis (PA…) or a value (VL…); `w` is +1 when the high end (or holding
 * the value) draws the character to it, −1 when it pushes them away */
type Pull = { on: string; w: 1 | -1 };

/** which parts of a character draw them to an idea or away from it; a kind or group left out has no pull */
export const IDEA_PULLS: Partial<Record<IdeaKind | IdeaGroup, Pull[]>> = {
  fight: [{ on: 'nerve', w: 1 }, { on: PA.temper, w: 1 }, { on: VL.glory, w: 1 }],
  attack: [{ on: 'nerve', w: 1 }, { on: PA.temper, w: 1 }],
  steady: [{ on: PA.discipline, w: 1 }],
  yield: [{ on: PA.pride, w: -1 }, { on: 'nerve', w: -1 }, { on: VL.safety, w: 1 }],
  flee: [{ on: 'nerve', w: -1 }, { on: VL.safety, w: 1 }],
  talk: [{ on: PA.sociability, w: 1 }],
  move: [{ on: PA.curiosity, w: 1 }, { on: VL.adventure, w: 1 }],
  go_new: [{ on: PA.curiosity, w: 1 }, { on: VL.adventure, w: 1 }],
  stealth: [{ on: 'nerve', w: -1 }],
  sneak: [{ on: 'nerve', w: -1 }],
  vanish: [{ on: 'nerve', w: -1 }],
  pick_up: [{ on: VL.wealth, w: 1 }],
  look: [{ on: PA.curiosity, w: 1 }, { on: VL.knowledge, w: 1 }],
  search: [{ on: PA.curiosity, w: 1 }, { on: VL.knowledge, w: 1 }, { on: PA.discipline, w: 1 }],
};

/** how strongly the character is drawn to an idea (points, + toward, − away); under PERSONALITY_LEAN either way it is 0, so a
 * middling character keeps the plain order */
export function pullOf(key: IdeaKind | IdeaGroup, p: Personality): number {
  const sum = (IDEA_PULLS[key] ?? []).reduce((t, { on, w }) => t + w * (on === 'nerve' ? p.nerve
    : on.startsWith('VL') ? (p.values.includes(on) ? CONFIG.IDEA_VALUE_PULL : 0) : (p.traits[on] ?? 0)), 0);
  return Math.abs(sum) < CONFIG.PERSONALITY_LEAN ? 0 : sum;
}

export const AGAINST_NATURE = 'against your nature';

type Idea = { text: string; note?: string; kind?: IdeaKind };
type Group = { group: string; key: IdeaGroup; items: Idea[] };

/** Ideas shaped by who the character is: groups and the ideas in each ordered by pull (ties keep their place), and an idea
 * pulled away from by IDEA_AGAINST_NATURE or more says so. Nothing is added or taken away. A broken nerve's way out stays first. */
export function leanIdeas<G extends Group>(groups: G[], p: Personality | undefined): G[] {
  if (!p) return groups;
  const by = <T>(xs: T[], pull: (x: T) => number) => xs.map((x, i) => ({ x, i, v: pull(x) })).sort((a, b) => b.v - a.v || a.i - b.i).map((e) => e.x);
  return by(groups, (g) => (g.key === 'getaway' ? Infinity : pullOf(g.key, p))).map((g) => ({ ...g,
    items: by(g.items, (it) => (it.kind ? pullOf(it.kind, p) : 0)).map((it) => it.kind && pullOf(it.kind, p) <= -CONFIG.IDEA_AGAINST_NATURE
      ? { ...it, note: it.note ? `${it.note} · ${AGAINST_NATURE}` : AGAINST_NATURE } : it) }));
}
