// W3 — the six deny-by-default view builders (+ the combat packet). Copy whitelisted fields into new objects only.
import { budgetUsed, lastScenarios } from '../engine/scenarioEnd';
import { SCENARIO_ENDING_NAMES } from '../types';
import { personalityText } from '../ruleset/personality';
import { ageText, stageOf } from '../ruleset/age';
import type { AttackOutcome, ScenarioFrame, Tier,
  Actor, ActorView, AttackMode, BeliefView, CombatPacket, DialogueInput, DialogueView, Effect, EventView, GameEvent, GameState, ItemDef,
  AgreementView, ContainerView, ItemInstance, HealthLevel, PartState, YieldView, Intent, JobView, Quest, NarrationEvent, NarrationView, OppositionView, OwnGearView, PlayerView, RollResult, SeenActor, SeenGearView,
  SparView, WayDid, WeaverView, Zone, ZoneLink, ZoneView,
} from '../types';
import { GRADES } from '../types';
import { CONFIG } from '../config';
import { COVER, LIGHT, NERVE_LINES, SCENARIO_SCALES, VISIBILITY, type VisibilityKey } from '../scales';
import { timeView, zoneLight, clockSet, now, timeOfDay, durationText, spanText } from '../time';
import { charLevel, wornTitle } from '../engine/xp';
import { seeingM, sideFrom, sightDistM, spotPoint } from '../engine/position';
import { hiddenFrom } from '../engine/gear';
import { revealedTo } from '../minds/state';
import { sightLevel } from '../perception/sight';
import { atChaseLine, chaseLost, chaseZones } from '../engine/chase';
import { actorById, allActors, knowsName, nameFor, atLeast, bandById, heldBy, isActive, hostile, perceivedZoneIds, seesAcross, shortestPath, sparring, stance, wary, zoneById } from '../engine/relations';
import { knownDestinations } from '../engine/trail';
import { talkingWith } from '../engine/speech';
import { barrierName, barrierOn, barrierView, linkPassage } from '../engine/barriers';
import { contentsOf, wornPack } from '../engine/containers';
import { sparLimit, sparOf } from '../engine/spar';
import { activity, actorBody, bodyType, getLibrary, itemDef, npcTemplate, routine } from '../library';
import { perkMoveBlock } from '../engine/perkMoves';
import { PERK_MOVES, hasPerk, healthLevel, isDownLevel, ownPerkMoves, partStates, tierName } from '../ruleset';
import { summonableThreadboundItems } from '../ruleset/threadboundItems';
import { barkOnly, beliefStatus, hearsWords, isComm, spotInSight } from '../perception';
import { skillName } from '../library/skillNames';
import { offeredRoutines } from '../minds/routines';
import { coinWords, countWords, isSeller, offerList, wareList } from '../engine/trade';
import { dueText, payText } from '../engine/quests';
import { pressedWords, tellFor, tookWords } from '../engine/speech';
import { PK } from '../library/perkIds';
import { readsHealthOf } from '../ruleset/achRewards';
import { IT } from '../library/itemIds';
import { mentions } from '../words';
import { modeName } from '../ruleset/gear';
import { met, outcomeText } from '../ruleset/hits';
import { itemValue } from '../ruleset/value';
import { moraleLevel, moraleShows } from '../ruleset/morale';
import { HEALTH_LEVELS, MORALE_LEVELS, PART_STATES } from '../scales';

const moraleWord = (a: Actor): string => MORALE_LEVELS.name(moraleLevel(a));
/** a unique NPC's title from its template, given with its name in CHARACTER only */
const uniqueTitle = (state: GameState, a: Actor): string | undefined =>
  a.core.generation === 'unique' && a.core.templateId ? npcTemplate(state, a.core.templateId).title : undefined;
/** MB40: the player's yield this scenario, in the player's names for each foe */
function yieldView(state: GameState): YieldView | undefined {
  const y = state.yielding;
  if (!y) return undefined;
  const names = (ids: string[]) => ids.map((id) => callName(state, state.player.id, id));
  return { took: names(y.accepted), waiting: names(y.pending), refused: names(y.refused) };
}

// GAP: Part 4 §5 says "the top few headlines of each ancestor" with no number; placeholder kept here (not in CONFIG).
const HEADLINES_PER_PLACE = 3;
/** others' health shows from CONFIG.HEALTH_SHOWN_FROM down (Voyage C2); Read Wounds (A13) shows it one step earlier on
 * the health track, by position, against a foe (an actor either side is opposed or hostile to) */
const foe = (state: GameState, a: Actor, b: Actor) => wary(state, a, b) || wary(state, b, a);
const reads = (state: GameState, viewer: Actor | undefined, other: Actor | undefined) => !!viewer && !!other && hasPerk(viewer, PK.read_wounds) && foe(state, viewer, other);
const healthShows = (level: HealthLevel, sharp: boolean) => HEALTH_LEVELS.pos(level) >= HEALTH_LEVELS.pos(CONFIG.HEALTH_SHOWN_FROM) - (sharp ? 1 : 0);

// ---------- shared helpers ----------
const stageZones = (state: GameState) => state.stage.zoneIds.map((id) => zoneById(state, id)).filter((z): z is Zone => !!z);

/** a distance as the story and the Map say it: metres under 1 km, else km to one decimal (4.5 km) */
export const distText = (m: number): string => (m >= 1000 ? `${Math.round(m / 100) / 10} km` : `${Math.round(m)} m`);

/** a zone as `viewer` knows it (SD3–SD5: a barrier on a way shows what the viewer can tell of it); with no viewer (the
 * Weaver), every barrier in full */
export function zoneView(state: GameState, z: Zone, viewer?: Actor): ZoneView {
  const way = (l: ZoneLink) => {
    const b = barrierOn(state, l);
    if (!b) return {};
    return { way: viewer ? barrierView(b, viewer, z.id) : { kind: barrierName(b), grade: b.grade, ...(b.lock ? { lock: b.lock.locked ? 'locked' : 'unlocked' } : {}),
      ...(b.bar ? { bar: `${b.bar.drawn ? 'drawn' : 'open'}, bolt on the ${b.bar.side === z.id ? 'this' : 'far'} side` } : {}), ...(b.blocked ? { blocked: true as const } : {}), ...(b.guarded ? { guarded: true as const } : {}) } };
  };
  return {
    id: z.id, name: z.name, look: z.look, cover: COVER.name(z.cover), light: LIGHT.name(zoneLight(state, z)),
    links: z.links.map((l) => ({ to: l.to, label: l.label, sight: seesAcross(state, l), ...(l.frontier ? { frontier: true } : {}), ...(l.drop ? { drop: true } : {}), ...way(l) })),
    groundItems: z.groundItems.filter((i) => !viewer || !hiddenFrom(i, viewer)).map((i) => ({ id: i.id, name: itemDef(state, i.itemId).name, ...containerOf(state, i, viewer) })), // SE8
  };
}
/** CT1/CT3: a container as `viewer` knows it (no viewer: the Weaver, everything); `inside` lists what a worn pack holds */
/** BG-181: what someone's wounds were last treated with, by item name, until their next wound */
const tendedOf = (state: GameState, a: Actor): { tended?: string } => { const t = a.core.condition.tended; return t ? { tended: itemDef(state, t.itemId).name } : {}; };
function containerOf(state: GameState, i: ItemInstance, viewer?: Actor, inside: ItemInstance[] = i.contents ?? []): { container?: ContainerView } {
  if (!itemDef(state, i.itemId).container) return {};
  const lock = i.lock ? { lock: i.lock.locked ? 'locked' as const : 'unlocked' as const } : {};
  const key = viewer && i.lock && viewer.core.inventory.some((k) => k.opens?.includes(i.id)) ? { key: true as const } : {};
  const shows = !viewer || i.open;
  return { container: { ...(i.open ? { open: true as const } : { shut: true as const }), ...lock, ...key, ...(!viewer && i.owner ? { owner: i.owner } : {}),
    ...(shows ? { contents: inside.map((c) => ({ id: c.id, name: itemDef(state, c.itemId).name })) } : {}) } };
}
const perceivedZones = (state: GameState, zoneId: string, viewer: Actor) => perceivedZoneIds(state, zoneId).map((id) => zoneView(state, zoneById(state, id)!, viewer));

