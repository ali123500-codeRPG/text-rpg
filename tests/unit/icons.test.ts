// IC1-IC5: items, containers and classes show icons from src/ui/iconArt.ts (game-icons.net and Fluent Emoji High
// Contrast, copied in by scripts/icons.mjs). Every library item and class gets a real icon; items sharing a type may
// share one. The licence credit is on the GM page.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { wholeTurn } from '../harness/turn';
import { getLibrary } from '../../src/library';
import { IT } from '../../src/library/itemIds';
import { CL } from '../../src/library/classIds';
import { ICON_ART } from '../../src/ui/iconArt';
import { classIconName, iconName, ICON_CREDIT } from '../../src/ui/itemIcons';
import { instanceItem } from '../../src/views';
import { zoneById } from '../../src/engine/relations';
import { intent } from '../cases/w4-kit';

describe('icons', () => {
  it('every library item picks an icon that exists; only the curio and unlisted misc things fall back on the pouch', () => {
    const s = wholeTurn().state;
    for (const id of Object.keys(getLibrary().items)) {
      const n = iconName(s, id);
      expect(ICON_ART[n], id).toBeTruthy();
      if (id !== IT.curio && getLibrary().items[id].kind !== 'misc') expect(n, id).not.toBe('pouch');
    }
    expect([IT.pack, IT.sack, IT.chest, IT.crate, IT.coin, IT.key].map((id) => iconName(s, id))).toEqual(['pack', 'sack', 'chest', 'crate', 'coin', 'key']);
  });

  it('every class has its own icon, so a new class gets one picked', () => {
    for (const id of Object.keys(getLibrary().classes)) if (id !== CL.commoner) expect(classIconName(id), id).not.toBe('commoner');
  });

  it('after a whole turn, the loot pop-up finds a thing inside an open chest by its instance id, in any place\'s zones', async () => {
    const g = wholeTurn();
    const z = zoneById(g.state, g.state.player.zone)!;
    z.groundItems.push({ id: 'chest_1', itemId: IT.chest, open: true, contents: [{ id: 'picks_1', itemId: IT.lockpicks }] } as never);
    await g.turn(intent({ action: { type: 'wait' } } as never));
    expect(instanceItem(g.state, 'picks_1')).toBe(IT.lockpicks);
    expect(iconName(g.state, instanceItem(g.state, 'picks_1')!)).toBe('picks');
  });

  it('the credit the CC BY licence asks for is on the GM page and in the licence file', () => {
    expect(readFileSync('src/ui/gm.ts', 'utf8')).toMatch(/h\('p', \{ class: 'hs-note' \}, ICON_CREDIT\)/);
    expect(ICON_CREDIT).toMatch(/game-icons\.net.*CC BY 3\.0/);
    expect(readFileSync('src/ui/assets/icons-LICENSE.txt', 'utf8')).toMatch(/creativecommons\.org\/licenses\/by\/3\.0/);
  });
});
