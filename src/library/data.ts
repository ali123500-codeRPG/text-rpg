// The prototype library: skills (Part 1 §3), creatures (Part 3), classes and templates (Part 4 §4),
// items (Appendix: prototype item bank), routine bank (Appendix: prototype routine bank). All numbers are placeholders.
import { CONFIG } from '../config';
import type { ActivityDef, CreatureType, ItemDef, ItemEffect, Library, NpcTemplate, Routine, RoutineSet, SituationTag, SkillDef, XpCategory } from '../types';
import { PERK_WRITEUPS } from './perks';
import { BUILT_PERKS } from './builtPerks';

/** XP category from the skill's function (X21); a skill with no deciding function names its own. */
const CATEGORY_OF: Partial<Record<SkillDef['functions'][number], XpCategory>> = {
  melee_attack: 'offensive', ranged_attack: 'offensive', unarmed_attack: 'offensive', defense: 'defensive', hp: 'endurance', notice: 'notice', influence: 'influence',
};
const sk = (id: string, treeId: string, functions: SkillDef['functions'], roles: SkillDef['roles'], playerOpen = true, cue?: 'sight' | 'sound', xpCategory?: XpCategory, tier: SkillDef['tier'] = 'tier_2'): SkillDef =>
  ({ id, treeId, functions, roles, playerOpen, ...(cue ? { cue } : {}), xpCategory: xpCategory ?? CATEGORY_OF[functions[0]] ?? 'misc', tier });

export const SKILLS: Record<string, SkillDef> = Object.fromEntries([
  sk('melee_light', 'melee', ['melee_attack'], ['grip']),
  sk('melee_medium', 'melee', ['melee_attack'], ['grip']),
  sk('melee_heavy', 'melee', ['melee_attack'], ['grip']),
  sk('ranged_light', 'ranged', ['ranged_attack'], ['grip']),
  sk('ranged_medium', 'ranged', ['ranged_attack'], ['grip']),
  sk('ranged_heavy', 'ranged', ['ranged_attack'], ['grip']),
  sk('unarmed_strike', 'unarmed', ['unarmed_attack'], ['grip']),
  sk('unarmed_grapple', 'unarmed', ['unarmed_attack'], ['grip']),
  sk('unarmed_improvised', 'unarmed', ['unarmed_attack'], ['grip']), // fighting with whatever is at hand (Ali, 07/11/2026)
  sk('unarmed_natural', 'unarmed', ['unarmed_attack'], ['strike'], false), // creatures only, in no player tree (Ali, 07/11/2026)
  sk('dodge', 'defense', ['defense'], ['move']),
  sk('block', 'defense', ['defense'], ['grip']),
  sk('endurance', 'defense', ['hp'], []), // hp: endurance sets total HP
  sk('sight', 'perception', ['notice'], ['sense'], true, 'sight'),
  sk('hearing', 'perception', ['notice'], ['sense'], true, 'sound'),
  // Stealth (Ali, 08/11/2026, ST1–ST10): one function, two skills; code picks Combat Stealth in an engagement, Sneaking
  // otherwise. Stealth is movement (the move role), so leg wounds count, except when hiding. Rating: notice / offensive.
  sk('sneaking', 'stealth', ['stealth'], ['move'], true, undefined, 'notice'),
  sk('combat_stealth', 'stealth', ['stealth'], ['move'], true, undefined, 'offensive'),
  sk('vanishing', 'stealth', ['stealth'], ['move'], true, undefined, 'offensive'), // ST11/ST18: breaks established sight
  sk('persuasion', 'speech', ['influence'], []),
  sk('intimidation', 'speech', ['influence'], []),
  sk('barter', 'speech', ['influence'], []),
  sk('feint', 'swordsman', [], ['grip'], true, undefined, 'offensive'),
  sk('riposte', 'swordsman', [], ['grip'], true, undefined, 'offensive'),
  sk('disarm', 'swordsman', [], ['grip'], true, undefined, 'offensive'),
  // slime class skills are tier 0 (Ali, 08/11/2026)
  sk('tremor', 'slime_senses', ['notice'], ['sense'], false, 'sound', undefined, 'tier_0'),
  sk('taste', 'slime_senses', ['notice'], ['sense'], false, undefined, undefined, 'tier_0'),
  // OQ-20 (settled 07/11/2026): placeholder tool skill id, renamed through library aliases later. Not on the creation screen.
  sk('lockpicking', 'tools', [], ['grip'], false),
].map((s) => [s.id, s]));

