// The prototype library: skills (Part 1 §3), body types (Part 3), classes and templates (Part 4 §4),
// items (Appendix: prototype item bank), routine bank (Appendix: prototype routine bank). All numbers are placeholders.
import { TP } from './templateIds';
import { BT, RC } from './raceIds';
import { TR } from './treeIds';
import { CONFIG } from '../config';
import type { ArmorWeightKey } from '../scales';
import { CLASS_TIERS } from '../scales';
import type { AccessCond, ActivityDef, BodyType, ItemDef, ItemEffect, Library, NpcTemplate, PerkDef, Routine, RoutineSet, SituationTag, SkillDef, SkillGroup, XpCategory } from '../types';
import { FUNCTION_GROUP } from './functionNames';
import { PERK_WRITEUPS } from './perks';
import { BOOST_PERKS } from './boostPerks';
import { ALL_PARTS } from './allPerks';
import { BUILT_PERKS } from './builtPerks';
import { SK, OLD_SKILL_IDS } from './skillIds';
import { ACH } from './achievementIds';
import { FN, GR } from './functionIds';
import { CL } from './classIds';
import { SV } from './serviceIds';
import { PK } from './perkIds';
import { IT } from './itemIds';

/** XP category from the skill's group (X21, F8); a skill with no deciding group names its own. */
/** aimed hits per part size: smaller parts are harder to hit, so their levels pay this many reward levels more */
const SMALLER_PAYS_MORE = { small: 1, extra_small: 1, tiny: 2 };

const CATEGORY_OF: Partial<Record<SkillGroup, XpCategory>> = {
  [GR.melee]: 'offensive', [GR.ranged]: 'offensive', [GR.defense]: 'defensive', [GR.health]: 'endurance', [GR.notice]: 'notice', [GR.influence]: 'influence',
};
const sk = (id: string, treeId: string, functions: SkillDef['functions'], roles: SkillDef['roles'], cue?: 'sight' | 'sound', xpCategory?: XpCategory, tier: SkillDef['tier'] = 'tier_2'): SkillDef =>
  ({ id, treeId, functions, roles, ...(cue ? { cue } : {}), xpCategory: xpCategory ?? CATEGORY_OF[FUNCTION_GROUP[functions[0]]] ?? 'misc', tier });

export const SKILLS: Record<string, SkillDef> = Object.fromEntries([
  sk(SK.melee_light, TR.melee, [FN.arms], ['grip']),
  sk(SK.melee_medium, TR.melee, [FN.arms], ['grip']),
  sk(SK.melee_heavy, TR.melee, [FN.arms], ['grip']),
  sk(SK.ranged_light, TR.ranged, [FN.ranged], ['grip']),
  sk(SK.ranged_medium, TR.ranged, [FN.ranged], ['grip']),
  sk(SK.ranged_heavy, TR.ranged, [FN.ranged], ['grip']),
  sk(SK.unarmed_strike, TR.unarmed, [FN.unarmed], ['grip']),
  sk(SK.unarmed_grapple, TR.unarmed, [FN.unarmed], ['grip']),
  sk(SK.unarmed_improvised, TR.unarmed, [FN.unarmed], ['grip']), // fighting with whatever is at hand
  sk(SK.unarmed_natural, TR.natural, [FN.unarmed], ['strike']), // its own tree, open to slime and dragon bodies (TA5)
  { ...sk(SK.dodge, TR.defense, [FN.defense], ['move']), groups: [GR.speed] }, // Defense and Speed groups; no Initiative function, so it doesn't add to initiative
  sk(SK.block, TR.defense, [FN.defense], ['grip']),
  sk(SK.endurance, TR.defense, [FN.health], []), // endurance sets total HP
  // Armor – Conventional (AR1–AR3): one skill per armor weight, function armor in the Defense group.
  // What the skill does while worn (AR4) and how it improves (AR5) are parked; equip requirements will read it.
  sk(SK.light_armor, TR.armor, [FN.armor], []),
  sk(SK.medium_armor, TR.armor, [FN.armor], []),
  sk(SK.heavy_armor, TR.armor, [FN.armor], []),
  sk(SK.eyesight, TR.perception, [FN.sight], ['sense'], 'sight'),
  sk(SK.earshot, TR.perception, [FN.hearing], ['sense'], 'sound'),
  // Stealth (ST1–ST10): one function, two skills; code picks Combat Stealth in an engagement, Sneaking
  // otherwise. Stealth is movement (the move role), so leg wounds count, except when hiding. Rating: notice / offensive.
  sk(SK.sneaking, TR.stealth, [FN.stealth], ['move'], undefined, 'notice'),
  sk(SK.combat_stealth, TR.stealth, [FN.stealth], ['move'], undefined, 'offensive'),
  sk(SK.vanishing, TR.stealth, [FN.stealth], ['move'], undefined, 'offensive'), // ST11/ST18: breaks established sight
  // speech role: head wounds reduce speech rolls
  sk(SK.persuasion, TR.speech, [FN.influence], ['speech']),
  sk(SK.intimidation, TR.speech, [FN.influence], ['speech']),
  sk(SK.barter, TR.speech, [FN.influence], ['speech']),
  sk(SK.feint, TR.swordsman, [], ['grip'], undefined, 'offensive'),
  sk(SK.riposte, TR.swordsman, [], ['grip'], undefined, 'offensive'),
  sk(SK.disarm, TR.swordsman, [], ['grip'], undefined, 'offensive'),
  // slime class skills are tier 0; F1: tremor is both a sight and a hearing function
  sk(SK.tremor, TR.slime_senses, [FN.sight, FN.hearing], ['sense'], 'sound', undefined, 'tier_0'),
  // OQ-20 (settled): placeholder tool skill id, renamed through library aliases later. Not on the creation screen.
  sk(SK.lockpicking, TR.tools, [], ['grip']),
].map((s) => [s.id, s]));

/** ST21: situation tags per skill. Light reaches sight and stealth; cover reaches hide and ranged. */
const SITUATION_TAGS_OF: Record<string, SituationTag[]> = {
  [SK.melee_light]: ['sight'], [SK.melee_medium]: ['sight'], [SK.melee_heavy]: ['sight'],
  [SK.ranged_light]: ['sight', 'ranged'], [SK.ranged_medium]: ['sight', 'ranged'], [SK.ranged_heavy]: ['sight', 'ranged'],
  [SK.unarmed_strike]: ['sight'], [SK.unarmed_grapple]: ['sight'], [SK.unarmed_improvised]: ['sight'], [SK.unarmed_natural]: ['sight'],
  [SK.dodge]: ['sight'], [SK.block]: ['sight'], [SK.eyesight]: ['sight'], [SK.earshot]: ['hearing'], [SK.tremor]: ['hearing'], // hearing: no table reads it yet
  [SK.sneaking]: ['stealth'], [SK.combat_stealth]: ['stealth'], [SK.vanishing]: ['stealth', 'hide'],
};
for (const [id, tags] of Object.entries(SITUATION_TAGS_OF)) SKILLS[id].tags = tags;
// SR1: intimidation is open to any race with the Speech tree; persuasion and barter need a speaking race
for (const id of [SK.persuasion, SK.barter]) SKILLS[id].access = { must: [{ kind: 'raceTag', id: 'speaks' }] };

const mode = (m: Partial<import('../types').AttackMode> & Pick<import('../types').AttackMode, 'id' | 'tree' | 'class' | 'reach' | 'hands'>) => m;
const KIT = (skill = '$mode'): ItemEffect => ({ kind: 'skill', skill, value: 25, active: 'held', scope: 'withItem', kit: true });
/** armor numbers come from CONFIG (one source, Part 5 armor table) */
/** Improvised weapons: a melee strike and a throw (like throwing a vase), both rolled with
 * Improvisation. Unarmed skills stand in for both (its own function); Arms skills also stand in for the strike,
 * Ranged skills for the throw. */
