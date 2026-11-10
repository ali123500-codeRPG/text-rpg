// The general equations behind rolls, skill gain and marking, for the library viewer's Equations tab. Every number is
// read from CONFIG or the scales, and every worked example and chance is computed by the functions the rules call
// (band, naturalEdge, ladder, stackType …), so the page follows the code.
import type { Library } from '../types';
import { CONFIG } from '../config';
import { CLASS_TIERS, MORALE_LEVELS, TIERS, type MoraleLevel } from '../scales';
import { tierCostMult } from './morale';
import { MARGIN_BANDS, SITUATION_BANDS, band, ladder, naturalEdge, stackType } from './index';
import { MILESTONES } from './perks';
import { learningWindow } from './improve';
import { tierMult } from './gear';
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

/** the effective skill worked example; tests/unit/equations.test.ts checks it against effectiveSkill */
export const EFF_EX = { skill: SK.melee_medium, standIn: SK.melee_light, trueSkill: 60, gear: 20 };
export const effExample = () => (EFF_EX.trueSkill + EFF_EX.gear) * CONFIG.SUBSTITUTE_EFFICIENCY * tierMult(EFF_EX.standIn);

export function equations(lib: Library): EquationGroup[] {
  const edges = [[1, 1], [2, 5], [96, 99], [100, 100]].map(([a, b]) => [a === b ? `${a}` : `${a}–${b}`, sg(naturalEdge(a))]);
  const ex = { d: 60, eff: 50, mods: 0 };
  const exMargin = ex.d + W() * ex.eff + ex.mods - NEED();
  const exLevel = rollLevel(ex.d, ex.eff);
  const quick = Object.values(lib.perks).filter((p) => p.improveRolls);
  return [
    { key: 'rolls', title: 'Rolls', about: 'Every skill roll, check, contest and the no-skill situation roll.', equations: [
      { name: 'True skill', at: 'trueSkill · src/ruleset/perks.ts',
        formula: 'true skill = raw + perk true skill + achievement true skill',
        terms: [['raw', 'the points in the skill'], ['perk true skill', 'the 40/80/120 perks of the skill (trueSkill, +functionBoost to skills sharing its group, trueSkillTo), and perks that add to every skill of a function (fnSkill)'], ['achievement true skill', 'skillAdd on your current achievements, lower levels of the chain included (achievementSkill · src/ruleset/achRewards.ts)']],
        notes: ['A dormant skill, or one in a tree the actor can\'t use, counts as 0.'] },
      { name: 'Effective skill', at: 'effectiveSkill · src/ruleset/gear.ts',
        formula: 'effective skill = best of ( true skill + gear ) × share × tier multiplier, over the skill and its stand-ins; + augments',
        terms: [['share', `1 for the skill itself; a stand-in counts at its share (flat ${n(CONFIG.SUBSTITUTE_EFFICIENCY)}, see the Stand-ins tab; perks and achievements such as Master of the Moment add to it). A function roll counts every skill with the function at 1.`],
          ['gear', `skill effects of worn, held or carried items, also × share; a standard kit gives EQUIP_FACTOR (${n(CONFIG.EQUIP_FACTOR)}) × its need, shared once per roll (the best piece)`],
          ['augments', 'each skill that augments this one (SkillDef.augments) adds its true skill × its share (default 1) × its tier, on every roll of this skill or only the roll kinds it lists; its tree must be open (Shrewd Dealing augments Barter). A perk can give one too (PerkDef.augments: Grit, Endurance × ${n(CONFIG.GRIT_SHARE)} to Resolve)'],
          ['tier multiplier', Object.entries(CONFIG.SKILL_TIER_MULT).map(([k, v]) => `${k.replace('_', ' ')} ×${v}`).join(' · ')]],
        notes: [`Example: ${skillName(EFF_EX.standIn)} ${EFF_EX.trueSkill} with +${EFF_EX.gear} ${skillName(EFF_EX.standIn)} gear, standing in for ${skillName(EFF_EX.skill)} 0 → (${EFF_EX.trueSkill} + ${EFF_EX.gear}) × ${n(CONFIG.SUBSTITUTE_EFFICIENCY)} × ${n(tierMult(EFF_EX.standIn))} = ${n(effExample())}. Gear for the named skill (the held weapon's bonus) does not pass to a stand-in.`] },
      { name: 'Skill roll', at: 'roll · src/ruleset/index.ts',
        formula: `margin = d100 + ${n(W())} × effective skill + modifiers − ${n(NEED())}`,
        terms: [['d100', '1 to 100'], ['0.5', `CONFIG.SKILL_WEIGHT = ${n(W())}`], ['modifiers', 'all roll modifiers, each type stacked on its own (see the Stacking tab)'], [n(NEED()), `CONFIG.ROLL_NEEDED = ${n(NEED())}`]],
        notes: [`Example: d100 ${ex.d}, effective skill ${ex.eff}, no modifiers → margin ${n(exMargin)} → ${TIERS.name(TIERS.at(exLevel))}.`] },
      { name: 'Tier of a roll', at: 'band · naturalEdge · tierAt · src/ruleset/index.ts',
        formula: 'tier = band of the margin + natural edge + tier shifts',
        table: { head: ['Tier', 'Margin'], rows: bandRows(MARGIN_BANDS) },
        terms: [['natural edge', edges.map(([d, v]) => `d100 ${d}: ${v}`).join(' · ')], ['tier shifts', 'whole tiers from cover, Hidden Strike, achievements such as The Unseen Death on an unaware target, marks, falling short on gear, Curiouser and Curiouser']],
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
        formula: 'gap = tier of B − tier of A; the side with the higher tier wins, equal tiers tie' },
      { name: 'Speech contest', at: 'resolveSpeech · pushContest · applySpeech · overhearLie · src/engine/speech.ts',
        formula: `the speaker rolls the speech skill (Lying for a lie) − ${CONFIG.REPEAT_TRY} × earlier tries; the listener rolls the same skill back (Insight against a lie), whoever speaks`,
        terms: [['Shaken', `the listener lost to intimidation: −${CONFIG.SHAKEN_PER_TIER} × tiers lost by, on every roll against the speaker until its engagement ends`],
          ['Swayed', `the listener lost to persuasion: −${CONFIG.SWAYED_PER_TIER} × tiers lost by, on every roll against the speaker until its engagement ends`],
          ['a lie', 'a listener whose Insight beats the Lying roll sees through it'], ['Overheard', 'an owner who hears a lie told to someone else answers the same Lying roll with Insight too'], ['earlier tries', 'tries of the same kind (persuade, deceive, intimidate, barter) at the same listener this engagement; plain talk never counts'], ['Easy Speaker', 'the listener answers one tier higher']],
        notes: ['NPCs roll speech at the player only with persuade, deceive, intimidate or barter; their plain talk does not roll. A second Shaken or Swayed from the same speaker keeps the bigger one.'] },
      { name: 'Morale roll', at: 'moraleRoll · src/ruleset/index.ts; payFear · src/engine/morale.ts; fear · src/engine/resolve.ts',
        formula: `margin = d100 + ${n(W())} × Resolve + modifiers − ${n(NEED())}; morale lost = the fear's cost × the tier's multiplier`,
        terms: [['max morale', `${CONFIG.MORALE_BASE} + ${CONFIG.MORALE_PER_RESOLVE} × Resolve; an NPC template's starting Resolve comes from its personality: ${Object.entries(CONFIG.PERSONALITY_RESOLVE).map(([k, v]) => `${k} ${v}`).join(', ')}`],
          ['tier multiplier', `${TIERS.keys.map((k) => `${TIERS.name(k)} ×${CONFIG.MORALE_TIER_MULT[k]}`).join(' · ')}; each step below Critical Failure +${CONFIG.MORALE_BEYOND_CF}`],
          ['levels', CONFIG.MORALE_TRACK.map(([k, max, v]) => `${MORALE_LEVELS.name(k as MoraleLevel)}${max === Infinity ? ' 100 %+' : ` ≤${Math.round(max)} %`}${v ? ` ${v}` : ''}`).join(' · ')],
          ['modifiers', 'wounds: the health level and the morale level (fear feeds on itself); the player\'s renown on every morale roll of a foe fighting the player; the player\'s rally on allies fighting beside the player']],
        table: { head: ['Resolve', 'Max morale', 'Share of a fear paid'], rows: [30, 50, 70, 90].map((m) => [String(m), String(CONFIG.MORALE_BASE + CONFIG.MORALE_PER_RESOLVE * m),
          `×${(D100.reduce((t, d) => t + tierCostMult(rollLevel(d, m)), 0) / 100).toFixed(2)}`]) },
        notes: ['Fears are the library fears table: flat costs, a negative cost restores. Rolled fears count only while engaged. Reaching Broken breaks an NPC (it flees), or makes it surrender when the roll that broke it was a Critical Failure or worse. The player at Broken cannot attack.',
          'Shares in the table are calm and unhurt, with no modifiers.'] },
      { name: 'Situation roll (no skill)', at: 'situation · src/ruleset/index.ts',
        formula: `margin = d100 ${CONFIG.SITUATION_BASE - 100 < 0 ? '−' : '+'} ${Math.abs(CONFIG.SITUATION_BASE - 100)} + modifiers`,
        terms: [[`${CONFIG.SITUATION_BASE - 100 < 0 ? '−' : '+'}${Math.abs(CONFIG.SITUATION_BASE - 100)}`, `situation base ${CONFIG.SITUATION_BASE} (CONFIG.SITUATION_BASE) minus 100`], ['modifiers', 'perk, gear, achievement and status situation bonuses, stacked by type']],
        table: { head: ['Tier', 'Margin'], rows: bandRows(SITUATION_BANDS) },
        notes: ['The natural edge applies here too. There are no tier shifts.'] },
      { name: 'Stacking within a type', at: 'stackType · modTotal · src/ruleset/index.ts',
        formula: `type total = biggest + ${n(CONFIG.STACK_RATIO)} × next + ${n(CONFIG.STACK_RATIO ** 2)} × next …, bonuses and penalties apart; types add in full`,
        notes: [`Example: three +10 of one type → ${n(stackType([10, 10, 10]))}.`] },
    ] },
    { key: 'attacks', title: 'Attacks', about: 'From the attack roll to the damage a hit does.', equations: [
      { name: 'Initiative', at: 'initiative · initiativeBonus · src/ruleset/index.ts; initiativeOrder · src/engine/resolve.ts',
        formula: `initiative = d100 + ${n(CONFIG.SKILL_WEIGHT)} × best Initiative-function skill + initiative roll modifiers; ${CONFIG.INIT_UNAWARE} (INIT_UNAWARE) instead for an actor unaware of anyone attacking it this turn (not with Never Surprised when the attack's noise reaches it); higher acts first`,
        terms: [['Initiative-function skill', 'the best effective skill with the Initiative function, at full value (0 when none)'], ['initiative roll modifiers', "gear and other effects with rollMod roll 'initiative'"]],
        notes: ['No skill has the Initiative function yet, so today it is a plain d100. Dodge is in the Speed group but has no Initiative function, so it does not count. Ties go to the seeded random roll.'] },
      { name: 'Attack and defense', at: 'attack · src/ruleset/index.ts',
        formula: 'attack roll (skill roll); below Near Miss it misses. Otherwise the defender makes a dodge, block or parry roll',
        terms: [['attack modifiers', 'weapon class hit + mode hitAdj, range, aim, light, perks'], ['defense modifiers', 'outnumbered, unaware (not with Never Surprised when the attack\'s noise reaches the defender), dodge vs missile, light, perks'], ['which defense', 'the standing defense, if it works: block needs a held shield, parry a held melee weapon (or Open-Hand Guard) and never stops a ranged attack; otherwise the usable one with the highest effective skill']] },
      { name: 'Throw (combined roll)', at: 'withRow · blendedSkill · src/ruleset/gear.ts',
        formula: `throw skill = ${n(CONFIG.THROW_BLEND.weapon)} × the weapon's own effective skill + ${n(CONFIG.THROW_BLEND.ranged)} × the effective ranged skill of the same class; reach = the weapon's own reach + ${CONFIG.THROWN_REACH_BONUS} (THROWN_REACH_BONUS) + perks' throwReach`,
        terms: [["weapon's own skill", "the skill its gear class asks for (a dagger: Light weapons; an improvised weapon: Improvisation)"], ['ranged skill', 'Light, Medium or Heavy ranged, by the throw mode\'s class'], ['shares', 'CONFIG.THROW_BLEND, set on the Throw attack mode row']],
        notes: ['Each part is its own effective skill: it takes its own stand-ins and only the gear that boosts it (the weapon\'s kit bonus goes to its own skill). Both skills that rolled can learn. The thrown item lands on the ground of the target\'s zone, hit or miss.'] },
      { name: 'Gap', at: 'attack · src/ruleset/index.ts',
        formula: 'gap = defense tier − attack tier + gap shifts, kept between −5 and +5',
        terms: [['gap shifts', `heavy weapon vs block or parry ${sg(CONFIG.HEAVY_VS_BLOCK_GAP)} (not against a parry with Against the Grain), cover (ranged), Slip the Blow +1 on a tie`]] },
      { name: 'Damage multiplier', at: 'ladder · CONFIG.GAP_LADDER',
        formula: 'multiplier = GAP_LADDER[dodge, block or parry][gap]',
        table: { head: ['Gap', 'Dodge', 'Block', 'Parry'], rows: [-10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map((g) => [sg(g), `×${n(ladder('dodge', g))}`, `×${n(ladder('block', g))}`, `×${n(ladder('parry', g))}`]) },
        notes: ['Gaps past −10 or +5 use the end row.', '×0 is a clean dodge, and a dodge at +1 is a graze. A block at +1 or better is blocked; a shield also blocks at 0 and takes the hit itself.',
          `A parry at +1 or +2 is blocked, and ×0 is parried. A parry at +${CONFIG.PARRY_STRIKE_GAP} (PARRY_STRIKE_GAP) or better also gives the defender one free melee attack back with the parrying weapon, once per turn; Answer the Blow lowers that by ${CONFIG.ANSWER_THE_BLOW_DROP} with a medium weapon.`] },
      { name: 'Damage', at: 'attack · src/ruleset/index.ts',
        formula: 'damage = (class damage + mode damageAdj) × multiplier × perk damage multipliers, then armor: (damage − max(0, reduction − pierce)) × armor multiplier',
        table: { head: ['Class', 'Damage', 'Hit'], rows: [...Object.entries(CONFIG.WEAPON_CLASSES), ['unarmed (no class)', CONFIG.UNARMED_PROFILE] as const].map(([k, c]) => [k, String(c.damage), sg(c.hit)]) },
        notes: ['Worn armor and natural armor each apply if they cover the part hit. Damage never goes below 0, and fractions stay.',
          `A minted weapon that boosts damage adds QUALITY_DAMAGE_FACTOR (${n(CONFIG.QUALITY_DAMAGE_FACTOR)}) × need × quality × its class factor (${Object.entries(CONFIG.DAMAGE_CLASS_FACTOR).map(([k, v]) => `${k} ${n(v)}`).join(', ')}) × its tree factor (${Object.entries(CONFIG.DAMAGE_TREE_FACTOR).map(([k, v]) => `${k} ${n(v)}`).join(', ')}) to damageAdj.`,
          `A worn armor's reduction is ARMOR_FACTOR (${n(CONFIG.ARMOR_FACTOR)}) × its need; its multiplier comes from its weight. A minted piece adds ARMOR_QUALITY_FACTOR (${n(CONFIG.ARMOR_QUALITY_FACTOR)}) × need × quality, rounded.`,
          `A shield's pool is POOL_BASE (${n(CONFIG.POOL_BASE)}) + POOL_FACTOR (${n(CONFIG.POOL_FACTOR)}) × its need; a minted shield adds POOL_QUALITY_FACTOR (${n(CONFIG.POOL_QUALITY_FACTOR)}) × need × quality, rounded. A blow on a shield drains its pool by the damage (×2 with Shield Breaker; ×${n(CONFIG.IRON_RIM_MULT)} with Iron Rim).`] },
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
    { key: 'levels', title: 'Levels', about: 'How XP turns into levels.', equations: [
      { name: 'XP to the next level', at: 'xpToNext · spendXp · src/engine/xp.ts',
        formula: `XP to go from level n to n + 1 = ${CONFIG.LEVEL_XP} × n`,
        terms: [[String(CONFIG.LEVEL_XP), 'CONFIG.LEVEL_XP'], ['n', 'character level: the sum of every class\'s level, plus bonus levels, less the free and bonus levels taken (at least 1); free and bonus levels never make the next level dearer']],
        table: { head: ['From level', 'To level', 'XP needed', 'Total from level 1'], rows: [1, 2, 3, 4, 5, 10, 15, 19].map((l) => [String(l), String(l + 1), String(CONFIG.LEVEL_XP * l), String(CONFIG.LEVEL_XP * l * (l + 1) / 2)]) },
        notes: [`The XP is spent and the level goes into the current class, or the class picked for the next level. The player starts at level ${CONFIG.START_LEVEL}.`,
          'One gain can take several levels in a row. When the class has no room left (at its top level), the XP stays banked until a class with room is picked.',
          'Free levels (from achievements or perks with free levels) are taken first and cost no XP; they bank the same way when no class has room.'] },
      { name: 'Class top level', at: 'classMaxLevel · src/library/spawn.ts',
        formula: `top level = min(${CONFIG.CLASS_MAX_LEVEL}, ${CONFIG.CLASS_TIER0_MAX_LEVEL} + ${CONFIG.CLASS_LEVELS_PER_TIER} × class tier)`,
        terms: [[String(CONFIG.CLASS_TIER0_MAX_LEVEL), 'CONFIG.CLASS_TIER0_MAX_LEVEL'], [String(CONFIG.CLASS_LEVELS_PER_TIER), 'CONFIG.CLASS_LEVELS_PER_TIER'], [String(CONFIG.CLASS_MAX_LEVEL), 'CONFIG.CLASS_MAX_LEVEL']],
        table: { head: ['Class tier', 'Top level'], rows: CLASS_TIERS.keys.map((k) => [CLASS_TIERS.name(k), String(Math.min(CONFIG.CLASS_MAX_LEVEL, CONFIG.CLASS_TIER0_MAX_LEVEL + CONFIG.CLASS_LEVELS_PER_TIER * CLASS_TIERS.pos(k)))]) },
        notes: ['Reaching the top level grants the class capstone.'] },
      { name: 'What a level gives', at: 'levelUp · src/engine/xp.ts',
        formula: 'each level: +1 level in the class, plus that class\'s perks for the level; on every even character level, +1 perk point',
        notes: ['Levels give no skill points: skills grow only through improvement rolls.'] },
    ] },
    { key: 'marking', title: 'Marking', about: 'What marks a skill so it can improve.', equations: [
      { name: 'Learning window', at: 'markIfClose · src/ruleset/improve.ts',
        formula: `a use marks the skill when raw − ${CONFIG.MARK_WINDOW} ≤ opposition ≤ max(raw, true skill) + ${CONFIG.MARK_WINDOW}`,
        terms: [[String(CONFIG.MARK_WINDOW), 'CONFIG.MARK_WINDOW'], ['raw', 'a skill not on the sheet counts as raw 0, and joins the sheet with its first gain']],
        table: { head: ['Raw', 'True skill', 'Opposition that teaches'], rows: [[0, 0], [20, 20], [30, 45], [50, 60]].map(([r, t]) => [String(r), String(t), learningWindow(r, t).join(' to ')]) },
        notes: ['Only the player marks. A skill in a tree the player can\'t use is never marked. A skill holds one mark at most until it rolls.'] },
      { name: 'Close calls', at: 'markUse · src/ruleset/improve.ts',
        formula: 'a contest or a defended attack whose tier gap is exactly 0 marks both sides\' skills, inside the window or not',
        notes: ['Every Fall a Lesson (A Nobody, class level 20): losing a contest or a defended attack by exactly one tier step marks the owner\'s skill too, inside the window or not.'] },
      { name: 'Opposition', at: 'markUse · src/ruleset/improve.ts',
        formula: 'check → its difficulty · contest → the other side\'s true skill in the skill it rolled · attack → each side against the other\'s true skill',
        terms: [['difficulty', Object.entries(CONFIG.DIFFICULTY).map(([k, v]) => `${k} ${v}`).join(' · ')]],
        notes: ['When a stand-in makes the roll, the stand-in and the skill the action asked for each mark, each against its own window.',
          'Stealth and ambush contests mark the watcher\'s sight or hearing skill (the one that rolled) as well as the sneaker\'s skill.'] },
      { name: 'Augmenting skills', at: 'markAugments · src/ruleset/improve.ts',
        formula: `the roll gets one window from its sums: low = rolled skill raw + Σ augment raw × share × tier − ${CONFIG.MARK_WINDOW}; high = rolled skill max(raw, true) + Σ augment max(raw, true) × share × tier + ${CONFIG.MARK_WINDOW}. Every augment that added to the roll marks when the opposition is inside it, or on a close call`,
        terms: [['opposition', 'a check\'s difficulty, or the other side\'s true skill plus what its own augments added to its roll']],
        notes: ['The rolled skill keeps its own window and opposition. An augment not on the sheet counts as raw 0 and can learn once its tree opens. An augment limited to roll kinds learns only from rolls of those kinds.'] },
      { name: `${skillName(SK.endurance)}`, at: 'markEndurance · src/ruleset/improve.ts',
        formula: `a single hit that costs ${CONFIG.ENDURANCE_MARK_PCT}% health or more marks ${skillName(SK.endurance)}`,
        terms: [[`${CONFIG.ENDURANCE_MARK_PCT}%`, 'CONFIG.ENDURANCE_MARK_PCT']] },
      { name: 'Armor skill', at: 'markArmor · src/ruleset/improve.ts',
        formula: 'a hit on a part your worn armor covers marks the armor\'s skill when the attacker\'s true skill, or the armor\'s requirement, is inside your armor skill\'s learning window',
        notes: ['A hit on a shield doesn\'t count.'] },
    ] },
  ];
}
