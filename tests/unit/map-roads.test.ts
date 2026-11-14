// Roads on the map: a road is only a line on the World map, between the places at its ends; a place along it (a waystation)
// is a map of its own, and on a road the map opens on the World with your pin at your point along it.
import { describe, expect, it } from 'vitest';
import { setupGame, intent, narrateAll } from '../harness/turn';
import { knownMap, rootPlace, worldTiles, type KnownMap, type MapZone } from '../../src/ui/mapData';
import { ZK } from '../../src/library/tableIds';
import type { Place, Zone } from '../../src/types';

const P = (id: string, kind: string, parentId: string | null, name: string, zones: Zone[]): Place =>
  ({ id, storyId: 'test', kind, parentId, names: { current: name, past: [] }, zones, state: {}, headlines: [] });

describe('roads on the map', () => {
  it('a place along a road is its own World place; the road tile is the road alone, joined to its ends and the places along it', () => {
    const z = (id: string, placeId: string, links: string[], rect: MapZone['rect']): MapZone =>
      ({ id, placeId, name: id, look: '', outdoor: true, here: false, inView: false, height: 0, links: links.map((to) => ({ to, label: to, sight: true, frontier: false, known: true })), people: [], items: [], rect });
    const m: KnownMap = { placeId: 'road', zoneId: 'r1', visited: [], places: [
      { id: 'town', name: 'Town', kind: 'village', parentId: null, depth: 0, facts: [], zones: [z('sq', 'town', ['r1'], { x: 0, y: 0, w: 20, d: 20 })] },
      { id: 'road', name: 'the road', kind: 'road', parentId: null, depth: 0, facts: [], zones: [z('r1', 'road', ['sq', 'yard'], { x: 1010, y: 0, w: 2000, d: 4 })] },
      { id: 'halt', name: 'the halt', kind: 'waystation', parentId: 'road', depth: 1, facts: [], zones: [z('yard', 'halt', ['r1', 'hut1'], { x: 2020, y: 0, w: 20, d: 20 })] },
      { id: 'hut', name: 'the hut', kind: 'house', parentId: 'halt', depth: 2, facts: [], zones: [z('hut1', 'hut', ['yard'], { x: 2032.5, y: 0, w: 5, d: 5 })] },
    ] };
    expect(rootPlace(m, 'hut')).toBe('halt');
    expect(rootPlace(m, 'halt')).toBe('halt');
    const w = worldTiles(m);
    expect(w.map((t) => t.id).sort()).toEqual(['halt', 'road', 'town']);
    const road = w.find((t) => t.id === 'road')!;
    expect(road.rect).toEqual({ x: 1010, y: 0, w: 2000, d: 4 }); // the road's own zone, not the halt beside it
    expect(road.links.map((l) => l.to).sort()).toEqual(['halt', 'town']);
    expect(w.find((t) => t.id === 'halt')!.look).toBe('2 zones known'); // the yard and the hut inside the halt
  });

  it('a road joins as many places and other roads as you know: each is an end on its tile, and the map fills in as you go', () => {
    const z = (id: string, placeId: string, links: string[]): MapZone =>
      ({ id, placeId, name: id, look: '', outdoor: true, here: false, inView: false, height: 0, links: links.map((to) => ({ to, label: to, sight: true, frontier: false, known: true })), people: [], items: [] });
    const m: KnownMap = { placeId: 'east', zoneId: 'e1', visited: [], places: [
      { id: 'town', name: 'Town', kind: 'village', parentId: null, depth: 0, facts: [], zones: [z('sq', 'town', ['e1'])] },
      { id: 'east', name: 'the east road', kind: 'road', parentId: null, depth: 0, facts: [], zones: [z('e1', 'east', ['sq', 'mkt', 'n1', 'farm'])] },
      { id: 'north', name: 'the north road', kind: 'road', parentId: null, depth: 0, facts: [], zones: [z('n1', 'north', ['e1'])] },
      { id: 'market', name: 'the market town', kind: 'village', parentId: null, depth: 0, facts: [], zones: [z('mkt', 'market', ['e1'])] },
      { id: 'farm', name: 'a farm', kind: 'farm', parentId: null, depth: 0, facts: [], zones: [z('farm', 'farm', ['e1'])] },
    ] };
    const w = worldTiles(m);
    expect(w.find((t) => t.id === 'east')!.links.map((l) => l.to).sort()).toEqual(['farm', 'market', 'north', 'town']);
    expect(w.find((t) => t.id === 'north')!.links.map((l) => l.to)).toEqual(['east']);
  });

  it('whole turn: standing on a road, the World holds the road as a place you are in, with your point along it, and the halt beside it on its own', async () => {
    const g = setupGame({ playerZone: 'gate_inner', without: ['slime_1', 'slime_2'] });
    const road: Zone = { id: 'e_road', placeId: 'east_way', name: 'the east road', look: 'A rutted cart road.', kind: ZK.road, outdoor: true, cover: 'none', light: 'bright', groundItems: [],
      rect: { x: 300, y: 0, w: 400, d: 4 }, links: [{ to: 'gate_inner', label: 'back to the gate', sight: true }, { to: 'halt_yard', label: 'a yard beside the road', sight: true }] };
    const yard: Zone = { id: 'halt_yard', placeId: 'halt', name: 'the halt', look: 'A stock pen beside the road.', outdoor: true, cover: 'none', light: 'bright', groundItems: [],
      rect: { x: 510, y: 0, w: 20, d: 20 }, links: [{ to: 'e_road', label: 'back out to the road', sight: true }] };
    g.state.places.push(P('east_way', 'road', null, 'the east road', [road]), P('halt', 'waystation', 'east_way', 'the halt', [yard]));
    g.state.places.find((p) => p.id === 'gate')!.zones[0].links.push({ to: 'e_road', label: 'the east road', sight: true });
    const p = g.state.player;
    p.zone = 'e_road'; p.placeId = 'east_way'; p.pos = { x: 250, y: 0 };
    g.claude.defaults.narrator = narrateAll();
    g.start();
    const t = g.game.state()!.turn;
    g.claude.push('parser', intent({ action: { type: 'wait' } as never }));
    await g.game.submit('wait', { aimed: false });
    await g.game.settle();
    expect(g.game.state()!.turn).toBe(t + 1); // the whole turn went through
    const m = knownMap(g.game.state()!);
    expect(m.zoneId).toBe('e_road');
    const here = m.places.find((x) => x.id === 'east_way')!.zones[0];
    expect(here.along).toEqual({ m: 150, len: 400, from: 'west', to: 'east' });
    const w = worldTiles(m);
    expect(w.find((t) => t.id === 'east_way')!.here).toBe(true);
    expect(w.find((t) => t.id === 'halt')).toBeDefined();
    expect(rootPlace(m, 'halt')).toBe('halt');
  });
});
