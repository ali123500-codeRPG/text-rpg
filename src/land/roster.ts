// NR17 to NR20, NR27, NR31: who the world holds. Code rolls, seeded by the land's own ids so a roll never changes, which
// hooks a settlement holds, which groups travel a road and who stands at a landmark; the World builder fills them as cast
// entries naming the roster key. Everyone else is crowd, written into how a place looks.
import type { GameState, LandFeature, LandView, Pt, Region, RoadLine, Site } from '../types';
import { cellAt, regionAt } from './sight';
import type { RosterView } from '../types/views';
import type { CastRecipe, RecipePart, HookKindDef, MeetRow, SettlementSize } from '../types/library';
import { getLibrary } from '../library';
import { CONFIG } from '../config';
import { RANKS, type GrandeurKey, type RankKey } from '../scales';
import { rankAbove } from '../library/spawn';
import { createRng, textSeed } from '../rng';
import { RC } from '../library/raceIds';
import { PF } from '../library/npcLayerIds';

type Rng = ReturnType<typeof createRng>;
/** a composition as a cast entry names it (NG15) */
export type RosterCompose = { race: string; role: string; theme: string; rank: string; class?: string; prefix?: string; grandeur?: GrandeurKey };
/** one rolled roster entry: a single person (compose) or a group (group + rank), with what it gives play */
export type RosterEntry = { key: string; who: string; gives: string; /** its hook kind (HK…) */ hook?: string; compose?: RosterCompose; group?: { id: string; rank: string }; goals?: true;
  /** NF4 b: its hook is notable, so whoever fills it is a notable foe */
  notable?: true };

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[rng.int(0, xs.length - 1)];
/** a weighted roll over { key: weight } */
export function rollWeights(rng: Rng, w: Record<string, number>): string {
  const rows = Object.entries(w).filter(([, n]) => n > 0), total = rows.reduce((n, [, x]) => n + x, 0);
  let r = rng.next() * total;
  for (const [k, n] of rows) if ((r -= n) < 0) return k;
  return rows[rows.length - 1][0];
}
/** a rank `steps` above another, by RANKS positions */
export const rankUp = (rank: string, steps = 1): string => rankAbove(rank as RankKey, steps);
/** NR31 a: a person's race: elves about 1 in 20, else human */
export const rollRace = (rng: Rng) => (rng.int(1, 100) <= CONFIG.ROSTER_ELF_PCT ? RC.elf : RC.human);
const rollRow = (rng: Rng, rows: readonly MeetRow[]) => {
  const g = rollWeights(rng, Object.fromEntries(rows.map((r, i) => [String(i), r.weight])));
  return rows[Number(g)];
};
/** NR17: settlement sizes, smallest first */
export const SETTLEMENT_SIZES: readonly SettlementSize[] = ['hamlet', 'village', 'town', 'city', 'court'];
/** NF7 a: the groups a hook can roll in a settlement of this size (a group's minSite keeps the larger rung out of villages) */
export function hookGroups(h: HookKindDef, size: SettlementSize): string[] {
  const groups = getLibrary().castRecipes ?? {}, at = SETTLEMENT_SIZES.indexOf(size);
  return (h.groups ?? []).filter((id) => { const min = groups[id]?.minSite; return !min || SETTLEMENT_SIZES.indexOf(min) <= at; });
}
const groupEntry = (key: string, g: CastRecipe, rank: string, hook?: { id: string; name: string; gives: string }): RosterEntry =>
  ({ key, who: hook?.name ?? g.name, gives: hook?.gives ?? g.lead.label, ...(hook ? { hook: hook.id } : {}), group: { id: g.id, rank } });

