// Applying a stage plan (Scenario setup steps 4–8), the fallback stage, opening events.
import { expireOffers } from '../engine/essence';
import { frameOf } from '../engine/scenarioEnd';
import { qualityMult } from '../ruleset/quality';
import type { Actor, Barrier, GameEvent, GameState, ItemDef, ItemInstance, Place, Rng, StagePlan, Tier, Zone, ZoneLink, OrderTemplate, Trigger, Secret } from '../types';
import { CONFIG } from '../config';
import { LIFE_STAGES, ROAD_DANGERS, ROAD_LENGTHS, TIME_OF_DAY } from '../scales';
import { SIDES } from '../types';
import { inferHeights } from './heights';
import { placeZones } from './geometry';
import { placeAll, startAtDoor } from '../engine/position';
import { clockSet, now, startClock } from '../time';
import { activity, getLibrary, itemDef, npcTemplate } from '../library';
import { spawnNpc } from '../library/spawn';
import { personalityFrom } from '../ruleset/personality';
import { installRoutines, desiredState, detectPlayer, headTo } from '../minds';
import { perceivesNow } from '../engine/yield';
import { updateBeliefs, computePerception } from '../perception';
import { buildActorView } from '../views';
import { actorById, isActive, zoneById } from '../engine/relations';
import { startSpar } from '../engine/spar';
import type { PlanContext, PlanError } from './index';
import { stageFrontiers, tidyRewards } from './validate';
import { requirement } from '../ruleset/requirements';
import { maxMorale, moraleLevel, setMoraleLost } from '../ruleset/morale';
import { CL } from '../library/classIds';
import { IT } from '../library/itemIds';

export function freshId(key: string, taken: Set<string>): string {
  let id = key;
  for (let n = 2; taken.has(id); n++) id = `${key}_${n}`;
  taken.add(id);
  return id;
}

function putOnStage(state: GameState, z: Zone): void {
  if (!state.stage.zoneIds.includes(z.id)) state.stage.zoneIds.push(z.id);
  if (!state.zones.includes(z)) state.zones.push(z);
}

function moveTo(state: GameState, a: Actor, zoneId: string): void {
  const z = zoneById(state, zoneId);
  if (!z) return;
  a.zone = z.id;
  a.placeId = z.placeId;
}

/** every link between zones runs both ways (the validator reads the graph undirected): a link without its way back
 * gets one, labelled with the zone's name. The plan's own links among its new zones count too (run: a yard whose only
 * links were the ways in, so the player found no exit). */
function ensureBackLinks(state: GameState, newZones: Zone[]): void {
  for (const z of newZones) for (const l of z.links) addBackLink(state, z, l);
  for (const s of state.zones) for (const l of s.links) if (newZones.some((z) => z.id === l.to)) addBackLink(state, s, l);
}
function addBackLink(state: GameState, from: Zone, l: ZoneLink): void {
  if (l.frontier) return;
  const other = zoneById(state, l.to);
  if (other && other !== from && !other.links.some((b) => b.to === from.id)) other.links.push({ to: from.id, label: from.name, sight: l.sight });
}

/** SD3–SD5: the plan's barriers on ways, one record for both sides of each (a way the Weaver barred twice keeps the first);
 * returns each with the key holders it names */
