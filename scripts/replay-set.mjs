// TQ3 replay set: turns the real agent answers of playtest runs into CI fixtures. For each run folder: its earliest
// backup (the whole world at that turn) and every later step's player input with the Parser, Planner, Responder,
// Voice and Weaver answers it got (agent-log.jsonl), gzipped to tests/replay/runs/<run>.json.gz.
//   node scripts/replay-set.mjs /mnt/project-files/playtests/run-99-scenarios-50 [...more run folders]
// A run with no backup has no world to start from and is skipped.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { gzipSync } from 'node:zlib';

const USED = new Set(['ok', 'repaired']); // a call that failed or fell back is replayed as a failed call
for (const dir of process.argv.slice(2)) {
  const name = basename(dir).replace(/-stopped$/, '');
  if (!existsSync(join(dir, 'store.json')) || !existsSync(join(dir, 'agent-log.jsonl'))) { console.log(`${name}: no store or agent log, skipped`); continue; }
  const { docs } = JSON.parse(readFileSync(join(dir, 'store.json'), 'utf8'));
  const all = readFileSync(join(dir, 'agent-log.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .map((x) => ({ input: x.input, answers: (x.agentLog ?? []).map((e) => ({ agent: e.agent, ...(e.actorId ? { actorId: e.actorId } : {}), turn: e.turn, ...(USED.has(e.status) ? { output: e.output } : {}) })) }));
  const firstTurn = Math.min(...all.flatMap((x) => x.answers.map((a) => a.turn)));
  // the earliest backup the log covers every turn after (a resumed run's log starts where it resumed)
  const backup = Object.keys(docs).filter((k) => /^stories\/[^/]+\/backups\/\d+$/.test(k)).map((k) => [k, +k.split('/').pop()]).sort((a, b) => a[1] - b[1]).find(([, t]) => t >= firstTurn - 1);
  if (!backup) { console.log(`${name}: no backup the log covers, skipped`); continue; }
  const [path, from] = backup;
  const story = path.split('/').slice(0, 2).join('/');
  const keep = Object.fromEntries(Object.entries(docs).filter(([k]) => k === story || k === path || k.startsWith(`${path}/parts/`)));
  const steps = all.filter((x) => x.answers.some((a) => a.turn > from));
  if (!steps.length) { console.log(`${name}: nothing after backup ${from}, skipped`); continue; }
  writeFileSync(join('tests/replay/runs', `${name}.json.gz`), gzipSync(JSON.stringify({ run: name, from, docs: keep, steps })));
  console.log(`${name}: from turn ${from}, ${steps.length} steps`);
}
