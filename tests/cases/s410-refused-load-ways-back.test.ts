// 410 (YS1 c): a saved story that fails its load checks offers its ways back on the creation screen: one turn back, when
// the save has an undo bookmark, and its backups, newest first. Either one loads the story and play goes on.
import { afterEach, describe, expect, it } from 'vitest';
import { ScriptedClaude, makeVillage } from '../harness';
import { createGame, VirtualClock, type ScenarioDirector } from '../../src/agents';
import { CONFIG, resetConfig } from '../../src/config';
import { listBackups, memoryStore, saveTurn } from '../../src/save';
import { IT } from '../../src/library/itemIds';
import type { GameState, LoadRecovery, TurnRecord } from '../../src/types';

const idle: ScenarioDirector = { startStory: () => new Promise(() => {}), afterResolve: async () => [], afterSave: () => {} };
const rec = (s: GameState): TurnRecord => ({ storyId: s.storyId, turn: s.turn, libraryVersion: s.libraryVersion, rngBefore: 0, playerInput: '', agentLog: [], events: [], factsAdded: [] });

/** turns 1 to 4 save cleanly (backups at 2 and 4); turn 5 saves a coin stack of 0, which no load accepts */
async function brokenSave() {
  const clock = new VirtualClock(), store = memoryStore();
  const s = makeVillage(); // resets the config, so the lever is set after it
  CONFIG.BACKUP_EVERY = 2;
  for (let t = 1; t <= 4; t++) { s.turn = t; s.clocks.last = t; await saveTurn(store, s, rec(s)); }
  s.turn = 5; s.clocks.last = 5;
  s.player.core.inventory.push({ id: 'c2', itemId: IT.coin, qty: 0 });
  await saveTurn(store, s, rec(s));
  const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
  expect(await g.resume()).toBe(false);
  const refused = g.notices().find((n) => n.kind === 'load_refused');
  return { g, s, store, recovery: (refused as { recovery?: LoadRecovery } | undefined)?.recovery };
}

afterEach(() => resetConfig());

describe('410 a refused load has ways back', () => {
  it('offers one turn back and the backups; going back one turn plays on from turn 4', async () => {
    const { g, s, recovery } = await brokenSave();
    expect(recovery).toEqual({ storyId: s.storyId, back: true, backups: [4, 2] });
    await g.recoverLoad('back');
    expect(g.state()?.clocks.last).toBe(4);
    expect(g.notices().some((n) => n.kind === 'load_refused')).toBe(false);
  });

  it('restores a backup, keeping a backup of the broken save it replaces', async () => {
    const { g, s, store } = await brokenSave();
    await g.recoverLoad(2);
    expect(g.state()?.clocks.last).toBe(2);
    expect(g.notices().some((n) => n.kind === 'load_refused')).toBe(false);
    expect((await listBackups(store, s.storyId)).map((b) => b.turn)).toEqual([5, 4, 2]);
  });
});
