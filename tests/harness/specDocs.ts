// The build spec and the parts moved out of it, so a test that reads "the spec" reads all of it.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';

export const BUG_LOG = 'docs/bug-log.md', BUG_LOG_ARCHIVE = 'docs/bug-log-archive.md';
export const DECISION_LOG = 'docs/decision-log.md', DECISION_LOG_ARCHIVE = 'docs/decision-log-archive.md';
export const SPEC_DOCS = ['docs/build-spec.md', 'docs/case-tests.md', DECISION_LOG, DECISION_LOG_ARCHIVE, BUG_LOG, BUG_LOG_ARCHIVE];
export const readDocs = (...files: string[]) => files.map((f) => readFileSync(f, 'utf8') as string).join('\n');
