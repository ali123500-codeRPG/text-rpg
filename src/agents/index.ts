// W7 — Agent wrappers (prompts as constants, schemas validated, legality), leak scan and fact checks, fallback narration,
// and the turn pipeline (Planner scheduler, BACKGROUND_WINDOW / DIALOGUE_WINDOW gates, mode switcher, call cap).
export * from './prompts';
export * from './schema';
export * from './format';
export * from './legality';
export * from './narration';
export * from './call';
export * from './wrappers';
export * from './clock';
export * from './client';
export { createGame, hasAgenda, plannerActors, worldIds, mechanicsLines } from './game';
export { validateBuild } from '../library/spawn';
export type { Game, GameDeps, ScenarioDirector } from './game';
