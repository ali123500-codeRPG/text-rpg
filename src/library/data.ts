// The prototype library: skills (Part 1 §3), body types (Part 3), classes and templates (Part 4 §4),
// items (Appendix: prototype item bank), routine bank (Appendix: prototype routine bank). All numbers are placeholders.
import { AM, BK, CP, DU, RV, EK, FR, FU, GC, HL, PA, PY, RL, TN, VL, ZK } from './tableIds';
import { TP } from './templateIds';
import { RO, TH } from './npcLayerIds';
import { BT, RC } from './raceIds';
import { TR } from './treeIds';
import { CONFIG } from '../config';
import { LAYOUTS } from './layouts';
import { UNIQUES } from './uniques';
import type { ArmorWeightKey, LifeStageKey } from '../scales';
import { CLASS_TIERS, LIFE_STAGES, NOISE, VISIBILITY, ZONE_SIZES, ROAD_LENGTHS, ROAD_DANGERS } from '../scales';
import { openAirReachM } from '../perception/noise';

/** AT12: armour on or off locks movement, is careful work in steps, and keeps what is done when broken off */
const ARMOR_TIME = { locksMove: true, focus: 'careful', output: 'steps', onBreak: [{ upTo: 1, then: 'kept' }] } as const;
/** HB1: how far a sound carries in the open */
const inOpen = (m: number | undefined) => (m === undefined ? 'nowhere' : m === 0 ? 'only right beside you' : `${m} m in the open`);
import type { AccessCond, ActivityDef, BodyType, ItemDef, ItemEffect, Library, NpcRoleDef, NpcTemplate, ThemeDef, PerkDef, Personality, Routine, RoutineSet, SituationTag, SkillDef } from '../types';
import { FUNCTION_GROUP } from './functionNames';
import { PERK_WRITEUPS } from './perks';
import { BOOST_PERKS } from './boostPerks';
import { ALL_PARTS } from './allPerks';
import { BUILT_PERKS } from './builtPerks';
import { SK, OLD_SKILL_IDS } from './skillIds';
import { ACH, ACH_HEADS } from './achievementIds';
import { FN, GR } from './functionIds';
import { CL } from './classIds';
import { SV } from './serviceIds';
import { ES } from './essenceIds';
import { PK } from './perkIds';
import { IT } from './itemIds';

/** aimed hits per part size: smaller parts are harder to hit, so their levels pay this many reward levels more */
/** AG3–AG6: life stage start ages per race (placeholders but the human row) */
const ages = (y: number[]) => Object.fromEntries(LIFE_STAGES.keys.map((k, i) => [k, y[i]])) as Record<LifeStageKey, number>;
const AGES = { human: ages([0, 13, 18, 40, 60, 80, 100]), elf: ages([0, 13, 20, 150, 250, 350, 450]), dragon: ages([0, 5, 100, 200, 300, 400, 500]) };
/** PL19: a short behaviour hint for each value, given to the agent with the value */
const VALUE_HINTS: Record<keyof typeof VL, string> = {
  duty: 'does what is expected of them, sees obligations through',
  wealth: 'wants money and fine things, counts the cost of everything',
  family: 'puts their own family first, protects and provides for them',
  faith: 'lives by their gods and their teachings',
  power: 'wants control over others and over events',
  freedom: 'hates being told what to do, chooses their own path',
  safety: 'avoids danger, wants things secure and settled',
  pleasure: 'lives for food, drink, fun and a good show',
  knowledge: 'studies, practises and seeks out learning',
  kindness: 'helps people in need, hates to see suffering',
  glory: 'wants great deeds and to be remembered for them',
  adventure: 'seeks out new places, thrills and challenges',
  reputation: 'cares what others think of them, guards their good name',
  humility: 'accepts their lot, asks for nothing, gives others the credit',
  nature: 'loves the wild, animals and growing things',
  justice: 'wants wrongs put right and the guilty punished',
  tolerance: 'accepts people who are different, hates prejudice',
  loyalty: 'stands by their friends and their own',
  courtesy: 'minds their manners, avoids giving offence',
  order: 'likes rules, routine and things in their place',
  propriety: 'keeps to what is proper for their place, and keeps private matters private',
  gratitude: 'repays kindness in kind or better, and offers to at once',
  desire: 'drawn to attractive people; notices them, flirts and chases romance',
};
const SMALLER_PAYS_MORE = { small: 1, extra_small: 1, tiny: 2 };

const sk = (id: string, treeId: string, functions: SkillDef['functions'], roles: SkillDef['roles'], cue?: 'sight' | 'sound', tier: SkillDef['tier'] = 'tier_2'): SkillDef =>
  ({ id, treeId, functions, roles, ...(cue ? { cue } : {}), tier });

export const SKILLS: Record<string, SkillDef> = Object.fromEntries([
  sk(SK.melee_light, TR.melee, [FN.arms], [RL.grip]),
  sk(SK.melee_medium, TR.melee, [FN.arms], [RL.grip]),
  sk(SK.melee_heavy, TR.melee, [FN.arms], [RL.grip]),
  sk(SK.ranged_light, TR.ranged, [FN.ranged], [RL.grip]),
  sk(SK.ranged_medium, TR.ranged, [FN.ranged], [RL.grip]),
  sk(SK.ranged_heavy, TR.ranged, [FN.ranged], [RL.grip]),
  sk(SK.unarmed_strike, TR.unarmed, [FN.unarmed], [RL.grip]),
  sk(SK.unarmed_grapple, TR.unarmed, [FN.unarmed], [RL.grip]),
  sk(SK.unarmed_improvised, TR.unarmed, [FN.unarmed], [RL.grip]), // fighting with whatever is at hand
  sk(SK.unarmed_natural, TR.natural, [FN.unarmed], [RL.strike]), // its own tree, open to slime and dragon bodies (TA5)
  { ...sk(SK.dodge, TR.defense, [FN.defense], [RL.move]), groups: [GR.speed] }, // Defense and Speed groups; no Initiative function, so it doesn't add to initiative
  sk(SK.block, TR.defense, [FN.defense], [RL.grip]), // shields only: a held weapon parries instead
  sk(SK.parry, TR.defense, [FN.defense], [RL.grip]), // turn a melee blow aside with a held melee weapon; a full stop earns a free strike back
  // Fortitude (MB5, MB32, FT15): body and mind. Endurance sets total HP; Resolve sets max morale and rolls the morale roll;
  // Stamina sets the stamina bar
  sk(SK.endurance, TR.fortitude, [FN.health], []),
  sk(SK.resolve, TR.fortitude, [FN.morale], []),
  sk(SK.stamina, TR.fortitude, [FN.stamina], []),
  // Armor – Conventional (AR1–AR3): one skill per armor weight, function armor in the Defense group.
  // What the skill does while worn (AR4) and how it improves (AR5) are parked (D-184); equip requirements will read it.
  sk(SK.light_armor, TR.armor, [FN.armor], []),
  sk(SK.medium_armor, TR.armor, [FN.armor], []),
  sk(SK.heavy_armor, TR.armor, [FN.armor], []),
  sk(SK.eyesight, TR.perception, [FN.sight], [RL.sense], 'sight'),
  sk(SK.earshot, TR.perception, [FN.hearing], [RL.sense], 'sound'),
  // NT17: what a listener rolls against a lie. No function, so nothing stands in for it; it sits in the Notice group
  { ...sk(SK.insight, TR.perception, [], [RL.sense]), groups: [GR.notice] },
  // Stealth (ST1–ST10): one function, two skills; code picks Combat Stealth in an engagement, Sneaking
  // otherwise. Stealth is movement (the move role), so leg wounds count, except when hiding. Rating: notice / offensive.
  sk(SK.sneaking, TR.stealth, [FN.stealth], [RL.move]),
  sk(SK.combat_stealth, TR.stealth, [FN.stealth], [RL.move]),
  sk(SK.vanishing, TR.stealth, [FN.stealth], [RL.move]), // ST11/ST18: breaks established sight
  // speech role: head wounds reduce speech rolls
  sk(SK.persuasion, TR.speech, [FN.influence], [RL.speech]),
  sk(SK.intimidation, TR.speech, [FN.influence], [RL.speech]),
  sk(SK.barter, TR.speech, [FN.influence], [RL.speech]),
  sk(SK.lying, TR.trickery, [FN.influence], [RL.speech]), // NT16: deceive rolls Lying
  { ...sk(SK.riposte, TR.swordsman, [], [RL.grip]), groups: [GR.melee, GR.defense], augments: [{ skill: SK.parry }] }, // adds its full value to every Parry roll
  { ...sk(SK.blade_dance, TR.sword_dancer, [], [RL.grip]), groups: [GR.melee, GR.defense], augments: [{ skill: SK.dodge }] }, // Riposte's mirror: adds its full value to every Dodge roll
  // Merchant's advanced barter: augments Barter, adding its effective value to every roll that asks for Barter
  { ...sk(SK.shrewd_dealing, TR.merchant, [], [RL.speech]), groups: [GR.influence], augments: [{ skill: SK.barter }] },
  // slime class skills are tier 0; tremor is no sense function of its own: it adds its full value to every hearing roll
  // (every hearing roll asks for Earshot, SENSE_SKILL)
  { ...sk(SK.tremor, TR.slime_senses, [], [RL.sense], 'sound', 'tier_0'), groups: [GR.notice], augments: [{ skill: SK.earshot }] },
  // FL1: the Sleight group (functionNames.ts): Lockpicking opens locks (BA2), Filching takes what others carry (src/engine/filch.ts);
  // each stands in for the other (CONFIG.SUBSTITUTES)
  sk(SK.lockpicking, TR.tools, [FN.lockpicking], [RL.grip]),
  sk(SK.filching, TR.tools, [FN.filching], [RL.grip]),
].map((s) => [s.id, s]));

/** ST21: situation tags per skill. Light reaches sight and stealth; cover reaches hide and ranged. */
const SITUATION_TAGS_OF: Record<string, SituationTag[]> = {
  [SK.melee_light]: ['sight'], [SK.melee_medium]: ['sight'], [SK.melee_heavy]: ['sight'],
  [SK.ranged_light]: ['sight', 'ranged'], [SK.ranged_medium]: ['sight', 'ranged'], [SK.ranged_heavy]: ['sight', 'ranged'],
  [SK.unarmed_strike]: ['sight'], [SK.unarmed_grapple]: ['sight'], [SK.unarmed_improvised]: ['sight'], [SK.unarmed_natural]: ['sight'],
  [SK.dodge]: ['sight'], [SK.block]: ['sight'], [SK.parry]: ['sight'], [SK.eyesight]: ['sight'], [SK.earshot]: ['hearing'], [SK.tremor]: ['hearing'], // hearing: no table reads it yet
  [SK.sneaking]: ['stealth'], [SK.combat_stealth]: ['stealth'], [SK.vanishing]: ['stealth', 'hide'],
};
for (const [id, tags] of Object.entries(SITUATION_TAGS_OF)) SKILLS[id].tags = tags;
// SR1: intimidation is open to any race with the Speech tree; persuasion and barter need a speaking race
for (const id of [SK.persuasion, SK.barter, SK.lying]) SKILLS[id].access = { must: [{ kind: 'raceTag', id: 'speaks' }] };

/** an attack mode with its reach in metres (real references) */
const mode = (m: Partial<import('../types').AttackMode> & Pick<import('../types').AttackMode, 'id' | 'tree' | 'class' | 'grips'> & { reachM: number }) => ({ ...m, reach: m.reachM });
const KIT = (skill = '$mode'): ItemEffect => ({ kind: 'skill', skill, value: 25, active: 'held', scope: 'withItem', kit: true });
/** armor numbers come from CONFIG (one source, Part 5 armor table) */
/** Improvised weapons: a melee strike and a throw (like throwing a vase), both rolled with
 * Improvisation. Unarmed skills stand in for both (its own function); Arms skills also stand in for the strike,
 * Ranged skills for the throw. */
const IMPROVISED_MODES = (cls: 'light' | 'medium' | 'heavy', grips: 1 | 2) => [
  mode({ id: AM.strike, tree: 'melee', class: cls, skill: SK.unarmed_improvised, reachM: 1.2, grips, hitAdj: CONFIG.IMPROVISED_HIT_ADJ, standInFns: [FN.arms] }),
  mode({ id: AM.throw, tree: 'ranged', class: cls, skill: SK.unarmed_improvised, reachM: CONFIG.THROW_M.improvised, grips, thrown: true, hitAdj: CONFIG.IMPROVISED_HIT_ADJ, standInFns: [FN.ranged] }),
];
/** QE4/QE5: armor stops ARMOR_FACTOR × need; a shield's pool is POOL_BASE + POOL_FACTOR × need (gear stats scale with need) */
const ARMOR = (w: ArmorWeightKey, level: string) => ({ reduction: CONFIG.ARMOR_FACTOR * CONFIG.EQUIP_NEED[level], multiplier: CONFIG.ARMOR_MULTIPLIER[w], weight: w });
const POOL = (level: string) => ({ pool: CONFIG.POOL_BASE + CONFIG.POOL_FACTOR * CONFIG.EQUIP_NEED[level] });
const WEIGHT = (v: number): ItemEffect => ({ kind: 'skill', skill: SK.dodge, value: v, active: 'worn', scope: 'any' });

