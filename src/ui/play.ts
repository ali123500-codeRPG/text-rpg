// Play screen, layout A "Book with a status strip" (play screen review, UI1–UI8): one reading column with each turn's
// results under its prose, a fixed who's-here row, the input and its tool row at the foot of the column, and a narrow
// status strip that opens the full sheet. Everything reads only PlayerView, the player's own sheet and the LogLines, and
// nothing changes with the encounter mode, which agents run or how many Claude calls a turn makes (hidden information).
import { PK } from '../library/perkIds';
import { outcomeText, struck } from '../ruleset/hits';
import type { AchievementNote, Actor, GameApi, GameState, LogLine, Notice, Personality, PlayerView, ScenarioEndNote } from '../types';
import { leanIdeas, type IdeaGroup, type IdeaKind } from './ideaLeans';
import { personalityOf } from '../ruleset/personality';
import { CONFIG } from '../config';
import { buildPlayerView, distText, questGoalText } from '../views';
import { QUEST_STATE_NAME, dueDay, dueText, isOpen, owes, payText, questChain } from '../engine/quests';
import { questFocus } from './pages';
import { tierGap, xpSourceWords } from '../agents/game';
import { isDownLevel, othersHealthWord, TAG_MARK, tierAtLeast, tierName } from '../ruleset';
import { poolState } from '../ruleset/body';
import { actorBody, getLibrary } from '../library';
import type { TierRoll } from '../types';
import { fellFacts, fellLine } from './fell';
import { autopilotBar } from './autopilot';
import { h, dragScroll, playDraft } from './kit';
import { perkSeries } from './perks';
import { stealthBadge, stealthButtons } from './stealth';
import { dayOf, now, timeOfDay, timeView } from '../time';
import { timePassedRow, todBadge } from './timeOfDay';
import { NERVE_PASSES, NERVE_STILL, NERVE_UNTIL, shownValues, sideSheet, statusStrip, tag, type ShownValues } from './charsheet';
import { moraleLevel } from '../ruleset/morale';
import { cantSteady } from '../engine/steady';
import { skillName } from './creation';
import { healCard, healIcon, partName, quickHeal, woundCard } from './healing';
import { applyMotion, arrive, bar as barMove, count, delta, finishAll, flare, impact, later, motionOn, moving, ms, play, pulse, sentences, setMotion, shake, slam, stamp } from './motion';
import { coinWords } from '../engine/trade';
import { actionsRow, doingChip, doingNow, followingNow, walkingNow } from './doing';
import { closePop, openPop } from './pop';
import { maybeOfferPop } from './essences';
import { anyGains, gainsPanel, gainsSummary, honor, playGains } from './gains';
import { working } from '../ruleset/body';
import { HEALTH_LEVELS, HIT_OUTCOMES, MORALE_LEVELS, PART_STATES, type MoraleLevel } from '../scales';
import type { AttackOutcome, PartState } from '../types';
import { cap, r1, theOf } from '../words';

const NOTICE_KIND: Record<Notice['kind'], string> = {
  scenario_fallback: 'Scenario planning failed', rate_limited: 'Slow down', stop_play: 'Play stopped',
  read_only: 'Read-only', save_failed: 'Not saved', load_refused: 'Not loaded',
};

const VOLUME_WORD: Record<string, string> = { whisper: 'whispering', normal: '', shout: 'shouting' };
const CHANGE_WORD: Record<string, [string, string]> = { combat: ['Combat', 'c10'], condition: ['Condition', 'c7'], health: ['Health', 'c2'] };
const SPEAKER_COLOURS = ['c15', 'c12', 'c4', 'c5', 'c1', 'c7', 'c14'];
const COMMANDS: [string, string][] = [
  ['/help', 'what you can type, and a recap of the last turns'], ['/stats', 'your character sheet'], ['/inv', 'what you carry'],
  ['/quests', 'your quests'], ['/achievements', 'your achievements and scars'], ['/title', 'wear an achievement as your title'], ['/essence', 'essences on offer and held: take, pass, give, sell or remove one'], ['/yield', 'give up the fight you are in'], ['/stuck', 'the scenario can go nowhere: the story finds a way forward'], ['/strike ', 'a blow at someone: /strike the guard at his left arm'], ['/shoot ', 'shoot at someone, by part if you like'], ['/throw ', 'throw something at someone'], ['/aim ', 'aim this attack at the body part it names: /aim /strike the guard at his leg'], ['/undo', 'rewind one turn (dice are not rolled back)'],
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

/** M-20: how hard each outcome label lands, 0 (no motion) to 4; hits are coloured by whose loss they are */
const OUTCOME_BEAT: Record<AttackOutcome, number> = { missed: 0, dodged: 0, parried: 1, blocked: 1, grazed: 1, full_hit: 2, heavy_hit: 3, crushing_hit: 4 };
/** the outcome label a check line's result starts with ("heavy hit, head" → heavy_hit), if any */
const outcomeOf = (result: string): AttackOutcome | null =>
  HIT_OUTCOMES.keys.find((k) => result.startsWith(outcomeText(k))) ?? null;
type Around = { who: Record<string, string>; head: Record<string, string>; heal: string };

const SLOW_AFTER_S = 90; // past this the waiting line gets a "taking longer than usual" note
const secs = (since: number) => Math.max(0, Math.round((Date.now() - since) / 1000));

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

/** BG-190: the player's last order that the game played out: the newest player line followed by narration, so a
 * clarify ("Continue with what?") or a / command is skipped */
export function lastOrder(lines: readonly LogLine[]): string | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (l.kind !== 'player' || l.text.startsWith('/')) continue;
    if (lines.slice(i + 1).some((x) => x.kind === 'narration')) return l.text;
  }
  return null;
}

/** pointing at someone on Who's here: how far they are, where if not in your zone, and whether your longest weapon in hand
 * reaches them ("34 m away · in the yard · in reach of your shortbow (50 m)"); no distance known, only where */
export function whoDistance(a: PlayerView['actors'][number], pv: PlayerView): string {
  const where = a.zone && a.zone !== pv.zone.id ? `in ${pv.zones.find((z) => z.id === a.zone)?.name ?? a.zone}` : ''; // actors carry zone ids
  if (a.distanceM === undefined) return where ? cap(where) : '';
  const far = pv.player.reaches?.[0];
  const m = (x: number) => (x < 10 ? `${r1(x)} m` : distText(x));
  const reach = !far ? '' : a.distanceM <= far.metres ? `in reach of your ${far.name} (${m(far.metres)})` : `beyond your ${far.name}’s ${m(far.metres)}`;
  return [`${m(a.distanceM)} away`, where, reach].filter(Boolean).join(' · ');
}

/** a clarifying question's phrases the player can tap: people (seen now or earlier), zones and items the view names, matched
 * with or without articles ("the lean man in the patched coat" finds "a lean man in a patched coat"); longest first, never
 * overlapping. Each gives where it sits in the text and the words to answer with (the text's own wording). */
