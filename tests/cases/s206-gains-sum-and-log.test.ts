// 206 The gains moment's XP sum and the Gains page's log (M-39a, D-226): a scenario's XP comes with where it came from
// (foes defeated in one row, each achievement and quest alone), and every scenario that gave anything is kept on the
// character, with how it ended, for the Gains page.
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/types';
import { makeVillage } from '../harness';
import { awardXp } from '../../src/engine/xp';
import { closeScenario, endScenario, frameOf } from '../../src/engine/scenarioEnd';

const frame = (s: GameState) => (s.stage.scenario = frameOf(s, { question: 'q', scale: 'situation', endings: [] }, 'success', (_k, r) => r));
const end = (s: GameState) => { endScenario(s, 'resolved', ''); s.stage.breakCause = 'scenario_end' as never; return closeScenario(s); };

describe('206 the XP sum and the gains log', () => {

  it('keeps each scenario that gave something on the character, and none that gave nothing', () => {
    const s = makeVillage();
    frame(s);
    awardXp(s, 30, 'defeat:npc_a');
    s.turn += 1;
    end(s);
    const log = s.player.progression!.gainsLog!;
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ ending: 'resolved', endTurn: s.turn });
    expect(log[0].xp.gained).toBe(30);
    frame(s);
    s.turn += 1;
    end(s);
    expect(s.player.progression!.gainsLog).toHaveLength(1);
  });
});
