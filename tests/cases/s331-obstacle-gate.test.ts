// OD1 b, OD10 a, OD12 a (questions page "Obstacle difficulty"): a lock is the first graded thing on the obstacle rule.
// A grade OBSTACLE_SURE_GAP or more below the picker's effective skill opens with no roll; more than OBSTACLE_REACH_GAP
// above it is out of reach with no roll; in between the roll takes SE23's grade modifier. Trying to pick shows the grade.
import { describe, expect, it } from 'vitest';
import type { Barrier, GameState, Intent } from '../../src/types';
import { createRng, forcedRng, makeVillage } from '../harness';
import { resolveTurn } from '../../src/engine';
import { zoneById } from '../../src/engine/relations';
import { gradeMod, obstacleGate } from '../../src/ruleset';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { BK } from '../../src/library/tableIds';
import { setBarrier } from '../harness';

const intent = (p: Partial<Intent>): Intent => ({ move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, action: null, ...p });
const pick = intent({ action: { type: 'pick', skill: '', target: 'street_door', targetPart: null, item: null, mode: null, approach: '' } });
const turn = (s: GameState, rng = createRng(1)) => { s.turn += 1; return resolveTurn(s, { intent: pick, aimed: false, agentOutputs: [], spokespeople: [] }, rng); };
function setup(grade: Barrier['grade']): { s: GameState; b: Barrier } {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'patron_1', 'trader'] });
  s.player.core.skills[SK.filching] = { raw: 50, state: 'normal' };
  const b: Barrier = { id: 'front_door', kind: BK.door, grade, lock: { locked: true } };
  (s.barriers ??= {})[b.id] = b;
  setBarrier(s, 'tav_common', 'street_door', b.id);
  return { s, b };
}
const picked = (s: GameState, rng?: ReturnType<typeof createRng>) => turn(s, rng).find((e) => e.kind === 'pick')!;

describe('331 obstacle gate on locks (OD1 b, OD10 a, OD12 a)', () => {
  it('the gate reads only the gap, so it is the same at 50 and at 300', () => {
    expect([obstacleGate(50, 25), obstacleGate(50, 26), obstacleGate(50, 75), obstacleGate(50, 76)]).toEqual(['sure', 'roll', 'roll', 'out']);
    expect([obstacleGate(300, 275), obstacleGate(300, 326)]).toEqual(['sure', 'out']);
  });
  it('a lock far below the picker opens with no roll, even on a die that would fumble', () => {
    const { s, b } = setup('none'); // 20 against effective 50
    const ev = picked(s, forcedRng([50, 1]));
    expect(ev.way!.did).toBe('picked');
    expect(ev.roll).toBeUndefined();
    expect(b.lock!.locked).toBe(false);
  });
  it('in between, the roll takes the one grade modifier (OD10 a), not a lock table', () => {
    const { s } = setup('major');
    const ev = picked(s, forcedRng([50, 50]));
    expect(ev.roll!.modifiers.find((m) => m.source === 'lock')!.value).toBe(gradeMod(CONFIG.DIFFICULTY.major));
  });
});