/** class-level perks (ClassDef.levelPerks), granted by a class at a level */
const CLASS_PERKS: Record<string, PerkDef> = {
  [PK.past_the_pain]: {
    id: PK.past_the_pain, name: 'Past the Pain', built: true,
    story: 'Ten foes went down while one of your limbs hung useless. You stopped noticing.',
    rules: { kind: 'passive', trigger: 'the owner earns Bones Heal Later', conditions: [], effect: 'one Crippled part of the owner (the first in body order) gives no role penalty to rolls', lasts: 'always' },
  },
  [PK.nobody_special]: {
    id: PK.nobody_special, name: 'Nobody Special', built: true, classLevel: { classId: CL.commoner, level: 5 },
    story: 'Five seasons of ordinary work, and nobody noticed you. That can be a start.',
    rules: { kind: 'passive', trigger: 'the owner gains this perk at Commoner class level 5', conditions: ['the owner does not have the A Nobody class'], effect: 'the A Nobody class unlocks at class level 0', lasts: 'always' },
  },
  [PK.known_at_every_stall]: {
    id: PK.known_at_every_stall, name: 'Known at Every Stall', built: true, classLevel: { classId: CL.trader, level: 5 },
    story: 'Every stallholder knows your face and your prices. Time for a shop of your own.',
    rules: { kind: 'passive', trigger: 'the owner gains this perk at Trader class level 5', conditions: ['the owner does not have the Merchant class'], effect: 'the Merchant class unlocks at class level 0', lasts: 'always' },
  },
  [PK.every_fall_a_lesson]: {
    id: PK.every_fall_a_lesson, name: 'Every Fall a Lesson', built: true, classLevel: { classId: CL.a_nobody, level: 15 },
    story: 'You learned more from losing than most learn from winning.',
    rules: { kind: 'passive', trigger: 'the owner loses a contest or a defended attack by exactly one tier step', conditions: [], effect: 'the skill the owner rolled (and the skill asked for, when a stand-in rolled) is marked, even when the other side is outside the learning window', lasts: 'always' },
  },
  [PK.as_far_as_the_road_goes]: {
    id: PK.as_far_as_the_road_goes, name: 'As Far as the Road Goes', built: true, classLevel: { classId: CL.late_bloomer, level: 20 },
    story: 'You were never meant for one path, so you follow each one as far as it goes.',
    rules: { kind: 'passive', trigger: 'the owner reaches a 60, 80, 100, 120 or 140 milestone in any skill', conditions: [], effect: 'the perk there opens as soon as true skill reaches it, without the earlier ladder perks in that skill it normally needs', lasts: 'always' },
  },
  [PK.write_your_own_ending]: {
    id: PK.write_your_own_ending, name: 'Write Your Own Ending', built: true, classLevel: { classId: CL.late_bloomer, level: 20 },
    story: 'You were never meant for one path, so every path is yours.',
    rules: { kind: 'passive', trigger: 'the owner gains this perk', conditions: [], effect: 'every class in the library the owner does not have unlocks at class level 0, whether or not its unlock conditions are met', lasts: 'always' },
  },
  [PK.no_road_closed]: {
    id: PK.no_road_closed, name: 'No Road Closed', built: true, classLevel: { classId: CL.late_bloomer, level: 20 },
    story: 'You were never meant for one path, so no road is closed to you.',
    rules: { kind: 'passive', trigger: 'any check of whether the owner can use a skill tree or skill', conditions: [], effect: 'the access rules (Must, Either of, Blocked by) do not apply: every tree and skill is open, and its skills can be used, marked and raised', lasts: 'always' },
  },
  // a quirk no race, class or template has yet: the mechanism for a being that everyone fears or hates at first sight
  [PK.dreaded_on_sight]: {
    id: PK.dreaded_on_sight, name: 'Dreaded on Sight', built: true, quirk: true, onSight: { colder: 1, fear: FR.dreaded_sight },
    story: 'Something about you is wrong, and everyone feels it the moment they see you. Strangers stiffen, hands drift to weapons, and nobody is glad you came.',
    rules: { kind: 'Always on (quirk)', trigger: 'Anyone outside the owner\'s band sees the owner for the first time.', conditions: ['Once per person, for good.', 'The owner\'s bandmates are never affected.'],
      effect: 'They pay the fear "You set eyes on someone dreaded" (15 morale, scaled by their morale roll), in a fight or out of one. From then on their stance toward the owner reads one step colder than their band\'s (neutral becomes unfriendly, opposed becomes hostile), until play gives them a stance of their own toward the owner. The player holds no stances, so a player who sees the owner only pays the fear.', lasts: 'The colder stance lasts until that person\'s own stance toward the owner is set.' },
  },
  // the first essence trait (Tavern Brawler), and the first trade augment (D-276); a placeholder until the D-229 content round
  [PK.fists_do_the_talking]: {
    id: PK.fists_do_the_talking, name: 'Fists Do the Talking', built: true, augments: [{ from: SK.unarmed_strike, skill: SK.intimidation, kind: 'trade' }],
    story: 'Someone\'s brawls taught your fists to speak for you. Half your Strike now stands behind every threat you make, and your punches give that much up to do it.',
    rules: { kind: 'Always on (trait of the Tavern Brawler essence)', trigger: 'The owner makes an Intimidation roll, or a Strike roll.', conditions: ['The owner holds a Tavern Brawler essence.', 'The Unarmed tree is open to the owner.'],
      effect: 'Strike trades into Intimidation: every Intimidation roll adds the owner\'s true Strike × 0.5 (CONFIG.AUGMENT_TRADE_SHARE, placeholder) × its tier, and every Strike roll loses the same amount. Strike learns from the Intimidation rolls the way an augment does.', lasts: 'While a Tavern Brawler essence is held.' },
  },
  // SS10-SS12: sleep quirks, given by NPC templates through quirkTags (a rolled one per tag)
  [PK.heavy_sleeper]: {
    id: PK.heavy_sleeper, name: 'Heavy Sleeper', built: true, quirk: true, tags: ['sleep'],
    story: 'Once you are out, you are out. Shouting in the next room won\'t reach you; it takes a real racket, or a hand on your shoulder.',
    rules: { kind: 'Always on (quirk)', trigger: 'A noise reaches the sleeping owner.', conditions: [],
      effect: `The noise must be ${CONFIG.HEAVY_SLEEPER_STEPS} noise level louder than WAKE_NOISE (a shout) to wake the owner (CONFIG.HEAVY_SLEEPER_STEPS, placeholder). A blow still wakes them.`, lasts: 'Always.' },
  },
  [PK.insomniac]: {
    id: PK.insomniac, name: 'Insomniac', built: true, quirk: true, tags: ['sleep'], sleepClear: CONFIG.INSOMNIAC_CLEAR,
    story: 'You lie awake long after everyone else is snoring, and wake before you are rested. Sleep pays back your debt a quarter slower.',
    rules: { kind: 'Always on (quirk)', trigger: 'The owner sleeps.', conditions: [],
      effect: `Sleep clears sleep debt ×${CONFIG.INSOMNIAC_CLEAR} (sleepClear, CONFIG.INSOMNIAC_CLEAR, placeholder), with the bed and worn armour multipliers.`, lasts: 'Always.' },
  },
  [PK.quick_study]: {
    id: PK.quick_study, name: 'Quick Study', built: true, personality: { [PA.curiosity]: CONFIG.ACH_PERSONALITY_STEP }, classLevel: { classId: CL.late_bloomer, level: 1 }, improveRolls: { below: 15, rolls: 2 },
    story: 'You came to this late, and it shows in how fast you learn. A skill you have barely touched improves twice as readily.',
    rules: { kind: 'passive', trigger: 'an improvement roll for a marked skill', conditions: ['the skill\'s raw value is below 15'], effect: 'roll twice; each roll that passes adds its own gain', lasts: 'always' },
  },
  [PK.always_yours]: {
    id: PK.always_yours, name: 'What Was Always Yours', built: true, classLevel: { classId: CL.threadbounded, level: 1 }, grantsThreadboundItem: { minRank: 'rank_4' },
    story: 'Something was tied to you before you can remember. It has never once left your side for long.',
    rules: { kind: 'passive', trigger: 'the owner gains this perk', conditions: ['a Threadbound item of Rank IV or higher is not yet in the world'], effect: 'the owner gets one such item at random, bound to them and worn', lasts: 'once' },
  },
  // D-218: the Varo's Loop's abilities, given while its owner wears it and holds the achievement its grant names.
  // The passives widen the event roll both ways and never move its middle; the two actives fire by themselves on essence quality rolls.
  [PK.loose_odds]: {
    id: PK.loose_odds, name: 'Loose Odds', built: true, eventEdges: 5,
    story: 'Fate already turned on you once. Now it turns more easily, either way.',
    rules: { kind: 'passive', trigger: 'the owner\'s event roll', conditions: ['the owner wears the Varo\'s Loop and has earned Fate Meant It as a Curse'], effect: 'the 5 naturals just inside each critical range shift a tier outward: with no tiers opened, 91–95 raise a tier and 06–10 drop one; each opened tier moves them 5 further in', lasts: 'while worn' },
  },
  [PK.twin_abyss]: {
    id: PK.twin_abyss, name: 'Twin Abyss', built: true, tierUnlocks: [{ roll: 'event', side: 'up', steps: 1 }, { roll: 'event', side: 'down', steps: 1 }],
    story: 'You have seen how bad it gets. The earring promises it can get better by as much.',
    rules: { kind: 'passive', trigger: 'the owner\'s event roll', conditions: ['the owner wears the Varo\'s Loop and has earned Fate Has a Sense of Humour'], effect: 'one more tier opens past Critical Success and one below Critical Failure', lasts: 'while worn' },
  },
  [PK.call_the_toss]: {
    id: PK.call_the_toss, name: 'Call the Toss', built: true, essenceAuto: { kind: 'farther', cooldownMin: 1440 },
    story: 'When something offers you a piece of itself, the earring calls the toss for you. Whatever it gives will not be ordinary.',
    rules: { kind: 'active', trigger: 'the owner\'s essence quality roll, by itself once the cooldown has passed', conditions: ['the owner wears the Varo\'s Loop and has earned Fortune\'s Favourite Accident', 'All or Nothing is not firing on the same roll'], effect: 'the roll uses two dice and keeps the one farther from the middle (50.5)', lasts: 'that roll', cooldown: 'Once per game day.' },
  },
  [PK.pull_to_the_edges]: {
    id: PK.pull_to_the_edges, name: 'Pull to the Edges', built: true, eventSpread: 1.5,
    story: 'Nothing that happens around you is merely fine any more.',
    rules: { kind: 'passive', trigger: 'the owner\'s event roll', conditions: ['the owner wears the Varo\'s Loop and has earned Cursed by Coincidence'], effect: 'the die counts 1.5 times as far from the middle (50.5) for the margin; modifiers and the natural edges are unchanged', lasts: 'while worn' },
  },
  [PK.all_or_nothing]: {
    id: PK.all_or_nothing, name: 'All or Nothing', built: true, essenceAuto: { kind: 'all_or_nothing', cooldownMin: 10080 },
    story: 'When something offers you a piece of itself, the earring stakes everything. You get the rarest it has, or nothing at all.',
    rules: { kind: 'active', trigger: 'the owner\'s essence quality roll, by itself once the cooldown has passed', conditions: ['the owner wears the Varo\'s Loop and has earned The Joke Is on Fate'], effect: 'the roll is Critical Success on 51–100 and Critical Failure on 01–50 (a rare essence or none); it fires before Call the Toss, and only one fires per roll', lasts: 'that roll', cooldown: 'Once per 7 game days.' },
  },
  [PK.further_still]: {
    id: PK.further_still, name: 'Further Still', built: true, tierUnlocks: [{ roll: 'event', side: 'up', steps: 1 }, { roll: 'event', side: 'down', steps: 1 }],
    story: 'Fate keeps finding new ways to laugh at you. You have started laughing back.',
    rules: { kind: 'passive', trigger: 'the owner\'s event roll', conditions: ['the owner wears the Varo\'s Loop and has earned Fate\'s Favourite Punchline'], effect: 'one more tier opens past Critical Success and one below Critical Failure (on top of Twin Abyss)', lasts: 'while worn' },
  },
};

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(([
  { id: IT.dagger, edge: true, level: 'common', gearClass: GC.melee_light, tags: ['starter'], kind: 'weapon', name: 'dagger', look: 'a plain dagger', bulk: 1, value: 5, grips: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.slash, tree: 'melee', class: 'light', reachM: 1, grips: 1 }), mode({ id: AM.throw, tree: 'ranged', class: 'light', reachM: CONFIG.THROW_M.knife, grips: 1, thrown: true })] } },
  { id: IT.arming_sword, edge: true, level: 'fine', gearClass: GC.melee_medium, tags: ['starter'], kind: 'weapon', name: 'arming sword', look: 'a straight arming sword', bulk: 2, value: 20, grips: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.cut, tree: 'melee', class: 'medium', reachM: 1.6, grips: 1 })] } },
  { id: IT.greataxe, edge: true, level: 'superior', gearClass: GC.melee_heavy, kind: 'weapon', name: 'greataxe', look: 'a heavy two-handed axe', bulk: 3, value: 30, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.chop, tree: 'melee', class: 'heavy', reachM: 2.2, grips: 2 })] } },
  { id: IT.spear, level: 'fine', gearClass: GC.melee_medium, tags: ['starter'], kind: 'weapon', name: 'spear', look: 'an ash-shafted spear', bulk: 3, value: 10, grips: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.thrust, tree: 'melee', class: 'medium', reachM: 2.8, grips: 2 }), mode({ id: AM.throw, tree: 'ranged', class: 'medium', reachM: CONFIG.THROW_M.spear, grips: 1, thrown: true })] } },
  { id: IT.shortbow, level: 'common', gearClass: GC.ranged_light, tags: ['starter'], kind: 'weapon', shotTime: DU.bow_light, name: 'shortbow', look: 'a short hunting bow', bulk: 2, value: 25, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'light', reachM: 50, grips: 2 })] } },
  { id: IT.longbow, level: 'fine', gearClass: GC.ranged_medium, tags: ['starter'], kind: 'weapon', shotTime: DU.bow_medium, name: 'longbow', look: 'a tall longbow', bulk: 3, value: 35, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'medium', reachM: 90, grips: 2 })] } },
  { id: IT.crossbow, level: 'superior', gearClass: GC.ranged_heavy, kind: 'weapon', shotTime: DU.crossbow_shot, spanTime: DU.span_crossbow, name: 'crossbow', look: 'a heavy crossbow', bulk: 3, value: 40, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'heavy', reachM: 80, grips: 2 })] } },
  // SL12 test piece: a medium weapon whose basket hilt gives +5 Parry while held, apart from its requirement's skill
  { id: IT.basket_hilt_sword, edge: true, level: 'fine', gearClass: GC.melee_medium, kind: 'weapon', name: 'basket-hilted sword', look: 'a sword with a caged steel hilt', bulk: 2, value: 25, grips: 1,
    effects: [KIT(), { kind: 'skill', skill: SK.parry, value: 5, active: 'held', scope: 'any' }],
    weapon: { modes: [mode({ id: AM.cut, tree: 'melee', class: 'medium', reachM: 1.7, grips: 1 })] } },
  { id: IT.hidden_blade, edge: true, level: 'fine', gearClass: GC.melee_light, kind: 'weapon', name: 'hidden blade', look: 'a slim blade', bulk: 1, value: 30, grips: 1, concealed: true, hiddenAt: 'great_success', // SE9 placeholder
    effects: [KIT()],
    weapon: { modes: [mode({ id: AM.stab, tree: 'melee', class: 'light', reachM: 0.9, grips: 1 })] } },
  // Crude gear: level Crude needs 0. Only the clothes are in the starter kit; the crude weapons are library
  // items outside it. Clothes stop nothing and cost no Dodge (placeholders).
  { id: IT.crude_clothes, level: 'crude', gearClass: GC.armor_light, tags: ['starter'], kind: 'armor', name: 'rough clothes', look: 'rough homespun clothes', bulk: 1, value: 1, slot: 'armor',
    armor: { covers: ['general'], reduction: 0, multiplier: 1, weight: 'light' } },
  { id: IT.cudgel, level: 'crude', gearClass: GC.melee_medium, kind: 'weapon', name: 'cudgel', look: 'a knotted wooden cudgel', bulk: 2, value: 1, grips: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.club, tree: 'melee', class: 'medium', reachM: 1.3, grips: 1 })] } },
  { id: IT.rusty_knife, edge: true, level: 'crude', gearClass: GC.melee_light, kind: 'weapon', name: 'rusty knife', look: 'a rusty knife', bulk: 1, value: 1, grips: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.slash, tree: 'melee', class: 'light', reachM: 0.9, grips: 1 })] } },
  { id: IT.gambeson, level: 'common', gearClass: GC.armor_light, tags: ['starter'], kind: 'armor', name: 'gambeson', look: 'a quilted gambeson', bulk: 2, value: 15, slot: 'armor', effects: [WEIGHT(CONFIG.ARMOR_DODGE.light)],
    armor: { covers: ['general', 'left_arm', 'right_arm', 'left_leg', 'right_leg'], ...ARMOR('light', 'common') } },
  { id: IT.mail_hauberk, level: 'fine', gearClass: GC.armor_medium, tags: ['starter'], kind: 'armor', name: 'mail hauberk', look: 'a mail hauberk', bulk: 3, value: 60, slot: 'armor', effects: [WEIGHT(CONFIG.ARMOR_DODGE.medium)],
    armor: { covers: ['general', 'left_arm', 'right_arm'], ...ARMOR('medium', 'fine') } },
  { id: IT.plate_harness, level: 'superior', gearClass: GC.armor_heavy, kind: 'armor', name: 'plate harness', look: 'a full plate harness', bulk: 3, value: 200, slot: 'armor', effects: [WEIGHT(CONFIG.ARMOR_DODGE.heavy)],
    armor: { covers: ['general', 'left_arm', 'right_arm', 'left_leg', 'right_leg', 'head', 'neck'], ...ARMOR('heavy', 'superior'), pools: { head: 20 } } },
  { id: IT.round_shield, level: 'common', gearClass: GC.shield, tags: ['starter'], kind: 'shield', name: 'round shield', look: 'a painted round shield', bulk: 2, value: 10, grips: 1, effects: [KIT(SK.block)], shield: POOL('common') },
  // Starter pairs: every gear class but improvised has a Common (need 25) and a Fine (need 50) starter piece;
  // creation gives the highest one met per class (starterKit). Superior and Masterwork gear stays out of the kit.
  { id: IT.short_sword, edge: true, level: 'fine', gearClass: GC.melee_light, tags: ['starter'], kind: 'weapon', name: 'short sword', look: 'a short, broad-bladed sword', bulk: 1, value: 15, grips: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.stab, tree: 'melee', class: 'light', reachM: 1.3, grips: 1 })] } },
  { id: IT.hand_axe, edge: true, level: 'common', gearClass: GC.melee_medium, tags: ['starter'], kind: 'weapon', name: 'hand axe', look: 'a bearded hand axe', bulk: 2, value: 8, grips: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.chop, tree: 'melee', class: 'medium', reachM: 1.2, grips: 1 })] } },
  { id: IT.woodsman_axe, edge: true, level: 'common', gearClass: GC.melee_heavy, tags: ['starter'], kind: 'weapon', name: "woodsman's axe", look: 'a long-hafted felling axe', bulk: 3, value: 10, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.chop, tree: 'melee', class: 'heavy', reachM: 1.6, grips: 2 })] } },
  { id: IT.greatsword, edge: true, level: 'fine', gearClass: GC.melee_heavy, tags: ['starter'], kind: 'weapon', name: 'greatsword', look: 'a two-handed sword', bulk: 3, value: 25, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.cut, tree: 'melee', class: 'heavy', reachM: 2.3, grips: 2 })] } },
  { id: IT.recurve_bow, level: 'fine', gearClass: GC.ranged_light, tags: ['starter'], kind: 'weapon', shotTime: DU.bow_light, name: 'recurve bow', look: 'a horn-backed recurve bow', bulk: 2, value: 35, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'light', reachM: 70, grips: 2 })] } },
  { id: IT.flatbow, level: 'common', gearClass: GC.ranged_medium, tags: ['starter'], kind: 'weapon', shotTime: DU.bow_medium, name: 'flatbow', look: 'a plain flat-limbed bow', bulk: 3, value: 25, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'medium', reachM: 60, grips: 2 })] } },
  { id: IT.light_crossbow, level: 'common', gearClass: GC.ranged_heavy, tags: ['starter'], kind: 'weapon', shotTime: DU.crossbow_shot, spanTime: DU.span_light, name: 'light crossbow', look: 'a light crossbow', bulk: 3, value: 25, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'heavy', reachM: 60, grips: 2 })] } },
  { id: IT.stirrup_crossbow, level: 'fine', gearClass: GC.ranged_heavy, tags: ['starter'], kind: 'weapon', shotTime: DU.crossbow_shot, spanTime: DU.span_stirrup, name: 'stirrup crossbow', look: 'a crossbow with a foot stirrup', bulk: 3, value: 35, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'heavy', reachM: 70, grips: 2 })] } },
  { id: IT.boiled_leather, level: 'fine', gearClass: GC.armor_light, tags: ['starter'], kind: 'armor', name: 'boiled leather', look: 'a cuirass of hardened leather', bulk: 2, value: 30, slot: 'armor', effects: [WEIGHT(CONFIG.ARMOR_DODGE.light)],
    armor: { covers: ['general', 'left_arm', 'right_arm', 'left_leg', 'right_leg'], ...ARMOR('light', 'fine') } },
  { id: IT.brigandine, level: 'common', gearClass: GC.armor_medium, tags: ['starter'], kind: 'armor', name: 'brigandine', look: 'a riveted brigandine', bulk: 3, value: 30, slot: 'armor', effects: [WEIGHT(CONFIG.ARMOR_DODGE.medium)],
    armor: { covers: ['general', 'left_arm', 'right_arm'], ...ARMOR('medium', 'common') } },
  { id: IT.lamellar_coat, level: 'common', gearClass: GC.armor_heavy, tags: ['starter'], kind: 'armor', name: 'lamellar coat', look: 'a coat of laced lamellar plates', bulk: 3, value: 60, slot: 'armor', effects: [WEIGHT(CONFIG.ARMOR_DODGE.heavy)],
    armor: { covers: ['general', 'left_arm', 'right_arm', 'left_leg', 'right_leg'], ...ARMOR('heavy', 'common') } },
  { id: IT.half_plate, level: 'fine', gearClass: GC.armor_heavy, tags: ['starter'], kind: 'armor', name: 'half plate', look: 'a breastplate with arm and leg plates', bulk: 3, value: 120, slot: 'armor', effects: [WEIGHT(CONFIG.ARMOR_DODGE.heavy)],
    armor: { covers: ['general', 'left_arm', 'right_arm', 'left_leg', 'right_leg'], ...ARMOR('heavy', 'fine') } },
  { id: IT.kite_shield, level: 'fine', gearClass: GC.shield, tags: ['starter'], kind: 'shield', name: 'kite shield', look: 'a tall kite shield', bulk: 3, value: 20, grips: 1, effects: [KIT(SK.block)], shield: POOL('fine') },
  // D-218 Threadbound items: one of a kind; binds to the first who wears it; its abilities open with its owner's achievements
  { id: IT.varos_loop, kind: 'accessory', name: 'Varo\'s Loop', look: 'a small hoop earring of dark silver, worn smooth, stamped with the coin of Varo, god of fortune', bulk: 0, value: 400, boon: 20, slot: 'accessory', visible: true,
    threadbound: { rank: 'rank_4', grants: [
      { perk: PK.loose_odds, achievement: ACH.event_crit_1 }, { perk: PK.twin_abyss, achievement: ACH.event_crit_fail_1 },
      { perk: PK.call_the_toss, achievement: ACH.event_crit_2 }, { perk: PK.pull_to_the_edges, achievement: ACH.event_crit_fail_2 },
      { perk: PK.all_or_nothing, achievement: ACH.event_crit_3 }, { perk: PK.further_still, achievement: ACH.event_crit_fail_3 },
    ] } },
  { id: IT.signet_ring, kind: 'accessory', name: 'signet ring', look: 'a heavy signet ring', bulk: 0, value: 40, slot: 'accessory', visible: true },
  { id: IT.lucky_charm, kind: 'misc', fragility: 'delicate', name: 'lucky charm', look: 'a small knotted charm', bulk: 0, value: 50,
    effects: [{ kind: 'rollMod', roll: 'event', value: 5, active: 'carried', scope: 'any' }] },
  { id: IT.lockpicks, kind: 'tool', name: 'lockpicks', look: 'a roll of lockpicks', bulk: 0, value: 15, grips: 1,
    effects: [{ kind: 'skill', skill: SK.lockpicking, value: 25, active: 'inUse', scope: 'withItem' }] },
  { id: IT.healing_draught, kind: 'consumable', name: 'healing draught', look: 'a stoppered vial', bulk: 1, value: 10, grips: 1, stackable: true, consumable: true, heal: HL.draught },
  // generic bases for minted items with no close match, and for scenario objects the player grabs (loot L2, L3)
  { id: IT.improvised_light, level: 'common', gearClass: GC.improvised, kind: 'weapon', name: 'improvised weapon', look: 'something small grabbed to fight with', bulk: 1, value: 0, grips: 1, tags: ['improvised'],
    weapon: { modes: IMPROVISED_MODES('light', 1) } },
  { id: IT.improvised_medium, level: 'common', gearClass: GC.improvised, kind: 'weapon', name: 'improvised weapon', look: 'something grabbed to fight with', bulk: 2, value: 0, grips: 1, tags: ['improvised'],
    weapon: { modes: IMPROVISED_MODES('medium', 1) } },
  { id: IT.improvised_heavy, level: 'common', gearClass: GC.improvised, kind: 'weapon', name: 'improvised weapon', look: 'something heavy grabbed to fight with', bulk: 3, value: 0, grips: 2, tags: ['improvised'],
    weapon: { modes: IMPROVISED_MODES('heavy', 2) } },
  { id: IT.curio, kind: 'misc', fragility: 'delicate', name: 'curio', look: 'an odd little object', bulk: 1, value: 1 },
  { id: IT.bandage, kind: 'consumable', fragility: 'sturdy', name: 'bandage', look: 'a roll of linen bandage', bulk: 0, value: 2, stackable: true, consumable: true, heal: HL.bandage },
  { id: IT.key, kind: 'misc', fragility: 'unbreakable', name: 'key', look: 'an iron key', bulk: 0, value: 1 }, // BA3: opens the barriers its instance names
  // CT1: containers. A worn pack holds its wearer's stowed items (CT7); a chest or crate stands where it is put
  { id: IT.pack, kind: 'misc', name: 'pack', look: 'a canvas pack on shoulder straps', bulk: 2, value: 4, container: { worn: true, soft: true } },
  { id: IT.sack, kind: 'misc', name: 'sack', look: 'a tied hemp sack', bulk: 1, value: 1, container: { soft: true } },
  { id: IT.chest, kind: 'misc', name: 'chest', look: 'an iron-bound wooden chest', bulk: 3, value: 20, container: { fixed: true } },
  { id: IT.crate, kind: 'misc', name: 'crate', look: 'a nailed wooden crate', bulk: 3, value: 2, container: { fixed: true } },
  // PO1: pockets that gear adds (placeholders)
  { id: IT.belt_pouches, kind: 'accessory', name: 'belt with pouches', look: 'a leather belt hung with small pouches', bulk: 1, value: 3, slot: 'accessory', visible: true, pockets: 2 },
  { id: IT.bandolier, kind: 'accessory', name: 'bandolier', look: 'a leather strap across the chest, lined with loops and pockets', bulk: 1, value: 5, slot: 'accessory', visible: true, pockets: 4 },
  { id: IT.coin, kind: 'misc', fragility: 'unbreakable', name: 'coin', look: 'coins', bulk: 0, value: 1, stackable: true },
] as ItemDef[]).map((i) => [i.id, i]));

