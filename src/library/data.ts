// The prototype library: skills (Part 1 §3), body types (Part 3), classes and templates (Part 4 §4),
// items (Appendix: prototype item bank), routine bank (Appendix: prototype routine bank). All numbers are placeholders.
import { CONFIG } from '../config';
import type { ArmorWeightKey } from '../scales';
import type { AccessCond, ActivityDef, BodyType, ItemDef, ItemEffect, Library, NpcTemplate, Routine, RoutineSet, SituationTag, SkillDef, SkillGroup, XpCategory } from '../types';
import { FUNCTION_GROUP } from './functionNames';
import { PERK_WRITEUPS } from './perks';
import { BOOST_PERKS } from './boostPerks';
import { ALL_PARTS } from './allPerks';
import { BUILT_PERKS } from './builtPerks';

/** XP category from the skill's group (X21, F8); a skill with no deciding group names its own. */
const CATEGORY_OF: Partial<Record<SkillGroup, XpCategory>> = {
  melee: 'offensive', ranged: 'offensive', defense: 'defensive', health: 'endurance', notice: 'notice', influence: 'influence',
};
const sk = (id: string, treeId: string, functions: SkillDef['functions'], roles: SkillDef['roles'], cue?: 'sight' | 'sound', xpCategory?: XpCategory, tier: SkillDef['tier'] = 'tier_2'): SkillDef =>
  ({ id, treeId, functions, roles, ...(cue ? { cue } : {}), xpCategory: xpCategory ?? CATEGORY_OF[FUNCTION_GROUP[functions[0]]] ?? 'misc', tier });

export const SKILLS: Record<string, SkillDef> = Object.fromEntries([
  sk('melee_light', 'melee', ['arms'], ['grip']),
  sk('melee_medium', 'melee', ['arms'], ['grip']),
  sk('melee_heavy', 'melee', ['arms'], ['grip']),
  sk('ranged_light', 'ranged', ['ranged'], ['grip']),
  sk('ranged_medium', 'ranged', ['ranged'], ['grip']),
  sk('ranged_heavy', 'ranged', ['ranged'], ['grip']),
  sk('unarmed_strike', 'unarmed', ['unarmed'], ['grip']),
  sk('unarmed_grapple', 'unarmed', ['unarmed'], ['grip']),
  sk('unarmed_improvised', 'unarmed', ['unarmed'], ['grip']), // fighting with whatever is at hand (Ali, 07/11/2026)
  sk('unarmed_natural', 'natural', ['unarmed'], ['strike']), // its own tree, open to slime and dragon bodies (TA5)
  sk('dodge', 'defense', ['defense'], ['move']),
  sk('block', 'defense', ['defense'], ['grip']),
  sk('endurance', 'defense', ['health'], []), // endurance sets total HP
  sk('sight', 'perception', ['sight'], ['sense'], 'sight'),
  sk('hearing', 'perception', ['hearing'], ['sense'], 'sound'),
  // Stealth (Ali, 08/11/2026, ST1–ST10): one function, two skills; code picks Combat Stealth in an engagement, Sneaking
  // otherwise. Stealth is movement (the move role), so leg wounds count, except when hiding. Rating: notice / offensive.
  sk('sneaking', 'stealth', ['stealth'], ['move'], undefined, 'notice'),
  sk('combat_stealth', 'stealth', ['stealth'], ['move'], undefined, 'offensive'),
  sk('vanishing', 'stealth', ['stealth'], ['move'], undefined, 'offensive'), // ST11/ST18: breaks established sight
  // speech role (Ali, 08/11/2026): head wounds reduce speech rolls
  sk('persuasion', 'speech', ['influence'], ['speech']),
  sk('intimidation', 'speech', ['influence'], ['speech']),
  sk('barter', 'speech', ['influence'], ['speech']),
  sk('feint', 'swordsman', [], ['grip'], undefined, 'offensive'),
  sk('riposte', 'swordsman', [], ['grip'], undefined, 'offensive'),
  sk('disarm', 'swordsman', [], ['grip'], undefined, 'offensive'),
  // slime class skills are tier 0 (Ali, 08/11/2026); F1: tremor is both a sight and a hearing function
  sk('tremor', 'slime_senses', ['sight', 'hearing'], ['sense'], 'sound', undefined, 'tier_0'),
  // OQ-20 (settled 07/11/2026): placeholder tool skill id, renamed through library aliases later. Not on the creation screen.
  sk('lockpicking', 'tools', [], ['grip']),
].map((s) => [s.id, s]));

