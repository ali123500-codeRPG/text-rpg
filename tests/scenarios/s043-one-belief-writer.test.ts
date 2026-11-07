// 43 One belief writer: opening beliefs on open entry are written through updateBeliefs only (unit test).
import { expect, it } from 'vitest';
import { makeVillage, actor } from '../harness';
import { updateBeliefs } from '../../src/perception';

// every source file as text (Vite glob; no node types in this project)
const sources = (import.meta as unknown as { glob: (p: string, o: object) => Record<string, string> })
  .glob('../../src/**/*.ts', { query: '?raw', import: 'default', eager: true });

it('43 One belief writer', () => {
  const s = makeVillage();
  s.turn = 4;
  updateBeliefs(s, { kind: 'opening', observerId: 'guard_1', aboutId: 'player', status: 'suspicious', zone: 'tav_common' });
  expect(actor(s, 'guard_1').mind!.knowledge.player).toEqual({ status: 'suspicious', source: 'seen', lastKnownZone: 'tav_common', lastSeenTurn: 4, revealed: [] });
  // no source file outside src/perception assigns into Mind.knowledge
  expect(Object.keys(sources).length).toBeGreaterThan(10);
  const writers = Object.entries(sources)
    .filter(([f]) => !f.includes('/src/perception/'))
    .filter(([, text]) => /knowledge(\s*\[[^\]]*\]|\.\w+)\s*(=[^=>]|\?\?=)|\.knowledge\s*=[^=]|Object\.assign\([^)]*knowledge/.test(text))
    .map(([f]) => f);
  expect(writers).toEqual([]);
});
