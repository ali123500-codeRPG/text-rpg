// TQ2/F7: saves real Weaver worlds from playtest runs as soak fixtures: each run's store.json trimmed to the story's
// head (meta, head, pages), so the soak run plays on worlds as strange as the ones players meet.
//   node scripts/soak-worlds.mjs /mnt/project-files/playtests/run-99-scenarios-50 [...more run folders]
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

for (const dir of process.argv.slice(2)) {
  const { docs } = JSON.parse(readFileSync(join(dir, 'store.json'), 'utf8'));
  const keep = Object.fromEntries(Object.entries(docs).filter(([k]) => /^stories\/[^/]+(\/control\/head|\/pages\/.*)?$/.test(k)));
  const out = join('tests/soak/worlds', `${basename(dir).replace(/-stopped$/, '')}.json`);
  writeFileSync(out, JSON.stringify(keep));
  console.log(`${out}: ${Object.keys(keep).length} docs, ${Math.round(JSON.stringify(keep).length / 1024)} KB`);
}
