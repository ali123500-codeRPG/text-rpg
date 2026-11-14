// 272 Worlds a new character can carry on (HF25, HF26, HF28, HF31, HF32). A world whose character fell is free: the creation
// screen lists it, and a new character picked into it carries on its last save. The fallen character stays there, dead,
// under their own id, so people remember them and not the newcomer. The world's date jumps to the Universe date.
import { describe, expect, it } from 'vitest';
import { ScriptedClaude, makeVillage } from '../harness';
import { createGame, VirtualClock, type ScenarioDirector } from '../../src/agents';
import { carryOn, loadStory, memoryStore, pastCharacterId, reachDay, readTurnRecord, saveTurn, storySaved } from '../../src/save';
import { createPlayer, recommendedBuild } from '../../src/library/spawn';
import { CL } from '../../src/library/classIds';
import { ST } from '../../src/library/startIds';
import { healthLevel } from '../../src/ruleset';
import { ageYears } from '../../src/ruleset/age';
import { dayOf, now } from '../../src/time';
import { getLibrary } from '../../src/library';
import { SK } from '../../src/library/skillIds';
import type { GameState, TurnRecord } from '../../src/types';
import { IT } from '../../src/library/itemIds';
import { threadboundStartBlocked } from '../../src/ruleset/threadboundItems';
import { applyGearOps } from '../../src/engine/gear';

const rec = (s: GameState): TurnRecord => ({ storyId: s.storyId, turn: s.turn, libraryVersion: s.libraryVersion, rngBefore: 0, playerInput: '', agentLog: [], events: [], factsAdded: [] });
const tick = () => new Promise((r) => setTimeout(r, 0));
const build = { name: 'Wren', age: 30, skills: { [SK.melee_medium]: 50, [SK.parry]: 40, [SK.dodge]: 30, [SK.endurance]: 50, [SK.eyesight]: 30, [SK.earshot]: 30, [SK.riposte]: 20 }, tagged: [SK.melee_medium, SK.parry, SK.endurance] };
// the opening: the new character steps into the first zone of the place they start at
const arrive: ScenarioDirector = {
  startStory: async (s) => { const z = s.places.find((p) => p.id === s.player.placeId)!.zones[0]; s.player.zone = z.id; return []; },
  afterResolve: async () => [], afterSave: () => {},
};

function fallenWorld(): GameState {
  const s: GameState = JSON.parse(JSON.stringify(makeVillage()).replaceAll('"storyId":"test"', '"storyId":"story_a"'));
  s.meta = { ...s.meta, storyId: 'story_a', createdAt: '2026-11-10T10:00:00Z' };
  s.turn = 12;
  s.clocks.time = 9 * 24 * 60 + 600; // day 10
  s.player.core.condition.hpLostPct = 100;
  const npc = s.actors.find((a) => a.mind)!;
  npc.mind!.knowledge.player = { about: 'player', status: 'seen', stance: 'hostile' } as never; // they hated the one who fell
  return s;
}

