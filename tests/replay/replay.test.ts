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
import { TURN_CHECK } from '../../src/save/turnCheck';

type Answer = { agent: string; actorId?: string; turn: number; output?: unknown };
type Run = { run: string; from: number; head?: boolean; docs: Record<string, string>; steps: { input: string; answers: Answer[] }[] };

const DIR = 'tests/replay/runs';
/** "<run> step <n>" -> why today's rules refuse a line the run accepted */
const REFUSED_ON_PURPOSE: Record<string, string> = {};
const runs = (readdirSync(DIR) as string[]).filter((f) => f.endsWith('.json.gz')).map((f) => JSON.parse(String(gunzipSync(readFileSync(`${DIR}/${f}`)))) as Run);
const turnOf = (req: ClaudeRequest) => Number(/"turn":(\d+)/.exec(req.input.at(-1)?.content ?? '')?.[1] ?? NaN);

/** answers each call with the logged answer for its agent and actor from the step being replayed (else from the next
 *  step: a Planner runs in the background before the next input); a call nobody logged, or one that failed then, fails
 *  now. Matching by step, not turn number, keeps a replay in step with its log after a line today's rules refuse. */
function replayClient(steps: Run['steps']): ClaudeClient & { used: number; at: number } {
  const pools = steps.map((s) => [...s.answers]);
  const client = {
    used: 0,
    at: 0,
    async call(req: ClaudeRequest): Promise<ClaudeResponse> {
      const same = (a: Answer) => a.agent === req.agent && (a.actorId ?? '') === (req.actorId ?? '');
      const t = turnOf(req);
      let a: Answer | undefined;
      for (const pool of [pools[client.at], pools[client.at + 1]].filter(Boolean)) {
        const i = pool.findIndex((x) => same(x) && x.turn === t) >= 0 ? pool.findIndex((x) => same(x) && x.turn === t) : pool.findIndex(same);
        if (i >= 0) { a = pool.splice(i, 1)[0]; break; }
      }
      if (a?.output === undefined) return { ok: false, error: 'upstream_error', message: 'replay: no logged answer' };
      client.used++;
      return { ok: true, value: structuredClone(a.output) };
    },
  };
  return client;
}

describe('replay set (TQ3)', () => {
  it('has runs, and a broken world rule throws here (strict turn checker)', () => {
    expect(runs.length).toBeGreaterThan(0);
    expect(TURN_CHECK.strict).toBe(true);
  });
  for (const r of runs) {
    it(`${r.run}: ${r.steps.length} steps from turn ${r.from} replay with no throw and no broken world rule`, async (t) => {
      const clock = new VirtualClock();
      const store = memoryStore(() => clock.now());
      for (const [k, v] of Object.entries(r.docs)) store.docs.set(k, v);
      const storyId = Object.keys(r.docs).find((k) => /^stories\/[^/]+$/.test(k))!.split('/')[1];
      // a resumed run whose log no backup covers carries the saved story as it resumed (head), not a backup
      if (!r.head) {
        try {
          await restoreBackup(store, storyId, r.from, getLibrary());
        } catch (e) {
          return t.skip(`${r.run}: its backup no longer loads (${(e as Error).message.slice(0, 120)})`); // old saves need not load; shown as skipped
        }
      }
      const client = replayClient(r.steps);
      const refused: string[] = [];
      const game = createGame({ client, clock, store, director: createDirector(clock) });
      let resumed = false;
      try {
        resumed = await game.resume();
      } catch (e) {
        if (r.head) return t.skip(`${r.run}: its saved story no longer loads (${(e as Error).message.slice(0, 120)})`);
        throw e;
      }
      if (!resumed && r.head) return t.skip(`${r.run}: its saved story no longer loads`);
      expect(resumed).toBe(true);
      for (const [n, s] of r.steps.entries()) {
        if (game.fell() || game.notices().some((x) => x.kind === 'stop_play')) break;
        client.at = n;
        const turn = game.state()!.turn;
        try {
          await game.submit(s.input, { aimed: s.input.startsWith('/aim') });
          await game.settle();
        } catch (e) {
          throw new Error(`${r.run} step ${n + 1} ("${s.input.slice(0, 80)}"): ${(e as Error).message}`);
        }
        const then = s.answers.find((a) => a.agent === 'parser')?.output as { clarify?: unknown } | undefined;
        // until the world parts from the run's (new ground the Weaver built in the background then is fallback ground now)
        if (game.notices().some((x) => x.kind === 'scenario_fallback')) continue;
        if (!s.input.startsWith('/') && then && !then.clarify && game.state()!.turn === turn) refused.push(`step ${n + 1} "${s.input.slice(0, 60)}"`);
      }
      expect(client.used).toBeGreaterThan(0);
      // a line the game took then and refuses now is a regression (BG-169 was one) unless a rule changed on purpose:
      // then name it in REFUSED_ON_PURPOSE with the reason
      expect(refused.filter((x) => !REFUSED_ON_PURPOSE[`${r.run} ${x.split(' "')[0]}`]), 'accepted in the run, refused now').toEqual([]);
    }, 120_000);
  }
});
