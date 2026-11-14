// 299 BK1-BK6 ("Breaking things open, guards and locked boxes"): forcing a container open checks its break roll against
// everything inside. Each item has a fragility (Fragile breaks at Near Miss or worse, Delicate at Failure, Sturdy at
// Critical Failure, Tough at Critical Failure−, Solid at Critical Failure−−, Unbreakable never; by kind unless the row or
// the Weaver sets it). What breaks stays as its broken version: tagged 'broken', named "broken ...", worth a share, doing
// nothing; a stack breaks together. Rolled opens count toward a 1/10/50 chain whose every level moves the lines one tier
// worse. Breaking one its owner guards is theft seen: those who made it out clearly catch you, as caught Filching.
import { expect, it } from 'vitest';
import type { GameState, ItemInstance } from '../../src/types';
import { makeVillage } from '../harness';
import { actor } from '../harness/village';
import { intent, play } from './w4-kit';
import { buildNarrationView } from '../../src/views';
import { stance, zoneById } from '../../src/engine/relations';
import { itemDef } from '../../src/library';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';
import { ACH } from '../../src/library/achievementIds';
import { grantAchievement } from '../../src/engine/xp';
import { breakInside, breakLine, fragilityOf } from '../../src/engine/breakage';
import { mint } from '../../src/scenario/apply';
import { itemValue } from '../../src/ruleset/value';
import { tierLevel } from '../../src/ruleset';
import { STANCES } from '../../src/scales';
import { CONFIG } from '../../src/config';

const village = (): GameState => makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
const inside = (): ItemInstance[] => [
  { id: 'vial', itemId: IT.healing_draught, qty: 3 }, { id: 'charm', itemId: IT.lucky_charm }, { id: 'coat', itemId: IT.boiled_leather },
  { id: 'picks', itemId: IT.lockpicks }, { id: 'blade', itemId: IT.dagger }, { id: 'purse', itemId: IT.coin, qty: 12 },
];
const box = (s: GameState, extra: object = {}) => {
  zoneById(s, 'tav_common')!.groundItems.push({ id: 'box', itemId: IT.chest, contents: inside(), lock: { locked: true }, grade: 'minor', ...extra });
  return zoneById(s, 'tav_common')!.groundItems.find((i) => i.id === 'box')!;
};
const broken = (s: GameState, list: ItemInstance[]) => list.filter((i) => itemDef(s, i.itemId).tags?.includes('broken')).map((i) => i.id);

it('BK1: fragility by kind, with tools between armor and weapons; coin, keys and Threadbound items never break', () => {
  const s = village();
  const f = (id: string) => fragilityOf(itemDef(s, id));
  expect([IT.healing_draught, IT.lucky_charm, IT.signet_ring, IT.boiled_leather, IT.lockpicks, IT.dagger, IT.coin, IT.key, IT.varos_loop].map(f))
    .toEqual(['fragile', 'delicate', 'delicate', 'sturdy', 'tough', 'solid', 'unbreakable', 'unbreakable', 'unbreakable']);
  const line = (id: string) => breakLine(itemDef(s, id));
  expect(line(IT.boiled_leather)! > line(IT.lockpicks)! && line(IT.lockpicks)! > line(IT.dagger)!).toBe(true);
  expect(line(IT.coin)).toBeNull();
});

it('BK2/BK3: one roll checks everything inside; what it reaches becomes its broken version, a stack together', () => {
  const at = (tier: string, beyond?: number) => {
    const s = village(), list = inside();
    breakInside(s, s.player, list, { tier: tier as never, ...(beyond ? { beyond } : {}) });
    return { s, list, hit: broken(s, list) };
  };
  expect(at('success').hit).toEqual([]);
  expect(at('near_miss').hit).toEqual(['vial']);
  expect(at('failure').hit).toEqual(['vial', 'charm']);
  expect(at('critical_failure').hit).toEqual(['vial', 'charm', 'coat']);
  expect(at('critical_failure', -1).hit).toEqual(['vial', 'charm', 'coat', 'picks']);
  expect(at('critical_failure', -2).hit).toEqual(['vial', 'charm', 'coat', 'picks', 'blade']);
  const { s, list } = at('critical_failure', -2);
  const vial = list.find((i) => i.id === 'vial')!, coat = itemDef(s, list.find((i) => i.id === 'coat')!.itemId);
  expect(vial.qty).toBe(3);
  expect(itemDef(s, vial.itemId).name).toBe('broken healing draught');
  expect(itemDef(s, vial.itemId).heal).toBeUndefined();
  expect(coat.armor).toBeUndefined();
  expect(coat.value).toBe(Math.round(itemValue(s, itemDef(s, IT.boiled_leather)) * CONFIG.BROKEN_VALUE_SHARE));
  // a broken item never breaks again, and one blueprint serves every copy
  breakInside(s, s.player, list, { tier: 'critical_failure', beyond: -2 });
  expect(s.blueprints.filter((b) => b.id === `${IT.healing_draught}_broken`)).toHaveLength(1);
});