const IMPROVISED_MODES = (cls: 'light' | 'medium' | 'heavy', hands: 1 | 2) => [
  mode({ id: 'strike', tree: 'melee', class: cls, skill: SK.unarmed_improvised, reach: 0, hands, hitAdj: CONFIG.IMPROVISED_HIT_ADJ, standInFns: [FN.arms] }),
  mode({ id: 'throw', tree: 'ranged', class: cls, skill: SK.unarmed_improvised, reach: 1, hands, thrown: true, hitAdj: CONFIG.IMPROVISED_HIT_ADJ, standInFns: [FN.ranged] }),
];
const ARMOR = (w: ArmorWeightKey) => ({ reduction: CONFIG.ARMOR_PROTECTION[w][0], multiplier: CONFIG.ARMOR_PROTECTION[w][1], weight: w });
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
  [PK.quick_study]: {
    id: PK.quick_study, name: 'Quick Study', built: true, classLevel: { classId: CL.late_bloomer, level: 1 }, improveRolls: { below: 15, rolls: 2 },
    story: 'You came to this late, and it shows in how fast you learn. A skill you have barely touched improves twice as readily.',
    rules: { kind: 'passive', trigger: 'an improvement roll for a marked skill', conditions: ['the skill\'s raw value is below 15'], effect: 'roll twice; each roll that passes adds its own gain', lasts: 'always' },
  },
};

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(([
  { id: IT.dagger, level: 'common', tags: ['starter'], kind: 'weapon', name: 'dagger', look: 'a plain dagger', bulk: 1, value: 5, hands: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: 'slash', tree: 'melee', class: 'light', reach: 0, hands: 1 }), mode({ id: 'throw', tree: 'ranged', class: 'light', reach: 1, hands: 1, thrown: true })] } },
  { id: IT.arming_sword, level: 'fine', tags: ['starter'], kind: 'weapon', name: 'arming sword', look: 'a straight arming sword', bulk: 2, value: 20, hands: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: 'cut', tree: 'melee', class: 'medium', reach: 0, hands: 1 })] } },
  { id: IT.greataxe, level: 'superior', tags: ['starter'], kind: 'weapon', name: 'greataxe', look: 'a heavy two-handed axe', bulk: 3, value: 30, hands: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: 'chop', tree: 'melee', class: 'heavy', reach: 0, hands: 2 })] } },
  { id: IT.spear, level: 'fine', tags: ['starter'], kind: 'weapon', name: 'spear', look: 'an ash-shafted spear', bulk: 3, value: 10, hands: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: 'thrust', tree: 'melee', class: 'medium', reach: 1, hands: 2 }), mode({ id: 'throw', tree: 'ranged', class: 'medium', reach: 1, hands: 1, thrown: true })] } },
  { id: IT.shortbow, level: 'common', tags: ['starter'], kind: 'weapon', name: 'shortbow', look: 'a short hunting bow', bulk: 2, value: 25, hands: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: 'shoot', tree: 'ranged', class: 'light', reach: 3, hands: 2 })] } },
  { id: IT.longbow, level: 'fine', tags: ['starter'], kind: 'weapon', name: 'longbow', look: 'a tall longbow', bulk: 3, value: 35, hands: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: 'shoot', tree: 'ranged', class: 'medium', reach: 4, hands: 2 })] } },
  { id: IT.crossbow, level: 'superior', tags: ['starter'], kind: 'weapon', name: 'crossbow', look: 'a heavy crossbow', bulk: 3, value: 40, hands: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: 'shoot', tree: 'ranged', class: 'heavy', reach: 4, hands: 2 })] } },
  { id: IT.hidden_blade, level: 'fine', kind: 'weapon', name: 'hidden blade', look: 'a slim blade', bulk: 1, value: 30, hands: 1, concealed: true, effects: [KIT()],
    weapon: { modes: [mode({ id: 'stab', tree: 'melee', class: 'light', reach: 0, hands: 1 })] } },
  // Crude gear: level Crude needs 0. Only the clothes are in the starter kit; the crude weapons are library
  // items outside it. Clothes stop nothing and cost no Dodge (placeholders).
  { id: IT.crude_clothes, level: 'crude', tags: ['starter'], kind: 'armor', name: 'rough clothes', look: 'rough homespun clothes', bulk: 1, value: 1, slot: 'armor',
    armor: { covers: ['general'], reduction: 0, multiplier: 1, weight: 'light' } },
  { id: IT.cudgel, level: 'crude', kind: 'weapon', name: 'cudgel', look: 'a knotted wooden cudgel', bulk: 2, value: 1, hands: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: 'club', tree: 'melee', class: 'medium', reach: 0, hands: 1 })] } },
  { id: IT.rusty_knife, level: 'crude', kind: 'weapon', name: 'rusty knife', look: 'a rusty knife', bulk: 1, value: 1, hands: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: 'slash', tree: 'melee', class: 'light', reach: 0, hands: 1 })] } },
  { id: IT.gambeson, level: 'common', tags: ['starter'], kind: 'armor', name: 'gambeson', look: 'a quilted gambeson', bulk: 2, value: 15, slot: 'armor', effects: [WEIGHT(CONFIG.ARMOR_DODGE.light)],
    armor: { covers: ['general', 'left_arm', 'right_arm', 'left_leg', 'right_leg'], ...ARMOR('light') } },
  { id: IT.mail_hauberk, level: 'fine', tags: ['starter'], kind: 'armor', name: 'mail hauberk', look: 'a mail hauberk', bulk: 3, value: 60, slot: 'armor', effects: [WEIGHT(CONFIG.ARMOR_DODGE.medium)],
    armor: { covers: ['general', 'left_arm', 'right_arm'], ...ARMOR('medium') } },
  { id: IT.plate_harness, level: 'superior', tags: ['starter'], kind: 'armor', name: 'plate harness', look: 'a full plate harness', bulk: 3, value: 200, slot: 'armor', effects: [WEIGHT(CONFIG.ARMOR_DODGE.heavy)],
    armor: { covers: ['general', 'left_arm', 'right_arm', 'left_leg', 'right_leg', 'head', 'neck'], ...ARMOR('heavy'), pools: { head: 20 } } },
  { id: IT.round_shield, level: 'common', tags: ['starter'], kind: 'shield', name: 'round shield', look: 'a painted round shield', bulk: 2, value: 10, hands: 1, effects: [KIT(SK.block)], shield: { pool: 30 } },
  { id: IT.signet_ring, kind: 'accessory', name: 'signet ring', look: 'a heavy signet ring', bulk: 0, value: 40, slot: 'accessory', visible: true },
  { id: IT.lucky_charm, kind: 'misc', name: 'lucky charm', look: 'a small knotted charm', bulk: 0, value: 50,
    effects: [{ kind: 'rollMod', roll: 'situation', value: 5, active: 'carried', scope: 'any' }] },
  { id: IT.lockpicks, kind: 'tool', name: 'lockpicks', look: 'a roll of lockpicks', bulk: 0, value: 15, hands: 1,
    effects: [{ kind: 'skill', skill: SK.lockpicking, value: 25, active: 'inUse', scope: 'withItem' }] },
  { id: IT.healing_draught, kind: 'consumable', name: 'healing draught', look: 'a stoppered vial', bulk: 1, value: 10, hands: 1, stackable: true, consumable: true },
  // generic bases for minted items with no close match, and for scene objects the player grabs (loot L2, L3)
  { id: IT.improvised_light, level: 'common', kind: 'weapon', name: 'improvised weapon', look: 'something small grabbed to fight with', bulk: 1, value: 0, hands: 1, tags: ['improvised'],
    weapon: { modes: IMPROVISED_MODES('light', 1) } },
  { id: IT.improvised_medium, level: 'common', kind: 'weapon', name: 'improvised weapon', look: 'something grabbed to fight with', bulk: 2, value: 0, hands: 1, tags: ['improvised'],
    weapon: { modes: IMPROVISED_MODES('medium', 1) } },
  { id: IT.improvised_heavy, level: 'common', kind: 'weapon', name: 'improvised weapon', look: 'something heavy grabbed to fight with', bulk: 3, value: 0, hands: 2, tags: ['improvised'],
    weapon: { modes: IMPROVISED_MODES('heavy', 2) } },
  { id: IT.curio, kind: 'misc', name: 'curio', look: 'an odd little object', bulk: 1, value: 1 },
  { id: IT.bandage, kind: 'consumable', name: 'bandage', look: 'a roll of linen bandage', bulk: 0, value: 2, stackable: true, consumable: true, heal: 'bandage' },
  { id: IT.coin, kind: 'misc', name: 'coin', look: 'coins', bulk: 0, value: 1, stackable: true },
] as ItemDef[]).map((i) => [i.id, i]));

