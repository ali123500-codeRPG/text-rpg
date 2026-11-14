// 300 PO1-PO3 ("Containers and Filching", round 3): pockets. Everyone has POCKET_SLOTS pockets outside the pack, each
// holding one hand-sized thing (a stack counts as one); a worn belt with pouches or a bandolier adds its own. What you pick
// up goes into a free pocket if it fits, else the pack, and you can move things between them. In a fight, getting
// something out of the pack (or moving it between pack and pocket) takes your action; from a pocket it is free.
import { expect, it } from 'vitest';
import type { GameState, ItemInstance } from '../../src/types';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { buildPlayerView } from '../../src/views';
import { zoneById } from '../../src/engine/relations';
import { applyGearOps } from '../../src/engine/gear';
import { contentsOf, findContainer } from '../../src/engine/containers';
import { pocketSlots } from '../../src/engine/pockets';
import { checkParserLegality } from '../../src/agents/legality';
import { IT } from '../../src/library/itemIds';
import { CONFIG } from '../../src/config';

const village = (): GameState => makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
const lay = (s: GameState, ...items: ItemInstance[]) => zoneById(s, 'tav_common')!.groundItems.push(...items.map((i) => ({ ...i, at: s.player.pos && { ...s.player.pos } })));
const own = (s: GameState, id: string) => s.player.core.inventory.find((i) => i.id === id)!;
const freeAll = (s: GameState) => { // a worn pack, every pocket empty
  for (const i of s.player.core.inventory) delete i.pocket;
  if (!s.player.core.inventory.some((i) => i.equippedIn?.includes('pack'))) s.player.core.inventory.push({ id: 'player_pack', itemId: IT.pack, equippedIn: ['pack'] });
};

it('PO1/PO3: a pick-up goes into a free pocket if it fits, else the pack; pocketed things are not in the pack', () => {
  const s = village();
  freeAll(s);
  const small = Array.from({ length: CONFIG.POCKET_SLOTS + 1 }, (_, n) => ({ id: `d${n}`, itemId: IT.healing_draught, qty: 1 }));
  lay(s, ...small, { id: 'axe', itemId: IT.greataxe });
  const g = applyGearOps(s, s.player, [...small, { id: 'axe' }].map((i) => ({ op: 'pick_up' as const, item: i.id })));
  expect(g.invalid).toEqual([]);
  expect(small.map((i) => !!own(s, i.id).pocket)).toEqual([...Array(CONFIG.POCKET_SLOTS).fill(true), false]);
  expect(own(s, 'axe').pocket).toBeUndefined();
  const pack = findContainer(s, s.player.core.inventory.find((i) => i.equippedIn?.includes('pack'))!.id)!;
  expect(contentsOf(pack).map((i) => i.id)).not.toContain('d0');
  expect(contentsOf(pack).map((i) => i.id)).toContain('d4');
  const v = buildPlayerView(s);
  expect(v.player.inventory.find((i) => i.id === 'd0')!.pocket).toBe('pocket');
  expect(v.player.pockets).toEqual({ total: CONFIG.POCKET_SLOTS, used: CONFIG.POCKET_SLOTS });
});

it('PO1/PO2: a worn belt with pouches adds pockets of its own; taken off, what they held goes back to the pack', () => {
  const s = village();
  freeAll(s);
  s.player.core.inventory.push({ id: 'belt', itemId: IT.belt_pouches });
  applyGearOps(s, s.player, [{ op: 'wear_acc', item: 'belt' }]);
  expect(pocketSlots(s, s.player)).toHaveLength(CONFIG.POCKET_SLOTS + 2);
  const small = Array.from({ length: CONFIG.POCKET_SLOTS + 2 }, (_, n) => ({ id: `d${n}`, itemId: IT.healing_draught, qty: 1 }));
  lay(s, ...small);
  applyGearOps(s, s.player, small.map((i) => ({ op: 'pick_up' as const, item: i.id })));
  expect(small.every((i) => own(s, i.id).pocket)).toBe(true);
  expect(buildPlayerView(s).player.inventory.find((i) => i.id === 'd5')!.pocket).toBe('belt with pouches');
  applyGearOps(s, s.player, [{ op: 'remove_acc', item: 'belt' }]);
  expect(small.filter((i) => own(s, i.id).pocket).map((i) => i.id)).toEqual(['d0', 'd1', 'd2', 'd3']);
});

it('PO3: moving things between pack and pocket by gear op stow; the Parser may name a pocket', () => {
  const s = village();
  freeAll(s);
  s.player.core.inventory.push({ id: 'vial', itemId: IT.healing_draught, qty: 1 });
  expect(checkParserLegality(intent({ gear: [{ op: 'stow', item: 'vial', into: 'pocket' }] }), buildPlayerView(s)).gearErrors).toEqual([]);
  applyGearOps(s, s.player, [{ op: 'stow', item: 'vial', into: 'pocket' }]);
  expect(own(s, 'vial').pocket).toBe('pocket:1');
  applyGearOps(s, s.player, [{ op: 'stow', item: 'vial' }]);
  expect(own(s, 'vial').pocket).toBeUndefined();
  // a pack never goes in a pocket, nor anything too big
  const big = applyGearOps(s, s.player, [{ op: 'stow', item: s.player.core.inventory.find((i) => i.equippedIn?.includes('pack'))!.id, into: 'pocket' }]);
  expect(big.invalid).toHaveLength(1);
});

it('PO2: in a fight, a draught in the pack takes the turn to get out (the drink goes on next turn); one in a pocket is drunk at once', () => {
  const drink = (pocketed: boolean, mode: 'tactical' | 'explore') => {
    const s = village();
    freeAll(s);
    s.mode = mode;
    s.player.core.condition.hpLostPct = 30;
    s.player.core.inventory.push({ id: 'vial', itemId: IT.healing_draught, qty: 1, ...(pocketed ? { pocket: 'pocket:1' } : {}) });
    const ev = play(s, { intent: intent({ action: { type: 'use_item', item: 'vial' } }) });
    return { used: ev.some((e) => e.kind === 'use_item'), busy: !!s.player.busy };
  };
  expect(drink(true, 'tactical')).toEqual({ used: true, busy: false });
  expect(drink(false, 'tactical')).toEqual({ used: false, busy: true });
  expect(drink(false, 'explore').used).toBe(true); // out of a fight it makes no difference
});
