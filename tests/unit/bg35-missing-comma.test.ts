// BG-35: the Narrator left out the comma before "narrated" (playtest run 40); the tolerant parser puts it back.
import { describe, expect, it } from 'vitest';
import { parseTolerant } from '../../src/agents/client';

describe('BG-35 missing comma between JSON members', () => {
  it('after a string, an array, an object, a number or a literal', () => {
    expect(parseTolerant('{"text":"You step in. \\"Who\\" asks.""narrated":["t70.2","t70.3"]}')).toEqual({ ok: true, value: { text: 'You step in. "Who" asks.', narrated: ['t70.2', 't70.3'] } });
    expect(parseTolerant('{"a":[1] "b":{"c":2}\n "d":3 "e":true "f":null}')).toEqual({ ok: true, value: { a: [1], b: { c: 2 }, d: 3, e: true, f: null } });
  });
  it('valid JSON and an empty string are left alone', () => {
    expect(parseTolerant('{"a":"","b":"x"}')).toEqual({ ok: true, value: { a: '', b: 'x' } });
  });
});
