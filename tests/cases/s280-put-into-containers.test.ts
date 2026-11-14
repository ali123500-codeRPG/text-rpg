// 280 PI1–PI4 (carried gear is one item in the inventory, and things can be placed inside it): putting things into a container is free gear, like stowing: gear op stow with into, a sack one carries or an open
// chest or crate within reach that is not someone else's to guard. How much a container holds is parked (D-254);
// a stack can go in part; a container never goes inside another; worn things come off first; into a worn pack is a
// plain stow (CT7). Taking it out again is pick_up. The inventory lists what each carried container holds.
import { expect, it } from 'vitest';
import type { GameState } from '../../src/types';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { wholeTurn } from '../harness/turn';
import { actorById, zoneById } from '../../src/engine/relations';
import { IT } from '../../src/library/itemIds';
import { checkNpcLegality, checkParserLegality } from '../../src/agents/legality';
import { buildOppositionView, buildPlayerView } from '../../src/views';
import type { NpcAction } from '../../src/types';

const village = (): GameState => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  s.player.core.inventory.push({ id: 'sack', itemId: IT.sack }, { id: 'knife', itemId: IT.dagger }, { id: 'purse', itemId: IT.coin, qty: 10 });
  return s;
};
const sack = (s: GameState) => s.player.core.inventory.find((i) => i.id === 'sack')!;
const has = (s: GameState, id: string) => s.player.core.inventory.some((i) => i.id === id);

it('PI1: putting a knife into your sack is free gear: it leaves your inventory, the sack lists it, the action still happens', () => {
  const s = village();
  const i = intent({ gear: [{ op: 'stow', item: 'knife', into: 'sack' }], action: { type: 'wait' } });
  expect(checkParserLegality(i, buildPlayerView(s)).gearErrors).toEqual([]);
  const ev = play(s, { intent: i });
  expect(has(s, 'knife')).toBe(false);
  expect(sack(s).contents?.map((x) => x.id)).toEqual(['knife']);
  expect(ev.some((e) => e.kind === 'put_in' && e.into === 'sack')).toBe(true);
  expect(ev.some((e) => e.actorId === 'player' && e.kind === 'wait')).toBe(true);
  expect(buildPlayerView(s).player.inventory.find((x) => x.id === 'sack')?.container?.contents).toEqual([{ id: 'knife', name: 'dagger' }]);
});

it('PI1: taking it out again is pick_up', () => {
  const s = village();
  play(s, { intent: intent({ gear: [{ op: 'stow', item: 'knife', into: 'sack' }] }) });
  const i = intent({ gear: [{ op: 'pick_up', item: 'knife' }] });
  expect(checkParserLegality(i, buildPlayerView(s)).gearErrors).toEqual([]);
  play(s, { intent: i });
  expect(has(s, 'knife')).toBe(true);
  expect(sack(s).contents).toEqual([]);
});

it('PI2: part of a stack goes in, and more of it joins the same stack', () => {
  const s = village();
  play(s, { intent: intent({ gear: [{ op: 'stow', item: 'purse', into: 'sack', qty: 4 }] }) });
  play(s, { intent: intent({ gear: [{ op: 'stow', item: 'purse', into: 'sack', qty: 2 }] }) });
  expect(s.player.core.inventory.find((x) => x.id === 'purse')?.qty).toBe(4);
  expect(sack(s).contents?.map((x) => x.qty)).toEqual([6]);
  expect(buildPlayerView(s).player.inventory.find((x) => x.id === 'sack')?.container?.contents?.[0].qty).toBe(6);
});

it('PI3: a container holds anything (size is parked); a container never goes in another; worn things come off first', () => {
  const s = village();
  s.player.core.inventory.push({ id: 'axe', itemId: IT.greataxe }, { id: 'spear', itemId: IT.spear }, { id: 'sack2', itemId: IT.sack });
  play(s, { intent: intent({ gear: [{ op: 'stow', item: 'axe', into: 'sack' }, { op: 'stow', item: 'spear', into: 'sack' }, { op: 'stow', item: 'knife', into: 'sack' }, { op: 'stow', item: 'sack2', into: 'sack' }] }) });
  expect(sack(s).contents?.map((x) => x.id)).toEqual(['axe', 'spear', 'knife']);
  expect(has(s, 'sack2')).toBe(true);
  const armor = s.player.core.inventory.find((x) => x.equippedIn?.includes('armor'))!;
  const s2 = village();
  play(s2, { intent: intent({ gear: [{ op: 'stow', item: armor.id, into: 'sack' }] }) });
  expect(sack(s2).contents ?? []).toEqual([]);
});

