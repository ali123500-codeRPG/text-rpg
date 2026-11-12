// 183 Scenarios as situations (SC1-SC10): the scenario's question, scale and endings; endings checked every turn and held while
// fighting, chased or talking (SC13); records for the next Weaver (SC6); inner scenarios inside an Episode or Venture (SC4).
// Also BG-36: the Weaver schema kept only the fields it named, dropping layouts, heights and road lengths.
import { describe, expect, it } from 'vitest';
import type { GameEvent, GameState, PlanEnding } from '../../src/types';
import { makeVillage, actor, place } from '../harness';
import { checkScenarioEnd, closeScenario, endScenario, frameOf, scaleFor } from '../../src/engine/scenarioEnd';
import { validateStagePlan } from '../../src/scenario';
import { villageStagePlan } from '../../src/scenario/fixtures';
import { checkStagePlan } from '../../src/agents/schema';
import { buildWeaverView } from '../../src/views';
import { IT } from '../../src/library/itemIds';

const frame = (s: GameState, endings: PlanEnding[], scale = 'situation') =>
  (s.stage.scenario = frameOf(s, { question: 'q', scale, endings }, 'success', (_k, r) => r));
const holdCoin: PlanEnding = { when: { kind: 'hold', item: IT.coin }, as: 'resolved', text: 'paid' };
const speak = (s: GameState): GameEvent => ({ id: 'e1', turn: s.turn, kind: 'speak', actorId: 'player', target: 'trader', effects: [], noise: 'normal', visibility: 'normal', perception: {} } as unknown as GameEvent);

describe('183 scenario endings (SC1-SC13)', () => {
  it('an ending met on a clear turn ends the scenario', () => {
    const s = makeVillage();
    frame(s, [holdCoin, { when: { kind: 'judged' }, as: 'lost', text: 'x' }]);
    checkScenarioEnd(s, []);
    expect(s.stage.breakCause).toBe('scenario_end');
    expect(s.stage.ended).toMatchObject({ as: 'resolved', text: 'paid' });
  });

  it('SC13: held while fighting, while chased and while talking; ends on the first clear turn', () => {
    const s = makeVillage();
    frame(s, [holdCoin]);
    const slime = actor(s, 'slime_1');
    slime.mind!.knowledge.player = { status: 'engaged', source: 'seen', revealed: [] } as never;
    checkScenarioEnd(s, []);
    expect(s.stage.breakCause).toBeUndefined();
    expect(s.stage.ending).toMatchObject({ as: 'resolved' });
    expect(s.log.at(-1)).toMatchObject({ code: 'scenario_ending_held', detail: { why: 'fight' } });
    // a chase: someone hunting the player who is not a foe in a fight
    s.bands.find((b) => b.id === 'slimes')!.relations.player_band = 'opposed';
    slime.mind!.knowledge.player = { status: 'hunting', source: 'seen', revealed: [] } as never;
    checkScenarioEnd(s, []);
    expect(s.log.at(-1)).toMatchObject({ code: 'scenario_ending_held', detail: { why: 'chase' } });
    delete slime.mind!.knowledge.player;
    checkScenarioEnd(s, [speak(s)]);
    expect(s.log.at(-1)).toMatchObject({ code: 'scenario_ending_held', detail: { why: 'talk' } });
    checkScenarioEnd(s, []);
    expect(s.stage.breakCause).toBe('scenario_end');
  });

  it('a band is out when every member is down, broken or gone', () => {
    const s = makeVillage();
    frame(s, [{ when: { kind: 'band_out', band: 'slimes' }, as: 'resolved', text: 'beaten' }]);
    actor(s, 'slime_1').core.condition.hpLostPct = 100;
    checkScenarioEnd(s, []);
    expect(s.stage.ending).toBeUndefined();
    actor(s, 'slime_2').mind!.moraleState = 'broken';
    checkScenarioEnd(s, []);
    expect(s.stage.ended?.as).toBe('resolved');
  });

  it('leaving a place needs being in it first', () => {
    const s = makeVillage({ playerZone: 'field_edge' });
    frame(s, [{ when: { kind: 'leave', place: 'tavern' }, as: 'left', text: 'walked out' }]);
    checkScenarioEnd(s, []);
    expect(s.stage.ending).toBeUndefined();
    place(s, 'player', 'tav_common');
    checkScenarioEnd(s, []);
    expect(s.stage.ending).toBeUndefined();
    place(s, 'player', 'field_edge');
    checkScenarioEnd(s, []);
    expect(s.stage.ended?.as).toBe('left');
  });

  it('SC4/SC6: an encounter inside an Episode is an inner scenario; when it ends the Episode carries on, and both are recorded', () => {
    const s = makeVillage();
    frame(s, [{ when: { kind: 'judged' }, as: 'resolved', text: 'x' }], 'episode');
    const outerNo = s.stage.scenario!.number;
    s.stage.breakCause = 'encounter';
    expect(closeScenario(s)).toBe('new');
    expect(s.stage.outer?.number).toBe(outerNo);
    expect(s.hidden.scenarios?.at(-1)).toMatchObject({ ending: 'interrupted', scale: 'episode' });
    s.stage.scenarioNumber += 1;
    frame(s, [holdCoin], 'moment');
    endScenario(s, 'resolved', 'paid');
    expect(closeScenario(s)).toBe('resume');
    expect(s.stage.breakCause).toBeUndefined();
    expect(s.stage.scenario?.number).toBe(outerNo);
    expect(s.stage.outer).toBeUndefined();
    expect(s.hidden.scenarios?.at(-1)).toMatchObject({ ending: 'resolved', scale: 'moment', inner: true });
    const v = buildWeaverView(s, { kind: 'scenario', placeId: s.player.placeId });
    expect(v.lastScenarios.map((r) => r.ending)).toEqual(['interrupted', 'resolved']);
  });

  it('a Situation is not interrupted into an inner scenario: an encounter ends it', () => {
    const s = makeVillage();
    frame(s, [holdCoin], 'situation');
    s.stage.breakCause = 'encounter';
    expect(closeScenario(s)).toBe('new');
    expect(s.stage.outer).toBeUndefined();
  });
});

