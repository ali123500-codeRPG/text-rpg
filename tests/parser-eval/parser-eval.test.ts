// TQ4: the Parser test set against the real model, nightly only: PARSER_EVAL=1 and a signed-in `claude` CLI
// (CI: CLAUDE_CODE_OAUTH_TOKEN). Each line is parsed by today's Parser prompt and legality on the test village; a case
// that misses twice in a row fails, so one odd answer is not a red night.
import { describe, expect, it } from 'vitest';
import type { ClaudeClient } from '../../src/types';
import { callParser, parseTolerant } from '../../src/agents';
import { VirtualClock } from '../../src/agents';
import { buildPlayerView } from '../../src/views';
import { makeVillage } from '../harness';
import { TIER_MODEL, claudeCli } from '../../scripts/claude-cli';
import { CASES, type Parsed } from './cases';

// @ts-expect-error Node types are not installed; vitest runs in Node
const ON = process.env.PARSER_EVAL === '1';
const client: ClaudeClient = {
  async call(req) {
    const r = await claudeCli(req.input.map((m) => m.content).join('\n\n'), req.model ?? TIER_MODEL[req.modelTier ?? 'default'], req.effort);
    if (r.error) return { ok: false, error: 'upstream_error', message: r.error };
    const p = parseTolerant(r.text);
    return p.ok ? { ok: true, value: p.value } : { ok: false, error: 'invalid_json', message: 'no JSON value in the reply' };
  },
};

async function parse(line: string): Promise<Parsed> {
  const s = makeVillage();
  const r = await callParser(line, buildPlayerView(s), { client, clock: new VirtualClock(), turn: 1, log: () => {} });
  return { intent: r.intent, clarify: r.clarify };
}

describe.skipIf(!ON)('Parser test set (TQ4, nightly)', () => {
  it.concurrent.each(CASES)('$line', async ({ line, bug, check }) => {
    let miss: string | null = null, got: Parsed | null = null;
    for (let t = 0; t < 2; t++) {
      got = await parse(line);
      miss = check(got);
      if (!miss) return;
    }
    expect.fail(`${bug ? `${bug}: ` : ''}"${line}" should give ${miss}; got ${JSON.stringify(got)}`);
  }, 300_000);
});
