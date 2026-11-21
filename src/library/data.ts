// The prototype library: skills (Part 1 §3), body types (Part 3), classes and templates (Part 4 §4),
// items and the routine bank (the library viewer shows every row). All numbers are placeholders.
import {
  AM,
  BK,
  BM,
  CP,
  DU,
  FR,
  FU,
  GC,
  GT,
  HL,
  IF,
  LC,
  LM,
  LS,
  OP,
  PA,
  PY,
  RK,
  RL,
  RV,
  RW,
  TN,
  VL,
  WK,
  ZK,
} from './tableIds';
import {
  TP,
} from './templateIds';
import {
  GP,
  HK,
  PF,
  RO,
  TH,
} from './npcLayerIds';
import {
  BT,
  RC,
} from './raceIds';
import {
  TR,
} from './treeIds';
import {
  CONFIG,
} from '../config';
import {
  LAYOUTS,
} from './layouts';
import {
  UNIQUES,
} from './uniques';
import type {
  ArmorWeightKey,
  GrandeurKey,
  LifeStageKey,
  RankKey,
} from '../scales';
import {
  CLASS_TIERS,
  LIFE_STAGES,
  NOISE,
  ROAD_DANGERS,
  ROAD_LENGTHS,
  VISIBILITY,
  ZONE_SIZES,
} from '../scales';
import {
  openAirReachM,
} from '../perception/noise';
import {
  armReachM,
  HUMANOID_SIZE,
} from './bodySize';
import type {
  AccessCond,
  ActivityDef,
  AttackMode,
  BodyType,
  CastRecipe,
  HookKindDef,
  ItemDef,
  ItemEffect,
  Library,
  MeetRow,
  NpcRoleDef,
  NpcTemplate,
  PartDef,
  PerkDef,
  Personality,
  RoleId,
  Routine,
  RoutineSet,
  SituationTag,
  SkillDef,
  ThemeDef,
} from '../types';
import {
  FUNCTION_GROUP,
} from './functionNames';
import {
  PERK_WRITEUPS,
} from './perks';
import {
  BOOST_PERKS,
} from './boostPerks';
import {
  ALL_PARTS,
} from './allPerks';
import {
  BUILT_PERKS,
} from './builtPerks';
import {
  ROLLED_SKILL,
  SK,
} from './skillIds';
import {
  ACH,
  ACH_HEADS,
} from './achievementIds';
import {
  FN,
  GR,
} from './functionIds';
import {
  CL,
} from './classIds';
import {
  SV,
} from './serviceIds';
import {
  GD,
} from './godIds';
import {
  ST,
} from './startIds';
import {
  ES,
} from './essenceIds';
import {
  PK,
} from './perkIds';
import {
  BREAK_TOOL_TAG,
  IT,
} from './itemIds';
import {
  armorMultiplier,
  armorStop,
  shieldPool,
} from './gearScale';
import {
  CLASS_PERKS,
} from './classPerks';
import {
  ACTIVITIES,
  FURNITURE_SIZE_M,
  KIND_FURNITURE,
  ONWARD_KINDS,
  ROUTINE_SETS,
  ROUTINES,
} from './routineBank';
import {
  FISTS,
  GEAR_TYPES,
  held,
  ITEM_FAMILIES,
  ITEMS,
} from './items';
import {
  BODY_TYPES,
  FORELEGS,
  HIND_LEGS,
} from './bodyTypes';
import {
  ap,
  CAST_RECIPES,
  HIDE,
  HOOK_KINDS,
  meet,
  nat,
  NPC_ROLES,
  sized,
  TEMPLATES,
  THEMES,
} from './npcs';
export { CAST_RECIPES, HOOK_KINDS, NPC_ROLES, TEMPLATES, THEMES } from './npcs';
export { ACTIVITIES, ROUTINES, ROUTINE_SETS } from './routineBank';
export { FISTS, GEAR_TYPES, ITEMS, ITEM_FAMILIES } from './items';
export { BODY_TYPES, FORELEGS, HIND_LEGS } from './bodyTypes';
/** BW26 a: what a wall of each kind is made of when it names no material (placeholders) */
const WALL_MATERIAL: Record<string, string> = { [WK.wall]: BM.brick, [WK.glazed]: BM.glass, [WK.arcade]: BM.stone, [WK.low]: BM.brick, [WK.fence]: BM.planks };
/** BW24: what each barrier kind is made of when it names no material (placeholders) */
const BARRIER_MATERIAL: Record<string, string> = { [BK.door]: BM.oak, [BK.gate]: BM.oak, [BK.grate]: BM.iron, [BK.hatch]: BM.oak, [BK.rubble]: BM.rubble,
  [BK.window]: BM.planks, [BK.arrow_slit]: BM.stone, [BK.barred_window]: BM.iron, [BK.large_window]: BM.planks };

/** AT12: armour on or off locks movement, is careful work in steps, and keeps what is done when broken off */
const ARMOR_TIME = { locksMove: true, focus: 'careful', output: 'steps', onBreak: [{ upTo: 1, then: 'kept' }] } as const;
/** HB1: how far a sound carries in the open */
const inOpen = (m: number | undefined) => (m === undefined ? 'nowhere' : m === 0 ? 'only right beside you' : `${m} m in the open`);

/** AG3–AG6: life stage start ages per race (placeholders but the human row) */
const ages = (y: number[]) => Object.fromEntries(LIFE_STAGES.keys.map((k, i) => [k, y[i]])) as Record<LifeStageKey, number>;
const AGES = { human: ages([0, 13, 18, 40, 60, 80, 100]), elf: ages([0, 13, 20, 150, 250, 350, 450]), dragon: ages([0, 5, 100, 200, 300, 400, 500]),
  // animals: Youth = weaned and on its own feet, Adult = grown and breeding, Old about the usual wild lifespan, Ancient the
  // longest kept animals live (dog: AAHA 2019 life stages, 10-13 years; wolf: 4-6 wild, 15 kept; tiger: grown at 4-5, 10-15
  // wild, 20-26 kept; brown bear: 20-25 wild, 35+ kept; wild boar: 10-14; horse: grown at 5, 25-30; Komodo: grown at 8-9,
  // about 30; python: grown at 3-4, 20-25). Placeholders built on those figures.
  dog: ages([0, 0.5, 2, 7, 10, 13, 16]), wolf: ages([0, 0.5, 2, 5, 8, 11, 14]), tiger: ages([0, 1.5, 4, 9, 14, 18, 22]),
  bear: ages([0, 2, 5, 12, 20, 26, 32]), boar: ages([0, 0.5, 1.5, 5, 8, 11, 14]), horse: ages([0, 1, 5, 12, 18, 25, 30]),
  lizard: ages([0, 1, 8, 15, 22, 28, 33]), python: ages([0, 1, 3, 10, 18, 23, 28]),
  // AB8, AB14 (same basis): giant spider as a large tarantula (grown at 3-6, females live 15-25); lion grown at 4, 10-14 wild,
  // 20 kept; leopard 12-17 wild, 23 kept; spotted hyena grown at 3, up to 25; Nile crocodile grown at 12-16, lives 45-70
  spider: ages([0, 0.5, 3, 10, 15, 20, 25]), lion: ages([0, 1.5, 4, 8, 12, 15, 20]), leopard: ages([0, 1, 3, 8, 12, 17, 23]),
  hyena: ages([0, 1, 3, 9, 15, 20, 25]), crocodile: ages([0, 1, 12, 30, 45, 60, 70]) };
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
/** aimed hits per part size: smaller parts are harder to hit, so their levels pay this many reward levels more */
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
  // AB16 a: Natural weapons split into one skill per kind of natural attack; each opens only to bodies and races with that
  // attack (worked out from the attacks at the end of prototypeLibrary). A Python's constrict rolls Grapple.
  sk(SK.bite, TR.natural, [FN.unarmed], [RL.strike]),
  sk(SK.claws, TR.natural, [FN.unarmed], [RL.strike]), // claws and talons
  sk(SK.hooves_horns, TR.natural, [FN.unarmed], [RL.strike]), // a kick, tusks or horns
  sk(SK.tail, TR.natural, [FN.unarmed], [RL.strike]), // a tail lash
  sk(SK.slam, TR.natural, [FN.unarmed], [RL.strike]), // a slime's body blow
  { ...sk(SK.dodge, TR.defense, [FN.defense], [RL.move]), groups: [GR.speed] }, // Defense and Speed groups; no Initiative function, so it doesn't add to initiative
  sk(SK.block, TR.defense, [FN.defense], [RL.grip]), // shields only: a held weapon parries instead
  sk(SK.parry, TR.defense, [FN.defense], [RL.grip]), // turn a melee blow aside with a held melee weapon; a full stop earns a free strike back
  // Fortitude (MB5, MB32, FT15): body and mind. Endurance sets total HP; Resolve sets max morale and rolls the morale roll;
  // Stamina sets the stamina bar
  sk(SK.endurance, TR.fortitude, [FN.health], []),
  sk(SK.resolve, TR.fortitude, [FN.morale], []),
  sk(SK.stamina, TR.fortitude, [FN.stamina], []),
  // Armor – Conventional (AR1–AR3): one skill per armor weight, function armor in the Defense group.
  // While worn the skill meets the piece's need (equip requirements, EQ12 c); it improves from hits on armored parts (AR5).
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
  sk(SK.falsehood, TR.trickery, [FN.influence], [RL.speech]), // NT16: deceive rolls Falsehood
  { ...sk(SK.riposte, TR.swordsman, [], [RL.grip]), groups: [GR.melee, GR.defense], augments: [{ skill: SK.parry }] }, // adds its full value to every Parry roll
  { ...sk(SK.blade_dance, TR.sword_dancer, [], [RL.grip]), groups: [GR.melee, GR.defense], augments: [{ skill: SK.dodge }] }, // Riposte's mirror: adds its full value to every Dodge roll
  // AB20: raises natural armor (ruleset naturalReduction); no function, so nothing stands in for it; open only to races with natural armor
  { ...sk(SK.hide, TR.defense, [], []), groups: [GR.defense] },
  // Merchant's advanced barter: augments Barter, adding its effective value to every roll that asks for Barter
  { ...sk(SK.shrewd_dealing, TR.merchant, [], [RL.speech]), groups: [GR.influence], augments: [{ skill: SK.barter }] },
  // tremor is tier 0 and no sense function of its own: it adds its full value to every hearing roll
  // (every hearing roll asks for Earshot, SENSE_SKILL)
  { ...sk(SK.tremor, TR.slime_senses, [], [RL.sense], 'sound', 'tier_0'), groups: [GR.notice], augments: [{ skill: SK.earshot }] },
  // AB18 a: the smell function's skill: notices anyone within Scent metres, seen or not (perception smells).
  // It sits in the Perception tree; who may use it is the skill's own rule (end of prototypeLibrary)
  sk(SK.scent, TR.perception, [FN.smell], [RL.sense]),
  sk(SK.healing, TR.medicine, [FN.healing], [RL.grip]), // NR33
  // FL1: the Sleight group (functionNames.ts): Filching takes what others carry (src/engine/filch.ts) and, applied to a lock,
  // opens it (BA2; D-89 RP20: there is no Lockpicking skill)
  sk(SK.filching, TR.trickery, [FN.filching, FN.lockpicking], [RL.grip]), // in Trickery beside Falsehood
  sk(SK.handiwork, TR.survival, [FN.handiwork], [RL.grip]), // D-89 RP13: mending gear, at a forge or in the field (src/engine/repair.ts)
  sk(SK.guile, TR.trickery, [FN.influence], []), // TC24, TC26: a lie told with the body, rolled against the onlooker's Insight
  // Tactics (TR19; TC11 d, TC10, TC13, TC14): the Tactics function on three skills that stand in for each other; Battle
  // Sense also rolls Reaction (FN11, the initiative roll: TC5, TC13); Command joins the group only
  sk(SK.battle_sense, TR.tactics, [FN.tactics, FN.initiative], []),
  { ...sk(SK.command, TR.tactics, [], [RL.speech]), groups: [GR.tactics] }, // orders are spoken: head wounds count
  sk(SK.fieldcraft, TR.tactics, [FN.tactics], []),
  sk(SK.stratagem, TR.tactics, [FN.tactics], []),
].map((s) => [s.id, s]));

/** ST21: situation tags per skill. Light reaches sight and stealth; cover reaches hide and ranged. */
const SITUATION_TAGS_OF: Record<string, SituationTag[]> = {
  [SK.melee_light]: ['sight'], [SK.melee_medium]: ['sight'], [SK.melee_heavy]: ['sight'],
  [SK.ranged_light]: ['sight', 'ranged'], [SK.ranged_medium]: ['sight', 'ranged'], [SK.ranged_heavy]: ['sight', 'ranged'],
  [SK.unarmed_strike]: ['sight'], [SK.unarmed_grapple]: ['sight'], [SK.unarmed_improvised]: ['sight'], [SK.bite]: ['sight'], [SK.claws]: ['sight'], [SK.hooves_horns]: ['sight'], [SK.tail]: ['sight'], [SK.slam]: ['sight'],
  [SK.dodge]: ['sight'], [SK.block]: ['sight'], [SK.parry]: ['sight'], [SK.eyesight]: ['sight'], [SK.earshot]: ['hearing'], [SK.tremor]: ['hearing'], // hearing: no table reads it yet
  [SK.sneaking]: ['stealth', 'hide'], [SK.combat_stealth]: ['stealth', 'hide'], [SK.vanishing]: ['stealth', 'hide'],
};
for (const [id, tags] of Object.entries(SITUATION_TAGS_OF)) SKILLS[id].tags = tags;
// SR1: intimidation is open to any race with the Speech tree; persuasion and barter need a speaking race
for (const id of [SK.persuasion, SK.barter, SK.falsehood]) SKILLS[id].access = { must: [{ kind: 'raceTag', id: 'speaks' }] };



// BR9: a rule names a body type or a race; a block the shape already gives is not repeated on the race
const AMORPHOUS: AccessCond = { kind: 'body', id: BT.amorphous }; // no hands, eyes, ears or voice
/** NR14, AB14: the animal races (AB18: they smell) */
const ANIMALS = [RC.dog, RC.wolf, RC.tiger, RC.bear, RC.boar, RC.horse, RC.lizard, RC.python, RC.spider, RC.lion, RC.leopard, RC.hyena, RC.crocodile];

