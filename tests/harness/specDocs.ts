// The build spec is an index (docs/build-spec.md) and one file per topic under docs/spec/, linked from the index in
// reading order. A test that reads "the spec" reads all of it, in that order.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { specFiles } from '../../scripts/spec';

export { SPEC_INDEX, specFiles } from '../../scripts/spec';
export const BUG_LOG = 'docs/spec/bug-log.md';
export const BUG_LOGS = [BUG_LOG, 'docs/spec/bug-log-archive.md']; // open rows, then closed ones

const read = (f: string) => readFileSync(f, 'utf8') as string;

export const readSpec = (): string => specFiles().map(read).join('\n');