export function clarifyPicks(text: string, pv: PlayerView): { start: number; end: number; phrase: string }[] {
  const ART = '(?:(?:a|an|the)\\s+)?';
  const names = [
    ...pv.actors.flatMap((a) => [a.name, a.label]), ...(pv.lastSeen ?? []).map((x) => x.name),
    ...pv.zones.map((z) => z.name), ...(pv.known ?? []).map((z) => z.name),
    ...pv.player.inventory.map((i) => i.name), ...pv.zone.groundItems.map((i) => i.name),
  ].filter((x): x is string => !!x);
  const words = [...new Set(names.map((n) => n.toLowerCase().replace(/^(a|an|the)\s+/, '').trim()))]
    .filter((n) => n.length >= 3).sort((a, b) => b.length - a.length);
  const out: { start: number; end: number; phrase: string }[] = [];
  for (const n of words) {
    const body = n.split(/\s+/).filter((w) => !/^(a|an|the)$/.test(w)).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(`\\s+${ART}`);
    const re = new RegExp(`\\b${ART}${body}\\b`, 'gi');
    for (const m of text.matchAll(re)) {
      const start = m.index!, end = start + m[0].length;
      if (out.some((o) => start < o.end && end > o.start)) continue;
      out.push({ start, end, phrase: m[0] });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

// AE8: how Ideas offers each perk move against someone in view
const PERK_IDEA: Record<string, { text: (who: string) => string; note: string }> = {
  [PK.dirt_in_the_eyes]: { text: (who) => `Throw dirt in ${who}'s eyes`, note: 'Dirt in the Eyes · free, once a fight' },
  [PK.bluff]: { text: (who) => `Bluff ${who}: "Behind you!"`, note: 'Bluff · free, once per foe a fight' },
};
/** perk moves aimed at no one: one idea each */
const PERK_SOLO_IDEA: Record<string, { text: string; note: string }> = {
  [PK.battle_cry]: { text: 'Let out a battle cry', note: 'Battle Cry · your action, once a fight' },
};

/** an idea's short label as the player would type it: "Talk to Tam" fills the box as "I talk to Tam" (ideas start with a verb) */
export const asI = (label: string) => `I ${label.charAt(0).toLowerCase()}${label.slice(1)}`;

/** the same name twice in one list reads as "the other …" from its second time on */
function apart(names: string[]): string[] {
  const seen = new Set<string>();
  return names.map((n) => { const k = n.toLowerCase(); if (!seen.has(k)) { seen.add(k); return n; } return `the other ${n.replace(/^(a|an|the)\s+/i, '')}`; });
}

/** Ideas (D-107): built by code from PlayerView only, so nothing the character doesn't know can show. Fight and Talk list
 * everyone in view; the other groups show three. */
export function ideas(pv: PlayerView, broken = false, canSteady = false, self?: Personality): { group: string; items: { text: string; note?: string }[] }[] {
  const people = pv.actors.filter((a) => a.level === 'full' && !(a.health && isDownLevel(a.health)));
  const names = apart(people.map((a) => a.name ?? a.label));
  const held = pv.player.inventory.filter((i) => i.equippedIn.some((x) => x.startsWith('grip:')) && i.kind === 'weapon');
  const stowed = pv.player.inventory.filter((i) => !i.equippedIn.length && i.kind === 'weapon');
  const [heldN, stowedN, groundN] = [apart(held.map((i) => i.name)), apart(stowed.map((i) => i.name)), apart(pv.zone.groundItems.map((i) => i.name))];
  const the = (n: string) => (n.startsWith('the other ') ? n : `the ${n}`);
  const groups: { group: string; key: IdeaGroup; items: { text: string; note?: string; kind?: IdeaKind }[]; all?: true }[] = [
    // MB12/BF37: with a broken nerve no walk and no attack can come (fleeing too, for now): you cower, and words still work
    broken ? { group: 'Your nerve is broken · you cower', key: 'getaway', items: [{ text: 'Yield', note: 'ends the fight if they take it', kind: 'yield' },
      { text: 'Hide', note: 'your action', kind: 'hide' }], all: true }
      : { group: 'Fight', key: 'fight', items: [...people.map((a, i) => ({ text: `Attack ${names[i]}`, note: a.health && HEALTH_LEVELS.name(a.health), kind: 'attack' as const })),
        // SY1: in a fight, above Broken and not within its cooldown: one morale roll as your action
        ...(canSteady ? [{ text: 'Steady yourself', note: 'your action · a morale roll', kind: 'steady' as const }] : [])], all: true },
    // TF13/TF17/TF10/TF11: in a fight, ways to talk a foe out of it (a hurt or frightened foe gives in more easily)
    { group: 'Talk', key: 'talk', items: [
      ...(pv.player.standDownOffers ?? []).map((o) => ({ text: `Take ${o.name}'s offer to stop`, note: 'ends your fight with them', kind: 'talk' as const })),
      ...people.flatMap((a, i) => [...(a.talkDown ? [
        { text: `Talk ${names[i]} down`, note: 'your action · Persuasion; easier once they are hurt or scared', kind: 'talk' as const },
        { text: `Lie to ${names[i]} to end it`, note: 'your action · Lying against their Insight', kind: 'talk' as const },
        { text: `Pay ${names[i]} to stop`, note: 'your action · Barter; name the coin, paid if they agree', kind: 'talk' as const },
      ] : [{ text: `Talk to ${names[i]}`, kind: 'talk' as const }]),
        // TF19: a surrender asks more than a stand-down, and counts as beating them
        ...(a.demandYield ? [{ text: `Demand ${names[i]} surrender`, note: 'your action · Persuasion; needs a bigger win; easier once they are hurt, scared, broken or crippled', kind: 'talk' as const }] : [])])], all: true },
    { group: 'Move', key: 'move', items: pv.zone.links.map((l) => ({ text: `Go ${l.label}`, note: l.frontier ? 'new ground' : undefined, kind: l.frontier ? 'go_new' as const : 'go' as const })) },
    // ST3: sneaking is free; hiding takes the action; ST13: a Vanish slips away by a link, out of sight of those who see you
    { group: 'Stealth', key: 'stealth', items: [
      ...(pv.player.posture === 'stealthy'
        ? [{ text: 'Hide', note: 'your action', kind: 'hide' as const }, ...pv.zone.links.filter((l) => !l.frontier).slice(0, 1).map((l) => ({ text: `Sneak ${l.label}`, kind: 'sneak' as const }))]
        : [{ text: 'Sneak', note: 'free', kind: 'sneak' as const }, { text: 'Hide', note: 'your action', kind: 'hide' as const }]),
      ...pv.zone.links.filter((l) => !l.frontier).slice(0, 1).map((l) => ({ text: `Vanish ${l.label}`, note: 'breaks sight', kind: 'vanish' as const }))] },
    { group: 'Use', key: 'use', items: [
      ...heldN.map((n) => ({ text: `Stow ${the(n)}`, note: 'free', kind: 'stow' as const })), ...stowedN.map((n) => ({ text: `Draw ${the(n)}`, note: 'free', kind: 'draw' as const })),
      ...groundN.map((n) => ({ text: `Pick up ${the(n)}`, note: 'free', kind: 'pick_up' as const })), ...(pv.player.summonable ?? []).map((x) => ({ text: `Summon ${x.name}`, note: 'free', kind: 'summon' as const })),
      { text: 'Look around', kind: 'look' }, { text: 'Search', note: 'your action', kind: 'search' }] },
    ...(pv.player.perkMoves?.length ? [{ group: 'Perks', key: 'perks' as const, items: pv.player.perkMoves.flatMap(({ id: p, inRange }) => PERK_SOLO_IDEA[p] ? [PERK_SOLO_IDEA[p]] : PERK_IDEA[p]
      ? people.filter((a) => inRange?.includes(a.id)).map((a) => ({ text: PERK_IDEA[p].text(names[people.indexOf(a)]), note: PERK_IDEA[p].note })) : []) }] : []),
  ];
  // the plain cut first (three ideas a group unless all are listed), then the character's leanings order what is shown
  return leanIdeas(groups.map((g) => ({ ...g, items: g.all ? g.items : g.items.slice(0, 3) })), self)
    .map((g) => ({ group: g.group, items: g.items.map(({ text, note }) => (note ? { text, note } : { text })) }));
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
function partsOf(s: GameState, p: Actor): Record<string, PartState> {
  const parts: Record<string, PartState> = {};
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
  // the fall: the story shakes and drains for a moment before "You fell" slams in (only when it happens in play, not on load)
  let wasFallen: boolean | null = null, dyingUntil = 0, fellKey = '';
  const FALL_MS = () => ms('--m-fall'); // durations come only from the --m-* tokens
  // the story: an append-only list (role=log announces each new entry once); the waiting line sits outside it
  const list = h('div', { class: 'log', role: 'log', 'aria-label': 'Story', tabindex: '0' });
  const waiting = h('p', { class: 'working', role: 'status' });
  // SD1: while a turn that ended a scenario is still running, the ending's rule is drawn here, under the player's line
  const endNow = h('div', { class: 'end-now' });
  let endKey = '', endDrawn = false; // the ending shown in endNow; whether its rule was drawn there, so the turn doesn't draw it again
  const story = h('div', { class: 'story' }, h('div', { class: 'col' }, list, endNow, waiting));
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
  // BG-190: the last order that played out (a clarify or a command doesn't count), offered back to carry on with it
  const againBtn = h('button', { type: 'button', class: 'itm', 'data-chip': 'again', onclick: () => { const o = lastOrder(api.lines()); if (o) pick(o); } }, 'Same again');
  const helpPanel = h('div', { class: 'helps', hidden: true });
  // MB12/BF37: while the player's nerve is broken, Yield comes forward and Aim steps back (no attack can come); no Flee, for now
  const yieldBtn = h('button', { type: 'button', class: 'itm nerve-act', 'data-chip': 'yield', title: 'Give up the fight: it ends if they take it', onclick: () => pick('I yield') }, 'Yield');
  const tools = h('div', { class: 'tools' }, h('div', { class: 'hs-picker' }, cmdBtn, ideaBtn, againBtn), h('div', { class: 'hs-picker' }, yieldBtn, aimBtn, st.sneak, st.hide, st.vanish, healBtn));
  const doingSlot = h('div', { class: 'doing-slot' }); // AT11a: the player's own long action, above the chips
  let doingHtml = '';
  const bar = h('form', { class: 'inbar', onsubmit: (e: Event) => { e.preventDefault(); submit(); } }, h('div', { class: 'inrow' }, input, send), hint, doingSlot, tools);
  const fell = h('div', { class: 'fell', hidden: true });
  const edge = h('div', { class: 'm-edge', 'aria-hidden': 'true' }); // M-33: the red edge when hurt badly
  const nerveEdge = h('div', { class: 'm-edge nerve', 'aria-hidden': 'true' }); // MW1: the violet edge as the nerve gives
  const body = h('div', { class: 'play' }, story, h('div', { class: 'sec col' }, notices, helpPanel, bar));
  // D-226 (M-39): the scenario-end gains panel, over the story while it is open; the action box below stays usable (M-13)
  let gainsVeil: HTMLElement | null = null, afterGains: (() => void) | null = null;
  const title = h('div', { class: 'head' });
  const who = h('div', { class: 'who', 'aria-label': 'Who’s here' });
  // pointing at (or tabbing to) someone shows how far they are at once; one floating tip, outside the row that clips
  const whoTip = h('div', { class: 'who-tip', role: 'tooltip', hidden: true });
  document.body.append(whoTip);
  const showWhoTip = (e: Event) => {
    const t = (e.target as Element).closest?.('.pp[data-dist]') as HTMLElement | null;
    if (!t || !t.dataset.dist) { whoTip.hidden = true; return; }
    const r = t.getBoundingClientRect();
    whoTip.textContent = cap(t.dataset.dist);
    whoTip.hidden = false;
    whoTip.style.top = `${r.bottom + 6}px`;
    whoTip.style.left = `${Math.max(8, Math.min(innerWidth - whoTip.offsetWidth - 8, r.left + r.width / 2 - whoTip.offsetWidth / 2))}px`;
  };
  const hideWhoTip = () => { whoTip.hidden = true; };
  who.addEventListener('pointerover', showWhoTip); who.addEventListener('focusin', showWhoTip);
  who.addEventListener('pointerleave', hideWhoTip); who.addEventListener('focusout', hideWhoTip);
  // layout A with the full sheet open by default at every width, so the screen is always filled (the player can still fold
  // it). Wide and narrow screens each keep their own choice.
  const WIDE = '(min-width: 1280px)';
  const wide = () => typeof matchMedia === 'function' && matchMedia(WIDE).matches;
  const foldKey = () => (wide() ? 'sheetFoldedWide' : 'sheetFoldedNarrow');
  const readFolded = () => { try { return localStorage.getItem(foldKey()) === '1'; } catch { return false; } };
  let folded = readFolded();
  if (typeof matchMedia === 'function') matchMedia(WIDE).addEventListener?.('change', () => { folded = readFolded(); if (el.isConnected) update(); });
  let dealsOpen = false;
  document.addEventListener('click', () => { if (dealsOpen && el.isConnected) { dealsOpen = false; update(); } });
  const sheet = h('aside', { class: 'cs-side', 'aria-label': 'Character sheet' });
  dragScroll(sheet); // no scrollbar: the wheel or a mouse drag scrolls the sheet
  const wrap = h('div', { class: 'play-wrap' }, body, sheet);
  // Watch an agent play: it types each command into the box, then sends it like Send
  const auto = autopilotBar(api, async (text) => {
    input.value = '';
    for (const ch of text) { input.value += ch; await new Promise((r) => setTimeout(r, Math.min(35, 1500 / text.length))); }
    await submit(true);
  }, () => update());
  const el = h('main', { class: 'playmain' }, title, who, auto.el, wrap, fell, edge, nerveEdge);
  /** Who's here sits in the header line, between the place and the switches, while everyone fits there; a crowd drops it
   *  to its own row under the header. It moves only when that changes, so its beats are never restarted. */
  function placeWho() {
    if (!el.isConnected) return;
    const text = title.firstElementChild, tools = title.querySelector('.title-tools');
    const kids = Array.from(who.children);
    if (!text || !tools || !kids.length) return;
    const need = kids.at(-1)!.getBoundingClientRect().right - kids[0].getBoundingClientRect().left;
    const t = text.getBoundingClientRect(), tl = tools.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(title).columnGap) || 0;
    const oneLine = Math.abs(tl.top - t.top) < 2; // the switches haven't wrapped under the title
    const room = tl.left - t.right - 2 * gap;
    const fits = oneLine && need <= room;
    if (fits && (who.parentElement !== title || who.nextElementSibling !== tools)) { who.classList.add('inline'); title.insertBefore(who, tools); }
    else if (!fits && who.parentElement !== el) { who.classList.remove('inline'); el.insertBefore(who, auto.el); }
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => placeWho()).observe(el);
  applyMotion();
  if (typeof matchMedia === 'function') matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => { applyMotion(); if (el.isConnected) update(); });
  // M-12: a click on the story finishes everything still moving
  story.addEventListener('click', () => { if (moving()) finishAll(); });

  // Escape closes whatever is open; PageUp/PageDown scroll the story while the box has focus; Tab takes the suggestion
  document.addEventListener('keydown', (e) => {
    if (!el.isConnected || el.hidden) return;
    if (e.key === 'Escape' && moving()) { finishAll(); return; } // M-12: while something moves, Esc only skips
    if (e.key === 'Escape' && gainsVeil) { closeGains(); return; }
    if (e.key === 'Escape') {
      if (dealsOpen || open) { dealsOpen = false; open = null; update(); }
      else if (suggestion && document.activeElement === input && !input.value) { suggestion = ''; update(); }
    }
    if ((e.key === 'PageUp' || e.key === 'PageDown') && document.activeElement === input) {
      e.preventDefault(); story.scrollBy({ top: (e.key === 'PageUp' ? -0.9 : 0.9) * story.clientHeight });
    }
  });
  // the suggestion is taken by Tab, by Use it, or by clicking (or tapping) the empty box; it lands selected, so typing over
  // it starts afresh and an arrow key keeps it
  const takeSuggestion = () => {
    if (!suggestion || input.value) return;
    input.value = suggestion; suggestion = ''; update();
    input.focus(); input.select();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey && suggestion && !input.value) { e.preventDefault(); takeSuggestion(); }
  });
  input.addEventListener('click', takeSuggestion);
  input.addEventListener('input', () => { if (suggestion) update(); });

  let offered: LogLine | null = null;

  async function submit(byAgent = false) {
    const text = input.value.trim();
    // the gains panel: Enter in an empty box first lands every gain, then closes it (M-12)
    if (!text && gainsVeil && !byAgent) { if (moving()) finishAll(); else closeGains(); return; }
    if (!text || api.busy() || (auto.playing() && !byAgent && !auto.asking())) return;
    if (!byAgent && auto.asking() && !text.startsWith('/')) auto.playedTurn(); // GA15: a turn you play yourself answers the agent's question
    closeGains(true); // sending closes the gains panel at once,
    finishAll(); // M-12: and finishes everything still moving
    const cmd = text.split(/\s+/)[0].toLowerCase();
    open = null;
    // the agent's /inv, /stats or /quests is answered in the story, never by taking the watcher to another page
    if (NAV_COMMANDS[cmd] && text === cmd && !byAgent) { input.value = ''; nav(NAV_COMMANDS[cmd]); return; }
    if (cmd === '/aim' && text === cmd) { aimed = !aimed; input.value = ''; update(); return; }
    input.value = '';
    suggestion = '';
    const wasAimed = aimed || cmd === '/aim';
    aimed = false; // resets after the turn resolves
    await api.submit(text, { aimed: wasAimed });
  }

  /** opens the Character page at its Perks section */
  const seePerks = () => { nav('stats'); setTimeout(() => document.querySelector('.pk')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); };
  const goldCard = (title: string, sub: string, action?: [string, () => void], levelUp = false, series?: string) => h('div', { class: 'perk-new', 'data-levelup': levelUp ? '' : undefined, 'data-series': series }, h('span', { class: 'st', 'aria-hidden': 'true' }, '✦'),
    h('div', {}, title, h('small', {}, sub)), action ? h('button', { type: 'button', class: 'hs-btn-text', onclick: action[1] }, action[0]) : null);

  /** an achievement or scar earned this turn: its name, reward level and what it asks for; a click shows why it was
   * earned, its XP and its rewards in a details pop-up. Scars carry the danger colour and a different mark. */
  const achCard = (a: AchievementNote) => {
    const kind = a.scar ? 'Scar' : 'Achievement';
    const card = h('div', { class: `perk-new ach${a.scar ? ' scar' : ''}`, role: 'button', tabindex: '0', 'data-ach': a.id,
      'aria-label': `${kind}: ${a.name}${a.levelName ? `, tier ${a.levelName}` : ''}. Show why you earned it` },
      h('span', { class: 'st', 'aria-hidden': 'true' }, a.scar ? '✶' : '✦'),
      h('div', { class: 'ach-txt' }, h('span', { class: 'ach-k' }, kind, a.levelName ? h('span', { class: 'ach-lv', title: 'Reward tier: it sets the XP and grows with how hard it is to earn' }, `Tier ${a.levelName}`) : null),
        h('b', { class: 'ach-n' }, a.name), a.earnedAt ? h('small', {}, cap(a.earnedAt)) : null),
      h('span', { class: 'hs-btn-text ach-why', 'aria-hidden': 'true' }, 'Why?'));
    const show = () => {
      if (moving()) return; // M-12: a click while it still arrives only skips (the story's click handler)
      openPop({ title: kind, opener: card, tone: a.scar ? 'danger' : 'scenario-mark', cls: 'ach-pop', body: [
        h('p', { class: 'ach-pop-n' }, h('b', {}, a.name), a.levelName ? h('span', { class: 'ach-lv' }, `Tier ${a.levelName}`) : null),
        a.why ? h('p', { class: 'ach-pop-why' }, a.why) : null,
        h('dl', { class: 'ach-pop-dl' },
          a.earnedAt ? [h('dt', {}, 'Earned at'), h('dd', {}, cap(a.earnedAt))] : null,
          a.xp ? [h('dt', {}, 'XP'), h('dd', {}, `+${a.xp}`)] : null,
          a.rewards?.length ? [h('dt', {}, 'Rewards'), h('dd', {}, h('ul', {}, a.rewards.map((r) => h('li', {}, r))))] : null),
        h('button', { type: 'button', class: 'hs-btn-text', onclick: () => { closePop(); nav('achievements'); } }, a.scar ? 'See all scars' : 'See all achievements'),
      ] });
    };
    card.addEventListener('click', show);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(); } });
    return card;
  };

  // ---- the story list: one cached entry per line, so redraws never rebuild it or close an opened fold
  const entries = new WeakMap<LogLine, HTMLElement>();
  const lineOf = new WeakMap<HTMLElement, LogLine>(); // a turn's element back to its line (the strike card reads it)
  let snap: Record<string, string> | null = null, snapLine: LogLine | null | undefined;
  let changedParts = new Set<string>(); // parts whose state the last turn changed: the body figure opens once
  // motion: the values the screen showed after the last turn landed, and a narration line that just arrived live
  let shownBefore: ShownValues | null = null, fresh: LogLine | null = null, firstLine: LogLine | undefined;
  let sheetHtml = '', whoHtml = '', titleHtml = '';
  // what Who's here, the header and the quick slot showed after the last turn, for their beats (M-36)
  let shownAround: Around | null = null;
  let limit = TURNS_SHOWN;
  const undoneOpen = new Set<number>(); // undone blocks the player unfolded, by the undo line's index
  const markers = new Map<number, HTMLElement>();
  const earlier = h('button', { type: 'button', class: 'hs-btn-text earlier', onclick: () => { limit += TURNS_SHOWN; update(); } });

  /** a roll line: whose roll (the player's own skill, or who rolled against the player), both tiers, the gap and the result */
  const checkLine = (c: NonNullable<LogLine['check']>, by?: string) => h('p', { class: 'check' + (by ? ' in' : '') }, checkIcon(c.kind),
    h('span', { class: 'sk' }, by ? cap(by) : skillName(c.skill)), tierChip(c),
    c.against ? [h('span', { class: 'vs' }, `vs ${c.against.what}`), tierChip(c.against), h('span', { class: 'gap' }, [tierGap(c, c.against), ...(c.shifts ?? [])].join(' · '))] : null,
    h('span', { class: 'res' }, '→ ', ((o) => h('b', { class: o && struck(o) ? 'hit' : '', 'data-o': o ? String(OUTCOME_BEAT[o]) : '0' }, c.result))(outcomeOf(c.result))));

  function results(l: LogLine, s: GameState | null): HTMLElement | null {
    const lib = getLibrary();
    const xp = (s?.player.progression?.xpLog ?? []).filter((a) => a.turn === l.turn && !a.levelUp && a.amount); // BG-199: each award with its source
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
      // MB12: an attack refused because the player's nerve is broken (no roll was made)
      l.nerveRefused ? h('p', { class: 'rrow nerve' }, h('span', { class: 'hs-label' }, 'Nerve'), h('span', {}, 'Your nerve is broken: no walk or attack came, and you cowered where you stand.')) : null,
      // coin gained or lost this turn: "+2 silver" in gold, "−5 copper" in red, so a theft or a price never passes unseen
      l.coin ? h('p', { class: 'rrow coin' }, h('span', { class: 'hs-label' }, 'Coin'), h('b', { class: l.coin > 0 ? 'coin-up' : 'coin-down' }, (l.coin > 0 ? '+' : '−') + coinWords(Math.abs(l.coin)))) : null,
      // AT11a: the long actions seen this turn: going on (time to go), done, broken off or set aside
      actionsRow(l.actions ?? []),
      // what you did at doors, gates and other barriers this turn: tried, opened, locked, picked
      ...(l.ways ?? []).map((w) => row('Way', w)),
      // a skill that went up this turn: "Strike +1" in gold, the same mark as the sheet's ▲ (playtest run 33)
      gains.length ? row('Skills', ...gains.flatMap(([k, n], i) => [i ? ' · ' : '', h('b', { class: 'skill-up', title: 'Went up this turn' }, `▲ ${skillName(k)} +${n}`)])) : null,
      xp.length && s ? row('XP', xp.map((x) => `${x.amount > 0 ? '+' : '−'}${Math.round(Math.abs(x.amount))} ${xpSourceWords(s, x)}`).join(' · ')) : null,
      ...(l.heals ?? []).map(healCard),
      ...(l.wounds ?? []).filter((w) => !working(w.to)).map(woundCard),
      // MB12: the turn the player's nerve broke says what that stops, how it passes and what still works
      l.nerveBroke ? h('div', { class: 'hcard ncard', role: 'status' }, h('span', { class: 'x', 'aria-hidden': 'true' }, '✖'),
        h('div', {}, 'Nerve broken', h('p', { class: 'hl' }, `${NERVE_UNTIL} ${NERVE_PASSES()} ${NERVE_STILL}`))) : null,
      // D-226: the scenario's gains, as one line in the story; it opens the gains panel again, already settled (M-60)
      anyGains(l.scenarioGains) ? h('button', { type: 'button', class: 'perk-new g-recap', onclick: () => openGains(l, 0, false) }, h('span', { class: 'st', 'aria-hidden': 'true' }, '✦'),
        h('span', { class: 'g-recap-t' }, 'What you gained', h('small', {}, gainsSummary(l.scenarioGains))), h('span', { class: 'hs-btn-text', 'aria-hidden': 'true' }, 'Show')) : null,
      ...(l.levelUps ?? []).map((u) => goldCard('Level up', u.classId ? `${lib.classes[u.classId]?.name ?? 'Your class'} reached level ${u.level}` : `A bonus level: you reached level ${u.level}`, ['See perks', seePerks], true)),
      ...(l.achievements ?? []).map(achCard),
      // V2a: milestones a skill crossed on this turn; the card never names the perk
      ...(l.unlocks ?? []).map((u) => goldCard('New perk unlocked', `${skillName(u.skill)} reached ${u.milestone}`, ['See perks', seePerks], false, perkSeries(u.milestone))),
      l.mechanics?.length ? h('details', { class: 'rolls' }, h('summary', {}, h('span', { class: 'hs-label' }, 'Rolls')),
        h('ul', {}, l.mechanics.map((m) => h('li', {}, m)))) : null,
    ].filter(Boolean) as HTMLElement[];
    return kids.length ? h('div', { class: 'results' }, ...kids) : null;
  }

  /** a place or scenario break before a turn's prose: the new place's name, '' for a new scenario in the same place, null for none */
  function breakFor(l: LogLine, prev: LogLine | null): string | null {
    if (!l.place || !prev?.place) return null;
    if (l.place.id !== prev.place.id) return l.place.name;
    return l.scenario !== undefined && prev.scenario !== undefined && l.scenario !== prev.scenario ? '' : null;
  }

  /** SD1: the scenario-ending rule, the ending's name in its middle in that ending's colour, plus the new place when the
   *  turn also moved the player there */
  function endRule(end: ScenarioEndNote, place: string): HTMLElement {
    return h('p', { class: 'pbreak end', 'data-end': end.as }, h('b', {}, cap(end.name)), place ? h('span', {}, ` · ${place}`) : null);
  }

  /** the clarify text with its tappable phrases; a tap fills the box with the order it asks about plus the phrase */
  function clarifyParts(l: LogLine): (Node | string)[] {
    const st = api.state();
    const picks = st ? clarifyPicks(l.text, buildPlayerView(st)) : [];
    const out: (Node | string)[] = [];
    let at = 0;
    for (const p of picks) {
      out.push(l.text.slice(at, p.start), h('button', { type: 'button', class: 'clar-pick', 'data-chip': 'clarify', title: 'Answer with this: fills the box with your order and this. Nothing is sent until Send',
        onclick: () => {
          const all = api.lines(), i = all.indexOf(l);
          const asked = all.slice(0, i < 0 ? all.length : i).reverse().find((x) => x.kind === 'player')?.text ?? '';
          pick(asked ? `${asked} (${p.phrase})` : p.phrase);
        } }, p.phrase));
      at = p.end;
    }
    out.push(l.text.slice(at));
    return out;
  }

  function entry(l: LogLine, s: GameState | null, prev: LogLine | null): HTMLElement {
    let e = entries.get(l);
    if (e) return e;
    if (l.kind === 'player') e = h('p', { class: 'ln-player' }, l.text, l.aimed ? h('span', { class: 'aimed' }, ' · aimed') : null);
    else if (l.kind === 'command' && l.text === UNDONE) e = h('p', { class: 'ln-command' }, `Turn ${l.turn} undone. Dice are not rolled back.`);
    // a command's reply (/stats) marks tagged skills with ✦; on screen it is the sheet's mark, which says Tagged on hover
    else if (l.kind === 'command') e = h('p', { class: 'ln-command' }, ...l.text.split(TAG_MARK).flatMap((x, i) => (i ? [tag(), x] : [x])));
    // a clarifying question: the people, places and things it names can be tapped, to answer with the order again plus that
    else if (l.kind === 'clarify') e = h('p', { class: 'ln-clarify' }, ...clarifyParts(l));
    else if (l.kind !== 'narration') e = h('p', { class: 'ln-' + l.kind }, l.text);
    else e = h('div', { class: 'turn' },
      // SD1: a turn that ended a scenario: the old scenario's closing line, then the ending's rule, then the new scenario's opening
      l.scenarioEnd?.closing ? h('p', { class: 'ln-closing' }, l.scenarioEnd.closing) : null,
      ((b) => l.scenarioEnd ? endRule(l.scenarioEnd, b ?? '') : b === null ? null : h('p', { class: 'pbreak' + (b ? '' : ' scenario') }, b))(breakFor(l, prev)),
      // M-10: each sentence its own span, so the reveal can pace them; the text is unchanged
      h('p', { class: 'ln-narration' }, sentences(l.text).flatMap((t, i) => [i ? ' ' : '', h('span', { class: 'sn' }, t)])),
      l.speech?.length ? h('div', { class: 'speech' }, l.speech.flatMap((sp) => [
        h('p', { class: 'who2', style: `color:var(--${colourOf(sp.speaker)})` }, sp.speaker.toLowerCase() === 'player' ? 'You' : cap(sp.speaker),
          VOLUME_WORD[sp.volume] ? h('span', { class: 'how' }, VOLUME_WORD[sp.volume]) : null),
        h('p', { class: 'said' }, ...spoken(sp.text, sp.volume))])) : null,
      l.timePassed ? timePassedRow(l.timePassed) : null, // T2 b
      results(l, s));
    // the list is the live region: inner status roles would announce the same words twice
    e.querySelectorAll('[role="status"]').forEach((x) => x.removeAttribute('role'));
    entries.set(l, e);
    lineOf.set(e, l);
    return e;
  }

  function renderStory(lines: LogLine[], s: GameState | null) {
    // a new narration line: the body parts it changed, by comparing the sheet before and after (opens the body figure once)
    const lastNarr = [...lines].reverse().find((l) => l.kind === 'narration') ?? null;
    if (s && !api.busy()) {
      const cur = partsOf(s, s.player);
      if (snap && snapLine !== undefined && lastNarr && lastNarr !== snapLine) {
        changedParts = new Set(Object.keys(cur).filter((k) => snap![k] && snap![k] !== cur[k]));
        fresh = lastNarr; // M-61: only this newest live turn animates
      }
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
    let prevNarr: LogLine | null = null; // the last narration not undone, for place and scenario breaks
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
    if (playDraft.text) { input.value = playDraft.text; playDraft.text = null; suggestion = ''; setTimeout(() => input.focus()); } // a draft from another page (Inventory's Take out)
    const s = api.state();
    // M-06: while a turn runs, the header, Who's here and the sheet keep showing what they showed before it
    const frozen = api.busy() && title.childElementCount > 0;
    const pv = s ? safe(() => buildPlayerView(s)) : null;
    const stealthy = s?.player.posture === 'stealthy';
    bar.classList.toggle('stealthy', stealthy);
    const lines = api.lines();
    // PM5/K1 c: the player's deals with NPCs, as an "N deals" chip beside the scenario title that opens the list
    const deals = pv?.agreements ?? [];
    if (!deals.length) dealsOpen = false;
    const dealChip = deals.length ? h('span', { class: 'dl-wrap' },
      h('button', { type: 'button', class: 'dl-chip', 'aria-expanded': String(dealsOpen), onclick: (e: Event) => { e.stopPropagation(); dealsOpen = !dealsOpen; update(); } },
        dealIcon(), `${deals.length} deal${deals.length === 1 ? '' : 's'}`),
      dealsOpen ? h('section', { class: 'dl-pop', 'aria-label': 'Your deals', onclick: (e: Event) => e.stopPropagation() },
        h('p', { class: 'hs-section' }, 'Your deals'),
        deals.map((d) => h('div', { class: 'dl-row' }, h('b', {}, cap(d.with)), h('span', {}, d.text), h('small', {}, `Made turn ${d.madeTurn}`)))) : null) : null;
    // UI6: "Show rolls" sets the story's own showMechanics; every turn keeps its rolls, so the switch shows or hides them all, past turns too
    const show = !!(s?.settings.showMechanics ?? CONFIG.SHOW_ROLLS_DEFAULT);
    const rollsBtn = s && CONFIG.SHOW_MECHANICS ? h('button', { type: 'button', class: 'hs-btn-text rolls-sw', 'aria-pressed': String(show),
      title: show ? 'Rolls show under each turn. Click to hide them' : 'Click to show the dice and modifiers under each turn',
      onclick: () => { s.settings.showMechanics = !show; update(); } }, show ? '✓ Show rolls' : 'Show rolls') : null;
    // M-72: the Motion switch, kept per viewer; it starts from the system's reduced-motion setting
    const mOn = motionOn();
    const motionBtn = h('button', { type: 'button', class: 'hs-btn-text rolls-sw', 'aria-pressed': String(mOn),
      title: mOn ? 'Values animate when they change. Click to turn motion off' : 'Values change without moving. Click to turn motion on',
      onclick: () => { setMotion(!mOn); update(); } }, mOn ? '✓ Motion' : 'Motion');
    // the header names the last turn played, the one the last results row shows
    const lastTurn = [...lines].reverse().find((l) => l.kind === 'narration')?.turn ?? s?.turn;
    // data-mh names the header pieces that get a beat when they change (M-36); the place line changes quietly (M-41)
    const mh = <T extends Element | null>(key: string, x: T): T => { x?.setAttribute('data-mh', key); return x; };
    // the agent button is one live element: a stand-in copy is compared, so a header that isn't redrawn keeps the real one
    const openerSlot = s ? auto.opener.cloneNode(true) as HTMLElement : null;
    const titleKids = [h('div', {}, h('h1', {}, s?.meta.title ?? 'Play', mh('tod', s ? todBadge(timeView(s).day, timeOfDay(now(s))) : null), mh('stealth', stealthy ? stealthBadge() : null), mh('deals', dealChip)),
      h('p', {}, s ? [`Turn ${lastTurn}`, ...placeLine(s, pv)] : 'No story yet'), mh('quest', s ? questLine(s, (id) => { questFocus.id = id; nav('quests'); }) : null)), h('div', { class: 'title-tools' }, openerSlot ?? '', rollsBtn ?? '', motionBtn)];
    const titleNow = titleKids.map((k) => k.outerHTML).join('');
    if (!frozen && titleNow !== titleHtml) { openerSlot?.replaceWith(auto.opener); title.replaceChildren(...titleKids); titleHtml = titleNow; }
    story.classList.toggle('no-rolls', !show);

    // who's here: one fixed-height row; only actors the character fully perceives (PlayerView); others' health from Wounded down
    const seen = pv?.actors.filter((a) => a.level === 'full') ?? [];
    const whoKids = [h('span', { class: 'hs-label' }, 'Who’s here'), ...(seen.length ? seen.map((a) => h('span', { class: 'pp', 'data-who': cap(a.name ?? a.label), tabindex: '0', 'data-dist': [whoDistance(a, pv!), a.age ? `looks ${a.age.toLowerCase()}` : ''].filter(Boolean).join(' · ') }, // pointing shows how far they are and if your weapon reaches; AG16: the life stage they look
      h('b', {}, cap(a.name ?? a.label)), // the name (BG-30's edit had put it inside the comment, so the row lost every name)
      a.health ? h('span', { class: isDownLevel(a.health) ? 'st down' : 'st warn' }, othersHealthWord(a.health, a.level === 'full'))
        : a.activityLook ? h('span', { class: 'st' }, a.activityLook) : null,
      // AT11a: a long action they are at, and how long is left
      a.doing ? doingChip(a.doing) : null,
      // MB16: others' morale, only from Afraid down
      a.morale ? h('span', { class: 'st fear' }, a.morale) : null,
      // FT17: others' fatigue, only from Exhausted down, as the level word (never points or the breath line)
      a.fatigue ? h('span', { class: 'st tired', 'data-st': 'fatigue', title: 'How worn out they look' }, a.fatigue) : null,
      // A13 Read Wounds: a foe's Damaged parts
      ...(a.damaged ?? []).map((pt) => h('span', { class: 'st warn', title: 'Read Wounds' }, `${partName(pt).toLowerCase()} damaged`)))) : [h('span', { class: 'hs-note' }, 'Nobody in view')])];
    // a redraw that changes nothing keeps the old elements, so nothing restarts (M-74)
    const whoNow = whoKids.map((k) => k.outerHTML).join('');
    if (!frozen && whoNow !== whoHtml) { who.replaceChildren(...whoKids); whoHtml = whoNow; }
    placeWho();

    // Q16: what the player put off last turn is offered as a dimmed suggestion; nothing is typed or sent until they take it
    const nextLine = lines.at(-1);
    if (nextLine?.next && nextLine !== offered && !api.busy()) { suggestion = nextLine.next; offered = nextLine; }
    const offering = !!suggestion && !input.value;
    input.placeholder = offering ? suggestion : PLACEHOLDER;
    input.classList.toggle('suggest', offering);
    const hintNow = offering ? 'offer' : '';
    if (hint.dataset.now !== hintNow) {
      hint.dataset.now = hintNow;
      hint.replaceChildren(...(offering ? ['From last turn · click it or Tab to use, Esc to clear ',
        h('button', { type: 'button', class: 'hs-btn-text in-use', 'data-chip': 'use-suggestion', onclick: takeSuggestion }, 'Use it'),
        h('button', { type: 'button', class: 'hs-btn-text in-clear', 'data-chip': 'clear-suggestion', onclick: () => { suggestion = ''; update(); input.focus(); } }, 'Clear')] : []));
    }

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
    // SD1: the ending moment starts as soon as the engine knows the scenario ended, while the next scenario is still being
    // made: the rule draws across, without the outcome. The closing line and the opening come with the turn's prose.
    const ending = busy ? api.scenarioEnding?.() ?? null : null;
    const key = ending ? `${ending.as}|${ending.name}` : '';
    if (key !== endKey) {
      endKey = key;
      if (!ending) endNow.replaceChildren();
      else {
        // how it ended (Resolved, Lost…) is the gains moment's reveal, so while the turn runs the rule names no outcome;
        // the turn's own break (or the pop-up) names it when the turn lands
        const r = h('p', { class: 'pbreak end-wait' }, h('b', {}, 'The scenario draws to a close'));
        endNow.replaceChildren(r);
        drawBreak(r, 0);
        endDrawn = false;
      }
    }

    helpPanel.hidden = !open;
    cmdBtn.setAttribute('aria-pressed', String(open === 'commands'));
    ideaBtn.setAttribute('aria-pressed', String(open === 'ideas'));
    const head = (t: string) => h('div', { class: 'helps-h' }, h('p', { class: 'hs-section' }, t),
      h('button', { class: 'hs-btn-text', type: 'button', onclick: () => { open = null; update(); } }, 'Close ×'));
    if (open === 'commands') helpPanel.replaceChildren(head('Commands · no time passes'),
      h('ul', { class: 'cmds' }, COMMANDS.map(([c, what]) => h('li', {}, h('button', { type: 'button', onclick: () => pick(c) }, h('b', {}, c.trim()), h('span', {}, what))))),
      h('p', { class: 'hs-note' }, 'Picking one fills the box; nothing is sent until you press Send.'));
    else if (open === 'ideas') helpPanel.replaceChildren(head('Ideas · from what you can see now'),
      h('div', { class: 'idea-groups' }, (pv ? ideas(pv, !!s && moraleLevel(s.player) === 'broken', !!s && cantSteady(s, s.player) === null, s ? personalityOf(s.player) : undefined) : []).map((g) => h('div', {}, h('p', { class: 'hs-label' }, g.group),
        g.items.length ? h('ul', {}, g.items.map((it) => h('li', {}, h('button', { type: 'button', onclick: () => pick(asI(it.text)) }, it.text, it.note ? h('span', {}, it.note) : null))))
          : h('p', { class: 'hs-note' }, 'Nothing right now')))),
      h('p', { class: 'hs-note' }, 'Built by code from what your character can see and carries, ordered by their personality, refreshed every turn. Picking one fills the box; nothing is sent until you press Send.'));
    if (stick || busy) story.scrollTop = story.scrollHeight;
    // 2.5: a new essence offer opens its pop-up once, when no turn is running (Take it / Let it go / Decide later)
    if (!busy && !auto.playing()) maybeOfferPop(api, s, update);

    const ns = api.notices();
    notices.replaceChildren(...ns.map((n) => h('div', { class: 'hs-hl ' + (n.kind === 'stop_play' || n.kind === 'save_failed' ? 'bad' : 'ask'), role: 'status' },
      h('span', { class: 'hs-hl-b', 'data-kind': NOTICE_KIND[n.kind] }, n.text))));
    const stopped = ns.some((n) => n.kind === 'stop_play' || n.kind === 'read_only');
    input.disabled = stopped || busy || (auto.playing() && !auto.asking()); // the autopilot has the box while it plays, unless it asks you
    send.disabled = stopped || busy || (auto.playing() && !auto.asking());
    auto.update();
    aimBtn.disabled = stopped;
    const broken = !!s && moraleLevel(s.player) === 'broken';
    yieldBtn.hidden = !broken; aimBtn.hidden = broken;
    yieldBtn.disabled = stopped;
    // AT11a: the player's own long action, and AT49 its walk on the way; a redraw that changes nothing keeps the element (M-74)
    if (!frozen) { const dn = [doingNow(pv?.player.doing, pick, stopped), pv?.player.following ? followingNow(pv.player.following, pv.player.walking, pick, stopped) : walkingNow(pv?.player.walking, pick, stopped)].filter((x): x is HTMLElement => !!x); const html = dn.map((x) => x.outerHTML).join(''); if (html !== doingHtml) { doingSlot.replaceChildren(...dn); doingHtml = html; } }
    st.set(stealthy, stopped);
    // OQ-24 (decided): the action box keeps focus; it comes back after a turn re-enables it
    if (!input.disabled && !el.hidden && el.isConnected && (document.activeElement === document.body || document.activeElement === send)) input.focus();
    aimBtn.setAttribute('aria-pressed', String(aimed));
    aimBtn.title = aimed ? 'This turn’s attack is aimed. Click to stop aiming' : 'Click to aim this turn’s attack (same as /aim)';
    aimBtn.textContent = aimed ? 'Aimed' : 'Aim';
    // H3 b: one quick slot for a healing item; it fills the box, nothing is sent until Send
    const qh = s ? quickHeal(s, s.player) : null;
    healBtn.hidden = !qh;
    const again = lastOrder(api.lines());
    againBtn.disabled = stopped || !again;
    againBtn.title = again ? `Fills the box with your last order: “${again}”. Nothing is sent until Send` : 'No order yet to repeat';
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
    const sheetKids: HTMLElement[] = [];
    if (s && folded) sheetKids.push(h('button', { type: 'button', class: 'cs-strip', 'aria-expanded': 'false', title: 'Open your full sheet', onclick: () => setFolded(false) },
      h('span', { class: 'hs-label' }, 'Your sheet ›'), ...statusStrip(s, s.player), stealthy ? h('span', { class: 'cs-stl' }, 'Stealthy') : null));
    else sheetKids.push(h('div', { class: 'cs-side-h' }, h('p', { class: 'hs-section' }, 'Your sheet'),
      h('button', { class: 'hs-btn-text', type: 'button', 'aria-expanded': 'true', onclick: () => setFolded(true) }, 'Close ×')),
      ...(s ? sideSheet(s, s.player, [...lines].reverse().find((l) => l.kind === 'narration'), changedParts) : []));
    const sheetNow = sheetKids.map((k) => k.outerHTML).join('');
    if (!frozen && sheetNow !== sheetHtml) { sheet.replaceChildren(...sheetKids); sheetHtml = sheetNow; }

    const fallen = api.fell();
    const calm = !motionOn();
    if (wasFallen === false && fallen && !calm) { finishAll(); dyingUntil = Date.now() + FALL_MS(); setTimeout(update, FALL_MS() + 20); }
    wasFallen = fallen;
    const dying = fallen && Date.now() < dyingUntil;
    el.classList.toggle('dying', dying);
    wrap.hidden = fallen && !dying;
    who.hidden = fallen && !dying;
    fell.hidden = !fallen || dying;
    if (!fallen) fellKey = '';
    else if (!dying) {
      const last = [...lines].reverse().find((l) => l.kind === 'narration');
      const downed = [...lines].reverse().find((l) => l.downedBy)?.downedBy;
      const key = `${last?.turn ?? 0}|${confirmReset}`;
      if (key !== fellKey) {
        fell.classList.toggle('enter', !fellKey); // the entrance plays once, not again when Reset asks to confirm
        fellKey = key;
        fell.replaceChildren(
          h('h2', {}, 'You fell'),
          h('p', { class: 'fell-cause' }, fellLine(downed, last?.turn ?? 0)),
          fellFacts(downed) ? h('p', { class: 'hs-note fell-facts' }, fellFacts(downed)) : '',
          h('p', { class: 'hs-note fell-how' }, 'Rewind one turn, or start a new story.'),
          h('div', { class: 'confirm' },
            h('button', { class: 'hs-btn-main', type: 'button', onclick: () => api.submit('/undo', { aimed: false }) }, 'Undo one turn'),
            confirmReset
              ? [h('span', { class: 'hs-note' }, 'Start over? This story ends and you make a new character.'),
                 h('button', { class: 'hs-btn-text danger', type: 'button', onclick: async () => { confirmReset = false; await api.reset(); } }, 'Reset the story'),
                 h('button', { class: 'hs-btn-text', type: 'button', onclick: () => { confirmReset = false; update(); } }, 'Keep it')]
              : h('button', { class: 'hs-btn-text danger', type: 'button', onclick: () => { confirmReset = true; update(); } }, 'Reset')));
      }
    }
    // motion: the newest live turn animates from what the screen showed before it (M-61, M-74); everything else lands as is
    if (s && !api.busy()) {
      const after = shownValues(s, s.player);
      if (lines[0] !== firstLine) { if (firstLine !== undefined) shownBefore = null; firstLine = lines[0]; } // a new story: no "before"
      const readOnly = ns.some((n) => n.kind === 'read_only');
      const around = aroundNow();
      if (fresh && !fallen && !readOnly) animateTurn(entries.get(fresh), shownBefore, after, shownAround, around, anyGains(fresh.scenarioGains) ? fresh : undefined);
      shownBefore = after; shownAround = around;
      el.classList.toggle('crit', HEALTH_LEVELS.pos(after.level) >= HEALTH_LEVELS.pos(CONFIG.MOTION_EDGE_STEADY) && !fallen);
      el.classList.toggle('nerve', MORALE_LEVELS.pos(after.moraleKey) >= MORALE_LEVELS.pos(CONFIG.MOTION_NERVE_STEADY) && !fallen); // MW1/MW2
    }
    fresh = null;
  }

  /** Who's here (by the name shown, with its status words), the header's marked pieces and the quick slot, as shown now */
  function aroundNow(): Around {
    const text = (x: Element) => (x.textContent ?? '').trim();
    return {
      who: Object.fromEntries(Array.from(who.querySelectorAll('[data-who]')).map((x) => [x.getAttribute('data-who')!, text(x)])),
      head: Object.fromEntries(Array.from(title.querySelectorAll('[data-mh]')).map((x) => [x.getAttribute('data-mh')!, x.getAttribute('data-mh') === 'tod' ? x.outerHTML : text(x)])),
      heal: healBtn.hidden ? '' : text(healBtn),
    };
  }

  /** M-40: a break's rule draws outward from its name; returns how long the prose waits for it */
  function drawBreak(brk: Element, delay: number): number {
    if (!motionOn()) return 0;
    const d = ms('--m-scenario');
    play(brk, [{ opacity: 0 }, { opacity: 1 }], { dur: d / 2, delay });
    play(brk, [{ transform: 'scaleX(0)', transformOrigin: 'right' }, { transform: 'scaleX(1)', transformOrigin: 'right' }], { dur: d, delay, pseudo: '::before' });
    play(brk, [{ transform: 'scaleX(0)', transformOrigin: 'left' }, { transform: 'scaleX(1)', transformOrigin: 'left' }], { dur: d, delay, pseudo: '::after' });
    return d * 0.6;
  }

  /** M-10–M-38: one live turn's motion, all on top of the final state. Prose sentence by sentence, then its results row by
   * row, then the sheet in the order health, body parts, morale, skills, XP and level, coin, then gold cards. */
  function animateTurn(e: HTMLElement | undefined, b: ShownValues | null, a: ShownValues, ab: Around | null, aa: Around, gainsLine?: LogLine) {
    finishAll();
    if (!e) return;
    const on = motionOn();
    let t = 0;
    // a turn with a gains panel opens it at once: the panel carries the ending and its closing line itself
    if (on && !gainsLine) {
      // SD1: the old scenario's closing line comes first; the ending's rule was already drawn while the turn ran, so it stays put
      const closing = e.querySelector('.ln-closing');
      if (closing) { play(closing, [{ opacity: 0 }, { opacity: 1 }], { dur: ms('--m-state') }); t += ms('--m-state'); }
      // M-40/M-42: a scenario or place break draws across first, outward from its name
      const brk = e.querySelector('.pbreak');
      if (brk && !(brk.classList.contains('end') && endDrawn)) t += drawBreak(brk, t);
    }
    endDrawn = false;
    // D-226 (M-39): a scenario that gave something opens its gains panel between the old scenario's close and the new one's
    // opening; the rest of the turn plays when the panel closes
    if (gainsLine) { openGains(gainsLine, t, on, () => { if (motionOn()) turnRest(e, b, a, ab, aa, ms('--m-state') * 0.7); }); return; }
    if (on) turnRest(e, b, a, ab, aa, t);
  }

  /** the gains panel: live plays its moment from t0, otherwise it opens settled (motion off, or reopened from the story) */
  function openGains(l: LogLine, t0: number, live: boolean, then?: () => void) {
    closeGains(true);
    const g = l.scenarioGains;
    if (!anyGains(g)) return;
    const v = gainsPanel(g, { end: l.scenarioEnd, achCard, onContinue: () => closeGains() });
    // M-12: while it still moves, a click anywhere on it only lands every gain
    v.addEventListener('click', (e) => { if (moving()) { finishAll(); e.stopPropagation(); e.preventDefault(); } }, true);
    body.append(v);
    gainsVeil = v; afterGains = then ?? null;
    if (live) playGains(v, g, t0);
  }
  /** closes the gains panel (exits are quicker, M-51) and lets the rest of the turn play; now: at once, with no exit */
  function closeGains(now = false) {
    const v = gainsVeil;
    if (!v) return;
    gainsVeil = null;
    const then = afterGains;
    afterGains = null;
    finishAll();
    const exit = ms('--m-state') * 0.7;
    if (now || !motionOn()) v.remove();
    else play(v, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(6px)' }], { dur: exit, exit: true, done: () => v.remove() });
    then?.();
    if (!input.disabled) input.focus();
  }

  /** the strike card: when the player's own blow lands, a card rises over the story
   * with the outcome, the weapon and where it struck, and what the player saw it change ("The slime is Wounded"). Tiers by
   * outcome (game-feel GF-01): a graze only arrives; a full hit draws the slash; a heavy or crushing hit adds the
   * hit-stop on the word and a short shake of the card (never the story text, never the input). One fixed life,
   * --m-strike, whatever the turn held (M-03); any skip (M-12) ends it at once with the card gone, the state a skip leaves
   * (M-73). It repeats the results row, so it is hidden from screen readers (the row carries the words, M-34). */
  function strikeCard(c: NonNullable<LogLine['check']>, d: number) {
    const o = outcomeOf(c.result), k = c.strike;
    if (!o || !struck(o) || !k || !motionOn()) return;
    const beat = OUTCOME_BEAT[o], where = c.result.split(', ').slice(1).join(', ');
    const target = theOf(k.target);
    const card = h('div', { class: `strike t${beat}`, 'aria-hidden': 'true', 'data-o': o },
      beat >= 2 ? h('span', { class: 'sk-slash' }) : null,
      h('p', { class: 'sk-out' }, cap(outcomeText(o))),
      h('p', { class: 'sk-where' }, [k.weapon ? `Your ${k.weapon.toLowerCase()}` : 'Your blow', `${target}${where ? `’s ${where}` : ''}`].join(' · ')),
      k.changes.length ? h('p', { class: 'sk-chg' }, k.changes.map(cap).join(' · ')) : null);
    later(() => {
      body.querySelectorAll('.strike').forEach((x) => x.remove());
      body.append(card);
      const life = ms('--m-strike'), enter = ms('--m-state') / life, leave = 1 - ms('--m-feedback') * 2 / life;
      play(card, [{ opacity: 0, transform: 'translateY(10px) scale(.96)' }, { opacity: 1, transform: 'none', offset: enter, easing: 'linear' }, { opacity: 1, transform: 'none', offset: leave, easing: 'cubic-bezier(0.4, 0, 1, 1)' }, { opacity: 0, transform: 'translateY(-6px)' }],
        { dur: life, done: () => card.remove() });
      const slash = card.querySelector('.sk-slash');
      if (slash) play(slash, [{ transform: 'rotate(-14deg) scaleX(0)', opacity: 1 }, { transform: 'rotate(-14deg) scaleX(1)', opacity: 1, offset: 0.35 }, { transform: 'rotate(-14deg) scaleX(1)', opacity: 0 }], { dur: ms('--m-trail'), delay: ms('--m-feedback') });
      const word = card.querySelector('.sk-out');
      if (beat >= 3) { impact(word, ms('--m-feedback')); shake([card], beat >= 4 ? 1 : 0.6, ms('--m-feedback') + ms('--m-hold')); }
      else if (beat === 2) pulse(word, ms('--m-feedback'), 2);
    }, d);
  }

  /** the turn after its opening: the prose, its results, the sheet and the gold cards, from t */
  function turnRest(e: HTMLElement, b: ShownValues | null, a: ShownValues, ab: Around | null, aa: Around, t: number) {
    // M-10/M-11: the prose, sentence by sentence (opacity only: a sentence is inline text), then what was said and the time row
    const gap = ms('--m-sentence'), fade = ms('--m-state');
    const parts = Array.from(e.querySelectorAll('.ln-narration .sn'));
    const extra = Array.from(e.querySelectorAll(':scope > .speech, :scope > .tpass, :scope > .time-passed'));
    const span = Math.max(0, Math.min(gap * (parts.length + extra.length - 1), ms('--m-reveal-cap') - fade));
    const each = parts.length + extra.length > 1 ? span / (parts.length + extra.length - 1) : 0;
    parts.forEach((x, i) => play(x, [{ opacity: 0 }, { opacity: 1 }], { dur: fade, delay: t + each * i }));
    extra.forEach((x, i) => arrive(x, t + each * (parts.length + i)));
    t += span + fade;
    // M-21: the results under the prose, top to bottom, then the sheet, then gold cards; past the cap the rest lands at once
    const stagger = ms('--m-stagger'), end = t + ms('--m-results-cap');
    const at = (step: number) => { const now = Math.min(t, end); t += step; return now; };
    const rows = Array.from(e.querySelectorAll(':scope > .results > *'));
    const gold = rows.filter((x) => x.classList.contains('perk-new'));
    for (const r of rows.filter((x) => !gold.includes(x))) {
      const d = at(stagger / 2);
      arrive(r, d);
      // M-20: the outcome word's beat, by severity
      const w = r.querySelector('.res b'), o = Number(w?.getAttribute('data-o') ?? 0);
      // the player's own blow that landed: the strike card over the story, at this row's beat
      if (r.classList.contains('check') && !r.classList.contains('in')) { const c = lineOf.get(e)?.check; if (c?.strike) strikeCard(c, d + fade); }
      if (w && o === 1) play(w, [{ opacity: 0 }, { opacity: 1 }], { dur: ms('--m-beat'), delay: d + fade });
      else if (w && o === 4 && r.classList.contains('in')) {
        // a crushing hit on the player (game-feel T3): the word holds its struck pose, then the story and the sheet
        // shake once (3 px, gone within --m-shake) and the screen edge flares red once. The input bar never moves.
        impact(w, d + fade);
        shake([story, sheet], 1, d + fade + ms('--m-hold'));
        play(edge, [{ opacity: 0 }, { opacity: 0.8, offset: 0.2 }, { opacity: 0 }], { dur: ms('--m-trail'), delay: d + fade + ms('--m-hold') });
      } else if (w && o > 1) {
        pulse(w, d + fade, o - 1, o > 2);
        if (o === 3 && r.classList.contains('in')) shake([story, sheet], 0.6, d + fade); // a heavy hit on the player: about 1 px
      }
      // coin that changed hands: its amount flares in its colour and pulses once (lost coin flares red, like a wound card)
      if (r.classList.contains('coin')) { const c = r.querySelector<HTMLElement>('b'); flare(c, 'color', c?.classList.contains('coin-down') ? 'var(--danger)' : 'var(--scenario-mark)', d + fade); pulse(c, d + fade, 2); }
      // a part that became Crippled or Destroyed: its card flares red, holds, and settles, with no growth that moves its text
      if (r.classList.contains('wcard')) { flare(r as HTMLElement, 'backgroundColor', 'color-mix(in srgb, var(--danger) 45%, transparent)', d + fade); pulse(r, d + fade, 1); }
      // MW2: the "Nerve broken" card lands like a wound card, in the morale violet
      if (r.classList.contains('ncard')) { flare(r as HTMLElement, 'backgroundColor', 'color-mix(in srgb, var(--c5) 45%, transparent)', d + fade); pulse(r, d + fade, 1); }
    }
    if (b) sheetBeats(b, a, at, stagger);
    if (ab) aroundBeats(ab, aa, Math.min(t, end));
    let pointsAt: number | null = null;
    for (const g of gold) {
      const d = at(stagger);
      if (g.classList.contains('ach') || g.hasAttribute('data-levelup')) { const n = honor(g as HTMLElement, d); t += n; if (pointsAt === null && g.hasAttribute('data-levelup')) pointsAt = d + fade; continue; }
      arrive(g, d, 6); pulse(g.querySelector('.st'), d + fade, 2);
    }
    // M-38: the rail's perk-point badge lands with the level-up card that gave the point, never before it
    if (b && a.points !== b.points) pointsBeat(b.points, a.points, pointsAt ?? at(stagger));
  }

  /** the rail's ✦n badge (it lives outside the Play screen): a new badge fades in, a changed count swaps at its beat */
  function pointsBeat(from: number, to: number, d: number) {
    const badge = document.querySelector<HTMLElement>('.game-rail [data-m="points"]');
    if (!badge || to <= 0) return;
    if (from > 0) { stamp(badge, d, `✦${from}`); pulse(badge, d + ms('--m-beat')); }
    else { arrive(badge, d, 0); pulse(badge, d + ms('--m-state'), 2); }
  }

  /** MW1–MW3: the nerve's warning. Worsening into MOTION_NERVE_FROM or worse flares the violet edge once; from
   * MOTION_NERVE_STEADY it settles to the steady tint (the class 'nerve' holds it). Breaking adds one beat on the track and
   * on the U3 "until" words. Climbing back out of the steady tint fades it with no beat (colour carries direction, M-30).
   * Where the red health edge shows, the violet one stays out (red wins); reduced motion leaves only the tint (M-72). */
  function nerveBeats(from: MoraleLevel, to: MoraleLevel, d: number, red: boolean) {
    const pos = (k: MoraleLevel) => MORALE_LEVELS.pos(k), steadyAt = pos(CONFIG.MOTION_NERVE_STEADY);
    if (pos(to) > pos(from)) {
      if (to === 'broken') { pulse(sheet.querySelector('[data-m="morale-track"]'), d + ms('--m-count'), 2); arrive(sheet.querySelector('[data-m="morale-until"]'), d + ms('--m-count')); }
      if (red || pos(to) < pos(CONFIG.MOTION_NERVE_FROM)) return;
      play(nerveEdge, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: pos(to) >= steadyAt ? 0.45 : 0 }], { dur: ms('--m-scenario'), delay: d });
    } else if (pos(from) >= steadyAt && pos(to) < steadyAt) {
      play(nerveEdge, [{ opacity: 0.45 }, { opacity: 0 }], { dur: ms('--m-state'), delay: d, exit: true });
    }
  }

  /** M-30–M-38: the sheet's beats, each on its own element; a value animates only if it changed */
  function sheetBeats(b: ShownValues, a: ShownValues, at: (step: number) => number, stagger: number) {
    const q = (sel: string, root: ParentNode = sheet) => root.querySelector<HTMLElement>(sel);
    const num = (n: number) => String(+n.toFixed(2));
    const whole = (n: number) => String(Math.round(n)); // while counting; the final text keeps its fractions
    const sign = (n: number, f: (x: number) => string = num) => (n > 0 ? '+' : '−') + f(Math.abs(n));
    let redEdge = false; // the red health edge flared this turn: the violet one stays out of its way (MW1)
    // health: the number counts, the bar leaves a trail, a new level word lands; Wounded or worse pulses the edge once
    if (a.hp !== b.hp || a.level !== b.level || a.hpFill !== b.hpFill) {
      const d = at(stagger);
      if (a.hp !== null && b.hp !== null && a.hp !== b.hp) {
        count(q('[data-m="hp"]'), b.hp, a.hp, whole, d);
        delta(q('[data-m="hp"]'), sign(a.hp - b.hp), a.hp < b.hp ? 'danger' : 'ok', d);
      }
      barMove(q('[data-m="hp-track"]'), q('[data-m="hp-track"] > b'), b.hpFill, a.hpFill, d);
      if (a.level !== b.level) {
        stamp(q('[data-m="hp-level"]'), d, HEALTH_LEVELS.name(b.level));
        const at = HEALTH_LEVELS.pos(a.level);
        if (at > HEALTH_LEVELS.pos(b.level) && at >= HEALTH_LEVELS.pos(CONFIG.MOTION_EDGE_FROM)) {
          const steady = at >= HEALTH_LEVELS.pos(CONFIG.MOTION_EDGE_STEADY);
          play(edge, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: steady ? 0.45 : 0 }], { dur: ms('--m-scenario'), delay: d });
          redEdge = true;
        }
      }
    }
    // body parts: the chip lands (hard when worse), the figure's part and the turn's card pulse once
    const changed = Object.keys(a.parts).filter((k) => b.parts[k] !== undefined && a.parts[k] !== b.parts[k]);
    if (changed.length) {
      const d = at(stagger);
      for (const k of changed) {
        const worse = PART_STATES.pos(a.parts[k]) > PART_STATES.pos(b.parts[k]);
        const chip = q(`.cs-pchip[data-part="${k}"]`);
        if (worse) slam(chip, d); else pulse(chip, d);
        // the figure keeps the part's old colour until this beat, then turns and dips once (M-30, M-74: the new
        // colour is already set; the old one is only the animation's first frame)
        const path = q(`path[data-part="${k}"]`);
        if (path) {
          const cls = path.getAttribute('class') ?? '';
          path.setAttribute('class', cls.replace(/\bbf-\w+/, `bf-${b.parts[k]}`));
          const old = getComputedStyle(path).fill;
          path.setAttribute('class', cls);
          play(path, [{ fill: old, opacity: 1 }, { fill: old, opacity: 0.35, offset: 0.35 }, { opacity: 1 }], { dur: ms('--m-beat') * 2, delay: d });
        }
      }
    }
    // gear lines (M-35, M-32): a shield's state or a pool's points land; an item that is gone fades out of its line
    const gearChanged = Object.keys({ ...a.gear, ...b.gear }).filter((k) => JSON.stringify(a.gear[k]) !== JSON.stringify(b.gear[k]));
    if (gearChanged.length) {
      const d = at(stagger);
      for (const k of gearChanged) {
        const line = q(`[data-gear="${CSS.escape(k)}"]`);
        if (!b.gear[k]) arrive(line, d);
        else if (!a.gear[k]) {
          const host = q('.cs-hw') ?? q('.cs-held');
          if (!host) continue;
          const g = h('span', { class: 'cs-gi m-ghost', 'aria-hidden': 'true' }, ' · ', b.gear[k].name);
          host.append(g);
          play(g, [{ opacity: 1 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], { dur: ms('--m-trail'), delay: d, exit: true, done: () => g.remove() });
        } else { stamp(q('[data-m="gear-note"]', line ?? sheet), d, b.gear[k].note); pulse(line, d); }
      }
    }
    // morale: like health, with its own violet edge (MW1–MW3)
    if (a.morale !== b.morale || a.moraleLeft !== b.moraleLeft) {
      const d = at(stagger);
      count(q('[data-m="morale-left"]'), b.moraleLeft, a.moraleLeft, (n) => String(Math.round(n)), d);
      barMove(q('[data-m="morale-track"]'), q('[data-m="morale-track"] > b'), b.moraleFill, a.moraleFill, d);
      if (a.morale !== b.morale) stamp(q('[data-m="morale-level"]'), d, b.morale);
      nerveBeats(b.moraleKey, a.moraleKey, d, redEdge || HEALTH_LEVELS.pos(a.level) >= HEALTH_LEVELS.pos(CONFIG.MOTION_EDGE_STEADY));
    }
    // Shaken, Swayed and the yield box arrive when they first show (M-36)
    if (a.chips.length > b.chips.length || (a.yielded && !b.yielded)) {
      const d = at(stagger);
      Array.from(sheet.querySelectorAll('.ps-pressure')).slice(b.chips.length).forEach((x) => arrive(x, d));
      if (a.yielded && !b.yielded) arrive(q('.cs-yield'), d);
    }
    // skills: each gain counts up with a gold "+n", its bar grows, its row pulses once
    const up = Object.keys(a.skills).filter((k) => a.skills[k] !== (b.skills[k] ?? 0));
    if (up.length) {
      const d = at(stagger);
      for (const k of up) {
        const row = q(`[data-skill="${k}"]`);
        if (!row) continue;
        const from = b.skills[k] ?? 0, to = a.skills[k];
        count(q('[data-m="skill"]', row), from, to, (n) => String(Math.round(n)), d);
        // the row's ▲ gain mark already says how much; no floating number here
        barMove(q('.cs-bar', row), q('.cs-bar > b', row), Math.min(100, from), Math.min(100, to), d);
        pulse(row, d);
      }
    }
    // XP and level: a level-up fills the bar, then it starts again from empty (M-38, the Thread weaves)
    if (a.xp !== null && b.xp !== null && (a.xp !== b.xp || a.lvl !== b.lvl)) {
      const levelled = a.lvl !== b.lvl;
      // a level-up holds the next step until the bar has wrapped and the new level word has landed, so the gold cards
      // (and the perk badge with them) come after it (M-38)
      const d = at(levelled ? ms('--m-trail') * 2 : stagger);
      count(q('[data-m="xp"]'), levelled ? 0 : b.xp, a.xp, whole, d + (levelled ? ms('--m-trail') : 0));
      if (a.xp > b.xp && !levelled) delta(q('[data-m="xp"]'), sign(a.xp - b.xp), 'scenario-mark', d);
      barMove(q('[data-m="xp-track"]'), q('[data-m="xp-track"] > b'), b.xpPct ?? 0, a.xpPct ?? 0, d, levelled);
      if (levelled) stamp(q('[data-m="lvl"]'), d + ms('--m-trail'), `Level ${b.lvl}`);
    }
    // coin: the words change, with the difference in coin words in the colour of the change, then a pulse
    if (a.coin !== b.coin) {
      const d = at(stagger);
      stamp(q('[data-m="coin"]'), d, coinWords(b.coin));
      delta(q('[data-m="coin"]'), (a.coin > b.coin ? '+' : '−') + coinWords(Math.abs(a.coin - b.coin)), a.coin > b.coin ? 'scenario-mark' : 'danger', d);
      pulse(q('[data-m="coin"]'), d + ms('--m-beat'), 2);
    }
  }
  /** M-36: arrivals in Who's here fade in, departures fade out, a changed status lands; header pieces that changed land;
   * the quick slot's count lands. All together, at one time: they are the world around the sheet, not its values. */
  function aroundBeats(b: Around, a: Around, d: number) {
    for (const [name, txt] of Object.entries(a.who)) {
      const chip = who.querySelector<HTMLElement>(`[data-who="${CSS.escape(name)}"]`);
      if (!(name in b.who)) arrive(chip, d);
      else if (b.who[name] !== txt) pulse(chip, d);
    }
    for (const [name, txt] of Object.entries(b.who)) {
      if (name in a.who) continue;
      // someone who left: a ghost of their chip fades out where the row ends (M-51: exits are quicker)
      const g = h('span', { class: 'pp m-ghost', 'aria-hidden': 'true' }, h('b', {}, txt));
      who.append(g);
      play(g, [{ opacity: 1 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { dur: ms('--m-state') * 2, delay: d, exit: true, done: () => g.remove() });
    }
    for (const [key, txt] of Object.entries(a.head)) {
      const x = title.querySelector<HTMLElement>(`[data-mh="${key}"]`);
      if (!(key in b.head)) arrive(x, d);
      else if (b.head[key] !== txt) play(x, [{ opacity: 0 }, { opacity: 1 }], { dur: ms('--m-state'), delay: d });
    }
    if (a.heal && b.heal && a.heal !== b.heal) stamp(healBtn.querySelector('b'), d, b.heal.replace(/^.*?(×\d+)$/, '$1'));
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
  // BG-191: coming back to Play (the page was off the screen, so the story lost its place) opens at the latest lines
  return { el, update, focus: () => { story.scrollTop = story.scrollHeight; input.focus(); } };
}
