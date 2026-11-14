// Scenario orchestration: scenario start (event roll, Weaver, repair retry, WEAVER_TIMEOUT), background stage
// extensions held in memory per frontier, crossing (waits for a late extension), saved-zone re-entry.
// The pipeline (W7) injects `weave`, which wraps the real Agent Weaver call and logs it.
import { placeAll } from '../engine/position';
import { noteLeft } from '../engine/trail';
import { noteCrossing } from '../engine/chase';
import type { CheckinAnswer, Clock, GameEvent, GameState, Rng, EventRollResult, StagePlan, WeaverView, WorldView, WindowAnswer } from '../types';
import { CONFIG } from '../config';
import { ruleset } from '../ruleset';
import { buildWeaverView, buildWorldView, type WeaverTarget } from '../views';
import { isActive, zoneById } from '../engine/relations';
import type { FrontierWait } from '../engine/resolve';
import type { PlanContext, PlanError } from './index';
import { stageFrontiers, validateStagePlan } from './validate';
import { applyFallbackStage, applyStagePlan, beginScenario, ensurePlace, openingEvents, stealthyArrival } from './apply';
import { frontiersNearPlayer, isSavedZone, loadSavedZone } from './stage';
import { addRegion, regionCallView, tidyBrief, type RegionCallView } from '../land/brief';
import { squaresWanted } from '../land/edge';

/** one Agent Weaver call; null = the call failed. `errors` and `rejected` set = the repair retry: the validator's errors and
 * the plan they belong to (V11). */
export type Weave = (view: WeaverView, errors?: PlanError[], rejected?: StagePlan) => Promise<StagePlan | null>;

/** WB1: one World builder call: the ground beyond a frontier, its everyday people and standing situations, with no tier.
 * Same contract as Weave. */
export type Build = (view: WorldView, errors?: PlanError[], rejected?: StagePlan) => Promise<StagePlan | null>;

/** WZ2/WB8: one World builder call for a region's brief; null = the call failed (code then draws the land from the kind alone) */
export type RegionCall = (view: RegionCallView) => Promise<unknown | null>;

/** SC8: one Weaver check-in call about the running scenario. null = the call failed. */
export type CheckIn = (view: WeaverView) => Promise<CheckinAnswer | null>;

/** WB6: one Weaver call on a scenario window in free roam: start one now, or not now. null = the call failed. */
export type Window = (view: WeaverView) => Promise<WindowAnswer | null>;

export type ScenarioOutcome = 'applied' | 'degraded' | 'fallback' | 'loaded';
export type ScenarioResult = {
  outcome: ScenarioOutcome;
  plan: StagePlan | null;
  errors: PlanError[];
  /** set on a scenario start only; the pipeline puts it on the turn record */
  eventRoll?: EventRollResult;
  /** a frontier crossing: NPCs that followed the player through (NW8) */
  followed?: string[];
};

/** errors that need the repair call: repaired notes don't count */
const blocking = (errors: PlanError[]) => errors.some((e) => !e.repaired);

/** dropped: WB2, story parts a World builder plan held, logged when the plan is applied */
type Planned = { plan: StagePlan | null; errors: PlanError[]; reason?: string; dropped?: string[] };
/** ahead (NW3): started for an NPC waiting at the frontier; done: its result once back (applied by applyBuiltAhead) */
type Held = { ctx: PlanContext; result: Promise<Planned>; ahead?: true; done?: Planned };
const TIMEOUT: unique symbol = Symbol('timeout');

export class ScenarioDirector {
  /** background extensions, keyed by frontier; held for the rest of the scenario, never saved */
  private held = new Map<string, Held>();
  lastEventRoll: EventRollResult | null = null;
  /** SC8: the check-in in flight, for the scenario numbered `number`; never saved (a reload drops it) */
  private checkin: { number: number; done: boolean; answer: CheckinAnswer | null } | null = null;

