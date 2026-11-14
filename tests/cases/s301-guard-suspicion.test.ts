// 301 GD1-GD6 ("Breaking things open, guards and locked boxes"): a guard whose search turns up a locked container on
// someone suspects them (one step colder, remembered, shown to its agent) until it is opened where the guard sees inside
// (nothing it is after: cleared and the step given back; stolen or forbidden goods: caught) or the suspect wins a
// Persuasion or Lying contest against it. It lasts until cleared or the scenario ends; anyone can be suspected. A code-run
// guard keeps close and asks to see inside.
import { expect, it } from 'vitest';
import type { GameState } from '../../src/types';
import { actor, beside, forcedRng, makeVillage } from '../harness';
import { resolveSpeech, selectSpokespeople } from '../../src/engine';
import { act, intent, play, plannerOut } from './w4-kit';
import { buildActorView } from '../../src/views';
import { stance } from '../../src/engine/relations';
import { beginScenario } from '../../src/scenario/apply';
import { suspect } from '../../src/engine/suspicion';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';
import { STANCES } from '../../src/scales';

const setup = (inside: { id: string; itemId: string; stolenFrom?: string }[] = [{ id: 'cup', itemId: IT.curio }]) => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
  const g = beside(s, 'guard_1', 'player', 0.5);
  g.mind!.knowledge.player = { status: 'aware', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  s.player.core.inventory.push({ id: 'box', itemId: IT.sack, lock: { locked: true }, grade: 'minor', contents: inside.map((i) => ({ ...i, qty: 1 })) } as never,
    { id: 'box_key', itemId: IT.key, opens: ['box'] } as never);
  s.player.letsSearch = { by: g.id, until: s.turn + 3 };
  return { s, g };
};
const pos = (s: GameState, g: ReturnType<typeof setup>['g']) => STANCES.pos(stance(s, g, s.player) as never);
const searched = (s: GameState) => play(s, { intent: intent(), agentOutputs: [plannerOut('guard_1', act('search', 'player'))] });
const openBox = (s: GameState) => play(s, { intent: intent({ action: { type: 'open', target: 'box' } }) });

it('GD2/GD3: a guard whose search finds a locked container suspects its carrier, one step colder, and its agent is told', () => {
  const { s, g } = setup();
  const before = pos(s, g);
  searched(s);
  expect(g.mind!.suspects?.player?.box).toBe('box');
  expect(pos(s, g)).toBe(before - 1);
  expect(s.hidden.memory.guard_1?.some((m) => /locked sack/.test(m.text))).toBe(true);
  expect(buildActorView(s, g.id).self.suspects).toEqual([{ id: 'player', name: expect.any(String), item: 'a locked sack' }]);
});

it('GD4 a: opened where the guard sees inside with nothing it is after: cleared, and the step comes back', () => {
  const { s, g } = setup();
  const before = pos(s, g);
  searched(s);
  openBox(s);
  expect(g.mind!.suspects?.player).toBeUndefined();
  expect(pos(s, g)).toBe(before);
});

it('GD1/GD4 a: stolen goods inside are caught; forbidden goods too', () => {
  const stolen = setup([{ id: 'ring', itemId: IT.signet_ring, stolenFrom: 'patron_1' }]);
  const before = pos(stolen.s, stolen.g);
  searched(stolen.s);
  openBox(stolen.s);
  expect(stolen.g.mind!.suspects?.player).toBeUndefined();
  expect(pos(stolen.s, stolen.g)).toBeLessThan(before - 1);
  expect(stolen.s.hidden.memory.guard_1?.some((m) => /caught .* steal/.test(m.text))).toBe(true);
  const banned = setup([{ id: 'blade', itemId: IT.dagger }]);
  banned.s.stage.forbidden = [IT.dagger];
  searched(banned.s);
  openBox(banned.s);
  expect(banned.s.hidden.memory.guard_1?.some((m) => /forbidden goods: a dagger/.test(m.text))).toBe(true);
});

it('GD4 b: winning a Persuasion contest against the guard clears it without opening', () => {
  const { s, g } = setup();
  searched(s);
  const i = intent({ action: { type: 'persuade', skill: SK.persuasion }, spoken: 'Only my mother\'s keepsakes, nothing more.', addressees: ['guard_1'] });
  resolveSpeech(s, i, selectSpokespeople(s, i), forcedRng([100, 1])); // natural 00 for the player, 01 for the guard
  expect(g.mind!.suspects?.player).toBeUndefined();
});

it('GD5/GD6: it ends with the scenario, and anyone can be suspected', () => {
  const { s, g } = setup();
  searched(s);
  const t = actor(s, 'patron_1');
  suspect(s, g, t, { id: 'chest_x', itemId: IT.chest, lock: { locked: true } });
  expect(Object.keys(g.mind!.suspects!).sort()).toEqual(['patron_1', 'player']);
  beginScenario(s, 'success');
  expect(g.mind!.suspects).toBeUndefined();
});

it('GD3: a code-run guard keeps close to someone it suspects and asks to see inside', () => {
  const { s, g } = setup();
  searched(s);
  g.mind!.control = 'code';
  const ev = play(s, { intent: intent() });
  expect(ev.find((e) => e.actorId === 'guard_1' && e.line)?.line?.text).toMatch(/Open that sack/);
});
