// Bundles each page into ONE self-contained HTML file in dist/: JS, CSS, fonts and the background picture inlined.
// dist/index.html is the game; dist/library.html is the library viewer (src/ui/libraryViewer.ts).
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const git = (args) => { try { return execSync(`git ${args}`, { encoding: 'utf8' }).trim(); } catch { return ''; } };
const BUILD = { sha: git('rev-parse --short HEAD') || 'unknown', date: git('log -1 --format=%cI') || new Date().toISOString() };

async function page(entry, title, file) {
  const out = await build({
    entryPoints: [entry],
    bundle: true, minify: true, write: false, format: 'iife', target: 'es2022', outdir: 'dist',
    loader: { '.woff2': 'dataurl', '.webp': 'dataurl' },
    define: { __BUILD__: JSON.stringify(BUILD) },
    logLevel: 'warning',
  });
  const pick = (ext) => out.outputFiles.filter((f) => f.path.endsWith(ext)).map((f) => f.text).join('\n');
  const js = pick('.js').replace(/<\/script/gi, '<\\/script');
  const css = pick('.css').replace(/<\/style/gi, '<\\/style');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${css}</style>
</head>
<body>
<script>${js}</script>
</body>
</html>
`;
  await writeFile(`dist/${file}`, html);
  console.log(`dist/${file} ${(html.length / 1024).toFixed(0)} KB`);
}

await mkdir('dist', { recursive: true });
await page('src/ui/main.ts', 'Slime Field Swordsman', 'index.html');
await page('src/ui/libraryViewer.ts', 'Library viewer', 'library.html');