/** how a zone reads from `from`: its name when it is `from`, else the label of the first link toward it */
function whereLabel(state: GameState, from: string, to: string): string | undefined {
  if (from === to) return zoneById(state, from)?.name;
  const path = shortestPath(state, from, to);
  return path?.length ? zoneById(state, from)?.links.find((l) => l.to === path[0])?.label : undefined;
}

/** what `viewerId` calls `id`: the player by 'player'; anyone else by the name the viewer has for them (nameFor), else by label */
export function callName(state: GameState, viewerId: string, id: string): string {
  const a = actorById(state, id);
  if (!a) return 'someone';
  if (a.id === state.player.id) return 'player';
  const viewer = actorById(state, viewerId);
  return (viewer && nameFor(state, viewer, a)) ?? a.label;
}
/** whoever `viewer` sees clearly right now (BG-95: a name heard is put to this face) */
export const seesClearlyNow = (state: GameState, viewer: Actor, id: string): boolean => seenActors(state, viewer).some((x) => x.id === id && x.level === 'full');

function ownGear(state: GameState, a: Actor): OwnGearView[] {
  return a.core.inventory.map((i) => {
    const d = itemDef(state, i.itemId);
    const classes = [...new Set((d.weapon?.modes ?? []).map((m) => m.class))];
    return {
      id: i.id, itemId: i.itemId, name: d.name, look: d.look, kind: d.kind, equippedIn: [...(i.equippedIn ?? [])],
      modes: (d.weapon?.modes ?? []).map((m) => ({ id: m.id, name: modeName(m) })),
      ...(classes.length ? { classLabel: classes.join('/') } : {}),
      ...(d.armor ? { weightLabel: d.armor.weight } : {}),
      ...(d.stackable ? { qty: i.qty ?? 1 } : {}),
      ...(d.container && !wornPack(i) ? containerOf(state, { ...i, open: true }, a) : {}), // CT3: one's own sack is always open to one
    };
  });
}

/** Part 5 §8: held items, shield and armor by look; accessories only when visible; concealed only once revealed; a worn
 * pack (CT7); stowed only once found (SE11), or once its pack stands open */
function seenGear(state: GameState, a: Actor, revealed: string[]): SeenGearView[] {
  const out: SeenGearView[] = [];
  for (const i of a.core.inventory) {
    const slot = i.equippedIn?.[0];
    const d = itemDef(state, i.itemId);
    if (!slot) { if (revealed.includes(`item:${i.id}`)) out.push({ id: i.id, name: d.name, look: d.look, where: 'carried' }); continue; }
    if (d.concealed && !revealed.includes(`item:${i.id}`)) continue;
    const where = slot.startsWith('grip:') ? (d.kind === 'shield' ? 'shield' : 'held') : slot === 'armor' ? 'armor' : slot.startsWith('acc:') && d.visible ? 'accessory' : slot === 'pack' ? 'pack' : null;
    // CT5/CT7: a worn pack shows; once opened (its wearer downed or yielded), what it holds shows in it
    if (where) out.push({ id: i.id, name: d.name, look: d.look, where, ...(where === 'pack' ? containerOf(state, i, a, contentsOf({ inst: i, at: a, holder: a })) : {}) });
  }
  return out;
}

/** the activity look an actor shows in this turn's events the viewer perceived fully */
function lookOf(state: GameState, events: GameEvent[], viewerId: string, actorId: string): string | undefined {
  const e = [...events].reverse().find((x) => x.actorId === actorId && x.activity && x.perception[viewerId]?.level === 'full');
  return e ? eventLook(state, e) : undefined;
}

/** BG-133: the look of an event's activity. A look of keeping out of sight (an activity seen only from close) is not shown
 * for someone in a talk who is not stealthy: talking openly, they are plainly not hiding. */
function eventLook(state: GameState, e: GameEvent): string | undefined {
  if (!e.activity) return undefined;
  const d = activity(e.activity), a = actorById(state, e.actorId);
  return d.visibility === 'close' && a?.engagement?.kinds.includes('talk') && a.posture !== 'stealthy' ? undefined : d.look;
}

/** LI2b Read Their Face: the viewer sees the stance toward it of anyone who spoke to it this scenario */
function readsFace(state: GameState, viewer: Actor, a: Actor): boolean {
  return hasPerk(viewer, PK.read_their_face) && !!a.mind && [...(state.recentEvents ?? []), ...state.events].some((e) =>
    e.kind === 'speak' && !e.bark && e.actorId === a.id && e.turn >= state.stage.scenarioStartTurn
    && (e.target === viewer.id || !!e.speech?.addressees?.includes(viewer.id)));
}

/** the viewer fully perceived an event by `aboutId` since the scenario began (recent history included) */
function seenClearly(state: GameState, viewerId: string, aboutId: string): boolean {
  return [...(state.recentEvents ?? []), ...state.events].some((e) =>
    e.actorId === aboutId && e.turn >= state.stage.scenarioStartTurn && e.perception[viewerId]?.level === 'full');
}

/** ZR6: how far off a person is made out, by the sight table: someone still at low visibility; someone who did something this
 * turn (walked, spoke, fought) at the most visible of what they did */
const personVisibility = (a: Actor, events: GameEvent[]): VisibilityKey =>
  events.filter((e) => e.actorId === a.id).reduce<VisibilityKey>((v, e) => (VISIBILITY.pos(e.visibility) > VISIBILITY.pos(v) ? e.visibility : v), 'low');

/** actors the viewer perceives now: in its own or a sight-linked zone, made out by the sight table in metres (ZR6): full
 * within clear sight, 'someone' within a glimpse, beyond that not at all; dark zones give partial. NPCs perceive the player
 * only once aware. */
function seenActors(state: GameState, viewer: Actor, events: GameEvent[] = state.events): SeenActor[] {
  if (viewer.asleep) return []; // NW12/NW20: asleep, it sees no one
  const zones = perceivedZoneIds(state, viewer.zone);
  const out: SeenActor[] = [];
  for (const a of allActors(state)) {
    if (a.id === viewer.id || !zones.includes(a.zone)) continue;
    if (a.id === state.player.id && !atLeast(viewer.mind?.knowledge[a.id]?.status, 'aware')) continue;
    const sight = sightLevel(personVisibility(a, events), seeingM(state, viewer, a));
    if (!sight) continue;
    // NS2/NS4: a stealthy NPC outside the viewer's band shows only to those who see it; a suspicious viewer half sees someone
    const hidden = a.id !== state.player.id && a.posture === 'stealthy' && a.bandId !== viewer.bandId ? beliefStatus(state, viewer, a) : 'aware';
    if (hidden === 'unaware') continue;
    // BG-92: where someone is, even half seen, so nobody mistakes them for another person elsewhere
    const place = {
      ...(a.pos && viewer.pos ? { distanceM: Math.round(sightDistM(state, viewer, a) * 10) / 10 } : {}),
      ...(sideFrom(viewer, a.pos) ? { side: sideFrom(viewer, a.pos)! } : {}),
    };
    if (hidden === 'suspicious') { out.push({ id: a.id, label: 'someone', zone: a.zone, level: 'partial', gear: [], ...place }); continue; }
    // P3: in a dark zone someone is half seen, unless within clear sight and the viewer perceived them fully this scenario
    // (spoke face to face, say): then they stay seen
    const keptSight = viewer.journal?.clearSight?.[a.id] === a.zone; // Q17: seen clearly and has not moved
    const dark = zoneLight(state, zoneById(state, a.zone)) === 'dark' && !keptSight && !(sight === 'full' && seenClearly(state, viewer.id, a.id));
    const level = sight === 'partial' || dark ? 'partial' : 'full';
    // GAP: a partially perceived actor keeps its id (needed as a target) but shows only 'someone'.
    if (level === 'partial') { out.push({ id: a.id, label: 'someone', zone: a.zone, level, gear: [], ...place }); continue; }
    const name = nameFor(state, viewer, a);
    const h = healthLevel(a);
    const parts = partStates(state, a);
    const crippled = parts.filter((p) => p.state === 'crippled').map((p) => p.id);
    const destroyed = parts.filter((p) => p.state === 'destroyed').map((p) => p.id);
    const damaged = parts.filter((p) => p.state === 'damaged').map((p) => p.id);
    const look = lookOf(state, events, viewer.id, a.id);
    out.push({
      id: a.id, label: a.label, ...(name ? { name } : {}), ...(a.pronouns ? { pronouns: a.pronouns } : {}), zone: a.zone, level,
      ...(stageOf(state, a) ? { age: stageOf(state, a)! } : {}), // AG16: the life stage, never the number
      ...place,
      ...(look ? { activityLook: look } : {}),
      ...(healthShows(h, reads(state, viewer, a)) || readsHealthOf(viewer, a) ? { health: h } : {}),
      // someone Down (incapacitated or dead) shows no mood
      ...(!isDownLevel(h) && moraleShows(moraleLevel(a)) ? { morale: moraleWord(a) } : {}),
      ...(readsFace(state, viewer, a) ? { stance: stance(state, a, viewer) } : {}),
      ...(crippled.length ? { crippled } : {}), ...(destroyed.length ? { destroyed } : {}), ...tendedOf(state, a),
      ...(reads(state, viewer, a) && damaged.length ? { damaged } : {}),
      gear: seenGear(state, a, revealedTo(viewer, a.id)),
      ...(viewer === state.player && isSeller(a) ? { wares: wareList(state, viewer, a), offers: offerList(state, viewer, a) } : {}),
    });
  }
  return out;
}

