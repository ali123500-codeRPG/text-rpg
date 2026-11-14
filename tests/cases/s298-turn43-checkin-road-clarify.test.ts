// Playtest, turns 43-44. BG-222: the Weaver's check-in pointed the scenario's ending at Corwin's own sword, an item made in
// play (IT26_m39_0), and the check threw it out because it looked only in the base catalogue. BG-223: the Weaver is told road
// lengths in words ("an hour's walk") but only the code keys passed, so every length in words was refused. BG-224: the
// clarifying question named the ways out to places not built yet, and those couldn't be tapped.
import { describe, expect, it } from 'vitest';
import type { GameState, PlanEnding } from '../../src/types';
import { makeVillage } from '../harness';
import { checkinPlanErrors } from '../../src/scenario/checkin';
import { mint } from '../../src/scenario/apply';
import { frameOf, checkScenarioEnd } from '../../src/engine/scenarioEnd';
import { validateStagePlan } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { ROAD_LENGTHS } from '../../src/scales';
import { clarifyPicks } from '../../src/ui/play';
import { getLibrary } from '../../src/library';

const judged: PlanEnding[] = [{ when: { kind: 'judged' }, as: 'resolved', text: 'x' }, { when: { kind: 'judged' }, as: 'lost', text: 'y' }];
const framed = (): GameState => {
  const s = makeVillage({ without: ['slime_1', 'slime_2'] });
  s.stage.scenario = frameOf(s, { question: 'q', scale: 'moment', endings: judged }, 'success', (_k, r) => r);
  return s;
};

describe('BG-222: endings that name an item made in play', () => {
  it('a check-in may point a hold or deliver ending at a made item, and holding it ends the scenario', () => {
    const s = framed();
    const sword = mint(s, { base: 'IT26', name: 'an old basket-hilted sword', look: 'worn', quality: 'quality_1' } as never, 0);
    const endings: PlanEnding[] = [
      { when: { kind: 'hold', item: sword }, as: 'resolved', text: 'takes the sword' },
      { when: { kind: 'deliver', item: sword, to: 'trader' }, as: 'resolved', text: 'gives it on' },
    ];
    expect(checkinPlanErrors(s, { verdict: 'continue', change: { endings } })).toEqual([]);
    // an item nobody knows is still refused
    expect(checkinPlanErrors(s, { verdict: 'continue', change: { endings: [{ ...endings[0], when: { kind: 'hold', item: 'IT26_m99_9' } }, endings[1]] } }).join(' ')).toMatch(/IT26_m99_9 unknown/);
    s.stage.scenario = frameOf(s, { question: 'q', scale: 'moment', endings: [endings[0], judged[1]] }, 'success', (_k, r) => r);
    checkScenarioEnd(s, []);
    expect(s.stage.breakCause).toBeUndefined(); // not held yet
    s.player.core.inventory.push({ itemId: sword, qty: 1 } as never);
    checkScenarioEnd(s, []);
    expect(s.stage.breakCause).toBe('scenario_end');
    expect(s.log.find((l) => l.code === 'scenario_ending_met')?.detail).toMatchObject({ as: 'resolved' });
  });
});

describe('BG-223: road lengths in the words the Weaver is told', () => {
  const road = (length: unknown) => {
    const lib = getLibrary();
    const roadKind = Object.entries(lib.zoneKinds ?? {}).find(([, k]) => (k as { road?: boolean }).road)![0];
    const p = villageStagePlan();
    const z = p.zones[0] as { kind: string; length?: unknown };
    z.kind = roadKind; z.length = length;
    const errs = validateStagePlan(toStoryStart(makeVillage()), p, { tier: 'success', kind: 'scenario', placeId: 'tavern' });
    return { errs: errs.filter((e) => !e.repaired && e.code === 'bad_zone' && /length/.test(e.message)), z };
  };
  it('every word passes and reads as its key; "2 km" reads as km; anything else is still refused', () => {
    for (const k of ROAD_LENGTHS.keys) {
      const r = road(ROAD_LENGTHS.name(k));
      expect(r.errs).toEqual([]);
      expect(r.z.length).toBe(k);
    }
    expect(road('hour').z.length).toBe('hour');
    expect(road('2 km').z.length).toBe(2);
    expect(road(3.5).errs).toEqual([]);
    expect(road('a fortnight').errs).toHaveLength(1);
  });
});

describe('BG-224: the ways out a clarifying question names can be tapped', () => {
  it('ways out to places not built yet are picks by their labels', () => {
    const pv = { actors: [], zones: [{ name: 'the high lane' }], zone: { groundItems: [], links: [
      { to: 'high_lane', label: 'the lane back toward the Bent Nail' }, { to: 'road_east', label: 'the east road out of the village', frontier: true },
      { to: 'mill_lane', label: 'a lane down toward the mill stream', frontier: true },
    ] }, player: { inventory: [] } } as never;
    const t = 'Which way do you take as the exit: the east road out of the village, the lane down toward the mill stream, or back along the high lane toward the Bent Nail?';
    expect(clarifyPicks(t, pv).map((p) => p.phrase)).toEqual(['the east road out of the village', 'the lane down toward the mill stream', 'the high lane']);
  });
});
