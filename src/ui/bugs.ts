// Bugs: report a bug from play, see the new reports and open bugs (the game's own filings and the threads'), and send them
// to Claude. The game's reports are new, with no number, until Claude numbers them at triage (BF45, src/save/bugs.ts). "Report bug" saves the report and
// then sends every open bug to Claude (BG-27: pressing it sends them), the same as "Send open bugs to
// Claude": a comment sent to Claude (the comments capability), which wakes the thread that triages them. The send
// button stays for sending again; it is hidden, and a report is only saved, when the page can't send to Claude.
import type { GameApi } from '../types';
import { isNewReport, type FiledBug } from '../save/bugs';
import { claudeComments, h, plural, type CommentsApi } from './kit';

const REFRESH_MS = 5000;

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
    const list = (bs: FiledBug[]) => bs.map((b) => `${b.id} (${b.code}, turn ${b.turn})`).join(', ');
    const fresh = open.filter(isNewReport), numbered = open.filter((b) => !isNewReport(b));
    const parts = [fresh.length ? `new reports to number: ${list(fresh)}` : '', numbered.length ? `open bugs: ${list(numbered)}` : ''].filter(Boolean);
    await comments.sendToClaude({ anchor: await comments.anchorFor(anchorEl), text: `Bugs to triage and hand to the right threads (read them from the db bugs collection). ${parts.join('; ')}` });
    return true;
  }
  report.onclick = async () => {
    const text = note.value.trim();
    if (!text) { sendNote.textContent = 'Write what went wrong first.'; return; }
    report.disabled = true;
    const id = await api.reportBug(text).catch(() => null);
    if (!id) { report.disabled = false; sendNote.textContent = 'The report couldn’t be saved. Try again.'; return; }
    note.value = '';
    sendNote.textContent = 'Saved. Sending it to Claude with the open bugs…';
    // BG-27: a report goes to Claude with every open bug, without a second press
    const open = await api.openBugs().catch(() => rows ?? []);
    rows = open; fetchedAt = Date.now();
    const sent = await sendOpen(open, report).catch(() => false);
    sendNote.textContent = sent ? 'Saved and sent to Claude, who gives it a bug number once it has been looked at.'
      : 'Saved, but it couldn’t be sent to Claude from here. Leave a comment on this page and send it to Claude.';
    report.disabled = false;
    draw();
  };
  claudeComments().then((c) => {
    if (!c) return;
    comments = c;
    toClaude.hidden = false;
    toClaude.onclick = async () => {
      const open = rows ?? [];
      if (!open.length) { claudeNote.textContent = 'No bugs to send.'; return; }
      toClaude.disabled = true;
      claudeNote.textContent = 'Sending…';
      const sent = await sendOpen(open, toClaude).catch(() => false);
      claudeNote.textContent = sent ? `Sent ${plural(open.length, 'bug')} to Claude.` : 'Couldn’t reach Claude from here. Leave a comment and send it to Claude instead.';
      toClaude.disabled = false;
    };
  }).catch(() => undefined);

  const row = (b: FiledBug) => h('tr', {},
    h('td', { class: 'bug-id' }, isNewReport(b) ? 'New' : b.id),
    h('td', {}, h('span', { class: 'hs-tg' }, b.code === 'player_report' ? 'your report' : b.code)),
    h('td', { class: 'num' }, String(b.turn ?? '')),
    h('td', {}, bugSummary(b)),
    h('td', { class: 'hs-note' }, b.at ? new Date(b.at).toLocaleString() : ''));
  function draw() {
    el.replaceChildren(
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Bugs'), h('p', {}, 'Report what went wrong. New reports get a bug number once Claude has looked at them. New reports and open bugs are listed below, newest first, until a fix marks them done.'))),
      h('section', { class: 'bug-report' }, note, h('div', { class: 'bug-actions' }, report, sendNote)),
      h('div', { class: 'bug-bar' }, h('h2', {}, rows ? `New and open bugs (${rows.length})` : 'New and open bugs'), toClaude, claudeNote),
      rows === null ? h('p', { class: 'empty', role: 'status' }, failed ? 'The bug list couldn’t be read from the save.' : 'Reading the save…')
        : rows.length ? h('table', { class: 'bug-table' }, h('thead', {}, h('tr', {}, ['Bug', 'Kind', 'Turn', 'What went wrong', 'Filed'].map((t) => h('th', {}, t)))),
          h('tbody', {}, rows.map(row)))
          : h('p', { class: 'empty' }, 'No new or open bugs.'));
  }
  function update() {
    draw();
    if (Date.now() - fetchedAt < REFRESH_MS) return;
    fetchedAt = Date.now();
    api.openBugs().then((r) => { rows = r; failed = false; draw(); }).catch(() => { failed = true; draw(); });
  }
  return { el, update };
}
