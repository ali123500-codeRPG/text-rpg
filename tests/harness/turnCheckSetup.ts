// TQ1: every test runs the turn checker strict (a broken world rule fails the test). KNOWN lists rules an open bug
// breaks in named test files, so CI stays green until the fix lands; the fixing PR deletes its entries.
import { expect } from 'vitest';

const KNOWN: { bug: string; rule: string; files: string[] }[] = [
  { bug: 'none', rule: '*', files: ['pipeline'] }, // a fake engine and fake views (vi.mock): no real world to check
];

// src/save/turnCheck.ts TURN_CHECK reads this; importing src here would load the library before tests set it up
(globalThis as { turnCheck?: unknown }).turnCheck = {
  strict: true,
  skip: () => {
    const file = (expect.getState().testPath ?? '').split('/').pop()?.replace(/\.test\.ts$/, '') ?? '';
    return KNOWN.filter((k) => k.files.includes(file)).map((k) => k.rule);
  },
};
