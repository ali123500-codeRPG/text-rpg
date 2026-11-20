// npm test runs most files in one shared module load (vitest.shared.config.ts). A file that replaces a module with
// vi.mock would leak its stand-in into the files after it, so every such file must be on MOCKED, which runs isolated.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readdirSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { MOCKED } from '../../vitest.shared.config';

it('every test file that uses vi.mock runs isolated, and MOCKED lists no other file', () => {
  const files = (readdirSync('tests', { recursive: true }) as string[])
    .filter((f) => f.endsWith('.test.ts'))
    .map((f) => `tests/${f.split('\\').join('/')}`);
  const mocking = files.filter((f) => /\bvi\.(do)?[mM]ock\(/.test(readFileSync(f, 'utf8'))).sort();
  expect(mocking).toEqual([...MOCKED].sort());
});
