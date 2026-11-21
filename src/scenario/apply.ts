// Applying a stage plan (Scenario setup steps 4–8), the fallback stage, opening events.
import { endSuspicions } from '../engine/suspicion';
import { freshId } from '../ids';
import { expireOffers } from '../engine/essence';
import { frameOf, holdForInner, holdsInner } from '../engine/scenarioEnd';
import { qualityMult } from '../ruleset/quality';
import type { Actor, Barrier, GameEvent, GameState, ItemDef, ItemInstance, NpcTemplate, Place, Rng, StagePlan, Tier, TitleSpec, WayKind, WaySpec, Zone, OrderTemplate, Trigger, Secret } from '../types';
import { CONFIG } from '../config';
import { LIFE_STAGES, TALENTS, ROAD_DANGERS, ROAD_LENGTHS, TIME_OF_DAY, SCENARIO_SCALES } from '../scales';
import { WAY_KINDS, addTitles, drawPlan, drawTitles } from '../plan/draw';
import { dropOnGround } from '../engine/ground';
import { furnitureIn } from '../engine/furniture';
import { placeHasForge } from '../engine/repair';

import { FU, ZK } from '../library/tableIds';
import { distOrNull, entryPoint, placeAll, standingAt, startAtDoor, titleMiddle } from '../engine/position';
import { clockSet, now, startClock } from '../time';
import { activity, getLibrary, itemDef, npcTemplate, routine, routineSet } from '../library';
import { composeTemplate, rankPos, roleMissing, presetPersonality, spawnNpc, templateRank } from '../library/spawn';
import type { MeetRow } from '../types/library';
import type { RankKey } from '../scales';
import { groupMembers, rosterEntry } from '../land/roster';
import { cellAt, regionAt } from '../land/sight';
import { topPlace } from '../engine/relations';
import { HK } from '../library/npcLayerIds';
import { createRng } from '../rng';
import { personalityFrom } from '../ruleset/personality';
import { installRoutines, desiredState, detectPlayer, headTo, knownFromTheStart } from '../minds';
import { perceivesNow } from '../engine/yield';
import { updateBeliefs, computePerception } from '../perception';
import { buildActorView } from '../views';
import { actorById, atLeast, isActive, stance, zoneById } from '../engine/relations';
import { power } from '../engine/xp';
import { startSpar } from '../engine/spar';
import { seedGoals } from '../engine/goals';
import { noteZonesSeen } from '../engine/trail';
import type { PlanContext, PlanError } from './index';
import { stageFrontiers, tidyContainers, tidyRewards } from './validate';
import { joinFrontier, joinWay, landNode, landRoad, landTarget, landZone, makeLandWays, openSideWay } from './ways';
import { wornPack } from '../engine/containers';
import { requirement } from '../ruleset/requirements';
import { maxMorale, isBrokenLevel, moraleLevel, setMoraleLost } from '../ruleset/morale';
import { CL } from '../library/classIds';
import { IT } from '../library/itemIds';
import { armorStop, shieldPool } from '../library/gearScale';
import { addCastPower, addWant } from './wants';

/** NG15: a composition's template, kept as a story blueprint (one per composition), so its copies rebuild on load and the GM
 * view lists it under "Made this story" with Send to library */
function composedBlueprint(state: GameState, c: NonNullable<StagePlan['cast'][number]['compose']>, label: string): NpcTemplate {
  const t = composeTemplate(c, label);
  if (!state.blueprints.some((b) => b.kind === 'npcTemplate' && b.id === t.id))
    state.blueprints.push({ storyId: state.storyId, id: t.id, kind: 'npcTemplate', data: { ...t, name: label } as unknown as Record<string, unknown> });
  return t;
}

/** CK6 a, CK9 a: the threats a scenario's place rolls from: an encounter on a road by the road's danger, else the land cover at the
 * encounter point, else the settlement's threat hook; only groups marked threat. Undefined where the place has none. */
function threatTable(state: GameState, placeId: string): { rows: MeetRow[]; ranks: Record<string, number>; dire: boolean } | undefined {
  const lib = getLibrary(), R = CONFIG.ROSTER_RANKS, enc = state.stage.encounter;
  const only = (rows: MeetRow[] | undefined) => (rows ?? []).filter((m) => lib.groups?.[m.group]?.threat);
  let t: { rows: MeetRow[]; ranks: Record<string, number>; dire: boolean } | undefined;
  if (enc) {
    const z = zoneById(state, enc.zone), r = regionAt(state, enc.at), i = r ? cellAt(r, enc.at) : -1;
    if (z?.danger) t = { rows: only(lib.roadPeople?.[z.danger]?.rows), ranks: R.road[z.danger], dire: z.danger !== 'safe' && z.danger !== 'quiet' };
    else if (r && i >= 0) t = { rows: only(lib.wildPeople?.[`LC${parseInt(r.cover[i], 36)}`]), ranks: R.wild, dire: true };
  } else {
    const top = topPlace(state, placeId), site = (state.regions ?? []).flatMap((r) => r.sites).find((s) => s.placeId === top);
    if (site) t = { rows: only((lib.hookKinds?.[HK.threat]?.groups ?? []).map((g) => ({ group: g, weight: 1 }))), ranks: R.threat[site.size], dire: true };
  }
  return t?.rows.length && t.ranks ? t : undefined;
}

/** CK6 a: the place's usual hostile group power (the weighted median over its threat groups and rank weights, one fixed
 * roll per pair, no Dire) and the highest rank its table can bring (a leader's step and Dire included); undefined where
 * the place has no threat table (CK9 a). Probes are built on a copy of the state's blueprint list, never stored. */
export function usualThreat(state: GameState, placeId: string): { power: number; top: number } | undefined {
  const t = threatTable(state, placeId);
  if (!t) return undefined;
  const lib = getLibrary(), memo = new Map<string, number>();
  const one = (m: ReturnType<typeof groupMembers>[number]): number => {
    const tpl = m.compose ? composeTemplate(m.compose, m.label) : npcTemplate(state, m.template!);
    if (!memo.has(tpl.id)) {
      const s = m.compose ? { ...state, blueprints: [...state.blueprints, { storyId: state.storyId, id: tpl.id, kind: 'npcTemplate' as const, data: tpl as unknown as Record<string, unknown> }] } : state;
      memo.set(tpl.id, power(s, spawnNpc(s, tpl.id, { id: `probe_${tpl.id}`, zone: '', placeId: '', bandId: '' }, createRng(1))));
    }
    return memo.get(tpl.id)!;
  };
  const cells = t.rows.flatMap((row) => Object.entries(t.ranks).map(([rank, w]) => ({
    weight: row.weight * w, power: groupMembers(lib.groups![row.group], rank, `usual:${row.group}:${rank}`).reduce((n, m) => n + one(m), 0) })))
    .sort((a, b) => a.power - b.power);
  const half = cells.reduce((n, c) => n + c.weight, 0) / 2;
  let acc = 0;
  const median = cells.find((c) => (acc += c.weight) >= half)!.power;
  const maxRank = Math.max(...Object.keys(t.ranks).map((k) => rankPos(k as RankKey)));
  const top = Math.max(...t.rows.map((row) => {
    const g = lib.groups![row.group], beast = [g.lead, g.follow].some((p) => [p?.role, ...(p?.roles ?? [])].some((r) => r && lib.npcRoles?.[r]?.kind === 'beast'));
    return maxRank + (g.lead.step ?? 0) + (t.dire && beast ? 1 : 0);
  }));
  return { power: median, top };
}

