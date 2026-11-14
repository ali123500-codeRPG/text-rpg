// Character (/stats) uses the character sheet (charsheet.ts). Inventory (/inv) and Quests (/quests) share one page shape. Visibility tiles on top (one per group; the Inventory has none),
// figures that can't be filtered in a text line under them, then the grouped table.
import type { GameApi, GameState, ItemInstance, Quest } from '../types';
import { QUEST_STATES } from '../types';
import { QUEST_STATE_NAME, dueText, isOpen, payText, questChain } from '../engine/quests';
import { getLibrary, itemDef } from '../library';
import { HEALTH_LEVELS, PART_STATES, QUEST_REWARD_LEVELS, THREADBOUND_RANKS } from '../scales';
import { achLevel, achXp, achievementInfo, achievementName, earnedAtText } from '../engine/xp';
import { earned } from '../ruleset/threadboundItems';
import { rewardName, rewardXp } from '../ruleset/achRewards';
import { branchLabel, chainRows, chainTag, heldChains, isBareHead, type HeldChain } from '../ruleset/achChains';
import { ACH_HEAD_NAMES, ACH_TAGS } from '../library/achievementIds';
import { CONFIG } from '../config';
import { requirement, shortBy } from '../ruleset/requirements';
import { gripWord, kitBonus, modeName } from '../ruleset/gear';
import { skillName } from '../library/skillNames';
import { othersHealthWord } from '../ruleset';
import { buildPlayerView, callName, factText, questGoalText } from '../views';
import { essencesSection } from './essences';
import { closePanel, groupedTable, playDraft, type PanelRow, h, natural, openPanel, plural, unitOf, visPass, visTiles, type Col, type TGroup, type TRow, type VisState, type VisTile } from './kit';
import { charCard, invFocus, treeBars } from './charsheet';
import { perksSection, refreshPerks } from './perks';
import { healItems, quickHeal } from './healing';
import { IT } from '../library/itemIds';
import { wornPack } from '../engine/containers';
import { gripParts } from '../engine/gear';
import { coins, coinWords, countWords } from '../engine/trade';
import { iconName, itemIcon, ICONS, type IconName } from './itemIcons';
import { cap, r1 } from '../words';

type Spec = {
  title: string; intro: string; noun: [string, string]; cols: Col[]; empty: string;
  groups: (s: GameState) => (TGroup & { sub: string; value: string; unit: string; how: string })[];
  line: (s: GameState) => string;
  panelTitle: string;
  detail?: (s: GameState, rowId: string) => PanelRow[]; // extra read-only rows for the side panel
  panelHead?: (s: GameState, rowId: string) => Node; // a control in the side panel's header
  /** tiles other than one per table group: each row passes the filter by its tile */
  tiles?: (s: GameState) => VisTile[];
  tileOf?: (s: GameState, row: TRow) => string;
  focus?: () => string | null; // a row to open on arrival (consumed once)
  top?: (redraw: () => void) => HTMLElement; // above the title: the page's sub-tabs
  lead?: (s: GameState) => HTMLElement; // under the title, above the tiles: the Inventory's equipment panel
  noTiles?: true; // no visibility tiles: the table alone (the Inventory, where the boxes only repeated the group counts)
  startOpen?: true; // every group starts open, so the rows themselves show; a heading the player closes stays closed
};

export function listPage(api: GameApi, spec: Spec): { el: HTMLElement; update: () => void } {
  const picks: Record<string, VisState> = {};
  const open = new Set<string>(), seen = new Set<string>();
  const sort = { key: spec.cols[0].key, dir: 0 as 0 | 1 | -1 };
  const el = h('main');
  const how = h('p', { class: 'how', hidden: true });

  function update() {
    const s = api.state();
    if (!s) { el.replaceChildren(h('h1', {}, spec.title), h('p', { class: 'empty' }, 'No story yet. Create your character first.')); return; }
    const all = spec.groups(s);
    if (spec.startOpen) for (const g of all) if (!seen.has(g.id)) { seen.add(g.id); open.add(g.id); }
    const tileOf = spec.tileOf;
    const shown = tileOf ? all.map((g) => ({ ...g, rows: g.rows.filter((r) => visPass(tileOf(s, r), picks)) })).filter((g) => g.rows.length) : all.filter((g) => visPass(g.id, picks));
    const onOpen = (id: string) => {
      for (const g of all) if (tileOf ? g.rows.some((r) => tileOf(s, r) === id) : g.id === id) open.add(g.id);
      for (const k of Object.keys(picks)) if (k !== id && picks[k] === 'shown') picks[k] = 'off';
      if (picks[id] === 'out') picks[id] = 'off';
      update();
      document.getElementById('grp-' + id)?.scrollIntoView({ block: 'nearest' });
    };
    const onField = (row: TRow, key: string) => openPanel(spec.panelTitle,
      [...spec.cols.map((c) => ({ k: c.title, v: row.cells[c.key] ?? '–', edit: c.key === key })), ...(spec.detail?.(s, row.id) ?? [])],
      'The game changes these through play, so the field is shown read-only here.', spec.panelHead?.(s, row.id));
    const want = spec.focus?.();
    if (want) {
      const g = all.find((x) => x.rows.some((r) => r.id === want));
      if (g) { open.add(g.id); delete picks[g.id]; onField(g.rows.find((r) => r.id === want)!, spec.cols[0].key); }
    }
    const picked = Object.entries(picks).filter(([, v]) => v !== 'off');
    const count = shown.reduce((a, g) => a + g.rows.length, 0);
    const hint = picked.length
      ? [h('span', {}, `${plural(count, spec.noun[0], spec.noun[1])} shown · `), h('button', { class: 'hs-btn-text', type: 'button', style: 'min-height:0', onclick: () => { for (const k of Object.keys(picks)) delete picks[k]; update(); } }, 'Clear')]
      : spec.noTiles ? 'Click a heading to open its rows.' : spec.startOpen ? 'Click one to see how it is earned. Click a box: once for Shown, twice for Left out, three times to clear.'
        : 'Click a box: once for Shown, twice for Left out, three times to clear. Click a heading to open its rows.';
    el.replaceChildren(
      ...(spec.top ? [spec.top(update)] : []),
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, spec.title), h('p', {}, spec.intro))),
      spec.lead?.(s) ?? '',
      h('div', { class: 'sec' },
        all.length && !spec.noTiles ? visTiles(spec.tiles?.(s) ?? all.map((g) => ({ id: g.id, label: g.title, value: g.value, unit: g.unit, sub: g.sub, how: g.how })), picks, update, onOpen, how) : null,
        h('p', { class: 'subline' }, spec.line(s)), how),
      h('div', { class: 'sec' }, h('div', { class: 'head' }, h('h2', { class: 'hs-section' }, spec.title), all.length ? h('p', { class: 'hs-note' }, hint) : null),
        groupedTable({ cols: spec.cols, groups: shown, open, sort, onField, redraw: update, emptyText: picked.length ? `No ${spec.noun[1]} match these boxes. Pick other boxes or Clear.` : spec.empty })));
  }
  return { el, update };
}