it('BK1 c: the Weaver can set how fragile an item it makes is', () => {
  const s = village();
  const id = mint(s, { base: IT.curio, quality: 'quality_1', boosts: 'hitAdj', name: 'glass bird', look: 'a tiny blown-glass bird', fragility: 'fragile' }, 1);
  expect(fragilityOf(itemDef(s, id))).toBe('fragile');
});

it('BK2: a real break roll checks what is inside against its own tier; the narration names it only once it is open', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const s = village(), c = box(s);
    s.player.core.skills[SK.unarmed_improvised] = { raw: 0 } as never;
    for (const i of s.player.core.inventory) if (i.equippedIn?.some((g) => g.startsWith('grip:'))) i.equippedIn = [];
    const evs = play(s, { intent: intent({ action: { type: 'break', target: 'box' } }) }, seed);
    const ev = evs.find((e) => e.kind === 'break_open')!;
    const want = inside().filter((i) => { const l = breakLine(itemDef(s, i.itemId)); return l !== null && tierLevel(ev.roll!) <= l; }).map((i) => i.id);
    expect(broken(s, c.contents!)).toEqual(want);
    expect(ev.breakOpen!.broke ?? []).toEqual(want);
    const said = buildNarrationView(s, evs).events.find((e) => e.kind === 'break_open')!.breakOpen!;
    if (want.length) expect(said.broke).toEqual(ev.breakOpen!.opened ? want.map((id) => itemDef(s, c.contents!.find((i) => i.id === id)!.itemId).name) : ['something inside']);
  }
});

it('BK4: a rolled open counts toward the chain; each level moves every line one tier worse', () => {
  const s = village();
  box(s);
  s.player.core.skills[SK.unarmed_improvised] = { raw: 400 } as never;
  for (const i of s.player.core.inventory) if (i.equippedIn?.some((g) => g.startsWith('grip:'))) i.equippedIn = [];
  play(s, { intent: intent({ action: { type: 'break', target: 'box' } }) });
  expect(s.player.progression!.tally!.broke_open).toBe(1);
  expect(s.player.progression!.achievements!.some((x) => x.key === ACH.broke_open_1)).toBe(true);
  const list = inside();
  breakInside(s, s.player, list, { tier: 'near_miss' });
  expect(broken(s, list)).toEqual([]); // Fragile now breaks only at Failure or worse
  grantAchievement(s, ACH.broke_open_10);
  grantAchievement(s, ACH.broke_open_50);
  const again = inside();
  breakInside(s, s.player, again, { tier: 'critical_failure' });
  expect(broken(s, again)).toEqual([]);
  breakInside(s, s.player, again, { tier: 'critical_failure', beyond: -1 });
  expect(broken(s, again)).toEqual(['vial']); // three steps: Fragile at Critical Failure−, the rest further
});

it('BK6: breaking a container its owner guards, under their eyes, is theft seen: no contest, the owner two steps colder and remembering', () => {
  const s = village(), c = box(s, { owner: 'patron_1' });
  const wim = actor(s, 'patron_1');
  const before = STANCES.pos(stance(s, wim, s.player) as never);
  s.player.core.skills[SK.unarmed_improvised] = { raw: 400 } as never;
  for (const i of s.player.core.inventory) if (i.equippedIn?.some((g) => g.startsWith('grip:'))) i.equippedIn = [];
  const evs = play(s, { intent: intent({ action: { type: 'break', target: 'box' } }) });
  expect(evs.some((e) => e.kind === 'filch' || e.kind === 'wasted')).toBe(false);
  expect(c.open).toBe(true);
  expect(STANCES.pos(stance(s, wim, s.player) as never)).toBe(Math.max(0, before - CONFIG.FILCH_CAUGHT_OWNER_STEPS));
  expect(s.hidden.memory.patron_1?.some((m) => /caught .* trying to steal my chest/.test(m.text))).toBe(true);
});

it('BK6 (searches): letting someone search you does not let them break your locked box; it is theft seen all the same', () => {
  const s = village();
  const wim = actor(s, 'patron_1');
  s.zones.find((z) => z.id === 'tav_common')!.groundItems = s.zones.find((z) => z.id === 'tav_common')!.groundItems.filter((i) => i.id !== 'box');
  wim.core.inventory.push({ id: 'box', itemId: IT.sack, contents: inside(), lock: { locked: true }, grade: 'minor' });
  wim.letsSearch = { by: s.player.id, until: s.turn + 2 };
  const before = STANCES.pos(stance(s, wim, s.player) as never);
  const evs = play(s, { intent: intent({ action: { type: 'break', target: 'box' } }) });
  expect(evs.find((e) => e.kind === 'break_open')?.breakOpen).toEqual({ opened: true, cut: true });
  expect(STANCES.pos(stance(s, wim, s.player) as never)).toBe(Math.max(0, before - CONFIG.FILCH_CAUGHT_OWNER_STEPS));
});
