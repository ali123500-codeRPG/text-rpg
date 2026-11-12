// Headless playtest: the real game engine with an in-memory save under its own story id (never the artifact db), and
// every Claude call sent through the signed-in Claude Code CLI (`claude -p`), so it runs on the session's subscription.
// A player agent (also `claude -p`) picks each action from the story so far.
// F8: prompts here differ from the artifact's: the CLI joins the fixed and per-turn user turns into one prompt, adds its
// own system prompt and picks the model per tier, so read prompt-behaviour results from playtests with that in mind.
//   npm run playtest -- --turns 50 --out playtest-out [--class late_bloomer]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ClaudeClient, ClaudeRequest, ClaudeResponse } from '../src/types';
import { createGame, parseTolerant, realClock } from '../src/agents';
import { createDirector } from '../src/agents/director';
import { memoryStore } from '../src/save/store';
import { CONFIG } from '../src/config';
import { validateStagePlan } from '../src/scenario';
import { ensurePlace } from '../src/scenario/apply';
import { isSeller } from '../src/engine/trade';
import type { GameState, StagePlan } from '../src/types';
import type { ScenarioDirector } from '../src/agents';
import { recommendedBuild } from '../src/library/spawn';
import { CL } from '../src/library/classIds';
import { PERSONAS, autoPerk } from '../src/agents/autopilot';
import { villageStagePlan } from '../src/scenario/fixtures';
import { TP } from '../src/library/templateIds';
import { getLibrary } from '../src/library';
import { personalityText } from '../src/ruleset/personality';
import { skillName as sk } from '../src/library/skillNames';
import type { LogLine, Personality } from '../src/types';

/** what the play screen shows under a line whatever the mechanics switch: skill-ups, perk unlocks, level-ups, achievements */
const screenNotes = (l: LogLine): string[] => {
  const lib = getLibrary();
  const gains = Object.entries(l.gains ?? {}).filter(([, n]) => n);
  return [
    ...(gains.length ? [`Skills: ${gains.map(([k, n]) => `${sk(k)} +${n}`).join(' · ')}`] : []),
    ...(l.unlocks ?? []).map((u) => `New perk unlocked: ${sk(u.skill)} reached ${u.milestone}`),
    ...(l.levelUps ?? []).map((u) => `Level up: ${lib.classes[u.classId]?.name ?? 'bonus level'} reached level ${u.level}`),
    ...(l.achievements ?? []).map((a) => `${a.scar ? 'Scar' : 'Achievement'}: ${a.name}${a.xp ? ` (+${a.xp} XP)` : ''}`),
    ...(l.next ? [`Put off to next turn (offered in the input box): ${l.next}`] : []), // Q16: the play screen's dimmed suggestion
    ...(l.place ? [`You are at: ${[l.place.zone, l.place.name].filter(Boolean).join(' · ')}`] : []), // the zone leads, as on the play header
  ].map((x) => `  [screen] ${x}`);
};