const safe = <T>(f: () => T): T | null => { try { return f(); } catch { return null; } };

export function characterPage(api: GameApi) {
  const el = h('main');
  const perks = perksSection(api);
  function update() {
    const s = api.state();
    if (!s) { el.replaceChildren(h('h1', {}, 'Character'), h('p', { class: 'empty' }, 'No story yet. Create your character first.')); return; }
    el.replaceChildren(
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Character'), h('p', {}, 'Who you are and what you can do. Same as /stats.'))),
      h('div', { class: 'cs-split' }, charCard(s, s.player), treeBars(s.player)),
      essencesSection(api, s, update),
      h('p', { class: 'hs-note' }, `The ${HEALTH_LEVELS.keys.length - 1} health segments are the health track, ${HEALTH_LEVELS.name('unhurt')} to ${HEALTH_LEVELS.name('incapacitated')}. ✦ marks a tagged skill. Bars fill at ${CONFIG.SKILL_CAP}, the training cap; a skill can go past it.`),
      perks);
    refreshPerks();
  }
  return { el, update };
}

const KIND_GROUP: Record<string, [string, string, string]> = {
  weapon: ['weapons', 'Weapons', 'c10'], shield: ['shields', 'Shields', 'c1'], armor: ['armor', 'Armor', 'c12'],
  accessory: ['accessories', 'Accessories', 'c5'], consumable: ['consumables', 'Consumables', 'c6'], tool: ['tools', 'Tools', 'c4'],
};
/** EQ7: "Medium Weapons 50" */
const needText = (r: { skill: string; need: number }) => `${skillName(r.skill)} ${r.need}`;

/** an item's exact stats: the Inventory's side panel and the equipment panel's hover card share these rows */
export function itemRows(s: GameState, it: { itemId: string; boundTo?: string }): PanelRow[] {
  const d = safe(() => itemDef(s, it.itemId));
  if (!d) return [];
  const sign = (n = 0) => (n >= 0 ? '+' : '') + n;
  const rows: PanelRow[] = [{ k: 'Look', v: d.look }, { k: 'Kind', v: d.kind }];
  if (d.grips) rows.push({ k: 'Grips', v: String(d.grips) });
  for (const m of d.weapon?.modes ?? []) rows.push({ k: `Attack · ${modeName(m)}`, v: `${m.tree} ${m.class}, reach ${m.reach} m, damage ${sign(m.damageAdj)}, hit ${sign(m.hitAdj)}` });
  if (d.armor) rows.push({ k: 'Armor', v: `${d.armor.weight}, covers ${d.armor.covers.join(', ')}, reduction ${d.armor.reduction}, multiplier ×${d.armor.multiplier}` });
  if (d.shield) rows.push({ k: 'Shield pool', v: String(d.shield.pool) });
  for (const e of d.effects ?? []) rows.push({ k: e.kit ? 'Standard kit' : 'Effect', v: `${sign(e.kit ? kitBonus(d, e) : e.value)} to ${e.kind === 'skill' ? (e.skill === '$mode' ? 'the attack skill' : skillName(e.skill ?? '')) : `${e.roll} rolls`} while ${e.active}${e.kit ? ' (kit pieces share one bonus per roll)' : ''}` });
  // EQ7: the requirement, red while the player is short, grey once met
  const need = requirement(d);
  if (need) {
    const short = shortBy(s.player, d), steps = Math.ceil(short / CONFIG.EQUIP_SHORT_STEP);
    const rolls = d.armor ? 'Dodge and stealth rolls while worn' : 'rolls with it';
    rows.push({ k: 'Needs', v: h('span', { class: short > 0 ? 'tone-bad' : 'tone-muted' }, short > 0
      ? `${needText(need)} (you have ${r1(need.need - short)}: ${plural(steps, 'outcome step')} worse on ${rolls})`
      : `${needText(need)} (met)`) });
  }
  rows.push({ k: 'Bulk', v: String(d.bulk) });
  if (d.threadbound) rows.push(...threadboundRows(s, it, d.threadbound));
  return rows;
}

/** A Threadbound item's powers: each one shows the deed (achievement) that wakes it and what that deed asks, but what the
 * power does stays hidden until it wakes; then it is named, since it is the owner's perk from then on. Only for its owner,
 * or before it is bound to anyone. */
function threadboundRows(s: GameState, it: { boundTo?: string }, tb: NonNullable<ReturnType<typeof itemDef>['threadbound']>): PanelRow[] {
  const p = s.player, lib = getLibrary(), mine = !it.boundTo || it.boundTo === p.id;
  const rows: PanelRow[] = [{ k: 'Threadbound', v: `${THREADBOUND_RANKS.name(tb.rank)} · ${it.boundTo === p.id ? 'bound to you' : it.boundTo ? 'bound to someone else' : 'binds to whoever wears it first'}` }];
  if (!mine) return rows;
  const woke = tb.grants.filter((g) => earned(p, g.achievement)).length;
  rows.push({ k: 'Powers', v: `${woke} of ${tb.grants.length} awake. Each wakes with a deed; what a power does stays hidden until then.` });
  for (const g of tb.grants) {
    const a = lib.achievements?.[g.achievement];
    const deed = a ? `“${a.name}”: ${earnedAtText(s, a)}` : g.achievement;
    rows.push(earned(p, g.achievement)
      ? { k: 'Awake', v: `${lib.perks[g.perk]?.name ?? g.perk} · woken by ${deed}` }
      : { k: 'Sealed', v: `A hidden power · wakes with ${deed}` });
  }
  return rows;
}

// The equipment panel, laid out the way MMOs show equipped items: the slots the body has (one per grip part,
// the armor slot, the accessory slots) with what is in them, and the pack beside them as a grid of item icons.
// Hovering or focusing an item shows its exact stats; Equip and Unequip send the same words the player could type,
// so the turn rules hold (drawing and putting away are free, armor on or off is the turn's action).
type InvItem = GameState['player']['core']['inventory'][number];

