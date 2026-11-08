// 118 The GM starts a new save (Ali, 08/11/2026, "with warnings"): a confirmed reset archives the story (D-73).
// Its pages stay under its id, but play no longer finds it, so a reload goes to Create instead of the old story.
import { describe, expect, it } from 'vitest';
import { archiveStory, listStories, loadPendingStart, memoryStore, savePendingStart } from '../../src/save';

const meta = (storyId: string, createdAt: string) => ({ storyId, title: storyId, schemaVersion: 1, createdAt, settings: {} });

describe('118 start a new save', () => {
  it('an archived story is kept but no longer listed; the next newest one runs', async () => {
    const store = memoryStore();
    await store.set('stories/old', meta('old', '2026-11-08T10:00:00Z'));
    await store.set('stories/new', meta('new', '2026-11-08T12:00:00Z'));
    await store.set('stories/new/pages/p', { kept: true });
    await savePendingStart(store, { storyId: 'new', build: {} as never, at: '2026-11-08T12:00:00Z' });
    await archiveStory(store, 'new', '2026-11-08T16:40:00Z');
    expect((await listStories(store)).map((m) => m.storyId)).toEqual(['old']);
    expect(await store.get('stories/new/pages/p')).toEqual({ kept: true }); // archived, not deleted
    expect((await store.get<{ archivedAt: string }>('stories/new'))?.archivedAt).toBe('2026-11-08T16:40:00Z');
    expect(await loadPendingStart(store)).toBeNull();
    await archiveStory(store, 'old', '2026-11-08T16:41:00Z');
    expect(await listStories(store)).toEqual([]);
  });
});
