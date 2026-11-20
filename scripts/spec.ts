// Read one part of the build spec instead of all of it. The spec is an index (docs/build-spec.md) and one file per topic
// under docs/spec/; this reads them all unless --file names one. Run with `npm run spec -- <query>`:
//   (no query)         every heading with its file, line and size
//   "Play screen"      the section under each heading that contains the text (case ignored)
//   BG-12, D-218, MAP-04  that ID's row in a table or list, or its own section (any LETTERS-number ID)
//   --grep <text>      which sections mention the text, and how often (a file path finds the rules it carries)
//   --file <path>      read one other markdown file the same way (docs/bug-fix-log.md, docs/systems.md)
// Plain-syntax TypeScript so Node 22 runs it as is; tests/unit/spec-tool.test.ts checks it on the real spec.
// @ts-expect-error Node types are not installed; Node runs this file
import { readFileSync } from 'node:fs';
// @ts-expect-error Node types are not installed; Node runs this file
import { pathToFileURL } from 'node:url';

declare const process: { argv: string[] };

export interface Section { line: number; depth: number; title: string; start: number; end: number; bytes: number }

/** every markdown heading, with the lines it owns: up to the next heading of the same or a higher level */
export function sections(lines: string[]): Section[] {
  const heads: { line: number; depth: number; title: string }[] = [];
  let fenced = false;
  lines.forEach((l, i) => {
    if (l.startsWith('```')) fenced = !fenced;
    const m = !fenced && /^(#{1,6}) (.+)$/.exec(l);
    if (m) heads.push({ line: i, depth: m[1].length, title: m[2].replace(/\\/g, '') });
  });
  return heads.map((h, k) => {
    const next = heads.slice(k + 1).find((o) => o.depth <= h.depth);
    const end = next ? next.line : lines.length;
    const bytes = lines.slice(h.line, end).reduce((n, l) => n + new TextEncoder().encode(l).length + 1, 0);
    return { ...h, start: h.line, end, bytes };
  });
}

/** the lines that define an ID: a table row that starts with it, a list item or line that opens with it (bold or not),
 *  or its own section */
export function idRows(lines: string[], id: string): string[] {
  const row = new RegExp(`^(\\| ${id} \\||(- )?\\**${id}\\b(?!-))`);
  const own = sections(lines).filter((s) => new RegExp(`^${id}\\b`).test(s.title));
  return [...lines.filter((l) => row.test(l)), ...own.map((s) => lines.slice(s.start, s.end).join('\n'))];
}

/** the innermost section holding each line that mentions the text, with how many lines do */
export function mentions(lines: string[], text: string): { section: Section; count: number }[] {
  const all = sections(lines);
  const needle = text.toLowerCase();
  const hits = new Map<Section, number>();
  lines.forEach((l, i) => {
    if (!l.toLowerCase().includes(needle)) return;
    const own = all.filter((s) => s.start <= i && i < s.end).pop();
    if (own) hits.set(own, (hits.get(own) ?? 0) + 1);
  });
  return [...hits].map(([section, count]) => ({ section, count }));
}

export const SPEC_INDEX = 'docs/build-spec.md';

/** the index, then every topic file it links, in reading order */
export function specFiles(): string[] {
  const links = readFileSync(SPEC_INDEX, 'utf8').matchAll(/\]\((spec\/[^)]+\.md)\)/g);
  return [SPEC_INDEX, ...[...links].map((m) => `docs/${m[1]}`)];
}

const kb = (b: number) => `${(b / 1024).toFixed(0).padStart(4)} KB`;
const label = (file: string, s: Section) => `${file}:${s.line + 1}  ${'#'.repeat(s.depth)} ${s.title}`;

export function run(args: string[]): string {
  const at = args.indexOf('--file');
  const files = at >= 0 ? [args[at + 1]] : specFiles();
  const rest = at >= 0 ? args.filter((_, i) => i !== at && i !== at + 1) : args;
  const docs = files.map((file) => ({ file, lines: readFileSync(file, 'utf8').split('\n') as string[] }));
  const each = (f: (file: string, lines: string[]) => string[]) => docs.flatMap(({ file, lines }) => f(file, lines));
  if (!rest.length) return each((file, lines) => sections(lines).map((s) => `${kb(s.bytes)}  ${label(file, s)}`)).join('\n');
  if (rest[0] === '--grep') {
    const text = rest.slice(1).join(' ');
    const found = each((file, lines) => mentions(lines, text).map(({ section, count }) => `${String(count).padStart(4)}×  ${label(file, section)}`));
    return found.length ? found.join('\n') : 'no mention';
  }
  const query = rest.join(' ');
  if (/^[A-Z]+-\d+[a-z]?$/i.test(query)) {
    const rows = each((_, lines) => idRows(lines, query.toUpperCase()));
    return rows.length ? rows.join('\n') : `${query}: no row`;
  }
  const hits = each((file, lines) => sections(lines)
    .filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
    .map((s) => `<!-- ${file}:${s.line + 1} -->\n${lines.slice(s.start, s.end).join('\n')}`));
  return hits.length ? hits.join('\n') : `no heading contains "${query}"; try --grep`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(run(process.argv.slice(2)));
