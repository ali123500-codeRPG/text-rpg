// W3 — the six deny-by-default view builders (+ the combat packet). Copy whitelisted fields into new objects only.
import type { Tier, TierRoll,
  Actor, ActorView, AttackMode, BeliefView, CombatPacket, DialogueInput, DialogueView, Effect, EventView, GameEvent, GameState,
  HealthLevel, Intent, NarrationEvent, NarrationView, OppositionView, OwnGearView, PlayerView, RollResult, SeenActor, SeenGearView,
  WeaverView, Zone, ZoneView,
} from '../types';
import { GRADES } from '../types';
import { CONFIG } from '../config';
import { COVER, LIGHT } from '../scales';
import { actorById, allActors, atLeast, bandById, isActive, hostile, shortestPath, zoneById } from '../engine/relations';
import { activity, creatureType, getLibrary, itemDef, npcTemplate, routine } from '../library';
import { healthLevel, partStates, tierName } from '../ruleset';
import { isComm } from '../perception';

// GAP: Part 4 §5 says "the top few headlines of each ancestor" with no number; placeholder kept here (not in CONFIG).
const HEADLINES_PER_PLACE = 3;
const VISIBLE_HEALTH: HealthLevel[] = ['Wounded', 'Mauled', 'Critical', 'Incapacitated'];
const VISIBLE_PART = ['Crippled', 'Destroyed'];

// ---------- shared helpers ----------
const stageZones = (state: GameState) => state.stage.zoneIds.map((id) => zoneById(state, id)).filter((z): z is Zone => !!z);

export function zoneView(state: GameState, z: Zone): ZoneView {
  return {
    id: z.id, name: z.name, look: z.look, cover: COVER.name(z.cover), light: LIGHT.name(z.light),
    links: z.links.map((l) => ({ to: l.to, label: l.label, sight: l.sight, ...(l.frontier ? { frontier: true } : {}) })),
    groundItems: z.groundItems.map((i) => ({ id: i.id, name: itemDef(state, i.itemId).name })),
  };
}
/** own zone plus zones linked to it with sight (no frontiers) */
function perceivedZoneIds(state: GameState, zoneId: string): string[] {
  const z = zoneById(state, zoneId);
  return [zoneId, ...(z?.links ?? []).filter((l) => l.sight && !l.frontier && zoneById(state, l.to)).map((l) => l.to)];
}
const perceivedZones = (state: GameState, zoneId: string) => perceivedZoneIds(state, zoneId).map((id) => zoneView(state, zoneById(state, id)!));

/** how a zone reads from `from`: its name when it is `from`, else the label of the first link toward it */
function whereLabel(state: GameState, from: string, to: string): string | undefined {
  if (from === to) return zoneById(state, from)?.name;
  const path = shortestPath(state, from, to);
  return path?.length ? zoneById(state, from)?.links.find((l) => l.to === path[0])?.label : undefined;
}

const nameKnown = (state: GameState, a: Actor) => a.id === state.player.id || !!a.knownOnSight || !!state.player.journal?.namesKnown.includes(a.id);
/** what `viewerId` calls `id`: the player by 'player'; for the player, names only once known; NPCs know bandmates' names */
export function callName(state: GameState, viewerId: string, id: string): string {
  const a = actorById(state, id);
  if (!a) return 'someone';
  if (a.id === state.player.id) return 'player';
  const viewer = actorById(state, viewerId);
  if (viewerId === state.player.id) return nameKnown(state, a) ? a.names.current : a.label;
  return viewer && viewer.bandId === a.bandId ? a.names.current : a.label;
}

function ownGear(state: GameState, a: Actor): OwnGearView[] {
  return a.core.inventory.map((i) => {
    const d = itemDef(state, i.itemId);
    const classes = [...new Set((d.weapon?.modes ?? []).map((m) => m.class))];
    return {
      id: i.id, itemId: i.itemId, name: d.name, kind: d.kind, equippedIn: [...(i.equippedIn ?? [])],
      modes: (d.weapon?.modes ?? []).map((m) => m.id),
      ...(classes.length ? { classLabel: classes.join('/') } : {}),
      ...(d.armor ? { weightLabel: d.armor.weight } : {}),
      ...(d.stackable ? { qty: i.qty ?? 1 } : {}),
    };
  });
}

