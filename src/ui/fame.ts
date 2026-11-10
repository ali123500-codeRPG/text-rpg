// Hall of fame: every fallen character, newest fall first. Read from the save (archived stories carry their fame entry),
// so it opens even when no story is running, which is right after a reset.
import type { FallenCharacter, GameApi } from '../types';
import { h } from './kit';
import { fellFacts, fellLine } from './fell';

const REFRESH_MS = 5000;

export function famePage(api: GameApi) {
  const el = h('main', { class: 'fame' });
  let rows: FallenCharacter[] | null = null, failed = false, fetchedAt = 0;
  const list = (title: string, xs: string[]) => (xs.length ? h('div', { class: 'fame-list' }, h('p', { class: 'hs-label' }, title),
    h('p', {}, ...xs.map((x) => h('span', { class: 'hs-tg' }, x)))) : '');
  // a card is two parts side by side when there is room: who they were and how they fell, then what they had
  const card = (c: FallenCharacter) => h('article', { class: 'fame-card' }, h('div', { class: 'fame-who' },
    h('div', { class: 'fame-h' },
      h('h2', {}, c.name, c.title ? h('small', {}, ` · ${c.title}`) : ''),
      c.owner === 'agent' ? h('span', { class: 'hs-tg cap' }, 'Agent’s story') : ''),
    h('p', { class: 'hs-note' }, `${c.classes.map((k) => `${k.name} ${k.level}`).join(', ') || 'No class'} · level ${c.level} · ${c.defeats} defeated`),
    h('p', { class: 'hs-note' }, `Fell on day ${c.day}, turn ${c.turn}, at ${c.place || 'an unknown place'}.`),
    h('p', { class: 'fame-cause' }, fellLine(c.downedBy, c.turn)),
    c.downedBy ? h('p', { class: 'hs-note' }, fellFacts(c.downedBy)) : ''),
    h('div', { class: 'fame-had' }, c.skills.length ? h('div', { class: 'fame-list' }, h('p', { class: 'hs-label' }, 'Best skills'),
      h('p', {}, ...c.skills.map((s) => h('span', { class: 'hs-tg' }, `${s.name} ${s.value}`)))) : '',
    list('Perks', c.perks), list('Achievements', c.achievements), list('Scars', c.scars)));
  function draw() {
    el.replaceChildren(
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Hall of fame'), h('p', {}, 'Everyone who fell, as they were when they went down. Newest first.'))),
      rows === null ? h('p', { class: 'empty', role: 'status' }, failed ? 'The hall of fame couldn’t be read from the save.' : 'Reading the save…')
        : rows.length ? h('div', { class: 'fame-grid' }, rows.map(card)) : h('p', { class: 'empty' }, 'Nobody has fallen yet.'));
  }
  function update() {
    draw();
    if (Date.now() - fetchedAt < REFRESH_MS) return;
    fetchedAt = Date.now();
    api.hallOfFame().then((r) => { rows = r; failed = false; draw(); }).catch(() => { failed = true; draw(); });
  }
  return { el, update };
}
