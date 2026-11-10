import { AM } from '../../src/library/tableIds';
import { IT } from '../../src/library/itemIds';
import type { Tier } from '../../src/types';
import { afterEach, expect, it, vi } from 'vitest';
import type { Intent, RollRequest } from '../../src/types';
import { makeVillage, actor, createRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { computePending, resolveTurn } from '../../src/engine';
import { isActive } from '../../src/engine/relations';
import { SK } from '../../src/library/skillIds';

afterEach(() => vi.restoreAllMocks());

it('23 Silent kill: nobody else perceives the attack; the next turn is Explore', () => {
  const s = makeVillage({ playerZone: 'field_mid', without: ['guard_1', 'trader', 'patron_1', 'slime_2'] });
  const slime = actor(s, 'slime_1');
  slime.core.condition.hpLostPct = 99.9;
  vi.spyOn(ruleset, 'roll').mockImplementation((req: RollRequest) => {
    const tier: Tier = req.actorId === 'player' ? 'critical_success' : 'critical_failure';
    return { actorId: req.actorId, skill: req.skill, d100: 50, margin: 0, tier, natural: 0, modifiers: [], tierShifts: [] };
  });
  const intent: Intent = {
    move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
    action: { type: 'attack', skill: SK.melee_medium, target: 'slime_1', targetPart: null, item: `player_${IT.arming_sword}_1`, mode: AM.cut, approach: 'a quick cut', stance: 'normal' },
  };
  resolveTurn(s, { intent, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(s.rngState));
  expect(isActive(slime)).toBe(false);
  expect(computePending(s).mode).toBe('explore');
});
