// Hall of fame: every fallen character, newest fall first. Read from the save (archived stories carry their fame entry),
// so it opens even when no story is running, which is right after a reset. HF34 a: "Send to NPC template" puts the
// character's echo sheet on the library send list and wakes Claude, who adds it to the code library by PR.
import type { FallenCharacter, GameApi } from '../types';
import { claudeComments, h, type CommentsApi } from './kit';
import { fellFacts, fellLine } from './fell';

const REFRESH_MS = 5000;

export function famePage(api: GameApi) {
  const el = h('main', { class: 'fame' });
  let rows: FallenCharacter[] | null = null, failed = false, fetchedAt = 0;
  let comments: CommentsApi | null = null;
  const notes = new Map<string, string>(); // what the last send said, by story
  claudeComments().then((c) => { comments = c; }).catch(() => undefined);
  async function send(c: FallenCharacter, btn: HTMLButtonElement) {
    btn.disabled = true;
    notes.set(c.storyId, 'Sending…');
    draw();
    const r = await api.sendHero(c.storyId).catch(() => ({ error: 'The send couldn’t be saved. Try again.' }));
    if ('error' in r) { notes.set(c.storyId, r.error); fetchedAt = 0; return update(); }
    const woke = comments ? await comments.sendToClaude({ anchor: await comments.anchorFor(btn), text: `${c.name} was sent to NPC template: add them to the library as a unique (an echo) by PR, from db library_sends/${r.id} (thread "Turn hall of fame heroes into NPCs").` }).then(() => true, () => false) : false;
    notes.set(c.storyId, woke ? 'Sent to Claude. They join the NPC templates once Claude’s PR merges.' : 'Saved to the send list, but Claude couldn’t be reached from here. Leave a comment on this page and send it to Claude.');
    fetchedAt = 0;
    update();
  }
  const sendRow = (c: FallenCharacter) => {
    if (c.inLibrary) return h('p', { class: 'fame-send' }, h('span', { class: 'hs-tg cap' }, 'In the NPC templates'));
    const btn = h('button', { type: 'button', class: 'hs-btn-main' }, c.sent ? 'Send again' : 'Send to NPC template') as HTMLButtonElement;
    btn.onclick = () => { void send(c, btn); };
    return h('p', { class: 'fame-send' }, btn, h('span', { class: 'hs-note', role: 'status' }, notes.get(c.storyId) ?? (c.sent ? 'Sent. Waiting for Claude’s PR.' : '')));
  };
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
    c.downedBy ? h('p', { class: 'hs-note' }, fellFacts(c.downedBy)) : '',
    sendRow(c)),
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
