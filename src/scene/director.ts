// Scene orchestration: scene start (situation roll, Weaver, repair retry, WEAVER_TIMEOUT), background stage
// extensions held in memory per frontier, crossing (waits for a late extension), saved-zone re-entry.
// The pipeline (W7) injects `weave`, which wraps the real Agent Weaver call and logs it.
import type { Clock, GameEvent, GameState, Rng, SituationResult, StagePlan, WeaverView } from '../types';
import { CONFIG } from '../config';
import { ruleset } from '../ruleset';
import { buildWeaverView } from '../views';
import { zoneById } from '../engine/relations';
import type { PlanContext, PlanError } from './index';
import { validateStagePlan } from './validate';
import { applyFallbackStage, applyStagePlan, beginScene, ensurePlace, openingEvents } from './apply';
import { frontiersNearPlayer, isSavedZone, loadSavedZone } from './stage';

/** one Agent Weaver call. `errors` set = the repair retry. null = the call failed. */
/** `errors` and `rejected` set = the repair retry: the validator's errors and the plan they belong to (V11). */
export type Weave = (view: WeaverView, errors?: PlanError[], rejected?: StagePlan) => Promise<StagePlan | null>;

export type SceneOutcome = 'applied' | 'degraded' | 'fallback' | 'loaded';
export type SceneResult = {
  outcome: SceneOutcome;
  plan: StagePlan | null;
  errors: PlanError[];
  /** set on a scene start only; the pipeline puts it on the turn record */
  situation?: SituationResult;
};

/** errors that need the repair call: repaired notes don't count */
const blocking = (errors: PlanError[]) => errors.some((e) => !e.repaired);

type Planned = { plan: StagePlan | null; errors: PlanError[]; reason?: string };
type Held = { ctx: PlanContext; result: Promise<Planned> };
const TIMEOUT: unique symbol = Symbol('timeout');

export class SceneDirector {
  /** background extensions, keyed by frontier; held for the rest of the scene, never saved */
  private held = new Map<string, Held>();
  lastSituation: SituationResult | null = null;

  constructor(private readonly opts: { weave: Weave; clock: Clock }) {}

  heldKeys(): string[] {
    return [...this.held.keys()];
  }

  /** Scene setup (steps 1–8 minus the save): one situation roll, one Weaver call (+ one repair), apply or fallback. */
  async startScene(state: GameState, rng: Rng, entry: 'open' | 'sneaking' = 'open'): Promise<SceneResult> {
    const placeId = state.player.placeId; // step 1
    ensurePlace(state, placeId);
    const situation = ruleset.situation(state.player, state, rng); // step 2
    this.lastSituation = situation;
    this.held.clear();
    beginScene(state, situation.tier);
    const ctx: PlanContext = { tier: situation.tier, kind: 'scene', placeId };
    // GAP: WEAVER_TIMEOUT bounds the whole scene-start wait (first call and repair together).
    const deadline = this.opts.clock.now() + CONFIG.WEAVER_TIMEOUT_MS;
    const planned = await this.plan(state, ctx, { kind: 'scene', placeId }, deadline);
    return { ...this.finish(state, ctx, planned, rng, entry), situation };
  }

  /** Story start: setup alone, as turn 0; returns the opening events (also pushed to state.events). The pipeline saves turn 0 and makes the one Narrator call. */
  async storyStart(state: GameState, rng: Rng): Promise<SceneResult & { events: GameEvent[] }> {
    state.turn = 0;
    const r = await this.startScene(state, rng, 'open');
    const events = openingEvents(state, rng);
    state.events.push(...events);
    return { ...r, events };
  }

  /** After a turn is saved: start one background Weaver call per unbuilt frontier linked from the player's zone. Returns the frontier keys started. */
  afterSave(state: GameState): string[] {
    const started: string[] = [];
    for (const key of frontiersNearPlayer(state)) {
      if (this.held.has(key)) continue;
      this.held.set(key, this.extension(state, key));
      started.push(key);
    }
    return started;
  }

  /** The player moves into frontier `key` (after resolveTurn, before the save). Waits for a late extension; no situation roll. */
  async cross(state: GameState, key: string, rng: Rng, entry: 'open' | 'sneaking' = 'open'): Promise<SceneResult> {
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
    // the stage may have changed since the plan came back: check it again (no retry for a background extension)
    const planned = r.plan ? { plan: r.plan, errors: validateStagePlan(state, r.plan, h.ctx) } : r;
    return this.finish(state, h.ctx, planned, rng, entry);
  }

  private extension(state: GameState, key: string): Held {
    const link = zoneById(state, state.player.zone)?.links.find((l) => l.to === key);
    const placeId = state.player.placeId;
    const ctx: PlanContext = { tier: state.stage.tier, kind: 'extension', frontierKey: key, placeId };
    // nobody may await a background call: a throw becomes a failed extension, never an unhandled rejection
    const result = this.plan(state, ctx, { kind: 'frontier', placeId, label: link?.label, frontierKey: key })
      .catch((): Planned => ({ plan: null, errors: [], reason: 'call_failed' }));
    return { ctx, result };
  }

  /** one call plus one repair retry with the validator's errors. */
  private async plan(state: GameState, ctx: PlanContext, target: WeaverView['target'], deadline?: number): Promise<Planned> {
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

  private finish(state: GameState, ctx: PlanContext, p: Planned, rng: Rng, entry: 'open' | 'sneaking'): SceneResult {
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

function finish(state: GameState, ctx: PlanContext, p: Planned, rng: Rng, entry: 'open' | 'sneaking'): SceneResult {
  if (p.plan && p.errors.every((e) => e.routineOnly || e.repaired)) {
    const degrade = p.errors.filter((e) => e.routineOnly);
    applyStagePlan(state, p.plan, ctx, { entry, ...(degrade.length ? { degrade } : {}) }, rng);
    return { outcome: degrade.length ? 'degraded' : 'applied', plan: p.plan, errors: p.errors };
  }
  applyFallbackStage(state, ctx, p.reason ?? 'invalid_plan', p.errors);
  return { outcome: 'fallback', plan: p.plan, errors: p.errors };
}

/**
 * Replay of a scene start (test 45): the same steps as startScene, fed the logged Weaver outputs in call order
 * (first answer, then the repair answer if one was made; null = the call failed or timed out). No Claude call.
 */
export function replaySceneStart(state: GameState, weaverOutputs: (StagePlan | null)[], rng: Rng, entry: 'open' | 'sneaking' = 'open'): SceneResult {
  const placeId = state.player.placeId;
  ensurePlace(state, placeId);
  const situation = ruleset.situation(state.player, state, rng);
  beginScene(state, situation.tier);
  const ctx: PlanContext = { tier: situation.tier, kind: 'scene', placeId };
  const [first, second] = weaverOutputs;
  let planned: Planned;
  if (!first) planned = { plan: null, errors: [], reason: 'call_failed' };
  else {
    const errors = validateStagePlan(state, first, ctx);
    if (!blocking(errors)) planned = { plan: first, errors };
    else if (!second) planned = { plan: first, errors, reason: 'call_failed' };
    else planned = { plan: second, errors: validateStagePlan(state, second, ctx), reason: 'invalid_plan' };
  }
  return { ...finish(state, ctx, planned, rng, entry), situation };
}
