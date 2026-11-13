// 223 CT1–CT7 (Containers and Filching): a container is an item with contents. Opening one is the turn's action and shows
// what is inside; taking out is a pick-up. A locked one opens with its key or a Lockpicking roll. One whose owner is up
// to guard it is theft (refused until Filching, FL3). A worn pack holds its wearer's stowed items: a downed or yielded
// wearer's pack opens freely, and taking the pack takes them with it. The Weaver places containers and fills them.
import { expect, it } from 'vitest';
import type { GameState, StagePlan } from '../../src/types';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { buildPlayerView } from '../../src/views';
import { zoneById, actorById } from '../../src/engine/relations';
import { IT } from '../../src/library/itemIds';
import { starterKit } from '../../src/library/spawn';
import { checkParserLegality } from '../../src/agents/legality';
import { tidyContainers, tidyRewards } from '../../src/scenario/validate';

const village = (): GameState => makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
const chest = (s: GameState, extra: object = {}) => {
  zoneById(s, 'tav_common')!.groundItems.push({ id: 'box', itemId: IT.chest, contents: [{ id: 'cup', itemId: IT.curio }], ...extra });
  return zoneById(s, 'tav_common')!.groundItems.find((i) => i.id === 'box')!;
};
const boxView = (s: GameState) => buildPlayerView(s).zone.groundItems.find((g) => g.id === 'box')!.container!;

it('CT1/CT3: a shut chest hides its contents; opening it is the action and shows them; taking out is a pick-up; the chest stays', () => {
  const s = village();
  chest(s);
  expect(boxView(s).contents).toBeUndefined();
  const ev = play(s, { intent: intent({ action: { type: 'open', target: 'box' } }) });
  expect(ev.some((e) => e.kind === 'open' && e.itemId === 'box')).toBe(true);
  expect(boxView(s)).toMatchObject({ open: true, contents: [{ id: 'cup', name: 'curio' }] });
  const legal = checkParserLegality(intent({ gear: [{ op: 'pick_up', item: 'cup' }, { op: 'pick_up', item: 'box' }] }), buildPlayerView(s));
  expect(legal.gearErrors).toEqual([]);
  play(s, { intent: legal.intent });
  expect(s.player.core.inventory.some((i) => i.id === 'cup')).toBe(true);
  expect(s.player.core.inventory.some((i) => i.id === 'box')).toBe(false); // CT1: fixed
  expect(boxView(s).contents).toEqual([]);
});

it('CT3: a locked chest stays shut without its key, opens with it, and its lock can be picked', () => {
  const s = village();
  const c = chest(s, { lock: { locked: true }, grade: 'minor' });
  expect(boxView(s).lock).toBe('locked');
  const ev = play(s, { intent: intent({ action: { type: 'open', target: 'box' } }) });
  expect(ev.find((e) => e.kind === 'wasted')?.reason).toBe('locked');
  s.player.core.inventory.push({ id: 'k', itemId: IT.key, opens: ['box'] });
  expect(boxView(s).key).toBe(true);
  play(s, { intent: intent({ action: { type: 'open', target: 'box' } }) });
  expect(c.open).toBe(true);
  expect(c.lock!.locked).toBe(false);
  // a pick targets the container (legal for the player), and resolves as a pick, never a "no lock" on a way
  const t = village();
  chest(t, { lock: { locked: true }, grade: 'none' });
  expect(checkParserLegality(intent({ action: { type: 'pick', target: 'box' } }), buildPlayerView(t)).illegal).toEqual([]);
  const pev = play(t, { intent: intent({ action: { type: 'pick', target: 'box' } }) });
  expect(pev.some((e) => e.kind === 'pick' && e.itemId === 'box' && !!e.way)).toBe(true);
});

it('CT4: a chest whose owner is up and present is theft: refused until Filching; with the owner down it opens', () => {
  const s = village();
  chest(s, { owner: 'patron_1' });
  const ev = play(s, { intent: intent({ action: { type: 'open', target: 'box' } }) });
  expect(ev.find((e) => e.kind === 'wasted')?.reason).toBe('theft');
  actorById(s, 'patron_1')!.core.condition.hpLostPct = 100;
  play(s, { intent: intent({ action: { type: 'open', target: 'box' } }) });
  expect(boxView(s).open).toBe(true);
});

it('CT5/CT7: a downed wearer\'s pack opens and shows what they carried; taking the pack takes it all, and one who wears none puts it on', () => {
  const s = village();
  const p = actorById(s, 'patron_1')!;
  p.pos = s.player.pos && { ...s.player.pos };
  p.zone = s.player.zone;
  p.core.inventory.push({ id: 'pk', itemId: IT.pack, equippedIn: ['pack'] }, { id: 'loot', itemId: IT.curio });
  const seen = () => buildPlayerView(s).actors.find((a) => a.id === 'patron_1')!.gear.find((g) => g.id === 'pk')!;
  expect(seen().where).toBe('pack');
  expect(seen().container!.contents).toBeUndefined();
  // up and guarding it: theft
  expect(play(s, { intent: intent({ action: { type: 'open', target: 'pk' } }) }).find((e) => e.kind === 'wasted')?.reason).toBe('theft');
  p.core.condition.hpLostPct = 100;
  play(s, { intent: intent({ action: { type: 'open', target: 'pk' } }) });
  expect(seen().container!.contents!.map((c) => c.id)).toContain('loot');
  play(s, { intent: intent({ gear: [{ op: 'pick_up', item: 'pk', from: 'patron_1' }] }) });
  const pk = s.player.core.inventory.find((i) => i.id === 'pk')!;
  expect(pk.equippedIn).toEqual(['pack']); // the player wore none: it is put on
  expect(s.player.core.inventory.some((i) => i.id === 'loot')).toBe(true); // what it held is now carried in it
  expect(p.core.inventory.some((i) => i.id === 'loot')).toBe(false);
});

it('CT7: a new character starts wearing a plain pack', () => {
  const s = village();
  expect(starterKit(s.player).find((i) => i.itemId === IT.pack)?.equippedIn).toEqual(['pack']);
});

it('CT2: the Weaver\'s containers are checked (bad ones dropped) and rewards go in by key', () => {
  const s = village();
  const plan = {
    cast: [], zones: [],
    containers: [
      { key: 'cellar_chest', item: IT.chest, place: { groundIn: 'tav_common' }, owner: 'patron_1', locked: { keys: ['patron_1'] } },
      { key: 'carried_chest', item: IT.chest, place: { carriedBy: 'patron_1' } }, // a chest can't be carried
      { key: 'not_a_box', item: IT.dagger, place: { groundIn: 'tav_common' } },
    ],
    rewards: [{ item: IT.curio, place: { in: 'cellar_chest' } }, { item: IT.curio, place: { in: 'not_a_box' } }],
    event: { summary: '', challenge: 'minor', gain: 'moderate' },
  } as unknown as StagePlan;
  const tc = tidyContainers(s, plan);
  expect(tc.containers.map((c) => c.key)).toEqual(['cellar_chest']);
  expect(tc.notes.map((n) => n.code)).toEqual(['container_dropped', 'container_dropped']);
  expect(tidyRewards(s, plan).rewards.map((r) => (r.place as { in?: string }).in)).toEqual(['cellar_chest']);
});
