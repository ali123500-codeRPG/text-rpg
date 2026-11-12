// BG-45: the Narrator closed a bracket it never opened ("text":"…"],"narrated":[…]) (playtest run 44); the tolerant parser drops it.
import { describe, expect, it } from 'vitest';
import { parseTolerant } from '../../src/agents/client';

describe('BG-45 stray closing bracket', () => {
  it('a ] or } that closes nothing open is dropped; brackets inside strings are kept', () => {
    expect(parseTolerant('{"text":"You look [close]."],"narrated":["t1.1","t1.2"]}')).toEqual({ ok: true, value: { text: 'You look [close].', narrated: ['t1.1', 't1.2'] } });
    expect(parseTolerant('{"a":[1,2}],"c":"x \\"]\\" y"}')).toEqual({ ok: true, value: { a: [1, 2], c: 'x "]" y' } });
  });
});
