// Stage-plan validation (Part 2, Agent Weaver: Validation) and the grades table.
import type { EndCheck, GameState, Grade, StagePlan, Tier, TriggerWhen } from '../types';
import { GRADES, SCENARIO_ENDINGS } from '../types';
import { triggerErrors } from './triggers';
import { scaleFor } from '../engine/scenarioEnd';
import { mentions } from '../words';
import { CONFIG } from '../config';
import { CHASE_RANGES, COVER, GRADE_LEVELS, LIFE_STAGES, QUALITY_LEVELS, LIGHT, SCENARIO_SCALES, STANCES, TACTICS, TIERS, TIME_OF_DAY, ZONE_SIZES, ROAD_LENGTHS, ROAD_DANGERS } from '../scales';
import { qualityOf } from '../ruleset/quality';
import { SIDES } from '../types';
import { clockSet, now, timeOfDay } from '../time';
import { tierName } from '../ruleset';
import { bodyType, race, getLibrary, itemDef, npcTemplate, routineSet } from '../library';
import type { PlanError, PlanContext } from './index';
import { itemValue } from '../ruleset/value';

const BELIEFS = ['unaware', 'suspicious', 'aware'];

const g = (x: Grade) => GRADE_LEVELS.pos(x);

/** gainVsChallenge: for the middle tiers, the gain's grade minus the challenge's, lowest and highest */
type Fit = { challenge: [Grade, Grade]; gain: [Grade, Grade]; gainVsChallenge?: [number, number] };
/** Challenge and gain grades that fit each tier [Proposed scale] (G3: data, not code): lowest and highest grade for each,
 * and for the middle tiers how far the gain sits from the challenge. The Weaver prompt reads this too. The tier sets the
 * balance of gain against challenge, worst to best (ER1, ER2): trouble with little gain; a fair event tilted slightly
 * bad (Near Miss: gain a step below the challenge); a matched one; good fortune (Great Success: major gain, little
 * challenge); the best of it (Critical Success: extreme gain inside the same challenge as Critical Failure, so the opportunity sets
 * it apart, not a milder danger). */
const CRITICAL_CHALLENGE: [Grade, Grade] = ['major', 'extreme'];
export const GRADES_FIT: Record<Tier, Fit> = {
  critical_failure: { challenge: CRITICAL_CHALLENGE, gain: ['none', 'minor'] },
  failure: { challenge: ['moderate', 'extreme'], gain: ['none', 'minor'] },
  near_miss: { challenge: ['minor', 'major'], gain: ['none', 'moderate'], gainVsChallenge: [-1, -1] },
  success: { challenge: ['minor', 'major'], gain: ['none', 'extreme'], gainVsChallenge: [-1, 1] },
  great_success: { challenge: ['none', 'moderate'], gain: ['major', 'major'] },
  critical_success: { challenge: CRITICAL_CHALLENGE, gain: ['extreme', 'extreme'] },
};
const within = (x: number, [lo, hi]: [Grade, Grade]) => x >= g(lo) && x <= g(hi);
export function gradesFitTier(tier: Tier, challenge: Grade, gain: Grade): boolean {
  const c = g(challenge), n = g(gain), fit = GRADES_FIT[tier];
  if (c < 0 || n < 0 || !fit) return false;
  const v = fit.gainVsChallenge;
  return within(c, fit.challenge) && within(n, fit.gain) && (!v || (n - c >= v[0] && n - c <= v[1]));
}
/** GRADES_FIT in words, for the Weaver prompt */
export function gradesFitText(): string {
  const range = ([lo, hi]: [Grade, Grade]) => (lo === hi ? lo : `${lo} to ${hi}`);
  const vs = ([lo, hi]: [number, number]) => (lo === -1 && hi === -1 ? 'one step below it' : lo === -hi ? `within ${hi} step of it` : `${lo} to ${hi} steps from it`);
  return TIERS.keys.map((t) => {
    const f = GRADES_FIT[t];
    return `${TIERS.name(t)} = challenge ${range(f.challenge)}, gain ${f.gainVsChallenge ? vs(f.gainVsChallenge) : range(f.gain)}`;
  }).join('; ');
}

/** frontier ids currently on the stage (links marked frontier) */
export function stageFrontiers(state: GameState): Set<string> {
  const out = new Set<string>();
  for (const z of state.zones) for (const l of z.links) if (l.frontier) out.add(l.to);
  return out;
}

/** trim hidden-only text to NOTE_CAP at a word boundary (V6) */
function trimNote(v: unknown): unknown {
  const cap = CONFIG.NOTE_CAP;
  if (typeof v !== 'string' || v.length <= cap) return v;
  const cut = v.slice(0, cap);
  const sp = cut.lastIndexOf(' ');
  return (sp > cap * 0.6 ? cut.slice(0, sp) : cut).trimEnd();
}