const outcomeLabel = (o: AttackOutcome) => outcomeText(o);

/** SP1/SP4: the spar `viewer` fights in; name turns an actor id into what the viewer shows (an id, or the player's name for it) */
function sparView(state: GameState, viewer: Actor, name: (id: string) => string): SparView | undefined {
  const sp = sparOf(state, viewer.id);
  if (!sp) return undefined;
  const mine = sp.sides.find((s) => s.includes(viewer.id))!;
  return {
    opponents: sp.sides.filter((s) => s !== mine).flat().map(name), allies: mine.filter((id) => id !== viewer.id).map(name),
    limit: sparLimit(sp), cruel: !!sp.cruel, out: viewer.id in sp.out,
  };
}

/** All-50 Know the Step: a viewer with the perk who only hears someone whose name it knows learns who it is */
function knowsStep(state: GameState, viewer: Actor, e: GameEvent): boolean {
  const p = e.perception[viewer.id];
  const a = actorById(state, e.actorId);
  if (!p || p.level === 'full' || p.cue !== 'sound' || !a || a === viewer || !hasPerk(viewer, PK.know_the_step)) return false;
  return knowsName(state, viewer, a);
}

function eventView(state: GameState, viewer: Actor, e: GameEvent): EventView {
  const p = e.perception[viewer.id];
  const full = p.level === 'full';
  return {
    id: e.id, turn: e.turn, kind: e.kind, zone: e.zone,
    ...(full || knowsStep(state, viewer, e) ? { actorId: e.actorId } : {}),
    ...(full && e.target ? { target: e.target } : {}),
    ...(full && e.tier !== undefined && e.actorId === viewer.id ? { tier: tierName(e.tier) } : {}),
    level: p.level, cue: p.cue,
    ...(!full ? { where: whereLabel(state, viewer.zone, e.zone) } : {}),
    ...(e.line && !e.bark && hearsWords(p) ? { line: { text: e.line.text, volume: e.line.volume } } : {}),
    ...(full && e.attack ? { outcome: outcomeLabel(e.attack.outcome) } : {}),
    ...(full && e.spar ? { spar: true as const } : {}),
    ...(e.actorId === viewer.id && tookWords(e) ? { took: tookWords(e) } : {}),
    ...(e.overheard?.includes(viewer.id) ? { tell: tellFor(viewer) } : {}), // LI5a Overheard
    ...(e.kind === 'wasted' && e.actorId === viewer.id && e.reason ? { reason: e.reason } : {}), // BG-175: its own action came to nothing, and why
  };
}

/** visible condition changes as text: the player's own always; others' only from CONFIG.HEALTH_SHOWN_FROM down (a step earlier
 * with Read Wounds) and parts Crippled or worse */
