// WI2 a: the land's ways are made by code, once. A road of the land is built as one zone (RoadLine.zone), a junction as
// one zone (RoadNode.zone), a settlement site as one place (Site.placeId). When one is built it takes over every way to
// new ground keyed by it, is joined to each land neighbour already built, and gets a way to new ground (a frontier keyed
// by the land id, labelled from the land) toward each one that is not. Planners write only the ways the land does not
// draw. WI5 a: every way between two titles is joined by joinWay (plan/draw), one opening, or the one already there.
import type { GameState, Place, Pt, Region, RoadLine, RoadNode, Zone } from '../types';
import { OPP_SIDE, SIDE_STEP, SIDE_WORD } from '../types';
import { CONFIG } from '../config';
import { ZK } from '../library/tableIds';
import { zoneById } from '../engine/relations';
import { topPlace } from './stage';
import { addFrontier, frontierTo, joinFrontier, joinWay } from '../plan/draw';
import { roofed, waysOut } from '../plan/where';
export { joinFrontier, joinWay };

/** the titles `z`'s ways lead to (frontier keys too) */
const leadsTo = (s: GameState, z: Zone): string[] => waysOut(s, z.id).map((w) => w.to);

// ---- the land's records ----
const regions = (s: GameState) => s.regions ?? [];
export function landRoad(s: GameState, id: string): { r: Region; line: RoadLine } | undefined {
  for (const r of regions(s)) { const line = r.roads.find((x) => x.id === id); if (line) return { r, line }; }
}
export function landNode(s: GameState, id: string): { r: Region; node: RoadNode } | undefined {
  for (const r of regions(s)) { const node = r.nodes.find((x) => x.id === id); if (node) return { r, node }; }
}
const roadsAt = (r: Region, node: string) => r.roads.filter((x) => x.ends.includes(node));
const otherEnd = (line: RoadLine, node: string) => (line.ends[0] === node ? line.ends[1] : line.ends[0]);

/** WZ18: the node on the far side of a region edge node, and the road that runs on from it, once that region is drawn */
export function acrossEdge(s: GameState, r: Region, n: RoadNode): { r: Region; node: RoadNode; line: RoadLine } | undefined {
  if (n.kind !== 'edge' || !n.side) return undefined;
  const [dx, dy] = SIDE_STEP[n.side];
  const nb = regions(s).find((q) => q.gx === r.gx + dx && q.gy === r.gy + dy);
  const node = nb?.nodes.find((q) => q.kind === 'edge' && q.side === OPP_SIDE[n.side!] && Math.hypot(q.at.x - n.at.x, q.at.y - n.at.y) <= nb.cell);
  const line = node && roadsAt(nb!, node.id)[0];
  return line ? { r: nb!, node: node!, line } : undefined;
}

/** what a way to new ground keyed `key` is in the land: a road, a junction or a settlement site (an edge node, the road
 * running on past it once that region is drawn); undefined for a way the land does not draw */
export type LandTarget = { road: string } | { junction: string } | { site: string };
export function landTarget(s: GameState, key: string): LandTarget | undefined {
  if (landRoad(s, key)) return { road: key };
  const f = landNode(s, key);
  if (!f) return undefined;
  if (f.node.kind === 'junction') return { junction: key };
  if (f.node.kind === 'site') return f.node.site ? { site: f.node.site } : undefined;
  const on = acrossEdge(s, f.r, f.node);
  return on ? { road: on.line.id } : undefined;
}

/** the zones a way to or from `z` counts for: a settlement's zones count as one (it needs one way to a road, not one per
 * zone); a road's or junction's zone is itself */
function group(s: GameState, z: Zone): Zone[] {
  if (z.road || junctionOf(s, z)) return [z];
  const top = topPlace(s, z.placeId), p = s.places.find((x) => x.id === top);
  return p?.site ? settlementZones(s, p) : [z];
}
const settlementZones = (s: GameState, p: Place) => s.zones.filter((z) => topPlace(s, z.placeId) === p.id);
const junctionOf = (s: GameState, z: Zone) => regions(s).flatMap((r) => r.nodes).find((n) => n.kind === 'junction' && n.zone === z.id);

/** where a road leaves a settlement: the zone already joined to it (or to new ground keyed by it), else its gate, square
 * or street, else any outdoor zone, else its first */