/** Fill in what a plan may leave out, in place, before validation (V4, V5, V6; missing plan steps). Never fills public text. */
/** CO17: a place that names a layout gets the layout's zones, keyed `${placeKey}.${zoneKey}`; runs once per plan */
export function expandLayouts(plan: StagePlan): void {
  const layouts = getLibrary().layouts ?? {};
  for (const p of Array.isArray(plan.places) ? plan.places : []) {
    // the Weaver often names a building's kind (a tavern) and uses its layout's keys (tavern.common) without naming the
    // layout: a place whose kind is a layout's building, and some of whose layout keys the plan uses, gets that layout
    const guess = p && !p.layout ? Object.values(layouts).find((x) => x.building === p.kind) : undefined;
    const text = guess ? JSON.stringify(plan) : '';
    const l = p?.layout ? layouts[p.layout] : guess?.zones.some((z) => text.includes(`"${p.key}.${z.key}"`)) ? guess : undefined;
    if (l && p && !p.layout) p.layout = l.id;
    if (!l || !Array.isArray(plan.zones) || plan.zones.some((z) => z?.key === `${p.key}.${l.entry}`)) continue;
    for (const z of l.zones) plan.zones.push({
      key: `${p.key}.${z.key}`, place: p.key, kind: z.kind, name: p.names?.[z.key] ?? z.name, look: p.looks?.[z.key] ?? z.look,
      ...(z.size ? { size: z.size } : {}), ...(z.edges ? { edges: { ...z.edges } } : {}), fromLayout: true,
      links: z.links.map(([to, label, sight]) => ({ to: `${p.key}.${to}`, label, sight })),
    });
  }
}

export function fillPlanDefaults(plan: StagePlan): void {
  if (!plan || typeof plan !== 'object') return;
  expandLayouts(plan);
  const list = <T>(x: T[] | undefined): T[] => (Array.isArray(x) ? x : []);
  if (plan.event) plan.event.summary = trimNote(plan.event.summary) as string;
  plan.weaverNote = trimNote(plan.weaverNote) as string;
  for (const p of list(plan.places)) if (p && (p.parent === undefined || p.parent === null)) p.parent = '';
  for (const b of list(plan.bands)) if (b) { b.goals = trimNote(b.goals) as string; b.temperament = trimNote(b.temperament) as string; }
  for (const c of list(plan.cast)) if (c) { c.motive = trimNote(c.motive) as string; c.routineGap = trimNote(c.routineGap) as string | undefined; }
  const seeds = plan.seeds;
  if (!seeds) return;
  const trig = (t: StagePlan['seeds']['triggers'][number], owner?: string) => {
    if (!t || typeof t !== 'object') return;
    if (!t.ownerId && owner) t.ownerId = owner;
    if (t.once === undefined || t.once === null) t.once = true;
  };
  for (const p of list(seeds.plans)) {
    if (!p || typeof p !== 'object') continue;
    if (!Array.isArray(p.steps)) p.steps = [];
    p.goal = trimNote(p.goal) as string;
    for (const t of list(p.triggers)) trig(t, p.ownerId);
  }
  for (const t of list(seeds.triggers)) trig(t);
  for (const s of list(seeds.secrets)) {
    if (!s) continue;
    s.fact = trimNote(s.fact) as string;
    // the Weaver writes a tier name; code keeps the key
    if (s.revealWhen?.type === 'check_passed') s.revealWhen.minTier = TIERS.keyOf(s.revealWhen.minTier) ?? s.revealWhen.minTier;
  }
}

