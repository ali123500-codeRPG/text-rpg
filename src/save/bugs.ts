// Bug reports for the build threads: every bug gets its own number (BG1, BG2, ...) and starts open, so each one is
// tracked until a build thread marks it fixed. Numbers come from one counter document; filings in the same window
// queue behind each other, so two at once never take the same number.
import type { Store } from './index';

export const BUG_COUNTER = 'bugs_meta/counter';
export type BugReport = { code: string; storyId: string; turn: number; [k: string]: unknown };
export type FiledBug = BugReport & { id: string; status: 'open' | 'fixed' | 'wont_fix'; at: number };

const queues = new WeakMap<Store, Promise<unknown>>();

/** files a bug as `bugs/BG<n>` with status open; resolves to its id, or null when the store refused */
export function fileBug(store: Store, now: number, bug: BugReport): Promise<string | null> {
  const run = async (): Promise<string | null> => {
    const c = await store.get<{ next: number }>(BUG_COUNTER);
    const n = Math.max(1, c?.next ?? 1);
    await store.set(BUG_COUNTER, { next: n + 1 });
    const id = `BG${n}`;
    const doc: FiledBug = { ...bug, id, status: 'open', at: now };
    await store.set(`bugs/${id}`, doc);
    return id;
  };
  const p = (queues.get(store) ?? Promise.resolve()).then(run, run).catch(() => null);
  queues.set(store, p);
  return p;
}
