import { afterEach, expect, it, vi } from 'vitest';
import type { Intent, RollRequest } from '../../src/types';
import { makeVillage, actor, createRng } from '../harness';
import { ruleset, tierName } from '../../src/ruleset';
import { computePending, resolveTurn } from '../../src/engine';
import { isActive } from '../../src/engine/relations';

afterEach(() => vi.restoreAllMocks());

it('23 Silent kill: nobody else perceives the attack; the next turn is Explore', () => {
  const s = makeVillage({ playerZone: 'field_mid', without: ['guard_1', 'trader', 'patron_1', 'slime_2'] });
  const slime = actor(s, 'slime_1');
  slime.core.condition.hpLostPct = 99.9;
  vi.spyOn(ruleset, 'roll').mockImplementation((req: RollRequest) => {
    const t = req.actorId === 'player' ? 5 : 0;
    return { actorId: req.actorId, skill: req.skill, d100: 50, margin: 0, tierIndex: t, tier: tierName(t), natural: 0, modifiers: [], tierShifts: [] };
  });
  const intent: Intent = {
    move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
    action: { type: 'attack', skill: 'melee_medium', target: 'slime_1', targetPart: null, item: 'player_arming_sword_1', mode: 'cut', approach: 'a quick cut', stance: 'normal' },
  };
  resolveTurn(s, { intent, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(s.rngState));
  expect(isActive(slime)).toBe(false);
  expect(computePending(s).mode).toBe('explore');
});