describe('183 scenario plans (SC2, SC3, SC7)', () => {
  const ctx = { tier: 'success' as const, kind: 'scenario' as const, placeId: 'village' };
  it('a scenario plan needs its question, a known scale and two or three endings that name real things', () => {
    const s = makeVillage();
    const p = villageStagePlan();
    delete p.scenario;
    expect(validateStagePlan(s, p, ctx).map((e) => e.code)).toContain('scenario_missing');
    const q = villageStagePlan();
    q.scenario!.endings = [q.scenario!.endings[0]];
    expect(validateStagePlan(s, q, ctx).map((e) => e.code)).toContain('scenario_endings');
    const r = villageStagePlan();
    r.scenario!.endings[0].when = { kind: 'band_out', band: 'nobody' };
    expect(validateStagePlan(s, r, ctx).find((e) => e.code === 'scenario_ending')).toMatchObject({ routineOnly: true });
  });
  it('code raises a scale too small for the plan\'s places', () => {
    expect(scaleFor(3, 'moment')).toBe('episode');
    const s = makeVillage();
    const p = villageStagePlan();
    p.scenario!.scale = 'moment';
    expect(validateStagePlan(s, p, ctx).find((e) => e.code === 'scenario_scale_raised')).toMatchObject({ repaired: true });
    expect(p.scenario!.scale).toBe('episode');
  });
  it('a frontier extension needs no scenario', () => {
    const s = makeVillage();
    const p = villageStagePlan();
    delete p.scenario;
    expect(validateStagePlan(s, p, { ...ctx, kind: 'extension', frontierKey: 'x' }).map((e) => e.code)).not.toContain('scenario_missing');
  });
});

describe('183 BG-36: the Weaver schema keeps every field it may give', () => {
  it('layouts, names, heights, sizes, edges, road lengths and dangers, and the scenario, reach the validator', () => {
    const v = checkStagePlan({
      event: { summary: 's', challenge: 'none', gain: 'none' },
      places: [{ key: 'p', name: 'n', kind: 'tavern', parent: null, layout: 'L', names: { a: 'b' }, looks: { a: 'c' } }],
      zones: [{ key: 'z', place: 'p', kind: 'k', name: 'n', look: 'l', height: 3, size: 'small', area: 20, edges: { n: 'wall' }, length: 4, danger: 'wild', links: [] }],
      frontiers: [], bands: [], cast: [], seeds: { plans: [], triggers: [], secrets: [] }, rewards: [], hiddenTerms: [], weaverNote: '',
      scenario: { question: 'q', scale: 'moment', endings: [] },
    });
    expect(v.errors).toEqual([]);
    expect(v.value.places[0]).toMatchObject({ layout: 'L', names: { a: 'b' }, looks: { a: 'c' } });
    expect(v.value.zones[0]).toMatchObject({ height: 3, size: 'small', area: 20, edges: { n: 'wall' }, length: 4, danger: 'wild' });
    expect(v.value.scenario).toMatchObject({ question: 'q' });
  });
});