it('PI4: into a worn pack is a plain stow; into an open chest within reach works; a guarded or shut one does not', () => {
  const s = village();
  s.player.core.inventory.push({ id: 'pack', itemId: IT.pack, equippedIn: ['pack'] });
  const pack = s.player.core.inventory.find((x) => x.equippedIn?.includes('pack'))!;
  const held = s.player.core.inventory.find((x) => x.equippedIn?.some((e) => e.startsWith('grip:')))!;
  play(s, { intent: intent({ gear: [{ op: 'stow', item: held.id, into: pack.id }] }) });
  expect(s.player.core.inventory.find((x) => x.id === held.id)?.equippedIn).toBeUndefined();
  const z = zoneById(s, 'tav_common')!;
  z.groundItems.push({ id: 'box', itemId: IT.chest, open: true, contents: [], ...(s.player.pos ? { at: { ...s.player.pos } } : {}) },
    { id: 'shut', itemId: IT.chest, contents: [], ...(s.player.pos ? { at: { ...s.player.pos } } : {}) },
    { id: 'theirs', itemId: IT.chest, open: true, owner: 'patron_1', contents: [], ...(s.player.pos ? { at: { ...s.player.pos } } : {}) });
  expect(actorById(s, 'patron_1')).toBeTruthy();
  play(s, { intent: intent({ gear: [{ op: 'stow', item: 'knife', into: 'shut' }, { op: 'stow', item: 'knife', into: 'theirs' }] }) });
  expect(has(s, 'knife')).toBe(true);
  play(s, { intent: intent({ gear: [{ op: 'stow', item: 'knife', into: 'box' }] }) });
  expect(z.groundItems.find((x) => x.id === 'box')?.contents?.map((x) => x.id)).toEqual(['knife']);
});

it('PI1: the Parser may only put things into a container the player knows', () => {
  const s = village();
  expect(checkParserLegality(intent({ gear: [{ op: 'stow', item: 'knife', into: 'nowhere' }] }), buildPlayerView(s)).gearErrors).toEqual(['gear stow knife']);
});

it('whole turn: the Narrator hears what went in and sees what the sack holds', async () => {
  const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  g.game.state()!.player.core.inventory.push({ id: 'sack', itemId: IT.sack }, { id: 'knife', itemId: IT.dagger });
  await g.turn(intent({ gear: [{ op: 'stow', item: 'knife', into: 'sack' }], action: { type: 'wait' } }));
  const req = g.claude.callsFor('narrator').at(-1) as { input: { content: string }[] };
  expect(req.input[1].content).toContain('"into":"sack"');
  expect(req.input[1].content).toContain('holding dagger');
});

it('BG-192, 196, 198, 205: an NPC may name what is in its own sack, to give it or to take it out (Wren, story mwf2lt7l t23)', () => {
  const s = village();
  const wim = actorById(s, 'patron_1')!;
  wim.core.inventory.push({ id: 'wim_sack', itemId: IT.sack, contents: [{ id: 'charm', itemId: IT.coin }] });
  const out = { action: { type: 'give', target: 'player', item: 'charm', mode: null } as unknown as NpcAction, gear: [{ op: 'pick_up' as const, item: 'charm', from: 'patron_1' }], stance: null };
  const r = checkNpcLegality(out, buildOppositionView(s, 'patron_1'), new Set(['player', 'patron_1', 'charm']), ['player']); // Wren knew Happi
  expect(r).toEqual({ orderError: null, errors: [] });
  expect(out.action.item).toBe('charm');
  expect(out.gear).toHaveLength(1);
});
