// The one way an agent call is made: two user turns [FIXED, PER_TURN_DATA], model/tier/effort from CONFIG,
// schema check, one repair retry with the errors (changed input), then the caller's fallback. Every call is logged.
import type { AgentCallStatus, AgentName, AgentTurnLog, ClaudeClient, ClaudeErrorCode, ClaudeRequest, Clock } from '../types';
import { CONFIG } from '../config';
import type { Checked } from './schema';

export type AgentCtx = {
  client: ClaudeClient;
  clock: Clock;
  turn: number;
  log: (entry: AgentTurnLog) => void;
  /** files a numbered bug (src/save/bugs.ts) for the build threads, e.g. a Weaver plan that left its catalogs */
  reportBug?: (code: string, detail: Record<string, unknown>) => void;
  /** told about every failed call code (rate_limited switches background calls off) */
  onError?: (code: ClaudeErrorCode, agent: AgentName) => void;
  /** the viewer's call slots, shared by every call of one game (Q4) */
  gate?: CallGate;
  /** a background Planner or Weaver call: it waits behind the turn's own calls */
  background?: boolean;
};

/**
 * Q4 (Motion Rules Review): the turn's own calls (Parser, dialogue calls, Narrator, a scene-start Weaver) always
 * go ahead of background Planner and Weaver calls in the viewer's call slots. Background calls start only while no
 * turn call is waiting or running, and never take the last slot, so a turn call never queues behind them and a fight
 * with more significant NPCs answers no slower (that would hint who is significant). A call already running is never
 * cut off.
 */
/** enter hands back the release at once when the call may start now (so a free call starts in the same tick), else a promise of it */
export type CallGate = { enter(background: boolean, signal?: AbortSignal): (() => void) | Promise<() => void> };
export function callGate(slots: number = CONFIG.CALL_SLOTS): CallGate {
  const bgMax = Math.max(1, slots - 1);
  let fg = 0, bg = 0;
  const waiting: { go: () => void }[] = [];
  const pump = () => {
    while (waiting.length && fg === 0 && bg < bgMax) { bg++; waiting.shift()!.go(); }
  };
  const once = (f: () => void) => { let done = false; return () => { if (!done) { done = true; f(); } }; };
  return {
    enter(background, signal) {
      if (!background) { fg++; return once(() => { fg--; pump(); }); }
      if (fg === 0 && bg < bgMax && !waiting.length) { bg++; return once(() => { bg--; pump(); }); }
      return new Promise<() => void>((resolve) => {
        const w = { go: () => { signal?.removeEventListener('abort', off); resolve(once(() => { bg--; pump(); })); } };
        // a queued call that is aborted leaves the queue without taking a slot
        const off = () => { const i = waiting.indexOf(w); if (i >= 0) waiting.splice(i, 1); resolve(() => {}); };
        signal?.addEventListener('abort', off, { once: true });
        waiting.push(w);
      });
    },
  };
}

/** not_granted, sampling_disabled, session_expired: stop play, no fallback play */
export class StopPlay extends Error {
  constructor(public code: ClaudeErrorCode) {
    super(`stop play: ${code}`);
  }
}
export const STOP_CODES: ClaudeErrorCode[] = ['not_granted', 'sampling_disabled', 'session_expired'];

export type Attempt<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'retry'; errors: string[]; note: string } // repair once with this note
  | { kind: 'fail'; errors: string[] }; // fallback now

export type RunSpec<T> = {
  agent: AgentName;
  actorId?: string;
  fixed: string;
  data: string;
  signal?: AbortSignal;
  schema: (v: unknown) => Checked<T>;
  /** checks after the schema (legality, leak scan, ...); runs on every schema-clean answer */
  accept?: (v: T, attempt: number) => Attempt<T>;
};

export type RunResult<T> = {
  value: T | null; // null: use the agent's fallback
  status: AgentCallStatus;
  errors: string[];
  code?: ClaudeErrorCode;
  log: AgentTurnLog;
};

