// HU3: the colour each kind of thing takes in a hover tip (tint in kit.ts), the same colour it has on the screen. Each
// returns a colour token from :root, without the dashes; undefined leaves the words plain.
import { getLibrary } from '../library';
import { HEALTH_LEVELS, PART_STATES } from '../scales';
import type { HealthLevel, PartState, TierRoll } from '../types';
import { SHOWN_LEVELS } from '../ruleset/body';
import { tierAtLeast } from '../ruleset';
import { TREE_VIEW } from './creation';
import { perkSeries } from './perks';

/** a skill: its tree's colour, as on the sheet */
export const skillTone = (skillId: string): string | undefined => TREE_VIEW.find((t) => getLibrary().trees[t.id]?.skills.includes(skillId))?.c;
/** a health level: its place on the health track (lv0 Healthy … lv7 gone) */
export const healthTone = (l: HealthLevel | string): string => `lv${Math.max(0, SHOWN_LEVELS().map(([x]) => x).indexOf((HEALTH_LEVELS.keyOf(l) ?? l) as HealthLevel))}`;
/** a body part's state: its colour on the body figure */
export const partTone = (st: PartState | string): string => ['lv0', 'lv2', 'lv5', 'lv7'][PART_STATES.pos((PART_STATES.keyOf(st) ?? st) as PartState)] ?? 'lv7';
/** a roll result: its chip's colour */
export const tierTone = (t: TierRoll): string => (tierAtLeast(t, 'great_success') ? 'ok' : tierAtLeast(t, 'success') ? 'accent' : tierAtLeast(t, 'near_miss') ? 'warn' : 'danger');
/** a perk: its series colour, by the milestone it is taken at */
export const perkTone = (milestone: number): string => `perk-${perkSeries(milestone)}`;
/** a perk by its id: its series colour; a perk off the skill ladders stays plain */
export const perkIdTone = (perkId: string): string | undefined => { const at = getLibrary().perks[perkId]?.ladder?.milestone; return at ? perkTone(at) : undefined; };
/** a time of day: its colour on the header's icon */
export const todTone = (key: string): string => ({ dawn: 'c4', morning: 'scenario-mark', afternoon: 'scenario-mark', dusk: 'c7' } as Record<string, string>)[key] ?? 'accent';
/** a class: its tier's hue, as on the class icon (accent for tiers 0-2, perk violet for 3-4, gold for 5) */
export const classTone = (tier: string | undefined): string => { const n = Number(String(tier ?? '').replace(/\D/g, '')) || 0; return n >= 5 ? 'scenario-mark' : n >= 3 ? 'perk-40' : 'accent'; };
/** the rest, by meaning */
export const TONE = {
  tie: 'tie', // organizations, titles, who holds a place
  morale: 'c5', stamina: 'c7', essence: 'essence', achievement: 'scenario-mark', quest: 'scenario-mark', scar: 'danger',
  good: 'ok', caution: 'warn', harm: 'danger', // gains and ready; costs and cautions; harm and can't
  gain: 'ok', loss: 'danger', // HU4: a number that changes something, by its direction
  inReach: 'ok', outOfReach: 'warn', // HU5: whether your weapon reaches
  free: 'ok', cost: 'warn', // HU6: what an action costs: free, or your turn or move; durations stay plain
} as const;
/** HU4: a change's colour by its direction: a gain green, a loss or penalty red */
export const changeTone = (good: boolean): string => (good ? TONE.gain : TONE.loss);
