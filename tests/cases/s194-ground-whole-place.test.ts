// 194 BG-43 and BG-44 (playtest run 43). A scenario's ground covers every zone of each place it touches, so following someone
// into the back room ends nothing; a Weaver "leave this place" ending counts only once the player is also off the ground.
// D-217 a: the ground is outlines (roads add none), and leaving it also needs GROUND_APART_TURNS turns out of touch with
// everyone the scenario brought.
import { describe, expect, it } from 'vitest';
import { makeVillage, place, withRoad } from '../harness';
import { checkScenarioEnd, frameOf } from '../../src/engine/scenarioEnd';
import { groundSpaces, noteApart, offGround } from '../../src/engine/chase';
import { CONFIG } from '../../src/config';

describe('194 ground is whole places', () => {
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
    for (let i = 0; i < CONFIG.GROUND_APART_TURNS; i++) noteApart(s); // D-217 a: off the outlines and out of touch long enough
    checkScenarioEnd(s, []);
    expect(s.stage.breakCause).toBe('scenario_end');
    expect(s.log.some((l) => l.code === 'scenario_ending_met')).toBe(true); // the Weaver's ending, not the code's ground check
  });

  const apart = (s: ReturnType<typeof makeVillage>, n = CONFIG.GROUND_APART_TURNS) => { for (let i = 0; i < n; i++) noteApart(s); };

  it('D-217 a: on the doorstep, in touch with someone the scenario brought, the player has not left; out of touch for long enough, it has', () => {
    const s = makeVillage({ playerZone: 'street_door' });
    s.stage.scenario = { ...frameOf(s, { question: 'q', scale: 'situation', endings: [] }, 'success', (_k, r) => r), ground: ['tav_common'], people: ['trader'] };
    place(s, 'trader', 'street_door');
    apart(s);
    expect(s.stage.scenario.apart).toBeUndefined();
    expect(offGround(s).off).toBe(false);
    s.actors = s.actors.filter((a) => a.id !== 'trader'); // gone from the stage: nobody of it is left to see or hear the player
    apart(s, CONFIG.GROUND_APART_TURNS - 1);
    expect(offGround(s).off).toBe(false);
    apart(s, 1);
    expect(offGround(s).off).toBe(true);
    place(s, 'player', 'tav_cellar'); // back inside the outlines: on the ground at once
    expect(offGround(s).off).toBe(false);
  });

  it('D-217 a: a road adds no outline, so walking away down the road leaves a road scenario', () => {
    const s = withRoad(5);
    place(s, 'player', 'north_road');
    s.stage.scenario = { ...frameOf(s, { question: 'q', scale: 'situation', endings: [] }, 'success', (_k, r) => r), ground: ['north_road'] };
    apart(s);
    expect(offGround(s).off).toBe(true);
    const spaces = groundSpaces(s, ['north_road', 'gate_inner']).map((z) => z.id); // the gate's place has outlines; the road adds none
    expect(spaces).toContain('gate_inner');
    expect(spaces).not.toContain('north_road');
  });
});