/** the words an Equip or Unequip button sends; null: the item can't be equipped */
export function gearWords(s: GameState, it: InvItem): { label: string; text: string } | null {
  const d = safe(() => itemDef(s, it.itemId));
  if (!d) return null;
  const on = !!it.equippedIn?.length;
  if (d.slot === 'armor' || d.slot === 'accessory') return on ? { label: 'Unequip', text: `I take off my ${d.name}` } : { label: 'Equip', text: `I put on my ${d.name}` };
  // anything held can be put away; only weapons and shields offer Equip, so a draught or a bandage stays a pack item
  if (d.grips && on) return { label: 'Unequip', text: `I put away my ${d.name}` };
  if (d.grips && (d.kind === 'weapon' || d.kind === 'shield')) return { label: 'Equip', text: `I draw my ${d.name}` };
  return null;
}

let tipEl: HTMLElement | null = null;
function showTip(s: GameState, it: InvItem, at: HTMLElement) {
  const d = safe(() => itemDef(s, it.itemId));
  if (!d) return;
  tipEl ??= document.body.appendChild(h('div', { class: 'itip', role: 'tooltip', hidden: true }));
  tipEl.dataset.kind = d.kind;
  tipEl.replaceChildren(h('p', { class: 'itip-name' }, cap(countWords(it.itemId, d.name, it.qty))),
    h('dl', {}, ...itemRows(s, it).flatMap((r) => [h('dt', {}, r.k), h('dd', {}, r.v)])));
  tipEl.hidden = false;
  const r = at.getBoundingClientRect(), w = tipEl.offsetWidth, ht = tipEl.offsetHeight;
  const left = r.right + 12 + w < innerWidth ? r.right + 12 : Math.max(12, r.left - 12 - w);
  tipEl.style.left = `${left}px`;
  tipEl.style.top = `${Math.max(12, Math.min(innerHeight - ht - 12, r.top))}px`;
}
const hideTip = () => { if (tipEl) tipEl.hidden = true; };

function equipment(api: GameApi, s: GameState): HTMLElement {
  hideTip(); // the panel is rebuilt on every change, so a card left open would point at nothing
  const p = s.player, inv = p.core.inventory.filter((i) => i.itemId !== IT.coin);
  const kindOf = (it: InvItem) => safe(() => itemDef(s, it.itemId))?.kind ?? 'misc';
  const nameOf = (it: InvItem) => cap(safe(() => itemDef(s, it.itemId))?.name ?? it.itemId);
  const locked = api.busy() || api.fell();
  const status = h('p', { class: 'hs-note eq-status', role: 'status' });
  const act = (w: { label: string; text: string }) => h('button', {
    type: 'button', class: w.label === 'Equip' ? 'hs-btn-main eq-act' : 'hs-btn-text eq-act', disabled: locked,
    title: `Sends “${w.text}” as your turn`,
    onclick: async () => { hideTip(); status.textContent = `${w.text}…`; await api.submit(w.text, { aimed: false }); },
  }, w.label);
  // hover or keyboard focus shows the stats; the item's name opens the side panel like the table does
  const hover = (el: HTMLElement, it: InvItem) => {
    el.addEventListener('pointerenter', () => showTip(s, it, el));
    el.addEventListener('pointerleave', hideTip);
    el.addEventListener('focusin', () => showTip(s, it, el));
    el.addEventListener('focusout', hideTip);
    return el;
  };
  const icon = (it: InvItem) => itemIcon(iconName(s, it.itemId), kindOf(it));
  const blank = (n: IconName) => { const el = h('span', { class: 'iico blank' }); el.innerHTML = ICONS[n]; return el; };

  // slots: one per grip part (an arm's hand, a dragon's head), then armor, then the accessory slots
  const gripSlots = gripParts(s, p).map((part) => ({ id: `grip:${part}`, label: cap(gripWord(part)), empty: 'sword' as IconName }));
  const slots = [...gripSlots, { id: 'armor', label: 'Body', empty: 'tunic' as IconName },
    ...Array.from({ length: CONFIG.ACCESSORY_SLOTS }, (_, n) => ({ id: `acc:${n}`, label: `Accessory ${n + 1}`, empty: 'ring' as IconName }))];
  const firstSlot = new Map<string, string>(); // a two-grip item shows once, in its first grip
  const slotCards = slots.map((sl) => {
    const it = inv.find((i) => i.equippedIn?.includes(sl.id));
    if (!it) return h('div', { class: 'eq-slot empty' }, blank(sl.empty), h('div', { class: 'eq-txt' }, h('span', { class: 'hs-label' }, sl.label), h('span', { class: 'eq-none' }, 'Empty')));
    const again = firstSlot.has(it.id);
    if (!again) firstSlot.set(it.id, sl.id);
    const w = gearWords(s, it);
    return hover(h('div', { class: `eq-slot${again ? ' again' : ''}`, tabindex: '0' }, icon(it),
      h('div', { class: 'eq-txt' }, h('span', { class: 'hs-label' }, sl.label), h('span', { class: 'eq-name' }, again ? `${nameOf(it)} (both grips)` : nameOf(it))),
      w && !again ? act(w) : ''), it);
  });
  // like an MMO bag, plain stacks of the same item show as one tile; worn or damaged pieces (pools) keep their own
  const pack: InvItem[] = [];
  for (const i of inv.filter((x) => !x.equippedIn?.length)) {
    const same = !i.pools && pack.find((x) => x.itemId === i.itemId && !x.pools);
    if (same) same.qty = (same.qty ?? 1) + (i.qty ?? 1); else pack.push(i.pools ? i : { ...i });
  }
  const packTiles = pack.map((it) => {
    const w = gearWords(s, it);
    return hover(h('div', { class: 'eq-item', tabindex: '0' },
      h('span', { class: 'eq-ico' }, icon(it), it.qty && it.qty > 1 ? h('b', { class: 'eq-qty' }, `×${it.qty}`) : ''),
      h('span', { class: 'eq-name' }, nameOf(it)), w ? act(w) : h('span', { class: 'eq-cant' }, 'Carried')), it);
  });
  return h('section', { class: 'eq', 'aria-label': 'Equipment' },
    h('div', { class: 'eq-col' }, h('h2', { class: 'hs-section' }, 'Equipped'), h('div', { class: 'eq-slots' }, ...slotCards)),
    h('div', { class: 'eq-col' }, h('h2', { class: 'hs-section' }, 'In your pack'),
      pack.length ? h('div', { class: 'eq-pack' }, ...packTiles) : h('p', { class: 'empty' }, 'Everything you carry is equipped.')),
    h('p', { class: 'hs-note eq-foot' }, locked ? 'Wait for the turn to finish before changing gear.' : 'Hover an item for its stats. Equip and Unequip take your turn, as if you typed them: drawing and putting away are free, putting armor on or off is your action.'),
    status);
}

/** the Inventory page's coin, in words as the play sheet and the Coin row say it: "Coin: 1 silver and 6 copper", never a bare count */
export const coinLine = (s: GameState) => `Coin: ${coinWords(coins(s.player))}`;

