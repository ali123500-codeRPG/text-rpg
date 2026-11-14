// Browser ClaudeClient over the artifact runtime's `sample` capability (runtime contract 0.2.96).
//   const sample = await window.claude.use('sample')   // null: not served / not granted
//   await sample(input, { signal, modelTier, model, effort, cache }) -> { text, truncated, modelTierApplied, modelApplied? }
//   rejects { code, message, text? }
// JSON agents call sample(), not sample.json: sample.json resolves only the parsed value and drops
// modelTierApplied / modelApplied / truncated, which the agent log must record. So we call sample() and parse the reply
// with sample.json's own tolerant rule (whole reply; else one code fence; else first { or [ to last } or ]).
import type { ClaudeClient, ClaudeErrorCode, ClaudeRequest, ClaudeResponse } from '../types';

type SampleResult = { text: string; truncated: boolean; modelTierApplied: string; modelApplied?: string };
type SampleOptions = {
  signal?: AbortSignal; modelTier?: 'quick' | 'default' | 'complex'; model?: string; effort?: 'low' | 'medium' | 'high'; cache?: boolean;
};
export type SampleFn = (input: { role: 'user' | 'assistant'; content: string }[], options?: SampleOptions) => Promise<SampleResult>;

const PASS: ClaudeErrorCode[] = ['upstream_error', 'rate_limited', 'refused', 'invalid_json', 'not_granted', 'sampling_disabled', 'session_expired', 'cancelled'];
/** runtime codes outside our set: capability gone = stop play; an empty answer = malformed; anything else = transient */
export function mapCode(code: unknown): ClaudeErrorCode {
  if (PASS.includes(code as ClaudeErrorCode)) return code as ClaudeErrorCode;
  if (code === 'not_declared' || code === 'capability_disabled' || code === 'capability_removed') return 'not_granted';
  if (code === 'empty_completion') return 'invalid_json';
  if (code === 'prompt_too_large' || code === 'invalid_request') return 'refused';
  return 'upstream_error';
}

export function parseTolerant(text: string): { ok: true; value: unknown } | { ok: false } {
  const tryParse = (s: string) => {
    try {
      return { ok: true as const, value: JSON.parse(s) as unknown };
    } catch {
      return null;
    }
  };
  const whole = tryParse(text.trim());
  if (whole) return whole;
  const fences = [...text.matchAll(/```(?:json)?\s*\n?([\s\S]*?)```/g)];
  if (fences.length === 1) {
    const f = tryParse(fences[0][1].trim());
    if (f) return f;
  }
  const first = text.search(/[{[]/);
  const last = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (first >= 0 && last > first) {
    const s = tryParse(text.slice(first, last + 1));
    if (s) return s;
  }
  // a model sometimes corrects itself ("Wait, correction: ... {fixed}"): take the last whole JSON object (run 17)
  if (last > first && text[last] === '}') {
    for (let i = text.lastIndexOf('{', last), n = 0; i > first && n < 200; i = text.lastIndexOf('{', i - 1), n++) {
      if (!/\n\s*$/.test(text.slice(0, i))) continue; // a fresh object starts on its own line, not inside a cut-off one
      const s = tryParse(text.slice(i, last + 1));
      if (s) return s;
    }
  }
  // a model sometimes copies the schema's "x|null" notation into its value, e.g. {"toZone":"bar"}|null (run 16)
  // a model sometimes writes a full-width comma or colon between JSON values ("text":"…"，"narrated") (run 20)
  const widened = text.replace(/"\s*，\s*(?=["{\[\d]|true|false|null)/g, '",').replace(/"\s*：\s*/g, '":');
  if (widened !== text) return parseTolerant(widened);
  const unshaped = text.replace(/([}\]"\d]|true|false|null)\s*\|\s*null\b/g, '$1');
  if (unshaped !== text) return parseTolerant(unshaped);
  // BG-35: a model sometimes leaves out the comma before the next key ("text":"…""narrated":[…]) (run 40)
  const commaed = text.replace(/((?<!\\)"|[}\]]|\d|true|false|null)(\s*)(?="[\w$-]+"\s*:)/g, (_m, v: string, ws: string) => `${v},${ws}`);
  if (commaed !== text) { const c = tryParse(commaed.slice(Math.max(0, commaed.search(/[{[]/)), Math.max(commaed.lastIndexOf('}'), commaed.lastIndexOf(']')) + 1)); if (c) return c; }
  // BG-45: a model sometimes closes a bracket it never opened ("text":"…"],"narrated":[…]) (run 44)
  const unstray = dropStrayClosers(text);
  if (unstray !== text) return parseTolerant(unstray);
  return { ok: false };
}

/** BG-45: drop each ] or } outside strings that doesn't close the bracket open at that point */
function dropStrayClosers(text: string): string {
  const open: string[] = [];
  let out = '', inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) { out += c; if (c === '\\') out += text[++i] ?? ''; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') open.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') { if (open.at(-1) !== c) continue; open.pop(); }
    out += c;
  }
  return out;
}

/** rejects as cancelled once the signal fires */
function givenUp(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const off = () => reject({ code: 'cancelled', message: 'the call was given up' });
    if (signal.aborted) off(); else signal.addEventListener('abort', off, { once: true });
  });
}

export function sampleClient(sample: SampleFn): ClaudeClient {
  return {
    async call(req: ClaudeRequest): Promise<ClaudeResponse> {
      try {
        const asked = sample(req.input, {
          signal: req.signal, modelTier: req.modelTier, model: req.model, effort: req.effort, cache: req.cache ?? false,
        });
        // a call whose signal fires gives up then, even if the page's Claude keeps it running, so a timeout always ends the wait
        const r = req.signal ? await Promise.race([asked, givenUp(req.signal)]) : await asked;
        const meta = { truncated: r.truncated, modelTierApplied: r.modelTierApplied, ...(r.modelApplied ? { modelApplied: r.modelApplied } : {}) };
        if (!req.json) return { ok: true, value: r.text, ...meta };
        const p = parseTolerant(r.text);
        if (!p.ok) return r.truncated ? { ok: true, value: null, ...meta } : { ok: false, error: 'invalid_json', message: 'no JSON value in the reply' };
        return { ok: true, value: p.value, ...meta };
      } catch (e) {
        const err = e as { code?: unknown; message?: string };
        return { ok: false, error: mapCode(err?.code), message: err?.message };
      }
    },
  };
}

/** the page's client, or null when this view cannot ask Claude (hide play, show the stop-play message) */
export async function browserClaudeClient(): Promise<ClaudeClient | null> {
  const w = globalThis as unknown as { claude?: { use(name: 'sample'): Promise<SampleFn | null> } };
  const sample = await w.claude?.use('sample');
  return sample ? sampleClient(sample) : null;
}
