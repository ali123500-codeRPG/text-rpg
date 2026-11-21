// The routine bank: activities, routines and routine sets (the library viewer shows every row). prototypeLibrary() in
// data.ts reads them from here.
import { FU, ZK } from './tableIds';
import type { ActivityDef, Routine, RoutineSet } from '../types';

const act = (id: string, look: string, attention: ActivityDef['attention'], noise: ActivityDef['noise'], visibility: ActivityDef['visibility']): ActivityDef =>
  ({ id, look, attention, noise, visibility });
/** PC1: each furniture kind's size, [length, width, height] in metres (placeholders from common furniture: a bar counter
 * about 1.1 m high, a table 0.75 m, a barrel 1 m, a cart bed about 1 m, a well's wall 0.9 m) */
export const FURNITURE_SIZE_M: Record<string, [number, number, number]> = {
  [FU.counter]: [3, 0.6, 1.1], [FU.hearth]: [1.5, 0.6, 1], [FU.table]: [1.5, 0.8, 0.75], [FU.bench]: [1.5, 0.35, 0.45],
  [FU.bed]: [2, 0.9, 0.5], [FU.barrels]: [1.2, 0.6, 1], [FU.shelves]: [1, 0.4, 1.8], [FU.crates]: [1, 1, 1], [FU.sacks]: [1, 0.6, 0.6],
  [FU.anvil]: [0.6, 0.3, 0.8], [FU.forge]: [1.2, 1, 1], [FU.rack]: [1.5, 0.4, 1.6], [FU.brazier]: [0.5, 0.5, 0.9],
  [FU.woodpile]: [2, 1, 1.2], [FU.water_barrel]: [0.6, 0.6, 1], [FU.stool]: [0.35, 0.35, 0.45], [FU.chair]: [0.45, 0.45, 0.9],
  [FU.cupboard]: [1, 0.5, 1.8], [FU.well]: [1.5, 1.5, 0.9], [FU.cart]: [1.5, 1, 1], [FU.fence]: [3, 0.1, 1.2], [FU.rail]: [3, 0.1, 1],
  [FU.altar]: [1.5, 0.8, 1], [FU.other]: [0.5, 0.5, 0.5],
};
/** FR2: furniture each zone kind gets unless a layout or the Weaver lists its own (colour, mostly: FR1) */
export const KIND_FURNITURE: Record<string, import('../types').PlanFurniture[]> = {
  [ZK.room]: [{ kind: FU.table, name: 'table' }, { kind: FU.bench, name: 'bench', at: 'w' }],
  [ZK.cellar]: [{ kind: FU.barrels, name: 'barrels', at: 'n' }, { kind: FU.sacks, name: 'sacks', at: 'e' }],
  [ZK.yard]: [{ kind: FU.woodpile, name: 'woodpile', at: 'e' }, { kind: FU.water_barrel, name: 'rain barrel', at: 'nw' }],
  [ZK.square]: [{ kind: FU.well, name: 'well' }],
  [ZK.street]: [{ kind: FU.cart, name: 'handcart', at: 's' }],
};
export const ACTIVITIES: Record<string, ActivityDef> = Object.fromEntries([
  act('stand_watch', 'keeping watch', 'alert', 'silent', 'normal'),
  act('search', 'searching', 'alert', 'quiet', 'normal'), // SE16: an alert sweep, or a careful patrol, searches at each stop
  act('walk', 'walking', 'normal', 'quiet', 'normal'),
  act('work', 'hard at work', 'normal', 'normal', 'normal'),
  act('tend_counter', 'tending the counter', 'normal', 'quiet', 'normal'),
  act('drink', 'nursing a drink', 'distracted', 'quiet', 'normal'),
  act('chat', 'chatting', 'distracted', 'normal', 'normal'),
  act('sleep', 'asleep', 'asleep', 'quiet', 'low'),
  act('lie_awake', 'lying awake', 'distracted', 'quiet', 'low'), // BF65: on a sleep step but awake (woken, or not yet dropped off)
  act('eat', 'eating', 'distracted', 'quiet', 'normal'),
  act('rest', 'resting', 'distracted', 'silent', 'low'),
  act('cower', 'keeping out of sight', 'alert', 'silent', 'close'), // NV4
  act('cowering', 'cowering where they stand', 'alert', 'quiet', 'normal'), // BF37: a broken nerve, no move and no attack
  act('ooze', 'oozing across the grass', 'normal', 'quiet', 'normal'),
  act('prowl', 'keeping to the shadows', 'alert', 'silent', 'close'), // NV4
  act('lie_in_wait', 'lying in wait', 'alert', 'silent', 'close'), // NR24: a bandit hidden by the road
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
  // SE16: a careful patrol walks the same beat at the same pace, but searches each stop for anyone lying in wait while calm
  timed(sched('careful_patrol', 'Walks the beat by day, searching each stop for anyone lying in wait; drinks in the evening, sleeps at night', true, [['route', 'short', 'search']], 'search_route_alert', { ...CALL_HELP }), ...OFF_DUTY),
  timed(sched('night_careful_patrol', 'Walks the beat from dusk to dawn, searching each stop for anyone lying in wait; sleeps by day', true, [['route', 'short', 'search']], 'search_route_alert', { ...CALL_HELP }), DAY_SLEEP),
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
  // NR24: a bandit keeps the camp: idles and talks there by day, drinks in the evening, sleeps at night; on alert, defends it
  timed(sched('keep_camp', 'Idles and talks at the camp by day; drinks in the evening, sleeps at night', true, [['post', 'medium', 'rest'], ['post', 'short', 'chat']], 'defend_camp_alert', { ...CALL_HELP }), ...OFF_DUTY),
  sched('defend_camp_alert', 'Stands to at the camp, on alert', true, [['post', 'long', 'stand_watch']], undefined, null),
  // NR24: a bandit lies hidden at a road spot from dawn to dusk and rushes out onto the road at whoever passes
  { ...timed(sched('ambush_road', 'Lies hidden beside the road from dawn to dusk; back at camp in the evening, asleep at night', true, [['hide', 'long', 'lie_in_wait']], 'spring_ambush_alert', { ...CALL_HELP }), ...OFF_DUTY), posture: 'stealthy' as const },
  sched('spring_ambush_alert', 'Rushes out onto the road, on alert', true, [['road', 'long', 'stand_watch']], undefined, null),
  // RT9: a slime settles for the evening and night
  timed(sched('roam_field', 'Oozes across the field by day, then settles; still at night', true, [['route', 'short', 'ooze'], ['post', 'medium', 'rest']], 'roam_field_alert', null),
    at(['evening', 'night'], [['post', 'long', 'rest']])),
  sched('roam_field_alert', 'Sweeps the field fast on alert; never flees', true, [['route', 'brief', 'ooze']], undefined, null),
  // D-230 a: a watchdog keeps its post day and night and barks at any stranger it senses (barkCalls)
  { ...sched('watchdog_post', 'Keeps watch at its post day and night, barking at strangers', true, [['post', 'long', 'stand_watch']], 'watchdog_alert', null), barks: true as const },
  { ...sched('watchdog_alert', 'Holds its post on alert, barking at strangers', true, [['post', 'long', 'stand_watch']], undefined, null), barks: true as const },
].map((r) => [r.id, r]));

