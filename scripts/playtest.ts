// Headless playtest: the real game engine with an in-memory save under its own story id (never the artifact db), and
// every Claude call sent through the signed-in Claude Code CLI (`claude -p`), so it runs on the session's subscription.
// A player agent (also `claude -p`) picks each action from the story so far.
// F8: prompts here differ from the artifact's: the CLI joins the fixed and per-turn user turns into one prompt, adds its
// own system prompt and picks the model per tier, so read prompt-behaviour results from playtests with that in mind.
//   npm run playtest -- --turns 50 --out playtest-out
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ClaudeClient, ClaudeRequest, ClaudeResponse } from '../src/types';
import { createGame, parseTolerant, realClock } from '../src/agents';
import { createDirector } from '../src/agents/director';
import { memoryStore } from '../src/save/store';
import { CONFIG } from '../src/config';
import { validateStagePlan } from '../src/scene';
import { ensurePlace } from '../src/scene/apply';
import type { GameState, StagePlan } from '../src/types';
import { MILESTONES, milestonePerk, milestoneState, trueSkill } from '../src/ruleset/perks';
import type { SceneDirector } from '../src/agents';

// Playtest only: each CLI call is a cold start (the Weaver takes about 80 s), so the scene-start wait is widened here.
// The game's own WEAVER_TIMEOUT_MS is not changed.
(CONFIG as { WEAVER_TIMEOUT_MS: number }).WEAVER_TIMEOUT_MS = 360_000;

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const TURNS = Number(arg('turns', '50'));
/** --max N: after --turns, keep going 10 turns at a time until a level-up and a perk have happened, or N turns (Ali, 07/11/2026) */
const MAX = Number(arg('max', String(TURNS)));
const OUT = arg('out', 'playtest-out');
// GAP: the artifact's `sample` picks the model per tier on claude.ai; this mapping is ours.
const TIER_MODEL: Record<string, string> = { quick: 'claude-haiku-5-5', default: 'claude-sonnet-5-5', complex: 'claude-opus-5-5' };

function claudeCli(prompt: string, model: string, effort?: string): Promise<{ text: string; truncated: boolean; error?: string }> {
  const args = ['-p', '--output-format', 'json', '--model', model, '--tools', '', '--setting-sources', '',
    '--system-prompt', 'Follow the instructions in the user message exactly. Reply with only what they ask for.'];
  if (effort) args.push('--effort', effort);
  return new Promise((resolve) => {
    const p = spawn('claude', args, { cwd: '/tmp', stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', () => {
      try {
        const j = JSON.parse(out);
        if (j.is_error) return resolve({ text: '', truncated: false, error: String(j.result ?? j.subtype) });
        resolve({ text: String(j.result ?? ''), truncated: j.stop_reason === 'max_tokens' });
      } catch { resolve({ text: '', truncated: false, error: (err || out).slice(0, 300) }); }
    });
    p.stdin.end(prompt);
  });
}

let calls = 0;
const cliClient: ClaudeClient = {
  async call(req: ClaudeRequest): Promise<ClaudeResponse> {
    const model = req.model ?? TIER_MODEL[req.modelTier ?? 'default'];
    calls++;
    const r = await claudeCli(req.input.map((m) => m.content).join('\n\n'), model, req.effort);
    if (r.error || (req.json && !parseTolerant(r.text).ok)) appendFileSync(join(OUT, 'call-errors.log'), `${req.agent} ${model}: ${r.error ?? r.text.slice(0, 2000)}\n---\n`);
    if (r.error) return { ok: false, error: /rate|limit|usage/i.test(r.error) ? 'rate_limited' : 'upstream_error', message: r.error };
    const meta = { truncated: r.truncated, modelTierApplied: req.modelTier ?? 'default', modelApplied: model };
    if (!req.json) return { ok: true, value: r.text, ...meta };
    const p = parseTolerant(r.text);
    if (!p.ok) return { ok: false, error: 'invalid_json', message: 'no JSON value in the reply' };
    return { ok: true, value: p.value, ...meta };
  },
};

const PLAYER_BRIEF = `You are playtesting a text RPG as its player: a swordsman with a sword and shield. Play naturally and curiously:
talk to people, explore, take on any trouble you find, fight if it comes to that, and sometimes try unusual things to test
the game. Reply with ONLY what you type next, one short line in plain words (no quotes). Now and then use a command:
/stats, /inv, /quests, /help or /aim <text>.`;
/** --persona eager: an over-enthusiastic adventurer who drives the story forward on their own (P7 pacing test) */
const PERSONAS: Record<string, string> = {
  eager: `You are an over-enthusiastic adventurer. Never wait for the story to come to you: chase every lead, follow anyone
who leaves, go through every door, ask about rumours and jobs, pick fights you think are just, and when a place goes quiet,
move on to somewhere new at once.`,
  bloodthirsty: `You are a violent, bloodthirsty brute (a test of combat, XP and level-ups). You settle everything with your sword:
insult people, threaten them, and attack anyone who looks at you wrong, starting within your first few turns. Keep fighting
until your foes are down or flee, then look for the next fight. Use /aim now and then. Never talk your way out of a fight.`,
};
const PERSONA = PERSONAS[arg('persona', '')] ?? '';

