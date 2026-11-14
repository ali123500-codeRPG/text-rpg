// BG-57, HB1–HB5: hearing by real metres. A sound's decibels at 1 m (CONFIG.NOISE_DB) weaken 20·log10(metres) with
// distance (the inverse-square law) and lose SOUND_LOSS_DB at each crossing between zones (an open gap nothing, a shut door
// or window 30, a wall 35), by whichever route keeps it loudest. The listener hears it while it is at least HEARING_FLOOR_DB
// and clearly (who and what) from CLEAR_ABOVE_FLOOR_DB over it (per-zone background noise is parked: D-231).
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import type { NoiseKey, SoundLossKey } from '../scales';
import type { GameState, Perception, Zone, ZoneLink } from '../types';
import { pathM, sightDistM, spotOf, withinM, type Located } from '../engine/position';
import { zoneById } from '../engine/relations';
import { doorway, edgeFacing, sameFloor } from '../scenario/geometry';

/** NV5: the noise of a spoken line by its volume (one table for the player's and NPCs' lines) */
export const VOLUME_NOISE = { whisper: 'hushed', normal: 'normal', shout: 'loud' } as const satisfies Record<import('../types').Volume, NoiseKey>;

const lossDb = (k: SoundLossKey | undefined): number => CONFIG.SOUND_LOSS_DB[k ?? 'open'];

/** HB4: what a sound loses crossing link `l`: a barrier by its kind while it is shut (a door, a gate, a hatch; a grate's
 * bars cost nothing); a window (a drop link); a doorway that can't be seen through is a shut door; else an open gap */
function linkLoss(state: GameState, l: ZoneLink): number {
  const b = l.barrier ? state.barriers?.[l.barrier] : undefined;
  if (b) return b.open || b.state === 'destroyed' ? lossDb('open') : lossDb(getLibrary().barrierKinds?.[b.kind]?.sound);
  return lossDb(l.drop ? 'window' : l.sight ? 'open' : 'door');
}

/** every way a sound leaves zone `z` for another stage zone: its links, and (zones with rectangles) the side it shares with
 * a zone on the same floor it has no link to, through that side's edge (a wall, a counter, a window) */
function crossings(state: GameState, z: Zone): { to: string; loss: number }[] {
  const stage = new Set(state.stage.zoneIds);
  const out = z.links.filter((l) => !l.frontier && stage.has(l.to)).map((l) => ({ to: l.to, loss: linkLoss(state, l) }));
  if (!z.rect) return out;
  const kinds = getLibrary().edgeKinds ?? {};
  for (const id of stage) {
    const o = zoneById(state, id);
    if (!o?.rect || o.id === z.id || z.links.some((l) => l.to === id) || !sameFloor(z, o) || !doorway(z, o)) continue;
    const edge = edgeFacing(z, o);
    out.push({ to: id, loss: lossDb(edge ? kinds[edge]?.sound ?? 'wall' : 'wall') });
  }
  return out;
}

/** the least-loss route from one zone to another (the zone ids after `from`) and its loss; null with none */
function quietestRoute(state: GameState, from: string, to: string): { path: string[]; loss: number } | null {
  if (from === to) return { path: [], loss: 0 };
  const best = new Map<string, { cost: number; prev?: string; loss: number }>([[from, { cost: 0, loss: 0 }]]);
  const open = new Set([from]);
  while (open.size) {
    let cur = '', cc = Infinity;
    for (const id of open) { const c = best.get(id)!.cost; if (c < cc || (c === cc && id < cur)) { cur = id; cc = c; } }
    open.delete(cur);
    if (cur === to) break;
    const z = zoneById(state, cur);
    if (!z) continue;
    for (const c of crossings(state, z)) {
      const cost = cc + c.loss + 0.001; // fewer crossings break a tie
      if (cost < (best.get(c.to)?.cost ?? Infinity)) { best.set(c.to, { cost, prev: cur, loss: best.get(cur)!.loss + c.loss }); open.add(c.to); }
    }
  }
  const end = best.get(to);
  if (!end) return null;
  const path: string[] = [];
  for (let id: string | undefined = to; id && id !== from; id = best.get(id)!.prev) path.unshift(id);
  return { path, loss: end.loss };
}

/** the decibels of a sound of this noise, made at `from`, where `to` stands (Keen Ear's `keenDb` adds); null for silence
 * or no route. The route that loses least on the way; across open gaps with sight between them, the straight line. */
export function soundDb(state: GameState, noise: NoiseKey | undefined, from: Located, to: Located, keenDb = 0, leanIn = false): number | null {
  const base = CONFIG.NOISE_DB[noise ?? 'normal'];
  if (base === null || base === undefined) return null;
  const A = spotOf(state, from), B = spotOf(state, to);
  const r = quietestRoute(state, A.zone, B.zone);
  if (!r) return null;
  let m = pathM(state, A, B, r.path);
  if (r.loss === 0 && A.zone !== B.zone) m = Math.min(m, sightDistM(state, A, B));
  // HB8: whispering to someone within reach, the speaker leans in to their ear
  const near = leanIn && r.loss === 0 && withinM(m, CONFIG.WHISPER_REACH_M);
  return base + keenDb - 20 * Math.log10(near ? CONFIG.WHISPER_LEAN_M : Math.max(m, CONFIG.NEAREST_M)) - r.loss;
}

/** HB1: how well the listener hears it: 'full' (who and what) from CLEAR_ABOVE_FLOOR_DB over HEARING_FLOOR_DB, 'partial'
 * (a sound, not who) at the floor, else null */
export function hearingOf(state: GameState, noise: NoiseKey | undefined, from: Located, listener: Located, keenDb = 0, leanIn = false): Perception | null {
  const db = soundDb(state, noise, from, listener, keenDb, leanIn);
  if (db === null) return null;
  const floor = CONFIG.HEARING_FLOOR_DB;
  return db >= floor + CONFIG.CLEAR_ABOVE_FLOOR_DB ? 'full' : db >= floor ? 'partial' : null;
}

/** how many metres a sound of this noise carries in the open (no walls), [clearly, at all] (0: not even at NEAREST_M;
 * null: silence). For the library's noise table and the Keen Ear text. */
export function openAirReachM(noise: NoiseKey, keenDb = 0): [number, number] | null {
  const base = CONFIG.NOISE_DB[noise];
  if (base === null || base === undefined) return null;
  const floor = CONFIG.HEARING_FLOOR_DB;
  const far = (min: number) => { const m = 10 ** ((base + keenDb - min) / 20); return m < CONFIG.NEAREST_M ? 0 : Math.round(m); };
  return [far(floor + CONFIG.CLEAR_ABOVE_FLOOR_DB), far(floor)];
}