  /** WZ18: region briefs asked for in the background, keyed by square; never saved (a reload asks again) */
  private regionCalls = new Map<string, { gx: number; gy: number; back: boolean; raw?: unknown }>();
  /** WB6: the window call in flight; never saved (a reload drops it and the window stays shut) */
  private window: { done: boolean; answer: WindowAnswer | null } | null = null;

  constructor(private readonly opts: { weave: Weave; clock: Clock; checkin?: CheckIn; region?: RegionCall; window?: Window; /** WB1: without it the Weave call builds frontiers (tests) */ build?: Build }) {}

  /** WB6: after a save, ask the Weaver about the open window in the background (again after a reload dropped the call). With
   * no window call wired (tests), the answer is "start" at once. Returns whether one was asked. */
  startWindow(state: GameState): boolean {
    if (!state.stage.window || this.window) return false;
    state.stage.window = 'asked';
    const w: { done: boolean; answer: WindowAnswer | null } = { done: !this.opts.window, answer: this.opts.window ? null : { start: true } };
    this.window = w;
    this.opts.window?.(buildWeaverView(state, { kind: 'window', placeId: state.player.placeId })).then((a) => { w.answer = a; }, () => { w.answer = null; }).finally(() => { w.done = true; });
    return true;
  }

  /** WB6: the window's answer once it is back, taken once (undefined: none back yet; null: the call failed) */
  takeWindow(): WindowAnswer | null | undefined {
    const w = this.window;
    if (!w?.done) return undefined;
    this.window = null;
    return w.answer;
  }

  /** WZ1/WZ2: a story in a world with no land yet draws its first region before its first plan: the Weaver's brief, then
   * code. Without a region call wired (tests with a scripted Weaver) the world stays without land, and a story already
   * under way without land (a test village) stays so. */
  private opening = false; // set while a story opens: only then is a world without land given its first region
  private async firstRegion(state: GameState, deadline: number): Promise<void> {
    if (state.regions?.length || !this.opts.region) return;
    const view = regionCallView(state, 0, 0);
    const got = await this.timed(this.opts.region(view).catch(() => null), deadline);
    const raw = got === TIMEOUT ? null : got;
    const { brief, notes } = tidyBrief(raw, view);
    const r = addRegion(state, 0, 0, brief);
    if (!raw) state.log.push({ turn: state.turn, code: 'region_brief_fallback', detail: { region: r.id, kind: r.kind } });
    if (notes.length) state.log.push({ turn: state.turn, code: 'region_brief_tidied', detail: { region: r.id, notes } });
  }

  /** SC8: after a save, start the check-in the last turn asked for, in the background. Returns whether one started. */
  startCheckin(state: GameState): boolean {
    const st = state.stage, f = st.scenario, reason = st.checkinDue;
    if (!reason || !f || !this.opts.checkin || this.checkin) return false;
    delete st.checkinDue;
    if (reason !== 'budget') f.checkins = (f.checkins ?? 0) + 1; // BG-42: the over-time check-in is not counted toward the cap
    f.lastCheckin = state.turn;
    const view = buildWeaverView(state, { kind: 'checkin', placeId: state.player.placeId, reason });
    const c: { number: number; done: boolean; answer: CheckinAnswer | null } = { number: f.number, done: false, answer: null };
    this.checkin = c;
    this.opts.checkin(view).then((a) => { c.answer = a; }, () => { c.answer = null; }).finally(() => { c.done = true; });
    return true;
  }

  /** SC8: the check-in's answer once it is back, taken once (null: none back yet) */
  takeCheckin(): { number: number; answer: CheckinAnswer | null } | null {
    const c = this.checkin;
    if (!c?.done) return null;
    this.checkin = null;
    return { number: c.number, answer: c.answer };
  }

  heldKeys(): string[] {
    return [...this.held.keys()];
  }

