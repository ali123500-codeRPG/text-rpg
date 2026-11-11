// Bugs page: the player's own reports are numbered like every other bug, and the list shows open bugs only, newest first.
import { expect, it } from 'vitest';
import { memoryStore } from '../../src/save/store';
import { fileBug, openBugs } from '../../src/save/bugs';

it('openBugs lists open bugs only, newest number first', async () => {
  const store = memoryStore(() => 1);
  await fileBug(store, 1, { code: 'player_report', storyId: 's', turn: 2, note: 'a' });
  const b = await fileBug(store, 1, { code: 'weaver_fallback', storyId: 's', turn: 0 });
  await fileBug(store, 1, { code: 'player_report', storyId: 's', turn: 5, note: 'c' });
  await store.set(`bugs/${b}`, { ...(await store.get(`bugs/${b}`))!, status: 'fixed' });
  expect((await openBugs(store)).map((x) => x.id)).toEqual(['BG-3', 'BG-1']);
});
