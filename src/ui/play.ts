// Play screen, layout A "Book with a status strip" (play screen review, UI1–UI8): one reading column with each turn's
// results under its prose, a fixed who's-here row, the input and its tool row at the foot of the column, and a narrow
// status strip that opens the full sheet. Everything reads only PlayerView, the player's own sheet and the LogLines, and
// nothing changes with the encounter mode, which agents run or how many Claude calls a turn makes (hidden information).
import { PK } from '../library/perkIds';
import type { Actor, GameApi, GameState, LogLine, Notice, PlayerView } from '../types';
import { CONFIG } from '../config';
import { buildPlayerView, questGoalText } from '../views';
import { QUEST_STATE_NAME, dueDay, dueText, isOpen, owes, payText, questChain } from '../engine/quests';
import { questFocus } from './pages';
import { tierGap } from '../agents/game';
import { isDownLevel, tierAtLeast, tierName } from '../ruleset';
import { poolState } from '../ruleset/body';
import { actorBody, getLibrary } from '../library';
import type { TierRoll } from '../types';
import { autopilotBar } from './autopilot';
import { h } from './kit';
import { stealthBadge, stealthButtons } from './stealth';
import { dayOf, now, timeOfDay, timeView } from '../time';
import { timePassedRow, todBadge } from './timeOfDay';
import { sideSheet, statusStrip } from './charsheet';
import { skillName } from './creation';
import { healCard, healIcon, partName, quickHeal } from './healing';

const NOTICE_KIND: Record<Notice['kind'], string> = {
  scene_fallback: 'Scene planning failed', rate_limited: 'Slow down', stop_play: 'Play stopped',
  read_only: 'Read-only', save_failed: 'Not saved', load_refused: 'Not loaded',
};

const VOLUME_WORD: Record<string, string> = { whisper: 'whispering', normal: '', shout: 'shouting' };
const CHANGE_WORD: Record<string, [string, string]> = { combat: ['Combat', 'c10'], condition: ['Condition', 'c7'], health: ['Health', 'c2'] };
const SPEAKER_COLOURS = ['c15', 'c12', 'c4', 'c5', 'c1', 'c7', 'c14'];
const COMMANDS: [string, string][] = [
  ['/help', 'what you can type, and a recap of the last turns'], ['/stats', 'your character sheet'], ['/inv', 'what you carry'],
  ['/quests', 'your quests'], ['/achievements', 'your achievements and scars'], ['/title', 'wear an achievement as your title'], ['/yield', 'give up the fight you are in'], ['/aim ', 'this turn’s attack is aimed'], ['/undo', 'rewind one turn (dice are not rolled back)'],
  ['/difficulty ', 'show or change the difficulty'],
];
const UNDONE = 'Turn undone.'; // the game's line after /undo
const TURNS_SHOWN = 50; // long-list rule: the last 50 turns, then 50 more per click

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

