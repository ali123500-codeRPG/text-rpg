// 272 Heroes into NPCs (HF1–HF34): a unique template holds one saved character's whole sheet. A Hall of fame hero comes back
// as an echo: its sheet exactly as saved, at full health, gear soulbound, coin and goods left behind, at most once per world,
// in the Weaver's catalog with its power and hidden past; beaten, it always offers an essence two tiers up, never below Common.
import { describe, expect, it } from 'vitest';
import type { GameState, Rng } from '../../src/types';
import { ScriptedClaude, makeVillage } from '../harness';
import { createGame, VirtualClock, type ScenarioDirector } from '../../src/agents';
import { memoryStore, saveTurn } from '../../src/save';
import { librarySends } from '../../src/save/sends';
import type { TurnRecord, UniqueSheet } from '../../src/types';
import { getLibrary, itemDef, setLibrary } from '../../src/library';
import { spawnNpc } from '../../src/library/spawn';
import { echoSheet, isEcho, uniqueInWorld, uniqueTemplate } from '../../src/library/echo';
import { RC } from '../../src/library/raceIds';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';
import { dropToGround, fadeSoulbound, giveItem } from '../../src/engine/gear';
import { offerList } from '../../src/engine/trade';
import { inWorld } from '../../src/ruleset/threadboundItems';
import { offersFromDefeats, qualityRoll } from '../../src/engine/essence';
import { buildNarrationView, buildWeaverView } from '../../src/views';
import { validateStagePlan } from '../../src/scenario';
import { villageStagePlan } from '../../src/scenario/fixtures';
import { ageYears } from '../../src/ruleset/age';
import { CONFIG } from '../../src/config';

const ECHO = 'TP_echo_test', ECHO_ESSENCE = 'ES_echo_test';
const dice = (...d: number[]): Rng => { let i = 0; return { state: 1, next: () => 0, int: (lo) => lo, d100: () => d[Math.min(i++, d.length - 1)] }; };

/** the village's player falls and is sent: a Threadbound item worn, a hurt shield, an achievement and a scar */
function sendHero(s: GameState): void {
  const p = s.player, lib = getLibrary();
  p.core.bornDay = -30 * CONFIG.YEAR_DAYS; // 30 years old
  const tb = Object.values(lib.items).find((d) => d.threadbound)!;
  p.core.inventory.push({ id: 'tb', itemId: tb.id, boundTo: p.id, equippedIn: ['acc:1'] });
  const shield = p.core.inventory.find((i) => itemDef(s, i.itemId).shield);
  if (shield) shield.pools = { shield: 20 };
  p.progression!.achievements = [{ id: 'a1', key: Object.keys(lib.achievements ?? {})[0], turn: 3 }];
  const t = { ...uniqueTemplate(ECHO, RC.human, 'a grim swordsman', echoSheet(s, p, ECHO, 'Aldric, a level 3 Swordsman; fell to a slime in the east field on day 2.')), essences: [ECHO_ESSENCE] };
  // EN3 b: an echo carries only its own essence
  const own = { id: ECHO_ESSENCE, name: 'Aldric\'s Last Stand', from: { echo: true as const }, weight: 1, skills: [{ skill: SK.melee_medium, weight: 1 }], story: 'test' };
  setLibrary({ ...lib, templates: { ...lib.templates, [ECHO]: t }, essences: { ...lib.essences, [ECHO_ESSENCE]: own } });
}
const spawnEcho = (s: GameState) => {
  const e = spawnNpc(s, ECHO, { id: 'echo_1', zone: s.player.zone, placeId: s.player.placeId, bandId: 'tavern_folk', label: 'a grim swordsman', name: 'Not Aldric' });
  e.pos = s.player.pos ? { ...s.player.pos } : undefined;
  s.actors.push(e);
  return e;
};