  /** Scenario setup (steps 1–8 minus the save): one event roll, one Weaver call (+ one repair), apply or fallback. */
  async startScenario(state: GameState, rng: Rng, entry: 'open' | 'stealthy' = 'open'): Promise<ScenarioResult> {
    const placeId = state.player.placeId; // step 1
    ensurePlace(state, placeId);
    const eventRoll = state.stage.encounter?.eventRoll ?? ruleset.eventRoll(state.player, state, rng); // step 2; TV4: an encounter's roll was made on the road
    this.lastEventRoll = eventRoll;
    this.held.clear();
    const wake = state.stage.breakCause === 'knocked_out'; // D-54
    // HF26: a new character standing nowhere yet, in a world that already has ground
    const arrive = !state.player.zone && state.places.some((p) => p.zones.length);
    beginScenario(state, eventRoll.tier, eventRoll.beyond);
    // WZ1 + WZ13: the land comes first; the story's first settlement stands on the brief's start site
    const deadline = this.opts.clock.now() + CONFIG.WEAVER_TIMEOUT_MS;
    if (this.opening) await this.firstRegion(state, deadline);
    const start = state.regions?.[0]?.sites.find((x) => x.id === state.regions![0].start && !x.placeId);
    const ctx: PlanContext = { tier: eventRoll.tier, kind: 'scenario', placeId, ...(start ? { site: start.id } : {}), ...(wake ? { wake: true as const } : {}), ...(arrive ? { arrive: true as const } : {}) };
    // WEAVER_TIMEOUT bounds the whole scenario-start wait (the region call, the first call and repair together)
    const target: WeaverTarget = { kind: 'scenario', placeId, ...(wake ? { wake: true as const } : {}), ...(arrive ? { arrive: true as const } : {}) };
    const planned = await this.plan(state, ctx, target, deadline);
    return { ...finish(state, ctx, planned, rng, entry), eventRoll };
  }

  /** Story start: setup alone, as turn 0; returns the opening events (also pushed to state.events). The pipeline saves turn 0 and makes the one Narrator call. */
  async storyStart(state: GameState, rng: Rng): Promise<ScenarioResult & { events: GameEvent[] }> {
    this.opening = true;
    const r = await this.startScenario(state, rng, 'open').finally(() => { this.opening = false; });
    const events = openingEvents(state, rng);
    state.events.push(...events);
    return { ...r, events };
  }

  /** After a turn is saved: start one background Weaver call per unbuilt frontier linked from the player's zone. Returns the frontier keys started.
   * In free roam too (WB5): crossing a frontier only builds the ground beyond it. */
  afterSave(state: GameState): string[] {
    const started: string[] = [];
    this.startCheckin(state);
    this.startWindow(state);
    this.drawAhead(state);
    started.push(...this.buildAhead(state));
    for (const key of frontiersNearPlayer(state)) {
      if (this.held.has(key)) continue;
      this.held.set(key, this.extension(state, key));
      started.push(key);
    }
    return started;
  }

  /** WZ18: once the player can see past their region's edge, or stands on a road that leaves by it, the Weaver's brief
   * for the square beyond is asked for in the background; applyRegionsDrawn draws it when it is back. Returns the
   * squares asked for. */
  drawAhead(state: GameState): string[] {
    const call = this.opts.region;
    if (!call || !state.regions?.length) return [];
    const asked: string[] = [];
    for (const q of squaresWanted(state)) {
      const key = `${q.gx},${q.gy}`;
      if (this.regionCalls.has(key)) continue;
      const e: { gx: number; gy: number; back: boolean; raw?: unknown } = { ...q, back: false };
      this.regionCalls.set(key, e);
      call(regionCallView(state, q.gx, q.gy)).then((raw) => { e.raw = raw; e.back = true; }, () => { e.raw = null; e.back = true; });
      asked.push(key);
    }
    return asked;
  }

  /** WZ18: regions whose brief came back since the last turn are drawn before the next one, joined to their drawn
   * neighbours (a brief that failed draws from the region kind alone). Returns the region ids drawn. */
  applyRegionsDrawn(state: GameState): string[] {
    const out: string[] = [];
    for (const [key, e] of this.regionCalls) {
      if (!e.back) continue;
      this.regionCalls.delete(key);
      if (state.regions?.some((r) => r.gx === e.gx && r.gy === e.gy)) continue;
      const view = regionCallView(state, e.gx, e.gy), { brief, notes } = tidyBrief(e.raw, view);
      const r = addRegion(state, e.gx, e.gy, brief);
      state.log.push({ turn: state.turn, code: 'region_drawn', detail: { region: r.id, kind: r.kind, ...(e.raw ? {} : { fallback: true }), ...(notes.length ? { notes } : {}) } });
      out.push(r.id);
    }
    return out;
  }

