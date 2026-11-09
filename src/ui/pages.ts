// Character (/stats) uses the character sheet (charsheet.ts). Inventory (/inv) and Quests (/quests) share one page shape. Visibility tiles on top (one per group),
// figures that can't be filtered in a text line under them, then the grouped table.
import { PART_STATES } from '../scales';
import type { Actor, GameApi, GameState, Quest } from '../types';
import { QUEST_STATES } from '../types';
import { QUEST_STATE_NAME, dueText, isOpen, payText, questChain } from '../engine/quests';
import { getLibrary, itemDef } from '../library';
import { QUEST_REWARD_LEVELS, REWARD_LEVELS } from '../scales';
import { achievementName } from '../engine/xp';
import { CONFIG } from '../config';
import { requirement, shortBy } from '../ruleset/requirements';
import { kitBonus } from '../ruleset/gear';
import { skillName } from '../library/skillNames';
import { isDownLevel } from '../ruleset';
import { buildPlayerView, callName, factText, questGoalText } from '../views';
import { closePanel, groupedTable, type PanelRow, h, natural, openPanel, plural, unitOf, visPass, visTiles, type Col, type TGroup, type TRow, type VisState, type VisTile } from './kit';
import { charCard, invFocus, treeBars } from './charsheet';
import { perksSection, refreshPerks } from './perks';
import { healItems, quickHeal } from './healing';
import { IT } from '../library/itemIds';

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
};

export function listPage(api: GameApi, spec: Spec): { el: HTMLElement; update: () => void } {
  const picks: Record<string, VisState> = {};
  const open = new Set<string>();
  const sort = { key: spec.cols[0].key, dir: 0 as 0 | 1 | -1 };
  const el = h('main');
  const how = h('p', { class: 'how', hidden: true });

  function update() {
    const s = api.state();
    if (!s) { el.replaceChildren(h('h1', {}, spec.title), h('p', { class: 'empty' }, 'No story yet. Create your swordsman first.')); return; }
    const all = spec.groups(s);
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
      : 'Click a box: once for Shown, twice for Left out, three times to clear. Click a heading to open its rows.';
    el.replaceChildren(
      ...(spec.top ? [spec.top(update)] : []),
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, spec.title), h('p', {}, spec.intro))),
      h('div', { class: 'sec' },
        all.length ? visTiles(spec.tiles?.(s) ?? all.map((g) => ({ id: g.id, label: g.title, value: g.value, unit: g.unit, sub: g.sub, how: g.how })), picks, update, onOpen, how) : null,
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
    if (!s) { el.replaceChildren(h('h1', {}, 'Character'), h('p', { class: 'empty' }, 'No story yet. Create your swordsman first.')); return; }
    el.replaceChildren(
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Character'), h('p', {}, 'Who you are and what you can do. Same as /stats.'))),
      h('div', { class: 'cs-split' }, charCard(s, s.player), treeBars(s, s.player)),
      h('p', { class: 'hs-note' }, 'The 8 health segments are the health track, Unhurt to Incapacitated. ✦ marks a tagged skill. Bars are drawn out of 100 for display only; the rules set no skill maximum yet (D-3).'),
      perks);
    refreshPerks();
  }
  return { el, update };
}

const KIND_GROUP: Record<string, [string, string, string]> = {
  weapon: ['weapons', 'Weapons', 'c10'], shield: ['shields', 'Shields', 'c1'], armor: ['armor', 'Armor', 'c12'],
};
/** EQ7: "Medium Weapons 50" */
const needText = (r: { skill: string; need: number }) => `${skillName(r.skill)} ${r.need}`;

function where(a: Actor, slots: string[] | undefined): string {
  if (!slots?.length) return 'Carried';
  return slots.map((x) => x === 'armor' ? 'Worn' : x.startsWith('hand:') ? `Held · ${x.slice(5).replace('_arm', ' hand')}` : x.startsWith('acc:') ? 'Worn accessory' : x).join(', ');
}

