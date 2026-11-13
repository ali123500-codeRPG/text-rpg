// A Threadbound item's stats card (Equipped, the pack and the Inventory panel): each power shows the deed that wakes it
// and what that deed asks, but what a sealed power does stays hidden; a woken one is named, since it is the owner's perk.
import { describe, expect, it } from 'vitest';
import { itemRows } from '../../src/ui/pages';
import { getLibrary } from '../../src/library';
import { IT } from '../../src/library/itemIds';
import { ACH } from '../../src/library/achievementIds';
import { makeVillage } from '../harness';
import { wholeTurn, intent } from '../harness/turn';
import type { GameState } from '../../src/types';

const text = (s: GameState, it: { itemId: string; boundTo?: string }) => itemRows(s, it).map((r) => `${r.k}: ${String(r.v)}`);

describe('Threadbound powers on the item card', () => {
  it('sealed powers show their deed, never the power; a woken one is named', () => {
    const s = makeVillage(), lib = getLibrary(), loop = lib.items[IT.varos_loop].threadbound!;
    (s.player.progression!.achievements ??= []).push({ id: 'a1', key: ACH.event_crit_1, turn: 1 });
    const rows = text(s, { itemId: IT.varos_loop, boundTo: s.player.id });
    expect(rows).toContain('Threadbound: Rank IV · bound to you');
    expect(rows.find((r) => r.startsWith('Powers'))).toMatch(/^Powers: 1 of 6 awake/);
    for (const g of loop.grants) {
      const perk = lib.perks[g.perk].name, deed = lib.achievements![g.achievement].name;
      expect(rows.some((r) => r.includes(deed)), deed).toBe(true); // every deed is shown
      expect(rows.some((r) => r.includes(perk)), perk).toBe(g.achievement === ACH.event_crit_1); // only the woken power is named
    }
    expect(rows).toContain('Sealed: A hidden power · wakes with “Fortune\'s Favourite Accident”: an event roll at Critical Success+');
    expect(rows.find((r) => r.includes('Fate\'s Favourite Punchline'))).toMatch(/an event roll at Critical Failure−−$/);
  });

  it('bound to someone else, it shows no powers at all', () => {
    const s = makeVillage();
    const rows = text(s, { itemId: IT.varos_loop, boundTo: 'someone' });
    expect(rows).toContain('Threadbound: Rank IV · bound to someone else');
    expect(rows.some((r) => /^(Powers|Sealed|Awake)/.test(r))).toBe(false);
  });

  it('whole turn: a worn Loop keeps its card through a turn, sealed powers still hidden', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!;
    s.player.core.inventory.push({ id: 'loop', itemId: IT.varos_loop, qty: 1 });
    await g.turn(intent({ action: { type: 'equip', skill: '', target: null, targetPart: null, item: 'loop', mode: null, approach: '', stance: 'normal' } }), 'I put on my Varo\'s Loop');
    const worn = s.player.core.inventory.find((i) => i.id === 'loop')!;
    const rows = text(s, worn);
    expect(rows.filter((r) => r.startsWith('Sealed')).length + rows.filter((r) => r.startsWith('Awake')).length).toBe(6);
    expect(rows.some((r) => r.includes(getLibrary().perks[getLibrary().items[IT.varos_loop].threadbound!.grants[1].perk].name))).toBe(false);
  });
});
