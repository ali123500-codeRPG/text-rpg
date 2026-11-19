// D-361 (PV1-PV13): one stance rule for every agent that may step a stance, where a colder step is a grudge judged by personality
import { expect, it } from 'vitest';
import { PLANNER_INSTRUCTIONS, RESPONDER_INSTRUCTIONS, VOICE_INSTRUCTIONS } from '../../src/agents/prompts';

it('Planner, Responder and Voice share one stance rule, with no fixed provocation list', () => {
  for (const p of [PLANNER_INSTRUCTIONS, RESPONDER_INSTRUCTIONS, VOICE_INSTRUCTIONS]) {
    expect(p).toContain('A colder step\n   is a grudge you will carry after this moment');
    expect(p).toContain('Take it as your CHARACTER would');
    expect(p).not.toContain('Step colder only\n   for a real provocation');
  }
});
