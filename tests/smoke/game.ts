// TQ7: the real game for the browser smoke tests: createGame on an in-memory store, with a stand-in Claude. The Parser
// reads a few words (look, go, say); the Narrator narrates every event it is shown; the Planner, Responder, Voice and
// Weaver calls fail, so NPCs run on their code minds and new ground is fallback ground. Set before the page's own entry
// runs, which mounts any injected GameApi.
import type { ClaudeClient, ClaudeRequest, ClaudeResponse, GameApi, Intent } from '../../src/types';
import { createGame, VirtualClock } from '../../src/agents';
import { createDirector } from '../../src/agents/director';
import { memoryStore } from '../../src/save/store';

const intent = (p: Partial<Intent>): Intent => ({ move: null, action: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, ...p });
const observe = { type: 'observe' as const, skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance: 'normal' as const };

function parse(req: ClaudeRequest): Intent {
  const text = req.input.at(-1)?.content ?? '';
  const said = /PLAYER_INPUT:\n"?([^"\n]*)/.exec(text)?.[1] ?? '';
  if (/^say /i.test(said)) return intent({ spoken: said.slice(4), addressees: ['everyone'] });
  { const m = /^hit (\S+) (SK\d+)$/i.exec(said); if (m) return intent({ action: { ...observe, type: 'attack' as never, skill: m[2], target: m[1] } }); } // BF66
  if (/^ask me$/i.test(said)) return intent({ clarify: 'Do you want to hold your place?', answers: ['I hold my place and wait to see who appears', 'I go back inside'] }); // BG-228
  if (/ then /i.test(said)) return intent({ action: observe, deferred: [said.split(/ then /i).slice(1).join(' then ')] }); // Q16: the rest is put off
  return intent({ action: observe });
}

function narrate(req: ClaudeRequest): ClaudeResponse {
  const data = req.input.map((m) => m.content).join('\n');
  const at = data.indexOf('NARRATION_VIEW:\n');
  const view = at < 0 ? { events: [] } : (JSON.parse(data.slice(at + 16).split('\n\n')[0]) as { events: { id: string }[] });
  return { ok: true, value: { text: 'Smoke narration: the world goes on around you.', narrated: view.events.map((e) => e.id) } };
}

const client: ClaudeClient = {
  async call(req: ClaudeRequest): Promise<ClaudeResponse> {
    if (req.agent === 'parser') return { ok: true, value: parse(req) };
    if (req.agent === 'narrator') return narrate(req);
    return { ok: false, error: 'upstream_error', message: 'smoke test: no Claude' };
  },
};

// virtual time (from now): the turn windows (BACKGROUND_WINDOW_MS and the rest) pass at once instead of 8 s a turn
const clock = new VirtualClock(Date.now());
(globalThis as { __GAME_API__?: GameApi }).__GAME_API__ = createGame({ client, clock, store: memoryStore(() => clock.now()), director: createDirector(clock) });
