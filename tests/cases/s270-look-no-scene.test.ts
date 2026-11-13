// 270 SE15: Look around is a sight roll with light only. The scene's challenge grade no longer moves it: an Extreme
// scene used to cost −15 even in a bright, empty room. Guard: no roll in src carries a 'scenario difficulty' modifier.
import { afterEach, expect, it, vi } from 'vitest';
import { makeVillage } from '../harness';
import { bannedLines } from '../harness/guard';
import { intent, play } from './w4-kit';
import { ruleset } from '../../src/ruleset';
import { SK } from '../../src/library/skillIds';
import type { RollRequest } from '../../src/types';

afterEach(() => vi.restoreAllMocks());

it('SE15: Look around in an Extreme scene rolls with no scene modifier', () => {
  const s = makeVillage();
  s.hidden.stage.challenge = 'extreme';
  const reqs: RollRequest[] = [];
  const real = ruleset.roll;
  vi.spyOn(ruleset, 'roll').mockImplementation((req, st, rng) => (reqs.push(req), real(req, st, rng)));
  play(s, { intent: intent({ action: { type: 'observe', skill: SK.eyesight, target: null } }) });
  const look = reqs.find((r) => r.actorId === 'player' && r.skill === SK.eyesight)!;
  expect(look).toBeDefined();
  expect(look.modifiers.some((m) => /scen/i.test(m.source))).toBe(false);
});

it('guard: no roll takes a scenario difficulty modifier', () => {
  expect(bannedLines(/['"]scenario difficulty['"]/i)).toEqual([]);
});
