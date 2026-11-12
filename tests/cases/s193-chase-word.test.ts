// 193 From playtest run 42 (BG-40): the Weaver wrote a band's chase as the name its schema shows ("Ground"); the schema kept
// the raw word and the validator refused the plan, so every first plan that followed the schema cost a whole retry.
import { describe, expect, it } from 'vitest';
import type { StagePlan } from '../../src/types';
import { checkStagePlan } from '../../src/agents/schema';

const plan = (chase: string): StagePlan => ({
  event: { summary: 's', challenge: 'minor', gain: 'minor' }, places: [], frontiers: [], rewards: [], hiddenTerms: [], weaverNote: '',
  zones: [], cast: [], seeds: { plans: [], triggers: [], secrets: [] },
  bands: [{ key: 'b', name: 'Band', goals: 'g', temperament: 't', tactics: 'cautious', relations: {}, chase } as never],
});

describe('193 a band chase written as its name (BG-40)', () => {
  it('"Ground" is read as the key ground', () => {
    const r = checkStagePlan(plan('Ground'));
    expect(r.value.bands[0].chase).toBe('ground');
  });
  it('a key stays a key', () => {
    expect(checkStagePlan(plan('far')).value.bands[0].chase).toBe('far');
  });
});
