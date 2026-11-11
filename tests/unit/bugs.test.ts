// Every bug gets its own number and starts open, even when several are filed at once.
import { describe, it, expect } from 'vitest';
import { fileBug, BUG_COUNTER } from '../../src/save/bugs';
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

describe('numbered bugs', () => {
  it('numbers bugs BG1, BG2, ... with no repeats when filed together, each open', async () => {
    const st = memStore();
    const ids = await Promise.all([1, 2, 3].map((t) => fileBug(st, 5, { code: 'agent_fallback', storyId: 's', turn: t })));
    expect(ids).toEqual(['BG1', 'BG2', 'BG3']);
    expect(st.docs.get('bugs/BG2')).toMatchObject({ id: 'BG2', status: 'open', code: 'agent_fallback', turn: 2 });
    expect(st.docs.get(BUG_COUNTER)).toEqual({ next: 4 });
    expect(await fileBug(st, 6, { code: 'weaver_off_catalog', storyId: 's', turn: 4 })).toBe('BG4');
  });
});
