// 317 BF69 (BG-245): an exhausted NPC woken in danger stays awake and acts. Collapsing from exhaustion keeps the same guards
// as falling asleep by routine: not within FALL_ASLEEP_MIN of waking, nor while alarmed, engaged or held. Once it is calm and
// that long has passed, exhaustion takes it again.
import { expect, it } from 'vitest';
import type { GameState } from '../../src/types';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { actorById } from '../../src/engine/relations';
import { passiveFatigue } from '../../src/engine/fatigue';
import { wake } from '../../src/engine/sleep';
import { barMax } from '../../src/ruleset/fatigue';
import { advanceClock } from '../../src/time';

const pass = (s: GameState, minutes: number) => { advanceClock(s, minutes); passiveFatigue(s, minutes); };

it('317 woken exhausted in danger: stays up while alarmed, collapses again once calm', () => {
  const s = makeVillage({ playerZone: 'tav_cellar', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  const p = actorById(s, 'patron_1')!;
  const max = barMax(p);
  p.core.condition.fatigue = { debt: max, line: 0, awake: max };
  p.asleep = { since: 0 };
  wake(s, p, 'noise'); // a shout in the fight
  p.mind!.alarm = { armed: true };
  pass(s, 1);
  expect(p.asleep).toBeUndefined(); // just woken and alarmed: stays up
  pass(s, CONFIG.FALL_ASLEEP_MIN);
  expect(p.asleep).toBeUndefined(); // still alarmed: stays up however long
  p.mind!.alarm = { armed: false }; // safe and calm
  pass(s, 1);
  expect(p.asleep).toBeDefined(); // exhaustion takes it again
  // just woken, calm: not straight back down, only after FALL_ASLEEP_MIN
  wake(s, p, 'noise');
  pass(s, 1);
  expect(p.asleep).toBeUndefined();
  pass(s, CONFIG.FALL_ASLEEP_MIN);
  expect(p.asleep).toBeDefined();
});
