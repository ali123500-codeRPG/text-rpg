// Hall of fame: resetting a story whose character is down archives it with the character as they fell; a reset while
// still standing keeps no entry. The hall lists every fallen character, newest first, from either owner.
import { describe, expect, it } from 'vitest';
import { ScriptedClaude, makeVillage } from '../harness';
import { createGame, VirtualClock, type ScenarioDirector } from '../../src/agents';
import { memoryStore, saveTurn } from '../../src/save';
import type { GameState, TurnRecord } from '../../src/types';
import { gradeLetter, reportCard } from '../../src/ruleset/reportCard';
import { getLibrary } from '../../src/library';
import { GR } from '../../src/library/functionIds';
import { groupsOf } from '../../src/library/functionNames';

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
    expect(Object.keys(f.card!)).toEqual(['combat', 'achievements', 'reputation']);
  });
  it('TS1, TS2: the report card grades by the rank rows, with no top', () => {
    const s = story('card', '2026-11-10T10:00:00Z', true), lib = getLibrary(), sk = s.player.core.skills;
    const melee = Object.keys(lib.skills).find((id) => groupsOf(lib.skills[id])[0] === GR.melee)!;
    for (const id of Object.keys(sk)) sk[id].raw = 10;
    const at = (v: number) => { sk[melee] = { ...sk[melee], raw: v }; return gradeLetter(reportCard(s).combat); };
    expect([at(10), at(50), at(75), at(100)]).toEqual(['F', 'D', 'B', 'A']);
    expect(gradeLetter('rank_8')).toBe('MAX');
    expect(gradeLetter('rank_10')).toBe('MAX++');
    expect(gradeLetter(reportCard(s).achievements)).toBe('F');
  });
});
