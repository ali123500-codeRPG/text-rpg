// Stealth on the play screen (via the Stealth tree, ST1–ST19): Sneak is a button in the
// action bar beside Aim (it fills the box; nothing is sent until Send), and while the player is stealthy the header shows a
// filled "Stealthy" badge in the Stealth tree's colour and the action bar is outlined in it. The name comes from POSTURES.
// DS6: beside it, while a weapon is in the player's hand, a "Weapon drawn" badge in the Melee tree's colour; sheathed, none.
import { POSTURES } from '../scales';
import { CONFIG } from '../config';
import { h, lineIcon, tint } from './kit';
import { TONE } from './tipTones';
import { ICONS } from './itemIcons';

type Kind = 'sneak' | 'unseen';
const PATHS: Record<Kind, string[]> = {
  sneak: ['M4 16v-2.4C4 11.5 3 10.5 3 8c0-2.7 1.5-6 4.5-6C9.4 2 10 3.8 10 5.5c0 3.1-2 5.7-2 8.7V16a2 2 0 1 1-4 0z',
    'M20 20v-2.4c0-2.1 1-3.1 1-5.6 0-2.7-1.5-6-4.5-6C14.6 6 14 7.8 14 9.5c0 3.1 2 5.7 2 8.7V20a2 2 0 1 0 4 0z'],
  unseen: ['M9.9 4.2A9 9 0 0 1 12 4c7 0 10 8 10 8a13 13 0 0 1-1.7 2.7', 'M6.6 6.6A13.5 13.5 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.4-1.6',
    'M14.1 14.1a3 3 0 1 1-4.2-4.2', 'M2 2l20 20'],
};

export const stealthIcon = (kind: Kind): SVGSVGElement => lineIcon('st-i', PATHS[kind]);

/** what pointing at Stealthy says (VS8: the time cost from CONFIG.SNEAK_TIME_MULT) */
export const stealthyTip = (): string =>
  `Stealthy slows all your actions ×${CONFIG.SNEAK_TIME_MULT}, moving included: each takes ${CONFIG.SNEAK_TIME_MULT} times as long. You are moving unseen; speaking above a whisper or a melee attack ends it.`;

/** the header badge while the player is stealthy */
export const stealthBadge = () =>
  h('span', { class: 'stealthy-b', role: 'status', title: stealthyTip() },
    stealthIcon('unseen'), POSTURES.name('stealthy'));

/** DS6: the header badge while a weapon is in the player's hand (sheathed shows none: the exception is marked, PS-130) */
export function drawnBadge(): HTMLElement {
  const i = h('i', { class: 'dr-i', 'aria-hidden': 'true' });
  i.innerHTML = ICONS.sword;
  return h('span', { class: 'drawn-b', role: 'status', title: `A weapon is in your hand. Outside a fight people read it as a ${tint(TONE.caution, 'threat')}; put it away to talk in peace.` }, i, 'Weapon drawn');
}
