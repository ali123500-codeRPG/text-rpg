// Hall of fame: resetting a story whose character is down archives it with the character as they fell; a reset while
// still standing keeps no entry. The hall lists every fallen character, newest first, from either owner.
import { describe, expect, it } from 'vitest';
import { ScriptedClaude, makeVillage } from '../harness';
import { createGame, VirtualClock, type ScenarioDirector } from '../../src/agents';
import { memoryStore, saveTurn } from '../../src/save';
import type { GameState, TurnRecord } from '../../src/types';

const rec = (s: GameState): TurnRecord => ({ storyId: s.storyId, turn: s.turn, libraryVersion: s.libraryVersion, rngBefore: 0, playerInput: '', agentLog: [], events: [], factsAdded: [] });
const idle: ScenarioDirector = { startStory: () => new Promise(() => {}), afterResolve: async () => [], afterSave: () => {} };
function story(id: string, createdAt: string, down: boolean): GameState {
  const s: GameState = JSON.parse(JSON.stringify(makeVillage()).replaceAll('"storyId":"test"', `"storyId":"${id}"`));
  s.meta = { ...s.meta, storyId: id, createdAt };
  if (down) s.player.core.condition.hpLostPct = 100;
  return s;
}

describe('164 hall of fame', () => {
  it('a fallen story is kept on reset; a standing one is not', async () => {
    const clock = new VirtualClock(), store = memoryStore();
    const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
    const fallen = story('fallen', '2026-11-10T10:00:00Z', true);
    await saveTurn(store, fallen, rec(fallen));
    expect(await g.resume()).toBe(true);
    expect(g.fell()).toBe(true);
    await g.reset();
    const alive = story('alive', '2026-11-10T11:00:00Z', false);
    await saveTurn(store, alive, rec(alive));
    expect(await g.resume()).toBe(true);
    await g.reset();
    const hall = await g.hallOfFame();
    expect(hall.map((x) => x.storyId)).toEqual(['fallen']);
    const f = hall[0];
    expect(f.name).toBe(fallen.player.names.current);
    expect(f.owner).toBe('player');
    expect(f.level).toBeGreaterThan(0);
    expect(f.skills.length).toBeGreaterThan(0);
    expect(f.skills[0].value).toBeGreaterThanOrEqual(f.skills.at(-1)!.value);
    expect(f.place).not.toBe('');
  });
});