export function inventoryPage(api: GameApi) {
  return listPage(api, {
    title: 'Inventory', intro: 'What you carry. Same as /inv. Click an item for its stats.', noun: ['item', 'items'], panelTitle: 'Item', empty: 'You carry nothing.',
    focus: () => { const id = invFocus.id; invFocus.id = null; return id; },
    detail: (s, id) => {
      const it = s.player.core.inventory.find((i) => i.id === id);
      const d = it ? safe(() => itemDef(s, it.itemId)) : null;
      if (!d) return [];
      const sign = (n = 0) => (n >= 0 ? '+' : '') + n;
      const rows: PanelRow[] = [{ k: 'Look', v: d.look }, { k: 'Kind', v: d.kind }];
      if (d.hands) rows.push({ k: 'Hands', v: String(d.hands) });
      for (const m of d.weapon?.modes ?? []) rows.push({ k: `Attack · ${m.name ?? m.id}`, v: `${m.tree} ${m.class}, reach ${m.reach}, damage ${sign(m.damageAdj)}, hit ${sign(m.hitAdj)}` });
      if (d.armor) rows.push({ k: 'Armor', v: `${d.armor.weight}, covers ${d.armor.covers.join(', ')}, reduction ${d.armor.reduction}, multiplier ×${d.armor.multiplier}` });
      if (d.shield) rows.push({ k: 'Shield pool', v: String(d.shield.pool) });
      for (const e of d.effects ?? []) rows.push({ k: e.kit ? 'Standard kit' : 'Effect', v: `${sign(e.kit ? kitBonus(d, e) : e.value)} to ${e.kind === 'skill' ? (e.skill === '$mode' ? 'the attack skill' : e.skill) : `${e.roll} rolls`} while ${e.active}${e.kit ? ' (kit pieces share one bonus per roll)' : ''}` });
      const heal = healItems(s, s.player).find((x) => x.itemId === it!.itemId);
      if (heal) {
        const r = heal.row;
        rows.push({ k: 'Heals', v: `${r.hpPct}% health and ${r.partPct}% to each body part${PART_STATES.pos(r.reach) >= PART_STATES.pos('crippled') ? ', mends Crippled parts' : ''}${r.inFight ? ', works in a fight' : ', not in a fight'}` });
        // H3 b: the player picks which healing item the quick slot beside Aim shows
        const btn = h('button', { type: 'button', class: 'hs-btn-text', style: 'min-height:0;padding:0' });
        const draw = () => {
          const on = quickHeal(s, s.player)?.itemId === heal.itemId;
          btn.textContent = on ? 'Shown in the quick slot' : 'Show in the quick slot';
          btn.disabled = on;
        };
        btn.onclick = () => { if (s.player.progression) { s.player.progression.quickHeal = heal.itemId; draw(); } };
        draw();
        rows.push({ k: 'Quick slot', v: btn });
      }
      // EQ7: the requirement, red while the player is short, grey once met
      const need = requirement(d);
      if (need) {
        const short = shortBy(s.player, d), steps = Math.ceil(short / CONFIG.EQUIP_SHORT_STEP);
        const rolls = d.armor ? 'Dodge and stealth rolls while worn' : 'rolls with it';
        rows.push({ k: 'Needs', v: h('span', { class: short > 0 ? 'tone-bad' : 'tone-muted' }, short > 0
          ? `${needText(need)} (you have ${Math.round((need.need - short) * 10) / 10}: ${plural(steps, 'outcome step')} worse on ${rolls})`
          : `${needText(need)} (met)`) });
      }
      rows.push({ k: 'Bulk', v: String(d.bulk) });
      return rows;
    },
    cols: [{ key: 'name', title: 'Item' }, { key: 'where', title: 'Where' }, { key: 'needs', title: 'Needs' }, { key: 'qty', title: 'Qty', right: true }, { key: 'cond', title: 'Condition' }],
    groups: (s) => {
      const p = s.player, groups = new Map<string, TGroup & { sub: string; value: string; unit: string; how: string }>();
      p.core.inventory.filter((i) => i.itemId !== IT.coin).forEach((it, n) => {
        const d = safe(() => itemDef(s, it.itemId));
        const [id, title, color] = KIND_GROUP[d?.kind ?? ''] ?? ['other', 'Other', 'c3'];
        const g = groups.get(id) ?? { id, title, color, rows: [], combined: {}, value: '', unit: 'items', sub: '', how: `Everything of this kind you carry.` };
        const pools = it.pools ? Object.entries(it.pools).map(([k, v]) => `${k} ${v}%`).join(', ') : 'Whole';
        const need = d ? requirement(d) : null;
        const needs = need ? `Needs ${needText(need)}` : '';
        g.rows.push({ id: it.id, sortKey: n, cells: { name: d?.name ?? it.itemId, where: where(p, it.equippedIn), needs, qty: String(it.qty ?? 1), cond: pools },
          ...(need ? { tones: { needs: shortBy(p, d!) > 0 ? 'bad' as const : 'muted' as const } } : {}) });
        groups.set(id, g);
      });
      return [...groups.values()].map((g) => {
        const qty = g.rows.reduce((a, r) => a + +r.cells.qty, 0);
        const ws = [...new Set(g.rows.map((r) => r.cells.where))], cs = [...new Set(g.rows.map((r) => r.cells.cond))];
        const ns = [...new Set(g.rows.map((r) => r.cells.needs))], ts = [...new Set(g.rows.map((r) => r.tones?.needs))];
        const equipped = g.rows.filter((r) => r.cells.where !== 'Carried').length;
        return { ...g, value: String(qty), unit: unitOf(qty, 'item'), sub: `${equipped} in use`, combined: { qty: String(qty), where: ws.length === 1 ? ws[0] : 'Mixed', cond: cs.length === 1 ? cs[0] : 'Mixed', needs: ns.length === 1 ? ns[0] : '' },
          ...(ns.length === 1 && ts.length === 1 && ts[0] ? { combinedTones: { needs: ts[0] } } : {}) };
      }).sort((a, b) => (a.id === 'other' ? 1 : 0) - (b.id === 'other' ? 1 : 0) || natural(a.title, b.title));
    },
    line: (s) => {
      const coin = s.player.core.inventory.filter((i) => i.itemId === IT.coin).reduce((a, i) => a + (i.qty ?? 1), 0);
      return `Coin ${coin}`;
    },
  });
}

