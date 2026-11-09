// The general equations behind rolls, skill gain and marking, for the library viewer's Equations tab. Every number is
// read from CONFIG or the scales, and every worked example and chance is computed by the functions the rules call
// (band, naturalEdge, ladder, stackType …), so the page follows the code.
import type { Library } from '../types';
import { CONFIG } from '../config';
import { TIERS } from '../scales';
import { MARGIN_BANDS, SITUATION_BANDS, band, ladder, naturalEdge, stackType } from './index';
import { MILESTONES } from './perks';
import { skillName } from '../library/skillNames';
import { SK } from '../library/skillIds';

export type Equation = {
  name: string;
  /** the equation, in words and symbols */
  formula: string;
  /** what each term is, with its value from CONFIG where it has one */
  terms?: [string, string][];
  table?: { head: string[]; rows: string[][] };
  notes?: string[];
  /** the function (and file) that does it */
  at: string;
};
export type EquationGroup = { key: string; title: string; about: string; equations: Equation[] };

const n = (x: number) => `${+x.toFixed(2)}`;
const sg = (x: number) => `${x > 0 ? '+' : ''}${n(x)}`;
const pct = (k: number) => `${n(k)}%`;
const D100 = Array.from({ length: 100 }, (_, i) => i + 1);
const W = () => CONFIG.SKILL_WEIGHT, NEED = () => CONFIG.ROLL_NEEDED;

/** the tier level a skill roll reaches: the same steps as ruleset.roll, before tier shifts */
const rollLevel = (d: number, effective: number, mods = 0) => band(d + W() * effective + mods - NEED()) + naturalEdge(d);
/** % of d100 results at or above tier `k` for an effective skill, no modifiers */
const chanceAtLeast = (effective: number, k: Parameters<typeof TIERS.pos>[0]) => D100.filter((d) => rollLevel(d, effective) >= TIERS.pos(k)).length;
/** the band rows: the margins that reach each tier */
const bandRows = (bands: number[]) => TIERS.keys.map((k, i) => [TIERS.name(k), i === 0 ? `below ${bands[0]}` : i === bands.length ? `${bands[i - 1]} or more` : `${bands[i - 1]} to below ${bands[i]}`]);
/** improvement passes: d100 above the target, or 99–100 */
const improves = (d: number, target: number) => d > target || d >= 99;
const improveChance = (target: number, flawed: boolean) => flawed
  ? D100.reduce((s, a) => s + D100.filter((b) => improves(Math.min(a, b), target)).length, 0) / 100
  : D100.filter((d) => improves(d, target)).length;

