// JSON schema checks for the six agent outputs. Each validator returns a clean copy built from known keys only
// (deny-by-default: an unknown key such as a Parser "aimed" never survives) plus the error list.
// A missing nullable field reads as null; only a missing required field fails the answer (CS9).
import type { GoalOps, GoalStep, StepEnd, PlanFurniture, AgreementMade, CheckinAnswer, Grade, Intent, MoveSpot, NarratorOutput, PlanBarrier, QuestEnd, SparMade, Stance, PlannerOutput, ResponderOutput, StagePlan, VoiceOutput } from '../types';
import { GOAL_KINDS, GRADES, IMPROVISED_BASES, NPC_ACTIONS, PARSER_ACTIONS, type ImprovisedBase } from '../types';
import { skillIdOf } from '../library/skillIds';
import { SKILL_NAMES } from '../library/skillNames';
import { CHASE_RANGES, COVER, FRAGILITY, LIGHT, QUALITY_LEVELS, STANCES, TACTICS, TIERS, TIME_OF_DAY, TRAVEL_PACES, type FragilityKey, type QualityKey, type Scale, type TimeOfDay, type TravelPaceKey } from '../scales';
import { qualityOf } from '../ruleset/quality';

type V<T = unknown> = (v: unknown, path: string, errs: string[]) => T;
export type Checked<T> = { value: T; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const str: V<string> = (v, p, e) => (typeof v === 'string' ? v : (e.push(`${p}: expected string`), ''));
const num: V<number> = (v, p, e) => (typeof v === 'number' && Number.isFinite(v) ? v : (e.push(`${p}: expected number`), 0));
const bool: V<boolean> = (v, p, e) => (typeof v === 'boolean' ? v : (e.push(`${p}: expected boolean`), false));
const any: V<unknown> = (v) => v;
const oneOf = <T extends string | number>(vals: readonly T[]): V<T> => (v, p, e) =>
  vals.includes(v as T) ? (v as T) : (e.push(`${p}: expected one of ${vals.join(', ')}`), vals[0]);
/** a skill an agent named: its ID, display name or code alias, read as the ID (skill IDs are SK + a number) */
const skillStr: V<string> = (v, p, e) => { const s = str(v, p, e); return s ? skillIdOf(s, SKILL_NAMES) : s; };
/** missing (undefined) or null both read as null */
const nul = <T>(c: V<T>): V<T | null> => (v, p, e) => (v === undefined || v === null ? null : c(v, p, e));
const arr = <T>(c: V<T>): V<T[]> => (v, p, e) => (Array.isArray(v) ? v.map((x, i) => c(x, `${p}[${i}]`, e)) : (e.push(`${p}: expected array`), []));
/** optional array: absent stays absent */
const optArr = <T>(c: V<T>): V<T[] | undefined> => (v, p, e) => (v === undefined || v === null ? undefined : arr(c)(v, p, e));
const record = <T>(c: V<T>): V<Record<string, T>> => (v, p, e) =>
  isObj(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, c(x, `${p}.${k}`, e)])) : (e.push(`${p}: expected object`), {});
function obj<T>(shape: { [K in keyof T]: V<T[K]> }, optional: (keyof T)[] = []): V<T> {
  return (v, p, e) => {
    if (!isObj(v)) {
      e.push(`${p}: expected object`);
      return {} as T;
    }
    const out = {} as T;
    for (const k of Object.keys(shape) as (keyof T)[]) {
      if (optional.includes(k) && (v[k as string] === undefined || v[k as string] === null)) continue;
      out[k] = shape[k](v[k as string], `${p}.${String(k)}`, e);
    }
    return out;
  };
}
const run = <T>(c: V<T>) => (v: unknown): Checked<T> => {
  const errors: string[] = [];
  const value = c(v, '$', errors);
  return { value, errors };
};

const VOLUME = oneOf(['whisper', 'normal', 'shout'] as const);
/** BF35: a follow's distance: metres, or melee / range */
const KEEP: V<NonNullable<MoveSpot['keep']>> = (v, p, e) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : v === 'melee' || v === 'range' ? v : (e.push(`${p}: expected metres, "melee" or "range"`), 'melee'));
const gearOp = obj<{ op: 'draw' | 'stow' | 'swap' | 'wear_acc' | 'remove_acc' | 'pick_up' | 'summon' | 'set_down'; item: string; from?: string; into?: string; qty?: number }>(
  { op: oneOf(['draw', 'stow', 'swap', 'wear_acc', 'remove_acc', 'pick_up', 'summon', 'set_down'] as const), item: str, from: str, into: str, qty: num },
  ['from', 'into', 'qty'],
);
const GEAR = nul(arr(gearOp));
const STANCE = nul(obj<{ toward: string; step: 'friendlier' | 'colder' }>({ toward: str, step: oneOf(['friendlier', 'colder'] as const) }));

