// BF4 (BG-121): Marda said "follow me round to the kitchen", walked there and went straight back to her counter as the
// player came in. A head_to walk an NPC makes leading someone (lead) waits at the end until they come, or
// LEAD_WAIT_TURNS pass, before it goes back to its routine.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { act, plannerOut, play, intent } from './w4-kit';

const setUp = () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'patron_1'] });
  const m = s.actors.find((a) => a.id === 'trader')!;
  m.mind!.control = 'agent';
  play(s, { agentOutputs: [plannerOut(m.id, act('hold'), { headTo: 'tav_cellar', lead: s.player.id })] });
  m.mind!.control = 'code';
  for (let i = 0; i < 6 && m.zone !== 'tav_cellar'; i++) play(s);
  expect(m.zone).toBe('tav_cellar');
  return { s, m };
};

describe('BF4 a walk that leads someone waits for them', () => {
  it('waits LEAD_WAIT_TURNS for someone who does not come, then goes back to its routine', () => {
    const { s, m } = setUp();
    for (let i = 0; i < CONFIG.LEAD_WAIT_TURNS - 1; i++) { play(s); expect(m.mind!.routine?.id).toBe('head_to'); expect(m.zone).toBe('tav_cellar'); }
    play(s);
    expect(m.mind!.routine?.id).not.toBe('head_to');
  });
  it('ends the wait when the one it leads arrives', () => {
    const { s, m } = setUp();
    play(s, { intent: { ...intent({ move: { toZone: 'tav_cellar' } }), action: null } });
    expect(s.player.zone).toBe('tav_cellar');
    expect(m.mind!.routine?.id).not.toBe('head_to');
    expect(m.mind!.leading).toBeUndefined();
  });
});
