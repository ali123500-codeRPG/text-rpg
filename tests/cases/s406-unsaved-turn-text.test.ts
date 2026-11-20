// 406 BG-335: a turn whose head write failed is not in the save, so its story text is not saved either. Play goes on from
// memory and the next good turn saves both; a reload instead finds the story column and the save on the same turn.
import { describe, expect, it } from 'vitest';
import { intent, wholeTurn } from '../harness/turn';
import { loadHistory } from '../../src/save';
import type { Head } from '../../src/types';

describe('406 the story text follows the commit', () => {
  it('keeps a failed turn’s text out of the saved story until a turn commits', async () => {
    const g = wholeTurn();
    await g.turn(intent(), 'first');
    await g.turn(intent(), 'second');
    const id = g.game.state()!.storyId;
    const savedTurns = async () => [...new Set((await loadHistory(g.store, id)).map((l) => l.turn))];
    const headTurn = async () => (await g.store.get<Head>(`stories/${id}/control/head`))!.turn;

    g.store.failNext = { match: /control\/head/, code: 'store_error' };
    await g.turn(intent(), 'third');
    expect(g.game.notices().map((n) => n.kind)).toContain('save_failed');
    expect(await headTurn()).toBe(2);
    expect(await savedTurns()).toEqual([1, 2]);

    await g.turn(intent(), 'fourth');
    expect(await headTurn()).toBe(4);
    expect(await savedTurns()).toEqual([1, 2, 3, 4]);
  });
});