const SLOW_AFTER_S = 90; // past this the waiting line gets a "taking longer than usual" note
const secs = (since: number) => Math.max(0, Math.round((Date.now() - since) / 1000));

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
/** Two hands meeting: the mark on the deals chip (K1 c). */
function dealIcon(): HTMLElement {
  const i = h('span', { class: 'dl-i', 'aria-hidden': 'true' });
  i.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l4-4 5 3 3-2 6 5"/><path d="M7 8l-4 4 6 6 2-2 2 2 2-2 2 2 3-3"/><path d="M11 16l2 2"/></svg>';
  return i;
}
const safe = <T>(f: () => T): T | null => { try { return f(); } catch { return null; } };
const colourOf = (name: string) => SPEAKER_COLOURS[[...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % SPEAKER_COLOURS.length];
const changesWord = (n: number) => `${n} change${n === 1 ? '' : 's'}`;
/** "*draws his sword* Stay back" → the stage direction in italics without the asterisks, outside the quote marks */
const spoken = (t: string, volume: string) => t.split(/\*([^*]+)\*/).map((x, i) => (i % 2 ? h('em', { class: 'stage' }, x.trim()) : x.trim()))
  .filter((x) => x !== '').flatMap((x, i) => [i ? ' ' : '', typeof x === 'string' ? h('q', { class: volume }, x) : x]);

// AE8: how Ideas offers each perk move against someone in view
const PERK_IDEA: Record<string, { text: (who: string) => string; note: string }> = {
  [PK.dirt_in_the_eyes]: { text: (who) => `Throw dirt in ${who}'s eyes`, note: 'Dirt in the Eyes · free, once a fight' },
  [PK.bluff]: { text: (who) => `Bluff ${who}: "Behind you!"`, note: 'Bluff · free, once per foe a fight' },
};

/** the same name twice in one list reads as "the other …" from its second time on */
function apart(names: string[]): string[] {
  const seen = new Set<string>();
  return names.map((n) => { const k = n.toLowerCase(); if (!seen.has(k)) { seen.add(k); return n; } return `the other ${n.replace(/^(a|an|the)\s+/i, '')}`; });
}

/** Ideas (D-107): built by code from PlayerView only, so nothing the character doesn't know can show. Fight and Talk list
 * everyone in view; the other groups show three. */
export function ideas(pv: PlayerView): { group: string; items: { text: string; note?: string }[] }[] {
  const people = pv.actors.filter((a) => a.level === 'full' && !(a.health && isDownLevel(a.health)));
  const names = apart(people.map((a) => a.name ?? a.label));
  const held = pv.player.inventory.filter((i) => i.equippedIn.some((x) => x.startsWith('hand:')) && i.kind === 'weapon');
  const stowed = pv.player.inventory.filter((i) => !i.equippedIn.length && i.kind === 'weapon');
  const [heldN, stowedN, groundN] = [apart(held.map((i) => i.name)), apart(stowed.map((i) => i.name)), apart(pv.zone.groundItems.map((i) => i.name))];
  const the = (n: string) => (n.startsWith('the other ') ? n : `the ${n}`);
  return [
    { group: 'Fight', items: people.map((a, i) => ({ text: `Attack ${names[i]}`, note: a.health })), all: true },
    { group: 'Talk', items: people.map((_, i) => ({ text: `Talk to ${names[i]}` })), all: true },
    { group: 'Move', items: pv.zone.links.map((l) => ({ text: `Go ${l.label}`, note: l.frontier ? 'new ground' : undefined })) },
    // ST3: sneaking is free; hiding takes the action; ST13: a Vanish slips away by a link, out of sight of those who see you
    { group: 'Stealth', items: [
      ...(pv.player.posture === 'stealthy'
        ? [{ text: 'Hide', note: 'your action' }, ...pv.zone.links.filter((l) => !l.frontier).slice(0, 1).map((l) => ({ text: `Sneak ${l.label}` }))]
        : [{ text: 'Sneak', note: 'free' }, { text: 'Hide', note: 'your action' }]),
      ...pv.zone.links.filter((l) => !l.frontier).slice(0, 1).map((l) => ({ text: `Vanish ${l.label}`, note: 'breaks sight' }))] },
    { group: 'Use', items: [
      ...heldN.map((n) => ({ text: `Stow ${the(n)}`, note: 'free' })), ...stowedN.map((n) => ({ text: `Draw ${the(n)}`, note: 'free' })),
      ...groundN.map((n) => ({ text: `Pick up ${the(n)}`, note: 'free' })), { text: 'Look around' }] },
    ...(pv.player.perkMoves?.length ? [{ group: 'Perks', items: pv.player.perkMoves.map((m) => m.id).flatMap((p) => PERK_IDEA[p]
      ? people.filter((a) => a.zone === pv.zone.id).map((a) => ({ text: PERK_IDEA[p].text(names[people.indexOf(a)]), note: PERK_IDEA[p].note })) : []) }] : []),
  ].map((g) => ({ group: g.group, items: 'all' in g ? g.items : g.items.slice(0, 3) }));
}

/** "Common room · the Crooked Kettle"; the place is left out when it only repeats the zone's name */
function placeLine(s: GameState, pv: PlayerView | null): (Node | string)[] {
  const place = s.places.find((x) => x.id === s.player.placeId);
  const parent = place?.parentId ? s.places.find((x) => x.id === place.parentId) : undefined;
  const zone = pv?.zone.name ? cap(pv.zone.name) : '';
  const bare = (t: string) => t.toLowerCase().replace(/^the\s+/, '');
  const where = [place?.names.current, parent?.names.current].filter((x): x is string => !!x && bare(x) !== bare(zone)).join(' › ');
  return zone ? [' · ', h('b', {}, zone), where ? ' · ' + where : ''] : where ? [' · ', h('b', {}, where)] : [];
}

/** each body part's state as the UI last saw it, so the body figure opens on the turn a part changes */
function partsOf(s: GameState, p: Actor): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const d of safe(() => actorBody(s, p).parts) ?? []) parts[d.id] = poolState(p.core.condition.parts[d.id] ?? 100);
  return parts;
}

