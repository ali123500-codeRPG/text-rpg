// WZ1 risk guard: a gallery of seeds for each region kind, rendered and looked at before every land change is merged.
// npm run land-gallery [-- seeds] -> dist/land-gallery.html and dist/land-gallery.png
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { drawRegion, type RegionBrief } from '../src/land/generate';
import { landLayer, landMarks } from '../src/ui/landSvg';
import { RK, LM } from '../src/library/tableIds';

const seeds = Number(process.argv[2] ?? 3);
const brief = (kind: string): RegionBrief => ({
  kind, name: 'Sample', look: '', river: { name: 'the Wend' },
  settlements: [
    { size: 'town', name: 'Marbury', look: '', where: 'crossing' },
    { size: 'village', name: 'Thornbury', look: '' }, { size: 'village', name: 'Ashwell', look: '', where: 'hill' }, { size: 'village', name: 'Coldridge', look: '' },
    { size: 'hamlet', name: 'Hob End', look: '' }, { size: 'hamlet', name: 'Sallow', look: '', where: 'woods' }, { size: 'hamlet', name: 'Netherby', look: '' },
  ],
  features: [{ kind: LM.quarry, name: 'old quarry', look: '' }, { kind: LM.ruin, name: 'the burnt tower', look: '' }],
});
const cards: string[] = [];
const t0 = Date.now();
let bytes = 0;
for (const kind of Object.values(RK)) for (let k = 1; k <= seeds; k++) {
  const r = drawRegion(`rg${k}`, 0, 0, 1000 * k + 7, brief(kind));
  const svg = `${landLayer(r)}${landMarks(r)}`; bytes += svg.length;
  cards.push(`<figure><svg viewBox="0 ${-r.size} ${r.size} ${r.size}">${svg}</svg><figcaption>${kind} seed ${1000 * k + 7}: ${r.sites.length} sites, ${r.roads.length} road lines, ${r.waters.length} waters, ${r.roads.reduce((n, x) => n + x.crossings.length, 0)} crossings</figcaption></figure>`);
}
const ms = Date.now() - t0;
const css = `body{background:#0d1222;color:#dde;font:14px system-ui;margin:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
figure{margin:0}svg{width:100%;display:block}figcaption{margin-top:4px}
.lc-LC1{fill:#6b6a3a}.lc-LC2{fill:#4b6b3e}.lc-LC3{fill:#24513a}.lc-LC4{fill:#5d4f66}.lc-LC5{fill:#6d5f55}.lc-LC6{fill:#3b5a5a}.lc-LC7{fill:#77736c}.lc-LC8{fill:#8a7552}.lc-LC9{fill:#5a7d4a}
.land-contour{fill:none;stroke:#000;stroke-opacity:.18;stroke-width:8px}.land-contour-major{stroke-opacity:.32;stroke-width:14px}
.land-water{fill:none;stroke:#6fb4e8;stroke-linecap:round;stroke-linejoin:round;stroke-width:max(calc(var(--w) * 1px), 14px)}.land-stream{stroke-width:12px}
.land-road{fill:none;stroke:#f1dfae;stroke-width:28px;stroke-linecap:round;stroke-linejoin:round}.land-path{stroke-width:16px;stroke-dasharray:60 50}
.land-bridge{fill:#f1dfae}.land-ford{fill:none;stroke:#f1dfae;stroke-width:12px}
.land-site circle{fill:#1d1a12;stroke:#f1dfae;stroke-width:24px}.land-site text,.land-feature text{fill:#fff;font:bold 230px system-ui;text-anchor:middle;paint-order:stroke;stroke:#000;stroke-width:40px}
.land-feature rect{fill:#c88;stroke:#000;stroke-width:16px}.land-faint{opacity:.45}`;
writeFileSync('dist/land-gallery.html', `<!doctype html><meta charset=utf-8><style>${css}</style>${cards.join('')}`);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
await page.goto(`file://${process.cwd()}/dist/land-gallery.html`);
await page.screenshot({ path: 'dist/land-gallery.png', fullPage: true });
await browser.close();
console.log(`drew ${cards.length} regions in ${ms} ms, svg ${Math.round(bytes / cards.length / 1024)} KB each -> dist/land-gallery.png`);
