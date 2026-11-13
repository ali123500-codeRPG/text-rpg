// Scripted Claude: returns logged agent outputs, records every request. Repeatable case tests.
import type { AgentName, ClaudeClient, ClaudeRequest, ClaudeResponse, Clock } from '../../src/types';

export type Script = { agent: AgentName; actorId?: string; response: ClaudeResponse | ((req: ClaudeRequest) => ClaudeResponse); delayMs?: number };

export class ScriptedClaude implements ClaudeClient {
  calls: ClaudeRequest[] = [];
  private scripts: Script[] = [];
  /** answers for calls nothing was queued for (wholeTurn sets a narrator that narrates every event); without one the call fails */
  defaults: Partial<Record<AgentName, (req: ClaudeRequest) => ClaudeResponse>> = {};
  constructor(private clock?: Clock) {}
  /** queue one answer; matched first-in-first-out by agent (and actorId when given) */
  push(agent: AgentName, value: unknown, opts: { actorId?: string; delayMs?: number } = {}): this {
    this.scripts.push({ agent, actorId: opts.actorId, response: { ok: true, value }, delayMs: opts.delayMs });
    return this;
  }
  pushResponse(s: Script): this {
    this.scripts.push(s);
    return this;
  }
  callsFor(agent: AgentName, actorId?: string): ClaudeRequest[] {
    return this.calls.filter((c) => c.agent === agent && (actorId === undefined || c.actorId === actorId));
  }
  async call(req: ClaudeRequest): Promise<ClaudeResponse> {
    this.calls.push(req);
    const i = this.scripts.findIndex((s) => s.agent === req.agent && (s.actorId === undefined || s.actorId === req.actorId));
    if (i < 0) return this.defaults[req.agent]?.(req) ?? { ok: false, error: 'upstream_error', message: `no scripted answer for ${req.agent} ${req.actorId ?? ''}` };
    const s = this.scripts.splice(i, 1)[0];
    if (s.delayMs && this.clock) await this.clock.sleep(s.delayMs, req.signal);
    if (req.signal?.aborted) return { ok: false, error: 'cancelled' };
    return typeof s.response === 'function' ? s.response(req) : s.response;
  }
}

/** the input text actually sent for a call (fixed instructions + per-turn data) */
export function sentText(req: ClaudeRequest): string {
  return req.input.map((m) => m.content).join('\n');
}
