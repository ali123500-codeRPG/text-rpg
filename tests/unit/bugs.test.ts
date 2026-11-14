// BF45: the game files reports unnumbered (new); Claude gives each real bug one number from the counter at triage.
import { describe, it, expect } from 'vitest';
import { fileBug, BUG_COUNTER, isBugCode } from '../../src/save/bugs';
import type { Store } from '../../src/save';

const memStore = (): Store & { docs: Map<string, unknown> } => {
  const docs = new Map<string, unknown>();
  return {
    docs,
    get: async <T>(p: string) => (docs.get(p) as T) ?? null,
    set: async (p, v) => { await Promise.resolve(); docs.set(p, v); },
    delete: async (p) => { docs.delete(p); },
    list: async (prefix) => [...docs.keys()].filter((k) => k.startsWith(prefix + '/')),
    acquireLease: async () => true,
    releaseLease: async () => {},
  };
};

describe('new bug reports', () => {
  it('files each report as new with no number, never touching the counter, with no repeats when filed together', async () => {
    const st = memStore();
    st.docs.set(BUG_COUNTER, { next: 40 });
    const ids = await Promise.all([1, 2, 3].map((t) => fileBug(st, 5, { code: 'agent_fallback', storyId: 's', turn: t })));
    expect(ids).toEqual(['new-5', 'new-5-1', 'new-5-2']);
    expect(st.docs.get('bugs/new-5-1')).toMatchObject({ id: 'new-5-1', status: 'new', code: 'agent_fallback', turn: 2, at: 5 });
    expect(st.docs.get(BUG_COUNTER)).toEqual({ next: 40 });
    expect(await fileBug(st, 6, { code: 'weaver_off_catalog', storyId: 's', turn: 4 })).toBe('new-6');
  });

  it('counts model slips, failed calls and fallbacks as bugs, not plain game outcomes', () => {
    for (const c of ['invalid_gear', 'invalid_quest_pay', 'view_leak', 'agent_fallback', 'weaver_fallback', 'call_failed']) expect(isBugCode(c)).toBe(true);
    for (const c of ['move_dropped', 'sell_refused', 'heal_blocked', 'rate_limited', 'level_up']) expect(isBugCode(c)).toBe(false);
  });
});