function gateOf(s: GameState, p: Place, road: string | undefined): Zone | undefined {
  const zs = settlementZones(s, p);
  const line = road ? landRoad(s, road)?.line : undefined;
  return zs.find((z) => leadsTo(s, z).some((to) => to === road || (!!line?.zone && to === line.zone)))
    ?? [ZK.gate, ZK.square, ZK.street].map((k) => zs.find((z) => z.kind === k)).find(Boolean)
    ?? zs.find((z) => !roofed(s, z)) ?? zs[0];
}

/** WI2 a: the built zone of land item `key` (a road's zone, a junction's zone, the settlement on a site, where `road`
 * leaves it; across a region edge, the zone of the road running on) */
export function landZone(s: GameState, key: string, road?: string): Zone | undefined {
  const rd = landRoad(s, key);
  if (rd) return rd.line.zone ? zoneById(s, rd.line.zone) : undefined;
  const f = landNode(s, key);
  if (!f) return undefined;
  if (f.node.kind === 'junction') return f.node.zone ? zoneById(s, f.node.zone) : undefined;
  if (f.node.kind === 'edge') { const on = acrossEdge(s, f.r, f.node); return on?.line.zone ? zoneById(s, on.line.zone) : undefined; }
  const site = f.r.sites.find((x) => x.id === f.node.site), p = site?.placeId ? s.places.find((x) => x.id === site.placeId) : undefined;
  return p ? gateOf(s, p, road) : undefined;
}

// ---- labels, from the land ----
const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export const compass = (a: Pt, b: Pt) => DIRS[Math.round((((Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI + 360) % 360) / 45) % 8];
function nodeWords(s: GameState, r: Region, n: RoadNode): string {
  if (n.kind === 'site') {
    const site = r.sites.find((x) => x.id === n.site);
    return s.places.find((p) => p.id === site?.placeId)?.names.current ?? (site?.name || `a ${site?.size ?? 'settlement'}`);
  }
  if (n.kind === 'edge') return acrossEdge(s, r, n)?.r.name || r.beyond[n.side!]?.name || `the ${SIDE_WORD[n.side!]} edge of ${r.name || 'the region'}`;
  const f = n.feature ? r.features.find((x) => x.id === n.feature) : undefined;
  if (f) return f.name;
  const ways = roadsAt(r, n.id).length;
  return ways >= 4 ? 'a crossroads' : ways === 3 ? 'a fork in the road' : 'where the road ends';
}
/** "the road north-west, toward a crossroads": along `line`, toward its end `to` */
function wayLabel(s: GameState, r: Region, line: RoadLine, to: string): string {
  const far = r.nodes.find((n) => n.id === to), near = r.nodes.find((n) => n.id === otherEnd(line, to));
  if (!far || !near) return line.name ?? `the ${line.kind}`;
  return `${line.name ?? `the ${line.kind}`} ${compass(near.at, far.at)}, toward ${nodeWords(s, r, far)}`.slice(0, CONFIG.TEXT_CAP);
}

/** a land item just built, and the land items next to it, each with the label of the way from it */
type Built = { keys: string[]; zone: Zone; around: { key: string; label: string; road?: string }[] };

/** WI2 a: after a plan (or a fallback) is applied: each land item it built (a zone on a road, a junction's zone, a
 * settlement just set on its site) takes over the ways to new ground keyed by it, is joined to every land neighbour
 * already built, and gets a way to new ground toward every one that is not. Safe to run again. */
export function makeLandWays(s: GameState, zones: Zone[], sited: Place[]): void {
  const built: Built[] = [];
  for (const z of zones) {
    const rd = z.road ? landRoad(s, z.road) : undefined;
    if (rd && rd.line.zone === z.id) {
      // a road over a region edge is also the way on from the road it continues in the next region
      const across = rd.line.ends.map((e) => rd.r.nodes.find((n) => n.id === e)).flatMap((n) => (n ? [acrossEdge(s, rd.r, n)?.node.id] : [])).filter((x): x is string => !!x);
      built.push({ keys: [rd.line.id, ...across], zone: z, around: rd.line.ends.map((e) => ({ key: e, label: wayLabel(s, rd.r, rd.line, e), road: rd.line.id })) });
    }
    const jn = junctionOf(s, z), jr = jn && landNode(s, jn.id)?.r;
    if (jn && jr) built.push({ keys: [jn.id], zone: z, around: roadsAt(jr, jn.id).map((line) => ({ key: line.id, label: wayLabel(s, jr, line, otherEnd(line, jn.id)) })) });
  }
  for (const p of sited) {
    const f = regions(s).flatMap((r) => r.nodes.filter((n) => n.kind === 'site' && n.site === p.site).map((node) => ({ r, node })))[0];
    if (!f) continue;
    for (const line of roadsAt(f.r, f.node.id)) {
      const gate = gateOf(s, p, line.id);
      if (gate) built.push({ keys: [f.node.id], zone: gate, around: [{ key: line.id, label: wayLabel(s, f.r, line, otherEnd(line, f.node.id)) }] });
    }
  }
  // first every way to new ground keyed by what was built leads to it, then each built item reaches its neighbours
  for (const b of built) for (const k of b.keys) {
    for (const o of s.openings.filter((x) => x.frontier && x.joins[1] === k)) frontierTo(s, o, landZone(s, k, zoneById(s, o.joins[0])?.road) ?? b.zone);
    for (const a of s.actors) if (a.mind?.slots?.dest === k) a.mind.slots.dest = b.zone.id;
  }
  for (const b of built) {
    const mine = group(s, b.zone);
    for (const n of b.around) {
      const there = landZone(s, n.key, n.road ?? b.zone.road);
      if (there) {
        const theirs = group(s, there);
        if (!mine.some((z) => leadsTo(s, z).some((to) => theirs.some((t) => t.id === to)))) joinWay(s, b.zone, there, { label: n.label });
      } else if (!mine.some((z) => leadsTo(s, z).includes(n.key))) {
        addFrontier(s, b.zone, n.key, n.label, { kind: 'open' });
      }
    }
  }
}

/** the point of a line nearest to `p`, and the segment it is on */
function nearestOn(pts: Pt[], p: Pt): { q: Pt; i: number } {
  let best = { q: pts[0], i: 0 }, d = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
    const q = { x: a.x + t * dx, y: a.y + t * dy }, e = Math.hypot(q.x - p.x, q.y - p.y);
    if (e < d) { d = e; best = { q, i }; }
  }
  return best;
}
/** RE8 a: a road encounter opens a side way. A junction is added on the land's road where the encounter stands (the road
 * stays one zone: the junction is not one of its ends), and a path from it to `toward` (a settlement site's id or a
 * landmark's id or name in the region), or to an end of its own SIDE_WAY_M off the road. Built like every land way: the
 * zone made at the junction gets a way to new ground along the path (makeLandWays). Returns the junction's id. */