export function prototypeLibrary(): Library {
  const lib: Library = structuredClone({
    version: 1,
    status: {}, // D-116: renamed, replaced and deleted entries (none while the prototype keeps no old saves)
    skills: SKILLS,
    // Skill tree access (TA1–TA11): each tree's own rule; no rule = open to everyone.
    // shortcut: slime and dragon are body types until the race split (BR answers) lands, then these name the races.
    trees: {
      [TR.melee]: { id: TR.melee, name: 'Combat – Arms', skills: [SK.melee_light, SK.melee_medium, SK.melee_heavy], access: { blockedBy: [AMORPHOUS] } },
      [TR.ranged]: { id: TR.ranged, name: 'Combat – Ranged', skills: [SK.ranged_light, SK.ranged_medium, SK.ranged_heavy], access: { blockedBy: [AMORPHOUS] } },
      [TR.unarmed]: { id: TR.unarmed, name: 'Combat – Unarmed', skills: [SK.unarmed_strike, SK.unarmed_grapple, SK.unarmed_improvised], access: { blockedBy: [AMORPHOUS] } },
      [TR.natural]: { id: TR.natural, name: 'Natural weapons', skills: [SK.bite, SK.claws, SK.hooves_horns, SK.tail, SK.slam] }, // its access and each skill's: from the attacks (end of this function)
      [TR.defense]: { id: TR.defense, name: 'Combat – Defense', skills: [SK.dodge, SK.block, SK.parry, SK.hide] },
      [TR.fortitude]: { id: TR.fortitude, name: 'Fortitude', skills: [SK.endurance, SK.resolve, SK.stamina] },
      [TR.armor]: { id: TR.armor, name: 'Armor – Conventional', skills: [SK.light_armor, SK.medium_armor, SK.heavy_armor], access: { blockedBy: [AMORPHOUS] } }, // AR6
      // open to all; each sense has its own rule (end of this function): no eyes or ears (TA6), smell for animals and slimes (AB18)
      [TR.perception]: { id: TR.perception, name: 'Perception', skills: [SK.eyesight, SK.earshot, SK.insight, SK.scent] },
      [TR.stealth]: { id: TR.stealth, name: 'Stealth – Conventional', skills: [SK.sneaking, SK.combat_stealth, SK.vanishing] },
      [TR.speech]: { id: TR.speech, name: 'Speech', skills: [SK.persuasion, SK.intimidation, SK.barter], access: { blockedBy: [AMORPHOUS] } },
      [TR.trickery]: { id: TR.trickery, name: 'Trickery', skills: [SK.falsehood, SK.filching, SK.guile], access: { blockedBy: [AMORPHOUS] } },
      // TC2, TC11 d: a normal tree; TC9: closed to unintelligent races (end of this function), Command only for intelligent ones
      [TR.tactics]: { id: TR.tactics, name: 'Tactics', skills: [SK.battle_sense, SK.command, SK.fieldcraft, SK.stratagem] },
      [TR.swordsman]: { id: TR.swordsman, name: 'Swordsman', skills: [SK.riposte], access: { must: [{ kind: 'perk', id: PK.blade_against_blade }] } }, // opened by Swordsman's level 1 perk
      [TR.merchant]: { id: TR.merchant, name: 'Merchant', skills: [SK.shrewd_dealing], access: { must: [{ kind: 'class', id: CL.merchant }] } },
      [TR.sword_dancer]: { id: TR.sword_dancer, name: 'Sword-dancer', skills: [SK.blade_dance], access: { must: [{ kind: 'perk', id: PK.first_steps_of_the_dance }] } }, // mirrors Swordsman: opened by its level 1 perk
      // BR7: from being a slime, not from a class
      [TR.slime_senses]: { id: TR.slime_senses, name: 'Tremor senses', rating: 'inferior', skills: [SK.tremor], access: { either: [RC.python, RC.spider].map((id) => ({ kind: 'race' as const, id })) } }, // AB11, AB19: snakes and spiders feel vibration; slimes smell instead
      [TR.medicine]: { id: TR.medicine, name: 'Medicine', skills: [SK.healing], access: { blockedBy: [AMORPHOUS] } }, // NR33: hands to mend with
      [TR.survival]: { id: TR.survival, name: 'Survival', skills: [SK.handiwork], access: { blockedBy: [AMORPHOUS] } }, // RP18 a: hands to work with
    },
    classes: {
      // Parry 80 and Medium or Heavy Weapons 60 unlock the class (PR #918); Medium Weapons 40 and Parry 40 are its creation floors
      [CL.swordsman]: { id: CL.swordsman, personality: { [PA.discipline]: CONFIG.ACH_PERSONALITY_STEP }, name: 'Swordsman', tier: 'tier_2', label: 'a swordsman', story: 'Blade against blade, drilled until the parry comes before the thought does.', floors: { [SK.melee_medium]: 40, [SK.parry]: 40 }, unlock: { [SK.parry]: 80 }, unlockAny: [{ [SK.melee_medium]: 60, [SK.melee_heavy]: 60 }], levelPerks: { 1: [PK.blade_against_blade] } },
      // the class of the late bloomer start (ST2): a unique class with a level 1 perk
      [CL.late_bloomer]: { id: CL.late_bloomer, personality: { [PA.curiosity]: CONFIG.ACH_PERSONALITY_STEP }, name: 'Unwritten Legend', tier: 'tier_5', label: 'a young stranger', story: 'No song carries your name, no master claimed you, and no road was chosen for you. You start late, in rough clothes with empty hands. Whatever story ends with your name, you will write it yourself.', floors: {}, unlockClass: { [CL.a_somebody]: 'max' }, levelPerks: { 1: [PK.any_road_will_do] }, capstone: [PK.as_far_as_the_road_goes], // CB3: also opens at A Somebody's top level
        capstones: [{ perk: PK.write_your_own_ending, needs: { must: [{ kind: 'classes', id: '', level: 7 }] } },
          { perk: PK.no_road_closed, needs: { must: [{ kind: 'allStep', id: '50', level: 1 }, { kind: 'skillsAbove', id: '15', level: 10 }] } }] },
      // TB7: the Threadbounded class, used only by The Threadbound start (ST4); its level 1 perk gives a random Threadbound item. No unlock
      [CL.threadbounded]: { id: CL.threadbounded, name: 'Threadbounded', tier: 'tier_4', label: 'a young stranger', story: 'Something was tied to you before you were old enough to know it. It answers when you call, and nothing has ever taken it from you for long.', floors: {}, levelPerks: { 1: [PK.always_yours] } },
      // DX1: Blessed by X, a variant per god; unlocks on being blessed by that god, and the blessed start (ST5) begins in it.
      // Level 1 gives a random Tier I blessing of the god; capstone to come (about earning a higher blessing from the god); name and story placeholders
      [CL.blessed_by_imbra]: { id: CL.blessed_by_imbra, name: 'Blessed by Imbra', tier: 'tier_2', label: 'a young stranger', story: 'Imbra looked your way once, and part of that look stayed with you.', floors: {}, blessedBy: GD.imbra, levelBlessings: { 1: 'tier_1' } },
      // Sword-dancer mirrors the Swordsman: its skills and perks are meant to be the Swordsman's, built for Dodge and
      // light or medium blades. Unlocks at Dodge 40 and Light or Medium Weapons 40; no tree, floors or creation start yet.
      [CL.sword_dancer]: { id: CL.sword_dancer, personality: { [PA.levity]: CONFIG.ACH_PERSONALITY_STEP }, name: 'Sword-dancer', tier: 'tier_2', story: 'Blade and footwork, drilled until the step comes before the thought does.', floors: {}, unlock: { [SK.dodge]: 80 }, unlockAny: [{ [SK.melee_light]: 60, [SK.melee_medium]: 60 }], levelPerks: { 1: [PK.first_steps_of_the_dance] } },
      // NR13 (placeholder numbers, benefits later): every Arms skill at 50 (the Arms All-50), one at 75, and Heavy Armor 60
      [CL.knight]: { id: CL.knight, personality: { [PA.discipline]: CONFIG.ACH_PERSONALITY_STEP }, name: 'Knight', tier: 'tier_2', label: 'a knight', story: 'Armoured head to foot and sworn to a banner; the blade does not tire and the line does not break.', floors: {},
        // NR36 b: the Arms All-50, one weapon at 100 and Heavy Armor 75; or Knight Trainee at its top level
        unlock: { [SK.melee_light]: 50, [SK.melee_medium]: 50, [SK.melee_heavy]: 50, [SK.heavy_armor]: 75 }, unlockAny: [{ [SK.melee_light]: 100, [SK.melee_medium]: 100, [SK.melee_heavy]: 100 }],
        orUnlocks: [{ unlockClass: { [CL.knight_trainee]: 'max' } }] },
      // NR36: the squire's road into Knight (placeholder unlock: a melee weapon and Heavy Armor at 40, like Guard's 40s)
      [CL.knight_trainee]: { id: CL.knight_trainee, personality: { [PA.discipline]: CONFIG.ACH_PERSONALITY_STEP }, name: 'Knight Trainee', tier: 'tier_1', label: 'a knight trainee', story: 'Carry the shield, wear the weight, learn the blade until the banner takes you.', floors: {},
        unlock: { [SK.heavy_armor]: 40 }, unlockAny: [{ [SK.melee_light]: 40, [SK.melee_medium]: 40, [SK.melee_heavy]: 40 }] },
      // the default class: opens when the current class is at its top level; its capstone (at 5, tier 0) gives a perk point
      [CL.commoner]: { id: CL.commoner, name: 'Commoner', tier: 'tier_0', story: 'Plain work and plain days.', floors: {}, fallback: true, capstone: [PK.nobody_special] },
      // unlocks at Commoner's top level (its Start, ST3, was removed: CC3)
      [CL.a_nobody]: { id: CL.a_nobody, personality: { [PA.pride]: -CONFIG.ACH_PERSONALITY_STEP }, name: 'A Nobody', tier: 'tier_2', label: 'a nobody', story: 'Nobody watches a nobody, and you have learned to use that.', floors: {}, unlockClass: { [CL.commoner]: 'max' },
        levelPerks: { 1: [PK.quick_study] }, capstone: [PK.every_fall_a_lesson] },
      // CB1-CB7: between A Nobody and Unwritten Legend; opens at A Nobody's top level (no skill road), Late Bloom at 1; its capstone is parked (ICI-360)
      [CL.a_somebody]: { id: CL.a_somebody, personality: { [PA.pride]: CONFIG.ACH_PERSONALITY_STEP }, name: 'A Somebody', tier: 'tier_3', label: 'a somebody', story: 'People finally know your name, though most of them still get it wrong.', floors: {},
        unlockClass: { [CL.a_nobody]: 'max' }, levelPerks: { 1: [PK.late_bloom] } },
      // PY2: every NPC that sells has this class; Barter 20 unlocks it
      // any weapon, any armor and any defense skill, and a perk that adds a hearing link (Keen Ear, which patrol templates have)
      [CL.guard]: { id: CL.guard, personality: { [PA.discipline]: CONFIG.ACH_PERSONALITY_STEP }, name: 'Guard', tier: 'tier_1', label: 'a guard', story: 'Stand at the gate and listen for trouble.', floors: {},
        unlockAny: [{ [SK.melee_light]: 40, [SK.melee_medium]: 40, [SK.melee_heavy]: 40, [SK.ranged_light]: 40, [SK.ranged_medium]: 40, [SK.ranged_heavy]: 40 },
          { [SK.light_armor]: 40, [SK.medium_armor]: 40, [SK.heavy_armor]: 40 }, { [SK.block]: 30, [SK.dodge]: 30, [SK.parry]: 30 }] as Record<string, number>[],
        unlockPerkWith: { hearingDb: 1 } },
      [CL.trader]: { id: CL.trader, personality: { [PA.sociability]: CONFIG.ACH_PERSONALITY_STEP }, name: 'Trader', tier: 'tier_0', label: 'a trader', story: 'Buy low, sell higher.', floors: {}, unlock: { [SK.barter]: 20 }, capstone: [PK.known_at_every_stall] },
      [CL.merchant]: { id: CL.merchant, personality: { [PA.pride]: CONFIG.ACH_PERSONALITY_STEP }, name: 'Merchant', tier: 'tier_1', label: 'a merchant', story: 'A trader who owns the stall.', floors: {}, unlockClass: { [CL.trader]: 'max' }, // Trader at its top level
        orUnlocks: [{ unlock: { [SK.barter]: 75 } }] }, // or Barter 75 on its own
    },
    // DX1: the Starts, the ways to begin on the creation screen, in the order the screen shows them. points/level left out =
    // CONFIG.CREATION_POINTS / START_LEVEL
    starts: {
      [ST.late_bloomer]: { id: ST.late_bloomer, name: 'Unwritten Legend', classId: CL.late_bloomer, level: 1 },
      [ST.threadbound]: { id: ST.threadbound, name: 'The Threadbound', classId: CL.threadbounded, level: 1 },
      // DX1: a random god's Tier V blessing, in that god's Blessed class; points and level [Proposed], as the other 50-point starts
      [ST.blessed]: { id: ST.blessed, name: 'The Blessed', level: 1, blessing: { tier: 'tier_5' },
        story: 'A god looked your way once, and part of that look stayed with you. Which god it was, you will know when your story starts.' },
    },
    // DX1: the gods, each with a narrow field. Varo and Imbra are minor gods (GOD_RANKS): grand to the average person, the minimum for the divine; lore belongs to the lore thread
    gods: {
      [GD.varo]: { id: GD.varo, name: 'Varo', rank: 'minor', field: 'extreme fortunes' },
      [GD.imbra]: { id: GD.imbra, name: 'Imbra', rank: 'minor', field: 'essence manipulation' },
    },
    // PY3: what sellers can offer besides goods; prices are base prices before the markup (placeholders).
    // heals: a healing row the service pays for (PY8: the clinic's care is bought, then used by resting there)
    services: {
      [SV.drink]: { id: SV.drink, name: 'drink', price: 1 },
      [SV.meal]: { id: SV.meal, name: 'meal', price: 2 },
      [SV.bed]: { id: SV.bed, name: 'bed for the night', price: 5 },
      [SV.bath]: { id: SV.bath, name: 'bath', price: 2 },
      [SV.clinic]: { id: SV.clinic, name: 'clinic care', price: 20, heals: HL.clinic },
      [SV.repair]: { id: SV.repair, name: 'repair', price: 0, repairs: true }, // D-89 RP6 a: priced by the job, only at a forge (RP8 b)
      [SV.forge]: { id: SV.forge, name: 'use of the forge', price: 5, forge: true }, // RP17 b
    },
    // D-141 VW14: a kept vow rolls RW1 for a reward type, then that type's table, until the stake's band is filled
    // (VW15). VW16: every reward type draws its items from RW3, the one Items table, so rewards balance in one place.
    // RW3 holds every item but Threadbound ones and the improvised bases; RW5 every Threadbound item (one of a kind: one
    // already in the world is put back). Weights are placeholders.
    rewardTables: {
      [RW.vow_kept]: { id: RW.vow_kept, name: 'Kept vow', rows: [{ weight: 3, table: RW.vow_items }, { weight: 1, table: RW.vow_threadbound }] },
      [RW.vow_items]: { id: RW.vow_items, name: 'Kept vow: items', rows: [{ weight: 1, table: RW.items }] },
      [RW.items]: { id: RW.items, name: 'Items', rows: [
        { weight: 1, item: IT.dagger }, { weight: 1, item: IT.arming_sword }, { weight: 1, item: IT.greataxe }, { weight: 1, item: IT.spear },
        { weight: 1, item: IT.war_spear }, { weight: 1, item: IT.shortbow }, { weight: 1, item: IT.longbow }, { weight: 1, item: IT.crossbow },
        { weight: 1, item: IT.basket_hilt_sword }, { weight: 1, item: IT.hidden_blade }, { weight: 1, item: IT.crude_clothes }, { weight: 1, item: IT.cudgel },
        { weight: 1, item: IT.rusty_knife }, { weight: 1, item: IT.gambeson }, { weight: 1, item: IT.mail_hauberk }, { weight: 1, item: IT.plate_harness },
        { weight: 1, item: IT.round_shield }, { weight: 1, item: IT.short_sword }, { weight: 1, item: IT.hand_axe }, { weight: 1, item: IT.woodsman_axe },
        { weight: 1, item: IT.greatsword }, { weight: 1, item: IT.recurve_bow }, { weight: 1, item: IT.flatbow }, { weight: 1, item: IT.light_crossbow },
        { weight: 1, item: IT.stirrup_crossbow }, { weight: 1, item: IT.boiled_leather }, { weight: 1, item: IT.brigandine }, { weight: 1, item: IT.lamellar_coat },
        { weight: 1, item: IT.half_plate }, { weight: 1, item: IT.kite_shield }, { weight: 1, item: IT.rapier }, { weight: 1, item: IT.longsword },
        { weight: 1, item: IT.turkish_bow }, { weight: 1, item: IT.warbow }, { weight: 1, item: IT.jack_of_plates }, { weight: 1, item: IT.coat_of_plates },
        { weight: 1, item: IT.heater_shield }, { weight: 1, item: IT.peerless_rapier }, { weight: 1, item: IT.peerless_longsword }, { weight: 1, item: IT.peerless_greatsword },
        { weight: 1, item: IT.peerless_composite_bow }, { weight: 1, item: IT.peerless_warbow }, { weight: 1, item: IT.peerless_crossbow }, { weight: 1, item: IT.peerless_jack },
        { weight: 1, item: IT.peerless_coat_of_plates }, { weight: 1, item: IT.peerless_plate }, { weight: 1, item: IT.peerless_heater }, { weight: 1, item: IT.arming_cap },
        { weight: 1, item: IT.leather_cap }, { weight: 1, item: IT.secret }, { weight: 1, item: IT.peerless_cap }, { weight: 1, item: IT.mail_coif },
        { weight: 1, item: IT.kettle_hat }, { weight: 1, item: IT.sallet }, { weight: 1, item: IT.peerless_sallet }, { weight: 1, item: IT.nasal_helm },
        { weight: 1, item: IT.bascinet }, { weight: 1, item: IT.great_helm }, { weight: 1, item: IT.peerless_great_helm }, { weight: 1, item: IT.leather_gloves },
        { weight: 1, item: IT.mail_mittens }, { weight: 1, item: IT.plate_gauntlets }, { weight: 1, item: IT.peerless_gauntlets }, { weight: 1, item: IT.spectacles },
        { weight: 1, item: IT.charmed_ring }, { weight: 1, item: IT.ear_cup }, { weight: 1, item: IT.amulet }, { weight: 1, item: IT.hooded_cloak },
        { weight: 1, item: IT.lucky_charm }, { weight: 1, item: IT.lockpicks }, { weight: 1, item: IT.sledgehammer }, { weight: 1, item: IT.pick },
        ...[IT.splitting_maul, IT.stick_bow, IT.green_wood_bow, IT.rickety_crossbow, IT.patched_mail, IT.rusted_scale_coat, IT.plank_shield, IT.rag_wraps, IT.bent_wire_picks].map((item) => ({ weight: 1, item })),
        { weight: 1, item: IT.healing_draught }, { weight: 1, item: IT.curio }, { weight: 1, item: IT.bandage }, { weight: 1, item: IT.key },
        { weight: 1, item: IT.pack }, { weight: 1, item: IT.sack }, { weight: 1, item: IT.chest }, { weight: 1, item: IT.crate },
        { weight: 1, item: IT.coin },
      ] },
      [RW.vow_threadbound]: { id: RW.vow_threadbound, name: 'Kept vow: Threadbound items', rows: [{ weight: 1, table: RW.threadbound }] },
      [RW.threadbound]: { id: RW.threadbound, name: 'Threadbound items', rows: [{ weight: 1, item: IT.varos_loop }] },
      // ITI-220: the Weaver's rewards draw as a kept vow's do, from a table of their own with the same weights. A row's
      // showsIn says which draws it can show in (left out: every draw), so a reward type can be for vows only.
      [RW.weaver]: { id: RW.weaver, name: 'Scenario reward', rows: [{ weight: 3, table: RW.weaver_items }, { weight: 1, table: RW.weaver_threadbound }] },
      [RW.weaver_items]: { id: RW.weaver_items, name: 'Scenario reward: items', rows: [{ weight: 1, table: RW.items }] },
      [RW.weaver_threadbound]: { id: RW.weaver_threadbound, name: 'Scenario reward: Threadbound items', rows: [{ weight: 1, table: RW.threadbound }] },
    },
    // growth proposal 2.2: essences. Placeholder rows for the engine; the content round (one table per race and body type,
    // with traits) belongs to the lore and loot threads (D-228). EG11 b: never numbers. NM2: an essence is a small foreign addition
    // that sits on someone's Thread, never a strand of it, so stories say it came with you or sits beside you, never that it knots in.
    essences: {
      [ES.gel_patience]: { id: ES.gel_patience, name: 'Gel Patience', from: { race: RC.slime }, skills: [{ skill: SK.slam, weight: 2 }, { skill: SK.scent, weight: 1 }], // EN5: slimes have no Endurance; AB19: Scent, not Tremor
        story: 'The slime\'s slow patience comes with you and settles in your gut like a swallowed stone. Who passed by reaches you as a smell before your eyes find them, and your body starts to feel like the weapon.' },
      // NE2 a: people rows come from the humanoid body type, so elves carry them as humans do (a row for one race can come later, IEI-229)
      [ES.gate_habit]: { id: ES.gate_habit, name: 'Gate-Warden\'s Habit', from: { bodyType: BT.humanoid }, skills: [{ skill: SK.block, weight: 2 }, { skill: SK.earshot, weight: 1 }],
        story: 'You catch yourself turning a shoulder toward the door before you decide to, as if you had brought someone else\'s long watches home with you.' },
      [ES.street_instinct]: { id: ES.street_instinct, name: 'Street Instinct', from: { bodyType: BT.humanoid }, skills: [{ skill: SK.dodge, weight: 2 }, { skill: SK.insight, weight: 1 }],
        story: 'A crowd reads differently now. You feel the reaching hand before it moves, the way they must have felt it.' },
      // EN6: placeholder rows so the barkeep and the tavern patron each carry one
      [ES.haggler_ear]: { id: ES.haggler_ear, name: 'Haggler\'s Ear', from: { bodyType: BT.humanoid }, skills: [{ skill: SK.barter, weight: 2 }, { skill: SK.earshot, weight: 1 }],
        story: 'A haggler\'s ear sits beside your own now. Prices start to sound like opening moves, and you hear the give in a seller\'s voice before they know it is there.' },
      [ES.tavern_brawler]: { id: ES.tavern_brawler, name: 'Tavern Brawler', from: { bodyType: BT.humanoid }, trait: PK.fists_do_the_talking, skills: [{ skill: SK.unarmed_strike, weight: 2 }, { skill: SK.persuasion, weight: 1 }],
        story: 'Someone\'s long nights of tavern brawls came along with you. Your fists hang easier at your sides, and so do your words: half a fight is talking your way into it, or out.' },
      // NE3 a: watchers' and hunters' only row; every person has some Eyesight and Earshot, so it fits everyone, picked rarely (CONFIG.ESSENCE_PICK_WEIGHT)
      [ES.lookout_eyes]: { id: ES.lookout_eyes, name: 'Lookout\'s Eyes', from: { bodyType: BT.humanoid }, skills: [{ skill: SK.eyesight, weight: 2 }, { skill: SK.earshot, weight: 1 }],
        story: 'Someone\'s long hours on a wall or in a hide came along with you. Your eyes go to the treeline and the far end of the road on their own, and a twig snapping behind you turns your head before you think to.' },
      // NE1 a: beast rows name no race or body type, so the fit rule hands each beast the rows of the natural weapons it has
      [ES.fang_nose]: { id: ES.fang_nose, name: 'Fang and Nose', from: {}, skills: [{ skill: SK.bite, weight: 2 }, { skill: SK.scent, weight: 1 }],
        story: 'A hunting animal\'s hunger sits beside your own now. Your jaw sets hard when a fight starts, and the air carries who passed by and how afraid they were.' },
      [ES.horn_hide]: { id: ES.horn_hide, name: 'Horn and Hide', from: {}, skills: [{ skill: SK.hooves_horns, weight: 2 }, { skill: SK.hide, weight: 1 }],
        story: 'Something of a charging beast came with you: the urge to lower your head and drive straight through, and a skin that shrugs off what should have cut it.' },
      [ES.claw_pounce]: { id: ES.claw_pounce, name: 'Claw and Pounce', from: {}, skills: [{ skill: SK.claws, weight: 2 }, { skill: SK.dodge, weight: 1 }],
        story: 'A great cat\'s patience settles in your shoulders. Your weight shifts onto your toes before a blow lands, and your hands curl as if they remember raking.' },
      [ES.lashing_tail]: { id: ES.lashing_tail, name: 'Lashing Tail', from: {}, skills: [{ skill: SK.tail, weight: 2 }, { skill: SK.hide, weight: 1 }],
        story: 'A heavy, scaled thing\'s way of fighting came along with you: turning side-on, sweeping wide at whatever comes close, and taking the hits on a hide that barely feels them.' },
      // D-362: a beast whose Resolve is above every weapon skill (an Untrained one: Resolve 50, weapons about 15) fits no weapon row
      [ES.cornered_nerve]: { id: ES.cornered_nerve, name: 'Cornered Nerve', from: { role: RO.beast, over: SK.resolve }, skills: [{ skill: SK.resolve, weight: 2 }, { skill: SK.scent, weight: 1 }],
        story: 'A young animal\'s refusal to back down came along with you. It had little to fight with and stood its ground anyway; when you are cornered now, your feet stay where they are and you smell the fear on whoever cornered you.' },
      [ES.hard_won_habit]: { id: ES.hard_won_habit, name: 'Hard-Won Habit', from: { deed: true }, skills: [],
        story: 'What you did again and again here has grown on you like a callus. Something in you will remember it.' },
    },
    roles: { [RL.sense]: { name: 'sense', shared: true }, [RL.grip]: { name: 'grip', shared: false }, [RL.move]: { name: 'move', shared: true }, [RL.fly]: { name: 'fly', shared: true }, [RL.strike]: { name: 'strike', shared: false }, [RL.speech]: { name: 'speech', shared: true } },
    bodyTypes: BODY_TYPES,
    // Healing sources (H1–H6); amounts are placeholders. A source's tier is its row: add rows for more.
    healing: {
      [HL.rest]: { id: HL.rest, name: 'Rest', hpPct: CONFIG.REST_HEAL_PCT, composure: CP.rest, reach: 'damaged', revivesDead: false },
      [HL.clinic]: { id: HL.clinic, name: 'Clinic', hpPct: CONFIG.CLINIC_HEAL_PCT, composure: CP.clinic, reach: 'crippled', revivesDead: false, placeKinds: ['clinic', 'infirmary'] },
      [HL.bandage]: { id: HL.bandage, name: 'Bandage', hpPct: 10, reach: 'damaged', revivesDead: false },
      // AT10 (placeholder): a healing draught, 25% of health and parts up to Damaged, any time
      [HL.draught]: { id: HL.draught, name: 'Healing draught', hpPct: 25, reach: 'damaged', revivesDead: false },
      // NR34: Heal (Healing 50); its share is set per use by the roll's tier (CONFIG.HEAL_TIER_SHARE of what is missing)
      [HL.heal]: { id: HL.heal, name: 'Heal', hpPct: 0, reach: 'damaged', revivesDead: false },
      // H12–H14: natural recovery, all the time (fights too): endurance × 0.01 % an hour (0.5% at 50); never Crippled or worse
      [HL.passive]: { id: HL.passive, name: 'Natural recovery', hpPct: 0, reach: 'damaged', revivesDead: false, hourly: { skill: SK.endurance, pctPerPoint: 0.01 } },
      // never applied itself: healing straight from a perk (Second Wind) is counted here for achievements; Fast Healer counts as natural recovery
      [HL.perk]: { id: HL.perk, name: 'Perks', hpPct: 0, reach: 'healthy', revivesDead: false, countOnly: true },
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
      [PA.assertiveness]: { id: PA.assertiveness, name: 'Assertiveness', low: 'meek', high: 'assertive', lowHint: 'gives way to those above them, asks rather than pushes', highHint: 'takes charge and pushes for what they want, even with those above them' },
      // D-206 BN3 a, BN4 a: they also scale stance moves and how fast a grudge fades (src/engine/regard.ts)
      [PA.attachment]: { id: PA.attachment, name: 'Attachment', low: 'detached', high: 'attached', lowHint: "keeps people at arm's length, moves on fast", highHint: 'bonds deeply, leans on those close, takes losing them hard' },
      [PA.forgivingness]: { id: PA.forgivingness, name: 'Forgivingness', low: 'vengeful', high: 'forgiving', lowHint: 'holds a grudge and waits to settle it', highHint: 'lets a wrong go once it is past' },
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
      [TN.wary_dangerous]: { id: TN.wary_dangerous, name: 'wary but dangerous', hint: 'avoids danger, yet hits hard when pushed', when: { nerveLine: 'cautious', min: { bestAttack: 40 } } },
      [TN.home_temptation]: { id: TN.home_temptation, name: 'torn between home and temptation', hint: 'loves their own, yet can\'t resist a pretty face', when: { drives: [VL.desire], anyDrive: [VL.family, VL.loyalty] } },
      [TN.talent_undisciplined]: { id: TN.talent_undisciplined, name: 'talent without discipline', hint: 'brilliant at their craft, careless at everything else', when: { min: { bestSkill: 60 }, max: { [PA.discipline]: -40 } } },
      [TN.crooked_means]: { id: TN.crooked_means, name: 'good ends, crooked means', hint: 'bends the truth to help the people they care about', when: { max: { [PA.honesty]: -20 }, anyDrive: [VL.loyalty, VL.kindness] } },
    },
    fears: {
      [FR.own_level]: { id: FR.own_level, name: 'Your health reaches a new level', cost: 5, rolled: true, health: { from: 'injured', to: 'mauled' } },
      [FR.own_critical]: { id: FR.own_critical, name: 'Your health reaches Critical', cost: 50, rolled: true, health: { from: 'critical', to: 'critical' } },
      [FR.bandmate_down]: { id: FR.bandmate_down, name: 'A bandmate goes down', cost: 10, rolled: true },
      [FR.bandmate_broken]: { id: FR.bandmate_broken, name: 'A bandmate breaks', cost: 10, rolled: true }, // MB23
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
    // handing over; Moderate bandaging, picking, hiding, armour; Hard a blow, a throw, any shot; All-out a Battle Cry;
    // crossbow spans are instant at Base, TP8 a). Unset: no movement lock, focus reflex, stop
    // any, output end, broken off = lost. The action row is the default turn outside a fight until turns last as long as their order.
    durations: {
      [DU.action]: { id: DU.action, name: 'Move, talk or other action', effort: 'base', seconds: 30 }, // an out-of-fight turn's own time (EXPLORE_TURN_S)
      [DU.trade]: { id: DU.trade, name: 'Trade', effort: 'base', seconds: 0, orders: ['barter', 'buy', 'sell'] }, // trading takes no time
      [DU.rest]: { id: DU.rest, name: 'Rest', effort: 'base', seconds: 60 * 60, orders: ['rest'], locksMove: true, focus: 'deep', output: 'share', onBreak: [{ upTo: 1, then: 'share' }] },
      [DU.sleep]: { id: DU.sleep, name: 'Sleep (until rested or the time named)', effort: 'base', seconds: 0, focus: 'careful', stop: 'never', output: 'steps', onBreak: [{ upTo: 1, then: 'share' }] },
      [DU.wait]: { id: DU.wait, name: 'Wait (until the time named)', effort: 'base', seconds: 0, focus: 'deep' },
      // attacks (AT11a-e): a blow; a throw; a bow drawn and loosed; a crossbow shot, its spanning a row of its own.
      // TP9 a: one shot time per weapon class, all Hard: light 3 s (light bows), medium 4 s (medium bows), heavy 5 s (crossbows).
      // Blows go by class the same way: unarmed and natural attacks 2 s, then light, medium and heavy weapons 3, 4 and 5 s
      // (an improvised strike goes by its weight class)
      [DU.blow_unarmed]: { id: DU.blow_unarmed, name: 'Unarmed or natural blow', effort: 'hard', seconds: 2, attack: true },
      [DU.blow]: { id: DU.blow, name: 'Light weapon blow', effort: 'hard', seconds: 3, attack: true },
      [DU.blow_medium]: { id: DU.blow_medium, name: 'Medium weapon blow', effort: 'hard', seconds: 4, attack: true },
      [DU.blow_heavy]: { id: DU.blow_heavy, name: 'Heavy weapon blow', effort: 'hard', seconds: 5, attack: true },
      [DU.throw]: { id: DU.throw, name: 'Throw', effort: 'hard', seconds: 3, attack: true, locksMove: true },
      [DU.bow_light]: { id: DU.bow_light, name: 'Light bow shot', effort: 'hard', seconds: 3, attack: true, locksMove: true, focus: 'steady' },
      [DU.bow_medium]: { id: DU.bow_medium, name: 'Medium bow shot', effort: 'hard', seconds: 4, attack: true, locksMove: true, focus: 'steady' },
      [DU.crossbow_shot]: { id: DU.crossbow_shot, name: 'Crossbow shot', effort: 'hard', seconds: 5, attack: true, locksMove: true, focus: 'steady' },
      // spanning is instant for every crossbow (less realism, TP6 f, TP8 a); the rows stay so a crossbow names its spanning
      [DU.span_light]: { id: DU.span_light, name: 'Span a light crossbow', effort: 'base', seconds: 0, readies: DU.crossbow_shot },
      [DU.span_stirrup]: { id: DU.span_stirrup, name: 'Span a stirrup crossbow', effort: 'base', seconds: 0, readies: DU.crossbow_shot },
      [DU.span_crossbow]: { id: DU.span_crossbow, name: 'Span a crossbow', effort: 'base', seconds: 0, readies: DU.crossbow_shot },
      // voice (AT11f-g): barks stay free (AE7); the words said before a break are heard
      [DU.battle_cry]: { id: DU.battle_cry, name: 'Battle Cry', effort: 'all_out', seconds: 1 },
      [DU.rally]: { id: DU.rally, name: 'Rally', effort: 'all_out', seconds: 1 }, // TC39 a: like Battle Cry
      [DU.play_dead]: { id: DU.play_dead, name: 'Play dead', effort: 'light', seconds: 1 }, // TC44 a: dropping as if Down takes the turn
      // TK6: plain talk in a fight takes no time; TK1 c: persuading, lying or threatening takes a fixed time however long the
      // words (haggling is a trade), and so does a turn of plain talk outside a fight (the world moves on while you talk)
      [DU.talk]: { id: DU.talk, name: 'Talking in a fight', effort: 'base', seconds: 0 },
      [DU.speech]: { id: DU.speech, name: 'Persuade, lie or threaten; talking outside a fight', effort: 'base', seconds: 3 },
      // gear and things in hand (AT11h-j): changing gear is instant and costs no strain (less realism)
      [DU.draw]: { id: DU.draw, name: 'Draw a weapon', effort: 'base', seconds: 0 },
      [DU.stow]: { id: DU.stow, name: 'Stow a weapon', effort: 'base', seconds: 0 },
      [DU.swap]: { id: DU.swap, name: 'Swap weapons', effort: 'base', seconds: 0 },
      [DU.pick_up_reach]: { id: DU.pick_up_reach, name: 'Pick up within reach', effort: 'base', seconds: 0 },
      [DU.pick_up_ground]: { id: DU.pick_up_ground, name: 'Pick up from the ground', effort: 'base', seconds: 0 },
      [DU.hand_over]: { id: DU.hand_over, name: 'Hand something over', effort: 'base', seconds: 0 }, // instant, like gear
      // ways (AT11k-l): doors, bars and keys are instant and never stop the walk (less realism); picking keeps its work
      // and is sped by Filching (BA2)
      [DU.door]: { id: DU.door, name: 'Open or close a door', effort: 'base', seconds: 0 },
      [DU.bar]: { id: DU.bar, name: 'Bar or unbar a door', effort: 'base', seconds: 0 },
      [DU.key]: { id: DU.key, name: 'Lock or unlock with a key', effort: 'base', seconds: 0 },
      // taking something out of a container you carry (a sack): instant, like all gear
      [DU.from_pack]: { id: DU.from_pack, name: 'Get something out of a container', effort: 'base', seconds: 0 },
      [DU.break_open]: { id: DU.break_open, name: 'Break something open', effort: 'hard', seconds: 6, locksMove: true, focus: 'steady' }, // BF31
      // BW13 a: its seconds come from strength and the material (src/ruleset/breaking.ts); work done stays on the wall or barrier
      [DU.break_through]: { id: DU.break_through, name: 'Break through a wall or barrier', effort: 'hard', seconds: 0, locksMove: true, focus: 'steady', onBreak: [{ upTo: 1, then: 'kept' }] },
      [DU.pick_lock]: { id: DU.pick_lock, name: 'Pick a lock', effort: 'moderate', seconds: 30, locksMove: true, focus: 'careful', onBreak: [{ upTo: 1, then: 'kept' }],
        speed: { fn: FN.lockpicking, halving: CONFIG.PICK_HALVING_PER, fastCap: CONFIG.PICK_FAST_CAP } },
      // D-89 RP15 b: its seconds come from the job (src/engine/repair.ts repairSeconds); RP24: a long action like picking a
      // lock, and broken off its share done takes effect (resolve.ts shareDone)
      [DU.repair]: { id: DU.repair, name: 'Repair gear', effort: 'moderate', seconds: 0, locksMove: true, focus: 'careful', output: 'share', onBreak: [{ upTo: 1, then: 'share' }] },
      // care (AT11m-n): a bandage broken off is not used up
      [DU.bandage]: { id: DU.bandage, name: 'Bandage', effort: 'moderate', seconds: 20, locksMove: true, focus: 'careful' },
      [DU.drink]: { id: DU.drink, name: 'Drink a potion', effort: 'base', seconds: 3 },
      // senses (AT11o)
      [DU.look]: { id: DU.look, name: 'Look around', effort: 'light', seconds: 3, focus: 'steady' },
      // armour on and off (AT12): instant and no strain, like all gear (heavy alone keeps ARMOR_ALONE_MULT, × 0 today)
      [DU.armor_light_on]: { id: DU.armor_light_on, name: 'Put on light armour', effort: 'base', seconds: 0, ...ARMOR_TIME },
      [DU.armor_light_off]: { id: DU.armor_light_off, name: 'Take off light armour', effort: 'base', seconds: 0, ...ARMOR_TIME },
      [DU.armor_medium_on]: { id: DU.armor_medium_on, name: 'Put on medium armour', effort: 'base', seconds: 0, ...ARMOR_TIME },
      [DU.armor_medium_off]: { id: DU.armor_medium_off, name: 'Take off medium armour', effort: 'base', seconds: 0, ...ARMOR_TIME },
      [DU.armor_heavy_on]: { id: DU.armor_heavy_on, name: 'Put on heavy armour', effort: 'base', seconds: 0, ...ARMOR_TIME, aloneMult: CONFIG.ARMOR_ALONE_MULT },
      [DU.armor_heavy_off]: { id: DU.armor_heavy_off, name: 'Take off heavy armour', effort: 'base', seconds: 0, ...ARMOR_TIME, aloneMult: CONFIG.ARMOR_ALONE_MULT },
    },
    // Humans and elves for now, identical but for lifespan
    // AG3–AG6: years at which each life stage starts. Human from real references (adolescence 13, majority 18, middle age 40,
    // the UN's older persons 60, oldest old 80, centenarian 100); elf (Ancient 450) and dragon (Ancient 500) are placeholders. Slime: ageless.
    // innate perks and quirks per race: lists, empty until chosen
    races: {
      // AB1 c: speed is the race's (m/s, real references): a person walks about 1.4 m/s and runs about 5 in kit (a sprinter reaches 8–10)
      [RC.human]: { id: RC.human, name: 'Human', bodyTypeId: BT.humanoid, hpMultiplier: 1, speed: { walk: 1.4, run: 5 }, innatePerks: [], innateQuirks: [], tags: ['speaks'], intelligence: 'intelligent', ageStages: AGES.human, playable: true },
      [RC.elf]: { id: RC.elf, name: 'Elf', bodyTypeId: BT.humanoid, hpMultiplier: 1, speed: { walk: 1.4, run: 5 }, innatePerks: [], innateQuirks: [], tags: ['speaks'], intelligence: 'intelligent', ageStages: AGES.elf, playable: true },
      // BR1–BR7: slime and dragon were body types only; HP multipliers moved here unchanged
      [RC.slime]: { id: RC.slime, name: 'Slime', bodyTypeId: BT.amorphous, hpMultiplier: 0.6, speed: { walk: 0.5, run: 1 }, // a creeping mass: a placeholder
        innatePerks: [], innateQuirks: [], tags: [], intelligence: 'unintelligent' }, // Slime and Dragon are not playable (reverses CC8 b)
      // on the ground as a horse: walk about 1.8 m/s, gallop about 12 (flight not modelled, D-323). AB17 a: about 1,000 kg,
      // twice a horse: (1000 ÷ 70)^(2/3) = 5.9. AB16: it bites and lashes its tail as the big beasts do (it had no attacks of its own)
      [RC.dragon]: { id: RC.dragon, name: 'Dragon', bodyTypeId: BT.winged_quadruped, hpMultiplier: 5.9, speed: { walk: 1.8, run: 12 }, innatePerks: [], innateQuirks: [], tags: [], intelligence: 'semi', ageStages: AGES.dragon,
        naturalAttacks: [nat(AM.bite, 'heavy', 0.8, 'head', 'bite'), nat(AM.slam, 'slam', 2, 'tail', 'tail lash', SK.tail)] },
      // Animals (NR14, NR15). hpMultiplier (AB6 a): (mass ÷ a 70 kg person)^(2/3), rounded: dog 30 kg, wolf 40, tiger 220,
      // bear 300, boar 90, horse 500, Komodo 70, python 75. Run = the cited burst; walk = an everyday gait (estimates unless cited).
      // Attack class by bite or blow force [Proposed]: a weak bite light, a tiger's or bear's (about 1,000 psi, National
      // Geographic) or a horse's kick heavy. SZ9: reach is metres past the body's edge: the neck's stretch past the nose, a
      // foreleg's swipe, a kick behind the rump (estimates unless cited). SZ3: size from head-and-body length (no tail), widest
      // width (estimates: rarely published) and shoulder height, from the species' Wikipedia measures unless cited.
      [RC.dog]: { id: RC.dog, name: 'Dog', bodyTypeId: BT.quadruped, hpMultiplier: 0.6, intelligence: 'semi', ageStages: AGES.dog,
        speed: { walk: 1.4, run: 8.9 }, // AKC: most dogs 15–20 mph
        ...sized(BT.quadruped, [1, 0.3, 0.57]), // a Labrador: 0.57 m at the shoulder (AKC standard)
        naturalAttacks: [nat(AM.bite, 'light', 0.2, 'head', 'bite')],
        innatePerks: [PK.keen_ear], innateQuirks: [], tags: [] }, // dogs hear sounds about 10 dB fainter than people at their best pitch (Heffner 1983)
      [RC.wolf]: { id: RC.wolf, name: 'Wolf', bodyTypeId: BT.quadruped, hpMultiplier: 0.7, intelligence: 'semi', ageStages: AGES.wolf,
        speed: { walk: 2.4, run: 15.6 }, // travels at 8.7 km/h (Mech, J. Mammalogy 1994, USGS); bursts 56–64 km/h (Mech and Boitani 2003)
        naturalAttacks: [nat(AM.bite, 'light', 0.2, 'head', 'bite')], // the Quadruped's own size
        innatePerks: [PK.keen_ear], innateQuirks: [], tags: [] },
      [RC.tiger]: { id: RC.tiger, name: 'Tiger', bodyTypeId: BT.quadruped, hpMultiplier: 2.1, intelligence: 'semi', ageStages: AGES.tiger,
        speed: { walk: 1.4, run: 15.6 }, // short bursts of about 56 km/h
        ...sized(BT.quadruped, [1.9, 0.45, 1]),
        naturalAttacks: [nat(AM.bite, 'heavy', 0.3, 'head', 'bite'), nat(AM.claw, 'medium', 0.6, FORELEGS, 'claws')],
        innatePerks: [PK.night_eyes], innateQuirks: [], tags: [] }, // a cat sees in about a sixth of the light a person needs
      [RC.bear]: { id: RC.bear, name: 'Bear', bodyTypeId: BT.quadruped, hpMultiplier: 2.6, intelligence: 'semi', ageStages: AGES.bear,
        speed: { walk: 1.4, run: 15.6 }, // a brown bear charges at up to about 56 km/h
        ...sized(BT.quadruped, [2, 0.6, 1.1]),
        naturalAttacks: [nat(AM.bite, 'heavy', 0.3, 'head', 'bite'), nat(AM.claw, 'heavy', 0.6, FORELEGS, 'claws')],
        innatePerks: [], innateQuirks: [], tags: [] },
      [RC.boar]: { id: RC.boar, name: 'Wild boar', bodyTypeId: BT.quadruped, hpMultiplier: 1.2, intelligence: 'semi', ageStages: AGES.boar,
        speed: { walk: 1.4, run: 11.1 }, // about 40 km/h
        ...sized(BT.quadruped, [1.4, 0.35, 0.85]),
        naturalAttacks: [nat(AM.gore, 'medium', 0.3, 'head', 'tusks')],
        naturalArmor: { covers: ['general'], ...HIDE(1) }, // AB13 a: a shoulder shield of gristle up to about 5 cm thick
        innatePerks: [], innateQuirks: [], tags: [] },
      [RC.horse]: { id: RC.horse, name: 'Horse', bodyTypeId: BT.quadruped, hpMultiplier: 3.7, intelligence: 'semi', ageStages: AGES.horse,
        speed: { walk: 1.8, run: 12 }, // walk about 1.8 m/s, gallop about 12 m/s (as the winged quadruped)
        // the head and neck reach about 1.5 m forward (FR4); a kick lands up to about 1.8 m (6 ft) behind
        ...sized(BT.quadruped, [2.4, 0.65, 1.6]), // nose to buttock about 2.4 m, 1.6 m (about 16 hands) at the withers
        naturalAttacks: [nat(AM.kick, 'heavy', 1.8, HIND_LEGS, 'kick'), nat(AM.bite, 'light', 0.5, 'head', 'bite')],
        innatePerks: [], innateQuirks: [], tags: [] },
      // a monitor lizard sized as the largest, the Komodo dragon: about 3 m long, half of it tail; bursts to about 20 km/h; a weak
      // bite (about 39 N, Fry et al., PNAS 2009) that tears with serrated teeth
      [RC.lizard]: { id: RC.lizard, name: 'Monitor lizard', bodyTypeId: BT.quadruped, hpMultiplier: 1, intelligence: 'unintelligent', ageStages: AGES.lizard,
        speed: { walk: 1, run: 5.6 },
        ...sized(BT.quadruped, [1.3, 0.35, 0.35]), // a Komodo dragon: about 2.6 m, half of it tail
        naturalAttacks: [nat(AM.bite, 'light', 0.2, 'head', 'bite'), nat(AM.slam, 'slam', 1.3, 'tail', 'tail lash', SK.tail)],
        naturalArmor: { covers: ['general', ...FORELEGS, ...HIND_LEGS, 'tail'], ...HIDE(0.8) }, // AB13 a: small bony scales (osteoderms) in the skin, a lighter hide than the boar's shield (estimate)
        innatePerks: [], innateQuirks: [], tags: [] },
      // a large constrictor (reticulated or Burmese python, 5–6 m): strikes about a third of its length, then coils and squeezes;
      // slow on land. Venomous snakes wait on a venom rule.
      [RC.python]: { id: RC.python, name: 'Python', bodyTypeId: BT.serpent, hpMultiplier: 1, intelligence: 'unintelligent', ageStages: AGES.python,
        speed: { walk: 0.4, run: 1 },
        naturalAttacks: [nat(AM.bite, 'light', 1.5, 'head', 'bite'), nat(AM.grapple, 'grapple', 1.5, 'coils', 'constrict', SK.unarmed_grapple)],
        innatePerks: [], innateQuirks: [], tags: [] },
      // AB8 a: a monster: a real spider's shape and the fastest real spider's sprint at the size of a wolf (about 40 kg). Its
      // venom waits on D-322.
      [RC.spider]: { id: RC.spider, name: 'Giant spider', bodyTypeId: BT.eight_legged, hpMultiplier: 0.7, intelligence: 'unintelligent', ageStages: AGES.spider,
        speed: { walk: 0.5, run: 3.6 }, // an Australian huntsman spider sprints 3.59 m/s (EWN news report, July 2026; study not yet peer reviewed)
        naturalAttacks: [nat(AM.bite, 'light', 0.2, 'head', 'fangs')], // the Eight-legged's own size
        innatePerks: [], innateQuirks: [], tags: [] },
      // AB14 a: more predators on the Quadruped
      [RC.lion]: { id: RC.lion, name: 'Lion', bodyTypeId: BT.quadruped, hpMultiplier: 1.9, intelligence: 'semi', ageStages: AGES.lion,
        speed: { walk: 1.4, run: 15.6 }, // short bursts of about 50–60 km/h; 190 kg
        ...sized(BT.quadruped, [1.9, 0.45, 1.2]),
        naturalAttacks: [nat(AM.bite, 'heavy', 0.3, 'head', 'bite'), nat(AM.claw, 'medium', 0.6, FORELEGS, 'claws')],
        innatePerks: [PK.night_eyes], innateQuirks: [], tags: [] },
      [RC.leopard]: { id: RC.leopard, name: 'Leopard', bodyTypeId: BT.quadruped, hpMultiplier: 0.9, intelligence: 'semi', ageStages: AGES.leopard,
        speed: { walk: 1.4, run: 16.1 }, // about 58 km/h; 60 kg; a smaller bite than the big cats'
        ...sized(BT.quadruped, [1.3, 0.3, 0.65]),
        naturalAttacks: [nat(AM.bite, 'medium', 0.3, 'head', 'bite'), nat(AM.claw, 'medium', 0.6, FORELEGS, 'claws')],
        innatePerks: [PK.night_eyes], innateQuirks: [], tags: [] },
      [RC.hyena]: { id: RC.hyena, name: 'Hyena', bodyTypeId: BT.quadruped, hpMultiplier: 0.9, intelligence: 'semi', ageStages: AGES.hyena,
        speed: { walk: 1.4, run: 16.7 }, // a spotted hyena: up to about 60 km/h; 60 kg; bites about 1,100 psi, as a bear
        ...sized(BT.quadruped, [1.3, 0.35, 0.8]),
        naturalAttacks: [nat(AM.bite, 'heavy', 0.3, 'head', 'bite')],
        innatePerks: [], innateQuirks: [], tags: [] },
      // a Nile crocodile, about 400 kg: about 14 km/h on land; the strongest bite measured (saltwater crocodile about 3,700 psi,
      // Erickson et al. 2012); swimming is not modelled
      [RC.crocodile]: { id: RC.crocodile, name: 'Crocodile', bodyTypeId: BT.quadruped, hpMultiplier: 3.2, intelligence: 'unintelligent', ageStages: AGES.crocodile,
        speed: { walk: 0.5, run: 3.9 },
        ...sized(BT.quadruped, [2.2, 0.6, 0.5]), // about 4 m, nearly half of it tail
        naturalAttacks: [nat(AM.bite, 'heavy', 0.4, 'head', 'bite'), nat(AM.slam, 'slam', 1.8, 'tail', 'tail lash', SK.tail)],
        naturalArmor: { covers: ['general', ...FORELEGS, ...HIND_LEGS, 'tail'], ...HIDE(1.5) }, // AB13 a: large bony plates (scutes) along the back, the heaviest hide here (estimate)
        innatePerks: [], innateQuirks: [], tags: [] },
    },
    // Z3. Outdoor zones' own light is lamps or fires only; the sky adds daylight (T3a).
    // gear classes (GC): the class sets which skill an item asks for; its level sets how much (EQUIP_NEED)
    gearTypes: GEAR_TYPES, // IR23: reach and coverage by type
    itemFamilies: ITEM_FAMILIES, // IR30: Mundane and the special families
    gearClasses: Object.fromEntries(([
      [GC.melee_light, 'Light melee weapon', SK.melee_light, 'melee'], [GC.melee_medium, 'Medium melee weapon', SK.melee_medium, 'melee'], [GC.melee_heavy, 'Heavy melee weapon', SK.melee_heavy, 'melee'],
      [GC.ranged_light, 'Light ranged weapon', SK.ranged_light, 'ranged'], [GC.ranged_medium, 'Medium ranged weapon', SK.ranged_medium, 'ranged'], [GC.ranged_heavy, 'Heavy ranged weapon', SK.ranged_heavy, 'ranged'],
      [GC.improvised, 'Improvised weapon', SK.unarmed_improvised, 'improvised'], [GC.armor_light, 'Light armor', SK.light_armor, 'armor'], [GC.armor_medium, 'Medium armor', SK.medium_armor, 'armor'],
      [GC.armor_heavy, 'Heavy armor', SK.heavy_armor, 'armor'], [GC.shield, 'Shield', SK.block, 'shield'], [GC.gauntlets, 'Gauntlets', SK.unarmed_strike, 'unarmed'],
    ] as const).map(([id, name, skill, use]) => [id, { id, name, skill, use }])),
    // attack modes: what an attack does; weapon modes and natural attacks name one by id
    // Throw carries the throw action's combined roll for every weapon that lists it; a throw mode's reachM is its own throw range (CONFIG.THROW_M)
    attackModes: Object.fromEntries(Object.entries(AM).map(([w, id]) => [id, { id, name: w[0].toUpperCase() + w.slice(1),
      ...(id === AM.throw ? { blend: CONFIG.THROW_BLEND } : {}) }])),
    // PZ14 a: title kinds are drawing templates: a roof or not, the light word drawn as a source (PZ5), default size and
    // aspect, and every side's wall kind unless named (roofed: a wall; open sky: none). No cover or light columns: clutter is
    // the land and objects (PZ6), light is sources (PZ5)
    zoneKinds: Object.fromEntries(([
      [ZK.room, 'Room', true, 'lamplit', 'room', 1], [ZK.corridor, 'Corridor', true, 'dim', 'small', 4], [ZK.stairs, 'Stairs', true, 'dim', 'cramped', 2],
      [ZK.cellar, 'Cellar or cave', true, 'dark', 'room', 1], [ZK.street, 'Street', false, 'dark', 'yard', 4], [ZK.square, 'Square', false, 'dark', 'open', 1],
      [ZK.gate, 'Gate', false, 'dark', 'small', 2], [ZK.yard, 'Yard', false, 'dark', 'yard', 1], [ZK.field, 'Field', false, 'dark', 'open', 1],
      [ZK.woods, 'Woods', false, 'dark', 'open', 1],
    ] as const).map(([id, name, roof, light, size, aspect]) => [id, { id, name, roof, light, size, aspect, wall: roof ? WK.wall : WK.open,
      ...(ONWARD_KINDS.has(id) ? { onward: true as const } : {}),
      ...(KIND_FURNITURE[id] ? { furniture: KIND_FURNITURE[id] } : {}) }])),
    // FR1: what furniture can be (a piece's kind sets its map icon; its name is the story's)
    furnitureKinds: Object.fromEntries(Object.entries(FU).map(([k, id]) => [id, { id, name: k.replace(/_/g, ' '), ...(FURNITURE_SIZE_M[id] ? { sizeM: FURNITURE_SIZE_M[id] } : {}) }])),
    // TV3/TV4, PZ9: a road's length and danger words (a road with no land line under it)
    roadLengths: Object.fromEntries(ROAD_LENGTHS.keys.map((k) => [k, { id: k, name: ROAD_LENGTHS.name(k), km: CONFIG.ROAD_LENGTH_KM[k] }])),
    roadDangers: Object.fromEntries(ROAD_DANGERS.keys.map((k) => [k, { id: k, name: ROAD_DANGERS.name(k), encounterPct: CONFIG.ROAD_ENCOUNTER_PCT[k] }])),
    // WZ11 region kinds (placeholders): relief in metres, wild shares by land cover, settlements per region (WZ3: one
    // market town and a few villages and hamlets in about 10 km)
    regionKinds: {
      [RK.river_valley]: { id: RK.river_valley, name: 'River valley farmland', text: 'A broad valley with a river, farmed round its villages, woods and heath on the higher ground.',
        relief: [20, 140], rough: 0.35, river: { width: 40, like: 'a lowland river like the Ouse at York, about 40 m across' }, streams: 6,
        wild: { [LC.woods]: 0.22, [LC.heath]: 0.12, [LC.marsh]: 0.05 }, open: LC.pasture,
        settlements: { town: 1, village: [3, 5], hamlet: [3, 6] }, danger: 'quiet' },
      [RK.forest]: { id: RK.forest, name: 'Forest', text: 'Rolling ground mostly under trees, with clearings for a few villages and a small river.',
        relief: [60, 260], rough: 0.5, river: { width: 15, like: 'a small river like the Cam at Cambridge, about 15 m across' }, streams: 7,
        wild: { [LC.woods]: 0.8, [LC.heath]: 0.05, [LC.marsh]: 0.04 }, open: LC.pasture,
        settlements: { town: 1, village: [2, 3], hamlet: [3, 6] }, danger: 'wild' },
      [RK.upland_moor]: { id: RK.upland_moor, name: 'Upland moor', text: 'High open moor cut by steep stream valleys, with a small market town and farms in the dales.',
        relief: [250, 600], rough: 0.6, streams: 9,
        wild: { [LC.moor]: 0.6, [LC.rock]: 0.08, [LC.woods]: 0.1, [LC.marsh]: 0.1 }, open: LC.heath,
        settlements: { town: 1, village: [2, 3], hamlet: [2, 5] }, danger: 'wild' },
    },
    // WZ1 land covers: standsM is how high it stands (trees, houses block sight over them)
    landCovers: Object.fromEntries(([
      [LC.farmland, 'Farmland', 'none', 0, 'Open fields of crops round a village'],
      [LC.pasture, 'Pasture', 'none', 0, 'Grass and meadow grazed by sheep and cattle'],
      [LC.woods, 'Woods', 'heavy', 20, 'Trees: a mature English oak stands about 20 to 25 m'],
      [LC.heath, 'Heath', 'light', 1, 'Heather, gorse and bracken, about knee to waist high'],
      [LC.moor, 'Moor', 'none', 0.5, 'Open upland of heather and rough grass'],
      [LC.marsh, 'Marsh', 'some', 2, 'Wet ground and reed beds; common reed grows to about 2 to 3 m'],
      [LC.rock, 'Crag and scree', 'some', 0, 'Bare rock, cliffs and loose stone'],
      [LC.settlement, 'Settlement', 'some', 6, 'Houses and yards; a two-storey house stands about 6 m'],
      [LC.water_meadow, 'Water meadow', 'none', 0, 'Flat grass beside a river that floods in winter'],
    ] as const).map(([id, name, cover, standsM, like]) => [id, { id, name, cover, standsM, like }])),
    landmarkKinds: Object.fromEntries(([
      [LM.quarry, 'Quarry', 'hill'], [LM.mill, 'Mill', 'river'], [LM.ruin, 'Ruin', 'remote'], [LM.shrine, 'Shrine', 'hill'],
      [LM.tower, 'Tower', 'hill'], [LM.mine, 'Mine', 'hill'], [LM.standing_stones, 'Standing stones', 'hill'], [LM.camp, 'Camp', 'woods'],
    ] as const).map(([id, name, seek]) => [id, { id, name, seek }])),
    // PZ2 a: wall kinds on the floor plan (placeholders): a low wall is a bar counter's height, about 1.1 m; a fence or rail
    // about 1.2 m; the rest stand a storey. Open draws no wall.
    wallKinds: Object.fromEntries(([
      [WK.wall, 'Wall', false, false, false, false, 'wall', undefined, 'Solid: no seeing, reaching or walking across; its doorways and windows are the ways through.'],
      [WK.open, 'Open', true, true, true, false, 'open', undefined, 'Nothing in the way: no wall is drawn.'],
      [WK.low, 'Low wall', false, false, true, true, 'open', CONFIG.LOW_WALL_M, 'A counter or low wall: seen and reached over above its top, crossed by climbing.'],
      [WK.glazed, 'Glazed', false, true, false, false, 'window', undefined, 'A wall of windows: seen through, never walked or reached across.'],
      [WK.fence, 'Fence', false, true, true, true, 'open', CONFIG.FENCE_M, 'A fence or rail: seen through and reached over, crossed by climbing.'],
      [WK.arcade, 'Arcade', false, true, false, false, 'open', undefined, 'Arches on piers with a rail between: seen and heard through, not walked across.'],
    ] as [string, string, boolean, boolean, boolean, boolean, import('../scales').SoundLossKey, number | undefined, string][]).map(([id, name, walk, see, reach, climb, sound, heightM, text]) =>
      [id, { id, name, walk, see, reach, climb, sound, ...(heightM !== undefined ? { heightM } : {}), ...(id === WK.open ? { none: true as const } : {}), text, ...(WALL_MATERIAL[id] ? { material: WALL_MATERIAL[id] } : {}) }])),
    // PZ2 a: kinds of way. A doorway is CONFIG.DOORWAY_M unless its barrier gives its own size (SZ7); a gap is as wide as the
    // ground the two titles share; a window (a drop, SD7) is a casement's size and sill unless its barrier gives one (PC3);
    // stairs about a metre wide (an estimate)
    openingKinds: Object.fromEntries(([
      [OP.doorway, 'Doorway', true, true, undefined, CONFIG.DOORWAY_M, undefined, 'A doorway in a wall: walked through. It holds a plain door unless it is doorless (an open doorway, as into a hall); the far side shows while the door stands open, or always with none (BG-312).'],
      [OP.gap, 'Gap', true, true, undefined, undefined, undefined, 'An open way: an arch, a gap in a wall, or open ground between two titles.'],
      [OP.window, 'Window', true, false, undefined, [0.6, 1], 0.9, 'A window or ledge over lower ground: seen through, and only ever jumped down.'],
      [OP.stairs, 'Stairs', false, true, true, [1, 2], undefined, 'Stairs, a ladder or a hatch to the floor above or below.'],
    ] as [string, string, boolean, boolean, true | undefined, [number, number] | undefined, number | undefined, string][]).map(([id, name, seeThrough, walk, floors, sizeM, sillM, text]) =>
      [id, { id, name, seeThrough, walk, ...(floors ? { floors } : {}), ...(sizeM ? { sizeM } : {}), ...(sillM !== undefined ? { sillM } : {}), text }])),
    // PZ5 a, D-391: light sources and their brightness in candela (placeholders: a candle is about 1 cd by the unit's own
    // history; the rest are estimates); a title's lights are set per source, bright enough for its light word
    lightKinds: Object.fromEntries(([
      [LS.candle, 'Candle', 1, false, 'A tallow or wax candle (about 1 candela)'],
      [LS.oil_lamp, 'Oil lamp', 10, false, 'A clay or brass oil lamp (an estimate, about 10 candela)'],
      [LS.lantern, 'Lantern', 15, false, 'A horn or glass lantern round a candle or wick (an estimate)'],
      [LS.torch, 'Torch', 100, false, 'A burning torch or brand (an estimate, about 100 candela)'],
      [LS.hearth, 'Hearth fire', 300, false, 'A wood fire in a hearth or brazier (an estimate)'],
      [LS.lights, 'Lights', 0, true, 'The lamps, candles or fire a title is lit by: as bright as its light word needs out to its far corner'],
    ] as const).map(([id, name, candela, scaled, like]) => [id, { id, name, candela, ...(scaled ? { scaled: true as const } : {}), like }])),
    // SD3–SD5: barriers on ways. A grate is bars you see through; rubble is a blockage only clearing opens (the walls thread).
    // SZ7: the opening each leaves, width × height in metres: a house door about 0.9 × 2 m (CONFIG.DOORWAY_M); a farm or
    // yard gate wide enough for a cart, about 3 m (an estimate); a grate across a passage about a door's (an estimate); a
    // trapdoor about 0.7 × 0.7 m, gone through upright (an estimate)
    barrierKinds: Object.fromEntries(([
      [BK.door, 'Door', true, true, false, false, 'door', 'A wooden door: it may be locked with a key, or barred from one side.', CONFIG.DOORWAY_M],
      [BK.gate, 'Gate', true, true, false, false, 'door', 'A gate in a wall or fence: locked, or barred from the inside.', [3, 2.5]],
      [BK.grate, 'Grate', true, true, false, true, 'open', 'Iron bars across a way: you see through it, but it may be locked or barred.', CONFIG.DOORWAY_M],
      [BK.hatch, 'Hatch', true, true, false, false, 'door', 'A trapdoor in a floor or ceiling: locked, or bolted from one side.', [0.7, 0.7], true],
      [BK.rubble, 'Rubble', false, false, true, false, 'wall', 'A cave-in or fallen stone: no way through until it is cleared.'],
      // PC3, PC4: windows, each only on a drop (placeholders). A common casement about 0.6 × 1 m, sill 0.9 m, behind shutters;
      // an arrow slit (medieval arrow loops: 5-10 cm wide, 1-1.5 m tall) always open and too narrow to climb; bars over a
      // casement, seen and shot through, never climbed unless broken; a hall's or shop's large window behind shutters
      [BK.window, 'Shuttered window', true, true, false, false, 'window', 'Wooden shutters over a window: you see, shoot and jump through it only while they are open; they may be locked, or barred from inside.', [0.6, 1], undefined, 0.9],
      [BK.arrow_slit, 'Arrow slit', false, false, false, true, 'open', 'A narrow slit in thick stone, splayed wide inside: an archer behind it sees the whole field, but only a strip of the archer shows, and no one fits through.', [0.1, 1.2], undefined, 1, true],
      [BK.barred_window, 'Barred window', false, false, false, true, 'window', 'Iron bars over a window: you see and shoot through it, but no one climbs through until the bars are broken.', [0.6, 1], undefined, 0.9, true],
      [BK.large_window, 'Large window', true, true, false, false, 'window', 'A tall window of a hall or a shop front behind shutters: open, it shows most of a room and is easy to climb through; they may be locked, or barred from inside.', [1.2, 1.5], undefined, 0.6],
    ] as [string, string, boolean, boolean, boolean, boolean, import('../scales').SoundLossKey, string, [number, number]?, true?, number?, true?][]).map(([id, name, lock, bar, blocked, seeThrough, sound, text, openingM, vertical, sillM, fixed]) =>
      [id, { id, name, lock, bar, blocked, seeThrough, sound, text, ...(openingM ? { openingM } : {}), ...(vertical ? { vertical } : {}), ...(sillM !== undefined ? { window: true as const, sillM } : {}), ...(fixed ? { fixed } : {}), ...(BARRIER_MATERIAL[id] ? { material: BARRIER_MATERIAL[id] } : {}) }])),
    // BW24 a, BW8 a: what walls, barriers and rubble are made of. secondsAt50 is a working professional with the right tool
    // making a person-sized hole through exampleCm (time grows with thickness, src/ruleset/breaking.ts). D-199 a: soundDb is
    // the decibels a sound loses through exampleCm of it, from real insulation figures (STC), CONFIG.SOUND_DB_PER_DOUBLING
    // more for each doubling of thickness (src/plan/line.ts soundLossDb); soundSource is where it comes from. The everyday rows
    // carry their source; where none was found the row says it is an estimate. Fantasy rows are placeholders. BW9 b: no
    // warded stone until magic exists (D-332).
    barrierMaterials: Object.fromEntries(([
      [BM.wattle, 'Wattle and daub', [10, 20], 15, 90, 45, 'An estimate by weight: about 180 kg/m² of daub, near a 4-in (10 cm) face brick wall\'s 189 kg/m² at STC 45 (BIA Technical Note 5A, Riverbank tests).', 'raised', undefined, 'Nearest source: a 2×4 stud wall with wood panel, 1.5 min to penetrate (NCEL TN-1425, Tancreto 1976, Table 1, NBS tests); wattle is no stronger.', 'Woven sticks packed with clay: village cottages and sheds.'],
      [BM.planks, 'Timber planks', [3, 8], 5, 90, 26, 'An estimate: oak\'s 30 less 4 dB for softwood\'s lighter boards (about 450 against 700 kg/m³, the mass law).', 'loud', undefined, 'A 2×4 stud wall with wood panel, 1.5 min to penetrate (NCEL TN-1425, Tancreto 1976, Table 1, NBS tests).', 'Board partitions, stables, shutters, fences.'],
      [BM.oak, 'Oak', [4, 8], 5, 300, 30, 'A solid-core door: STC 30-35 (Acoustical Solutions, STC rating chart); the low end, as a plain door\'s edges are not sealed.', 'loud', undefined, 'EN 1627 resistance class RC3 (hammer, crowbar, screwdrivers): 5 min of working time.', 'A stout door, hatch or gate of oak; its lock or bar breaks with it.'],
      [BM.brick, 'Brick', [10, 34], 20, 120, 52, 'An 8-in (20 cm) solid face brick wall: STC 52 (BIA Technical Note 5A, Riverbank Acoustical Laboratories tests).', 'loud', undefined, 'An 8-in (20 cm) mortar-filled concrete block wall, 10 lb sledgehammer: 2.0 min (NCEL TN-1425, Tancreto 1976, Table 3).', 'Town houses and cellars: half a brick is about 10 cm, a brick about 22 cm.'],
      [BM.iron, 'Iron bars', [2, 6], 3, 600, 0, 'Bars: sound passes through the air between them, as through an open gap.', 'blaring', undefined, 'EN 1627 resistance class RC4 (saws, axes, hammers, chisels): 10 min of working time.', 'Cell bars, a grate, an iron-bound gate, bars over a window.'],
      [BM.stone, 'Stone', [20, 400], 20, 660, 57, 'Nearest source: 15 cm of poured concrete, STC about 55 (NRC Canadian Building Digest 239), +2.5 dB to 20 cm by the mass law; 8-in bare concrete is STC 57-60 (Commercial Acoustics).', 'blaring', undefined, 'Nearest source: 8-in (20 cm) unreinforced concrete with drill, sledgehammer and punch, 11 min (NCEL TN-1425, Tancreto 1976, Table 3; NBSIR 73-101).', 'Mortared stone: a cottage wall is about 60 cm, a castle curtain wall metres.'],
      [BM.glass, 'Glass', [0.3, 1], 0.5, 1, 27, '6 mm single glazing: STC 29 (Engineering ToolBox, sound transmission loss through building elements), less 1.6 dB to 5 mm by the mass law.', 'loud', undefined, 'An estimate (no source found): one blow breaks a pane.', 'Window panes and glazed walls.'],
      [BM.rubble, 'Rubble', [30, 300], 100, 1050, 68, 'An estimate by weight: about 1600 kg/m² of loose stone with its gaps, against 20 cm of concrete\'s 460 kg/m² at 57 dB (the mass law).', 'raised', undefined, 'About 150 shovels to the cubic yard (EngineersEdge, Typical capacities of earth-handling methods); a person-sized passage 1 m deep is about 2.4 cubic yards, at an estimated 3 s a shovel.', 'A cave-in or fallen stone, cleared by digging; its thickness is how deep it lies.'],
      [BM.ice, 'Ice', [30, 200], 100, 1200, 63, 'A placeholder (fantasy), by weight: about 920 kg/m², against stone\'s 460 at 57 dB.', 'raised', undefined, 'A placeholder (fantasy).', 'A frozen cavern deep in the wild: soft for its size.', true],
      [BM.living_wood, 'Living wood', [20, 100], 40, 1800, 53, 'A placeholder (fantasy), by weight: about 280 kg/m², against stone\'s 460 at 57 dB.', 'loud', 'regrows', 'A placeholder (fantasy).', 'A grown hedge-wall or a hollow giant tree: stop working and it closes again.', true],
      [BM.slime_membrane, 'Slime membrane', [10, 50], 30, 120, 53, 'A placeholder (fantasy), by weight: about 300 kg/m² of water-heavy slime, against stone\'s 460 at 57 dB.', 'murmur', 'regrows', 'A placeholder (fantasy).', 'The wet wall of a slime nest: quick to cut, quick to close, almost silent.', true],
      [BM.lair_stone, 'Lair stone', [50, 500], 100, 14400, 71, 'A placeholder (fantasy), by weight: about 2300 kg/m², against stone\'s 460 at 57 dB.', 'blaring', 'deeper', 'A placeholder (fantasy).', 'The walls of a dungeon or lair: harder the deeper the wild goes (waits on D-331).', true],
      [BM.starmetal, 'Starmetal', [5, 30], 20, 1e7, 68, 'A placeholder (fantasy), by weight: iron-heavy, about 1560 kg/m², against stone\'s 460 at 57 dB.', 'deafening', undefined, 'A placeholder (fantasy): about four months at 50, so a Mythic needs half a day and a Transcendent minutes.', 'A vault or sealed tomb door of sky-fallen metal.', true],
    ] as [string, string, [number, number], number, number, number, string, import('../scales').NoiseKey, 'regrows' | 'deeper' | undefined, string, string, true?][]).map(([id, name, thicknessCm, exampleCm, secondsAt50, soundDb, soundSource, noise, trait, source, text, fantasy]) =>
      [id, { id, name, thicknessCm, exampleCm, secondsAt50, soundDb, noise, ...(trait ? { trait } : {}), ...(fantasy ? { fantasy } : {}), source, soundSource, text }])),
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
      thunderous: 'A gunshot or a firework bursting close by, the threshold of pain (about 140 dB)',
      shattering: 'A volcano blowing apart: Krakatoa still measured 172 dB 160 km away (about 170 dB)',
      cataclysmic: 'The loudest true sound air can carry; anything louder is a shockwave (about 194 dB)',
    } as Record<string, string>)[k] }])),
    visibilityLevels: Object.fromEntries(VISIBILITY.keys.map((k) => [k, { id: k, name: VISIBILITY.name(k), clearM: CONFIG.SIGHT_M[k]?.[0] ?? null, glimpsedM: CONFIG.SIGHT_M[k]?.[1] ?? null, like: ({
      unseen: 'Nothing to see: keeping still out of sight',
      faint: 'A palmed coin, a note passed hand to hand: made out within half a metre, glimpsed within 2 m',
      slight: 'Lips moving, a lockpick being worked, a hand slipping into a purse: made out at 2 m, glimpsed at 6 m',
      close: 'A nod, a hand sign, a change of expression: read at about 6 m, noticed out to about 20 m',
      low: 'Someone sitting still or resting: a face known at about 15 m (where witnesses stop naming faces reliably), a shape noticed at 60 m',
      normal: 'Someone walking or talking: who it is at about 25 m, a figure moving across open ground at 200 m',
      high: 'A fight, someone running or waving: who is who by build and clothes at 50 m, the movement caught at 500 m',
      bright: 'A galloping rider, a banner waving, a crowd on the move: made out at 100 m, seen 1 km off',
      glaring: 'A fire, a torch or a lit window at night, sun flashing on steel: made out at 200 m, seen 2 km off',
    } as Record<string, string>)[k] }])),
    layouts: LAYOUTS,
    items: { ...ITEMS, ...Object.fromEntries(Object.values(UNIQUES).flatMap((t) => t.unique?.itemDefs ?? []).map((d) => [d.id, d])) },
    templates: { ...TEMPLATES, ...UNIQUES }, // HF34 a: Hall of fame heroes are unique templates in their own file
    npcRoles: NPC_ROLES,
    themes: THEMES,
    // NR37 a: the first beast prefix; later ones (mana, demons) add traits on top. A creature carries at most one
    // NR37 a: Dire's third part, one body size larger, waits for a body-size rule (D-354)
    prefixes: { [PF.dire]: { id: PF.dire, name: 'Dire', text: 'A bigger, fiercer kind of the same beast: one rank up, half again the health, a fifth more skill.', rankStep: 1, hpMult: 1.5, skillMult: 1.2 } },
    hookKinds: HOOK_KINDS,
    castRecipes: CAST_RECIPES,
    // NR17 a: hooks by settlement size (the crowd is text); must = always there, the rest rolled from pool without repeats first
    rosters: {
      hamlet: { count: [1, 2], must: [], pool: [HK.face, HK.threat], theme: TH.village_folk },
      village: { count: [3, 5], must: [HK.leader, HK.service, HK.warden], pool: [HK.face, HK.face, HK.threat, HK.rival], theme: TH.village_folk },
      town: { count: [6, 10], must: [HK.leader, HK.service, HK.seat, HK.trader, HK.watch, HK.rival], pool: [HK.service, HK.face, HK.face, HK.trader, HK.threat], theme: TH.town_folk },
      // TL24 / NR21 a: a city holds a Beyond and a realm's court a Mythic. The land draws no cities or courts yet (a region
      // holds one town at most); these rows are ready for when a region brief or a bigger region places one
      city: { count: [10, 16], must: [HK.leader, HK.service, HK.seat, HK.trader, HK.watch, HK.rival, HK.threat], pool: [HK.service, HK.face, HK.face, HK.face, HK.trader, HK.rival, HK.threat], theme: TH.town_folk },
      court: { count: [5, 8], must: [HK.leader, HK.seat, HK.watch, HK.rival], pool: [HK.rival, HK.face, HK.face, HK.service, HK.trader], theme: TH.lords_household },
    },
    // NR18 a: who travels a road, by danger (only who brings gain or danger); code rolls a stretch when the land is drawn
    roadPeople: {
      safe: { count: [0, 1], rows: [meet(GP.pedlar, 3), meet(GP.watch_patrol, 2), meet(GP.traveller, 2)] },
      quiet: { count: [0, 2], rows: [meet(GP.pedlar, 3), meet(GP.traveller, 3), meet(GP.pilgrims, 1)] },
      wild: { count: [1, 2], rows: [meet(GP.caravan, 3), meet(GP.wolf_pack, 2), meet(GP.traveller, 1)] },
      dangerous: { count: [1, 3], rows: [meet(GP.bandit_gang, 4), meet(GP.wolf_pack, 2), meet(GP.bear, 1), meet(GP.bandit_company, 1)] }, // NF7 a: a company (placeholder weight)
    },
    // NR19 a: the wild by land cover (flocks, herds and deer are scenery text); monsters only at their own places
    wildPeople: {
      [LC.farmland]: [meet(GP.dog, 3, 'day'), meet(GP.wolf_pack, 1, 'night')],
      [LC.pasture]: [meet(GP.dog, 3, 'day'), meet(GP.wolf_pack, 1, 'night')],
      [LC.woods]: [meet(GP.hunter, 3, 'day'), meet(GP.boar, 2), meet(GP.wolf_pack, 2, 'night'), meet(GP.bear, 1)],
      [LC.heath]: [meet(GP.wolf_pack, 3), meet(GP.bear, 1)],
      [LC.moor]: [meet(GP.wolf_pack, 3), meet(GP.bear, 1)],
      [LC.marsh]: [meet(GP.slimes, 3)],
      [LC.water_meadow]: [meet(GP.slimes, 3)],
      [LC.rock]: [meet(GP.bear, 1)],
    },
    // NR20 a: people at landmarks (a shrine, mill, quarry, mine and standing stones hold crowd or nobody; a ruin holds one
    // monster kind in its own place only when the World builder puts it there)
    landmarkPeople: {
      [LM.tower]: [meet(GP.watch_post, 1)],
      [LM.camp]: [meet(GP.bandit_gang, 3), meet(GP.watch_patrol, 1)],
    },
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
      [ACH.yielded_10]: { id: ACH.yielded_10, name: 'Breaker of Wills', level: 'iii', rule: 'yielded', tags: ['combat', 'social'], count: 10, after: ACH.yielded_1, skillAdd: { [SK.intimidation]: 5 }, personality: ap({ [PA.pride]: 1 }) },
      [ACH.yielded_50]: { id: ACH.yielded_50, name: 'The Name That Ends Fights', level: 'iv', rule: 'yielded', tags: ['combat', 'social'], count: 50, after: ACH.yielded_10, renown: 10, personality: ap({ [PA.pride]: 1 }) },
      // TM9: 1 / 10 / 50 / 100 per group (the first row's name is a placeholder)
      [ACH.crits_1]: { id: ACH.crits_1, name: 'First Clean Stroke ({group})', level: 'zero', rule: 'crits', tags: ['skill'], count: 1, by: 'group' },
      [ACH.crits_10]: { id: ACH.crits_10, name: 'Sure Hand ({group})', level: 'i', rule: 'crits', tags: ['skill'], count: 10, by: 'group', after: ACH.crits_1 },
      [ACH.crits_50]: { id: ACH.crits_50, name: 'Perfect Form ({group})', level: 'ii', rule: 'crits', tags: ['skill'], count: 50, by: 'group', after: ACH.crits_10 },
      [ACH.crits_100]: { id: ACH.crits_100, name: 'Master of the Moment ({group})', level: 'iii', rule: 'crits', tags: ['skill'], count: 100, by: 'group', after: ACH.crits_50, standIn: 0.2 },
      [ACH.beyond_1]: { id: ACH.beyond_1, name: 'Beyond Perfect', level: 'i', rule: 'beyond_crit', tags: ['skill'], count: 1 },
      [ACH.beyond_2]: { id: ACH.beyond_2, name: 'Past the Limit', level: 'ii', rule: 'beyond_crit', tags: ['skill'], count: 2, after: ACH.beyond_1 },
      [ACH.beyond_3]: { id: ACH.beyond_3, name: 'Touched by Fate', level: 'iii', rule: 'beyond_crit', tags: ['skill'], count: 3, after: ACH.beyond_2, tierUnlocks: [{ roll: 'any', side: 'up', steps: 1 }] },
      [ACH.beyond_group_1]: { id: ACH.beyond_group_1, name: 'Beyond Perfect ({group})', level: 'i', rule: 'beyond_crit', tags: ['skill'], count: 1, by: 'group', branchOf: ACH.beyond_1, skillAddByKind: 1 },
      [ACH.beyond_group_2]: { id: ACH.beyond_group_2, name: 'Past the Limit ({group})', level: 'ii', rule: 'beyond_crit', tags: ['skill'], count: 2, by: 'group', after: ACH.beyond_group_1, skillAddByKind: 1 },
      [ACH.beyond_group_3]: { id: ACH.beyond_group_3, name: 'Touched by Fate ({group})', level: 'iii', rule: 'beyond_crit', tags: ['skill'], count: 3, by: 'group', after: ACH.beyond_group_2, skillAddByKind: 1 },
      [ACH.flawless_1]: { id: ACH.flawless_1, name: 'Untouched', level: 'i', rule: 'flawless', tags: ['combat'], count: 1, personality: ap({ [PA.discipline]: 1 }) },
      [ACH.flawless_10]: { id: ACH.flawless_10, name: 'Not a Scratch', level: 'ii', rule: 'flawless', tags: ['combat'], count: 10, after: ACH.flawless_1, personality: ap({ [PA.discipline]: 1 }) },
      [ACH.flawless_50]: { id: ACH.flawless_50, name: 'Untouchable', level: 'iii', rule: 'flawless', tags: ['combat'], count: 50, after: ACH.flawless_10, personality: ap({ [PA.discipline]: 1 }) },
      [ACH.outnumbered_1]: { id: ACH.outnumbered_1, name: 'Stand Against Many', level: 'ii', rule: 'outnumbered', tags: ['combat'], count: 1, personality: ap({ nerve: 1 }) },
      [ACH.outnumbered_10]: { id: ACH.outnumbered_10, name: 'One Against the Horde', level: 'iii', rule: 'outnumbered', tags: ['combat'], count: 10, after: ACH.outnumbered_1, personality: ap({ nerve: 1 }) },
      [ACH.brink_1]: { id: ACH.brink_1, name: 'Not Today', level: 'i', rule: 'brink', tags: ['combat', 'survival'], count: 1 },
      [ACH.brink_3]: { id: ACH.brink_3, name: 'Not Yet', level: 'i', rule: 'brink', tags: ['combat', 'survival'], count: 3, after: ACH.brink_1, deathsDoor: 7 },
      [ACH.brink_5]: { id: ACH.brink_5, name: 'Death Keeps Waiting', level: 'ii', rule: 'brink', tags: ['combat', 'survival'], count: 5, after: ACH.brink_3, deathsDoor: 1, excludes: ['deathsDoor'] },
      [ACH.crippled_1]: { id: ACH.crippled_1, name: 'Still Swinging', level: 'i', rule: 'crippled_defeats', tags: ['combat', 'survival'], count: 1, maxMorale: 1 },
      [ACH.crippled_10]: { id: ACH.crippled_10, name: 'Bones Heal Later', level: 'ii', rule: 'crippled_defeats', tags: ['combat', 'survival'], count: 10, perk: PK.past_the_pain, after: ACH.crippled_1 },
      [ACH.held_line_1]: { id: ACH.held_line_1, name: 'Few Against Many', level: 'i', rule: 'held_line', tags: ['combat', 'social'], count: 1, personality: ap({ nerve: 1 }) },
      [ACH.held_line_10]: { id: ACH.held_line_10, name: 'Hold the Line', level: 'ii', rule: 'held_line', tags: ['combat', 'social'], count: 10, after: ACH.held_line_1, rally: 10, personality: ap({ nerve: 1 }) },
      // IAA-108 deed ideas (DI1-DI7, DI12-DI15, DI20): rows approved from the Chronicler's ideas
      [ACH.counter_kills_1]: { id: ACH.counter_kills_1, name: 'Answer in Steel', level: 'zero', rule: 'counter_kills', tags: ['combat'], count: 1 },
      [ACH.counter_kills_10]: { id: ACH.counter_kills_10, name: 'Every Thrust Returned', level: 'i', rule: 'counter_kills', tags: ['combat'], count: 10, after: ACH.counter_kills_1 }, // placeholder name
      [ACH.counter_kills_50]: { id: ACH.counter_kills_50, name: 'Strike Me and Die', level: 'ii', rule: 'counter_kills', tags: ['combat'], count: 50, after: ACH.counter_kills_10 }, // placeholder name
      [ACH.held_ground_1]: { id: ACH.held_ground_1, name: 'Not One Step', level: 'i', rule: 'held_ground', tags: ['combat'], count: 1, personality: ap({ nerve: 1 }) },
      [ACH.held_ground_10]: { id: ACH.held_ground_10, name: 'Rooted', level: 'ii', rule: 'held_ground', tags: ['combat'], count: 10, after: ACH.held_ground_1, personality: ap({ nerve: 1 }) }, // placeholder name
      [ACH.held_ground_more_1]: { id: ACH.held_ground_more_1, name: 'Not One Step ({foes}+)', level: 'ii', rule: 'held_ground', by: 'foes', only: String(CONFIG.HELD_GROUND_FOES[0]), tags: ['combat'], count: 1, branchOf: ACH.held_ground_1, personality: ap({ nerve: 1 }) },
      [ACH.held_ground_more_10]: { id: ACH.held_ground_more_10, name: 'Rooted ({foes}+)', level: 'iii', rule: 'held_ground', by: 'foes', only: String(CONFIG.HELD_GROUND_FOES[0]), tags: ['combat'], count: 10, after: ACH.held_ground_more_1, personality: ap({ nerve: 1 }) },
      [ACH.held_ground_most_1]: { id: ACH.held_ground_most_1, name: 'Not One Step ({foes}+)', level: 'iii', rule: 'held_ground', by: 'foes', only: String(CONFIG.HELD_GROUND_FOES[1]), tags: ['combat'], count: 1, branchOf: ACH.held_ground_1, personality: ap({ nerve: 1 }) },
      [ACH.held_ground_most_10]: { id: ACH.held_ground_most_10, name: 'Rooted ({foes}+)', level: 'iv', rule: 'held_ground', by: 'foes', only: String(CONFIG.HELD_GROUND_FOES[1]), tags: ['combat'], count: 10, after: ACH.held_ground_most_1, personality: ap({ nerve: 1 }) },
      [ACH.finishing_1]: { id: ACH.finishing_1, name: 'Finishing Stroke', level: 'zero', rule: 'finishing_blows', tags: ['combat'], count: 1 },
      [ACH.finishing_10]: { id: ACH.finishing_10, name: 'Last Word', level: 'i', rule: 'finishing_blows', tags: ['combat'], count: 10, after: ACH.finishing_1 }, // placeholder name
      [ACH.every_last_1]: { id: ACH.every_last_1, name: 'Every Last One', level: 'i', rule: 'every_last', tags: ['combat'], count: 1, maxMorale: 1 },
      [ACH.every_last_10]: { id: ACH.every_last_10, name: 'None Left for Them', level: 'ii', rule: 'every_last', tags: ['combat'], count: 10, after: ACH.every_last_1, renown: 5 }, // placeholder name
      [ACH.crippled_quests_1]: { id: ACH.crippled_quests_1, name: 'Paid in Bone', level: 'i', rule: 'crippled_quests', tags: ['social', 'survival'], count: 1, maxMorale: 1 },
      [ACH.crippled_quests_5]: { id: ACH.crippled_quests_5, name: 'Bought with Blood', level: 'ii', rule: 'crippled_quests', tags: ['social', 'survival'], count: 5, after: ACH.crippled_quests_1, restPct: 10, maxHpPct: 2 }, // placeholder name
      [ACH.crippled_parts_1]: { id: ACH.crippled_parts_1, name: 'Something Gave', level: 'zero', rule: 'crippled_parts', tags: ['survival'], count: 1, branchOf: ACH_HEADS.wounds, maxMorale: 1, maxHpPct: 1 },
      [ACH.crippled_parts_10]: { id: ACH.crippled_parts_10, name: 'Held Together', level: 'i', rule: 'crippled_parts', tags: ['survival'], count: 10, after: ACH.crippled_parts_1, maxMorale: 1, maxHpPct: 1 }, // placeholder name
      [ACH.threat_deals_1]: { id: ACH.threat_deals_1, name: 'Terms Under Threat', level: 'i', rule: 'threat_deals', tags: ['social', 'combat'], count: 1, personality: ap({ nerve: 1 }) },
      [ACH.threat_deals_10]: { id: ACH.threat_deals_10, name: 'Danger Money', level: 'ii', rule: 'threat_deals', tags: ['social', 'combat'], count: 10, after: ACH.threat_deals_1, questPayPct: 10 }, // placeholder name
      [ACH.quests_1]: { id: ACH.quests_1, name: 'Job Done', level: 'zero', rule: 'quests_done', tags: ['social'], count: 1, personality: ap({ [PA.discipline]: 1 }) },
      [ACH.quests_5]: { id: ACH.quests_5, name: 'Reliable Hand', level: 'i', rule: 'quests_done', tags: ['social'], count: 5, after: ACH.quests_1, personality: ap({ [PA.discipline]: 1 }) },
      [ACH.quests_10]: { id: ACH.quests_10, name: 'Hand for Hire', level: 'ii', rule: 'quests_done', tags: ['social'], count: 10, after: ACH.quests_5, questPayPct: 5, personality: ap({ [PA.discipline]: 1 }) },
      [ACH.quests_25]: { id: ACH.quests_25, name: 'Sought After', level: 'iii', rule: 'quests_done', tags: ['social'], count: 25, after: ACH.quests_10, questPayPct: 5, personality: ap({ [PA.discipline]: 1 }) },
      [ACH.quests_50]: { id: ACH.quests_50, name: 'The One They Send For', level: 'iv', rule: 'quests_done', tags: ['social'], count: 50, after: ACH.quests_25, questPayPct: 10, personality: ap({ [PA.discipline]: 1 }) },
      [ACH.quests_abandoned_1]: { id: ACH.quests_abandoned_1, name: 'Left Undone', level: 'zero', rule: 'quests_abandoned', tags: ['social'], count: 1, scar: true }, // TM29: the first one (placeholder name)
      [ACH.quests_abandoned_5]: { id: ACH.quests_abandoned_5, name: 'Word Not Kept', level: 'i', rule: 'quests_abandoned', tags: ['social'], count: 5, after: ACH.quests_abandoned_1, scar: true, personality: ap({ [PA.honesty]: -1 }) },
      // TM8: 1 / 10 / 100 / 500 (the first of an act is an achievement; the first row's name is a placeholder)
      [ACH.clean_1]: { id: ACH.clean_1, name: 'Turned Aside', level: 'zero', rule: 'clean_defense', tags: ['combat'], count: 1, defenseRoll: 1 },
      [ACH.clean_10]: { id: ACH.clean_10, name: 'Not Here', level: 'i', rule: 'clean_defense', tags: ['combat'], count: 10, after: ACH.clean_1, defenseRoll: 2 },
      [ACH.clean_100]: { id: ACH.clean_100, name: 'Wall of Steel', level: 'ii', rule: 'clean_defense', tags: ['combat'], count: 100, after: ACH.clean_10, defenseRoll: 3 },
      [ACH.clean_500]: { id: ACH.clean_500, name: 'Nothing Lands', level: 'iii', rule: 'clean_defense', tags: ['combat'], count: 500, after: ACH.clean_100, defenseRoll: 4 },
      [ACH.unseen_1]: { id: ACH.unseen_1, name: 'Unnoticed', level: 'zero', rule: 'unseen_moves', tags: ['stealth'], count: 1 }, // TM24 (placeholder name)
      [ACH.unseen_10]: { id: ACH.unseen_10, name: 'Under Their Noses', level: 'i', rule: 'unseen_moves', tags: ['stealth'], count: 10, after: ACH.unseen_1, skillAdd: { [SK.sneaking]: 1 } },
      [ACH.unseen_50]: { id: ACH.unseen_50, name: 'Slipped Past', level: 'ii', rule: 'unseen_moves', tags: ['stealth'], count: 50, after: ACH.unseen_10, skillAdd: { [SK.sneaking]: 2 } },
      [ACH.unseen_250]: { id: ACH.unseen_250, name: 'Never Was Here', level: 'iii', rule: 'unseen_moves', tags: ['stealth'], count: 250, after: ACH.unseen_50, skillAdd: { [SK.sneaking]: 3 }, quieter: 1 },
      [ACH.vanished_1]: { id: ACH.vanished_1, name: 'Gone', level: 'zero', rule: 'vanished', tags: ['stealth'], count: 1 }, // TM24 (placeholder name)
      [ACH.vanished_5]: { id: ACH.vanished_5, name: 'Now You Don\u2019t', level: 'i', rule: 'vanished', tags: ['stealth'], count: 5, after: ACH.vanished_1, skillAdd: { [SK.vanishing]: 1 } },
      [ACH.vanished_25]: { id: ACH.vanished_25, name: 'Smoke on the Wind', level: 'ii', rule: 'vanished', tags: ['stealth'], count: 25, after: ACH.vanished_5, skillAdd: { [SK.vanishing]: 2 } },
      [ACH.vanished_50]: { id: ACH.vanished_50, name: 'As If Never There', level: 'iii', rule: 'vanished', tags: ['stealth'], count: 50, after: ACH.vanished_25, skillAdd: { [SK.vanishing]: 3 } }, // XR16 (placeholder name)
      [ACH.spotted_10]: { id: ACH.spotted_10, name: 'Nothing Gets Past', level: 'i', rule: 'spotted', tags: ['stealth'], count: 10 },
      [ACH.spotted_100]: { id: ACH.spotted_100, name: 'Eyes in the Back of Your Head', level: 'ii', rule: 'spotted', tags: ['stealth'], count: 100, after: ACH.spotted_10, spotRoll: 1 },
      [ACH.spotted_250]: { id: ACH.spotted_250, name: 'Nothing Moves Unseen', level: 'iii', rule: 'spotted', tags: ['stealth'], count: 250, after: ACH.spotted_100, spotRoll: 2 },
      [ACH.spotted_fn_1]: { id: ACH.spotted_fn_1, name: 'Sharp {function}', level: 'zero', rule: 'spotted', tags: ['stealth'], count: 1, by: 'function', branchOf: ACH.spotted_10 },
      [ACH.spotted_fn_10]: { id: ACH.spotted_fn_10, name: '{function} That Never Sleeps', level: 'i', rule: 'spotted', tags: ['stealth'], count: 10, after: ACH.spotted_fn_1, by: 'function', skillAddByKind: 2 },
      [ACH.spotted_fn_100]: { id: ACH.spotted_fn_100, name: 'Nothing Hides from Your {function}', level: 'ii', rule: 'spotted', tags: ['stealth'], count: 100, after: ACH.spotted_fn_10, by: 'function', skillAddByKind: 2 },
      [ACH.speech_1]: { id: ACH.speech_1, name: 'First Word Won ({skill})', level: 'zero', rule: 'speech_won', tags: ['social'], count: 1, by: 'skill' }, // TM20 (placeholder name)
      [ACH.speech_10]: { id: ACH.speech_10, name: 'Practised Speaker ({skill})', level: 'i', rule: 'speech_won', tags: ['social'], count: 10, by: 'skill', after: ACH.speech_1, skillAddByKind: 2, personality: ap({ [PA.sociability]: 1 }), personalityByKind: { [SK.falsehood]: ap({ [PA.honesty]: -1 }) } },
      [ACH.speech_100]: { id: ACH.speech_100, name: 'Voice That Carries ({skill})', level: 'ii', rule: 'speech_won', tags: ['social'], count: 100, after: ACH.speech_10, by: 'skill', skillAddByKind: 2, personality: ap({ [PA.sociability]: 1 }), personalityByKind: { [SK.falsehood]: ap({ [PA.honesty]: -1 }) } },
      [ACH.speech_250]: { id: ACH.speech_250, name: 'Words That Move Crowds ({skill})', level: 'iii', rule: 'speech_won', tags: ['social'], count: 250, after: ACH.speech_100, by: 'skill', skillAddByKind: 2, personality: ap({ [PA.sociability]: 1 }), personalityByKind: { [SK.falsehood]: ap({ [PA.honesty]: -1 }) } },
      [ACH.talked_down_1]: { id: ACH.talked_down_1, name: 'Blood Unspilled', level: 'i', rule: 'talked_down', tags: ['social'], count: 1, skillAdd: { [SK.persuasion]: 2 }, personality: ap({ [PA.temper]: -1 }) },
      [ACH.talked_down_10]: { id: ACH.talked_down_10, name: 'Peacemaker', level: 'ii', rule: 'talked_down', tags: ['social'], count: 10, after: ACH.talked_down_1, skillAdd: { [SK.persuasion]: 2 }, personality: ap({ [PA.temper]: -1 }) },
      [ACH.talked_down_50]: { id: ACH.talked_down_50, name: 'Every Fight Ends in Talk', level: 'iii', rule: 'talked_down', tags: ['social'], count: 50, after: ACH.talked_down_10, skillAdd: { [SK.persuasion]: 2 }, personality: ap({ [PA.temper]: -1 }) },
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
      [ACH.back_from_down_1]: { id: ACH.back_from_down_1, name: 'Not Done Yet', level: 'iii', rule: 'back_from_down', tags: ['survival'], count: 1, maxMorale: 5 },
      // the deepest of the near-death depths (Critical, Down and back, the survival roll): depth pays more than count
      [ACH.survival_roll_1]: { id: ACH.survival_roll_1, name: 'Woke Up Anyway', level: 'ii', rule: 'survival_rolls', tags: ['combat', 'survival'], count: 1, maxMorale: 10 },
      // D-292: one time; your contest rolls can go one tier past Critical Success (name and reward level are placeholders)
      [ACH.matched_crit_1]: { id: ACH.matched_crit_1, name: 'Perfect Meets Perfect', level: 'i', rule: 'matched_crits', tags: ['skill'], count: 1, tierUnlocks: [{ roll: 'contest', side: 'up', steps: 1 }] },
      [ACH.holds_1]: { id: ACH.holds_1, name: 'Got a Grip', level: 'zero', rule: 'holds', tags: ['combat', 'skill'], count: 1 }, // TM24 (placeholder name)
      [ACH.holds_10]: { id: ACH.holds_10, name: 'Iron Grip', level: 'i', rule: 'holds', tags: ['combat', 'skill'], count: 10, after: ACH.holds_1 },
      [ACH.holds_100]: { id: ACH.holds_100, name: 'No Getting Loose', level: 'ii', rule: 'holds', tags: ['combat', 'skill'], count: 100, after: ACH.holds_10 },
      [ACH.aimed_10]: { id: ACH.aimed_10, name: 'Called Shot', level: 'i', rule: 'aimed_hits', tags: ['combat', 'skill'], count: 10, aimEase: 5 },
      // TM7: 10 / 50 / 100
      [ACH.aimed_50]: { id: ACH.aimed_50, name: 'Where I Said', level: 'ii', rule: 'aimed_hits', tags: ['combat', 'skill'], count: 50, after: ACH.aimed_10, aimEase: 5 },
      [ACH.aimed_100]: { id: ACH.aimed_100, name: 'Never Misses Its Mark', level: 'iii', rule: 'aimed_hits', tags: ['combat', 'skill'], count: 100, after: ACH.aimed_50, aimEase: 5 },
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
      [ACH.won_panicking_1]: { id: ACH.won_panicking_1, name: 'Hands Still Shaking', level: 'i', rule: 'won_panicking', tags: ['combat'], count: 1, personality: ap({ nerve: 1 }), maxMorale: 5 },
      [ACH.won_panicking_10]: { id: ACH.won_panicking_10, name: 'Fear Rides With Me', level: 'ii', rule: 'won_panicking', tags: ['combat'], count: 10, after: ACH.won_panicking_1, personality: ap({ nerve: 1 }), maxMorale: 5 },
      [ACH.won_panicking_25]: { id: ACH.won_panicking_25, name: 'Panic Is Just Another Weapon', level: 'iii', rule: 'won_panicking', tags: ['combat'], count: 25, after: ACH.won_panicking_10, personality: ap({ nerve: 1 }), maxMorale: 5 },
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
      // BS2 b: bested (defeated, or talked or bribed out of a fight with you), each person once; from reward level −2
      [ACH.bested_1]: { id: ACH.bested_1, name: 'Bested', level: 'minus_2', rule: 'bested', tags: ['social'], count: 1 },
      [ACH.bested_10]: { id: ACH.bested_10, name: 'The Better of Ten', level: 'minus_1', rule: 'bested', tags: ['social'], count: 10, after: ACH.bested_1 },
      [ACH.bested_100]: { id: ACH.bested_100, name: 'The Better of a Hundred', level: 'zero', rule: 'bested', tags: ['social'], count: 100, after: ACH.bested_10 },
      [ACH.bested_250]: { id: ACH.bested_250, name: 'Few Stand Long Against You', level: 'i', rule: 'bested', tags: ['social'], count: 250, after: ACH.bested_100 },
      [ACH.bested_1000]: { id: ACH.bested_1000, name: 'Better Than a Thousand', level: 'ii', rule: 'bested', tags: ['social'], count: 1000, after: ACH.bested_250 },
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
      [ACH.hp_lost_1000]: { id: ACH.hp_lost_1000, name: 'Hard to Count the Wounds', level: 'i', rule: 'hp_lost', tags: ['survival'], count: 1000, after: ACH.hp_lost_100, fearFrom: { fear: FR.own_level, steps: 1 } },
      [ACH.hp_lost_10000]: { id: ACH.hp_lost_10000, name: 'Made of Old Wounds', level: 'ii', rule: 'hp_lost', tags: ['survival'], count: 10000, after: ACH.hp_lost_1000, fearFrom: { fear: FR.own_level, steps: 1 } },
      [ACH.morale_lost_100]: { id: ACH.morale_lost_100, name: 'Nerves Worn Thin', level: 'zero', rule: 'morale_lost', tags: ['survival'], count: 100, maxMorale: 1 },
      [ACH.morale_lost_1000]: { id: ACH.morale_lost_1000, name: 'Seen Too Much', level: 'i', rule: 'morale_lost', tags: ['survival'], count: 1000, after: ACH.morale_lost_100, maxMorale: 2 },
      [ACH.morale_lost_10000]: { id: ACH.morale_lost_10000, name: 'Fear Is an Old Friend', level: 'ii', rule: 'morale_lost', tags: ['survival'], count: 10000, after: ACH.morale_lost_1000, maxMorale: 3 },
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
      [ACH.total_50]: { id: ACH.total_50, name: 'A Thread Worth Following', level: 'iii', rule: 'achievements', tags: ['progression'], count: 50, after: ACH.total_25, eventRoll: 1 },
      [ACH.total_100]: { id: ACH.total_100, name: 'Pattern in the Weave', level: 'iv', rule: 'achievements', tags: ['progression'], count: 100, after: ACH.total_50 },
      [ACH.total_250]: { id: ACH.total_250, name: 'The Tapestry Remembers', level: 'v', rule: 'achievements', tags: ['progression'], count: 250, after: ACH.total_100, eventRoll: 2 },
      // TM16: the chain scales with however many achievements the game gains: every 250 past 250, a reward level higher each time
      [ACH.total_every]: { id: ACH.total_every, name: 'The Weave Goes On ({level})', level: 'v', rule: 'achievements', tags: ['progression'], count: 500, every: 250, levelStep: 1, branchOf: ACH.total_10 },
      // TM14: areas entered, counted per kind of area under one head: zones 1 / 25 / 50 / 150 / 300, and every kind of place
      // (a settlement, a place in one, any kind made later) 1 / 5 / 10 / 25 / 50. New names are placeholders.
      [ACH.zones_1]: { id: ACH.zones_1, name: 'Out the Door', level: 'minus_1', rule: 'zones', tags: ['exploration'], count: 1, branchOf: ACH_HEADS.areas },
      [ACH.zones_25]: { id: ACH.zones_25, name: 'Finding Your Feet', level: 'zero', rule: 'zones', tags: ['exploration'], count: 25, after: ACH.zones_1, personality: ap({ [PA.curiosity]: 1 }) },
      [ACH.zones_50]: { id: ACH.zones_50, name: 'Wanderer', level: 'i', rule: 'zones', tags: ['exploration'], count: 50, after: ACH.zones_25, personality: ap({ [PA.curiosity]: 1 }) },
      [ACH.zones_150]: { id: ACH.zones_150, name: 'Pathfinder', level: 'ii', rule: 'zones', tags: ['exploration'], count: 150, after: ACH.zones_50, personality: ap({ [PA.curiosity]: 1 }) },
      [ACH.zones_300]: { id: ACH.zones_300, name: 'Walker of Every Road', level: 'iii', rule: 'zones', tags: ['exploration'], count: 300, after: ACH.zones_150, personality: ap({ [PA.curiosity]: 1 }) },
      // PZ17: new ground: distinct REGION_CELL_M land cells stood in, 1 / 25 / 100 / 500 / 2,500; XP only, curiosity from zero
      [ACH.ground_1]: { id: ACH.ground_1, name: 'New Ground', level: 'minus_1', rule: 'ground', tags: ['exploration'], count: 1, branchOf: ACH_HEADS.areas },
      [ACH.ground_25]: { id: ACH.ground_25, name: 'Footloose', level: 'zero', rule: 'ground', tags: ['exploration'], count: 25, after: ACH.ground_1, personality: ap({ [PA.curiosity]: 1 }) },
      [ACH.ground_100]: { id: ACH.ground_100, name: 'Far Afield', level: 'i', rule: 'ground', tags: ['exploration'], count: 100, after: ACH.ground_25, personality: ap({ [PA.curiosity]: 1 }) },
      [ACH.ground_500]: { id: ACH.ground_500, name: 'Long Roads Behind', level: 'ii', rule: 'ground', tags: ['exploration'], count: 500, after: ACH.ground_100, personality: ap({ [PA.curiosity]: 1 }) },
      [ACH.ground_2500]: { id: ACH.ground_2500, name: 'Map in the Bones', level: 'iii', rule: 'ground', tags: ['exploration'], count: 2500, after: ACH.ground_500, personality: ap({ [PA.curiosity]: 1 }) },
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
      [ACH.class_tiers_3]: { id: ACH.class_tiers_3, name: 'Across Three Heights', level: 'iii', rule: 'class_max_tiers', tags: ['progression'], count: 3, after: ACH.class_tiers_2, freeLevels: 1.5 },
      [ACH.class_tiers_4]: { id: ACH.class_tiers_4, name: 'Across Four Heights', level: 'iv', rule: 'class_max_tiers', tags: ['progression'], count: 4, after: ACH.class_tiers_3, freeLevels: 2 },
      [ACH.class_tiers_5]: { id: ACH.class_tiers_5, name: 'Across Five Heights', level: 'v', rule: 'class_max_tiers', tags: ['progression'], count: 5, after: ACH.class_tiers_4, freeLevels: 2.5 },
      [ACH.class_tiers_all]: { id: ACH.class_tiers_all, name: 'Every Height Climbed', level: 'vi', rule: 'class_max_tiers', tags: ['progression'], count: CLASS_TIERS.keys.length, after: ACH.class_tiers_5, freeLevels: 3 },
      [ACH.char_level_10]: { id: ACH.char_level_10, name: 'Woven Past Counting ({level})', level: 'minus_1', rule: 'char_level', tags: ['progression'], count: 10, every: 10, levelStep: 1,
        names: { 10: 'No Longer Green', 20: 'Steady Hand', 30: 'Battle-Tested', 40: 'A Name Worth Knowing', 50: 'Half a Hundred Roads',
          60: 'Something Tugs at the Edges', 70: 'The Pattern Takes Notice', 80: 'Caught in the Weave', 90: 'A Thread That Will Not Fray', 100: 'One Who Pulls the Threads' } },
      // growth proposal EG12 a (approved): take your first essence; fill every essence slot at character level 8 or higher
      [ACH.first_knot]: { id: ACH.first_knot, name: 'First Knot', level: 'i', rule: 'essences_taken', tags: ['progression'], count: 1 },
      [ACH.room_for_no_more]: { id: ACH.room_for_no_more, name: 'Room for No More', level: 'ii', rule: 'essence_room', tags: ['progression'], count: 8, essenceSlots: 1 },
    },
  });
  // ST1: a skill's tree is wherever the trees table lists it, so moving a skill is one edit there
  for (const t of Object.values(lib.trees)) for (const id of t.skills) if (lib.skills[id]) lib.skills[id].treeId = t.id;
  // an All-50 skill part sits in its skill's current tree, so it moves with the skill
  for (const p of Object.values(lib.perks)) if (p.allStep?.skill) {
    const treeId = lib.skills[p.allStep.skill]?.treeId;
    if (treeId) p.allStep = { ...p.allStep, treeId };
  }
  // AB16 a, AB20: a natural attack's skill opens to the bodies and races with that attack, Hide to the races with natural armor
  const holders = (has: (x: { naturalAttacks?: AttackMode[]; naturalArmor?: unknown }) => boolean): AccessCond[] => [
    ...Object.values(lib.bodyTypes).filter(has).map((b) => ({ kind: 'body' as const, id: b.id })),
    ...Object.values(lib.races ?? {}).filter(has).map((r) => ({ kind: 'race' as const, id: r.id }))];
  const natural = lib.trees[TR.natural];
  natural.access = { either: holders((x) => !!x.naturalAttacks?.some((m) => natural.skills.includes(m.skill ?? ''))) };
  for (const id of natural.skills) lib.skills[id].access = { either: holders((x) => !!x.naturalAttacks?.some((m) => m.skill === id)) };
  lib.skills[SK.hide].access = { either: holders((x) => !!x.naturalArmor) };
  // Perception: eyes and ears are not for the amorphous (TA6); animals and slimes smell, anyone else only through an essence (AB18 a)
  for (const id of [SK.eyesight, SK.earshot, SK.insight]) lib.skills[id].access = { blockedBy: [AMORPHOUS] };
  lib.skills[SK.scent].access = { either: [RC.slime, ...ANIMALS].map((id) => ({ kind: 'race' as const, id })) };
  // TC9 a: the Tactics tree is closed to unintelligent races; Command needs an intelligent one
  const racesAt = (lvl: string) => Object.values(lib.races ?? {}).filter((r) => r.intelligence === lvl).map((r) => ({ kind: 'race' as const, id: r.id }));
  lib.trees[TR.tactics].access = { blockedBy: [AMORPHOUS, ...racesAt('unintelligent')] };
  lib.skills[SK.command].access = { either: racesAt('intelligent') };
  return lib;
}
