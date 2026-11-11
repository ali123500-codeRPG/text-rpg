// The Map page: only what the character knows, and a layout that follows the exits' compass words.
import { describe, it, expect } from 'vitest';
import { compassOf, knownMap, worldTiles } from '../../src/ui/mapData';
import { layout } from '../../src/ui/map';
import { createFakeGame } from '../../src/ui/fakeGame';
import { noteZonesSeen } from '../../src/engine/trail';
import { zoneById } from '../../src/engine/relations';

const game = async () => {
  const g = createFakeGame({ autoStart: true });
  await new Promise((r) => setTimeout(r, 50));
  return g.state()!;
};

describe('map', () => {
  it('reads compass words from exit labels', () => {
    expect(compassOf('the kitchen door, west')).toEqual([-1, 0]);
    // up and down are heights, never north or south
    expect(compassOf('the stairs up')).toBeNull();
    expect(compassOf('down to the cellar')).toBeNull();
    expect(compassOf('the northeast tower')![0]).toBeCloseTo(Math.SQRT1_2);
    expect(compassOf('the green door')).toBeNull();
  });

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

  it('remembers zones seen across sight links', async () => {
    const s = await game();
    s.player.journal!.zonesSeen = [];
    noteZonesSeen(s);
    const seen = s.player.journal!.zonesSeen!;
    expect(seen[0]).toBe(s.player.zone);
    const sightLinks = zoneById(s, s.player.zone)!.links.filter((l) => l.sight && !l.frontier).map((l) => l.to);
    expect(sightLinks.length).toBeGreaterThan(0);
    for (const z of sightLinks) expect(seen).toContain(z);
  });

  it('a road to another village is a known link to another top-level place, which gets its own map', async () => {
    const s = await game();
    const m = knownMap(s);
    const ash = m.places.find((p) => p.id === 'ashford')!;
    expect(ash.parentId).toBeNull();
    const road = m.places.flatMap((p) => p.zones).find((z) => z.id === 'v_square')!.links.find((l) => l.to === 'ash_gate')!;
    expect(road.known).toBe(true);
    expect(road.otherPlace).toBe('Ashford');
  });

  it('the World view has one tile per top-level place, joined by the roads between them', async () => {
    const s = await game();
    const w = worldTiles(knownMap(s));
    expect(w.map((t) => t.id).sort()).toEqual(['ashford', 'village']);
    expect(w.find((t) => t.id === 'village')!.here).toBe(true);
    expect(w.find((t) => t.id === 'village')!.look).toBe('7 zones known');
    expect(w.find((t) => t.id === 'village')!.links.map((l) => l.to)).toEqual(['ashford']);
    expect(w.find((t) => t.id === 'ashford')!.links.map((l) => l.to)).toEqual(['village']);
  });

  it('places a zone on the side its exit names', async () => {
    const s = await game();
    const tav = knownMap(s).places.find((p) => p.id === 'tavern')!;
    const at = layout(tav.zones, 'tav_common', new Map());
    const c = at.get('tav_common')!;
    // the landing is straight above the common room, on its own floor
    expect(at.get('tav_upstairs')).toEqual(c);
    expect(at.get('tav_kitchen')!.x).toBeLessThan(c.x);
    expect(at.get('tav_yard')!.x).toBeGreaterThan(c.x);
  });
});