const set = (id: string, brief: string, place: string[], role: string[], time: RoutineSet['tags']['time'], slots: RoutineSet['slots'], routines: string[]): RoutineSet =>
  ({ id, brief, tags: { place, role, time, event: ['ordinary'] }, slots, routines });
/** NW4: the kinds that lead onward (a street, square, gate, field or woods never ends in a wall); yards and rooms may */
export const ONWARD_KINDS = new Set<string>([ZK.street, ZK.square, ZK.gate, ZK.field, ZK.woods]);
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
  set('careful_patrol_guard', 'A careful guard walking a beat by day, searching each stop for an ambush', ['gate', 'street'], ['guard'], ['any'], { route: r("the beat's stops, in order"), seat: SEAT, bed: BED }, ['careful_patrol', 'search_route_alert', 'wait', 'wait_alert']),
  set('night_careful_patrol_guard', 'A careful guard walking a beat through the night, searching each stop for an ambush', ['gate', 'street'], ['guard'], ['any'], { route: r("the beat's stops, in order"), bed: BED }, ['night_careful_patrol', 'search_route_alert', 'wait', 'wait_alert']),
  set('barkeep', 'Runs the bar', ['tavern'], ['trader'], ['any'], { counter: z('behind the bar'), refuge: z('back room or cellar'), bed: BED }, ['tend_bar', 'flee_to_refuge_alert', 'wait', 'wait_alert']),
  set('patron', 'A customer drinking', ['tavern'], ['patron'], ['any'], { seat: z('where they sit'), refuge: z('where they would hide'), exit: z('the way out'), bed: BED }, ['drink_at_seat', 'flee_to_refuge_alert', 'leave_by_exit', 'wait', 'wait_alert']),
  set('sleeper', 'A guest staying the night', ['tavern'], ['sleeper'], ['any'], { bed: z('their bed'), refuge: z('where they would hide'), seat: SEAT, exit: OUT }, ['sleep_in_bed', 'flee_to_refuge_alert', 'wait', 'wait_alert']),
  set('street_worker', 'A labourer or stallholder at work', ['street'], ['worker'], ['any'], { work: z('the work spot'), refuge: z('home or a doorway'), bed: BED }, ['work_shift', 'flee_to_refuge_alert', 'wait', 'wait_alert']),
  set('thief', 'A thief prowling for an easy mark', ['street', 'tavern'], ['thief'], ['any'], { route: r('the stops it prowls, in order'), refuge: z('where it lies low') }, ['prowl', 'lie_low_alert', 'wait', 'wait_alert']),
  // NR24: bandits keep a camp and lie in wait by a road; a camp's lookout takes the gate_guard set, posted at the camp's edge
  set('bandit_camp', 'A bandit at the gang\'s camp', ['camp', 'woods'], ['bandit'], ['any'], { post: z('the camp'), seat: SEAT, bed: BED }, ['keep_camp', 'defend_camp_alert', 'wait', 'wait_alert']),
  set('bandit_ambush', 'A bandit lying in wait by a road', ['road', 'woods'], ['bandit'], ['any'], { hide: z('where it hides beside the road'), road: z('the road it rushes onto'), seat: SEAT, bed: BED }, ['ambush_road', 'spring_ambush_alert', 'wait', 'wait_alert']),
  set('companion', "The player's band; not chosen by tags", [], [], [], {}, ['follow', 'follow_alert', 'wait', 'wait_alert']),
  set('watchdog', 'A dog kept to guard a yard, gate or camp; barks at strangers', ['gate', 'street', 'camp', 'yard'], ['watchdog'], ['any'], { post: z('where the dog keeps watch') }, ['watchdog_post', 'watchdog_alert']),
  set('slime_wander', 'A slime roaming the field outside the gate', ['field'], ['beast'], ['any'], { route: r('across the field, in order'), post: z('where it settles') }, ['roam_field', 'roam_field_alert']),
].map((s) => [s.id, s]));
