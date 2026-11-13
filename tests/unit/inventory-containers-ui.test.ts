// CT1 on the Inventory: a carried container lists what it holds, nested containers' contents after them with their path,
// Take out drafts a pick-up, which the game plays out of one's own sack, and Put in drafts a stow into a carried container.
import { describe, expect, it } from 'vitest';
import { dropOrder, insideOf, putInto } from '../../src/ui/pages';
import { wholeTurn, intent } from '../harness/turn';
import { IT } from '../../src/library/itemIds';
import type { ItemInstance } from '../../src/types';

describe('containers on the Inventory', () => {
  it('whole turn: a sack lists its contents nested, and taking one out removes it from the list', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!;
    s.player.core.inventory.push({ id: 'sk', itemId: IT.sack, qty: 1, contents: [{ id: 'bd', itemId: IT.bandage, qty: 1 },
      { id: 'in', itemId: IT.sack, qty: 1, contents: [{ id: 'dr', itemId: IT.healing_draught, qty: 1 }] }] } as ItemInstance);
    const sack = () => g.game.state()!.player.core.inventory.find((i) => i.id === 'sk')!;
    expect(insideOf(g.game.state()!, sack()).map((x) => x.path)).toEqual(['Bandage', 'Sack', 'Sack › Healing draught']);
    expect(insideOf(g.game.state()!, sack()).find((x) => x.it.id === 'dr')!.box.id).toBe('in');
    await g.turn(intent({ gear: [{ op: 'pick_up', item: 'bd' }], action: null }), 'I take the bandage out of my sack');
    expect(insideOf(g.game.state()!, sack()).map((x) => x.path)).toEqual(['Sack', 'Sack › Healing draught']);
    expect(g.game.state()!.player.core.inventory.some((i) => i.id === 'bd')).toBe(true);
  });

  it('whole turn: a loose item offers each carried container once, and putting it in moves it inside', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!;
    s.player.core.inventory.push({ id: 'sk', itemId: IT.sack, qty: 1, contents: [] } as ItemInstance,
      { id: 'sk2', itemId: IT.sack, qty: 1, contents: [] } as ItemInstance, { id: 'bd', itemId: IT.bandage, qty: 1 } as ItemInstance);
    const inv = () => g.game.state()!.player.core.inventory;
    expect(putInto(s, inv().find((i) => i.id === 'bd')!)).toEqual(['sack']);
    expect(putInto(s, inv().find((i) => i.id === 'sk')!)).toEqual([]); // a container never goes into another
    await g.turn(intent({ gear: [{ op: 'stow', item: 'bd', into: 'sk' }], action: null }), 'I put the bandage in my sack');
    expect(inv().some((i) => i.id === 'bd')).toBe(false);
    expect(insideOf(g.game.state()!, inv().find((i) => i.id === 'sk')!).map((x) => x.path)).toEqual(['Bandage']);
    const inner = insideOf(g.game.state()!, inv().find((i) => i.id === 'sk')!)[0];
    expect(putInto(g.game.state()!, inner.it, true)).toEqual([]);
  });

  it('whole turn: a drop drafts the right order, and the drafted put-in plays', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!;
    s.player.core.inventory.push({ id: 'sk', itemId: IT.sack, qty: 1, contents: [{ id: 'dr', itemId: IT.healing_draught, qty: 1 }] } as ItemInstance,
      { id: 'bd', itemId: IT.bandage, qty: 1 } as ItemInstance);
    expect(dropOrder(s, 'bd', { row: 'sk' })).toBe('I put the bandage in my sack'); // onto the sack's row
    expect(dropOrder(s, 'bd', { group: 'in:sk' })).toBe('I put the bandage in my sack'); // onto its "In your sack" group
    expect(dropOrder(s, 'bd', { row: 'dr' })).toBe('I put the bandage in my sack'); // onto something already inside it
    expect(dropOrder(s, 'dr', { group: 'consumables' })).toBe('I take the healing draught out of my sack');
    expect(dropOrder(s, 'dr', { row: 'sk' })).toBeNull(); // already there
    expect(dropOrder(s, 'sk', { row: 'sk' })).toBeNull();
    expect(dropOrder(s, 'bd', { group: 'consumables' })).toBeNull(); // loose onto loose: nothing to do
    await g.turn(intent({ gear: [{ op: 'stow', item: 'bd', into: 'sk' }], action: null }), dropOrder(s, 'bd', { row: 'sk' })!);
    expect(insideOf(g.game.state()!, g.game.state()!.player.core.inventory.find((i) => i.id === 'sk')!).map((x) => x.path)).toEqual(['Healing draught', 'Bandage']);
  });
});
