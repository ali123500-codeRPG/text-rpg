// 357 BG-287 (BF94 a): run 16's opening ending "the common room is cleared" had to be judged: the slimes there came from
// several bands and band_out checks one. A "clear" ending is met once nobody hostile to the player still stands in the
// place (down, broken or gone, from any band), and only after a foe has stood there in this scenario.
import { describe, expect, it } from 'vitest';
import type { GameState, PlanEnding } from '../../src/types';
import { makeVillage } from '../harness';
import { checkScenarioEnd, foesIn, frameOf } from '../../src/engine/scenarioEnd';
import { stance } from '../../src/engine/relations';

const frame = (s: GameState, endings: PlanEnding[]) => (s.stage.scenario = frameOf(s, { question: 'q', scale: 'situation', endings }, 'success', (_k, r) => r));
const clear = (place: string): PlanEnding => ({ when: { kind: 'clear', place }, as: 'resolved', text: 'cleared' });

describe('357 BG-287: a clear ending', () => {
  it('is met once every foe standing in the place is down or broken, whatever their band', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    const foes = foesIn(s, 'field');
    expect(foes.length).toBeGreaterThan(0);
    expect(foes.every((a) => stance(s, a, s.player) === 'hostile')).toBe(true);
    frame(s, [clear('field')]);
    checkScenarioEnd(s, []);
    expect(s.stage.ending).toBeUndefined(); // foes still stand there
    expect(s.stage.scenario!.hadFoes).toEqual(['field']);
    foes.forEach((a, i) => { if (i % 2) a.mind!.moraleState = 'broken'; else a.core.condition.hpLostPct = 105; });
    checkScenarioEnd(s, []);
    expect(s.stage.ending ?? s.stage.ended).toMatchObject({ as: 'resolved', text: 'cleared' });
  });

  it('a place where no foe has stood this scenario is not cleared', () => {
    const s = makeVillage({ playerZone: 'field_mid' });
    expect(foesIn(s, 'tav_common')).toEqual([]);
    frame(s, [clear('tav_common')]);
    checkScenarioEnd(s, []);
    expect(s.stage.ending).toBeUndefined();
    expect(s.stage.ended).toBeUndefined();
  });
});
