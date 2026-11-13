// BG-175 (run 79e t33-34): Ness's view showed her shut chest as `container: {}`, not saying it was shut, and her own
// wasted use_item and give (no_item) reached her with no reason, so she tried the same again. One rule: a shut container
// says shut in every view, and a mind's own wasted action carries its reason in its next view.
import { expect, it } from 'vitest';
import { beside, makeVillage } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';
import { zoneById, actorById } from '../../src/engine/relations';
import { buildActorView } from '../../src/views';
import { IT } from '../../src/library/itemIds';

it('an NPC sees its chest is shut and why its last action came to nothing', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  actorById(s, 'patron_1')!.mind!.control = 'agent';
  zoneById(s, 'tav_common')!.groundItems.push({ id: 'box', itemId: IT.chest, at: { x: s.player.pos!.x + 2, y: s.player.pos!.y }, contents: [{ id: 'roll', itemId: IT.bandage }] } as never);
  beside(s, 'patron_1', 'player', 1);
  play(s, { intent: intent(), agentOutputs: [plannerOut('patron_1', { ...act('use_item', 'player'), item: null })] });
  const v = buildActorView(s, 'patron_1');
  expect(v.zones.flatMap((z) => z.groundItems).find((g) => g.id === 'box')!.container).toMatchObject({ shut: true });
  expect(v.perceived.find((e) => e.kind === 'wasted' && e.actorId === 'patron_1')?.reason).toBe('no_item');
});
