// D-141 (VW9 a): the Quests page's Vows section, and the Witness chat that draws a vow up for the player to swear.
import type { GameApi, GameState, Vow } from '../types';
import { CONFIG } from '../config';
import { REWARD_LEVELS } from '../scales';
import { dueText } from '../engine/quests';
import { VOW_STATE_NAME, activeVows, vowOwnGoalText, vowXp } from '../engine/vows';
import type { WitnessLine, WitnessReply } from '../agents/witness';
import { questGoalText } from '../views';
import { closePanel, groupedTable, h, openPanel, type Col, type TGroup } from './kit';
import { closePop, openPop } from './pop';

export const vowGoalText = (s: GameState, v: Vow): string => vowOwnGoalText(s, v) ?? questGoalText(s, v as Vow & { goal: Exclude<Vow['goal'], { kind: 'skill' | 'level' | 'achievement' | 'essence' | 'restraint' }> });
const stakeText = (s: GameState, v: Vow) => `${REWARD_LEVELS.name(v.stake)} · ${v.xp ?? vowXp(s, v.stake)} Thread`;

/** the table's open groups and sort live across redraws, as listPage keeps its own */
const OPEN = new Set<string>(), SORT: { key: string; dir: 0 | 1 | -1 } = { key: 'text', dir: 0 };
const COLS: Col[] = [{ key: 'text', title: 'Vow' }, { key: 'goal', title: 'Goal' }, { key: 'stake', title: 'Stake' }, { key: 'due', title: 'Due' }, { key: 'state', title: 'State' }];

/** VW8 a: renouncing breaks the vow, so it asks once */
function renounceButton(api: GameApi, v: Vow, s: GameState): HTMLElement {
  const box = h('span');
  const ask = () => box.replaceChildren(h('span', { class: 'hs-note' }, `Breaks it: −${vowXp(s, v.stake)} Thread. `),
    h('button', { type: 'button', class: 'hs-btn-text danger', onclick: () => { api.renounceVow(v.id); closePanel(); } }, 'Renounce'),
    h('button', { type: 'button', class: 'hs-btn-text', onclick: draw }, 'Keep'));
  const draw = () => box.replaceChildren(h('button', { type: 'button', class: 'hs-btn-text danger', onclick: ask }, 'Renounce vow'));
  draw();
  return box;
}

/** the Vows section under the quests: Swear a vow (off at the cap), then one row per vow, newest last */
export function vowsSection(api: GameApi, s: GameState, redraw: () => void): HTMLElement {
  const vows = s.vows ?? [], full = activeVows(s).length >= CONFIG.VOW_MAX_ACTIVE;
  const swear = h('button', { type: 'button', class: 'hs-btn-main', disabled: full || api.busy(),
    title: full ? `You hold ${CONFIG.VOW_MAX_ACTIVE} vows, the most at once` : 'Talk a goal over with the Witness' }, 'Swear a vow');
  swear.onclick = () => openWitness(api, swear, redraw);
  const groups: TGroup[] = vows.map((v) => {
    const cells = { text: v.text, goal: vowGoalText(s, v), stake: stakeText(s, v), due: v.state === 'active' ? dueText(v).replace(/^Due /, '') : '', state: VOW_STATE_NAME[v.state] };
    return { id: v.id, title: v.text, rows: [{ id: v.id, sortKey: v.startTurn, cells, ...(v.state === 'broken' ? { tones: { state: 'bad' as const } } : {}) }], combined: cells };
  });
  return h('div', { class: 'sec vows' },
    h('div', { class: 'head' }, h('h2', {}, 'Vows'), swear),
    groupedTable({ cols: COLS, groups, open: OPEN, sort: SORT, redraw, emptyText: 'No vows yet.',
      onField: (row, key) => {
        const v = vows.find((x) => x.id === row.id);
        if (!v) return;
        openPanel('Vow', [...COLS.map((c) => ({ k: c.title, v: row.cells[c.key] || '–', picked: c.key === key })),
          ...(v.state === 'active' ? [{ k: '', v: renounceButton(api, v, s) }] : [])]);
      } }));
}

/** VW2 a: the Witness chat as a pop-up. Each send asks the Witness once; when it has drawn up a vow, its card shows with Swear */
export function openWitness(api: GameApi, opener: HTMLElement, done: () => void): void {
  const chat: WitnessLine[] = [];
  const log = h('div', { class: 'wit-log', role: 'log', 'aria-live': 'polite' });
  const card = h('div', { class: 'wit-card', hidden: true });
  const input = h('textarea', { class: 'hs-input wit-in', rows: 2, 'aria-label': 'Your words to the Witness', placeholder: 'A goal you mean to hold to' }) as HTMLTextAreaElement;
  const send = h('button', { type: 'button', class: 'hs-btn-text' }, 'Send') as HTMLButtonElement; // Swear is the one main button
  const say = (l: WitnessLine) => { chat.push(l); log.append(h('p', { class: `wit-${l.by}` }, l.text)); log.scrollTop = log.scrollHeight; };
  const showCard = (r: WitnessReply) => {
    const s = api.state();
    if (!s || !r.form || !r.vow) { card.hidden = true; return; }
    const v = r.vow, err = h('p', { class: 'hs-note tone-bad', hidden: true });
    card.replaceChildren(h('b', {}, v.text),
      h('p', { class: 'hs-note' }, `${vowGoalText(s, v)} · ${dueText(v)} · Stake ${stakeText(s, v)}`),
      h('button', { type: 'button', class: 'hs-btn-main', onclick: () => {
        const why = api.swearVow(r.form!);
        if (why) { err.textContent = why; err.hidden = false; return; }
        closePop(); done();
      } }, 'Swear'), err);
    card.hidden = false;
  };
  const go = async () => {
    const text = input.value.trim();
    if (!text || send.disabled) return;
    input.value = '';
    say({ by: 'player', text });
    send.disabled = true;
    const r = await api.witness(chat);
    send.disabled = false;
    if (!r) { log.append(h('p', { class: 'hs-note' }, 'The Witness did not answer. Try again.')); return; }
    say({ by: 'witness', text: r.reply });
    showCard(r);
    input.focus();
  };
  send.onclick = () => void go();
  input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void go(); } };
  openPop({ title: 'The Witness', cls: 'wit-pop', opener, body: [log, card, h('div', { class: 'wit-row' }, input, send)] });
  input.focus();
}