export function modelFor(agent: AgentName): Pick<ClaudeRequest, 'modelTier' | 'model' | 'effort'> {
  const modelTier = CONFIG.MODEL_TIERS[agent];
  if (agent === 'weaver') return { model: CONFIG.WEAVER_MODEL, modelTier, effort: CONFIG.WEAVER_EFFORT };
  return { modelTier };
}

const repairNote = (note: string) =>
  `\n\nREPAIR: your previous answer was rejected: ${note}\nAnswer again with the whole corrected JSON.`;

export async function runAgent<T>(ctx: AgentCtx, spec: RunSpec<T>): Promise<RunResult<T>> {
  const log: AgentTurnLog = {
    turn: ctx.turn, agent: spec.agent, ...(spec.actorId ? { actorId: spec.actorId } : {}),
    input: null, output: null, rawOutputs: [], status: 'ok', errors: [], startedAt: ctx.clock.now(),
  };
  const done = (value: T | null, status: AgentCallStatus, code?: ClaudeErrorCode): RunResult<T> => {
    log.output = value;
    log.status = status;
    log.endedAt = ctx.clock.now();
    ctx.log(log);
    return { value, status, errors: log.errors, code, log };
  };
  let data = spec.data;
  for (let attempt = 0; attempt < 2; attempt++) {
    const req: ClaudeRequest = {
      agent: spec.agent, ...(spec.actorId ? { actorId: spec.actorId } : {}),
      input: [{ role: 'user', content: spec.fixed }, { role: 'user', content: data }],
      ...modelFor(spec.agent), json: true, signal: spec.signal, cache: false,
    };
    if (attempt === 0) log.input = req.input;
    if (spec.signal?.aborted) return done(null, 'cancelled', 'cancelled');
    let res;
    const slot = ctx.gate ? ctx.gate.enter(!!ctx.background, spec.signal) : () => {};
    const release = typeof slot === 'function' ? slot : await slot;
    try {
      if (spec.signal?.aborted) return done(null, 'cancelled', 'cancelled');
      res = await ctx.client.call(req);
    } catch (e) {
      res = { ok: false as const, error: ((e as { code?: ClaudeErrorCode })?.code ?? 'upstream_error') as ClaudeErrorCode };
    } finally {
      release();
    }
    if (spec.signal?.aborted) return done(null, 'cancelled', 'cancelled');
    if (!res.ok) {
      if (res.error === 'cancelled') return done(null, 'cancelled', 'cancelled');
      ctx.onError?.(res.error, spec.agent);
      if (STOP_CODES.includes(res.error)) {
        log.errors.push(res.error);
        done(null, 'failed', res.error);
        throw new StopPlay(res.error);
      }
      if (res.error === 'invalid_json' && attempt === 0) {
        log.errors.push('invalid_json');
        data = spec.data + repairNote('it was not valid JSON');
        continue;
      }
      log.errors.push(res.error === 'upstream_error' ? 'call_failed' : res.error);
      return done(null, 'fallback', res.error);
    }
    log.rawOutputs!.push(res.value);
    if (res.modelTierApplied) log.modelTierApplied = res.modelTierApplied;
    if (res.modelApplied) log.modelApplied = res.modelApplied;
    let verdict: Attempt<T>;
    if (res.truncated) verdict = { kind: 'retry', errors: ['truncated'], note: 'it was cut off; answer shorter' };
    else {
      const c = spec.schema(res.value);
      verdict = c.errors.length
        ? { kind: 'retry', errors: ['schema', ...c.errors], note: c.errors.slice(0, 12).join('; ') }
        : spec.accept ? spec.accept(c.value, attempt) : { kind: 'ok', value: c.value };
    }
    if (verdict.kind === 'ok') return done(verdict.value, attempt === 0 ? 'ok' : 'repaired');
    log.errors.push(...verdict.errors);
    if (verdict.kind === 'fail') return done(null, 'fallback');
    data = spec.data + repairNote(verdict.note);
  }
  return done(null, 'fallback');
}
