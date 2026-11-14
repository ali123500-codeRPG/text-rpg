// 316 WZ18: the next region is drawn once the player can see past their region's edge (WZ17: the sight table's farthest
// glimpse) or stands on a road that leaves by it; it joins its drawn neighbour so roads, rivers and ground run on across
// the edge, and the neighbour then knows it by name.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { TIERS } from '../../src/scales';
import { ScenarioDirector } from '../../src/scenario';
import { toStoryStart, villageStagePlan, VirtualClock } from '../../src/scenario/fixtures';
import { RK } from '../../src/library/tableIds';
import { landSeen, landSightM } from '../../src/land/sight';
import { squaresWanted } from '../../src/land/edge';
import { noteZonesSeen } from '../../src/engine/trail';
import { CONFIG } from '../../src/config';
import type { GameState, Region } from '../../src/types';

const FIRST = {
  kind: RK.river_valley, name: 'The Wendvale', look: 'A broad green vale.', river: { name: 'the Wend', from: 'w', to: 'e' },
  settlements: [{ size: 'town', name: 'Marbury', look: '' }, { size: 'village', name: 'Thornbury', look: '', start: true }],
  features: [], exits: ['e', 'w'], beyond: { e: { name: 'Eastmarch', kind: RK.forest } },
};
const NEXT = { kind: RK.forest, name: 'Eastmarch', look: 'Old oakwood.', settlements: [{ size: 'village', name: 'Oakley', look: '', start: true }], features: [], beyond: {} };

async function story(): Promise<{ s: GameState; d: ScenarioDirector; asked: { gx: number; gy: number; beside: string[] }[] }> {
  const s = toStoryStart(makeVillage());
  s.regions = undefined;
  const asked: { gx: number; gy: number; beside: string[] }[] = [];
  const d = new ScenarioDirector({ weave: async (view) => villageStagePlan(TIERS.keyOf(view.tier)!), clock: new VirtualClock(),
    region: async (view) => { if (view.first) return FIRST; asked.push({ ...view.square, beside: view.beside.map((b) => b.name) }); return NEXT; } });
  await d.storyStart(s, createRng(s.rngState));
  return { s, d, asked };
}
/** puts the player outdoors at point p */
function standAt(s: GameState, p: { x: number; y: number }): void {
  const out = s.places.flatMap((x) => x.zones).find((z) => z.outdoor && z.rect)!;
  s.player.zone = out.id; s.player.placeId = out.placeId; s.player.pos = p;
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const S = CONFIG.REGION_SIZE_M;

describe('316 the next region', () => {
  it('WZ17: land is made out to the sight table\'s farthest glimpse, by day or night', () => {
    expect(landSightM()).toBe(CONFIG.SIGHT_M.glaring![1]);
  });

  it('is wanted only once the edge is in sight', async () => {
    const { s } = await story();
    standAt(s, { x: S / 2, y: S / 2 });
    expect(squaresWanted(s)).toEqual([]);
    standAt(s, { x: S - landSightM() / 2, y: S / 2 });
    expect(squaresWanted(s)).toEqual([{ gx: 1, gy: 0 }]);
  });

  it('is asked for in the background, drawn before the next turn, and joins its neighbour', async () => {
    const { s, d, asked } = await story();
    const a = s.regions![0];
    standAt(s, { x: S - 500, y: S / 2 });
    expect(d.drawAhead(s)).toEqual(['1,0']);
    expect(d.drawAhead(s)).toEqual([]); // asked once
    await tick();
    expect(d.applyRegionsDrawn(s)).toEqual(['rg_1_0']);
    const b = s.regions!.find((r) => r.id === 'rg_1_0')!;
    expect(asked).toEqual([{ gx: 1, gy: 0, sizeKm: 10, beside: ['The Wendvale'] }]);
    expect(b).toMatchObject({ name: 'Eastmarch', kind: RK.forest });
    expect(b.start).toBeUndefined(); // only the first region holds the story's start
    expect(a.beyond.e).toMatchObject({ name: 'Eastmarch' });
    // every road leaving A eastward comes in on B's west edge at the same point
    const out = a.nodes.filter((n) => n.kind === 'edge' && n.side === 'e');
    expect(out.length).toBeGreaterThan(0);
    for (const n of out) expect(b.nodes.some((m) => m.kind === 'edge' && m.side === 'w' && Math.abs(m.at.y - n.at.y) <= CONFIG.REGION_CELL_M)).toBe(true);
    // the river runs on: it leaves A where it enters B, with its name and width
    const ra = a.waters.find((w) => w.kind === 'river')!, rb = b.waters.find((w) => w.kind === 'river')!;
    expect(rb).toMatchObject({ name: ra.name, width: ra.width });
    expect(Math.hypot(rb.pts[0].x - ra.pts.at(-1)!.x, rb.pts[0].y - ra.pts.at(-1)!.y)).toBeLessThan(CONFIG.REGION_CELL_M);
    // the ground runs on: along the shared edge B's heights are within a few metres of A's
    const N = S / CONFIG.REGION_CELL_M, edge = (r: Region, col: number) => Array.from({ length: N }, (_, k) => r.heights[k * N + col]);
    const ea = edge(a, N - 1), eb = edge(b, 0);
    const worst = Math.max(...ea.map((h, k) => Math.abs(h - eb[k])));
    expect(worst).toBeLessThan(15);
  });

  it('a road that leaves by the edge asks for the region beyond it, and sight reaches into it once drawn', async () => {
    const { s, d } = await story();
    const a = s.regions![0], edgeNode = a.nodes.find((n) => n.kind === 'edge' && n.side === 'e')!;
    const line = a.roads.find((x) => x.ends.includes(edgeNode.id))!;
    const out = s.places.flatMap((x) => x.zones).find((z) => z.outdoor && z.rect)!;
    out.road = line.id;
    standAt(s, { x: S / 2, y: S / 2 }); // far from every edge: only the road asks
    expect(d.drawAhead(s)).toEqual(['1,0']);
    await tick();
    d.applyRegionsDrawn(s);
    standAt(s, { x: S - 300, y: edgeNode.at.y });
    noteZonesSeen(s);
    const seen = landSeen(s, 'rg_1_0'), n = s.regions!.find((r) => r.id === 'rg_1_0')!.heights.filter((_, i) => seen(i)).length;
    expect(n).toBeGreaterThan(10);
  });
});