/** NG16 b, CK6 a: three readings logged beside the Weaver's declared challenge grade, none of them a verdict: danger to the
 * player (the hostile cast's power, those hostile or opposed, over the player's), local pressure (over the place's usual
 * hostile group; unknown where the place has no threat table, CK9 a) and exceptional (ranks the strongest hostile stands
 * above anything the place can roll, CK10 a). Nothing is refused and no NPC changes. */
function logCastPower(state: GameState, challenge: string, cast: Actor[], placeId: string): void {
  const foes = cast.filter((a) => ['hostile', 'opposed'].includes(stance(state, a, state.player)));
  const hostile = foes.reduce((n, a) => n + power(state, a), 0), player = power(state, state.player), r2 = (x: number) => Math.round(x * 100) / 100;
  const usual = usualThreat(state, placeId);
  const ranks = foes.map((a) => { const t = a.core.templateId ? npcTemplate(state, a.core.templateId) : undefined, k = t && templateRank(t); return k ? rankPos(k) : -Infinity; });
  const above = usual && ranks.length ? Math.max(...ranks) - usual.top : 0;
  addCastPower(state.hidden, { turn: state.turn, scenario: state.stage.scenarioNumber, challenge, hostile: Math.round(hostile), player: Math.round(player),
    ratio: player > 0 ? r2(hostile / player) : 0, ...(usual ? { usual: Math.round(usual.power), local: usual.power > 0 ? r2(hostile / usual.power) : 0 } : {}), ...(above > 0 ? { exceptional: above } : {}) });
}

/** every settlement site of the world's land */
const sites = (state: GameState) => (state.regions ?? []).flatMap((r) => r.sites);

export { freshId };

/** WI8 a: a zone just built joins the world's live zones */
function putOnStage(state: GameState, z: Zone): void {
  if (!state.zones.includes(z)) state.zones.push(z);
}

function moveTo(state: GameState, a: Actor, zoneId: string): void {
  const z = zoneById(state, zoneId);
  if (!z) return;
  a.zone = z.id;
  a.placeId = z.placeId;
}

/** SD3–SD5: the plan's barriers on ways, one record for both sides of each (a way the Weaver barred twice keeps the first);
 * returns each with the key holders it names, and each by the way it is on (`from>to`, plan keys) */
function makeBarriers(state: GameState, plan: StagePlan, zoneRef: (r: string) => string): { list: { b: Barrier; keys: string[] }[]; byWay: Map<string, Barrier> } {
  const list: { b: Barrier; keys: string[] }[] = [], byWay = new Map<string, Barrier>();
  const taken = new Set(Object.keys(state.barriers ?? {}));
  for (const z of plan.zones) for (const l of z.ways) {
    const spec = l.barrier;
    const k = spec && getLibrary().barrierKinds?.[spec.kind];
    if (!spec || !k || byWay.has(`${z.key}>${l.to}`) || byWay.has(`${l.to}>${z.key}`)) continue;
    const from = zoneRef(z.key), to = zoneRef(l.to);
    const b: Barrier = {
      id: freshId(`way_${from}_${to}`, taken), kind: k.id, grade: spec.grade ?? 'minor', scenario: state.stage.scenarioNumber,
      ...(k.lock && spec.locked ? { lock: { locked: true } } : {}),
      ...(k.bar && spec.barredFrom ? { bar: { side: zoneRef(spec.barredFrom), drawn: true } } : {}),
      ...(k.blocked ? { blocked: true as const } : {}),
      ...(spec.guarded ? { guarded: true as const } : {}),
    };
    // BA3: a door with keys but not locked now still has a lock
    if (!b.lock && k.lock && spec.keys?.length) b.lock = { locked: false };
    (state.barriers ??= {})[b.id] = b;
    byWay.set(`${z.key}>${l.to}`, b);
    list.push({ b, keys: spec.keys ?? [] });
  }
  return { list, byWay };
}

/** the player crosses into the placed `entry` (NW3: not when it was built ahead for an NPC). BG-226: they stand a step
 * inside the way they came in by, never at the middle of the zone (on a road, kilometres on) */
function enterFrontier(state: GameState, entry: Zone): void {
  const from = state.player.zone;
  moveTo(state, state.player, entry.id);
  const at = entryPoint(state, entry.id, from, state.player);
  if (at) { state.player.pos = at; state.player.floor = entry.floor; }
}

function setFallbackFlags(state: GameState, reason: string, code: 'weaver_fallback' | 'routine_fallback', errors: PlanError[], actors?: string[]): void {
  state.stage.fallback = { reason, turn: state.turn };
  if (actors) state.stage.routineFallback = { actors, turn: state.turn };
  state.log.push({ turn: state.turn, code, detail: { reason, errors: errors.map((e) => ({ ...e })) } });
}

function idleHere(a: Actor, here: string, turn: number, at: number): void {
  const m = a.mind!;
  m.routines = ['idle_here'];
  m.slots = { here };
  delete m.routineSetId;
  m.routine = { id: 'idle_here', anchorTurn: turn, at };
}

export function mint(state: GameState, m: Exclude<StagePlan['rewards'][number]['item'], string>, n: number): string {
  const base = itemDef(state, m.base);
  const q = qualityMult(m.quality);
  const T = CONFIG.QUALITY_TABLE;
  const def: ItemDef = { ...structuredClone(base), id: `${base.id}_m${state.turn}_${n}`, name: m.name, look: m.look, base: { itemId: base.id, quality: m.quality, boosts: m.boosts }, ...(m.fragility ? { fragility: m.fragility } : {}) }; // BK1 c: the Weaver may set how easily it breaks
  const need = requirement(def)?.need ?? 0; // gear stats scale with the minted level's need (QUALITY_LEVEL_UP_FROM and better move it up a level)
  if (def.weapon) {
    for (const mode of def.weapon.modes) {
      if (m.boosts === 'damageAdj') { // QE2: fractions stay
        const use = def.gearClass ? getLibrary().gearClasses?.[def.gearClass]?.use : undefined; // the gear class's melee/ranged tag, not the mode's (a thrown dagger is melee gear)
        const f = (CONFIG.DAMAGE_CLASS_FACTOR[mode.class] ?? 1) * (CONFIG.DAMAGE_TREE_FACTOR[use === 'melee' || use === 'ranged' ? use : mode.tree] ?? 1);
        mode.damageAdj = (mode.damageAdj ?? 0) + Math.round(CONFIG.QUALITY_DAMAGE_FACTOR * need * q * f * 100) / 100;
      } else mode.hitAdj = (mode.hitAdj ?? 0) + Math.round(CONFIG.QUALITY_HIT_FACTOR * need * q);
    }
  }
  if (def.armor) def.armor.reduction = armorStop(def.armor.weight, need) + Math.round(CONFIG.ARMOR_QUALITY_FACTOR * need * q); // QE4, QE6, D-368
  if (def.shield) def.shield.pool = shieldPool(need) + Math.round(CONFIG.POOL_QUALITY_FACTOR * need * q); // QE5, QE6
  if (def.kind === 'tool') for (const e of def.effects ?? []) if (e.kind === 'skill') e.value += T.tool[m.quality];
  state.blueprints.push({ storyId: state.storyId, id: def.id, kind: 'item', data: def as unknown as Record<string, unknown> });
  state.scenarioCaps.minted += 1;
  return def.id;
}

