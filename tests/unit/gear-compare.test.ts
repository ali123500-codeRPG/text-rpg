// P1 gear compare: an item the player could equip shows what equipping it would change against what they have on,
// figure by figure with ▲ or ▼; it reads the Character page's own figures on a copy and never touches the real player.
import { describe, expect, it } from 'vitest';
import { itemRows } from '../../src/ui/pages';
import { compareRows, tryOn } from '../../src/ui/compare';
import { IT } from '../../src/library/itemIds';
import { zoneById } from '../../src/engine/relations';
import { makeVillage, lay } from '../harness';
import type { GameState } from '../../src/types';
import { groundIn } from '../../src/engine/ground';

const text = (s: GameState, id: string) => compareRows(s, { id }).map((r) => `${r.k}: ${String(r.v)}`);
const give = (s: GameState, itemId: string) => { const it = { id: `t_${itemId}`, itemId, qty: 1 }; s.player.core.inventory.push(it); return it; };

describe('gear compare (P1)', () => {
  it('a pack item names what it replaces and each changed figure, old → new with an arrow', () => {
    const s = makeVillage(), before = JSON.stringify(s.player);
    const cap = give(s, IT.sallet);
    const rows = text(s, cap.id);
    expect(rows[0]).toMatch(/^Compared with: /);
    expect(rows.find((r) => r.startsWith('Protection · head'))).toMatch(/→ .*▲ \+/);
    expect(JSON.stringify(s.player)).toBe(JSON.stringify({ ...JSON.parse(before), core: { ...JSON.parse(before).core, inventory: [...JSON.parse(before).core.inventory, cap] } }));
  });

  it('a skill the item raises shows its effective value going up', () => {
    const s = makeVillage();
    const sp = give(s, IT.spectacles);
    expect(text(s, sp.id).find((r) => r.startsWith('Eyesight'))).toMatch(/▲ \+\d/);
  });

  it('nothing to compare for what is already on or cannot be equipped', () => {
    const s = makeVillage();
    const on = s.player.core.inventory.find((i) => i.equippedIn?.length)!;
    expect(compareRows(s, on)).toEqual([]);
    expect(compareRows(s, give(s, IT.bandage))).toEqual([]);
  });

  it('the item card carries the compare rows', () => {
    const s = makeVillage();
    const sp = give(s, IT.spectacles);
    expect(itemRows(s, sp).some((r) => r.k === 'Compared with')).toBe(true);
  });

  it('loot on the ground compares as if taken, and stays on the ground', () => {
    const s = makeVillage();
    lay(s, s.player.zone, { id: 'g_spec', itemId: IT.spectacles, qty: 1 }, s.player.pos);
    expect(tryOn(s, 'g_spec')).not.toBeNull();
    expect(text(s, 'g_spec')[0]).toMatch(/^Compared with: /);
    expect(s.player.core.inventory.some((i) => i.id === 'g_spec')).toBe(false);
    expect(groundIn(s, s.player.zone).some((i) => i.id === 'g_spec')).toBe(true);
  });
});
