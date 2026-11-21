// D-141 vows (VW1–VW9): goals the player sets by talking with the Witness. The Witness only fills a vow form; code reads
// it into a goal it can check (or refuses it), the player swears it, and code checks it every turn: kept pays the stake's
// Thread, broken takes the same Thread (the bar may go into debt, as when an essence is given up).
import type { Actor, GameEvent, GameState, JobOffer, Vow, VowGoal, VowStake, VowState } from '../types';
import type { VOW_GOAL_KINDS } from '../types/state';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { skillIdOf } from '../library/skillIds';
import { SKILL_NAMES } from '../library/skillNames';
import { PARSER_ACTIONS } from '../types/agents';
import { REWARD_LEVELS, TIME_OF_DAY, type TimeOfDay } from '../scales';
import { now } from '../time';
import { trueSkill } from '../ruleset/perks';
import { rewardXp } from '../ruleset/achRewards';
import { freshId } from '../ids';
import { actorById } from './relations';
import { logCode } from './effects';
import { awardXp, charLevel, xpToNext } from './xp';
import { dead, dueAt, goalItemGone, goalProgress, goalTarget, need, readGoal } from './quests';

/** VW3 c: the acts a restraint vow may give up: killing, or any of the Parser's action types */
export const VOW_ACTS = ['kill', ...PARSER_ACTIONS] as const;

/** what the Witness writes when a vow has taken shape: the quest job's goal fields, plus skill, to and act */
export type VowForm = {
  line: string;
  goal: Omit<JobOffer['goal'], 'kind' | 'to'> & { kind: (typeof VOW_GOAL_KINDS)[number]; skill?: string | null; to?: string | number | null; act?: string | null };
  stake: string; // a REWARD_LEVELS name, I to III
  days: number;
  by?: TimeOfDay | null;
};

export const activeVows = (state: GameState): Vow[] => (state.vows ?? []).filter((v) => v.state === 'active');
const taken = (state: GameState) => state.player.progression?.tally?.essences_taken ?? 0;
const hasAchievement = (state: GameState, key: string) => (state.player.progression?.achievements ?? []).some((a) => a.key === key);
/** a vow's Thread: its stake's reward level, share of a level included (VW4: as an achievement of that level) */
export const vowXp = (state: GameState, stake: VowStake): number => Math.round(rewardXp(stake, xpToNext(state.player)));
const stakeOf = (s: string): VowStake | undefined => CONFIG.VOW_STAKES.find((k) => k === s.trim().toLowerCase() || REWARD_LEVELS.name(k) === s.trim().toUpperCase());

/** the goal a form asks for, read the way code checks it; a string says why it cannot be checked */
function readVowGoal(state: GameState, g: VowForm['goal']): VowGoal | string {
  const p = state.player;
  if (g.kind === 'defeat' || g.kind === 'deliver' || g.kind === 'reach' || g.kind === 'find') {
    const q = readGoal(state, { ...g, kind: g.kind, to: g.to === undefined || g.to === null ? g.to : String(g.to) });
    if (q.kind === 'other') return `no ${g.kind} goal code can check: the target is not someone, something or somewhere it knows`;
    if (q.kind === 'reach' && goalProgress(state, q, 0, [], []) >= 1) return 'you are already there';
    if (q.kind === 'find' && goalProgress(state, q, 0, [], []) >= 1) return 'you have already found them';
    return q;
  }
  if (g.kind === 'skill') {
    const skill = skillIdOf(g.skill ?? g.target ?? '', SKILL_NAMES), to = Math.floor(Number(g.to));
    if (!SKILL_NAMES[skill]) return `no skill named ${g.skill ?? g.target ?? ''}`;
    if (!(to > trueSkill(p, skill))) return `${SKILL_NAMES[skill]} is already ${Math.floor(trueSkill(p, skill))}: aim above it`;
    return { kind: 'skill', skill, to };
  }
  if (g.kind === 'level') {
    const to = Math.floor(Number(g.to ?? g.count));
    if (!(to > charLevel(p))) return `you are already level ${charLevel(p)}: aim above it`;
    return { kind: 'level', to };
  }
  if (g.kind === 'achievement') {
    const lib = getLibrary().achievements ?? {}, t = (g.target ?? '').trim();
    const key = lib[t] ? t : Object.keys(lib).find((k) => lib[k].name.toLowerCase() === t.toLowerCase());
    if (!key) return `no achievement named ${t}`;
    if (hasAchievement(state, key)) return `you already hold ${lib[key].name}`;
    return { kind: 'achievement', key };
  }
  if (g.kind === 'essence') return { kind: 'essence', from: taken(state) };
  if (g.kind === 'restraint') {
    const act = (g.act ?? g.target ?? '').trim().toLowerCase();
    return (VOW_ACTS as readonly string[]).includes(act) ? { kind: 'restraint', act } : `no act named ${act} that code can watch`;
  }
  return `no goal kind ${String((g as { kind: unknown }).kind)}`;
}

/** D-141: a vow form read into a vow ready to swear (not yet in the list), or why it is refused, in words the Witness
 * passes on. A goal already met is refused (VW4's guard), and so is a vow past the cap (VW7). */