function visibleChanges(state: GameState, effects: Effect[], viewerId: string): string[] {
  const out: string[] = [];
  for (const f of effects) {
    const own = f.actorId === viewerId;
    const who = callName(state, viewerId, f.actorId);
    const sharp = reads(state, actorById(state, viewerId), actorById(state, f.actorId));
    if (f.kind === 'threshold_crossed') {
      const to = f.data.to as HealthLevel;
      if (own || healthShows(to, sharp) || readsHealthOf(actorById(state, viewerId), actorById(state, f.actorId))) out.push(`${who} is ${HEALTH_LEVELS.name(to)}`);
    }
    const by = f.data.by ? callName(state, viewerId, String(f.data.by)) : '';
    if (f.kind === 'found') out.push(`${by} finds ${who} hiding`); // SE3: a search won
    if (f.kind === 'found_items') { // SE8/SE11
      const names = (f.data.items as string[]).map((id) => itemName(state, id) ?? 'something').join(', ');
      out.push(f.data.on ? `${by} finds ${names} on ${who}, left there for now` : `${who} finds ${names} hidden here, left there for now`); // BG-178: found is not taken
    }
    if (f.kind === 'found_nothing') out.push(!f.data.on ? `${by} finds nothing here` : f.data.held ? `${by} finds nothing on ${who}` : `${by} sees nothing on ${who}; going through their things needs a hold on them`); // BG-142
    if (f.kind === 'disturbed') out.push(`${who} notices something here has been moved`); // SE8: a search that tied a hidden item
    if (f.kind === 'held') out.push(`${who} is held by ${by}`); // A8 Hold
    if (f.kind === 'broke_free') out.push(`${who} breaks free of ${by}`);
    if (f.kind === 'still_held') out.push(`${who} fails to break free of ${by}`);
    if (f.kind === 'slipped_grab') out.push(`${who} slips ${by}'s grab`); // BF5
    if (f.kind === 'dirt_in_eyes') out.push(`${by} throws dirt in ${who}'s eyes`); // A9 Dirt in the Eyes
    if (f.kind === 'dirt_dodged') out.push(`${who} turns away from ${by}'s thrown dirt`);
    if (f.kind === 'bluff_believed') out.push(`${who} falls for ${by}'s bluff and hesitates`); // LI1c Bluff
    if (f.kind === 'bluff_seen_through') out.push(`${who} doesn't fall for ${by}'s bluff`);
    if (f.kind === 'aura_took') out.push(f.data.overwhelmed ? `${who} is overwhelmed by ${by} and gives up` : `${who} falters before ${by}`); // NT14 auras: Dread Presence; MR4 Overwhelm
    if (f.kind === 'cry_took') out.push(f.data.overwhelmed ? `${who} is overwhelmed by ${by}'s roar and gives up` : `${who} falters at ${by}'s roar`); // I9 Battle Cry
    if (f.kind === 'rallied' && f.data.by !== f.actorId) out.push(`${who} takes heart at ${by}'s roar`); // the roarer's own rally goes untold
    if (f.kind === 'travelled') { // TV7: one passage for the trip: how far, how long, how it ended
      const d = f.data as { metres: number; minutes: number; pace: string; night: boolean; stop: string };
      const km = distText(d.metres);
      const stop = d.stop === 'nightfall' ? ', stopping as night falls' : d.stop === 'encounter' ? ', until something on the road stops ' + (own ? 'you' : who) : '';
      out.push(`${who} travel${own ? '' : 's'} ${km} in ${durationText(d.minutes)} at a ${d.pace} pace${d.night ? ' through the dark' : ''}${stop}`);
    }
    if (f.kind === 'part_state_changed') {
      const to = f.data.to as PartState;
      if (own || PART_STATES.pos(to) >= PART_STATES.pos('crippled') || (sharp && to === 'damaged')) out.push(`${who}'s ${String(f.data.part ?? f.data.partId ?? 'part')} is ${PART_STATES.name(to)}`);
    }
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
/** BG-55: who the player was just talking with (engine talkingWith); BG-61: heard counts too (a voice through a barred
 * door), since their words reached the player */
function talkingWithSeen(state: GameState): { id: string; name: string }[] {
  return talkingWith(state).map((id) => ({ id, name: callName(state, state.player.id, id) }));
}
/** people the player saw or heard earlier who are out of sight now, with the zone they were last seen or heard in, so
 * the Parser never answers "they aren't here" about someone a few steps away (playtest run 20) or someone heard running
 * off (BG-28) */
/** BG-164: the player sees the spot where they last saw `id`, and nobody is made out there: they are gone from it, as far
 * as the player knows (never where to) */
function goneFromSpot(state: GameState, id: string): boolean {
  const j = state.player.journal, zone = j?.lastKnown?.[id], pos = j?.lastSpot?.[id];
  return !!zone && !!pos && spotInSight(state, { zone, pos });
}
function lastSeen(state: GameState, seen: SeenActor[]): NonNullable<PlayerView['lastSeen']> {
  const p = state.player;
  return Object.entries({ ...p.journal?.clearSight, ...p.journal?.lastKnown }).flatMap(([id, zone]) => {
    const a = actorById(state, id);
    if (!a || seen.some((x) => x.id === id && x.level === 'full') || !isActive(a)) return [];
    // BG-130: their pronouns too, so words about someone out of sight never guess them from a name
    // BG-155: a seller seen before is still known to sell, so a buy from them steps up to them
    return [{ id, name: nameFor(state, p, a) ?? a.label, zone: zoneById(state, zone)?.name ?? zone, ...(a.pronouns ? { pronouns: a.pronouns } : {}), ...(isSeller(a) ? { wares: wareList(state, p, a) } : {}), ...(goneFromSpot(state, id) ? { gone: true } : {}) }];
  });
}

/** NM2: names the player has heard of someone still in the world but cannot yet put a face to */
const heardOf = (state: GameState): string[] => (state.player.journal?.heardOf ?? []).flatMap((id) => actorById(state, id)?.names.current ?? []);

export function buildPlayerView(state: GameState): PlayerView {
  const p = state.player;
  const actors = seenActors(state, p);
  return {
    turn: state.turn,
    player: {
      id: 'player', name: p.names.current, ...(p.pronouns ? { pronouns: p.pronouns } : {}), // BG-97: never guessed from the name
      classes: p.core.classes.map((c) => ({ id: c.classId, name: getLibrary().classes[c.classId]?.name ?? c.classId })),
      skills: Object.keys(p.core.skills).map((id) => ({ id, name: skillName(id) })),
      perks: p.core.perks.map((x) => ({ id: x.perkId, name: getLibrary().perks[x.perkId]?.name ?? x.perkId })),
      ...(summonableThreadboundItems(state, p).length ? { summonable: summonableThreadboundItems(state, p).map((i) => ({ id: i.id, name: itemDef(state, i.itemId).name })) } : {}),
      ...(ownPerkMoves(p).length ? { perkMoves: ownPerkMoves(p).map((id) => ({ id, name: getLibrary().perks[id]?.name ?? id, does: PERK_MOVES[id].does, ...(PERK_MOVES[id].free ? {} : { action: true as const }), ...(PERK_MOVES[id].untargeted ? {} : { inRange: actors.filter((x) => perkMoveBlock(state, p, id, x.id) !== 'no_target').map((x) => x.id) }) })) } : {}),
      health: healthLevel(p), parts: partStates(state, p).map((x) => ({ id: x.id, state: x.state })), ...tendedOf(state, p), morale: moraleWord(p),
      inventory: ownGear(state, p),
      posture: p.posture ?? 'open',
      standingDefense: p.core.standingDefense,
      ...(heldBy(state, p) ? { heldBy: callName(state, p.id, heldBy(state, p)!.id) } : {}),
      ...(sparOf(state, p.id) ? { spar: sparView(state, p, (id) => callName(state, p.id, id)) } : {}),
      ...(yieldView(state) ? { yielded: yieldView(state) } : {}),
    },
    zone: zoneView(state, zoneById(state, p.zone)!, p),
    zones: perceivedZones(state, p.zone, p),
    actors,
    ...(lastSeen(state, actors).length ? { lastSeen: lastSeen(state, actors) } : {}),
    ...(heardOf(state).length ? { heardOf: heardOf(state) } : {}),
    ...(talkingWithSeen(state).length ? { talkingWith: talkingWithSeen(state) } : {}),
    ...(knownDestinations(state).length ? { known: knownDestinations(state) } : {}),
    ...(p.journal?.trail?.length ? { cameFrom: p.journal.trail.map((x) => ({ zone: x.zone, name: zoneById(state, x.zone)?.name ?? x.zone, leftTurn: x.left })) } : {}),
    facts: factsFor(state, p.placeId, actors.filter((a) => a.level === 'full').map((a) => a.id)),
    headlines: headlinesFor(state, p.placeId, false),
    ...(agreementViews(state, p.id).length ? { agreements: agreementViews(state, p.id) } : {}),
  };
}

// ---------- ActorView / OppositionView / DialogueView ----------
type BaseView = Omit<ActorView, 'plan' | 'memory' | 'agreements' | 'secrets' | 'firedTriggers'>;

/** everything an NPC view holds that is not in state.hidden */
function baseView(state: GameState, actorId: string): BaseView {
  const a = need(state, actorId);
  if (!a.mind) throw new Error(`actor ${actorId} has no mind`);
  const m = a.mind;
  const ct = actorBody(state, a);
  const attackSkill = (a.core.templateId ? npcTemplate(state, a.core.templateId).fallback?.attackSkill : undefined) ?? ct.fallback.attackSkill;
  // never copy bark events into an NPC view (Leak prevention)
  const history = [...(state.recentEvents ?? []), ...state.events];
  const perceived = history.filter((e) => e.perception[a.id] && !barkOnly(e)).slice(-CONFIG.RECENT_EVENTS).map((e) => eventView(state, a, e));
  const told = history.filter((e) => hearsWords(e.perception[a.id]) && isComm(e)).slice(-CONFIG.RECENT_EVENTS).map((e) => eventView(state, a, e));
  const said = history.filter((e) => e.actorId === a.id && e.line?.text && !e.bark).slice(-CONFIG.SAID_LINES).map((e) => e.line!.text);
  const hit = [...history].reverse().find((e) => e.kind === 'attack' && e.target === a.id && e.perception[a.id] && e.attack && met(e.attack.outcome));
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
      stance: stance(state, a, other), hostile: hostile(state, a, other), ...(sparring(state, a, other) ? { sparring: true as const } : {}),
      ...(chaseLost(b) ? { lost: true as const } : {}),
      active: isActive(other), label: callName(state, a.id, about),
      ...(about === state.player.id && nameFor(state, a, other) ? { name: nameFor(state, a, other)! } : {}), // BG-95: the player's name, once heard (NM3: or the false one believed)
      ...(other.pronouns ? { pronouns: other.pronouns } : {}), // BG-60: so an NPC speaks of someone out of sight as they are
      // T18: a worn title reaches only someone who has seen the player, never by sound or hearsay, so stealth keeps it hidden
      ...(about === state.player.id && b.source === 'seen' && atLeast(b.status, 'aware') && wornTitle(state) ? { title: wornTitle(state) } : {}),
    });
  }
  const band = bandById(state, a.bandId);
  const jobs = jobViews(state, a.id);
  const chase = chaseZones(state, a);
  return {
    turn: state.turn,
    time: timeView(state),
    self: {
      id: a.id, label: a.label, name: a.names.current, kind: 'npc', ...(ageText(state, a) ? { age: ageText(state, a)! } : {}), // AG16
      zone: a.zone, placeId: a.placeId, bandId: a.bandId,
      health: healthLevel(a), parts: partStates(state, a).map((x) => ({ id: x.id, state: x.state })), ...tendedOf(state, a), morale: moraleWord(a),
      ...(m.lastWasted ? { lastWasted: { ...m.lastWasted } } : {}), active: isActive(a), broken: m.moraleState === 'broken', surrendered: m.moraleState === 'surrendered',
      control: m.control, standingDefense: a.core.standingDefense, ...(heldBy(state, a) ? { heldBy: heldBy(state, a)!.id } : {}),
      gear: ownGear(state, a), attackSkill,
      ...(m.routine ? { routine: { id: m.routine.id, anchorTurn: m.routine.anchorTurn, elapsed: Math.max(0, now(state) - (m.routine.at ?? now(state))), dayPart: timeOfDay(now(state)) } } : {}),
      routines: offeredRoutines(m.routines).map((id) => ({ id, brief: routine(id).brief })),
      ...(m.routineSetId ? { routineSetId: m.routineSetId } : {}),
      slots: Object.fromEntries(Object.entries(m.slots ?? {}).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v])),
      ...(m.alarm ? { alarm: { armed: m.alarm.armed, ...(m.alarm.lastAlarmTurn !== undefined ? { lastAlarmTurn: m.alarm.lastAlarmTurn } : {}), ...(m.alarm.returnTo ? { returnTo: { id: m.alarm.returnTo.id, anchorTurn: m.alarm.returnTo.anchorTurn } } : {}) } } : {}),
      ...(lastHitBy ? { lastHitBy } : {}),
      ...(a.posture === 'stealthy' ? { stealthy: true as const } : {}),
      ...(sparOf(state, a.id) ? { spar: sparView(state, a, (id) => id) } : {}),
      ...(state.yielding?.pending.includes(a.id) ? { playerYielded: true as const } : {}),
      ...(state.mercy?.pending.includes(a.id) ? { playerAtMercy: true as const } : {}),
      ...(isSeller(a) ? { wares: wareList(state, state.player, a), offers: offerList(state, state.player, a) } : {}),
      ...(chase ? { chaseZones: chase } : {}),
      ...(atChaseLine(state, a) ? { atChaseLine: true as const } : {}),
    },
    beliefs, perceived, told, said,
    ...(m.earlier?.lines.length ? { earlier: [...m.earlier.lines] } : {}),
    personality: personalityText(state, a, moraleWord(a)),
    ...(uniqueTitle(state, a) ? { title: uniqueTitle(state, a) } : {}),
    band: band
      ? { id: band.id, name: band.name, goals: band.goals, temperament: band.temperament, tactics: band.tactics, relations: { ...band.relations } }
      : { id: a.bandId, name: '', goals: '', temperament: '', tactics: 'simple', relations: {} },
    // BA7: code paths treat a way shut to this actor (no key, the far side of the bar, rubble) as no way
    map: stageZones(state).map((z) => ({ id: z.id, links: z.links.map((l) => ({ to: l.to, sight: seesAcross(state, l), ...(l.frontier ? { frontier: true } : {}), ...(l.drop ? { drop: true } : {}), ...(linkPassage(state, l, a, z.id) === 'shut' ? { shut: true } : {}) })) })),
    zones: perceivedZones(state, a.zone, a),
    seen: seenActors(state, a),
    ...(jobs.length ? { jobs } : {}),
  };
}

