// WZ1-WZ3, WZ8: code draws a region's land from a seed and a brief: the same every time, sites spaced like parishes,
// every settlement on the road network, crossings wherever a road meets water.
import { describe, expect, it } from 'vitest';
import { drawRegion, lineLength, type RegionBrief } from '../../src/land/generate';
import { CONFIG } from '../../src/config';
import { RK, LM } from '../../src/library/tableIds';

const brief = (kind: string): RegionBrief => ({
  kind, name: 'Vale', look: 'a broad vale', river: { name: 'the Wend', from: 'w', to: 'e' },
  settlements: [{ size: 'town', name: 'Marbury', look: '', where: 'crossing' }, { size: 'village', name: 'Thornbury', look: '' }, { size: 'village', name: 'Ashwell', look: '', where: 'hill' }, { size: 'hamlet', name: 'Hob End', look: '' }],
  features: [{ kind: LM.quarry, name: 'the old quarry', look: '' }],
  beyond: { n: { name: 'the Fells' }, e: { name: 'Eastmarch' } },
});
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('land generator', () => {
  const r = drawRegion('rg1', 0, 0, 4242, brief(RK.river_valley));

  it('gives the same land from the same seed and brief', () => {
    expect(drawRegion('rg1', 0, 0, 4242, brief(RK.river_valley))).toEqual(r);
  });

  it('keeps the grid and everything drawn inside the region', () => {
    const n = (CONFIG.REGION_SIZE_M / CONFIG.REGION_CELL_M) ** 2;
    expect(r.heights.length).toBe(n);
    expect(r.cover.length).toBe(n);
    const inside = (p: { x: number; y: number }) => p.x >= 0 && p.x <= r.size && p.y >= 0 && p.y <= r.size;
    for (const w of r.waters) expect(w.pts.every(inside)).toBe(true);
    for (const rd of r.roads) expect(rd.pts.every(inside)).toBe(true);
  });

  it('places every brief settlement, with the brief\'s names, spaced apart', () => {
    expect(r.sites.map((s) => s.name).sort()).toEqual(['Ashwell', 'Hob End', 'Marbury', 'Thornbury']);
    for (const a of r.sites) for (const b of r.sites) if (a !== b) expect(dist(a.at, b.at)).toBeGreaterThanOrEqual(Math.min(CONFIG.SITE_SPACING_M[a.size], CONFIG.SITE_SPACING_M[b.size]));
    expect(r.features).toHaveLength(1);
  });

  it('runs the river from the brief\'s side to the other and names it', () => {
    const river = r.waters.find((w) => w.kind === 'river')!;
    expect(river.name).toBe('the Wend');
    expect(river.pts[0].x).toBe(0);
    expect(river.pts.at(-1)!.x).toBe(r.size);
  });

  it('joins every settlement to the road network, and roads lead out to the named regions beyond', () => {
    const adj = new Map<string, string[]>();
    for (const rd of r.roads) for (const [a, b] of [rd.ends, [rd.ends[1], rd.ends[0]]]) adj.set(a, [...(adj.get(a) ?? []), b]);
    const town = r.nodes.find((n) => n.site === r.sites.find((s) => s.size === 'town')!.id)!;
    const seen = new Set([town.id]), todo = [town.id];
    while (todo.length) for (const n of adj.get(todo.pop()!) ?? []) if (!seen.has(n)) { seen.add(n); todo.push(n); }
    for (const s of r.sites) expect(seen.has(r.nodes.find((n) => n.site === s.id)?.id ?? '')).toBe(true);
    expect(r.nodes.filter((n) => n.kind === 'edge').map((n) => n.side).sort()).toEqual(['e', 'n']);
  });

  it('measures each road along its line, and bridges the river where a road crosses it', () => {
    for (const rd of r.roads) expect(rd.length).toBe(Math.round(lineLength(rd.pts)));
    const bridges = r.roads.flatMap((rd) => rd.crossings).filter((c) => c.kind === 'bridge');
    for (const b of bridges) expect(r.waters.find((w) => w.id === b.water)!.width).toBeGreaterThan(CONFIG.FORD_MAX_WIDTH_M);
  });

  it('draws each region kind', () => {
    for (const k of Object.values(RK)) {
      const x = drawRegion('rg2', 1, 0, 99, { ...brief(k), river: undefined, settlements: [] });
      expect(x.sites.length).toBeGreaterThan(2);
      expect(x.roads.length).toBeGreaterThan(0);
      expect(x.heights.every((h) => h >= 0)).toBe(true);
    }
  });
});