export function validateStagePlan(state: GameState, plan: StagePlan, ctx: PlanContext): PlanError[] {
  fillPlanDefaults(plan);
  const errs: PlanError[] = [];
  const seenErr = new Set<string>();
  const err = (code: string, message: string, castKey?: string, routineOnly = false) => {
    if (seenErr.has(message)) return; // one error per field and problem (V12)
    seenErr.add(message);
    errs.push({ code, message, routineOnly, ...(castKey !== undefined ? { castKey } : {}) });
  };

  const P = CONFIG.PLAN_CAPS;
  const cap = CONFIG.TEXT_CAP;
  // T8: the Weaver picks the time only when the story's clock is not set yet; after that it must match the clock
  const current = timeOfDay(now(state));
  if (plan.timeOfDay !== undefined && !TIME_OF_DAY.has(plan.timeOfDay)) err('bad_time', `timeOfDay is ${TIME_OF_DAY.list()}`);
  else if (plan.timeOfDay !== undefined && clockSet(state) && plan.timeOfDay !== current) err('bad_time', `timeOfDay: it is ${TIME_OF_DAY.name(current)} now; leave timeOfDay out`);
  const tod = !clockSet(state) && TIME_OF_DAY.has(plan.timeOfDay) ? plan.timeOfDay : current;
  const arr = <T>(x: T[] | undefined): T[] => (Array.isArray(x) ? x : []);
  const places = arr(plan.places), zones = arr(plan.zones), frontiers = arr(plan.frontiers), bands = arr(plan.bands);
  const cast = arr(plan.cast);
  const seeds = plan.seeds ?? { plans: [], triggers: [], secrets: [] };
  const secrets = arr(seeds.secrets);

  // ---- key sets ----
  const dupes = (kind: string, keys: string[]) => {
    const seen = new Set<string>();
    for (const k of keys) {
      if (!k) err('missing_key', `${kind} without a key`);
      else if (seen.has(k)) err('duplicate_key', `duplicate ${kind} key ${k}`);
      seen.add(k);
    }
    return seen;
  };
  const placeKeys = dupes('place', places.map((p) => p.key));
  const zoneKeys = dupes('zone', zones.map((z) => z.key));
  const frontierKeys = dupes('frontier', frontiers.map((f) => f.key));
  const bandKeys = dupes('band', bands.map((b) => b.key));
  const castKeys = dupes('cast', cast.map((c) => c.key));
  const stageZones = new Set(state.stage.zoneIds);
  const existingFrontiers = stageFrontiers(state);
  const placeIds = new Set(state.places.map((p) => p.id));
  const bandIds = new Set(state.bands.map((b) => b.id));
  const actorIds = new Set([state.player.id, ...state.actors.map((a) => a.id)]);
  const isZone = (r: string) => zoneKeys.has(r) || stageZones.has(r);
  const isFrontier = (r: string) => frontierKeys.has(r) || existingFrontiers.has(r);
  const isBand = (r: string) => bandKeys.has(r) || bandIds.has(r);
  const isActor = (r: string) => castKeys.has(r) || actorIds.has(r);
  const isPlace = (r: string) => placeKeys.has(r) || placeIds.has(r);

  // ---- caps ----
  const counts: [string, number, number][] = [
    ['cast', cast.length, P.cast], ['zones', zones.filter((z) => !z?.fromLayout).length, P.zones], ['frontiers', frontiers.length, P.frontiers],
    ['places', places.length, P.places], ['bands', bands.length, P.bands],
  ];
  for (const [what, n, max] of counts) if (n > max) err('cap_exceeded', `${what}: ${n} > ${max}`);

  // ---- grades ----
  const ev = plan.event;
  if (ctx.kind === 'checkin') { /* SC12: a check-in keeps the scenario's grades */ }
  else if (!ev || !GRADES.includes(ev.challenge) || !GRADES.includes(ev.gain)) err('bad_grade', 'event needs challenge and gain grades');
  else if (!gradesFitTier(ctx.tier, ev.challenge, ev.gain))
    err('grades_misfit', `challenge ${ev.challenge} / gain ${ev.gain} does not fit tier ${tierName(ctx.tier)}`);

  // ---- text: caps for every free-text field; public fields scanned for hidden and leak terms ----
  const terms = [...arr(plan.hiddenTerms), ...secrets.flatMap((s) => arr(s.leakTerms))].filter((t) => typeof t === 'string' && t.trim());
  const text = (where: string, v: unknown, pub: boolean, castKey?: string) => {
    if (v === undefined || v === null) return;
    if (typeof v !== 'string') return err('bad_text', `${where} is not text`, castKey);
    if (!pub) return; // hidden-only notes were trimmed to NOTE_CAP by fillPlanDefaults
    if (v.length > cap) err('text_too_long', `${where}: ${v.length} > ${cap} chars`, castKey);
    // whole words, as the narration check matches (V10)
    for (const t of terms) if (mentions(v, t)) err('public_leak', `${where} contains hidden term "${t}"` +
      (where.includes(' knows ') ? '; knows is public, so a secret goes in seeds.secrets' : ''), castKey);
  };
  // keys become ids the player-side agents see (Q2): scanned like public text, with _ and - read as spaces
  const keyScan = (kind: string, k: unknown, castKey?: string) => {
    if (typeof k !== 'string') return;
    const words = k.replace(/[_-]+/g, ' ');
    for (const t of terms) if (mentions(words, t)) err('public_leak', `${kind} key ${k} contains hidden term "${t}"`, castKey);
  };
  for (const [kind, list] of [['place', places], ['zone', zones], ['frontier', frontiers], ['band', bands]] as const) for (const x of list) keyScan(kind, x.key);
  for (const c of cast) if (c.actor === undefined) keyScan('cast', c.key, c.key);
  text('event.summary', ev?.summary, false);
  text('weaverNote', plan.weaverNote, false);
  for (const p of places) {
    text(`place ${p.key} name`, p.name, true);
    // GAP: a root place may give parent '' (the type has no null); anything else must resolve.
    if (p.parent && !isPlace(p.parent)) err('unresolved_place', `place ${p.key}: parent ${p.parent} unknown`);
    const lays = getLibrary().layouts ?? {};
    if (p.layout !== undefined && !lays[p.layout]) err('bad_place', `place ${p.key}: layout is a layout id from catalogs.layouts (${Object.values(lays).map((l) => `${l.id} ${l.name}`).join(', ')})`);
  }
  for (const f of frontiers) text(`frontier ${f.key} label`, f.label, true);

  // ---- zones and links ----
  // NW4: every zone or frontier a plan zone touches, both ways (links run both ways once applied); an extension's
  // entry (its first zone) also touches the zones whose links led into the crossed frontier
  const neighbours = (key: string) => {
    const n = new Set<string>();
    const z = zones.find((x) => x.key === key);
    for (const l of arr(z?.links)) if (l.to !== key) n.add(l.to);
    for (const o of zones) if (o.key !== key && arr(o.links).some((l) => l.to === key)) n.add(o.key);
    for (const o of state.zones) if (o.links.some((l) => !l.frontier && l.to === key)) n.add(o.id);
    if (ctx.frontierKey && zones[0]?.key === key) for (const o of state.zones) if (o.links.some((l) => l.frontier && l.to === ctx.frontierKey)) n.add(o.id);
    return n;
  };
  for (const z of zones) {
    text(`zone ${z.key} name`, z.name, true);
    text(`zone ${z.key} look`, z.look, true);
    if (!isPlace(z.place)) err('unresolved_place', `zone ${z.key}: place ${z.place} unknown`);
    const kinds = Object.values(getLibrary().zoneKinds ?? {});
    if (!kinds.some((k) => k.id === z.kind)) err('bad_zone', `zone ${z.key}: kind is one of ${kinds.map((k) => `${k.id} (${k.name})`).join(', ')}`);
    if (z.height !== undefined && (typeof z.height !== 'number' || !Number.isFinite(z.height) || Math.abs(z.height) > 500)) err('bad_zone', `zone ${z.key}: height is metres above the ground, a number from -500 to 500`);
    if (z.size !== undefined && !ZONE_SIZES.has(z.size)) err('bad_zone', `zone ${z.key}: size is ${ZONE_SIZES.list()}`);
    const road = getLibrary().zoneKinds?.[z.kind]?.road;
    // BG-141: a length or danger on a zone that is not a road kind is dropped (a repair), never the whole plan
    if (!road && (z.length !== undefined || z.danger !== undefined)) {
      delete z.length; delete z.danger;
      errs.push({ code: 'road_fields_dropped', message: `zone ${z.key}: not a road kind, so its length and danger were dropped`, routineOnly: false, repaired: true });
    }
    if (z.length !== undefined && !(ROAD_LENGTHS.has(z.length) || (typeof z.length === 'number' && Number.isFinite(z.length) && z.length >= 0.1 && z.length <= 500))) err('bad_zone', `zone ${z.key}: a road's length is ${ROAD_LENGTHS.list()}, or km from 0.1 to 500`);
    if (z.danger !== undefined && !ROAD_DANGERS.has(z.danger)) err('bad_zone', `zone ${z.key}: a road's danger is ${ROAD_DANGERS.list()}`);
    if (z.area !== undefined && (typeof z.area !== 'number' || !Number.isFinite(z.area) || z.area < 1 || z.area > 1e6)) err('bad_zone', `zone ${z.key}: area is m², a number from 1 to 1000000`);
    const edgeKinds = getLibrary().edgeKinds ?? {};
    for (const [side, ek] of Object.entries(z.edges ?? {})) {
      if (!SIDES.includes(side as never) || !edgeKinds[ek as string]) err('bad_zone', `zone ${z.key}: edges are n, e, s or w, each an edge kind id from catalogs.edgeKinds (${Object.values(edgeKinds).map((k) => `${k.id} ${k.name}`).join(', ')})`);
    }
    if ((z.cover !== undefined && !COVER.has(z.cover)) || (z.light !== undefined && !LIGHT.has(z.light))) err('bad_zone', `zone ${z.key}: light is ${LIGHT.list()}; cover is ${COVER.list()}`);
    // NW4: an onward kind (a street, square, gate, field, woods or road) links somewhere besides the way in
    if (getLibrary().zoneKinds?.[z.kind]?.onward && !z.fromLayout && neighbours(z.key).size < 2)
      err('dead_end', `zone ${z.key}: a ${getLibrary().zoneKinds?.[z.kind]?.name.toLowerCase()} leads onward: besides the way in, link it to another zone or a frontier`);
    for (const l of arr(z.links)) {
      text(`zone ${z.key} link label`, l.label, true);
      if (!isZone(l.to) && !isFrontier(l.to)) err('bad_link', `zone ${z.key}: link to ${l.to} is not a zone in the plan, on the stage, or a frontier`);
      // SD3–SD5: a barrier on the way
      const b = l.barrier;
      if (b) {
        const bks = getLibrary().barrierKinds ?? {}, k = bks[b.kind];
        if (!k) err('bad_link', `zone ${z.key}: a barrier's kind is a barrier kind id from catalogs.barrierKinds (${Object.values(bks).map((x) => `${x.id} ${x.name}`).join(', ')})`);
        else {
          if (b.locked && !k.lock) err('bad_link', `zone ${z.key}: ${k.name} takes no lock`);
          if (b.barredFrom !== undefined && !k.bar) err('bad_link', `zone ${z.key}: ${k.name} takes no bar`);
        }
        if (b.barredFrom !== undefined && b.barredFrom !== z.key && b.barredFrom !== l.to) err('bad_link', `zone ${z.key}: barredFrom is the zone the bolt is on: ${z.key} or ${l.to}`);
        if (l.drop || isFrontier(l.to)) err('bad_link', `zone ${z.key}: a barrier goes on a way between two zones, never on a drop or a frontier`);
        for (const key of arr(b.keys)) if (!isActor(key)) err('bad_link', `zone ${z.key}: key holder ${key} is not in the cast or on the stage`);
      }
    }
  }

  // ---- bands ----
  for (const b of bands) {
    text(`band ${b.key} name`, b.name, true);
    text(`band ${b.key} goals`, b.goals, false);
    text(`band ${b.key} temperament`, b.temperament, false);
    if (!TACTICS.has(b.tactics)) err('bad_band', `band ${b.key}: tactics is ${TACTICS.list()}`);
    if (b.lethal !== undefined && typeof b.lethal !== 'boolean') err('bad_band', `band ${b.key}: lethal is true or false`);
    if (b.chase !== undefined && !CHASE_RANGES.has(b.chase)) err('bad_band', `band ${b.key}: chase is ${CHASE_RANGES.list()}`); // CH5
    for (const [other, st] of Object.entries(b.relations ?? {})) {
      if (!isBand(other)) err('unresolved_band', `band ${b.key}: relation to unknown band ${other}`);
      if (!STANCES.has(st)) err('bad_stance', `band ${b.key}: relation ${st}`);
    }
  }

  // ---- cast ----
  const lib = getLibrary();
  const playerBand = state.player.bandId;
  // zone graph for reachability: plan links plus stage links, undirected (apply adds back-links into the stage)
  // GAP: reachability treats links as two-way; the spec does not say whether a one-way link counts.
  const adj = new Map<string, Set<string>>();
  const edge = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  for (const z of zones) for (const l of arr(z.links)) if (isZone(l.to)) edge(z.key, l.to);
  for (const z of state.zones) for (const l of z.links) if (!l.frontier && stageZones.has(l.to)) edge(z.id, l.to);
  const reach = (from: string) => {
    const seen = new Set([from]);
    const q = [from];
    while (q.length) for (const n of adj.get(q.shift()!) ?? []) if (!seen.has(n)) (seen.add(n), q.push(n));
    return seen;
  };

  for (const c of cast) {
    const k = c.key;
    text(`cast ${k} label`, c.label, true, k);
    text(`cast ${k} name`, c.name, true, k);
    text(`cast ${k} appearance`, c.appearance, true, k);
    text(`cast ${k} motive`, c.motive, false, k);
    text(`cast ${k} routineGap`, c.routineGap, false, k);
    const knows = arr(c.knows);
    if (knows.length > P.knows) err('cap_exceeded', `cast ${k}: knows ${knows.length} > ${P.knows}`, k);
    for (const f of knows) text(`cast ${k} knows ${f.id}`, f.text, true, k);

    if (c.template !== undefined && c.actor !== undefined) err('bad_cast', `cast ${k}: template or actor, not both`, k);
    else if (c.actor !== undefined) {
      if (!actorIds.has(c.actor) || c.actor === state.player.id) err('unresolved_actor', `cast ${k}: actor ${c.actor} unknown`, k);
    } else if (c.template === undefined) err('bad_cast', `cast ${k}: names no template or actor`, k);
    else {
      let tpl;
      try { tpl = npcTemplate(state, c.template); } catch { err('unknown_template', `cast ${k}: template ${c.template} unknown; known: ${Object.keys(lib.templates).join(', ')}`, k); }
      if (tpl) {
        try { bodyType(state, race(tpl.raceId).bodyTypeId); } catch {
          err('unknown_body_type', `cast ${k}: race ${tpl.raceId} or its body type unknown; known races: ${Object.values(lib.races ?? {}).map((r) => `${r.id} (${r.name})`).join(', ')}`, k);
        }
        // AG14: a life stage the race has; an ageless race takes none
        if (c.age !== undefined && (!LIFE_STAGES.keyOf(c.age) || !lib.races?.[tpl.raceId]?.ageStages))
          err('bad_age', `cast ${k}: age is a life stage, ${LIFE_STAGES.list()}, and only for a race that ages`, k);
      }
    }
    if (!c.band) err('missing_band', `cast ${k}: names no band`, k);
    else if (!isBand(c.band)) err('unresolved_band', `cast ${k}: band ${c.band} unknown`, k);
    if (!BELIEFS.includes(c.awarenessOfPlayer)) err('bad_belief', `cast ${k}: awarenessOfPlayer is ${BELIEFS.join(', ')}`, k);
    for (const b of arr(c.awarenessOfBands)) {
      if (!isBand(b.band)) err('unresolved_band', `cast ${k}: awarenessOfBands names unknown band ${b.band}`, k);
      if (!BELIEFS.includes(b.awareness)) err('bad_belief', `cast ${k}: awareness ${b.awareness} is not ${BELIEFS.join(', ')}`, k);
    }
    for (const o of arr(c.overrides)) {
      if (!isActor(o.actor)) err('unresolved_actor', `cast ${k}: override for unknown actor ${o.actor}`, k);
      if (!STANCES.has(o.stance)) err('bad_stance', `cast ${k}: override stance ${o.stance}`, k);
    }

    // ---- routine errors (routineOnly) ----
    const rerr = (code: string, message: string) => err(code, message, k, true);
    const set = routineSet(c.routineSetId);
    const slots = c.slots ?? {};
    if (!set) { rerr('unresolved_set', `cast ${k}: routine set ${c.routineSetId} unknown`); continue; }
    // T3b: the set's time tags must fit the time of day (sleepers at night)
    const tags: string[] = set.tags.time?.length ? set.tags.time : ['any'];
    if (!tags.includes('any') && !tags.some((t) => CONFIG.TIME_TAGS[tod]?.includes(t))) rerr('wrong_time', `cast ${k}: routine set ${c.routineSetId} is for ${tags.join('/')}; it is ${TIME_OF_DAY.name(tod)}`);
    if (c.band === playerBand) {
      // GAP: a player-band entry with the wrong set or bound slots is read as a routine error (it degrades to idle_here).
      if (c.routineSetId !== 'companion') rerr('companion_set', `cast ${k}: a player-band entry uses the companion set`);
      if (Object.keys(slots).length) rerr('invalid_slot', `cast ${k}: a player-band entry binds no slots`);
    }
    for (const s of Object.keys(slots)) if (!set.slots[s]) rerr('invalid_slot', `cast ${k}: slot ${s} is not in set ${set.id}`);
    const bound: string[] = [];
    for (const [s, def] of Object.entries(set.slots)) {
      const v = slots[s];
      if (v === undefined) { if (!def.optional) rerr('missing_slot', `cast ${k}: slot ${s} is not bound`); continue; }
      const list = def.kind === 'zone' ? (typeof v === 'string' ? [v] : null) : Array.isArray(v) ? v : null;
      if (!list) { rerr('invalid_slot', `cast ${k}: slot ${s} binds ${def.kind === 'zone' ? 'one zone' : 'a list of zones'}`); continue; }
      // a one-zone route means the actor stays there (V9)
      if (def.kind === 'route' && (list.length < 1 || list.length > CONFIG.MAX_ROUTE_ZONES))
        rerr('invalid_slot', `cast ${k}: route slot ${s} binds 1 to ${CONFIG.MAX_ROUTE_ZONES} zones`);
      for (const z of list) {
        if (isFrontier(z) && !isZone(z)) rerr('frontier_binding', `cast ${k}: slot ${s} is bound to frontier ${z}`);
        else if (!isZone(z)) rerr('invalid_slot', `cast ${k}: slot ${s} is bound to unknown zone ${z}`);
        else bound.push(z);
      }
    }
    if (c.startAt !== undefined && !set.slots[c.startAt]) rerr('bad_start_at', `cast ${k}: startAt ${c.startAt} is not a slot of ${set.id}`);
    const uniq = [...new Set(bound)];
    if (uniq.length > 1) {
      const r = reach(uniq[0]);
      for (const z of uniq.slice(1)) if (!r.has(z)) rerr('unreachable_zone', `cast ${k}: bound zone ${z} is unreachable from ${uniq[0]}`);
    }
  }

  // ---- seeds ----
  const refs = { isZone, isActor };
  const checkTrigger = (where: string, t: StagePlan['seeds']['triggers'][number]) => {
    for (const m of triggerErrors(state, t, refs, where)) err('bad_trigger', m);
    if (t && t.id && typeof t.once !== 'boolean') err('bad_trigger', `trigger ${t.id}: once is true or false`); // tidy() fills it in
  };
  for (const p of arr(seeds.plans)) {
    if (!isActor(p.ownerId)) err('unresolved_actor', `plan owner ${p.ownerId} unknown`);
    if (!arr(p.steps).every((x) => typeof x === 'string')) err('bad_plan', `plan ${p.ownerId}: steps is a list of short phrases`);
    text(`plan ${p.ownerId} goal`, p.goal, false);
    for (const t of arr(p.triggers)) checkTrigger(`plan ${p.ownerId}`, t);
  }
  for (const t of arr(seeds.triggers)) checkTrigger('seeds.triggers', t);
  if (ctx.wake && !zones.length) err('wake_needs_zone', 'the player wakes somewhere safe: plan at least one new zone; the first one is where they wake');
  if (ctx.arrive && !zones.length) err('arrive_needs_zone', 'a new character arrives: plan at least one new zone; the first one is where they arrive');
  for (const [i, sp] of arr(plan.spars).entries()) {
    const ids = arr(sp.sides).flatMap((x) => arr(x));
    if (arr(sp.sides).length < 2 || arr(sp.sides).some((x) => !arr(x).length)) err('bad_spar', `spar ${i}: needs two sides or more, none empty`);
    else if (new Set(ids).size !== ids.length) err('bad_spar', `spar ${i}: a fighter is on two sides`);
    for (const id of ids) if (!isActor(id)) err('unresolved_actor', `spar ${i}: fighter ${id} unknown`);
  }
  for (const s of secrets) {
    if (!arr(s.leakTerms).length) err('secret_without_leak_terms', `secret ${s.id}: needs leakTerms`);
    if (!isActor(s.holderId)) err('unresolved_actor', `secret ${s.id}: holder ${s.holderId} unknown`);
    text(`secret ${s.id} fact`, s.fact, false);
    const r = s.revealWhen;
    if (r?.type === 'event_in_zone' && !isZone(r.zone)) err('bad_secret', `secret ${s.id}: zone ${r.zone} unknown`);
    else if (r?.type === 'check_passed' && !isActor(r.againstActorId)) err('bad_secret', `secret ${s.id}: actor ${r.againstActorId} unknown`);
    else if (r?.type === 'check_passed' && !lib.skills[r.skill]) err('bad_secret', `secret ${s.id}: skill ${r.skill} unknown; known: ${Object.keys(lib.skills).join(', ')}`);
    else if (r?.type === 'check_passed' && !TIERS.has(r.minTier)) err('bad_secret', `secret ${s.id}: minTier must be one of ${TIERS.list()}`);
    else if (r?.type !== 'event_in_zone' && r?.type !== 'check_passed') err('bad_secret', `secret ${s.id}: revealWhen unknown`);
  }

  // ---- SC1/SC2/SC3/SC7: a new scenario's question, scale and endings ----
  if (ctx.kind === 'scenario' || (ctx.kind === 'checkin' && plan.scenario)) {
    // degradable: after the repair retry, a plan whose scenario is still wrong is applied with the bad endings dropped
    const serr = (code: string, message: string) => err(code, message, undefined, true);
    const sc = plan.scenario;
    if (!sc || typeof sc !== 'object') serr('scenario_missing', `scenario: give the scenario's question, scale and ${CONFIG.SCENARIO_ENDINGS_MIN} to ${CONFIG.SCENARIO_ENDINGS_MAX} endings`);
    else {
      if (typeof sc.question !== 'string' || !sc.question.trim()) serr('scenario_question', 'scenario.question: one line, the hidden question this scenario turns on');
      const scale = SCENARIO_SCALES.keyOf(sc.scale);
      if (!scale) serr('scenario_scale', `scenario.scale must be one of ${SCENARIO_SCALES.list()}`);
      else {
        // SC3: the plan must fit its scale's space; code raises the scale to fit (a repair note, never blocking)
        const fit = scaleFor(new Set(zones.map((z) => z?.place)).size, scale); // places that hold zones in this plan
        if (fit !== scale) errs.push({ code: 'scenario_scale_raised', message: `scenario.scale ${scale} holds at most ${CONFIG.SCENARIO_SCALE[scale].places} place(s) with zones; raised to ${fit}`, routineOnly: false, repaired: true });
        sc.scale = fit;
      }
      const ends = arr(sc.endings);
      if (ends.length < CONFIG.SCENARIO_ENDINGS_MIN || ends.length > CONFIG.SCENARIO_ENDINGS_MAX) serr('scenario_endings', `scenario.endings: ${CONFIG.SCENARIO_ENDINGS_MIN} to ${CONFIG.SCENARIO_ENDINGS_MAX}, got ${ends.length}`);
      ends.forEach((e, i) => {
        const at = `scenario.endings ${i}`;
        if (!e || typeof e !== 'object') { serr('scenario_ending', `${at}: not an ending`); return; }
        if (!PLAN_ENDINGS.includes(e.as as never)) serr('scenario_ending', `${at}: as must be one of ${PLAN_ENDINGS.join(', ')}`);
        text(`${at} text`, e.text, false);
        const w = e.when as EndCheck | undefined;
        switch (w?.kind) {
          case 'band_out': if (!isBand(w.band)) serr('scenario_ending', `${at}: band ${w.band} unknown`); break;
          case 'reach': case 'leave': if (!isPlace(w.place) && !isZone(w.place)) serr('scenario_ending', `${at}: place ${w.place} unknown`); break;
          case 'find': if (!isActor(w.actor)) serr('scenario_ending', `${at}: actor ${w.actor} unknown`); break;
          case 'hold': if (!lib.items?.[w.item]) serr('scenario_ending', `${at}: item ${w.item} unknown`); break;
          case 'deliver': if (!lib.items?.[w.item]) serr('scenario_ending', `${at}: item ${w.item} unknown`); else if (!isActor(w.to)) serr('scenario_ending', `${at}: actor ${w.to} unknown`); break;
          case 'time': if (!TIME_OF_DAY.keyOf(w.at)) serr('scenario_ending', `${at}: time must be one of ${TIME_OF_DAY.list()}`); break;
          case 'judged': break;
          default: serr('scenario_ending', `${at}: when.kind must be one of band_out, reach, leave, find, hold, deliver, time, judged`);
        }
      });
    }
  }

  // ---- rewards: repaired, never blocking (loot L1) ----
  errs.push(...tidyContainers(state, plan).notes, ...tidyRewards(state, plan).notes);

  return errs;
}

