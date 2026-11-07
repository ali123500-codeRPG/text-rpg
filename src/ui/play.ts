// Play screen (Part 2, Play screen): narration log newest last, "…" while waiting, one input (/ starts a command),
// Aim toggle, mechanics panel under the narration, out-of-character notices and the "You fell" screen.
import type { GameApi, LogLine, Notice } from '../types';
import { CONFIG } from '../config';
import { credit, h } from './kit';
import { sideSheet } from './charsheet';

const NOTICE_KIND: Record<Notice['kind'], string> = {
  scene_fallback: 'Scene planning failed', rate_limited: 'Slow down', stop_play: 'Play stopped',
  read_only: 'Read-only', save_failed: 'Not saved', load_refused: 'Not loaded',
};

const MODE_WORD: Record<string, string> = { explore: 'Exploring', dialogue: 'Talking', tactical: 'Fighting' };

export type PlayUi = { el: HTMLElement; update: () => void; focus: () => void };

/** /stats, /inv and /quests open their rail page; everything else goes to the game. */
export const NAV_COMMANDS: Record<string, string> = { '/stats': 'stats', '/inv': 'inv', '/quests': 'quests' };

export function playScreen(api: GameApi, nav: (page: string) => void): PlayUi {
  let aimed = false;
  let confirmReset = false;
  const log = h('div', { class: 'log', 'aria-live': 'polite', 'aria-label': 'Story' });
  const mech = h('div', { class: 'mech', hidden: true });
  const notices = h('div', { class: 'notices' });
  const aimBtn = h('button', { type: 'button' });
  const input = h('input', { class: 'hs-input', id: 'cmd', autocomplete: 'off', placeholder: 'What do you do? A line starting with / is a command (/help)', 'aria-label': 'What do you do' });
  const send = h('button', { class: 'hs-btn-main', type: 'submit' }, 'Send');
  const aimPicker = h('div', { class: 'hs-picker' }, aimBtn);
  const bar = h('form', { class: 'inbar', onsubmit: (e: Event) => { e.preventDefault(); submit(); } }, input, aimPicker, send);
  const fell = h('div', { class: 'fell', hidden: true });
  const body = h('div', { class: 'play' }, h('div', { class: 'log-wrap' }, log, mech), h('div', { class: 'sec' }, notices, bar, credit()));
  const title = h('div', { class: 'head' });
  let folded = false;
  try { folded = localStorage.getItem('sheetFolded') === '1'; } catch { /* storage blocked: start open */ }
  const sheet = h('aside', { class: 'cs-side', 'aria-label': 'Character sheet' });
  const el = h('main', { class: 'playmain' }, title, h('div', { class: 'play-wrap' }, body, sheet), fell);

  async function submit() {
    const text = input.value.trim();
    if (!text || api.busy()) return;
    const cmd = text.split(/\s+/)[0].toLowerCase();
    if (NAV_COMMANDS[cmd] && text === cmd) { input.value = ''; nav(NAV_COMMANDS[cmd]); return; }
    if (cmd === '/aim' && text === cmd) { aimed = !aimed; input.value = ''; update(); return; }
    input.value = '';
    const wasAimed = aimed || cmd === '/aim';
    aimed = false; // resets after the turn resolves
    await api.submit(text, { aimed: wasAimed });
  }

  function lineEl(l: LogLine): HTMLElement {
    return h('p', { class: 'ln-' + l.kind }, l.text);
  }

  function update() {
    const s = api.state();
    title.replaceChildren(h('div', {}, h('h1', {}, s?.meta.title ?? 'Play'), h('p', {}, s ? `Turn ${s.turn} · ${MODE_WORD[s.mode] ?? s.mode}` : 'No story yet')));
    const lines = api.lines();
    const stick = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    log.replaceChildren(...lines.map(lineEl), api.busy() ? h('p', { class: 'wait', 'aria-label': 'Waiting for the story' }, '…') : '');
    if (stick || api.busy()) log.scrollTop = log.scrollHeight;

    const show = s?.settings.showMechanics ?? CONFIG.SHOW_MECHANICS;
    const last = [...lines].reverse().find((l) => l.mechanics?.length);
    mech.hidden = !show || !last;
    if (show && last) mech.replaceChildren(h('p', { class: 'hs-label' }, `Mechanics · turn ${last.turn}`), h('ul', {}, last.mechanics!.map((m) => h('li', { class: 'hs-num' }, m))));

    const ns = api.notices();
    notices.replaceChildren(...ns.map((n) => h('div', { class: 'hs-hl ' + (n.kind === 'stop_play' || n.kind === 'save_failed' ? 'bad' : 'ask'), role: 'status' },
      h('span', { class: 'hs-hl-b', 'data-kind': NOTICE_KIND[n.kind] }, n.text))));
    const stopped = ns.some((n) => n.kind === 'stop_play' || n.kind === 'read_only');
    input.disabled = stopped || api.busy();
    send.disabled = stopped || api.busy();
    aimBtn.disabled = stopped;
    aimBtn.setAttribute('aria-pressed', String(aimed));
    aimBtn.title = aimed ? 'This turn’s attack is aimed. Click to stop aiming' : 'Click to aim this turn’s attack (same as /aim)';
    aimBtn.textContent = aimed ? 'Aimed' : 'Aim';

    const fold = h('button', { class: 'hs-btn-text cs-fold', type: 'button', 'aria-expanded': String(!folded),
      onclick: () => { folded = !folded; try { localStorage.setItem('sheetFolded', folded ? '1' : '0'); } catch { /* not saved */ } update(); } }, folded ? 'Sheet ‹' : 'Hide ›');
    sheet.classList.toggle('folded', folded);
    sheet.replaceChildren(h('div', { class: 'cs-side-h' }, folded ? null : h('p', { class: 'hs-section' }, 'Your sheet'), fold), ...(s && !folded ? sideSheet(s, s.player) : []));

    const fallen = api.fell();
    body.hidden = fallen;
    sheet.hidden = fallen;
    fell.hidden = !fallen;
    if (fallen) {
      fell.replaceChildren(
        h('h2', {}, 'You fell'),
        h('p', { class: 'hs-note' }, 'The fight left you incapacitated. Rewind one turn, or start a new story.'),
        h('div', { class: 'confirm' },
          h('button', { class: 'hs-btn-main', type: 'button', onclick: () => api.submit('/undo', { aimed: false }) }, 'Undo one turn'),
          confirmReset
            ? [h('span', { class: 'hs-note' }, 'Start over? This story ends and a new swordsman is made.'),
               h('button', { class: 'hs-btn-text danger', type: 'button', onclick: async () => { confirmReset = false; await api.reset(); } }, 'Reset the story'),
               h('button', { class: 'hs-btn-text', type: 'button', onclick: () => { confirmReset = false; update(); } }, 'Keep it')]
            : h('button', { class: 'hs-btn-text danger', type: 'button', onclick: () => { confirmReset = true; update(); } }, 'Reset…')));
    }
  }
  aimBtn.onclick = () => { aimed = !aimed; update(); };
  return { el, update, focus: () => input.focus() };
}