export const BODY_TYPES: Record<string, BodyType> = {
  [BT.humanoid]: {
    id: BT.humanoid, name: 'Humanoid', general: { name: 'torso', size: 'normal' },
    speed: { walk: 1.4, run: 5 }, // an everyday walk about 1.4 m/s; a run in kit about 5 m/s (a sprinter reaches 8–10)
    naturalAttacks: [{ id: AM.punch, tree: 'unarmed', class: 'punch', skill: SK.unarmed_strike, reachM: 0.7, reach: 0.7, grips: 0, name: 'fists' },
      { id: AM.grapple, tree: 'unarmed', class: 'grapple', skill: SK.unarmed_grapple, reachM: 0.6, reach: 0.6, grips: 0, name: 'grapple' }],
    parts: [
      { id: 'head', size: 'small', impact: 'essential', roles: [RL.sense, RL.speech], adjacent: ['general', 'neck'] },
      // FR2: an adult's arm reaches about 0.7 m from the shoulder to the fingertips (NASA-STD-3000 anthropometry), as fists do
      { id: 'left_arm', size: 'normal', impact: 'normal', roles: [RL.grip], reachM: 0.7 },
      { id: 'right_arm', size: 'normal', impact: 'normal', roles: [RL.grip], reachM: 0.7 },
      { id: 'left_leg', size: 'normal', impact: 'normal', roles: [RL.move] },
      { id: 'right_leg', size: 'normal', impact: 'normal', roles: [RL.move] },
      { id: 'neck', size: 'extra_small', impact: 'essential', roles: [], adjacent: ['head', 'general'] },
    ],
    fallback: { attackSkill: SK.unarmed_strike },
    // Side-sheet figure: one SVG path per part id, 'general' is the torso. Facing the viewer, so the
    // character's right side is drawn on the left.
    figure: {
      viewBox: '0 0 200 258',
      parts: {
        head: 'M100 5a19 22 0 1 0 0.01 0z',
        neck: 'M91 47h18l2 14H89z',
        general: 'M70 64q30-8 60 0l-4 46q-2 22 0 40H74q2-18 0-40z',
        right_arm: 'M68 66q-14 4-18 22l-8 52q-1 8 6 9t9-7l8-44z',
        left_arm: 'M132 66q14 4 18 22l8 52q1 8-6 9t-9-7l-8-44z',
        right_leg: 'M74 152h25l-2 96q0 6-7 6h-8q-6 0-6-6z',
        left_leg: 'M101 152h25l-2 96q0 6-6 6h-8q-7 0-7-6z',
      },
    },
  },
  // BR4: shape names, so later races can reuse them; Slime and Dragon are races
  [BT.amorphous]: {
    id: BT.amorphous, name: 'Amorphous', general: { name: 'body', size: 'normal' },
    speed: { walk: 0.5, run: 1 }, // no real reference: a placeholder for a creeping mass
    naturalAttacks: [{ id: AM.slam, tree: 'unarmed', class: 'slam', skill: SK.unarmed_natural, reachM: 0.5, reach: 0.5, grips: 0, name: 'slam' }],
    parts: [],
    fallback: { attackSkill: SK.unarmed_natural },
  },
  [BT.winged_quadruped]: {
    id: BT.winged_quadruped, name: 'Winged quadruped', general: { name: 'body', size: 'big' },
    speed: { walk: 1.8, run: 12 }, // a horse on the ground: walk about 1.8 m/s, gallop about 12 m/s (flight not modelled)
    naturalAttacks: [],
    parts: [
      // FR4: a quadruped takes and carries things in its jaws, as a dog or a horse does; a horse's head and neck reach about
      // 1.5 m forward of its chest
      { id: 'head', size: 'normal', impact: 'essential', roles: [RL.sense, RL.strike, RL.speech, RL.grip], reachM: 1.5 },
      { id: 'left_wing', size: 'normal', impact: 'non_essential', roles: [RL.fly] },
      { id: 'right_wing', size: 'normal', impact: 'non_essential', roles: [RL.fly] },
      { id: 'forelegs', size: 'normal', impact: 'normal', roles: [RL.move] },
      { id: 'hind_legs', size: 'normal', impact: 'normal', roles: [RL.move] },
      { id: 'tail', size: 'small', impact: 'non_essential', roles: [RL.strike] },
    ],
    fallback: { attackSkill: SK.unarmed_natural },
  },
};

/** PL11: a template's Nerve, trait and value points ([Proposed] numbers) */
/** AP2: an achievement's personality points, written in steps of CONFIG.ACH_PERSONALITY_STEP (the one balance lever) */
const ap = (steps: Record<string, number>): Record<string, number> => Object.fromEntries(Object.entries(steps).map(([k, n]) => [k, n * CONFIG.ACH_PERSONALITY_STEP]));
const pers = (nerve: number, traits: Record<string, number> = {}, values: string[] = []): Personality => ({ nerve, traits, values });

/** NG2, NG21: NPC roles: the skills each kind of work trains, by band (CONFIG.ROLE_BAND_SHARE of the rank's anchor) */
export const NPC_ROLES: Record<string, NpcRoleDef> = Object.fromEntries(([
  [RO.soldier, 'Soldier', { high: [SK.melee_medium, SK.block], moderate: [SK.medium_armor, SK.endurance, SK.intimidation], low: [SK.parry] }], // Block is their defense
  [RO.skirmisher, 'Skirmisher', { high: [SK.melee_light, SK.dodge], moderate: [SK.light_armor, SK.ranged_light], low: [SK.sneaking, SK.endurance] }],
  [RO.brute, 'Brute', { high: [SK.melee_heavy, SK.unarmed_strike], moderate: [SK.endurance, SK.intimidation, SK.unarmed_grapple], low: [SK.heavy_armor] }],
  [RO.shooter, 'Shooter', { high: [SK.ranged_medium], moderate: [SK.ranged_light, SK.eyesight, SK.dodge], low: [SK.light_armor, SK.melee_light] }],
  [RO.sneak, 'Sneak', { high: [SK.sneaking, SK.melee_light], moderate: [SK.combat_stealth, SK.vanishing, SK.dodge], low: [SK.light_armor, SK.lying, SK.filching, SK.lockpicking] }],
  [RO.watcher, 'Watcher', { high: [SK.eyesight, SK.earshot], moderate: [SK.insight, SK.intimidation], low: [SK.melee_medium, SK.persuasion] }],
  [RO.talker, 'Talker', { high: [SK.persuasion, SK.barter], moderate: [SK.insight, SK.lying, SK.earshot], low: [SK.eyesight] }],
  [RO.worker, 'Worker', { high: [SK.endurance], moderate: [SK.unarmed_strike, SK.stamina], low: [SK.persuasion] }],
  [RO.beast, 'Beast', { high: [SK.unarmed_natural], low: [SK.dodge] }],
] as const).map(([id, name, bands]) => [id, { id, name, bands: bands as unknown as NpcRoleDef['bands'] }]));

/** NG21: NPC themes: what their world adds; per-theme rank titles come from the lore thread */
export const THEMES: Record<string, ThemeDef> = {
  [TH.village_folk]: { id: TH.village_folk, name: 'Village folk', bands: { low: [SK.persuasion] } },
  [TH.town_watch]: { id: TH.town_watch, name: 'Town watch', bands: { moderate: [SK.eyesight], low: [SK.intimidation, SK.persuasion] } },
  [TH.road_bandits]: { id: TH.road_bandits, name: 'Road bandits', bands: { moderate: [SK.intimidation], low: [SK.sneaking] } },
  [TH.wild_beasts]: { id: TH.wild_beasts, name: 'Wild beasts' },
};

/** NG1, NG21: today's five templates as presets (same TP IDs): race, role, theme and rank, at the ranks they played at.
 * minimums are hand-set floors the story needs; class floors are added in code. */
export const TEMPLATES: Record<string, NpcTemplate> = {
  [TP.slime]: {
    id: TP.slime, raceId: RC.slime, generation: 'copy', minimums: { [SK.unarmed_natural]: 30, [SK.tremor]: 50 },
    roleId: RO.beast, themeId: TH.wild_beasts, rank: 'rank_0', resolve: 50, personality: pers(0), control: 'code', label: 'a slime', chase: 'far', // CH5: monsters hunt anywhere
    fallback: { attackSkill: SK.unarmed_natural },
  },
  [TP.guard]: {
    id: TP.guard, raceId: RC.human, classId: CL.guard, generation: 'copy', // its class floors (the Guard unlock) raise its minimums
    minimums: { [SK.melee_medium]: 50, [SK.medium_armor]: 50, [SK.block]: 30, [SK.dodge]: 20, [SK.eyesight]: 40, [SK.earshot]: 30, [SK.intimidation]: 30, [SK.persuasion]: 20 }, // AR9/EQ5: meets its loadout's requirements; BF17: Eyesight 40, a search's skill, above a thief's
    // Anyone with fighting experience is at least level 4 (Trained); any patrolling template has Keen Ear
    roleId: RO.soldier, themeId: TH.town_watch, rank: 'rank_2', perks: [PK.keen_ear],
    resolve: 50, personality: pers(0, { [PA.discipline]: 40 }, [VL.duty]), loadout: [IT.arming_sword, IT.mail_hauberk, IT.round_shield], control: 'agent', label: 'a village guard', chase: 'ground', // a gate warden's shield: Block, not Parry; CH5: guards keep to the scenario's ground
  },
  [TP.trader]: {
    id: TP.trader, raceId: RC.human, classId: CL.trader, generation: 'copy',
    minimums: { [SK.eyesight]: 25, [SK.earshot]: 25, [SK.barter]: 40, [SK.persuasion]: 30 }, roleId: RO.talker, themeId: TH.village_folk, rank: 'rank_1', // Villagers are at least level 2 (Novice)
    resolve: 30, personality: pers(-40, { [PA.sociability]: 20 }, [VL.wealth]), control: 'code', label: 'the barkeep', chase: 'post', // CH5: townsfolk never leave their own place
  },
  // NS7: a village thief, the first stealthy NPC
  [TP.thief]: {
    id: TP.thief, raceId: RC.human, generation: 'copy',
    minimums: { [SK.sneaking]: 40, [SK.combat_stealth]: 30, [SK.vanishing]: 30, [SK.melee_light]: 35, [SK.light_armor]: 25, [SK.dodge]: 30, [SK.eyesight]: 30, [SK.earshot]: 30, [SK.lying]: 30 }, roleId: RO.sneak, themeId: TH.village_folk, rank: 'rank_2', // fighting experience: level 4 (Trained)
    resolve: 30, personality: pers(-40, { [PA.honesty]: -40 }, [VL.wealth]), loadout: [IT.dagger, IT.gambeson], control: 'agent', label: 'a shifty villager', chase: 'post',
  },
  [TP.patron]: {
    id: TP.patron, raceId: RC.human, generation: 'copy',
    minimums: { [SK.unarmed_strike]: 20, [SK.eyesight]: 20, [SK.persuasion]: 30 }, roleId: RO.worker, themeId: TH.village_folk, rank: 'rank_1',
    resolve: 30, personality: pers(-40, { [PA.sociability]: 20 }, [VL.pleasure]), control: 'code', label: 'a tavern patron', chase: 'post',
  },
};

const act = (id: string, look: string, attention: ActivityDef['attention'], noise: ActivityDef['noise'], visibility: ActivityDef['visibility']): ActivityDef =>
  ({ id, look, attention, noise, visibility });
/** FR2: furniture each zone kind gets unless a layout or the Weaver lists its own (colour, mostly: FR1) */
const KIND_FURNITURE: Record<string, import('../types').PlanFurniture[]> = {
  [ZK.room]: [{ kind: FU.table, name: 'table' }, { kind: FU.bench, name: 'bench', at: 'w' }],
  [ZK.cellar]: [{ kind: FU.barrels, name: 'barrels', at: 'n' }, { kind: FU.sacks, name: 'sacks', at: 'e' }],
  [ZK.yard]: [{ kind: FU.woodpile, name: 'woodpile', at: 'e' }, { kind: FU.water_barrel, name: 'rain barrel', at: 'nw' }],
  [ZK.square]: [{ kind: FU.well, name: 'well' }],
  [ZK.street]: [{ kind: FU.cart, name: 'handcart', at: 's' }],
};
export const ACTIVITIES: Record<string, ActivityDef> = Object.fromEntries([
  act('stand_watch', 'keeping watch', 'alert', 'silent', 'normal'),
  act('search', 'searching', 'alert', 'quiet', 'normal'), // SE16: an alert sweep searches at each stop
  act('walk', 'walking', 'normal', 'quiet', 'normal'),
  act('work', 'hard at work', 'normal', 'normal', 'normal'),
  act('tend_counter', 'tending the counter', 'normal', 'quiet', 'normal'),
  act('drink', 'nursing a drink', 'distracted', 'quiet', 'normal'),
  act('chat', 'chatting', 'distracted', 'normal', 'normal'),
  act('sleep', 'asleep', 'asleep', 'quiet', 'low'),
  act('eat', 'eating', 'distracted', 'quiet', 'normal'),
  act('rest', 'resting', 'distracted', 'silent', 'low'),
  act('cower', 'keeping out of sight', 'alert', 'silent', 'close'), // NV4
  act('cowering', 'cowering where they stand', 'alert', 'quiet', 'normal'), // BF37: a broken nerve, no move and no attack
  act('ooze', 'oozing across the grass', 'normal', 'quiet', 'normal'),
  act('prowl', 'keeping to the shadows', 'alert', 'silent', 'close'), // NV4
].map((a) => [a.id, a]));

const CALL_HELP = { type: 'call_help', target: null, skill: null, intent: 'call for help' } as const;
const sched = (id: string, brief: string, loop: boolean, steps: [string, Routine['steps'][0]['duration'], string][], alert: string | undefined, onAlert: Routine['onAlert']): Routine =>
  ({ id, brief, kind: 'schedule', loop, steps: steps.map(([slot, duration, activity]) => ({ slot, duration, activity })), ...(alert ? { alert } : {}), onAlert });
const still = (id: string, kind: 'wait' | 'follow' | 'head', activity: string, brief: string, alert?: string): Routine =>
  ({ id, brief, kind, loop: false, steps: [], activity, ...(alert ? { alert } : {}), onAlert: null });

/** NW10/NW13: steps for some times of day (RT1–RT9); the routine's own steps serve every other time */
const at = (times: import('../scales').TimeOfDay[], steps: [string, Routine['steps'][0]['duration'], string][]) =>
  ({ at: times, steps: steps.map(([slot, duration, activity]) => ({ slot, duration, activity })) });
const timed = (r: Routine, ...times: ReturnType<typeof at>[]): Routine => ({ ...r, times });
const OFF_DUTY = [at(['evening'], [['seat', 'medium', 'drink'], ['seat', 'short', 'chat']]), at(['night'], [['bed', 'long', 'sleep']])];
const DAY_SLEEP = at(['morning', 'afternoon'], [['bed', 'long', 'sleep']]);

export const ROUTINES: Record<string, Routine> = Object.fromEntries([
  // RT1/RT2: on duty from dawn to dusk, off duty in the evening, asleep at night; the night watch is the mirror
  timed(sched('guard_post', 'Stands watch at the post by day; drinks in the evening, sleeps at night', true, [['post', 'long', 'stand_watch']], 'hold_post_alert', { ...CALL_HELP }), ...OFF_DUTY),
  timed(sched('night_guard_post', 'Stands watch at the post from dusk to dawn; sleeps by day', true, [['post', 'long', 'stand_watch']], 'hold_post_alert', { ...CALL_HELP }), DAY_SLEEP),
  sched('hold_post_alert', 'Holds the post on alert', true, [['post', 'long', 'stand_watch']], undefined, null),
  timed(sched('patrol', 'Walks the beat by day; drinks in the evening, sleeps at night', true, [['route', 'short', 'walk']], 'search_route_alert', { ...CALL_HELP }), ...OFF_DUTY),
  timed(sched('night_patrol', 'Walks the beat from dusk to dawn; sleeps by day', true, [['route', 'short', 'walk']], 'search_route_alert', { ...CALL_HELP }), DAY_SLEEP),
  sched('search_route_alert', 'Sweeps the beat fast, searching at each stop, on alert', true, [['route', 'brief', 'search']], undefined, null),
  // RT3: the tavern closes when the night starts
  timed(sched('tend_bar', 'Works behind the bar from morning to evening; sleeps at night', true, [['counter', 'long', 'tend_counter']], 'flee_to_refuge_alert', null),
    at(['night', 'dawn'], [['bed', 'long', 'sleep']])),
  // RT4: a patron drinks from dusk; by day they are home or out at work
  timed(sched('drink_at_seat', 'Drinks and chats at a seat from dusk; home asleep at night, out by day', true, [['seat', 'medium', 'drink'], ['seat', 'short', 'chat']], 'flee_to_refuge_alert', null),
    at(['night', 'dawn', 'morning'], [['bed', 'long', 'sleep']]), at(['afternoon'], [['exit', 'long', 'walk']])),
  // RT5: a guest sleeps the night, eats in the morning, goes out, and drinks in the evening
  timed(sched('sleep_in_bed', 'Sleeps in bed at night; eats, goes out and drinks by day', true, [['bed', 'long', 'sleep']], 'flee_to_refuge_alert', null),
    at(['morning'], [['seat', 'medium', 'eat']]), at(['afternoon'], [['exit', 'long', 'walk']]), at(['dusk', 'evening'], [['seat', 'medium', 'drink'], ['seat', 'short', 'chat']])),
  // RT6: home at night, at work through the day
  timed(sched('work_shift', 'Works with short breaks by day; home in the evening and asleep at night', true, [['work', 'long', 'work'], ['work', 'brief', 'rest']], 'flee_to_refuge_alert', null),
    at(['dawn'], [['work', 'long', 'walk']]), at(['dusk'], [['work', 'long', 'rest']]), at(['evening'], [['bed', 'long', 'rest']]), at(['night'], [['bed', 'long', 'sleep']])),
  sched('flee_to_refuge_alert', 'Hides in the refuge', false, [['refuge', 'long', 'cower']], undefined, null),
  sched('leave_by_exit', 'Heads for the exit and lingers', false, [['exit', 'long', 'rest']], 'flee_to_refuge_alert', null),
  still('wait', 'wait', 'rest', 'Waits where it stands', 'wait_alert'),
  still('wait_alert', 'wait', 'stand_watch', 'Waits on guard where it stands'),
  still('follow', 'follow', 'walk', 'Follows the player', 'follow_alert'),
  still('follow_alert', 'follow', 'stand_watch', 'Follows the player, on guard'),
  still('idle_here', 'wait', 'rest', 'Fallback only; in no set'),
  still('head_to', 'head', 'walk', 'Heads for the place its agent named, then back to its routine; in no set (NW2)'),
  // RT7: a thief works the crowds and the dark, and sleeps it off in the morning
  { ...timed(sched('prowl', 'Prowls unseen, stop by stop, from afternoon to night; sleeps at dawn and in the morning', true, [['route', 'short', 'prowl']], 'lie_low_alert', null),
    at(['dawn', 'morning'], [['refuge', 'long', 'sleep']])), posture: 'stealthy' as const },
  { ...sched('lie_low_alert', 'Slips off to lie low, on alert', false, [['refuge', 'long', 'cower']], undefined, null), posture: 'stealthy' as const },
  // RT9: a slime settles for the evening and night
  timed(sched('roam_field', 'Oozes across the field by day, then settles; still at night', true, [['route', 'short', 'ooze'], ['post', 'medium', 'rest']], 'roam_field_alert', null),
    at(['evening', 'night'], [['post', 'long', 'rest']])),
  sched('roam_field_alert', 'Sweeps the field fast on alert; never flees', true, [['route', 'brief', 'ooze']], undefined, null),
].map((r) => [r.id, r]));

const set = (id: string, brief: string, place: string[], role: string[], time: RoutineSet['tags']['time'], slots: RoutineSet['slots'], routines: string[]): RoutineSet =>
  ({ id, brief, tags: { place, role, time, event: ['ordinary'] }, slots, routines });
/** NW4: the kinds that lead onward (a street, square, gate, field, woods or road never ends in a wall); yards and rooms may */
const ONWARD_KINDS = new Set<string>([ZK.street, ZK.square, ZK.gate, ZK.field, ZK.woods, ZK.road]);
const z = (hint: string) => ({ kind: 'zone' as const, hint });
/** RT: an optional slot; left unbound, the actor stays where it is at the times that read it */
const oz = (hint: string) => ({ kind: 'zone' as const, hint, optional: true as const });
const BED = oz('where they sleep (home for townsfolk)'), SEAT = oz('where they sit to eat or drink'), OUT = oz('the way out of the place');
const r = (hint: string) => ({ kind: 'route' as const, hint });
export const ROUTINE_SETS: Record<string, RoutineSet> = Object.fromEntries([
  set('gate_guard', 'A guard posted at one spot by day', ['gate', 'street'], ['guard'], ['any'], { post: z('where the guard stands'), seat: SEAT, bed: BED }, ['guard_post', 'hold_post_alert', 'wait', 'wait_alert']),
  set('night_gate_guard', 'A guard posted at one spot through the night', ['gate', 'street'], ['guard'], ['any'], { post: z('where the guard stands'), bed: BED }, ['night_guard_post', 'hold_post_alert', 'wait', 'wait_alert']),
  set('patrol_guard', 'A guard walking a beat by day', ['gate', 'street'], ['guard'], ['any'], { route: r("the beat's stops, in order"), seat: SEAT, bed: BED }, ['patrol', 'search_route_alert', 'wait', 'wait_alert']),
  set('night_patrol_guard', 'A guard walking a beat through the night', ['gate', 'street'], ['guard'], ['any'], { route: r("the beat's stops, in order"), bed: BED }, ['night_patrol', 'search_route_alert', 'wait', 'wait_alert']),
  set('barkeep', 'Runs the bar', ['tavern'], ['trader'], ['any'], { counter: z('behind the bar'), refuge: z('back room or cellar'), bed: BED }, ['tend_bar', 'flee_to_refuge_alert', 'wait', 'wait_alert']),
  set('patron', 'A customer drinking', ['tavern'], ['patron'], ['any'], { seat: z('where they sit'), refuge: z('where they would hide'), exit: z('the way out'), bed: BED }, ['drink_at_seat', 'flee_to_refuge_alert', 'leave_by_exit', 'wait', 'wait_alert']),
  set('sleeper', 'A guest staying the night', ['tavern'], ['sleeper'], ['any'], { bed: z('their bed'), refuge: z('where they would hide'), seat: SEAT, exit: OUT }, ['sleep_in_bed', 'flee_to_refuge_alert', 'wait', 'wait_alert']),
  set('street_worker', 'A labourer or stallholder at work', ['street'], ['worker'], ['any'], { work: z('the work spot'), refuge: z('home or a doorway'), bed: BED }, ['work_shift', 'flee_to_refuge_alert', 'wait', 'wait_alert']),
  set('thief', 'A thief prowling for an easy mark', ['street', 'tavern'], ['thief'], ['any'], { route: r('the stops it prowls, in order'), refuge: z('where it lies low') }, ['prowl', 'lie_low_alert', 'wait', 'wait_alert']),
  set('companion', "The player's band; not chosen by tags", [], [], [], {}, ['follow', 'follow_alert', 'wait', 'wait_alert']),
  set('slime_wander', 'A slime roaming the field outside the gate', ['field'], ['creature'], ['any'], { route: r('across the field, in order'), post: z('where it settles') }, ['roam_field', 'roam_field_alert']),
].map((s) => [s.id, s]));

