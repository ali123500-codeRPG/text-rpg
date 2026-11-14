// 270 The Universe calendar (HF17, HF22): stories share one calendar. The Universe keeps the furthest day any world has
// reached; a new world starts the day after it, and the new character's age is the age picked at creation.
import { describe, expect, it } from 'vitest';
import { ScriptedClaude } from '../harness';
import { createGame, VirtualClock, type ScenarioDirector } from '../../src/agents';
import { memoryStore, reachDay, universeDay } from '../../src/save';
import { dayOf, now } from '../../src/time';
import { ageYears } from '../../src/ruleset/age';
import { SK } from '../../src/library/skillIds';

const idle: ScenarioDirector = { startStory: () => new Promise(() => {}), afterResolve: async () => [], afterSave: () => {} };
const build = { name: 'Wren', age: 30, skills: { [SK.melee_medium]: 40, [SK.parry]: 25, [SK.dodge]: 10, [SK.endurance]: 15, [SK.eyesight]: 5, [SK.earshot]: 5 }, tagged: [SK.melee_medium, SK.parry, SK.endurance] };
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('270 universe calendar', () => {
  it('the Universe date only moves forward', async () => {
    const store = memoryStore();
    expect(await universeDay(store)).toBe(0);
    await reachDay(store, 40);
    await reachDay(store, 30);
    expect(await universeDay(store)).toBe(40);
  });

  it('the first world starts on day 1; a later world starts the day after the furthest day reached', async () => {
    for (const [reached, start] of [[0, 1], [40, 41]]) {
      const clock = new VirtualClock(), store = memoryStore();
      if (reached) await reachDay(store, reached);
      const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
      void g.newStory(build).catch(() => {});
      for (let i = 0; i < 5 && !g.state()?.clocks.startDay; i++) await tick();
      const s = g.state()!;
      expect(dayOf(now(s))).toBe(start);
      expect(Math.round(ageYears(s, s.player)!)).toBe(30); // the age picked at creation, whatever the start day
    }
  });
});
