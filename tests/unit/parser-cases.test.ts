// TQ4 support, in every CI run: the nightly Parser set's cases name only ids the test village shows the Parser, and no
// check passes on a failed call (no intent, no clarify), so a village change or a broken call is not a fake Parser bug.
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { CASES } from '../parser-eval/cases';
import { makeVillage } from '../harness';
import { buildPlayerView } from '../../src/views';

describe('Parser set cases (TQ4)', () => {
  it('every id a case names is in the village PlayerView', () => {
    const view = JSON.stringify(buildPlayerView(makeVillage()));
    const ids = [...new Set([...(readFileSync('tests/parser-eval/cases.ts', 'utf8') as string).matchAll(/'([a-z]+(?:_[A-Za-z0-9]+)+)'/g)].map((m) => m[1]))];
    expect(ids.length).toBeGreaterThan(3);
    expect(ids.filter((id) => !view.includes(`"${id}"`))).toEqual([]);
  });
  it('no check passes when the call failed (no intent and no clarify)', () => {
    expect(CASES.filter((c) => c.check({ intent: null, clarify: null }) === null).map((c) => c.line)).toEqual([]);
  });
});
