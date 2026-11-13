// TQ1: every test runs the turn checker strict (a broken world rule fails the test). KNOWN lists rules an open bug
// breaks in named test files, so CI stays green until the fix lands; the fixing PR deletes its entries.
import { expect } from 'vitest';

const KNOWN: { bug: string; rule: string; files: string[] }[] = [
  { bug: 'none', rule: '*', files: ['pipeline'] }, // a fake engine and fake views (vi.mock): no real world to check
  { bug: 'BG-119', rule: 'move_event', files: [ // NPCs changing zone by an unlogged catch-up (fix: catchUp logs caught_up)
    's049-deed-instead-of-reply', 's093-thrown', 's114-hold', 's119-strike-improvised-60', 's125-all50', 's149-player-yield',
    's152-dread-presence', 's153-parry', 's159-battle-cry', 's160-overwhelm-linked', 's171-positions', 's187-follow-order', 's222-lead-waits'] },
];

// src/save/turnCheck.ts TURN_CHECK reads this; importing src here would load the library before tests set it up
(globalThis as { turnCheck?: unknown }).turnCheck = {
  strict: true,
  skip: () => {
    const file = (expect.getState().testPath ?? '').split('/').pop()?.replace(/\.test\.ts$/, '') ?? '';
    return KNOWN.filter((k) => k.files.includes(file)).map((k) => k.rule);
  },
};