async function main() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'call-errors.log'), '');
  const t0 = Date.now();
  // keep a copy of the state before each scene start, so a fallback can report the Weaver plan's validator errors
  const inner = createDirector(realClock) as SceneDirector;
  let before: GameState | null = null;
  const director: SceneDirector = { ...inner,
    startStory: (st, rng, ctx) => { before = structuredClone(st); ensurePlace(before, st.player.placeId); return inner.startStory(st, rng, ctx); },
    afterResolve: (st, ev, rng, ctx) => inner.afterResolve(st, ev, rng, ctx), afterSave: (st, ctx) => inner.afterSave(st, ctx) };
  const game = createGame({ client: cliClient, clock: realClock, store: memoryStore(Date.now), director });
  const skills = { melee_medium: 50, block: 40, dodge: 30, endurance: 50, sight: 30, hearing: 30, feint: 10, riposte: 10 };
  await game.newStory({ name: 'Arden', skills, tagged: ['melee_medium', 'block', 'endurance'] });
  const storyId = game.state()?.storyId;
  const st0 = game.state()!;
  const planErrors = before ? game.gm().agentLog.filter((a) => a.agent === 'weaver' && a.output).map((a) =>
    validateStagePlan(structuredClone(before!), a.output as StagePlan, { tier: st0.stage.tier, kind: 'scene', placeId: before!.player.placeId })) : [];
  writeFileSync(join(OUT, "plan-errors.json"), JSON.stringify(planErrors, null, 1));
  writeFileSync(join(OUT, "start-log.json"), JSON.stringify({ notices: game.notices(), log: game.gm().log, agentLog: game.gm().agentLog }, null, 1));
  console.log(`story ${storyId} started (in-memory save)`);
  const agentLog = join(OUT, 'agent-log.jsonl');
  writeFileSync(agentLog, '');
  const tested = () => progress.some((x) => x.includes('level up')) && progress.some((x) => x.includes('took perk'));
  for (let t = 1; t <= MAX; t++) {
    if (t > TURNS && (t - TURNS - 1) % 10 === 0) {
      if (tested()) { console.log(`level-up and perk seen by turn ${t - 1}; stopping`); break; }
      console.log(`turn ${t - 1}: no level-up and perk yet, playing 10 more`);
    }
    if (game.fell()) { console.log('player fell'); break; }
    const stop = game.notices().find((n) => n.kind === 'stop_play');
    if (stop) { console.log('stop_play:', stop.text); break; }
    // spoken lines are shown under the narration on screen (the Narrator does not quote them), so the player sees them too
    const recent = game.lines().slice(-14).map((l) => [`[${l.kind}] ${l.text}`, ...(l.speech ?? []).map((sp) => `  ${sp.speaker}: "${sp.text}"`)].join('\n')).join('\n');
    const pick = await claudeCli(`${PLAYER_BRIEF}${PERSONA ? `\n${PERSONA}` : ''}\n\nThe story so far (latest last):\n${recent}`, 'claude-sonnet-5-5');
    const input = (pick.text || 'I look around.').split('\n')[0].trim().slice(0, 200);
    const aimed = input.startsWith('/aim');
    console.log(`turn ${t}: ${input}`);
    await game.submit(input, { aimed });
    spendPerkPoints(game, t);
    const gm = game.gm();
    appendFileSync(agentLog, JSON.stringify({ step: t, input, notices: game.notices(), agentLog: gm.agentLog }) + '\n');
    writeTranscript(game, storyId!, t0);
  }
  await game.settle();
  writeTranscript(game, storyId!, t0);
  writeFileSync(join(OUT, 'final-state.json'), JSON.stringify(game.state(), null, 1));
  console.log(`done: ${calls} game calls, ${Math.round((Date.now() - t0) / 60000)} min`);
}

/** The test player can't open the Perks page, so it spends each perk point at once on the open milestone of its highest skill. */
const progress: string[] = [];
function spendPerkPoints(game: ReturnType<typeof createGame>, turn: number) {
  const st = game.state();
  const p = st?.player;
  if (!p?.progression) return;
  for (const x of p.progression.xpLog ?? []) if (x.turn === st!.turn && x.levelUp) progress.push(`turn ${turn}: level up to ${x.levelUp.level} (${x.levelUp.classId})`);
  while (p.progression.unspentPerkPoints > 0) {
    const open = Object.keys(p.core.skills).flatMap((sk) => MILESTONES.filter((m) => milestoneState(p, sk, m) === 'open').map((m) => ({ id: milestonePerk(sk, m)!.id, sk, m })))
      .sort((a, b) => trueSkill(p, b.sk) - trueSkill(p, a.sk) || a.m - b.m);
    if (!open.length) { progress.push(`turn ${turn}: ${p.progression.unspentPerkPoints} perk point(s) unspent, no open milestone`); break; }
    game.takePerk(open[0].id);
    progress.push(`turn ${turn}: took perk ${open[0].id} (${open[0].sk} ${open[0].m})`);
  }
}

function writeTranscript(game: ReturnType<typeof createGame>, storyId: string, t0: number) {
  const pr = game.state()?.player.progression;
  const md = [`# Playtest ${storyId}`, `Started ${new Date(t0).toISOString()} · ${calls} game calls so far`, '',
    `XP ${pr?.xp ?? 0} · unspent perk points ${pr?.unspentPerkPoints ?? 0} · perks: ${game.state()?.player.core.perks.map((x) => x.perkId).join(', ') || 'none'}`,
    ...progress.map((x) => `- ${x}`), '',
    ...game.lines().map((l) => (l.kind === 'player' ? `\n**> ${l.text}**` : `${l.kind === 'narration' ? '' : `_${l.kind}:_ `}${l.text}`)
      + (l.speech?.length ? `\n\n${l.speech.map((sp) => `> _${sp.speaker}:_ "${sp.text}"`).join('\n')}` : '')
      + (l.mechanics?.length ? `\n\n    ${l.mechanics.join('\n    ')}` : ''))].join('\n');
  writeFileSync(join(OUT, 'transcript.md'), md);
}

main().catch((e) => { console.error(e); process.exit(1); });
