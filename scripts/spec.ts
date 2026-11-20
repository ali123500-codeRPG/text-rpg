// Read one part of the build spec instead of all of it. The spec is an index (docs/build-spec.md) and one file per topic
// under docs/spec/; this reads them all unless --file names one. Run with `npm run spec -- <query>`:
//   (no query)         every heading with its file, line and size
//   "Play screen"      the section under each heading that contains the text (case ignored)
//   BG-12, D-218, MAP-04  that ID's row in a table or list, or its own section (any LETTERS-number ID)
//   SEARCH_AREA_M2     the src/config/ file and line that set it, then the sections that mention it
//   --grep <text>      which sections mention the text, and how often (a file path finds the rules it carries)
//   --file <path>      read one other markdown file the same way (docs/bug-fix-log.md, docs/systems.md)
// Plain-syntax TypeScript so Node 22 runs it as is; tests/unit/spec-tool.test.ts checks it on the real spec.
// @ts-expect-error Node types are not installed; Node runs this file
import { readdirSync, readFileSync } from 'node:fs';
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
  // a wrapped rule goes on in lines indented under it, up to the next item or a blank line
  const rule = (i: number) => {
    let end = i + 1;
    while (end < lines.length && /^\s+\S/.test(lines[end]) && !/^\s*[-*] /.test(lines[end])) end++;
    return lines.slice(i, end).join('\n');
  };
  const rows = lines.flatMap((l, i) => (row.test(l) ? [rule(i)] : []));
  return [...rows, ...own.map((s) => lines.slice(s.start, s.end).join('\n'))];
}

/** does the line cite the ID, alone or inside a range ("LS1-LS5", "LS1 to LS5", "ST1–ST19")? */
export function cites(line: string, id: string): boolean {
  const m = /^([A-Z]+-?)(\d+)/.exec(id);
  if (!m) return false;
  const [, prefix, num] = m;
  if (new RegExp(`\\b${id}\\b(?!-\\d)`).test(line)) return true;
  const range = new RegExp(`\\b${prefix}(\\d+)\\s*(?:-|–|to)\\s*(?:${prefix})?(\\d+)\\b`, 'g');
  return [...line.matchAll(range)].some((r) => +r[1] <= +num && +num <= +r[2]);
}

/** the innermost section holding each line that mentions the text, with how many lines do */
export function mentions(lines: string[], text: string): { section: Section; count: number }[] {
  const all = sections(lines);
  const needle = text.toLowerCase();
  const hits = new Map<Section, number>();
  lines.forEach((l, i) => {
    // the spec escapes underscores (SEARCH\_AREA\_M2), so a setting's name is matched as written in code
    if (!l.replace(/\\_/g, '_').toLowerCase().includes(needle)) return;
    const own = all.filter((s) => s.start <= i && i < s.end).pop();
    if (own) hits.set(own, (hits.get(own) ?? 0) + 1);
  });
  return [...hits].map(([section, count]) => ({ section, count }));
}

/** where a CONFIG setting is set: the part of src/config/ and the line (settings move between parts, so look it up) */
export function settingAt(key: string): string[] {
  return readdirSync('src/config').filter((f: string) => f.endsWith('.ts')).flatMap((f: string) => readFileSync(`src/config/${f}`, 'utf8')
    .split('\n').flatMap((l: string, i: number) => (l.startsWith(`  ${key}:`) ? [`src/config/${f}:${i + 1}`] : [])));
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
  const grep = (text: string) => each((file, lines) => mentions(lines, text).map(({ section, count }) => `${String(count).padStart(4)}×  ${label(file, section)}`));
  if (rest[0] === '--grep') {
    const found = grep(rest.slice(1).join(' '));
    return found.length ? found.join('\n') : 'no mention';
  }
  const query = rest.join(' ');
  // a setting's name, as the spec names every lever: where it is set, then the sections that rule it
  const set = /^[A-Z][A-Z0-9_]+$/.test(query) ? settingAt(query) : [];
  if (set.length) return [...set.map((s) => `${query}: ${s}`), ...grep(query)].join('\n');
  if (/^[A-Z]+-\d+[a-z]?$/i.test(query)) {
    const rows = each((_, lines) => idRows(lines, query.toUpperCase()));
    if (rows.length) return rows.join('\n');
  }
  // a question ID (LS3) or an ID with no row: every line that cites it, in the spec and the decision history
  if (/^[A-Z]+-?\d+[a-z]?$/i.test(query)) {
    const memory = at >= 0 ? [] : readdirSync('docs/memory').filter((f: string) => f.endsWith('.md')).map((f: string) => `docs/memory/${f}`);
    const cited = [...docs, ...memory.map((file: string) => ({ file, lines: readFileSync(file, 'utf8').split('\n') as string[] }))]
      .flatMap(({ file, lines }) => lines.flatMap((l: string, i: number) => (cites(l, query.toUpperCase()) ? [`${file}:${i + 1}  ${l.trim().slice(0, 200)}`] : [])));
    return cited.length ? cited.join('\n') : `${query}: not cited in the spec or docs/memory`;
  }
  const hits = each((file, lines) => sections(lines)
    .filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
    .map((s) => `<!-- ${file}:${s.line + 1} -->\n${lines.slice(s.start, s.end).join('\n')}`));
  return hits.length ? hits.join('\n') : `no heading contains "${query}"; try --grep`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(run(process.argv.slice(2)));
