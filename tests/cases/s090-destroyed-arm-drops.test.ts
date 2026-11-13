// 90 Destroyed arm drops: a Destroyed sword arm puts the sword on the zone's ground; an observer perceives an
// item_dropped event; pick up returns it.
import { AM } from '../../src/library/tableIds';
import { IT } from '../../src/library/itemIds';
import type { Tier } from '../../src/types';
import { afterEach, expect, it, vi } from 'vitest';
import { actor, makeVillage, place } from '../harness';
import { ruleset } from '../../src/ruleset';
import type { AttackRequest, AttackResult, RollResult } from '../../src/types';
import { intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';

afterEach(() => vi.restoreAllMocks());

const roll = (actorId: string, skill: string, tier: Tier): RollResult =>
  ({ actorId, skill, d100: 90, margin: 40, tier, natural: 0, modifiers: [], tierShifts: [] });

it('90 Destroyed arm drops', () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  const g = place(s, 'guard_1', 'tav_common');
  g.mind!.slots!.post = 'tav_common'; // keep the guard here (its routine would walk it back to the gate first)
  g.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: 1, source: 'seen', revealed: [] };
  g.core.condition.parts.right_arm = 1; // one more hit there destroys it
  const sword = `guard_1_${IT.arming_sword}_1`;
  expect(g.core.inventory.find((i) => i.id === sword)!.equippedIn).toEqual(['grip:right_arm']);
  // force the blow onto the sword arm; damage still goes through the real applyEffects
  vi.spyOn(ruleset, 'attack').mockImplementationOnce((req: AttackRequest): AttackResult => ({
    attack: roll(req.attackerId, SK.melee_medium, 'critical_success'), defense: roll(req.targetId, SK.block, 'failure'), defenseType: 'block',
    gap: -4, gapShifts: [], outcome: 'heavy_hit', location: 'right_arm', locationHow: 'aimed', multiplier: 1.5, damage: 30,
    deciding: { attack: [], defense: [], gap: [] }, attackerId: req.attackerId, targetId: req.targetId, weaponId: req.weaponId, modeId: req.modeId ?? AM.cut,
  }));
  const ev = play(s, { intent: intent({ action: { type: 'attack', target: 'guard_1', skill: SK.melee_medium, targetPart: 'right_arm' } }), aimed: true });
  const drop = ev.find((e) => e.kind === 'item_dropped');
  expect(drop).toMatchObject({ actorId: 'guard_1', itemId: sword, zone: 'tav_common' });
  expect(drop!.perception.patron_1 ?? drop!.perception.player).toBeTruthy();
  expect(s.zones.find((z) => z.id === 'tav_common')!.groundItems.map((i) => i.id)).toContain(sword);
  play(s, { intent: intent({ gear: [{ op: 'pick_up', item: sword }] }) });
  expect(s.player.core.inventory.some((i) => i.id === sword)).toBe(true);
  expect(actor(s, 'guard_1').core.inventory.some((i) => i.id === sword)).toBe(false);
});
