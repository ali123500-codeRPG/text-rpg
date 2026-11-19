// The general equations behind rolls, skill gain and marking, for the library viewer's Equations tab. Every number is
// read from CONFIG or the scales, and every worked example and chance is computed by the functions the rules call
// (band, naturalEdge, ladder, stackType …), so the page follows the code.
import type { Library } from '../types';
import { D100_MEAN } from '../rng';
import { GRADES } from '../types/core';
import { CONFIG } from '../config';
import { CLASS_TIERS, GRADE_LEVELS, LIFE_STAGES, SKILL_TIERS, MORALE_LEVELS, TIERS, type MoraleLevel } from '../scales';
import { tierCostMult } from './morale';
import { gradeMod, ladder, naturalEdge, pickSeconds, rollMargin, stackType, tierOf } from './index';
import { MILESTONES } from './perks';
import { growthRoll, learningWindow } from './improve';
import { tierMult } from './gear';
import { levelCost, xpToReach } from './levels';
import { poolOf, ratingOf } from './ratings';
import { skillName } from '../library/skillNames';
import { groupName, ratingName } from '../library/functionNames';
import { SK } from '../library/skillIds';
import { FN, RT } from '../library/functionIds';
import { PK } from '../library/perkIds';
import { perkName } from '../library';
import { FR } from '../library/tableIds';

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
/** the number-boost perks' milestones (the 40/80/120 perks): every other milestone, from the second */
const BOOSTS = MILESTONES.filter((_, i) => i % 2 === 1).join('/');
/** the stacking worked example: these modifiers of one type */
const STACK_EX = [10, 10, 10];

/** the tier level a skill roll reaches with no modifiers or tier shifts: the rule's own tierOf */
const rollLevel = (d: number, effective: number) => tierOf(d, effective, [], []);
/** % of d100 results at or above tier `k` for an effective skill, no modifiers */
const chanceAtLeast = (effective: number, k: Parameters<typeof TIERS.pos>[0]) => D100.filter((d) => rollLevel(d, effective) >= TIERS.pos(k)).length;
/** the band rows: the margins that reach each tier */
const bandRows = (bands: number[]) => TIERS.keys.map((k, i) => [TIERS.name(k), i === 0 ? `below ${bands[0]}` : i === bands.length ? `${bands[i - 1]} or more` : `${bands[i - 1]} to below ${bands[i]}`]);
/** % chance an improvement roll at `raw` gains at least `atLeast` (SG1 C), no burden */
const growthChance = (raw: number, state: 'normal' | 'tagged' | 'flawed', atLeast: number) =>
  D100.filter((d) => growthRoll(d, { raw, state }, 0).gain >= atLeast).length;

/** the effective skill worked example; tests/unit/equations.test.ts checks it against effectiveSkill */
export const EFF_EX = { skill: SK.melee_medium, standIn: SK.melee_light, trueSkill: 60, gear: 20 };
/** the skill roll worked example; tests/unit/equations.test.ts checks it against ruleset.roll */
export const SKILL_ROLL_EX = { d: 60, eff: 50 };
export const effExample = () => (EFF_EX.trueSkill + EFF_EX.gear) * CONFIG.SUBSTITUTE_EFFICIENCY * tierMult(EFF_EX.standIn);

