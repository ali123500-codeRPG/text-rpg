// CT1 on the Inventory: a carried container lists what it holds, nested containers' contents after them with their path,
// and Take out drafts a pick-up, which the game plays out of one's own sack.
import { describe, expect, it } from 'vitest';
import { insideOf } from '../../src/ui/pages';
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
});