/** QT15: the pinned quest, else the newest open one, under the place line; opens it on the Quests page. Nothing without one. */
function questLine(s: GameState, open: (id: string) => void): HTMLElement | null {
  const live = s.quests.filter(isOpen);
  const q = live.find((x) => x.pinned) ?? [...live].sort((a, b) => b.startTurn - a.startTurn)[0];
  if (!q) return null;
  const chain = questChain(s, q);
  const step = chain.length > 1 ? `step ${chain.indexOf(q) + 1}` : '';
  const ready = q.state === 'ready';
  const goal = ready ? '' : questGoalText(s, q);
  const due = ready ? '' : dueText(q);
  const pay = owes(q) ? payText(s, q) : '';
  const more = live.length - 1;
  const flag = h('span', { 'aria-hidden': 'true' });
  flag.innerHTML = `<svg viewBox="0 0 24 24" fill="${q.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v18M6 4h11l-2 4 2 4H6"/></svg>`;
  const sep = () => h('span', { 'aria-hidden': 'true' }, '·');
  const bits: (HTMLElement | null)[] = [
    goal ? h('span', {}, goal) : null,
    ready ? h('span', { class: 'ok' }, `✓ ${QUEST_STATE_NAME.ready}`) : null,
    due ? h('span', { class: dueDay(q) === dayOf(now(s)) ? 'warn' : '' }, due) : null,
    pay ? h('span', {}, pay) : null,
    more > 0 ? h('span', { class: 'more' }, `+${more} more`) : null,
  ];
  const label = [`Quest: ${q.text}`, step, ready ? QUEST_STATE_NAME.ready : goal.replace(/(\d+) \/ (\d+)/, '$1 of $2'), due, pay].filter(Boolean).join(', ');
  return h('button', { type: 'button', class: 'quest-line', title: q.text, 'aria-label': `${label}. Opens the Quests page.`, onclick: () => open(q.id) },
    flag, h('span', { class: 'qt' }, q.text), step ? h('span', { class: 'step' }, step) : null,
    ...bits.filter((b): b is HTMLElement => !!b).flatMap((b) => [sep(), b]));
}

export type PlayUi = { el: HTMLElement; update: () => void; focus: () => void };

/** /stats, /inv, /quests and /achievements open their rail page; everything else goes to the game. */
export const NAV_COMMANDS: Record<string, string> = { '/stats': 'stats', '/inv': 'inv', '/quests': 'quests', '/achievements': 'achievements' };

