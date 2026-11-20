// The library split (Phase 2, SX5): prototypeLibrary() built with its tables in src/library/items.ts, classPerks.ts,
// bodyTypes.ts, npcs.ts and routineBank.ts must equal the library built by the single data.ts it replaced: every key,
// array element and row in the same order, version included, both with default settings and with settings changed before
// the library loads (data.ts reads CONFIG at load). The hashes were taken from main before the move. This file is a
// one-time check: the PR after the split removes it, so changing a library row later does not trip it.
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { createHash } from 'node:crypto';

const ser = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'function' ? `__fn:${String(x)}` : typeof x === 'number' && !Number.isFinite(x) ? `__num:${x}` : x === undefined ? '__undefined__' : x instanceof Set ? { __set: [...x] } : x instanceof Map ? { __map: [...x] } : x));
const hash = (v: unknown) => createHash('sha256').update(ser(v)).digest('hex');

describe('library split', () => {
  it('builds the same library, with default settings', async () => {
    vi.resetModules();
    await import('../../src/library');
    const lib = (await import('../../src/library/data')).prototypeLibrary();
    expect(lib.version).toBe(1);
    expect(hash(lib)).toBe('59af9165d8cf67d77e60d9788109db9262e832f06960acb4e7416ef0768c9071');
  });

  it('reads its settings at load as before', async () => {
    vi.resetModules();
    const { CONFIG } = await import('../../src/config');
    CONFIG.EQUIP_NEED = { ...CONFIG.EQUIP_NEED, fine: 55 };
    CONFIG.ARMOR_MULTIPLIER = { ...CONFIG.ARMOR_MULTIPLIER, light: 0.77 };
    await import('../../src/library');
    expect(hash((await import('../../src/library/data')).prototypeLibrary())).toBe('a688cf5856c16752df1d25c44dbe73ab44ce5fb3b81982ef0896eaa957247304');
    vi.resetModules();
  });
});
