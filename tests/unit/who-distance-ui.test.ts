// Pointing at someone on Who's here shows how far they are, where if not in your zone, and whether your longest weapon in
// hand reaches them. Reach and distance are metres (case 92), so a bow reaches someone in sight in another zone.
import { describe, expect, it } from 'vitest';
import { whoDistance } from '../../src/ui/play';
import { buildPlayerView } from '../../src/views';
import { wholeTurn, intent } from '../harness/turn';
import { byDoor } from '../harness';
import { IT } from '../../src/library/itemIds';
import type { PlayerView } from '../../src/types';

describe("Who's here: distance and reach", () => {
  it('whole turn: someone in sight in the next zone reads their metres, their zone, and in reach of your shortbow', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
    const s = g.game.state()!;
    s.player.core.inventory.push({ id: 'bw', itemId: IT.shortbow });
    byDoor(s, 'patron_1', 'tav_counter', 'tav_common', 1).mind!.slots!.seat = 'tav_counter';
    byDoor(s, 'player', 'tav_common', 'tav_counter', 4);
    const gear = [{ op: 'stow' as const, item: `player_${IT.arming_sword}_1` }, { op: 'stow' as const, item: `player_${IT.round_shield}_2` }, { op: 'draw' as const, item: 'bw' }];
    await g.turn(intent({ gear, action: null, move: null }), 'I ready my bow');
    const pv = buildPlayerView(g.game.state()!);
    expect(pv.player.reaches?.[0]).toEqual({ name: 'shortbow', metres: 50 });
    const patron = pv.actors.find((a) => a.id === 'patron_1' && a.level === 'full')!;
    expect(patron.zone).toBe('tav_counter');
    const name = pv.zones.find((z) => z.id === 'tav_counter')!.name;
    expect(patron.distanceM).toBeGreaterThan(0);
    expect(whoDistance(patron, pv)).toBe(`${patron.distanceM} m away · in ${name} · in reach of your shortbow (50 m)`);
  });

  it('beyond reach, close by, no weapon, or no point known', () => {
    const pv = { zone: { id: 'yard', name: 'the yard' }, zones: [{ id: 'yard', name: 'the yard' }, { id: 'road', name: 'the road' }], player: { reaches: [{ name: 'arming sword', metres: 1.1 }] } } as unknown as PlayerView;
    const a = { label: 'a guard', zone: 'yard', distanceM: 34 } as PlayerView['actors'][number];
    expect(whoDistance(a, pv)).toBe('34 m away · beyond your arming sword’s 1.1 m');
    expect(whoDistance({ ...a, distanceM: 1 }, pv)).toBe('1 m away · in reach of your arming sword (1.1 m)');
    expect(whoDistance(a, { ...pv, player: {} } as PlayerView)).toBe('34 m away');
    expect(whoDistance({ ...a, distanceM: undefined, zone: 'road' }, pv)).toBe('In the road');
  });
});
