// Applying a stage plan (Scene setup steps 4–8), the fallback stage, opening events.
import type { Actor, GameEvent, GameState, ItemDef, ItemInstance, Place, Rng, StagePlan, Tier, Zone, ZoneLink, OrderTemplate, Trigger, Secret } from '../types';
import { CONFIG } from '../config';
import { activity, itemDef } from '../library';
import { spawnNpc } from '../library/spawn';
import { installRoutines, desiredState } from '../minds';
import { updateBeliefs, computePerception } from '../perception';
import { buildActorView } from '../views';
import { actorById, isActive, zoneById } from '../engine/relations';
import type { PlanContext, PlanError } from './index';
import { stageFrontiers } from './validate';

function freshId(key: string, taken: Set<string>): string {
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

/** every link between a new zone and a stage zone is made two-way. GAP: the plan can't add links to stage zones, so code adds the way back. */
function ensureBackLinks(state: GameState, newZones: Zone[]): void {
  const fresh = new Set(newZones.map((z) => z.id));
  for (const z of newZones) {
    for (const l of z.links) {
      if (l.frontier || fresh.has(l.to)) continue;
      const other = zoneById(state, l.to);
      if (other && !other.links.some((b) => b.to === z.id)) other.links.push({ to: z.id, label: z.name, sight: l.sight });
    }
  }
  for (const s of state.zones) {
    if (fresh.has(s.id)) continue;
    for (const l of s.links) {
      if (!fresh.has(l.to)) continue;
      const z = zoneById(state, l.to)!;
      if (!z.links.some((b) => b.to === s.id)) z.links.push({ to: s.id, label: s.name, sight: l.sight });
    }
  }
}

/** an extension's entry: links into the crossed frontier now lead to `entry`, and the player stands there. */
function enterFrontier(state: GameState, frontierKey: string, entry: Zone): void {
  for (const z of state.zones) {
    for (const l of z.links) {
      if (l.frontier && l.to === frontierKey) {
        l.to = entry.id;
        delete l.frontier;
      }
    }
  }
  ensureBackLinks(state, [entry]);
  moveTo(state, state.player, entry.id);
}

function setFallbackFlags(state: GameState, reason: string, code: 'weaver_fallback' | 'routine_fallback', errors: PlanError[], actors?: string[]): void {
  state.stage.fallback = { reason, turn: state.turn };
  if (actors) state.stage.routineFallback = { actors, turn: state.turn };
  state.log.push({ turn: state.turn, code, detail: { reason, errors: errors.map((e) => ({ ...e })) } });
}

function idleHere(a: Actor, here: string, turn: number): void {
  const m = a.mind!;
  m.routines = ['idle_here'];
  m.slots = { here };
  delete m.routineSetId;
  m.routine = { id: 'idle_here', anchorTurn: turn };
}

function mint(state: GameState, m: Exclude<StagePlan['rewards'][number]['item'], string>, n: number): string {
  const base = itemDef(state, m.base);
  const q = m.quality;
  const T = CONFIG.QUALITY_TABLE;
  const def: ItemDef = { ...structuredClone(base), id: `${base.id}_m${state.turn}_${n}`, name: m.name, look: m.look, base: { itemId: base.id, quality: q, boosts: m.boosts } };
  if (def.weapon) {
    for (const mode of def.weapon.modes) {
      if (m.boosts === 'damageAdj') mode.damageAdj = (mode.damageAdj ?? 0) + T.damageAdj[q - 1];
      else mode.hitAdj = (mode.hitAdj ?? 0) + T.hitAdj[q - 1];
    }
  }
  if (def.armor) def.armor.reduction += T.reduction[q - 1];
  if (def.kind === 'tool') for (const e of def.effects ?? []) if (e.kind === 'skill') e.value += T.tool[q - 1];
  state.blueprints.push({ storyId: state.storyId, id: def.id, kind: 'item', data: def as unknown as Record<string, unknown> });
  state.sceneCaps.minted += 1;
  return def.id;
}

/** reset scene-scoped records at a scene start (Scenes: Start). */
export function beginScene(state: GameState, tier: Tier): void {
  state.stage.tier = tier;
  state.stage.sceneNumber += 1;
  state.stage.sceneStartTurn = state.turn;
  delete state.stage.fallback;
  delete state.stage.routineFallback;
  delete state.stage.partner;
  state.sceneCaps = { promotions: 0, minted: 0 };
}

export function applyStagePlan(state: GameState, plan: StagePlan, ctx: PlanContext, opts: { entry: 'open' | 'sneaking'; degrade?: PlanError[] }, rng: Rng): void {
  const turn = state.turn;
  const allZoneIds = new Set([...state.places.flatMap((p) => p.zones.map((z) => z.id)), ...stageFrontiers(state)]);

  // ---- keys -> stable ids (plan keys first, then existing ids) ----
  const placeMap = new Map<string, string>();
  const placeTaken = new Set(state.places.map((p) => p.id));
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
    state.places.push(node);
  }
  const newZones: Zone[] = [];
  for (const z of plan.zones) {
    const links: ZoneLink[] = z.links.map((l) => {
      const fr = frontierMap.get(l.to) ?? (!isZoneRef(l.to) ? l.to : undefined);
      return fr !== undefined ? { to: fr, label: l.label, sight: l.sight, frontier: true as const } : { to: zoneRef(l.to), label: l.label, sight: l.sight };
    });
    const zone: Zone = { id: zoneMap.get(z.key)!, placeId: placeRef(z.place), name: z.name, look: z.look, links, cover: z.cover, light: z.light, groundItems: [] };
    state.places.find((p) => p.id === zone.placeId)!.zones.push(zone);
    putOnStage(state, zone);
    newZones.push(zone);
  }
  ensureBackLinks(state, newZones);
  const firstZone = newZones[0]?.id;
  if (ctx.kind === 'extension' && ctx.frontierKey && newZones[0]) enterFrontier(state, ctx.frontierKey, newZones[0]);
  // GAP: at story start the player has no zone on the stage yet; it starts in the plan's first zone.
  if (firstZone && !state.stage.zoneIds.includes(state.player.zone)) moveTo(state, state.player, firstZone);

  // ---- bands (existing bands keep theirs) ----
  for (const b of plan.bands) {
    state.bands.push({
      id: bandMap.get(b.key)!, name: b.name, goals: b.goals, temperament: b.temperament, tacticsLevel: b.tacticsLevel,
      lethal: b.lethal ?? true,
      relations: Object.fromEntries(Object.entries(b.relations ?? {}).map(([k, v]) => [bandRef(k), v])),
    });
  }

  // ---- cast ----
  const degraded = new Set((opts.degrade ?? []).filter((e) => e.routineOnly && e.castKey !== undefined).map((e) => e.castKey!));
  const castActors: Actor[] = [];
  for (const c of plan.cast) {
    const id = castMap.get(c.key)!;
    const boundZones = Object.values(c.slots ?? {}).flat().filter((z) => typeof z === 'string' && isZoneRef(z)).map(zoneRef);
    const startZone = boundZones[0] ?? firstZone ?? state.player.zone;
    const startPlace = zoneById(state, startZone)?.placeId ?? ctx.placeId;
    let a: Actor;
    if (c.actor) {
      a = actorById(state, c.actor)!;
      a.label = c.label;
      // GAP: a reused actor keeps its names; the plan's name is ignored.
    } else {
      a = spawnNpc(state, c.template!, { id, zone: startZone, placeId: startPlace, bandId: bandRef(c.band), label: c.label, name: c.name, storyId: state.storyId }, rng);
      state.actors.push(a);
    }
    a.bandId = bandRef(c.band);
    a.appearance = c.appearance;
    if (c.knownOnSight) a.knownOnSight = true;
    a.mind!.knows = (c.knows ?? []).map((f) => ({ id: f.id, text: f.text }));
    moveTo(state, a, startZone);
    castActors.push(a);
  }
  plan.cast.forEach((c, i) => {
    const a = castActors[i];
    for (const o of c.overrides ?? []) (a.mind!.overrides ??= {})[actorRef(o.actor)] = o.stance;
    if (degraded.has(c.key)) {
      const here = Object.values(c.slots ?? {}).flat().find((z) => typeof z === 'string' && isZoneRef(z));
      idleHere(a, here ? zoneRef(here) : (firstZone ?? a.zone), turn);
    } else {
      const slots = Object.fromEntries(Object.entries(c.slots ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.map(zoneRef) : zoneRef(v)]));
      installRoutines(a, c.routineSetId, slots, c.startAt, turn, rng);
    }
  });
  // step 5: each actor stands in its default routine's desired zone for the current turn
  for (const a of castActors) {
    const d = desiredState(buildActorView(state, a.id));
    if (d) moveTo(state, a, d.zone);
  }

  // ---- beliefs: opening (open entry only), then band beliefs (whatever the entry) ----
  if (opts.entry === 'open') {
    plan.cast.forEach((c, i) => updateBeliefs(state, { kind: 'opening', observerId: castActors[i].id, aboutId: state.player.id, status: c.openingBelief, zone: state.player.zone, source: 'seen' }));
  }
  // GAP: arrival detection for a sneaking entry (step 7) waits on the Stealth tree (D-8); the caller runs detectPlayer.
  const onStage = new Set(state.stage.zoneIds);
  plan.cast.forEach((c, i) => {
    for (const bb of c.bandBeliefs ?? []) {
      const band = bandRef(bb.band);
      for (const m of [state.player, ...state.actors]) {
        if (m.bandId !== band || m.id === castActors[i].id || !onStage.has(m.zone)) continue;
        updateBeliefs(state, { kind: 'opening', observerId: castActors[i].id, aboutId: m.id, status: bb.status, zone: m.zone, source: 'seen' });
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

  // ---- rewards ----
  plan.rewards.forEach((r, i) => {
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
  if (ctx.kind === 'scene') state.hidden.stage = { eventSummary: plan.event.summary, challenge: plan.event.challenge, gain: plan.event.gain, hiddenTerms: [...plan.hiddenTerms] };
  // GAP: an extension keeps the scene's grades; its summary is appended and its hiddenTerms join the stage's.
  else state.hidden.stage = { ...hs, eventSummary: [hs.eventSummary, plan.event.summary].filter(Boolean).join(' / '), hiddenTerms: [...new Set([...hs.hiddenTerms, ...plan.hiddenTerms])] };
  state.hidden.weaverNote = plan.weaverNote;
  state.hidden.castNotes ??= {};
  plan.cast.forEach((c, i) => (state.hidden.castNotes![castActors[i].id] = { motive: c.motive, ...(c.routineGap ? { routineGap: c.routineGap } : {}) }));

  if (degraded.size) {
    const actors = plan.cast.filter((c) => degraded.has(c.key)).map((c) => castMap.get(c.key)!);
    setFallbackFlags(state, 'routine_fallback', 'routine_fallback', opts.degrade!.filter((e) => e.routineOnly), actors);
  }
}

/** GAP: at story start the player's place has no node yet; a bare one is made so the Weaver's plan (and the fallback) can use its id. */
export function ensurePlace(state: GameState, placeId: string): Place {
  let place = state.places.find((p) => p.id === placeId);
  if (!place) {
    place = { id: placeId, storyId: state.storyId, kind: 'place', parentId: null, names: { current: placeId, past: [] }, zones: [], state: {}, headlines: [] };
    state.places.push(place);
  }
  return place;
}

export function applyFallbackStage(state: GameState, ctx: PlanContext, reason: string, errors: PlanError[]): void {
  const place = ensurePlace(state, ctx.placeId);
  if (ctx.kind === 'extension' && ctx.frontierKey) {
    // one empty zone per frontier label: the crossed frontier's label (from the first link that names it)
    const link = state.zones.flatMap((z) => z.links).find((l) => l.frontier && l.to === ctx.frontierKey);
    const taken = new Set([...state.places.flatMap((p) => p.zones.map((z) => z.id)), ...stageFrontiers(state)]);
    taken.delete(ctx.frontierKey);
    const zone: Zone = { id: freshId(ctx.frontierKey, taken), placeId: ctx.placeId, name: link?.label ?? ctx.frontierKey, look: '', links: [], cover: 0, light: 0, groundItems: [] };
    place?.zones.push(zone);
    putOnStage(state, zone);
    enterFrontier(state, ctx.frontierKey, zone);
  } else {
    if (place?.zones.length) for (const z of place.zones) putOnStage(state, z);
    else if (place) {
      // GAP: a scene start at a place with no saved zones and no frontier gets one empty zone named after the place.
      const taken = new Set(state.places.flatMap((p) => p.zones.map((z) => z.id)));
      const zone: Zone = { id: freshId(`${place.id}_area`, taken), placeId: place.id, name: place.names.current, look: '', links: [], cover: 0, light: 0, groundItems: [] };
      place.zones.push(zone);
      putOnStage(state, zone);
    }
    if (place?.zones[0] && !state.stage.zoneIds.includes(state.player.zone)) moveTo(state, state.player, place.zones[0].id);
    state.hidden.stage = { eventSummary: '', challenge: 'none', gain: 'none', hiddenTerms: [] };
  }
  setFallbackFlags(state, reason, 'weaver_fallback', errors);
}

/** arrival + presence events for the player's perception (scene setup step 8). */
export function openingEvents(state: GameState, rng: Rng): GameEvent[] {
  const p = state.player;
  const out: GameEvent[] = [];
  const arrival: GameEvent = { id: `t${state.turn}_arrival`, turn: state.turn, actorId: p.id, kind: 'arrival', zone: p.zone, effects: [], noise: 1, visibility: 2, perception: {} };
  arrival.perception = computePerception(arrival, state, rng);
  out.push(arrival);
  const stage = new Set(state.stage.zoneIds);
  for (const a of [...state.actors].sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (!stage.has(a.zone) || !isActive(a)) continue;
    const act = a.mind ? desiredState(buildActorView(state, a.id))?.activity : undefined;
    const def = act ? activity(act) : undefined;
    const ev: GameEvent = {
      id: `t${state.turn}_presence_${a.id}`, turn: state.turn, actorId: a.id, kind: 'presence', zone: a.zone, effects: [],
      noise: def?.noise ?? 1, visibility: def?.visibility ?? 2, perception: {}, ...(act ? { activity: act } : {}),
    };
    ev.perception = computePerception(ev, state, rng);
    if (ev.perception[p.id]) out.push(ev);
  }
  return out;
}
