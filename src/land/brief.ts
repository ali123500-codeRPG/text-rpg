// WZ2: the Weaver writes a brief in words once per region; code draws the land to fit (src/land/generate.ts). This file
// holds the brief call's view, the check of its answer, the fallback when no brief comes back, and the land as the
// Weaver is shown it in its plans (sites to build settlements on, roads to build road zones along).
import type { GameState, Pt, Region, Side } from '../types';
import { OPP_SIDE, SIDE_STEP, SIDE_WORD, SIDES } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { ROAD_DANGERS } from '../scales';
import { textSeed } from '../rng';
import { RK } from '../library/tableIds';
import { drawRegion, SITE_SIZES, WHERE, type RegionBrief, type SiteSize, type Where } from './generate';
import { regionAt } from './sight';
import { joinsFor } from './edge';


/** WZ2 what the region call is given: the story's premise, the square to fill, what lies beside it, and the catalogs */
export type RegionCallView = {
  premise: string;
  /** WZ13: the first region of a story: one settlement must carry start true, where the story opens */
  first: boolean;
  square: { gx: number; gy: number; sizeKm: number };
  /** drawn regions beside this square: their names and what this square was called from there */
  beside: { side: Side; name: string; look: string; calledHere?: string }[];
  catalogs: {
    regionKinds: { id: string; name: string; text: string; settlements: string }[];
    landmarkKinds: { id: string; name: string }[];
    where: readonly string[]; sides: Side[]; dangers: readonly string[]; sizes: SiteSize[];
  };
};

export function regionCallView(state: GameState, gx: number, gy: number): RegionCallView {
  const lib = getLibrary();
  const at = (dx: number, dy: number) => state.regions?.find((r) => r.gx === gx + dx && r.gy === gy + dy);
  const beside = SIDES.flatMap((side) => { const r = at(...SIDE_STEP[side]); return r ? [{ side, name: r.name, look: r.look, ...(r.beyond[OPP_SIDE[side]] ? { calledHere: r.beyond[OPP_SIDE[side]]!.name } : {}) }] : []; });
  return {
    premise: CONFIG.STORY_PREMISE, first: !state.regions?.length, square: { gx, gy, sizeKm: CONFIG.REGION_SIZE_M / 1000 }, beside,
    catalogs: {
      regionKinds: Object.values(lib.regionKinds ?? {}).map((k) => ({ id: k.id, name: k.name, text: k.text, settlements: `${k.settlements.town} town, ${k.settlements.village.join(' to ')} villages, ${k.settlements.hamlet.join(' to ')} hamlets` })),
      landmarkKinds: Object.values(lib.landmarkKinds ?? {}).map((k) => ({ id: k.id, name: k.name })),
      where: WHERE, sides: [...SIDES], dangers: ROAD_DANGERS.keys, sizes: [...SITE_SIZES],
    },
  };
}

/** the brief as code will use it: unknown words dropped (each noted), a kind always set; null when nothing usable came back */
export function tidyBrief(raw: unknown, view: RegionCallView): { brief: RegionBrief; notes: string[] } {
  const lib = getLibrary(), notes: string[] = [];
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, 2000) : '');
  const side = (v: unknown) => (SIDES.includes(v as Side) ? (v as Side) : undefined);
  const where = (v: unknown): Where | undefined => (WHERE.includes(v as Where) ? (v as Where) : (v !== undefined && notes.push(`where "${String(v)}" dropped`), undefined));
  let kind = str(o.kind);
  if (!lib.regionKinds?.[kind]) { if (kind) notes.push(`kind ${kind} unknown: ${RK.river_valley}`); kind = RK.river_valley; }
  const list = (v: unknown) => (Array.isArray(v) ? v : []) as Record<string, unknown>[];
  const settlements = list(o.settlements).flatMap((x) => {
    if (!SITE_SIZES.includes(x?.size as SiteSize)) { notes.push(`settlement ${str(x?.name)} has no size`); return []; }
    return [{ size: x.size as SiteSize, name: str(x.name), look: str(x.look), ...(where(x.where) ? { where: x.where as Where } : {}), ...(x.start === true && view.first ? { start: true as const } : {}) }];
  });
  const features = list(o.features).flatMap((x) => {
    if (!lib.landmarkKinds?.[str(x?.kind)]) { notes.push(`landmark ${str(x?.name)} kind ${str(x?.kind)} unknown`); return []; }
    return [{ kind: str(x.kind), name: str(x.name), look: str(x.look), ...(where(x.where) ? { where: x.where as Where } : {}) }];
  });
  const river = o.river && typeof o.river === 'object' ? o.river as Record<string, unknown> : undefined;
  const beyondRaw = (o.beyond && typeof o.beyond === 'object' ? o.beyond : {}) as Record<string, Record<string, unknown>>;
  const beyond = Object.fromEntries(SIDES.flatMap((sd) => (beyondRaw[sd]?.name ? [[sd, { name: str(beyondRaw[sd].name), ...(lib.regionKinds?.[str(beyondRaw[sd].kind)] ? { kind: str(beyondRaw[sd].kind) } : {}) }]] : [])));
  // a drawn neighbour's name for the side it lies on wins: the land already says what is there
  for (const b of view.beside) beyond[b.side] = { name: b.name };
  const exits = (Array.isArray(o.exits) ? o.exits : []).map(side).filter((x): x is Side => !!x);
  const danger = ROAD_DANGERS.has(o.danger) ? (o.danger as RegionBrief['danger']) : undefined;
  if (view.first && settlements.length && !settlements.some((x) => 'start' in x)) notes.push('no settlement marked start: the story opens in the town');
  return {
    brief: { kind, name: str(o.name), look: str(o.look), ...(river ? { river: { name: str(river.name), ...(side(river.from) ? { from: side(river.from) } : {}), ...(side(river.to) ? { to: side(river.to) } : {}) } } : {}),
      settlements, features, ...(exits.length ? { exits } : {}), beyond, ...(danger ? { danger } : {}) },
    notes,
  };
}

