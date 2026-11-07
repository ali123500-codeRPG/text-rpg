// W6 — Scenes, the stage, frontiers, situation roll, Agent Weaver plan validation/application, fallback stage, opening narration, stage trim.
import type { GameEvent, GameState, Grade, Rng, StagePlan, Tier } from '../types';
import { todo } from '../todo';

export type PlanError = { code: string; message: string; routineOnly: boolean; castKey?: string };
export type PlanContext = { tier: Tier; kind: 'scene' | 'extension'; frontierKey?: string; placeId: string };

export function gradesFitTier(tier: Tier, challenge: Grade, gain: Grade): boolean { return todo('gradesFitTier'); }
export function validateStagePlan(state: GameState, plan: StagePlan, ctx: PlanContext): PlanError[] { return todo('validateStagePlan'); }
/** apply a validated plan (minus routine-only errors when degrading). entry 'sneaking' skips opening beliefs and runs arrival detection. */
export function applyStagePlan(state: GameState, plan: StagePlan, ctx: PlanContext, opts: { entry: 'open' | 'sneaking'; degrade?: PlanError[] }, rng: Rng): void { return todo('applyStagePlan'); }
/** flagged fallback stage: the place's saved zones, or one empty zone per frontier label; grades none/none. */
export function applyFallbackStage(state: GameState, ctx: PlanContext, reason: string, errors: PlanError[]): void { return todo('applyFallbackStage'); }
/** arrival + presence events for the player's perception (scene setup step 8). */
export function openingEvents(state: GameState, rng: Rng): GameEvent[] { return todo('openingEvents'); }
/** Stage trim [Proposed]: past MAX_STAGE_ZONES drop the farthest zones without engaged actors; links into them become frontiers. */
export function trimStage(state: GameState): void { return todo('trimStage'); }
/** frontier keys linked from the player's zone. */
export function frontiersNearPlayer(state: GameState): string[] { return todo('frontiersNearPlayer'); }
