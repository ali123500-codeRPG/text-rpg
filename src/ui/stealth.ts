// Stealth on the play screen (via the Stealth tree, ST1–ST19): Sneak and Vanish are buttons in the
// action bar beside Aim (they fill the box; nothing is sent until Send), and while the player is stealthy the header shows a
// filled "Stealthy" badge in the Stealth tree's colour and the action bar is outlined in it. The name comes from POSTURES.
import { POSTURES } from '../scales';
import { h, lineIcon } from './kit';

type Kind = 'sneak' | 'unseen' | 'vanish';
const PATHS: Record<Kind, string[]> = {
  sneak: ['M4 16v-2.4C4 11.5 3 10.5 3 8c0-2.7 1.5-6 4.5-6C9.4 2 10 3.8 10 5.5c0 3.1-2 5.7-2 8.7V16a2 2 0 1 1-4 0z',
    'M20 20v-2.4c0-2.1 1-3.1 1-5.6 0-2.7-1.5-6-4.5-6C14.6 6 14 7.8 14 9.5c0 3.1 2 5.7 2 8.7V20a2 2 0 1 0 4 0z'],
  unseen: ['M9.9 4.2A9 9 0 0 1 12 4c7 0 10 8 10 8a13 13 0 0 1-1.7 2.7', 'M6.6 6.6A13.5 13.5 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.4-1.6',
    'M14.1 14.1a3 3 0 1 1-4.2-4.2', 'M2 2l20 20'],
  vanish: ['M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
};

export const stealthIcon = (kind: Kind): SVGSVGElement => lineIcon('st-i', PATHS[kind]);

/** the header badge while the player is stealthy */
export const stealthBadge = () =>
  h('span', { class: 'stealthy-b', role: 'status', title: 'You are moving unseen. Speaking above a whisper or a melee attack ends it.' },
    stealthIcon('unseen'), POSTURES.name('stealthy'));

/** Sneak and Vanish buttons for the action bar; `set` refreshes them for the player's posture */
export function stealthButtons(pick: (text: string) => void) {
  const sneak = h('button', { type: 'button', class: 'itm st-act' });
  // ST13: a Vanish needs the link it slips away by, so like a stealthy Sneak it leaves the box open for where to
  const vanish = h('button', { type: 'button', class: 'itm st-act', title: 'Slip out of sight of someone who sees you. Add where to', onclick: () => pick('Vanish ') },
    stealthIcon('vanish'), h('span', { class: 'lbl' }, 'Vanish'));
  const set = (stealthy: boolean, disabled: boolean) => {
    sneak.replaceChildren(stealthIcon('sneak'), h('span', { class: 'lbl' }, 'Sneak'));
    sneak.title = stealthy ? 'You are stealthy. Add where to sneak to; sneaking is free' : 'Start sneaking: free, keeps your action';
    sneak.onclick = () => pick(stealthy ? 'Sneak ' : 'Sneak');
    sneak.disabled = vanish.disabled = disabled;
  };
  return { sneak, vanish, set };
}
