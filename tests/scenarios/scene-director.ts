// Shared by tests 44 and 45: scene setup inside a triggering turn, live (one Weaver call through Claude) and replayed
// (the logged Weaver outputs, no call). Mirrors what the pipeline does: each Weaver call is one agent-log entry.
import type { AgentTurnLog, ClaudeClient, GameEvent, GameState, Rng, SituationResult, StagePlan, TurnRecord } from '../../src/types';
import { SceneDirector, replaySceneStart } from '../../src/scene/director';
import { openingEvents } from '../../src/scene';
import { FITTING_GRADES, VirtualClock } from '../../src/scene/fixtures';
import { TIERS } from '../../src/scales';

export type SceneDirectorApi = {
  runSceneSetup(state: GameState, deps: { claude: ClaudeClient; rng: Rng }): Promise<{ situation: SituationResult; events: GameEvent[]; agentLog: AgentTurnLog[] }>;
  replaySceneSetup(state: GameState, record: TurnRecord, rng: Rng): GameEvent[];
};

const director: SceneDirectorApi = {
  async runSceneSetup(state, { claude, rng }) {
    const agentLog: AgentTurnLog[] = [];
    const d = new SceneDirector({
      clock: new VirtualClock(),
      weave: async (view, errors) => {
        const r = await claude.call({ agent: 'weaver', input: [{ role: 'user', content: 'WEAVER' }, { role: 'user', content: JSON.stringify({ view, errors }) }], json: true });
        const output = r.ok ? (r.value as StagePlan) : null;
        agentLog.push({ turn: state.turn, agent: 'weaver', input: view, output, status: r.ok ? 'ok' : 'failed', errors: [] });
        return output;
      },
    });
    const res = await d.startScene(state, rng);
    const events = openingEvents(state, rng);
    return { situation: res.situation!, events, agentLog };
  },
  replaySceneSetup(state, record, rng) {
    const outputs = record.agentLog.filter((l) => l.agent === 'weaver').map((l) => (l.output as StagePlan | null) ?? null);
    replaySceneStart(state, outputs, rng);
    return openingEvents(state, rng);
  },
};

export async function loadDirector(): Promise<SceneDirectorApi> {
  return director;
}

/** A small valid plan for the village: an old mill outside the gate, one frontier, no cast. */
export const MILL_PLAN: StagePlan = {
  event: { summary: 'slime tracks lead toward the old mill', challenge: 'moderate', gain: 'moderate' },
  places: [{ key: 'mill', name: 'the old mill', kind: 'place', parent: 'village' }],
  zones: [
    { key: 'mill_yard', place: 'mill', name: 'mill yard', look: 'a weedy yard before a sagging mill', cover: 'some', light: 'bright',
      links: [{ to: 'field_edge', label: 'back to the field', sight: true }, { to: 'mill_race', label: 'down to the race', sight: false }] },
    { key: 'mill_race', place: 'mill', name: 'mill race', look: 'a choked stone channel', cover: 'some', light: 'dim',
      links: [{ to: 'mill_yard', label: 'up to the yard', sight: false }, { to: 'mill_pond', label: 'along the race', sight: false }] },
  ],
  frontiers: [{ key: 'mill_pond', label: 'along the race' }],
  bands: [], cast: [], seeds: { plans: [], triggers: [], secrets: [] }, rewards: [],
  hiddenTerms: ['nest'], weaverNote: 'the slimes come from the pond',
};

/** a scripted Weaver answer: MILL_PLAN with grades that fit whatever tier the situation roll dealt */
export function millWeaver(req: import('../../src/types').ClaudeRequest): import('../../src/types').ClaudeResponse {
  const tier = (JSON.parse(req.input[1].content) as { view: { tier: string } }).view.tier;
  return { ok: true, value: { ...MILL_PLAN, event: { ...MILL_PLAN.event, ...FITTING_GRADES[TIERS.keyOf(tier)!] } } };
}