export function readVow(state: GameState, f: VowForm): { vow: Vow } | { error: string } {
  const text = f.line.trim().slice(0, CONFIG.TEXT_CAP);
  if (!text) return { error: 'the vow has no line' };
  if (activeVows(state).length >= CONFIG.VOW_MAX_ACTIVE) return { error: `you already hold ${CONFIG.VOW_MAX_ACTIVE} vows, the most at once` };
  const stake = stakeOf(f.stake);
  if (!stake) return { error: `the stake must be one of ${CONFIG.VOW_STAKES.map((k) => REWARD_LEVELS.name(k)).join(', ')}` };
  const days = Math.floor(f.days);
  if (!(days >= CONFIG.VOW_DAYS_MIN && days <= CONFIG.VOW_DAYS_MAX)) return { error: `the deadline must be ${CONFIG.VOW_DAYS_MIN} to ${CONFIG.VOW_DAYS_MAX} days` };
  const by = f.by && TIME_OF_DAY.has(f.by) ? f.by : undefined;
  const goal = readVowGoal(state, f.goal);
  if (typeof goal === 'string') return { error: goal };
  const id = freshId(`vow_${state.turn}`, new Set((state.vows ?? []).map((v) => v.id)));
  return { vow: { id, text, goal, progress: 0, stake, state: 'active', startTurn: state.turn, startAt: now(state), due: dueAt(state, { days, by }), ...(by ? { dueBy: by } : {}) } };
}

/** the Swear button: the form is read again against the state now; null when sworn, else why not */
export function swearVow(state: GameState, f: VowForm): string | null {
  const r = readVow(state, f);
  if ('error' in r) return r.error;
  (state.vows ??= []).push(r.vow);
  logCode(state, 'vow_sworn', { id: r.vow.id, goal: r.vow.goal.kind, stake: r.vow.stake });
  return null;
}

function endVow(state: GameState, v: Vow, to: Exclude<VowState, 'active'>, why: string): void {
  v.state = to;
  v.endTurn = state.turn;
  v.why = why;
  v.xp = vowXp(state, v.stake);
  if (to === 'kept') awardXp(state, v.xp, `vow:${v.id}`);
  else {
    // VW5 a: the stake's Thread is lost, into debt if need be; new Thread pays the debt first
    const pr = state.player.progression;
    if (pr) { pr.xp -= v.xp; (pr.xpLog ??= []).push({ source: `vow broken:${v.id}`, amount: -v.xp, turn: state.turn }); }
  }
  logCode(state, to === 'kept' ? 'vow_kept' : 'vow_broken', { id: v.id, why, xp: v.xp });
}

/** VW8 a: renouncing a vow breaks it */
export function renounceVow(state: GameState, id: string): boolean {
  const v = activeVows(state).find((x) => x.id === id);
  if (!v) return false;
  endVow(state, v, 'broken', 'renounced');
  return true;
}

const vowNeed = (g: VowGoal) => (g.kind === 'skill' || g.kind === 'level' ? g.to : g.kind === 'restraint' || g.kind === 'essence' || g.kind === 'achievement' ? 1 : need(g));

/** per turn, after the quests: progress, a restraint broken by this turn's act, goals met, and deadlines. `act` is the
 * player's action type this turn, when they acted; `defeated`, whom they defeated (a kill: one now dead). */
export function updateVows(state: GameState, events: GameEvent[], defeated: Actor[], act?: string): void {
  const p = state.player;
  for (const v of activeVows(state)) {
    const g = v.goal;
    if (g.kind === 'restraint') {
      if (g.act === act || (g.act === 'kill' && defeated.some(dead))) endVow(state, v, 'broken', 'restraint');
      continue;
    }
    v.progress = g.kind === 'skill' ? Math.floor(trueSkill(p, g.skill)) : g.kind === 'level' ? charLevel(p)
      : g.kind === 'achievement' ? Number(hasAchievement(state, g.key)) : g.kind === 'essence' ? Number(taken(state) > g.from)
        : goalProgress(state, g, v.progress, events, defeated);
    if (v.progress >= vowNeed(g)) { v.progress = vowNeed(g); endVow(state, v, 'kept', 'met'); continue; }
    const target = g.kind === 'skill' || g.kind === 'level' || g.kind === 'achievement' || g.kind === 'essence' ? undefined : goalTarget(g);
    if (target && dead(actorById(state, target))) endVow(state, v, 'broken', 'target_dead');
    else if ((g.kind === 'deliver') && goalItemGone(state, g)) endVow(state, v, 'broken', 'item_gone');
  }
  // VW6 a: at the deadline a restraint is kept and a goal not met is broken
  for (const v of activeVows(state)) if (now(state) > v.due) endVow(state, v, v.goal.kind === 'restraint' ? 'kept' : 'broken', 'deadline');
}

// ---------- what screens and the Witness show ----------

export const VOW_STATE_NAME: Record<VowState, string> = { active: 'Active', kept: 'Kept', broken: 'Broken' };
const ACT_WORDS: Record<string, string> = { kill: 'kill', filch: 'steal', deceive: 'lie', use_item: 'use an item', rest: 'rest' };
/** a growth or restraint goal in words; quest goals read through questGoalText */
export function vowOwnGoalText(state: GameState, v: Vow): string | undefined {
  const g = v.goal;
  if (g.kind === 'skill') return `${SKILL_NAMES[g.skill] ?? g.skill} ${v.progress || Math.floor(trueSkill(state.player, g.skill))} / ${g.to}`;
  if (g.kind === 'level') return `Level ${v.progress || charLevel(state.player)} / ${g.to}`;
  if (g.kind === 'achievement') return `Earn ${getLibrary().achievements?.[g.key]?.name ?? g.key}`;
  if (g.kind === 'essence') return 'Take an essence';
  if (g.kind === 'restraint') return `Never ${ACT_WORDS[g.act] ?? g.act.replace(/_/g, ' ')}`;
  return undefined;
}
