// The prototype library: skills (Part 1 §3), creatures (Part 3), classes and templates (Part 4 §4),
// items (Appendix: prototype item bank), routine bank (Appendix: prototype routine bank). All numbers are placeholders.
import { CONFIG } from '../config';
import type { ActivityDef, CreatureType, ItemDef, ItemEffect, Library, NpcTemplate, Routine, RoutineSet, SkillDef } from '../types';

const sk = (id: string, treeId: string, functions: SkillDef['functions'], roles: SkillDef['roles'], playerOpen = true, cue?: 'sight' | 'sound'): SkillDef =>
  ({ id, treeId, functions, roles, playerOpen, ...(cue ? { cue } : {}) });

export const SKILLS: Record<string, SkillDef> = Object.fromEntries([
  sk('melee_light', 'melee', ['melee_attack'], ['grip']),
  sk('melee_medium', 'melee', ['melee_attack'], ['grip']),
  sk('melee_heavy', 'melee', ['melee_attack'], ['grip']),
  sk('ranged_light', 'ranged', ['ranged_attack'], ['grip']),
  sk('ranged_medium', 'ranged', ['ranged_attack'], ['grip']),
  sk('ranged_heavy', 'ranged', ['ranged_attack'], ['grip']),
  sk('unarmed_strike', 'unarmed', ['unarmed_attack'], ['grip']),
  sk('unarmed_grapple', 'unarmed', ['unarmed_attack'], ['grip']),
  sk('unarmed_natural', 'unarmed', ['unarmed_attack'], ['strike'], false), // creatures only for now (Ali, 07/11/2026)
  sk('dodge', 'defense', ['defense'], ['move']),
  sk('block', 'defense', ['defense'], ['grip']),
  sk('endurance', 'defense', [], []),
  sk('sight', 'perception', ['notice'], ['sense'], true, 'sight'),
  sk('hearing', 'perception', ['notice'], ['sense'], true, 'sound'),
  sk('persuasion', 'speech', ['influence'], []),
  sk('intimidation', 'speech', ['influence'], []),
  sk('barter', 'speech', ['influence'], []),
  sk('feint', 'swordsman', [], ['grip']),
  sk('riposte', 'swordsman', [], ['grip']),
  sk('disarm', 'swordsman', [], ['grip']),
  sk('tremor', 'slime_senses', ['notice'], ['sense'], false, 'sound'),
  sk('taste', 'slime_senses', ['notice'], ['sense'], false),
  // OQ-20 build default: placeholder tool skill id, renamed through library aliases later. Not on the creation screen.
  sk('lockpicking', 'tools', [], ['grip'], false),
].map((s) => [s.id, s]));

const mode = (m: Partial<import('../types').AttackMode> & Pick<import('../types').AttackMode, 'id' | 'tree' | 'class' | 'reach' | 'hands'>) => m;
const KIT = (skill = '$mode'): ItemEffect => ({ kind: 'skill', skill, value: 25, active: 'held', scope: 'withItem', kit: true });
/** armor numbers come from CONFIG (one source, Part 5 armor table) */
const ARMOR = (w: 'light' | 'medium' | 'heavy') => ({ reduction: CONFIG.ARMOR_PROTECTION[w][0], multiplier: CONFIG.ARMOR_PROTECTION[w][1], weight: w });
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
    weapon: { modes: [mode({ id: 'strike', tree: 'melee', class: 'light', reach: 0, hands: 1, hitAdj: CONFIG.IMPROVISED_HIT_ADJ })] } },
  { id: 'improvised_medium', kind: 'weapon', name: 'improvised weapon', look: 'something grabbed to fight with', bulk: 2, value: 0, hands: 1, tags: ['improvised'],
    weapon: { modes: [mode({ id: 'strike', tree: 'melee', class: 'medium', reach: 0, hands: 1, hitAdj: CONFIG.IMPROVISED_HIT_ADJ })] } },
  { id: 'improvised_heavy', kind: 'weapon', name: 'improvised weapon', look: 'something heavy grabbed to fight with', bulk: 3, value: 0, hands: 2, tags: ['improvised'],
    weapon: { modes: [mode({ id: 'strike', tree: 'melee', class: 'heavy', reach: 0, hands: 2, hitAdj: CONFIG.IMPROVISED_HIT_ADJ })] } },
  { id: 'curio', kind: 'misc', name: 'curio', look: 'an odd little object', bulk: 1, value: 1 },
  { id: 'coin', kind: 'misc', name: 'coin', look: 'coins', bulk: 0, value: 1, stackable: true },
] as ItemDef[]).map((i) => [i.id, i]));