/** reset scenario-scoped records at a scenario start (Scenarios: Start). */
export function beginScenario(state: GameState, tier: Tier, beyond?: number): void {
  // SW10 a: a Situation started between Situations sits inside the running Episode, which becomes the bigger scenario
  const st = state.stage;
  if (st.between && st.scenario && !st.outer) {
    holdForInner(state, st.scenario);
    st.outer = st.scenario;
    delete st.scenario;
    state.log.push({ turn: state.turn, code: 'episode_inner', detail: { outer: st.outer.number } });
  }
  delete st.between;
  state.stage.tier = tier;
  if (beyond) state.stage.tierBeyond = beyond; else delete state.stage.tierBeyond;
  state.stage.scenarioNumber += 1;
  state.stage.scenarioStartTurn = state.turn;
  delete state.stage.fallback;
  delete state.stage.routineFallback;
  delete state.stage.partner;
  state.stage.quiet = 0;
  delete state.stage.breakCause;
  delete state.stage.roam; // SD2 a: free roam ends when a scenario starts
  delete state.stage.window; // WB6: an open window is moot once a scenario starts
  expireOffers(state, true); // growth proposal 2.5: an essence offer lasts until a new scenario starts
  state.scenarioCaps = { promotions: 0, minted: 0 };
  endYields(state);
  delete state.stage.forbidden; // GD1 b: each scenario sets its own
  endSuspicions(state); // GD5 a
}

/** Q1 (option A): when the scenario ends, a yielded actor holds a grudge (opposed) toward those it
 * yielded to, its surrender ends (Morale: it lasts the scenario), and it leaves for its exit slot if it has one.
 * NW1: nobody leaves the world; it walks to its exit zone (head_to, NW2) and its routine carries on from there. */
function endYields(state: GameState): void {
  // Q4: broken and surrendered last only the scenario (Morale); MB9: a bar still at Broken moves up to Panicking, one point short of Broken
  for (const a of state.actors) if (a.mind?.moraleState) delete a.mind.moraleState;
  delete state.yielding; // MB42: the truce lasts the scenario
  delete state.offers; // TF16: so does a stand-down truce
  for (const a of [state.player, ...state.actors]) if (isBrokenLevel(moraleLevel(a))) setMoraleLost(a, maxMorale(a) - 1);
  for (const a of state.actors) {
    const o = a.mind?.overrides;
    if (!o || !Object.values(o).includes('yielded')) continue;
    for (const k of Object.keys(o)) if (o[k] === 'yielded') o[k] = 'opposed';
    const slot = a.mind!.slots?.exit;
    const exit = Array.isArray(slot) ? slot[0] : slot;
    if (isActive(a) && exit && zoneById(state, exit) && exit !== a.zone) headTo(state, a, exit, 'yield');
  }
}

/** TV3/TV4: a road is one long zone, ROAD_WIDTH_M wide, its length from the Weaver's word or km (an hour's walk when
 * left out), with a danger (quiet when left out) */
export function roadShape(length: string | number | undefined, danger: string | undefined): { area: number; aspect: number; danger: NonNullable<Zone['danger']> } {
  const km = typeof length === 'number' ? length : CONFIG.ROAD_LENGTH_KM[ROAD_LENGTHS.has(length) ? length : 'hour'];
  const m = km * 1000, w = CONFIG.ROAD_WIDTH_M;
  return { area: m * w, aspect: Math.max(1, m / w), danger: ROAD_DANGERS.has(danger) ? danger : 'quiet' };
}

/** BF1: set up hiding: stealthy now, or on a routine that keeps it stealthy (a thief prowling, someone lying low) */
const hiding = (m: Actor): boolean => m.posture === 'stealthy' || (!!m.mind?.routine && routine(m.mind.routine.id).posture === 'stealthy');

