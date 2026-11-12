// Bug reports for the build threads: every bug gets its own number (BG-1, BG-2, ...) and starts open, so each one is
// tracked until a build thread marks it fixed. Threads take numbers for bugs they find from the same counter, so the
// spec's bug log and the game never reuse a number. Numbers come from one counter document; filings in the same window
// queue behind each other, so two at once never take the same number.
import type { Store } from './index';

export const BUG_COUNTER = 'bugs_meta/counter';

/** log codes that are bugs: a model output that broke a rule, a call that failed, or a fallback that replaced real
 *  content. Every `invalid_` code is one too. Plain game outcomes (a blocked move, a refused sale) are not. */
export const BUG_CODES = new Set([
  'view_leak', 'invalid_target', 'unlisted_reveal', 'planner_late', 'agent_fallback', 'call_failed', 'refused', 'invalid_json',
  'weaver_off_catalog', 'weaver_fallback', 'weaver_timeout', 'routine_fallback', 'routine_skip', 'reward_repaired', 'quest_goal_gap',
  'scenario_overrun', 'scenario_stalled', 'checkin_failed', // SC12/SC14: code ended a scenario, or a Weaver check-in failed
]);
export const isBugCode = (code: string): boolean => code.startsWith('invalid_') || BUG_CODES.has(code);
export type BugReport = { code: string; storyId: string; turn: number; [k: string]: unknown };
export type FiledBug = BugReport & { id: string; status: 'open' | 'fixed' | 'wont_fix'; at: number };

const queues = new WeakMap<Store, Promise<unknown>>();

/** the open bugs, newest number first (the play page's bug list) */
export async function openBugs(store: Store): Promise<FiledBug[]> {
  const docs = await Promise.all((await store.list('bugs')).map((p) => store.get<FiledBug>(p)));
  const num = (b: FiledBug) => Number(String(b.id).replace(/^BG-/, '')) || 0;
  return docs.filter((b): b is FiledBug => !!b && b.status === 'open').sort((a, b) => num(b) - num(a));
}

/** files a bug as `bugs/BG-<n>` with status open; resolves to its id, or null when the store refused */
export function fileBug(store: Store, now: number, bug: BugReport): Promise<string | null> {
  const run = async (): Promise<string | null> => {
    const c = await store.get<{ next: number }>(BUG_COUNTER);
    const n = Math.max(1, c?.next ?? 1);
    await store.set(BUG_COUNTER, { next: n + 1 });
    const id = `BG-${n}`;
    const doc: FiledBug = { ...bug, id, status: 'open', at: now };
    await store.set(`bugs/${id}`, doc);
    return id;
  };
  const p = (queues.get(store) ?? Promise.resolve()).then(run, run).catch(() => null);
  queues.set(store, p);
  return p;
}