export function openSideWay(s: GameState, roadId: string, at: Pt, toward?: string, name?: string): string | undefined {
  const rd = landRoad(s, roadId);
  if (!rd || rd.line.pts.length < 2) return undefined;
  const { r, line } = rd;
  const ids = new Set([...r.nodes.map((n) => n.id), ...r.roads.map((x) => x.id)]);
  const fresh = (base: string) => { let i = 1; while (ids.has(`${base}${i}`)) i++; ids.add(`${base}${i}`); return `${base}${i}`; };
  const { q: p, i } = nearestOn(line.pts, at);
  const site = r.sites.find((x) => x.id === toward);
  const feat = toward ? r.features.find((f) => f.id === toward || f.name.toLowerCase() === toward.toLowerCase()) : undefined;
  let end = site ? r.nodes.find((n) => n.kind === 'site' && n.site === site.id) : undefined;
  if (site && !end) r.nodes.push((end = { id: fresh(`${r.id}_n`), kind: 'site', at: site.at, site: site.id }));
  if (!end) {
    let q = feat?.at;
    if (!q) { // a short path of its own, off to one side of the road, kept inside the region
      const a = line.pts[i], b = line.pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
      const lo = { x: r.gx * r.size, y: r.gy * r.size }, inside = (o: Pt) => o.x >= lo.x && o.x <= lo.x + r.size && o.y >= lo.y && o.y <= lo.y + r.size;
      const m = CONFIG.SIDE_WAY_M, one = { x: p.x + nx * m, y: p.y + ny * m }, two = { x: p.x - nx * m, y: p.y - ny * m };
      q = inside(one) ? one : two;
    }
    r.nodes.push((end = { id: fresh(`${line.id}_end`), kind: 'junction', at: q, ...(feat ? { feature: feat.id } : {}) }));
  }
  const jn: RoadNode = { id: fresh(`${line.id}_side`), kind: 'junction', at: p };
  r.nodes.push(jn);
  r.roads.push({ id: fresh(`${line.id}_way`), kind: 'path', ...(name ? { name } : {}), danger: line.danger, ends: [jn.id, end.id], pts: [p, end.at], length: Math.round(Math.hypot(end.at.x - p.x, end.at.y - p.y)), crossings: [] });
  return jn.id;
}

