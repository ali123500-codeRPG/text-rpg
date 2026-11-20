// 407 BG-338: /undo writes the head first, then deletes the undone turn's record. When that delete fails, the save has
// already gone back a turn, so the game goes back too and says so, instead of "there is no turn to undo".
import { describe, expect, it } from 'vitest';
import { intent, wholeTurn } from '../harness/turn';
import type { Head } from '../../src/types';

describe('407 a failed tidy-up after /undo', () => {
  it('still undoes the turn on screen when the turn record delete fails', async () => {
    const g = wholeTurn();
    await g.turn(intent(), 'first');
    await g.turn(intent(), 'second');
    const id = g.game.state()!.storyId;

    g.store.failNext = { match: new RegExp(`stories/${id}/turns/2$`), code: 'store_error' };
    await g.game.submit('/undo', { aimed: false });
    await g.game.settle();

    expect((await g.store.get<Head>(`stories/${id}/control/head`))!.turn).toBe(1);
    expect(g.game.lines().at(-1)?.text).toBe('Turn undone.');
  });
});
