// Shared by tests 44 and 45: the contract assumed for W6's scene director (src/scene/director.ts, not built yet),
// loaded dynamically so the suite type-checks before it lands. Adjust here at integration if W6 names it differently.
import type { AgentTurnLog, ClaudeClient, GameEvent, GameState, Rng, SituationResult, StagePlan, TurnRecord } from '../../src/types';

export type SceneDirector = {
  /** Scene setup steps 1–8 inside the triggering turn (after resolveTurn): situation roll, one Weaver call, plan applied. */
  runSceneSetup(state: GameState, deps: { claude: ClaudeClient; rng: Rng }): Promise<{ situation: SituationResult; events: GameEvent[]; agentLog: AgentTurnLog[] }>;
  /** The same from a turn record: the logged situation roll and Weaver output, no Claude call. */
  replaySceneSetup(state: GameState, record: TurnRecord, rng: Rng): GameEvent[];
};

export async function loadDirector(): Promise<SceneDirector> {
  const path = '../../src/scene/director';
  return (await import(/* @vite-ignore */ path)) as SceneDirector;
}

/** A small valid plan for the village: an old mill outside the gate, one frontier, no cast. */
export const MILL_PLAN: StagePlan = {
  event: { summary: 'slime tracks lead toward the old mill', challenge: 'moderate', gain: 'moderate' },
  places: [{ key: 'mill', name: 'the old mill', kind: 'place', parent: 'village' }],
  zones: [
    { key: 'mill_yard', place: 'mill', name: 'mill yard', look: 'a weedy yard before a sagging mill', cover: 1, light: 0,
      links: [{ to: 'field_edge', label: 'back to the field', sight: true }, { to: 'mill_race', label: 'down to the race', sight: false }] },
    { key: 'mill_race', place: 'mill', name: 'mill race', look: 'a choked stone channel', cover: 1, light: 1,
      links: [{ to: 'mill_yard', label: 'up to the yard', sight: false }, { to: 'mill_pond', label: 'along the race', sight: false }] },
  ],
  frontiers: [{ key: 'mill_pond', label: 'along the race' }],
  bands: [], cast: [], seeds: { plans: [], triggers: [], secrets: [] }, rewards: [],
  hiddenTerms: ['nest'], weaverNote: 'the slimes come from the pond',
};
