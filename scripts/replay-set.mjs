// TQ3 replay set: turns the real agent answers of playtest runs into CI fixtures. For each run folder: its earliest
// backup (the whole world at that turn) and every later step's player input with the Parser, Planner, Responder,
// Voice and Weaver answers it got (agent-log.jsonl), gzipped to tests/replay/runs/<run>.json.gz.
//   node scripts/replay-set.mjs /mnt/project-files/playtests/run-99-scenarios-50 [...more run folders]
// A resumed run whose log no backup covers starts from the world it resumed from: resumed-from.json (written by
// playtest --resume), else the run folder one letter back (run-97c for run-97d) when its last turn fits.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
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
  let path, from, keep, head = false;
  if (backup) {
    [path, from] = backup;
    const story = path.split('/').slice(0, 2).join('/');
    keep = Object.fromEntries(Object.entries(docs).filter(([k]) => k === story || k === path || k.startsWith(`${path}/parts/`)));
  } else {
    const src = resumedFrom(dir);
    // the game turn it resumed after (the store's step counts playtest inputs, not turns)
    const headDoc = src && Object.entries(src.docs).find(([k]) => /^stories\/[^/]+\/control\/head$/.test(k));
    const turn = headDoc ? Number(/"turn":(\d+)/.exec(headDoc[1])?.[1] ?? NaN) : NaN;
    if (!(turn >= firstTurn - 1)) { console.log(`${name}: no backup the log covers and no world it resumed from, skipped`); continue; }
    // the saved story as the run resumed it (its head and pages; not its turn records, backups or story text)
    keep = Object.fromEntries(Object.entries(src.docs).filter(([k]) => /^stories\/[^/]+(\/(pages|control)(\/|$)|$)/.test(k)));
    from = turn;
    head = true;
  }
  const steps = all.filter((x) => x.answers.some((a) => a.turn > from));
  if (!steps.length) { console.log(`${name}: nothing after backup ${from}, skipped`); continue; }
  writeFileSync(join('tests/replay/runs', `${name}.json.gz`), gzipSync(JSON.stringify({ run: name, from, ...(head ? { head } : {}), docs: keep, steps })));
  console.log(`${name}: from turn ${from}${head ? ' (where it resumed)' : ''}, ${steps.length} steps`);
}

/** the store a resumed run started from: resumed-from.json, else the folder one letter back */
function resumedFrom(dir) {
  const read = (d) => (existsSync(join(d, 'store.json')) ? JSON.parse(readFileSync(join(d, 'store.json'), 'utf8')) : null);
  if (existsSync(join(dir, 'resumed-from.json'))) return read(JSON.parse(readFileSync(join(dir, 'resumed-from.json'), 'utf8')).dir);
  const m = /^(run-\d+)([a-z]?)(-.*?)(-stopped)?$/.exec(basename(dir));
  if (!m || !m[2]) return null;
  const prev = `${m[1]}${m[2] === 'b' ? '' : String.fromCharCode(m[2].charCodeAt(0) - 1)}${m[3]}`;
  for (const d of [prev, `${prev}-stopped`]) { const s = read(join(dirname(dir), d)); if (s) return s; }
  return null;
}