/** Part 5 §8: held items, shield and armor by look; accessories only when visible; concealed only once revealed; stowed never */
function seenGear(state: GameState, a: Actor, revealed: string[]): SeenGearView[] {
  const out: SeenGearView[] = [];
  for (const i of a.core.inventory) {
    const slot = i.equippedIn?.[0];
    if (!slot) continue;
    const d = itemDef(state, i.itemId);
    if (d.concealed && !revealed.includes(`item:${i.id}`)) continue;
    const where = slot.startsWith('hand:') ? (d.kind === 'shield' ? 'shield' : 'held') : slot === 'armor' ? 'armor' : slot.startsWith('acc:') && d.visible ? 'accessory' : null;
    if (where) out.push({ id: i.id, name: d.name, look: d.look, where });
  }
  return out;
}

/** the activity look an actor shows in this turn's events the viewer perceived fully */
function lookOf(events: GameEvent[], viewerId: string, actorId: string): string | undefined {
  const e = [...events].reverse().find((x) => x.actorId === actorId && x.activity && x.perception[viewerId]?.level === 'full');
  return e?.activity ? activity(e.activity).look : undefined;
}

/** the viewer fully perceived an event by `aboutId` since the scene began (recent history included) */
function seenClearly(state: GameState, viewerId: string, aboutId: string): boolean {
  return [...(state.recentEvents ?? []), ...state.events].some((e) =>
    e.actorId === aboutId && e.turn >= state.stage.sceneStartTurn && e.perception[viewerId]?.level === 'full');
}

/** actors the viewer perceives now: in its own or a sight-linked zone; dark zones give partial. NPCs perceive the player only once aware. */
function seenActors(state: GameState, viewer: Actor, events: GameEvent[] = state.events): SeenActor[] {
  const zones = perceivedZoneIds(state, viewer.zone);
  const out: SeenActor[] = [];
  for (const a of allActors(state)) {
    if (a.id === viewer.id || !zones.includes(a.zone)) continue;
    if (a.id === state.player.id && !atLeast(viewer.mind?.knowledge[a.id]?.status, 'aware')) continue;
    // P3: in a dark zone someone is half seen, unless they share the viewer's zone and the viewer perceived them
    // fully this scene (spoke face to face, say): then they stay seen
    const keptSight = viewer.journal?.clearSight?.[a.id] === a.zone; // Q17: seen clearly and has not moved
    const level = zoneById(state, a.zone)?.light === 'dark' && !keptSight && !(a.zone === viewer.zone && seenClearly(state, viewer.id, a.id)) ? 'partial' : 'full';
    // GAP: a partially perceived actor keeps its id (needed as a target) but shows only 'someone'.
    if (level === 'partial') { out.push({ id: a.id, label: 'someone', zone: a.zone, level, gear: [] }); continue; }
    const name = viewer.id === state.player.id ? (nameKnown(state, a) ? a.names.current : undefined) : viewer.bandId === a.bandId ? a.names.current : undefined;
    const h = healthLevel(a);
    const parts = partStates(state, a);
    const crippled = parts.filter((p) => p.state === 'Crippled').map((p) => p.id);
    const destroyed = parts.filter((p) => p.state === 'Destroyed').map((p) => p.id);
    const look = lookOf(events, viewer.id, a.id);
    out.push({
      id: a.id, label: a.label, ...(name ? { name } : {}), ...(a.pronouns ? { pronouns: a.pronouns } : {}), zone: a.zone, level,
      ...(look ? { activityLook: look } : {}),
      ...(VISIBLE_HEALTH.includes(h) ? { health: h } : {}),
      ...(crippled.length ? { crippled } : {}), ...(destroyed.length ? { destroyed } : {}),
      gear: seenGear(state, a, viewer.mind?.knowledge[a.id]?.revealed ?? []),
    });
  }
  return out;
}

const outcomeLabel = (o: string) => o.replaceAll('_', ' ');