const intent = obj<Intent>({
  move: nul(obj<{ toZone: string; after?: boolean; pace?: TravelPaceKey; spot?: MoveSpot | null; jump?: boolean; behind?: boolean }>({ toZone: str, after: bool, jump: bool, behind: bool, pace: oneOf(TRAVEL_PACES.keys),
    spot: nul(obj<MoveSpot>({ near: str, awayFrom: str, side: str, follow: bool, keep: KEEP }, ['near', 'awayFrom', 'side', 'follow', 'keep'])) }, ['after', 'pace', 'spot', 'jump', 'behind'])),
  action: nul(obj<NonNullable<Intent['action']>>({
    type: oneOf(PARSER_ACTIONS),
    skill: (v, p, e) => (v === null || v === undefined ? '' : skillStr(v, p, e)),
    target: nul(str),
    targetPart: nul(str),
    aimed: (v, p, e) => (v === undefined || v === null ? undefined : bool(v, p, e)) as boolean,
    item: nul(str),
    qty: num,
    for: nul(str),
    mode: nul(str),
    approach: (v, p, e) => (v === null || v === undefined ? '' : str(v, p, e)),
    stance: (v, p, e) => (v === null || v === undefined ? 'normal' : oneOf(['careful', 'normal', 'reckless'] as const)(v, p, e)),
    improvised: (v, p, e) => (v === null || v === undefined ? null
      : obj<{ base: ImprovisedBase; name: string }>({ base: oneOf(IMPROVISED_BASES), name: str })(v, p, e)),
    demand: (v, p, e) => (v === null || v === undefined ? null : oneOf(['yield'] as const)(v, p, e)),
  }, ['qty', 'for', 'demand', 'aimed'])),
  perkMove: nul(obj<{ perk: string; target: string | null }>({ perk: str, target: nul(str) })),
  way: nul(obj<NonNullable<Intent['way']>>({ toZone: str, op: oneOf(['lock', 'unlock', 'bar', 'unbar', 'open', 'shut'] as const) })),
  gear: GEAR,
  spoken: nul(str),
  volume: VOLUME,
  addressees: nul(arr(str)),
  deferred: (v, p, e) => (v === undefined || v === null ? [] : arr(str)(v, p, e)),
  clarify: nul(str),
  answers: (v, p, e) => (v === undefined || v === null ? undefined : arr(str)(v, p, e)) as string[], // BG-228: replies to the clarify, shown as buttons
  yields: (v, p, e) => (v === undefined || v === null ? undefined : bool(v, p, e)) as boolean,
  letsSearch: (v, p, e) => (v === undefined ? undefined : nul(str)(v, p, e)) as string | null,
  standDown: (v, p, e) => (v === undefined ? undefined : nul(str)(v, p, e)) as string | null, // TF11
  look: (v, p, e) => (v === undefined || v === null ? undefined : oneOf(['stats', 'inv'] as const)(v, p, e)) as 'stats' | 'inv',
}, ['perkMove', 'yields', 'letsSearch', 'standDown', 'way', 'volume', 'look', 'answers']);

const npcAction = obj<PlannerOutput['action']>({
  type: oneOf(NPC_ACTIONS),
  target: nul(str),
  skill: nul(skillStr),
  targetPart: nul(str),
  aimed: (v, p, e) => (v === undefined || v === null ? false : bool(v, p, e)),
  defense: nul(oneOf(['dodge', 'block', 'parry'] as const)),
  item: nul(str),
  qty: num,
  mode: nul(str),
  intent: (v, p, e) => (v === undefined || v === null ? '' : str(v, p, e)),
}, ['qty']);