// Playtest only: each CLI call is a cold start (the Weaver takes about 80 s), so the scenario-start wait is widened here.
// The game's own WEAVER_TIMEOUT_MS is not changed.
(CONFIG as { WEAVER_TIMEOUT_MS: number }).WEAVER_TIMEOUT_MS = 360_000;

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
// --set KEY=VALUE (repeatable): a config override for this run only, e.g. --set SKILL_UP_INSTANT=true
process.argv.forEach((x, i) => {
  if (x !== '--set') return;
  const [k, v] = process.argv[i + 1].split('=');
  (CONFIG as Record<string, unknown>)[k] = v === 'true' ? true : v === 'false' ? false : Number.isNaN(Number(v)) ? v : Number(v);
  console.log(`config ${k} = ${v}`);
});
/** --mechanics: the player agent also reads each line's mechanics (what the screen shows with mechanics on: rolls, skill-ups) */
const MECHANICS = process.argv.includes('--mechanics');
/** --debrief: after the run, the player agent answers DEBRIEF about how it felt to play */
const DEBRIEF = arg('debrief', '');
const TURNS = Number(arg('turns', '50'));
/** --max N: after --turns, keep going 10 turns at a time until a level-up and a perk have happened, or N turns */
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
/** --fixture: the story opens on the fixture stage plan (Brookmere, its tavern, street and slime field) instead of a Weaver call */
let fixtureLeft = process.argv.includes('--fixture') ? 1 : 0;
const cliClient: ClaudeClient = {
  async call(req: ClaudeRequest): Promise<ClaudeResponse> {
    if (fixtureLeft && req.agent === 'weaver') { fixtureLeft--; return { ok: true, value: villageStagePlan(), truncated: false, modelTierApplied: 'complex', modelApplied: 'fixture' }; }
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

const PLAYER_BRIEF = `You are playtesting a text RPG as its player: ${arg('class', CL.swordsman) === CL.swordsman ? 'a swordsman with a sword and shield' : 'a nobody with little gear'}. Play naturally and curiously:
talk to people, explore, take on any trouble you find, fight if it comes to that, and sometimes try unusual things to test
the game. Reply with ONLY what you type next, one short line in plain words (no quotes). Now and then use a command:
/stats, /inv, /quests, /help or /aim <text>.`;
const PERSONA = PERSONAS[arg('persona', '')] ?? '';

/** --character "nerve=-60,PA1=60,PA3=-60,values=VL10+VL7": the character's personality points on the creation build
 * (the creation screen's picker), so a persona can play a character unlike itself */
const CHARACTER = arg('character', '');
function characterPersonality(): Personality | undefined {
  if (!CHARACTER) return undefined;
  const p: Personality = { nerve: 0, traits: {}, values: [] };
  for (const kv of CHARACTER.split(',')) {
    const [k, v] = kv.split('=');
    if (k === 'nerve') p.nerve = Number(v); else if (k === 'values') p.values = v.split('+'); else p.traits[k] = Number(v);
  }
  return p;
}

/** every run: play toward the persona's goals, check each try worked, and report what doesn't */
const GOAL_RULES = `How to play this test:
- Every turn, take a concrete step toward your goals above. Never idle, wait or repeat a command just to pass turns.
- After each try, read the result and check that it did what you meant. If the same thing fails twice, try a clearly
  different way, and add a second line to your reply: REPORT: what you tried, what happened, and what you expected.
- Also write a REPORT line whenever the game does something that looks wrong or confusing to you.`;

/** --near-seller: start the player one zone from the first seller on the stage (across its counter), else in its zone */
function nearSeller(st: GameState) {
  const seller = st.actors.find((a) => isSeller(a) && st.stage.zoneIds.includes(a.zone));
  if (!seller) { console.log('no seller on the stage; the player starts where the story put them'); return; }
  const next = st.zones.find((z) => z.id === seller.zone)?.links.find((l) => !l.frontier && st.stage.zoneIds.includes(l.to))?.to;
  st.player.zone = next ?? seller.zone;
  console.log(`player placed in ${st.player.zone}, next to ${seller.id} in ${seller.zone}`);
}

/** --near-slimes: start the player one zone from the first slime on the stage, else in its zone */
function nearSlimes(st: GameState) {
  const slime = st.actors.find((a) => a.core.templateId === TP.slime && st.stage.zoneIds.includes(a.zone));
  if (!slime) { console.log('no slime on the stage; the player starts where the story put them'); return; }
  const next = st.zones.find((z) => z.id === slime.zone)?.links.find((l) => !l.frontier && st.stage.zoneIds.includes(l.to))?.to;
  st.player.zone = next ?? slime.zone;
  st.player.placeId = st.zones.find((z) => z.id === st.player.zone)?.placeId ?? st.player.placeId;
  console.log(`player placed in ${st.player.zone}, next to ${slime.id} in ${slime.zone}`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'call-errors.log'), '');
  const t0 = Date.now();
  // keep a copy of the state before each scenario start, so a fallback can report the Weaver plan's validator errors
  const inner = createDirector(realClock) as ScenarioDirector;
  let before: GameState | null = null;
  const director: ScenarioDirector = { ...inner,
    startStory: async (st, rng, ctx) => {
      before = structuredClone(st); ensurePlace(before, st.player.placeId);
      const ev = await inner.startStory(st, rng, ctx);
      if (process.argv.includes('--near-seller')) nearSeller(st); // before the opening is narrated
      if (process.argv.includes('--near-slimes')) nearSlimes(st);
      return ev;
    },
    afterResolve: (st, ev, rng, ctx) => inner.afterResolve(st, ev, rng, ctx), afterSave: (st, ctx) => inner.afterSave(st, ctx) };
  const game = createGame({ client: cliClient, clock: realClock, store: memoryStore(Date.now), director });
  // --class late_bloomer starts an Unwritten Legend; the default is the Swordsman. Both use the class's recommended build.
  const pers = characterPersonality();
  await game.newStory({ ...recommendedBuild(arg('class', CL.swordsman)), name: 'Arden', ...(pers ? { personality: pers } : {}) });
  const storyId = game.state()?.storyId;
  // the Character page shows the personality; the agent reads it as a player would, but plays as its persona
  if (pers) charLine = `\nYour character's sheet describes their personality as: ${personalityText(game.state()!.player, 'steady')} You may play differently from it; play the way your persona says.`;
  const st0 = game.state()!;
  const planErrors = before ? game.gm().agentLog.filter((a) => a.agent === 'weaver' && a.output).map((a) =>
    validateStagePlan(structuredClone(before!), a.output as StagePlan, { tier: st0.stage.tier, kind: 'scenario', placeId: before!.player.placeId })) : [];
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
    const recent = game.lines().slice(-14).map((l) => [`[${l.kind}] ${l.text}`, ...(l.speech ?? []).map((sp) => `  ${sp.speaker}: "${sp.text}"`), ...screenNotes(l), ...(MECHANICS ? (l.mechanics ?? []).map((m) => `  (${m})`) : [])].join('\n')).join('\n');
    const ask = `${PLAYER_BRIEF}${PERSONA ? `\n${PERSONA}` : ''}${charLine}\n${GOAL_RULES}\n\nThe story so far (latest last):\n${recent}`;
    const first = (r: { text: string }) => {
      const lines = (r.text || 'I look around.').split('\n').map((x) => x.trim()).filter(Boolean);
      for (const x of lines.filter((x) => /^REPORT:/i.test(x))) { reports.push(`turn ${t}: ${x.replace(/^REPORT:\s*/i, '')}`); console.log(`turn ${t} REPORT: ${x.slice(7).trim()}`); }
      return (lines.find((x) => !/^REPORT:/i.test(x)) ?? 'I look around.').slice(0, 200);
    };
    let input = first(await claudeCli(ask, 'claude-sonnet-5-5'));
    // a slash command answers at once and passes no time: sending the same one again only repeats its answer (run 33 sent /stats 11 times)
    if (input.startsWith('/') && input === lastInput) input = first(await claudeCli(`${ask}\n\nYou just sent ${input} and its answer is above; it passes no time. Do something in the story instead.`, 'claude-sonnet-5-5'));
    lastInput = input;
    const aimed = input.startsWith('/aim');
    console.log(`turn ${t}: ${input}`);
    const rawBefore = Object.fromEntries(Object.entries(game.state()?.player.core.skills ?? {}).map(([k, v]) => [k, v.raw]));
    await game.submit(input, { aimed });
    spendPerkPoints(game, t);
    for (const [k, v] of Object.entries(game.state()?.player.core.skills ?? {})) if (v.raw > (rawBefore[k] ?? 0)) skillUps.push(`turn ${t}: ${k} ${rawBefore[k] ?? 0} -> ${v.raw}`);
    const gm = game.gm();
    appendFileSync(agentLog, JSON.stringify({ step: t, input, notices: game.notices(), agentLog: gm.agentLog }) + '\n');
    tracePacing(game, t, input);
    writeTranscript(game, storyId!, t0);
  }
  await game.settle();
  writeTranscript(game, storyId!, t0);
  if (DEBRIEF) {
    const story = game.lines().map((l) => [`[${l.kind}] ${l.text}`, ...screenNotes(l), ...(MECHANICS ? (l.mechanics ?? []).map((m) => `  (${m})`) : [])].join('\n')).join('\n');
    const r = await claudeCli(`${PLAYER_BRIEF}${PERSONA ? `\n${PERSONA}` : ''}\n\nYou have finished playing. The whole story you played:\n${story}\n\n${DEBRIEF}\nAnswer as the player, honestly and specifically, in plain prose.`, 'claude-sonnet-5-5');
    writeFileSync(join(OUT, 'debrief.md'), `# Debrief\n\nQuestion: ${DEBRIEF}\n\n${r.text || r.error}\n\nSkill-ups this run (${skillUps.length}):\n${skillUps.map((x) => `- ${x}`).join('\n')}\n`);
  }
  writeFileSync(join(OUT, 'final-state.json'), JSON.stringify(game.state(), null, 1));
  console.log(`done: ${calls} game calls, ${Math.round((Date.now() - t0) / 60000)} min`);
}

