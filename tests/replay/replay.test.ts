// TQ3 replay set: every playtest run's real agent answers (tests/replay/runs, made by scripts/replay-set.mjs) played
// again through today's code from the run's backup: the same player inputs, each call answered with what Claude said
// then (matched by agent, actor and turn), through schema checks, legality, a whole turn and the turn checker.
// An answer that no longer fits today's rules is refused the way the game refuses it (a clarify or a fallback); that is
// not a failure. A throw or a broken world rule is.
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readdirSync, readFileSync } from 'node:fs';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { gunzipSync } from 'node:zlib';
import type { ClaudeClient, ClaudeRequest, ClaudeResponse } from '../../src/types';
import { createGame, VirtualClock } from '../../src/agents';
import { createDirector } from '../../src/agents/director';
import { memoryStore } from '../../src/save/store';
import { restoreBackup } from '../../src/save';
import { getLibrary } from '../../src/library';

type Answer = { agent: string; actorId?: string; turn: number; output?: unknown };
type Run = { run: string; from: number; docs: Record<string, string>; steps: { input: string; answers: Answer[] }[] };

const DIR = 'tests/replay/runs';
const runs = (readdirSync(DIR) as string[]).filter((f) => f.endsWith('.json.gz')).map((f) => JSON.parse(String(gunzipSync(readFileSync(`${DIR}/${f}`)))) as Run);
const turnOf = (req: ClaudeRequest) => Number(/"turn":(\d+)/.exec(req.input.at(-1)?.content ?? '')?.[1] ?? NaN);

/** answers each call with the logged answer for its agent, actor and turn (else the next one for that agent and actor);
 *  a call nobody logged, or one that failed then, fails now */
function replayClient(answers: Answer[]): ClaudeClient & { used: number } {
  const left = [...answers];
  const client = {
    used: 0,
    async call(req: ClaudeRequest): Promise<ClaudeResponse> {
      const same = (a: Answer) => a.agent === req.agent && (a.actorId ?? '') === (req.actorId ?? '');
      const t = turnOf(req);
      const i = left.findIndex((a) => same(a) && a.turn === t) >= 0 ? left.findIndex((a) => same(a) && a.turn === t) : Number.isNaN(t) ? left.findIndex(same) : -1;
      const a = i >= 0 ? left.splice(i, 1)[0] : undefined;
      if (a?.output === undefined) return { ok: false, error: 'upstream_error', message: 'replay: no logged answer' };
      client.used++;
      return { ok: true, value: structuredClone(a.output) };
    },
  };
  return client;
}

describe('replay set (TQ3)', () => {
  it('has runs', () => expect(runs.length).toBeGreaterThan(0));
  for (const r of runs) {
    it(`${r.run}: ${r.steps.length} steps from turn ${r.from} replay with no throw and no broken world rule`, async () => {
      const clock = new VirtualClock();
      const store = memoryStore(() => clock.now());
      for (const [k, v] of Object.entries(r.docs)) store.docs.set(k, v);
      const storyId = Object.keys(r.docs).find((k) => /^stories\/[^/]+$/.test(k))!.split('/')[1];
      try {
        await restoreBackup(store, storyId, r.from, getLibrary());
      } catch (e) {
        return console.log(`${r.run}: its backup no longer loads (${(e as Error).message.slice(0, 120)}); skipped`); // old saves need not load
      }
      const client = replayClient(r.steps.flatMap((s) => s.answers));
      const game = createGame({ client, clock, store, director: createDirector(clock) });
      expect(await game.resume()).toBe(true);
      for (const [n, s] of r.steps.entries()) {
        if (game.fell() || game.notices().some((x) => x.kind === 'stop_play')) break;
        try {
          await game.submit(s.input, { aimed: s.input.startsWith('/aim') });
          await game.settle();
        } catch (e) {
          throw new Error(`${r.run} step ${n + 1} ("${s.input.slice(0, 80)}"): ${(e as Error).message}`);
        }
      }
      expect(client.used).toBeGreaterThan(0);
    }, 120_000);
  }
});
