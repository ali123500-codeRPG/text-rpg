// BG-186: a story saved before held items moved to 'grip:' slots still shoots with the bow in hand once loaded, and an
// attack with a weapon that isn't in hand comes to nothing ("not in hand") instead of becoming a punch.
import { afterEach, expect, it } from 'vitest';
import { actor, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { CONFIG, resetConfig } from '../../src/config';
import { getLibrary } from '../../src/library';
import { loadStory, memoryStore, saveTurn } from '../../src/save';
import { handToGrip, LAND_SCHEMA } from '../../src/save/checks';
import { IT } from '../../src/library/itemIds';
import { AM } from '../../src/library/tableIds';
import { NARRATOR_INSTRUCTIONS } from '../../src/agents/prompts';
import type { GameState } from '../../src/types';

afterEach(() => resetConfig());

const archer = (slots: string[]) => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  actor(s, 'trader').zone = 'tav_common';
  s.player.core.inventory = s.player.core.inventory.filter((i) => !i.equippedIn?.some((e) => e.startsWith('grip:')));
  s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, qty: 1, equippedIn: slots } as never);
  return s;
};
const shoot = (s: GameState) => play(s, { intent: intent({ action: { type: 'attack', target: 'trader', item: 'bow', mode: AM.shoot, targetPart: 'left_leg' } as never }) })
  .filter((e) => e.actorId === 'player');

it('BG-186: a bow held in an old save (hand: slots) is in hand after the grip step, and the shot is a shot', () => {
  const s = archer(['hand:right_arm', 'hand:left_arm']);
  handToGrip(s.player.core.inventory); // the v7 -> v8 step, as it ran on load before the land
  expect(s.player.core.inventory.find((i) => i.id === 'bow')?.equippedIn).toEqual(['grip:right_arm', 'grip:left_arm']);
  const ev = shoot(s);
  expect(ev.map((e) => e.kind)).not.toContain('move'); // no walking up to the target for a punch
  expect(ev.find((e) => e.kind === 'attack')).toMatchObject({ itemId: 'bow' });
});

it('WZ12: a save from before the land is refused with a reason, and left as it was', async () => {
  const st = memoryStore(), old = archer([]);
  CONFIG.SCHEMA_VERSION = LAND_SCHEMA - 1;
  await saveTurn(st, old, { storyId: old.storyId, turn: 0, libraryVersion: old.libraryVersion, rngBefore: 0, playerInput: '', agentLog: [], events: [], factsAdded: [] });
  resetConfig();
  const err = await loadStory(st, old.storyId, getLibrary()).catch((e) => e);
  expect(String(err.message)).toContain('made before the land');
});

it('BG-186: an attack with a weapon that is not in hand comes to nothing and says why, with no walk up for a punch', () => {
  const s = archer([]); // the bow is only carried
  const ev = shoot(s);
  expect(ev.map((e) => e.kind)).toEqual(['wasted']);
  expect(ev[0]).toMatchObject({ reason: 'not_in_hand' });
  expect(NARRATOR_INSTRUCTIONS).toContain('a weapon not in hand');
});