  /** NW3 (option A): an NPC waiting at an unbuilt frontier this turn starts the same background Weaver call the player's
   * frontiers get, at most NPC_BUILDS_PER_TURN a turn and none for a frontier already held. A frontier to a saved zone
   * just loads it (no call). In free roam too: the NPC's build is an extension, never a scenario of its own. */
  private buildAhead(state: GameState): string[] {
    const started: string[] = [];
    const open = stageFrontiers(state);
    for (const w of (state.scratch?.frontierWaits as FrontierWait[] | undefined) ?? []) {
      if (!open.has(w.frontier) || this.held.has(w.frontier)) continue;
      if (isSavedZone(state, w.frontier)) { loadSavedZone(state, w.frontier); continue; }
      if (started.length >= CONFIG.NPC_BUILDS_PER_TURN) break;
      const h: Held = { ...this.extension(state, w.frontier, true), ahead: true };
      h.result.then((r) => { h.done = r; });
      this.held.set(w.frontier, h);
      started.push(w.frontier);
    }
    return started;
  }

  /** NW3: NPC-started builds that came back are applied before the next turn (after the turn's own crossing), so the
   * waiting NPC steps through on its next move. Built is not seen: the player's Map shows the new ground only once they
   * see it (S6). Returns the frontier keys built. */
  applyBuiltAhead(state: GameState, rng: Rng): string[] {
    const built: string[] = [];
    for (const [key, h] of this.held) {
      if (!h.ahead || !h.done) continue;
      this.held.delete(key);
      if (!stageFrontiers(state).has(key)) continue; // the player crossed it first and it was applied then
      const planned = h.done.plan ? { ...h.done, errors: validateStagePlan(state, h.done.plan, h.ctx) } : h.done;
      finish(state, h.ctx, planned, rng, 'stealthy'); // stealthy: no opening beliefs, the player is not arriving
      built.push(key);
    }
    return built;
  }

  /** NW8 (settles OQ-13): NPCs that walked into frontier `key` this turn follow the player through it, after them */
  private followAcross(state: GameState, key: string): string[] {
    const here = zoneById(state, state.player.zone);
    if (!here) return [];
    const out: string[] = [];
    for (const w of (state.scratch?.frontierWaits as FrontierWait[] | undefined) ?? []) {
      const a = state.actors.find((x) => x.id === w.actorId);
      if (w.frontier !== key || !a || !isActive(a)) continue;
      a.zone = here.id;
      a.placeId = here.placeId;
      delete a.pos; // ZP1: placed in its new zone at the next turn's start
      out.push(a.id);
    }
    if (state.scratch?.frontierWaits) state.scratch.frontierWaits = (state.scratch.frontierWaits as FrontierWait[]).filter((w) => w.frontier !== key);
    return out;
  }

  /** The player moves into frontier `key` (after resolveTurn, before the save). Waits for a late extension; no event roll,
   * in free roam too (WB5, which reverses CH3 a): crossing only builds the ground beyond. */
  async cross(state: GameState, key: string, rng: Rng, entry: 'open' | 'stealthy' = 'open'): Promise<ScenarioResult> {
    const from = state.player.zone;
    const res = await this.crossTo(state, key, rng, entry);
    noteLeft(state, from); // the trail: "go back" leads to the zone the frontier was crossed from
    if (state.player.zone !== from) {
      noteCrossing(state, from, state.player.zone); // CH6: pursuers who saw it follow
      return { ...res, followed: this.followAcross(state, key) }; // NW8
    }
    return res;
  }