export function equations(lib: Library): EquationGroup[] {
  const edges = [[1, 1], [2, 5], [96, 99], [100, 100]].map(([a, b]) => [a === b ? `${a}` : `${a}–${b}`, sg(naturalEdge(a))]);
  const ex = { d: 60, eff: 50, mods: 0 };
  const exMargin = ex.d + W() * ex.eff + ex.mods - NEED();
  const exLevel = rollLevel(ex.d, ex.eff);
  const quick = Object.values(lib.perks).filter((p) => p.improveRolls);
  return [
    { key: 'rolls', title: 'Rolls', about: 'Every skill roll, check, contest and the no-skill situation roll.', equations: [
      { name: 'True skill', at: 'trueSkill · src/ruleset/perks.ts',
        formula: 'true skill = raw + perk true skill',
        terms: [['raw', 'the points in the skill'], ['perk true skill', 'the 40/80/120 perks of the skill (trueSkill, +functionBoost to skills sharing its group, trueSkillTo), and perks that add to every skill of a function (fnSkill)']],
        notes: ['A dormant skill, or one in a tree the actor can\'t use, counts as 0.'] },
      { name: 'Effective skill', at: 'effectiveSkill · src/ruleset/gear.ts',
        formula: 'effective skill = best of ( true skill × share + gear ) × tier multiplier, over the skill and its stand-ins',
        terms: [['share', `1 for the skill itself; a stand-in counts at its share (flat ${n(CONFIG.SUBSTITUTE_EFFICIENCY)}, see the Stand-ins tab). A function roll counts every skill with the function at 1.`],
          ['gear', `skill effects of worn, held or carried items, also × share; a standard kit gives ${sg(CONFIG.KIT_BONUS)}`],
          ['tier multiplier', Object.entries(CONFIG.SKILL_TIER_MULT).map(([k, v]) => `${k.replace('_', ' ')} ×${v}`).join(' · ')]] },
      { name: 'Skill roll', at: 'roll · src/ruleset/index.ts',
        formula: `margin = d100 + ${n(W())} × effective skill + modifiers − ${n(NEED())}`,
        terms: [['d100', '1 to 100'], ['0.5', `CONFIG.SKILL_WEIGHT = ${n(W())}`], ['modifiers', 'all roll modifiers, each type stacked on its own (see the Stacking tab)'], [n(NEED()), `CONFIG.ROLL_NEEDED = ${n(NEED())}`]],
        notes: [`Example: d100 ${ex.d}, effective skill ${ex.eff}, no modifiers → margin ${n(exMargin)} → ${TIERS.name(TIERS.at(exLevel))}.`] },
      { name: 'Tier of a roll', at: 'band · naturalEdge · tierAt · src/ruleset/index.ts',
        formula: 'tier = band of the margin + natural edge + tier shifts',
        table: { head: ['Tier', 'Margin'], rows: bandRows(MARGIN_BANDS) },
        terms: [['natural edge', edges.map(([d, v]) => `d100 ${d}: ${v}`).join(' · ')], ['tier shifts', 'whole tiers from cover, Hidden Strike, marks, falling short on gear, Curiouser and Curiouser']],
        notes: ['A tier pushed past either end keeps the end name with one + or − per step (Critical Success+).'] },
      { name: 'Chance by effective skill', at: 'computed with band and naturalEdge',
        formula: '% of d100 results that reach each tier, no modifiers',
        table: { head: ['Effective skill', 'Near Miss or better', 'Success or better', 'Great Success or better', 'Critical Success'],
          rows: [0, 20, 40, 50, 60, 80, 100].map((s) => [String(s), pct(chanceAtLeast(s, 'near_miss')), pct(chanceAtLeast(s, 'success')), pct(chanceAtLeast(s, 'great_success')), pct(chanceAtLeast(s, 'critical_success'))]) } },
      { name: 'Check (no roll)', at: 'check · src/ruleset/index.ts',
        formula: 'passes when effective skill + modifiers ≥ the scene\'s difficulty',
        terms: [['difficulty', Object.entries(CONFIG.DIFFICULTY).map(([k, v]) => `${k} ${v}`).join(' · ')]],
        notes: ['Modifiers add in full here, with no stacking.'] },
      { name: 'Contest', at: 'contested · src/ruleset/index.ts',
        formula: 'gap = tier of B − tier of A; the side with the higher tier wins, equal tiers tie',
        notes: ['Both sides make a skill roll against each other. Aim modifiers are dropped.'] },
      { name: 'Situation roll (no skill)', at: 'situation · src/ruleset/index.ts',
        formula: `margin = d100 + ${CONFIG.SITUATION_BASE} + modifiers − 100`,
        terms: [[String(CONFIG.SITUATION_BASE), 'CONFIG.SITUATION_BASE'], ['modifiers', 'perk, gear and status situation bonuses, stacked by type']],
        table: { head: ['Tier', 'Margin'], rows: bandRows(SITUATION_BANDS) },
        notes: ['The natural edge applies here too. There are no tier shifts.'] },
      { name: 'Stacking within a type', at: 'stackType · modTotal · src/ruleset/index.ts',
        formula: `type total = biggest + ${n(CONFIG.STACK_RATIO)} × next + ${n(CONFIG.STACK_RATIO ** 2)} × next …, bonuses and penalties apart; types add in full`,
        notes: [`Example: three +10 of one type → ${n(stackType([10, 10, 10]))}.`] },
    ] },
    { key: 'attacks', title: 'Attacks', about: 'From the attack roll to the damage a hit does.', equations: [
      { name: 'Attack and defense', at: 'attack · src/ruleset/index.ts',
        formula: 'attack roll (skill roll); below Near Miss it misses. Otherwise the defender makes a dodge or block roll',
        terms: [['attack modifiers', 'weapon class hit + mode hitAdj, range, aim, light, perks'], ['defense modifiers', 'outnumbered, unaware, dodge vs missile, light, perks']] },
      { name: 'Gap', at: 'attack · src/ruleset/index.ts',
        formula: 'gap = defense tier − attack tier + gap shifts, kept between −5 and +5',
        terms: [['gap shifts', `heavy weapon vs block ${sg(CONFIG.HEAVY_VS_BLOCK_GAP)}, cover (ranged), Slip the Blow +1 on a tie`]] },
      { name: 'Damage multiplier', at: 'ladder · CONFIG.GAP_LADDER',
        formula: 'multiplier = GAP_LADDER[dodge or block][gap]',
        table: { head: ['Gap', 'Dodge', 'Block'], rows: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map((g) => [sg(g), `×${n(ladder('dodge', g))}`, `×${n(ladder('block', g))}`]) },
        notes: ['×0 is a clean dodge, and a dodge at +1 is a graze. A block at +1 or better is blocked; a shield also blocks at 0 and takes the hit itself.'] },
      { name: 'Damage', at: 'attack · src/ruleset/index.ts',
        formula: 'damage = (class damage + mode damageAdj) × multiplier × perk damage multipliers, then armor: (damage − max(0, reduction − pierce)) × armor multiplier',
        table: { head: ['Class', 'Damage', 'Hit'], rows: [...Object.entries(CONFIG.WEAPON_CLASSES), ['unarmed (no class)', CONFIG.UNARMED_PROFILE] as const].map(([k, c]) => [k, String(c.damage), sg(c.hit)]) },
        notes: ['Worn armor and natural armor each apply if they cover the part hit. Damage never goes below 0, and fractions stay.'] },
    ] },
    { key: 'gain', title: 'Skill gain', about: 'How a marked skill improves.', equations: [
      { name: 'When skills roll to improve', at: 'improveMarked · src/ruleset/improve.ts (called in src/engine/resolve.ts)',
        formula: 'at the end of each engagement, or when the scene breaks, every marked skill makes its improvement roll(s); then all marks clear',
        notes: ['Only the player has marks for now. A failed improvement roll shows nothing.'] },
      { name: 'Burden', at: 'improveMarked · src/ruleset/improve.ts',
        formula: `burden = max(0, floor((sum of raw of untagged skills − potential) ÷ ${CONFIG.K}))`,
        terms: [['potential', `CONFIG.POTENTIAL = ${CONFIG.POTENTIAL}, plus any adjustments`], [String(CONFIG.K), 'CONFIG.K']] },
      { name: 'Improvement roll', at: 'improveMarked · src/ruleset/improve.ts',
        formula: 'target = raw + burden (a tagged skill: raw). Improves if d100 > target, or d100 is 99–100',
        terms: [['flawed skill', 'rolls two d100 and keeps the lower'], ['gain', '+1d5 raw (1 to 5)'],
          ['rolls', `1 per marked skill${quick.length ? `; ${quick.map((p) => `${p.name}: ${p.improveRolls!.rolls} rolls while raw is below ${p.improveRolls!.below}`).join('; ')}` : ''}`]],
        table: { head: ['Target', 'Chance', 'Flawed'], rows: [0, 20, 40, 60, 80, 95].map((t) => [String(t), pct(improveChance(t, false)), pct(improveChance(t, true))]) },
        notes: [`Crossing a milestone (${MILESTONES.join(', ')}) on true skill is logged with the gain.`] },
    ] },
    { key: 'marking', title: 'Marking', about: 'What marks a skill so it can improve.', equations: [
      { name: 'Mark window', at: 'markIfClose · src/ruleset/improve.ts',
        formula: `a use marks the skill when |opposition − raw| ≤ ${CONFIG.MARK_WINDOW} or |opposition − true skill| ≤ ${CONFIG.MARK_WINDOW}`,
        terms: [[String(CONFIG.MARK_WINDOW), 'CONFIG.MARK_WINDOW']],
        notes: ['Only the player marks. A skill in a tree the player can\'t use is never marked. A skill holds one mark at most until it rolls.'] },
      { name: 'Opposition', at: 'markUse · src/ruleset/improve.ts',
        formula: 'check → its difficulty · contest → the other side\'s true skill in the skill it rolled · attack → each side against the other\'s true skill',
        terms: [['difficulty', Object.entries(CONFIG.DIFFICULTY).map(([k, v]) => `${k} ${v}`).join(' · ')]],
        notes: ['When a stand-in makes the roll, the stand-in and the skill the action asked for each mark, each against its own window.'] },
      { name: `${skillName(SK.endurance)}`, at: 'markEndurance · src/ruleset/improve.ts',
        formula: `a single hit that costs ${CONFIG.ENDURANCE_MARK_PCT}% health or more marks ${skillName(SK.endurance)}`,
        terms: [[`${CONFIG.ENDURANCE_MARK_PCT}%`, 'CONFIG.ENDURANCE_MARK_PCT']] },
      { name: 'Armor skill', at: 'markArmor · src/ruleset/improve.ts',
        formula: 'a hit on a part your worn armor covers marks the armor\'s skill when the attacker\'s true skill, or the armor\'s requirement, is within the window of your raw or true armor skill',
        notes: ['A hit on a shield doesn\'t count.'] },
    ] },
  ];
}
