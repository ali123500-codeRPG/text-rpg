// One imported name per line, sorted, in the files that many PRs change at once (Phase 1 of the split, SX5): two PRs that
// add different names to the same import then touch different lines, so they merge. Statement order is kept as written,
// because it is the order modules first run in; imports placed lower in a file move up to join the header, which keeps
// that order (imports run before the file's own code wherever they stand). Run `node scripts/imports.ts` to rewrite the
// files; tests/unit/imports-format.test.ts fails while one is out of form. Plain-syntax TypeScript so Node 22 runs it.
// @ts-expect-error Node types are not installed; Node runs this file
import { readFileSync, writeFileSync } from 'node:fs';
// @ts-expect-error Node types are not installed; Node runs this file
import { pathToFileURL } from 'node:url';

declare const process: { argv: string[]; exitCode?: number };

/** the files kept in this form */
export const ONE_PER_LINE = ['src/engine/resolve.ts', 'src/library/data.ts'];

// a whole import statement at the top level, on one line or already split, ending in its specifier
const STATEMENT = /^import\s+(type\s+)?([^;]*?)\s*from\s*(['"][^'"]+['"]);?[ \t]*$/gm;

const nameKey = (n: string) => n.replace(/^type\s+/, '').toLowerCase();

function formatClause(typeOnly: string, clause: string, spec: string): string {
  const braces = /^([^{]*?)\{([^}]*)\}\s*$/s.exec(clause);
  if (!braces) return `import ${typeOnly}${clause.trim()} from ${spec};`;
  const names = braces[2].split(',').map((n) => n.trim().replace(/\s+/g, ' ')).filter(Boolean)
    .sort((a, b) => nameKey(a).localeCompare(nameKey(b)) || a.localeCompare(b));
  const lead = braces[1].trim(); // a default import before the braces: `x, {`
  return `import ${typeOnly}${lead ? `${lead} ` : ''}{\n${names.map((n) => `  ${n},\n`).join('')}} from ${spec};`;
}

/** every top-level import gathered under the file's opening comment, in its own order, one name per line */
export function formatImports(text: string): string {
  const found: string[] = [];
  const rest = text.replace(STATEMENT, (_m: string, typeOnly: string | undefined, clause: string, spec: string) => {
    found.push(formatClause(typeOnly ?? '', clause, spec));
    return '\u0000';
  }).split('\n').filter((l: string) => l !== '\u0000').join('\n');
  const lines = rest.split('\n');
  let head = 0;
  while (head < lines.length && /^\/\//.test(lines[head])) head++;
  return [...lines.slice(0, head), ...found, ...lines.slice(head)].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const f of ONE_PER_LINE) {
    const before = readFileSync(f, 'utf8');
    const after = formatImports(before);
    if (after !== before) writeFileSync(f, after);
    console.log(`${f}: ${after === before ? 'already in form' : 'rewritten'}`);
  }
}