  private async crossTo(state: GameState, key: string, rng: Rng, entry: 'open' | 'stealthy'): Promise<ScenarioResult> {
    if (isSavedZone(state, key)) {
      loadSavedZone(state, key);
      const z = zoneById(state, key)!;
      state.player.zone = z.id;
      state.player.placeId = z.placeId;
      placeAll(state); // ZP1, as a built plan: a spot in the zone, never the point it had in the last one
      return { outcome: 'loaded', plan: null, errors: [] };
    }
    let h = this.held.get(key);
    if (!h) this.held.set(key, (h = this.extension(state, key)));
    const r = await h.result;
    // NW3: the player got to a frontier an NPC's build was already under way for: it is the player's crossing now
    const ctx: PlanContext = h.ahead ? (({ ahead: _, ...c }) => c)(h.ctx) : h.ctx;
    if (h.ahead) this.held.set(key, { ctx, result: h.result });
    // the stage may have changed since the plan came back: check it again (no retry for a background extension)
    const planned = r.plan ? { ...r, errors: validateStagePlan(state, r.plan, ctx) } : r;
    const res = finish(state, ctx, planned, rng, entry);
    if (entry === 'stealthy') stealthyArrival(state, rng);
    return res;
  }

  private extension(state: GameState, key: string, ahead = false): Held {
    // the frontier's edge: the player's zone when it links there, else (NW3) the zone the NPC waits in
    const edge = [zoneById(state, state.player.zone), ...state.zones].find((z) => z?.links.some((l) => l.to === key));
    const link = edge?.links.find((l) => l.to === key);
    const placeId = ahead && edge ? edge.placeId : state.player.placeId;
    // WB1/WB2: the World builder builds it, with no tier: what is really there, not what luck brings
    const ctx: PlanContext = { tier: state.stage.tier, kind: 'extension', frontierKey: key, placeId, world: true, ...(ahead ? { ahead: true as const } : {}) };
    // nobody may await a background call: a throw becomes a failed extension, never an unhandled rejection
    const result = this.plan(state, ctx, { kind: 'frontier', placeId, label: link?.label, frontierKey: key, ...(state.hidden.frontierBriefs?.[key] ? { brief: state.hidden.frontierBriefs[key] } : {}), ...(ahead ? { ahead: true as const } : {}) })
      .catch((): Planned => ({ plan: null, errors: [], reason: 'call_failed' }));
    return { ctx, result };
  }

  /** one call plus one repair retry with the validator's errors. */
  private async plan(state: GameState, ctx: PlanContext, target: WeaverTarget, deadline?: number): Promise<Planned> {
    // WB1: a world build goes to the World builder (its view has no tier); without one wired, to the Weave call
    const build = ctx.world ? this.opts.build : undefined;
    const call = build ? ((v: unknown, e?: PlanError[], r?: StagePlan) => build(v as WorldView, e, r).catch(() => null)) : (v: unknown, e?: PlanError[], r?: StagePlan) => this.call(v as WeaverView, e, r);
    const view = build ? buildWorldView(state, target) : buildWeaverView(state, target);
    const dropped = new Set<string>();
    const got = async (e?: PlanError[], r?: StagePlan) => { const p = await this.timed(call(view, e, r), deadline); return p && p !== TIMEOUT && ctx.world ? worldOnly(p, dropped) : p; };
    const res = await this.planWith(state, ctx, got);
    return dropped.size ? { ...res, dropped: [...dropped] } : res;
  }

  private async planWith(state: GameState, ctx: PlanContext, got: (e?: PlanError[], r?: StagePlan) => Promise<StagePlan | null | typeof TIMEOUT>): Promise<Planned> {
    const first = await got();
    if (first === TIMEOUT) return { plan: null, errors: [], reason: 'weaver_timeout' };
    if (!first) return { plan: null, errors: [], reason: 'call_failed' };
    const errors = validateStagePlan(state, first, ctx);
    if (!blocking(errors)) return { plan: first, errors };
    const second = await got(errors, first);
    if (second === TIMEOUT || !second) {
      // the repair failed: the first plan may still degrade if its errors are routine-only
      return { plan: first, errors, reason: second === TIMEOUT ? 'weaver_timeout' : 'call_failed' };
    }
    return { plan: second, errors: validateStagePlan(state, second, ctx), reason: 'invalid_plan' };
  }