/** NR17 a: a settlement's hooks, by its size: the must-have hooks first, then the rest from the size's pool */
export function siteRoster(site: Site): RosterEntry[] {
  const lib = getLibrary(), row = lib.rosters?.[site.size];
  if (!row) return [];
  const rng = createRng(textSeed(`roster:${site.id}`)), n = rng.int(row.count[0], row.count[1]);
  const hooks = [...row.must];
  const pool = [...row.pool];
  while (hooks.length < n && pool.length) hooks.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  while (hooks.length < n) hooks.push(pick(rng, row.pool));
  const R = CONFIG.ROSTER_RANKS;
  return hooks.slice(0, Math.max(n, row.must.length)).map((id, i) => {
    const h = lib.hookKinds![id], key = `${site.id}.h${i + 1}`;
    const rank = h.rank === 'seat' ? (() => { const r = rollWeights(rng, R.seat[site.size]); return rng.int(1, 100) <= CONFIG.SEAT_STEP_UP_PCT ? rankUp(r) : r; })()
      : rollWeights(rng, h.rank === 'threat' ? R.threat[site.size] : R[h.rank]);
    const gs = hookGroups(h, site.size);
    if (gs.length) return groupEntry(key, lib.castRecipes![pick(rng, gs)], rank, h);
    // NR40 a: a seat of the Great is always grand
    const compose: RosterCompose = { race: rollRace(rng), role: pick(rng, h.roles ?? []), theme: h.theme ?? row.theme, rank, ...(h.class ? { class: h.class } : {}), ...(h.rank === 'seat' ? { grandeur: 'grand' as const } : {}) };
    return { key, who: h.name, gives: h.gives, hook: h.id, compose, ...(h.goals ? { goals: true as const } : {}), ...(h.notable ? { notable: true as const } : {}) };
  });
}

/** NR18 a: the groups on a stretch of road, by its danger */
export function roadRoster(road: RoadLine): RosterEntry[] {
  const lib = getLibrary(), row = lib.roadPeople?.[road.danger];
  if (!row) return [];
  const rng = createRng(textSeed(`roster:${road.id}`)), n = rng.int(row.count[0], row.count[1]);
  return Array.from({ length: n }, (_, i) => groupEntry(`${road.id}.g${i + 1}`, lib.castRecipes![rollRow(rng, row.rows).group], rollWeights(rng, CONFIG.ROSTER_RANKS.road[road.danger])));
}

/** NR20 a: who is at a landmark: one group from its kind's rows, or nobody */
export function landmarkRoster(f: LandFeature): RosterEntry[] {
  const lib = getLibrary(), rows = lib.landmarkPeople?.[f.kind];
  if (!rows?.length) return [];
  const rng = createRng(textSeed(`roster:${f.id}`));
  return [groupEntry(`${f.id}.g1`, lib.castRecipes![rollRow(rng, rows).group], rollWeights(rng, CONFIG.ROSTER_RANKS.wild))];
}

/** NR19 a: who can be met on each land cover the region has, at this time of day (the World builder casts from it) */
type WildRow = { cover: string; meet: { group: string; who: string; weight: number }[] };
export function wildTable(r: Region, night: boolean): WildRow[] {
  const lib = getLibrary(), covers = [...new Set(r.cover)].map((ch) => `LC${parseInt(ch, 36)}`);
  return covers.flatMap((c) => {
    const rows = (lib.wildPeople?.[c] ?? []).filter((m) => !m.when || m.when === (night ? 'night' : 'day'));
    return rows.length ? [{ cover: lib.landCovers?.[c]?.name ?? c, meet: rows.map((m) => ({ group: m.group, who: lib.castRecipes![m.group].name, weight: m.weight })) }] : [];
  });
}

/** every roster entry of a region by key (sites, roads, landmarks) */
export function regionRoster(r: Region): Map<string, RosterEntry> {
  return new Map([...r.sites.flatMap(siteRoster), ...r.roads.flatMap(roadRoster), ...r.features.flatMap(landmarkRoster)].map((e) => [e.key, e]));
}
/** a roster entry by its key, in any region of the world */
export function rosterEntry(state: GameState, key: string): RosterEntry | undefined {
  const r = state.regions?.find((x) => key.startsWith(`${x.id}_`));
  return r ? regionRoster(r).get(key) : undefined;
}

/** NR27 (D-308): a group's members as compositions (or templates): the leader and its seconds (NF7 a) `step` ranks up,
 * followers' races rolled (NR31); notable when its part is (NF7 a) */
