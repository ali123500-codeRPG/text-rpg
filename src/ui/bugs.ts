// Bugs: report a bug from play, see the open bugs (the game's own filings and the threads'), and send them to Claude.
// Reports are numbered from the same counter as every other bug (src/save/bugs.ts). "Report bug" saves the report and
// then sends every open bug to Claude (BG-27: pressing it sends them), the same as "Send open bugs to
// Claude": a comment sent to Claude (the comments capability), which wakes the thread that triages them. The send
// button stays for sending again; it is hidden, and a report is only saved, when the page can't send to Claude.
import type { GameApi } from '../types';
import type { FiledBug } from '../save/bugs';
import { h } from './kit';

const REFRESH_MS = 5000;
type CommentsApi = { anchorFor(el: Element): Promise<unknown>; canSendToClaude(): Promise<string>; sendToClaude(t: { anchor: unknown; text: string }): Promise<unknown> };

/** one line saying what went wrong: the player's note, else the first error, else the code */
export function bugSummary(b: FiledBug): string {
  const errs = b.errors as { message?: string }[] | undefined;
  const text = typeof b.note === 'string' ? b.note : typeof b.detail === 'string' ? b.detail : errs?.[0]?.message ?? '';
  return text.length > 220 ? `${text.slice(0, 217)}…` : text;
}

export function bugsPage(api: GameApi) {
  const el = h('main', { class: 'bugs' });
  let rows: FiledBug[] | null = null, failed = false, fetchedAt = 0;
  const note = h('textarea', { class: 'hs-input bug-note', rows: 4, maxlength: 2000, placeholder: 'What went wrong? What did you do, and what did you expect?', 'aria-label': 'Bug report' });
  const sendNote = h('span', { class: 'hs-note', role: 'status' });
  const report = h('button', { type: 'button', class: 'hs-btn-main' }, 'Report bug');
  const claudeNote = h('span', { class: 'hs-note', role: 'status' });
  const toClaude = h('button', { type: 'button', class: 'hs-btn-main', hidden: true }, 'Send open bugs to Claude');
  let comments: CommentsApi | null = null;
  /** sends the open bugs to Claude; true when sent */
  async function sendOpen(open: FiledBug[], anchorEl: Element): Promise<boolean> {
    if (!comments || !open.length) return false;
    const list = open.map((b) => `${b.id} (${b.code}, turn ${b.turn})`).join(', ');
    await comments.sendToClaude({ anchor: await comments.anchorFor(anchorEl), text: `Open bugs to triage and hand to the right threads (read them from the db bugs collection): ${list}` });
    return true;
  }
  report.onclick = async () => {
    const text = note.value.trim();
    if (!text) { sendNote.textContent = 'Write what went wrong first.'; return; }
    report.disabled = true;
    const id = await api.reportBug(text).catch(() => null);
    if (!id) { report.disabled = false; sendNote.textContent = 'The report couldn’t be saved. Try again.'; return; }
    note.value = '';
    sendNote.textContent = `Saved as ${id}. Sending the open bugs to Claude…`;
    // BG-27: a report goes to Claude with every open bug, without a second press
    const open = await api.openBugs().catch(() => rows ?? []);
    rows = open; fetchedAt = Date.now();
    const sent = await sendOpen(open, report).catch(() => false);
    sendNote.textContent = sent ? `Saved as ${id} and sent to Claude with ${open.length} open bug${open.length === 1 ? '' : 's'}.`
      : `Saved as ${id}, but it couldn’t be sent to Claude from here. Leave a comment on this page and send it to Claude.`;
    report.disabled = false;
    draw();
  };
  const rt = (window as unknown as { claude?: { use(n: string): Promise<CommentsApi | null> } }).claude;
  rt?.use('comments').then(async (c) => {
    if (!c || (await c.canSendToClaude().catch(() => 'off')) !== 'available') return;
    comments = c;
    toClaude.hidden = false;
    toClaude.onclick = async () => {
      const open = rows ?? [];
      if (!open.length) { claudeNote.textContent = 'No open bugs to send.'; return; }
      toClaude.disabled = true;
      claudeNote.textContent = 'Sending…';
      const sent = await sendOpen(open, toClaude).catch(() => false);
      claudeNote.textContent = sent ? `Sent ${open.length} open bug${open.length === 1 ? '' : 's'} to Claude.` : 'Couldn’t reach Claude from here. Leave a comment and send it to Claude instead.';
      toClaude.disabled = false;
    };
  }).catch(() => undefined);

  const row = (b: FiledBug) => h('tr', {},
    h('td', { class: 'bug-id' }, b.id),
    h('td', {}, h('span', { class: 'hs-tg' }, b.code === 'player_report' ? 'your report' : b.code)),
    h('td', { class: 'num' }, String(b.turn ?? '')),
    h('td', {}, bugSummary(b)),
    h('td', { class: 'hs-note' }, b.at ? new Date(b.at).toLocaleString() : ''));
  function draw() {
    el.replaceChildren(
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Bugs'), h('p', {}, 'Report what went wrong. Open bugs are listed below, newest first, until a fix marks them done.'))),
      h('section', { class: 'bug-report' }, note, h('div', { class: 'bug-actions' }, report, sendNote)),
      h('div', { class: 'bug-bar' }, h('h2', {}, rows ? `Open bugs (${rows.length})` : 'Open bugs'), toClaude, claudeNote),
      rows === null ? h('p', { class: 'empty', role: 'status' }, failed ? 'The bug list couldn’t be read from the save.' : 'Reading the save…')
        : rows.length ? h('table', { class: 'bug-table' }, h('thead', {}, h('tr', {}, ['Bug', 'Kind', 'Turn', 'What went wrong', 'Filed'].map((t) => h('th', {}, t)))),
          h('tbody', {}, rows.map(row)))
          : h('p', { class: 'empty' }, 'No open bugs.'));
  }
  function update() {
    draw();
    if (Date.now() - fetchedAt < REFRESH_MS) return;
    fetchedAt = Date.now();
    api.openBugs().then((r) => { rows = r; failed = false; draw(); }).catch(() => { failed = true; draw(); });
  }
  return { el, update };
}