/** QT5/QT8: the player's jobs the viewer gave, or that send the player to it */
function jobViews(state: GameState, viewerId: string): JobView[] {
  return state.quests.filter((q) => q.giver === viewerId || (q.goal.kind === 'deliver' && q.goal.to === viewerId) || (q.goal.kind === 'find' && q.goal.actor === viewerId))
    .map((q) => ({
      id: q.id, text: q.text, state: q.state === 'ready' ? 'active' : q.state,
      ...(q.giver !== viewerId ? { giver: callName(state, viewerId, q.giver) } : {}),
      ...(q.giver === viewerId && payText(state, q) ? { owed: payText(state, q) } : {}),
      ...(dueText(q) ? { due: dueText(q) } : {}),
      ...(q.after ? { after: q.after } : {}),
    }));
}

/** QT14: a quest's goal and progress as the player knows it ("Slimes 3 / 10"); empty for an "other" goal */
export function questGoalText(state: GameState, q: Quest): string {
  const g = q.goal, lib = getLibrary();
  const who = (id: string) => callName(state, state.player.id, id);
  const name = (f: () => string, or: string) => { try { return f(); } catch { return or; } };
  const many = (n: string, k: number) => (k > 1 && !/s$/i.test(n) ? `${n}s` : n);
  const count = (n: string, k: number) => `${n[0].toUpperCase()}${many(n, k).slice(1)} ${q.progress} / ${k}`;
  switch (g.kind) {
    case 'defeat': return g.by === 'actor' ? `Defeat ${who(g.of)}` : count(g.noun ?? (g.by === 'race' ? lib.races?.[g.of]?.name ?? g.of : name(() => bodyType(state, g.of).name, g.of)), g.count);
    case 'deliver': return `${count(g.inst ? itemName(state, g.item) ?? 'the item' : name(() => itemDef(state, g.item).name, g.item), g.qty)} to ${who(g.to)}`;
    case 'reach': return `Reach ${zoneById(state, g.place)?.name ?? state.places.find((p) => p.id === g.place)?.names.current ?? g.place}`;
    case 'find': return `Find ${who(g.actor)}`;
    default: return '';
  }
}

export function buildActorView(state: GameState, actorId: string): ActorView {
  const base = baseView(state, actorId);
  const h = state.hidden;
  const plan = h.plans[actorId];
  return {
    ...base,
    ...(plan ? { plan: { goal: plan.goal, steps: [...plan.steps], triggers: structuredClone(plan.triggers), createdTurn: plan.createdTurn } } : {}),
    ...(h.memory[actorId]?.length ? { memory: h.memory[actorId].map((m, i) => ({ n: i + 1, turn: m.turn, text: m.text })) } : {}),
    ...(agreementViews(state, actorId).length ? { agreements: agreementViews(state, actorId) } : {}),
    secrets: h.secrets.filter((s) => s.holderId === actorId).map((s) => ({ id: s.id, holderId: s.holderId, fact: s.fact, leakTerms: [...s.leakTerms], revealWhen: { ...s.revealWhen } })),
    firedTriggers: h.firedLog.filter((f) => f.ownerId === actorId).map((f) => ({ triggerId: f.triggerId, turn: f.turn })),
  };
}
/** PM3: the deals `viewerId` is a party to, naming the other party as the viewer calls it */
function agreementViews(state: GameState, viewerId: string): AgreementView[] {
  return (state.hidden.agreements ?? []).filter((g) => g.parties.includes(viewerId)).map((g) => {
    const other = g.parties[0] === viewerId ? g.parties[1] : g.parties[0];
    const q = state.quests.find((x) => x.dealId === g.id);
    return { id: g.id, with: callName(state, viewerId, other), withId: other, text: g.text, madeTurn: g.madeTurn, ...(q ? { quest: q.id } : {}) };
  });
}

/** PM6: one plain line about a perceived event, as `viewer` saw or heard it; null for idle kinds */
export function earlierLine(state: GameState, viewer: Actor, e: GameEvent): string | null {
  if (['hold', 'idle', 'wait', 'rest', 'sleep', 'presence'].includes(e.kind)) return null;
  const v = eventView(state, viewer, e);
  if (v.level !== 'full') return `${v.cue === 'sound' ? 'heard' : 'glimpsed'} ${v.actorId ? callName(state, viewer.id, v.actorId) : 'something'}${v.where ? ` ${v.where}` : ''}`;
  const name = (id: string) => (id === viewer.id ? 'you' : callName(state, viewer.id, id));
  const who = name(e.actorId);
  const said = v.line ? `: "${v.line.text.length > 80 ? `${v.line.text.slice(0, 77)}...` : v.line.text}"` : '';
  const moving = e.kind === 'move' || e.kind === 'flee';
  const where = moving && (e.fromZone || !v.target) ? ` to ${zoneById(state, e.zone)?.name ?? e.zone}` : '';
  return `${who} ${e.kind.replace(/_/g, ' ')}${v.target ? ` ${moving ? (e.beside ? 'up to ' : 'toward ') : ''}${name(v.target)}` : ''}${where}${v.outcome ? ` (${v.outcome})` : ''}${said}`;
}

export function buildOppositionView(state: GameState, actorId: string): OppositionView {
  return buildActorView(state, actorId);
}
/** whitelists nothing from state.hidden (owner's recommendation, answer pending) */
export function buildDialogueView(state: GameState, actorId: string, input: DialogueInput): DialogueView {
  return {
    ...baseView(state, actorId),
    knows: (need(state, actorId).mind?.knows ?? []).map((f) => ({ id: f.id, text: f.text })),
    dialogue: input.map((d) => ({ spoken: d.spoken, impression: d.impression })),
  };
}

// ---------- NarrationView ----------
/**
 * What the player calls an event's target. Run 15: a zone target ("observe the cellar") came out as "someone", and the
 * Narrator invented a person. Actors only when the player perceives them fully; zones and items by name; else nothing.
 */
function eventTarget(state: GameState, me: string, target: string, seenIds: Set<string>): string | undefined {
  if (target === me) return 'player';
  if (actorById(state, target)) return seenIds.has(target) ? callName(state, me, target) : undefined;
  const z = zoneById(state, target);
  if (z) return z.name;
  return itemName(state, target);
}