export function applyStagePlan(state: GameState, plan: StagePlan, ctx: PlanContext, opts: { entry: 'open' | 'stealthy'; degrade?: PlanError[] }, rng: Rng): void {
  const turn = state.turn;
  // T8: the story's first plan sets the clock (to the start of day if it names no time)
  if (!clockSet(state)) startClock(state, TIME_OF_DAY.has(plan.timeOfDay) ? plan.timeOfDay : 'morning');
  const allZoneIds = new Set([...state.places.flatMap((p) => p.zones.map((z) => z.id)), ...stageFrontiers(state)]);

  // ---- keys -> stable ids (plan keys first, then existing ids) ----
  const placeMap = new Map<string, string>();
  // BG-32: the bare place made for the story start (ensurePlace) is filled in by the plan's place of the same key, never doubled
  const bare = (id: string) => state.places.find((p) => p.id === id && p.bare);
  const placeTaken = new Set(state.places.filter((p) => !bare(p.id)).map((p) => p.id));
  for (const p of plan.places) placeMap.set(p.key, freshId(p.key, placeTaken));
  const zoneMap = new Map<string, string>();
  // BG-286 (BF93 a): a zone keyed as a frontier on the stage builds that frontier: it keeps the frontier's id and is joined
  // to it (joinFrontier) below, as when the player walks through it, so the way is never built twice
  const builtFrontiers = plan.zones.filter((z) => z.key !== ctx.frontierKey && stageFrontiers(state).has(z.key)).map((z) => z.key);
  for (const z of plan.zones) zoneMap.set(z.key, builtFrontiers.includes(z.key) ? z.key : freshId(z.key, allZoneIds));
  const frontierMap = new Map<string, string>();
  for (const f of plan.frontiers) {
    frontierMap.set(f.key, freshId(f.key, allZoneIds));
    if (f.brief?.trim()) (state.hidden.frontierBriefs ??= {})[frontierMap.get(f.key)!] = f.brief.trim(); // WB3
  }
  const bandMap = new Map<string, string>();
  const bandTaken = new Set(state.bands.map((b) => b.id));
  for (const b of plan.bands) bandMap.set(b.key, freshId(b.key, bandTaken));
  const castMap = new Map<string, string>();
  const actorTaken = new Set([state.player.id, ...state.actors.map((a) => a.id)]);
  for (const c of plan.cast) castMap.set(c.key, c.actor ?? freshId(c.key, actorTaken));

  const placeRef = (r: string) => placeMap.get(r) ?? r;
  const zoneRef = (r: string) => zoneMap.get(r) ?? r;
  const bandRef = (r: string) => bandMap.get(r) ?? r;
  const actorRef = (r: string) => castMap.get(r) ?? r;
  const anyRef = (r: string) => castMap.get(r) ?? zoneMap.get(r) ?? r;
  const stageZones = new Set(state.zones.map((z) => z.id)); // WI8 a: every built zone
  const isZoneRef = (r: string) => zoneMap.has(r) || stageZones.has(r);
  // WI2 a: a link to a land road, junction or site id is the way along the land: to its zone if built, else new ground keyed by it
  const landRef = (r: string) => (zoneMap.has(r) || stageZones.has(r) || !landTarget(state, r) ? undefined : landZone(state, r)?.id ?? r);

  // ---- places and zones ----
  const sited: string[] = []; // WI2 a: settlements set on their sites by this plan
  for (const p of plan.places) {
    const node: Place = {
      id: placeMap.get(p.key)!, storyId: state.storyId, kind: p.kind, parentId: p.parent ? placeRef(p.parent) : null,
      names: { current: p.name, past: [] }, zones: [], state: {}, headlines: [],
    };
    // WZ1/WZ13: a settlement stands on its site; the story's first top-level place stands on the brief's start site
    const site = sites(state).find((x) => x.id === (p.site ?? (!node.parentId && ctx.site && !sites(state).some((y) => y.id === ctx.site && y.placeId) ? ctx.site : undefined)));
    if (site && !node.parentId) { node.site = site.id; site.placeId = node.id; sited.push(node.id); }
    const stub = bare(node.id);
    if (stub) { Object.assign(stub, { ...node, zones: stub.zones }); delete stub.bare; }
    else state.places.push(node);
  }
  // RE8 a: a road encounter's zone that opens a side way is built at a junction code adds on the road where it stands
  const enc = state.stage.encounter, encRoad = enc ? zoneById(state, enc.zone) : undefined;
  const side = encRoad?.road ? plan.zones.find((z) => z.sideWay && !z.node && !z.road) : undefined;
  if (side) { const jn = openSideWay(state, encRoad!.road!, enc!.at, side.sideWay!.toward, side.sideWay!.name); if (jn) side.node = jn; }
  // SD3–SD5: the plan's barriers, one record for both sides of each way (a way the Weaver barred twice keeps the first)
  const barriers = makeBarriers(state, plan, zoneRef);
  const specs: TitleSpec[] = [];
  for (const z of plan.zones) {
    const ways: WaySpec[] = z.ways.map((l) => {
      const kind = l.kind && WAY_KINDS.includes(l.kind) ? { kind: l.kind } : {};
      const barrier = barriers.byWay.get(`${z.key}>${l.to}`) ?? barriers.byWay.get(`${l.to}>${z.key}`);
      const land = landRef(l.to);
      if (land !== undefined && land !== l.to) return { to: land, label: l.label, ...kind };
      const fr = frontierMap.get(l.to) ?? (!isZoneRef(l.to) ? l.to : undefined);
      return fr !== undefined ? { to: fr, label: l.label, ...kind, frontier: true as const } : { to: zoneRef(l.to), label: l.label, ...kind, ...(barrier ? { barrier: barrier.id } : {}), ...(l.doorless ? { doorless: true as const } : {}) };
    });
    const k = getLibrary().zoneKinds?.[z.kind ?? '']; // the validator checked it (a road has none)
    // WZ1: a road along a road of the land takes its real length and its danger from it, and is drawn along its line (PZ9)
    const line = z.road ? state.regions?.flatMap((r) => r.roads).find((x) => x.id === z.road) : undefined;
    const road = line ? { danger: line.danger, road: line.id, line: line.pts.map((q) => ({ ...q })) } : z.length !== undefined || z.danger !== undefined ? roadShape(z.length, z.danger) : {};
    specs.push({
      id: zoneMap.get(z.key)!, placeId: placeRef(z.place), ...(z.kind ? { kind: z.kind } : {}), name: z.name, look: z.look,
      ...(z.light ? { light: z.light } : {}), area: z.area ?? CONFIG.ZONE_SIZE_M2[z.size ?? k?.size ?? 'room'], ...road,
      ...(z.walls ? { walls: z.walls } : {}), ...(z.furniture ? { furniture: z.furniture } : {}), ways, // FR2: the kind's furniture when left out
    });
    if (line) line.zone = zoneMap.get(z.key)!;
    const jn = z.node ? landNode(state, z.node)?.node : undefined;
    if (jn?.kind === 'junction') jn.zone = zoneMap.get(z.key)!; // WI2 a: a junction is built once and keeps its title
  }
  // PZ14 a: the titles and their ways, then (an extension's entry joined first, BG-225, BG-285) the land's ways, then the plan
  const draft = addTitles(state, specs);
  const newZones = draft.titles;
  if (ctx.frontierKey && newZones[0]) joinFrontier(state, ctx.frontierKey, newZones[0]);
  for (const key of builtFrontiers) joinFrontier(state, key, newZones.find((z) => z.id === key)!);
  if (side?.node) { const z = zoneById(state, zoneMap.get(side.key)!); if (z) joinWay(state, encRoad!, z); } // RE8: beside the road
  makeLandWays(state, newZones, sited.map((id) => state.places.find((p) => p.id === id)!)); // WI2 a
  drawPlan(state, draft);
  const firstZone = newZones[0]?.id;
  const startZone = state.player.zone; // CH1: the zone the player stood in when the scenario began is ground
  if (ctx.frontierKey && newZones[0] && !ctx.ahead) enterFrontier(state, newZones[0]);
  // at story start the player stands in no built zone yet; it starts in the plan's first zone (CS2)
  const storyStart = !!firstZone && !zoneById(state, state.player.zone);
  // BG-273, BG-1549: a new character, and the player at story start, arrives where the plan says (arriveAt: an area on the
  // stage or a new zone), else in its first new zone
  const arriveAt = (ctx.arrive || storyStart) && plan.arriveAt ? zoneRef(plan.arriveAt) : undefined;
  if (arriveAt && zoneById(state, arriveAt)) moveTo(state, state.player, arriveAt);
  else if (storyStart) moveTo(state, state.player, firstZone!);
  else if (ctx.wake && firstZone) moveTo(state, state.player, firstZone); // D-54: the player wakes somewhere safe

  // ---- bands (existing bands keep theirs) ----
  for (const b of plan.bands) {
    state.bands.push({
      id: bandMap.get(b.key)!, name: b.name, goals: b.goals, temperament: b.temperament,
      lethal: b.lethal ?? true,
      ...(b.chase ? { chase: b.chase } : {}), // CH5
      relations: Object.fromEntries(Object.entries(b.relations ?? {}).map(([k, v]) => [bandRef(k), v])),
    });
  }

  // ---- cast ----
  const degraded = new Set((opts.degrade ?? []).filter((e) => e.routineOnly && e.castKey !== undefined).map((e) => e.castKey!));
  const castActors: Actor[] = [];
  const reused = new Set<Actor>(); // NW7: actors already in the world never jump; they walk
  for (const c of plan.cast) {
    const id = castMap.get(c.key)!;
    const boundZones = Object.values(c.slots ?? {}).flat().filter((z) => typeof z === 'string' && isZoneRef(z)).map(zoneRef);
    const startZone = boundZones[0] ?? firstZone ?? state.player.zone;
    const startPlace = zoneById(state, startZone)?.placeId ?? ctx.placeId;
    let a: Actor;
    if (c.actor) {
      a = actorById(state, c.actor)!;
      reused.add(a);
      a.label = c.label;
      // someone brought back keeps their names; the plan's name is ignored (CS2)
    } else {
      const t = c.compose ? composedBlueprint(state, c.compose, c.label) : npcTemplate(state, c.template!); // NG15
      const personality = c.personality ? personalityFrom(presetPersonality(t, id), c.personality) : undefined; // PL12 on the NG14 layers
      const z0 = zoneById(state, startZone);
      a = spawnNpc(state, t.id, { id, zone: startZone, placeId: startPlace, ...(z0 ? { at: titleMiddle(z0) } : {}), bandId: bandRef(c.band), label: c.label, name: c.name, storyId: state.storyId, ...(personality ? { personality } : {}), ...(LIFE_STAGES.keyOf(c.age) ? { ageStage: LIFE_STAGES.keyOf(c.age) } : {}), ...(TALENTS.keyOf(c.talent) ? { talent: TALENTS.keyOf(c.talent) } : {}) }, rng);
      a.unplaced = true; // ZP1: placeAll gives it a free spot in its title
      state.actors.push(a);
    }
    a.bandId = bandRef(c.band);
    if (c.roster && rosterEntry(state, c.roster)?.notable) a.core.notable = true; // NF4 b
    const unique = a.core.generation === 'unique'; // HF15: a unique's looks and pronouns are its own
    if (!unique || !a.appearance) a.appearance = c.appearance;
    if (c.pronouns && (!unique || !a.pronouns)) a.pronouns = c.pronouns;
    if (c.knownOnSight) a.knownOnSight = c.knownOnSight;
    if (c.knownAs) a.knownAs = c.knownAs;
    a.mind!.knows = (c.knows ?? []).map((f) => ({ id: f.id, text: f.text }));
    if (c.wares) stockWares(state, a, c.wares, turn);
    if (!reused.has(a)) moveTo(state, a, startZone);
    castActors.push(a);
  }
  plan.cast.forEach((c, i) => {
    const a = castActors[i];
    for (const o of c.overrides ?? []) (a.mind!.overrides ??= {})[actorRef(o.actor)] = o.stance;
    if (degraded.has(c.key)) {
      const here = Object.values(c.slots ?? {}).flat().find((z) => typeof z === 'string' && isZoneRef(z));
      idleHere(a, here ? zoneRef(here) : (firstZone ?? a.zone), turn, now(state));
    } else {
      const slots = Object.fromEntries(Object.entries(c.slots ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.map(zoneRef) : zoneRef(v)]));
      installRoutines(a, c.routineSetId, withBed(state, c.routineSetId, slots, a.zone), c.startAt, turn, rng, now(state));
    }
    // NW7: a reused actor stays where it is. One the player can't perceive walks to its start (head_to), then takes up
    // its new routine; one the player perceives is not sent anywhere, and its new routine walks it on from where it stands.
    if (reused.has(a)) {
      const d = desiredState(buildActorView(state, a.id));
      if (d && d.zone !== a.zone && !perceivesNow(state, state.player, a, 'faint')) headTo(state, a, d.zone, 'weaver');
    }
  });
  // step 5: each actor stands in its default routine's desired zone for the current turn (SC12: arrivals walk in instead)
  if (ctx.kind !== 'checkin') for (const a of castActors) {
    if (reused.has(a)) continue; // NW7
    const d = desiredState(buildActorView(state, a.id));
    if (d) moveTo(state, a, d.zone);
  }

  // ---- beliefs: opening (open entry only), then band beliefs (whatever the entry) ----
  if (opts.entry === 'open') {
    plan.cast.forEach((c, i) => updateBeliefs(state, { kind: 'opening', observerId: castActors[i].id, aboutId: state.player.id, status: c.awarenessOfPlayer, zone: state.player.zone, source: 'seen' }));
  }
  // arrival detection for a stealthy entry (step 7): the caller runs stealthyArrival
  const onStage = new Set(state.zones.map((z) => z.id));
  plan.cast.forEach((c, i) => {
    for (const bb of c.awarenessOfBands ?? []) {
      const band = bandRef(bb.band);
      for (const m of [state.player, ...state.actors]) {
        if (m.bandId !== band || m.id === castActors[i].id || !onStage.has(m.zone)) continue;
        updateBeliefs(state, { kind: 'opening', observerId: castActors[i].id, aboutId: m.id, status: bb.awareness, zone: m.zone, source: 'seen' });
      }
    }
  });
  // BF1 (BG-114): the cast already knows everyone it can see at the opening, so the scene the Weaver set holds. Someone set
  // up hiding (a stealthy routine) is not known: the stealth contests find them as play starts. The player is known only as
  // awarenessOfPlayer says. Arrivals walk in and are noticed in play (SC12).
  if (ctx.kind !== 'checkin') {
    for (const o of castActors) for (const m of state.actors) {
      if (m === o || !isActive(m) || !onStage.has(m.zone) || atLeast(o.mind?.knowledge[m.id]?.status, 'aware') || !perceivesNow(state, o, m, 'faint') || hiding(m)) continue;
      updateBeliefs(state, { kind: 'opening', observerId: o.id, aboutId: m.id, status: 'aware', zone: m.zone, source: 'seen' });
    }
    knownFromTheStart(state, castActors);
  }

  // ---- seeds ----
  const tpl = (t: OrderTemplate): OrderTemplate => ({ ...t, ...(t.actorId ? { actorId: actorRef(t.actorId) } : {}), target: t.target && !t.target.startsWith('$') ? anyRef(t.target) : t.target });
  const trig = (t: Trigger): Trigger => {
    const w = t.when;
    const when = w.type === 'player_seen_in_zone' ? { ...w, zone: zoneRef(w.zone) } : w.type === 'actor_down' ? { ...w, actorId: actorRef(w.actorId) } : { ...w };
    return { ...t, ownerId: actorRef(t.ownerId), when, then: tpl(t.then) };
  };
  for (const p of plan.seeds.plans) {
    const owner = actorRef(p.ownerId);
    state.hidden.plans[owner] = { goal: p.goal, steps: [...p.steps], triggers: (p.triggers ?? []).map(trig), createdTurn: turn };
  }
  for (const t of plan.seeds.triggers) {
    const b = trig(t);
    // a seeded trigger whose owner has no plan gets an empty-goal plan to hold it (CS2)
    (state.hidden.plans[b.ownerId] ??= { goal: '', steps: [], triggers: [], createdTurn: turn }).triggers.push(b);
  }
  for (const s of plan.seeds.secrets) {
    const r = s.revealWhen;
    const revealWhen: Secret['revealWhen'] = r.type === 'event_in_zone' ? { ...r, zone: zoneRef(r.zone) } : { ...r, againstActorId: actorRef(r.againstActorId) };
    state.hidden.secrets.push({ ...s, holderId: actorRef(s.holderId), leakTerms: [...s.leakTerms], revealWhen });
  }

  // SP2: spars the scenario opens with
  for (const sp of plan.spars ?? []) startSpar(state, sp.sides.map((x) => x.map(actorRef)), !!sp.cruel, 'weaver');

  // BA3: keys to the plan's barriers, carried by the actors it names
  for (const { b, keys } of barriers.list) for (const k of keys) {
    const holder = actorById(state, actorRef(k));
    if (holder) holder.core.inventory.push({ id: `key_${b.id}_${holder.id}`, itemId: IT.key, opens: [b.id] });
  }

  // ---- CT2: containers (a worn pack is put on by a carrier who wears none), their owners, locks and keys ----
  const boxes = new Map<string, { inst: ItemInstance; holder?: Actor }>();
  const tc = tidyContainers(state, plan);
  if (tc.notes.length) state.log.push({ turn, code: 'container_repaired', detail: { notes: tc.notes.map((e) => e.message) } });
  for (const c of tc.containers) {
    const inst: ItemInstance = { id: `ct${turn}_${c.key}`, itemId: c.item, ...(c.owner ? { owner: actorRef(c.owner) } : {}),
      ...(c.locked ? { lock: { locked: true }, grade: c.locked.grade ?? 'minor' } : {}) };
    const pl = c.place as { carriedBy?: string; groundIn?: string };
    const holder = pl.carriedBy !== undefined ? actorById(state, actorRef(pl.carriedBy)) : undefined;
    if (holder) {
      if (itemDef(state, c.item).container?.worn && !holder.core.inventory.some(wornPack)) inst.equippedIn = ['pack'];
      holder.core.inventory.push(inst);
    } else dropOnGround(state, { zone: zoneRef(pl.groundIn!) }, inst);
    boxes.set(c.key, { inst, ...(holder ? { holder } : {}) });
    for (const k of c.locked?.keys ?? []) {
      const kh = actorById(state, actorRef(k));
      if (kh) kh.core.inventory.push({ id: `key_${inst.id}_${kh.id}`, itemId: IT.key, opens: [inst.id] });
    }
  }

  // GD1 b: what guards are after here this scenario (catalog items only)
  const forbidden = (plan.forbidden ?? []).filter((id) => { try { return !!itemDef(state, id); } catch { return false; } });
  if (forbidden.length) state.stage.forbidden = forbidden;

  // ---- rewards ----
  const { rewards, notes } = tidyRewards(state, plan);
  if (notes.length) state.log.push({ turn, code: 'reward_repaired', detail: { notes: notes.map((e) => e.message) } });
  const made = new Map<string, string[]>(), plain = new Set<string>(); // BG-227: what this plan makes from each base item
  rewards.forEach((r, i) => {
    const itemId = typeof r.item === 'string' ? r.item : mint(state, r.item, i);
    const def = itemDef(state, itemId);
    if (typeof r.item === 'string') plain.add(r.item);
    else if (def.base) made.set(def.base.itemId, [...(made.get(def.base.itemId) ?? []), itemId]);
    const qty = r.qty ?? 1;
    const id = `rw${turn}_${i}_${itemId}`;
    const own = r.owner && actorById(state, actorRef(r.owner)) ? { owner: actorRef(r.owner) } : {}; // BF18
    const insts: ItemInstance[] = def.stackable ? [{ id, itemId, qty, ...own }] : Array.from({ length: qty }, (_, n) => ({ id: n ? `${id}_${n}` : id, itemId, ...own }));
    const pl = r.place as { carriedBy?: string; groundIn?: string; hiddenAt?: Tier; in?: string };
    const box = pl.in !== undefined ? boxes.get(pl.in) : undefined;
    // CT7: what goes into a worn pack is its wearer's stowed gear; into any other container, its contents
    if (box) { if (box.holder && wornPack(box.inst)) box.holder.core.inventory.push(...insts); else (box.inst.contents ??= []).push(...insts); }
    else if (pl.carriedBy !== undefined) actorById(state, actorRef(pl.carriedBy))!.core.inventory.push(...insts);
    else dropOnGround(state, { zone: zoneRef(pl.groundIn!) }, ...insts.map((x) => (pl.hiddenAt ? { ...x, hiddenAt: { tier: pl.hiddenAt }, knownTo: [] } : x))); // SE8
  });

  // ---- hidden stage, note, cast notes ----
  const hs = state.hidden.stage;
  if (ctx.kind === 'scenario') state.hidden.stage = { eventSummary: plan.event.summary, challenge: plan.event.challenge, gain: plan.event.gain, hiddenTerms: [...plan.hiddenTerms] };
  // an extension keeps the scenario's grades; its summary is appended and its hiddenTerms join the stage's (CS2)
  // WB1: a World builder's ground is the world's, not the scenario's: only its hidden terms join
  else state.hidden.stage = { ...hs, eventSummary: [hs.eventSummary, ctx.world ? '' : plan.event.summary].filter(Boolean).join(' / '), hiddenTerms: [...new Set([...hs.hiddenTerms, ...plan.hiddenTerms])] };
  if (ctx.world) state.hidden.worldNote = plan.weaverNote; // WB1: each role keeps its own note
  else state.hidden.weaverNote = plan.weaverNote;
  // SC1/SC2/SC7: a new scenario's question, scale and endings, plan keys mapped to ids
  const frameRef = (k: 'band' | 'place' | 'actor', r: string) => (k === 'band' ? bandRef(r) : k === 'actor' ? actorRef(r) : placeMap.get(r) ?? zoneMap.get(r) ?? r);
  // BG-227: an ending that names the base item this plan makes one item from means that made item (the Weaver can't know
  // its id yet); with a plain one placed too, or more than one made, it stays as written
  if (plan.scenario) for (const e of plan.scenario.endings ?? []) {
    const w = e?.when as { kind?: string; item?: string } | undefined;
    if (!(w?.kind === 'hold' || w?.kind === 'deliver') || !w.item || !made.has(w.item)) continue;
    const from = w.item, one = !plain.has(from) && made.get(from)!.length === 1;
    if (one) w.item = made.get(from)![0];
    // BF55: filed as a bug either way, so the Weaver's habit can be looked into
    state.log.push({ turn, code: 'ending_item_remapped', detail: { from, ...(one ? { to: w.item } : { made: made.get(from), plainToo: plain.has(from) }) } });
  }
  if (ctx.kind === 'scenario') {
    // SW10 a: with no bigger scenario running, the plan's episode is the bigger one and its scenario the first part inside it
    const st = state.stage, epScale = SCENARIO_SCALES.keyOf(plan.episode?.scale), inScale = SCENARIO_SCALES.keyOf(plan.scenario?.scale);
    if (plan.episode && !st.outer && epScale && holdsInner(epScale) && !(inScale && holdsInner(inScale))) {
      st.outer = frameOf(state, plan.episode, ctx.tier, frameRef);
      st.scenarioNumber += 1; // its first part is a scenario of its own (a check-in names the one it is about)
      state.log.push({ turn, code: 'episode_planned', detail: { number: st.outer.number, scale: st.outer.scale } });
    }
    st.scenario = frameOf(state, plan.scenario, ctx.tier, frameRef);
    // an Episode (or bigger) on its own: between parts from the start, so danger and windows start the parts inside it
    if (!st.outer && holdsInner(st.scenario.scale)) st.between = { since: turn, sinceMin: now(state) };
  }
  // CH1: the ground: the start zone, every zone this scenario's plans build, and the stage zones they name (links, slots)
  const named = [...plan.zones.flatMap((z) => z.ways.map((l) => l.to)), ...plan.cast.flatMap((c) => Object.values(c.slots ?? {}).flat())]
    .filter((r): r is string => typeof r === 'string' && stageZones.has(r));
  const ground = [...(ctx.kind === 'scenario' && !ctx.wake ? [startZone] : []), ...newZones.map((z) => z.id), ...named].filter((z) => zoneById(state, z));
  if (ctx.kind === 'scenario' && state.stage.scenario) {
    state.stage.scenario.ground = [...new Set(ground)];
    if (state.stage.outer) state.stage.outer.ground = [...new Set([...(state.stage.outer.ground ?? []), ...ground])]; // SW10 a: the episode holds each part's ground
  }
  else if (state.stage.scenario?.ground) state.stage.scenario.ground = [...new Set([...state.stage.scenario.ground, ...ground])];
  // SC12: a check-in may change the running scenario's question, scale and endings; its number, start and records stay
  else if (ctx.kind === 'checkin' && plan.scenario && state.stage.scenario) {
    const f = frameOf(state, plan.scenario, state.stage.scenario.tier, frameRef);
    Object.assign(state.stage.scenario, { question: f.question, scale: f.scale, endings: f.endings, ...(f.stake ? { stake: f.stake } : {}) });
  }
  state.hidden.castNotes ??= {};
  plan.cast.forEach((c, i) => (state.hidden.castNotes![castActors[i].id] = { motive: c.motive, ...(c.routineGap ? { routineGap: c.routineGap } : {}), ...(c.templateGap ? { templateGap: c.templateGap } : {}) }));
  // NG15: who the Weaver wanted and couldn't field, kept for the GM view so a template can be made
  for (const c of plan.cast) if (c.roster && !state.hidden.rosterFilled?.includes(c.roster)) (state.hidden.rosterFilled ??= []).push(c.roster); // NR17
  plan.cast.forEach((c, i) => { // NR28: a composition by wanted skills whose role lacks some of them
    const w = c.compose?.wants, missing = w ? roleMissing(c.compose!.role, w.skills) : [];
    if (missing.length) addWant(state.hidden, 'roleWants', { turn: state.turn, scenario: state.stage.scenarioNumber, actorId: castActors[i].id, label: w!.label, skills: w!.skills, role: c.compose!.role, missing });
  });
  plan.cast.forEach((c, i) => { if (c.templateGap) addWant(state.hidden, 'templateWants', { turn: state.turn, scenario: state.stage.scenarioNumber, actorId: castActors[i].id, label: c.label, wanted: c.templateGap, template: castActors[i].core.templateId ?? '' }); });
  // D-53 a: a routine the Weaver wanted and no set gave, in the same GM list
  plan.cast.forEach((c, i) => { if (c.routineGap) addWant(state.hidden, 'templateWants', { turn: state.turn, scenario: state.stage.scenarioNumber, actorId: castActors[i].id, label: c.label, wanted: c.routineGap, template: c.routineSetId, of: 'routine' }); });
  if (ctx.kind === 'scenario') logCastPower(state, plan.event.challenge, castActors, ctx.placeId); // NG16 b, CK6 a
  // UG3: goal holders: the template's standing goal, then the Weaver's goals, their keys read as ids
  const aboutRef = (r: string) => castMap.get(r) ?? placeMap.get(r) ?? zoneMap.get(r) ?? r;
  plan.cast.forEach((c, i) => {
    const a = castActors[i], standing = a.core.templateId ? npcTemplate(state, a.core.templateId).standingGoal : undefined;
    if (c.goals?.length || standing) seedGoals(state, a, (c.goals ?? []).map((g) => ({ text: g.text, ...(g.about?.length ? { about: g.about.map(aboutRef) } : {}) })), standing);
  });

  if (degraded.size) {
    const actors = plan.cast.filter((c) => degraded.has(c.key)).map((c) => castMap.get(c.key)!);
    setFallbackFlags(state, 'routine_fallback', 'routine_fallback', opts.degrade!.filter((e) => e.routineOnly), actors);
  }
  placeAll(state); // ZP1: the cast and anyone moved by the scenario get spots in their zones
  if (storyStart) startAtDoor(state, ctx.placeId); // BG-49: the story opens with the player at the door
  noteZonesSeen(state); // BG-313: what the player sees from where the plan leaves it is on the Map before the first turn
}