/** a quest to open on arrival (the Play screen's quest line) */
export const questFocus: { id: string | null } = { id: null };
const titleCase = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

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
        text: q.text, giver: titleCase(callName(s, s.player.id, q.giver)), goal: questGoalText(s, q),
        reward: `Level ${QUEST_REWARD_LEVELS.name(q.level)} · ${CONFIG.QUEST_REWARD_XP[q.level] ?? 0} XP`, pay: payText(s, q),
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
      return `${plural(done.length, 'quest')} done · ${done.reduce((n, q) => n + (CONFIG.QUEST_REWARD_XP[q.level] ?? 0), 0)} XP from quests`;
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
    get intro() { return scars ? 'What went wrong and left its mark on you. Same as /achievements.' : 'Deeds that earned you a name, and the XP they paid. Same as /achievements.'; },
    get noun(): [string, string] { return scars ? ['scar', 'scars'] : ['achievement', 'achievements']; },
    get empty() { return scars ? 'No scars yet.' : 'No achievements yet. Defeat foes, win fights, strike deals and explore.'; },
    get panelTitle() { return scars ? 'Scar' : 'Achievement'; },
    top: (redraw) => h('div', { class: 'pk-tabs', role: 'tablist' }, tab(false, 'Achievements', redraw), tab(true, 'Scars', redraw)),
    cols: [{ key: 'name', title: 'Name' }, { key: 'state', title: 'State' }, { key: 'turn', title: 'Earned' }],
    groups: (s) => {
      const lib = getLibrary().achievements ?? {};
      const mine = (s.player.progression?.achievements ?? []).filter((a) => !!lib[a.key ?? '']?.scar === scars);
      return REWARD_LEVELS.keys.map((lv) => {
        const rows: TRow[] = mine.filter((a) => lib[a.key!].level === lv).map((a) => ({ id: a.id, sortKey: a.turn,
          cells: { name: achievementName(s, a), state: a.replacedBy ? 'Replaced by the next level' : 'Current', turn: `turn ${a.turn}` },
          ...(a.replacedBy ? { tones: { state: 'muted' as const } } : {}) }));
        const title = `Level ${REWARD_LEVELS.name(lv)}`;
        return { id: lv, title, rows, value: String(rows.length), unit: unitOf(rows.length, scars ? 'scar' : 'achievement'),
          sub: `${CONFIG.REWARD_XP[lv] ?? 0} XP each`, how: `${scars ? 'Scars' : 'Achievements'} of reward ${title}.`, combined: {} };
      }).filter((g) => g.rows.length);
    },
    line: (s) => {
      const lib = getLibrary().achievements ?? {};
      const xp = (s.player.progression?.achievements ?? []).filter((a) => !!lib[a.key ?? '']?.scar === scars).reduce((n, a) => n + (CONFIG.REWARD_XP[lib[a.key!].level] ?? 0), 0);
      return `${xp} XP earned this way`;
    },
  });
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
      where: v ? (zone ? `In view · ${zone}` : 'In view') : 'Not in view', health: v?.health && isDownLevel(v.health) ? 'Down' : v?.health ?? '–' }];
  });
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
    if (!s) { el.replaceChildren(h('h1', {}, 'Journal'), h('p', { class: 'empty' }, 'No story yet. Create your swordsman first.')); return; }
    const people = journalPeople(s), places = journalPlaces(s);
    const pGroups: TGroup[] = ['In view', 'Not in view'].map((g) => ({ id: 'p-' + g, title: g,
      rows: people.filter((p) => p.where.startsWith(g)).map((p, i) => ({ id: p.id, sortKey: i, cells: { name: p.name, label: p.label, where: p.where, health: p.health } })),
      combined: { label: '', where: g, health: '' } })).filter((g) => g.rows.length);
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
      sec('People', 'A label until you learn the name. Health shows only from Wounded down.',
        groupedTable({ cols: [{ key: 'name', title: 'Name' }, { key: 'label', title: 'Looks like' }, { key: 'where', title: 'Where' }, { key: 'health', title: 'Health' }],
          groups: pGroups, open: opened.people, sort: sorts.people, onField: field('Person'), redraw: update, emptyText: 'Nobody yet.' })),
      sec('Places', 'Places you have been in or heard facts about, folded under the place they belong to. The game draws no maps.',
        groupedTable({ cols: [{ key: 'name', title: 'Place' }, { key: 'parent', title: 'Part of' }, { key: 'facts', title: 'What you know' }],
          groups: plGroups, open: opened.places, sort: sorts.places, onField: field('Place'), redraw: update, emptyText: 'No places yet.' })),
      sec('Timeline', 'Turns played since this page was opened, oldest first.',
        groupedTable({ cols: [{ key: 'turn', title: 'Turn', right: true }, { key: 'did', title: 'You did' }, { key: 'happened', title: 'What happened' }],
          groups: tGroups, open: opened.time, sort: sorts.time, onField: field('Turn'), redraw: update, emptyText: 'Nothing yet this session.' })));
  }
  return { el, update };
}
