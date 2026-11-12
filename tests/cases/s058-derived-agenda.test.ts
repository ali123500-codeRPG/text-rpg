// 58 Derived agenda: an NPC voiced by the Voice gains a plan; from then on it has an agenda (the pipeline routes it
// to the Responder); no save field holds hasAgenda.
import { expect, it } from 'vitest';
import { actor, makeVillage } from '../harness';
import { hasAgenda } from '../../src/engine/relations';
import { act, play, plannerOut } from './w4-kit';

it('58 Derived agenda', () => {
  const s = makeVillage({ playerZone: 'tav_counter' });
  expect(hasAgenda(s, 'trader')).toBe(false); // Voice
  actor(s, 'trader').mind!.overrides = { player: 'hostile' };
  actor(s, 'trader').mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_counter', lastSeenTurn: 1, source: 'seen', revealed: [] };
  play(s, { agentOutputs: [plannerOut('trader', act('hold'), { planUpdate: { goal: 'get rid of the swordsman', steps: ['wait'], triggers: [], memoryNote: 'he asked about the cellar', routine: null } })] });
  expect(s.hidden.plans.trader).toMatchObject({ goal: 'get rid of the swordsman' });
  expect(hasAgenda(s, 'trader')).toBe(true); // Responder from now on
  expect(JSON.stringify(s)).not.toContain('hasAgenda');
});