/** At story start the player's place has no node yet (CS2); a bare one is made so the Weaver's plan (and the fallback) can use its id. */
export function ensurePlace(state: GameState, placeId: string): Place {
  let place = state.places.find((p) => p.id === placeId);
  if (!place) {
    place = { id: placeId, storyId: state.storyId, kind: 'place', parentId: null, names: { current: placeId, past: [] }, zones: [], state: {}, headlines: [], bare: true };
    state.places.push(place);
  }
  return place;
}

/** BG-126: the fallback's empty ground is open ground with a kind and a size, drawn like any title */
function bareZone(id: string, placeId: string, name: string, ways: WaySpec[] = []): TitleSpec {
  const k = getLibrary().zoneKinds![ZK.field];
  return { id, placeId, kind: ZK.field, name, look: '', area: CONFIG.ZONE_SIZE_M2[k.size], ways };
}

export function applyFallbackStage(state: GameState, ctx: PlanContext, reason: string, errors: PlanError[]): void {
  const place = ensurePlace(state, ctx.placeId);
  const startZone = state.player.zone;
  if (ctx.frontierKey) {
    // one empty title per frontier label: the crossed frontier's label (from the first way that names it)
    const link = state.openings.find((o) => o.frontier && o.joins[1] === ctx.frontierKey);
    const taken = new Set([...state.places.flatMap((p) => p.zones.map((z) => z.id)), ...stageFrontiers(state)]);
    taken.delete(ctx.frontierKey);
    const spec = bareZone(freshId(ctx.frontierKey, taken), ctx.placeId, link?.labels[0] ?? ctx.frontierKey);
    // WI2 a: new ground the land draws is that road or junction, even empty, so it is never built a second time
    const land = landTarget(state, ctx.frontierKey);
    const line = land && 'road' in land ? landRoad(state, land.road)?.line : undefined;
    if (line) { Object.assign(spec, { kind: undefined, danger: line.danger, road: line.id, line: line.pts.map((q) => ({ ...q })) }); delete spec.kind; line.zone = spec.id; }
    if (land && 'junction' in land) landNode(state, land.junction)!.node.zone = spec.id;
    const draft = addTitles(state, [spec]);
    const zone = draft.titles[0];
    joinFrontier(state, ctx.frontierKey, zone);
    makeLandWays(state, [zone], []);
    drawPlan(state, draft);
    if (!ctx.ahead) enterFrontier(state, zone);
    if (state.stage.scenario?.ground && ctx.kind === 'extension') state.stage.scenario.ground.push(zone.id); // CH1
  } else {
    if (place?.zones.length) for (const z of place.zones) putOnStage(state, z);
    else if (place) {
      // a scenario start at a place with no saved zones and no frontier gets one empty zone named after the place (CS2)
      const taken = new Set(state.places.flatMap((p) => p.zones.map((z) => z.id)));
      drawTitles(state, [bareZone(freshId(`${place.id}_area`, taken), place.id, place.names.current)]);
    }
    if (place?.zones[0] && !zoneById(state, state.player.zone)) moveTo(state, state.player, place.zones[0].id);
  }
  if (ctx.kind === 'scenario') {
    state.hidden.stage = { eventSummary: '', challenge: 'none', gain: 'none', hiddenTerms: [] };
    state.stage.scenario = frameOf(state, undefined, ctx.tier, (_k, r) => r); // no endings: the stall (and later the budget) ends it
    // CH1: the fallback's ground: where the player stood, where it stands now, and its place's zones
    state.stage.scenario.ground = [...new Set([startZone, state.player.zone, ...(place?.zones ?? []).map((z) => z.id)])].filter((z) => zoneById(state, z));
  }
  placeAll(state); // ZP1, as a built plan: anyone moved onto the fallback ground gets a spot in their zone (BG-150)
  noteZonesSeen(state); // BG-313, as a built plan
  setFallbackFlags(state, reason, 'weaver_fallback', errors);
}