function eventView(state: GameState, viewer: Actor, e: GameEvent): EventView {
  const p = e.perception[viewer.id];
  const full = p.level === 'full';
  return {
    id: e.id, turn: e.turn, kind: e.kind, zone: e.zone,
    ...(full ? { actorId: e.actorId } : {}),
    ...(full && e.target ? { target: e.target } : {}),
    ...(full && e.tier !== undefined && e.actorId === viewer.id ? { tier: tierName(e.tier) } : {}),
    level: p.level, cue: p.cue,
    ...(!full ? { where: whereLabel(state, viewer.zone, e.zone) } : {}),
    ...(e.line && (full || p.cue === 'sound') ? { line: { text: e.line.text, volume: e.line.volume } } : {}),
    ...(full && e.attack ? { outcome: outcomeLabel(e.attack.outcome) } : {}),
  };
}

/** visible condition changes as text: the player's own always; others' only Wounded down and Crippled/Destroyed */
function visibleChanges(state: GameState, effects: Effect[], viewerId: string): string[] {
  const out: string[] = [];
  for (const f of effects) {
    const own = f.actorId === viewerId;
    const to = String(f.data.to ?? '');
    const who = callName(state, viewerId, f.actorId);
    if (f.kind === 'threshold_crossed' && (own || VISIBLE_HEALTH.includes(to as HealthLevel))) out.push(`${who} is ${to}`);
    if (f.kind === 'part_state_changed' && (own || VISIBLE_PART.includes(to))) out.push(`${who}'s ${String(f.data.part ?? f.data.partId ?? 'part')} is ${to}`);
  }
  return out;
}

export function factText(state: GameState, text: string): string {
  return text.replace(/\{(npc|place):([^}]+)\}/g, (_, k: string, id: string) =>
    k === 'place' ? (state.places.find((p) => p.id === id)?.names.current ?? 'somewhere') : callName(state, state.player.id, id));
}
/** Part 4 §5: facts of the current place plus facts linked to an entity present */
function factsFor(state: GameState, placeId: string, present: string[]): string[] {
  return state.facts.filter((f) => f.placeId === placeId || f.refs.some((r) => present.includes(r))).map((f) => factText(state, f.text));
}
function headlinesFor(state: GameState, placeId: string, includeSelf: boolean): string[] {
  const out: string[] = [];
  let p = state.places.find((x) => x.id === placeId);
  if (p && !includeSelf) p = state.places.find((x) => x.id === p!.parentId);
  for (let n = 0; p && n < 32; n++) {
    for (const id of p.headlines.slice(0, HEADLINES_PER_PLACE)) {
      const f = state.facts.find((x) => x.id === id);
      if (f) out.push(factText(state, f.text));
    }
    p = state.places.find((x) => x.id === p!.parentId);
  }
  return out;
}

function need(state: GameState, id: string): Actor {
  const a = actorById(state, id);
  if (!a) throw new Error(`no actor ${id}`);
  return a;
}

// ---------- PlayerView ----------
export function buildPlayerView(state: GameState): PlayerView {
  const p = state.player;
  const actors = seenActors(state, p);
  return {
    turn: state.turn,
    player: {
      id: 'player', name: p.names.current,
      classes: p.core.classes.map((c) => c.classId),
      skills: Object.keys(p.core.skills),
      perks: p.core.perks.map((x) => x.perkId),
      health: healthLevel(p), parts: partStates(state, p).map((x) => ({ id: x.id, state: x.state })),
      inventory: ownGear(state, p),
      posture: p.posture ?? 'open',
      standingDefense: p.core.standingDefense,
    },
    zone: zoneView(state, zoneById(state, p.zone)!),
    zones: perceivedZones(state, p.zone),
    actors,
    facts: factsFor(state, p.placeId, actors.filter((a) => a.level === 'full').map((a) => a.id)),
    headlines: headlinesFor(state, p.placeId, false),
  };
}

// ---------- ActorView / OppositionView / DialogueView ----------
type BaseView = Omit<ActorView, 'plan' | 'memory' | 'secrets' | 'firedTriggers'>;

