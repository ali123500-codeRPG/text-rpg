// Read one part of docs/build-spec.md instead of the whole file. Run with `npm run spec -- <query>`:
//   (no query)         every heading with its line and size
//   "Play screen"      the section under each heading that contains the text (case ignored)
//   BG-12, D-218, OQ-9 that ID's row in its table or list
//   --grep <text>      which sections mention the text, and how often (a file path finds the rules it carries)
//   --file <path>      read another markdown file the same way (docs/bug-fix-log.md, docs/instructions.md)
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

/** the lines that define an ID: a table row that starts with it, a list item that opens with it, or its own section */
export function idRows(lines: string[], id: string): string[] {
  const row = new RegExp(`^(\\| ${id} \\||- \\**${id}\\b)`);
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

const kb = (b: number) => `${(b / 1024).toFixed(0).padStart(4)} KB`;
const label = (s: Section) => `${String(s.line + 1).padStart(5)}  ${'#'.repeat(s.depth)} ${s.title}`;

export function run(args: string[]): string {
  const at = args.indexOf('--file');
  const file = at >= 0 ? args[at + 1] : 'docs/build-spec.md';
  const rest = at >= 0 ? args.filter((_, i) => i !== at && i !== at + 1) : args;
  const lines = readFileSync(file, 'utf8').split('\n');
  if (!rest.length) return sections(lines).map((s) => `${kb(s.bytes)} ${label(s)}`).join('\n');
  if (rest[0] === '--grep') {
    const found = mentions(lines, rest.slice(1).join(' '));
    return found.length ? found.map(({ section, count }) => `${String(count).padStart(4)}× ${label(section)}`).join('\n') : 'no mention';
  }
  const query = rest.join(' ');
  if (/^(BG|D|OQ)-\d+$/i.test(query)) {
    const rows = idRows(lines, query.toUpperCase());
    return rows.length ? rows.join('\n') : `${query}: no row`;
  }
  const hits = sections(lines).filter((s) => s.title.toLowerCase().includes(query.toLowerCase()));
  if (!hits.length) return `no heading contains "${query}"; try --grep`;
  return hits.map((s) => lines.slice(s.start, s.end).join('\n')).join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(run(process.argv.slice(2)));
