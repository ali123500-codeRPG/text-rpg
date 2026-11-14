// AT11a: long actions on the play screen. Who's here shows what each person in full view is at and how long is left; the
// action box shows the player's own with a Keep going chip; each turn's results list the long actions the player saw, as
// going on, done, broken off or set aside. Times are game seconds and minutes only (never rounds, AT35). The meter is drawn
// once from done ÷ (done + left) and does not move by itself (M-01: it is game time, not a wait).
import type { ActionNote, DoingView, FollowingView, WalkingView } from '../types';
import { distText } from '../views';
import { h } from './kit';

/** whole game seconds in words: "40 s", "2 min", "1 min 30 s" */
export const secsText = (n: number): string => {
  const t = Math.max(0, Math.round(n));
  if (t < 60) return `${t} s`;
  const m = Math.floor(t / 60), r = t % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
};

/** the share of the action done, 0 to 1 */
export const doneShare = (d: { done: number; left: number }): number => (d.done + d.left > 0 ? Math.min(1, Math.max(0, d.done / (d.done + d.left))) : 1);

/** a thin meter of the share done (scaleX on the fill, so it never animates layout) */
export const doingMeter = (d: { done: number; left: number }, done = false): HTMLElement =>
  h('span', { class: 'dg-m' + (done ? ' done' : ''), 'aria-hidden': 'true' }, h('i', { style: `transform:scaleX(${done ? 1 : doneShare(d).toFixed(3)})` }));

const lower = (what: string) => what.charAt(0).toLowerCase() + what.slice(1);

/** Who's here: "span a crossbow · 6 s left" with the meter */
export const doingChip = (d: DoingView): HTMLElement =>
  h('span', { class: 'st doing', 'data-doing': d.what, title: `${d.what}: ${secsText(d.done)} done, ${secsText(d.left)} to go` }, doingMeter(d), `${lower(d.what)} · ${secsText(d.left)} left`);

/** the action box: the player's own long action, and a chip that fills the box to carry it on (nothing is sent until Send) */
export function doingNow(d: DoingView | undefined, pick: (text: string) => void, disabled: boolean): HTMLElement | null {
  if (!d) return null;
  return h('div', { class: 'doing-now', role: 'status' },
    doingMeter(d),
    h('span', { class: 'dg-t' }, h('b', {}, d.what), ` · ${secsText(d.done)} done · `, h('b', { class: 'dg-left' }, `${secsText(d.left)} to go`)),
    h('span', { class: 'hs-note' }, 'Keep at it to carry on; anything else sets it aside.'),
    h('div', { class: 'hs-picker dg-pick' }, h('button', { type: 'button', class: 'itm dg-go', 'data-chip': 'keep-going', disabled, title: 'Fills the box to carry on with it. Nothing is sent until Send', onclick: () => pick(`I keep going: ${lower(d.what)}`) }, 'Keep going')));
}

/** what is left of a walk: "14 m · 10 s to go"; a goal with no open way to it (a shut door found on the way) has no distance */
export const walkLeft = (w: WalkingView): string =>
  Number.isFinite(w.metres) && Number.isFinite(w.seconds) ? `${distText(w.metres)} · ${secsText(w.seconds)} to go` : 'no open way there';

/** a chip under a walk or follow line: it only fills the box */
const chip = (key: string, label: string, text: string, title: string, pick: (text: string) => void, disabled: boolean) =>
  h('button', { type: 'button', class: 'itm wk-' + key, 'data-chip': key, disabled, title, onclick: () => pick(text) }, label);

/** AT49: the player's walk still on its way, with what is left; it carries on by itself while the player only talks, so the
 * chips are a shortcut to keep going in words or to stop (a wait is an action, and any action ends the walk) */
export function walkingNow(w: WalkingView | undefined, pick: (text: string) => void, disabled: boolean): HTMLElement | null {
  if (!w) return null;
  return h('div', { class: 'walking-now', role: 'status', 'data-to': w.toZone },
    h('span', { class: 'wk-i', 'aria-hidden': 'true' }, '➜'),
    h('span', { class: 'dg-t' }, 'Walking to ', h('b', {}, w.to), ' · ', h('b', { class: 'dg-left' }, walkLeft(w))),
    h('span', { class: 'hs-note' }, 'Carries on next turn while you only talk; any other order stops it.'),
    h('div', { class: 'hs-picker dg-pick' },
      chip('keep-walking', 'Keep walking', `I keep walking to ${w.to}`, 'Fills the box to carry on walking. Nothing is sent until Send', pick, disabled),
      chip('stop-walking', 'Stop here', 'I stop and wait here', 'Fills the box to stop where you are. Nothing is sent until Send', pick, disabled)));
}