/** ST21 (Ali, 08/11/2026): situation tags per skill. Light reaches sight and stealth; cover reaches hide and ranged. */
const SITUATION_TAGS_OF: Record<string, SituationTag[]> = {
  melee_light: ['sight'], melee_medium: ['sight'], melee_heavy: ['sight'],
  ranged_light: ['sight', 'ranged'], ranged_medium: ['sight', 'ranged'], ranged_heavy: ['sight', 'ranged'],
  unarmed_strike: ['sight'], unarmed_grapple: ['sight'], unarmed_improvised: ['sight'], unarmed_natural: ['sight'],
  dodge: ['sight'], block: ['sight'], sight: ['sight'], hearing: ['hearing'], tremor: ['hearing'], // hearing: no table reads it yet
  sneaking: ['stealth'], combat_stealth: ['stealth'], vanishing: ['stealth', 'hide'],
};
for (const [id, tags] of Object.entries(SITUATION_TAGS_OF)) SKILLS[id].tags = tags;
// SR1 (Ali, 08/11/2026): intimidation is open to any race with the Speech tree; persuasion and barter need a speaking race
for (const id of ['persuasion', 'barter']) SKILLS[id].access = { must: [{ kind: 'raceTag', id: 'speaks' }] };

const mode = (m: Partial<import('../types').AttackMode> & Pick<import('../types').AttackMode, 'id' | 'tree' | 'class' | 'reach' | 'hands'>) => m;
const KIT = (skill = '$mode'): ItemEffect => ({ kind: 'skill', skill, value: 25, active: 'held', scope: 'withItem', kit: true });
/** armor numbers come from CONFIG (one source, Part 5 armor table) */
const ARMOR = (w: ArmorWeightKey) => ({ reduction: CONFIG.ARMOR_PROTECTION[w][0], multiplier: CONFIG.ARMOR_PROTECTION[w][1], weight: w });
const WEIGHT = (v: number): ItemEffect => ({ kind: 'skill', skill: 'dodge', value: v, active: 'worn', scope: 'any' });

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(([
  { id: 'dagger', kind: 'weapon', name: 'dagger', look: 'a plain dagger', bulk: 1, value: 5, hands: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: 'slash', tree: 'melee', class: 'light', reach: 0, hands: 1 }), mode({ id: 'throw', tree: 'ranged', class: 'light', reach: 1, hands: 1, thrown: true })] } },
  { id: 'arming_sword', kind: 'weapon', name: 'arming sword', look: 'a straight arming sword', bulk: 2, value: 20, hands: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: 'cut', tree: 'melee', class: 'medium', reach: 0, hands: 1 })] } },
  { id: 'greataxe', kind: 'weapon', name: 'greataxe', look: 'a heavy two-handed axe', bulk: 3, value: 30, hands: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: 'chop', tree: 'melee', class: 'heavy', reach: 0, hands: 2 })] } },
  { id: 'spear', kind: 'weapon', name: 'spear', look: 'an ash-shafted spear', bulk: 3, value: 10, hands: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: 'thrust', tree: 'melee', class: 'medium', reach: 1, hands: 2 }), mode({ id: 'throw', tree: 'ranged', class: 'medium', reach: 1, hands: 1, thrown: true })] } },
  { id: 'shortbow', kind: 'weapon', name: 'shortbow', look: 'a short hunting bow', bulk: 2, value: 25, hands: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: 'shoot', tree: 'ranged', class: 'light', reach: 3, hands: 2 })] } },
  { id: 'longbow', kind: 'weapon', name: 'longbow', look: 'a tall longbow', bulk: 3, value: 35, hands: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: 'shoot', tree: 'ranged', class: 'medium', reach: 4, hands: 2 })] } },
  { id: 'crossbow', kind: 'weapon', name: 'crossbow', look: 'a heavy crossbow', bulk: 3, value: 40, hands: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: 'shoot', tree: 'ranged', class: 'heavy', reach: 4, hands: 2 })] } },
  { id: 'hidden_blade', kind: 'weapon', name: 'hidden blade', look: 'a slim blade', bulk: 1, value: 30, hands: 1, concealed: true, effects: [KIT()],
    weapon: { modes: [mode({ id: 'stab', tree: 'melee', class: 'light', reach: 0, hands: 1 })] } },
  { id: 'gambeson', kind: 'armor', name: 'gambeson', look: 'a quilted gambeson', bulk: 2, value: 15, slot: 'armor', effects: [WEIGHT(CONFIG.ARMOR_DODGE.light)],
    armor: { covers: ['general', 'left_arm', 'right_arm', 'left_leg', 'right_leg'], ...ARMOR('light') } },
  { id: 'mail_hauberk', kind: 'armor', name: 'mail hauberk', look: 'a mail hauberk', bulk: 3, value: 60, slot: 'armor', effects: [WEIGHT(CONFIG.ARMOR_DODGE.medium)],
    armor: { covers: ['general', 'left_arm', 'right_arm'], ...ARMOR('medium') } },
  { id: 'plate_harness', kind: 'armor', name: 'plate harness', look: 'a full plate harness', bulk: 3, value: 200, slot: 'armor', effects: [WEIGHT(CONFIG.ARMOR_DODGE.heavy)],
    armor: { covers: ['general', 'left_arm', 'right_arm', 'left_leg', 'right_leg', 'head', 'neck'], ...ARMOR('heavy'), pools: { head: 20 } } },
  { id: 'round_shield', kind: 'shield', name: 'round shield', look: 'a painted round shield', bulk: 2, value: 10, hands: 1, effects: [KIT('block')], shield: { pool: 30 } },
  { id: 'signet_ring', kind: 'accessory', name: 'signet ring', look: 'a heavy signet ring', bulk: 0, value: 40, slot: 'accessory', visible: true },
  { id: 'lucky_charm', kind: 'misc', name: 'lucky charm', look: 'a small knotted charm', bulk: 0, value: 50,
    effects: [{ kind: 'rollMod', roll: 'situation', value: 5, active: 'carried', scope: 'any' }] },
  { id: 'lockpicks', kind: 'tool', name: 'lockpicks', look: 'a roll of lockpicks', bulk: 0, value: 15, hands: 1,
    effects: [{ kind: 'skill', skill: 'lockpicking', value: 25, active: 'inUse', scope: 'withItem' }] },
  { id: 'healing_draught', kind: 'consumable', name: 'healing draught', look: 'a stoppered vial', bulk: 1, value: 10, hands: 1, stackable: true, consumable: true },
  // generic bases for minted items with no close match, and for scene objects the player grabs (loot L2, L3)
  { id: 'improvised_light', kind: 'weapon', name: 'improvised weapon', look: 'something small grabbed to fight with', bulk: 1, value: 0, hands: 1, tags: ['improvised'],
    weapon: { modes: [mode({ id: 'strike', tree: 'melee', class: 'light', skill: 'unarmed_improvised', reach: 0, hands: 1, hitAdj: CONFIG.IMPROVISED_HIT_ADJ })] } },
  { id: 'improvised_medium', kind: 'weapon', name: 'improvised weapon', look: 'something grabbed to fight with', bulk: 2, value: 0, hands: 1, tags: ['improvised'],
    weapon: { modes: [mode({ id: 'strike', tree: 'melee', class: 'medium', skill: 'unarmed_improvised', reach: 0, hands: 1, hitAdj: CONFIG.IMPROVISED_HIT_ADJ })] } },
  { id: 'improvised_heavy', kind: 'weapon', name: 'improvised weapon', look: 'something heavy grabbed to fight with', bulk: 3, value: 0, hands: 2, tags: ['improvised'],
    weapon: { modes: [mode({ id: 'strike', tree: 'melee', class: 'heavy', skill: 'unarmed_improvised', reach: 0, hands: 2, hitAdj: CONFIG.IMPROVISED_HIT_ADJ })] } },
  { id: 'curio', kind: 'misc', name: 'curio', look: 'an odd little object', bulk: 1, value: 1 },
  { id: 'bandage', kind: 'consumable', name: 'bandage', look: 'a roll of linen bandage', bulk: 0, value: 2, stackable: true, consumable: true, heal: 'bandage' },
  { id: 'coin', kind: 'misc', name: 'coin', look: 'coins', bulk: 0, value: 1, stackable: true },
] as ItemDef[]).map((i) => [i.id, i]));

