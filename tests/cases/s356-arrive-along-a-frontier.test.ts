// 356 BG-286 (BF93 a): in deck playtest run 16 the causeway had two roads north-west: the first story's unbuilt frontier and
// a road zone the fifth hero's opening built beside it to arrive on. A plan zone keyed as a frontier on the stage now builds
// that frontier (it keeps the frontier's id and is joined to it, as when the player walks through), so the way is built once.
import { expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ScenarioDirector } from '../../src/scenario/director';
import { FITTING_GRADES, VirtualClock } from '../../src/scenario/fixtures';
import { MILL_PLAN } from './scenario-director';
import { TIERS } from '../../src/scales';
import { ZK } from '../../src/library/tableIds';
import { zoneById } from '../../src/engine/relations';
import type { GameState, StagePlan, WeaverView } from '../../src/types';

function newcomer(): GameState {
  const s = makeVillage();
  delete s.stage.scenario; delete s.stage.roam;
  s.player.zone = '';
  s.player.placeId = 'tavern';
  return s;
}
const plan = (view: WeaverView, more: Partial<StagePlan>): StagePlan => ({
  ...MILL_PLAN, places: [], zones: [], frontiers: [],
  event: { ...MILL_PLAN.event, ...FITTING_GRADES[TIERS.keyOf(view.tier)!] },
  episode: { ...MILL_PLAN.episode!, endings: [{ when: { kind: 'judged' }, as: 'resolved', text: 'the source is found' }, { when: { kind: 'judged' }, as: 'lost', text: 'given up' }] },
  scenario: { ...MILL_PLAN.scenario!, endings: [{ when: { kind: 'judged' }, as: 'resolved', text: 'settled' }, { when: { kind: 'leave', place: 'tavern' }, as: 'left', text: 'the player walks away' }] },
  ...more,
});

it('an arrival zone keyed as a frontier builds that frontier: one way in, the frontier\'s own, and the hero arrives on it', async () => {
  const s = newcomer();
  const label = zoneById(s, 'field_far')!.links.find((l) => l.to === 'woods' && l.frontier)!.label;
  const errors: string[][] = [];
  const d = new ScenarioDirector({ clock: new VirtualClock(), weave: async (view, errs) => {
    errors.push((errs ?? []).map((e) => e.code));
    expect(view.places.flatMap((p) => p.areas).flatMap((a) => a.links).some((l) => l.to === 'woods' && l.frontier)).toBe(true); // the Weaver sees the way
    return plan(view, { arriveAt: 'woods', zones: [{ key: 'woods', place: 'field', kind: ZK.yard, name: 'the woods path', look: 'a path under the trees', ways: [{ to: 'field_far', label: 'back out to the field' }] }] });
  } });
  await d.startScenario(s, forcedRng([50, 50, 50, 50]));
  expect(errors).toEqual([[]]); // accepted at once
  const ways = zoneById(s, 'field_far')!.links.filter((l) => l.to === 'woods');
  expect(ways).toEqual([expect.objectContaining({ to: 'woods', label })]);
  expect(ways[0].frontier).toBeUndefined();
  expect(zoneById(s, 'woods')!.name).toBe('the woods path');
  expect(s.zones.some((z) => z.id.startsWith('woods_'))).toBe(false); // no copy beside it
  expect(s.player.zone).toBe('woods');
});
