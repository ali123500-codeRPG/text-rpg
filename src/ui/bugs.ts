// Bugs: report a bug from play, see the new reports and open bugs (the game's own filings and the threads'), and send them
// to Claude. The game's reports are new, with no number, until Claude numbers them at triage (BF45, src/save/bugs.ts). "Report bug" saves the report and
// then sends every open bug to Claude (BG-27: pressing it sends them), the same as "Send open bugs to
// Claude": a comment sent to Claude (the comments capability), which wakes the thread that triages them. The send
// button stays for sending again; it is hidden, and a report is only saved, when the page can't send to Claude.
// AA-108: below them, the Chronicler's deed ideas, sent to Claude the same way for review with the owner.
import type { GameApi, GameState } from '../types';
import { deedSendId, type DeedSend } from '../save/sends';
import { isNewReport, type FiledBug } from '../save/bugs';
import { claudeSend, h, plural } from './kit';
import { cap } from '../words';

const REFRESH_MS = 5000;

/** one line saying what went wrong: the player's note, else the first error, else the code */
export function bugSummary(b: FiledBug): string {
  const errs = b.errors as { message?: string }[] | undefined;
  const text = typeof b.note === 'string' ? b.note : typeof b.detail === 'string' ? b.detail : errs?.[0]?.message ?? '';
  return text.length > 220 ? `${text.slice(0, 217)}…` : text;
}

/** SD14: a bug's kind in plain words (agent_fallback → Agent fallback); the code itself is the cell's tip */
export const bugKind = (code: string): string => (code === 'player_report' ? 'Your report' : cap(code.replace(/_/g, ' ')));

/** the text "Copy for Claude" puts on the clipboard: full records, since a thread on another account can't read the db */
export function bugsForClaude(open: FiledBug[], unsent: string): string {
  const fresh = unsent ? `\n\nA report not yet saved in the game:\n${unsent}` : '';
  return `Bugs from the Echoes of the Thread Bugs page, to triage and fix in ali123500-codeRPG/text-rpg. Open a GitHub issue labelled \`bug\` for each real one (its number is its BG-n), then find the root cause and fix it by PR. These are the full records from the game's db bugs collection.${fresh}\n\n\`\`\`json\n${JSON.stringify(open, null, 2)}\n\`\`\``;
}

type Want = NonNullable<GameState['hidden']['templateWants']>[number];
/** AA-108: the text sent to Claude (or copied) with the Chronicler's deed ideas, for review with the owner (PROG-118), each
 * with the db document its verdict goes on */
export function deedsForClaude(storyId: string, ideas: readonly Want[]): string {
  return `Deed ideas from the Chronicler (AA-108), from the Bugs page of story ${storyId} in ali123500-codeRPG/text-rpg. `
    + 'Review them with the owner, and write each one the owner approves as an achievement code rule by PR (PROG-118). '
    + 'Once the owner rules on one, record it in the game page\'s db on its document in deed_sends (keep id, storyId, name and at) '
    + 'with verdict "approved" or "turned_down", so the Bugs page shows it.\n\n'
    + ideas.map((w) => `- ${w.label}: ${w.wanted} (scenario ${w.scenario}, turn ${w.turn}; deed_sends/${deedSendId(storyId, w)})`).join('\n');
}
const VERDICT_WORD = { approved: 'Approved', turned_down: 'Turned down' } as const;

/** AA-108: the Chronicler's deed ideas of this story, each sent to Claude once (deed_sends marks it) or copied where sending
 * isn't available (a copy marks nothing, so it holds every idea still waiting for a verdict); Clear list takes the ruled ones off */
function deedIdeas(api: GameApi, redraw: () => void) {
  let marks = new Map<string, DeedSend>(), at = 0;
  const mark = (s: GameState, w: Want) => marks.get(deedSendId(s.storyId, w));
  function refresh() {
    if (Date.now() - at < REFRESH_MS) return;
    at = Date.now();
    api.deedSends().then((xs) => { marks = new Map(xs.map((x) => [x.id, x])); redraw(); }).catch(() => undefined);
  }
  const of = (keep: (m: DeedSend | undefined) => boolean) => {
    const s = api.gm().state;
    return s ? (s.hidden.templateWants ?? []).filter((w) => w.of === 'deed' && keep(mark(s, w))) : [];
  };
  const send = claudeSend({
    label: 'Send deed ideas to Claude', copyTip: 'Copy the deed ideas still waiting for a verdict, to paste into a Claude chat', none: 'No new deed ideas.',
    send: () => {
      const s = api.gm().state, ds = of((m) => !m);
      return s && ds.length ? { text: deedsForClaude(s.storyId, ds), done: `Sent ${plural(ds.length, 'deed idea')} to Claude.`,
        after: () => api.markDeedsSent(ds).then(() => { at = 0; redraw(); }, () => undefined) } : null;
    },
    copy: () => { const s = api.gm().state, ds = of((m) => !m?.verdict); return s && ds.length ? deedsForClaude(s.storyId, ds) : null; },
  });
  const clear = h('button', { type: 'button', class: 'hs-btn-text', title: 'Take the deed ideas you have approved or turned down off this list' }, 'Clear list');
  clear.onclick = async () => {
    clear.disabled = true;
    const n = await api.clearRuledDeeds().catch(() => -1);
    send.note.textContent = n < 0 ? 'The list couldn’t be cleared. Try again.' : `Cleared ${plural(n, 'deed idea')}.`;
    clear.disabled = false;
    at = 0; redraw();
  };
  /** the section: the ideas not cleared, newest first, each with Sent or the owner's verdict */
  return () => {
    const s = api.gm().state;
    if (!s) return '';
    refresh();
    const rows = of((m) => !m?.cleared);
    return h('section', {},
      h('div', { class: 'bug-bar' }, h('h2', {}, `Deed ideas (${rows.length})`),
        ...(rows.length ? [send.button, send.copy, rows.some((w) => mark(s, w)?.verdict) ? clear : null, send.note] : [])),
      rows.length ? h('table', { class: 'bug-table' }, h('thead', {}, h('tr', {}, ['Idea', 'Deed', 'Scenario', 'Status'].map((t) => h('th', {}, t)))),
        h('tbody', {}, [...rows].reverse().map((w) => { const m = mark(s, w);
          return h('tr', {}, h('td', { class: 'bug-id' }, w.label), h('td', {}, w.wanted), h('td', { class: 'hs-note' }, `${w.scenario} · turn ${w.turn}`),
            h('td', {}, m ? (m.verdict ? VERDICT_WORD[m.verdict] : 'Sent') : h('span', { class: 'hs-note' }, 'New'))); })))
        : h('p', { class: 'empty' }, 'No deed ideas. The Chronicler proposes deeds no achievement counts yet at each scenario\'s end.'));
  };
}