/** ZP1: an event happens at its maker's point */
const atPoint = (a: Actor): Pick<GameEvent, 'pos'> => ({ pos: standingAt(a) });

/** Scenario setup step 7 (case 42): a stealthy player arriving through a frontier is tested by every observer in range;
 * the plan's opening beliefs were skipped for this entry. Returns the arrival event. */
export function stealthyArrival(state: GameState, rng: Rng): GameEvent {
  const p = state.player;
  const ev: GameEvent = { id: `t${state.turn}_arrival`, turn: state.turn, actorId: p.id, kind: 'arrival', zone: p.zone, ...atPoint(p), effects: [], noise: 'quiet', visibility: 'normal', perception: {} };
  ev.perception = computePerception(ev, state, rng);
  detectPlayer(state, ev, rng);
  return ev;
}

/** arrival + presence events for the player's perception (scenario setup step 8). */
export function openingEvents(state: GameState, rng: Rng): GameEvent[] {
  const p = state.player;
  const out: GameEvent[] = [];
  const arrival: GameEvent = { id: `t${state.turn}_arrival`, turn: state.turn, actorId: p.id, kind: 'arrival', zone: p.zone, ...atPoint(p), effects: [], noise: 'quiet', visibility: 'normal', perception: {} };
  arrival.perception = computePerception(arrival, state, rng);
  out.push(arrival);
  const stage = new Set(state.zones.map((z) => z.id));
  for (const a of [...state.actors].sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (!stage.has(a.zone) || !isActive(a)) continue;
    const act = a.mind ? desiredState(buildActorView(state, a.id))?.activity : undefined;
    const def = act ? activity(act) : undefined;
    const ev: GameEvent = {
      id: `t${state.turn}_presence_${a.id}`, turn: state.turn, actorId: a.id, kind: 'presence', zone: a.zone, ...atPoint(a), effects: [],
      noise: def?.noise ?? 'quiet', visibility: def?.visibility ?? 'normal', perception: {}, ...(act ? { activity: act } : {}),
    };
    ev.perception = computePerception(ev, state, rng);
    if (ev.perception[p.id]) out.push(ev);
  }
  return out;
}