/** everything an NPC view holds that is not in state.hidden */
function baseView(state: GameState, actorId: string): BaseView {
  const a = need(state, actorId);
  if (!a.mind) throw new Error(`actor ${actorId} has no mind`);
  const m = a.mind;
  const ct = creatureType(state, a.core.creatureTypeId);
  const attackSkill = (a.core.templateId ? npcTemplate(state, a.core.templateId).fallback?.attackSkill : undefined) ?? ct.fallback.attackSkill;
  // never copy bark events into an NPC view (Leak prevention)
  const history = [...(state.recentEvents ?? []), ...state.events];
  const perceived = history.filter((e) => e.perception[a.id] && !e.bark).slice(-CONFIG.RECENT_EVENTS).map((e) => eventView(state, a, e));
  const told = history.filter((e) => e.perception[a.id] && isComm(e)).slice(-CONFIG.RECENT_EVENTS).map((e) => eventView(state, a, e));
  const said = history.filter((e) => e.actorId === a.id && e.line?.text && !e.bark).slice(-CONFIG.SAID_LINES).map((e) => e.line!.text);
  const hit = [...history].reverse().find((e) => e.kind === 'attack' && e.target === a.id && e.perception[a.id] && e.attack && !['missed', 'dodged'].includes(e.attack.outcome));
  const scratchHits = state.scratch?.[a.id];
  const lastHitBy = hit?.actorId ?? (Array.isArray(scratchHits) ? (scratchHits.at(-1) as string | undefined) : undefined);
  const beliefs: BeliefView[] = [];
  for (const [about, b] of Object.entries(m.knowledge)) {
    const other = actorById(state, about);
    if (!other) continue;
    beliefs.push({
      about, status: b.status,
      ...(b.lastKnownZone !== undefined ? { lastKnownZone: b.lastKnownZone } : {}),
      ...(b.lastSeenTurn !== undefined ? { lastSeenTurn: b.lastSeenTurn } : {}),
      source: b.source, revealed: [...b.revealed],
      hostile: hostile(state, a, other), active: isActive(other), label: callName(state, a.id, about),
    });
  }
  const band = bandById(state, a.bandId);
  return {
    turn: state.turn,
    self: {
      id: a.id, label: a.label, name: a.names.current, kind: 'npc',
      zone: a.zone, placeId: a.placeId, bandId: a.bandId,
      health: healthLevel(a), parts: partStates(state, a).map((x) => ({ id: x.id, state: x.state })),
      active: isActive(a), broken: m.moraleState === 'broken', surrendered: m.moraleState === 'surrendered', fearless: !!m.fearless,
      control: m.control, standingDefense: a.core.standingDefense,
      gear: ownGear(state, a), attackSkill,
      ...(m.routine ? { routine: { id: m.routine.id, anchorTurn: m.routine.anchorTurn } } : {}),
      routines: (m.routines ?? []).map((id) => ({ id, brief: routine(id).brief })),
      ...(m.routineSetId ? { routineSetId: m.routineSetId } : {}),
      slots: Object.fromEntries(Object.entries(m.slots ?? {}).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v])),
      ...(m.alarm ? { alarm: { armed: m.alarm.armed, ...(m.alarm.lastAlarmTurn !== undefined ? { lastAlarmTurn: m.alarm.lastAlarmTurn } : {}), ...(m.alarm.returnTo ? { returnTo: { id: m.alarm.returnTo.id, anchorTurn: m.alarm.returnTo.anchorTurn } } : {}) } } : {}),
      ...(lastHitBy ? { lastHitBy } : {}),
    },
    beliefs, perceived, told, said,
    band: band
      ? { id: band.id, name: band.name, goals: band.goals, temperament: band.temperament, tactics: band.tactics, relations: { ...band.relations } }
      : { id: a.bandId, name: '', goals: '', temperament: '', tactics: 'simple', relations: {} },
    map: stageZones(state).map((z) => ({ id: z.id, links: z.links.map((l) => ({ to: l.to, sight: l.sight, ...(l.frontier ? { frontier: true } : {}) })) })),
    zones: perceivedZones(state, a.zone),
    seen: seenActors(state, a),
  };
}