/** SC10: the endings a plan may name; worn out and broken off are code's own */
const PLAN_ENDINGS = SCENARIO_ENDINGS.filter((e) => e !== 'worn_out' && e !== 'broken_off');

type Reward = StagePlan['rewards'][number];
type PlanContainer = NonNullable<StagePlan['containers']>[number];

/** CT2: a bad container is dropped, never fails the plan (as rewards, L1): it needs a new key, a container item, a known
 * place (a fixed one, such as a chest, only in a zone), a known owner, a lock grade and key holders that exist */
export function tidyContainers(state: GameState, plan: StagePlan): { containers: PlanContainer[]; notes: PlanError[] } {
  const notes: PlanError[] = [];
  const note = (code: string, message: string) => notes.push({ code, message, routineOnly: false, repaired: true });
  const arr = <T>(x: T[] | undefined): T[] => (Array.isArray(x) ? x : []);
  const who = new Set([...arr(plan.cast).map((c) => c.key), ...state.actors.map((a) => a.id)]);
  const zones = new Set([...arr(plan.zones).map((z) => z.key), ...state.stage.zoneIds]);
  const keys = new Set<string>();
  const containers: PlanContainer[] = [];
  arr(plan.containers).forEach((c, i) => {
    const where = `container ${i}`;
    let def;
    try { def = typeof c?.item === 'string' ? itemDef(state, c.item) : undefined; } catch { def = undefined; }
    const pl = c?.place as { carriedBy?: string; groundIn?: string } | undefined;
    const why = typeof c?.key !== 'string' || !c.key || keys.has(c.key) ? 'needs a key of its own'
      : !def?.container ? `item ${c.item} is not a container`
      : pl?.carriedBy !== undefined && !who.has(pl.carriedBy) ? `carriedBy ${pl.carriedBy} unknown`
      : pl?.carriedBy !== undefined && def.container.fixed ? `a ${def.name} can't be carried`
      : pl?.carriedBy === undefined && (pl?.groundIn === undefined || !zones.has(pl.groundIn)) ? 'needs a known carriedBy or groundIn'
      : c.owner !== undefined && !who.has(c.owner) ? `owner ${c.owner} unknown`
      : c.locked && c.locked.grade !== undefined && !GRADES.includes(c.locked.grade) ? `locked.grade must be one of ${GRADES.join(', ')}`
      : arr(c.locked?.keys).find((k) => !who.has(k)) ? `key holder ${arr(c.locked?.keys).find((k) => !who.has(k))} unknown` : '';
    if (why) return note('container_dropped', `${where}: ${why}`);
    keys.add(c.key);
    containers.push(c);
  });
  return { containers, notes };
}