/** PY2: only a Trader-class actor sells. Known goods are stocked into its inventory (qty 1 when left out) and known
 * services listed, up to WARES_CAP lines; anything else is dropped and logged. BG-210: a returning Trader keeps what it
 * has: goods are topped up to the listed count, never added on top, and the purse comes only the first time it sells. */
function stockWares(state: GameState, a: Actor, w: NonNullable<StagePlan['cast'][number]['wares']>, turn: number): void {
  const dropped: string[] = [];
  if (!a.core.classes.some((c) => c.classId === CL.trader)) {
    state.log.push({ turn, code: 'wares_dropped', detail: { actorId: a.id, reason: 'not_a_trader' } });
    return;
  }
  const known = (id: string) => { try { return itemDef(state, id); } catch { return undefined; } };
  const items: string[] = [];
  const services: string[] = [];
  for (const g of w.items ?? []) {
    const def = known(g.item);
    if (!def || g.item === IT.coin || items.length + services.length >= CONFIG.WARES_CAP) { dropped.push(String(g.item)); continue; }
    const have = a.core.inventory.filter((i) => i.itemId === g.item).reduce((n, i) => n + (i.qty ?? 1), 0);
    const qty = Math.max(1, Math.floor(g.qty ?? 1)) - have;
    const id = `ware${turn}_${a.id}_${g.item}`;
    if (qty > 0) a.core.inventory.push(...(def.stackable ? [{ id, itemId: g.item, qty }] : Array.from({ length: qty }, (_, n) => ({ id: n ? `${id}_${n}` : id, itemId: g.item }))));
    if (!items.includes(g.item)) items.push(g.item);
  }
  for (const s of w.services ?? []) {
    const sv = getLibrary().services?.[s];
    // RP8 b: repair and use of the forge only where the seller's place has a forge
    if (!sv || items.length + services.length >= CONFIG.WARES_CAP || ((sv.repairs || sv.forge) && !placeHasForge(state, a.placeId))) dropped.push(String(s));
    else if (!services.includes(s)) services.push(s);
  }
  if (!a.wares) a.core.inventory.push({ id: `purse${turn}_${a.id}`, itemId: IT.coin, qty: CONFIG.TRADER_PURSE }); // SL3: the Trader's purse, once
  a.wares = { items, services };
  if (dropped.length) state.log.push({ turn, code: 'wares_dropped', detail: { actorId: a.id, dropped } });
}

