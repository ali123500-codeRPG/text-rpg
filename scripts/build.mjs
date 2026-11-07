// Bundles src/ui/main.ts into ONE self-contained dist/index.html: JS, CSS, fonts and the background picture inlined.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';

const out = await build({
  entryPoints: ['src/ui/main.ts'],
  bundle: true, minify: true, write: false, format: 'iife', target: 'es2022', outdir: 'dist',
  loader: { '.woff2': 'dataurl', '.webp': 'dataurl' },
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
<title>Slime Field Swordsman</title>
<style>${css}</style>
</head>
<body>
<script>${js}</script>
</body>
</html>
`;
await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', html);
console.log(`dist/index.html ${(html.length / 1024).toFixed(0)} KB`);