export function equations(lib: Library): EquationGroup[] {
  const N = CONFIG.NATURAL_EDGE;
  const edges = [[1, N], [101 - N, 100]].map(([a, b]) => [a === b ? `${a}` : `${a}–${b}`, sg(naturalEdge(a))]);
  const ex = SKILL_ROLL_EX;
  const exMargin = rollMargin(ex.d, ex.eff, []);
  const exLevel = rollLevel(ex.d, ex.eff);
  const quick = Object.values(lib.perks).filter((p) => p.improveRolls);
  return [
    { key: 'skills', title: 'Skills', about: 'What a skill counts for before any roll: true skill, then effective skill.', equations: [
      { name: 'True skill', at: 'trueSkill · src/ruleset/perks.ts',
        formula: 'true skill = flat + shares; flat = raw + perk true skill + achievement true skill + essence points',
        terms: [['raw', 'the points in the skill'], ['perk true skill', `the ${BOOSTS} perks of the skill (trueSkill, +functionBoost to skills sharing its group, trueSkillTo), perks that add to every skill of a function (fnSkill), and linked perks that add to every aura skill (auraSkill, Crushing Presence)`], ['achievement true skill', 'skillAdd on your current achievements, lower levels of the chain included (achievementSkill · src/ruleset/achRewards.ts)']],
        notes: ['A dormant skill, or one in a tree the actor can\'t use, counts as 0.', `shares: a ${MILESTONES[5]} perk adds ${CONFIG.HIGH_PERK_SHARE} × its own skill\'s flat true skill to that skill (shareOwn), and ${CONFIG.HIGH_PERK_SPREAD} × it to every skill sharing a group (shareGroup). Shares read flat true skill only, so they never feed each other; several on one skill add in full (RN3).`] },
      { name: 'Effective skill', at: 'effectiveSkill · src/ruleset/gear.ts',
        formula: 'effective skill = best of ( true skill + gear ) × share × tier multiplier × age, over the skill and its stand-ins; + augments × age',
        terms: [['share', `1 for the skill itself; a stand-in counts at its share (flat ${n(CONFIG.SUBSTITUTE_EFFICIENCY)}, see the Stand-ins tab; perks and achievements such as Master of the Moment add to it). A function roll counts every skill with the function at 1 (with the Perception All-150 Every Sense One, a sight or hearing roll counts the skills of both).`],
          ['gear', `skill effects of worn, held or carried items, also × share; a standard kit gives EQUIP_FACTOR (${n(CONFIG.EQUIP_FACTOR)}) × its need, shared once per roll (the best piece)`],
          ['augments', `each skill that augments this one (SkillDef.augments) adds its true skill × its share (default 1) × its tier, on every roll of this skill or only the roll kinds it lists; its tree must be open (Shrewd Dealing augments Barter). A perk can give one too (PerkDef.augments: Grit, Endurance × ${n(CONFIG.GRIT_SHARE)} to Resolve; ${perkName(PK.misdirection)}, ${skillName(SK.guile)} × ${n(CONFIG.MISDIRECTION_SHARE)} to ${skillName(SK.vanishing)}; an essence trait). Kinds (D-276): plain as above; trade, share ${n(CONFIG.AUGMENT_TRADE_SHARE)} by default, where the giving skill's own rolls lose what it gives (Fists Do the Talking, Strike to Intimidation); percent, the giving true skill ÷ 100 × ${n(CONFIG.AUGMENT_PERCENT_RATE)} × the receiving skill's own true skill, several on one skill adding in full (RN3). A payoff augment (D-260: Patient Knife, Protagonist Mentality) takes as its share ${n(CONFIG.PAYOFF_SHARE)} × pieces^${n(CONFIG.PAYOFF_EXP)}, the pieces being the owned perks with its theme tag (itself included), or quirks (RN4)`],
          ['tier multiplier', SKILL_TIERS.keys.map((k) => `${SKILL_TIERS.name(k)} ×${CONFIG.SKILL_TIER_MULT[k]}`).join(' · ')],
          ['age', `old-age decline (ageMult · src/ruleset/age.ts): skills in the ${CONFIG.AGE_DECLINE_GROUPS.map(groupName).join(', ')} groups halve for every (the race\'s Ancient start − its ${LIFE_STAGES.name(CONFIG.AGE_DECLINE_FROM)} start) years past the start of ${LIFE_STAGES.name(CONFIG.AGE_DECLINE_FROM)}; full before then, for other skills and for ageless races`]],
        notes: [`Example: ${skillName(EFF_EX.standIn)} ${EFF_EX.trueSkill} with +${EFF_EX.gear} ${skillName(EFF_EX.standIn)} gear, standing in for ${skillName(EFF_EX.skill)} 0 → (${EFF_EX.trueSkill} + ${EFF_EX.gear}) × ${n(CONFIG.SUBSTITUTE_EFFICIENCY)} × ${n(tierMult(EFF_EX.standIn))} = ${n(effExample())}. Gear for the named skill (the held weapon's bonus) does not pass to a stand-in.`] },
    ] },
    { key: 'rolls', title: 'Rolls', about: 'Every skill roll, check, contest and the no-skill event roll.', equations: [
      { name: 'Skill roll', at: 'roll · src/ruleset/index.ts',
        formula: `margin = d100 + ${n(W())} × effective skill + modifiers − ${n(NEED())}`,
        terms: [['d100', '1 to 100'], [n(W()), `CONFIG.SKILL_WEIGHT = ${n(W())}`], ['modifiers', 'all roll modifiers, each type stacked on its own (see the Stacking tab)'], [n(NEED()), `CONFIG.ROLL_NEEDED = ${n(NEED())}`]],
        notes: [`Example: d100 ${ex.d}, effective skill ${ex.eff}, no modifiers → margin ${n(exMargin)} → ${TIERS.name(TIERS.at(exLevel))}.`] },
      { name: 'Tier of a roll', at: 'band · naturalEdge · tierAt · src/ruleset/index.ts',
        formula: 'tier = band of the margin + unlocked extra bands + natural edge + tier shifts',
        table: { head: ['Tier', 'Margin'], rows: bandRows(CONFIG.MARGIN_BANDS) },
        terms: [['natural edge', `${edges.map(([d, v]) => `d100 ${d}: ${v}`).join(' · ')} (CONFIG.NATURAL_EDGE at each end); never more than one tier`], ['tier shifts', 'whole tiers from Hidden Strike, Hug the Cover, achievements such as The Unseen Death on an unaware target, marks, falling short on gear, Curiouser and Curiouser']],
        notes: ['A tier pushed past either end keeps the end name with one + or − per step (Critical Success+).',
          `Unlocked extra bands (D-211): each tier past Critical Success a perk or achievement opens for this kind of roll (tierUnlocks) adds a band ${n(CONFIG.TIER_EXTRA_BAND)} wider past the end, so Critical Success+ is reached from margin ${n(CONFIG.MARGIN_BANDS[CONFIG.MARGIN_BANDS.length - 1] + CONFIG.TIER_EXTRA_BAND)} and Critical Success++ from ${n(CONFIG.MARGIN_BANDS[CONFIG.MARGIN_BANDS.length - 1] + 2 * CONFIG.TIER_EXTRA_BAND)}; each tier below Critical Failure opened adds one below ${n(CONFIG.MARGIN_BANDS[0] - CONFIG.TIER_EXTRA_BAND)}, and so on. Unlocks for contest rolls count on every roll made as one side of a contest (attacks and defenses, speech, stealth against senses, holds, auras against morale; D-292). Without an unlock the table above is the whole table.`] },
      { name: 'Chance by effective skill', at: 'tierOf · src/ruleset/index.ts',
        formula: '% of d100 results that reach each tier, no modifiers',
        table: { head: ['Effective skill', 'Near Miss or better', 'Success or better', 'Great Success or better', 'Critical Success'],
          rows: [0, 20, 40, 50, 60, 80, 100].map((s) => [String(s), pct(chanceAtLeast(s, 'near_miss')), pct(chanceAtLeast(s, 'success')), pct(chanceAtLeast(s, 'great_success')), pct(chanceAtLeast(s, 'critical_success'))]) } },
      { name: 'Roll only when in doubt', at: 'obstacleGate · gradeMods · src/ruleset/index.ts',
        formula: `an act on a graded thing (a lock, use, interact, observe, other) is a sure Success with no roll when effective skill − grade ≥ ${CONFIG.OBSTACLE_SURE_GAP}, out of reach with no roll when grade − effective skill > ${CONFIG.OBSTACLE_REACH_GAP}, else a roll with the grade modifier`,
        terms: [['grade', GRADE_LEVELS.keys.map((k) => `${GRADE_LEVELS.name(k)} ${CONFIG.DIFFICULTY[k]}`).join(' · ')], ['grade modifier', '(Moderate − grade) × SKILL_WEIGHT (SE23)']],
        notes: ['The grade is the thing\'s own, else the Parser\'s (OD3); both gaps are placeholders (D-343).'] },
      { name: 'Contest', at: 'contested · src/ruleset/index.ts',
        formula: 'gap = tier of B − tier of A; the side with the higher tier wins, equal tiers tie' },
      { name: 'Speech contest', at: 'resolveSpeech · pushContest · applySpeech · overhearLie · src/engine/speech.ts',
        formula: `the speaker rolls the speech skill (${skillName(SK.falsehood)} for a lie) − ${CONFIG.REPEAT_TRY} × earlier tries; the listener rolls the same skill back (Insight against a lie), whoever speaks`,
        terms: [['Shaken', `the listener lost to intimidation: −${CONFIG.SHAKEN_PER_TIER} × tiers lost by, on every roll against the speaker until its engagement ends`],
          ['Swayed', `the listener lost to persuasion: −${CONFIG.SWAYED_PER_TIER} × tiers lost by, on every roll against the speaker until its engagement ends`],
          ['a lie', `a listener whose ${skillName(SK.insight)} beats the ${skillName(SK.falsehood)} roll sees through it`], [perkName(PK.overheard), `an owner who hears a lie told to someone else answers the same ${skillName(SK.falsehood)} roll with ${skillName(SK.insight)} too`], ['earlier tries', 'tries of the same kind (persuade, deceive, intimidate, barter) at the same listener this engagement; plain talk never counts'], [perkName(PK.easy_speaker), 'the listener answers one tier higher']],
        notes: ['NPCs roll speech at the player only with persuade, deceive, intimidate or barter; their plain talk does not roll, but a line they know is false is always given as deceive. A second Shaken or Swayed from the same speaker keeps the bigger one.'] },
      { name: 'Morale roll', at: 'moraleRoll · src/ruleset/index.ts; payFear · src/engine/morale.ts; fear · src/engine/resolve.ts',
        formula: `margin = d100 + ${n(W())} × Resolve + modifiers − ${n(NEED())}; morale lost = the fear's cost × the tier's multiplier`,
        terms: [['max morale', `${CONFIG.MORALE_BASE} + ${CONFIG.MORALE_PER_RESOLVE} × Resolve + the flat max morale of the actor's current achievements (maxMorale; lower levels of a chain included); an NPC template sets its starting Resolve; raw Resolve also sets the Nerve tier (from ${CONFIG.NERVE_TIER_FROM.join(', ')})`],
          ['tier multiplier', `${TIERS.keys.map((k) => `${TIERS.name(k)} ×${CONFIG.MORALE_TIER_MULT[k]}`).join(' · ')}; each step below Critical Failure +${CONFIG.MORALE_BEYOND_CF}`],
          ['levels', CONFIG.MORALE_TRACK.map(([k, max, v]) => `${MORALE_LEVELS.name(k as MoraleLevel)}${max === Infinity ? ` 100 %+` : ` ≤${Math.round(max)} %`}${v ? ` ${v}%` : ''}`).join(' · ') + ` · ${MORALE_LEVELS.name('cowering')} ${Math.round(100 * CONFIG.MORALE_COWER_AT)} % (the most that can be lost; BF79)`],
          ['modifiers', `wounds, each a % of the average roll (${D100_MEAN} + ${n(W())} × Resolve): the health level, the morale level (fear feeds on itself) and a crippled essential part; the player's renown on every morale roll of a foe fighting the player; the player's rally on allies fighting beside the player`]],
        table: { head: ['Resolve', 'Max morale', 'Share of a fear paid'], rows: [30, 50, 70, 90].map((m) => [String(m), String(CONFIG.MORALE_BASE + CONFIG.MORALE_PER_RESOLVE * m),
          `×${(D100.reduce((t, d) => t + tierCostMult(rollLevel(d, m)), 0) / 100).toFixed(2)}`]) },
        notes: [`Fears are the library fears table: flat costs, a negative cost restores. Rolled fears count only while engaged; the player is engaged while someone is fighting them. A hit that leaves parts Crippled or worse rolls the Crippled fear once, paying each part's cost by its impact (non-essential, normal, essential) for a ${n(lib.fears?.[FR.own_part_crippled]?.refParts ?? 6)}-part body, scaled by ${n(lib.fears?.[FR.own_part_crippled]?.refParts ?? 6)} ÷ the body's part count; a part Destroyed rolls again at ${n(lib.fears?.[FR.own_part_destroyed]?.partCostOf?.mult ?? 1.5)} × those costs. Reaching Broken breaks an NPC (it flees), or makes it surrender when the roll that broke it was a Critical Failure or worse. The player at Broken cannot attack. Overwhelm: an aura that wins by ${CONFIG.OVERWHELM_TIERS}+ tiers against a target with max morale at most ${CONFIG.OVERWHELM_MORALE_SHARE * 100} % of the owner's takes all its morale, and an NPC surrenders.`,
          'Shares in the table are calm and unhurt, with no modifiers.'] },
      { name: 'Event roll (no skill)', at: 'eventRoll · src/ruleset/index.ts',
        formula: `margin = d100 ${CONFIG.EVENT_BASE - 100 < 0 ? '−' : '+'} ${Math.abs(CONFIG.EVENT_BASE - 100)} + modifiers`,
        terms: [[`${CONFIG.EVENT_BASE - 100 < 0 ? '−' : '+'}${Math.abs(CONFIG.EVENT_BASE - 100)}`, `event base ${CONFIG.EVENT_BASE} (CONFIG.EVENT_BASE) minus 100`], ['modifiers', 'perk, gear, achievement and status situation bonuses, stacked by type']],
        table: { head: ['Tier', 'Margin'], rows: bandRows(CONFIG.MARGIN_BANDS) },
        notes: ['It reads the same tier table as a skill roll. The natural edge applies here too. There are no tier shifts.', `The tier stops at Critical Success and Critical Failure unless perks or achievements open tiers past them (tierUnlocks, added up along a chain). Each tier opened above widens the natural critical range by ${CONFIG.EVENT_CRIT_NATURALS} (CONFIG.EVENT_CRIT_NATURALS): with one opened, d100 ${101 - CONFIG.EVENT_CRIT_NATURALS}–100 is Critical Success+ and ${101 - 2 * CONFIG.EVENT_CRIT_NATURALS}–${100 - CONFIG.EVENT_CRIT_NATURALS} Critical Success; with two, the next ${CONFIG.EVENT_CRIT_NATURALS} below that is Critical Success too and the top tier is ++. Tiers opened below work the same from 01 up.`, `Threadbound perks (D-218) widen it both ways without moving its middle: eventEdges shifts that many naturals just inside each critical range a tier outward; eventSpread counts the die that many times as far from ${D100_MEAN} (modifiers unchanged); an armed active rolls two dice and keeps the one farther from ${D100_MEAN}, or makes 51–100 Critical Success and 01–50 Critical Failure.`] },
      { name: 'Picking a lock', at: 'doPick · src/engine/resolve.ts; pickSeconds · src/ruleset/index.ts',
        formula: `a Lockpicking function roll (Lockpicking, or Filching at ${n(CONFIG.SUBSTITUTES[FN.lockpicking][0].k)}; lockpicks in use add theirs) + the lock's grade; time = ${n(pickSeconds(CONFIG.ACTION_SPEED_PIVOT))} s (the Action times pick_lock row) × 2^((${n(CONFIG.ACTION_SPEED_PIVOT)} − effective) ÷ ${n(CONFIG.PICK_HALVING_PER)})`,
        terms: [['grade', GRADES.map((k) => `${GRADE_LEVELS.name(k)} ${sg(gradeMod(CONFIG.DIFFICULTY[k]))}`).join(' · ')], ['effective', `the picker's effective Lockpicking with its tools${CONFIG.PICK_FAST_CAP === null ? '' : `, counted at most ${CONFIG.PICK_FAST_CAP} for the time (perks carry it further)`}`]],
        table: { head: ['Effective skill', 'Time'], rows: [25, 50, 75, 100, 150, 200].map((k) => [String(k), `${n(pickSeconds(k))} s`]) },
        notes: [`OD1 b: no roll when the lock is sure or out of reach: graded ${CONFIG.OBSTACLE_SURE_GAP} or more below the effective skill it opens (Success); more than ${CONFIG.OBSTACLE_REACH_GAP} above, it is beyond the picker. The grade modifier is ${n(W())} × (${n(CONFIG.DIFFICULTY.moderate)} − grade), as every task grade (SE23, OD10 a).`, 'Success opens it once the time is done: out of a fight the time passes at once; in a fight each turn at it adds a fight turn of work. Near Miss: not yet, keep going. Failure: the lock is beyond the picker until its effective skill is higher than at that try. Critical Failure: the pick snaps and the lockpicks used are lost. Picking is a whisper (hushed).'] },
      { name: 'Filching', at: 'filchContest · src/engine/filch.ts',
        formula: `gap = tier of (each watcher's Sight or Hearing roll + attention + size) − tier of (one Filching roll F)`,
        terms: [['F', `one Filching function roll per try (Filching, or Lockpicking at ${n(CONFIG.SUBSTITUTES[FN.filching][0].k)})`],
          ['attention', Object.entries(CONFIG.FILCH_ATTENTION).filter(([k]) => k !== 'asleep').map(([k, v]) => `${k} ${sg(v)}`).join(' · ')],
          ['size', CONFIG.FILCH_SIZE.map((v, b) => `bulk ${b} ${b > CONFIG.FILCH_MAX_BULK ? 'closed' : sg(v)}`).join(' · ')]],
        notes: ['Sight: everyone who sees the act at its visibility level. Hearing: the act sounds ' + CONFIG.FILCH_NOISE + ', one level louder per tier F falls below Near Miss, heard by the usual hearing math.',
          'gap above 0 and the act made out clearly: caught. Above 0 but only glimpsed or heard partly, or 0: suspicious. Below 0: nothing. The worst result decides: caught, nothing taken; suspicious, nothing taken and the owner suspicious; else taken unseen.'] },
      { name: 'Stacking within a type', at: 'stackType · modTotal · src/ruleset/index.ts',
        formula: `type total = Σ value(k) × (k^${n(CONFIG.MOD_STACK_EXP)} − (k−1)^${n(CONFIG.MOD_STACK_EXP)}), k = 1 for the largest; bonuses and penalties apart; types add in full`,
        notes: [`Example: ${STACK_EX.length} × ${sg(STACK_EX[0])} of one type → ${n(stackType(STACK_EX))}.`] },
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
        formula: `throw skill = ${n(CONFIG.THROW_BLEND.weapon)} × the weapon's own effective skill + ${n(CONFIG.THROW_BLEND.ranged)} × the effective ranged skill of the same class; reach = the throw mode's own range in metres (THROW_M: spear ${CONFIG.THROW_M.spear}, knife ${CONFIG.THROW_M.knife}, improvised ${CONFIG.THROW_M.improvised}) + perks' throwReach metres (modeReach), measured against the distance in metres`,
        terms: [["weapon's own skill", "the skill its gear class asks for (a dagger: Light weapons; an improvised weapon: Improvisation)"], ['ranged skill', 'Light, Medium or Heavy ranged, by the throw mode\'s class'], ['shares', 'CONFIG.THROW_BLEND, set on the Throw attack mode row']],
        notes: ['Each part is its own effective skill: it takes its own stand-ins and only the gear that boosts it (the weapon\'s kit bonus goes to its own skill). Both skills that rolled can learn. The thrown item lands where the target stands, hit or miss.'] },
      { name: 'Gap', at: 'attack · src/ruleset/index.ts',
        formula: `gap = defense tier − attack tier + gap shifts, at most ${sg(CONFIG.GAP_MAX)}`,
        terms: [['gap shifts', `heavy weapon vs block or parry ${sg(CONFIG.HEAVY_VS_BLOCK_GAP)} (not against a parry with Against the Grain), Turn Aside ${sg(CONFIG.TURN_ASIDE_GAP)} on a heavy or crushing hit (never past 0), Slip the Blow +1 on a tie`]] },
      { name: 'Damage multiplier', at: 'ladder · src/ruleset/index.ts',
        formula: 'multiplier = GAP_LADDER[dodge, block or parry][gap]',
        table: { head: ['Gap', 'Dodge', 'Block', 'Parry'], rows: Array.from({ length: CONFIG.GAP_MAX - CONFIG.GAP_MIN + 1 }, (_, i) => CONFIG.GAP_MIN + i).map((g) => [sg(g), `×${n(ladder('dodge', g))}`, `×${n(ladder('block', g))}`, `×${n(ladder('parry', g))}`]) },
        notes: [`A gap past ${sg(CONFIG.GAP_MAX)} uses its row. Past ${sg(CONFIG.GAP_MIN)} each further step adds ×${n(CONFIG.GAP_PAST_STEP)} to the ${sg(CONFIG.GAP_MIN)} row, with no top (CONFIG.GAP_PAST_STEP).`, `×0 is a clean dodge, and a dodge at ${sg(CONFIG.HIT_GAPS.graze)} is a graze. A block at ${sg(CONFIG.HIT_GAPS.blockFrom)} or better is blocked; a shield also blocks at ${sg(CONFIG.HIT_GAPS.shieldFrom)} and takes the hit itself. A hit at ${sg(CONFIG.HIT_GAPS.heavy)} is a heavy hit, at ${sg(CONFIG.HIT_GAPS.crushing)} or worse a crushing hit (CONFIG.HIT_GAPS).`,
          `Where it lands: at ${sg(CONFIG.HIT_GAPS.movesAdjacent)} the hit moves to the named part if it is adjacent, at ${sg(CONFIG.HIT_GAPS.movesAnywhere)} or worse to the named part anywhere. From ${sg(CONFIG.HIT_GAPS.noEssentialFrom.dodge)} (dodge) or ${sg(CONFIG.HIT_GAPS.noEssentialFrom.block)} (block, parry) up it never lands on an essential part; a block or parry from ${sg(CONFIG.HIT_GAPS.nonEssentialOnlyFrom.block)} up off the shield lets it land on non-essential parts only.`,
          `A parry at ${sg(CONFIG.HIT_GAPS.blockFrom)} or better that lets part of the blow through is blocked, and ×0 is parried (a clean parry). A full parry, at +${CONFIG.PARRY_STRIKE_GAP} (PARRY_STRIKE_GAP) or better, also gives the defender one free melee attack back with the parrying weapon, up to ${CONFIG.STRIKE_BACK_LIMIT} per round (STRIKE_BACK_LIMIT; Every Answer, Ceaseless Guard and Endless Answer raise or lift it; a strike back earns none of its own); Answer the Blow lowers that by ${CONFIG.ANSWER_THE_BLOW_DROP} with a medium weapon.`] },
      { name: 'Damage', at: 'attack · src/ruleset/index.ts',
        formula: `damage = (class damage + mode damageAdj) × (1 + ${n(CONFIG.DAMAGE_NEED_RATE)} × need) × multiplier × perk damage multipliers, then armor: damage × armor multiplier − max(0, reduction − pierce)`,
        terms: [['need', `the weapon's requirement (CONFIG.DAMAGE_NEED_RATE: +${n(CONFIG.DAMAGE_NEED_RATE * 100)}% damage a point); a natural attack or a bare hand has none, so the attacker's skill with it stands in`]],
        table: { head: ['Class', 'Damage', 'Hit'], rows: [...Object.entries(CONFIG.WEAPON_CLASSES), ['unarmed (no class)', CONFIG.UNARMED_PROFILE] as const].map(([k, c]) => [k, String(c.damage), sg(c.hit)]) },
        notes: ['Worn armor and natural armor each apply if they cover the part hit. Damage never goes below 0, and fractions stay.',
          `A minted weapon that boosts damage adds QUALITY_DAMAGE_FACTOR (${n(CONFIG.QUALITY_DAMAGE_FACTOR)}) × need × quality × its class factor (${Object.entries(CONFIG.DAMAGE_CLASS_FACTOR).map(([k, v]) => `${k} ${n(v)}`).join(', ')}) × its tree factor (${Object.entries(CONFIG.DAMAGE_TREE_FACTOR).map(([k, v]) => `${k} ${n(v)}`).join(', ')}) to damageAdj.`,
          `A worn armor's reduction is ARMOR_FACTOR (${n(CONFIG.ARMOR_FACTOR)}) × its need × ARMOR_WEIGHT_SOAK by weight (${Object.entries(CONFIG.ARMOR_WEIGHT_SOAK).map(([k, v]) => `${k} ${n(v)}`).join(', ')}); its multiplier comes from its weight and is taken first, then the reduction. A minted piece adds ARMOR_QUALITY_FACTOR (${n(CONFIG.ARMOR_QUALITY_FACTOR)}) × need × quality, rounded.`,
          `Natural armor (a boar's shield, a crocodile's plates) uses the same equation with the owner's Hide skill in place of the need, times its race's hide: ARMOR_FACTOR × Hide × race hide (naturalReduction); its multiplier is light armor's.`,
          `A shield's pool is POOL_BASE (${n(CONFIG.POOL_BASE)}) + POOL_FACTOR (${n(CONFIG.POOL_FACTOR)}) × its need; a minted shield adds POOL_QUALITY_FACTOR (${n(CONFIG.POOL_QUALITY_FACTOR)}) × need × quality, rounded. A blow on a shield drains its pool by the damage (×${n(CONFIG.SHIELD_BREAKER_MULT)} with Shield Breaker; ×${n(CONFIG.IRON_RIM_MULT)} with Iron Rim).`] },
    ] },
    { key: 'gain', title: 'Skill gain', about: 'How a marked skill improves.', equations: [
      { name: 'When skills roll to improve', at: 'payScenario · scenarioRolls · src/engine/growth.ts',
        formula: CONFIG.GROWTH_AT_SCENARIO_END ? 'at the end of a scenario: rolls = round(owed rolls marked in it × tier share × ending factor) + rolls past Critical Success + the low-level bonus, dealt to the marked skills by their owed rolls' : 'at the end of the turn a skill is marked, it makes the improvement roll(s) it is owed',
        terms: [['tier share', `by the scenario's event-roll tier: ${Object.entries(CONFIG.GROWTH_TIER_SHARE).map(([k, v]) => `${k.replace(/_/g, ' ')} ${n(v)}`).join(', ')} (CONFIG.GROWTH_TIER_SHARE)`],
          ['ending factor', `${Object.entries(CONFIG.ENDING_FACTOR).map(([k, v]) => `${k.replace(/_/g, ' ')} ${n(v)}`).join(', ')}, kept between ${n(CONFIG.ENDING_FACTOR_MIN)} and ${n(CONFIG.ENDING_FACTOR_MAX)} (CONFIG.ENDING_FACTOR, ENDING_FACTOR_MIN, ENDING_FACTOR_MAX)`],
          ['past Critical Success', `+${n(CONFIG.GROWTH_ROLLS_PAST_CRIT)} roll per step (CONFIG.GROWTH_ROLLS_PAST_CRIT)`],
          ['low-level bonus', `+${n(CONFIG.GROWTH_LOW_LEVEL_BONUS)} roll below character level ${CONFIG.GROWTH_LOW_LEVEL_BELOW} when anything was marked (CONFIG.GROWTH_LOW_LEVEL_BONUS, GROWTH_LOW_LEVEL_BELOW)`]],
        notes: ['Rolls are made in rounds: each round every skill with rolls left makes one, and Burden is worked out again before the next round.', 'Marks made in free roam wait for the next scenario. An inner scenario pays only for its own marks; the bigger one pays for the rest at its end.', 'Level-ups wait for the same moment. Only the player has marks for now. A failed improvement roll shows nothing.'] },
      { name: 'Burden', at: 'burdenOf · payRolls · src/ruleset/improve.ts',
        formula: `burden = max(0, floor((sum of raw × share − potential) ÷ ${CONFIG.K}))`,
        terms: [['potential', `CONFIG.POTENTIAL = ${CONFIG.POTENTIAL}, plus any adjustments`], [String(CONFIG.K), 'CONFIG.K'],
          ['share', `1 − ${CONFIG.TAG_BURDEN_SELF_PCT}% for its own tag − ${CONFIG.TAG_BURDEN_GROUP_PCT}% per tagged skill sharing a group with it, itself included (CONFIG.TAG_BURDEN_SELF_PCT, TAG_BURDEN_GROUP_PCT); a lone tag counts 0, below 0 lowers the sum (burdenShare)`],
          ['flaws', `+ ${CONFIG.FLAW_BURDEN_GROUP_PCT}% per flawed skill sharing a group with it, itself included (CONFIG.FLAW_BURDEN_GROUP_PCT, D-377)`]] },
      { name: 'Improvement roll', at: 'growthRoll · payRolls · src/ruleset/improve.ts',
        formula: `margin = d100 + (cap − raw − burden + group bonus) − ${CONFIG.GROWTH_ROLL_NEEDED}; gain = margin ÷ ${CONFIG.GROWTH_MARGIN_PER_POINT}, rounded up, nothing at 0 or below`,
        terms: [['cap', `${CONFIG.SKILL_CAP} (CONFIG.SKILL_CAP); a tagged skill ${CONFIG.SKILL_CAP + CONFIG.TAG_CAP_BONUS} (+ CONFIG.TAG_CAP_BONUS); a flawed skill ${CONFIG.SKILL_CAP - CONFIG.FLAW_CAP_PENALTY} (− CONFIG.FLAW_CAP_PENALTY)${CONFIG.GROWTH_CAP_IN_ROLL ? '' : '; every skill rolls against ' + CONFIG.SKILL_CAP} (CONFIG.GROWTH_CAP_IN_ROLL)`],
          ['burden', 'Burden; a tagged skill carries none'], ['group bonus', `${CONFIG.TAG_GROUP_ROLL_SHARE} × true skill of every other tagged skill sharing a group with it (CONFIG.TAG_GROUP_ROLL_SHARE, groupRollBonus)`], [String(CONFIG.GROWTH_ROLL_NEEDED), 'CONFIG.GROWTH_ROLL_NEEDED'],
          [String(CONFIG.GROWTH_MARGIN_PER_POINT), 'margin per raw point gained (CONFIG.GROWTH_MARGIN_PER_POINT)'],
          ['tagged and flawed', 'roll one d100 like any skill; only the cap moves'],
          ['rolls', `1 per roll owed${quick.length ? `; ${quick.map((p) => `${p.name}: ${p.improveRolls!.rolls} rolls while raw is below ${p.improveRolls!.below ?? `${p.improveRolls!.belowShare} × the highest raw skill`}`).join('; ')}` : ''}`]],
        table: { head: ['Raw', 'Gains (+1 or more)', '+2 or more', 'Flawed: gains'], rows: [25, 50, 65, 75, 90, 99].map((r) => [String(r), pct(growthChance(r, 'normal', 1)), pct(growthChance(r, 'normal', 2)), pct(growthChance(r, 'flawed', 1))]) },
        notes: ['No hard limit: the room left below the cap is the bonus, so the roll gets harder smoothly and runs out on its own exactly at the cap (further with a group bonus); perks, achievements and gear still raise true skill past it.',
          `A tagged skill at raw ${CONFIG.SKILL_CAP} rolls like an untagged ${CONFIG.SKILL_CAP - (CONFIG.GROWTH_CAP_IN_ROLL ? CONFIG.TAG_CAP_BONUS : 0)} and keeps going to ${CONFIG.SKILL_CAP + CONFIG.TAG_CAP_BONUS}.`,
          `Crossing a milestone (${MILESTONES.join(', ')}) on true skill is logged with the gain.`] },
    ] },
    { key: 'levels', title: 'Levels', about: 'How XP turns into levels.', equations: [
      { name: 'XP to the next level', at: 'xpToNext · spendXp · src/engine/xp.ts',
        formula: `XP to go from level n to n + 1 = ${CONFIG.LEVEL_XP} × √(n² + ${CONFIG.LEVEL_XP_EARLY}²), rounded`,
        terms: [[String(CONFIG.LEVEL_XP_EARLY), 'CONFIG.LEVEL_XP_EARLY: the early bump; each level costs more than the last, and the cost bends back to LEVEL_XP × n as n grows'], [String(CONFIG.LEVEL_XP), 'CONFIG.LEVEL_XP'], ['n', 'character level: the sum of every class\'s level, plus bonus levels, less the free and bonus levels taken (at least 1); free and bonus levels never make the next level dearer']],
        table: { head: ['From level', 'To level', 'XP needed', 'Total from level 1'], rows: [1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 19].map((l) => [String(l), String(l + 1), String(levelCost(l)), String(xpToReach(l + 1) - xpToReach(1))]) },
        notes: [`The XP is spent and the level goes into the current class, or the class picked for the next level. The player starts at their Start's level (level 1 today).`,
          'One gain can take several levels in a row. When the class has no room left (at its top level), the XP stays banked until a class with room is picked.',
          'Free levels (from achievements or perks with free levels) are taken first and cost no XP; they bank the same way when no class has room.'] },
      { name: 'Class top level', at: 'classMaxLevel · src/library/spawn.ts',
        formula: `top level = min(${CONFIG.CLASS_MAX_LEVEL}, ${CONFIG.CLASS_TIER0_MAX_LEVEL} + ${CONFIG.CLASS_LEVELS_PER_TIER} × class tier)`,
        terms: [[String(CONFIG.CLASS_TIER0_MAX_LEVEL), 'CONFIG.CLASS_TIER0_MAX_LEVEL'], [String(CONFIG.CLASS_LEVELS_PER_TIER), 'CONFIG.CLASS_LEVELS_PER_TIER'], [String(CONFIG.CLASS_MAX_LEVEL), 'CONFIG.CLASS_MAX_LEVEL']],
        table: { head: ['Class tier', 'Top level'], rows: CLASS_TIERS.keys.map((k) => [CLASS_TIERS.name(k), String(Math.min(CONFIG.CLASS_MAX_LEVEL, CONFIG.CLASS_TIER0_MAX_LEVEL + CONFIG.CLASS_LEVELS_PER_TIER * CLASS_TIERS.pos(k)))]) },
        notes: ['Reaching the top level grants the class capstone.'] },
      { name: 'What a level gives', at: 'levelUp · src/engine/xp.ts',
        formula: `each level: +1 level in the class, plus that class's perks for the level; on every character level that is a multiple of ${CONFIG.PERK_POINT_EVERY}, +1 perk point`,
        notes: ['Levels give no skill points: skills grow only through improvement rolls.'] },
    ] },
    { key: 'marking', title: 'Marking', about: 'What marks a skill so it can improve.', equations: [
      { name: 'Learning window', at: 'markIfClose · src/ruleset/improve.ts',
        formula: `a use marks the skill when raw − ${CONFIG.MARK_WINDOW} ≤ opposition ≤ max(raw, true skill) + ${CONFIG.MARK_WINDOW}`,
        terms: [[String(CONFIG.MARK_WINDOW), 'CONFIG.MARK_WINDOW'], ['raw', 'a skill not on the sheet counts as raw 0, and joins the sheet with its first gain']],
        table: { head: ['Raw', 'True skill', 'Opposition that teaches'], rows: [[0, 0], [20, 20], [30, 45], [50, 60]].map(([r, t]) => [String(r), String(t), learningWindow(r, t).join(' to ')]) },
        notes: ['Only the player marks. A skill in a tree the player can\'t use is never marked.',
          CONFIG.MARK_STACK_EVERY === Infinity ? 'A skill is owed one roll per engagement (CONFIG.MARK_STACK_EVERY is off).' : CONFIG.MARK_STACK_EVERY === 1 ? 'Marks stack: every mark on a skill owes a roll (CONFIG.MARK_STACK_EVERY 1).' : `Marks stack: the first mark on a skill in an engagement (or in a scenario, outside one) owes a roll, and so does every ${CONFIG.MARK_STACK_EVERY} marks after it (CONFIG.MARK_STACK_EVERY; ${CONFIG.MARK_STACK_EVERY}: marks 1, ${1 + CONFIG.MARK_STACK_EVERY}, ${1 + 2 * CONFIG.MARK_STACK_EVERY}...).`] },
      { name: 'Close calls', at: 'markUse · src/ruleset/improve.ts',
        formula: 'a contest or a defended attack whose tier gap is exactly 0 marks both sides\' skills, inside the window or not',
        notes: ['A won contest or defended attack has no top to its window: beating a stronger side marks the winner\'s skill.', `Every Fall a Lesson (A Nobody, class level ${lib.perks[PK.every_fall_a_lesson]?.classLevel?.level}): losing a contest or a defended attack by exactly one tier step marks the owner\'s skill too, inside the window or not.`] },
      { name: 'Opposition', at: 'markUse · src/ruleset/improve.ts',
        formula: 'check → its difficulty · contest → the other side\'s true skill in the skill it rolled · attack → each side against the other\'s true skill',
        terms: [['difficulty', GRADE_LEVELS.keys.map((k) => `${GRADE_LEVELS.name(k)} ${CONFIG.DIFFICULTY[k]}`).join(' · ')]],
        notes: ['When a stand-in makes the roll, the stand-in and the skill the action asked for each mark, each against its own window.',
          'Stealth and ambush contests mark the watcher\'s sight or hearing skill (the one that rolled) as well as the sneaker\'s skill.'] },
      { name: 'Augmenting skills', at: 'markAugments · src/ruleset/improve.ts',
        formula: `the roll gets one window from its sums: low = rolled skill raw + Σ augment raw × share × tier − ${CONFIG.MARK_WINDOW}; high = rolled skill max(raw, true) + Σ augment max(raw, true) × share × tier + ${CONFIG.MARK_WINDOW}. Every augment that added to the roll marks when the opposition is inside it, or on a close call`,
        terms: [['opposition', 'a check\'s difficulty, or the other side\'s true skill plus what its own augments added to its roll']],
        notes: ['The rolled skill keeps its own window and opposition. An augment not on the sheet counts as raw 0 and can learn once its tree opens. An augment limited to roll kinds learns only from rolls of those kinds.'] },
      { name: `${skillName(SK.endurance)}`, at: 'markEndurance · src/ruleset/improve.ts',
        formula: `a hit that costs any health marks ${skillName(SK.endurance)} when the attacker's true skill is inside ${skillName(SK.endurance)}'s learning window`,
        notes: ['A foe far weaker than your Endurance no longer teaches it, the same as any other skill.'] },
      { name: 'Armor skill', at: 'markArmor · src/ruleset/improve.ts',
        formula: 'a hit on a part your worn armor covers marks the armor\'s skill when the attacker\'s true skill, or the armor\'s requirement, is inside your armor skill\'s learning window',
        notes: ['A hit on a shield doesn\'t count.'] },
    ] },
    { key: 'power', title: 'Ratings and power', about: 'Skill groups read as one number, strength, and the power that sets defeat XP.', equations: [
      { name: 'Group rating', at: 'worth · poolOf · ratingOf · ratingOfGroups · src/ruleset/ratings.ts',
        formula: `rating = 50 × (pool ÷ ${n(CONFIG.SKILL_RATING_AT_50)})^(1/${n(CONFIG.SKILL_RATING_POWER)}); pool = Σ worth(skill) × ${n(CONFIG.RATING_SHARE_STEP)}^place, highest first; worth(s) = ${n(CONFIG.SKILL_RATING_AT_50)} × (s ÷ 50)^${n(CONFIG.SKILL_RATING_POWER)}`,
        terms: [['s', 'each skill\'s effective value in the group (true skill × tier, gear lines, augments, age)'], [n(CONFIG.SKILL_RATING_AT_50), 'CONFIG.SKILL_RATING_AT_50'], [n(CONFIG.SKILL_RATING_POWER), 'CONFIG.SKILL_RATING_POWER'], [n(CONFIG.RATING_SHARE_STEP), 'CONFIG.RATING_SHARE_STEP: the second skill counts at this share, the third at its square …']],
        table: { head: ['Skills in the group', 'Rating'], rows: [[50], [50, 50], [50, 50, 50], [75], [75, 50], [100], [100, 75, 50], [150], [200, 100]].map((v) => [v.join(' + '), n(ratingOf(poolOf(v)))]) },
        notes: ['A lone skill rates exactly itself; every further skill adds less, and nothing caps it.', 'A skill counts in every group it names. The own rating leaves gear lines out; the gap between the two is what gear adds.'] },
      { name: 'Compound ratings', at: 'compoundRating · src/ruleset/ratings.ts',
        formula: 'a compound rating pools the skills of several groups as one group (each skill once)',
        table: { head: ['Rating', 'Groups'], rows: Object.entries(CONFIG.RATINGS).map(([id, gs]) => [ratingName(id), gs.map(groupName).join(' + ')]) },
        notes: ['Rows live in CONFIG.RATINGS.'] },
      { name: 'Strength', at: 'strengthFor · holdStrength · src/ruleset/ratings.ts',
        formula: 'strength for an action = the best of its kinds: compound rating × the kind\'s share',
        table: { head: ['Action', 'Kinds'], rows: Object.entries(CONFIG.STRENGTH_KINDS).map(([act, ks]) => [act, Object.entries(ks).map(([k, s]) => `${ratingName(k)} × ${n(s)}`).join(' · ')]) },
        notes: [`Breaking free of a hold or holding on: both sides add ${n(CONFIG.STRENGTH_HOLD_SHARE)} × their ${ratingName(RT.melee_strength)} (with ${skillName(SK.unarmed_grapple)} left out of its pool) to the ${skillName(SK.unarmed_grapple)} roll (CONFIG.STRENGTH_HOLD_SHARE).`] },
      { name: 'Power (placeholder)', at: 'power · levelRating · combatPart · src/engine/xp.ts; combatLevel · combatParts · src/engine/combatLevel.ts; nonCombatPart · src/engine/nonCombat.ts',
        formula: 'power = level part + combat part + non-combat part',
        terms: [['level part', `${n(CONFIG.LEVEL_RATING_SHARE)} × the XP its level costs to reach (CONFIG.LEVEL_RATING_SHARE)`],
          ['combat part', `the XP rating's skill part of the reference fighter at the actor's combat level: a human with ${CONFIG.MODEL_REF_SKILLS.map(skillName).join(', ')} all at the level, holding relics of ${CONFIG.MODEL_REF_KIT.map((id) => lib.items[id]?.name ?? id).join(' and ')} whose requirement is the level, standing in ${CONFIG.MODEL_REF_DEFENSE}`],
          ['combat level', 'the level of the reference fighter the actor fights evenly: the level where each side needs the same seconds to defeat the other, each with its best attack; no dice and no staged fight'],
          ['seconds to defeat', 'blows to defeat × the attack\'s seconds; blows to defeat = the other\'s health × nerve ÷ the average blow (a blocker\'s shield first takes the blows it blocks until its pool is gone); an attack that outreaches the reference lands 1 + (reach past its reach) ÷ (its run speed × the seconds it needs) times its blows'],
          ['average blow', 'Σ chance × max(0, ladder × damage × armor share − soak), over every pair of tiers the attack and defense rolls can give (every d100 face once, tiers with no end, the gap\'s own shifts) and every body part by how often it is hit'],
          ['nerve', 'the average share of its health an actor loses before it is out: Down, or Broken by a health fear (from its Resolve roll\'s odds)'],
          ['non-combat part', `for each of ${Object.keys(CONFIG.NONCOMBAT_SHARES).map(groupName).join(', ')}: the group's pool × the share of an equal fight it settles (CONFIG.NONCOMBAT_SHARES)`]],
        table: { head: ['Level', 'Level part'], rows: [1, 5, 10, 20, 40, 60].map((l) => [String(l), n(CONFIG.LEVEL_RATING_SHARE * xpToReach(l))]) },
        notes: ['A fighter\'s power is taken as it joins a fight and kept until the fight ends.'] },
      { name: 'Defeat XP', at: 'weakFoeTaper · src/engine/xp.ts',
        formula: `defeat XP = foe power × min(1, ${n(CONFIG.DEFEAT_XP_TAPER)} × foe power ÷ your power) × ${n(CONFIG.DEFEAT_XP_MULT)}`,
        terms: [[n(CONFIG.DEFEAT_XP_TAPER), 'CONFIG.DEFEAT_XP_TAPER: a weak foe gives less'], [n(CONFIG.DEFEAT_XP_MULT), 'CONFIG.DEFEAT_XP_MULT']],
        notes: ['Both powers are the ones taken when each side joined the fight.'] },
    ] },
    { key: 'essences', title: 'Essences', about:'Where an essence comes from: one rule for every essence of each kind.', equations: [
      { name: 'Foe essence', at: 'notable · offersFromDefeats · src/engine/essence.ts',
        formula: `beating a notable foe of the essence's race or body type offers it; notable = power at least ${Math.round(CONFIG.ESSENCE_NOTABLE_SHARE * 100)}% of yours, or a notable or rolled NPC`,
        notes: ['Each such foe rolls once, ever.', 'A scenario you resolve at Great Success or better can also offer one from the foes you beat in it.'] },
      { name: 'Deed essence', at: 'offerAtEnding · src/engine/essence.ts',
        formula: 'a scenario you resolve at Great Success or better, in which you beat no foe whose race or body type has essences, offers a deed essence',
        notes: ['It is built on the skill you used most in that scenario.'] },
    ] },
  ];
}
