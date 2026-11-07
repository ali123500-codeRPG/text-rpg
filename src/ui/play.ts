// Play screen (Part 2, Play screen): place line and Claude-call count in the header, who's-here strip, narration log
// newest last with the check line, speaker lines and folded turn changes, "…" while waiting, Commands and Ideas
// panels (D-100, D-107), one input (/ starts a command), Aim toggle, mechanics panel, notices and the "You fell" screen.
import type { GameApi, GameState, LogLine, Notice, PlayerView } from '../types';
import { CONFIG } from '../config';
import { buildPlayerView } from '../views';
import { tierGap } from '../agents/game';
import { tierAtLeast, tierName } from '../ruleset';
import type { TierRoll } from '../types';
import { h } from './kit';
import { timeView } from '../time';
import { sideSheet } from './charsheet';
import { skillName } from './creation';
import { healCard, healIcon, quickHeal } from './healing';

const NOTICE_KIND: Record<Notice['kind'], string> = {
  scene_fallback: 'Scene planning failed', rate_limited: 'Slow down', stop_play: 'Play stopped',
  read_only: 'Read-only', save_failed: 'Not saved', load_refused: 'Not loaded',
};

const MODE_WORD: Record<string, string> = { explore: 'Exploring', dialogue: 'Talking', tactical: 'Fighting' };
const VOLUME_WORD: Record<string, string> = { whisper: 'whispering', normal: '', shout: 'shouting' };
const CHANGE_WORD: Record<string, [string, string]> = { combat: ['Combat', 'c10'], condition: ['Condition', 'c7'], health: ['Health', 'c2'] };
const SPEAKER_COLOURS = ['c15', 'c12', 'c4', 'c5', 'c1', 'c7', 'c14'];
const COMMANDS: [string, string][] = [
  ['/help', 'what you can type, and a recap of the last turns'], ['/stats', 'your character sheet'], ['/inv', 'what you carry'],
  ['/quests', 'your quests'], ['/aim ', 'this turn’s attack is aimed'], ['/undo', 'rewind one turn (dice are not rolled back)'],
  ['/difficulty ', 'show or change the difficulty'],
];

