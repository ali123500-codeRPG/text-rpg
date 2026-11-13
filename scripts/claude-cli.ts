// One way to call Claude from Node with no API key: the signed-in Claude Code CLI (`claude -p`), on the subscription.
// Used by playtests and the nightly Parser test set (CI signs in with CLAUDE_CODE_OAUTH_TOKEN).
// @ts-expect-error Node types are not installed (the parser test set imports this under tsc)
import { spawn } from 'node:child_process';

// GAP: the artifact's `sample` picks the model per tier on claude.ai; this mapping is ours.
export const TIER_MODEL: Record<string, string> = { quick: 'claude-haiku-5-5', default: 'claude-sonnet-5-5', complex: 'claude-opus-5-5' };

export type CliUsage = { ms?: number; ttftMs?: number; usage?: unknown; costUsd?: number };
export function claudeCli(prompt: string, model: string, effort?: string): Promise<{ text: string; truncated: boolean; error?: string } & CliUsage> {
  const args = ['-p', '--output-format', 'json', '--model', model, '--tools', '', '--setting-sources', '',
    '--system-prompt', 'Follow the instructions in the user message exactly. Reply with only what they ask for.'];
  if (effort) args.push('--effort', effort);
  return new Promise((resolve) => {
    const p = spawn('claude', args, { cwd: '/tmp', stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d: string) => (out += d));
    p.stderr.on('data', (d: string) => (err += d));
    p.on('error', (e: Error) => resolve({ text: '', truncated: false, error: e.message }));
    p.on('close', () => {
      try {
        const j = JSON.parse(out);
        if (j.is_error) return resolve({ text: '', truncated: false, error: String(j.result ?? j.subtype) });
        resolve({ text: String(j.result ?? ''), truncated: j.stop_reason === 'max_tokens', ms: j.duration_api_ms, ttftMs: j.ttft_ms, usage: j.usage, costUsd: j.total_cost_usd });
      } catch { resolve({ text: '', truncated: false, error: (err || out).slice(0, 300) }); }
    });
    p.stdin.end(prompt);
  });
}