/** CT1: what a carried container holds, nested containers' contents after them, each with its path ("Pouch › Ring") and the
 * container it sits in. A worn pack's contents are the stowed items, listed in the table already. */
type Inside = { it: ItemInstance; path: string; box: ItemInstance };
export function insideOf(s: GameState, box: ItemInstance, path = ''): Inside[] {
  return (box.contents ?? []).flatMap((it) => {
    const name = cap(safe(() => itemDef(s, it.itemId).name) ?? it.itemId), here = path ? `${path} › ${name}` : name;
    return [{ it, path: here, box }, ...insideOf(s, it, here)];
  });
}
const carriedBoxes = (s: GameState) => s.player.core.inventory.filter((i) => safe(() => itemDef(s, i.itemId).container) && !wornPack(i));
const allInside = (s: GameState) => carriedBoxes(s).flatMap((b) => insideOf(s, b));
/** CT1: the carried containers (by name, each name once) a loose item can be put in; none for something already inside one,
 * and none for a container, which never goes into another */
export function putInto(s: GameState, it: ItemInstance, inside = false): string[] {
  if (inside || safe(() => itemDef(s, it.itemId).container)) return [];
  return [...new Set(carriedBoxes(s).map((b) => (safe(() => itemDef(s, b.itemId).name) ?? 'container').toLowerCase()))];
}
/** CT1: what dropping a dragged item on a row or group of the Inventory means, as the order it drafts on Play: onto a
 * carried container (its row, its "In your …" group, or anything already inside it) puts it in; an item inside a container
 * dropped anywhere else in the pack takes it out. Null: no order (the same container, or not a place to drop). */
export function dropOrder(s: GameState, itemId: string, onto: { row?: string; group?: string }): string | null {
  const nameOf = (i: ItemInstance) => (safe(() => itemDef(s, i.itemId).name) ?? i.itemId).toLowerCase();
  const inside = allInside(s), from = inside.find((x) => x.it.id === itemId);
  const it = from?.it ?? s.player.core.inventory.find((i) => i.id === itemId);
  if (!it) return null;
  const boxes = carriedBoxes(s);
  const box = boxes.find((b) => b.id === onto.row || `in:${b.id}` === onto.group)
    ?? inside.find((x) => x.it.id === onto.row)?.box;
  if (box) {
    if (from) return null; // already in a container: moving it to another is two orders, so take it out first
    return putInto(s, it).length && !safe(() => itemDef(s, it.itemId).container) ? `I put the ${nameOf(it)} in my ${nameOf(box)}` : null;
  }
  return from ? `I take the ${nameOf(it)} out of my ${nameOf(from.box)}` : null;
}