export function buildActorView(state: GameState, actorId: string): ActorView {
  const base = baseView(state, actorId);
  const h = state.hidden;
  const plan = h.plans[actorId];
  return {
    ...base,
    ...(plan ? { plan: { goal: plan.goal, steps: [...plan.steps], triggers: structuredClone(plan.triggers), createdTurn: plan.createdTurn } } : {}),
    ...(h.memory[actorId] !== undefined ? { memory: h.memory[actorId] } : {}),
    secrets: h.secrets.filter((s) => s.holderId === actorId).map((s) => ({ id: s.id, holderId: s.holderId, fact: s.fact, leakTerms: [...s.leakTerms], revealWhen: { ...s.revealWhen } })),
    firedTriggers: h.firedLog.filter((f) => f.ownerId === actorId).map((f) => ({ triggerId: f.triggerId, turn: f.turn })),
  };
}
export function buildOppositionView(state: GameState, actorId: string): OppositionView {
  return buildActorView(state, actorId);
}
/** whitelists nothing from state.hidden (owner's recommendation, pending Ali's answer) */
export function buildDialogueView(state: GameState, actorId: string, input: DialogueInput): DialogueView {
  return {
    ...baseView(state, actorId),
    knows: (need(state, actorId).mind?.knows ?? []).map((f) => ({ id: f.id, text: f.text })),
    dialogue: input.map((d) => ({ spoken: d.spoken, impression: d.impression })),
  };
}

// ---------- NarrationView ----------
function itemName(state: GameState, instanceId: string): string | undefined {
  for (const a of allActors(state)) {
    const i = a.core.inventory.find((x) => x.id === instanceId);
    if (i) return itemDef(state, i.itemId).name;
  }
  for (const z of state.zones) {
    const i = z.groundItems.find((x) => x.id === instanceId);
    if (i) return itemDef(state, i.itemId).name;
  }
  return undefined;
}

/** events: this turn's events (the builder keeps only those the player perceived). */
export function buildNarrationView(state: GameState, events: GameEvent[], intent?: Intent | null): NarrationView {
  const p = state.player;
  const me = p.id;
  const out: NarrationEvent[] = [];
  const heard: NarrationView['heard'] = [];
  for (const e of events) {
    const per = e.perception[me];
    if (!per) continue;
    const full = per.level === 'full';
    const changes = visibleChanges(state, e.effects, me);
    if ((e.kind === 'threshold_crossed' || e.kind === 'part_state_changed') && !changes.length) continue; // hidden change
    const speaker = full ? callName(state, me, e.actorId) : undefined;
    const hears = !!e.line && (full || per.cue === 'sound');
    if (hears) heard.push({ speaker: speaker ?? 'someone', text: e.line!.text, volume: e.line!.volume });
    const look = full && e.activity ? activity(e.activity).look : undefined;
    const item = full && e.itemId && e.kind !== 'attack' ? itemName(state, e.itemId) : undefined;
    out.push({
      id: e.id, kind: e.kind, level: per.level, cue: per.cue,
      ...(full ? { actor: callName(state, me, e.actorId) } : {}),
      ...(full && e.target ? { target: callName(state, me, e.target) } : {}),
      where: full ? zoneById(state, e.zone)?.name : whereLabel(state, p.zone, e.zone),
      ...(hears ? { line: { text: e.line!.text, volume: e.line!.volume, ...(speaker ? { speaker } : {}) } } : {}),
      ...(look ? { activityLook: look } : {}),
      ...(full && e.kind === 'attack' && e.attack ? { packet: buildCombatPacket(state, e, me) } : {}),
      ...(item ? { item } : {}),
      ...(changes.length && e.kind !== 'attack' ? { changes } : {}),
    });
  }
  const seen = seenActors(state, p, events);
  const a = intent?.action;
  return {
    style: { tone: state.settings.tone || CONFIG.STYLE.tone, length: CONFIG.STYLE.length },
    ...(a ? { approach: a.approach, stance: a.stance } : {}),
    events: out,
    player: { name: p.names.current, health: healthLevel(p), parts: partStates(state, p).map((x) => ({ id: x.id, state: x.state })), zone: zoneById(state, p.zone)?.name ?? '' },
    surroundings: perceivedZones(state, p.zone),
    heard,
    actors: seen.map((s) => ({ label: s.label, ...(s.name ? { name: s.name } : {}), ...(s.pronouns ? { pronouns: s.pronouns } : {}), zone: zoneById(state, s.zone)?.name ?? '', ...(s.health ? { health: s.health } : {}), ...(s.activityLook ? { activityLook: s.activityLook } : {}) })),
    facts: factsFor(state, p.placeId, seen.filter((s) => s.level === 'full').map((s) => s.id)),
    headlines: headlinesFor(state, p.placeId, false),
  };
}

