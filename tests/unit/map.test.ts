// The Map page: only what the character knows, drawn from the floor plan (BG-313).
import { describe, it, expect } from 'vitest';
import { knownMap } from '../../src/ui/mapData';
import { wayWords } from '../../src/ui/map';
import { createFakeGame } from '../../src/ui/fakeGame';
import { noteZonesSeen } from '../../src/engine/trail';
import { zoneById } from '../../src/engine/relations';
import { waysOut } from '../../src/plan/where';
import { seesAcross } from '../../src/engine/relations';

const game = async () => {
  const g = createFakeGame({ autoStart: true });
  await new Promise((r) => setTimeout(r, 50));
  return g.state()!;
};

describe('map', () => {
  it('shows only known zones, and light, cover, people and items only for zones in view', async () => {
    const s = await game();
    const m = knownMap(s);
    const zones = m.places.flatMap((p) => p.zones);
    const ids = zones.map((z) => z.id);
    expect(ids).toContain(s.player.zone);
    expect(ids).not.toContain('tav_cellar');
    for (const z of zones) if (!z.inView) {
      expect(z.light).toBeUndefined();
      expect(z.cover).toBeUndefined();
      expect(z.items).toEqual([]);
      expect(z.people.every((p) => !p.now)).toBe(true);
    }
    // the unseen cellar is an exit you have not taken, not a known zone
    const kitchen = zones.find((z) => z.id === 'tav_kitchen')!;
    expect(kitchen.links.find((l) => l.to === 'tav_cellar')?.known).toBe(false);
  });

  it('marks a barrier on an exit only as far as the character knows it stops them', async () => {
    const s = await game();
    const common = knownMap(s).places.flatMap((p) => p.zones).find((z) => z.id === 'tav_common')!;
    const way = (to: string) => common.links.find((l) => l.to === to)?.way;
    expect(way('tav_kitchen')).toMatchObject({ kind: 'door', shut: 'locked' }); // tried it
    expect(way('tav_yard')).toMatchObject({ kind: 'door', shut: 'barred' }); // tried it, the bolt is on the far side
    expect(way('v_square')).toMatchObject({ shut: 'locked', key: true }); // its key is in the pack
    // never tried and no key: a locked door is only a door
    s.barriers!.fb_kitchen.tried = [];
    const again = knownMap(s).places.flatMap((p) => p.zones).find((z) => z.id === 'tav_common')!;
    expect(again.links.find((l) => l.to === 'tav_kitchen')?.way).toEqual({ kind: 'door' });
    expect(wayWords({ kind: 'door', shut: 'locked', key: true })).toBe('door, locked: you hold its key');
  });

  it('remembers zones seen across sight links', async () => {
    const s = await game();
    s.barriers!.fb_front.open = true; // every way out of the common room is a shut door or the stairs: open the front door
    s.player.journal!.zonesSeen = [];
    noteZonesSeen(s);
    const seen = s.player.journal!.zonesSeen!;
    expect(seen[0]).toBe(s.player.zone);
    const sightLinks = waysOut(s, s.player.zone).filter((l) => seesAcross(s, l) && !l.frontier).map((l) => l.to);
    expect(sightLinks.length).toBeGreaterThan(0);
    for (const z of sightLinks) expect(seen).toContain(z);
  });

});