/** CT1: drag and drop on the Inventory table; a drop drafts the order on Play, as the Put in and Take out buttons do */
function dragToBoxes(api: GameApi, el: HTMLElement): void {
  let dragId: string | null = null;
  const spot = (e: Event) => {
    const t = (e.target as Element | null)?.closest?.('tr[data-row], tr[data-group]') as HTMLElement | null;
    return t ? { tr: t, onto: { row: t.dataset.row, group: t.dataset.group } } : null;
  };
  const clear = () => el.querySelectorAll('.drop-ok, .dragging').forEach((x) => x.classList.remove('drop-ok', 'dragging'));
  el.addEventListener('dragstart', (e) => {
    const tr = (e.target as Element).closest?.('tr[data-row]') as HTMLElement | null;
    if (!tr?.draggable) return;
    dragId = tr.dataset.row ?? null;
    e.dataTransfer?.setData('text/plain', dragId ?? '');
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    tr.classList.add('dragging');
  });
  el.addEventListener('dragend', () => { dragId = null; clear(); });
  el.addEventListener('dragover', (e) => {
    const s = api.state(), at = spot(e);
    el.querySelectorAll('.drop-ok').forEach((x) => x !== at?.tr && x.classList.remove('drop-ok'));
    if (!s || !dragId || !at || !dropOrder(s, dragId, at.onto)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    at.tr.classList.add('drop-ok');
  });
  el.addEventListener('drop', (e) => {
    const s = api.state(), at = spot(e), id = dragId;
    clear(); dragId = null;
    const order = s && id && at ? dropOrder(s, id, at.onto) : null;
    if (!order) return;
    e.preventDefault();
    playDraft.text = order; closePanel(); location.hash = 'play';
  });
}
const holdsText = (b: ItemInstance) => (b.contents?.length ? `Holds ${plural(b.contents.length, 'item')}` : 'Empty');

export function inventoryPage(api: GameApi) {
  const page = listPage(api, {
    title: 'Inventory', intro: 'What you carry. Same as /inv. Equipped gear is above, the rest of your pack below. Click an item for its stats; drag one onto a sack to put it in, or out of a sack to take it out.', noun: ['item', 'items'], panelTitle: 'Item', empty: 'Nothing in your pack. Your equipped gear is listed above.',
    focus: () => { const id = invFocus.id; invFocus.id = null; return id; },
    lead: (s) => equipment(api, s),
    detail: (s, id) => {
      const inside = allInside(s).find((x) => x.it.id === id);
      const it = s.player.core.inventory.find((i) => i.id === id) ?? inside?.it;
      if (!it) return [];
      const rows = itemRows(s, it);
      // CT1: something in a carried container: where it is, and Take out, which drafts the order on Play (a pick-up)
      if (inside) {
        const boxName = safe(() => itemDef(s, inside.box.itemId).name) ?? 'container', name = safe(() => itemDef(s, it.itemId).name) ?? it.itemId;
        rows.splice(rows.length - 1, 0, { k: 'Inside', v: `Your ${boxName.toLowerCase()}` },
          { k: 'Take out', v: h('button', { type: 'button', class: 'hs-btn-text', 'data-chip': 'take-out', style: 'min-height:0;padding:0', title: 'Puts the order in the box on Play. Nothing is sent until Send',
            onclick: () => { playDraft.text = `I take the ${name.toLowerCase()} out of my ${boxName.toLowerCase()}`; closePanel(); location.hash = 'play'; } }, 'Take it out') });
      }
      // CT1: something loose in the pack, while a container is carried: Put in drafts the order on Play (a stow into it)
      const boxes = putInto(s, it, !!inside);
      if (boxes.length) {
        const name = (safe(() => itemDef(s, it.itemId).name) ?? it.itemId).toLowerCase();
        rows.splice(rows.length - 1, 0, { k: 'Put in', v: h('span', { class: 'put-in' }, boxes.map((box) =>
          h('button', { type: 'button', class: 'hs-btn-text', 'data-chip': 'put-in', style: 'min-height:0;padding:0', title: 'Puts the order in the box on Play. Nothing is sent until Send',
            onclick: () => { playDraft.text = `I put the ${name} in my ${box}`; closePanel(); location.hash = 'play'; } }, `Put it in your ${box}`))) });
      }
      const heal = healItems(s, s.player).find((x) => x.itemId === it.itemId);
      if (heal) {
        const r = heal.row;
        rows.splice(rows.length - 1, 0, { k: 'Heals', v: `${r.hpPct}% health and ${r.partPct}% to each body part${PART_STATES.pos(r.reach) >= PART_STATES.pos('crippled') ? ', mends Crippled parts' : ''}` });
        // H3 b: the player picks which healing item the quick slot beside Aim shows
        const btn = h('button', { type: 'button', class: 'hs-btn-text', style: 'min-height:0;padding:0' });
        const draw = () => {
          const on = quickHeal(s, s.player)?.itemId === heal.itemId;
          btn.textContent = on ? 'Shown in the quick slot' : 'Show in the quick slot';
          btn.disabled = on;
        };
        btn.onclick = () => { if (s.player.progression) { s.player.progression.quickHeal = heal.itemId; draw(); } };
        draw();
        rows.splice(rows.length - 1, 0, { k: 'Quick slot', v: btn });
      }
      return rows;
    },
    cols: [{ key: 'name', title: 'Item' }, { key: 'needs', title: 'Needs' }, { key: 'qty', title: 'Qty', right: true }, { key: 'cond', title: 'Condition' }],
    groups: (s) => {
      const p = s.player, groups = new Map<string, TGroup & { sub: string; value: string; unit: string; how: string }>();
      // worn and held gear shows in the Equipped panel above, so the table lists only what is in the pack
      p.core.inventory.filter((i) => i.itemId !== IT.coin && !i.equippedIn?.length).forEach((it, n) => {
        const d = safe(() => itemDef(s, it.itemId));
        const [id, title, color] = KIND_GROUP[d?.kind ?? ''] ?? ['other', 'Other', 'c3'];
        const g = groups.get(id) ?? { id, title, color, rows: [], combined: {}, value: '', unit: 'items', sub: '', how: `Everything of this kind you carry.` };
        const pools = it.pools ? Object.entries(it.pools).map(([k, v]) => `${k} ${v}%`).join(', ') : 'Whole';
        const need = d ? requirement(d) : null;
        const needs = need ? `Needs ${needText(need)}` : '';
        g.rows.push({ id: it.id, sortKey: n, drag: !d?.container, cells: { name: d?.name ?? it.itemId, needs, qty: String(it.qty ?? 1), cond: d?.container ? holdsText(it) : pools },
          ...(need ? { tones: { needs: shortBy(p, d!) > 0 ? 'bad' as const : 'muted' as const } } : {}) });
        groups.set(id, g);
      });
      // CT1: each carried container that holds something gets its own group of what is inside, nested containers' contents included
      const boxes = carriedBoxes(s).filter((b) => b.contents?.length).map((b, k) => {
        const name = safe(() => itemDef(s, b.itemId).name) ?? 'container';
        return { id: `in:${b.id}`, title: `In your ${name.toLowerCase()}`, color: 'c4', order: k, how: `What your ${name.toLowerCase()} holds. Click one to take it out.`,
          rows: insideOf(s, b).map((x, n) => ({ id: x.it.id, sortKey: n, drag: true, cells: { name: x.path, needs: '', qty: String(x.it.qty ?? 1),
            cond: safe(() => itemDef(s, x.it.itemId).container) ? holdsText(x.it) : x.it.pools ? Object.entries(x.it.pools).map(([k2, v]) => `${k2} ${v}%`).join(', ') : 'Whole' } })) };
      });
      const inBoxes = boxes.map((g) => {
        const qty = g.rows.reduce((a, r) => a + +r.cells.qty, 0);
        return { id: g.id, title: g.title, color: g.color, rows: g.rows, combined: { qty: String(qty), cond: '', needs: '' }, value: String(qty), unit: unitOf(qty, 'item'), sub: 'inside', how: g.how };
      });
      return [...[...groups.values()].map((g) => {
        const qty = g.rows.reduce((a, r) => a + +r.cells.qty, 0);
        const cs = [...new Set(g.rows.map((r) => r.cells.cond))];
        const ns = [...new Set(g.rows.map((r) => r.cells.needs))], ts = [...new Set(g.rows.map((r) => r.tones?.needs))];
        return { ...g, value: String(qty), unit: unitOf(qty, 'item'), sub: 'in your pack', combined: { qty: String(qty), cond: cs.length === 1 ? cs[0] : 'Mixed', needs: ns.length === 1 ? ns[0] : '' },
          ...(ns.length === 1 && ts.length === 1 && ts[0] ? { combinedTones: { needs: ts[0] } } : {}) };
      }).sort((a, b) => (a.id === 'other' ? 1 : 0) - (b.id === 'other' ? 1 : 0) || natural(a.title, b.title)), ...inBoxes];
    },
    line: coinLine, noTiles: true,
  });
  dragToBoxes(api, page.el);
  return page;
}

/** a quest to open on arrival (the Play screen's quest line) */
export const questFocus: { id: string | null } = { id: null };

/** QT12: "Abandon quest", confirmed in place */
function abandonButton(api: GameApi, id: string): HTMLElement {
  const box = h('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-2)' });
  const ask = () => box.replaceChildren(h('span', {}, 'Abandon this quest? This can’t be undone.'),
    h('button', { type: 'button', class: 'hs-btn-text danger', onclick: () => { api.abandonQuest(id); closePanel(); } }, 'Abandon'),
    h('button', { type: 'button', class: 'hs-btn-text', onclick: draw }, 'Keep'));
  const draw = () => box.replaceChildren(h('button', { type: 'button', class: 'hs-btn-text danger', onclick: ask }, 'Abandon quest'));
  draw();
  return box;
}

