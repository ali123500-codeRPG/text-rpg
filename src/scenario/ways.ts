// WI2 a: the land's ways are made by code, once. A road of the land is built as one zone (RoadLine.zone), a junction as
// one zone (RoadNode.zone), a settlement site as one place (Site.placeId). When one is built it takes over every way to
// new ground keyed by it, is joined to each land neighbour already built, and gets a way to new ground (a frontier keyed
// by the land id, labelled from the land) toward each one that is not. Planners write only the ways the land does not
// draw. WI5 a: every way between two zones is joined by joinWay, which writes both ends or keeps an end already there.
import type { GameState, Place, Pt, Region, RoadLine, RoadNode, Zone, ZoneLink } from '../types';
import { OPP_SIDE, SIDE_STEP, SIDE_WORD } from '../types';
import { CONFIG } from '../config';
import { ZK } from '../library/tableIds';
import { zoneById } from '../engine/relations';
import { topPlace } from './stage';

/** WI5 a: the one way to join two zones: each end that is missing is added, an end already there is kept */
export function joinWay(state: GameState, a: Zone, b: Zone, opts: { label?: string; back?: string; sight?: boolean } = {}): void {
  if (a === b) return;
  const sight = opts.sight ?? true;
  if (!a.links.some((l) => l.to === b.id)) a.links.push({ to: b.id, label: opts.label ?? b.name, sight });
  if (!b.links.some((l) => l.to === a.id)) b.links.push({ to: a.id, label: opts.back ?? a.name, sight });
}

/** a way to new ground keyed `key` is built: every link into it now leads to `to` (a zone that already had a way there
 * keeps that one), joined both ways. NW2: anyone heading for it now heads for the zone. */
export function joinFrontier(state: GameState, key: string, to: Zone): void {
  for (const z of state.zones) if (z.links.some((l) => l.frontier && l.to === key)) wayBuilt(state, z, key, to);
  for (const a of state.actors) if (a.mind?.slots?.dest === key) a.mind.slots.dest = to.id;
}
/** zone `z`'s way to new ground `key` now leads to `to`, joined both ways (dropped if `z` already has a way there) */
function wayBuilt(state: GameState, z: Zone, key: string, to: Zone): void {
  const i = z.links.findIndex((l) => l.frontier && l.to === key);
  const l = z.links[i];
  if (z === to || z.links.some((x) => x !== l && x.to === to.id)) z.links.splice(i, 1);
  else { l.to = to.id; delete l.frontier; }
  if (z !== to) joinWay(state, z, to, { sight: l.sight });
}

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
  return zs.find((z) => z.links.some((l) => l.to === road || (line?.zone && l.to === line.zone)))
    ?? [ZK.gate, ZK.square, ZK.street].map((k) => zs.find((z) => z.kind === k)).find(Boolean)
    ?? zs.find((z) => z.outdoor) ?? zs[0];
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
    for (const z of s.zones.filter((x) => x.links.some((l) => l.frontier && l.to === k))) wayBuilt(s, z, k, landZone(s, k, z.road) ?? b.zone);
    for (const a of s.actors) if (a.mind?.slots?.dest === k) a.mind.slots.dest = b.zone.id;
  }
  for (const b of built) {
    const mine = group(s, b.zone);
    for (const n of b.around) {
      const there = landZone(s, n.key, n.road ?? b.zone.road);
      if (there) {
        const theirs = group(s, there);
        if (!mine.some((z) => z.links.some((l) => theirs.some((t) => t.id === l.to)))) joinWay(s, b.zone, there, { label: n.label });
      } else if (!mine.some((z) => z.links.some((l) => l.to === n.key))) {
        b.zone.links.push({ to: n.key, label: n.label, sight: true, frontier: true } satisfies ZoneLink);
      }
    }
  }
}
