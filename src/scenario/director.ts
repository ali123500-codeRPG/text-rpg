// Scenario orchestration: scenario start (event roll, Weaver, repair retry, WEAVER_TIMEOUT), background stage
// extensions held in memory per frontier, crossing (waits for a late extension), saved-zone re-entry.
// The pipeline (W7) injects `weave`, which wraps the real Agent Weaver call and logs it.
import { noteLeft } from '../engine/trail';
import { noteCrossing } from '../engine/chase';
import type { CheckinAnswer, Clock, GameEvent, GameState, Rng, EventRollResult, StagePlan, WeaverView } from '../types';
import { CONFIG } from '../config';
import { ruleset } from '../ruleset';
import { buildWeaverView, type WeaverTarget } from '../views';
import { isActive, zoneById } from '../engine/relations';
import type { FrontierWait } from '../engine/resolve';
import type { PlanContext, PlanError } from './index';
import { stageFrontiers, validateStagePlan } from './validate';
import { applyFallbackStage, applyStagePlan, beginScenario, ensurePlace, openingEvents, stealthyArrival } from './apply';
import { frontiersNearPlayer, isSavedZone, loadSavedZone } from './stage';

/** one Agent Weaver call. `errors` set = the repair retry. null = the call failed. */
/** `errors` and `rejected` set = the repair retry: the validator's errors and the plan they belong to (V11). */
export type Weave = (view: WeaverView, errors?: PlanError[], rejected?: StagePlan) => Promise<StagePlan | null>;

/** SC8: one Weaver check-in call about the running scenario. null = the call failed. */
export type CheckIn = (view: WeaverView) => Promise<CheckinAnswer | null>;

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

type Planned = { plan: StagePlan | null; errors: PlanError[]; reason?: string };
/** ahead (NW3): started for an NPC waiting at the frontier; done: its result once back (applied by applyBuiltAhead) */
type Held = { ctx: PlanContext; result: Promise<Planned>; ahead?: true; done?: Planned };
const TIMEOUT: unique symbol = Symbol('timeout');

export class ScenarioDirector {
  /** background extensions, keyed by frontier; held for the rest of the scenario, never saved */
  private held = new Map<string, Held>();
  lastEventRoll: EventRollResult | null = null;
  /** SC8: the check-in in flight, for the scenario numbered `number`; never saved (a reload drops it) */
  private checkin: { number: number; done: boolean; answer: CheckinAnswer | null } | null = null;

  constructor(private readonly opts: { weave: Weave; clock: Clock; checkin?: CheckIn }) {}

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

  /** Scenario setup (steps 1–8 minus the save): one event roll, one Weaver call (+ one repair), apply or fallback.
   * frontierKey (CH3 a): free roam crossed an unbuilt frontier; the scenario's opening plan builds the ground beyond it. */
  async startScenario(state: GameState, rng: Rng, entry: 'open' | 'stealthy' = 'open', frontierKey?: string): Promise<ScenarioResult> {
    const placeId = state.player.placeId; // step 1
    ensurePlace(state, placeId);
    const eventRoll = state.stage.encounter?.eventRoll ?? ruleset.eventRoll(state.player, state, rng); // step 2; TV4: an encounter's roll was made on the road
    this.lastEventRoll = eventRoll;
    this.held.clear();
    const wake = state.stage.breakCause === 'knocked_out'; // D-54
    const label = frontierKey ? zoneById(state, state.player.zone)?.links.find((l) => l.to === frontierKey)?.label : undefined;
    beginScenario(state, eventRoll.tier, eventRoll.beyond);
    const ctx: PlanContext = { tier: eventRoll.tier, kind: 'scenario', placeId, ...(wake ? { wake: true as const } : {}), ...(frontierKey ? { frontierKey } : {}) };
    // GAP: WEAVER_TIMEOUT bounds the whole scenario-start wait (first call and repair together).
    const deadline = this.opts.clock.now() + CONFIG.WEAVER_TIMEOUT_MS;
    const target: WeaverTarget = { kind: 'scenario', placeId, ...(wake ? { wake: true as const } : {}), ...(frontierKey ? { frontierKey, ...(label !== undefined ? { label } : {}) } : {}) };
    const planned = await this.plan(state, ctx, target, deadline);
    const res = { ...this.finish(state, ctx, planned, rng, entry), eventRoll };
    if (frontierKey && entry === 'stealthy') stealthyArrival(state, rng);
    return res;
  }

  /** Story start: setup alone, as turn 0; returns the opening events (also pushed to state.events). The pipeline saves turn 0 and makes the one Narrator call. */
  async storyStart(state: GameState, rng: Rng): Promise<ScenarioResult & { events: GameEvent[] }> {
    state.turn = 0;
    const r = await this.startScenario(state, rng, 'open');
    const events = openingEvents(state, rng);
    state.events.push(...events);
    return { ...r, events };
  }