/** QT14/QT24: one row per quest; linked quests fold under one head row, numbered by start; tiles by state */
export function questsPage(api: GameApi) {
  const quest = (s: GameState, id: string) => s.quests.find((q) => q.id === id);
  return listPage(api, {
    title: 'Quests', intro: 'Jobs people gave you. Same as /quests.', noun: ['quest', 'quests'], panelTitle: 'Quest', empty: 'No quests yet. Talk to people in the village.',
    focus: () => { const id = questFocus.id; questFocus.id = null; return id; },
    cols: [{ key: 'text', title: 'Quest' }, { key: 'giver', title: 'Giver' }, { key: 'goal', title: 'Goal' }, { key: 'reward', title: 'Reward' },
      { key: 'pay', title: 'Payment' }, { key: 'due', title: 'Due' }, { key: 'state', title: 'State' }],
    groups: (s) => {
      const chains = new Map<string, Quest[]>();
      for (const q of s.quests) { const root = questChain(s, q)[0].id; chains.set(root, [...(chains.get(root) ?? []), q]); }
      const row = (q: Quest): TRow => ({ id: q.id, sortKey: q.startTurn, cells: {
        text: q.text, giver: cap(callName(s, s.player.id, q.giver)), goal: questGoalText(s, q),
        reward: `Level ${QUEST_REWARD_LEVELS.name(q.level)} · ${rewardXp(q.level)} XP`, pay: payText(s, q),
        due: isOpen(q) && q.state !== 'ready' ? dueText(q).replace(/^Due /, '') : '', state: QUEST_STATE_NAME[q.state] },
        ...(q.unpaid || !isOpen(q) ? { tones: { ...(q.unpaid ? { pay: 'bad' as const } : {}), ...(!isOpen(q) && q.state !== 'done' ? { state: 'muted' as const } : {}) } } : {}) });
      return [...chains.values()].map((qs) => {
        const rows = qs.map(row).sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0) || natural(a.cells.text, b.cells.text));
        const last = rows[rows.length - 1];
        const givers = [...new Set(rows.map((r) => r.cells.giver))];
        return { id: `chain-${rows[0].id}`, title: rows[0].cells.text, rows, value: String(rows.length), unit: unitOf(rows.length, 'quest'), sub: '', how: '',
          combined: { giver: givers.length === 1 ? givers[0] : 'Mixed', goal: last.cells.goal, pay: last.cells.pay, due: last.cells.due, state: last.cells.state } };
      }).sort((a, b) => (a.rows[0].sortKey ?? 0) - (b.rows[0].sortKey ?? 0));
    },
    tiles: (s) => QUEST_STATES.filter((st) => s.quests.some((q) => q.state === st)).map((st) => {
      const qs = s.quests.filter((q) => q.state === st);
      return { id: st, label: QUEST_STATE_NAME[st], value: String(qs.length), unit: unitOf(qs.length, 'quest'), sub: `latest: ${qs[qs.length - 1].text}`, how: `Quests whose state is ${QUEST_STATE_NAME[st].toLowerCase()}.` };
    }),
    tileOf: (s, row) => quest(s, row.id)?.state ?? '',
    panelHead: (s, id) => {
      const q = quest(s, id);
      if (!q || !isOpen(q)) return h('span');
      const b = h('button', { type: 'button', class: 'hs-btn-text', style: 'margin-left:auto' });
      const draw = () => { const on = !!quest(s, id)?.pinned; b.textContent = on ? '✓ Pinned' : 'Pin to quest line'; b.setAttribute('aria-pressed', String(on)); };
      b.onclick = () => { api.pinQuest(id); draw(); };
      draw();
      return b;
    },
    detail: (s, id) => {
      const q = quest(s, id);
      if (!q) return [];
      const chain = questChain(s, q);
      const before = q.after ? quest(s, q.after) : undefined;
      return [
        ...(chain.length > 1 ? [{ k: 'Step', v: `${chain.indexOf(q) + 1} of ${chain.length}` }] : []),
        ...(before ? [{ k: 'Follows', v: before.text }] : []),
        ...(q.goal.kind === 'other' ? [{ k: 'How it ends', v: 'The giver judges it when you report back.' }] : []),
        ...(isOpen(q) ? [{ k: '', v: abandonButton(api, id) }] : []),
      ];
    },
    line: (s) => {
      const done = s.quests.filter((q) => q.state === 'done');
      return `${plural(done.length, 'quest')} done · ${done.reduce((n, q) => n + rewardXp(q.level), 0)} XP from quests`;
    },
  });
}

// ---------- Achievements and Scars ----------
/** two sub-tabs: Achievements and Scars (negative achievements, AchievementDef.scar). Earned ones only, grouped by reward level. */
export function achievementsPage(api: GameApi) {
  let scars = false;
  const tab = (on: boolean, label: string, redraw: () => void) =>
    h('button', { type: 'button', role: 'tab', 'aria-selected': String(scars === on), onclick: () => { scars = on; redraw(); } }, label);
  return listPage(api, {
    get title() { return scars ? 'Scars' : 'Achievements'; },
    get intro() { return scars ? 'What went wrong and left its mark on you. Same as /achievements.' : 'Deeds that earned you a name, and the XP they paid. One line per chain; click it for its earlier levels and branches. Same as /achievements.'; },
    get noun(): [string, string] { return scars ? ['scar chain', 'scar chains'] : ['chain', 'chains']; },
    get empty() { return scars ? 'No scars yet.' : 'No achievements yet. Defeat foes, win fights, strike deals and explore.'; },
    get panelTitle() { return scars ? 'Scar' : 'Achievement'; },
    top: (redraw) => h('div', { class: 'pk-tabs', role: 'tablist' }, tab(false, 'Achievements', redraw), tab(true, 'Scars', redraw)),
    startOpen: true,
    cols: [{ key: 'name', title: 'Name' }, { key: 'state', title: 'Level' }, { key: 'next', title: 'Next' }, { key: 'turn', title: 'Earned' }],
    detail: (s, id) => chainDetail(s, id, scars),
    groups: (s) => {
      // TB4: tag sections (Combat, Stealth …), one line per chain: its current name, its level ("III of IV"), the next
      // row's count (TB5) and ↻N for every row earned in it, branches included
      const lines = chainLines(s, scars);
      return (Object.keys(ACH_TAGS) as (keyof typeof ACH_TAGS)[]).map((tag) => {
        const rows: TRow[] = lines.filter((l) => l.tag === tag).map((l) => ({ id: l.id, sortKey: l.turn,
          cells: { name: `${l.name}${l.count > 1 ? `  ↻${l.count}` : ''}`, state: l.level, next: l.next ?? '', turn: `turn ${l.turn}` } }));
        const xp = lines.filter((l) => l.tag === tag).reduce((n, l) => n + l.xp, 0);
        return { id: tag, title: ACH_TAGS[tag], rows, value: String(rows.length), unit: unitOf(rows.length, scars ? 'scar chain' : 'chain'),
          sub: `${xp} XP`, how: `${scars ? 'Scar' : 'Achievement'} chains of the ${ACH_TAGS[tag]} section.`, combined: {} };
      }).filter((g) => g.rows.length);
    },
    line: (s) => {
      const lib = getLibrary().achievements ?? {};
      const xp = (s.player.progression?.achievements ?? []).filter((a) => !!lib[a.key ?? '']?.scar === scars).reduce((n, a) => n + achXp(lib[a.key!], a.of), 0);
      return scars ? `${plural((s.player.progression?.achievements ?? []).filter((a) => !!lib[a.key ?? '']?.scar).length, 'scar', 'scars')}, ${xp} XP` : `${xp} XP earned this way`;
    },
  });
}

