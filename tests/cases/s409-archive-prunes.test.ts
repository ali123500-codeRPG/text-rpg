// 409 (YS2 b): a story the player resets keeps its pages, its meta and its newest backup. Its turn records and older
// backups are never read again, so they go, and the world it leaves can still be carried on.
import { describe, expect, it } from 'vitest';
import { intent, wholeTurn } from '../harness/turn';
import { CONFIG, resetConfig } from '../../src/config';
import { getLibrary } from '../../src/library';
import { listBackups, listWorlds, loadStory } from '../../src/save';

describe('409 archiving prunes what is never read again', () => {
  it('keeps pages, meta and the newest backup; drops turn records and older backups', async () => {
    const g = wholeTurn();
    CONFIG.BACKUP_EVERY = 1; // after the set-up, which resets the config
    try {
      for (const line of ['first', 'second', 'third']) await g.turn(intent(), line);
      const id = g.game.state()!.storyId;
      expect((await listBackups(g.store, id)).map((b) => b.turn)).toEqual([3, 2, 1]);
      const pages = (await g.store.list(`stories/${id}/pages`)).length;

      await g.game.reset();

      expect(await g.store.list(`stories/${id}/turns`)).toEqual([]);
      expect((await listBackups(g.store, id)).map((b) => b.turn)).toEqual([3]);
      expect((await g.store.list(`stories/${id}/pages`)).length).toBe(pages);
      expect((await g.store.get<{ archivedAt?: string }>(`stories/${id}`))?.archivedAt).toBeTruthy();
      expect((await listWorlds(g.store)).map((w) => w.lastStoryId)).toContain(id);
      await expect(loadStory(g.store, id, getLibrary())).resolves.toBeTruthy(); // carrying the world on reads its pages
    } finally {
      resetConfig();
    }
  });
});