describe('272 echo uniques', () => {
  it('HF3, HF18, HF24 c: the sheet keeps gear only, as soulbound copies at full pools; coin and goods stay behind', () => {
    const s = makeVillage();
    sendHero(s);
    const u = getLibrary().templates[ECHO].unique!;
    expect(u.origin).toBe('echo');
    expect(u.gear.every((g) => g.soulbound)).toBe(true);
    expect(u.gear.some((g) => g.itemId === IT.coin || g.itemId === IT.bandage)).toBe(false);
    expect(u.gear.find((g) => itemDef(s, g.itemId).shield)?.pools).toEqual({ shield: 100 });
    expect(u.gear.some((g) => itemDef(s, g.itemId).threadbound)).toBe(true);
    expect(u.achievements).toHaveLength(1);
    expect(u.ageDays).toBe(Math.round(ageYears(s, s.player)! * CONFIG.YEAR_DAYS));
    expect(u.ageDays).toBeGreaterThan(29 * CONFIG.YEAR_DAYS);
  });

  it('HF5, HF15, HF20, HF21: spawned exactly as saved at full health, under its own name; its gear is bound to it', () => {
    const s = makeVillage();
    s.player.core.condition.hpLostPct = 50;
    sendHero(s);
    const e = spawnEcho(s);
    expect(e.names.current).toBe(s.player.names.current);
    expect(e.core).toMatchObject({ generation: 'unique', origin: 'echo', templateId: ECHO, classes: s.player.core.classes, skills: s.player.core.skills });
    expect(e.core.condition.hpLostPct).toBe(0);
    expect(e.progression!.achievements).toHaveLength(1);
    expect(e.core.inventory.every((i) => i.soulbound && i.boundTo === e.id)).toBe(true);
    expect(Math.round(ageYears(s, e)! * CONFIG.YEAR_DAYS)).toBe(getLibrary().templates[ECHO].unique!.ageDays);
    expect(isEcho(e)).toBe(true);
  });

  it('HF18, HF19: soulbound gear can not be given, dropped or sold, and is not the Threadbound one of a kind; it fades on death', () => {
    const s = makeVillage();
    sendHero(s);
    s.player.core.inventory = s.player.core.inventory.filter((i) => i.id !== 'tb'); // the original is freed
    const e = spawnEcho(s), sword = e.core.inventory[0];
    expect(giveItem(s, e, sword.id, s.player.id)).toBeNull();
    expect(dropToGround(s, e, sword.id, e.zone)).toBe(false);
    const trader = s.actors.find((a) => a.id === 'trader')!;
    expect(offerList(s, e, trader).some((o) => o.id === sword.id)).toBe(false);
    const tb = e.core.inventory.find((i) => itemDef(s, i.itemId).threadbound)!;
    expect(inWorld(s, tb.itemId)).toBe(false);
    e.core.condition.hpLostPct = 1000;
    fadeSoulbound(s, e);
    expect(e.core.inventory.some((i) => i.soulbound)).toBe(false);
  });

  it('HF9, HF11: the Weaver sees it among uniques with its power and past until it is in the world; then a second cast is refused', () => {
    const s = makeVillage();
    sendHero(s);
    const v = buildWeaverView(s, { kind: 'scenario', placeId: 'tavern' });
    expect(v.catalogs.templates.some((t) => t.id === ECHO)).toBe(false);
    expect(v.catalogs.uniques).toEqual([expect.objectContaining({ id: ECHO, name: s.player.names.current, echo: true, past: expect.stringContaining('fell to a slime') })]);
    expect(v.catalogs.uniques[0].power).toBeGreaterThan(0);
    expect(v.player.power).toBeGreaterThan(0);
    const plan = villageStagePlan();
    plan.cast.push({ ...plan.cast[0], key: 'echo', template: ECHO, name: s.player.names.current });
    const ctx = { tier: 'success' as const, kind: 'scenario' as const, placeId: 'tavern' };
    expect(validateStagePlan(s, plan, ctx).some((x) => x.code === 'unique_in_world')).toBe(false);
    plan.cast.push({ ...plan.cast[0], key: 'echo_2', template: ECHO });
    expect(validateStagePlan(s, plan, ctx).some((x) => x.code === 'unique_in_world')).toBe(true);
    plan.cast.pop();
    spawnEcho(s);
    expect(uniqueInWorld(s, ECHO)).toBe(true);
    expect(buildWeaverView(s, { kind: 'scenario', placeId: 'tavern' }).catalogs.uniques).toEqual([]);
    expect(validateStagePlan(s, plan, ctx).some((x) => x.code === 'unique_in_world')).toBe(true);
  });

  it('HF2: the Narrator gets an echo\'s past as a hidden note', () => {
    const s = makeVillage();
    sendHero(s);
    spawnEcho(s);
    const seen = buildNarrationView(s, []).actors.find((a) => a.echo);
    expect(seen?.echo).toContain('fell to a slime');
  });

  it('HF29 a: a beaten echo always offers an essence; its quality roll is two tiers up and never below Common', () => {
    expect(qualityRoll(dice(1), 60, undefined, true)).toEqual({ grade: 'common', past: 0 }); // Critical Failure: floor
    expect(qualityRoll(dice(69), 60, undefined, true)).toEqual({ grade: 'fine', past: 0 }); // Near Miss + 2 = Great Success
    expect(qualityRoll(dice(96), 60, undefined, true)).toEqual({ grade: 'legendary', past: 0 }); // Critical + 2
    const s = makeVillage();
    sendHero(s);
    const e = spawnEcho(s);
    offersFromDefeats(s, [e], dice(1)); // no appearance roll: the one die is the quality roll
    expect(s.player.progression!.essenceOffers).toEqual([expect.objectContaining({ essence: ECHO_ESSENCE, grade: 'common', from: e.names.current })]);
  });

  it('HF34 a: "Send to NPC template" saves the fallen hero\'s echo sheet to the send list; once in the library, the card says so', async () => {
    const clock = new VirtualClock(), store = memoryStore();
    const idle: ScenarioDirector = { startStory: () => new Promise(() => {}), afterResolve: async () => [], afterSave: () => {} };
    const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
    const s = makeVillage();
    s.player.core.condition.hpLostPct = 100;
    await saveTurn(store, s, { storyId: s.storyId, turn: s.turn, libraryVersion: s.libraryVersion, rngBefore: 0, playerInput: '', agentLog: [], events: [], factsAdded: [] } as TurnRecord);
    expect(await g.resume()).toBe(true);
    await g.reset();
    expect(await g.sendHero('nobody')).toEqual({ error: expect.any(String) });
    const r = await g.sendHero(s.storyId);
    expect(r).toEqual({ id: `unique_${s.storyId}` });
    const [send] = await librarySends(store);
    const sheet = send.data.sheet as UniqueSheet;
    expect(send).toMatchObject({ kind: 'unique', storyId: s.storyId, name: s.player.names.current });
    expect(sheet).toMatchObject({ origin: 'echo', name: s.player.names.current, from: s.storyId });
    expect(sheet.past).toContain(`Fell on day`);
    expect(sheet.gear.every((x) => x.soulbound)).toBe(true);
    expect((await g.hallOfFame())[0]).toMatchObject({ sent: true });
    const lib = getLibrary();
    setLibrary({ ...lib, templates: { ...lib.templates, [ECHO]: uniqueTemplate(ECHO, RC.human, 'a grim swordsman', sheet) } });
    const card = (await g.hallOfFame())[0];
    expect(card.inLibrary).toBe(true);
    expect(card.sent).toBeUndefined();
  });

  it('the GM view: something the Weaver made in this story goes on the send list for review', async () => {
    const clock = new VirtualClock(), store = memoryStore();
    const idle: ScenarioDirector = { startStory: () => new Promise(() => {}), afterResolve: async () => [], afterSave: () => {} };
    const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
    const s = makeVillage();
    s.blueprints.push({ storyId: s.storyId, id: 'IT27_m2_1', kind: 'item', data: { id: 'IT27_m2_1', kind: 'weapon', name: 'Wim’s old blade' } });
    await saveTurn(store, s, { storyId: s.storyId, turn: s.turn, libraryVersion: s.libraryVersion, rngBefore: 0, playerInput: '', agentLog: [], events: [], factsAdded: [] } as TurnRecord);
    expect(await g.resume()).toBe(true);
    expect(await g.sendBlueprint('nothing')).toEqual({ error: expect.any(String) });
    expect(await g.sendBlueprint('IT27_m2_1')).toEqual({ id: `item_${s.storyId}_IT27_m2_1` });
    expect(await g.librarySends()).toEqual([expect.objectContaining({ kind: 'item', name: 'Wim’s old blade', storyId: s.storyId, data: expect.objectContaining({ id: 'IT27_m2_1' }) })]);
  });
});