export function bugsPage(api: GameApi) {
  const el = h('main', { class: 'bugs' });
  let rows: FiledBug[] | null = null, failed = false, fetchedAt = 0;
  const note = h('textarea', { class: 'hs-input bug-note', rows: 4, maxlength: 2000, placeholder: 'What went wrong? What did you do, and what did you expect?', 'aria-label': 'Bug report' });
  const sendNote = h('span', { class: 'hs-note', role: 'status' });
  const report = h('button', { type: 'button', class: 'hs-btn-main' }, 'Report bug');
  /** the open bugs' ids for Claude, which reads them from the db bugs collection */
  function openText(open: FiledBug[]): string {
    const list = (bs: FiledBug[]) => bs.map((b) => `${b.id} (${b.code}, turn ${b.turn})`).join(', ');
    const fresh = open.filter(isNewReport), numbered = open.filter((b) => !isNewReport(b));
    const parts = [fresh.length ? `new reports to number: ${list(fresh)}` : '', numbered.length ? `open bugs: ${list(numbered)}` : ''].filter(Boolean);
    return `Bugs to triage and hand to the right threads (read them from the db bugs collection). ${parts.join('; ')}`;
  }
  const deeds = deedIdeas(api, () => draw());
  const claude = claudeSend({
    label: 'Send open bugs to Claude', copyTip: 'Copy the bugs as text to paste into a Claude chat', none: 'No bugs to send.',
    send: () => (rows?.length ? { text: openText(rows), done: `Sent ${plural(rows.length, 'bug')} to Claude.` } : null),
    copy: () => (rows?.length || note.value.trim() ? bugsForClaude(rows ?? [], note.value.trim()) : null),
  });
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
    const sent = open.length ? await claude.sendComment(openText(open), report).catch(() => false) : false;
    sendNote.textContent = sent ? 'Saved and sent to Claude, who gives it a bug number once it has been looked at.'
      : 'Saved, but it couldn’t be sent to Claude from here. Use Copy for Claude and paste it into a Claude chat.';
    report.disabled = false;
    draw();
  };

  const row = (b: FiledBug) => h('tr', {},
    h('td', { class: 'bug-id' }, isNewReport(b) ? 'New' : b.id),
    h('td', {}, h('span', { class: 'hs-tg', title: b.code }, bugKind(b.code))),
    h('td', { class: 'num' }, String(b.turn ?? '')),
    h('td', {}, bugSummary(b)),
    h('td', { class: 'hs-note' }, b.at ? new Date(b.at).toLocaleString() : ''));
  function draw() {
    el.replaceChildren(
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Bugs'))),
      h('section', { class: 'bug-report' }, note, h('div', { class: 'bug-actions' }, report, sendNote)),
      h('div', { class: 'bug-bar' }, h('h2', {}, rows ? `New and open bugs (${rows.length})` : 'New and open bugs'), claude.button, claude.copy, claude.note),
      rows === null ? h('p', { class: 'empty', role: 'status' }, failed ? 'The bug list couldn’t be read from the save.' : 'Reading the save…')
        : rows.length ? h('table', { class: 'bug-table' }, h('thead', {}, h('tr', {}, ['Bug', 'Kind', 'Turn', 'What went wrong', 'Filed'].map((t) => h('th', {}, t)))),
          h('tbody', {}, rows.map(row)))
          : h('p', { class: 'empty' }, 'No new or open bugs.'),
      deeds());
  }
  function update() {
    draw();
    if (Date.now() - fetchedAt < REFRESH_MS) return;
    fetchedAt = Date.now();
    api.openBugs().then((r) => { rows = r; failed = false; draw(); }).catch(() => { failed = true; draw(); });
  }
  return { el, update };
}