/** the chain an achievement belongs to, lowest level first: each row's `after` names the level below it */
export const achievementChain = (key: string): string[] => chainRows(key);

type ChainLine = { id: string; tag: string; name: string; level: string; next?: string; count: number; xp: number; turn: number };
/** a chain position in Roman numerals (1 to 39), as the sketch shows it: "III of IV" */
const romanOf = (n: number): string => n < 1 || n > 39 ? String(n) : 'X'.repeat(Math.floor(n / 10)) + ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][n % 10];
/** "III of IV": a held chain's place, its highest held row among all its rows */
const placeText = (c: HeldChain) => `${romanOf(c.rows.indexOf(c.current) + 1)} of ${romanOf(c.rows.length)}`;
/** TB5: the next row's count of a started chain, or that every level is held */
const nextText = (s: GameState, c: HeldChain) => (c.next ? cap(earnedAtText(s, getLibrary().achievements![c.next], c.of)) : c.rows.length > 1 ? 'every level held' : '');
const earnedOf = (s: GameState, c: HeldChain) => (s.player.progression?.achievements ?? []).filter((m) => c.held.includes(m.key ?? '') && (getLibrary().achievements![c.root]?.every || (m.of ?? '') === (c.of ?? '')));

/** TB4: one line per chain head the player has started */
export function chainLines(s: GameState, scars: boolean): ChainLine[] {
  const lib = getLibrary().achievements ?? {};
  return [...heldChains(s, scars)].map(([id, chains]) => {
    const head = id.split(':')[0];
    const trunk = chains.find((c) => c.root === head);
    const earned = chains.flatMap((c) => earnedOf(s, c));
    const latest = earned.reduce((a, b) => (b.turn > a.turn ? b : a), earned[0]);
    const show = trunk ? earnedOf(s, trunk).find((m) => m.key === trunk.current)! : latest;
    const name = isBareHead(head) ? ACH_HEAD_NAMES[head].name : achievementName(s, show);
    return { id, tag: chainTag(head), name, level: trunk ? placeText(trunk) : `${plural(chains.length, 'branch', 'branches')}`,
      ...(trunk && nextText(s, trunk) ? { next: nextText(s, trunk) } : {}), count: earned.length,
      xp: earned.reduce((n, m) => n + achXp(lib[m.key!], m.of), 0), turn: latest.turn };
  });
}

/** the side panel for a chain (TB4 unfold): its current row, how it is earned, the earlier levels, one line per branch
 * kind with its own level and next count, and the chain's combined XP (the trunk's next count is already a column) */
export function chainDetail(s: GameState, id: string, scars: boolean): PanelRow[] {
  const chains = heldChains(s, scars).get(id);
  if (!chains) return [];
  const lib = getLibrary().achievements ?? {};
  const head = id.split(':')[0];
  const trunk = chains.find((c) => c.root === head);
  const rows: PanelRow[] = [];
  if (trunk) {
    const cur = earnedOf(s, trunk).find((m) => m.key === trunk.current)!;
    const info = achievementInfo(s, cur);
    rows.push({ k: 'How it is earned', v: cap(info.earnedAt) }, { k: 'You earned it', v: info.why },
      { k: 'Reward', v: [`Level ${info.levelName} · ${info.xp} XP`, ...info.rewards].join(' · ') });
    if (trunk.held.length > 1) rows.push({ k: 'Earlier', v: trunk.held.slice(0, -1).map((k) => `${achievementName(s, { id: '', key: k, ...(trunk.of ? { of: trunk.of } : {}) })} (${earnedAtText(s, lib[k], trunk.of)})`).join(' · ') });
  }
  for (const c of chains.filter((x) => x !== trunk)) {
    const cur = earnedOf(s, c).find((m) => m.key === c.current)!;
    rows.push({ k: `Branch · ${branchLabel(lib[c.root])}`, v: `${achievementName(s, cur)} · ${placeText(c)}${c.next ? ` · next: ${nextText(s, c)}` : ''}` });
  }
  const earned = chains.flatMap((c) => earnedOf(s, c));
  rows.push({ k: 'Chain XP', v: `${earned.reduce((n, m) => n + achXp(lib[m.key!], m.of), 0)} XP from ${plural(earned.length, 'row', 'rows')}` });
  return rows;
}

/** the side panel for an earned achievement: how it is earned, when you earned it, what it pays, and every level of its chain
 * with how each is earned and whether you have it */
export function achievementDetail(s: GameState, id: string): PanelRow[] {
  const a = (s.player.progression?.achievements ?? []).find((x) => x.id === id);
  if (!a?.key) return [];
  const info = achievementInfo(s, a);
  const rows: PanelRow[] = [
    { k: 'How it is earned', v: cap(info.earnedAt) },
    { k: 'You earned it', v: info.why },
    { k: 'Reward', v: [`Level ${info.levelName} · ${info.xp} XP`, ...info.rewards].join(' · ') },
  ];
  const levels = achievementLevels(s, a.key, a.of);
  if (levels.length > 1) rows.push({ k: 'Every level', v: h('ol', { class: 'ach-chain' }, levels.map((l) =>
    h('li', { class: l.got ? 'got' : '' }, h('b', {}, l.name), ` · ${l.earnedAt} · Level ${l.level}`, l.got ? ' · earned' : ''))) });
  return rows;
}

/** every level of an achievement's chain for one kind (`of`): its name, how it is earned, its reward level, and whether you have it */
export function achievementLevels(s: GameState, key: string, of?: string): { name: string; earnedAt: string; level: string; got: boolean }[] {
  const lib = getLibrary().achievements ?? {};
  const mine = s.player.progression?.achievements ?? [];
  return achievementChain(key).map((k) => ({ name: achievementName(s, { id: '', key: k, of }), earnedAt: cap(earnedAtText(s, lib[k], of)),
    level: rewardName(achLevel(lib[k], of)), got: mine.some((m) => m.key === k && (m.of ?? '') === (of ?? '')) }));
}

// ---------- Journal (Voyage U26, U28) ----------
// Built only from what the character knows: people in view or whose name was learned, places the character was in or
// heard facts about, and the turns played since this page was opened. Never the hidden store.