const trigger = obj<{ id: string; ownerId: string; when: unknown; then: unknown; once: boolean }>(
  { id: str, ownerId: str, when: any, then: any, once: (v, p, e) => (v === undefined ? true : bool(v, p, e)) },
  ['ownerId'],
);
const planUpdate = nul(obj<NonNullable<PlannerOutput['planUpdate']>>({
  goal: str,
  steps: arr(str),
  // the engine drops any trigger it can't parse (Hidden state persistence); we check only the envelope
  triggers: (v, p, e) => (v === undefined || v === null ? [] : (arr(trigger)(v, p, e) as unknown as NonNullable<PlannerOutput['planUpdate']>['triggers'])),
  memoryNote: (v, p, e) => (v === undefined || v === null ? undefined : str(v, p, e)) as string,
  routine: nul(str),
}, ['memoryNote']));
const dialogue = nul(obj<NonNullable<PlannerOutput['dialogue']>>({ line: str, volume: VOLUME }));

const memory = nul(obj<NonNullable<PlannerOutput['memory']>>({
  add: (v, p, e) => (v === undefined || v === null ? [] : arr(str)(v, p, e)),
  drop: (v, p, e) => (v === undefined || v === null ? [] : arr(num)(v, p, e)),
}));
const nNum = nul(num), nStr = nul(str);
type Job = NonNullable<AgreementMade['job']>;
const job = obj<Job>({
  line: str,
  goal: obj<Job['goal']>({ kind: oneOf(GOAL_KINDS), target: nStr, count: nNum, item: nStr, qty: nNum, to: nStr }, ['target', 'count', 'item', 'qty', 'to']),
  pay: nul(obj<NonNullable<Job['pay']>>({ coin: nNum, item: nStr, qty: nNum }, ['coin', 'item', 'qty'])),
  due: nul(obj<NonNullable<Job['due']>>({ days: num, by: nul((v, p, e) => TIME_OF_DAY.keyOf(v) ?? (e.push(`${p}: expected one of ${TIME_OF_DAY.keys.join(', ')}`), null)) }, ['by'])),
  after: nStr,
}, ['pay', 'due', 'after']);
const agreement = nul(obj<AgreementMade>({ with: str, text: str, job }, ['job']));
const questEnd = nul(obj<QuestEnd>({ id: str, outcome: oneOf(['done', 'abandoned', 'called_off'] as const) }));
const endAgreements = (v: unknown, p: string, e: string[]) => (v === undefined || v === null ? [] : arr(obj<NonNullable<PlannerOutput['endAgreements']>[number]>({ id: str, outcome: oneOf(['done', 'broken'] as const) }))(v, p, e));
const spar = nul(obj<SparMade>({ sides: arr(arr(str)), cruel: bool }, ['cruel']));
const yields = (v: unknown, p: string, e: string[]) => (v === undefined || v === null ? undefined : bool(v, p, e)) as boolean;
const acceptYield = yields;
const letsSearch = (v: unknown, p: string, e: string[]) => (v === undefined ? undefined : nul(str)(v, p, e)) as string | null; // BF16
const spare = yields; // D-239
const standDown = yields; // TF15
const MEMORY_KEYS = ['memory', 'agreement', 'endAgreements', 'questEnd', 'spar', 'yields', 'letsSearch', 'acceptYield', 'standDown', 'spare', 'headTo', 'lead', 'goals', 'steps'] as ('memory' | 'agreement' | 'endAgreements' | 'questEnd' | 'spar' | 'yields' | 'letsSearch' | 'acceptYield' | 'standDown' | 'spare' | 'headTo' | 'lead' | 'goals' | 'steps')[];
const headTo = nStr; // NW2
// UG5/UG16: a goal holder's goals met, failed or added, and its next steps
const goalOps = nul(obj<GoalOps>({
  met: (v, p, e) => (v === undefined || v === null ? [] : arr(num)(v, p, e)),
  failed: (v, p, e) => (v === undefined || v === null ? [] : arr(num)(v, p, e)),
  add: (v, p, e) => (v === undefined || v === null ? [] : arr(obj<GoalOps['add'][number]>({ text: str, about: arr(str) }, ['about']))(v, p, e)),
}));
const timeOfDay: V<TimeOfDay> = (v, p, e) => TIME_OF_DAY.keyOf(v) ?? (e.push(`${p}: expected one of ${TIME_OF_DAY.keys.join(', ')}`), TIME_OF_DAY.keys[0]);
const goalStep = obj<GoalStep>({ go: str, lead: str, routine: str, wait: (v, p, e) => (bool(v, p, e) || undefined) as true, until: obj<StepEnd>({ at: timeOfDay, arrival: str }, ['at', 'arrival']) }, ['go', 'lead', 'routine', 'wait', 'until']);
const steps = nul(arr(goalStep));
const lead = nStr; // BF4
const npcMove = nul(obj<{ toZone: string; after?: boolean; speakAt?: 'end' }>({ toZone: str, after: bool, speakAt: oneOf(['end'] as const) }, ['after', 'speakAt']));
const planner = obj<PlannerOutput>({ action: npcAction, move: npcMove, dialogue, gear: GEAR, stance: STANCE, planUpdate, memory, agreement, endAgreements, questEnd, spar, yields, letsSearch, acceptYield, standDown, spare, headTo, lead, goals: goalOps, steps }, ['move', ...MEMORY_KEYS]);
const responder = obj<ResponderOutput>({
  action: npcAction, move: npcMove, dialogue, gear: GEAR, stance: STANCE, planUpdate, memory, agreement, endAgreements, questEnd, spar, yields, letsSearch, acceptYield, standDown, spare, headTo, lead, goals: goalOps, steps,
  reveals: (v, p, e) => (v === undefined || v === null ? [] : arr(str)(v, p, e)),
}, ['move', ...MEMORY_KEYS]);
const voice = obj<VoiceOutput>({
  action: npcAction, line: str, volume: VOLUME,
  shares: (v, p, e) => (v === undefined || v === null ? [] : arr(str)(v, p, e)),
  gear: GEAR, stance: STANCE, routine: nul(str), agreement, questEnd, spar, yields, letsSearch, acceptYield, standDown, spare, headTo, lead,
}, ['agreement', 'questEnd', 'spar', 'yields', 'letsSearch', 'acceptYield', 'standDown', 'spare', 'headTo', 'lead']);
const narrator = obj<NarratorOutput>({
  text: (v, p, e) => {
    const s = str(v, p, e);
    if (typeof v === 'string' && !s.trim()) e.push(`${p}: empty text`);
    return s;
  },
  narrated: arr(str),
  closing: str,
}, ['closing']);