/** ST21 (Ali, 08/11/2026): situation tags per skill. Light reaches sight and stealth; cover reaches hide and ranged. */
const SITUATION_TAGS_OF: Record<string, SituationTag[]> = {
  melee_light: ['sight'], melee_medium: ['sight'], melee_heavy: ['sight'],
  ranged_light: ['sight', 'ranged'], ranged_medium: ['sight', 'ranged'], ranged_heavy: ['sight', 'ranged'],
  unarmed_strike: ['sight'], unarmed_grapple: ['sight'], unarmed_improvised: ['sight'], unarmed_natural: ['sight'],
  dodge: ['sight'], block: ['sight'], sight: ['sight'],
  sneaking: ['stealth'], combat_stealth: ['stealth'], vanishing: ['stealth', 'hide'],
};
for (const [id, tags] of Object.entries(SITUATION_TAGS_OF)) SKILLS[id].tags = tags;

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
    weapon: { modes: [mode({ id: 'strike', tree: 'melee', class: 'light', skill: 'unarmed_improvised', reach: 0, hands: 1, hitAdj: CONFIG.IMPROVISED_HIT_ADJ })] } },
  { id: 'improvised_medium', kind: 'weapon', name: 'improvised weapon', look: 'something grabbed to fight with', bulk: 2, value: 0, hands: 1, tags: ['improvised'],
    weapon: { modes: [mode({ id: 'strike', tree: 'melee', class: 'medium', skill: 'unarmed_improvised', reach: 0, hands: 1, hitAdj: CONFIG.IMPROVISED_HIT_ADJ })] } },
  { id: 'improvised_heavy', kind: 'weapon', name: 'improvised weapon', look: 'something heavy grabbed to fight with', bulk: 3, value: 0, hands: 2, tags: ['improvised'],
    weapon: { modes: [mode({ id: 'strike', tree: 'melee', class: 'heavy', skill: 'unarmed_improvised', reach: 0, hands: 2, hitAdj: CONFIG.IMPROVISED_HIT_ADJ })] } },
  { id: 'curio', kind: 'misc', name: 'curio', look: 'an odd little object', bulk: 1, value: 1 },
  { id: 'bandage', kind: 'consumable', name: 'bandage', look: 'a roll of linen bandage', bulk: 0, value: 2, stackable: true, consumable: true, heal: 'bandage' },
  { id: 'coin', kind: 'misc', name: 'coin', look: 'coins', bulk: 0, value: 1, stackable: true },
] as ItemDef[]).map((i) => [i.id, i]));