export function playScreen(api: GameApi, nav: (page: string) => void): PlayUi {
  let aimed = false;
  let confirmReset = false;
  // the story: an append-only list (role=log announces each new entry once); the waiting line sits outside it
  const list = h('div', { class: 'log', role: 'log', 'aria-label': 'Story', tabindex: '0' });
  const waiting = h('p', { class: 'working', role: 'status' });
  const story = h('div', { class: 'story' }, h('div', { class: 'col' }, list, waiting));
  const notices = h('div', { class: 'notices' });
  const aimBtn = h('button', { type: 'button', class: 'aim' });
  const input = h('input', { class: 'hs-input', id: 'cmd', autocomplete: 'off', 'aria-label': 'What do you do', 'aria-describedby': 'cmd-hint' });
  const PLACEHOLDER = 'What do you do? A line starting with / is a command (/help)';
  const hint = h('p', { class: 'hs-note in-hint', id: 'cmd-hint' });
  const send = h('button', { class: 'hs-btn-main', type: 'submit' }, 'Send');
  const healBtn = h('button', { type: 'button', class: 'itm' });
  let open: 'commands' | 'ideas' | null = null;
  let suggestion = ''; // Q16: what the player put off last turn, offered in the box until used or cleared
  const pick = (text: string) => { input.value = text; open = null; update(); input.focus(); };
  const st = stealthButtons(pick);
  const helpBtn = (id: 'commands' | 'ideas', label: string) => h('button', { type: 'button', onclick: () => { open = open === id ? null : id; update(); } }, label);
  const cmdBtn = helpBtn('commands', 'Commands'), ideaBtn = helpBtn('ideas', 'Ideas');
  const helpPanel = h('div', { class: 'helps', hidden: true });
  const tools = h('div', { class: 'tools' }, h('div', { class: 'hs-picker' }, cmdBtn, ideaBtn), h('div', { class: 'hs-picker' }, aimBtn, st.sneak, st.hide, st.vanish, healBtn));
  const bar = h('form', { class: 'inbar', onsubmit: (e: Event) => { e.preventDefault(); submit(); } }, h('div', { class: 'inrow' }, input, send), hint, tools);
  const fell = h('div', { class: 'fell', hidden: true });
  const body = h('div', { class: 'play' }, story, h('div', { class: 'sec col' }, notices, helpPanel, bar));
  const title = h('div', { class: 'head' });
  const who = h('div', { class: 'who', 'aria-label': 'Who’s here' });
  // layout A: the status strip by default; on a wide screen the full sheet is open by default, so the space beside the story
  // is used. Each width keeps its own choice (the player can still fold or open it).
  const WIDE = '(min-width: 1280px)';
  const wide = () => typeof matchMedia === 'function' && matchMedia(WIDE).matches;
  const foldKey = () => (wide() ? 'sheetFoldedWide' : 'sheetFolded');
  const readFolded = () => { try { const v = localStorage.getItem(foldKey()); return v === null ? !wide() : v === '1'; } catch { return !wide(); } };
  let folded = readFolded();
  if (typeof matchMedia === 'function') matchMedia(WIDE).addEventListener?.('change', () => { folded = readFolded(); if (el.isConnected) update(); });
  let dealsOpen = false;
  document.addEventListener('click', () => { if (dealsOpen && el.isConnected) { dealsOpen = false; update(); } });
  const sheet = h('aside', { class: 'cs-side', 'aria-label': 'Character sheet' });
  const wrap = h('div', { class: 'play-wrap' }, body, sheet);
  // Watch an agent play: it types each command into the box, then sends it like Send
  const auto = autopilotBar(api, async (text) => {
    input.value = '';
    for (const ch of text) { input.value += ch; await new Promise((r) => setTimeout(r, Math.min(35, 1500 / text.length))); }
    await submit(true);
  }, () => update());
  const el = h('main', { class: 'playmain' }, title, who, auto.el, wrap, fell);

  // Escape closes whatever is open; PageUp/PageDown scroll the story while the box has focus; Tab takes the suggestion
  document.addEventListener('keydown', (e) => {
    if (!el.isConnected || el.hidden) return;
    if (e.key === 'Escape') {
      if (dealsOpen || open) { dealsOpen = false; open = null; update(); }
      else if (suggestion && document.activeElement === input && !input.value) { suggestion = ''; update(); }
    }
    if ((e.key === 'PageUp' || e.key === 'PageDown') && document.activeElement === input) {
      e.preventDefault(); story.scrollBy({ top: (e.key === 'PageUp' ? -0.9 : 0.9) * story.clientHeight });
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey && suggestion && !input.value) { e.preventDefault(); input.value = suggestion; suggestion = ''; update(); }
  });
  input.addEventListener('input', () => { if (suggestion) update(); });

  let offered: LogLine | null = null;

  async function submit(byAgent = false) {
    const text = input.value.trim();
    if (!text || api.busy() || (auto.playing() && !byAgent)) return;
    const cmd = text.split(/\s+/)[0].toLowerCase();
    open = null;
    if (NAV_COMMANDS[cmd] && text === cmd) { input.value = ''; nav(NAV_COMMANDS[cmd]); return; }
    if (cmd === '/aim' && text === cmd) { aimed = !aimed; input.value = ''; update(); return; }
    input.value = '';
    suggestion = '';
    const wasAimed = aimed || cmd === '/aim';
    aimed = false; // resets after the turn resolves
    await api.submit(text, { aimed: wasAimed });
  }

  /** opens the Character page at its Perks section */
  const seePerks = () => { nav('stats'); setTimeout(() => document.querySelector('.pk')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); };
  const goldCard = (title: string, sub: string, action?: [string, () => void]) => h('div', { class: 'perk-new' }, h('span', { class: 'st', 'aria-hidden': 'true' }, '✦'),
    h('div', {}, title, h('small', {}, sub)), action ? h('button', { type: 'button', class: 'hs-btn-text', onclick: action[1] }, action[0]) : null);

  // ---- the story list: one cached entry per line, so redraws never rebuild it or close an opened fold
  const entries = new WeakMap<LogLine, HTMLElement>();
  let snap: Record<string, string> | null = null, snapLine: LogLine | null | undefined;
  let changedParts = new Set<string>(); // parts whose state the last turn changed: the body figure opens once
  let limit = TURNS_SHOWN;
  const undoneOpen = new Set<number>(); // undone blocks the player unfolded, by the undo line's index
  const markers = new Map<number, HTMLElement>();
  const earlier = h('button', { type: 'button', class: 'hs-btn-text earlier', onclick: () => { limit += TURNS_SHOWN; update(); } });

  /** a roll line: whose roll (the player's own skill, or who rolled against the player), both tiers, the gap and the result */
  const checkLine = (c: NonNullable<LogLine['check']>, by?: string) => h('p', { class: 'check' + (by ? ' in' : '') }, checkIcon(c.kind),
    h('span', { class: 'sk' }, by ? cap(by) : skillName(c.skill)), tierChip(c),
    c.against ? [h('span', { class: 'vs' }, `vs ${c.against.what}`), tierChip(c.against), h('span', { class: 'gap' }, tierGap(c, c.against))] : null,
    h('span', { class: 'res' }, '→ ', h('b', {}, c.result)));

  function results(l: LogLine, s: GameState | null): HTMLElement | null {
    const lib = getLibrary();
    const xp = (s?.player.progression?.xpLog ?? []).filter((a) => a.turn === l.turn).reduce((a, x) => a + x.amount, 0);
    const gains = Object.entries(l.gains ?? {}).filter(([, n]) => n);
    const gear = l.gear ?? [];
    const row = (k: string, ...v: (Node | string)[]) => h('p', { class: 'rrow' }, h('span', { class: 'hs-label' }, k), h('span', {}, ...v));
    const kids = [
      l.check ? checkLine(l.check) : null,
      ...(l.incomingChecks ?? []).map((c) => checkLine(c, c.by)),
      l.changes?.length ? h('details', { class: 'changes' },
        h('summary', {}, h('span', { class: 'hs-label' }, `Turn ${l.turn}`), h('span', { class: 'hs-chip' }, `↻${l.changes.length}`),
          h('span', { class: 'sum' }, l.changes.filter((x) => x.kind !== 'combat').map((x) => x.text).join(' · ') || changesWord(l.changes.length))),
        h('table', { class: 'chg' }, h('tbody', {}, l.changes.map((x) => h('tr', {},
          h('td', {}, h('span', { class: 'hs-tg', style: `--tg:var(--${CHANGE_WORD[x.kind][1]})` }, CHANGE_WORD[x.kind][0])), h('td', {}, x.text)))))) : null,
      ...gear.map((g) => row('Gear', g)),
      gains.length ? row('Skills', gains.map(([k, n]) => `${skillName(k)} +${n}`).join(' · ')) : null,
      xp ? row('XP', `+${xp}`) : null,
      ...(l.heals ?? []).map(healCard),
      ...(l.levelUps ?? []).map((u) => goldCard('Level up', u.classId ? `${lib.classes[u.classId]?.name ?? 'Your class'} reached level ${u.level}` : `A bonus level: you reached level ${u.level}`, ['See perks', seePerks])),
      ...(l.achievements ?? []).map((a) => goldCard('Achievement', a.name, ['See achievements', () => nav('achievements')])),
      // V2a: milestones a skill crossed on this turn; the card never names the perk
      ...(l.unlocks ?? []).map((u) => goldCard('New perk unlocked', `${skillName(u.skill)} reached ${u.milestone}`, ['See perks', seePerks])),
      l.mechanics?.length ? h('details', { class: 'rolls' }, h('summary', {}, h('span', { class: 'hs-label' }, 'Rolls')),
        h('ul', {}, l.mechanics.map((m) => h('li', {}, m)))) : null,
    ].filter(Boolean) as HTMLElement[];
    return kids.length ? h('div', { class: 'results' }, ...kids) : null;
  }

  /** a place or scene break before a turn's prose: the new place's name, '' for a new scene in the same place, null for none */
  function breakFor(l: LogLine, prev: LogLine | null): string | null {
    if (!l.place || !prev?.place) return null;
    if (l.place.id !== prev.place.id) return l.place.name;
    return l.scene !== undefined && prev.scene !== undefined && l.scene !== prev.scene ? '' : null;
  }

  function entry(l: LogLine, s: GameState | null, prev: LogLine | null): HTMLElement {
    let e = entries.get(l);
    if (e) return e;
    if (l.kind === 'player') e = h('p', { class: 'ln-player' }, l.text, l.aimed ? h('span', { class: 'aimed' }, ' · aimed') : null);
    else if (l.kind === 'command' && l.text === UNDONE) e = h('p', { class: 'ln-command' }, `Turn ${l.turn} undone. Dice are not rolled back.`);
    else if (l.kind !== 'narration') e = h('p', { class: 'ln-' + l.kind }, l.text);
    else e = h('div', { class: 'turn' },
      ((b) => b === null ? null : h('p', { class: 'pbreak' + (b ? '' : ' scene') }, b))(breakFor(l, prev)),
      h('p', { class: 'ln-narration' }, l.text),
      l.speech?.length ? h('div', { class: 'speech' }, l.speech.flatMap((sp) => [
        h('p', { class: 'who2', style: `color:var(--${colourOf(sp.speaker)})` }, sp.speaker.toLowerCase() === 'player' ? 'You' : cap(sp.speaker),
          VOLUME_WORD[sp.volume] ? h('span', { class: 'how' }, VOLUME_WORD[sp.volume]) : null),
        h('p', { class: 'said' }, ...spoken(sp.text, sp.volume))])) : null,
      l.timePassed ? timePassedRow(l.timePassed) : null, // T2 b
      results(l, s));
    // the list is the live region: inner status roles would announce the same words twice
    e.querySelectorAll('[role="status"]').forEach((x) => x.removeAttribute('role'));
    entries.set(l, e);
    return e;
  }

  function renderStory(lines: LogLine[], s: GameState | null) {
    // a new narration line: the body parts it changed, by comparing the sheet before and after (opens the body figure once)
    const lastNarr = [...lines].reverse().find((l) => l.kind === 'narration') ?? null;
    if (s && !api.busy()) {
      const cur = partsOf(s, s.player);
      if (snap && snapLine !== undefined && lastNarr && lastNarr !== snapLine && !entries.has(lastNarr))
        changedParts = new Set(Object.keys(cur).filter((k) => snap![k] && snap![k] !== cur[k]));
      snap = cur; snapLine = lastNarr;
    }
    // undone turns: the lines of turn N before each "Turn undone." line, folded under one "Undone · turn N" row
    const undone = new Map<number, number>(); // line index → its undo line's index
    lines.forEach((l, i) => {
      if (l.kind !== 'command' || l.text !== UNDONE) return;
      for (let j = i - 1; j >= 0 && lines[j].turn >= l.turn; j--) if (lines[j].turn === l.turn && !undone.has(j)) undone.set(j, i);
    });
    const turns = [...new Set(lines.map((l) => l.turn))];
    const from = turns.length > limit ? turns[turns.length - limit] : -Infinity;
    const want: HTMLElement[] = [];
    if (turns.length > limit) { earlier.textContent = `Show earlier turns · ${turns.length - limit} more`; want.push(earlier); }
    let prevNarr: LogLine | null = null; // the last narration not undone, for place and scene breaks
    lines.forEach((l, i) => {
      const u = undone.get(i);
      const prev = prevNarr;
      if (l.kind === 'narration' && u === undefined) prevNarr = l;
      if (l.turn < from) return;
      if (u !== undefined && undone.get(i - 1) !== u) {
        let m = markers.get(u);
        if (!m) {
          m = h('button', { type: 'button', class: 'undone-row', 'aria-expanded': 'false', onclick: () => { undoneOpen.has(u) ? undoneOpen.delete(u) : undoneOpen.add(u); update(); } },
            h('span', { class: 'hs-label' }, `Undone · turn ${l.turn}`));
          markers.set(u, m);
        }
        m.setAttribute('aria-expanded', String(undoneOpen.has(u)));
        want.push(m);
      }
      const e = entry(l, s, prev);
      e.classList.toggle('undone', u !== undefined);
      e.hidden = u !== undefined && !undoneOpen.has(u);
      want.push(e);
    });
    // append-only while the old entries are unchanged; a full redraw only after an undo or "Show earlier turns"
    const have = Array.from(list.children);
    if (have.length <= want.length && have.every((x, i) => x === want[i])) list.append(...want.slice(have.length));
    else list.replaceChildren(...want);
  }

  function update() {
    const s = api.state();
    const pv = s ? safe(() => buildPlayerView(s)) : null;
    const stealthy = s?.player.posture === 'stealthy';
    bar.classList.toggle('stealthy', stealthy);
    const lines = api.lines();
    // PM5/K1 c: the player's deals with NPCs, as an "N deals" chip beside the scene title that opens the list
    const deals = pv?.agreements ?? [];
    if (!deals.length) dealsOpen = false;
    const dealChip = deals.length ? h('span', { class: 'dl-wrap' },
      h('button', { type: 'button', class: 'dl-chip', 'aria-expanded': String(dealsOpen), onclick: (e: Event) => { e.stopPropagation(); dealsOpen = !dealsOpen; update(); } },
        dealIcon(), `${deals.length} deal${deals.length === 1 ? '' : 's'}`),
      dealsOpen ? h('section', { class: 'dl-pop', 'aria-label': 'Your deals', onclick: (e: Event) => e.stopPropagation() },
        h('p', { class: 'hs-section' }, 'Your deals'),
        deals.map((d) => h('div', { class: 'dl-row' }, h('b', {}, cap(d.with)), h('span', {}, d.text), h('small', {}, `Made turn ${d.madeTurn}`)))) : null) : null;
    // UI6: "Show rolls" sets the story's own showMechanics; the game records rolls only while it is on
    const show = !!(s?.settings.showMechanics ?? CONFIG.SHOW_MECHANICS);
    const rollsBtn = s && CONFIG.SHOW_MECHANICS ? h('button', { type: 'button', class: 'hs-btn-text rolls-sw', 'aria-pressed': String(show),
      title: show ? 'Rolls show under each turn. Click to hide them' : 'Click to show the dice and modifiers under each turn',
      onclick: () => { s.settings.showMechanics = !show; update(); } }, show ? '✓ Show rolls' : 'Show rolls') : null;
    // the header names the last turn played, the one the last results row shows
    const lastTurn = [...lines].reverse().find((l) => l.kind === 'narration')?.turn ?? s?.turn;
    title.replaceChildren(h('div', {}, h('h1', {}, s?.meta.title ?? 'Play', s ? todBadge(timeView(s).day, timeOfDay(now(s))) : null, stealthy ? stealthBadge() : null, dealChip),
      h('p', {}, s ? [`Turn ${lastTurn}`, ...placeLine(s, pv)] : 'No story yet'), s ? questLine(s, (id) => { questFocus.id = id; nav('quests'); }) : null), h('div', { class: 'title-tools' }, s ? auto.opener : '', rollsBtn ?? ''));
    story.classList.toggle('no-rolls', !show);

    // who's here: one fixed-height row; only actors the character fully perceives (PlayerView); others' health from Wounded down
    const seen = pv?.actors.filter((a) => a.level === 'full') ?? [];
    who.replaceChildren(h('span', { class: 'hs-label' }, 'Who’s here'), ...(seen.length ? seen.map((a) => h('span', { class: 'pp' }, h('b', {}, cap(a.name ?? a.label)),
      a.health ? h('span', { class: isDownLevel(a.health) ? 'st down' : 'st warn' }, isDownLevel(a.health) ? 'Down' : a.health)
        : a.activityLook ? h('span', { class: 'st' }, a.activityLook) : null,
      // MB16: others' morale, only from Afraid down
      a.morale ? h('span', { class: 'st fear' }, a.morale) : null,
      // A13 Read Wounds: a foe's Damaged parts
      ...(a.damaged ?? []).map((pt) => h('span', { class: 'st warn', title: 'Read Wounds' }, `${partName(pt).toLowerCase()} damaged`)))) : [h('span', { class: 'hs-note' }, 'Nobody in view')]));

    // Q16: what the player put off last turn is offered as a dimmed suggestion; nothing is typed or sent until they take it
    const nextLine = lines.at(-1);
    if (nextLine?.next && nextLine !== offered && !api.busy()) { suggestion = nextLine.next; offered = nextLine; }
    const offering = !!suggestion && !input.value;
    input.placeholder = offering ? suggestion : PLACEHOLDER;
    input.classList.toggle('suggest', offering);
    hint.textContent = offering ? 'From last turn · Tab to use, Esc to clear' : '';

    const stick = story.scrollHeight - story.scrollTop - story.clientHeight < 40;
    renderStory(lines, s);
    const busy = api.busy();
    if (busy && !waiting.dataset.since) {
      const since = String(Date.now());
      waiting.dataset.since = since;
      // one neutral line on every turn: never which agent runs (UI2); the ticking seconds are not read out
      waiting.replaceChildren(h('span', { class: 'spin', 'aria-hidden': 'true' }), h('span', {}, 'The story is moving…'),
        h('span', { class: 'secs', 'aria-hidden': 'true' }, '0 s'), h('span', { class: 'slow', hidden: true }, 'Taking longer than usual. It is still running; the game waits for it.'));
    }
    if (!busy) { delete waiting.dataset.since; waiting.replaceChildren(); }
    waiting.hidden = !busy;

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
    if (stick || busy) story.scrollTop = story.scrollHeight;

    const ns = api.notices();
    notices.replaceChildren(...ns.map((n) => h('div', { class: 'hs-hl ' + (n.kind === 'stop_play' || n.kind === 'save_failed' ? 'bad' : 'ask'), role: 'status' },
      h('span', { class: 'hs-hl-b', 'data-kind': NOTICE_KIND[n.kind] }, n.text))));
    const stopped = ns.some((n) => n.kind === 'stop_play' || n.kind === 'read_only');
    input.disabled = stopped || busy || auto.playing(); // the autopilot has the box while it plays
    send.disabled = stopped || busy || auto.playing();
    auto.update();
    aimBtn.disabled = stopped;
    st.set(stealthy, stopped);
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

    // layout A: the status strip, or the full sheet as a 420px side panel that pushes the story narrower
    const setFolded = (f: boolean) => { folded = f; try { localStorage.setItem(foldKey(), f ? '1' : '0'); } catch { /* not saved */ } update(); };
    sheet.classList.toggle('folded', folded);
    wrap.classList.toggle('sheet-open', !folded);
    if (s && folded) sheet.replaceChildren(h('button', { type: 'button', class: 'cs-strip', 'aria-expanded': 'false', title: 'Open your full sheet', onclick: () => setFolded(false) },
      h('span', { class: 'hs-label' }, 'Your sheet ›'), ...statusStrip(s, s.player), stealthy ? h('span', { class: 'cs-stl' }, 'Stealthy') : null));
    else sheet.replaceChildren(h('div', { class: 'cs-side-h' }, h('p', { class: 'hs-section' }, 'Your sheet'),
      h('button', { class: 'hs-btn-text', type: 'button', 'aria-expanded': 'true', onclick: () => setFolded(true) }, 'Close ×')),
      ...(s ? sideSheet(s, s.player, [...lines].reverse().find((l) => l.kind === 'narration'), changedParts) : []));

    const fallen = api.fell();
    wrap.hidden = fallen;
    who.hidden = fallen;
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
            : h('button', { class: 'hs-btn-text danger', type: 'button', onclick: () => { confirmReset = true; update(); } }, 'Reset')));
    }
  }
  aimBtn.onclick = () => { aimed = !aimed; update(); };
  // tick the seconds on the waiting line without rebuilding the page
  setInterval(() => {
    const since = +(waiting.dataset.since ?? 0);
    if (!since) return;
    const n = secs(since), sec = waiting.querySelector('.secs'), slow = waiting.querySelector<HTMLElement>('.slow');
    if (sec) sec.textContent = `${n} s`;
    if (slow) slow.hidden = n < SLOW_AFTER_S;
  }, 1000);
  return { el, update, focus: () => input.focus() };
}
