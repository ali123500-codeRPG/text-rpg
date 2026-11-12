// 194 BG-43 and BG-44 (playtest run 43). A scenario's ground covers every zone of each place it touches, so following someone
// into the back room ends nothing; a Weaver "leave this place" ending counts only once the player is also off the ground.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { checkScenarioEnd, frameOf } from '../../src/engine/scenarioEnd';
import { offGround } from '../../src/engine/chase';

describe('194 ground is whole places', () => {
  it('BG-43: a zone of a place the ground touches is on the ground, though no plan named it', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    s.stage.scenario = { ...frameOf(s, { question: 'q', scale: 'situation', endings: [] }, 'success', (_k, r) => r), ground: ['tav_common'] };
    place(s, 'player', 'tav_cellar');
    expect(offGround(s).off).toBe(false);
    checkScenarioEnd(s, []);
    expect(s.stage.ending).toBeUndefined();
    place(s, 'player', 'street_door');
    expect(offGround(s).off).toBe(true);
  });

  it('BG-44: a leave ending waits while the player is still on the ground, and fires once off it', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    const endings = [{ as: 'left', text: 'walked out', when: { kind: 'leave' as const, place: 'tavern' } }];
    s.stage.scenario = { ...frameOf(s, { question: 'q', scale: 'situation', endings }, 'success', (_k, r) => r), ground: ['tav_common', 'street_door'] };
    checkScenarioEnd(s, []);
    place(s, 'player', 'street_door');
    checkScenarioEnd(s, []);
    expect(s.stage.ending).toBeUndefined();
    expect(s.stage.breakCause).toBeUndefined();
    expect(s.log.some((l) => l.code === 'scenario_ending_met')).toBe(false);
    place(s, 'player', 'gate_inner');
    checkScenarioEnd(s, []);
    expect(s.stage.breakCause).toBe('scenario_end');
    expect(s.log.some((l) => l.code === 'scenario_ending_met')).toBe(true); // the Weaver's ending, not the code's ground check
  });
});
