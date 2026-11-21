// 347 BG-273 (BF82 a): a new character carried into a fallen character's world finds the settlement as it was left. Before
// the Weaver plans, the settlement around the start place (its top-level place and every place inside it) is in its view
// with everyone in it (WI8 a: the whole built world is live); the Weaver's view lists them and says a newcomer arrives. A plan that declares a place or area
// already on the stage again is refused (the copies were tavern_2, causeway_2, marda_2). WT16 a: the newcomer is placed
// before the Weaver plans (the start place's first title), and the view says where they stand.
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ScenarioDirector } from '../../src/scenario/director';
import { FITTING_GRADES, VirtualClock } from '../../src/scenario/fixtures';
import { MILL_PLAN } from './scenario-director';
import { TIERS } from '../../src/scales';
import { ZK } from '../../src/library/tableIds';
import type { GameState, StagePlan, WeaverView } from '../../src/types';

/** a new character standing nowhere yet at the tavern of a village with a past (carryOn) */
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
/** the copy the bug made: the inn and its common room declared again */
const again = (view: WeaverView) => plan(view, {
  places: [{ key: 'tavern', name: 'The Crooked Kettle', kind: 'place', parent: 'village' }],
  zones: [{ key: 'tav_common', place: 'tavern', kind: ZK.yard, name: 'common room', look: 'tables and a hearth', ways: [{ to: 'street_door', label: 'the door', kind: 'door' }] }],
});

describe('347 BG-273: a newcomer finds the village as it was left', () => {
  it('the newcomer stands in the inn before the Weaver plans; it sees the settlement and its people; a copy is refused', async () => {
    const s = newcomer();
    const places0 = s.places.map((p) => p.id), zones0 = s.places.flatMap((p) => p.zones.map((z) => z.id));
    const calls: { view: WeaverView; errors: string[] }[] = [];
    const d = new ScenarioDirector({ clock: new VirtualClock(), weave: async (view, errors) => {
      calls.push({ view, errors: (errors ?? []).map((e) => e.code) });
      return calls.length === 1 ? again(view) : plan(view, {});
    } });
    await d.startScenario(s, forcedRng([50, 50, 50, 50]));
    const v = calls[0].view;
    expect(v.target.arrive).toBe(true);
    expect(v.player.standsIn?.area).toBe('tav_common'); // WT16 a: placed before the Weaver plans
    expect(v.places.map((p) => p.id)).toEqual(expect.arrayContaining(['tavern', 'street', 'gate', 'field'])); // the village itself has no areas of its own
    const inn = v.places.find((p) => p.id === 'tavern')!;
    expect(inn.areas.map((a) => a.id)).toContain('tav_common');
    expect(inn.people.length).toBeGreaterThan(0); // the people still there
    expect(calls[1].errors).toEqual(expect.arrayContaining(['place_exists', 'zone_exists'])); // the copy is sent back
    expect(s.player.zone).toBe('tav_common');
    expect(s.places.map((p) => p.id)).toEqual(places0); // no tavern_2
    expect(s.places.flatMap((p) => p.zones.map((z) => z.id))).toEqual(zones0); // no tav_common_2
  });

});