  /** After a turn is saved: start one background Weaver call per unbuilt frontier linked from the player's zone. Returns the frontier keys started.
   * None in free roam (SD2 a): no scenario runs, so crossing one starts a scenario of its own (CH3 a). */
  afterSave(state: GameState): string[] {
    const started: string[] = [];
    this.startCheckin(state);
    started.push(...this.buildAhead(state));
    if (state.stage.roam) return started;
    for (const key of frontiersNearPlayer(state)) {
      if (this.held.has(key)) continue;
      this.held.set(key, this.extension(state, key));
      started.push(key);
    }
    return started;
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
      const planned = h.done.plan ? { plan: h.done.plan, errors: validateStagePlan(state, h.done.plan, h.ctx) } : h.done;
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

  /** The player moves into frontier `key` (after resolveTurn, before the save). Waits for a late extension; no event roll.
   * In free roam an unbuilt frontier starts a new scenario there instead, with its own event roll (CH3 a: eventRoll is set). */
  async cross(state: GameState, key: string, rng: Rng, entry: 'open' | 'stealthy' = 'open'): Promise<ScenarioResult> {
    const from = state.player.zone;
    const res = state.stage.roam && !isSavedZone(state, key) ? await this.startScenario(state, rng, entry, key) : await this.crossTo(state, key, rng, entry);
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
      return { outcome: 'loaded', plan: null, errors: [] };
    }
    let h = this.held.get(key);
    if (!h) this.held.set(key, (h = this.extension(state, key)));
    const r = await h.result;
    // NW3: the player got to a frontier an NPC's build was already under way for: it is the player's crossing now
    const ctx: PlanContext = h.ahead ? (({ ahead: _, ...c }) => c)(h.ctx) : h.ctx;
    if (h.ahead) this.held.set(key, { ctx, result: h.result });
    // the stage may have changed since the plan came back: check it again (no retry for a background extension)
    const planned = r.plan ? { plan: r.plan, errors: validateStagePlan(state, r.plan, ctx) } : r;
    const res = this.finish(state, ctx, planned, rng, entry);
    if (entry === 'stealthy') stealthyArrival(state, rng);
    return res;
  }

  private extension(state: GameState, key: string, ahead = false): Held {
    // the frontier's edge: the player's zone when it links there, else (NW3) the zone the NPC waits in
    const edge = [zoneById(state, state.player.zone), ...state.zones].find((z) => z?.links.some((l) => l.to === key));
    const link = edge?.links.find((l) => l.to === key);
    const placeId = ahead && edge ? edge.placeId : state.player.placeId;
    const ctx: PlanContext = { tier: state.stage.tier, kind: 'extension', frontierKey: key, placeId, ...(ahead ? { ahead: true as const } : {}) };
    // nobody may await a background call: a throw becomes a failed extension, never an unhandled rejection
    const result = this.plan(state, ctx, { kind: 'frontier', placeId, label: link?.label, frontierKey: key, ...(ahead ? { ahead: true as const } : {}) })
      .catch((): Planned => ({ plan: null, errors: [], reason: 'call_failed' }));
    return { ctx, result };
  }

  /** one call plus one repair retry with the validator's errors. */
  private async plan(state: GameState, ctx: PlanContext, target: WeaverTarget, deadline?: number): Promise<Planned> {
    const view = buildWeaverView(state, target);
    const first = await this.timed(this.call(view), deadline);
    if (first === TIMEOUT) return { plan: null, errors: [], reason: 'weaver_timeout' };
    if (!first) return { plan: null, errors: [], reason: 'call_failed' };
    const errors = validateStagePlan(state, first, ctx);
    if (!blocking(errors)) return { plan: first, errors };
    const second = await this.timed(this.call(view, errors, first), deadline);
    if (second === TIMEOUT || !second) {
      // the repair failed: the first plan may still degrade if its errors are routine-only
      return { plan: first, errors, reason: second === TIMEOUT ? 'weaver_timeout' : 'call_failed' };
    }
    return { plan: second, errors: validateStagePlan(state, second, ctx), reason: 'invalid_plan' };
  }

  private finish(state: GameState, ctx: PlanContext, p: Planned, rng: Rng, entry: 'open' | 'stealthy'): ScenarioResult {
    return finish(state, ctx, p, rng, entry);
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

function finish(state: GameState, ctx: PlanContext, p: Planned, rng: Rng, entry: 'open' | 'stealthy'): ScenarioResult {
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
