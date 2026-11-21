// Hall of fame: every fallen character, newest fall first. Read from the save (archived stories carry their fame entry),
// so it opens even when no story is running, which is right after a reset. HF34 a: "Send to NPC template" puts the
// character's echo sheet on the library send list and wakes Claude, who adds it to the code library by PR.
import type { FallenCharacter, GameApi, GameState } from '../types';
import { claudeComments, h, keyCap, tint, type CommentsApi } from './kit';
import { fellFacts, fellLine } from './fell';
import { gradeLetter } from '../ruleset/reportCard';
import { GRADE_LETTERS } from '../scales';
import { itemIcon, skillMark, type IconName } from './itemIcons';
import { getLibrary } from '../library';
import { skillName } from '../library/skillNames';
import { TREE_VIEW } from './creation';
import { characterPage } from './pages';

const REFRESH_MS = 5000;

/** a grade's chip tone, as roll tiers are tinted: FFF to F red, E and D amber, C and B blue, A and up (MAX+ too) green */
const GRADES = Object.keys(GRADE_LETTERS);
const gradeTone = (g: string) => { const i = GRADES.indexOf(g); return i < 0 || i > 6 ? 'great' : i > 4 ? 'ok' : i > 2 ? 'near' : 'bad'; };
const RC_LINES: [keyof FallenCharacter['card'], IconName, string][] = [['combat', 'fig_power', 'Combat Power'], ['achievements', 'rc_achievements', 'Achievements'], ['reputation', 'rc_reputation', 'Reputation']];
/** each row's colour, from what it already means elsewhere: perks violet, achievements gold, scars red */
const ROW_TONE: Record<string, string> = { Perks: '--tg:var(--perk-40)', Achievements: '--tg:var(--scenario-mark)', Scars: '--tg:var(--danger)' };
/** a best skill: its icon in place of its name, then its value, tinted in its tree's colour (the entry keeps names only) */
const bestSkill = (s: { name: string; value: number }) => {
  const lib = getLibrary(), id = Object.keys(lib.skills).find((k) => skillName(k) === s.name);
  const tree = id ? TREE_VIEW.find((t) => lib.trees[t.id]?.skills.includes(id)) : undefined;
  return h('span', { class: 'hs-tg fame-sk', style: tree ? `--tg:var(--${tree.c})` : undefined }, id ? skillMark(id, s.name) : s.name, ` ${s.value}`);
};
/** a report card line: the line's icon in place of its name (name and grade in its tip and accessible name), then its letter */
const rcChip = (c: FallenCharacter, [k, icon, name]: (typeof RC_LINES)[number]) => {
  const g = gradeLetter(c.card[k]);
  return h('span', { class: `rc-g tier ${gradeTone(c.card[k])}`, role: 'img', title: `${name} ${tint(({ great: 'ok', ok: 'accent', near: 'warn', bad: 'danger' } as Record<string, string>)[gradeTone(c.card[k])], g)}`, 'aria-label': `${name} ${g}` }, itemIcon(icon, undefined, 'skico'), g);
};

/** YB5: a game handle on a fallen character's story as it ended: it reads, and nothing on the page can act through it */
function lookOnly(api: GameApi, s: GameState): GameApi {
  const none = async () => {};
  return { ...api, state: () => s, busy: () => true, fell: () => true, takePerk: none, undoPerk: none, submit: none, setSignatures: () => {} } as GameApi;
}

export function famePage(api: GameApi) {
  // the page holds the list, or one fallen character's sheet in its place (YB5 a: their Character page, read-only)
  const el = h('div', { class: 'fame-view' });
  const board = h('main', { class: 'fame' });
  let sheet: { storyId: string; el: HTMLElement } | null = null;
  const closeSheet = () => {
    if (!sheet) return;
    const id = sheet.storyId;
    sheet = null;
    if (history.state?.fameSheet) history.back();
    draw();
    el.querySelector<HTMLElement>(`[data-sheet="${id}"]`)?.focus();
  };
  async function openSheet(c: FallenCharacter) {
    notes.set(c.storyId, 'Opening their sheet…');
    draw();
    const s = await api.fallenSheet(c.storyId).catch(() => null);
    if (!s) { notes.set(c.storyId, 'Their story no longer loads, so their sheet can’t be opened.'); draw(); return; }
    notes.delete(c.storyId);
    const close = h('button', { type: 'button', class: 'hs-icon-btn', 'aria-label': 'Back to the Hall of fame', title: `Back to the Hall of fame ${keyCap('Esc')}`, onclick: closeSheet }, '✕');
    const page = characterPage(lookOnly(api, s), { title: [c.name, c.title ? h('small', {}, ` · ${c.title}`) : '', h('small', {}, ` · fell on day ${c.day}, turn ${c.turn}`)], close });
    page.update();
    sheet = { storyId: c.storyId, el: page.el };
    if (!history.state?.fameSheet) history.pushState({ fameSheet: true }, ''); // Back closes it
    draw();
    close.focus();
  }
  // Esc and Back close the sheet, but only once no pop-up is open over it (those close first)
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet && el.isConnected && !document.querySelector('.dpop, .fpop, .pk-card')) { e.preventDefault(); closeSheet(); }
  }, true);
  addEventListener('popstate', () => { if (sheet && !history.state?.fameSheet) { sheet = null; draw(); } });
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
    h('p', {}, ...xs.map((x) => h('span', { class: 'hs-tg', style: ROW_TONE[title] }, x)))) : '');
  // a card is two parts side by side when there is room: who they were and how they fell, then what they had
  const card = (c: FallenCharacter) => h('article', { class: 'fame-card' }, h('div', { class: 'fame-who' },
    h('div', { class: 'fame-h' },
      h('h2', {}, h('button', { type: 'button', class: 'fame-open', 'data-sheet': c.storyId, title: 'Their full sheet', onclick: () => void openSheet(c) }, c.name), c.title ? h('small', {}, ` · ${c.title}`) : ''),
      c.owner === 'agent' ? h('span', { class: 'hs-tg cap' }, 'Agent’s story') : ''),
    h('p', { class: 'hs-note' }, `${c.classes.map((k) => `${k.name} ${k.level}`).join(', ') || 'No class'} · level ${c.level} · ${c.defeats} defeated`),
    h('p', { class: 'hs-note' }, `Fell on day ${c.day}, turn ${c.turn}, at ${c.place || 'an unknown place'}.`),
    h('p', { class: 'fame-cause' }, fellLine(c.downedBy, c.turn)),
    c.downedBy ? h('p', { class: 'hs-note' }, fellFacts(c.downedBy)) : '',
    h('div', { class: 'fame-list' }, h('p', { class: 'hs-label' }, 'Report card'), h('p', {}, RC_LINES.map((l) => rcChip(c, l)))),
    sendRow(c)),
    h('div', { class: 'fame-had' }, c.skills.length ? h('div', { class: 'fame-list' }, h('p', { class: 'hs-label' }, 'Best skills'),
      h('p', {}, ...c.skills.map(bestSkill))) : '',
    list('Perks', c.perks), list('Achievements', c.achievements), list('Scars', c.scars)));
  function draw() {
    if (sheet) { if (el.firstChild !== sheet.el) el.replaceChildren(sheet.el); return; }
    if (el.firstChild !== board) el.replaceChildren(board);
    board.replaceChildren(
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Hall of fame'))),
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