// ---------- WeaverView ----------
const STAKES: Record<Tier, string> = {
  critical_failure: 'A real challenge with little gain; the harder of the two',
  failure: 'A real challenge with little gain',
  near_miss: 'A normal event, gain matched to challenge',
  success: 'A normal event, gain matched to challenge',
  great_success: 'High gain with a matching high challenge',
  critical_success: 'The biggest gain with the biggest challenge',
};

export function buildWeaverView(state: GameState, target: WeaverView['target']): WeaverView {
  const lib = getLibrary();
  const stage = new Set(state.stage.zoneIds);
  const onStage = state.actors.filter((a) => stage.has(a.zone));
  const bandIds = new Set([state.player.bandId, ...onStage.map((a) => a.bandId)]);
  const cur = state.player.core.classes.find((c) => c.state === 'current');
  const bp = (kind: string) => state.blueprints.filter((b) => b.kind === kind);
  const templates = new Map(Object.values(lib.templates).map((t) => [t.id, { id: t.id, label: t.label, creatureTypeId: t.creatureTypeId }]));
  for (const b of bp('npcTemplate')) templates.set(b.id, { id: b.id, label: String(b.data.label ?? ''), creatureTypeId: String(b.data.creatureTypeId ?? '') });
  const worth = (i: { boon?: number; value: number }) => i.boon ?? i.value / CONFIG.BOON_COIN; // loot V8
  const items = new Map<string, { id: string; name: string; kind: string; boon: number }>(Object.values(lib.items).map((i) => [i.id, { id: i.id, name: i.name, kind: i.kind, boon: worth(i) }]));
  for (const b of bp('item')) items.set(b.id, { id: b.id, name: String(b.data.name ?? ''), kind: String(b.data.kind ?? ''), boon: worth(itemDef(state, b.id)) });
  return {
    tier: tierName(state.stage.tier),
    stakes: STAKES[state.stage.tier] ?? '',
    target: { kind: target.kind, placeId: target.placeId, ...(target.label !== undefined ? { label: target.label } : {}), ...(target.frontierKey !== undefined ? { frontierKey: target.frontierKey } : {}) },
    headlines: headlinesFor(state, target.placeId, true),
    stage: stageZones(state).map((z) => zoneView(state, z)),
    actors: onStage.map((a) => {
      const plan = state.hidden.plans[a.id];
      return {
        id: a.id, label: a.label, name: a.names.current, zone: a.zone, band: a.bandId,
        ...(a.core.templateId ? { templateId: a.core.templateId } : {}),
        ...(plan ? { plan: { goal: plan.goal, steps: [...plan.steps], triggers: structuredClone(plan.triggers), createdTurn: plan.createdTurn } } : {}),
        secrets: state.hidden.secrets.filter((s) => s.holderId === a.id).map((s) => ({ id: s.id, holderId: s.holderId, fact: s.fact, leakTerms: [...s.leakTerms], revealWhen: { ...s.revealWhen } })),
      };
    }),
    quests: state.quests.map((q) => ({ id: q.id, state: q.state, text: q.text })),
    flags: { ...state.flags },
    bands: state.bands.filter((b) => bandIds.has(b.id)).map((b) => ({ id: b.id, name: b.name, goals: b.goals, relations: { ...b.relations } })),
    player: { level: state.player.core.classes.reduce((n, c) => n + c.level, 0), currentClass: cur?.classId ?? null, health: healthLevel(state.player) },
    previousNote: state.hidden.weaverNote,
    catalogs: {
      templates: [...templates.values()],
      creatureTypes: [...new Set([...Object.keys(lib.creatures), ...bp('creature').map((b) => b.id)])],
      routineSets: Object.values(lib.routineSets).map((s) => ({
        id: s.id, brief: s.brief, tags: structuredClone(s.tags),
        slots: Object.fromEntries(Object.entries(s.slots).map(([k, v]) => [k, { kind: v.kind, hint: v.hint }])),
      })),
      items: [...items.values()],
      skills: Object.keys(lib.skills),
    },
    grades: [...GRADES],
  };
}

