// 298 BF31 (Bug Fix Questions, approved base): breaking a locked container open. It is the turn's action, loud (heard
// like a shout), within grip reach. A sack or pack is cut open by an edged weapon in hand with no roll; otherwise it is a
// roll of the melee weapon in hand (bare hands: Improvised) at the lock's grade, the modifier Lockpicking uses. Success
// or better opens it and breaks its lock for good. What it does to what is inside, and breaking one its owner guards
// (BK1-BK6): s299-break-fragility.
import { expect, it } from 'vitest';
import type { GameState } from '../../src/types';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { buildPlayerView } from '../../src/views';
import { zoneById } from '../../src/engine/relations';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';
import { checkParserLegality } from '../../src/agents/legality';

const village = (): GameState => makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
const box = (s: GameState, itemId: string = IT.chest, extra: object = {}) => {
  zoneById(s, 'tav_common')!.groundItems.push({ id: 'box', itemId, contents: [{ id: 'cup', itemId: IT.curio }], lock: { locked: true }, grade: 'minor', ...extra });
  return zoneById(s, 'tav_common')!.groundItems.find((i) => i.id === 'box')!;
};
const bare = (s: GameState) => { for (const i of s.player.core.inventory) if (i.equippedIn?.some((g) => g.startsWith('grip:'))) i.equippedIn = []; };

it('BF31: breaking a locked chest is a loud roll; Success opens it and breaks its lock for good, else it stays locked', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const s = village(), c = box(s);
    expect(checkParserLegality(intent({ action: { type: 'break', target: 'box' } }), buildPlayerView(s)).illegal).toEqual([]);
    const ev = play(s, { intent: intent({ action: { type: 'break', target: 'box' } }) }, seed).find((e) => e.kind === 'break_open')!;
    expect(ev.noise).toBe('loud');
    expect(ev.roll).toBeDefined();
    if (ev.breakOpen!.opened) expect([c.open, c.lock]).toEqual([true, { locked: false, broken: true }]);
    else expect(c.lock!.locked).toBe(true);
  }
});

it('BF31: bare hands roll Improvised; a strong arm opens it', () => {
  const s = village(), c = box(s);
  bare(s);
  s.player.core.skills[SK.unarmed_improvised] = { raw: 300 } as never;
  const ev = play(s, { intent: intent({ action: { type: 'break', target: 'box' } }) }).find((e) => e.kind === 'break_open')!;
  expect(ev.roll!.skill).toBe(SK.unarmed_improvised);
  expect(c.open).toBe(true);
});

it('BF31: a blade in hand cuts a locked sack open with no roll', () => {
  const s = village(), c = box(s, IT.sack);
  const ev = play(s, { intent: intent({ action: { type: 'break', target: 'box' } }) }).find((e) => e.kind === 'break_open')!;
  expect(ev.breakOpen).toEqual({ opened: true, cut: true });
  expect(ev.roll).toBeUndefined();
  expect(c.open).toBe(true);
});

it('BF31: nothing to break when it is not locked', () => {
  const s = village();
  box(s, IT.chest, { lock: undefined });
  expect(play(s, { intent: intent({ action: { type: 'break', target: 'box' } }) }).find((e) => e.kind === 'wasted')?.reason).toBe('not_locked');
});