/** Loot V8: a reward's Boon = the item's boon (or its value ÷ BOON_COIN, src/ruleset/value.ts) × qty, × BOON_QUALITY for a minted item. */
export function boon(state: GameState, item: Reward['item'], qty = 1): number {
  const def = itemDef(state, typeof item === 'string' ? item : item.base);
  const q = typeof item === 'string' ? 'plain' : item.quality;
  return (def.boon ?? itemValue(state, def) / CONFIG.BOON_COIN) * qty * CONFIG.BOON_QUALITY[q];
}

/**
 * Loot L1: a bad reward is fixed or dropped, never fails the plan. Validation reports each change as a repaired
 * note; the apply step places the tidied list. Same input, same output, so replay matches.
 */
export function tidyRewards(state: GameState, plan: StagePlan): { rewards: Reward[]; notes: PlanError[] } {
  const notes: PlanError[] = [];
  const note = (code: string, message: string) => notes.push({ code, message, routineOnly: false, repaired: true });
  const arr = <T>(x: T[] | undefined): T[] => (Array.isArray(x) ? x : []);
  const castKeys = new Set(arr(plan.cast).map((c) => c.key));
  const zoneKeys = new Set(arr(plan.zones).map((z) => z.key));
  const actorIds = new Set(state.actors.map((a) => a.id));
  const stageZones = new Set(state.stage.zoneIds);
  const terms = [...arr(plan.hiddenTerms), ...arr(plan.seeds?.secrets).flatMap((s) => arr(s.leakTerms))]
    .filter((t) => typeof t === 'string' && t.trim()).map((t) => t.toLowerCase());
  const badText = (v: unknown) => typeof v !== 'string' || v.length > CONFIG.TEXT_CAP || terms.some((t) => v.toLowerCase().includes(t));
  const gain = plan.event?.gain;
  const maxQ = GRADES.includes(gain) ? CONFIG.GAIN_MAX_QUALITY[gain] ?? null : null;
  let mintLeft = CONFIG.SCENARIO_CAPS.minted - state.scenarioCaps.minted;
  let boonLeft = GRADES.includes(gain) ? CONFIG.BOON_BUDGET[gain] ?? 0 : 0; // V8: Boon is the only limit on rewards
  const known = (id: unknown) => { try { return typeof id === 'string' ? itemDef(state, id) : undefined; } catch { return undefined; } };

  const boxes = new Set(tidyContainers(state, plan).containers.map((c) => c.key));
  const rewards: Reward[] = [];
  arr(plan.rewards).forEach((r, i) => {
    const where = `reward ${i}`;
    const pl = r?.place as { carriedBy?: string; groundIn?: string; in?: string } | undefined;
    const placed = pl?.carriedBy !== undefined ? castKeys.has(pl.carriedBy) || actorIds.has(pl.carriedBy)
      : pl?.groundIn !== undefined ? zoneKeys.has(pl.groundIn) || stageZones.has(pl.groundIn) : pl?.in !== undefined && boxes.has(pl.in);
    if (!placed) return note('reward_dropped', `${where}: needs a known carriedBy (not the player), groundIn or in (a container key)`);
    let qty = r.qty;
    if (qty !== undefined && (!Number.isInteger(qty) || qty < 1)) { note('reward_qty', `${where}: qty ${qty} set to 1`); qty = 1; }
    let item: Reward['item'];
    if (typeof r.item === 'string') {
      if (!known(r.item)) return note('reward_dropped', `${where}: item ${r.item} unknown`);
      if (known(r.item)!.threadbound) return note('reward_dropped', `${where}: ${r.item} is a Threadbound item; the Weaver does not place those (D-220)`);
      item = r.item;
    } else {
      const m = r.item;
      const base = known(m?.base);
      if (!base) return note('reward_dropped', `${where}: base item ${m?.base} unknown`);
      if (base.threadbound) return note('reward_dropped', `${where}: ${base.id} is one of a kind and cannot be minted`); // D-218
      const plain = mintLeft <= 0 ? 'the scenario\'s minted cap is used up' : !maxQ ? `a ${gain} gain allows no minted item`
        : badText(m.name) || badText(m.look) ? 'its name or look is too long or uses a hidden term' : '';
      if (plain) { note('reward_plain', `${where}: placed as a plain ${base.id}, because ${plain}`); item = base.id; }
      else {
        mintLeft -= 1;
        const asked = qualityOf(m.quality) ?? QUALITY_LEVELS.keys[0];
        const quality = QUALITY_LEVELS.pos(asked) > QUALITY_LEVELS.pos(maxQ!) ? maxQ! : asked;
        if (quality !== m.quality) note('reward_quality', `${where}: quality ${m.quality} set to ${quality}, the most a ${gain} gain allows`);
        let boosts = m.boosts;
        if (base.kind === 'weapon' && boosts !== 'hitAdj' && boosts !== 'damageAdj') {
          note('reward_boosts', `${where}: boosts "${boosts}" set to hitAdj`);
          boosts = 'hitAdj';
        }
        item = { ...m, quality, boosts };
      }
    }
    const b = boon(state, item, qty ?? 1);
    if (b > boonLeft + 1e-9) {
      if (typeof item !== 'string') mintLeft += 1;
      return note('reward_dropped', `${where}: worth ${b} Boon, only ${boonLeft} left of the ${gain} gain budget`);
    }
    boonLeft -= b;
    rewards.push({ ...r, item, ...(qty !== undefined ? { qty } : {}) });
  });
  return { rewards, notes };
}