function makeBarriers(state: GameState, plan: StagePlan, zoneRef: (r: string) => string): { b: Barrier; keys: string[] }[] {
  const out: { b: Barrier; keys: string[] }[] = [];
  const taken = new Set(Object.keys(state.barriers ?? {}));
  for (const z of plan.zones) for (const l of z.links) {
    const spec = l.barrier;
    const from = zoneById(state, zoneRef(z.key)), to = zoneById(state, zoneRef(l.to));
    const k = spec && getLibrary().barrierKinds?.[spec.kind];
    if (!spec || !k || !from || !to) continue;
    const there = from.links.find((x) => x.to === to.id), back = to.links.find((x) => x.to === from.id);
    if (!there || there.barrier || back?.barrier) continue;
    const b: Barrier = {
      id: freshId(`way_${from.id}_${to.id}`, taken), kind: k.id, grade: spec.grade ?? 'minor', scenario: state.stage.scenarioNumber,
      ...(k.lock && spec.locked ? { lock: { locked: true } } : {}),
      ...(k.bar && spec.barredFrom ? { bar: { side: zoneRef(spec.barredFrom), drawn: true } } : {}),
      ...(k.blocked ? { blocked: true as const } : {}),
      ...(spec.guarded ? { guarded: true as const } : {}),
    };
    // BA3: a door with keys but not locked now still has a lock
    if (!b.lock && k.lock && spec.keys?.length) b.lock = { locked: false };
    (state.barriers ??= {})[b.id] = b;
    there.barrier = b.id;
    if (back) back.barrier = b.id;
    out.push({ b, keys: spec.keys ?? [] });
  }
  return out;
}

/** an extension's entry: links into the crossed frontier now lead to `entry`, and the player stands there (NW3: unless it
 * was built ahead for an NPC, when the player stays where it is). */
function enterFrontier(state: GameState, frontierKey: string, entry: Zone, movePlayer = true): void {
  for (const z of state.zones) {
    for (const l of z.links) {
      if (l.frontier && l.to === frontierKey) {
        l.to = entry.id;
        delete l.frontier;
      }
    }
  }
  ensureBackLinks(state, [entry]);
  // NW2: anyone heading for the frontier now heads for the zone beyond it
  for (const a of state.actors) if (a.mind?.slots?.dest === frontierKey) a.mind.slots.dest = entry.id;
  if (movePlayer) moveTo(state, state.player, entry.id);
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
  const def: ItemDef = { ...structuredClone(base), id: `${base.id}_m${state.turn}_${n}`, name: m.name, look: m.look, base: { itemId: base.id, quality: m.quality, boosts: m.boosts } };
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
  if (def.armor) def.armor.reduction = CONFIG.ARMOR_FACTOR * need + Math.round(CONFIG.ARMOR_QUALITY_FACTOR * need * q); // QE4, QE6
  if (def.shield) def.shield.pool = CONFIG.POOL_BASE + CONFIG.POOL_FACTOR * need + Math.round(CONFIG.POOL_QUALITY_FACTOR * need * q); // QE5, QE6
  if (def.kind === 'tool') for (const e of def.effects ?? []) if (e.kind === 'skill') e.value += T.tool[m.quality];
  state.blueprints.push({ storyId: state.storyId, id: def.id, kind: 'item', data: def as unknown as Record<string, unknown> });
  state.scenarioCaps.minted += 1;
  return def.id;
}

/** reset scenario-scoped records at a scenario start (Scenarios: Start). */
export function beginScenario(state: GameState, tier: Tier, beyond?: number): void {
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
  expireOffers(state, true); // growth proposal 2.5: an essence offer lasts until a new scenario starts
  state.scenarioCaps = { promotions: 0, minted: 0 };
  endYields(state);
}

/** Q1 (option A): when the scenario ends, a yielded actor holds a grudge (opposed) toward those it
 * yielded to, its surrender ends (Morale: it lasts the scenario), and it leaves for its exit slot if it has one.
 * NW1: nobody leaves the world; it walks to its exit zone (head_to, NW2) and its routine carries on from there. */
