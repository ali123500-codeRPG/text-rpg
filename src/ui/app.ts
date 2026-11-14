// App shell: side rail (64px items, active pill fills the item, rail scrolls on its own), page area and the push-aside panel.
import type { GameApi } from '../types';
import { boxOf, h, lineIcon, plural, setPanelHost, closePanel, playDraft } from './kit';
import { creationScreen } from './creation';
import { playScreen } from './play';
import { achievementsPage, characterPage, inventoryPage, journalPage, questsPage } from './pages';
import { gmPage } from './gm';
import { famePage } from './fame';
import { mapPage } from './map';
import { closeFull, openFull } from './pop';
import { bugsPage } from './bugs';
import { gainsPage } from './gains';

const ICON: Record<string, string> = {
  create: 'M4 20 15 9m2-5 3 3-4 4-3-3zM6 14l4 4',
  play: 'M4 5h7a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-7M13 7a2 2 0 0 1 2-2h5v12h-5a2 2 0 0 0-2 2',
  stats: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  inv: 'M4 8h16v12H4zM9 8V5h6v3M4 13h16',
  quests: 'M6 3v18M6 4h11l-2 4 2 4H6',
  achievements: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6',
  gains: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z',
  gm: 'M4 6h16M4 12h16M4 18h10M18 16l2 2-2 2',
  fame: 'M7 21V10a5 5 0 0 1 10 0v11M5 21h14M12 11v6M9.5 13.5h5',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  journal: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6',
  bugs: 'M9 7a3 3 0 0 1 6 0v1H9zM7 9h10v6a5 5 0 0 1-10 0zM12 10v9M4 12h3M17 12h3M4 17l3-1M20 17l-3-1M6 6l2 2M18 6l-2 2',
};
const icon = (k: string) => lineIcon('hs-i', ICON[k]);

const PAGES = [['play', 'Play'], ['stats', 'Character'], ['inv', 'Inventory'], ['quests', 'Quests'], ['achievements', 'Achievements'], ['gains', 'Gains'], ['journal', 'Journal'], ['fame', 'Hall of fame'], ['bugs', 'Bugs']] as const;
const GM_KEY = 'rpg.gmDebug';
const readGm = () => { try { return localStorage.getItem(GM_KEY) === '1'; } catch { return false; } };
const writeGm = (on: boolean) => { try { localStorage.setItem(GM_KEY, on ? '1' : '0'); } catch { /* per-PC convenience only */ } };