export const BODY_TYPES: Record<string, BodyType> = {
  [BT.humanoid]: {
    id: BT.humanoid, name: 'Humanoid', general: { name: 'torso', size: 'normal' },
    naturalAttacks: [{ id: 'punch', tree: 'unarmed', class: 'punch', skill: SK.unarmed_strike, reach: 0, hands: 0, name: 'fists' },
      { id: 'grapple', tree: 'unarmed', class: 'grapple', skill: SK.unarmed_grapple, reach: 0, hands: 0, name: 'grapple' }],
    parts: [
      { id: 'head', size: 'small', impact: 'essential', roles: ['sense', 'speech'], adjacent: ['general', 'neck'] },
      { id: 'left_arm', size: 'normal', impact: 'normal', roles: ['grip'] },
      { id: 'right_arm', size: 'normal', impact: 'normal', roles: ['grip'] },
      { id: 'left_leg', size: 'normal', impact: 'normal', roles: ['move'] },
      { id: 'right_leg', size: 'normal', impact: 'normal', roles: ['move'] },
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
    naturalAttacks: [{ id: 'slam', tree: 'unarmed', class: 'slam', skill: SK.unarmed_natural, reach: 0, hands: 0, name: 'slam' }],
    parts: [],
    fallback: { attackSkill: SK.unarmed_natural },
  },
  [BT.winged_quadruped]: {
    id: BT.winged_quadruped, name: 'Winged quadruped', general: { name: 'body', size: 'big' },
    naturalAttacks: [],
    parts: [
      { id: 'head', size: 'normal', impact: 'essential', roles: ['sense', 'strike', 'speech'] },
      { id: 'left_wing', size: 'normal', impact: 'non_essential', roles: ['fly'] },
      { id: 'right_wing', size: 'normal', impact: 'non_essential', roles: ['fly'] },
      { id: 'forelegs', size: 'normal', impact: 'normal', roles: ['move'] },
      { id: 'hind_legs', size: 'normal', impact: 'normal', roles: ['move'] },
      { id: 'tail', size: 'small', impact: 'non_essential', roles: ['strike'] },
    ],
    fallback: { attackSkill: SK.unarmed_natural },
  },
};

export const TEMPLATES: Record<string, NpcTemplate> = {
  [TP.slime]: {
    id: TP.slime, raceId: RC.slime, generation: 'copy', minimums: { [SK.unarmed_natural]: 30, [SK.tremor]: 50 },
    level: 0, bonusPoints: 0, focus: [], personality: 'fearless', control: 'code', label: 'a slime',
    fallback: { attackSkill: SK.unarmed_natural },
  },
  [TP.guard]: {
    id: TP.guard, raceId: RC.human, generation: 'copy',
    minimums: { [SK.melee_medium]: 50, [SK.medium_armor]: 50, [SK.block]: 30, [SK.dodge]: 20, [SK.eyesight]: 30, [SK.earshot]: 30, [SK.intimidation]: 30, [SK.persuasion]: 20 }, // AR9/EQ5: meets its loadout's requirements
    // Anyone with fighting experience is at least level 4; any patrolling template has Keen Ear
    level: 4, bonusPoints: 10, perks: [PK.keen_ear],
    focus: [{ treeId: TR.melee, skill: SK.melee_medium }, { treeId: TR.defense, skill: SK.block }, { treeId: TR.perception, skill: SK.eyesight }],
    personality: 'steady', loadout: [IT.arming_sword, IT.mail_hauberk], control: 'agent', label: 'a village guard',
  },
  [TP.trader]: {
    id: TP.trader, raceId: RC.human, classId: CL.trader, generation: 'copy',
    minimums: { [SK.eyesight]: 25, [SK.earshot]: 25, [SK.barter]: 40, [SK.persuasion]: 30 }, level: 2, bonusPoints: 0, // Villagers are at least level 2
    focus: [{ treeId: TR.perception, skill: SK.earshot }, { treeId: TR.melee, skill: SK.melee_light }, { treeId: TR.defense, skill: SK.dodge }],
    personality: 'timid', control: 'code', label: 'the barkeep',
  },
  // NS7: a village thief, the first stealthy NPC
  [TP.thief]: {
    id: TP.thief, raceId: RC.human, generation: 'copy',
    minimums: { [SK.sneaking]: 40, [SK.combat_stealth]: 30, [SK.vanishing]: 30, [SK.melee_light]: 35, [SK.light_armor]: 25, [SK.dodge]: 30, [SK.eyesight]: 30, [SK.earshot]: 30 }, level: 4, bonusPoints: 10, // fighting experience: level 4
    focus: [{ treeId: TR.stealth, skill: SK.sneaking }, { treeId: TR.melee, skill: SK.melee_light }, { treeId: TR.defense, skill: SK.dodge }],
    personality: 'timid', loadout: [IT.dagger, IT.gambeson], control: 'agent', label: 'a shifty villager',
  },
  [TP.patron]: {
    id: TP.patron, raceId: RC.human, generation: 'copy',
    minimums: { [SK.unarmed_strike]: 20, [SK.eyesight]: 20, [SK.persuasion]: 30 }, level: 2, bonusPoints: 0,
    focus: [{ treeId: TR.unarmed, skill: SK.unarmed_strike }, { treeId: TR.defense, skill: SK.dodge }, { treeId: TR.perception, skill: SK.eyesight }],
    personality: 'timid', control: 'code', label: 'a tavern patron',
  },
};

const act = (id: string, look: string, attention: ActivityDef['attention'], noise: ActivityDef['noise'], visibility: ActivityDef['visibility']): ActivityDef =>
  ({ id, look, attention, noise, visibility });
export const ACTIVITIES: Record<string, ActivityDef> = Object.fromEntries([
  act('stand_watch', 'keeping watch', 'alert', 'silent', 'normal'),
  act('walk', 'walking', 'normal', 'quiet', 'normal'),
  act('work', 'hard at work', 'normal', 'normal', 'normal'),
  act('tend_counter', 'tending the counter', 'normal', 'quiet', 'normal'),
  act('drink', 'nursing a drink', 'distracted', 'quiet', 'normal'),
  act('chat', 'chatting', 'distracted', 'normal', 'normal'),
  act('sleep', 'asleep', 'asleep', 'quiet', 'low'),
  act('rest', 'resting', 'distracted', 'silent', 'low'),
  act('cower', 'keeping out of sight', 'alert', 'silent', 'close'), // NV4
  act('ooze', 'oozing across the grass', 'normal', 'quiet', 'normal'),
  act('prowl', 'keeping to the shadows', 'alert', 'silent', 'close'), // NV4
].map((a) => [a.id, a]));

const CALL_HELP = { type: 'call_help', target: null, skill: null, intent: 'call for help' } as const;
const sched = (id: string, brief: string, loop: boolean, steps: [string, Routine['steps'][0]['duration'], string][], alert: string | undefined, onAlert: Routine['onAlert']): Routine =>
  ({ id, brief, kind: 'schedule', loop, steps: steps.map(([slot, duration, activity]) => ({ slot, duration, activity })), ...(alert ? { alert } : {}), onAlert });
const still = (id: string, kind: 'wait' | 'follow', activity: string, brief: string, alert?: string): Routine =>
  ({ id, brief, kind, loop: false, steps: [], activity, ...(alert ? { alert } : {}), onAlert: null });

export const ROUTINES: Record<string, Routine> = Object.fromEntries([
  sched('guard_post', 'Stands watch at the post', true, [['post', 'long', 'stand_watch']], 'hold_post_alert', { ...CALL_HELP }),
  sched('hold_post_alert', 'Holds the post on alert', true, [['post', 'long', 'stand_watch']], undefined, null),
  sched('patrol', 'Walks the beat, stop by stop', true, [['route', 'short', 'walk']], 'search_route_alert', { ...CALL_HELP }),
  sched('search_route_alert', 'Sweeps the beat fast, on alert', true, [['route', 'brief', 'stand_watch']], undefined, null),
  sched('tend_bar', 'Works behind the bar', true, [['counter', 'long', 'tend_counter']], 'flee_to_refuge_alert', null),
  sched('drink_at_seat', 'Drinks and chats at a seat', true, [['seat', 'medium', 'drink'], ['seat', 'short', 'chat']], 'flee_to_refuge_alert', null),
  sched('sleep_in_bed', 'Sleeps in bed', true, [['bed', 'long', 'sleep']], 'flee_to_refuge_alert', null),
  sched('work_shift', 'Works with short breaks', true, [['work', 'long', 'work'], ['work', 'brief', 'rest']], 'flee_to_refuge_alert', null),
  sched('flee_to_refuge_alert', 'Hides in the refuge', false, [['refuge', 'long', 'cower']], undefined, null),
  sched('leave_by_exit', 'Heads for the exit and lingers', false, [['exit', 'long', 'rest']], 'flee_to_refuge_alert', null),
  still('wait', 'wait', 'rest', 'Waits where it stands', 'wait_alert'),
  still('wait_alert', 'wait', 'stand_watch', 'Waits on guard where it stands'),
  still('follow', 'follow', 'walk', 'Follows the player', 'follow_alert'),
  still('follow_alert', 'follow', 'stand_watch', 'Follows the player, on guard'),
  still('idle_here', 'wait', 'rest', 'Fallback only; in no set'),
  { ...sched('prowl', 'Prowls unseen, stop by stop', true, [['route', 'short', 'prowl']], 'lie_low_alert', null), posture: 'stealthy' as const },
  { ...sched('lie_low_alert', 'Slips off to lie low, on alert', false, [['refuge', 'long', 'cower']], undefined, null), posture: 'stealthy' as const },
  sched('roam_field', 'Oozes across the field, then settles', true, [['route', 'short', 'ooze'], ['post', 'medium', 'rest']], 'roam_field_alert', null),
  sched('roam_field_alert', 'Sweeps the field fast on alert; never flees', true, [['route', 'brief', 'ooze']], undefined, null),
].map((r) => [r.id, r]));

const set = (id: string, brief: string, place: string[], role: string[], time: RoutineSet['tags']['time'], slots: RoutineSet['slots'], routines: string[]): RoutineSet =>
  ({ id, brief, tags: { place, role, time, event: ['ordinary'] }, slots, routines });
const z = (hint: string) => ({ kind: 'zone' as const, hint });
const r = (hint: string) => ({ kind: 'route' as const, hint });
export const ROUTINE_SETS: Record<string, RoutineSet> = Object.fromEntries([
  set('gate_guard', 'A guard posted at one spot', ['gate', 'street'], ['guard'], ['any'], { post: z('where the guard stands') }, ['guard_post', 'hold_post_alert', 'wait', 'wait_alert']),
  set('patrol_guard', 'A guard walking a beat', ['gate', 'street'], ['guard'], ['any'], { route: r("the beat's stops, in order") }, ['patrol', 'search_route_alert', 'wait', 'wait_alert']),
  set('barkeep', 'Runs the bar', ['tavern'], ['trader'], ['any'], { counter: z('behind the bar'), refuge: z('back room or cellar') }, ['tend_bar', 'flee_to_refuge_alert', 'wait', 'wait_alert']),
  set('patron', 'A customer drinking', ['tavern'], ['patron'], ['any'], { seat: z('where they sit'), refuge: z('where they would hide'), exit: z('the way out') }, ['drink_at_seat', 'flee_to_refuge_alert', 'leave_by_exit', 'wait', 'wait_alert']),
  set('sleeper', 'A guest asleep upstairs', ['tavern'], ['sleeper'], ['night'], { bed: z('their bed'), refuge: z('where they would hide') }, ['sleep_in_bed', 'flee_to_refuge_alert', 'wait', 'wait_alert']),
  set('street_worker', 'A labourer or stallholder at work', ['street'], ['worker'], ['day'], { work: z('the work spot'), refuge: z('home or a doorway') }, ['work_shift', 'flee_to_refuge_alert', 'wait', 'wait_alert']),
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
      [TR.defense]: { id: TR.defense, name: 'Combat – Defense', skills: [SK.dodge, SK.block, SK.endurance] },
      [TR.armor]: { id: TR.armor, name: 'Armor – Conventional', skills: [SK.light_armor, SK.medium_armor, SK.heavy_armor], access: { blockedBy: [AMORPHOUS] } }, // AR6
      [TR.perception]: { id: TR.perception, name: 'Perception', skills: [SK.eyesight, SK.earshot], access: { blockedBy: [AMORPHOUS] } }, // no eyes or ears (TA6)
      [TR.stealth]: { id: TR.stealth, name: 'Stealth – Conventional', skills: [SK.sneaking, SK.combat_stealth, SK.vanishing] },
      [TR.speech]: { id: TR.speech, name: 'Speech', skills: [SK.persuasion, SK.intimidation, SK.barter], access: { blockedBy: [AMORPHOUS] } },
      [TR.swordsman]: { id: TR.swordsman, name: 'Swordsman', skills: [SK.feint, SK.riposte, SK.disarm], access: { must: [{ kind: 'class', id: CL.swordsman }] } },
      // BR7: from being a slime, not from a class
      [TR.slime_senses]: { id: TR.slime_senses, name: 'Slime senses', skills: [SK.tremor], access: { must: [{ kind: 'race', id: RC.slime }] } },
      [TR.tools]: { id: TR.tools, name: 'Tools (placeholder, OQ-20)', skills: [SK.lockpicking], access: { blockedBy: [AMORPHOUS] } },
    },
    classes: {
      // Medium Weapons 40 and Block 40 unlock the class, and are its creation floors
      [CL.swordsman]: { id: CL.swordsman, name: 'Swordsman', tier: 'tier_1', label: 'a swordsman', floors: { [SK.melee_medium]: 40, [SK.block]: 40 }, unlock: { [SK.melee_medium]: 40, [SK.block]: 40 } },
      // The late bloomer's creation option: 50 points, level 1, a unique class with a level 1 perk
      [CL.late_bloomer]: { id: CL.late_bloomer, name: 'Unwritten Legend', tier: 'tier_5', label: 'a young stranger', floors: {}, creation: { points: 50, level: 1 }, levelPerks: { 1: [PK.quick_study] }, capstone: [PK.as_far_as_the_road_goes],
        capstones: [{ perk: PK.write_your_own_ending, needs: { must: [{ kind: 'classes', id: '', level: 7 }] } },
          { perk: PK.no_road_closed, needs: { must: [{ kind: 'allStep', id: '50', level: 1 }, { kind: 'skillsAbove', id: '15', level: 10 }] } }] },
      // Sword-dancer mirrors the Swordsman: its skills and perks are meant to be the Swordsman's, built for Dodge and
      // light or medium blades. Unlocks at Dodge 40 and Light or Medium Weapons 40; no tree, floors or creation start yet.
      [CL.sword_dancer]: { id: CL.sword_dancer, name: 'Sword-dancer', tier: 'tier_1', floors: {}, unlock: { [SK.dodge]: 40 }, unlockAny: { [SK.melee_light]: 40, [SK.melee_medium]: 40 } },
      // the default class: opens when the current class is at its top level; its capstone (at 5, tier 0) unlocks A Nobody
      [CL.commoner]: { id: CL.commoner, name: 'Commoner', tier: 'tier_0', floors: {}, fallback: true, capstone: [PK.nobody_special] },
      // a starting class (50 points, level 1, like the Unwritten Legend); others unlock it through Commoner 5's perk
      [CL.a_nobody]: { id: CL.a_nobody, name: 'A Nobody', tier: 'tier_2', label: 'a nobody', floors: {}, creation: { points: 50, level: 1 }, unlockPerk: PK.nobody_special,
        levelPerks: { 1: [PK.quick_study] }, capstone: [PK.every_fall_a_lesson] },
      // PY2: every NPC that sells has this class; Barter 20 unlocks it
      [CL.trader]: { id: CL.trader, name: 'Trader', tier: 'tier_1', label: 'a trader', floors: {}, unlock: { [SK.barter]: 20 } },
    },
    // PY3: what sellers can offer besides goods; prices are base prices before the markup (placeholders).
    // heals: a healing row the service pays for (PY8: the clinic's care is bought, then used by resting there)
    services: {
      [SV.drink]: { id: SV.drink, name: 'drink', price: 1 },
      [SV.meal]: { id: SV.meal, name: 'meal', price: 2 },
      [SV.bed]: { id: SV.bed, name: 'bed for the night', price: 5 },
      [SV.bath]: { id: SV.bath, name: 'bath', price: 2 },
      [SV.clinic]: { id: SV.clinic, name: 'clinic care', price: 20, heals: 'clinic' },
    },
    roles: { sense: { shared: true }, grip: { shared: false }, move: { shared: true }, fly: { shared: true }, strike: { shared: false }, speech: { shared: true } },
    bodyTypes: BODY_TYPES,
    // Healing sources (H1–H6); amounts are placeholders. A source's tier is its row: add rows for more.
    healing: {
      rest: { id: 'rest', name: 'Rest', hpPct: CONFIG.REST_HEAL_PCT, partPct: CONFIG.REST_HEAL_PCT, reach: 'damaged', revivesDead: false, inFight: false },
      clinic: { id: 'clinic', name: 'Clinic', hpPct: CONFIG.CLINIC_HEAL_PCT, partPct: CONFIG.CLINIC_HEAL_PCT, reach: 'crippled', revivesDead: false, inFight: false, placeKinds: ['clinic', 'infirmary'] },
      bandage: { id: 'bandage', name: 'Bandage', hpPct: 10, partPct: 10, reach: 'damaged', revivesDead: false, inFight: true },
      // H12–H14: natural recovery, all the time (fights too): endurance × 0.01 % an hour (0.5% at 50); never Crippled or worse
      passive: { id: 'passive', name: 'Natural recovery', hpPct: 0, partPct: 0, reach: 'damaged', revivesDead: false, inFight: true, hourly: { skill: SK.endurance, pctPerPoint: 0.01 } },
    },
    // Game clock (T1): minutes per action; placeholders
    durations: {
      fight_turn: { id: 'fight_turn', name: 'Fight turn', minutes: 0.1 },
      action: { id: 'action', name: 'Move, talk or other action', minutes: 1 },
      trade: { id: 'trade', name: 'Trade', minutes: 10, orders: ['barter', 'buy'] },
      rest: { id: 'rest', name: 'Rest', minutes: 60, orders: ['rest'] },
      sleep: { id: 'sleep', name: 'Sleep', minutes: 480 },
    },
    // Humans and elves for now, identical
    // innate perks and quirks per race: lists, empty until chosen
    races: {
      [RC.human]: { id: RC.human, name: 'Human', bodyTypeId: BT.humanoid, hpMultiplier: 1, innatePerks: [], innateQuirks: [], tags: ['speaks'], intelligence: 'intelligent' },
      [RC.elf]: { id: RC.elf, name: 'Elf', bodyTypeId: BT.humanoid, hpMultiplier: 1, innatePerks: [], innateQuirks: [], tags: ['speaks'], intelligence: 'intelligent' },
      // BR1–BR7: slime and dragon were body types only; HP multipliers moved here unchanged
      [RC.slime]: { id: RC.slime, name: 'Slime', bodyTypeId: BT.amorphous, hpMultiplier: 0.6, innatePerks: [], innateQuirks: [], tags: [], intelligence: 'unintelligent' },
      [RC.dragon]: { id: RC.dragon, name: 'Dragon', bodyTypeId: BT.winged_quadruped, hpMultiplier: 3, innatePerks: [], innateQuirks: [], tags: [], intelligence: 'semi' },
    },
    // Z3. Outdoor zones' own light is lamps or fires only; the sky adds daylight (T3a).
    zoneKinds: Object.fromEntries(([
      ['room', 'Room', false, 'some', 'dim'], ['corridor', 'Corridor', false, 'none', 'dim'], ['stairs', 'Stairs', false, 'none', 'dim'],
      ['cellar', 'Cellar or cave', false, 'some', 'dark'], ['street', 'Street', true, 'none', 'dark'], ['square', 'Square', true, 'none', 'dark'],
      ['gate', 'Gate', true, 'none', 'dark'], ['yard', 'Yard', true, 'some', 'dark'], ['field', 'Field', true, 'none', 'dark'],
      ['woods', 'Woods', true, 'heavy', 'dark'],
    ] as const).map(([id, name, outdoor, cover, light]) => [id, { id, name, outdoor, cover, light }])),
    items: ITEMS,
    templates: TEMPLATES,
    activities: ACTIVITIES,
    routines: ROUTINES,
    routineSets: ROUTINE_SETS,
    // the 20 milestone picks; higher and banked perks stay in PERK_WRITEUPS until they get a milestone; All-50 parts (allStep) too
    perks: {
      ...Object.fromEntries([...PERK_WRITEUPS, ...BOOST_PERKS, ...ALL_PARTS].filter((d) => d.ladder || d.allStep).map(({ ref: _r, skill: _s, place: _p, ...d }) => [d.id, { ...d, built: BUILT_PERKS.has(d.id) }])),
      ...CLASS_PERKS,
    },
    achievements: {
      // XP by reward level (REWARD_LEVELS, CONFIG.REWARD_XP); per-kind 10/100 and mastery all-100/150 moved up a level. Names grow grander with the feat.
      // after = the lower level it builds on; earning it switches the lower one off.
      [ACH.first_defeat_body_type]: { id: ACH.first_defeat_body_type, name: 'First {body_type} Felled', level: 'i', rule: 'defeats', tags: ['combat'], count: 1, by: 'body_type' },
      [ACH.defeats_10_body_type]: { id: ACH.defeats_10_body_type, name: '{body_type}bane', level: 'ii', rule: 'defeats', tags: ['combat'], count: 10, by: 'body_type', after: ACH.first_defeat_body_type, firstSight: 'unintelligent' },
      [ACH.defeats_100_body_type]: { id: ACH.defeats_100_body_type, name: 'Scourge of the {body_type} Hordes', level: 'iii', rule: 'defeats', tags: ['combat'], count: 100, by: 'body_type', after: ACH.defeats_10_body_type, readsHealth: true, firstSight: 'semi', excludes: ['firstSight'] },
      [ACH.first_defeat_race]: { id: ACH.first_defeat_race, name: 'First of {race}kind Felled', level: 'i', rule: 'defeats', tags: ['combat'], count: 1, by: 'race' },
      [ACH.defeats_10_race]: { id: ACH.defeats_10_race, name: 'Bane of {race}kind', level: 'ii', rule: 'defeats', tags: ['combat'], count: 10, by: 'race', after: ACH.first_defeat_race, firstSight: 'unintelligent' },
      [ACH.defeats_100_race]: { id: ACH.defeats_100_race, name: 'Scourge of {race}kind', level: 'iii', rule: 'defeats', tags: ['combat'], count: 100, by: 'race', after: ACH.defeats_10_race, firstSight: 'semi', excludes: ['firstSight'] },
      [ACH.defeats_10]: { id: ACH.defeats_10, name: 'Blooded Fighter', level: 'i', rule: 'defeats', tags: ['combat'], count: 10 },
      [ACH.defeats_100]: { id: ACH.defeats_100, name: 'Calamity of a Hundred Blades', level: 'ii', rule: 'defeats', tags: ['combat'], count: 100, after: ACH.defeats_10 },
      [ACH.defeats_250]: { id: ACH.defeats_250, name: 'Harvester of the Fallen', level: 'iii', rule: 'defeats', tags: ['combat'], count: 250, after: ACH.defeats_100 },
      [ACH.defeats_1000]: { id: ACH.defeats_1000, name: 'Thousand-Slayer, Herald of Ruin', level: 'iv', rule: 'defeats', tags: ['combat'], count: 1000, after: ACH.defeats_250 },
      // one per tree and mastery step, id <id>:<tree>
      [ACH.mastery_50]: { id: ACH.mastery_50, name: 'Adept of {tree}', level: 'ii', rule: 'mastery', tags: ['skill'], count: 50, reqLower: 5 },
      [ACH.mastery_100]: { id: ACH.mastery_100, name: 'Ascendant of {tree}', level: 'iii', rule: 'mastery', tags: ['skill'], count: 100, after: ACH.mastery_50 },
      [ACH.mastery_150]: { id: ACH.mastery_150, name: 'Transcendent Sovereign of {tree}', level: 'iv', rule: 'mastery', tags: ['skill'], count: 150, after: ACH.mastery_100 },
      // deeds: the player's tallies (tally in src/engine/xp.ts, turnFeats in src/engine/feats.ts)
      [ACH.unaware_1]: { id: ACH.unaware_1, name: 'Never Saw It Coming', level: 'i', rule: 'unaware_defeats', tags: ['combat', 'stealth'], count: 1 },
      [ACH.unaware_10]: { id: ACH.unaware_10, name: 'Knife in the Dark', level: 'ii', rule: 'unaware_defeats', tags: ['combat', 'stealth'], count: 10, after: ACH.unaware_1 },
      [ACH.unaware_50]: { id: ACH.unaware_50, name: 'Shadow\'s Edge', level: 'ii', rule: 'unaware_defeats', tags: ['combat', 'stealth'], count: 50, after: ACH.unaware_10 },
      [ACH.unaware_100]: { id: ACH.unaware_100, name: 'The Unseen Death', level: 'iii', rule: 'unaware_defeats', tags: ['combat', 'stealth'], count: 100, after: ACH.unaware_50, unawareShift: 1, quieter: 1 },
      [ACH.yielded_1]: { id: ACH.yielded_1, name: 'Yield or Fall', level: 'i', rule: 'yielded', tags: ['combat', 'social'], count: 1 },
      [ACH.yielded_10]: { id: ACH.yielded_10, name: 'Breaker of Wills', level: 'ii', rule: 'yielded', tags: ['combat', 'social'], count: 10, after: ACH.yielded_1, skillAdd: { [SK.intimidation]: 5 } },
      [ACH.yielded_50]: { id: ACH.yielded_50, name: 'The Name That Ends Fights', level: 'iii', rule: 'yielded', tags: ['combat', 'social'], count: 50, after: ACH.yielded_10, renown: 10 },
      [ACH.crits_10]: { id: ACH.crits_10, name: 'Sure Hand ({group})', level: 'i', rule: 'crits', tags: ['skill'], count: 10, by: 'group' },
      [ACH.crits_100]: { id: ACH.crits_100, name: 'Perfect Form ({group})', level: 'ii', rule: 'crits', tags: ['skill'], count: 100, by: 'group', after: ACH.crits_10 },
      [ACH.crits_1000]: { id: ACH.crits_1000, name: 'Master of the Moment ({group})', level: 'iii', rule: 'crits', tags: ['skill'], count: 1000, by: 'group', after: ACH.crits_100, standIn: 0.2 },
      [ACH.beyond_1]: { id: ACH.beyond_1, name: 'Beyond Perfect', level: 'i', rule: 'beyond_crit', tags: ['skill'], count: 1 },
      [ACH.beyond_2]: { id: ACH.beyond_2, name: 'Past the Limit', level: 'ii', rule: 'beyond_crit', tags: ['skill'], count: 2, after: ACH.beyond_1 },
      [ACH.beyond_3]: { id: ACH.beyond_3, name: 'Touched by Fate', level: 'iii', rule: 'beyond_crit', tags: ['skill'], count: 3, after: ACH.beyond_2 },
      [ACH.beyond_group_1]: { id: ACH.beyond_group_1, name: 'Beyond Perfect ({group})', level: 'i', rule: 'beyond_crit', tags: ['skill'], count: 1, by: 'group' },
      [ACH.beyond_group_2]: { id: ACH.beyond_group_2, name: 'Past the Limit ({group})', level: 'ii', rule: 'beyond_crit', tags: ['skill'], count: 2, by: 'group', after: ACH.beyond_group_1 },
      [ACH.beyond_group_3]: { id: ACH.beyond_group_3, name: 'Touched by Fate ({group})', level: 'iii', rule: 'beyond_crit', tags: ['skill'], count: 3, by: 'group', after: ACH.beyond_group_2 },
      [ACH.flawless_1]: { id: ACH.flawless_1, name: 'Untouched', level: 'i', rule: 'flawless', tags: ['combat'], count: 1 },
      [ACH.flawless_10]: { id: ACH.flawless_10, name: 'Not a Scratch', level: 'ii', rule: 'flawless', tags: ['combat'], count: 10, after: ACH.flawless_1 },
      [ACH.flawless_50]: { id: ACH.flawless_50, name: 'Untouchable', level: 'iii', rule: 'flawless', tags: ['combat'], count: 50, after: ACH.flawless_10 },
      [ACH.outnumbered_1]: { id: ACH.outnumbered_1, name: 'Stand Against Many', level: 'i', rule: 'outnumbered', tags: ['combat'], count: 1 },
      [ACH.outnumbered_10]: { id: ACH.outnumbered_10, name: 'One Against the Horde', level: 'ii', rule: 'outnumbered', tags: ['combat'], count: 10, after: ACH.outnumbered_1 },
      [ACH.brink_1]: { id: ACH.brink_1, name: 'Not Today', level: 'i', rule: 'brink', tags: ['combat', 'survival'], count: 1 },
      [ACH.brink_3]: { id: ACH.brink_3, name: 'Not Yet', level: 'i', rule: 'brink', tags: ['combat', 'survival'], count: 3, after: ACH.brink_1, deathsDoor: 7 },
      [ACH.brink_5]: { id: ACH.brink_5, name: 'Death Keeps Waiting', level: 'ii', rule: 'brink', tags: ['combat', 'survival'], count: 5, after: ACH.brink_3, deathsDoor: 1, excludes: ['deathsDoor'] },
      [ACH.crippled_1]: { id: ACH.crippled_1, name: 'Still Swinging', level: 'i', rule: 'crippled_defeats', tags: ['combat', 'survival'], count: 1 },
      [ACH.crippled_10]: { id: ACH.crippled_10, name: 'Bones Heal Later', level: 'ii', rule: 'crippled_defeats', tags: ['combat', 'survival'], count: 10, perk: PK.past_the_pain, after: ACH.crippled_1 },
      [ACH.held_line_1]: { id: ACH.held_line_1, name: 'Few Against Many', level: 'i', rule: 'held_line', tags: ['combat', 'social'], count: 1 },
      [ACH.held_line_10]: { id: ACH.held_line_10, name: 'Hold the Line', level: 'ii', rule: 'held_line', tags: ['combat', 'social'], count: 10, after: ACH.held_line_1, rally: 10 },
      [ACH.quests_1]: { id: ACH.quests_1, name: 'Job Done', level: 'zero', rule: 'quests_done', tags: ['social'], count: 1 },
      [ACH.quests_5]: { id: ACH.quests_5, name: 'Reliable Hand', level: 'i', rule: 'quests_done', tags: ['social'], count: 5, after: ACH.quests_1 },
      [ACH.quests_10]: { id: ACH.quests_10, name: 'Hand for Hire', level: 'ii', rule: 'quests_done', tags: ['social'], count: 10, after: ACH.quests_5 },
      [ACH.quests_25]: { id: ACH.quests_25, name: 'Sought After', level: 'iii', rule: 'quests_done', tags: ['social'], count: 25, after: ACH.quests_10 },
      [ACH.quests_50]: { id: ACH.quests_50, name: 'The One They Send For', level: 'iv', rule: 'quests_done', tags: ['social'], count: 50, after: ACH.quests_25 },
      [ACH.quests_abandoned_5]: { id: ACH.quests_abandoned_5, name: 'Word Not Kept', level: 'i', rule: 'quests_abandoned', tags: ['social'], count: 5, scar: true },
      [ACH.clean_10]: { id: ACH.clean_10, name: 'Not Here', level: 'i', rule: 'clean_defense', tags: ['combat'], count: 10 },
      [ACH.clean_100]: { id: ACH.clean_100, name: 'Wall of Steel', level: 'ii', rule: 'clean_defense', tags: ['combat'], count: 100, after: ACH.clean_10 },
      [ACH.clean_1000]: { id: ACH.clean_1000, name: 'Nothing Lands', level: 'iii', rule: 'clean_defense', tags: ['combat'], count: 1000, after: ACH.clean_100 },
      [ACH.unseen_10]: { id: ACH.unseen_10, name: 'Under Their Noses', level: 'i', rule: 'unseen_moves', tags: ['stealth'], count: 10 },
      [ACH.unseen_50]: { id: ACH.unseen_50, name: 'Slipped Past', level: 'ii', rule: 'unseen_moves', tags: ['stealth'], count: 50, after: ACH.unseen_10 },
      [ACH.unseen_250]: { id: ACH.unseen_250, name: 'Never Was Here', level: 'iii', rule: 'unseen_moves', tags: ['stealth'], count: 250, after: ACH.unseen_50 },
      [ACH.vanished_5]: { id: ACH.vanished_5, name: 'Now You Don\u2019t', level: 'i', rule: 'vanished', tags: ['stealth'], count: 5 },
      [ACH.vanished_25]: { id: ACH.vanished_25, name: 'Smoke on the Wind', level: 'ii', rule: 'vanished', tags: ['stealth'], count: 25, after: ACH.vanished_5 },
      [ACH.spotted_10]: { id: ACH.spotted_10, name: 'Nothing Gets Past', level: 'i', rule: 'spotted', tags: ['stealth'], count: 10 },
      [ACH.spotted_100]: { id: ACH.spotted_100, name: 'Eyes in the Back of Your Head', level: 'ii', rule: 'spotted', tags: ['stealth'], count: 100, after: ACH.spotted_10 },
      [ACH.spotted_fn_1]: { id: ACH.spotted_fn_1, name: 'Sharp {function}', level: 'zero', rule: 'spotted', tags: ['stealth'], count: 1, by: 'function' },
      [ACH.spotted_fn_10]: { id: ACH.spotted_fn_10, name: '{function} That Never Sleeps', level: 'i', rule: 'spotted', tags: ['stealth'], count: 10, after: ACH.spotted_fn_1, by: 'function' },
      [ACH.spotted_fn_100]: { id: ACH.spotted_fn_100, name: 'Nothing Hides from Your {function}', level: 'ii', rule: 'spotted', tags: ['stealth'], count: 100, after: ACH.spotted_fn_10, by: 'function' },
      [ACH.speech_10]: { id: ACH.speech_10, name: 'Practised Speaker ({skill})', level: 'i', rule: 'speech_won', tags: ['social'], count: 10, by: 'skill' },
      [ACH.speech_100]: { id: ACH.speech_100, name: 'Voice That Carries ({skill})', level: 'ii', rule: 'speech_won', tags: ['social'], count: 100, after: ACH.speech_10, by: 'skill' },
      [ACH.speech_500]: { id: ACH.speech_500, name: 'Words That Move Crowds ({skill})', level: 'iii', rule: 'speech_won', tags: ['social'], count: 500, after: ACH.speech_100, by: 'skill' },
      [ACH.talked_down_1]: { id: ACH.talked_down_1, name: 'Blood Unspilled', level: 'i', rule: 'talked_down', tags: ['social'], count: 1 },
      [ACH.talked_down_10]: { id: ACH.talked_down_10, name: 'Peacemaker', level: 'ii', rule: 'talked_down', tags: ['social'], count: 10, after: ACH.talked_down_1 },
      [ACH.talked_down_50]: { id: ACH.talked_down_50, name: 'Every Fight Ends in Talk', level: 'iii', rule: 'talked_down', tags: ['social'], count: 50, after: ACH.talked_down_10 },
      [ACH.outmatched_1]: { id: ACH.outmatched_1, name: 'Against the Odds', level: 'i', rule: 'outmatched', tags: ['skill'], count: 1 },
      [ACH.outmatched_10]: { id: ACH.outmatched_10, name: 'No Match for You', level: 'ii', rule: 'outmatched', tags: ['skill'], count: 10, after: ACH.outmatched_1 },
      [ACH.outmatched_fn_1]: { id: ACH.outmatched_fn_1, name: 'Better {function}', level: 'zero', rule: 'outmatched', tags: ['skill'], count: 1, by: 'function' },
      [ACH.outmatched_fn_10]: { id: ACH.outmatched_fn_10, name: '{function} Without Equal', level: 'i', rule: 'outmatched', tags: ['skill'], count: 10, after: ACH.outmatched_fn_1, by: 'function' },
      [ACH.enemy_friend_1]: { id: ACH.enemy_friend_1, name: 'Enemy to Friend', level: 'i', rule: 'enemy_to_friend', tags: ['social'], count: 1 },
      [ACH.enemy_friend_5]: { id: ACH.enemy_friend_5, name: 'Mender of Grudges', level: 'ii', rule: 'enemy_to_friend', tags: ['social'], count: 5, after: ACH.enemy_friend_1 },
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
      [ACH.holds_10]: { id: ACH.holds_10, name: 'Iron Grip', level: 'i', rule: 'holds', tags: ['combat', 'skill'], count: 10 },
      [ACH.holds_100]: { id: ACH.holds_100, name: 'No Getting Loose', level: 'ii', rule: 'holds', tags: ['combat', 'skill'], count: 100, after: ACH.holds_10 },
      [ACH.aimed_10]: { id: ACH.aimed_10, name: 'Called Shot', level: 'i', rule: 'aimed_hits', tags: ['combat', 'skill'], count: 10 },
      [ACH.aimed_100]: { id: ACH.aimed_100, name: 'Where I Said', level: 'ii', rule: 'aimed_hits', tags: ['combat', 'skill'], count: 100, after: ACH.aimed_10 },
      [ACH.aimed_1000]: { id: ACH.aimed_1000, name: 'Never Misses Its Mark', level: 'iii', rule: 'aimed_hits', tags: ['combat', 'skill'], count: 1000, after: ACH.aimed_100 },
      [ACH.aimed_size_10]: { id: ACH.aimed_size_10, name: '{size} Target', level: 'i', rule: 'aimed_hits', tags: ['combat', 'skill'], count: 10, by: 'size', levelUp: SMALLER_PAYS_MORE },
      [ACH.aimed_size_100]: { id: ACH.aimed_size_100, name: 'Threads the Needle ({size})', level: 'ii', rule: 'aimed_hits', tags: ['combat', 'skill'], count: 100, after: ACH.aimed_size_10, by: 'size', levelUp: SMALLER_PAYS_MORE },
      [ACH.quests_giver_5]: { id: ACH.quests_giver_5, name: 'Go-To for {giver}', level: 'i', rule: 'quests_for_giver', tags: ['social'], count: 5, by: 'giver' },
      [ACH.quest_givers_10]: { id: ACH.quest_givers_10, name: 'Known in Every House', level: 'ii', rule: 'quest_givers', tags: ['social'], count: 10 },
      [ACH.quest_chain_1]: { id: ACH.quest_chain_1, name: 'Saw It Through', level: 'i', rule: 'quest_chains', tags: ['social'], count: 1 },
      [ACH.quests_early_1]: { id: ACH.quests_early_1, name: 'Early Every Time', level: 'i', rule: 'quests_early', tags: ['social'], count: 1 },
      [ACH.quests_unpaid_1]: { id: ACH.quests_unpaid_1, name: 'For Nothing', level: 'i', rule: 'quests_unpaid', tags: ['social'], count: 1 },
      [ACH.spar_1]: { id: ACH.spar_1, name: 'First Bout', level: 'zero', rule: 'spar_wins', tags: ['combat'], count: 1 },
      [ACH.spar_10]: { id: ACH.spar_10, name: 'Sparring Partner', level: 'i', rule: 'spar_wins', tags: ['combat'], count: 10, after: ACH.spar_1 },
      [ACH.spar_25]: { id: ACH.spar_25, name: 'Yard Veteran', level: 'i', rule: 'spar_wins', tags: ['combat'], count: 25, after: ACH.spar_10 },
      [ACH.spar_50]: { id: ACH.spar_50, name: 'Regular at the Yard', level: 'ii', rule: 'spar_wins', tags: ['combat'], count: 50, after: ACH.spar_25 },
      [ACH.spar_200]: { id: ACH.spar_200, name: 'Nobody Wants to Spar You', level: 'ii', rule: 'spar_wins', tags: ['combat'], count: 200, after: ACH.spar_50 },
      [ACH.cruel_spar_1]: { id: ACH.cruel_spar_1, name: 'Blood on the Practice Sword', level: 'i', rule: 'cruel_spar_wins', tags: ['combat'], count: 1 },
      [ACH.cruel_spar_10]: { id: ACH.cruel_spar_10, name: 'Cruel Teacher', level: 'ii', rule: 'cruel_spar_wins', tags: ['combat'], count: 10, after: ACH.cruel_spar_1 },
      [ACH.cruel_spar_25]: { id: ACH.cruel_spar_25, name: 'No One Spars You Twice', level: 'ii', rule: 'cruel_spar_wins', tags: ['combat'], count: 25, after: ACH.cruel_spar_10 },
      [ACH.spar_losses_10]: { id: ACH.spar_losses_10, name: 'Sparring Dummy', level: 'i', rule: 'spar_losses', tags: ['combat'], count: 10, scar: true },
      [ACH.total_10]: { id: ACH.total_10, name: 'A Few Threads', level: 'i', rule: 'achievements', tags: ['progression'], count: 10 },
      [ACH.total_25]: { id: ACH.total_25, name: 'Woven In', level: 'i', rule: 'achievements', tags: ['progression'], count: 25, after: ACH.total_10 },
      [ACH.total_50]: { id: ACH.total_50, name: 'A Thread Worth Following', level: 'ii', rule: 'achievements', tags: ['progression'], count: 50, after: ACH.total_25 },
      [ACH.total_100]: { id: ACH.total_100, name: 'Pattern in the Weave', level: 'iii', rule: 'achievements', tags: ['progression'], count: 100, after: ACH.total_50 },
      [ACH.total_250]: { id: ACH.total_250, name: 'The Tapestry Remembers', level: 'iv', rule: 'achievements', tags: ['progression'], count: 250, after: ACH.total_100 },
      [ACH.zones_50]: { id: ACH.zones_50, name: 'Wanderer', level: 'i', rule: 'zones', tags: ['exploration'], count: 50 },
      [ACH.zones_250]: { id: ACH.zones_250, name: 'Pathfinder', level: 'ii', rule: 'zones', tags: ['exploration'], count: 250, after: ACH.zones_50 },
      [ACH.zones_1000]: { id: ACH.zones_1000, name: 'Walker of Every Road', level: 'iii', rule: 'zones', tags: ['exploration'], count: 1000, after: ACH.zones_250 },
      [ACH.deals_1]: { id: ACH.deals_1, name: 'Word Given', level: 'i', rule: 'deals', tags: ['social'], count: 1 },
      [ACH.deals_10]: { id: ACH.deals_10, name: 'Dealmaker', level: 'ii', rule: 'deals', tags: ['social'], count: 10, after: ACH.deals_1 },
      [ACH.deals_100]: { id: ACH.deals_100, name: 'Silver Tongue', level: 'iii', rule: 'deals', tags: ['social'], count: 100, after: ACH.deals_10, pricePct: 5 },
      [ACH.days_7]: { id: ACH.days_7, name: 'Still Breathing', level: 'i', rule: 'days', tags: ['survival'], count: 7 },
      [ACH.days_30]: { id: ACH.days_30, name: 'Seasoned', level: 'ii', rule: 'days', tags: ['survival'], count: 30, after: ACH.days_7, restPct: 10 },
      [ACH.days_100]: { id: ACH.days_100, name: 'Old Blood', level: 'iii', rule: 'days', tags: ['survival'], count: 100, after: ACH.days_30, situation: 10 },
      [ACH.class_unlock]: { id: ACH.class_unlock, name: '{class} Awakened', level: 'i', rule: 'class_unlock', tags: ['progression'], count: 1, by: 'class' },
      // classes at their top level: in all, per class tier (one, then several in the same tier), and across tiers
      [ACH.class_max_1]: { id: ACH.class_max_1, name: 'Path Walked to Its End', level: 'i', rule: 'class_max', tags: ['progression'], count: 1 },
      [ACH.class_max_3]: { id: ACH.class_max_3, name: 'Thrice Mastered', level: 'ii', rule: 'class_max', tags: ['progression'], count: 3, after: ACH.class_max_1 },
      [ACH.class_max_5]: { id: ACH.class_max_5, name: 'Master of Many Paths', level: 'iii', rule: 'class_max', tags: ['progression'], count: 5, after: ACH.class_max_3 },
      [ACH.class_max_10]: { id: ACH.class_max_10, name: 'The Thousand-Faced', level: 'iv', rule: 'class_max', tags: ['progression'], count: 10, after: ACH.class_max_5 },
      [ACH.class_max_tier_1]: { id: ACH.class_max_tier_1, name: 'Peak of {tier}', level: 'i', rule: 'class_max', tags: ['progression'], count: 1, by: 'class_tier' },
      [ACH.class_max_tier_2]: { id: ACH.class_max_tier_2, name: 'Twin Peaks of {tier}', level: 'ii', rule: 'class_max', tags: ['progression'], count: 2, by: 'class_tier' },
      [ACH.class_max_tier_3]: { id: ACH.class_max_tier_3, name: 'Crown of {tier}', level: 'iii', rule: 'class_max', tags: ['progression'], count: 3, by: 'class_tier', after: ACH.class_max_tier_2 },
      [ACH.class_tiers_2]: { id: ACH.class_tiers_2, name: 'Across Two Heights', level: 'ii', rule: 'class_max_tiers', tags: ['progression'], count: 2 },
      [ACH.class_tiers_4]: { id: ACH.class_tiers_4, name: 'Across the Heights', level: 'iii', rule: 'class_max_tiers', tags: ['progression'], count: 4, after: ACH.class_tiers_2 },
      [ACH.class_tiers_all]: { id: ACH.class_tiers_all, name: 'Every Height Climbed', level: 'iv', rule: 'class_max_tiers', tags: ['progression'], count: CLASS_TIERS.keys.length, after: ACH.class_tiers_4 },
      [ACH.char_level_10]: { id: ACH.char_level_10, name: 'Risen to Level {level}', level: 'zero', rule: 'char_level', tags: ['progression'], count: 10, every: 10 },
    },
  });
  // ST1: a skill's tree is wherever the trees table lists it, so moving a skill is one edit there
  for (const t of Object.values(lib.trees)) for (const id of t.skills) if (lib.skills[id]) lib.skills[id].treeId = t.id;
  return lib;
}
