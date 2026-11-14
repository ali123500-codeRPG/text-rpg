// BF40 part 2 (BG-208): /essence take was a command, and commands were not saved until the next turn, so a take was lost if
// the page reloaded first. A command that changes the character (/essence take, pass, give, sell, remove; /title) now
// saves at once, as a perk pick does (CS12).
import { describe, expect, it } from 'vitest';
import { ScriptedClaude, beside, makeVillage } from '../harness';
import { createGame, VirtualClock, type ScenarioDirector } from '../../src/agents';
import { memoryStore, saveTurn } from '../../src/save';
import { ES } from '../../src/library/essenceIds';
import { SK } from '../../src/library/skillIds';
import type { EssenceOffer, GameState, TurnRecord } from '../../src/types';

const rec = (s: GameState): TurnRecord => ({ storyId: s.storyId, turn: s.turn, libraryVersion: s.libraryVersion, rngBefore: 0, playerInput: '', agentLog: [], events: [], factsAdded: [] });
const idle: ScenarioDirector = { startStory: () => new Promise(() => {}), afterResolve: async () => [], afterSave: () => {} };
const tick = () => new Promise((r) => setTimeout(r, 0));
const offer = (s: GameState): EssenceOffer => ({ essence: ES.street_instinct, grade: 'common', points: { [SK.dodge]: 1, [SK.insight]: 1 }, turn: s.turn, source: 'foe', untilMin: 1e9 });

async function reloaded(store: ReturnType<typeof memoryStore>, clock: VirtualClock): Promise<GameState> {
  const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
  await g.resume();
  return g.state()!;
}

describe('BF40: essence commands save at once', () => {
  it('a taken essence survives a reload before the next turn', async () => {
    const clock = new VirtualClock(), store = memoryStore();
    const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    s.turn = 1;
    s.player.progression!.essenceOffers = [offer(s)];
    await saveTurn(store, s, rec(s));
    const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
    await g.resume();
    await g.submit('/essence take 1', { aimed: false });
    await tick();
    const pr = (await reloaded(store, clock)).player.progression!;
    expect(pr.essences?.map((e) => e.essence)).toEqual([ES.street_instinct]);
    expect(pr.essenceOffers ?? []).toEqual([]);
  });
  it('a pass and a give are saved at once too', async () => {
    const clock = new VirtualClock(), store = memoryStore();
    const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    s.turn = 1;
    const w = beside(s, 'patron_1', 'player', 1); // within reach to hand it over
    w.progression = { ...structuredClone(s.player.progression!), essences: [] }; // with room for one
    s.player.progression!.essenceOffers = [offer(s), offer(s)];
    await saveTurn(store, s, rec(s));
    const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
    await g.resume();
    await g.submit('/essence pass 1', { aimed: false });
    await tick();
    expect((await reloaded(store, clock)).player.progression!.essenceOffers).toHaveLength(1);
    const name = g.state()!.actors.find((a) => a.id === 'patron_1')!.label;
    await g.submit(`/essence give 1 to ${name}`, { aimed: false });
    await tick();
    expect(g.state()!.player.progression!.essenceOffers ?? []).toEqual([]);
    expect((await reloaded(store, clock)).player.progression!.essenceOffers ?? []).toEqual([]);
  });
});
