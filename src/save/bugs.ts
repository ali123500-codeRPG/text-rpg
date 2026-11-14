// Bug reports for the build threads (BF45): the game files each report unnumbered, as a new report
// (bugs/new-<time>, status new). Claude looks at the new reports and gives each real bug one number from the counter
// (BG-1, BG-2, ...); repeats of one bug share that number, and a report that is not a bug gets none. Threads take numbers
// for bugs they find from the same counter, so the spec's bug log never reuses a number. A numbered bug stays open until a
// build thread marks it fixed. Filings in the same window queue behind each other, so two at once never take one id.
import type { Store } from './index';

/** the one BG counter: Claude numbers bugs from it at triage, threads for bugs they find (the game never does) */
export const BUG_COUNTER = 'bugs_meta/counter';

/** log codes that are bugs: a model output that broke a rule, a call that failed, or a fallback that replaced real
 *  content. Every `invalid_` code is one too. Plain game outcomes (a blocked move, a refused sale) are not. */
export const BUG_CODES = new Set([
  'view_leak', 'invalid_target', 'unlisted_reveal', 'planner_late', 'agent_fallback', 'call_failed', 'refused', 'invalid_json',
  'weaver_off_catalog', 'weaver_fallback', 'weaver_timeout', 'routine_fallback', 'routine_skip', 'reward_repaired', 'quest_goal_gap',
  'scenario_overrun', 'scenario_stalled', 'checkin_failed', // SC12/SC14: code ended a scenario, or a Weaver check-in failed
  'turn_check', // TQ1: a world rule broke after a turn (src/save/turnCheck.ts)
  'code_error', // a throw the game caught so play could go on (a background Planner, the story text save)
]);
export const isBugCode = (code: string): boolean => code.startsWith('invalid_') || BUG_CODES.has(code);
export type BugReport = { code: string; storyId: string; turn: number; [k: string]: unknown };
export type FiledBug = BugReport & { id: string; status: 'new' | 'open' | 'fixed' | 'wont_fix'; at: number };
/** BF45: a report the game filed that Claude has not numbered yet */
export const isNewReport = (b: FiledBug): boolean => b.status === 'new';

const queues = new WeakMap<Store, Promise<unknown>>();

/** the new reports, newest first, then the open bugs, newest number first (the play page's bug list) */
export async function openBugs(store: Store): Promise<FiledBug[]> {
  const docs = await Promise.all((await store.list('bugs')).map((p) => store.get<FiledBug>(p)));
  const num = (b: FiledBug) => Number(String(b.id).replace(/^BG-/, '')) || 0;
  const live = docs.filter((b): b is FiledBug => !!b && (b.status === 'open' || isNewReport(b)));
  return [...live.filter(isNewReport).sort((a, b) => b.at - a.at), ...live.filter((b) => !isNewReport(b)).sort((a, b) => num(b) - num(a))];
}

/** files a report as `bugs/new-<time>` with status new and no number (BF45); resolves to its id, or null when the store
 *  refused */
export function fileBug(store: Store, now: number, bug: BugReport): Promise<string | null> {
  const run = async (): Promise<string | null> => {
    let id = `new-${now}`;
    for (let k = 1; await store.get(`bugs/${id}`); k++) id = `new-${now}-${k}`;
    const doc: FiledBug = { ...bug, id, status: 'new', at: now };
    await store.set(`bugs/${id}`, doc);
    return id;
  };
  const p = (queues.get(store) ?? Promise.resolve()).then(run, run).catch(() => null);
  queues.set(store, p);
  return p;
}
