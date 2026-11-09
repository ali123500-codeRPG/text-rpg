// 84 No numbers to the Narrator: the combat packet in NarrationView holds no roll, margin, damage, pool or HP value (unit test).
import { IT } from '../../src/library/itemIds';
import type { Tier } from '../../src/types';
import { expect, it } from 'vitest';
import type { AttackResult, GameEvent, RollResult } from '../../src/types';
import { makeVillage, place, createRng } from '../harness';
import { computePerception } from '../../src/perception';
import { buildNarrationView } from '../../src/views';
import { SK } from '../../src/library/skillIds';

const roll = (actorId: string, tier: Tier, d100: number, margin: number): RollResult =>
  ({ actorId, skill: SK.melee_medium, d100, margin, tier, natural: 0, modifiers: [{ source: 'wounds', type: 'wounds', value: -15 }], tierShifts: [{ source: 'perk', value: 1 }] });

it('84 No numbers to the Narrator', () => {
  const s = makeVillage();
  place(s, 'guard_1', 'tav_common');
  s.actors.find((a) => a.id === 'guard_1')!.core.condition.hpLostPct = 37;
  const result: AttackResult = {
    attack: roll('player', 'great_success', 87, 13.5), defense: roll('guard_1', 'near_miss', 61, -4.25), defenseType: 'block', gap: -2, gapShifts: [{ source: 'cover', value: 1 }],
    outcome: 'heavy_hit', location: 'general', locationHow: 'rolled', multiplier: 1.75, damage: 23,
    deciding: { attack: ['arming sword'], defense: ['round shield'], gap: [] },
    attackerId: 'player', targetId: 'guard_1', weaponId: `player_${IT.arming_sword}_1`, modeId: 'cut',
  };
  const e: GameEvent = { id: 'evt_hit', turn: 1, actorId: 'player', kind: 'attack', zone: 'tav_common', target: 'guard_1', tier: 'great_success', effects: [{ kind: 'damage', actorId: 'guard_1', data: { hp: 23, pool: 44 } }], noise: 'normal', visibility: 'normal', perception: {}, attack: result };
  e.perception = computePerception(e, s, createRng(1));
  const v = buildNarrationView(s, [e], null);
  const packet = v.events[0].packet!;
  expect(packet.outcome).toBe('heavy hit');
  const text = JSON.stringify(packet);
  expect(text).not.toMatch(/\d/);
  for (const k of ['d100', 'margin', 'damage', 'multiplier', 'pool', 'hp', 'gap', 'tierIndex', 'modifiers']) expect(text).not.toContain(`"${k}"`);
  const all = JSON.stringify(v);
  for (const n of ['87', '13.5', '4.25', '61', '1.75', '23', '44', '37']) expect(all).not.toContain(n);
});