  private call(view: WeaverView, errors?: PlanError[], rejected?: StagePlan): Promise<StagePlan | null> {
    return this.opts.weave(view, errors, rejected).catch(() => null);
  }

  private async timed<T>(p: Promise<T>, deadline?: number): Promise<T | typeof TIMEOUT> {
    if (deadline === undefined) return p;
    const ac = new AbortController();
    const timer = this.opts.clock.sleep(Math.max(0, deadline - this.opts.clock.now()), ac.signal).then((): typeof TIMEOUT => TIMEOUT, (): typeof TIMEOUT => TIMEOUT);
    try {
      return await Promise.race([p, timer]);
    } finally {
      ac.abort();
    }
  }
}

/** WB2: a World builder plan holds no story: its scenario, rewards and beats are dropped (logged), and its event carries
 * no grades */
function worldOnly(p: StagePlan, dropped: Set<string>): StagePlan {
  if (p.scenario) dropped.add('scenario');
  if (p.rewards?.length) dropped.add('rewards');
  if (p.seeds?.triggers?.length) dropped.add('beats');
  const { scenario: _s, ...rest } = p;
  return { ...rest, event: { summary: p.event?.summary ?? '', challenge: 'none', gain: 'none' }, rewards: [], seeds: { plans: p.seeds?.plans ?? [], triggers: [], secrets: p.seeds?.secrets ?? [] } };
}

function finish(state: GameState, ctx: PlanContext, p: Planned, rng: Rng, entry: 'open' | 'stealthy'): ScenarioResult {
  if (ctx.kind === 'scenario') delete state.stage.cause; // SW3 a: read by this plan's view only
  if (p.dropped?.length) state.log.push({ turn: state.turn, code: 'world_story_dropped', detail: { dropped: p.dropped, ...(ctx.frontierKey ? { frontier: ctx.frontierKey } : {}) } });
  if (p.plan && p.errors.every((e) => e.routineOnly || e.repaired)) {
    const degrade = p.errors.filter((e) => e.routineOnly);
    applyStagePlan(state, p.plan, ctx, { entry, ...(degrade.length ? { degrade } : {}) }, rng);
    return { outcome: degrade.length ? 'degraded' : 'applied', plan: p.plan, errors: p.errors };
  }
  applyFallbackStage(state, ctx, p.reason ?? 'invalid_plan', p.errors);
  return { outcome: 'fallback', plan: p.plan, errors: p.errors };
}

/**
 * Replay of a scenario start (test 45): the same steps as startScenario, fed the logged Weaver outputs in call order
 * (first answer, then the repair answer if one was made; null = the call failed or timed out). No Claude call.
 */
export function replayScenarioStart(state: GameState, weaverOutputs: (StagePlan | null)[], rng: Rng, entry: 'open' | 'stealthy' = 'open'): ScenarioResult {
  const placeId = state.player.placeId;
  ensurePlace(state, placeId);
  const eventRoll = state.stage.encounter?.eventRoll ?? ruleset.eventRoll(state.player, state, rng);
  const wake = state.stage.breakCause === 'knocked_out'; // D-54
  beginScenario(state, eventRoll.tier, eventRoll.beyond);
  const ctx: PlanContext = { tier: eventRoll.tier, kind: 'scenario', placeId, ...(wake ? { wake: true as const } : {}) };
  const [first, second] = weaverOutputs;
  let planned: Planned;
  if (!first) planned = { plan: null, errors: [], reason: 'call_failed' };
  else {
    const errors = validateStagePlan(state, first, ctx);
    if (!blocking(errors)) planned = { plan: first, errors };
    else if (!second) planned = { plan: first, errors, reason: 'call_failed' };
    else planned = { plan: second, errors: validateStagePlan(state, second, ctx), reason: 'invalid_plan' };
  }
  return { ...finish(state, ctx, planned, rng, entry), eventRoll };
}
