// 289 BG-193: "punch him" with a sword in hand struck with the sword. The view listed no fists, so the Parser named the
// sword's skill; now the body's own attacks are listed (player and NPCs) and a punch names its mode, with no item.
import { expect, it } from 'vitest';
import { actor, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { AM } from '../../src/library/tableIds';
import { IT } from '../../src/library/itemIds';
import { buildPlayerView } from '../../src/views';
import { checkParserLegality } from '../../src/agents/legality';

const tavern = () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const t = actor(s, 'trader');
  t.zone = 'tav_common';
  t.pos = { ...s.player.pos! };
  for (const i of s.player.core.inventory) if (i.equippedIn?.some((e) => e.startsWith('grip:')) && i.itemId !== IT.arming_sword) i.equippedIn = []; // the sword stays, the shield hand is free
  return s;
};

it('BG-193: a punch names the fists by mode, passes the Parser checks, and lands as fists, not the sword in hand', () => {
  const s = tavern();
  const punch = intent({ action: { type: 'attack', target: 'trader', mode: AM.punch, targetPart: 'head' } as never });
  const legal = checkParserLegality(punch, buildPlayerView(s));
  expect(legal.illegal).toEqual([]);
  expect(legal.intent.action?.mode).toBe(AM.punch);
  const hit = play(s, { intent: punch }).find((e) => e.actorId === 'player' && e.kind === 'attack');
  expect(hit).toMatchObject({ itemId: `natural:${AM.punch}` });
});