// BR9: a rule names a body type or a race; a block the shape already gives is not repeated on the race
const AMORPHOUS: AccessCond = { kind: 'body', id: BT.amorphous }; // no hands, eyes, ears or voice

export function prototypeLibrary(): Library {
  const lib: Library = structuredClone({
    version: 1,
    status: Object.fromEntries(Object.entries(OLD_SKILL_IDS).map(([old, to]) => [old, { state: 'renamed' as const, to }])), // old name IDs → numbers
    skills: SKILLS,
    // Skill tree access (TA1–TA11): each tree's own rule; no rule = open to everyone.
    // shortcut: slime and dragon are body types until the race split (BR answers) lands, then these name the races.
    trees: {
      [TR.melee]: { id: TR.melee, name: 'Combat – Arms', skills: [SK.melee_light, SK.melee_medium, SK.melee_heavy], access: { blockedBy: [AMORPHOUS] } },
      [TR.ranged]: { id: TR.ranged, name: 'Combat – Ranged', skills: [SK.ranged_light, SK.ranged_medium, SK.ranged_heavy], access: { blockedBy: [AMORPHOUS] } },
      [TR.unarmed]: { id: TR.unarmed, name: 'Combat – Unarmed', skills: [SK.unarmed_strike, SK.unarmed_grapple, SK.unarmed_improvised], access: { blockedBy: [AMORPHOUS] } },
      [TR.natural]: { id: TR.natural, name: 'Natural weapons', skills: [SK.unarmed_natural], access: { either: [AMORPHOUS, { kind: 'race', id: RC.dragon }] } /* the shape's slam; the dragon's own attacks */ },
      [TR.defense]: { id: TR.defense, name: 'Combat – Defense', skills: [SK.dodge, SK.block, SK.parry] },
      [TR.fortitude]: { id: TR.fortitude, name: 'Fortitude', skills: [SK.endurance, SK.resolve, SK.stamina] },
      [TR.armor]: { id: TR.armor, name: 'Armor – Conventional', skills: [SK.light_armor, SK.medium_armor, SK.heavy_armor], access: { blockedBy: [AMORPHOUS] } }, // AR6
      [TR.perception]: { id: TR.perception, name: 'Perception', skills: [SK.eyesight, SK.earshot, SK.insight], access: { blockedBy: [AMORPHOUS] } }, // no eyes or ears (TA6)
      [TR.stealth]: { id: TR.stealth, name: 'Stealth – Conventional', skills: [SK.sneaking, SK.combat_stealth, SK.vanishing] },
      [TR.speech]: { id: TR.speech, name: 'Speech', skills: [SK.persuasion, SK.intimidation, SK.barter], access: { blockedBy: [AMORPHOUS] } },
      [TR.trickery]: { id: TR.trickery, name: 'Trickery', skills: [SK.lying], access: { blockedBy: [AMORPHOUS] } },
      [TR.swordsman]: { id: TR.swordsman, name: 'Swordsman', skills: [SK.riposte], access: { must: [{ kind: 'class', id: CL.swordsman }] } },
      [TR.merchant]: { id: TR.merchant, name: 'Merchant', skills: [SK.shrewd_dealing], access: { must: [{ kind: 'class', id: CL.merchant }] } },
      [TR.sword_dancer]: { id: TR.sword_dancer, name: 'Sword-dancer', skills: [SK.blade_dance], access: { must: [{ kind: 'class', id: CL.sword_dancer }] } }, // mirrors Swordsman
      // BR7: from being a slime, not from a class
      [TR.slime_senses]: { id: TR.slime_senses, name: 'Slime senses', rating: 'inferior', skills: [SK.tremor], access: { must: [{ kind: 'race', id: RC.slime }] } },
      [TR.tools]: { id: TR.tools, name: 'Tools (placeholder, OQ-20)', skills: [SK.lockpicking, SK.filching], access: { blockedBy: [AMORPHOUS] } },
    },
    classes: {
      // Parry 40 and Medium or Heavy Weapons 40 unlock the class; Medium Weapons 40 and Parry 40 are its creation floors
      [CL.swordsman]: { id: CL.swordsman, personality: { [PA.discipline]: CONFIG.ACH_PERSONALITY_STEP }, name: 'Swordsman', tier: 'tier_1', label: 'a swordsman', story: 'Blade against blade, drilled until the parry comes before the thought does.', floors: { [SK.melee_medium]: 40, [SK.parry]: 40 }, unlock: { [SK.parry]: 40 }, unlockAny: [{ [SK.melee_medium]: 40, [SK.melee_heavy]: 40 }] },
      // The late bloomer's creation option: 50 points, level 1, a unique class with a level 1 perk
      [CL.late_bloomer]: { id: CL.late_bloomer, personality: { [PA.curiosity]: CONFIG.ACH_PERSONALITY_STEP }, name: 'Unwritten Legend', tier: 'tier_5', label: 'a young stranger', story: 'No song carries your name, no master claimed you, and no road was chosen for you. You start late, in rough clothes with empty hands. Whatever story ends with your name, you will write it yourself.', floors: {}, creation: { points: 50, level: 1 }, levelPerks: { 1: [PK.quick_study] }, capstone: [PK.as_far_as_the_road_goes],
        capstones: [{ perk: PK.write_your_own_ending, needs: { must: [{ kind: 'classes', id: '', level: 7 }] } },
          { perk: PK.no_road_closed, needs: { must: [{ kind: 'allStep', id: '50', level: 1 }, { kind: 'skillsAbove', id: '15', level: 10 }] } }] },
      // TB7: the Threadbounded class, used only by The Threadbound start (50 points, level 1); its level 1 perk gives a random Threadbound item. No unlock
      [CL.threadbounded]: { id: CL.threadbounded, name: 'Threadbounded', tier: 'tier_4', label: 'a young stranger', story: 'Something was tied to you before you were old enough to know it. It answers when you call, and nothing has ever taken it from you for long.', floors: {}, creation: { points: 50, level: 1, name: 'The Threadbound' }, levelPerks: { 1: [PK.always_yours] } },
      // Sword-dancer mirrors the Swordsman: its skills and perks are meant to be the Swordsman's, built for Dodge and
      // light or medium blades. Unlocks at Dodge 40 and Light or Medium Weapons 40; no tree, floors or creation start yet.
      [CL.sword_dancer]: { id: CL.sword_dancer, personality: { [PA.levity]: CONFIG.ACH_PERSONALITY_STEP }, name: 'Sword-dancer', tier: 'tier_1', story: 'Blade and footwork, drilled until the step comes before the thought does.', floors: {}, unlock: { [SK.dodge]: 40 }, unlockAny: [{ [SK.melee_light]: 40, [SK.melee_medium]: 40 }] },
      // the default class: opens when the current class is at its top level; its capstone (at 5, tier 0) unlocks A Nobody
      [CL.commoner]: { id: CL.commoner, name: 'Commoner', tier: 'tier_0', story: 'Plain work and plain days.', floors: {}, fallback: true, capstone: [PK.nobody_special] },
      // a starting class (50 points, level 1, like the Unwritten Legend); others unlock it through Commoner 5's perk
      [CL.a_nobody]: { id: CL.a_nobody, personality: { [PA.pride]: -CONFIG.ACH_PERSONALITY_STEP }, name: 'A Nobody', tier: 'tier_2', label: 'a nobody', story: 'Nobody watches a nobody, and you have learned to use that.', floors: {}, creation: { points: 50, level: 1 }, unlockPerk: PK.nobody_special,
        levelPerks: { 1: [PK.quick_study] }, capstone: [PK.every_fall_a_lesson] },
      // PY2: every NPC that sells has this class; Barter 20 unlocks it
      // any weapon, any armor and any defense skill, and a perk that adds a hearing link (Keen Ear, which patrol templates have)
      [CL.guard]: { id: CL.guard, personality: { [PA.discipline]: CONFIG.ACH_PERSONALITY_STEP }, name: 'Guard', tier: 'tier_1', label: 'a guard', story: 'Stand at the gate and listen for trouble.', floors: {},
        unlockAny: [{ [SK.melee_light]: 40, [SK.melee_medium]: 40, [SK.melee_heavy]: 40, [SK.ranged_light]: 40, [SK.ranged_medium]: 40, [SK.ranged_heavy]: 40 },
          { [SK.light_armor]: 40, [SK.medium_armor]: 40, [SK.heavy_armor]: 40 }, { [SK.block]: 30, [SK.dodge]: 30, [SK.parry]: 30 }] as Record<string, number>[],
        unlockPerkWith: { hearingDb: 1 } },
      [CL.trader]: { id: CL.trader, personality: { [PA.sociability]: CONFIG.ACH_PERSONALITY_STEP }, name: 'Trader', tier: 'tier_0', label: 'a trader', story: 'Buy low, sell higher.', floors: {}, unlock: { [SK.barter]: 20 }, capstone: [PK.known_at_every_stall] },
      [CL.merchant]: { id: CL.merchant, personality: { [PA.pride]: CONFIG.ACH_PERSONALITY_STEP }, name: 'Merchant', tier: 'tier_1', label: 'a merchant', story: 'A trader who owns the stall.', floors: {}, unlockPerk: PK.known_at_every_stall }, // the Trader capstone
    },
    // PY3: what sellers can offer besides goods; prices are base prices before the markup (placeholders).
    // heals: a healing row the service pays for (PY8: the clinic's care is bought, then used by resting there)
    services: {
      [SV.drink]: { id: SV.drink, name: 'drink', price: 1 },
      [SV.meal]: { id: SV.meal, name: 'meal', price: 2 },
      [SV.bed]: { id: SV.bed, name: 'bed for the night', price: 5 },
      [SV.bath]: { id: SV.bath, name: 'bath', price: 2 },
      [SV.clinic]: { id: SV.clinic, name: 'clinic care', price: 20, heals: HL.clinic },
    },
    // growth proposal 2.2: essences. Placeholder rows for the engine; the content round (one table per race and body type,
    // with traits) belongs to the lore and loot threads (D-228). EG11 b: the story may name the thread; never numbers.
    essences: {
      [ES.gel_patience]: { id: ES.gel_patience, name: 'Gel Patience', from: { race: RC.slime }, weight: 1, skills: [{ skill: SK.unarmed_natural, weight: 2 }, { skill: SK.tremor, weight: 1 }], // EN5: slimes have no Endurance
        story: 'A strand of the slime\'s slow patience knots into yours. Footsteps reach you through the floor before your ears catch them, and your body starts to feel like the weapon.' },
      [ES.gate_habit]: { id: ES.gate_habit, name: 'Gate-Warden\'s Habit', from: { race: RC.human }, weight: 1, skills: [{ skill: SK.block, weight: 2 }, { skill: SK.earshot, weight: 1 }],
        story: 'You catch yourself turning a shoulder toward the door before you decide to, as if someone else\'s long watches were knotted into yours.' },
      [ES.street_instinct]: { id: ES.street_instinct, name: 'Street Instinct', from: { race: RC.human }, weight: 1, skills: [{ skill: SK.dodge, weight: 2 }, { skill: SK.insight, weight: 1 }],
        story: 'A crowd reads differently now. You feel the reaching hand before it moves, the way they must have felt it.' },
      // EN6: placeholder rows so the barkeep and the tavern patron each carry one
      [ES.haggler_ear]: { id: ES.haggler_ear, name: 'Haggler\'s Ear', from: { race: RC.human }, weight: 1, skills: [{ skill: SK.barter, weight: 2 }, { skill: SK.earshot, weight: 1 }],
        story: 'A haggler\'s ear has knotted into yours. Prices start to sound like opening moves, and you hear the give in a seller\'s voice before they know it is there.' },
      [ES.tavern_brawler]: { id: ES.tavern_brawler, name: 'Tavern Brawler', from: { race: RC.human }, weight: 1, trait: PK.fists_do_the_talking, skills: [{ skill: SK.unarmed_strike, weight: 2 }, { skill: SK.persuasion, weight: 1 }],
        story: 'Someone\'s long nights of tavern brawls have tied into your own. Your fists hang easier at your sides, and so do your words: half a fight is talking your way into it, or out.' },
      [ES.hard_won_habit]: { id: ES.hard_won_habit, name: 'Hard-Won Habit', from: { deed: true }, weight: 1, skills: [],
        story: 'What you did again and again here has pulled tight and held. Something in you will remember it.' },
    },
    roles: { [RL.sense]: { name: 'sense', shared: true }, [RL.grip]: { name: 'grip', shared: false }, [RL.move]: { name: 'move', shared: true }, [RL.fly]: { name: 'fly', shared: true }, [RL.strike]: { name: 'strike', shared: false }, [RL.speech]: { name: 'speech', shared: true } },
    bodyTypes: BODY_TYPES,
    // Healing sources (H1–H6); amounts are placeholders. A source's tier is its row: add rows for more.
    healing: {
      [HL.rest]: { id: HL.rest, name: 'Rest', hpPct: CONFIG.REST_HEAL_PCT, partPct: CONFIG.REST_HEAL_PCT, composure: CP.rest, reach: 'damaged', revivesDead: false },
      [HL.clinic]: { id: HL.clinic, name: 'Clinic', hpPct: CONFIG.CLINIC_HEAL_PCT, partPct: CONFIG.CLINIC_HEAL_PCT, composure: CP.clinic, reach: 'crippled', revivesDead: false, placeKinds: ['clinic', 'infirmary'] },
      [HL.bandage]: { id: HL.bandage, name: 'Bandage', hpPct: 10, partPct: 10, reach: 'damaged', revivesDead: false },
      // AT10 (placeholder): a healing draught, 25% of health and parts up to Damaged, any time
      [HL.draught]: { id: HL.draught, name: 'Healing draught', hpPct: 25, partPct: 25, reach: 'damaged', revivesDead: false },
      // H12–H14: natural recovery, all the time (fights too): endurance × 0.01 % an hour (0.5% at 50); never Crippled or worse
      [HL.passive]: { id: HL.passive, name: 'Natural recovery', hpPct: 0, partPct: 0, reach: 'damaged', revivesDead: false, hourly: { skill: SK.endurance, pctPerPoint: 0.01 } },
      // never applied itself: healing straight from a perk (Second Wind) is counted here for achievements; Fast Healer counts as natural recovery
      [HL.perk]: { id: HL.perk, name: 'Perks', hpPct: 0, partPct: 0, reach: 'healthy', revivesDead: false, countOnly: true },
    },
    // What restores morale, a table apart from healing so each tunes on its own; a healing row names the row its action
    // also restores (rest, clinic). Amounts are placeholders.
    composure: {
      [CP.rest]: { id: CP.rest, name: 'Rest', pct: CONFIG.REST_MORALE_PCT, inFight: false }, // MB8
      [CP.clinic]: { id: CP.clinic, name: 'Clinic', pct: CONFIG.CLINIC_MORALE_PCT, inFight: false },
      // MB34: morale comes back from Resolve: 0.1 % of max morale per point an hour (5 % at 50), all the time
      [CP.natural]: { id: CP.natural, name: 'Natural composure', pct: 0, inFight: true, hourly: { skill: SK.resolve, pctPerPoint: 0.1 } },
      [CP.danger_passed]: { id: CP.danger_passed, name: 'Danger passed', pct: CONFIG.MORALE_ENGAGEMENT_END_PCT, inFight: false }, // MB9: an engagement ends
      // never applied itself: morale restored straight by a perk is counted here for achievements (calmFromPerk)
      [CP.perk]: { id: CP.perk, name: 'Perks', pct: 0, inFight: true, countOnly: true },
      [CP.steady]: { id: CP.steady, name: 'Steadying yourself', pct: 0, inFight: true }, // SY1: the share comes from the roll's tier (CONFIG.STEADY_PCT)
      // TM28: moved here from the fears table, so they count toward the Calmed achievements; flat morale points
      [CP.foe_downed]: { id: CP.foe_downed, name: 'You down a foe', pct: 0, points: 10, inFight: true }, // MB10
      [CP.rallied]: { id: CP.rallied, name: 'An ally\'s battle cry rallies you', pct: 0, points: 10, inFight: true }, // I9 b
    },
    // FT7/FT8/FT28: what restores stamina, beside healing and composure; every refill goes through engine/fatigue.ts
    recovery: {
      [RV.sleep]: { id: RV.sleep, name: 'Sleep', linePct: 100, debtPctPerHour: CONFIG.SLEEP_CLEAR_PCT }, // × spot and worn armour (SLEEP_SPOT_MULT, SLEEP_ARMOR_MULT)
      [RV.rest]: { id: RV.rest, name: 'Rest', linePct: 100 }, // by the share of its hour that ran
      [RV.breath]: { id: RV.breath, name: 'Catching your breath', perMinute: { pct: CONFIG.BREATH_BASE_PCT, perPoint: CONFIG.BREATH_PER_POINT_PCT } },
      [RV.perk]: { id: RV.perk, name: 'Perks', countOnly: true },
    },
    // MB21–MB28: what costs morale (flat points; a negative cost restores). Amounts are placeholders.
    // PL6: personality axes, with the words and hints for each end (Levity from the personality line voice tests); PL19,
    // PL28: values (Schwartz's 19 refined values plus family; VL11–VL20 from PL29; propriety, gratitude and desire from the
    // voice tests); PL10, PL21–PL27: archetypes
    personalityAxes: {
      [PA.honesty]: { id: PA.honesty, name: 'Honesty', low: 'deceitful', high: 'honest', lowHint: 'bends the truth when it suits them', highHint: 'says what they think, keeps their word' },
      [PA.pride]: { id: PA.pride, name: 'Pride', low: 'humble', high: 'proud', lowHint: 'plays themself down, lets others shine', highHint: 'rates themself above others and says so' },
      [PA.temper]: { id: PA.temper, name: 'Temper', low: 'patient', high: 'quick to anger', lowHint: 'slow to anger, lets slights pass', highHint: 'flares up fast when crossed' },
      [PA.sociability]: { id: PA.sociability, name: 'Sociability', low: 'quiet', high: 'talkative', lowHint: 'keeps to themself, says little', highHint: 'chatters, makes friends easily, fills silences' },
      [PA.discipline]: { id: PA.discipline, name: 'Discipline', low: 'impulsive', high: 'disciplined', lowHint: 'acts first, thinks later', highHint: 'keeps to plans and habits, finishes what they start' },
      [PA.curiosity]: { id: PA.curiosity, name: 'Curiosity', low: 'set in their ways', high: 'curious', lowHint: 'sticks to what they know, distrusts the new', highHint: 'wants to know how things work, asks and pokes' },
      [PA.levity]: { id: PA.levity, name: 'Levity', low: 'earnest', high: 'playful', lowHint: 'takes things seriously, rarely jokes', highHint: 'jokes and teases, and talks lightly even about serious things' },
    },
    values: Object.fromEntries(Object.entries(VL).map(([k, id]) => [id, { id, name: k, hint: VALUE_HINTS[k as keyof typeof VL] }])),
    // archetypes: the nearest target (six axes, Nerve, and the drives counted ARCHETYPE_VALUE_WEIGHT times) is the
    // character's; ties go to the earlier row, so Ordinary comes first. Targets are placeholders.
    personalityTypes: {
      [PY.ordinary]: { id: PY.ordinary, name: 'Ordinary', target: {}, hint: 'an everyday sort, nothing to extremes' },
      [PY.prideful]: { id: PY.prideful, name: 'Prideful', target: { [PA.pride]: 70, [PA.temper]: 20 }, nerve: 20, values: [VL.reputation, VL.glory], hint: 'won\'t back down in front of others, takes insults personally' },
      [PY.mature]: { id: PY.mature, name: 'Mature', target: { [PA.discipline]: 60, [PA.temper]: -40, [PA.honesty]: 20 }, values: [VL.duty, VL.order], hint: 'thinks before acting, keeps a cool head, owns their mistakes' },
      [PY.childish]: { id: PY.childish, name: 'Childish', target: { [PA.discipline]: -70, [PA.temper]: 30, [PA.sociability]: 40, [PA.curiosity]: 40 }, nerve: 20, values: [VL.pleasure, VL.adventure], hint: 'acts on impulse, sulks when crossed' },
      [PY.honourable]: { id: PY.honourable, name: 'Honourable', target: { [PA.honesty]: 70, [PA.pride]: 40, [PA.discipline]: 30 }, nerve: 20, values: [VL.justice, VL.loyalty, VL.duty], hint: 'keeps their word and answers any insult to their name' },
      [PY.schemer]: { id: PY.schemer, name: 'Schemer', target: { [PA.honesty]: -60, [PA.discipline]: 50, [PA.temper]: -20, [PA.sociability]: 20 }, nerve: -20, values: [VL.power, VL.wealth], hint: 'plans ahead, lies patiently, uses people' },
      [PY.bully]: { id: PY.bully, name: 'Bully', target: { [PA.pride]: 60, [PA.temper]: 60, [PA.honesty]: -30, [PA.curiosity]: -20 }, values: [VL.power], hint: 'picks on the weak, backs down from the strong' },
      [PY.loner]: { id: PY.loner, name: 'Loner', target: { [PA.sociability]: -60 }, values: [VL.freedom, VL.safety], hint: 'keeps to themself and relies on no one; dodges group ties and promises rather than argue about them' },
      [PY.busybody]: { id: PY.busybody, name: 'Busybody', target: { [PA.sociability]: 60, [PA.curiosity]: 60, [PA.discipline]: -20 }, values: [VL.reputation], hint: 'pokes into other people\'s business and passes on what they learn' },
      [PY.free_spirit]: { id: PY.free_spirit, name: 'Free spirit', target: { [PA.discipline]: -60, [PA.sociability]: 50 }, nerve: 40, values: [VL.freedom, VL.pleasure, VL.desire], hint: 'lives for the moment, laughs off trouble, hates being tied down' },
    },
    // tensions, shown in row order, at most TENSIONS_SHOWN. Thresholds are placeholders.
    tensions: {
      [TN.unshakeable_scatterbrained]: { id: TN.unshakeable_scatterbrained, name: 'unshakeable yet scatterbrained', hint: 'nothing frightens them, yet they can\'t keep to a plan', when: { min: { [SK.resolve]: 80 }, max: { [PA.discipline]: -40 } } },
      [TN.bold_unbacked]: { id: TN.bold_unbacked, name: 'bold with nothing to back it', hint: 'laughs at danger, can\'t fight', when: { nerveLine: 'daring', max: { bestFight: 19 } } },
      [TN.old_head]: { id: TN.old_head, name: 'old head on young shoulders', hint: 'talks and plans like a grown-up, though still a child', when: { ageStage: 'stage_0', min: { [PA.discipline]: 40 } } },
      [TN.wary_dangerous]: { id: TN.wary_dangerous, name: 'wary but dangerous', hint: 'avoids danger, yet hits hard when pushed', when: { nerveLine: 'cautious', min: { bestAttack: 40 } } },
      [TN.home_temptation]: { id: TN.home_temptation, name: 'torn between home and temptation', hint: 'loves their own, yet can\'t resist a pretty face', when: { drives: [VL.desire], anyDrive: [VL.family, VL.loyalty] } },
      [TN.talent_undisciplined]: { id: TN.talent_undisciplined, name: 'talent without discipline', hint: 'brilliant at their craft, careless at everything else', when: { min: { bestSkill: 60 }, max: { [PA.discipline]: -40 } } },
      [TN.crooked_means]: { id: TN.crooked_means, name: 'good ends, crooked means', hint: 'bends the truth to help the people they care about', when: { max: { [PA.honesty]: -20 }, anyDrive: [VL.loyalty, VL.kindness] } },
    },
    fears: {
      [FR.own_level]: { id: FR.own_level, name: 'Your health reaches a new level', cost: 25, rolled: true, health: { from: 'injured', to: 'mauled' } },
      [FR.own_critical]: { id: FR.own_critical, name: 'Your health reaches Critical', cost: 50, rolled: true, health: { from: 'critical', to: 'critical' } },
      [FR.bandmate_down]: { id: FR.bandmate_down, name: 'A bandmate goes down', cost: 25, rolled: true },
      [FR.bandmate_broken]: { id: FR.bandmate_broken, name: 'A bandmate breaks', cost: 25, rolled: true }, // MB23
      [FR.lost_intimidation]: { id: FR.lost_intimidation, name: 'You lose to intimidation', cost: 10, rolled: false, perTier: true }, // MB28, per tier of gap
      [FR.dread_presence]: { id: FR.dread_presence, name: 'An aura of dread gets to you', cost: 10, rolled: false, perTier: true }, // MB37: each failed aura check costs its own morale
      [FR.battle_cry]: { id: FR.battle_cry, name: 'A battle cry shakes you', cost: 10, rolled: false, perTier: true }, // I9: as Dread Presence
      // the Dreaded on Sight quirk: paid once per owner, in a fight or out of one
      [FR.steady_slipped]: { id: FR.steady_slipped, name: 'Trying to steady yourself makes it worse', cost: 0, rolled: false }, // SY1: the cost comes from the roll's tier (CONFIG.STEADY_PCT)
      [FR.dreaded_sight]: { id: FR.dreaded_sight, name: 'You set eyes on someone dreaded', cost: 15, rolled: true, unengaged: true },
      // a part Crippled or worse: per part by impact for a 6-part body, scaled to the body's part count; one roll per hit pays the sum
      [FR.own_part_crippled]: { id: FR.own_part_crippled, name: 'A part of yours is Crippled', cost: 0, rolled: true, part: 'crippled',
        partCost: { non_essential: 5, normal: 15, essential: 30 }, refParts: 6 },
      // a part Destroyed rolls again, at 1.5 × the Crippled row's costs (read from that row)
      [FR.own_part_destroyed]: { id: FR.own_part_destroyed, name: 'A part of yours is Destroyed', cost: 0, rolled: true, part: 'destroyed',
        partCostOf: { fear: FR.own_part_crippled, mult: 1.5 } },
    },
    // The Action times table (T1, AT1, AT11, AT12): seconds at a time factor of 1, for a skill-50 professional, from the real
    // references on the Action Time pages (action-time/action-time-research.md). FT24/FT25: each row's effort tier pays its
    // strain ([Proposed] placement: Base free actions, words, a drawn weapon, a door, rest, sleep, waiting; Light a look round,
    // handing over; Moderate bandaging, picking, hiding, armour; Hard a blow, a throw, a shot, a span; All-out a heavy span,
    // Battle Cry). Unset: no movement lock, focus reflex, stop
    // any, output end, broken off = lost. The action row is the default turn outside a fight until turns last as long as their order.
    durations: {
      [DU.action]: { id: DU.action, name: 'Move, talk or other action', effort: 'base', seconds: 60 },
      [DU.trade]: { id: DU.trade, name: 'Trade', effort: 'base', seconds: 10 * 60, orders: ['barter', 'buy', 'sell'], focus: 'steady' },
      [DU.rest]: { id: DU.rest, name: 'Rest', effort: 'base', seconds: 60 * 60, orders: ['rest'], locksMove: true, focus: 'deep', output: 'share', onBreak: [{ upTo: 1, then: 'share' }] },
      [DU.sleep]: { id: DU.sleep, name: 'Sleep (until rested or the time named)', effort: 'base', seconds: 0, focus: 'careful', stop: 'never', output: 'steps', onBreak: [{ upTo: 1, then: 'share' }] },
      [DU.wait]: { id: DU.wait, name: 'Wait (until the time named)', effort: 'base', seconds: 0, focus: 'deep' },
      // attacks (AT11a-e): a melee or unarmed blow; a throw; a bow drawn and loosed; a crossbow shot, its spanning a row of its own
      [DU.blow]: { id: DU.blow, name: 'Melee or unarmed blow', effort: 'hard', seconds: 3, attack: true },
      [DU.throw]: { id: DU.throw, name: 'Throw', effort: 'hard', seconds: 3, attack: true, locksMove: true },
      [DU.bow_light]: { id: DU.bow_light, name: 'Light bow shot', effort: 'hard', seconds: 5, attack: true, locksMove: true, focus: 'steady' },
      [DU.bow_medium]: { id: DU.bow_medium, name: 'Medium bow shot', effort: 'hard', seconds: 6, attack: true, locksMove: true, focus: 'steady' },
      [DU.crossbow_shot]: { id: DU.crossbow_shot, name: 'Crossbow shot', effort: 'light', seconds: 2, attack: true, locksMove: true, focus: 'steady' },
      // spanning stays done when broken off: a spanned crossbow stays loaded (AT11c b)
      [DU.span_light]: { id: DU.span_light, name: 'Span a light crossbow', effort: 'hard', seconds: 4, readies: DU.crossbow_shot, locksMove: true, focus: 'careful', onBreak: [{ upTo: 1, then: 'kept' }] },
      [DU.span_stirrup]: { id: DU.span_stirrup, name: 'Span a stirrup crossbow', effort: 'hard', seconds: 8, readies: DU.crossbow_shot, locksMove: true, focus: 'careful', onBreak: [{ upTo: 1, then: 'kept' }] },
      [DU.span_crossbow]: { id: DU.span_crossbow, name: 'Span a crossbow', effort: 'all_out', seconds: 28, readies: DU.crossbow_shot, locksMove: true, focus: 'careful', onBreak: [{ upTo: 1, then: 'kept' }] },
      // voice (AT11f-g): barks stay free (AE7); the words said before a break are heard
      [DU.battle_cry]: { id: DU.battle_cry, name: 'Battle Cry', effort: 'all_out', seconds: 1 },
      [DU.talk]: { id: DU.talk, name: 'Talking (a word)', effort: 'base', seconds: 0.4, perWord: true, output: 'share', onBreak: [{ upTo: 1, then: 'share' }] },
      // gear and things in hand (AT11h-j)
      [DU.draw]: { id: DU.draw, name: 'Draw a weapon', effort: 'base', seconds: 1 },
      [DU.stow]: { id: DU.stow, name: 'Stow a weapon', effort: 'base', seconds: 2 },
      [DU.swap]: { id: DU.swap, name: 'Swap weapons', effort: 'base', seconds: 3 },
      [DU.pick_up_reach]: { id: DU.pick_up_reach, name: 'Pick up within reach', effort: 'base', seconds: 1 },
      [DU.pick_up_ground]: { id: DU.pick_up_ground, name: 'Pick up from the ground', effort: 'base', seconds: 4, locksMove: true },
      [DU.hand_over]: { id: DU.hand_over, name: 'Hand something over', effort: 'light', seconds: 2 },
      // ways (AT11k-l): you stop at the door; picking keeps its work and is sped by Lockpicking (BA2)
      [DU.door]: { id: DU.door, name: 'Open or close a door', effort: 'base', seconds: 1, locksMove: true },
      [DU.bar]: { id: DU.bar, name: 'Bar or unbar a door', effort: 'base', seconds: 2, locksMove: true },
      [DU.key]: { id: DU.key, name: 'Lock or unlock with a key', effort: 'base', seconds: 4, locksMove: true },
      // PO2: in a fight, getting something out of a pack you carry (or putting it back, or moving it to or from a pocket) takes your action (placeholder: one fight turn)
      [DU.from_pack]: { id: DU.from_pack, name: 'Get something out of a pack', effort: 'base', seconds: 6 },
      [DU.break_open]: { id: DU.break_open, name: 'Break something open', effort: 'hard', seconds: 6, locksMove: true, focus: 'steady' }, // BF31
      [DU.pick_lock]: { id: DU.pick_lock, name: 'Pick a lock', effort: 'moderate', seconds: 60, locksMove: true, focus: 'careful', onBreak: [{ upTo: 1, then: 'kept' }],
        speed: { fn: FN.lockpicking, halving: CONFIG.PICK_HALVING_PER, fastCap: CONFIG.PICK_FAST_CAP } },
      // care (AT11m-n): a bandage broken off is not used up
      [DU.bandage]: { id: DU.bandage, name: 'Bandage', effort: 'moderate', seconds: 40, locksMove: true, focus: 'careful' },
      [DU.drink]: { id: DU.drink, name: 'Drink a potion', effort: 'base', seconds: 3 },
      // senses (AT11o)
      [DU.hide]: { id: DU.hide, name: 'Hide', effort: 'moderate', seconds: 2, locksMove: true },
      [DU.look]: { id: DU.look, name: 'Look around', effort: 'light', seconds: 3, focus: 'steady' },
      // armour on and off with help (AT12): each piece counts once on; heavy alone takes ARMOR_ALONE_MULT times as long
      [DU.armor_light_on]: { id: DU.armor_light_on, name: 'Put on light armour', effort: 'moderate', seconds: 2 * 60, ...ARMOR_TIME },
      [DU.armor_light_off]: { id: DU.armor_light_off, name: 'Take off light armour', effort: 'moderate', seconds: 60, ...ARMOR_TIME },
      [DU.armor_medium_on]: { id: DU.armor_medium_on, name: 'Put on medium armour', effort: 'moderate', seconds: 60, ...ARMOR_TIME },
      [DU.armor_medium_off]: { id: DU.armor_medium_off, name: 'Take off medium armour', effort: 'moderate', seconds: 30, ...ARMOR_TIME },
      [DU.armor_heavy_on]: { id: DU.armor_heavy_on, name: 'Put on heavy armour', effort: 'moderate', seconds: 10 * 60, ...ARMOR_TIME, aloneMult: CONFIG.ARMOR_ALONE_MULT },
      [DU.armor_heavy_off]: { id: DU.armor_heavy_off, name: 'Take off heavy armour', effort: 'moderate', seconds: 3 * 60, ...ARMOR_TIME, aloneMult: CONFIG.ARMOR_ALONE_MULT },
    },
    // Humans and elves for now, identical but for lifespan
    // AG3–AG6: years at which each life stage starts. Human from real references (adolescence 13, majority 18, middle age 40,
    // the UN's older persons 60, oldest old 80, centenarian 100); elf (Ancient 450) and dragon (Ancient 500) are placeholders. Slime: ageless.
    // innate perks and quirks per race: lists, empty until chosen
    races: {
      [RC.human]: { id: RC.human, name: 'Human', bodyTypeId: BT.humanoid, hpMultiplier: 1, innatePerks: [], innateQuirks: [], tags: ['speaks'], intelligence: 'intelligent', ageStages: AGES.human },
      [RC.elf]: { id: RC.elf, name: 'Elf', bodyTypeId: BT.humanoid, hpMultiplier: 1, innatePerks: [], innateQuirks: [], tags: ['speaks'], intelligence: 'intelligent', ageStages: AGES.elf },
      // BR1–BR7: slime and dragon were body types only; HP multipliers moved here unchanged
      [RC.slime]: { id: RC.slime, name: 'Slime', bodyTypeId: BT.amorphous, hpMultiplier: 0.6, innatePerks: [], innateQuirks: [], tags: [], intelligence: 'unintelligent' },
      [RC.dragon]: { id: RC.dragon, name: 'Dragon', bodyTypeId: BT.winged_quadruped, hpMultiplier: 3, innatePerks: [], innateQuirks: [], tags: [], intelligence: 'semi', ageStages: AGES.dragon },
    },
    // Z3. Outdoor zones' own light is lamps or fires only; the sky adds daylight (T3a).
    // gear classes (GC): the class sets which skill an item asks for; its level sets how much (EQUIP_NEED)
    gearClasses: Object.fromEntries(([
      [GC.melee_light, 'Light melee weapon', SK.melee_light, 'melee'], [GC.melee_medium, 'Medium melee weapon', SK.melee_medium, 'melee'], [GC.melee_heavy, 'Heavy melee weapon', SK.melee_heavy, 'melee'],
      [GC.ranged_light, 'Light ranged weapon', SK.ranged_light, 'ranged'], [GC.ranged_medium, 'Medium ranged weapon', SK.ranged_medium, 'ranged'], [GC.ranged_heavy, 'Heavy ranged weapon', SK.ranged_heavy, 'ranged'],
      [GC.improvised, 'Improvised weapon', SK.unarmed_improvised, 'improvised'], [GC.armor_light, 'Light armor', SK.light_armor, 'armor'], [GC.armor_medium, 'Medium armor', SK.medium_armor, 'armor'],
      [GC.armor_heavy, 'Heavy armor', SK.heavy_armor, 'armor'], [GC.shield, 'Shield', SK.block, 'shield'],
    ] as const).map(([id, name, skill, use]) => [id, { id, name, skill, use }])),
    // attack modes: what an attack does; weapon modes and natural attacks name one by id
    // Throw carries the throw action's combined roll for every weapon that lists it; a throw mode's reachM is its own throw range (CONFIG.THROW_M)
    attackModes: Object.fromEntries(Object.entries(AM).map(([w, id]) => [id, { id, name: w[0].toUpperCase() + w.slice(1),
      ...(id === AM.throw ? { blend: CONFIG.THROW_BLEND } : {}) }])),
    // CO16 default size and CO15 default edge per kind: indoors walled, outdoors open
    zoneKinds: Object.fromEntries(([
      [ZK.room, 'Room', false, 'some', 'dim', 'room', 1], [ZK.corridor, 'Corridor', false, 'none', 'dim', 'small', 4], [ZK.stairs, 'Stairs', false, 'none', 'dim', 'cramped', 2],
      [ZK.cellar, 'Cellar or cave', false, 'some', 'dark', 'room', 1], [ZK.street, 'Street', true, 'none', 'dark', 'yard', 4], [ZK.square, 'Square', true, 'none', 'dark', 'open', 1],
      [ZK.gate, 'Gate', true, 'none', 'dark', 'small', 2], [ZK.yard, 'Yard', true, 'some', 'dark', 'yard', 1], [ZK.field, 'Field', true, 'none', 'dark', 'open', 1],
      [ZK.woods, 'Woods', true, 'heavy', 'dark', 'open', 1], [ZK.road, 'Road', true, 'none', 'dark', 'vast', 1],
    ] as const).map(([id, name, outdoor, cover, light, size, aspect]) => [id, { id, name, outdoor, cover, light, size, aspect, edge: outdoor ? EK.open : EK.wall,
      ...(id === ZK.road ? { road: true as const } : {}), ...(ONWARD_KINDS.has(id) ? { onward: true as const } : {}),
      ...(KIND_FURNITURE[id] ? { furniture: KIND_FURNITURE[id] } : {}) }])),
    // FR1: what furniture can be (a piece's kind sets its map icon; its name is the story's)
    furnitureKinds: Object.fromEntries(Object.entries(FU).map(([k, id]) => [id, { id, name: k.replace(/_/g, ' ') }])),
    // TV3/TV4: a road is one long zone; its length and danger words
    roadLengths: Object.fromEntries(ROAD_LENGTHS.keys.map((k) => [k, { id: k, name: ROAD_LENGTHS.name(k), km: CONFIG.ROAD_LENGTH_KM[k] }])),
    roadDangers: Object.fromEntries(ROAD_DANGERS.keys.map((k) => [k, { id: k, name: ROAD_DANGERS.name(k), encounterPct: CONFIG.ROAD_ENCOUNTER_PCT[k] }])),
    edgeKinds: Object.fromEntries(([
      [EK.wall, 'Wall', false, false, false, false, 'wall', 'Solid: no seeing or walking across; doorways in it are the zone\'s links.'],
      [EK.open, 'Open', true, true, true, false, 'open', 'Nothing in the way: walk and see across anywhere along it.'],
      [EK.low, 'Low', false, true, true, true, 'open', 'A counter, fence or rail: see and reach across it, cross it by climbing.'],
      [EK.window, 'Window', false, true, false, false, 'window', 'See through it; no walking or reaching across.'],
    ] as const).map(([id, name, walk, see, reach, climb, sound, text]) => [id, { id, name, walk, see, reach, climb, sound, text }])),
    // SD3–SD5: barriers on ways. A grate is bars you see through; rubble is a blockage only clearing opens (the walls thread)
    barrierKinds: Object.fromEntries(([
      [BK.door, 'Door', true, true, false, false, 'door', 'A wooden door: it may be locked with a key, or barred from one side.'],
      [BK.gate, 'Gate', true, true, false, false, 'door', 'A gate in a wall or fence: locked, or barred from the inside.'],
      [BK.grate, 'Grate', true, true, false, true, 'open', 'Iron bars across a way: you see through it, but it may be locked or barred.'],
      [BK.hatch, 'Hatch', true, true, false, false, 'door', 'A trapdoor in a floor or ceiling: locked, or bolted from one side.'],
      [BK.rubble, 'Rubble', false, false, true, false, 'wall', 'A cave-in or fallen stone: no way through until it is cleared.'],
    ] as const).map(([id, name, lock, bar, blocked, seeThrough, sound, text]) => [id, { id, name, lock, bar, blocked, seeThrough, sound, text }])),
    zoneSizes: Object.fromEntries(ZONE_SIZES.keys.map((k) => [k, { id: k, name: ZONE_SIZES.name(k), m2: CONFIG.ZONE_SIZE_M2[k], like: ({
      cramped: 'A ship\'s cabin, a cell, a closet (about 3 × 3 m)',
      small: 'A peasant cottage\'s one room, an inn bedroom (about 5 × 5 m)',
      room: 'A village tavern\'s common room (about 8 × 8 m)',
      hall: 'Penshurst Place\'s Baron\'s Hall (about 19 × 12 m); a lord\'s great hall like Winterfell\'s',
      yard: 'An inn yard with stables, a castle courtyard (about 20 × 20 m)',
      open: 'A village green or small market (about 40 × 40 m)',
      vast: 'A city market square (Kraków\'s is about 200 × 200 m, four of these)',
    } as Record<string, string>)[k] }])),
    noiseLevels: Object.fromEntries(NOISE.keys.map((k) => [k, { id: k, name: NOISE.name(k), decibels: CONFIG.NOISE_DB[k], clearTo: inOpen(openAirReachM(k)?.[0]), heardTo: inOpen(openAirReachM(k)?.[1]), like: ({
      silent: 'No sound at all: standing still and holding your breath',
      faint: 'Breathing, rustling leaves, a cloth brushing a wall (about 20 dB)',
      hushed: 'A whisper (about 30 dB)',
      quiet: 'A quiet library, soft footsteps, a page turned (about 40 dB)',
      murmur: 'Low talk across a table, steady rain, a crackling hearth (about 50 dB)',
      normal: 'Ordinary conversation, a sword drawn, someone walking in boots (about 60 dB)',
      raised: 'A raised voice, a busy tavern, a scuffle (about 70 dB)',
      loud: 'A shout, steel ringing on steel (about 88 dB)',
      blaring: 'A scream, a hammer on an anvil, a war horn (about 100 dB)',
      deafening: 'A thunderclap overhead, a church bell up close, an alarm bell (about 120 dB)',
    } as Record<string, string>)[k] }])),
    visibilityLevels: Object.fromEntries(VISIBILITY.keys.map((k) => [k, { id: k, name: VISIBILITY.name(k), clearM: CONFIG.SIGHT_M[k]?.[0] ?? null, glimpsedM: CONFIG.SIGHT_M[k]?.[1] ?? null, like: ({
      unseen: 'Nothing to see: keeping still out of sight',
      faint: 'A palmed coin, a hand slipping to a purse: made out within half a metre, glimpsed within 2 m',
      close: 'A nod, a hand sign, a change of expression: read at about 6 m, noticed out to about 20 m',
      low: 'Someone sitting still or resting: a face known at about 15 m (where witnesses stop naming faces reliably), a shape noticed at 60 m',
      normal: 'Someone walking or talking: who it is at about 25 m, a figure moving across open ground at 200 m',
      high: 'A fight, someone running or waving: who is who by build and clothes at 50 m, the movement caught at 500 m',
      glaring: 'A fire, a torch or a lit window at night, sun flashing on steel: made out at 200 m, seen 2 km off',
    } as Record<string, string>)[k] }])),
    layouts: LAYOUTS,
    items: { ...ITEMS, ...Object.fromEntries(Object.values(UNIQUES).flatMap((t) => t.unique?.itemDefs ?? []).map((d) => [d.id, d])) },
    templates: { ...TEMPLATES, ...UNIQUES }, // HF34 a: Hall of fame heroes are unique templates in their own file
    npcRoles: NPC_ROLES,
    themes: THEMES,
    activities: ACTIVITIES,
    routines: ROUTINES,
    routineSets: ROUTINE_SETS,
    // the 20 milestone picks; higher and banked perks stay in PERK_WRITEUPS until they get a milestone; All-50 parts (allStep) too
    perks: {
      ...Object.fromEntries([...PERK_WRITEUPS, ...BOOST_PERKS, ...ALL_PARTS].filter((d) => d.ladder || d.allStep || d.linked).map(({ ref: _r, skill: _s, place: _p, ...d }) => [d.id, { ...d, built: BUILT_PERKS.has(d.id) }])),
      ...CLASS_PERKS,
    },
    achievements: {
      // XP by reward level (REWARD_LEVELS, rewardXp); per-kind 10/100 and mastery all-100/150 moved up a level. Names grow grander with the feat.
      // after = the lower level it builds on; earning it switches the lower one off.
      [ACH.first_defeat_body_type]: { id: ACH.first_defeat_body_type, name: 'First {body_type} Felled', level: 'i', rule: 'defeats', tags: ['combat'], count: 1, by: 'body_type', branchOf: ACH.defeats_10 },
      [ACH.defeats_10_body_type]: { id: ACH.defeats_10_body_type, name: '{body_type}bane', level: 'ii', rule: 'defeats', tags: ['combat'], count: 10, by: 'body_type', after: ACH.first_defeat_body_type, firstSight: 'unintelligent' },
      [ACH.defeats_100_body_type]: { id: ACH.defeats_100_body_type, name: 'Scourge of the {body_type} Hordes', level: 'iii', rule: 'defeats', tags: ['combat'], count: 100, by: 'body_type', after: ACH.defeats_10_body_type, readsHealth: true, firstSight: 'semi', excludes: ['firstSight'] },
      [ACH.first_defeat_race]: { id: ACH.first_defeat_race, name: 'First of {race}kind Felled', level: 'i', rule: 'defeats', tags: ['combat'], count: 1, by: 'race', branchOf: ACH.defeats_10 },
      [ACH.defeats_10_race]: { id: ACH.defeats_10_race, name: 'Bane of {race}kind', level: 'ii', rule: 'defeats', tags: ['combat'], count: 10, by: 'race', after: ACH.first_defeat_race, firstSight: 'unintelligent' },
      [ACH.defeats_100_race]: { id: ACH.defeats_100_race, name: 'Scourge of {race}kind', level: 'iii', rule: 'defeats', tags: ['combat'], count: 100, by: 'race', after: ACH.defeats_10_race, firstSight: 'semi', excludes: ['firstSight'] },
      [ACH.defeats_10]: { id: ACH.defeats_10, name: 'Blooded Fighter', level: 'i', rule: 'defeats', tags: ['combat'], count: 10 },
      // TM4/TM25: 10 / 50 / 100 / 250; the roll bonus goes by chain position (+1 to +4)
      [ACH.defeats_50]: { id: ACH.defeats_50, name: 'Carver of Fifty Graves', level: 'ii', rule: 'defeats', tags: ['combat'], count: 50, after: ACH.defeats_10 },
      [ACH.defeats_100]: { id: ACH.defeats_100, name: 'Calamity of a Hundred Blades', level: 'iii', rule: 'defeats', tags: ['combat'], count: 100, after: ACH.defeats_50 },
      [ACH.defeats_250]: { id: ACH.defeats_250, name: 'Harvester of the Fallen', level: 'iv', rule: 'defeats', tags: ['combat'], count: 250, after: ACH.defeats_100 },
      // kills are counted apart from defeats (a kill is the defeat where the foe died, so both tallies move); ordeal rows pay
      // max morale, never the skill used
      [ACH.kills_1]: { id: ACH.kills_1, name: 'A Life Taken', level: 'zero', rule: 'kills', tags: ['combat'], count: 1, maxMorale: 1 },
      [ACH.kills_10]: { id: ACH.kills_10, name: 'Gravefiller', level: 'i', rule: 'kills', tags: ['combat'], count: 10, after: ACH.kills_1, maxMorale: 1 },
      [ACH.kills_50]: { id: ACH.kills_50, name: 'Death Walks Beside You', level: 'ii', rule: 'kills', tags: ['combat'], count: 50, after: ACH.kills_10, maxMorale: 1 },
      // one per tree and mastery step, id <id>:<tree>; each tree rating has its own line (MASTERY_ACH), grander the higher the rating
      [ACH.mastery_50]: { id: ACH.mastery_50, name: 'Adept of {tree}', level: 'ii', rule: 'mastery', tags: ['skill'], count: 50, reqLower: 5 },
      [ACH.mastery_100]: { id: ACH.mastery_100, name: 'Master of {tree}', level: 'iii', rule: 'mastery', tags: ['skill'], count: 100, after: ACH.mastery_50 },
      [ACH.mastery_150]: { id: ACH.mastery_150, name: 'Grandmaster of {tree}', level: 'iv', rule: 'mastery', tags: ['skill'], count: 150, after: ACH.mastery_100 },
      [ACH.mastery_superior_50]: { id: ACH.mastery_superior_50, name: 'Paragon of {tree}', level: 'ii', rule: 'mastery', tags: ['skill'], count: 50, reqLower: 5 },
      [ACH.mastery_superior_100]: { id: ACH.mastery_superior_100, name: 'Ascendant of {tree}', level: 'iii', rule: 'mastery', tags: ['skill'], count: 100, after: ACH.mastery_superior_50 },
      [ACH.mastery_superior_150]: { id: ACH.mastery_superior_150, name: 'Transcendent Sovereign of {tree}', level: 'iv', rule: 'mastery', tags: ['skill'], count: 150, after: ACH.mastery_superior_100 },
      [ACH.mastery_legendary_50]: { id: ACH.mastery_legendary_50, name: 'Chosen of {tree}', level: 'ii', rule: 'mastery', tags: ['skill'], count: 50, reqLower: 5 },
      [ACH.mastery_legendary_100]: { id: ACH.mastery_legendary_100, name: '{tree} Incarnate', level: 'iii', rule: 'mastery', tags: ['skill'], count: 100, after: ACH.mastery_legendary_50 },
      [ACH.mastery_legendary_150]: { id: ACH.mastery_legendary_150, name: 'The Heavens Kneel to {tree}', level: 'iv', rule: 'mastery', tags: ['skill'], count: 150, after: ACH.mastery_legendary_100 },
      // deeds: the player's tallies (tally in src/engine/xp.ts, turnFeats in src/engine/feats.ts)
      [ACH.unaware_1]: { id: ACH.unaware_1, name: 'Never Saw It Coming', level: 'i', rule: 'unaware_defeats', tags: ['combat', 'stealth'], count: 1, personality: ap({ [PA.honesty]: -1 }) },
      [ACH.unaware_10]: { id: ACH.unaware_10, name: 'Knife in the Dark', level: 'ii', rule: 'unaware_defeats', tags: ['combat', 'stealth'], count: 10, after: ACH.unaware_1, personality: ap({ [PA.honesty]: -1 }) },
      [ACH.unaware_50]: { id: ACH.unaware_50, name: 'Shadow\'s Edge', level: 'ii', rule: 'unaware_defeats', tags: ['combat', 'stealth'], count: 50, after: ACH.unaware_10, personality: ap({ [PA.honesty]: -1 }) },
      [ACH.unaware_100]: { id: ACH.unaware_100, name: 'The Unseen Death', level: 'iii', rule: 'unaware_defeats', tags: ['combat', 'stealth'], count: 100, after: ACH.unaware_50, unawareShift: 1, quieter: 1, personality: ap({ [PA.honesty]: -1 }) },
      [ACH.yielded_1]: { id: ACH.yielded_1, name: 'Yield or Fall', level: 'i', rule: 'yielded', tags: ['combat', 'social'], count: 1, personality: ap({ [PA.pride]: 1 }) },
      [ACH.yielded_10]: { id: ACH.yielded_10, name: 'Breaker of Wills', level: 'ii', rule: 'yielded', tags: ['combat', 'social'], count: 10, after: ACH.yielded_1, skillAdd: { [SK.intimidation]: 5 }, personality: ap({ [PA.pride]: 1 }) },
      [ACH.yielded_50]: { id: ACH.yielded_50, name: 'The Name That Ends Fights', level: 'iii', rule: 'yielded', tags: ['combat', 'social'], count: 50, after: ACH.yielded_10, renown: 10, personality: ap({ [PA.pride]: 1 }) },
      // TM9: 1 / 10 / 50 / 100 per group (the first row's name is a placeholder)
      [ACH.crits_1]: { id: ACH.crits_1, name: 'First Clean Stroke ({group})', level: 'zero', rule: 'crits', tags: ['skill'], count: 1, by: 'group' },
      [ACH.crits_10]: { id: ACH.crits_10, name: 'Sure Hand ({group})', level: 'i', rule: 'crits', tags: ['skill'], count: 10, by: 'group', after: ACH.crits_1 },
      [ACH.crits_50]: { id: ACH.crits_50, name: 'Perfect Form ({group})', level: 'ii', rule: 'crits', tags: ['skill'], count: 50, by: 'group', after: ACH.crits_10 },
      [ACH.crits_100]: { id: ACH.crits_100, name: 'Master of the Moment ({group})', level: 'iii', rule: 'crits', tags: ['skill'], count: 100, by: 'group', after: ACH.crits_50, standIn: 0.2 },
      [ACH.beyond_1]: { id: ACH.beyond_1, name: 'Beyond Perfect', level: 'i', rule: 'beyond_crit', tags: ['skill'], count: 1 },
      [ACH.beyond_2]: { id: ACH.beyond_2, name: 'Past the Limit', level: 'ii', rule: 'beyond_crit', tags: ['skill'], count: 2, after: ACH.beyond_1 },
      [ACH.beyond_3]: { id: ACH.beyond_3, name: 'Touched by Fate', level: 'iii', rule: 'beyond_crit', tags: ['skill'], count: 3, after: ACH.beyond_2 },
      [ACH.beyond_group_1]: { id: ACH.beyond_group_1, name: 'Beyond Perfect ({group})', level: 'i', rule: 'beyond_crit', tags: ['skill'], count: 1, by: 'group', branchOf: ACH.beyond_1 },
      [ACH.beyond_group_2]: { id: ACH.beyond_group_2, name: 'Past the Limit ({group})', level: 'ii', rule: 'beyond_crit', tags: ['skill'], count: 2, by: 'group', after: ACH.beyond_group_1 },
      [ACH.beyond_group_3]: { id: ACH.beyond_group_3, name: 'Touched by Fate ({group})', level: 'iii', rule: 'beyond_crit', tags: ['skill'], count: 3, by: 'group', after: ACH.beyond_group_2 },
      [ACH.flawless_1]: { id: ACH.flawless_1, name: 'Untouched', level: 'i', rule: 'flawless', tags: ['combat'], count: 1, personality: ap({ [PA.discipline]: 1 }) },
      [ACH.flawless_10]: { id: ACH.flawless_10, name: 'Not a Scratch', level: 'ii', rule: 'flawless', tags: ['combat'], count: 10, after: ACH.flawless_1, personality: ap({ [PA.discipline]: 1 }) },
      [ACH.flawless_50]: { id: ACH.flawless_50, name: 'Untouchable', level: 'iii', rule: 'flawless', tags: ['combat'], count: 50, after: ACH.flawless_10, personality: ap({ [PA.discipline]: 1 }) },
      [ACH.outnumbered_1]: { id: ACH.outnumbered_1, name: 'Stand Against Many', level: 'ii', rule: 'outnumbered', tags: ['combat'], count: 1, personality: ap({ nerve: 1 }) },
      [ACH.outnumbered_10]: { id: ACH.outnumbered_10, name: 'One Against the Horde', level: 'iii', rule: 'outnumbered', tags: ['combat'], count: 10, after: ACH.outnumbered_1, personality: ap({ nerve: 1 }) },
      [ACH.brink_1]: { id: ACH.brink_1, name: 'Not Today', level: 'i', rule: 'brink', tags: ['combat', 'survival'], count: 1 },
      [ACH.brink_3]: { id: ACH.brink_3, name: 'Not Yet', level: 'i', rule: 'brink', tags: ['combat', 'survival'], count: 3, after: ACH.brink_1, deathsDoor: 7 },
      [ACH.brink_5]: { id: ACH.brink_5, name: 'Death Keeps Waiting', level: 'ii', rule: 'brink', tags: ['combat', 'survival'], count: 5, after: ACH.brink_3, deathsDoor: 1, excludes: ['deathsDoor'] },
      [ACH.crippled_1]: { id: ACH.crippled_1, name: 'Still Swinging', level: 'i', rule: 'crippled_defeats', tags: ['combat', 'survival'], count: 1 },
      [ACH.crippled_10]: { id: ACH.crippled_10, name: 'Bones Heal Later', level: 'ii', rule: 'crippled_defeats', tags: ['combat', 'survival'], count: 10, perk: PK.past_the_pain, after: ACH.crippled_1 },
      [ACH.held_line_1]: { id: ACH.held_line_1, name: 'Few Against Many', level: 'i', rule: 'held_line', tags: ['combat', 'social'], count: 1, personality: ap({ nerve: 1 }) },
      [ACH.held_line_10]: { id: ACH.held_line_10, name: 'Hold the Line', level: 'ii', rule: 'held_line', tags: ['combat', 'social'], count: 10, after: ACH.held_line_1, rally: 10, personality: ap({ nerve: 1 }) },
      [ACH.quests_1]: { id: ACH.quests_1, name: 'Job Done', level: 'zero', rule: 'quests_done', tags: ['social'], count: 1, personality: ap({ [PA.discipline]: 1 }) },
      [ACH.quests_5]: { id: ACH.quests_5, name: 'Reliable Hand', level: 'i', rule: 'quests_done', tags: ['social'], count: 5, after: ACH.quests_1, personality: ap({ [PA.discipline]: 1 }) },
      [ACH.quests_10]: { id: ACH.quests_10, name: 'Hand for Hire', level: 'ii', rule: 'quests_done', tags: ['social'], count: 10, after: ACH.quests_5, personality: ap({ [PA.discipline]: 1 }) },
      [ACH.quests_25]: { id: ACH.quests_25, name: 'Sought After', level: 'iii', rule: 'quests_done', tags: ['social'], count: 25, after: ACH.quests_10, personality: ap({ [PA.discipline]: 1 }) },
      [ACH.quests_50]: { id: ACH.quests_50, name: 'The One They Send For', level: 'iv', rule: 'quests_done', tags: ['social'], count: 50, after: ACH.quests_25, personality: ap({ [PA.discipline]: 1 }) },
      [ACH.quests_abandoned_1]: { id: ACH.quests_abandoned_1, name: 'Left Undone', level: 'zero', rule: 'quests_abandoned', tags: ['social'], count: 1, scar: true }, // TM29: the first one (placeholder name)
      [ACH.quests_abandoned_5]: { id: ACH.quests_abandoned_5, name: 'Word Not Kept', level: 'i', rule: 'quests_abandoned', tags: ['social'], count: 5, after: ACH.quests_abandoned_1, scar: true, personality: ap({ [PA.honesty]: -1 }) },
      // TM8: 1 / 10 / 100 / 500 (the first of an act is an achievement; the first row's name is a placeholder)
      [ACH.clean_1]: { id: ACH.clean_1, name: 'Turned Aside', level: 'zero', rule: 'clean_defense', tags: ['combat'], count: 1 },
      [ACH.clean_10]: { id: ACH.clean_10, name: 'Not Here', level: 'i', rule: 'clean_defense', tags: ['combat'], count: 10, after: ACH.clean_1 },
      [ACH.clean_100]: { id: ACH.clean_100, name: 'Wall of Steel', level: 'ii', rule: 'clean_defense', tags: ['combat'], count: 100, after: ACH.clean_10 },
      [ACH.clean_500]: { id: ACH.clean_500, name: 'Nothing Lands', level: 'iii', rule: 'clean_defense', tags: ['combat'], count: 500, after: ACH.clean_100 },
      [ACH.unseen_1]: { id: ACH.unseen_1, name: 'Unnoticed', level: 'zero', rule: 'unseen_moves', tags: ['stealth'], count: 1 }, // TM24 (placeholder name)
      [ACH.unseen_10]: { id: ACH.unseen_10, name: 'Under Their Noses', level: 'i', rule: 'unseen_moves', tags: ['stealth'], count: 10, after: ACH.unseen_1 },
      [ACH.unseen_50]: { id: ACH.unseen_50, name: 'Slipped Past', level: 'ii', rule: 'unseen_moves', tags: ['stealth'], count: 50, after: ACH.unseen_10 },
      [ACH.unseen_250]: { id: ACH.unseen_250, name: 'Never Was Here', level: 'iii', rule: 'unseen_moves', tags: ['stealth'], count: 250, after: ACH.unseen_50 },
      [ACH.vanished_1]: { id: ACH.vanished_1, name: 'Gone', level: 'zero', rule: 'vanished', tags: ['stealth'], count: 1 }, // TM24 (placeholder name)
      [ACH.vanished_5]: { id: ACH.vanished_5, name: 'Now You Don\u2019t', level: 'i', rule: 'vanished', tags: ['stealth'], count: 5, after: ACH.vanished_1 },
      [ACH.vanished_25]: { id: ACH.vanished_25, name: 'Smoke on the Wind', level: 'ii', rule: 'vanished', tags: ['stealth'], count: 25, after: ACH.vanished_5 },
      [ACH.spotted_10]: { id: ACH.spotted_10, name: 'Nothing Gets Past', level: 'i', rule: 'spotted', tags: ['stealth'], count: 10 },
      [ACH.spotted_100]: { id: ACH.spotted_100, name: 'Eyes in the Back of Your Head', level: 'ii', rule: 'spotted', tags: ['stealth'], count: 100, after: ACH.spotted_10 },
      [ACH.spotted_fn_1]: { id: ACH.spotted_fn_1, name: 'Sharp {function}', level: 'zero', rule: 'spotted', tags: ['stealth'], count: 1, by: 'function', branchOf: ACH.spotted_10 },
      [ACH.spotted_fn_10]: { id: ACH.spotted_fn_10, name: '{function} That Never Sleeps', level: 'i', rule: 'spotted', tags: ['stealth'], count: 10, after: ACH.spotted_fn_1, by: 'function' },
      [ACH.spotted_fn_100]: { id: ACH.spotted_fn_100, name: 'Nothing Hides from Your {function}', level: 'ii', rule: 'spotted', tags: ['stealth'], count: 100, after: ACH.spotted_fn_10, by: 'function' },
      [ACH.speech_1]: { id: ACH.speech_1, name: 'First Word Won ({skill})', level: 'zero', rule: 'speech_won', tags: ['social'], count: 1, by: 'skill' }, // TM20 (placeholder name)
      [ACH.speech_10]: { id: ACH.speech_10, name: 'Practised Speaker ({skill})', level: 'i', rule: 'speech_won', tags: ['social'], count: 10, by: 'skill', after: ACH.speech_1, personality: ap({ [PA.sociability]: 1 }), personalityByKind: { [SK.lying]: ap({ [PA.honesty]: -1 }) } },
      [ACH.speech_100]: { id: ACH.speech_100, name: 'Voice That Carries ({skill})', level: 'ii', rule: 'speech_won', tags: ['social'], count: 100, after: ACH.speech_10, by: 'skill', personality: ap({ [PA.sociability]: 1 }), personalityByKind: { [SK.lying]: ap({ [PA.honesty]: -1 }) } },
      [ACH.speech_250]: { id: ACH.speech_250, name: 'Words That Move Crowds ({skill})', level: 'iii', rule: 'speech_won', tags: ['social'], count: 250, after: ACH.speech_100, by: 'skill', personality: ap({ [PA.sociability]: 1 }), personalityByKind: { [SK.lying]: ap({ [PA.honesty]: -1 }) } },
      [ACH.talked_down_1]: { id: ACH.talked_down_1, name: 'Blood Unspilled', level: 'i', rule: 'talked_down', tags: ['social'], count: 1, personality: ap({ [PA.temper]: -1 }) },
      [ACH.talked_down_10]: { id: ACH.talked_down_10, name: 'Peacemaker', level: 'ii', rule: 'talked_down', tags: ['social'], count: 10, after: ACH.talked_down_1, personality: ap({ [PA.temper]: -1 }) },
      [ACH.talked_down_50]: { id: ACH.talked_down_50, name: 'Every Fight Ends in Talk', level: 'iii', rule: 'talked_down', tags: ['social'], count: 50, after: ACH.talked_down_10, personality: ap({ [PA.temper]: -1 }) },
      [ACH.outmatched_1]: { id: ACH.outmatched_1, name: 'Against the Odds', level: 'i', rule: 'outmatched', tags: ['skill'], count: 1 },
      [ACH.outmatched_10]: { id: ACH.outmatched_10, name: 'No Match for You', level: 'ii', rule: 'outmatched', tags: ['skill'], count: 10, after: ACH.outmatched_1 },
      [ACH.outmatched_fn_1]: { id: ACH.outmatched_fn_1, name: 'Better {function}', level: 'zero', rule: 'outmatched', tags: ['skill'], count: 1, by: 'function', branchOf: ACH.outmatched_1 },
      [ACH.outmatched_fn_10]: { id: ACH.outmatched_fn_10, name: '{function} Without Equal', level: 'i', rule: 'outmatched', tags: ['skill'], count: 10, after: ACH.outmatched_fn_1, by: 'function' },
      [ACH.enemy_friend_1]: { id: ACH.enemy_friend_1, name: 'Enemy to Friend', level: 'i', rule: 'enemy_to_friend', tags: ['social'], count: 1, personality: ap({ [PA.temper]: -1, [PA.sociability]: 1 }) },
      [ACH.enemy_friend_5]: { id: ACH.enemy_friend_5, name: 'Mender of Grudges', level: 'ii', rule: 'enemy_to_friend', tags: ['social'], count: 5, after: ACH.enemy_friend_1, personality: ap({ [PA.temper]: -1, [PA.sociability]: 1 }) },
      [ACH.no_blow_1]: { id: ACH.no_blow_1, name: 'Won Without a Blow', level: 'i', rule: 'won_without_blow', tags: ['social', 'combat'], count: 1 },
      [ACH.no_blow_10]: { id: ACH.no_blow_10, name: 'The Fight Is Already Over', level: 'ii', rule: 'won_without_blow', tags: ['social', 'combat'], count: 10, after: ACH.no_blow_1 },
      [ACH.bought_100]: { id: ACH.bought_100, name: 'Good Custom', level: 'zero', rule: 'coin_spent', tags: ['social'], count: 100 },
      [ACH.bought_1000]: { id: ACH.bought_1000, name: 'Regular', level: 'i', rule: 'coin_spent', tags: ['social'], count: 1000, after: ACH.bought_100 },
      [ACH.bought_10000]: { id: ACH.bought_10000, name: 'Known at Every Counter', level: 'ii', rule: 'coin_spent', tags: ['social'], count: 10000, after: ACH.bought_1000 },
      [ACH.sold_100]: { id: ACH.sold_100, name: 'Peddler', level: 'zero', rule: 'coin_earned', tags: ['social'], count: 100 },
      [ACH.sold_1000]: { id: ACH.sold_1000, name: 'Merchant', level: 'i', rule: 'coin_earned', tags: ['social'], count: 1000, after: ACH.sold_100 },
      [ACH.sold_10000]: { id: ACH.sold_10000, name: 'Has a Price for Everything', level: 'ii', rule: 'coin_earned', tags: ['social'], count: 10000, after: ACH.sold_1000 },
      [ACH.mended_1]: { id: ACH.mended_1, name: 'Mended', level: 'zero', rule: 'mended', tags: ['survival'], count: 1 },
      [ACH.mended_10]: { id: ACH.mended_10, name: 'Patched and Stitched', level: 'i', rule: 'mended', tags: ['survival'], count: 10, after: ACH.mended_1 },
      [ACH.mended_50]: { id: ACH.mended_50, name: 'Hard to Keep Down', level: 'ii', rule: 'mended', tags: ['survival'], count: 50, after: ACH.mended_10 },
      [ACH.back_from_down_1]: { id: ACH.back_from_down_1, name: 'Not Done Yet', level: 'i', rule: 'back_from_down', tags: ['survival'], count: 1 },
      // the deepest of the near-death depths (Critical, Down and back, the survival roll): depth pays more than count
      [ACH.survival_roll_1]: { id: ACH.survival_roll_1, name: 'Woke Up Anyway', level: 'ii', rule: 'survival_rolls', tags: ['combat', 'survival'], count: 1, maxMorale: 10 },
      // D-292: one time; your contest rolls can go one tier past Critical Success (name and reward level are placeholders)
      [ACH.matched_crit_1]: { id: ACH.matched_crit_1, name: 'Perfect Meets Perfect', level: 'i', rule: 'matched_crits', tags: ['skill'], count: 1, tierUnlocks: [{ roll: 'contest', side: 'up', steps: 1 }] },
      [ACH.holds_1]: { id: ACH.holds_1, name: 'Got a Grip', level: 'zero', rule: 'holds', tags: ['combat', 'skill'], count: 1 }, // TM24 (placeholder name)
      [ACH.holds_10]: { id: ACH.holds_10, name: 'Iron Grip', level: 'i', rule: 'holds', tags: ['combat', 'skill'], count: 10, after: ACH.holds_1 },
      [ACH.holds_100]: { id: ACH.holds_100, name: 'No Getting Loose', level: 'ii', rule: 'holds', tags: ['combat', 'skill'], count: 100, after: ACH.holds_10 },
      [ACH.aimed_10]: { id: ACH.aimed_10, name: 'Called Shot', level: 'i', rule: 'aimed_hits', tags: ['combat', 'skill'], count: 10 },
      // TM7: 10 / 50 / 100
      [ACH.aimed_50]: { id: ACH.aimed_50, name: 'Where I Said', level: 'ii', rule: 'aimed_hits', tags: ['combat', 'skill'], count: 50, after: ACH.aimed_10 },
      [ACH.aimed_100]: { id: ACH.aimed_100, name: 'Never Misses Its Mark', level: 'iii', rule: 'aimed_hits', tags: ['combat', 'skill'], count: 100, after: ACH.aimed_50 },
      // TM26/TM27: per part size 1 / 10 / 50; each row takes AIM_EASE_PCT % off that size's aim penalty (carried up: 10 / 20 / 30 %).
      // The first row's name is a placeholder.
      [ACH.aimed_size_1]: { id: ACH.aimed_size_1, name: 'Found the {size} Mark', level: 'zero', rule: 'aimed_hits', tags: ['combat', 'skill'], count: 1, by: 'size', levelUp: SMALLER_PAYS_MORE, aimEase: CONFIG.AIM_EASE_PCT, branchOf: ACH.aimed_10 },
      [ACH.aimed_size_10]: { id: ACH.aimed_size_10, name: '{size} Target', level: 'i', rule: 'aimed_hits', tags: ['combat', 'skill'], count: 10, after: ACH.aimed_size_1, by: 'size', levelUp: SMALLER_PAYS_MORE, aimEase: CONFIG.AIM_EASE_PCT },
      [ACH.aimed_size_50]: { id: ACH.aimed_size_50, name: 'Threads the Needle ({size})', level: 'ii', rule: 'aimed_hits', tags: ['combat', 'skill'], count: 50, after: ACH.aimed_size_10, by: 'size', levelUp: SMALLER_PAYS_MORE, aimEase: CONFIG.AIM_EASE_PCT },
      [ACH.quests_giver_5]: { id: ACH.quests_giver_5, name: 'Go-To for {giver}', level: 'i', rule: 'quests_for_giver', tags: ['social'], count: 5, by: 'giver', branchOf: ACH.quests_1 },
      [ACH.quest_givers_10]: { id: ACH.quest_givers_10, name: 'Known in Every House', level: 'ii', rule: 'quest_givers', tags: ['social'], count: 10 },
      [ACH.quest_chain_1]: { id: ACH.quest_chain_1, name: 'Saw It Through', level: 'i', rule: 'quest_chains', tags: ['social'], count: 1 },
      [ACH.quests_early_1]: { id: ACH.quests_early_1, name: 'Early Every Time', level: 'i', rule: 'quests_early', tags: ['social'], count: 1, personality: ap({ [PA.discipline]: 1 }) },
      [ACH.quests_unpaid_1]: { id: ACH.quests_unpaid_1, name: 'For Nothing', level: 'i', rule: 'quests_unpaid', tags: ['social'], count: 1, personality: ap({ [PA.pride]: -1 }) },
      [ACH.spar_1]: { id: ACH.spar_1, name: 'First Bout', level: 'zero', rule: 'spar_wins', tags: ['combat'], count: 1 },
      [ACH.spar_10]: { id: ACH.spar_10, name: 'Sparring Partner', level: 'i', rule: 'spar_wins', tags: ['combat'], count: 10, after: ACH.spar_1 },
      [ACH.spar_25]: { id: ACH.spar_25, name: 'Yard Veteran', level: 'i', rule: 'spar_wins', tags: ['combat'], count: 25, after: ACH.spar_10 },
      [ACH.spar_50]: { id: ACH.spar_50, name: 'Regular at the Yard', level: 'ii', rule: 'spar_wins', tags: ['combat'], count: 50, after: ACH.spar_25 },
      [ACH.cruel_spar_1]: { id: ACH.cruel_spar_1, name: 'Blood on the Practice Sword', level: 'i', rule: 'cruel_spar_wins', tags: ['combat'], count: 1, personality: ap({ [PA.temper]: 1 }), branchOf: ACH.spar_1 },
      [ACH.cruel_spar_10]: { id: ACH.cruel_spar_10, name: 'Cruel Teacher', level: 'ii', rule: 'cruel_spar_wins', tags: ['combat'], count: 10, after: ACH.cruel_spar_1, personality: ap({ [PA.temper]: 1 }) },
      [ACH.cruel_spar_25]: { id: ACH.cruel_spar_25, name: 'No One Spars You Twice', level: 'ii', rule: 'cruel_spar_wins', tags: ['combat'], count: 25, after: ACH.cruel_spar_10, personality: ap({ [PA.temper]: 1 }) },
      [ACH.spar_losses_1]: { id: ACH.spar_losses_1, name: 'Flat on Your Back', level: 'zero', rule: 'spar_losses', tags: ['combat'], count: 1, scar: true, personality: ap({ [PA.pride]: -1 }) },
      [ACH.spar_losses_10]: { id: ACH.spar_losses_10, name: 'Sparring Dummy', level: 'i', rule: 'spar_losses', tags: ['combat'], count: 10, after: ACH.spar_losses_1, scar: true, personality: ap({ [PA.pride]: -1 }) },
      [ACH.defeated_1]: { id: ACH.defeated_1, name: 'Humbled', level: 'zero', rule: 'defeated', tags: ['combat'], count: 1, scar: true }, // TM13 (placeholder name)
      [ACH.defeated_5]: { id: ACH.defeated_5, name: 'Loser', level: 'i', rule: 'defeated', tags: ['combat'], count: 5, after: ACH.defeated_1, scar: true, personality: ap({ [PA.pride]: -1 }) },
      [ACH.defeated_25]: { id: ACH.defeated_25, name: 'Sore Loser', level: 'ii', rule: 'defeated', tags: ['combat'], count: 25, after: ACH.defeated_5, scar: true, personality: ap({ [PA.pride]: -1 }) },
      // D-160 morale: fights won while Panicking, and the scar for breaking (a break also counts as defeated)
      [ACH.won_panicking_1]: { id: ACH.won_panicking_1, name: 'Hands Still Shaking', level: 'i', rule: 'won_panicking', tags: ['combat'], count: 1, personality: ap({ nerve: 1 }) },
      [ACH.won_panicking_10]: { id: ACH.won_panicking_10, name: 'Fear Rides With Me', level: 'ii', rule: 'won_panicking', tags: ['combat'], count: 10, after: ACH.won_panicking_1, personality: ap({ nerve: 1 }) },
      [ACH.won_panicking_25]: { id: ACH.won_panicking_25, name: 'Panic Is Just Another Weapon', level: 'iii', rule: 'won_panicking', tags: ['combat'], count: 25, after: ACH.won_panicking_10, personality: ap({ nerve: 1 }) },
      [ACH.morale_breaks_1]: { id: ACH.morale_breaks_1, name: 'First Crack', level: 'zero', rule: 'morale_breaks', tags: ['combat'], count: 1, scar: true, personality: ap({ nerve: -1 }) },
      [ACH.morale_breaks_5]: { id: ACH.morale_breaks_5, name: 'Glass Nerves', level: 'i', rule: 'morale_breaks', tags: ['combat'], count: 5, after: ACH.morale_breaks_1, scar: true, personality: ap({ nerve: -1 }) },
      [ACH.morale_breaks_25]: { id: ACH.morale_breaks_25, name: 'Nothing Left to Break', level: 'ii', rule: 'morale_breaks', tags: ['combat'], count: 25, after: ACH.morale_breaks_5, scar: true, personality: ap({ nerve: -1 }) },
      // the mind's twin of the survival roll: the fight was won although your morale broke in it. Extraordinary by nature (Broken
      // stops attacks), so the higher levels are something to chase, not something a build plans on
      // AS1–AS11: attacking a foe who already gave up. Counted once per foe, hit or miss, when the player sees the foe
      // surrendered or broken (a visible state) as they strike; surrendered to anyone counts. Temper +5 per level.
      // Killing a surrendered foe is its branch; cutting down a broken foe as it flees is a branch line of its own. New names are placeholders.
      [ACH.struck_surrendered_1]: { id: ACH.struck_surrendered_1, name: 'No Quarter', level: 'i', rule: 'struck_surrendered', tags: ['combat'], count: 1, personality: ap({ [PA.temper]: 1 }) },
      [ACH.struck_surrendered_5]: { id: ACH.struck_surrendered_5, name: 'Mercy Is for Others', level: 'ii', rule: 'struck_surrendered', tags: ['combat'], count: 5, after: ACH.struck_surrendered_1, personality: ap({ [PA.temper]: 1 }) },
      [ACH.struck_surrendered_10]: { id: ACH.struck_surrendered_10, name: 'Deaf to Begging', level: 'iii', rule: 'struck_surrendered', tags: ['combat'], count: 10, after: ACH.struck_surrendered_5, personality: ap({ [PA.temper]: 1 }) },
      [ACH.struck_surrendered_25]: { id: ACH.struck_surrendered_25, name: 'The White Flag Means Nothing', level: 'iv', rule: 'struck_surrendered', tags: ['combat'], count: 25, after: ACH.struck_surrendered_10, personality: ap({ [PA.temper]: 1 }) },
      [ACH.struck_surrendered_50]: { id: ACH.struck_surrendered_50, name: 'None Are Spared', level: 'v', rule: 'struck_surrendered', tags: ['combat'], count: 50, after: ACH.struck_surrendered_25, personality: ap({ [PA.temper]: 1 }) },
      [ACH.killed_surrendered_1]: { id: ACH.killed_surrendered_1, name: 'Surrender Was Not Enough', level: 'i', rule: 'killed_surrendered', tags: ['combat'], count: 1, branchOf: ACH.struck_surrendered_1, personality: ap({ [PA.temper]: 1 }) },
      [ACH.killed_surrendered_5]: { id: ACH.killed_surrendered_5, name: 'Executioner', level: 'ii', rule: 'killed_surrendered', tags: ['combat'], count: 5, after: ACH.killed_surrendered_1, personality: ap({ [PA.temper]: 1 }) },
      [ACH.killed_surrendered_25]: { id: ACH.killed_surrendered_25, name: 'No One Walks Away', level: 'iii', rule: 'killed_surrendered', tags: ['combat'], count: 25, after: ACH.killed_surrendered_5, personality: ap({ [PA.temper]: 1 }) },
      [ACH.struck_fleeing_1]: { id: ACH.struck_fleeing_1, name: 'No Running', level: 'i', rule: 'struck_fleeing', tags: ['combat'], count: 1, branchOf: ACH.struck_surrendered_1, personality: ap({ [PA.temper]: 1 }) },
      [ACH.struck_fleeing_5]: { id: ACH.struck_fleeing_5, name: 'Back Turned, Blade Bared', level: 'ii', rule: 'struck_fleeing', tags: ['combat'], count: 5, after: ACH.struck_fleeing_1, personality: ap({ [PA.temper]: 1 }) },
      [ACH.struck_fleeing_10]: { id: ACH.struck_fleeing_10, name: 'Run Them Down', level: 'iii', rule: 'struck_fleeing', tags: ['combat'], count: 10, after: ACH.struck_fleeing_5, personality: ap({ [PA.temper]: 1 }) },
      [ACH.struck_fleeing_25]: { id: ACH.struck_fleeing_25, name: 'The Hunt Ends Here', level: 'iv', rule: 'struck_fleeing', tags: ['combat'], count: 25, after: ACH.struck_fleeing_10, personality: ap({ [PA.temper]: 1 }) },
      [ACH.struck_fleeing_50]: { id: ACH.struck_fleeing_50, name: 'None Escape', level: 'v', rule: 'struck_fleeing', tags: ['combat'], count: 50, after: ACH.struck_fleeing_25, personality: ap({ [PA.temper]: 1 }) },
      [ACH.won_broken_1]: { id: ACH.won_broken_1, name: 'Back from the Break', level: 'ii', rule: 'won_broken', tags: ['combat'], count: 1, maxMorale: 5, personality: ap({ nerve: 1 }) },
      [ACH.won_broken_5]: { id: ACH.won_broken_5, name: 'Broken, Not Beaten', level: 'iii', rule: 'won_broken', tags: ['combat'], count: 5, after: ACH.won_broken_1, maxMorale: 5, personality: ap({ nerve: 1 }) },
      [ACH.won_broken_25]: { id: ACH.won_broken_25, name: 'Nothing Left to Fear', level: 'iv', rule: 'won_broken', tags: ['combat'], count: 25, after: ACH.won_broken_5, maxMorale: 5, personality: ap({ nerve: 1 }) },
      // BK4: forcing locked containers open; each level moves every fragility line one tier worse (names: placeholders for the lore thread)
      [ACH.broke_open_1]: { id: ACH.broke_open_1, name: 'Forced Entry', level: 'zero', rule: 'broke_open', tags: ['skill'], count: 1, safeBreak: 1 },
      [ACH.broke_open_10]: { id: ACH.broke_open_10, name: 'Steady Crowbar', level: 'i', rule: 'broke_open', tags: ['skill'], count: 10, after: ACH.broke_open_1, safeBreak: 1 },
      [ACH.broke_open_50]: { id: ACH.broke_open_50, name: 'Nothing Spilled', level: 'ii', rule: 'broke_open', tags: ['skill'], count: 50, after: ACH.broke_open_10, safeBreak: 1 },
      // D-174: HP healed (a flat number) from one healing row each; counts are placeholders
      [ACH.healed_rest_100]: { id: ACH.healed_rest_100, name: 'A Good Night\'s Sleep', level: 'zero', rule: 'healed', by: 'heal_source', only: HL.rest, tags: ['survival'], count: 100, branchOf: ACH_HEADS.healed },
      [ACH.healed_rest_1000]: { id: ACH.healed_rest_1000, name: 'Sleeps Through Anything', level: 'i', rule: 'healed', by: 'heal_source', only: HL.rest, tags: ['survival'], count: 1000, after: ACH.healed_rest_100 },
      [ACH.healed_rest_10000]: { id: ACH.healed_rest_10000, name: 'The Long Rest', level: 'ii', rule: 'healed', by: 'heal_source', only: HL.rest, tags: ['survival'], count: 10000, after: ACH.healed_rest_1000 },
      [ACH.healed_natural_50]: { id: ACH.healed_natural_50, name: 'Knits Back Together', level: 'zero', rule: 'healed', by: 'heal_source', only: HL.passive, tags: ['survival'], count: 50, branchOf: ACH_HEADS.healed },
      [ACH.healed_natural_500]: { id: ACH.healed_natural_500, name: 'Walks It Off', level: 'i', rule: 'healed', by: 'heal_source', only: HL.passive, tags: ['survival'], count: 500, after: ACH.healed_natural_50 },
      [ACH.healed_natural_2500]: { id: ACH.healed_natural_2500, name: 'The Body Remembers', level: 'ii', rule: 'healed', by: 'heal_source', only: HL.passive, tags: ['survival'], count: 2500, after: ACH.healed_natural_500 },
      [ACH.healed_perk_50]: { id: ACH.healed_perk_50, name: 'Borrowed Strength', level: 'zero', rule: 'healed', by: 'heal_source', only: HL.perk, tags: ['survival'], count: 50, branchOf: ACH_HEADS.healed },
      [ACH.healed_perk_500]: { id: ACH.healed_perk_500, name: 'Tricks of the Flesh', level: 'i', rule: 'healed', by: 'heal_source', only: HL.perk, tags: ['survival'], count: 500, after: ACH.healed_perk_50 },
      [ACH.healed_perk_2500]: { id: ACH.healed_perk_2500, name: 'Unkillable by Habit', level: 'ii', rule: 'healed', by: 'heal_source', only: HL.perk, tags: ['survival'], count: 2500, after: ACH.healed_perk_500 },
      // morale restored (flat points) from one composure row each, mirroring healing by source; counts are placeholders
      [ACH.calmed_rest_100]: { id: ACH.calmed_rest_100, name: 'Sleep On It', level: 'zero', rule: 'calmed', by: 'morale_source', only: CP.rest, tags: ['survival'], count: 100, branchOf: ACH_HEADS.calmed },
      [ACH.calmed_rest_1000]: { id: ACH.calmed_rest_1000, name: 'Rested Nerves', level: 'i', rule: 'calmed', by: 'morale_source', only: CP.rest, tags: ['survival'], count: 1000, after: ACH.calmed_rest_100 },
      [ACH.calmed_rest_10000]: { id: ACH.calmed_rest_10000, name: 'Peace of Mind', level: 'ii', rule: 'calmed', by: 'morale_source', only: CP.rest, tags: ['survival'], count: 10000, after: ACH.calmed_rest_1000 },
      [ACH.calmed_natural_50]: { id: ACH.calmed_natural_50, name: 'Catch Your Breath', level: 'zero', rule: 'calmed', by: 'morale_source', only: CP.natural, tags: ['survival'], count: 50, branchOf: ACH_HEADS.calmed },
      [ACH.calmed_natural_500]: { id: ACH.calmed_natural_500, name: 'Shakes It Off', level: 'i', rule: 'calmed', by: 'morale_source', only: CP.natural, tags: ['survival'], count: 500, after: ACH.calmed_natural_50 },
      [ACH.calmed_natural_2500]: { id: ACH.calmed_natural_2500, name: 'The Mind Remembers', level: 'ii', rule: 'calmed', by: 'morale_source', only: CP.natural, tags: ['survival'], count: 2500, after: ACH.calmed_natural_500 },
      [ACH.calmed_perk_50]: { id: ACH.calmed_perk_50, name: 'Borrowed Courage', level: 'zero', rule: 'calmed', by: 'morale_source', only: CP.perk, tags: ['survival'], count: 50, branchOf: ACH_HEADS.calmed },
      [ACH.calmed_perk_500]: { id: ACH.calmed_perk_500, name: 'Tricks of the Mind', level: 'i', rule: 'calmed', by: 'morale_source', only: CP.perk, tags: ['survival'], count: 500, after: ACH.calmed_perk_50 },
      [ACH.calmed_perk_2500]: { id: ACH.calmed_perk_2500, name: 'Unshakable by Habit', level: 'ii', rule: 'calmed', by: 'morale_source', only: CP.perk, tags: ['survival'], count: 2500, after: ACH.calmed_perk_500 },
      // flat HP and morale points lost, from any cause; counts are placeholders
      [ACH.hp_lost_100]: { id: ACH.hp_lost_100, name: 'Bled For It', level: 'zero', rule: 'hp_lost', tags: ['survival'], count: 100 },
      [ACH.hp_lost_1000]: { id: ACH.hp_lost_1000, name: 'Hard to Count the Wounds', level: 'i', rule: 'hp_lost', tags: ['survival'], count: 1000, after: ACH.hp_lost_100 },
      [ACH.hp_lost_10000]: { id: ACH.hp_lost_10000, name: 'Made of Old Wounds', level: 'ii', rule: 'hp_lost', tags: ['survival'], count: 10000, after: ACH.hp_lost_1000 },
      [ACH.morale_lost_100]: { id: ACH.morale_lost_100, name: 'Nerves Worn Thin', level: 'zero', rule: 'morale_lost', tags: ['survival'], count: 100 },
      [ACH.morale_lost_1000]: { id: ACH.morale_lost_1000, name: 'Seen Too Much', level: 'i', rule: 'morale_lost', tags: ['survival'], count: 1000, after: ACH.morale_lost_100 },
      [ACH.morale_lost_10000]: { id: ACH.morale_lost_10000, name: 'Fear Is an Old Friend', level: 'ii', rule: 'morale_lost', tags: ['survival'], count: 10000, after: ACH.morale_lost_1000 },
      // D-177: fights against a hostile foe stronger than you (power = rating + gear rating); gaps are placeholders
      [ACH.survived_above_100]: { id: ACH.survived_above_100, name: 'Lived to Tell It', level: 'i', rule: 'survived_above', tags: ['combat', 'survival'], count: 100 },
      [ACH.survived_above_250]: { id: ACH.survived_above_250, name: 'Walked Away From That', level: 'ii', rule: 'survived_above', tags: ['combat', 'survival'], count: 250, after: ACH.survived_above_100 },
      [ACH.survived_above_500]: { id: ACH.survived_above_500, name: 'Should Have Died There', level: 'iii', rule: 'survived_above', tags: ['combat', 'survival'], count: 500, after: ACH.survived_above_250 },
      [ACH.survived_pct_25]: { id: ACH.survived_pct_25, name: 'Outclassed, Not Outlived', level: 'ii', rule: 'survived_above_pct', tags: ['combat', 'survival'], count: 25 },
      [ACH.survived_pct_50]: { id: ACH.survived_pct_50, name: 'Too Stubborn to Die', level: 'iii', rule: 'survived_above_pct', tags: ['combat', 'survival'], count: 50, after: ACH.survived_pct_25 },
      [ACH.survived_pct_100]: { id: ACH.survived_pct_100, name: 'Death Looked Away', level: 'iv', rule: 'survived_above_pct', tags: ['combat', 'survival'], count: 100, after: ACH.survived_pct_50 },
      [ACH.won_above_100]: { id: ACH.won_above_100, name: 'Punching Up', level: 'i', rule: 'won_above', tags: ['combat'], count: 100, personality: ap({ nerve: 1 }) },
      [ACH.won_above_250]: { id: ACH.won_above_250, name: 'The Bigger They Are', level: 'ii', rule: 'won_above', tags: ['combat'], count: 250, after: ACH.won_above_100, personality: ap({ nerve: 1 }) },
      [ACH.won_above_500]: { id: ACH.won_above_500, name: 'Giantkiller', level: 'iii', rule: 'won_above', tags: ['combat'], count: 500, after: ACH.won_above_250, personality: ap({ nerve: 1 }) },
      [ACH.won_pct_25]: { id: ACH.won_pct_25, name: 'Long Odds', level: 'iii', rule: 'won_above_pct', tags: ['combat'], count: 25, personality: ap({ nerve: 1 }) },
      [ACH.won_pct_50]: { id: ACH.won_pct_50, name: 'Against All Odds', level: 'iv', rule: 'won_above_pct', tags: ['combat'], count: 50, after: ACH.won_pct_25, personality: ap({ nerve: 1 }) },
      [ACH.won_pct_100]: { id: ACH.won_pct_100, name: 'Nobody Bet on You', level: 'v', rule: 'won_above_pct', tags: ['combat'], count: 100, after: ACH.won_pct_50, personality: ap({ nerve: 1 }) },
      // event rolls at the Critical tiers: each level is earned by reaching the tier the level below opened, and opens the next
      [ACH.event_crit_1]: { id: ACH.event_crit_1, name: 'Fate Meant It as a Curse', level: 'i', rule: 'event_crits', tags: ['exploration'], count: 1, tierUnlocks: [{ roll: 'event', side: 'up', steps: 1 }] },
      [ACH.event_crit_2]: { id: ACH.event_crit_2, name: 'Fortune\'s Favourite Accident', level: 'ii', rule: 'event_crits', tags: ['exploration'], count: 2, after: ACH.event_crit_1, tierUnlocks: [{ roll: 'event', side: 'up', steps: 1 }] },
      [ACH.event_crit_3]: { id: ACH.event_crit_3, name: 'The Joke Is on Fate', level: 'iii', rule: 'event_crits', tags: ['exploration'], count: 3, after: ACH.event_crit_2, tierUnlocks: [{ roll: 'event', side: 'up', steps: 1 }] },
      [ACH.event_crit_fail_1]: { id: ACH.event_crit_fail_1, name: 'Fate Has a Sense of Humour', level: 'zero', rule: 'event_crit_fails', tags: ['exploration'], count: 1, scar: true, tierUnlocks: [{ roll: 'event', side: 'down', steps: 1 }] },
      [ACH.event_crit_fail_2]: { id: ACH.event_crit_fail_2, name: 'Cursed by Coincidence', level: 'i', rule: 'event_crit_fails', tags: ['exploration'], count: 2, after: ACH.event_crit_fail_1, scar: true, tierUnlocks: [{ roll: 'event', side: 'down', steps: 1 }] },
      [ACH.event_crit_fail_3]: { id: ACH.event_crit_fail_3, name: 'Fate\'s Favourite Punchline', level: 'ii', rule: 'event_crit_fails', tags: ['exploration'], count: 3, after: ACH.event_crit_fail_2, scar: true, tierUnlocks: [{ roll: 'event', side: 'down', steps: 1 }] },
      [ACH.total_10]: { id: ACH.total_10, name: 'A Few Threads', level: 'i', rule: 'achievements', tags: ['progression'], count: 10 },
      [ACH.total_25]: { id: ACH.total_25, name: 'Woven In', level: 'ii', rule: 'achievements', tags: ['progression'], count: 25, after: ACH.total_10 },
      [ACH.total_50]: { id: ACH.total_50, name: 'A Thread Worth Following', level: 'iii', rule: 'achievements', tags: ['progression'], count: 50, after: ACH.total_25 },
      [ACH.total_100]: { id: ACH.total_100, name: 'Pattern in the Weave', level: 'iv', rule: 'achievements', tags: ['progression'], count: 100, after: ACH.total_50 },
      [ACH.total_250]: { id: ACH.total_250, name: 'The Tapestry Remembers', level: 'v', rule: 'achievements', tags: ['progression'], count: 250, after: ACH.total_100 },
      // TM16: the chain scales with however many achievements the game gains: every 250 past 250, a reward level higher each time
      [ACH.total_every]: { id: ACH.total_every, name: 'The Weave Goes On ({level})', level: 'v', rule: 'achievements', tags: ['progression'], count: 500, every: 250, levelStep: 1, branchOf: ACH.total_10 },
      // TM14: areas entered, counted per kind of area under one head: zones 1 / 25 / 50 / 150 / 300, and every kind of place
      // (a settlement, a place in one, any kind made later) 1 / 5 / 10 / 25 / 50. New names are placeholders.
      [ACH.zones_1]: { id: ACH.zones_1, name: 'Out the Door', level: 'minus_1', rule: 'zones', tags: ['exploration'], count: 1, branchOf: ACH_HEADS.areas },
      [ACH.zones_25]: { id: ACH.zones_25, name: 'Finding Your Feet', level: 'zero', rule: 'zones', tags: ['exploration'], count: 25, after: ACH.zones_1, personality: ap({ [PA.curiosity]: 1 }) },
      [ACH.zones_50]: { id: ACH.zones_50, name: 'Wanderer', level: 'i', rule: 'zones', tags: ['exploration'], count: 50, after: ACH.zones_25, personality: ap({ [PA.curiosity]: 1 }) },
      [ACH.zones_150]: { id: ACH.zones_150, name: 'Pathfinder', level: 'ii', rule: 'zones', tags: ['exploration'], count: 150, after: ACH.zones_50, personality: ap({ [PA.curiosity]: 1 }) },
      [ACH.zones_300]: { id: ACH.zones_300, name: 'Walker of Every Road', level: 'iii', rule: 'zones', tags: ['exploration'], count: 300, after: ACH.zones_150, personality: ap({ [PA.curiosity]: 1 }) },
      [ACH.places_1]: { id: ACH.places_1, name: 'Set Foot in a {place_kind}', level: 'zero', rule: 'places', by: 'place_kind', tags: ['exploration'], count: 1, branchOf: ACH_HEADS.areas },
      [ACH.places_5]: { id: ACH.places_5, name: 'Roamer ({place_kind})', level: 'i', rule: 'places', by: 'place_kind', tags: ['exploration'], count: 5, after: ACH.places_1 },
      [ACH.places_10]: { id: ACH.places_10, name: 'Traveller ({place_kind})', level: 'ii', rule: 'places', by: 'place_kind', tags: ['exploration'], count: 10, after: ACH.places_5, personality: ap({ [PA.curiosity]: 1 }) },
      [ACH.places_25]: { id: ACH.places_25, name: 'Seasoned Traveller ({place_kind})', level: 'iii', rule: 'places', by: 'place_kind', tags: ['exploration'], count: 25, after: ACH.places_10, personality: ap({ [PA.curiosity]: 1 }) },
      [ACH.places_50]: { id: ACH.places_50, name: 'Known in Every {place_kind}', level: 'iv', rule: 'places', by: 'place_kind', tags: ['exploration'], count: 50, after: ACH.places_25, personality: ap({ [PA.curiosity]: 1 }) },
      // TM23: the first time your health reaches each wound level; worse levels pay more (names are placeholders)
      [ACH.health_first]: { id: ACH.health_first, name: 'First Time {health_level}', level: 'zero', rule: 'health_reached', by: 'health_level', tags: ['survival'], count: 1, branchOf: ACH_HEADS.wounds,
        levelUp: { injured: 1, wounded: 1, mauled: 2, critical: 2, incapacitated: 3 },
        names: { bruised: 'First Bruise', hurt: 'First Real Hurt', injured: 'First Injury', wounded: 'First Wound', mauled: 'Mauled and Standing', critical: 'At Death\'s Door', incapacitated: 'Back from the Brink of Nothing' } },
      [ACH.deals_1]: { id: ACH.deals_1, name: 'Word Given', level: 'i', rule: 'deals', tags: ['social'], count: 1, personality: ap({ [PA.honesty]: 1 }) },
      [ACH.deals_10]: { id: ACH.deals_10, name: 'Dealmaker', level: 'ii', rule: 'deals', tags: ['social'], count: 10, after: ACH.deals_1, personality: ap({ [PA.honesty]: 1 }) },
      [ACH.deals_100]: { id: ACH.deals_100, name: 'Silver Tongue', level: 'iii', rule: 'deals', tags: ['social'], count: 100, after: ACH.deals_10, pricePct: 5, personality: ap({ [PA.honesty]: 1 }) },
      [ACH.days_7]: { id: ACH.days_7, name: 'Still Breathing', level: 'i', rule: 'days', tags: ['survival'], count: 7 },
      [ACH.days_30]: { id: ACH.days_30, name: 'Seasoned', level: 'ii', rule: 'days', tags: ['survival'], count: 30, after: ACH.days_7, restPct: 10 },
      [ACH.days_100]: { id: ACH.days_100, name: 'Old Blood', level: 'iii', rule: 'days', tags: ['survival'], count: 100, after: ACH.days_30, eventRoll: 10 },
      [ACH.class_unlock]: { id: ACH.class_unlock, name: '{class} Awakened', level: 'i', rule: 'class_unlock', tags: ['progression'], count: 1, by: 'class' },
      // classes at their top level: in all, per class tier (one, then several in the same tier), and across tiers
      [ACH.class_max_1]: { id: ACH.class_max_1, name: 'Path Walked to Its End', level: 'i', rule: 'class_max', tags: ['progression'], count: 1 },
      [ACH.class_max_3]: { id: ACH.class_max_3, name: 'Thrice Mastered', level: 'ii', rule: 'class_max', tags: ['progression'], count: 3, after: ACH.class_max_1 },
      [ACH.class_max_5]: { id: ACH.class_max_5, name: 'Master of Many Paths', level: 'iii', rule: 'class_max', tags: ['progression'], count: 5, after: ACH.class_max_3 },
      [ACH.class_max_10]: { id: ACH.class_max_10, name: 'The Thousand-Faced', level: 'iv', rule: 'class_max', tags: ['progression'], count: 10, after: ACH.class_max_5 },
      [ACH.class_max_tier_1]: { id: ACH.class_max_tier_1, name: 'Peak of the {tier}', level: 'i', rule: 'class_max', tags: ['progression'], count: 1, by: 'class_tier', branchOf: ACH.class_max_1 },
      [ACH.class_max_tier_2]: { id: ACH.class_max_tier_2, name: 'Twin Peaks of the {tier}', level: 'ii', rule: 'class_max', tags: ['progression'], count: 2, by: 'class_tier', after: ACH.class_max_tier_1 },
      [ACH.class_max_tier_3]: { id: ACH.class_max_tier_3, name: 'Crown of the {tier}', level: 'iii', rule: 'class_max', tags: ['progression'], count: 3, by: 'class_tier', after: ACH.class_max_tier_2 },
      [ACH.class_tiers_2]: { id: ACH.class_tiers_2, name: 'Across Two Heights', level: 'ii', rule: 'class_max_tiers', tags: ['progression'], count: 2, freeLevels: 1, branchOf: ACH.class_max_1 },
      [ACH.class_tiers_3]: { id: ACH.class_tiers_3, name: 'Across Three Heights', level: 'iii', rule: 'class_max_tiers', tags: ['progression'], count: 3, after: ACH.class_tiers_2, freeLevels: 2 },
      [ACH.class_tiers_4]: { id: ACH.class_tiers_4, name: 'Across Four Heights', level: 'iv', rule: 'class_max_tiers', tags: ['progression'], count: 4, after: ACH.class_tiers_3, freeLevels: 3 },
      [ACH.class_tiers_5]: { id: ACH.class_tiers_5, name: 'Across Five Heights', level: 'v', rule: 'class_max_tiers', tags: ['progression'], count: 5, after: ACH.class_tiers_4, freeLevels: 4 },
      [ACH.class_tiers_all]: { id: ACH.class_tiers_all, name: 'Every Height Climbed', level: 'vi', rule: 'class_max_tiers', tags: ['progression'], count: CLASS_TIERS.keys.length, after: ACH.class_tiers_5, freeLevels: 5 },
      [ACH.char_level_10]: { id: ACH.char_level_10, name: 'Woven Past Counting ({level})', level: 'minus_1', rule: 'char_level', tags: ['progression'], count: 10, every: 10, levelStep: 1,
        names: { 10: 'No Longer Green', 20: 'Steady Hand', 30: 'Battle-Tested', 40: 'A Name Worth Knowing', 50: 'Half a Hundred Roads',
          60: 'Something Tugs at the Edges', 70: 'The Pattern Takes Notice', 80: 'Caught in the Weave', 90: 'A Thread That Will Not Fray', 100: 'One Who Pulls the Threads' } },
      // growth proposal EG12 a (approved): take your first essence; fill every essence slot at character level 8 or higher
      [ACH.first_knot]: { id: ACH.first_knot, name: 'First Knot', level: 'i', rule: 'essences_taken', tags: ['progression'], count: 1 },
      [ACH.room_for_no_more]: { id: ACH.room_for_no_more, name: 'Room for No More', level: 'ii', rule: 'essence_room', tags: ['progression'], count: 8 },
    },
  });
  // ST1: a skill's tree is wherever the trees table lists it, so moving a skill is one edit there
  for (const t of Object.values(lib.trees)) for (const id of t.skills) if (lib.skills[id]) lib.skills[id].treeId = t.id;
  // an All-50 skill part sits in its skill's current tree, so it moves with the skill
  for (const p of Object.values(lib.perks)) if (p.allStep?.skill) {
    const treeId = lib.skills[p.allStep.skill]?.treeId;
    if (treeId) p.allStep = { ...p.allStep, treeId };
  }
  return lib;
}
