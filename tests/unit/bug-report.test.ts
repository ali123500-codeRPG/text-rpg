// Bugs page: the player's own reports are filed new like the game's (BF45); the list shows new reports, newest first, then
// open numbered bugs, newest number first; fixed ones drop off.
import { expect, it } from 'vitest';
import { memoryStore } from '../../src/save/store';
import { fileBug, openBugs } from '../../src/save/bugs';

it('openBugs lists new reports newest first, then open numbered bugs newest number first', async () => {
  const store = memoryStore(() => 1);
  await fileBug(store, 1, { code: 'player_report', storyId: 's', turn: 2, note: 'a' });
  await fileBug(store, 3, { code: 'player_report', storyId: 's', turn: 5, note: 'c' });
  for (const [n, status] of [[7, 'open'], [9, 'open'], [8, 'fixed']] as const) await store.set(`bugs/BG-${n}`, { id: `BG-${n}`, code: 'invalid_gear', storyId: 's', turn: 1, status, at: 2 });
  expect((await openBugs(store)).map((x) => x.id)).toEqual(['new-3', 'new-1', 'BG-9', 'BG-7']);
});