/** the library item of an item instance anyone carries or that lies on the ground */
function instanceItem(state: GameState, instanceId: string): string | undefined {
  for (const a of allActors(state)) {
    const i = a.core.inventory.find((x) => x.id === instanceId);
    if (i) return i.itemId;
  }
  for (const z of state.zones) {
    const i = z.groundItems.find((x) => x.id === instanceId);
    if (i) return i.itemId;
  }
  return undefined;
}
/** an event's item by name: an instance id, or (BG-168: a use_item, a stack used up) the item's own id */
function itemName(state: GameState, instanceId: string): string | undefined {
  const id = instanceItem(state, instanceId) ?? instanceId;
  try { return itemDef(state, id).name; } catch { return undefined; }
}

/** events: this turn's events (the builder keeps only those the player perceived). */
export function buildNarrationView(state: GameState, events: GameEvent[], intent?: Intent | null): NarrationView {
  const p = state.player;
  const me = p.id;
  const out: NarrationEvent[] = [];
  const heard: NarrationView['heard'] = [];
  const seen = seenActors(state, p, events);
  const seenIds = new Set(seen.filter((x) => x.level === 'full').map((x) => x.id));
  const comings = new Map<string, string[]>(); // BF2e: a long turn's legs the player noticed, by who walked them
  for (const e of events) {
    const per = e.perception[me];
    if (!per) continue;
    const full = per.level === 'full';
    if (e.summed) { comings.set(e.actorId, [...(comings.get(e.actorId) ?? []), legWords(state, e, full)]); continue; }
    const changes = visibleChanges(state, e.effects, me);
    if ((e.kind === 'threshold_crossed' || e.kind === 'part_state_changed') && !changes.length) continue; // hidden change
    const speaker = full || knowsStep(state, p, e) ? callName(state, me, e.actorId) : undefined;
    const hears = !!e.line && hearsWords(per);
    if (hears) heard.push({ speaker: speaker ?? 'someone', text: e.line!.text, volume: e.line!.volume });
    const look = full ? eventLook(state, e) : undefined;
    const name = full && e.kind !== 'attack' ? (e.service ? getLibrary().services?.[e.service]?.name : e.itemId ? itemName(state, e.itemId) : undefined) : undefined;
    const item = e.itemId && instanceItem(state, e.itemId) === IT.coin && e.qty ? coinWords(e.qty) : name && e.qty && e.qty > 1 ? `${e.qty} ${name}` : name; // PY9: coin in coin words
    const forWhom = full && e.for ? eventTarget(state, me, e.for, new Set([...seenIds, e.for])) : undefined;
    // a fully seen attack shows both sides; any other target only if the player sees it (run 15)
    // BG-125: the player's own action at someone they cannot see is still at someone, never at themselves
    const target = full && e.target ? eventTarget(state, me, e.target, e.kind === 'attack' ? new Set([...seenIds, e.target]) : seenIds)
      ?? (e.actorId === me && actorById(state, e.target) ? 'someone' : undefined) : undefined;
    out.push({
      id: e.id, kind: e.kind, level: per.level, cue: per.cue,
      ...(full ? { actor: callName(state, me, e.actorId) } : {}),
      ...(full && e.actorId !== me && actorById(state, e.actorId)?.pronouns ? { pronouns: actorById(state, e.actorId)!.pronouns } : {}),
      ...(target ? { target } : {}),
      ...(target && e.target !== me && actorById(state, e.target!)?.pronouns ? { targetPronouns: actorById(state, e.target!)!.pronouns } : {}),
      where: full ? zoneById(state, e.zone)?.name : whereLabel(state, p.zone, e.zone),
      ...(hears ? { line: { text: e.line!.text, volume: e.line!.volume, ...(speaker ? { speaker } : {}) } } : {}),
      ...(look ? { activityLook: look } : {}),
      ...(full && e.kind === 'attack' && e.attack ? { packet: buildCombatPacket(state, e, me) } : {}),
      ...(full && e.spar ? { spar: true as const } : {}),
      ...(e.push?.listener === me && pressedWords(e, p) ? { pressed: pressedWords(e, p) } : {}),
      ...(e.overheard?.includes(me) ? { overheard: tellFor(p) } : {}), // LI5a
      ...(item ? { item } : {}),
      ...(full && e.price ? { price: coinWords(e.price) } : {}),
      ...(full && e.metres ? { metres: e.metres } : {}),
      ...(full && e.spot ? { spot: e.spot } : {}),
      ...(full && e.beside ? { spot: 'beside them' } : {}), // BG-81: the walk at its target reached them
      ...(full && e.fall ? { fall: { metres: e.fall.metres, landing: e.fall.landing } } : {}),
      ...(full && e.way && (!e.way.barrier || state.barriers?.[e.way.barrier]) ? { way: wayWords(state, e.way) } : {}),
      ...(full && e.kind === 'move' ? (e.fromZone ? { from: zoneById(state, e.fromZone)?.name ?? e.fromZone } : { within: true as const }) : {}),
      ...(full && e.heading ? { heading: zoneById(state, e.heading)?.name ?? e.heading } : {}),
      ...(full && e.toGo ? { toGo: e.toGo } : {}),
      ...(full && e.round ? { round: `${e.round.way}: ${e.round.shut}` } : {}),
      ...(forWhom ? { for: forWhom } : {}),
      ...(full && e.reason ? { reason: e.reason.replace(/_/g, ' ') } : {}),
      ...(changes.length && e.kind !== 'attack' ? { changes } : {}),
    });
  }
  const a = intent?.action;
  return {
    style: { tone: state.settings.tone || CONFIG.STYLE.tone, length: CONFIG.STYLE.length },
    time: timeView(state),
    ...(a ? { approach: a.approach, stance: a.stance } : {}),
    events: out,
    player: { name: p.names.current, ...(p.pronouns ? { pronouns: p.pronouns } : {}), health: healthLevel(p), morale: moraleWord(p), parts: partStates(state, p).map((x) => ({ id: x.id, state: x.state })), ...tendedOf(state, p), zone: zoneById(state, p.zone)?.name ?? '', ...(p.posture === 'stealthy' ? { stealthy: true } : {}), ...(yieldView(state) ? { yielded: yieldView(state) } : {}), ...(wornTitle(state) ? { title: wornTitle(state) } : {}), personality: personalityText(state, p, moraleWord(p)), ...(ageText(state, p) ? { age: ageText(state, p)! } : {}),
      // the only gear the player character has: the Narrator may not describe any other (playtest run 20)
      gear: ownGear(state, p).map((g) => `${countWords(g.itemId, g.name, g.qty)}, ${g.look} (${g.equippedIn.some((x) => x.startsWith('grip:')) ? 'held' : g.equippedIn.length ? 'worn' : 'carried'})`) },
    surroundings: perceivedZones(state, p.zone, p),
    heard,
    actors: seen.map((s) => ({ label: s.label, ...(s.name ? { name: s.name } : {}), ...(s.pronouns ? { pronouns: s.pronouns } : {}), zone: zoneById(state, s.zone)?.name ?? '', ...(s.distanceM !== undefined ? { distanceM: Math.round(s.distanceM) } : {}), ...(s.side ? { side: s.side } : {}), ...(s.health ? { health: s.health } : {}), ...(s.morale ? { morale: s.morale } : {}), ...(s.activityLook ? { activityLook: s.activityLook } : {}), ...(s.age ? { age: s.age } : {}), ...(s.tended ? { tended: s.tended } : {}) })),
    facts: factsFor(state, p.placeId, seen.filter((s) => s.level === 'full').map((s) => s.id)),
    headlines: headlinesFor(state, p.placeId, false),
    // growth proposal 2.7/EG11 b: essences offered this turn, as the character feels them (never numbers or grades)
    ...((offered) => offered.length ? { essences: offered } : {})((p.progression?.essenceOffers ?? []).filter((o) => o.turn === state.turn)
      .map((o) => ({ name: getLibrary().essences?.[o.essence]?.name ?? o.essence, story: getLibrary().essences?.[o.essence]?.story ?? '' }))),
    // essences that appeared this turn and failed their quality roll: they show, then fade
    ...(comings.size ? { cameAndWent: cameAndWent(state, me, comings) } : {}),
    ...((gone) => gone.length ? { notThere: gone } : {})(notThere(state, intent, seenIds)),
    ...((w) => w ? { stayedPut: w } : {})(stayedPut(state, events, intent)),
    ...((faded) => faded.length ? { essencesFaded: faded } : {})(state.log.filter((l) => l.turn === state.turn && l.code === 'essence_faded')
      .map((l) => String((l.detail as { essence?: string } | undefined)?.essence ?? ''))
      .map((id) => ({ name: getLibrary().essences?.[id]?.name ?? id, story: getLibrary().essences?.[id]?.story ?? '' }))),
  };
}