// ---------- the combat packet ----------
function modeOf(state: GameState, attacker: Actor, weaponId: string, modeId: string): { mode?: AttackMode; weapon: string | null } {
  const inst = attacker.core.inventory.find((i) => i.id === weaponId);
  if (inst) {
    const d = itemDef(state, inst.itemId);
    return { mode: d.weapon?.modes.find((m) => m.id === modeId) ?? d.weapon?.modes[0], weapon: d.name };
  }
  const nat = creatureType(state, attacker.core.creatureTypeId).naturalAttacks;
  const id = weaponId.startsWith('natural:') ? weaponId.slice(8) : modeId;
  const mode = nat.find((m) => m.id === id) ?? nat[0];
  return { mode, weapon: mode?.name ?? null };
}

/** the other side's deciding sources: only lucky/fumble, situation and aim, the weapon used, and gear the viewer can see (no health, wounds, perks or hidden gear) */
function shownDeciding(state: GameState, list: string[], roll: RollResult, rollerId: string, viewerId: string): string[] {
  if (rollerId === viewerId) return [...list];
  const seen = new Set(seenGear(state, need(state, rollerId), need(state, viewerId).mind?.knowledge[rollerId]?.revealed ?? []).map((g) => g.name));
  const type = new Map(roll.modifiers.map((m) => [m.source, m.type]));
  return list.filter((s) => s === 'lucky' || s === 'fumble' || s.startsWith('weapon: ') || type.get(s) === 'situational' || type.get(s) === 'aim' ||
    (s.startsWith('Gear (') && seen.has(s.slice(s.indexOf('): ') + 3))));
}

/** Part 3 packet: no numbers. Others' Healthy→Damaged and Bruised–Injured stay hidden; the player's own condition is always visible. */
export function buildCombatPacket(state: GameState, event: GameEvent, viewerId: string): CombatPacket {
  const r = event.attack;
  if (!r) throw new Error(`event ${event.id} is not an attack`);
  const attacker = need(state, r.attackerId);
  const target = need(state, r.targetId);
  const { mode, weapon } = modeOf(state, attacker, r.weaponId, r.modeId);
  const nat = (n: number) => (n > 0 ? 'lucky' : n < 0 ? 'fumble' : null);
  const armor = r.location && r.location !== 'shield'
    ? target.core.inventory.find((i) => i.equippedIn?.includes('armor') && itemDef(state, i.itemId).armor?.covers.includes(r.location!))
    : undefined;
  const shield = r.location === 'shield' && r.shieldItemId ? target.core.inventory.find((i) => i.id === r.shieldItemId) : undefined;
  const partName = r.location === 'general' ? creatureType(state, target.core.creatureTypeId).general.name : r.location;
  return {
    event: event.id,
    actor: callName(state, viewerId, attacker.id),
    target: callName(state, viewerId, target.id),
    action: `${r.locationHow === 'aimed' ? 'aimed ' : ''}${mode?.thrown ? 'thrown' : (mode?.tree ?? 'melee')} attack`,
    weapon,
    armor: armor ? itemDef(state, armor.itemId).name : null,
    shield: shield ? itemDef(state, shield.itemId).name : null,
    attack: { tier: tierName(r.attack.tier), natural: nat(r.attack.natural), deciding: shownDeciding(state, r.deciding.attack, r.attack, attacker.id, viewerId) },
    defense: r.defense && r.defenseType ? { type: r.defenseType, tier: tierName(r.defense.tier), natural: nat(r.defense.natural), deciding: shownDeciding(state, r.deciding.defense, r.defense, target.id, viewerId) } : null,
    outcome: outcomeLabel(r.outcome),
    location: r.location && partName ? { part: partName, how: r.locationHow ?? 'rolled' } : null,
    changes: visibleChanges(state, event.effects, viewerId),
    events: [],
  };
}
