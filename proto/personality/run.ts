// Personality line prototype runner.
//   explain            print each character's computed line and how it was chosen
//   check              fail if a character's archetype, buts, tensions or nerve word moved
//   build <out dir> [character keys]   write one Responder prompt per scene and mode (auto, full) for blind voice-test runs
// Run: npx esbuild proto/personality/run.ts --bundle --platform=node --format=esm --outfile=dist/proto-personality.mjs && node dist/proto-personality.mjs explain
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { FIXED } from '../../src/agents/prompts';
import { CHARACTERS, EXPECTED } from './characters';
import { parts, personalityLine, type Character } from './line';

const [cmd = 'explain', ...args] = process.argv.slice(2);
const sceneDir = join(process.cwd(), 'proto/personality/scenes');

/** KS16: when CHARACTER's lines disagree, which one wins */
const ORDER_RULE = ' Where CHARACTER\'s lines disagree, a line written for you alone wins, then a tension, then the "at heart" line.';
function responderRules() {
  const anchor = 'Play your band\'s goals and temperament, as given in CHARACTER.';
  const rules: string = (FIXED as Record<string, string>).responder;
  if (!rules.includes(anchor)) throw new Error('Responder rule 7 anchor moved; update ORDER_RULE placement');
  return rules.replace(anchor, anchor + ORDER_RULE);
}

function characterBlock(c: Character, full: boolean) {
  return {
    id: c.name.toLowerCase(), name: full && c.title ? `${c.name}, ${c.title}` : c.name, role: c.role, band: c.name,
    personality: personalityLine(c, { full }), bandGoals: c.bandGoals, temperament: c.temperament, tactics: c.tactics,
  };
}

if (cmd === 'explain') {
  for (const c of CHARACTERS) {
    const p = parts(c);
    console.log(`\n== ${c.key} (${c.name})`);
    console.log(`archetype: ${p.arch.name}${p.pinned ? ' (pinned)' : ''}; nearest: ${p.gaps.slice(0, 3).map((g) => `${g.a.name} ${g.gap.toFixed(1)}`).join(', ')}`);
    console.log(`buts: ${p.buts.map((b) => `${b.ax} ${b.v} (target ${b.t}, gap ${b.gap})`).join('; ') || 'none'}`);
    console.log(`tensions met: ${p.tensionsMet.map((t) => t.key).join(', ') || 'none'}; shown ${p.tensions.length}`);
    console.log(`auto: ${personalityLine(c)}`);
  }
} else if (cmd === 'check') {
  let bad = 0;
  for (const c of CHARACTERS) {
    const p = parts(c), e = EXPECTED[c.key];
    const got = { archetype: p.arch.key, buts: p.buts.map((b) => b.ax), tensions: p.tensions.map((t) => t.key), nerve: p.nerve.word };
    if (JSON.stringify(got) !== JSON.stringify(e)) { bad++; console.log(`FAIL ${c.key}\n  want ${JSON.stringify(e)}\n  got  ${JSON.stringify(got)}`); }
    else console.log(`ok ${c.key}`);
  }
  process.exit(bad ? 1 : 0);
} else if (cmd === 'build') {
  const out = args[0];
  if (!out) throw new Error('usage: build <out dir>');
  mkdirSync(out, { recursive: true });
  const rules = responderRules().trimEnd();
  const block = (k: string, v: unknown) => `${k}:\n${typeof v === 'string' ? v : JSON.stringify(v)}`;
  let n = 0;
  const keys = args.slice(1);
  for (const c of CHARACTERS.filter((ch) => !keys.length || keys.includes(ch.key))) {
    const dir = c.scenes?.dir ?? c.key;
    const files = readdirSync(join(sceneDir, dir)).filter((f) => f.endsWith('.json') && (!c.scenes?.only || c.scenes.only.includes(f.replace('.json', '')))).sort();
    for (const file of files) {
      const s = JSON.parse(readFileSync(join(sceneDir, dir, file), 'utf8'));
      for (const mode of ['auto', 'full']) {
        const input = [block('CHARACTER', characterBlock(c, mode === 'full')), block('OPPOSITION_VIEW', s.view),
          block('DIALOGUE_INPUT', s.dialogue), block('COMMITTED', 'none'), block('SLIPS', 'none')].join('\n\n');
        writeFileSync(join(out, `${c.key}-${file.replace('.json', '')}-${mode}.txt`), `${rules}\n\n${input}\n`);
        n++;
      }
    }
  }
  console.log(`built ${n} prompts in ${out}`);
} else {
  throw new Error(`unknown command ${cmd}`);
}
