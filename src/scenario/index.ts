// W6 — Scenarios, the stage, frontiers, event roll, Agent Weaver plan validation/application, fallback stage, opening narration, stage trim.
import type { Tier } from '../types';

/** repaired: code already fixed it (rewards); it never blocks a plan or asks for a repair call. */
export type PlanError = { code: string; message: string; routineOnly: boolean; castKey?: string; repaired?: true };
/** wake (D-54): the player was knocked out and survived; the plan's first zone is where they wake */
/** ahead (NW3): an extension built for an NPC heading through the frontier; the player is not moved in */
export type PlanContext = { tier: Tier; kind: 'scenario' | 'extension' | 'checkin'; frontierKey?: string; placeId: string; wake?: true; ahead?: true };

export { boon, gradesFitTier, tidyRewards, validateStagePlan } from './validate';
/** applyStagePlan: apply a validated plan (minus routine-only errors when degrading). entry 'stealthy' skips opening beliefs.
 *  applyFallbackStage: flagged fallback stage: the place's saved zones, or one empty zone per frontier label; grades none/none.
 *  openingEvents: arrival + presence events for the player's perception (scenario setup step 8). */
export { applyStagePlan, applyFallbackStage, openingEvents, beginScenario } from './apply';
/** frontiersNearPlayer: unbuilt frontier keys linked from the player's zone. */
export { frontiersNearPlayer, loadSavedZone, isSavedZone } from './stage';
export { ScenarioDirector } from './director';
export type { Weave, ScenarioResult, ScenarioOutcome } from './director';