function endYields(state: GameState): void {
  // Q4: broken and surrendered last only the scenario (Morale); MB9: a bar still at Broken moves up to Panicking, one point short of Broken
  for (const a of state.actors) if (a.mind?.moraleState) delete a.mind.moraleState;
  delete state.yielding; // MB42: the truce lasts the scenario
  for (const a of [state.player, ...state.actors]) if (moraleLevel(a) === 'broken') setMoraleLost(a, maxMorale(a) - 1);
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
export function roadShape(length: string | number | undefined, danger: string | undefined): Pick<Zone, 'area' | 'aspect' | 'danger'> {
  const km = typeof length === 'number' ? length : CONFIG.ROAD_LENGTH_KM[ROAD_LENGTHS.has(length) ? length : 'hour'];
  const m = km * 1000, w = CONFIG.ROAD_WIDTH_M;
  return { area: m * w, aspect: Math.max(1, m / w), danger: ROAD_DANGERS.has(danger) ? danger : 'quiet' };
}

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
  for (const z of plan.zones) zoneMap.set(z.key, freshId(z.key, allZoneIds));
  const frontierMap = new Map<string, string>();
  for (const f of plan.frontiers) frontierMap.set(f.key, freshId(f.key, allZoneIds));
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
  const stageZones = new Set(state.stage.zoneIds);
  const isZoneRef = (r: string) => zoneMap.has(r) || stageZones.has(r);

  // ---- places and zones ----
  for (const p of plan.places) {
    const node: Place = {
      id: placeMap.get(p.key)!, storyId: state.storyId, kind: p.kind, parentId: p.parent ? placeRef(p.parent) : null,
      names: { current: p.name, past: [] }, zones: [], state: {}, headlines: [],
    };
    const stub = bare(node.id);
    if (stub) { Object.assign(stub, { ...node, zones: stub.zones }); delete stub.bare; }
    else state.places.push(node);
  }
  const newZones: Zone[] = [];
  for (const z of plan.zones) {
    const links: ZoneLink[] = z.links.map((l) => {
      const fr = frontierMap.get(l.to) ?? (!isZoneRef(l.to) ? l.to : undefined);
      return fr !== undefined ? { to: fr, label: l.label, sight: l.sight, frontier: true as const } : { to: zoneRef(l.to), label: l.label, sight: l.sight, ...(l.drop ? { drop: true as const } : {}) };
    });
    const k = getLibrary().zoneKinds![z.kind]; // the validator checked it
    const road = k.road ? roadShape(z.length, z.danger) : {};
    const zone: Zone = { id: zoneMap.get(z.key)!, placeId: placeRef(z.place), kind: z.kind, name: z.name, look: z.look, links, cover: z.cover ?? k.cover, light: z.light ?? k.light, ...(k.outdoor ? { outdoor: true as const } : {}), ...(z.height ? { height: z.height } : z.height === 0 ? { height: 0 } : {}),
      area: z.area ?? CONFIG.ZONE_SIZE_M2[z.size ?? k.size], edges: Object.fromEntries(SIDES.map((sd) => [sd, z.edges?.[sd] ?? k.edge])), ...(k.aspect > 1 ? { aspect: k.aspect } : {}), ...road, groundItems: [] };
    state.places.find((p) => p.id === zone.placeId)!.zones.push(zone);
    putOnStage(state, zone);
    newZones.push(zone);
  }
  ensureBackLinks(state, newZones);
  const barriers = makeBarriers(state, plan, zoneRef);
  inferHeights(state, newZones);
  placeZones(state, newZones); // after heights: stairs stack zones straight above or below
  const firstZone = newZones[0]?.id;
  const startZone = state.player.zone; // CH1: the zone the player stood in when the scenario began is ground
  // an extension's entry, or (CH3 a) a scenario started in free roam by crossing an unbuilt frontier
  if (ctx.frontierKey && newZones[0]) enterFrontier(state, ctx.frontierKey, newZones[0], !ctx.ahead);
  // GAP: at story start the player has no zone on the stage yet; it starts in the plan's first zone.
  const storyStart = !!firstZone && !state.stage.zoneIds.includes(state.player.zone);
  if (storyStart) moveTo(state, state.player, firstZone!);
  else if (ctx.wake && firstZone) moveTo(state, state.player, firstZone); // D-54: the player wakes somewhere safe

  // ---- bands (existing bands keep theirs) ----
  for (const b of plan.bands) {
    state.bands.push({
      id: bandMap.get(b.key)!, name: b.name, goals: b.goals, temperament: b.temperament, tactics: b.tactics,
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
      // GAP: a reused actor keeps its names; the plan's name is ignored.
    } else {
      const t = npcTemplate(state, c.template!);
      const personality = c.personality ? personalityFrom(t.personality, c.personality) : undefined; // PL12
      a = spawnNpc(state, c.template!, { id, zone: startZone, placeId: startPlace, bandId: bandRef(c.band), label: c.label, name: c.name, storyId: state.storyId, ...(personality ? { personality } : {}), ...(LIFE_STAGES.keyOf(c.age) ? { ageStage: LIFE_STAGES.keyOf(c.age) } : {}) }, rng);
      state.actors.push(a);
    }
    a.bandId = bandRef(c.band);
    a.appearance = c.appearance;
    if (c.pronouns) a.pronouns = c.pronouns;
    if (c.knownOnSight) a.knownOnSight = true;
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
      installRoutines(a, c.routineSetId, slots, c.startAt, turn, rng, now(state));
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
  const onStage = new Set(state.stage.zoneIds);
  plan.cast.forEach((c, i) => {
    for (const bb of c.awarenessOfBands ?? []) {
      const band = bandRef(bb.band);
      for (const m of [state.player, ...state.actors]) {
        if (m.bandId !== band || m.id === castActors[i].id || !onStage.has(m.zone)) continue;
        updateBeliefs(state, { kind: 'opening', observerId: castActors[i].id, aboutId: m.id, status: bb.awareness, zone: m.zone, source: 'seen' });
      }
    }
  });

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
    // GAP: a seeded trigger whose owner has no plan gets an empty-goal plan to hold it.
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
  for (const { b, keys } of barriers) for (const k of keys) {
    const holder = actorById(state, actorRef(k));
    if (holder) holder.core.inventory.push({ id: `key_${b.id}_${holder.id}`, itemId: IT.key, opens: [b.id] });
  }

  // ---- rewards ----
  const { rewards, notes } = tidyRewards(state, plan);
  if (notes.length) state.log.push({ turn, code: 'reward_repaired', detail: { notes: notes.map((e) => e.message) } });
  rewards.forEach((r, i) => {
    const itemId = typeof r.item === 'string' ? r.item : mint(state, r.item, i);
    const def = itemDef(state, itemId);
    const qty = r.qty ?? 1;
    const id = `rw${turn}_${i}_${itemId}`;
    const insts: ItemInstance[] = def.stackable ? [{ id, itemId, qty }] : Array.from({ length: qty }, (_, n) => ({ id: n ? `${id}_${n}` : id, itemId }));
    const pl = r.place as { carriedBy?: string; groundIn?: string };
    if (pl.carriedBy !== undefined) actorById(state, actorRef(pl.carriedBy))!.core.inventory.push(...insts);
    else zoneById(state, zoneRef(pl.groundIn!))!.groundItems.push(...insts);
  });

  // ---- hidden stage, note, cast notes ----
  const hs = state.hidden.stage;
  if (ctx.kind === 'scenario') state.hidden.stage = { eventSummary: plan.event.summary, challenge: plan.event.challenge, gain: plan.event.gain, hiddenTerms: [...plan.hiddenTerms] };
  // GAP: an extension keeps the scenario's grades; its summary is appended and its hiddenTerms join the stage's.
  else state.hidden.stage = { ...hs, eventSummary: [hs.eventSummary, plan.event.summary].filter(Boolean).join(' / '), hiddenTerms: [...new Set([...hs.hiddenTerms, ...plan.hiddenTerms])] };
  state.hidden.weaverNote = plan.weaverNote;
  // SC1/SC2/SC7: a new scenario's question, scale and endings, plan keys mapped to ids
  const frameRef = (k: 'band' | 'place' | 'actor', r: string) => (k === 'band' ? bandRef(r) : k === 'actor' ? actorRef(r) : placeMap.get(r) ?? zoneMap.get(r) ?? r);
  if (ctx.kind === 'scenario') state.stage.scenario = frameOf(state, plan.scenario, ctx.tier, frameRef);
  // CH1: the ground: the start zone, every zone this scenario's plans build, and the stage zones they name (links, slots)
  const named = [...plan.zones.flatMap((z) => z.links.map((l) => l.to)), ...plan.cast.flatMap((c) => Object.values(c.slots ?? {}).flat())]
    .filter((r): r is string => typeof r === 'string' && stageZones.has(r));
  const ground = [...(ctx.kind === 'scenario' && !ctx.wake ? [startZone] : []), ...newZones.map((z) => z.id), ...named].filter((z) => zoneById(state, z));
  if (ctx.kind === 'scenario' && state.stage.scenario) state.stage.scenario.ground = [...new Set(ground)];
  else if (state.stage.scenario?.ground) state.stage.scenario.ground = [...new Set([...state.stage.scenario.ground, ...ground])];
  // SC12: a check-in may change the running scenario's question, scale and endings; its number, start and records stay
  else if (ctx.kind === 'checkin' && plan.scenario && state.stage.scenario) {
    const f = frameOf(state, plan.scenario, state.stage.scenario.tier, frameRef);
    Object.assign(state.stage.scenario, { question: f.question, scale: f.scale, endings: f.endings });
  }
  state.hidden.castNotes ??= {};
  plan.cast.forEach((c, i) => (state.hidden.castNotes![castActors[i].id] = { motive: c.motive, ...(c.routineGap ? { routineGap: c.routineGap } : {}) }));

  if (degraded.size) {
    const actors = plan.cast.filter((c) => degraded.has(c.key)).map((c) => castMap.get(c.key)!);
    setFallbackFlags(state, 'routine_fallback', 'routine_fallback', opts.degrade!.filter((e) => e.routineOnly), actors);
  }
  placeAll(state); // ZP1: the cast and anyone moved by the scenario get spots in their zones
  if (storyStart) startAtDoor(state, ctx.placeId); // BG-49: the story opens with the player at the door
}

/** GAP: at story start the player's place has no node yet; a bare one is made so the Weaver's plan (and the fallback) can use its id. */
export function ensurePlace(state: GameState, placeId: string): Place {
  let place = state.places.find((p) => p.id === placeId);
  if (!place) {
    place = { id: placeId, storyId: state.storyId, kind: 'place', parentId: null, names: { current: placeId, past: [] }, zones: [], state: {}, headlines: [], bare: true };
    state.places.push(place);
  }
  return place;
}

export function applyFallbackStage(state: GameState, ctx: PlanContext, reason: string, errors: PlanError[]): void {
  const place = ensurePlace(state, ctx.placeId);
  const startZone = state.player.zone;
  if (ctx.frontierKey) {
    // one empty zone per frontier label: the crossed frontier's label (from the first link that names it)
    const link = state.zones.flatMap((z) => z.links).find((l) => l.frontier && l.to === ctx.frontierKey);
    const taken = new Set([...state.places.flatMap((p) => p.zones.map((z) => z.id)), ...stageFrontiers(state)]);
    taken.delete(ctx.frontierKey);
    const zone: Zone = { id: freshId(ctx.frontierKey, taken), placeId: ctx.placeId, name: link?.label ?? ctx.frontierKey, look: '', links: [], cover: 'none', light: 'bright', groundItems: [] };
    place?.zones.push(zone);
    putOnStage(state, zone);
    enterFrontier(state, ctx.frontierKey, zone, !ctx.ahead);
    if (state.stage.scenario?.ground && ctx.kind === 'extension') state.stage.scenario.ground.push(zone.id); // CH1
  } else {
    if (place?.zones.length) for (const z of place.zones) putOnStage(state, z);
    else if (place) {
      // GAP: a scenario start at a place with no saved zones and no frontier gets one empty zone named after the place.
      const taken = new Set(state.places.flatMap((p) => p.zones.map((z) => z.id)));
      const zone: Zone = { id: freshId(`${place.id}_area`, taken), placeId: place.id, name: place.names.current, look: '', links: [], cover: 'none', light: 'bright', groundItems: [] };
      place.zones.push(zone);
      putOnStage(state, zone);
    }
    if (place?.zones[0] && !state.stage.zoneIds.includes(state.player.zone)) moveTo(state, state.player, place.zones[0].id);
  }
  if (ctx.kind === 'scenario') {
    state.hidden.stage = { eventSummary: '', challenge: 'none', gain: 'none', hiddenTerms: [] };
    state.stage.scenario = frameOf(state, undefined, ctx.tier, (_k, r) => r); // no endings: the stall (and later the budget) ends it
    // CH1: the fallback's ground: where the player stood, where it stands now, and its place's zones
    state.stage.scenario.ground = [...new Set([startZone, state.player.zone, ...(place?.zones ?? []).map((z) => z.id)])].filter((z) => zoneById(state, z));
  }
  setFallbackFlags(state, reason, 'weaver_fallback', errors);
}

/** arrival + presence events for the player's perception (scenario setup step 8). */
/** Scenario setup step 7 (case 42): a stealthy player arriving through a frontier is tested by every observer in range;
 * the plan's opening beliefs were skipped for this entry. Returns the arrival event. */
export function stealthyArrival(state: GameState, rng: Rng): GameEvent {
  const p = state.player;
  const ev: GameEvent = { id: `t${state.turn}_arrival`, turn: state.turn, actorId: p.id, kind: 'arrival', zone: p.zone, effects: [], noise: 'quiet', visibility: 'normal', perception: {} };
  ev.perception = computePerception(ev, state, rng);
  detectPlayer(state, ev, rng);
  return ev;
}

export function openingEvents(state: GameState, rng: Rng): GameEvent[] {
  const p = state.player;
  const out: GameEvent[] = [];
  const arrival: GameEvent = { id: `t${state.turn}_arrival`, turn: state.turn, actorId: p.id, kind: 'arrival', zone: p.zone, effects: [], noise: 'quiet', visibility: 'normal', perception: {} };
  arrival.perception = computePerception(arrival, state, rng);
  out.push(arrival);
  const stage = new Set(state.stage.zoneIds);
  for (const a of [...state.actors].sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (!stage.has(a.zone) || !isActive(a)) continue;
    const act = a.mind ? desiredState(buildActorView(state, a.id))?.activity : undefined;
    const def = act ? activity(act) : undefined;
    const ev: GameEvent = {
      id: `t${state.turn}_presence_${a.id}`, turn: state.turn, actorId: a.id, kind: 'presence', zone: a.zone, effects: [],
      noise: def?.noise ?? 'quiet', visibility: def?.visibility ?? 'normal', perception: {}, ...(act ? { activity: act } : {}),
    };
    ev.perception = computePerception(ev, state, rng);
    if (ev.perception[p.id]) out.push(ev);
  }
  return out;
}

/** PY2: only a Trader-class actor sells. Known goods are stocked into its inventory (qty 1 when left out) and known
 * services listed, up to WARES_CAP lines; anything else is dropped and logged. */
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
    const qty = Math.max(1, Math.floor(g.qty ?? 1));
    const id = `ware${turn}_${a.id}_${g.item}`;
    a.core.inventory.push(...(def.stackable ? [{ id, itemId: g.item, qty }] : Array.from({ length: qty }, (_, n) => ({ id: n ? `${id}_${n}` : id, itemId: g.item }))));
    if (!items.includes(g.item)) items.push(g.item);
  }
  for (const s of w.services ?? []) {
    if (!getLibrary().services?.[s] || items.length + services.length >= CONFIG.WARES_CAP) dropped.push(String(s));
    else if (!services.includes(s)) services.push(s);
  }
  a.wares = { items, services };
  a.core.inventory.push({ id: `purse${turn}_${a.id}`, itemId: IT.coin, qty: CONFIG.TRADER_PURSE }); // SL3: the Trader's purse
  if (dropped.length) state.log.push({ turn, code: 'wares_dropped', detail: { actorId: a.id, dropped } });
}