const GRADE = oneOf(GRADES);
/** a scale level Claude writes as its display name (or key); code keeps the key (src/scales.ts) */
const level = <K extends string>(sc: Scale<K>): V<K> => (v, p, e) =>
  sc.keyOf(v) ?? (e.push(`${p}: expected one of ${sc.keys.map(sc.name).join(', ')}`), sc.keys[0]);
const STANCE_WORD = oneOf(STANCES.keys);
const BELIEF_WORD = oneOf(['unaware', 'suspicious', 'aware'] as const);
/** awareness is what an actor knows; hostility belongs in band relations (V3, V12 hint) */
const AWARENESS: V<'unaware' | 'suspicious' | 'aware'> = (v, p, e) => (STANCES.has(v)
  ? (e.push(`${p}: awareness is unaware, suspicious or aware (what they know); "${v}" is a stance and goes in band relations`), 'unaware')
  : BELIEF_WORD(v, p, e));
type Cast = StagePlan['cast'][number];
/** FR1/FR2: a piece of furniture the Weaver lists */
const FURNITURE = obj<PlanFurniture>({ kind: str, name: str, at: str, edge: bool }, ['at', 'edge']);
const weaver = obj<StagePlan>({
  event: obj<StagePlan['event']>({ summary: str, challenge: GRADE, gain: GRADE }),
  timeOfDay: level(TIME_OF_DAY),
  // BG-36: every optional field the Weaver may give is named here, or it is dropped before validation
  places: arr(obj<StagePlan['places'][number]>({ key: str, name: str, kind: str, parent: (v, p, e) => (v === undefined || v === null ? '' : str(v, p, e)),
    layout: str, names: record(str), looks: record(str), furniture: record(arr(FURNITURE)), site: str }, ['layout', 'names', 'looks', 'furniture', 'site'])), // no parent = top level (V5)
  zones: arr(obj<StagePlan['zones'][number]>({
    key: str, place: str, kind: str, name: str, look: str,
    cover: level(COVER), light: level(LIGHT),
    height: num, size: str, area: num, edges: record(str) as V<NonNullable<StagePlan['zones'][number]['edges']>>,
    length: (v, p, e) => (typeof v === 'number' ? num(v, p, e) : str(v, p, e)), danger: str, road: str, fromLayout: any as V<true>, furniture: arr(FURNITURE),
    links: arr(obj<StagePlan['zones'][number]['links'][number]>({ to: str, label: str, sight: bool, drop: bool,
      barrier: obj<PlanBarrier>({ kind: str, grade: GRADE, locked: bool, barredFrom: str, guarded: bool, keys: arr(str) }, ['grade', 'locked', 'barredFrom', 'guarded', 'keys']) }, ['drop', 'barrier'])),
  }, ['cover', 'light', 'height', 'size', 'area', 'edges', 'length', 'danger', 'road', 'fromLayout', 'furniture'])),
  frontiers: arr(obj<StagePlan['frontiers'][number]>({ key: str, label: str, brief: str }, ['brief'])),
  bands: arr(obj<StagePlan['bands'][number]>({
    key: str, name: str, goals: str, temperament: str,
    tactics: level(TACTICS),
    lethal: (v, p, e) => (v === undefined || v === null ? true : bool(v, p, e)),
    relations: (v, p, e) => (v === undefined || v === null ? {} : record(STANCE_WORD)(v, p, e)),
    chase: level(CHASE_RANGES), // CH5; BG-40: the schema shows the names ("Ground"), so a name is read as its key
  }, ['chase'])),
  cast: arr(obj<Cast>({
    template: str, actor: str, label: str, name: str, appearance: str, pronouns: oneOf(['he', 'she', 'they', 'it'] as const),
    knownOnSight: bool, knows: arr(obj<{ id: string; text: string }>({ id: str, text: str })),
    key: str, band: str, routineSetId: str,
    slots: record<string | string[]>((v, p, e) => (Array.isArray(v) ? arr(str)(v, p, e) : str(v, p, e))),
    startAt: str, routineGap: str, awarenessOfPlayer: AWARENESS,
    compose: obj<NonNullable<Cast['compose']>>({ race: str, role: str, theme: str, rank: str, class: str }, ['class']), templateGap: str, // NG15
    awarenessOfBands: arr(obj<{ band: string; awareness: 'unaware' | 'suspicious' | 'aware' }>({ band: str, awareness: AWARENESS })),
    overrides: arr(obj<{ actor: string; stance: Stance }>({ actor: str, stance: STANCE_WORD })),
    motive: str,
    wares: obj<NonNullable<Cast['wares']>>({
      items: (v, p, e) => (v === undefined || v === null ? [] : arr(obj<{ item: string; qty?: number }>({ item: str, qty: num }, ['qty']))(v, p, e)),
      services: (v, p, e) => (v === undefined || v === null ? [] : arr(str)(v, p, e)),
    }),
    personality: obj<NonNullable<Cast['personality']>>({ nerve: str, types: arr(str), values: arr(str) }, ['nerve', 'types', 'values']),
    age: str,
    talent: str, // AG25
    goals: arr(obj<GoalOps['add'][number]>({ text: str, about: arr(str) }, ['about'])), // UG3
  }, ['template', 'actor', 'compose', 'templateGap', 'pronouns', 'knownOnSight', 'knows', 'startAt', 'routineGap', 'awarenessOfBands', 'overrides', 'wares', 'personality', 'age', 'talent', 'goals'])),
  seeds: obj<StagePlan['seeds']>({ plans: arr(any) as V<StagePlan['seeds']['plans']>, triggers: arr(any) as V<StagePlan['seeds']['triggers']>, secrets: arr(any) as V<StagePlan['seeds']['secrets']> }),
  rewards: arr(obj<StagePlan['rewards'][number]>({
    item: (v, p, e) => (typeof v === 'string' ? v : obj<{ base: string; quality: QualityKey; boosts: string; name: string; look: string; fragility?: FragilityKey }>(
      { base: str, quality: (q, qp, qe) => qualityOf(q) ?? (qe.push(`${qp}: expected one of ${QUALITY_LEVELS.keys.join(', ')}`), QUALITY_LEVELS.keys[0]), boosts: str, name: str, look: str,
        fragility: (f, fp, fe) => FRAGILITY.keyOf(f) ?? (fe.push(`${fp}: expected one of ${FRAGILITY.keys.join(', ')}`), undefined) }, ['fragility'])(v, p, e)), // BK1 c
    qty: num,
    place: (v, p, e) => (isObj(v) && typeof v.carriedBy === 'string' ? { carriedBy: v.carriedBy }
      : isObj(v) && typeof v.groundIn === 'string' ? { groundIn: v.groundIn, ...(v.hiddenAt !== undefined ? { hiddenAt: TIERS.keyOf(v.hiddenAt) ?? (e.push(`${p}.hiddenAt: expected one of ${TIERS.list()}`), 'success') } : {}) }
      : isObj(v) && typeof v.in === 'string' ? { in: v.in }
      : (e.push(`${p}: expected {carriedBy}, {groundIn} or {in}`), { groundIn: '' })),
    owner: str, // BF18
  }, ['qty', 'owner'])),
  containers: arr(obj<NonNullable<StagePlan['containers']>[number]>({
    key: str, item: str, owner: str,
    place: (v, p, e) => (isObj(v) && typeof v.carriedBy === 'string' ? { carriedBy: v.carriedBy }
      : isObj(v) && typeof v.groundIn === 'string' ? { groundIn: v.groundIn } : (e.push(`${p}: expected {carriedBy} or {groundIn}`), { groundIn: '' })),
    locked: obj<{ grade?: Grade; keys?: string[] }>({ grade: any as V<Grade>, keys: arr(str) }, ['grade', 'keys']),
  }, ['owner', 'locked'])),
  hiddenTerms: arr(str),
  weaverNote: str,
  spars: arr(obj<SparMade>({ sides: arr(arr(str)), cruel: bool }, ['cruel'])),
  scenario: any as V<StagePlan['scenario']>, // SC1/SC2/SC7: checked by the validator (src/scenario/validate.ts)
  forbidden: arr(str), // GD1 b
}, ['timeOfDay', 'spars', 'scenario', 'containers', 'forbidden']);

