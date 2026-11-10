// W6 — Scenes, the stage, frontiers, situation roll, Agent Weaver plan validation/application, fallback stage, opening narration, stage trim.
import type { Tier } from '../types';

/** repaired: code already fixed it (rewards); it never blocks a plan or asks for a repair call. */
export type PlanError = { code: string; message: string; routineOnly: boolean; castKey?: string; repaired?: true };
/** wake (D-54): the player was knocked out and survived; the plan's first zone is where they wake */
export type PlanContext = { tier: Tier; kind: 'scene' | 'extension'; frontierKey?: string; placeId: string; wake?: true };

export { boon, gradesFitTier, tidyRewards, validateStagePlan } from './validate';
/** applyStagePlan: apply a validated plan (minus routine-only errors when degrading). entry 'stealthy' skips opening beliefs.
 *  applyFallbackStage: flagged fallback stage: the place's saved zones, or one empty zone per frontier label; grades none/none.
 *  openingEvents: arrival + presence events for the player's perception (scene setup step 8). */
export { applyStagePlan, applyFallbackStage, openingEvents, beginScene } from './apply';
/** trimStage [Proposed]: past MAX_STAGE_ZONES drop the farthest zones without engaged actors; links into them become frontiers.
 *  frontiersNearPlayer: unbuilt frontier keys linked from the player's zone. */
export { trimStage, frontiersNearPlayer, loadSavedZone, isSavedZone } from './stage';
export { SceneDirector } from './director';
export type { Weave, SceneResult, SceneOutcome } from './director';
