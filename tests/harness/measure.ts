// Balance probe: how often a searcher finds a still hider at an exact distance, searching or waiting, over seeded trials
// on the village fixture through the real turn (resolveTurn and the turn checker, as the case tests play it). Distances
// are the game's own: metres between the two bodies on a clear line (sightDistM). The village's own people are left out,
// and the player stands out of sight in the cellar unless it is one of the two. Every trial checks the gap it got and
// that nobody moved or dropped out of hiding; anything else is a deviation in the result, never a silent change.
// Run it with `npm run measure` (scripts/measure.ts).
import type { Actor, GameState } from '../../src/types';
import { makeVillage, place, beside, actor } from './village';
import { play, intent, plannerOut, act } from '../cases/w4-kit';
import { spawnNpc } from '../../src/library/spawn';
import { getLibrary } from '../../src/library';
import { TP } from '../../src/library/templateIds';
import { CONFIG } from '../../src/config';
import { sightDistM } from '../../src/engine/position';
import { atLeast } from '../../src/engine/relations';
import { beliefStatus, inLookReach } from '../../src/perception';
import { searchReach } from '../../src/minds';
import { searchSees } from '../../src/minds/state';
import { boxOf } from '../../src/plan/geom';
import { functionName } from '../../src/library/functionNames';

/** who: 'player' or a template key (guard, thief …); id: the NPC's actor ID, which seeds a copy's skills and traits (NG9,
 * NG12); perks: perk ids or names added to that side */
export type Side = { who: string; id?: string; perks?: string[] };
export type Scenario = {
  searcher: Side; hider: Side; distanceM: number; modes: ('search' | 'wait')[];
  trials: number; turns: number; seed: number; zone?: string; set?: Record<string, number | boolean | string>;
};
export type ModeResult = { mode: 'search' | 'wait'; found: number; suspicious: number; firstTurns: number[] };
export type Measurement = {
  scenario: Scenario & { zone: string }; searcherId: string; hiderId: string;
  start: { searcher: { x: number; y: number }; hider: { x: number; y: number }; gapM: number };
  reach: ReturnType<typeof searchReach> & { band: string };
  runs: ModeResult[]; deviations: string[];
};

const HIDER_BAND = 'hiders';
const OTHERS = ['guard_1', 'trader', 'patron_1', 'slime_1', 'slime_2'];

function perkId(name: string): string {
  const perks = getLibrary().perks;
  const id = perks[name] ? name : Object.values(perks).find((p) => p.name.toLowerCase() === name.toLowerCase())?.id;
  if (!id) throw new Error(`measure: no perk "${name}"`);
  return id;
}

/** one trial's starting world: the searcher at the west edge of `zone`, the hider `distanceM` east of it, body to body */
function setup(sc: Scenario & { zone: string }, seed: number): { s: GameState; a: Actor; h: Actor } {
  const s = makeVillage({ seed, playerZone: sc.zone, without: OTHERS });
  for (const [k, v] of Object.entries(sc.set ?? {})) (CONFIG as Record<string, unknown>)[k] = v; // makeVillage resets CONFIG
  s.bands.push({ ...s.bands[0], id: HIDER_BAND, name: 'the hiders', relations: {} });
  if (sc.searcher.who !== 'player' && sc.hider.who !== 'player') place(s, 'player', sc.zone === 'tav_cellar' ? 'field_far' : 'tav_cellar');
  const make = (side: Side, id: string, bandId: string): Actor => {
    if (side.who === 'player') return s.player;
    const tp = TP[side.who as keyof typeof TP];
    if (!tp) throw new Error(`measure: no template "${side.who}" (${Object.keys(TP).join(', ')})`);
    s.actors.push(spawnNpc(null, tp, { id, zone: sc.zone, placeId: 'street', bandId, name: side.who, storyId: s.storyId }));
    return place(s, id, sc.zone);
  };
  const a = make(sc.searcher, sc.searcher.id ?? 'searcher', 'village_watch'), h = make(sc.hider, sc.hider.id ?? 'hider', HIDER_BAND);
  if (a.kind === 'player') a.bandId = 'player_band';
  if (h.kind === 'player') h.bandId = HIDER_BAND;
  for (const [x, side] of [[a, sc.searcher], [h, sc.hider]] as const) for (const p of side.perks ?? []) x.core.perks.push({ perkId: perkId(p) } as never);
  const r = boxOf(s.zones.find((z) => z.id === sc.zone)!.outline);
  a.pos = { x: r.x - r.w / 2 + 0.6, y: r.y };
  beside(s, h.id, a.id, sc.distanceM);
  h.posture = 'stealthy';
  return { s, a, h };
}

/** this turn's input: the searcher searches or waits (holds: an NPC's hold, the player's turn with no action), the hider holds */
function input(a: Actor, h: Actor, mode: 'search' | 'wait') {
  const outs = [a, h].filter((x) => x.kind !== 'player').map((x) => plannerOut(x.id, act(x === a && mode === 'search' ? 'search' : 'hold')));
  return { agentOutputs: outs, ...(a.kind === 'player' ? { intent: intent(mode === 'search' ? { action: { type: 'search' } } : {}) } : {}) };
}

