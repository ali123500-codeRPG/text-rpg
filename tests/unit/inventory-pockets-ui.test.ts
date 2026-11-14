// PO1-PO3 on the Inventory: your own pockets and each worn piece's pockets are their own sections, apart from the pack, and a
// drag (or To a pocket / To the pack) sends the words the Parser turns into gear op stow, into "pocket" or back to the pack.
import { describe, expect, it } from 'vitest';
import { pocketGroups, pocketWords } from '../../src/ui/pages';
import { wholeTurn, intent } from '../harness/turn';
import { IT } from '../../src/library/itemIds';
import { CONFIG } from '../../src/config';
import type { ItemInstance } from '../../src/types';

const village = () => {
  const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
  const s = g.game.state()!;
  for (const i of s.player.core.inventory) delete i.pocket;
  s.player.core.inventory.push({ id: 'belt', itemId: IT.belt_pouches, qty: 1, equippedIn: ['acc:2'] } as ItemInstance,
    { id: 'bd', itemId: IT.bandage, qty: 1 } as ItemInstance, { id: 'dr', itemId: IT.healing_draught, qty: 1, pocket: 'belt:1' } as ItemInstance);
  return g;
};

describe('pockets on the Inventory', () => {
  it('your own pockets first, then one section per worn piece with pockets, each slot with what is in it', () => {
    const s = village().game.state()!;
    const groups = pocketGroups(s);
    expect(groups.map((x) => [x.title, x.slots.length])).toEqual([['Pockets', CONFIG.POCKET_SLOTS], ['Belt with pouches', 2]]);
    expect(groups[1].slots[0].it?.id).toBe('dr');
  });
  it('a small thing in the pack offers a pocket; a pocketed one offers the pack; worn gear and containers offer neither', () => {
    const s = village().game.state()!;
    expect(pocketWords(s, 'bd', 'pocket')).toBe('I put my bandage in a pocket');
    expect(pocketWords(s, 'bd', 'pack')).toBeNull();
    expect(pocketWords(s, 'dr', 'pack')).toBe('I put my healing draught back in my pack');
    expect(pocketWords(s, 'dr', 'pocket')).toBeNull();
    expect(pocketWords(s, 'belt', 'pocket')).toBeNull();
  });
  it('no free pocket: nothing more can go in', () => {
    const s = village().game.state()!;
    for (let n = 0; n < CONFIG.POCKET_SLOTS + 1; n++) s.player.core.inventory.push({ id: `x${n}`, itemId: IT.bandage, qty: 1, pocket: n < CONFIG.POCKET_SLOTS ? `pocket:${n + 1}` : 'belt:2' } as ItemInstance);
    expect(pocketWords(s, 'bd', 'pocket')).toBeNull();
  });
  it('whole turn: the stow the words become moves the bandage into your own pocket, and the section shows it', async () => {
    const g = village();
    await g.turn(intent({ gear: [{ op: 'stow', item: 'bd', into: 'pocket' }], action: null }), 'I put my bandage in a pocket');
    const s = g.game.state()!;
    expect(pocketGroups(s)[0].slots.map((x) => x.it?.id)).toContain('bd');
    expect(pocketWords(s, 'bd', 'pack')).toBe('I put my bandage back in my pack');
    await g.turn(intent({ gear: [{ op: 'stow', item: 'bd' }], action: null }), 'I put my bandage back in my pack');
    expect(pocketGroups(g.game.state()!)[0].slots.some((x) => x.it?.id === 'bd')).toBe(false);
  });
});
