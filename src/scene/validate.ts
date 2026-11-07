// Stage-plan validation (Part 2, Agent Weaver: Validation) and the grades table.
import type { GameState, Grade, StagePlan, Tier, TriggerWhen } from '../types';
import { GRADES, ORDER_TYPES } from '../types';
import { mentions } from '../words';
import { CONFIG, COVER_NAMES, LIGHT_NAMES, TIER_MAX, TIER_MIN } from '../config';
import { tierName } from '../ruleset';
import { creatureType, getLibrary, itemDef, npcTemplate, routineSet } from '../library';
import type { PlanError, PlanContext } from './index';

const STANCES = ['opposed', 'neutral', 'friendly'];
const BELIEFS = ['unaware', 'suspicious', 'aware'];
const TRIGGER_TYPES: TriggerWhen['type'][] = ['player_seen_in_zone', 'turn_reached', 'actor_down', 'alarm_heard'];

const g = (x: Grade) => GRADES.indexOf(x);

/** Challenge and gain grades [Proposed scale]. */
export function gradesFitTier(tier: Tier, challenge: Grade, gain: Grade): boolean {
  const c = g(challenge), n = g(gain);
  if (c < 0 || n < 0) return false;
  switch (tier) {
    case -3: return c >= g('major') && n <= g('minor');
    case -2: return c >= g('moderate') && n <= g('minor');
    case -1:
    case 0: return c >= g('minor') && c <= g('major') && Math.abs(n - c) <= 1;
    case 1: return c >= g('major') && gain === 'major';
    case 2: return challenge === 'extreme' && gain === 'extreme';
    default: return false;
  }
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
export function fillPlanDefaults(plan: StagePlan): void {
  if (!plan || typeof plan !== 'object') return;
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
  for (const s of list(seeds.secrets)) if (s) s.fact = trimNote(s.fact) as string;
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
    ['cast', cast.length, P.cast], ['zones', zones.length, P.zones], ['frontiers', frontiers.length, P.frontiers],
    ['places', places.length, P.places], ['bands', bands.length, P.bands],
  ];
  for (const [what, n, max] of counts) if (n > max) err('cap_exceeded', `${what}: ${n} > ${max}`);

  // ---- grades ----
  const ev = plan.event;
  if (!ev || !GRADES.includes(ev.challenge) || !GRADES.includes(ev.gain)) err('bad_grade', 'event needs challenge and gain grades');
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
  text('event.summary', ev?.summary, false);
  text('weaverNote', plan.weaverNote, false);
  for (const p of places) {
    text(`place ${p.key} name`, p.name, true);
    // GAP: a root place may give parent '' (the type has no null); anything else must resolve.
    if (p.parent && !isPlace(p.parent)) err('unresolved_place', `place ${p.key}: parent ${p.parent} unknown`);
  }
  for (const f of frontiers) text(`frontier ${f.key} label`, f.label, true);

  // ---- zones and links ----
  for (const z of zones) {
    text(`zone ${z.key} name`, z.name, true);
    text(`zone ${z.key} look`, z.look, true);
    if (!isPlace(z.place)) err('unresolved_place', `zone ${z.key}: place ${z.place} unknown`);
    if (!(z.cover in COVER_NAMES) || !(z.light in LIGHT_NAMES)) err('bad_zone', `zone ${z.key}: light is ${Object.values(LIGHT_NAMES).join(', ')}; cover is ${Object.values(COVER_NAMES).join(', ')}`);
    for (const l of arr(z.links)) {
      text(`zone ${z.key} link label`, l.label, true);
      if (!isZone(l.to) && !isFrontier(l.to)) err('bad_link', `zone ${z.key}: link to ${l.to} is not a zone in the plan, on the stage, or a frontier`);
    }
  }

  // ---- bands ----
  for (const b of bands) {
    text(`band ${b.key} name`, b.name, true);
    text(`band ${b.key} goals`, b.goals, false);
    text(`band ${b.key} temperament`, b.temperament, false);
    if (![1, 2, 3].includes(b.tacticsLevel)) err('bad_band', `band ${b.key}: tacticsLevel is 1, 2 or 3`);
    if (b.lethal !== undefined && typeof b.lethal !== 'boolean') err('bad_band', `band ${b.key}: lethal is true or false`);
    for (const [other, st] of Object.entries(b.relations ?? {})) {
      if (!isBand(other)) err('unresolved_band', `band ${b.key}: relation to unknown band ${other}`);
      if (!STANCES.includes(st)) err('bad_stance', `band ${b.key}: relation ${st}`);
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
        try { creatureType(state, tpl.creatureTypeId); } catch {
          err('unknown_creature_type', `cast ${k}: creature type ${tpl.creatureTypeId} unknown; known: ${Object.keys(lib.creatures).join(', ')}`, k);
        }
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
      if (!STANCES.includes(o.stance)) err('bad_stance', `cast ${k}: override stance ${o.stance}`, k);
    }

    // ---- routine errors (routineOnly) ----
    const rerr = (code: string, message: string) => err(code, message, k, true);
    const set = routineSet(c.routineSetId);
    const slots = c.slots ?? {};
    if (!set) { rerr('unresolved_set', `cast ${k}: routine set ${c.routineSetId} unknown`); continue; }
    if (c.band === playerBand) {
      // GAP: a player-band entry with the wrong set or bound slots is read as a routine error (it degrades to idle_here).
      if (c.routineSetId !== 'companion') rerr('companion_set', `cast ${k}: a player-band entry uses the companion set`);
      if (Object.keys(slots).length) rerr('invalid_slot', `cast ${k}: a player-band entry binds no slots`);
    }
    for (const s of Object.keys(slots)) if (!set.slots[s]) rerr('invalid_slot', `cast ${k}: slot ${s} is not in set ${set.id}`);
    const bound: string[] = [];
    for (const [s, def] of Object.entries(set.slots)) {
      const v = slots[s];
      if (v === undefined) { rerr('missing_slot', `cast ${k}: slot ${s} is not bound`); continue; }
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
  const checkWhen = (where: string, w: TriggerWhen | undefined) => {
    if (!w || !TRIGGER_TYPES.includes(w.type)) return err('bad_trigger', `${where}: unknown trigger type ${w?.type}`);
    if (w.type === 'player_seen_in_zone' && !isZone(w.zone)) err('bad_trigger', `${where}: zone ${w.zone} unknown`);
    if (w.type === 'actor_down' && !isActor(w.actorId)) err('bad_trigger', `${where}: actor ${w.actorId} unknown`);
    if (w.type === 'turn_reached' && typeof w.turn !== 'number') err('bad_trigger', `${where}: turn is a number`);
  };
  const checkTrigger = (where: string, t: StagePlan['seeds']['triggers'][number]) => {
    if (!t || !t.id) return err('bad_trigger', `${where}: trigger without an id`);
    if (!isActor(t.ownerId)) err('bad_trigger', `trigger ${t.id}: owner ${t.ownerId} unknown`);
    checkWhen(`trigger ${t.id}`, t.when);
    // one order per trigger: `then` is a single order template
    if (!t.then || Array.isArray(t.then) || typeof t.then.type !== 'string') err('bad_trigger', `trigger ${t.id}: then holds exactly one order`);
    else if (!(ORDER_TYPES as readonly string[]).includes(t.then.type)) err('bad_trigger', `trigger ${t.id}: then.type ${t.then.type} unknown; known: ${ORDER_TYPES.join(', ')}`);
    if (typeof t.once !== 'boolean') err('bad_trigger', `trigger ${t.id}: once is true or false`);
  };
  for (const p of arr(seeds.plans)) {
    if (!isActor(p.ownerId)) err('unresolved_actor', `plan owner ${p.ownerId} unknown`);
    if (!arr(p.steps).every((x) => typeof x === 'string')) err('bad_plan', `plan ${p.ownerId}: steps is a list of short phrases`);
    text(`plan ${p.ownerId} goal`, p.goal, false);
    for (const t of arr(p.triggers)) checkTrigger(`plan ${p.ownerId}`, t);
  }
  for (const t of arr(seeds.triggers)) checkTrigger('seeds.triggers', t);
  for (const s of secrets) {
    if (!arr(s.leakTerms).length) err('secret_without_leak_terms', `secret ${s.id}: needs leakTerms`);
    if (!isActor(s.holderId)) err('unresolved_actor', `secret ${s.id}: holder ${s.holderId} unknown`);
    text(`secret ${s.id} fact`, s.fact, false);
    const r = s.revealWhen;
    if (r?.type === 'event_in_zone' && !isZone(r.zone)) err('bad_secret', `secret ${s.id}: zone ${r.zone} unknown`);
    else if (r?.type === 'check_passed' && !isActor(r.againstActorId)) err('bad_secret', `secret ${s.id}: actor ${r.againstActorId} unknown`);
    else if (r?.type === 'check_passed' && !lib.skills[r.skill]) err('bad_secret', `secret ${s.id}: skill ${r.skill} unknown; known: ${Object.keys(lib.skills).join(', ')}`);
    else if (r?.type === 'check_passed' && !(Number.isInteger(r.minTier) && r.minTier >= TIER_MIN && r.minTier <= TIER_MAX)) err('bad_secret', `secret ${s.id}: minTier must be a tier ID from ${TIER_MIN} to ${TIER_MAX}`);
    else if (r?.type !== 'event_in_zone' && r?.type !== 'check_passed') err('bad_secret', `secret ${s.id}: revealWhen unknown`);
  }

  // ---- rewards: repaired, never blocking (loot L1) ----
  errs.push(...tidyRewards(state, plan).notes);

  return errs;
}

type Reward = StagePlan['rewards'][number];

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
  const maxQ = GRADES.includes(gain) ? CONFIG.GAIN_MAX_QUALITY[gain] ?? 0 : 0;
  let mintLeft = CONFIG.SCENE_CAPS.minted - state.sceneCaps.minted;
  const known = (id: unknown) => { try { return typeof id === 'string' ? itemDef(state, id) : undefined; } catch { return undefined; } };

  const rewards: Reward[] = [];
  arr(plan.rewards).forEach((r, i) => {
    const where = `reward ${i}`;
    if (rewards.length >= CONFIG.PLAN_CAPS.rewards) return note('reward_dropped', `${where}: over the cap of ${CONFIG.PLAN_CAPS.rewards} rewards`);
    const pl = r?.place as { carriedBy?: string; groundIn?: string } | undefined;
    const placed = pl?.carriedBy !== undefined ? castKeys.has(pl.carriedBy) || actorIds.has(pl.carriedBy)
      : pl?.groundIn !== undefined && (zoneKeys.has(pl.groundIn) || stageZones.has(pl.groundIn));
    if (!placed) return note('reward_dropped', `${where}: needs a known carriedBy (not the player) or groundIn`);
    let qty = r.qty;
    if (qty !== undefined && (!Number.isInteger(qty) || qty < 1)) { note('reward_qty', `${where}: qty ${qty} set to 1`); qty = 1; }
    let item: Reward['item'];
    if (typeof r.item === 'string') {
      if (!known(r.item)) return note('reward_dropped', `${where}: item ${r.item} unknown`);
      item = r.item;
    } else {
      const m = r.item;
      const base = known(m?.base);
      if (!base) return note('reward_dropped', `${where}: base item ${m?.base} unknown`);
      const plain = mintLeft <= 0 ? 'the scene\'s minted cap is used up' : maxQ < 1 ? `a ${gain} gain allows no minted item`
        : badText(m.name) || badText(m.look) ? 'its name or look is too long or uses a hidden term' : '';
      if (plain) { note('reward_plain', `${where}: placed as a plain ${base.id}, because ${plain}`); item = base.id; }
      else {
        mintLeft -= 1;
        const quality = Math.min(maxQ, Math.max(1, Math.round(Number(m.quality)) || 1)) as 1 | 2 | 3 | 4;
        if (quality !== m.quality) note('reward_quality', `${where}: quality ${m.quality} set to ${quality}, the most a ${gain} gain allows`);
        let boosts = m.boosts;
        if (base.kind === 'weapon' && boosts !== 'hitAdj' && boosts !== 'damageAdj') {
          note('reward_boosts', `${where}: boosts "${boosts}" set to hitAdj`);
          boosts = 'hitAdj';
        }
        item = { ...m, quality, boosts };
      }
    }
    rewards.push({ ...r, item, ...(qty !== undefined ? { qty } : {}) });
  });
  return { rewards, notes };
}