/** BG-164: people this turn's words, action or walk were for, who are not where the player last saw them (seen empty):
 * by name, with where that was */
function notThere(state: GameState, intent: Intent | null | undefined, seenIds: Set<string>): string[] {
  const named = (id: string) => { const a = actorById(state, id), n = a && (nameFor(state, state.player, a) ?? a.label); return !!n && (intent?.deferred ?? []).some((d) => mentions(d, n)); };
  // BG-171: someone the player meant to go to, put off by the Parser (deferred, by the name they know), counts too
  const ids = new Set([intent?.action?.target, intent?.move?.spot?.near, ...(intent?.addressees ?? []), ...Object.keys(state.player.journal?.lastKnown ?? {}).filter(named)].filter((x): x is string => !!x));
  return [...ids].flatMap((id) => {
    const a = actorById(state, id), zone = state.player.journal?.lastKnown?.[id];
    if (!a || seenIds.has(id) || !zone || !goneFromSpot(state, id)) return [];
    return [`${nameFor(state, state.player, a) ?? a.label}, last seen in ${zoneById(state, zone)?.name ?? zone}`];
  });
}

/** BG-174: a move in the player's own zone that took no step, nothing stopping it: they already stand there ("on the
 * east side of Mill Lane"), so the story says so instead of a silent wait */
function stayedPut(state: GameState, events: GameEvent[], intent: Intent | null | undefined): string | undefined {
  const m = intent?.move, p = state.player;
  if (!m || m.toZone !== p.zone || events.some((e) => e.actorId === p.id && ['move', 'wasted', 'way', 'travel'].includes(e.kind))) return undefined;
  const at = m.spot ? spotPoint(state, m.toZone, m.spot, p)?.words : undefined;
  return `${at ?? 'in'} ${zoneById(state, p.zone)?.name ?? p.zone}`.trim();
}

/** BF2e: one leg of a long turn as noticed: where they went (seen), or only that someone moved off (heard) */
function legWords(state: GameState, e: GameEvent, full: boolean): string {
  const to = zoneById(state, e.zone)?.name ?? e.zone;
  if (!full) return 'moved about, heard but not seen';
  return e.fromZone ? `went from ${zoneById(state, e.fromZone)?.name ?? e.fromZone} into ${to}` : `crossed ${to} toward ${zoneById(state, e.heading ?? '')?.name ?? 'the way out'}`;
}
/** BF2e3/BF2e4: one line per person noticed, legs in order, up to LONG_TURN_LINES; the rest "others came and went" */
function cameAndWent(state: GameState, me: string, comings: Map<string, string[]>): string[] {
  const lines = [...comings].map(([id, legs]) => `${legs.every((l) => l.startsWith('moved about')) ? 'someone' : callName(state, me, id)} ${[...new Set(legs)].join(', then ')}`);
  const n = CONFIG.LONG_TURN_LINES;
  return lines.length > n ? [...lines.slice(0, n), 'others came and went'] : lines;
}

// ---------- WeaverView ----------
/** SC8: the running scenario, as the check-in sees it: its question, endings, and how much of its budget is used */
function checkinScenario(state: GameState, f: ScenarioFrame): NonNullable<WeaverView['target']['scenario']> {
  const c = CONFIG.SCENARIO_SCALE[f.scale];
  return {
    question: f.question, scale: SCENARIO_SCALES.name(f.scale), endings: f.endings.map((e) => ({ when: e.when, as: e.as, text: e.text })),
    turns: state.turn - f.startTurn, budget: c?.budgetMin ? `${spanText(c.budgetMin)} of game time` : '?',
    used: Math.round(budgetUsed(state, f) * 100) / 100, overTime: budgetUsed(state, f) >= 1,
    happened: (f.happened ?? []).map((h) => ({ ...h })),
    remembered: state.actors.filter((a) => state.stage.zoneIds.includes(a.zone)).flatMap((a) =>
      (state.hidden.memory[a.id] ?? []).filter((m) => m.turn >= f.startTurn).map((m) => ({ who: a.id, turn: m.turn, text: m.text }))),
  };
}
/** SD3–SD5, BA2: what was done at a barrier, or (CT3) at a container's lock, for the Narrator */
function wayWords(state: GameState, w: NonNullable<GameEvent['way']>): NonNullable<NarrationEvent['way']> {
  const box = !w.barrier ? itemName(state, w.to) : undefined;
  return { what: w.barrier ? barrierName(state.barriers![w.barrier]) : box ? `${box}'s lock` : 'way', did: WAY_WORDS[w.did], to: box ?? zoneById(state, w.to)?.name ?? w.to };
}
/** SD3–SD5, BA2: what was done at a barrier, for the Narrator */
const WAY_WORDS: Record<WayDid, string> = {
  unlocked: 'unlocked it with a key on the way through', unbarred: 'slid its bar back on the way through',
  found_locked: 'tried it: locked', found_barred: 'tried it: barred from the other side', found_blocked: 'blocked: no way through',
  lock: 'locked it with a key', unlock: 'unlocked it with a key', bar: 'slid its bar across', unbar: 'slid its bar back',
  open: 'opened it and left it standing open', shut: 'shut it',
  picked: 'picked the lock: it opens', picking: 'working at the lock, not open yet', not_yet: 'working at the lock: not yet',
  beyond: 'the lock is beyond them for now', pick_broke: 'the pick snapped in the lock',
  found_open: 'checked it: nothing locks it, it opens freely', found_opens: 'checked it: shut, but they can open it (their key, or the bolt on their side)',
};

/** BA8 (SD3): how the tier leans the ways in and out, never a limit. A tier past Critical reads its end row for now (the
 * extra lean past Critical is parked, D-216). The GM view counts barriers per tier so the lean can be checked. */
const WAYS_LEAN: Record<Tier, string> = {
  critical_failure: 'Ways out lean toward locked, barred or guarded, at major or extreme grades, and pursuers chase far.',
  failure: 'Ways out lean toward locked, barred or guarded, at major or extreme grades, and pursuers chase far.',
  near_miss: 'A way or two shut, around moderate.',
  success: 'Ways mostly open, minor at most.',
  great_success: 'Open ways, and a guard who looks away.',
  critical_success: 'Open ways, and a guard who looks away.',
};

const STAKES: Record<Tier, string> = {
  critical_failure: 'A real challenge with little gain; the harder of the two',
  failure: 'A real challenge with little gain',
  near_miss: 'A fair event tilted slightly against the player: gain a step below the challenge',
  success: 'A normal event, gain matched to challenge',
  great_success: 'Good fortune: a windfall or a chance worth taking, with little challenge',
  critical_success: 'The best of luck: the biggest gain, found inside a challenge as hard as a Critical Failure brings. The opportunity in the danger sets it apart, not a milder danger',
};

const placeName = (state: GameState, id: string) => state.places.find((p) => p.id === id)?.names.current ?? id;

/** NW6: the stage sorted by place, in stage order: each place named, with its parent, its areas and
 * the people standing in them. Nobody is left out; the sorting is what keeps the Weaver on the right place (the test
 * on 12/11 lost the thread with two flat lists). */
function weaverPlaces(state: GameState, onStage: Actor[]): WeaverView['places'] {
  const out = new Map<string, WeaverView['places'][number]>();
  for (const z of stageZones(state)) {
    let e = out.get(z.placeId);
    if (!e) {
      const pl = state.places.find((p) => p.id === z.placeId);
      const parent = pl?.parentId ? { id: pl.parentId, name: placeName(state, pl.parentId) } : null;
      out.set(z.placeId, e = { id: z.placeId, name: pl?.names.current ?? z.placeId, kind: pl?.kind ?? '', parent, areas: [], people: [] });
    }
    e.areas.push(zoneView(state, z));
  }
  for (const a of onStage) {
    const plan = state.hidden.plans[a.id];
    out.get(zoneById(state, a.zone)!.placeId)?.people.push({
      id: a.id, label: a.label, name: a.names.current, zone: a.zone, band: a.bandId,
      ...(a.core.templateId ? { templateId: a.core.templateId } : {}),
      ...(plan ? { plan: { goal: plan.goal, steps: [...plan.steps], triggers: structuredClone(plan.triggers), createdTurn: plan.createdTurn } } : {}),
      secrets: state.hidden.secrets.filter((s) => s.holderId === a.id).map((s) => ({ id: s.id, holderId: s.holderId, fact: s.fact, leakTerms: [...s.leakTerms], revealWhen: { ...s.revealWhen } })),
    });
  }
  return [...out.values()];
}