export const CREATURES: Record<string, CreatureType> = {
  humanoid: {
    id: 'humanoid', hpMultiplier: 1, general: { name: 'torso', size: 'normal' },
    naturalAttacks: [{ id: 'punch', tree: 'unarmed', class: 'punch', skill: 'unarmed_strike', reach: 0, hands: 0, name: 'fists' },
      { id: 'grapple', tree: 'unarmed', class: 'grapple', skill: 'unarmed_grapple', reach: 0, hands: 0, name: 'grapple' }],
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
    id: 'slime', creatureTypeId: 'slime', classId: 'slime', generation: 'copy', minimums: { unarmed_natural: 30, tremor: 50, taste: 50 },
    level: 0, bonusPoints: 0, focus: [], personality: 'fearless', control: 'code', label: 'a slime',
    fallback: { attackSkill: 'unarmed_natural' },
  },
  guard: {
    id: 'guard', creatureTypeId: 'humanoid', raceId: 'human', generation: 'copy',
    minimums: { melee_medium: 40, block: 30, dodge: 20, sight: 30, hearing: 30, intimidation: 30, persuasion: 20 },
    level: 2, bonusPoints: 10,
    focus: [{ treeId: 'melee', skill: 'melee_medium' }, { treeId: 'defense', skill: 'block' }, { treeId: 'perception', skill: 'sight' }],
    personality: 'steady', loadout: ['arming_sword', 'mail_hauberk'], control: 'agent', label: 'a village guard',
  },
  trader: {
    id: 'trader', creatureTypeId: 'humanoid', raceId: 'human', generation: 'copy',
    minimums: { sight: 25, hearing: 25, barter: 40, persuasion: 30 }, level: 1, bonusPoints: 0,
    focus: [{ treeId: 'perception', skill: 'hearing' }, { treeId: 'melee', skill: 'melee_light' }, { treeId: 'defense', skill: 'dodge' }],
    personality: 'timid', control: 'code', label: 'the barkeep',
  },
  patron: {
    id: 'patron', creatureTypeId: 'humanoid', raceId: 'human', generation: 'copy',
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
  const lib: Library = structuredClone({
    version: 1,
    status: {},
    skills: SKILLS,
    trees: {
      melee: { id: 'melee', name: 'Combat – Melee', skills: ['melee_light', 'melee_medium', 'melee_heavy'] },
      ranged: { id: 'ranged', name: 'Combat – Ranged', skills: ['ranged_light', 'ranged_medium', 'ranged_heavy'] },
      unarmed: { id: 'unarmed', name: 'Combat – Unarmed', skills: ['unarmed_strike', 'unarmed_grapple', 'unarmed_improvised'] },
      defense: { id: 'defense', name: 'Combat – Defense', skills: ['dodge', 'block', 'endurance'] },
      perception: { id: 'perception', name: 'Perception', skills: ['sight', 'hearing'] },
      stealth: { id: 'stealth', name: 'Stealth', skills: ['sneaking', 'combat_stealth', 'vanishing'] },
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
    // Healing sources (Ali, 07/11/2026, H1–H6); amounts are placeholders. A source's tier is its row: add rows for more.
    healing: {
      rest: { id: 'rest', name: 'Rest', hpPct: CONFIG.REST_HEAL_PCT, partPct: CONFIG.REST_HEAL_PCT, reach: 'damaged', inFight: false },
      clinic: { id: 'clinic', name: 'Clinic', hpPct: CONFIG.CLINIC_HEAL_PCT, partPct: CONFIG.CLINIC_HEAL_PCT, reach: 'crippled', inFight: false, placeKinds: ['clinic', 'infirmary'] },
      bandage: { id: 'bandage', name: 'Bandage', hpPct: 10, partPct: 10, reach: 'damaged', inFight: true },
      // H12–H14: natural recovery, all the time (fights too): endurance × 0.01 % an hour (0.5% at 50); never Crippled or worse
      passive: { id: 'passive', name: 'Natural recovery', hpPct: 0, partPct: 0, reach: 'damaged', inFight: true, hourly: { skill: 'endurance', pctPerPoint: 0.01 } },
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
    races: { human: { id: 'human', name: 'Human', creatureTypeId: 'humanoid' }, elf: { id: 'elf', name: 'Elf', creatureTypeId: 'humanoid' } },
    items: ITEMS,
    templates: TEMPLATES,
    activities: ACTIVITIES,
    routines: ROUTINES,
    routineSets: ROUTINE_SETS,
    // the 20 milestone picks; higher and banked perks stay in PERK_WRITEUPS until they get a milestone
    perks: Object.fromEntries(PERK_WRITEUPS.filter((d) => d.ladder).map(({ ref: _r, skill: _s, place: _p, ...d }) => [d.id, { ...d, built: BUILT_PERKS.has(d.id) }])),
    achievements: {
      // XP by reward level (REWARD_LEVELS, CONFIG.REWARD_XP); per-kind 10/100 and mastery all-100/150 moved up a level (Ali, 07/11/2026). Names grow grander with the feat (Ali, 07/11/2026).
      first_defeat: { id: 'first_defeat', name: 'First {creature} Felled', level: 'i', rule: 'defeats', count: 1, by: 'creature' },
      defeats_10_creature: { id: 'defeats_10', name: '{creature}bane', level: 'ii', rule: 'defeats', count: 10, by: 'creature' },
      defeats_100_creature: { id: 'defeats_100', name: 'Scourge of the {creature} Hordes', level: 'iii', rule: 'defeats', count: 100, by: 'creature' },
      first_defeat_race: { id: 'first_defeat_race', name: 'First of {race}kind Felled', level: 'i', rule: 'defeats', count: 1, by: 'race' },
      defeats_10_race: { id: 'defeats_10_race', name: 'Bane of {race}kind', level: 'ii', rule: 'defeats', count: 10, by: 'race' },
      defeats_100_race: { id: 'defeats_100_race', name: 'Scourge of {race}kind', level: 'iii', rule: 'defeats', count: 100, by: 'race' },
      defeats_10: { id: 'defeats_10', name: 'Blooded Fighter', level: 'i', rule: 'defeats', count: 10 },
      defeats_100: { id: 'defeats_100', name: 'Calamity of a Hundred Blades', level: 'ii', rule: 'defeats', count: 100 },
      defeats_1000: { id: 'defeats_1000', name: 'Thousand-Slayer, Herald of Ruin', level: 'iii', rule: 'defeats', count: 1000 },
      // one per tree and mastery step, id <id>:<tree>; not awarded until mastery perks exist
      mastery_50: { id: 'mastery_50', name: 'Adept of {tree}', level: 'ii', rule: 'mastery', count: 50 },
      mastery_100: { id: 'mastery_100', name: 'Ascendant of {tree}', level: 'iii', rule: 'mastery', count: 100 },
      mastery_150: { id: 'mastery_150', name: 'Transcendent Sovereign of {tree}', level: 'iv', rule: 'mastery', count: 150 },
    },
  });
  // ST1 (Ali, 08/11/2026): a skill's tree is wherever the trees table lists it, so moving a skill is one edit there
  for (const t of Object.values(lib.trees)) for (const id of t.skills) if (lib.skills[id]) lib.skills[id].treeId = t.id;
  return lib;
}