/** People: whoever the character sees clearly now, and everyone whose name it has learned. */
export function journalPeople(s: GameState): { id: string; name: string; label: string; where: string; health: string }[] {
  const pv = safe(() => buildPlayerView(s));
  const seen = new Map((pv?.actors ?? []).filter((a) => a.level === 'full').map((a) => [a.id, a]));
  const ids = [...new Set([...seen.keys(), ...(s.player.journal?.namesKnown ?? [])])];
  return ids.flatMap((id) => {
    const a = s.actors.find((x) => x.id === id);
    if (!a) return [];
    const v = seen.get(id);
    const zone = v ? pv?.zones.find((z) => z.id === v.zone)?.name : undefined;
    return [{ id, name: v?.name ?? (s.player.journal?.namesKnown.includes(id) ? a.names.current : '–'), label: a.label,
      where: v ? (zone ? `In view · ${zone}` : 'In view') : 'Not in view', health: v?.health ? othersHealthWord(v.health, v.level === 'full') : '–' }];
  });
}

/** the names the character has heard of people who weren't there (PlayerView.heardOf), less anyone already in People */
export function heardOfNames(s: GameState, people = journalPeople(s)): string[] {
  const known = new Set(people.map((p) => p.name.toLowerCase()));
  return (safe(() => buildPlayerView(s))?.heardOf ?? []).filter((n) => !known.has(n.toLowerCase()));
}

/** Places: the current place and the places above it, and every place the character witnessed a fact about. */
export function journalPlaces(s: GameState): { id: string; name: string; parent: string; facts: string[] }[] {
  const byId = new Map(s.places.map((p) => [p.id, p]));
  const known = new Set<string>();
  for (let p = byId.get(s.player.placeId); p && !known.has(p.id); p = p.parentId ? byId.get(p.parentId) : undefined) known.add(p.id);
  const witnessed = new Set(s.player.journal?.factsWitnessed ?? []);
  const facts = s.facts.filter((f) => witnessed.has(f.id));
  for (const f of facts) if (byId.has(f.placeId)) known.add(f.placeId);
  return [...known].map((id) => {
    const p = byId.get(id)!;
    return { id, name: p.names.current, parent: p.parentId ? byId.get(p.parentId)?.names.current ?? '–' : '–',
      facts: facts.filter((f) => f.placeId === id).map((f) => factText(s, f.text)) };
  });
}

const firstSentence = (t: string) => (t.match(/^.*?[.!?](\s|$)/)?.[0] ?? t).trim();

export function journalPage(api: GameApi) {
  const opened = { people: new Set<string>(), places: new Set<string>(), time: new Set<string>() };
  const sorts = { people: { key: 'name', dir: 0 as 0 | 1 | -1 }, places: { key: 'name', dir: 0 as 0 | 1 | -1 }, time: { key: 'turn', dir: 0 as 0 | 1 | -1 } };
  const el = h('main');
  const field = (title: string) => (row: TRow, key: string) => openPanel(title, Object.entries(row.cells).map(([k, v]) => ({ k, v, edit: k === key })), 'Written by the game as you play, so it is read-only here.');
  function update() {
    const s = api.state();
    if (!s) { el.replaceChildren(h('h1', {}, 'Journal'), h('p', { class: 'empty' }, 'No story yet. Create your character first.')); return; }
    const people = journalPeople(s), places = journalPlaces(s);
    const pGroups: TGroup[] = ['In view', 'Not in view'].map((g) => ({ id: 'p-' + g, title: g,
      rows: people.filter((p) => p.where.startsWith(g)).map((p, i) => ({ id: p.id, sortKey: i, cells: { name: p.name, label: p.label, where: p.where, health: p.health } })),
      combined: { label: '', where: g, health: '' } })).filter((g) => g.rows.length);
    // names heard of someone who wasn't there (PlayerView.heardOf); one met since is listed above instead
    const heard = heardOfNames(s, people);
    if (heard.length) pGroups.push({ id: 'p-heard', title: 'Heard of', combined: { label: '', where: 'Never met', health: '' },
      rows: heard.map((name, i) => ({ id: `heard:${i}`, sortKey: i, cells: { name, label: '–', where: 'Heard of, never met', health: '–' } })) });
    const parents = [...new Set(places.map((p) => p.parent))];
    const plGroups: TGroup[] = parents.map((par) => ({ id: 'pl-' + par, title: par === '–' ? 'Top level' : par,
      rows: places.filter((p) => p.parent === par).map((p, i) => ({ id: p.id, sortKey: i, cells: { name: p.name, parent: p.parent, facts: p.facts.join(' ') || '–' } })),
      combined: { parent: par, facts: '' } }));
    const turns = [...new Set(api.lines().map((l) => l.turn))];
    const tGroups: TGroup[] = turns.map((t) => {
      const ls = api.lines().filter((l) => l.turn === t);
      const did = ls.filter((l) => l.kind === 'player').map((l) => l.text).join(' · ');
      const nar = ls.find((l) => l.kind === 'narration');
      return { id: 't-' + t, title: String(t), combined: {}, rows: [{ id: 't' + t, sortKey: t, cells: { turn: String(t), did: did || '–', happened: nar ? firstSentence(nar.text) : '–' } }] };
    }).filter((g) => g.rows[0].cells.did !== '–' || g.rows[0].cells.happened !== '–');
    const sec = (title: string, note: string, table: HTMLElement) => h('div', { class: 'sec' }, h('div', { class: 'head' }, h('h2', { class: 'hs-section' }, title), h('p', { class: 'hs-note' }, note)), table);
    el.replaceChildren(
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Journal'), h('p', {}, 'What your character knows: people, places and what happened. Only what you saw, heard or were told.'))),
      sec('People', `A label until you learn the name. Health shows only from ${HEALTH_LEVELS.name(CONFIG.HEALTH_SHOWN_FROM)} down. Heard of: names you have heard for people you have never met.`,
        groupedTable({ cols: [{ key: 'name', title: 'Name' }, { key: 'label', title: 'Looks like' }, { key: 'where', title: 'Where' }, { key: 'health', title: 'Health' }],
          groups: pGroups, open: opened.people, sort: sorts.people, onField: field('Person'), redraw: update, emptyText: 'Nobody yet.' })),
      sec('Places', 'Places you have been in or heard facts about, folded under the place they belong to. The Map page draws their zones.',
        groupedTable({ cols: [{ key: 'name', title: 'Place' }, { key: 'parent', title: 'Part of' }, { key: 'facts', title: 'What you know' }],
          groups: plGroups, open: opened.places, sort: sorts.places, onField: field('Place'), redraw: update, emptyText: 'No places yet.' })),
      sec('Timeline', 'Turns played since this page was opened, oldest first.',
        groupedTable({ cols: [{ key: 'turn', title: 'Turn', right: true }, { key: 'did', title: 'You did' }, { key: 'happened', title: 'What happened' }],
          groups: tGroups, open: opened.time, sort: sorts.time, onField: field('Turn'), redraw: update, emptyText: 'Nothing yet this session.' })));
  }
  return { el, update };
}
