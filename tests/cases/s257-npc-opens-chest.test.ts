// BG-173 (run 79d t33): Ness was told to open her shut chest first, but "open" was missing from the NPC action list the
// schema checks and the prompts show, so she could only send use_item with nothing. One rule: the prompts' action list is
// built from NPC_ACTIONS, which has open, and an NPC's open works as the player's.
import { expect, it } from 'vitest';
import { beside, makeVillage } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';
import { zoneById, actorById } from '../../src/engine/relations';
import { PLANNER_SHAPE, VOICE_SHAPE } from '../../src/agents/prompts';
import { NPC_ACTIONS } from '../../src/types';
import { IT } from '../../src/library/itemIds';
import { checkPlanner } from '../../src/agents/schema';

it('an NPC can open a chest, and every NPC action is in the prompts', () => {
  expect(checkPlanner({ action: act('open', 'box'), dialogue: null, gear: null, stance: null, planUpdate: null }).errors).toEqual([]);
  for (const t of NPC_ACTIONS) { expect(PLANNER_SHAPE).toContain(`"${t}"`); expect(VOICE_SHAPE).toContain(`"${t}"`); }
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const wim = actorById(s, 'patron_1')!;
  wim.mind!.control = 'agent';
  zoneById(s, 'tav_common')!.groundItems.push({ id: 'box', itemId: IT.chest, at: { x: s.player.pos!.x + 2, y: s.player.pos!.y }, contents: [{ id: 'roll', itemId: IT.bandage }] } as never);
  beside(s, 'patron_1', 'player', 2.3);
  play(s, { intent: intent(), agentOutputs: [plannerOut('patron_1', act('open', 'box'))] });
  expect(zoneById(s, 'tav_common')!.groundItems.find((g) => g.id === 'box')!.open).toBe(true);
});