// check line: an icon for the kind of roll, and each tier as a chip tinted good (Success and up) or bad (below)
const ICON_PATH = { attack: 'M14.5 4H20v5.5L9 20.5 3.5 15zM6 13l5 5M4 20l2.5-2.5', contest: 'M4 5h16v11H9l-5 4z', roll: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' };
function checkIcon(kind: 'attack' | 'contest' | 'roll'): SVGSVGElement {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('class', 'hs-i ci'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', ICON_PATH[kind]); s.append(p);
  return s;
}
const tierChip = (t: TierRoll) => h('span', { class: 'tier ' + (tierAtLeast(t, 'great_success') ? 'great' : tierAtLeast(t, 'success') ? 'ok' : tierAtLeast(t, 'near_miss') ? 'near' : 'bad') }, tierName(t));

// what each Claude agent is doing, in the player's words (shown while it runs)
const DOING: Record<string, string> = {
  weaver: 'setting the scene', parser: 'reading what you typed', planner: 'deciding what the others do',
  responder: 'working out a reply', voice: 'working out a reply', narrator: 'writing what happens',
};
const SLOW_AFTER_S = 90; // past this a running call gets a "taking longer than usual" note
const secs = (since: number) => Math.max(0, Math.round((Date.now() - since) / 1000));

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const safe = <T>(f: () => T): T | null => { try { return f(); } catch { return null; } };
const colourOf = (name: string) => SPEAKER_COLOURS[[...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % SPEAKER_COLOURS.length];

/** Ideas (D-107): built by code from PlayerView only, so nothing the character doesn't know can show. Three per group. */
export function ideas(pv: PlayerView): { group: string; items: { text: string; note?: string }[] }[] {
  const people = pv.actors.filter((a) => a.level === 'full' && a.health !== 'Incapacitated');
  const nm = (a: PlayerView['actors'][number]) => a.name ?? a.label;
  const held = pv.player.inventory.filter((i) => i.equippedIn.some((x) => x.startsWith('hand:')) && i.kind === 'weapon');
  const stowed = pv.player.inventory.filter((i) => !i.equippedIn.length && i.kind === 'weapon');
  return [
    { group: 'Fight', items: people.map((a) => ({ text: `Attack ${nm(a)}`, note: a.health })) },
    { group: 'Talk', items: people.map((a) => ({ text: `Talk to ${nm(a)}` })) },
    { group: 'Move', items: pv.zone.links.map((l) => ({ text: `Go ${l.label}`, note: l.frontier ? 'new ground' : undefined })) },
    { group: 'Use', items: [
      ...held.map((i) => ({ text: `Stow the ${i.name}`, note: 'free' })), ...stowed.map((i) => ({ text: `Draw the ${i.name}`, note: 'free' })),
      ...pv.zone.groundItems.map((i) => ({ text: `Pick up the ${i.name}`, note: 'free' })), { text: 'Look around' }] },
  ].map((g) => ({ ...g, items: g.items.slice(0, 3) }));
}

/** T11: "Day 2 · Evening" in the header */
function dayLine(s: GameState): string {
  const t = timeView(s);
  return `Day ${t.day} · ${t.timeOfDay}`;
}

function placeLine(s: GameState, pv: PlayerView | null): (Node | string)[] {
  const place = s.places.find((x) => x.id === s.player.placeId);
  const parent = place?.parentId ? s.places.find((x) => x.id === place.parentId) : undefined;
  const where = [place?.names.current, parent?.names.current].filter(Boolean).join(' › ');
  return pv?.zone.name ? [' · ', h('b', {}, cap(pv.zone.name)), where ? ' · ' + where : ''] : where ? [' · ', h('b', {}, where)] : [];
}

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
  const healBtn = h('button', { type: 'button', class: 'itm' });
  const aimPicker = h('div', { class: 'hs-picker' }, aimBtn, healBtn);
  let open: 'commands' | 'ideas' | null = null;
  const helpBtn = (id: 'commands' | 'ideas', label: string) => h('button', { type: 'button', onclick: () => { open = open === id ? null : id; update(); } }, label);
  const cmdBtn = helpBtn('commands', 'Commands'), ideaBtn = helpBtn('ideas', 'Ideas');
  const helpPanel = h('div', { class: 'helps', hidden: true });
  const bar = h('form', { class: 'inbar', onsubmit: (e: Event) => { e.preventDefault(); submit(); } }, h('div', { class: 'hs-picker' }, cmdBtn, ideaBtn), input, aimPicker, send);
  const fell = h('div', { class: 'fell', hidden: true });
  const body = h('div', { class: 'play' }, h('div', { class: 'log-wrap' }, log, mech), h('div', { class: 'sec' }, notices, helpPanel, bar));
  const title = h('div', { class: 'head' });
  const who = h('div', { class: 'who', 'aria-label': 'Who’s here' });
  let folded = false;
  try { folded = localStorage.getItem('sheetFolded') === '1'; } catch { /* storage blocked: start open */ }
  const sheet = h('aside', { class: 'cs-side', 'aria-label': 'Character sheet' });
  const el = h('main', { class: 'playmain' }, title, who, h('div', { class: 'play-wrap' }, body, sheet), fell);

  let offered: LogLine | null = null;
  const pick = (text: string) => { input.value = text; open = null; update(); input.focus(); };

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

  /** opens the Character page at its Perks section */
  const seePerks = () => { nav('stats'); setTimeout(() => document.querySelector('.pk')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); };

  function lineEl(l: LogLine): (HTMLElement | null)[] {
    if (l.kind !== 'narration') return [h('p', { class: 'ln-' + l.kind }, l.text)];
    const c = l.check;
    return [
      c ? h('p', { class: 'check' }, checkIcon(c.kind), h('span', { class: 'sk' }, skillName(c.skill)), tierChip(c),
        c.against ? [h('span', { class: 'vs' }, `vs ${c.against.what}`), tierChip(c.against), h('span', { class: 'gap' }, tierGap(c, c.against))] : null,
        h('span', { class: 'res' }, '→ ', h('b', {}, c.result))) : null,
      h('p', { class: 'ln-narration' }, l.text),
      ...(l.speech ?? []).map((sp) => h('div', { class: 'line' },
        h('p', { class: 'who2', style: `color:var(--${colourOf(sp.speaker)})` }, cap(sp.speaker), VOLUME_WORD[sp.volume] ? h('span', { class: 'how' }, VOLUME_WORD[sp.volume]) : null),
        h('p', {}, h('q', { class: sp.volume }, sp.text)))),
      ...(l.heals ?? []).map(healCard),
      // V2a (Ali, 07/11/2026): milestones a skill crossed on this turn; the card never names the perk
      ...(l.unlocks ?? []).map((u) => h('div', { class: 'perk-new', role: 'status' }, h('span', { class: 'st', 'aria-hidden': 'true' }, '✦'),
        h('div', {}, 'New perk unlocked', h('small', {}, `${skillName(u.skill)} reached ${u.milestone}`)),
        h('button', { type: 'button', class: 'hs-btn-text', onclick: seePerks }, 'See perks'))),
      l.changes?.length ? h('details', { class: 'changes' },
        h('summary', {}, h('span', { class: 'hs-label' }, `Turn ${l.turn}`), h('span', { class: 'hs-chip' }, `↻${l.changes.length}`),
          h('span', { class: 'sum' }, l.changes.filter((x) => x.kind !== 'combat').map((x) => x.text).join(' · ') || `${l.changes.length} changes`)),
        h('table', { class: 'chg' }, h('tbody', {}, l.changes.map((x) => h('tr', {},
          h('td', {}, h('span', { class: 'hs-tg', style: `--tg:var(--${CHANGE_WORD[x.kind][1]})` }, CHANGE_WORD[x.kind][0])), h('td', {}, x.text)))))) : null,
    ];
  }

  /** the story column's row while the player waits: what Claude is doing and for how long */
  function workingRow(): HTMLElement {
    const w = api.working()[0];
    const doing = w ? `Claude is ${DOING[w.agent] ?? 'working'}` : 'Working on your turn';
    return h('p', { class: 'working', role: 'status' }, h('span', { class: 'spin', 'aria-hidden': 'true' }), h('span', {}, doing),
      w ? h('span', { class: 'secs', 'data-since': String(w.since) }, `${secs(w.since)} s`) : null,
      w ? h('span', { class: 'slow', 'data-slow-since': String(w.since), hidden: secs(w.since) < SLOW_AFTER_S }, 'Taking longer than usual. It is still running; the game waits for it.') : null);
  }
  /** header note for calls running while the player is free to act (background Planners and Weaver) */
  function bgNote(): HTMLElement | null {
    const n = api.working().length;
    if (!n || api.busy()) return null;
    return h('p', { class: 'hs-note bg-run', title: 'Claude is preparing the next turn in the background. You can act now.' },
      h('span', { class: 'spin sm', 'aria-hidden': 'true' }), `Claude is preparing ${n === 1 ? '1 call' : `${n} calls`} in the background`);
  }

  function update() {
    const s = api.state();
    const pv = s ? safe(() => buildPlayerView(s)) : null;
    title.replaceChildren(h('div', {}, h('h1', {}, s?.meta.title ?? 'Play'), h('p', {}, s ? [`Turn ${s.turn} · ${dayLine(s)} · ${MODE_WORD[s.mode] ?? s.mode}`, ...placeLine(s, pv)] : 'No story yet')),
      h('p', { class: 'hs-note calls', title: 'Every request this page sent to Claude since it was opened, counted by code. Repairs and background calls count too.' },
        `${api.calls()} Claude call${api.calls() === 1 ? '' : 's'} this session`),
      bgNote() ?? '');
    // who's here: only actors the character fully perceives (PlayerView); others' health only from Wounded down
    const seen = pv?.actors.filter((a) => a.level === 'full') ?? [];
    who.hidden = !seen.length;
    who.replaceChildren(h('span', { class: 'hs-label' }, 'Who’s here'), ...seen.map((a) => h('span', { class: 'pp' }, h('b', {}, cap(a.name ?? a.label)),
      a.health ? h('span', { class: a.health === 'Incapacitated' ? 'st down' : 'st warn' }, a.health === 'Incapacitated' ? 'Down' : a.health)
        : a.activityLook ? h('span', { class: 'st' }, a.activityLook) : null,
      // A13 Read Wounds: a foe's Damaged parts
      ...(a.damaged ?? []).map((pt) => h('span', { class: 'st warn', title: 'Read Wounds' }, `${pt.replace(/_/g, ' ')} damaged`)))));
    const lines = api.lines();
    // Q16: what the player put off last turn fills an empty action box once (nothing is sent until Send)
    const nextLine = lines.at(-1);
    if (nextLine?.next && nextLine !== offered && !input.value && !api.busy()) { input.value = nextLine.next; offered = nextLine; }
    const stick = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    log.replaceChildren(...lines.flatMap(lineEl).filter((x): x is HTMLElement => !!x), api.busy() ? workingRow() : '');

    helpPanel.hidden = !open;
    cmdBtn.setAttribute('aria-pressed', String(open === 'commands'));
    ideaBtn.setAttribute('aria-pressed', String(open === 'ideas'));
    const head = (t: string) => h('div', { class: 'helps-h' }, h('p', { class: 'hs-section' }, t),
      h('button', { class: 'hs-btn-text', type: 'button', onclick: () => { open = null; update(); } }, 'Close ×'));
    if (open === 'commands') helpPanel.replaceChildren(head('Commands · no time passes'),
      h('ul', { class: 'cmds' }, COMMANDS.map(([c, what]) => h('li', {}, h('button', { type: 'button', onclick: () => pick(c) }, h('b', {}, c.trim()), h('span', {}, what))))),
      h('p', { class: 'hs-note' }, 'Picking one fills the box; nothing is sent until you press Send.'));
    else if (open === 'ideas') helpPanel.replaceChildren(head('Ideas · from what you can see now'),
      h('div', { class: 'idea-groups' }, (pv ? ideas(pv) : []).map((g) => h('div', {}, h('p', { class: 'hs-label' }, g.group),
        g.items.length ? h('ul', {}, g.items.map((it) => h('li', {}, h('button', { type: 'button', onclick: () => pick(it.text) }, it.text, it.note ? h('span', {}, it.note) : null))))
          : h('p', { class: 'hs-note' }, 'Nothing right now')))),
      h('p', { class: 'hs-note' }, 'Built by code from what your character can see and carries, refreshed every turn. Picking one fills the box; nothing is sent until you press Send.'));
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
    // OQ-24 (decided): the action box keeps focus; it comes back after a turn re-enables it
    if (!input.disabled && !el.hidden && el.isConnected && (document.activeElement === document.body || document.activeElement === send)) input.focus();
    aimBtn.setAttribute('aria-pressed', String(aimed));
    aimBtn.title = aimed ? 'This turn’s attack is aimed. Click to stop aiming' : 'Click to aim this turn’s attack (same as /aim)';
    aimBtn.textContent = aimed ? 'Aimed' : 'Aim';
    // H3 b: one quick slot for a healing item; it fills the box, nothing is sent until Send
    const qh = s ? quickHeal(s, s.player) : null;
    healBtn.hidden = !qh;
    healBtn.disabled = stopped;
    if (qh) {
      const use = `use a ${qh.name}`;
      healBtn.title = `${cap(qh.name)} ×${qh.count}: fills the box with “${use}”. Pick which healing item shows here in the Inventory.`;
      healBtn.setAttribute('aria-label', `Use a ${qh.name}, ${qh.count} left`);
      healBtn.replaceChildren(healIcon(qh), h('b', {}, `×${qh.count}`));
      healBtn.onclick = () => pick(use);
    }

    const fold = h('button', { class: 'hs-btn-text cs-fold', type: 'button', 'aria-expanded': String(!folded),
      onclick: () => { folded = !folded; try { localStorage.setItem('sheetFolded', folded ? '1' : '0'); } catch { /* not saved */ } update(); } }, folded ? 'Sheet ‹' : 'Hide ›');
    sheet.classList.toggle('folded', folded);
    sheet.replaceChildren(h('div', { class: 'cs-side-h' }, folded ? null : h('p', { class: 'hs-section' }, 'Your sheet'), fold), ...(s && !folded ? sideSheet(s, s.player, [...lines].reverse().find((l) => l.kind === 'narration')) : []));

    const fallen = api.fell();
    body.hidden = fallen;
    sheet.hidden = fallen;
    who.hidden = fallen || !seen.length;
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
  // tick the seconds on the working row without rebuilding the page
  setInterval(() => {
    for (const e of Array.from(el.querySelectorAll<HTMLElement>('[data-since]'))) e.textContent = `${secs(+e.dataset.since!)} s`;
    for (const e of Array.from(el.querySelectorAll<HTMLElement>('[data-slow-since]'))) e.hidden = secs(+e.dataset.slowSince!) < SLOW_AFTER_S;
  }, 1000);
  return { el, update, focus: () => input.focus() };
}