/** WZ1: draws the region in square gx, gy from its brief (or, with none, from its kind's table alone) and adds it to the
 * world. The seed comes from the world and the square, so the same world always gets the same land. The brief's start
 * settlement (WZ13) becomes the region's start. */
export function addRegion(state: GameState, gx: number, gy: number, brief: RegionBrief): Region {
  const world = state.meta.worldId ?? state.storyId;
  const id = `rg_${gx}_${gy}`.replace(/-/g, 'm');
  const r = drawRegion(id, gx, gy, textSeed(`${world}:${id}`), brief, joinsFor(state, gx, gy));
  const want = brief.settlements.find((x) => x.start);
  const start = (want && r.sites.find((s) => s.name === want.name && s.size === want.size)) ?? r.sites.find((s) => s.size === 'town') ?? r.sites[0];
  if (start && (want || !state.regions?.length)) r.start = start.id; // WZ13: only the first region, or one a brief marks
  // WZ18: each drawn neighbour now knows this region by its name, on the side it lies
  for (const sd of SIDES) { const nb = state.regions?.find((x) => x.gx === gx + SIDE_STEP[sd][0] && x.gy === gy + SIDE_STEP[sd][1]); if (nb && r.name) nb.beyond[OPP_SIDE[sd]] = { name: r.name, kind: r.kind }; }
  (state.regions ??= []).push(r);
  return r;
}

/** the land as the Weaver sees it in a plan: the region the player stands in (or, before they stand anywhere, the
 * first), its sites, roads and landmarks in words, each with how far and which way from `from` */
export function landView(state: GameState, from?: Pt): import('../types').LandView | undefined {
  const r = (from && regionAt(state, from)) ?? state.regions?.[0];
  if (!r) return undefined;
  const lib = getLibrary(), origin = from ?? r.sites.find((s) => s.id === r.start)?.at ?? { x: r.gx * r.size + r.size / 2, y: r.gy * r.size + r.size / 2 };
  const way = (p: Pt) => {
    const dx = p.x - origin.x, dy = p.y - origin.y, d = Math.hypot(dx, dy);
    if (d < 150) return 'here';
    const a = (Math.atan2(dx, dy) * 180) / Math.PI, dirs = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
    return `${d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1)} km`} ${dirs[Math.round(((a + 360) % 360) / 45) % 8]}`;
  };
  const nodeName = (id: string) => {
    const n = r.nodes.find((x) => x.id === id);
    if (!n) return id;
    if (n.kind === 'site') return r.sites.find((s) => s.id === n.site)?.name || `a ${r.sites.find((s) => s.id === n.site)?.size ?? 'settlement'}`;
    if (n.kind === 'edge') return `the ${SIDE_WORD[n.side!]} edge, toward ${r.beyond[n.side!]?.name ?? 'land not yet drawn'}`;
    return `a junction ${way(n.at)}`;
  };
  return {
    region: r.id, name: r.name, look: r.look, kind: lib.regionKinds?.[r.kind]?.name ?? r.kind,
    ...(r.start ? { start: r.start } : {}),
    sites: r.sites.map((s) => ({ id: s.id, size: s.size, name: s.name, look: s.look, where: way(s.at), ...(s.placeId ? { place: s.placeId } : {}) })),
    roads: r.roads.map((x) => ({ id: x.id, kind: x.kind, from: nodeName(x.ends[0]), to: nodeName(x.ends[1]), km: Math.round(x.length / 100) / 10, danger: x.danger,
      ...(x.crossings.length ? { crosses: x.crossings.map((c) => `a ${c.kind}`).join(', ') } : {}), ...(x.zone ? { zone: x.zone } : {}) })),
    landmarks: r.features.map((f) => ({ name: f.name, kind: lib.landmarkKinds?.[f.kind]?.name ?? f.kind, look: f.look, where: way(f.at) })),
    beyond: Object.fromEntries(Object.entries(r.beyond).map(([k, v]) => [SIDE_WORD[k as Side], v!.name])),
  };
}
