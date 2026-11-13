// PL14, PL17: the player's personality: the creation picker (Nerve line, trait points, values) and the sheet's block
// (Nerve tier, trait words, values, archetype). Everything shown is read from the points by src/ruleset/personality.ts.
import type { Actor, Personality } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { NERVE_HINTS, NERVE_LINES, type NerveLine } from '../scales';
import { archetypeOf, nerveLine, nerveTier, personalityFrom, personalityOf, traitWords } from '../ruleset/personality';
import { h } from './kit';
import { cap } from '../words';

const LINE_HINT = (l: NerveLine) => cap(NERVE_HINTS[l]);
const lineName = (l: NerveLine) => cap(l);
export const blankPersonality = (): Personality => ({ nerve: 0, traits: {}, values: [] });

/** one trait's word on its own ("a bit honest"), or null under the lean */
function traitWord(k: string, v: number): string | null {
  return traitWords({ nerve: 0, traits: { [k]: v }, values: [] })[0] ?? null;
}

/** what others will read: trait words, values and the archetype, one line */
function readLine(a: Actor): string {
  const p = personalityOf(a), lib = getLibrary();
  const words = traitWords(p), values = p.values.map((v) => lib.values?.[v]?.name).filter(Boolean) as string[];
  return [
    words.length ? `${cap(words.join(', '))}.` : 'No strong leanings.',
    values.length ? `Values ${values.join(', ')}.` : '',
    `${archetypeOf(p).name} at heart.`,
  ].filter(Boolean).join(' ');
}

/**
 * PL14: the creation picker. `st` is kept by the caller so it survives a class switch; `actor` builds the preview
 * sheet (Resolve, class and perks change the tier and archetype). Returns the element and a refresh for the caller's render.
 */
export function personalityPicker(st: { p: Personality }, actor: () => Actor): { el: HTMLElement; refresh: () => void } {
  const lib = getLibrary();
  const axes = Object.values(lib.personalityAxes ?? {});
  const values = Object.values(lib.values ?? {});
  const tierOut = h('b', { class: 'pe-tier' });
  const readOut = h('p', { class: 'pe-read', 'aria-live': 'polite' });
  const lines = (Object.keys(NERVE_LINES) as NerveLine[]).map((l) => h('button', { type: 'button', title: LINE_HINT(l),
    onclick: () => { st.p = personalityFrom(st.p, { nerve: l }); refresh(); } }, lineName(l)));
  const axisRows = axes.map((a) => {
    const word = h('span', { class: 'pe-word' });
    const fill = h('i', { class: 's' });
    const range = h('input', { type: 'range', min: '-100', max: '100', step: '5', 'aria-label': `${a.name}: ${a.low} to ${a.high}`,
      oninput: (e: Event) => { const v = +(e.target as HTMLInputElement).value; if (v) st.p.traits[a.id] = v; else delete st.p.traits[a.id]; refresh(); } });
    const row = h('div', { class: 'pe-axis', 'data-axis': a.id },
      h('div', { class: 'nm' }, h('b', {}, a.name), word),
      h('div', { class: 'pe-ends' }, h('span', {}, a.low), h('div', { class: 'bar' }, h('div', { class: 'tr' }, fill), h('span', { class: 'tk', style: 'left:50%' }), range), h('span', {}, a.high)));
    return { a, row, word, fill, range };
  });
  const valueBtns = values.map((v) => h('button', { type: 'button', 'data-value': v.id, onclick: () => {
    const i = st.p.values.indexOf(v.id);
    if (i >= 0) st.p.values.splice(i, 1); else if (st.p.values.length < CONFIG.DRIVES_SHOWN) st.p.values.push(v.id);
    refresh();
  } }, cap(v.name)));

  function refresh() {
    const a = actor(), line = nerveLine(st.p);
    lines.forEach((b, i) => b.setAttribute('aria-pressed', String(Object.keys(NERVE_LINES)[i] === line)));
    tierOut.textContent = nerveTier(a);
    for (const r of axisRows) {
      const v = st.p.traits[r.a.id] ?? 0;
      r.range.value = String(v);
      r.fill.style.left = `${50 + Math.min(0, v) / 2}%`;
      r.fill.style.width = `${Math.abs(v) / 2}%`;
      const w = traitWord(r.a.id, v);
      r.word.textContent = w ?? 'no lean';
      r.word.classList.toggle('none', !w);
    }
    valueBtns.forEach((b) => {
      const on = st.p.values.includes(b.dataset.value!);
      b.setAttribute('aria-pressed', String(on));
      (b as HTMLButtonElement).disabled = !on && st.p.values.length >= CONFIG.DRIVES_SHOWN;
    });
    readOut.textContent = readLine(a);
  }

  const el = h('section', { class: 'pe', 'aria-label': 'Personality' },
    h('div', { class: 'grp-h' }, h('h2', { class: 'hs-section' }, 'Personality'),
      h('button', { class: 'hs-btn-text', type: 'button', onclick: () => { st.p = blankPersonality(); refresh(); } }, 'Clear')),
    h('p', { class: 'pe-note' }, 'Shown on your sheet. It never stops you doing anything; perks, classes and achievements can shift it later.'),
    h('div', { class: 'pe-top' },
      h('div', { class: 'pe-nerve' }, h('span', { class: 'hs-label' }, 'Nerve'), h('div', { class: 'hs-picker', role: 'group', 'aria-label': 'Nerve line' }, lines),
        h('span', { class: 'pe-tierline', title: `Your tier on the line comes from raw Resolve (${CONFIG.NERVE_TIER_FROM.join(', ')})` }, 'Now ', tierOut, ', rising with Resolve')),
      h('div', { class: 'pe-values' }, h('span', { class: 'hs-label' }, `Values · up to ${CONFIG.DRIVES_SHOWN}, strongest first`), h('div', { class: 'hs-picker', role: 'group', 'aria-label': 'Values' }, valueBtns))),
    h('div', { class: 'pe-axes' }, axisRows.map((r) => r.row)),
    readOut);
  refresh();
  return { el, refresh };
}

/** PL17: the sheet's block: Nerve tier and line, trait words, values and the archetype (with how it acts) */
export function personalityBlock(a: Actor): HTMLElement {
  const p = personalityOf(a), lib = getLibrary(), line = nerveLine(p);
  const words = traitWords(p), values = p.values.map((v) => lib.values?.[v]?.name).filter(Boolean) as string[];
  const arch = archetypeOf(p);
  return h('div', { class: 'cs-gear cs-pe' }, h('p', { class: 'hs-label' }, 'Personality'),
    h('span', { title: `${LINE_HINT(line)}. Your tier on the line rises with raw Resolve.` }, h('b', { class: 'cs-pe-v' }, nerveTier(a, p)), ` · ${lineName(line)} nerve`),
    h('span', {}, words.length ? cap(words.join(', ')) : 'No strong leanings'),
    values.length ? h('span', {}, `Values ${values.join(', ')}`) : null,
    h('span', {}, h('b', { class: 'cs-pe-v' }, arch.name), ` · ${arch.hint}`));
}
