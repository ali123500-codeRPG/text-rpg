// BG-60: an NPC's beliefs carry the other person's pronouns, so it speaks of someone out of sight as they are.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { buildActorView } from '../../src/views';
import { actorById } from '../../src/engine/relations';

it('BG-60: beliefs about someone out of sight carry their pronouns', () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  actorById(s, 'trader')!.pronouns = 'she';
  actorById(s, 'guard_1')!.mind!.knowledge.trader = { status: 'aware', source: 'heard', revealed: [] };
  const b = buildActorView(s, 'guard_1').beliefs.find((x) => x.about === 'trader');
  expect(b?.pronouns).toBe('she');
});