export type WeaverTarget = Omit<WeaverView['target'], 'placeName'>;
export function buildWeaverView(state: GameState, target: WeaverTarget): WeaverView {
  const lib = getLibrary();
  const stage = new Set(state.stage.zoneIds);
  const onStage = state.actors.filter((a) => stage.has(a.zone));
  const bandIds = new Set([state.player.bandId, ...onStage.map((a) => a.bandId)]);
  const cur = state.player.core.classes.find((c) => c.state === 'current');
  const bp = (kind: string) => state.blueprints.filter((b) => b.kind === kind);
  const templates = new Map<string, { id: string; label: string; raceId: string; classId?: string }>(Object.values(lib.templates).map((t) => [t.id, { id: t.id, label: t.label, raceId: t.raceId, ...(t.classId ? { classId: t.classId } : {}) }]));
  for (const b of bp('npcTemplate')) templates.set(b.id, { id: b.id, label: String(b.data.label ?? ''), raceId: String(b.data.raceId ?? '') });
  const worth = (i: ItemDef) => i.boon ?? itemValue(state, i) / CONFIG.BOON_COIN; // loot V8
  // D-220: the Weaver placing Threadbound items is parked, so they stay out of its catalog
  const box = (i: ItemDef) => (i.container ? { container: i.container.worn ? 'worn' : i.container.fixed ? 'fixed' : 'carried' } : {}); // CT2
  const items = new Map<string, { id: string; name: string; kind: string; boon: number; container?: string }>(Object.values(lib.items).filter((i) => !i.threadbound).map((i) => [i.id, { id: i.id, name: i.name, kind: i.kind, boon: worth(i), ...box(i) }]));
  for (const b of bp('item')) items.set(b.id, { id: b.id, name: String(b.data.name ?? ''), kind: String(b.data.kind ?? ''), boon: worth(itemDef(state, b.id)) });
  return {
    tier: tierName({ tier: state.stage.tier, ...(state.stage.tierBeyond ? { beyond: state.stage.tierBeyond } : {}) }),
    time: clockSet(state) ? timeView(state) : null,
    ways: WAYS_LEAN[state.stage.tier] ?? '',
    stakes: (STAKES[state.stage.tier] ?? '') + (state.stage.tierBeyond ? `; beyond Critical by ${Math.abs(state.stage.tierBeyond)}: push it further still, the luck ${state.stage.tierBeyond > 0 ? 'almost unbelievable' : 'cruel to the point of irony'}` : ''),
    target: { kind: target.kind, placeId: target.placeId, placeName: placeName(state, target.placeId), ...(target.label !== undefined ? { label: target.label } : {}), ...(target.frontierKey !== undefined ? { frontierKey: target.frontierKey } : {}), ...(target.wake ? { wake: true as const } : {}), ...(target.ahead ? { ahead: true as const } : {}),
      ...(target.kind === 'checkin' && state.stage.scenario ? { reason: target.reason, scenario: checkinScenario(state, state.stage.scenario) } : {}),
      ...(target.kind === 'scenario' && state.stage.encounter ? { encounter: { zone: state.stage.encounter.zone, danger: zoneById(state, state.stage.encounter.zone)?.danger ?? 'quiet', noticed: state.stage.encounter.noticed } } : {}) },
    headlines: headlinesFor(state, target.placeId, true),
    places: weaverPlaces(state, onStage),
    quests: state.quests.map((q) => ({ id: q.id, state: q.state, text: q.text })),
    flags: { ...state.flags },
    bands: state.bands.filter((b) => bandIds.has(b.id)).map((b) => ({ id: b.id, name: b.name, goals: b.goals, relations: { ...b.relations }, ...(b.chase ? { chase: b.chase } : {}) })),
    player: { level: charLevel(state.player), ...(state.player.pronouns ? { pronouns: state.player.pronouns } : {}), currentClass: cur ? { id: cur.classId, name: lib.classes[cur.classId]?.name ?? cur.classId } : null, health: healthLevel(state.player),
      standsIn: { place: state.player.placeId, placeName: placeName(state, state.player.placeId), area: state.player.zone } },
    previousNote: state.hidden.weaverNote,
    lastScenarios: lastScenarios(state).map((r) => ({ question: r.question, scale: SCENARIO_SCALES.name(r.scale), tier: tierName(r.tier), ending: SCENARIO_ENDING_NAMES[r.ending], note: r.text, turns: r.endTurn - r.startTurn, fallen: [...r.fallen], gained: r.gained.map((i) => lib.items?.[i]?.name ?? i), ...(r.inner ? { inner: true as const } : {}) })),
    ...(state.stage.outer ? { outerScenario: { question: state.stage.outer.question, scale: SCENARIO_SCALES.name(state.stage.outer.scale) } } : {}),
    catalogs: {
      templates: [...templates.values()],
      services: Object.values(lib.services ?? {}).map((s) => ({ id: s.id, name: s.name, price: s.price })),
      bodyTypes: [...Object.values(lib.bodyTypes).map((b) => ({ id: b.id, name: b.name })), ...bp('body_type').filter((b) => !lib.bodyTypes[b.id]).map((b) => ({ id: b.id, name: String(b.data.name ?? b.id) }))],
      races: Object.values(lib.races ?? {}).map((r) => ({ id: r.id, name: r.name })),
      classes: Object.values(lib.classes).map((c) => ({ id: c.id, name: c.name })),
      routineSets: Object.values(lib.routineSets).map((s) => ({
        id: s.id, brief: s.brief, tags: structuredClone(s.tags),
        slots: Object.fromEntries(Object.entries(s.slots).map(([k, v]) => [k, { kind: v.kind, hint: v.hint, ...(v.optional ? { optional: true } : {}) }])),
      })),
      items: [...items.values()],
      skills: Object.keys(lib.skills).map((id) => ({ id, name: skillName(id) })),
      personality: { nerve: Object.keys(NERVE_LINES), types: Object.values(lib.personalityTypes ?? {}).map((t) => ({ id: t.id, name: t.name, hint: t.hint })), values: Object.values(lib.values ?? {}).map((v) => ({ id: v.id, name: v.name })) },
      zoneKinds: Object.values(lib.zoneKinds ?? {}).map((k) => ({ ...k })),
      edgeKinds: Object.values(lib.edgeKinds ?? {}).map((k) => ({ ...k })),
      barrierKinds: Object.values(lib.barrierKinds ?? {}).map((k) => ({ ...k })),
      layouts: Object.values(lib.layouts ?? {}).map((l) => ({ id: l.id, name: l.name, building: l.building, entry: l.entry, zones: l.zones.map((z) => ({ key: z.key, name: z.name })) })),
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
  const nat = actorBody(state, attacker).naturalAttacks;
  const id = weaponId.startsWith('natural:') ? weaponId.slice(8) : modeId;
  const mode = nat.find((m) => m.id === id) ?? nat[0];
  return { mode, weapon: mode?.name ?? null };
}

/** the other side's deciding sources: only lucky/fumble, situational and aim, the weapon used, and gear the viewer can see (no health, wounds, perks or hidden gear) */
function shownDeciding(state: GameState, list: string[], roll: RollResult, rollerId: string, viewerId: string): string[] {
  if (rollerId === viewerId) return [...list];
  const seen = new Set(seenGear(state, need(state, rollerId), revealedTo(need(state, viewerId), rollerId)).map((g) => g.name));
  const type = new Map(roll.modifiers.map((m) => [m.source, m.type]));
  return list.filter((s) => s === 'lucky' || s === 'fumble' || s.startsWith('weapon: ') || type.get(s) === 'situational' || type.get(s) === 'aim' ||
    (s.startsWith('Gear (') && seen.has(s.slice(s.indexOf('): ') + 3))));
}

/** Part 3 packet: no numbers. Others' health above CONFIG.HEALTH_SHOWN_FROM and their Damaged parts stay hidden (Read Wounds
 * aside); the player's own condition is always visible. */
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
  const partName = r.location === 'general' ? actorBody(state, target).general.name : r.location;
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
