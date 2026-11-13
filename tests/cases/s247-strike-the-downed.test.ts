// BG-162 (run 90c t45): the player stood 1 m from a downed slime and attacked it unarmed; fists reach 0.7 m, and the
// closing in skipped anyone down while the blow itself may strike them (BG-25), so it was wasted as out of reach. One rule:
// whoever can be struck is closed in on. And going through a body by hand is a search, never an attack (Parser rule 15).
import { expect, it } from 'vitest';
import { beside, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { healthLevel } from '../../src/ruleset';
import { PARSER_INSTRUCTIONS } from '../../src/agents/prompts';

it('a downed foe out of fist reach is closed in on and struck', () => {
  const s = makeVillage({ playerZone: 'field_mid', without: ['slime_2', 'guard_1', 'trader', 'patron_1'] });
  s.player.core.inventory = s.player.core.inventory.filter((i) => !i.equippedIn?.some((x) => x.startsWith('grip:')));
  const t = beside(s, 'slime_1', 'player', 1);
  t.core.condition.hpLostPct = 105;
  expect(healthLevel(t)).not.toBe('dead');
  const ev = play(s, { intent: intent({ action: { type: 'attack', target: t.id } }) });
  expect(ev.some((e) => e.actorId === 'player' && e.kind === 'wasted')).toBe(false);
  expect(ev.some((e) => e.actorId === 'player' && e.kind === 'attack')).toBe(true);
  expect(PARSER_INSTRUCTIONS).toContain('Going through someone or their body by hand');
});
