// BG-128: the Weaver gave Wren a trigger "pick $player" (try the newcomer's purse); it fired as a lock pick at the
// player and resolved as a wasted "no lock". A pick opens a lock on a way: its target is a zone, never a person, for
// a plan's trigger, an NPC's agent and the player alike (taking from someone is filch).
import { expect, it } from 'vitest';
import { triggerErrors } from '../../src/scenario/triggers';

it('BG-128: a trigger that picks a person is refused, one that picks a way is kept', () => {
  const refs = { isZone: (r: string) => r === 'tav_cellar', isActor: (r: string) => r === 'wren' };
  const t = (target: string) => ({ id: 'try_purse', ownerId: 'wren', when: { type: 'quiet_turns' as const, turns: 3 }, then: { type: 'pick', target, skill: null, intent: 'try the purse' }, once: true });
  expect(triggerErrors(t('$player') as never, refs).join()).toMatch(/never a person/);
  expect(triggerErrors(t('wren') as never, refs).join()).toMatch(/never a person/);
  expect(triggerErrors(t('tav_cellar') as never, refs)).toEqual([]);
});