export function mountApp(api: GameApi, root: HTMLElement = document.body) {
  let gmOn = readGm();
  const rail = h('nav', { class: 'hs-rail game-rail', 'aria-label': 'Game' });
  const view = h('div', { class: 'hs-view' });
  const panel = h('aside', { class: 'hs-panel', hidden: true, 'aria-label': 'Details' });
  setPanelHost(panel);
  // The artifact host may wrap this page so its <style> lands in <body>: keep styles when replacing the body.
  root.querySelectorAll('style').forEach((st) => document.head.append(st));
  // the rail goes last so Tab runs input, tools, sheet, then the rail; CSS puts it in the first column
  root.replaceChildren(view, panel, rail);
  root.classList.add('icon-rail');
  // the rail's tip: one floating label beside the hovered or focused item (the rail scrolls, so the tip lives outside it)
  const tip = h('div', { class: 'rail-tip', role: 'tooltip', hidden: true });
  root.append(tip);
  const showTip = (e: Event) => {
    const t = (e.target as Element).closest?.('[data-tip]') as HTMLElement | null;
    if (!t || !rail.contains(t)) return;
    const r = boxOf(t);
    tip.textContent = t.dataset.tip!;
    tip.style.top = `${r.top + r.height / 2}px`; tip.style.left = `${r.right + 8}px`;
    tip.hidden = false;
  };
  const hideTip = () => { tip.hidden = true; };
  rail.addEventListener('mouseover', showTip); rail.addEventListener('focusin', showTip);
  rail.addEventListener('mouseleave', hideTip); rail.addEventListener('focusout', hideTip); rail.addEventListener('scroll', hideTip);
  rail.addEventListener('click', hideTip);

  const play = playScreen(api, (p) => go(p));
  // the map is a big pop-up over the page, not a page of its own: the Map button on Play opens it
  // "Move to here" on the map types the order in Play's action box, ready to send
  const map = mapPage(api, (order) => { playDraft.text = order; closeFull(); go('play'); });
  let mapOpen = false;
  const openMap = (opener: HTMLElement | null) => {
    if (!api.state()) return;
    mapOpen = true;
    openFull({ label: 'Map', cls: 'map-full', opener, body: [map.el], onClose: () => { mapOpen = false; } });
    map.update();
  };
  const pages: Record<string, { el: HTMLElement; update: () => void }> = {
    play, stats: characterPage(api), inv: inventoryPage(api), quests: questsPage(api), achievements: achievementsPage(api), gains: gainsPage(api), journal: journalPage(api), fame: famePage(api), bugs: bugsPage(api), gm: gmPage(api),
  };
  let creation: HTMLElement | null = null;

  // until the saved story has been looked for, show a loading note, never the creation screen
  let resuming = true;
  const current = () => {
    const p = location.hash.slice(1);
    if ((p === 'fame' || p === 'bugs') && !resuming) return p; // the hall of fame opens with no story too (right after a reset)
    if (!api.state()) return resuming ? 'loading' : 'create';
    if (p === 'gm' && !gmOn) return 'play';
    return pages[p] ? p : 'play';
  };
  function go(p: string) {
    if (p === 'map') { openMap(document.activeElement as HTMLElement | null); return; }
    if (location.hash.slice(1) === p) render(); else location.hash = p;
  }

  // the rail is rebuilt only when what it shows changes, so a redraw never cuts short the perk badge's beat (M-74)
  let railKey = '', railPoints = 0;
  function drawRail(page: string) {
    const started = !!api.state();
    // BF64: while a turn runs the badge keeps the count it had, so a new point never gives away an ending or a level-up
    // before the gains pop-up or the level-up card shows it
    if (!api.busy()) railPoints = api.state()?.player.progression?.unspentPerkPoints ?? 0;
    const key = [page, started, gmOn, railPoints].join('|');
    if (key === railKey) return;
    railKey = key;
    // icons only: the name is kept for screen readers and shown in a tip on hover or focus
    const item = (id: string, label: string, enabled: boolean) => h('a', {
      href: enabled ? '#' + id : undefined, 'aria-current': page === id ? 'page' : undefined, 'aria-disabled': enabled ? undefined : 'true',
      'data-tip': enabled ? label : `${label}: opens once your character is made`,
    }, icon(id), h('span', { class: 'rail-label' }, label), id === 'stats' ? pointsBadge() : null);
    // V2b: perk points waiting to be spent; after a turn the Play screen holds a new count back until its level-up lands (M-38)
    function pointsBadge() {
      const n = railPoints;
      return n > 0 ? h('span', { class: 'hs-badge', 'data-m': 'points', title: `${plural(n, 'perk point')} to spend` }, `✦${n}`) : null;
    }
    rail.replaceChildren(
      h('div', { class: 'hs-brand' }, 'RPG', h('span', { class: 'ar' }, 'v0')),
      started ? '' : item('create', 'Create', true),
      ...PAGES.map(([id, label]) => item(id, label, started || id === 'fame' || id === 'bugs')),
      gmOn ? item('gm', 'GM', started) : '',
      h('button', { class: 'foot', type: 'button', 'aria-pressed': String(gmOn), 'data-tip': gmOn ? 'GM on: turn the debug view off' : 'GM off: turn the debug view on',
        onclick: () => { gmOn = !gmOn; writeGm(gmOn); if (!gmOn && current() === 'play' && location.hash === '#gm') go('play'); render(); } },
        icon('gm'), h('span', { class: 'rail-label' }, gmOn ? 'GM on' : 'GM off')),
    );
  }

  let lastPage = '';
  function render() {
    if (location.hash === '#map' && api.state()) { history.replaceState(null, '', '#play'); queueMicrotask(() => openMap(null)); } // an old link to the map page
    const page = current();
    drawRail(page);
    if (page !== lastPage) closePanel();
    if (page === 'loading') {
      view.replaceChildren(h('main', { class: 'playmain' }, h('p', { class: 'working', role: 'status' },
        h('span', { class: 'spin', 'aria-hidden': 'true' }), 'Loading your story…')));
    } else if (page === 'create') {
      if (lastPage !== 'create' || !creation) creation = creationScreen(api, () => go('play'));
      // a saved story that failed to load says so here, so a new story is never started by mistake
      const refused = api.notices().find((n) => n.kind === 'load_refused');
      view.replaceChildren(...(refused ? [h('div', { class: 'hs-hl bad', role: 'alert' }, h('span', { class: 'hs-hl-b' }, refused.text))] : []), creation);
    } else {
      creation = null;
      const pg = pages[page];
      if (view.firstChild !== pg.el) view.replaceChildren(pg.el);
      pg.update();
      if (page === 'play' && lastPage !== 'play') play.focus();
    }
    lastPage = page;
    if (mapOpen) map.update();
  }

  window.addEventListener('hashchange', render);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
  api.subscribe(render);
  void api.resume().catch(() => false).finally(() => { resuming = false; render(); });
  render();
}
