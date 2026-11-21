// 348 BG-275: the story's opening is a turn too, so it records when it ended (turnEnds), like every resolved turn. Before,
// it never did: the turn check, which judges a fight by the end of the turn before, read the opening as ending now, and a
// new character's first long turn in a world with a fight still going flagged that fresh fight as stale (fight_ends).
import { describe, expect, it } from 'vitest';
import { ScriptedClaude, makeVillage } from '../harness';
import { createGame, VirtualClock, type ScenarioDirector } from '../../src/agents';
import { memoryStore, saveTurn } from '../../src/save';
import { advanceClock, now, turnTime } from '../../src/time';
import { checkTurn, snapTurn } from '../../src/save/turnCheck';
import { SK } from '../../src/library/skillIds';
import { placeAll } from '../../src/engine/position';
import type { GameState, TurnRecord } from '../../src/types';

const rec = (s: GameState): TurnRecord => ({ storyId: s.storyId, turn: s.turn, libraryVersion: s.libraryVersion, rngBefore: 0, playerInput: '', agentLog: [], events: [], factsAdded: [] });
const build = { name: 'Wren', age: 30, skills: { [SK.melee_medium]: 40, [SK.parry]: 25, [SK.dodge]: 10, [SK.endurance]: 15, [SK.eyesight]: 5, [SK.earshot]: 5 }, tagged: [SK.melee_medium, SK.parry, SK.endurance], flawed: [SK.persuasion, SK.barter, SK.sneaking] };
const arrive: ScenarioDirector = {
  startStory: async (s) => { const z = s.places.find((p) => p.id === s.player.placeId)!.zones[0]; s.player.zone = z.id; placeAll(s); return []; }, // as a stage plan does: ZP1 placement
  afterResolve: async () => [], afterSave: () => {},
};

describe('348 BG-275: the opening turn records its end', () => {
  it('a new character in an old world stamps the opening turn\'s end at the opening\'s own time', async () => {
    const clock = new VirtualClock();
    // a world whose character fell, carried on: the opening runs on from the world's turns (every opening goes the same way)
    const old: GameState = JSON.parse(JSON.stringify(makeVillage()).replaceAll('"storyId":"test"', '"storyId":"story_a"'));
    old.meta = { ...old.meta, storyId: 'story_a', createdAt: '2026-11-10T10:00:00Z' };
    old.turn = 12;
    old.player.core.condition.hpLostPct = 100;
    // a fight still going in the inn: a slime and a guard, last renewed on turn 12, which ended 15 s before the world was left
    old.turnEnds = { 12: 600 };
    old.clocks.time = 600.25;
    const sl = old.actors.find((a) => a.id === 'slime_1')!, gd = old.actors.find((a) => a.id === 'guard_1')!;
    sl.mind!.knowledge.guard_1 = { status: 'engaged', closedTurn: 12, lastKnownZone: gd.zone, lastSeenTurn: 12, source: 'seen', revealed: [] };
    const store2 = memoryStore(), g2 = createGame({ client: new ScriptedClaude(clock), clock, store: store2, director: arrive });
    await saveTurn(store2, old, rec(old));
    await g2.resume();
    await g2.reset();
    const [w] = await g2.worlds();
    await g2.newStory(build, { worldId: w.worldId });
    const t = g2.state()!;
    const opening = t.turn - 1; // the opening was turn 13; play goes on from 14
    expect(opening).toBe(13);
    expect(t.turnEnds?.[opening]).toBe(now(t)); // stamped at the opening's own time
    expect(turnTime(t, opening)).toBe(now(t));
    // a long first turn (30 s): judged by the opening's end, the fight was 15 s old, still fresh; the rule check stays quiet
    advanceClock(t, 0.5);
    expect(t.actors.find((a) => a.id === 'slime_1')!.mind!.knowledge.guard_1?.status).toBe('engaged');
    expect(checkTurn(t, snapTurn(t), []).filter((b) => b.rule === 'fight_ends')).toEqual([]);
  });
});