/** WI9 a / WI10 a: the world check. Each broken rule is one line in plain words, naming what broke:
 * - a road of the land has at most one area, the one it records;
 * - a junction's area exists and is outdoors and no road's own area; a site's settlement exists and is a top place, and
 *   no second top place stands on that site (areas around a junction and places inside a settlement are free);
 * - every built road that ends at a junction or site leads, at that end, into it, or to new ground keyed by it while it
 *   is unbuilt;
 * - no new ground leads to land already built, and every plain way leads to an area.
 * Two ways between the same two areas are allowed (WI6: a place can have two doors). */
export function worldCheck(s: GameState): string[] {
  const out: string[] = [];
  for (const r of regions(s)) {
    for (const line of r.roads) {
      const on = s.zones.filter((z) => z.road === line.id);
      if (line.zone && !zoneById(s, line.zone)) out.push(`road ${line.id} records area ${line.zone}, which does not exist`);
      if (on.length > 1) out.push(`road ${line.id} has ${on.length} areas (${on.map((z) => z.id).join(', ')}); a road is one area`);
      else if (on.length === 1 && line.zone !== on[0].id) out.push(`area ${on[0].id} runs along road ${line.id}, but the road records ${line.zone ?? 'no area'}`);
    }
    for (const n of r.nodes) {
      if (n.kind === 'edge') continue;
      if (n.kind === 'junction' && n.zone) {
        const z = zoneById(s, n.zone);
        if (!z) out.push(`junction ${n.id} records area ${n.zone}, which does not exist`);
        else if (roofed(s, z) || z.road) out.push(`junction ${n.id}'s area ${z.id} is ${z.road ? `road ${z.road}'s own area` : 'indoors'}`);
      }
      if (n.kind === 'site') {
        const site = r.sites.find((x) => x.id === n.site), p = site?.placeId ? s.places.find((x) => x.id === site.placeId) : undefined;
        if (site?.placeId && !p) out.push(`site ${site.id} records settlement ${site.placeId}, which does not exist`);
        else if (p?.parentId) out.push(`site ${site!.id}'s settlement ${p.id} is not a top place`);
        const tops = s.places.filter((x) => !x.parentId && x.site === n.site);
        if (tops.length > 1) out.push(`site ${n.site} has ${tops.length} settlements (${tops.map((x) => x.id).join(', ')}); a site holds one`);
      }
      for (const line of roadsAt(r, n.id)) {
        const rz = line.zone ? zoneById(s, line.zone) : undefined;
        if (!rz) continue;
        const t = landZone(s, n.id, line.id);
        if (t) { if (!group(s, rz).some((z) => leadsTo(s, z).some((to) => group(s, t).some((g) => g.id === to)))) out.push(`road ${line.id}'s area ${rz.id} does not lead into ${t.id}, built at its end ${n.id}`); }
        else if (!waysOut(s, rz.id).some((l) => l.frontier && l.to === n.id)) out.push(`road ${line.id}'s area ${rz.id} has no way on toward its unbuilt end ${n.id}`);
      }
    }
  }
  for (const z of s.zones) for (const l of waysOut(s, z.id)) {
    const built = l.frontier && landTarget(s, l.to) ? landZone(s, l.to, z.road) : undefined;
    if (built) out.push(`${z.id}'s way "${l.label}" is new ground, but ${l.to} is already built as ${built.id}`);
    else if (!l.frontier && !zoneById(s, l.to)) out.push(`${z.id}'s way "${l.label}" leads to ${l.to}, which is no area`);
  }
  return out;
}
