// Bundles each page into its own folder in dist/: a tiny index.html shell plus app.js, app.css and assets/ (fonts and
// the background picture). Publish the folder as ONE multi-file artifact: the shell is all a read-before-republish
// loads, and assets/ only goes up on the first publish (files left out of a later publish are kept).
// dist/play is the game; dist/library is the library viewer (src/ui/libraryViewer.ts).
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, relative } from 'node:path';

const git = (args) => { try { return execSync(`git ${args}`, { encoding: 'utf8' }).trim(); } catch { return ''; } };
const BUILD = { sha: git('rev-parse --short HEAD') || 'unknown', date: git('log -1 --format=%cI') || new Date().toISOString() };

async function page(entry, title, dir) {
  const outdir = `dist/${dir}`;
  await rm(outdir, { recursive: true, force: true });
  const out = await build({
    entryPoints: { app: entry },
    bundle: true, minify: true, write: false, format: 'iife', target: 'es2022', outdir,
    loader: { '.woff2': 'file', '.webp': 'file' }, assetNames: 'assets/[name]',
    define: { __BUILD__: JSON.stringify(BUILD) },
    logLevel: 'warning',
  });
  const files = [];
  for (const f of out.outputFiles) {
    await mkdir(dirname(f.path), { recursive: true });
    await writeFile(f.path, f.contents);
    files.push(relative(outdir, f.path));
  }
  // The ?v= stamp makes each build's app files a new URL, so a republish never runs against a cached old bundle.
  const v = BUILD.sha;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="app.css?v=${v}">
</head>
<body>
<script src="app.js?v=${v}"></script>
</body>
</html>
`;
  await writeFile(`${outdir}/index.html`, html);
  console.log(`${outdir}/index.html + ${files.sort().join(', ')}`);
}

await mkdir('dist', { recursive: true });
await page('src/ui/main.ts', 'Slime Field Swordsman', 'play');
await page('src/ui/libraryViewer.ts', 'Library viewer', 'library');