/** pacing.jsonl: the quiet-turn clock, scenario breaks, beats and rests after each step (P7 / resting tests) */
let firedSeen = 0, logSeen = 0;
function tracePacing(game: ReturnType<typeof createGame>, step: number, input: string) {
  const st = game.state();
  if (!st) return;
  const fired = st.hidden.firedLog.slice(firedSeen); firedSeen = st.hidden.firedLog.length;
  const codes = st.log.slice(logSeen).filter((l) => /rest|beat|stall|scenario|break|wait|time|heal/i.test(l.code)); logSeen = st.log.length;
  const p = st.player;
  appendFileSync(join(OUT, 'pacing.jsonl'), JSON.stringify({ step, turn: st.turn, input, scenario: st.stage.scenarioNumber, quiet: st.stage.quiet,
    breakCause: st.stage.breakCause ?? null, clock: st.clocks.time ?? null, hpLostPct: p.core.condition.hpLostPct, restedAt: st.clocks[`rest:${p.id}`] ?? null,
    fired, codes, quietBeatsLeft: Object.values(st.hidden.plans).flatMap((pl) => pl.triggers).filter((tr) => tr.when.type === 'quiet_turns').map((tr) => tr.id) }) + '\n');
}

/** The test player can't open the Perks page, so it spends each perk point at once on the open milestone of its highest skill. */
const progress: string[] = [];
const skillUps: string[] = [];
const reports: string[] = [];
let charLine = '';
let lastInput = '';
let levelUpsSeen = 0;
function spendPerkPoints(game: ReturnType<typeof createGame>, turn: number) {
  const st = game.state();
  const p = st?.player;
  if (!p?.progression) return;
  const ups = (p.progression.xpLog ?? []).filter((x) => x.levelUp);
  for (const x of ups.slice(levelUpsSeen)) progress.push(`turn ${turn}: level up to ${x.levelUp!.level} (${x.levelUp!.classId})`);
  levelUpsSeen = ups.length;
  while (p.progression.unspentPerkPoints > 0) {
    const id = autoPerk(p);
    if (!id) { progress.push(`turn ${turn}: ${p.progression.unspentPerkPoints} perk point(s) unspent, no perk it can take yet`); break; }
    game.takePerk(id);
    progress.push(`turn ${turn}: took perk ${id}`);
  }
}

function writeTranscript(game: ReturnType<typeof createGame>, storyId: string, t0: number) {
  const pr = game.state()?.player.progression;
  const md = [`# Playtest ${storyId}`, `Started ${new Date(t0).toISOString()} · ${calls} game calls so far`, '',
    `XP ${+(pr?.xp ?? 0).toFixed(6)} · unspent perk points ${pr?.unspentPerkPoints ?? 0} · perks: ${game.state()?.player.core.perks.map((x) => x.perkId).join(', ') || 'none'}`,
    ...progress.map((x) => `- ${x}`), '',
    ...game.lines().map((l) => (l.kind === 'player' ? `\n**> ${l.text}**` : `${l.kind === 'narration' ? '' : `_${l.kind}:_ `}${l.text}`)
      + (l.speech?.length ? `\n\n${l.speech.map((sp) => `> _${sp.speaker}:_ "${sp.text}"`).join('\n')}` : '')
      + (l.mechanics?.length ? `\n\n    ${l.mechanics.join('\n    ')}` : ''))].join('\n');
  writeFileSync(join(OUT, 'transcript.md'), md);
  writeFileSync(join(OUT, 'reports.md'), `# Player reports (${reports.length})\n\n${reports.map((x) => `- ${x}`).join('\n')}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