export const CREATURES: Record<string, CreatureType> = {
  humanoid: {
    id: 'humanoid', hpMultiplier: 1, general: { name: 'torso', size: 'normal' },
    naturalAttacks: [{ id: 'punch', tree: 'unarmed', class: 'punch', skill: 'unarmed_strike', reach: 0, hands: 0, name: 'fists' }],
    parts: [
      { id: 'head', size: 'small', impact: 'essential', roles: ['sense'], adjacent: ['general', 'neck'] },
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
  slime: {
    id: 'slime', hpMultiplier: 0.6, general: { name: 'body', size: 'normal' },
    naturalAttacks: [{ id: 'slam', tree: 'unarmed', class: 'slam', skill: 'unarmed_natural', reach: 0, hands: 0, name: 'slam' }],
    parts: [],
    fallback: { attackSkill: 'unarmed_natural' },
  },
  dragon: {
    id: 'dragon', hpMultiplier: 3, general: { name: 'body', size: 'big' },
    naturalAttacks: [],
    parts: [
      { id: 'head', size: 'normal', impact: 'essential', roles: ['sense', 'strike'] },
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
    id: 'slime', creatureTypeId: 'slime', classId: 'slime', generation: 'copy', minimums: { unarmed_natural: 30 },
    level: 0, bonusPoints: 0, focus: [], personality: 'fearless', control: 'code', label: 'a slime',
    fallback: { attackSkill: 'unarmed_natural' },
  },
  guard: {
    id: 'guard', creatureTypeId: 'humanoid', generation: 'copy',
    minimums: { melee_medium: 40, block: 30, dodge: 20, sight: 30, hearing: 30, intimidation: 30, persuasion: 20 },
    level: 2, bonusPoints: 10,
    focus: [{ treeId: 'melee', skill: 'melee_medium' }, { treeId: 'defense', skill: 'block' }, { treeId: 'perception', skill: 'sight' }],
    personality: 'steady', loadout: ['arming_sword', 'mail_hauberk'], control: 'agent', label: 'a village guard',
  },
  trader: {
    id: 'trader', creatureTypeId: 'humanoid', generation: 'copy',
    minimums: { sight: 25, hearing: 25, barter: 40, persuasion: 30 }, level: 1, bonusPoints: 0,
    focus: [{ treeId: 'perception', skill: 'hearing' }, { treeId: 'melee', skill: 'melee_light' }, { treeId: 'defense', skill: 'dodge' }],
    personality: 'timid', control: 'code', label: 'the barkeep',
  },
  patron: {
    id: 'patron', creatureTypeId: 'humanoid', generation: 'copy',
    minimums: { unarmed_strike: 20, sight: 20, persuasion: 30 }, level: 1, bonusPoints: 0,
    focus: [{ treeId: 'unarmed', skill: 'unarmed_strike' }, { treeId: 'defense', skill: 'dodge' }, { treeId: 'perception', skill: 'sight' }],
    personality: 'timid', control: 'code', label: 'a tavern patron',
  },
};

const act = (id: string, look: string, attention: ActivityDef['attention'], noise: ActivityDef['noise'], visibility: ActivityDef['visibility']): ActivityDef =>
  ({ id, look, attention, noise, visibility });
export const ACTIVITIES: Record<string, ActivityDef> = Object.fromEntries([
  act('stand_watch', 'keeping watch', 'alert', 0, 2),
  act('walk', 'walking', 'normal', 1, 2),
  act('work', 'hard at work', 'normal', 2, 2),
  act('tend_counter', 'tending the counter', 'normal', 1, 2),
  act('drink', 'nursing a drink', 'distracted', 1, 2),
  act('chat', 'chatting', 'distracted', 2, 2),
  act('sleep', 'asleep', 'asleep', 1, 1),
  act('rest', 'resting', 'distracted', 0, 1),
  act('cower', 'keeping out of sight', 'alert', 0, 1),
  act('ooze', 'oozing across the grass', 'normal', 1, 2),
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
  set('companion', "The player's band; not chosen by tags", [], [], [], {}, ['follow', 'follow_alert', 'wait', 'wait_alert']),
  set('slime_wander', 'A slime roaming the field outside the gate', ['field'], ['creature'], ['any'], { route: r('across the field, in order'), post: z('where it settles') }, ['roam_field', 'roam_field_alert']),
].map((s) => [s.id, s]));

export function prototypeLibrary(): Library {
  return structuredClone({
    version: 1,
    status: {},
    skills: SKILLS,
    trees: {
      melee: { id: 'melee', name: 'Combat – Melee', skills: ['melee_light', 'melee_medium', 'melee_heavy'] },
      ranged: { id: 'ranged', name: 'Combat – Ranged', skills: ['ranged_light', 'ranged_medium', 'ranged_heavy'] },
      unarmed: { id: 'unarmed', name: 'Combat – Unarmed', skills: ['unarmed_strike', 'unarmed_grapple', 'unarmed_natural'] },
      defense: { id: 'defense', name: 'Combat – Defense', skills: ['dodge', 'block', 'endurance'] },
      perception: { id: 'perception', name: 'Perception', skills: ['sight', 'hearing'] },
      speech: { id: 'speech', name: 'Speech', skills: ['persuasion', 'intimidation', 'barter'] },
      swordsman: { id: 'swordsman', name: 'Swordsman', skills: ['feint', 'riposte', 'disarm'], classId: 'swordsman' },
      slime_senses: { id: 'slime_senses', name: 'Slime senses', skills: ['tremor', 'taste'], classId: 'slime' },
      tools: { id: 'tools', name: 'Tools (placeholder, OQ-20)', skills: ['lockpicking'] },
    },
    classes: {
      swordsman: { id: 'swordsman', name: 'Swordsman', treeId: 'swordsman', floors: { melee_medium: 25, block: 15 } },
      slime: { id: 'slime', name: 'Slime', treeId: 'slime_senses', floors: {} },
    },
    roles: { sense: { shared: true }, grip: { shared: false }, move: { shared: true }, fly: { shared: true }, strike: { shared: false } },
    creatures: CREATURES,
    items: ITEMS,
    templates: TEMPLATES,
    activities: ACTIVITIES,
    routines: ROUTINES,
    routineSets: ROUTINE_SETS,
    perks: {},
  });
}
