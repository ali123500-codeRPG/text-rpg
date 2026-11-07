// App shell: side rail (64px items, active pill fills the item, rail scrolls on its own), page area and the push-aside panel.
import type { GameApi } from '../types';
import { h, setPanelHost, closePanel } from './kit';
import { creationScreen } from './creation';
import { playScreen } from './play';
import { characterPage, inventoryPage, journalPage, questsPage } from './pages';
import { gmPage } from './gm';

const ICON: Record<string, string> = {
  create: 'M4 20 15 9m2-5 3 3-4 4-3-3zM6 14l4 4',
  play: 'M4 5h7a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-7M13 7a2 2 0 0 1 2-2h5v12h-5a2 2 0 0 0-2 2',
  stats: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  inv: 'M4 8h16v12H4zM9 8V5h6v3M4 13h16',
  quests: 'M6 3v18M6 4h11l-2 4 2 4H6',
  gm: 'M4 6h16M4 12h16M4 18h10M18 16l2 2-2 2',
  journal: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6',
};
const icon = (k: string) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('class', 'hs-i'); s.setAttribute('viewBox', '0 0 24 24');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', ICON[k]); s.append(p);
  return s;
};

const PAGES = [['play', 'Play'], ['stats', 'Character'], ['inv', 'Inventory'], ['quests', 'Quests'], ['journal', 'Journal']] as const;
const GM_KEY = 'rpg.gmDebug';
const readGm = () => { try { return localStorage.getItem(GM_KEY) === '1'; } catch { return false; } };
const writeGm = (on: boolean) => { try { localStorage.setItem(GM_KEY, on ? '1' : '0'); } catch { /* per-PC convenience only */ } };

export function mountApp(api: GameApi, root: HTMLElement = document.body) {
  let gmOn = readGm();
  const rail = h('nav', { class: 'hs-rail', 'aria-label': 'Game' });
  const view = h('div', { style: 'min-width:0' });
  const panel = h('aside', { class: 'hs-panel', hidden: true, 'aria-label': 'Details' });
  setPanelHost(panel);
  // The artifact host may wrap this page so its <style> lands in <body>: keep styles when replacing the body.
  root.querySelectorAll('style').forEach((st) => document.head.append(st));
  root.replaceChildren(rail, view, panel);

  const play = playScreen(api, (p) => go(p));
  const pages: Record<string, { el: HTMLElement; update: () => void }> = {
    play, stats: characterPage(api), inv: inventoryPage(api), quests: questsPage(api), journal: journalPage(api), gm: gmPage(api),
  };
  let creation: HTMLElement | null = null;

  // until the saved story has been looked for, show a loading note, never the creation screen
  let resuming = true;
  const current = () => {
    const p = location.hash.slice(1);
    if (!api.state()) return resuming ? 'loading' : 'create';
    if (p === 'gm' && !gmOn) return 'play';
    return pages[p] ? p : 'play';
  };
  function go(p: string) { if (location.hash.slice(1) === p) render(); else location.hash = p; }

  function drawRail(page: string) {
    const started = !!api.state();
    const item = (id: string, label: string, enabled: boolean) => h('a', {
      href: enabled ? '#' + id : undefined, 'aria-current': page === id ? 'page' : undefined, 'aria-disabled': enabled ? undefined : 'true',
      title: enabled ? label : 'Opens once your swordsman is made',
    }, icon(id), label, id === 'stats' && (api.state()?.player.progression?.unspentPerkPoints ?? 0) > 0 ? h('span', { class: 'hs-dot', title: 'A perk point to spend' }) : null);
    rail.replaceChildren(
      h('div', { class: 'hs-brand' }, 'RPG', h('span', { class: 'ar' }, 'v0')),
      started ? '' : item('create', 'Create', true),
      ...PAGES.map(([id, label]) => item(id, label, started)),
      gmOn ? item('gm', 'GM', started) : '',
      h('button', { class: 'foot', type: 'button', 'aria-pressed': String(gmOn), title: gmOn ? 'Turn the GM debug view off' : 'Turn the GM debug view on',
        onclick: () => { gmOn = !gmOn; writeGm(gmOn); if (!gmOn && current() === 'play' && location.hash === '#gm') go('play'); render(); } },
        icon('gm'), gmOn ? 'GM on' : 'GM off'),
    );
  }

  let lastPage = '';
  function render() {
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
  }

  window.addEventListener('hashchange', render);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
  api.subscribe(render);
  void api.resume().catch(() => false).finally(() => { resuming = false; render(); });
  render();
}
