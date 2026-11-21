// BG-186: a bow held in 'grip:' slots shoots; a carried one named in an attack is drawn first (DS7); an attack with a
// weapon that is gone comes to nothing ("not in hand") instead of becoming a punch.
import { afterEach, expect, it } from 'vitest';
import { actor, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { CONFIG, resetConfig } from '../../src/config';
import { getLibrary } from '../../src/library';
import { loadStory, memoryStore, saveTurn } from '../../src/save';
import { IT } from '../../src/library/itemIds';
import { AM } from '../../src/library/tableIds';
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

it('BG-186: a bow held in both grips is in hand, and the shot is a shot', () => {
  const s = archer(['grip:right_arm', 'grip:left_arm']);
  const ev = shoot(s);
  expect(ev.map((e) => e.kind)).not.toContain('move'); // no walking up to the target for a punch
  expect(ev.find((e) => e.kind === 'attack')).toMatchObject({ itemId: 'bow' });
});

it('MG2: a save older than OLDEST_SAVE_SCHEMA is refused with its reason', async () => {
  const st = memoryStore(), old = archer([]);
  CONFIG.SCHEMA_VERSION = CONFIG.OLDEST_SAVE_SCHEMA - 1;
  await saveTurn(st, old, { storyId: old.storyId, turn: 0, libraryVersion: old.libraryVersion, rngBefore: 0, playerInput: '', agentLog: [], events: [], factsAdded: [] });
  resetConfig();
  const err = await loadStory(st, old.storyId, getLibrary()).catch((e) => e);
  expect(String(err.message)).toContain(`made ${CONFIG.OLDEST_SAVE_REASON}`);
});

it('DS2/DS7: a carried bow named in an attack is drawn at no cost and shot, never a punch', () => {
  const s = archer([]); // the bow is only carried
  const ev = shoot(s);
  expect(ev.map((e) => e.kind)).not.toContain('move');
  expect(ev.find((e) => e.kind === 'attack')).toMatchObject({ itemId: 'bow' });
});

it('BG-186: an attack with a weapon that is not on them comes to nothing and says why, with no walk up for a punch', () => {
  const s = archer([]);
  s.player.core.inventory = s.player.core.inventory.filter((i) => i.id !== 'bow'); // gone
  const ev = shoot(s);
  expect(ev.map((e) => e.kind)).toEqual(['wasted']);
  expect(ev[0]).toMatchObject({ reason: 'not_in_hand' });
});