export const checkIntent = run(intent);
export const checkPlanner = run(planner);
export const checkResponder = run(responder);
export const checkVoice = run(voice);
export const checkNarrator = run(narrator);
export const checkStagePlan = run(weaver);
/** WB1: a World builder plan may leave out what it never writes (event grades, rewards, beats): defaults go in first */
export const checkWorldPlan = run<StagePlan>((v, p, e) => weaver(isObj(v) ? { event: { summary: '', challenge: 'none', gain: 'none' }, rewards: [], hiddenTerms: [], weaverNote: '', ...v,
  seeds: { plans: [], triggers: [], secrets: [], ...(isObj(v.seeds) ? v.seeds : {}) } } : v, p, e));

/** SC12: arrivals use the stage plan's own band, cast and seed checks */
const arrivals: V<NonNullable<CheckinAnswer['arrivals']>> = (v, p, e) => {
  if (!isObj(v)) { e.push(`${p}: expected object`); return { bands: [], cast: [] }; }
  const r = weaver({ event: { summary: '', challenge: 'none', gain: 'none' }, places: [], zones: [], frontiers: [], rewards: [], hiddenTerms: [], weaverNote: '',
    bands: v.bands ?? [], cast: v.cast ?? [], seeds: v.seeds ?? { plans: [], triggers: [], secrets: [] } }, p, e);
  return { bands: r.bands, cast: r.cast, seeds: r.seeds };
};
/** SC8: the Weaver's check-in answer; what it may say is checked by engine/scenarioEnd.ts checkinErrors */
const checkin = obj<CheckinAnswer>({
  verdict: oneOf(['continue', 'end'] as const), as: str, text: str, beats: optArr(trigger) as V<CheckinAnswer['beats']>, note: str,
  change: obj<NonNullable<CheckinAnswer['change']>>({ question: str, scale: str, endings: arr(any) as V<NonNullable<NonNullable<CheckinAnswer['change']>['endings']>> }, ['question', 'scale', 'endings']),
  arrivals,
  frontiers: arr(obj<NonNullable<CheckinAnswer['frontiers']>[number]>({ zone: str, key: str, label: str, brief: str }, ['brief'])),
}, ['as', 'text', 'beats', 'note', 'change', 'arrivals', 'frontiers']);
export const checkCheckin = run(checkin);
/** WZ2 the region brief: only its shape is checked here; src/land/brief.ts tidyBrief drops unknown words */
export const checkRegionBrief = run(obj<Record<string, unknown>>({ kind: str, name: str, look: str, settlements: arr(any), features: arr(any), river: any, exits: any, beyond: any, danger: any },
  ['river', 'exits', 'beyond', 'danger', 'features']));