export const BODY_TYPES: Record<string, BodyType> = {
  humanoid: {
    id: 'humanoid', general: { name: 'torso', size: 'normal' },
    naturalAttacks: [{ id: 'punch', tree: 'unarmed', class: 'punch', skill: 'unarmed_strike', reach: 0, hands: 0, name: 'fists' },
      { id: 'grapple', tree: 'unarmed', class: 'grapple', skill: 'unarmed_grapple', reach: 0, hands: 0, name: 'grapple' }],
    parts: [
      { id: 'head', size: 'small', impact: 'essential', roles: ['sense', 'speech'], adjacent: ['general', 'neck'] },
      { id: 'left_arm', size: 'normal', impact: 'normal', roles: ['grip'] },
      { id: 'right_arm', size: 'normal', impact: 'normal', roles: ['grip'] },
      { id: 'left_leg', size: 'normal', impact: 'normal', roles: ['move'] },
      { id: 'right_leg', size: 'normal', impact: 'normal', roles: ['move'] },
      { id: 'neck', size: 'extra_small', impact: 'essential', roles: [], adjacent: ['head', 'general'] },
    ],
    fallback: { attackSkill: 'unarmed_strike' },
    // Side-sheet figure (Ali, 07/11/2026): one SVG path per part id, 'general' is the torso. Facing the viewer, so the
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
  // BR4 (Ali, 08/11/2026): shape names, so later races can reuse them; Slime and Dragon are races
  amorphous: {
    id: 'amorphous', general: { name: 'body', size: 'normal' },
    naturalAttacks: [{ id: 'slam', tree: 'unarmed', class: 'slam', skill: 'unarmed_natural', reach: 0, hands: 0, name: 'slam' }],
    parts: [],
    fallback: { attackSkill: 'unarmed_natural' },
  },
  winged_quadruped: {
    id: 'winged_quadruped', general: { name: 'body', size: 'big' },
    naturalAttacks: [],
    parts: [
      { id: 'head', size: 'normal', impact: 'essential', roles: ['sense', 'strike', 'speech'] },
      { id: 'left_wing', size: 'normal', impact: 'non_essential', roles: ['fly'] },
      { id: 'right_wing', size: 'normal', impact: 'non_essential', roles: ['fly'] },
      { id: 'forelegs', size: 'normal', impact: 'normal', roles: ['move'] },
      { id: 'hind_legs', size: 'normal', impact: 'normal', roles: ['move'] },
      { id: 'tail', size: 'small', impact: 'non_essential', roles: ['strike'] },
    ],
    fallback: { attackSkill: 'unarmed_natural' },
  },
};

export const TEMPLATES: Record<string, NpcTemplate> = {
  slime: {
    id: 'slime', raceId: 'slime', generation: 'copy', minimums: { unarmed_natural: 30, tremor: 50 },
    level: 0, bonusPoints: 0, focus: [], personality: 'fearless', control: 'code', label: 'a slime',
    fallback: { attackSkill: 'unarmed_natural' },
  },
  guard: {
    id: 'guard', raceId: 'human', generation: 'copy',
    minimums: { melee_medium: 40, block: 30, dodge: 20, sight: 30, hearing: 30, intimidation: 30, persuasion: 20 },
    // Ali (08/11/2026): anyone with fighting experience is at least level 4; any patrolling template has Keen Ear
    level: 4, bonusPoints: 10, perks: ['keen_ear'],
    focus: [{ treeId: 'melee', skill: 'melee_medium' }, { treeId: 'defense', skill: 'block' }, { treeId: 'perception', skill: 'sight' }],
    personality: 'steady', loadout: ['arming_sword', 'mail_hauberk'], control: 'agent', label: 'a village guard',
  },
  trader: {
    id: 'trader', raceId: 'human', generation: 'copy',
    minimums: { sight: 25, hearing: 25, barter: 40, persuasion: 30 }, level: 2, bonusPoints: 0, // Ali (08/11/2026): villagers are at least level 2
    focus: [{ treeId: 'perception', skill: 'hearing' }, { treeId: 'melee', skill: 'melee_light' }, { treeId: 'defense', skill: 'dodge' }],
    personality: 'timid', control: 'code', label: 'the barkeep',
  },
  // NS7 (Ali, 08/11/2026): a village thief, the first stealthy NPC
  thief: {
    id: 'thief', raceId: 'human', generation: 'copy',
    minimums: { sneaking: 40, combat_stealth: 30, vanishing: 30, melee_light: 35, dodge: 30, sight: 30, hearing: 30 }, level: 4, bonusPoints: 10, // fighting experience: level 4
    focus: [{ treeId: 'stealth', skill: 'sneaking' }, { treeId: 'melee', skill: 'melee_light' }, { treeId: 'defense', skill: 'dodge' }],
    personality: 'timid', loadout: ['dagger', 'gambeson'], control: 'agent', label: 'a shifty villager',
  },
  patron: {
    id: 'patron', raceId: 'human', generation: 'copy',
    minimums: { unarmed_strike: 20, sight: 20, persuasion: 30 }, level: 2, bonusPoints: 0,
    focus: [{ treeId: 'unarmed', skill: 'unarmed_strike' }, { treeId: 'defense', skill: 'dodge' }, { treeId: 'perception', skill: 'sight' }],
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

// BR9 (Ali, 08/11/2026): a rule names a body type or a race; a block the shape already gives is not repeated on the race
const AMORPHOUS: AccessCond = { kind: 'body', id: 'amorphous' }; // no hands, eyes, ears or voice

export function prototypeLibrary(): Library {
  const lib: Library = structuredClone({
    version: 1,
    status: {},
    skills: SKILLS,
    // Skill tree access (Ali, 08/11/2026, TA1–TA11): each tree's own rule; no rule = open to everyone.
    // shortcut: slime and dragon are body types until the race split (BR answers) lands, then these name the races.
    trees: {
      melee: { id: 'melee', name: 'Combat – Arms', skills: ['melee_light', 'melee_medium', 'melee_heavy'], access: { blockedBy: [AMORPHOUS] } },
      ranged: { id: 'ranged', name: 'Combat – Ranged', skills: ['ranged_light', 'ranged_medium', 'ranged_heavy'], access: { blockedBy: [AMORPHOUS] } },
      unarmed: { id: 'unarmed', name: 'Combat – Unarmed', skills: ['unarmed_strike', 'unarmed_grapple', 'unarmed_improvised'], access: { blockedBy: [AMORPHOUS] } },
      natural: { id: 'natural', name: 'Natural weapons', skills: ['unarmed_natural'], access: { either: [AMORPHOUS, { kind: 'race', id: 'dragon' }] } /* the shape's slam; the dragon's own attacks */ },
      defense: { id: 'defense', name: 'Combat – Defense', skills: ['dodge', 'block', 'endurance'] },
      perception: { id: 'perception', name: 'Perception', skills: ['sight', 'hearing'], access: { blockedBy: [AMORPHOUS] } }, // no eyes or ears (TA6)
      stealth: { id: 'stealth', name: 'Stealth – Conventional', skills: ['sneaking', 'combat_stealth', 'vanishing'] },
      speech: { id: 'speech', name: 'Speech', skills: ['persuasion', 'intimidation', 'barter'], access: { blockedBy: [AMORPHOUS] } },
      swordsman: { id: 'swordsman', name: 'Swordsman', skills: ['feint', 'riposte', 'disarm'], access: { must: [{ kind: 'class', id: 'swordsman' }] } },
      // BR7 (Ali, 08/11/2026): from being a slime, not from a class
      slime_senses: { id: 'slime_senses', name: 'Slime senses', skills: ['tremor'], access: { must: [{ kind: 'race', id: 'slime' }] } },
      tools: { id: 'tools', name: 'Tools (placeholder, OQ-20)', skills: ['lockpicking'], access: { blockedBy: [AMORPHOUS] } },
    },
    classes: {
      swordsman: { id: 'swordsman', name: 'Swordsman', floors: { melee_medium: 25, block: 15 } },
    },
    roles: { sense: { shared: true }, grip: { shared: false }, move: { shared: true }, fly: { shared: true }, strike: { shared: false }, speech: { shared: true } },
    bodyTypes: BODY_TYPES,
    // Healing sources (Ali, 07/11/2026, H1–H6); amounts are placeholders. A source's tier is its row: add rows for more.
    healing: {
      rest: { id: 'rest', name: 'Rest', hpPct: CONFIG.REST_HEAL_PCT, partPct: CONFIG.REST_HEAL_PCT, reach: 'damaged', revivesDead: false, inFight: false },
      clinic: { id: 'clinic', name: 'Clinic', hpPct: CONFIG.CLINIC_HEAL_PCT, partPct: CONFIG.CLINIC_HEAL_PCT, reach: 'crippled', revivesDead: false, inFight: false, placeKinds: ['clinic', 'infirmary'] },
      bandage: { id: 'bandage', name: 'Bandage', hpPct: 10, partPct: 10, reach: 'damaged', revivesDead: false, inFight: true },
      // H12–H14: natural recovery, all the time (fights too): endurance × 0.01 % an hour (0.5% at 50); never Crippled or worse
      passive: { id: 'passive', name: 'Natural recovery', hpPct: 0, partPct: 0, reach: 'damaged', revivesDead: false, inFight: true, hourly: { skill: 'endurance', pctPerPoint: 0.01 } },
    },
    // Game clock (Ali, 07/11/2026, T1): minutes per action; placeholders
    durations: {
      fight_turn: { id: 'fight_turn', name: 'Fight turn', minutes: 0.1 },
      action: { id: 'action', name: 'Move, talk or other action', minutes: 1 },
      trade: { id: 'trade', name: 'Trade', minutes: 10, orders: ['barter'] },
      rest: { id: 'rest', name: 'Rest', minutes: 60, orders: ['rest'] },
      sleep: { id: 'sleep', name: 'Sleep', minutes: 480 },
    },
    // Ali (07/11/2026): humans and elves for now, identical
    // innate perks and quirks per race (Ali, 08/11/2026): lists, empty until chosen
    races: {
      human: { id: 'human', name: 'Human', bodyTypeId: 'humanoid', hpMultiplier: 1, innatePerks: [], innateQuirks: [], tags: ['speaks'] },
      elf: { id: 'elf', name: 'Elf', bodyTypeId: 'humanoid', hpMultiplier: 1, innatePerks: [], innateQuirks: [], tags: ['speaks'] },
      // BR1–BR7 (Ali, 08/11/2026): slime and dragon were body types only; HP multipliers moved here unchanged
      slime: { id: 'slime', name: 'Slime', bodyTypeId: 'amorphous', hpMultiplier: 0.6, innatePerks: [], innateQuirks: [], tags: [] },
      dragon: { id: 'dragon', name: 'Dragon', bodyTypeId: 'winged_quadruped', hpMultiplier: 3, innatePerks: [], innateQuirks: [], tags: [] },
    },
    // Z3 (Ali, 08/11/2026). Outdoor zones' own light is lamps or fires only; the sky adds daylight (T3a).
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
    perks: Object.fromEntries([...PERK_WRITEUPS, ...BOOST_PERKS, ...ALL_PARTS].filter((d) => d.ladder || d.allStep).map(({ ref: _r, skill: _s, place: _p, ...d }) => [d.id, { ...d, built: BUILT_PERKS.has(d.id) }])),
    achievements: {
      // XP by reward level (REWARD_LEVELS, CONFIG.REWARD_XP); per-kind 10/100 and mastery all-100/150 moved up a level (Ali, 07/11/2026). Names grow grander with the feat (Ali, 07/11/2026).
      // after = the lower level it builds on; earning it switches the lower one off (Ali, 08/11/2026).
      first_defeat: { id: 'first_defeat', name: 'First {body_type} Felled', level: 'i', rule: 'defeats', count: 1, by: 'body_type' },
      defeats_10_body_type: { id: 'defeats_10', name: '{body_type}bane', level: 'ii', rule: 'defeats', count: 10, by: 'body_type', after: 'first_defeat' },
      defeats_100_body_type: { id: 'defeats_100', name: 'Scourge of the {body_type} Hordes', level: 'iii', rule: 'defeats', count: 100, by: 'body_type', after: 'defeats_10_body_type' },
      first_defeat_race: { id: 'first_defeat_race', name: 'First of {race}kind Felled', level: 'i', rule: 'defeats', count: 1, by: 'race' },
      defeats_10_race: { id: 'defeats_10_race', name: 'Bane of {race}kind', level: 'ii', rule: 'defeats', count: 10, by: 'race', after: 'first_defeat_race' },
      defeats_100_race: { id: 'defeats_100_race', name: 'Scourge of {race}kind', level: 'iii', rule: 'defeats', count: 100, by: 'race', after: 'defeats_10_race' },
      defeats_10: { id: 'defeats_10', name: 'Blooded Fighter', level: 'i', rule: 'defeats', count: 10 },
      defeats_100: { id: 'defeats_100', name: 'Calamity of a Hundred Blades', level: 'ii', rule: 'defeats', count: 100, after: 'defeats_10' },
      defeats_1000: { id: 'defeats_1000', name: 'Thousand-Slayer, Herald of Ruin', level: 'iii', rule: 'defeats', count: 1000, after: 'defeats_100' },
      // one per tree and mastery step, id <id>:<tree>; not awarded until mastery perks exist
      mastery_50: { id: 'mastery_50', name: 'Adept of {tree}', level: 'ii', rule: 'mastery', count: 50 },
      mastery_100: { id: 'mastery_100', name: 'Ascendant of {tree}', level: 'iii', rule: 'mastery', count: 100, after: 'mastery_50' },
      mastery_150: { id: 'mastery_150', name: 'Transcendent Sovereign of {tree}', level: 'iv', rule: 'mastery', count: 150, after: 'mastery_100' },
    },
  });
  // ST1 (Ali, 08/11/2026): a skill's tree is wherever the trees table lists it, so moving a skill is one edit there
  for (const t of Object.values(lib.trees)) for (const id of t.skills) if (lib.skills[id]) lib.skills[id].treeId = t.id;
  return lib;
}