const LOST_WORDS: Record<NonNullable<FollowingView['lost']>, string> = {
  down: 'they went down in', slipped_away: 'they slipped out of sight in', out_of_sight: 'they went on out of sight from',
};

/** BG-190: the following line as plain text, as it reads on screen */
export function followingText(f: FollowingView, w?: WalkingView): string {
  if (f.lost) return `Lost ${f.name} · ${LOST_WORDS[f.lost]} ${f.zone ?? 'here'}`;
  return `Following ${f.name}${f.keepM !== undefined ? ` · ${distText(f.keepM)} back` : ''} · ${w ? `in ${w.to} · ${walkLeft(w)}` : 'close behind'}`; // BF35: the distance kept
}
/** BG-190: the chips under the following line, and what each fills the box with */
export function followingChips(f: FollowingView): { key: string; label: string; text: string }[] {
  return f.lost ? [{ key: 'look-for', label: 'Look for them', text: `I look around for ${f.name}` }]
    : [{ key: 'keep-following', label: 'Keep following', text: `I keep following ${f.name}` }, { key: 'stop-walking', label: 'Stop here', text: 'I stop and wait here' }];
}

/** BG-190: whom the player is following, in place of the walk line: "Following Bren · in the Upstairs landing · 24 m · 17 s
 * to go", with Keep following and Stop here; or, the turn they are lost, what happened and where ("Lost Bren · they slipped
 * out of sight in the Common room"), with Look for them. The chips only fill the box. */
export function followingNow(f: FollowingView | undefined, w: WalkingView | undefined, pick: (text: string) => void, disabled: boolean): HTMLElement | null {
  if (!f) return null;
  if (f.lost) return h('div', { class: 'walking-now following lost', role: 'status', 'data-who': f.who, 'data-lost': f.lost },
    h('span', { class: 'wk-i', 'aria-hidden': 'true' }, '✕'),
    h('span', { class: 'dg-t' }, 'Lost ', h('b', {}, f.name), ` · ${LOST_WORDS[f.lost]} `, h('b', {}, f.zone ?? 'here')),
    h('span', { class: 'hs-note' }, 'The follow is over.'),
    h('div', { class: 'hs-picker dg-pick' }, followingChips(f).map((c) => chip(c.key, c.label, c.text, 'Fills the box. Nothing is sent until Send', pick, disabled))));
  return h('div', { class: 'walking-now following', role: 'status', 'data-who': f.who, ...(w ? { 'data-to': w.toZone } : {}) },
    h('span', { class: 'wk-i', 'aria-hidden': 'true' }, '➜'),
    h('span', { class: 'dg-t' }, 'Following ', h('b', {}, f.name), ...(w ? [' · in ', h('b', {}, w.to), ' · ', h('b', { class: 'dg-left' }, walkLeft(w))] : [' · ', h('b', { class: 'dg-left' }, 'close behind')])),
    h('span', { class: 'hs-note' }, 'Keeps after them each turn while you can see or hear them; any other order stops it.'),
    h('div', { class: 'hs-picker dg-pick' }, followingChips(f).map((c) => chip(c.key, c.label, c.text, 'Fills the box. Nothing is sent until Send', pick, disabled))));
}

const STATE_WORD: Record<ActionNote['state'], string> = { going: '', done: 'done', broken: 'broken off', stopped: 'set aside' };

/** a turn's results: one row of the long actions seen, "You: Bandage · 20 s to go", "Hild: Span a crossbow ✓ done" */
export function actionsRow(notes: ActionNote[]): HTMLElement | null {
  if (!notes.length) return null;
  return h('div', { class: 'rrow acts' }, h('span', { class: 'hs-label' }, 'Actions'),
    h('ul', {}, notes.map((n) => h('li', { 'data-state': n.state },
      doingMeter(n, n.state === 'done'),
      h('span', {}, h('b', {}, n.who), `: ${n.what}`),
      n.state === 'going' ? h('span', { class: 'dg-left' }, `${secsText(n.left)} to go`)
        : h('span', { class: 'dg-end ' + n.state }, n.state === 'done' ? '✓ ' : '', STATE_WORD[n.state])))));
}