describe('272 carrying a world on', () => {
  it('lists a fallen world; a new character there meets its people as a stranger, on the Universe date', async () => {
    const clock = new VirtualClock(), store = memoryStore();
    const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: arrive });
    const old = fallenWorld();
    await saveTurn(store, old, rec(old));
    expect(await g.worlds()).toEqual([]); // someone still lives there
    await g.resume();
    await g.reset();
    await reachDay(store, 40); // other worlds went further
    const [w] = await g.worlds();
    expect(w).toMatchObject({ worldId: 'story_a', lastStoryId: 'story_a', day: 10, past: [{ name: old.player.names.current, fell: true }], threadbound: [], name: `${old.player.names.current}’s world` });

    await g.newStory(build, { worldId: w.worldId });
    for (let i = 0; i < 20 && !(await storySaved(store, g.state()!.storyId)); i++) await tick();
    const s = (await loadStory(store, g.state()!.storyId, getLibrary())).state; // the carried-on save loads and passes every check
    const pastId = pastCharacterId('story_a'), past = s.actors.find((a) => a.id === pastId)!;
    expect(s.player.names.current).toBe('Wren');
    expect(s.meta.worldId).toBe('story_a');
    expect(s.turn).toBe(13); // the world's turns run on
    expect((await readTurnRecord(store, s.storyId, 13))?.opening).toBe(true); // replay reads it as the story's opening
    expect(past.names.current).toBe(old.player.names.current);
    expect(past.kind).toBe('npc');
    expect(healthLevel(past)).toBe('dead'); // HF27: the original perished there
    const npc = s.actors.find((a) => a.mind?.knowledge[pastId])!;
    expect(npc.mind!.knowledge.player).toBeUndefined(); // the grudge stays with the one who fell
    expect(s.places.map((p) => p.id)).toEqual(old.places.map((p) => p.id));
    expect(dayOf(now(s))).toBe(40); // HF32: the world jumps to the Universe date
    expect(Math.round(ageYears(s, s.player)!)).toBe(30);
    expect(await g.worlds()).toEqual([]); // one character lives in a world at a time
    expect((await loadStory(store, 'story_a', getLibrary())).state.player.names.current).toBe(old.player.names.current); // the old story is untouched
  });

  it('HF28: a Threadbound newcomer gets an item not already in that world', () => {
    const b = { ...recommendedBuild(ST.threadbound), tagged: [] as string[] };
    b.tagged = Object.keys(b.skills).slice(0, 3);
    const first = createPlayer(b, 'story_b').core.inventory.find((i) => i.boundTo)!;
    const world = fallenWorld();
    world.player.core.inventory.push({ ...first, boundTo: 'player' });
    const fresh = createPlayer(b, 'story_b', { world }).core.inventory.find((i) => i.boundTo);
    expect(fresh?.itemId).not.toBe(first.itemId); // another one, or none while the library has no other
    const s = carryOn(world, { ...world, storyId: 'story_b', player: createPlayer(b, 'story_b', { world }), actors: [], bands: [], hidden: { ...world.hidden, plans: {} } });
    expect(s.actors.find((a) => a.id === pastCharacterId('story_a'))!.core.inventory.find((i) => i.itemId === first.itemId)?.boundTo).toBe(pastCharacterId('story_a'));
  });

  it('WP1 b: a character reset while standing left the world for good, with what they carried; WP5: a world takes a title', async () => {
    const clock = new VirtualClock(), store = memoryStore();
    const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: arrive });
    const old = fallenWorld();
    old.player.core.condition.hpLostPct = 0; // standing
    await saveTurn(store, old, rec(old));
    await g.resume();
    await g.reset();
    const [w] = await g.worlds();
    expect(w.past).toEqual([{ name: old.player.names.current, fell: false }]);
    await g.titleWorld(w.worldId, '  The Kettle Years  ');
    expect((await g.worlds())[0].name).toBe('The Kettle Years');
    await g.titleWorld(w.worldId, '');
    expect((await g.worlds())[0].name).toBe(`${old.player.names.current}’s world`);
    await g.newStory(build, { worldId: w.worldId });
    for (let i = 0; i < 20 && !(await storySaved(store, g.state()!.storyId)); i++) await tick();
    const s = (await loadStory(store, g.state()!.storyId, getLibrary())).state;
    expect(s.actors.some((a) => a.id === pastCharacterId('story_a'))).toBe(false); // gone, and nobody keeps a belief about them
    expect(s.actors.some((a) => a.mind?.knowledge[pastCharacterId('story_a')] || a.mind?.knowledge.player)).toBe(false);
  });

  it('WP2 b: a Threadbound start is off in a world whose Threadbound items are all taken', async () => {
    expect(threadboundStartBlocked(ST.threadbound, [IT.varos_loop])).toBe(true);
    expect(threadboundStartBlocked(ST.threadbound, [])).toBe(false);
    expect(threadboundStartBlocked(ST.swordsman, [IT.varos_loop])).toBe(false);
    const clock = new VirtualClock(), store = memoryStore();
    const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: arrive });
    const old = fallenWorld();
    old.player.core.inventory.push({ id: 'loop', itemId: IT.varos_loop, boundTo: 'player' });
    await saveTurn(store, old, rec(old));
    await g.resume();
    await g.reset();
    const [w] = await g.worlds();
    expect(w.threadbound).toEqual([IT.varos_loop]); // it lies there with the one who fell
    const b = { ...recommendedBuild(ST.threadbound), tagged: Object.keys(recommendedBuild(ST.threadbound).skills).slice(0, 3) };
    await expect(g.newStory(b, { worldId: w.worldId })).rejects.toThrow(/Threadbound/);
  });

  it('WP2: the bond dies with its owner, so the player can take a dead owner\'s Threadbound item', () => {
    const s = makeVillage();
    const owner = s.actors[0];
    s.player.core.inventory.push({ id: 'loop', itemId: IT.varos_loop, boundTo: owner.id });
    expect(applyGearOps(s, s.player, [{ op: 'wear_acc', item: 'loop' }]).invalid).toHaveLength(1); // still bound while they live
    owner.core.condition.hpLostPct = 200;
    applyGearOps(s, s.player, [{ op: 'wear_acc', item: 'loop' }]);
    expect(s.player.core.inventory.find((i) => i.id === 'loop')).toMatchObject({ boundTo: 'player', equippedIn: [expect.any(String)] });
  });

  it('WP6 a: the foes who downed the one who fell loot the body before the newcomer arrives', () => {
    const world = fallenWorld();
    const [patron, trader] = ['patron_1', 'trader'].map((id) => world.actors.find((a) => a.id === id)!);
    (patron.mind!.overrides ??= {})[world.player.id] = 'hostile'; // it downed them, in the same zone
    world.player.core.inventory.push({ id: 'loop', itemId: IT.varos_loop, boundTo: world.player.id, equippedIn: ['acc:1'] });
    const kit = world.player.core.inventory.map((i) => i.id);
    const s = carryOn(world, { ...world, storyId: 'story_b', player: createPlayer(build, 'story_b', { world }), actors: [], bands: [], hidden: { ...world.hidden, plans: {} } });
    const [p, t, past] = [patron.id, trader.id, pastCharacterId('story_a')].map((id) => s.actors.find((a) => a.id === id)!);
    expect(p.core.inventory.find((i) => i.itemId === IT.coin)?.qty).toBe(20); // all the coin
    expect(p.core.inventory.map((i) => i.id)).toEqual(expect.arrayContaining(kit)); // and every thing of value, up to LOOT_TAKE_MAX
    expect(p.core.inventory.find((i) => i.id === 'loop')).toMatchObject({ boundTo: past.id }); // the bond is a dead one's (WP2)
    expect(p.core.inventory.every((i) => !i.equippedIn?.length || !kit.includes(i.id))).toBe(true);
    expect(past.core.inventory).toEqual([]);
    expect(t.core.inventory).toEqual([]); // not a foe: takes nothing
  });

  it('WP6 a: with no foe standing, everything stays on the body', () => {
    const world = fallenWorld();
    const kit = world.player.core.inventory.map((i) => i.id);
    const s = carryOn(world, { ...world, storyId: 'story_b', player: createPlayer(build, 'story_b', { world }), actors: [], bands: [], hidden: { ...world.hidden, plans: {} } });
    expect(s.actors.find((a) => a.id === pastCharacterId('story_a'))!.core.inventory.map((i) => i.id)).toEqual(kit);
  });
});