export function measure(scenario: Scenario): Measurement {
  const sc = { ...scenario, zone: scenario.zone ?? 'street_square' };
  const deviations: string[] = [];
  const first = setup(sc, sc.seed);
  const gap = (s: GameState, a: Actor, h: Actor) => sightDistM(s, a, h);
  const g0 = gap(first.s, first.a, first.h);
  const { a: a0, h: h0, s: s0 } = first;
  const sr = searchReach(s0, a0);
  const reach = { ...sr, band: searchSees(s0, a0, h0, sr.radiusM) ? 'inside the search area' : searchSees(s0, a0, h0, sr.ring1M) ? 'ring one'
    : inLookReach(g0) ? 'ring two' : 'beyond the look' };
  const runs = sc.modes.map((mode): ModeResult => {
    const res: ModeResult = { mode, found: 0, suspicious: 0, firstTurns: [] };
    for (let i = 0; i < sc.trials; i++) {
      const seed = sc.seed + i, { s, a, h } = setup(sc, seed);
      const at = (x: Actor) => JSON.stringify(x.pos);
      const startA = at(a), startH = at(h), g = gap(s, a, h);
      if (Math.abs(g - sc.distanceM) > 0.01) deviations.push(`seed ${seed}: asked ${sc.distanceM} m, stood ${g.toFixed(2)} m apart`);
      for (let t = 1; t <= sc.turns; t++) {
        play(s, input(a, h, mode), seed * 7919 + t);
        if (at(actor(s, a.id)) !== startA || at(actor(s, h.id)) !== startH) deviations.push(`${mode} seed ${seed} turn ${t}: someone moved (gap now ${gap(s, a, h).toFixed(2)} m)`);
        if (actor(s, h.id).posture !== 'stealthy') deviations.push(`${mode} seed ${seed} turn ${t}: the hider is no longer hiding (${h.posture})`);
        const st = beliefStatus(s, a, h);
        if (atLeast(st, 'aware')) { res.found++; res.firstTurns.push(t); break; }
        if (t === sc.turns && st === 'suspicious') res.suspicious++;
      }
    }
    return res;
  });
  return { scenario: sc, searcherId: a0.id, hiderId: h0.id, start: { searcher: a0.pos!, hider: h0.pos!, gapM: g0 }, reach, runs, deviations };
}

const n2 = (x: number) => x.toFixed(2);
/** the compact text report scripts/measure.ts prints */
export function report(m: Measurement): string {
  const sc = m.scenario, r = m.reach;
  const side = (x: Side, id: string) => `${x.who}${x.who !== 'player' ? ` (${TP[x.who as keyof typeof TP]}, id ${id})` : ''}${x.perks?.length ? ` +perks ${x.perks.join(', ')}` : ''}`;
  const terms = (xs: { source: string; value: number }[], unit: string) => xs.length ? xs.map((x) => `${x.source} ${x.value}${unit}`).join(', ') : 'none';
  const pct = (n: number) => `${(100 * n / sc.trials).toFixed(1)}%`;
  return [
    `scenario   ${side(sc.searcher, m.searcherId)} looks for ${side(sc.hider, m.hiderId)} in ${sc.zone}; the hider is hiding and waits`,
    `config     ${Object.entries(sc.set ?? {}).map(([k, v]) => `${k}=${v}`).join(' ') || 'defaults'}`,
    `window     ${sc.trials} trials x up to ${sc.turns} turn(s); seeds ${sc.seed}..${sc.seed + sc.trials - 1} (village seed; turn t rolls seed*7919+t)`,
    `positions  asked ${n2(sc.distanceM)} m body to body; stood ${n2(m.start.gapM)} m (searcher (${n2(m.start.searcher.x)}, ${n2(m.start.searcher.y)}), hider (${n2(m.start.hider.x)}, ${n2(m.start.hider.y)}))`,
    `search     sense ${functionName(r.sense)}, effective skill ${n2(r.skill)}: base ${n2(r.baseM2)} m² (SEARCH_AREA_M2 ${CONFIG.SEARCH_AREA_M2} x skill / ${CONFIG.SEARCH_AREA_SKILL_BASE})`,
    `           searchArea: ${terms(r.areaPct, '%')}; searchReach: ${terms(r.reachM, ' m')} (x ${CONFIG.SEARCH_M2_PER_REACH_M} m² per m)`,
    `           area ${n2(r.areaM2)} m², radius ${n2(r.radiusM)} m (min ${CONFIG.SEARCH_MIN_RADIUS_M}), ring one to ${n2(r.ring1M)} m; the hider is ${r.band}`,
    ...m.runs.map((x) => `${x.mode.padEnd(10)} found ${x.found}/${sc.trials} (${pct(x.found)})${x.firstTurns.length && sc.turns > 1 ? `, mean turn ${(x.firstTurns.reduce((n, t) => n + t, 0) / x.firstTurns.length).toFixed(1)}` : ''}; suspicious only ${x.suspicious}`),
    m.deviations.length ? `DEVIATIONS ${m.deviations.length}:\n  ${m.deviations.slice(0, 10).join('\n  ')}${m.deviations.length > 10 ? '\n  …' : ''}` : 'deviations none: every trial stood at the asked gap, and nobody moved or stopped hiding',
  ].join('\n');
}