export function groupMembers(g: CastRecipe, rank: string, seed: string, direPct = 0): { label: string; compose?: RosterCompose; template?: string; lead: boolean; second?: true; notable?: true }[] {
  const rng = createRng(textSeed(`group:${seed}`)), lib = getLibrary();
  const one = (p: RecipePart, lead: boolean, second = false) => {
    const marks = { ...(p.notable ? { notable: true as const } : {}), ...(second ? { second: true as const } : {}) };
    if (p.template) return { label: p.label, template: p.template, lead, ...marks };
    const role = p.role ?? pick(rng, p.roles ?? []);
    // NR38 a: a beast may roll the Dire prefix (one rank up and more health, in composeTemplate); its label says so
    const dire = lib.npcRoles?.[role]?.kind === 'beast' && rng.int(1, 100) <= direPct ? PF.dire : undefined;
    const m = p.label.match(/^(a|an|the) (.*)$/), word = dire ? lib.prefixes![dire].name.toLowerCase() : '';
    const label = !dire ? p.label : m ? `${m[1] === 'the' ? 'the' : 'a'} ${word} ${m[2]}` : `${word} ${p.label}`;
    return { label, lead, ...marks, compose: { race: p.race ?? rollRace(rng), role, theme: g.theme, rank: rankUp(rank, p.step ?? 0), ...(p.class ? { class: p.class } : {}), ...(dire ? { prefix: dire } : {}) } };
  };
  const count = (p?: { count: [number, number] }) => (p ? rng.int(p.count[0], p.count[1]) : 0);
  const n2 = count(g.seconds), n = count(g.follow);
  return [one(g.lead, true), ...Array.from({ length: n2 }, () => one(g.seconds!, false, true)), ...Array.from({ length: n }, () => one(g.follow!, false))];
}

/** the roster entries not yet filled, as a planner sees them (is = who code rolled) */
function rosterViews(state: GameState, es: RosterEntry[]): RosterView[] {
  const lib = getLibrary(), filled = new Set(state.hidden.rosterFilled ?? []);
  const rankName = (k: string) => RANKS.name(k as never);
  return es.filter((e) => !filled.has(e.key)).map((e) => ({ key: e.key, who: e.who, gives: e.gives,
    is: e.group ? `${lib.castRecipes?.[e.group.id]?.name ?? e.group.id}, ${rankName(e.group.rank)}`
      : `${lib.races?.[e.compose!.race]?.name ?? e.compose!.race} ${lib.npcRoles?.[e.compose!.role]?.name ?? e.compose!.role}, ${rankName(e.compose!.rank)}`,
    ...(e.goals ? { goals: true as const } : {}) }));
}

/** RE4: who an encounter on a road can be, for its Weaver: the road's unfilled travellers (NR18) and the wild table for the
 * land cover at the encounter point (NR19) */
export function encounterPeople(state: GameState, roadId: string | undefined, at: Pt, night: boolean): { travellers?: RosterView[]; wild?: WildRow['meet'] } {
  const road = roadId ? state.regions?.flatMap((x) => x.roads).find((x) => x.id === roadId) : undefined;
  const travellers = road ? rosterViews(state, roadRoster(road)) : [];
  const r = regionAt(state, at), i = r ? cellAt(r, at) : -1;
  const cover = r && i >= 0 ? getLibrary().landCovers?.[`LC${parseInt(r.cover[i], 36)}`]?.name : undefined;
  const wild = r && cover ? wildTable(r, night).find((x) => x.cover === cover)?.meet : undefined;
  return { ...(travellers.length ? { travellers } : {}), ...(wild?.length ? { wild } : {}) };
}

/** NR17 to NR20: the World builder's land view: each unfilled roster entry beside its site, road or landmark, and the wild table */
export function withRosters(state: GameState, land: LandView, night: boolean): LandView {
  const r = state.regions?.find((x) => x.id === land.region);
  if (!r) return land;
  const view = (es: RosterEntry[]) => rosterViews(state, es);
  const nonEmpty = <T extends object>(k: string, xs: RosterView[], o: T) => (xs.length ? { ...o, [k]: xs } : o);
  return {
    ...land,
    sites: land.sites.map((s) => { const site = r.sites.find((x) => x.id === s.id); return site ? nonEmpty('roster', view(siteRoster(site)), s) : s; }),
    roads: land.roads.map((x) => { const road = r.roads.find((y) => y.id === x.id); return road ? nonEmpty('travellers', view(roadRoster(road)), x) : x; }),
    landmarks: land.landmarks.map((l, i) => (r.features[i] ? nonEmpty('people', view(landmarkRoster(r.features[i])), l) : l)),
    wild: wildTable(r, night),
  };
}
