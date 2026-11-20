// 408: the save's head is the one document that grows with the world. Once it passes HEAD_WARN_SHARE of the document
// limit, the game files one head_large bug, on the save that crosses the line, and play goes on.
import { describe, expect, it } from 'vitest';
import { intent, wholeTurn } from '../harness/turn';
import { CONFIG, resetConfig } from '../../src/config';
import { byteLength, PAGE_LIMIT } from '../../src/save/pages';
import type { FiledBug } from '../../src/save/bugs';
import type { Head } from '../../src/types';

describe('408 a large save head is reported once', () => {
  it('files head_large on the save that crosses the line, and not on later ones', async () => {
    const g = wholeTurn();
    const id = g.game.state()!.storyId;
    // the opening's head has no undo bookmark; the next one lists every page twice, so it crosses a line set just above
    const opening = byteLength((await g.store.get<Head>(`stories/${id}/control/head`))!);
    CONFIG.HEAD_WARN_SHARE = (opening + 1) / PAGE_LIMIT;
    try {
      await g.turn(intent(), 'first');
      await g.turn(intent(), 'second');
      await g.game.settle();
      const filed = (await Promise.all((await g.store.list('bugs')).map((p) => g.store.get<FiledBug>(p)))).filter((b) => b?.code === 'head_large');
      expect(filed).toHaveLength(1);
      expect(filed[0]).toMatchObject({ turn: 1, storyId: id });
      expect(g.game.notices().map((n) => n.kind)).not.toContain('save_failed');
    } finally {
      resetConfig();
    }
  });
});