/** BF68: everyone whose set has a bed slot gets somewhere to sleep when the plan left it out: a real bed within
 * BED_NEAR_M metres of its own spots by the walking path (nearest first; BG-303), else its refuge (home or a doorway), else its work spot */
export function withBed(state: GameState, setId: string, slots: Record<string, string | string[]>, start: string): Record<string, string | string[]> {
  const set = routineSet(setId);
  if (!set?.slots.bed || (slots.bed !== undefined && [slots.bed].flat().length)) return slots;
  const own = Object.entries(slots).filter(([k]) => k !== 'bed').flatMap(([, v]) => [v].flat());
  const beds = new Set(state.zones.filter((z) => furnitureIn(state, z.id).some((f) => f.kind === FU.bed)).map((z) => z.id));
  // the nearest bed by the walking path from its own spots (and where it starts), within BED_NEAR_M
  const from = [...new Set([...own, start])].filter((z) => zoneById(state, z));
  const away = (b: string) => Math.min(...from.map((z) => distOrNull(state, { zone: z }, { zone: b }) ?? Infinity));
  const found = [...beds].map((b) => ({ b, m: away(b) })).filter((x) => x.m <= CONFIG.BED_NEAR_M).sort((x, y) => x.m - y.m || x.b.localeCompare(y.b))[0];
  if (found) return { ...slots, bed: found.b };
  const refuge = [slots.refuge ?? []].flat()[0];
  const work = ['work', 'post', 'counter', 'seat', 'route'].map((k) => [slots[k] ?? []].flat()[0]).find(Boolean);
  const bed = refuge ?? work ?? start;
  return { ...slots, bed };
}
