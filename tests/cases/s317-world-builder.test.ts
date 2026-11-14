// 317 WB1-WB4, WB8: the World builder makes the world, the Weaver runs scenarios. Ground beyond a frontier is built by
// the World builder: its view has no tier and no story, its note is its own, and any story part it returns is dropped.
import { describe, expect, it, vi } from 'vitest';
import type { GameState, Intent, WeaverView, WorldView } from '../../src/types';
import { createRng, makeVillage } from '../harness';
import { resolveTurn } from '../../src/engine';
import { ScenarioDirector } from '../../src/scenario';
import { grovePlan, VirtualClock } from '../../src/scenario/fixtures';
import { headTo } from '../../src/minds';
import { FIXED } from '../../src/agents/prompts';
import { applyCheckinPlan } from '../../src/scenario/checkin';

const idle: Intent = { move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, action: null };
/** the guard waits at the field's far edge, heading into the unbuilt woods: its wait asks for the ground beyond */
function waiting(): GameState {
  const s = makeVillage({ playerZone: 'tav_cellar', without: ['slime_1', 'slime_2', 'patron_1'] });
  const g = s.actors.find((a) => a.id === 'guard_1')!;
  g.zone = 'field_far'; g.placeId = 'field'; delete g.pos;
  headTo(s, g, 'woods');
  s.turn += 1;
  resolveTurn(s, { intent: idle, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1));
  return s;
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('317 the World builder (WB1-WB4)', () => {
  it('builds frontier ground with no tier and its own note; story parts are dropped and logged; the Weaver is not asked', async () => {
    const s = waiting();
    s.hidden.weaverNote = 'the story so far';
    s.hidden.frontierBriefs = { woods: 'the clearing where the slimes breed' }; // WB3: the Weaver's brief
    const weave = vi.fn(async (_v: WeaverView) => grovePlan());
    const build = vi.fn(async (_v: WorldView) => ({ ...grovePlan(), weaverNote: 'birches thin toward the river' }));
    const d = new ScenarioDirector({ weave, build, clock: new VirtualClock() });
    expect(d.afterSave(s)).toEqual(['woods']);
    expect(weave).not.toHaveBeenCalled();
    const view = build.mock.calls[0][0] as unknown as Record<string, unknown>;
    for (const k of ['tier', 'stakes', 'ways', 'lastScenarios', 'outerScenario']) expect(view).not.toHaveProperty(k);
    expect(view.target).toMatchObject({ kind: 'frontier', frontierKey: 'woods', brief: 'the clearing where the slimes breed' });
    await flush();
    expect(d.applyBuiltAhead(s, createRng(1))).toEqual(['woods']);
    expect(s.zones.some((z) => z.name === 'a grove')).toBe(true);
    expect(s.hidden.worldNote).toBe('birches thin toward the river');
    expect(s.hidden.weaverNote).toBe('the story so far'); // the Weaver's note is not touched
    expect(s.log.find((l) => l.code === 'world_story_dropped')?.detail).toMatchObject({ dropped: ['scenario'], frontier: 'woods' });
  });

  it('WB3: a frontier the Weaver adds in a check-in keeps its brief for the World builder', () => {
    const s = waiting();
    applyCheckinPlan(s, { as: 'continue', frontiers: [{ zone: s.stage.zoneIds[0], key: 'trapdoor', label: 'a trapdoor', brief: 'the smugglers\' cellar' }] } as never, createRng(1));
    const id = s.zones.flatMap((z) => z.links).find((l) => l.label === 'a trapdoor')!.to;
    expect(s.hidden.frontierBriefs?.[id]).toBe('the smugglers\' cellar');
  });

  it('WB4: the roles keep their names; the World builder writes no story (WB2) and does not scale people to the hero', () => {
    expect(FIXED.world).toMatch(/World builder/);
    expect(FIXED.world).not.toMatch(/You are the Weaver/);
    expect(FIXED.region).toMatch(/World builder/);
    expect(FIXED.weaver).toMatch(/Weaver/);
  });
});
