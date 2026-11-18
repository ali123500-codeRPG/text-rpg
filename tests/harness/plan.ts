// Test fixture: a bare world holding only titles drawn on a floor plan (PZ1, PZ14 a), for geometry, sight, sound and walk
// tests. Each title is a TitleSpec as a plan hands it over; places are made for the place ids the titles name.
import type { GameState, Place, TitleSpec, WayKind, WaySpec } from '../../src/types';
import { drawTitles } from '../../src/plan/draw';
import { resetLibrary } from '../../src/library';
import { CONFIG, resetConfig } from '../../src/config';

/** a way to a title: its words, its kind (open by default) and frontier when it leads off the stage */
export const way = (to: string, label: string, kind: WayKind = 'open', frontier = false): WaySpec => ({ to, label, kind, ...(frontier ? { frontier: true as const } : {}) });
/** a title spec: id, place, ways, and anything else a plan gives (rect, area, roof, walls, light, kind …) */
export const title = (id: string, placeId: string, ways: WaySpec[], extra: Partial<TitleSpec> = {}): TitleSpec =>
  ({ id, placeId, name: id, look: '', ways, ...extra });

/** an empty world: places, no titles, an empty plan */
export function bareWorld(placeIds: string[] = [], extra: Partial<GameState> = {}): GameState {
  resetConfig();
  resetLibrary();
  const places: Place[] = placeIds.map((id) => ({ id, storyId: 'test', kind: 'place', parentId: null, names: { current: id, past: [] }, zones: [], state: {}, headlines: [] }));
  return { storyId: 'test', turn: 1, places, zones: [], walls: [], openings: [], roofs: [], lights: [], furniture: [], ground: [], actors: [], barriers: {}, ...extra } as unknown as GameState;
}
/** a world with these titles drawn (their places made first) */
export function planWorld(titles: TitleSpec[], extra: Partial<GameState> = {}): GameState {
  const s = bareWorld([...new Set(titles.map((t) => t.placeId))], extra);
  drawTitles(s, titles);
  return s;
}

/** PZ6 a: lays plain land of one land cover (an LC id) under these points (a title's outline), so clutter there is that
 *  cover's (fixture setup only): flat regions round them, every cell that cover, with no roads, waters or sites */
export function landUnder(state: GameState, pts: { x: number; y: number }[], lc: string): void {
  const S = CONFIG.REGION_SIZE_M, cell = CONFIG.REGION_CELL_M, N = Math.round(S / cell);
  for (const key of new Set(pts.map((p) => `${Math.floor(p.x / S)},${Math.floor(p.y / S)}`))) {
    const [gx, gy] = key.split(',').map(Number);
    state.regions = (state.regions ?? []).filter((r) => r.gx !== gx || r.gy !== gy);
    state.regions.push({ id: `rg_test_${gx}_${gy}`, kind: 'RK1', name: 'test land', look: '', gx, gy, seed: 1, size: S, cell, heights: new Array(N * N).fill(0),
      cover: parseInt(lc.slice(2), 10).toString(36).repeat(N * N), waters: [], roads: [], nodes: [], sites: [], features: [], beyond: {} });
  }
}

/** PZ6 a: like landUnder, but only the land cells under the box of these points (shrunk 1 cm, so a cell that only touches
 *  its edge is left) take that cover; the rest of the region stays as it was, else pasture (fixture setup only) */
export function landCellsUnder(state: GameState, pts: { x: number; y: number }[], lc: string): void {
  const S = CONFIG.REGION_SIZE_M, cell = CONFIG.REGION_CELL_M, N = Math.round(S / cell), e = 0.01;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs) + e, x1 = Math.max(...xs) - e, y0 = Math.min(...ys) + e, y1 = Math.max(...ys) - e;
  const code = parseInt(lc.slice(2), 10).toString(36);
  for (let x = Math.floor(x0 / cell) * cell; x <= x1; x += cell) for (let y = Math.floor(y0 / cell) * cell; y <= y1; y += cell) {
    const gx = Math.floor(x / S), gy = Math.floor(y / S);
    let r = state.regions?.find((q) => q.gx === gx && q.gy === gy);
    if (!r) {
      landUnder(state, [{ x, y }], LC_PASTURE);
      r = state.regions!.find((q) => q.gx === gx && q.gy === gy)!;
    }
    const i = Math.floor((y - gy * S) / cell) * N + Math.floor((x - gx * S) / cell);
    r.cover = r.cover.slice(0, i) + code + r.cover.slice(i + 1);
  }
}
const LC_PASTURE = 'LC2';

