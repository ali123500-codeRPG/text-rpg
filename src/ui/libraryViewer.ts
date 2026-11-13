// Library viewer: every library table drawn from the same modules the game runs, so it shows the
// library exactly as code sees it. Bundled into dist/library/ by scripts/build.mjs. Tables without a custom view
// get the generic cards, so a new table shows up with no edit here.
import { BT } from '../library/raceIds';
import './styles.css';
import './libraryViewer.css';
import type { EssenceDef, Personality, TierUnlock, ClassDef, HealingDef, FearDef, ComposureDef, AchievementDef, AchievementTag, BodyType, ItemDef, ItemEffect, Library, PerkDef, PerkWriteup, TreeAccess } from '../types';
import { classTree, condName } from '../ruleset/access';
import { baneSkill, defeatsRoll, isBane } from '../ruleset/bane';
import { achLevel, achXp, rewardLines, rewardName, tierUnlockLine } from '../ruleset/achRewards';
import { ACH_RULE_TEXT, ACH_TAGS } from '../library/achievementIds';
import { MOD_SOURCES, MOD_TYPE_NAMES, type ModSource, type StackedType } from '../ruleset/modSources';
import { modTotal, stackType } from '../ruleset';
import { equations } from '../ruleset/equations';
import { benefits, itemValue } from '../ruleset/value';
import { fnSkills, kitBonus, modeName, modeReach, standInShare, standInTable } from '../ruleset/gear';
import { prototypeLibrary } from '../library/data';
import { PERK_WRITEUPS } from '../library/perks';
import { BOOST_PERKS } from '../library/boostPerks';
import { FUNCTION_GROUP, FUNCTION_ROLLS, GROUP_NAMES, groupName, groupsOf, functionName } from '../library/functionNames';
import { CONFIG } from '../config';
import { ESSENCE_GRADES, LIFE_STAGES, THREADBOUND_RANKS, type ThreadboundRankKey, NERVE_LINES, type NerveLine, type Scale, INTELLIGENCE, CLASS_TIERS, EQUIP_LEVELS, PART_STATES, QUEST_REWARD_LEVELS, REWARD_LEVELS, SKILL_TIERS, XP_FACTORS, type XpFactorKey } from '../scales';
import { earnedAtText, sourceRowName, xpGroupFactor } from '../engine/xp';
import { GOAL_KINDS, QUEST_STATES, type GameState, type QuestState } from '../types/state';
import { QUEST_STATE_NAME } from '../engine/quests';
import { partFearCost } from '../ruleset/morale';
import { nerveLine } from '../ruleset/personality';
import { GRADES } from '../types/core';
/** earnedAtText only reads state to name a granted kind; the library shows definitions, so it passes none */
const NO_STATE = {} as GameState;
import { itemLevel, requirement } from '../ruleset/requirements';
import { fmtDate, h } from './kit';
import { toneTable } from './libraryTones';
import { skillName } from './creation';
import { ALL_BUNDLES } from '../library/allPerks';
import { classFloors } from '../library/spawn';
import { partName } from './healing';
import { SENSE_SKILL, SK } from '../library/skillIds';
import { PK } from '../library/perkIds';
import { classMaxLevel } from '../library/spawn';

declare const __BUILD__: { sha: string; date: string };
const lib: Library = prototypeLibrary();
type Entry = Record<string, unknown>;
type Section = { key: string; title: string; table: keyof Library; view?: () => (HTMLElement | null)[]; count?: number };

const label = (id: string) => partName(id);
const chip = (text: string, tone?: string) => h('span', { class: 'hs-tg cap', style: tone ? `--tg: var(${tone})` : undefined }, text);
const link = (sec: string, id: string, text = id) => h('a', { class: 'lv-link', href: `#${sec}/${id}` }, text);
const none = (text = 'none yet') => h('span', { class: 'lv-none' }, text);
const row = (k: string, ...v: (Node | string | null)[]) => h('div', { class: 'lv-row' }, h('span', { class: 'lv-k' }, k), h('span', { class: 'lv-v' }, ...v));
const raw = (e: unknown) => h('details', { class: 'lv-raw' }, h('summary', {}, 'Code'), h('pre', {}, JSON.stringify(e, null, 2)));

/** filter buttons: each section names [group, value] pairs per entry; generic tables get them from their short fields */
type Facets = (e: any) => [string, string | number | boolean | undefined][];
let facetOf: Facets = () => [];
function card(sec: string, id: string, entry: unknown, title: string, chips: (HTMLElement | null)[], ...body: (Node | null)[]): HTMLElement {
  const f = facetOf(entry).filter(([, v]) => v !== undefined && v !== '').map(([g, v]) => `${g}\t${v}`);
  return h('article', { class: 'lv-card', id: `${sec}/${id}`, 'data-q': `${title} ${f.map((x) => x.split('\t')[1]).join(' ')} ${JSON.stringify(entry)}`.toLowerCase(), 'data-f': [...new Set(f)].join('\n') },
    h('header', {}, h('h3', {}, h('a', { class: 'lv-title', href: `#${sec}/${id}` }, title)), h('code', { class: 'lv-id' }, id), ...chips),
    // the fields sit in one box, so cards side by side in a grid start their fields on the same line (subgrid)
    h('div', { class: 'lv-cbody' }, ...body, raw(entry)));
}

/** any value as code holds it: primitives as text, lists as chips, objects as nested rows */
/** a field key as words: raceId → Race, focusTreeId → Focus tree, hpMultiplier → Hp multiplier */
const humanKey = (k: string): string => { if (!/^[a-z][A-Za-z0-9_]*$/.test(k)) return k; const w = k.replace(/Ids?$/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase().replace(/^fn\b/, 'function'); return w.charAt(0).toUpperCase() + w.slice(1); };
/** typed ids (RC1, CL6, IT2, SK1 …) shown as their entry's name, linked to its pop-up; the raw id stays in the Code view */
let idIndex: Map<string, [string | null, string]> | undefined;
function typedId(v: string): Node | null {
  if (!/^[A-Z]{2,3}\d+$/.test(v)) return null;
  if (!idIndex) {
    idIndex = new Map();
    for (const sec of SECTIONS) for (const [id, e] of Object.entries(lib[sec.table] as Record<string, Entry>)) {
      if (!idIndex.has(id)) idIndex.set(id, [sec.key, String(e.name ?? e.label ?? (sec.table === 'skills' ? skillName(id) : id))]);
    }
    for (const [id, t] of Object.entries(lib.trees)) if (!idIndex.has(id)) idIndex.set(id, [null, (t as { name?: string }).name ?? id]);
  }
  const hit = idIndex.get(v);
  if (!hit) { // functions and groups are not tables; show their names, linked to the stand-in check where one exists
    const name = v.startsWith('FN') ? functionName(v) : v.startsWith('GR') ? groupName(v) : undefined;
    return name && name !== v ? (v.startsWith('FN') ? link('standIns', `fn-${v}`, name) : h('span', { title: v }, name)) : null;
  }
  return hit[0] ? link(hit[0], v, hit[1]) : h('span', { title: v }, hit[1]);
}
function val(v: unknown, depth = 0): Node | string {
  if (v === null || v === undefined) return none('—');
  if (v instanceof Node) return v;
  if (typeof v === 'string') { const t = typedId(v); if (t) return t; }
  if (Array.isArray(v)) {
    if (!v.length) return none('empty');
    if (v.every((x) => typeof x === 'string' && typedId(x))) return h('span', {}, ...v.flatMap((x, i) => [i ? ', ' : '', typedId(x as string)!]));
    if (v.every((x) => typeof x !== 'object')) return h('span', { class: 'lv-chips' }, v.map((x) => chip(String(x))));
    return h('div', { class: 'lv-sub' }, v.map((x) => h('div', { class: 'lv-subitem' }, val(x, depth + 1))));
  }
  if (typeof v === 'object') return depth > 3 ? JSON.stringify(v) : h('div', { class: 'lv-sub' }, Object.entries(v).map(([k, x]) => row(humanKey(k), val(x, depth + 1))));
  return String(v);
}
/** skill IDs are codes: show a skill field, or a table keyed by skill, by the skill's name */
const SKILL_KEYED = new Set(['minimums', 'skills', 'trueSkillTo', 'gains', 'floors', 'unlock', 'unlockAny']);
const named = (k: string, v: unknown): unknown => {
  if (k === 'skill' && typeof v === 'string') return skillName(v);
  // the game's own wording for tier unlocks (D-211), on perks and anywhere else the field turns up
  if (k === 'tierUnlocks' && Array.isArray(v)) return v.map((u) => tierUnlockLine(u as TierUnlock)).join('; ');
  // personality points (PL1, PL15, PL16) in words: axis names, signed points, the Nerve line, values as links
  if (k === 'personality' && v && typeof v === 'object') {
    const sg = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
    const pts = (o: Record<string, number>) => Object.entries(o).map(([a, n]) => `${a === 'nerve' ? 'Nerve' : lib.personalityAxes?.[a]?.name ?? a} ${sg(n)}`);
    if (!('traits' in v)) return pts(v as Record<string, number>).join(', ') || none('none');
    const p = v as Personality, line = nerveLine(p);
    return { Nerve: h('span', {}, `${sg(p.nerve)} (`, link('nerve', line, `${label(line)} line`), ')'),
      Traits: pts(p.traits).join(', ') || none('none'), Values: p.values.length ? p.values : none('none') };
  }
  // fields that hold perk ids show each perk as a link that opens its details
  const perkLinks = (ids: string[]) => links('perks', ids.map((id) => [id, lib.perks[id]?.name ?? id]));
  if (k === 'unlockPerk' && typeof v === 'string') return perkLinks([v]);
  if (k === 'levelPerks' && v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([lv, ids]) => [`level ${lv}`, perkLinks(ids as string[])]));
  if (/perks?$|quirks?$/i.test(k) && Array.isArray(v) && v.length && v.every((x) => typeof x === 'string' && lib.perks[x])) return perkLinks(v as string[]);
  if (Array.isArray(v)) return v.map((x) => (x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([a, b]) => (SKILL_KEYED.has(k) ? [skillName(a), b] : [a, named(a, b)]))) : SKILL_KEYED.has(k) && typeof x === 'string' ? skillName(x) : x));
  if (SKILL_KEYED.has(k) && v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([a, b]) => [skillName(a), b]));
  return v;
};
const fields = (e: Entry, skip: string[]) => Object.entries(e).filter(([k]) => !skip.includes(k)).map(([k, v]) => row(humanKey(k), val(named(k, v))));

function generic(sec: string, table: Record<string, Entry>): HTMLElement[] {
  return Object.entries(table).map(([id, e]) => {
    const title = String(e.name ?? e.label ?? e.brief ?? e.look ?? label(id));
    return card(sec, id, e, title, [], ...fields(e, ['id', 'name']));
  });
}

// ---------- Body figure: a body type's parts, tinted by impact or lit when an item covers them ----------
const IMPACT_TONE: Record<string, string> = { essential: 'lv-ess', normal: 'lv-norm', non_essential: 'lv-non' };
function figure(ct: BodyType | undefined, cls: (part: string) => string): HTMLElement | null {
  if (!ct?.figure) return null;
  const f = h('div', { class: 'bf-svg lv-fig' });
  f.innerHTML = `<svg viewBox="${ct.figure.viewBox}" role="img" aria-label="${ct.name} body">${Object.entries(ct.figure.parts)
    .map(([id, d]) => `<path class="${cls(id)}" d="${d}"><title>${id === 'general' ? ct.general.name : label(id)}</title></path>`).join('')}</svg>`;
  return f;
}
const impactOf = (ct: BodyType, part: string) => (part === 'general' ? 'essential' : ct.parts.find((p) => p.id === part)?.impact ?? 'normal');

// ---------- Gear ----------
const ACTIVE: Record<ItemEffect['active'], string> = { worn: 'when worn', held: 'when held', inUse: 'while in use', carried: 'when carried' };
function effectParts(e: ItemEffect, def?: ItemDef): [string, string[]] {
  const what = e.kind === 'skill' ? (e.skill === '$mode' ? 'skill of the attack mode used' : skillName(String(e.skill))) : `${e.roll} rolls`;
  const v = e.kit && def ? kitBonus(def, e) : e.value; // a kit piece: EQUIP_FACTOR × its need, as the game reads it
  return [`${v > 0 ? '+' : ''}${+v.toFixed(2)} ${what}`, [ACTIVE[e.active], ...(e.scope === 'withItem' ? ['with this item only'] : []), ...(e.kit ? ['kit'] : [])]];
}
/** a multi-part value as one line: the lead in full, the rest as quiet aligned bits (no " · " strings) */
const parts = (lead: Node | string, bits: (string | null | false | undefined)[]) =>
  h('div', { class: 'lv-part' }, h('b', {}, lead), h('span', { class: 'lv-bits' }, ...bits.filter((b): b is string => !!b).map((b) => h('span', {}, b))));
function gearCard(i: ItemDef, id = i.id): HTMLElement {
  const humanoid = lib.bodyTypes[BT.humanoid];
  const req = requirement(i);
  const flags = (['concealed', 'stackable', 'consumable', 'visible'] as const).filter((f) => i[f]).map((f) => chip(f, toneFor('Flag', f)));
  const covers = new Set(i.armor?.covers ?? []);
  return card('gear', id, i, label(i.name), [chip(i.kind, toneFor('Kind', i.kind)), ...flags, ...(i.tags ?? []).map((t) => chip(t, toneFor('Flag', t)))],
    h('p', { class: 'lv-look' }, i.look),
    i.gearClass ? row('Gear class', typedId(i.gearClass) ?? i.gearClass) : null,
    req ? row('Needs', `${req.need} true skill in `, link('skills', req.skill, skillName(req.skill)), ` (${EQUIP_LEVELS.name(req.level)} item)`) : row('Needs', none('nothing')),
    row('Bulk', String(i.bulk)), row('Value', `${itemValue(null, i)} coin${benefits(i).length ? ` (${benefits(i).map((b) => `${b.what}: ${+b.coin.toFixed(2)}`).join(' · ')})` : ''}`),
    i.hands !== undefined ? row('Hands', String(i.hands)) : null,
    i.slot ? row('Slot', i.slot) : null,
    i.weapon ? row('Modes', h('div', { class: 'lv-plist' }, i.weapon.modes.map((m) => { const row = lib.attackModes?.[m.id]; return parts(modeName(m), [`${m.tree} ${m.class}`,
      `${m.thrown ? 'thrown' : 'reach'} ${modeReach(m)} m`, `${m.hands} hand${m.hands === 1 ? '' : 's'}`,
      m.skill && skillName(m.skill), m.thrown && 'thrown', row?.blend && `combined roll (${row.blend.weapon} own skill + ${row.blend.ranged} ranged)`, m.hitAdj ? `hit ${m.hitAdj > 0 ? '+' : ''}${m.hitAdj}` : null]); }))) : null,
    i.armor ? h('div', { class: 'lv-armor' }, figure(humanoid, (p) => (covers.has(p) ? 'lv-on' : 'lv-off')),
      h('div', {}, row('Weight', i.armor.weight), row('Reduction', String(i.armor.reduction)), row('Multiplier', `×${i.armor.multiplier}`),
        row('Covers', val(i.armor.covers.map(label))), i.armor.pools ? row('Pools', val(i.armor.pools)) : null)) : null,
    i.shield ? row('Shield pool', String(i.shield.pool)) : null,
    i.effects?.length ? row('Effects', h('div', { class: 'lv-plist' }, i.effects.map((e) => { const [lead, bits] = effectParts(e, i); return parts(lead, bits); }))) : null,
    i.heal ? row('Heals as', link('healing', i.heal, lib.healing?.[i.heal]?.name ?? i.heal)) : null);
}
function gear(): HTMLElement[] {
  const kinds = [...new Set(Object.values(lib.items).map((i) => i.kind))];
  const all = kinds.map((kind) => h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, `${label(kind)}`),
    h('div', { class: 'lv-grid' }, Object.values(lib.items).filter((i) => i.kind === kind).map((i) => gearCard(i)))));
  // the starter kit: every item tagged 'starter' (starterKit in src/library/spawn.ts)
  const kit = Object.values(lib.items).filter((i) => i.tags?.includes('starter'));
  const rule = h('article', { class: 'lv-card lv-fixed' }, h('header', {}, h('h3', {}, 'How the starter kit is given'), chip('starterKit · src/library/spawn.ts')),
    h('ol', { class: 'lv-steps' },
      h('li', {}, 'After creation the player gets, for each gear class, the highest-level item tagged starter whose equip requirement the build meets (shortBy = 0; a stand-in skill counts at its share). Every class has a 25 and a 50 piece.'),
      h('li', {}, 'Held: the met weapon whose required skill is highest, then the higher item level. A met shield goes in the other hand unless that weapon takes two hands.'),
      h('li', {}, 'Worn: the highest-level armor met.'),
      h('li', {}, 'Everything else met is carried in the pack.')));
  const kitKinds = [...new Set(kit.map((i) => i.kind))];
  return panes([
    { key: 'all', title: 'All gear', n: Object.keys(lib.items).length, content: all },
    { key: 'starter', title: 'Starter kit', n: kit.length, content: [
      h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, 'Starter kit'), h('div', { class: 'lv-grid wide' }, rule)),
      ...kitKinds.map((kind) => h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, `Starter ${label(kind)}`),
        h('div', { class: 'lv-grid' }, kit.filter((i) => i.kind === kind).map((i) => gearCard(i, `starter-${i.id}`)))))] },
  ]);
}

// ---------- Perks: the ladder grid (skill × milestone), then every perk ----------
/** colour coding (libraryTones.ts): one colour per filter value, built once from every tab at start-up */
let TONES: Map<string, Map<string, string>> | undefined;
const toneFor = (group: string, value: string): string | undefined => TONES?.get(group)?.get(value);
/** names-table order for groups that have one; other groups sort by name */
const TONE_ORDER: Record<string, readonly string[]> = {
  Level: REWARD_LEVELS.keys.map((k) => `Level ${REWARD_LEVELS.name(k)}`), Tier: CLASS_TIERS.keys.map((k) => CLASS_TIERS.name(k)),
  Intelligence: INTELLIGENCE.keys.map((k) => INTELLIGENCE.name(k)), Tag: Object.values(ACH_TAGS), Class: ['light', 'medium', 'heavy'],
};
const TIER_TONE: Record<string, string> = { tier_0: '--warn', tier_1: '--c15', tier_2: '--c3' };
/** the filter group each table is coloured by at first; any group can be picked with its "Colour" button */
const COLOUR_BY: Record<string, string> = { gear: 'Kind', perks: 'Effect', achievements: 'Level', bodyTypes: 'Size', skills: 'Group', standIns: 'Function', stacking: 'Type', classes: 'Tier' };
let colourBy = '';
const ms = (d: PerkDef) => (d.ladder ? `${d.ladder.milestone} perk` : d.allStep ? `All-${d.allStep.step}` : d.classLevel ? `class level ${d.classLevel.level}` : 'no milestone');
const className = (id: string) => lib.classes?.[id]?.name ?? id;
/** a banked write-up's tag (PerkWriteup.bankedAs / aimAt): what it is meant to become */
const treeOfSkill = (s?: string) => (s ? lib.trees[lib.skills[s]?.treeId ?? '']?.name : undefined);
function bankedText(d: PerkWriteup): string {
  if (d.bankedAs === 'milestone') return `banked: ${d.aimAt ? `${d.aimAt} perk` : 'milestone perk'}${d.skill ? ` · ${skillName(d.skill)}` : ''}`;
  if (d.bankedAs === 'allX') return `banked: ${d.aimAt ? `All-${d.aimAt}` : 'All-X'} candidate${treeOfSkill(d.skill) ? ` · ${treeOfSkill(d.skill)}` : ''}`;
  return 'banked: other';
}
/** who holds an All-X part: a skill's part names the skill, the tree's passive names the tree; a part no skill carries is parked */
function allHolder(st: { treeId: string; step: number; skill?: string }, id: string): string {
  const tree = lib.trees[st.treeId]?.name ?? st.treeId;
  if (st.skill) return `All-${st.step} · ${skillName(st.skill)} (${tree})`;
  if (ALL_BUNDLES.some((b) => b.passive === id)) return `All-${st.step} · ${tree} passive`;
  return `All-${st.step} · ${tree} · parked: no skill holds it`;
}
function perkCard(sec: string, d: PerkDef | PerkWriteup): HTMLElement {
  const r = d.rules;
  return card(sec, d.id, d, d.name, [
    d.ladder ? chip(`${ms(d)} · ${skillName(d.ladder.skill)}`) : 'allStep' in d && d.allStep ? chip(allHolder(d.allStep, d.id))
      : 'classLevel' in d && d.classLevel ? chip(`${ms(d)} · ${className(d.classLevel.classId)}`)
      : chip(('place' in d ? d.place : '') || 'no milestone'),
    'bankedAs' in d && d.bankedAs ? chip(bankedText(d)) : null,
    d.effect ? chip(d.effect, toneFor('Effect', d.effect)) : null,
    d.quirk ? chip('quirk', '--danger') : null,
    'built' in d && d.built !== undefined ? chip(d.built ? 'built' : 'not built', d.built ? '--ok' : '--warn') : null],
  d.story ? h('p', { class: 'lv-story' }, d.story) : null,
  r ? h('div', { class: 'lv-rules' }, row('Kind', r.kind), row('Trigger', r.trigger), r.conditions.length ? row('Conditions', h('div', { class: 'lv-sub' }, r.conditions.map((c) => h('div', {}, c)))) : null,
    row('Effect', r.effect), row('Lasts', r.lasts), r.cooldown ? row('Cooldown', r.cooldown) : null, r.needs ? row('Needs first', r.needs) : null, r.open ? row('Open', r.open) : null) : null,
  d.trueSkill ? row('True skill', `+${d.trueSkill} ${d.ladder ? skillName(d.ladder.skill) : ''}`) : null,
  d.functionBoost ? row('Same-group skills (itself too)', `+${d.functionBoost} each`) : null,
  d.trueSkillTo ? row('True skill to', val(Object.fromEntries(Object.entries(d.trueSkillTo).map(([k, v]) => [skillName(k), `+${v}`])))) : null,
  d.numbers ? row('Numbers', val(d.numbers)) : null,
  ...fields(d as Entry, ['id', 'name', 'story', 'rules', 'ladder', 'effect', 'built', 'quirk', 'trueSkill', 'functionBoost', 'trueSkillTo', 'numbers', 'ref', 'skill', 'place', 'allStep', 'bankedAs', 'aimAt']));
}
/** sub-tabs inside one section (Perks split into milestone, All-XX, not in use, other). Every pane is
 * built, only the chosen one shows; filters and colours count the shown pane only. */
type Pane = { key: string; title: string; n: number; content: (HTMLElement | null)[]; short?: string };
let pane = '';
// Remembered per viewer (this browser only): which sections are folded and which sub-tab each tab had open
const remember = <T>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? '') as T; } catch { return fallback; } };
const keep = (key: string, value: unknown): void => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: keep it for this visit only */ } };
// older keys carried the sub-tab (tab|pane|title); a fold now covers every sub-tab, so keep tab|title
const foldedSet = new Set<string>(remember<string[]>('lv-folded', []).map((k) => { const p = k.split('|'); return p.length > 2 ? `${p[0]}|${p.slice(2).join('|')}` : k; }));
const paneOf: Record<string, string> = remember<Record<string, string>>('lv-pane', {});
// every sub-tab row starts with All (every sub-tab at once, for searching across them), unless the table's own
// first sub-tab already lists everything (gear, achievements)
const ALL_PANES = '*';
const showsPane = (key: string) => pane === ALL_PANES || pane === key;
function panes(list: Pane[]): HTMLElement[] {
  const tabs: Pane[] = list[0].title === 'All' || list[0].title.startsWith('All ') ? list
    : [{ key: ALL_PANES, title: 'All', n: list.reduce((n, p) => n + p.n, 0), content: [] }, ...list];
  if (!tabs.some((p) => p.key === pane)) pane = tabs[0].key;
  const bar = h('div', { class: 'lv-tabs', role: 'tablist' }, tabs.map((p) => h('button', {
    type: 'button', role: 'tab', 'data-pane': p.key, 'aria-selected': String(p.key === pane), onclick: () => showPane(p.key),
    ...(p.short ? { title: p.title, 'aria-label': `${p.title}, ${p.n}` } : {}),
  }, p.short ?? p.title, h('small', {}, String(p.n)))));
  return [bar, ...list.map((p) => h('div', { class: 'lv-pane', 'data-pane': p.key, hidden: !showsPane(p.key) }, ...(p.content.filter(Boolean) as HTMLElement[])))];
}
function showPane(key: string): void {
  pane = key;
  paneOf[shown] = key; keep('lv-pane', paneOf);
  document.querySelectorAll<HTMLElement>('.lv-tabs [data-pane]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.pane === key)));
  body.querySelectorAll<HTMLElement>('.lv-pane').forEach((p) => { p.hidden = !showsPane(p.dataset.pane!); });
  drawBar(); paint(); filter();
}

const cell = (d: PerkDef) => h('a', { class: `lv-cell${d.built ? '' : ' unbuilt'}${d.quirk ? ' quirk' : ''}`, href: `#perks/${d.id}`, style: `--tg: var(${toneFor('Effect', d.effect ?? '') ?? '--c3'})` }, d.name);
const grid = (corner: string, cols: string[], rows: [string, (col: string) => PerkDef[]][]) => h('div', { class: 'lv-ladder' }, h('table', { class: 'hs-tbl' },
  h('thead', {}, h('tr', {}, h('th', {}, corner), cols.map((c) => h('th', {}, c)))),
  h('tbody', {}, rows.map(([name, at]) => h('tr', {}, h('td', {}, h('b', {}, name)), cols.map((c) => h('td', {}, at(c).map(cell))))))));
const cardsOf = (title: string, list: (PerkDef | PerkWriteup)[], empty: string) => h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, title),
  list.length ? h('div', { class: 'lv-grid' }, list.map((d) => perkCard('perks', d))) : h('p', { class: 'hs-note' }, empty));
/** "Written, not in the library", split by what each banked write-up is meant to become (bankedAs, set in src/library/perks.ts):
 * milestone perks (grid of skill × suggested milestone, then one section per skill), All-X candidates, other, and untagged */
function banked(loose: (PerkDef | PerkWriteup)[]): HTMLElement[] {
  const as = (d: PerkDef | PerkWriteup) => ('bankedAs' in d ? d.bankedAs : undefined);
  const ms = loose.filter((d) => as(d) === 'milestone') as PerkWriteup[];
  const aims = [...new Set(ms.map((d) => d.aimAt ?? 0))].sort((x, y) => x - y);
  const skills = Object.keys(lib.skills).filter((s) => ms.some((d) => d.skill === s));
  const noSkill = ms.filter((d) => !d.skill || !lib.skills[d.skill]);
  const out: HTMLElement[] = [];
  if (ms.length) {
    out.push(h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, `Banked milestone perks (${ms.length})`),
      h('p', { class: 'hs-note' }, 'Grouped by skill; the columns are the suggested milestone (aimAt). Click a name to open it.'),
      grid('Skill', aims.map((a) => (a ? `${a} perk` : 'no aim')), skills.map((s): [string, (c: string) => PerkDef[]] =>
        [skillName(s), (c) => ms.filter((d) => d.skill === s && (d.aimAt ? `${d.aimAt} perk` : 'no aim') === c) as unknown as PerkDef[]]))));
    for (const s of skills) out.push(cardsOf(`Banked · ${skillName(s)}`, ms.filter((d) => d.skill === s), 'None.'));
    if (noSkill.length) out.push(cardsOf('Banked milestone perks with no skill', noSkill, 'None.'));
  }
  const allX = loose.filter((d) => as(d) === 'allX');
  out.push(cardsOf(`Banked All-X candidates (${allX.length})`, allX, 'None.'));
  out.push(cardsOf('Banked, other', loose.filter((d) => as(d) === 'other'), 'None right now.'));
  const untagged = loose.filter((d) => !as(d));
  if (untagged.length) out.push(cardsOf('Written, not in the library, no banked tag', untagged, 'None.'));
  return out;
}
function perks(): HTMLElement[] {
  const all = Object.values(lib.perks);
  const ladder = all.filter((d) => d.ladder);
  const allParts = all.filter((d) => d.allStep);
  const loose = [...PERK_WRITEUPS, ...BOOST_PERKS].filter((d) => !lib.perks[d.id]);
  const unused = [...all.filter((d) => !d.built), ...loose];
  // class perks: what each class grants by level (ClassDef.levelPerks), the same source the game reads
  const classes = byTier(); // every class gets a row, so one with no level perks shows as empty
  const classPerkIds = new Set(classes.flatMap((c) => [...Object.values(c.levelPerks ?? {}).flat(), ...(c.capstone ?? []), ...(c.capstones ?? []).map((x) => x.perk)]));
  const classPerks = all.filter((d) => classPerkIds.has(d.id) || d.classLevel);
  const other = all.filter((d) => d.built && !d.ladder && !d.allStep && !classPerks.includes(d));
  const quirks = all.filter((d) => d.quirk).length;
  // milestone grid: skills × 20/40/60 … ; All-XX grid: trees × 50/100/150 (dashed = not built yet, as in the game's tiles)
  const steps = [...new Set(ladder.map((d) => d.ladder!.milestone))].sort((x, y) => x - y).map(String);
  const ladderRows = Object.keys(lib.skills).filter((s) => ladder.some((d) => d.ladder!.skill === s))
    .map((s): [string, (c: string) => PerkDef[]] => [skillName(s), (c) => ladder.filter((d) => d.ladder!.skill === s && String(d.ladder!.milestone) === c)]);
  const allSteps = [...new Set(allParts.map((d) => d.allStep!.step))].sort((x, y) => x - y).map(String);
  const allRows = Object.values(lib.trees).filter((t) => allParts.some((d) => d.allStep!.treeId === t.id))
    .map((t): [string, (c: string) => PerkDef[]] => [t.name, (c) => allParts.filter((d) => d.allStep!.treeId === t.id && String(d.allStep!.step) === c)]);
  const classLevels = [...new Set(classes.flatMap((c) => Object.keys(c.levelPerks ?? {}).map(Number)))].sort((x, y) => x - y).map(String);
  // capstones (ClassDef.capstones) get their own column: picked at the level cap, each with its own access rule
  const classCols = [...classLevels.map((l) => `Level ${l}`), ...(classes.some((c) => c.capstone?.length || c.capstones?.length) ? ['Capstones'] : [])];
  const classRows = classes.map((c): [string, (col: string) => PerkDef[]] => [`${c.name} · ${CLASS_TIERS.name(c.tier)}`,
    (col) => (col === 'Capstones' ? [...(c.capstone ?? []), ...(c.capstones ?? []).map((x) => x.perk)] : c.levelPerks?.[+col.replace('Level ', '')] ?? []).map((id) => lib.perks[id]).filter(Boolean)]);
  return [
    h('p', { class: 'hs-note' }, `${all.length} perks in the library · ${all.filter((d) => d.built).length} built · ${quirks} quirk${quirks === 1 ? '' : 's'} · ${loose.length} written outside the library. A dashed cell is not built yet; a red edge is a quirk.`),
    h('p', { class: 'hs-note lv-chips' }, [...new Set(all.map((d) => d.effect).flatMap((e) => (e ? [e] : [])))].sort((x, y) => x.localeCompare(y)).map((e) => chip(e, toneFor('Effect', e)))),
    ...panes([
      { key: 'milestone', title: 'Milestone perks (20, 40, 60 …)', short: 'Milestone', n: ladder.length, content: [
        h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, 'By skill and milestone'), grid('Skill', steps.map((m) => `${m} perk`), ladderRows.map(([n, at]) => [n, (c: string) => at(c.replace(' perk', ''))]))),
        cardsOf('Built', ladder.filter((d) => d.built), 'None built yet.')] },
      { key: 'all', title: 'All-XX perks', short: 'All-XX', n: allParts.length, content: [
        h('p', { class: 'hs-note' }, 'Granted when enough skills of a tree reach the step, by the tree\'s rating (inferior never, normal 3, superior 2, legendary 1): the tree\'s passive plus each of those skills\' part; a further skill at the step adds its part (allStep in src/library/allPerks.ts).'),
        h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, 'By tree and step'), grid('Tree', allSteps.map((m) => `All-${m}`), allRows.map(([n, at]) => [n, (c: string) => at(c.replace('All-', ''))]))),
        cardsOf('Built', allParts.filter((d) => d.built), 'None built yet.')] },
      { key: 'unused', title: 'Not in use', n: unused.length, content: [
        h('p', { class: 'hs-note' }, 'Written down but the game can\'t give them yet: not built (built: false), or not in the library at all.'),
        cardsOf('In the library, not built', all.filter((d) => !d.built), 'None.'),
        ...banked(loose)] },
      { key: 'class', title: 'Class perks', short: 'Class', n: classPerks.length, content: [
        h('p', { class: 'hs-note' }, 'Granted by a class for reaching a class level (levelPerks on the class in src/library/data.ts). Capstones come at the class\'s top level (set by its tier): the default one, or an alternate whose conditions hold; the Classes tab shows what each alternate needs.'),
        h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, 'By class and level'), grid('Class', classCols, classRows)),
        cardsOf('Class perks', classPerks, 'No class grants a perk yet.')] },
      { key: 'other', title: 'Other', n: other.length, content: [
        cardsOf('Built, with no milestone, All-XX step or class', other, 'None right now: every built perk is a milestone, All-XX or class perk.')] },
    ]),
  ];
}

// ---------- Races and body types ----------
const links = (sec: string, pairs: [string, string][]) => (pairs.length ? h('span', {}, ...pairs.flatMap(([id, t], i) => [i ? ', ' : '', link(sec, id, t)])) : none());
const usedBy = (pred: (t: Entry) => boolean) => links('templates', Object.values(lib.templates).filter((x) => pred(x as unknown as Entry)).map((x) => [x.id, x.label]));
const perkList = (ids: string[] | undefined) => links('perks', (ids ?? []).map((id) => [id, lib.perks[id]?.name ?? id]));
// ---------- Gear classes ----------
// a class sets WHICH skill its items ask for; the item's level sets HOW MUCH (EQUIP_NEED)
const itemsOfClass = (gc: string) => Object.values(lib.items).filter((i) => i.gearClass === gc);
function gearClasses(): HTMLElement[] {
  return [h('p', { class: 'hs-note' }, 'A gear class sets which skill its items ask for. The item\'s level sets how much: ',
      EQUIP_LEVELS.keys.map((l) => `${EQUIP_LEVELS.name(l)} ${CONFIG.EQUIP_NEED[l] ?? 0}`).join(', '), ' true skill.'),
    h('div', { class: 'lv-grid' }, Object.values(lib.gearClasses ?? {}).map((g) => {
      const items = itemsOfClass(g.id);
      return card('gearClasses', g.id, g, g.name, [chip(g.use, toneFor('Use', g.use))],
        row('Use', g.use), row('Skill', link('skills', g.skill, skillName(g.skill))),
        row('Items', items.length ? h('span', {}, ...items.flatMap((i, n) => [n ? ', ' : '', link('gear', i.id, `${label(i.name)} (${EQUIP_LEVELS.name(itemLevel(i) ?? 'crude')}${items.filter((o) => o.name === i.name).length > 1 ? `, bulk ${i.bulk}` : ''})`)])) : none('none yet')));
    }))];
}

// Healing: what each source restores in words, morale included, so the table view shows it too (the raw % fields stay in Code)
function restores(d: HealingDef): string {
  if (d.countOnly) return 'nothing itself: it only tallies healing from perks, for achievements that count healing by source';
  if (d.hourly) {
    const at50 = +(d.hourly.pctPerPoint * 50).toFixed(2);
    return `every hour, ${d.hourly.pctPerPoint} % of max health per ${skillName(d.hourly.skill)} point (${at50} % at 50)`;
  }
  const calm = d.composure ? lib.composure?.[d.composure] : undefined; // morale comes from the composure table's row
  const parts = [d.hpPct ? `${d.hpPct} % health` : '', d.partPct ? `${d.partPct} % to body parts` : '', calm?.pct ? `${calm.pct} % morale` : ''].filter(Boolean);
  return parts.length ? parts.join(', ') : 'nothing';
}
function healing(): HTMLElement[] {
  return [h('div', { class: 'lv-grid' }, Object.values(lib.healing ?? {}).map((d) => card('healing', d.id, d, d.name,
    [d.countOnly ? chip('tally only') : null, d.composure ? chip('morale') : null, d.inFight ? chip('in a fight') : null],
    row('Restores', restores(d)),
    d.composure ? row('Morale from', link('composure', d.composure, lib.composure?.[d.composure]?.name ?? d.composure), ' (composure row)') : null,
    ...fields(d as unknown as Entry, ['id', 'name', 'hpPct', 'partPct', 'composure', 'hourly', 'countOnly']))))];
}
// Composure: what restores morale, its own table so it tunes apart from healing; a healing row names the row it also restores
function composureText(d: ComposureDef): string {
  if (d.countOnly) return 'nothing itself: it only tallies morale restored by perks, for achievements that count morale by source';
  if (d.hourly) return `every hour, ${d.hourly.pctPerPoint} % of max morale per ${skillName(d.hourly.skill)} point (${+(d.hourly.pctPerPoint * 50).toFixed(2)} % at 50)`;
  return `${d.pct} % of max morale`;
}
function composure(): HTMLElement[] {
  return [h('p', { class: 'hs-note' }, 'What restores morale. Healing rows that also calm you (rest, clinic) name their row here, so morale and health tune apart.'),
    h('div', { class: 'lv-grid' }, Object.values(lib.composure ?? {}).map((d) => {
      const from = Object.values(lib.healing ?? {}).filter((x) => x.composure === d.id);
      return card('composure', d.id, d, d.name, [d.countOnly ? chip('tally only') : null, d.inFight ? chip('in a fight') : null],
        row('Restores', composureText(d)),
        from.length ? row('Also given by', links('healing', from.map((x) => [x.id, x.name]))) : null,
        row('Achievements', usedByAch(d.id)),
        ...fields(d as unknown as Entry, ['id', 'name', 'pct', 'hourly', 'countOnly']));
    }))];
}
const usedByAch = (row: string) => { const a = Object.values(lib.achievements ?? {}).filter((x) => x.by === 'morale_source' && x.only === row);
  return a.length ? links('achievements', a.map((x) => [x.id, x.name])) : none('none'); };

/** Fears: a part fear's cost comes from per-part impact costs (partCost, or another row's × mult), so its card shows
 * those and what one part of each impact costs on each body type, worked out by the game's partFearCost */
const impName = (imp: string) => imp.replace('_', '-');
function fears(): HTMLElement[] {
  const all = Object.values(lib.fears ?? {}) as FearDef[];
  const cost = (f: FearDef): Node | string => {
    const base = f.partCostOf ? lib.fears?.[f.partCostOf.fear] : f;
    if (!base?.partCost) return `${f.cost < 0 ? 'restores ' : ''}${Math.abs(f.cost)} morale${f.perTier ? ' per tier of the gap' : ''}${f.rolled ? ', before the roll' : ''}`;
    const mult = f.partCostOf?.mult ?? 1;
    const per = Object.entries(base.partCost).map(([imp, n]) => `${impName(imp)} ${+(n * mult).toFixed(2)}`).join(', ');
    return h('span', {}, `Per part hit, by impact: ${per}`,
      f.partCostOf ? h('span', {}, ' (', link('fears', f.partCostOf.fear, base.name), ` × ${mult}, read from that row)`) : '',
      `${f.rolled ? ', before the roll' : ''}. Set for a ${base.refParts ?? 'body'}-part body and scaled by ${base.refParts ?? 'its'} ÷ the body's part count; one roll per hit pays the sum.`);
  };
  const perBody = (f: FearDef) => (f.partCost || f.partCostOf) ? Object.values(lib.bodyTypes).map((b) => {
    const imps = [...new Set(b.parts.map((p) => p.impact))];
    if (!b.parts.length) return `${b.name}: no parts, so never`;
    return `${b.name} (${b.parts.length} parts): ${imps.map((imp) => `${impName(imp)} ${+partFearCost(f, [b.parts.find((p) => p.impact === imp)!.id], b.parts).toFixed(2)}`).join(', ')}`;
  }) : [];
  return [h('div', { class: 'lv-grid' }, all.map((f) => card('fears', f.id, f, f.name,
    [f.part ? chip(`part ${PART_STATES.name(f.part)}`) : null],
    row('Cost', cost(f)),
    perBody(f).length ? row('One part, by body', h('ul', { class: 'lv-names' }, perBody(f).map((t) => h('li', {}, t)))) : null,
    f.part ? row('When', `one of your parts reaches ${PART_STATES.name(f.part)}`) : null,
    row('Rolled', f.rolled ? `yes: a morale roll sets how much of the cost you take${f.unengaged ? '; paid in a fight or out of one' : '; only while in a fight'}` : 'no: the cost applies as it stands'),
    ...fields(f as unknown as Entry, ['id', 'name', 'cost', 'perTier', 'part', 'partCost', 'refParts', 'partCostOf', 'rolled']))))];
}

function races(): HTMLElement[] {
  return [h('div', { class: 'lv-grid' }, Object.values(lib.races ?? {}).map((r) => {
    const ct = lib.bodyTypes[r.bodyTypeId];
    return card('races', r.id, r, r.name, [chip(INTELLIGENCE.name(r.intelligence), toneFor('Intelligence', INTELLIGENCE.name(r.intelligence)))],
      h('div', { class: 'lv-armor' }, figure(ct, (p) => IMPACT_TONE[impactOf(ct, p)]), h('div', {},
        row('Body', link('bodyTypes', r.bodyTypeId, lib.bodyTypes[r.bodyTypeId]?.name ?? r.bodyTypeId)),
        row('HP multiplier', `×${r.hpMultiplier}`),
        row('Intelligence', INTELLIGENCE.name(r.intelligence)),
        r.naturalAttacks?.length ? row('Own natural attacks', val(r.naturalAttacks.map((a) => `${a.name ?? a.id} (${skillName(a.skill ?? '')})`))) : null,
        r.naturalArmor ? row('Natural armor', val(r.naturalArmor)) : null,
        r.fallback ? row('Fallback attack', skillName(r.fallback.attackSkill)) : null,
        row('Innate perks', perkList(r.innatePerks)), row('Innate quirks', perkList(r.innateQuirks)),
        row('NPC templates', usedBy((t) => t.raceId === r.id)))),
      ...fields(r as unknown as Entry, ['id', 'name', 'bodyTypeId', 'hpMultiplier', 'naturalAttacks', 'naturalArmor', 'fallback', 'innatePerks', 'innateQuirks', 'intelligence']));
  }))];
}
function bodyTypes(): HTMLElement[] {
  return [h('p', { class: 'hs-note' }, h('span', { class: 'lv-key lv-ess' }), 'essential ', h('span', { class: 'lv-key lv-norm' }), 'normal ', h('span', { class: 'lv-key lv-non' }), 'non-essential part'),
    h('div', { class: 'lv-grid wide' }, Object.values(lib.bodyTypes).map((c) => card('bodyTypes', c.id, c, c.name, [chip(c.general.size, toneFor('Size', c.general.size))],
      h('div', { class: 'lv-armor' }, figure(c, (p) => IMPACT_TONE[impactOf(c, p)]), h('div', {},
        row('General area', `${c.general.name} · ${c.general.size}`),
        row('Natural attacks', c.naturalAttacks.length ? val(c.naturalAttacks.map((a) => `${a.name ?? a.id} (${skillName(a.skill ?? '')})`)) : none('none')),
        row('Fallback attack', skillName(c.fallback.attackSkill)),
        row('Races', links('races', Object.values(lib.races ?? {}).filter((r) => r.bodyTypeId === c.id).map((r) => [r.id, r.name]))),
        row('NPC templates', usedBy((t) => lib.races?.[t.raceId as string]?.bodyTypeId === c.id)))),
      c.parts.length ? h('table', { class: 'hs-tbl lv-parts' }, h('thead', {}, h('tr', {}, ['Part', 'Size', 'Impact', 'Roles', 'Next to'].map((x) => h('th', {}, x)))),
        h('tbody', {}, c.parts.map((p) => h('tr', {}, h('td', {}, h('span', { class: `lv-key ${IMPACT_TONE[p.impact]}` }), label(p.id)), h('td', {}, p.size),
          h('td', {}, label(p.impact)), h('td', {}, p.roles.map((r) => lib.roles[r]?.name ?? r).join(', ') || '—'), h('td', {}, (p.adjacent ?? []).map(label).join(', ') || '—'))))) : row('Parts', none('general area only'))))),
  ];
}

// ---------- Achievements ----------
/** achievement tags (TG1): read from the row; display names from the ACH_TAGS names table */
const achTags = (d: AchievementDef): string[] => d.tags ?? [];
const achTagName = (t: string): string => ACH_TAGS[t as AchievementTag] ?? label(t);
function achievements(): HTMLElement[] {
  // show each rule's rows by count, rules in the order they first appear
  const rows = Object.entries(lib.achievements ?? {});
  const first = (r: string) => rows.findIndex(([, d]) => d.rule === r);
  const all = rows.sort(([, a], [, b]) => first(a.rule) - first(b.rule) || (a.count ?? 0) - (b.count ?? 0));
  const name = (n: string) => h('span', {}, ...n.split(/(\{\w+\})/).map((p) => (p.startsWith('{') ? h('em', { class: 'lv-slot' }, p) : p)));
  const achCard = ([key, d]: [string, AchievementDef]) => {
    const tags = achTags(d);
    const kind = d.by === 'body_type' ? 'body type' : 'race';
    const bane = isBane(d) ? baneSkill(key) : 0; // D-111: the same function the rolls use
    const total = d.rule === 'defeats' && !d.by ? defeatsRoll(key) : 0; // D-119
    // {level} on an every-N row reads as the levels it is earned at: 10, 20, 30…
    // a row with its own name per earning (names) reads by its first name; the Names row lists them all
    const named = d.names ? Object.entries(d.names).sort(([a], [b]) => Number(a) - Number(b)) : [];
    const after = named.length && d.every ? Number(named[named.length - 1][0]) + d.every : 0;
    const title = named.length ? named[0][1]
      : d.every && d.name.includes('{level}') ? d.name.replace('{level}', `${[0, 1, 2].map((i) => (d.count ?? d.every!) + i * d.every!).join(', ')}…`) : d.name;
    return card('achievements', key, d, title, [chip(`Level ${rewardName(d.level)}`, toneFor('Level', `Level ${rewardName(d.level)}`)), chip(`${achXp(d)} XP`),
      bane ? chip(`+${bane} skill vs that ${kind}`) : null, total ? chip(`+${total} combat rolls`) : null,
      rewardLines(d).length ? chip('reward') : null,
      d.scar ? chip('scar', toneFor('Kind', 'scar')) : null, ...tags.map((t) => chip(achTagName(t), toneFor('Tag', achTagName(t))))],
      row('Name', name(title)),
      named.length ? row('Names', h('ul', { class: 'lv-names' }, ...named.map(([k, n]) => h('li', {}, `Level ${k}: ${n}${d.levelStep ? ` · reward level ${rewardName(achLevel(d, k))}, ${achXp(d, k)} XP` : ''}`)),
        after ? h('li', {}, `Levels ${after}, ${after + d.every!}…: ${d.name.replace('{level}', String(after))}, and so on${d.levelStep ? ` · reward level ${rewardName(achLevel(d, String(after)))} and up, ${d.levelStep === 1 ? 'one level' : `${d.levelStep} levels`} a step` : ''}`) : null)) : null,
      row('Reward', (() => { const all = [...(bane ? [`+${bane} skill on every roll against that ${kind}`] : []),
        ...(total ? [`+${total} on every attack and defense roll`] : []), ...rewardLines(d)];
        return all.length ? all.join('; ') : none('none, XP only'); })()),
      d.levelUp ? row('Pays more', Object.entries(d.levelUp).map(([k, n]) => `${k.replace("_", " ")}: +${n} reward level${n === 1 ? '' : 's'}`).join('; ')) : null,
      d.after ? row('Builds on', link('achievements', d.after, lib.achievements?.[d.after]?.name ?? d.after)) : null,
      // the engine's one "what it asks for" text (earnedAtText); the viewer only links the healing row and names the per-kind split
      (() => { const at = earnedAtText(NO_STATE, d), heal = d.only ? sourceRowName(d, d.only) : '', tbl = d.by === 'morale_source' ? 'composure' : 'healing';
        return heal && at.endsWith(heal) ? row('Earned at', at.slice(0, -heal.length), link(tbl, d.only!, heal))
          : row('Earned at', `${at}${d.by && !d.only ? `, once per ${d.by.replace('_', ' ')}` : ''}`); })(),
      row('Granted id', d.by || d.rule === 'mastery' ? `${d.id}:<${d.by ?? 'tree'}>` : d.every ? `${d.id}:<level>` : d.id));
  };
  // a medal: the card stays whole (search, filters, table view and the pop-up read it) and shows only its face on the
  // page: the count it asks for leads, then the reward level, name and the gist of its reward. Clicking opens the full card.
  const medal = ([key, d]: [string, AchievementDef]) => {
    const c = achCard([key, d]);
    const lv = `Level ${rewardName(d.level)}`, tone = toneFor('Level', lv);
    const kind = d.by === 'body_type' ? 'body type' : 'race';
    const bane = isBane(d) ? baneSkill(key) : 0, total = d.rule === 'defeats' && !d.by ? defeatsRoll(key) : 0;
    const gist = [...(bane ? [`+${bane} skill vs that ${kind}`] : []), ...(total ? [`+${total} on attack and defense rolls`] : []), ...rewardLines(d)];
    // an every-N row with a name per level (Woven Past Counting) is one library row but a chain in play: its card stands
    // for the first level and each later level gets a medal of its own, opening the same card
    const named = d.every && d.names ? Object.entries(d.names).sort(([a], [b]) => Number(a) - Number(b)) : [];
    c.classList.add('lv-medal');
    if (d.scar) c.classList.add('lv-scarmedal');
    if (tone) c.style.setProperty('--gem', `var(${tone})`);
    c.prepend(h('div', { class: 'lv-face', 'aria-hidden': 'true' },
      h('span', { class: 'lv-gem' }, rewardName(d.level)), d.scar ? h('span', { class: 'lv-scartag' }, 'Scar') : null, h('span', { class: 'lv-xp' }, `${fmtNum(achXp(d))} XP`),
      h('b', { class: 'lv-count' }, named.length ? fmtNum(Number(named[0][0])) : d.every ? `every ${fmtNum(d.every)}` : fmtNum(d.count ?? 1))));
    if (gist.length) c.querySelector(':scope > header')!.after(h('p', { class: 'lv-gist' }, `${gist[0]}${gist.length > 1 ? ` · +${gist.length - 1} more` : ''}`)); // XP only: the XP says it
    if (!named.length) return [c];
    if (d.levelStep) { const lv0 = rewardName(achLevel(d, named[0][0])); c.querySelector('.lv-gem')!.textContent = lv0; const t = toneFor('Level', `Level ${lv0}`); if (t) c.style.setProperty('--gem', `var(${t})`); }
    c.querySelector('.lv-xp')!.textContent = `${fmtNum(achXp(d, named[0][0]))} XP`;
    c.querySelector('a.lv-title')!.textContent = named[0][1];
    const after = Number(named[named.length - 1][0]) + d.every!;
    const ghost = (k: string, count: string, title: string) => {
      const lv = rewardName(achLevel(d, k)), t = toneFor('Level', `Level ${lv}`);
      return h('div', { class: 'lv-medal lv-ghost', style: t ? `--gem: var(${t})` : undefined },
        h('div', { class: 'lv-face', 'aria-hidden': 'true' }, h('span', { class: 'lv-gem' }, lv), h('span', { class: 'lv-xp' }, `${fmtNum(achXp(d, k))} XP`), h('b', { class: 'lv-count' }, count)),
        h('header', {}, h('h3', {}, h('a', { class: 'lv-title', href: `#achievements/${key}` }, title))));
    };
    return [c, ...named.slice(1).map(([k, n]) => ghost(k, fmtNum(Number(k)), n)),
      ghost(String(after), `${fmtNum(after)}+`, `${d.name.replace('{level}', String(after))}, and on every ${d.every}`)];
  };
  const fmtNum = (n: number) => n.toLocaleString('en');
  const section = (title: string, list: [string, AchievementDef][]) => {
    const xp = list.reduce((n, [, d]) => n + achXp(d), 0);
    return h('section', { class: 'lv-group lv-chain' }, h('h2', { class: 'hs-section' }, title,
      h('span', { class: 'lv-chainmeta' }, ` (${list.length} level${list.length === 1 ? '' : 's'}, ${fmtNum(xp)} XP)`)),
      ...chainsOf(list).map(([label, rows]) => [label ? h('h3', { class: 'lv-chainlabel' }, label) : null,
        ((ms) => h('div', { class: 'lv-grid lv-track', style: `--n: ${Math.min(ms.length, 6)}` }, ms))(rows.flatMap(medal))]).flat().filter((x) => !!x) as HTMLElement[]);
  };
  // one line can hold several chains (one per healing source, say): follow `after` from each root so a medal's rail
  // always leads to the level that builds on it; a line with no `after` links stays one track in count order
  const chainsOf = (list: [string, AchievementDef][]): [string, [string, AchievementDef][]][] => {
    const ids = new Set(list.map(([k]) => k));
    const roots = list.filter(([, d]) => !d.after || !ids.has(d.after));
    const chains = roots.map((r) => { const out = [r]; for (let cur = r, i = 0; i < 50; i++) { const next = list.find(([, d]) => d.after === cur[0]); if (!next || out.includes(next)) break; out.push(next); cur = next; } return out; });
    if (!chains.some((c) => c.length > 1) || chains.length === 1) return [['', list]];
    const linked = chains.filter((c) => c.length > 1), loose = chains.filter((c) => c.length === 1).flat();
    const label = (c: [string, AchievementDef][]) => { const d = c[0][1]; return d.only ? `From ${sourceRowName(d, d.only)}` : `${c[0][1].name} chain`; };
    return [...linked.map((c): [string, [string, AchievementDef][]] => [label(c), c]), ...(loose.length ? [['Single levels', loose] as [string, [string, AchievementDef][]]] : [])];
  };
  // a line: one rule counted one way (rule + by), its levels in count order; each line folds on its own
  const lineOf = (d: AchievementDef) => `${d.rule}|${d.by ?? ''}`;
  const lineTitle = (k: string) => { const [rule, by] = k.split('|'); const t = ACH_RULE_TEXT[rule as AchievementDef['rule']] ?? rule; return `${t[0].toUpperCase()}${t.slice(1)}${by ? ` (per ${by.replace('_', ' ')})` : ''}`; };
  const byLine = (list: [string, AchievementDef][]) => [...new Set(list.map(([, d]) => lineOf(d)))]
    .map((k) => section(lineTitle(k), list.filter(([, d]) => lineOf(d) === k)));
  // sub-tabs by tag (TG1–TG9) in ACH_TAGS order, plus All; scars sit with achievements; a row with several tags shows under each
  const used = new Set(all.flatMap(([, d]) => achTags(d)));
  const tagKeys = [...Object.keys(ACH_TAGS).filter((t) => used.has(t)), ...[...used].filter((t) => !(t in ACH_TAGS))];
  const untagged = all.filter(([, d]) => !achTags(d).length);
  return panes([
    { key: 'all', title: 'All', n: all.length, content: byLine(all) },
    ...tagKeys.map((t) => { const list = all.filter(([, d]) => achTags(d).includes(t)); return { key: `tag:${t}`, title: achTagName(t), n: list.length, content: byLine(list) }; }),
    ...(untagged.length ? [{ key: 'untagged', title: 'Untagged', n: untagged.length, content: byLine(untagged) }] : []),
  ]);
}

// ---------- Classes ----------
/** classes, lowest tier first (CLASS_TIERS order), then by name */
const byTier = (): ClassDef[] => Object.values(lib.classes ?? {}).sort((a, b) => CLASS_TIERS.pos(a.tier) - CLASS_TIERS.pos(b.tier) || a.name.localeCompare(b.name));
/** every condition a class unlocks on, as one list (all must hold; an either-of group needs one of its skills) */
const PERK_NUMBERS: Record<string, string> = { hearingDb: 'hears quieter (dB)' };
function unlockRow(c: ClassDef): HTMLElement | null {
  const sk = ([id, n]: [string, number]) => [link('skills', id, skillName(id)), ` ${n}`];
  const lines: (Node | string)[][] = [
    ...Object.entries(c.unlock ?? {}).map((e) => sk(e)),
    ...(c.unlockAny ?? []).map((g) => ['one of: ', ...Object.entries(g).flatMap((e, i) => [i ? ', ' : '', ...sk(e)])]),
    ...(c.unlockPerk ? [['the perk ', link('perks', c.unlockPerk, lib.perks[c.unlockPerk]?.name ?? c.unlockPerk)]] : []),
    ...Object.entries(c.unlockPerkWith ?? {}).map(([k, n]) => {
      const has = Object.values(lib.perks).filter((d) => ((d as unknown as Record<string, number>)[k] ?? 0) >= (n as number));
      return [`an active perk with ${PERK_NUMBERS[k] ?? humanKey(k).toLowerCase()} ${n}`, ...(has.length ? [' (', ...has.flatMap((d, i) => [i ? ', ' : '', link('perks', d.id, d.name)]), ')'] : [])];
    }),
    ...Object.entries(c.unlockClass ?? {}).map(([id, lv]) => [link('classes', id, lib.classes[id]?.name ?? id), lv === 'max' ? ` at its top level (${classMaxLevel(id)})` : ` level ${lv}`]),
  ];
  return lines.length ? row(lines.length > 1 ? 'Unlocks when all hold' : 'Unlocks when', h('div', { class: 'lv-sub' }, lines.map((l) => h('div', {}, ...l)))) : null;
}
/** skill floors a character of the class always meets: its own floors plus its unlock skills (classFloors in src/library/spawn.ts) */
function floorsRow(c: ClassDef): HTMLElement | null {
  const f = classFloors(c.id);
  const sk = ([id, n]: [string, number]) => [link('skills', id, skillName(id)), ` ${n}`];
  const lines: (Node | string)[][] = [...Object.entries(f.all).map((e) => sk(e)),
    ...f.any.map((g) => ['one of: ', ...Object.entries(g).flatMap((e, i) => [i ? ', ' : '', ...sk(e)])])];
  return lines.length ? row('Skill floors', h('div', { class: 'lv-sub' }, lines.map((l) => h('div', {}, ...l)))) : null;
}
function classes(): HTMLElement[] {
  return [
    h('p', { class: 'hs-note' }, `Lowest tier first. Tiers (CLASS_TIERS in src/scales.ts): ${CLASS_TIERS.keys.map((k) => CLASS_TIERS.name(k)).join(', ')}.`),
    h('div', { class: 'lv-grid' }, byTier().map((c) => card('classes', c.id, c, c.name,
      [chip(CLASS_TIERS.name(c.tier), toneFor('Tier', CLASS_TIERS.name(c.tier))), c.fallback ? chip('default class', toneFor('Kind', 'default class')) : null, c.creation ? chip('starting class', toneFor('Kind', 'starting class')) : null],
      c.story ? h('p', { class: 'lv-story' }, c.story) : null,
      row('Top level', `${classMaxLevel(c.id)} (from its tier)`),
      unlockRow(c), floorsRow(c),
      ...fields(c as unknown as Entry, ['id', 'name', 'tier', 'story', 'capstone', 'capstones', 'unlock', 'unlockAny', 'unlockPerk', 'unlockPerkWith', 'unlockClass', 'floors']),
      c.capstone?.length || c.capstones?.length ? row('Capstones', h('div', { class: 'lv-sub' },
        ...(c.capstone ?? []).map((id) => h('div', {}, link('perks', id, lib.perks[id]?.name ?? id), ' ', chip('default'))),
        ...(c.capstones ?? []).map((x) => h('div', {}, link('perks', x.perk, lib.perks[x.perk]?.name ?? x.perk), ' ', chip('alternate'), ' ', ...access(x.needs))))) : null))),
  ];
}

// ---------- Skills, by tree ----------
/** tree access (TA1–TA11): Must, Either of and Blocked by as chips; a tree with no rule is open to everyone */
const access = (r?: TreeAccess): HTMLElement[] => !r ? [chip('open to everyone')] : [
  ...(r.must ?? []).map((c) => chip(`must: ${condName(c)}`)),
  ...(r.either?.length ? [chip(`either of: ${r.either.map(condName).join(', ')}`)] : []),
  ...(r.blockedBy ?? []).map((c) => chip(`blocked by: ${condName(c)}`, '--danger'))];
function skills(): HTMLElement[] {
  const inTree = new Set(Object.values(lib.trees).flatMap((t) => t.skills));
  const loose = Object.keys(lib.skills).filter((s) => !inTree.has(s));
  const tree = (id: string, title: string, ids: string[], entry: unknown, chips: HTMLElement[]) => card('skills', id, entry, title, chips,
    h('table', { class: 'hs-tbl' }, h('thead', {}, h('tr', {}, ['Skill', 'Functions', 'Group', 'Roles', 'Tier', 'XP', 'Tags'].map((x) => h('th', {}, x)))),
      h('tbody', {}, ids.map((s) => lib.skills[s]).filter(Boolean).map((s) => h('tr', { id: `skills/${s.id}` },
        h('td', {}, h('b', {}, skillName(s.id)), s.cue ? ` · ${s.cue} cue` : '', ...(s.access ? access(s.access) : []),
          ...(s.augments ?? []).map((a) => h('div', { class: 'lv-bits' }, 'augments ', link('skills', a.skill, skillName(a.skill)), ` ×${a.share ?? 1}`, a.rollKinds?.length ? ` (${a.rollKinds.join(', ')} rolls)` : ''))), h('td', {}, s.functions.length ? h('span', { class: 'lv-chips' }, s.functions.map((f) => chip(functionName(f), toneFor('Function', functionName(f))))) : '—'),
        h('td', {}, groupsOf(s).length ? h('span', { class: 'lv-chips' }, groupsOf(s).map((g) => chip(GROUP_NAMES[g], toneFor('Group', GROUP_NAMES[g])))) : '—'), h('td', {}, s.roles.map((r) => lib.roles[r as keyof typeof lib.roles]?.name ?? r).join(', ') || '—'),
        h('td', {}, chip(`${SKILL_TIERS.name(s.tier)} · ×${CONFIG.SKILL_TIER_MULT[s.tier]}`, TIER_TONE[s.tier])), h('td', {}, groupsOf(s)[0] ? chip(`${GROUP_NAMES[groupsOf(s)[0]]} · ${XP_FACTORS.name(CONFIG.XP_GROUP_FACTOR[groupsOf(s)[0]] as XpFactorKey ?? 'none')} ×${xpGroupFactor(groupsOf(s)[0])}`, toneFor('Group', GROUP_NAMES[groupsOf(s)[0]])) : '—'), h('td', {}, (s.tags ?? []).join(', ') || '—'))))));
  // the header says which group(s) the code puts the tree's skills in (FUNCTION_GROUP)
  const groupChips = (ids: string[]) => [...new Set(ids.flatMap((s) => groupsOf(lib.skills[s])))].map((g) => chip(`${GROUP_NAMES[g]} group`, toneFor('Group', GROUP_NAMES[g])));
  const treeCard = (id: string, title: string, ids: string[], entry: unknown, chips: HTMLElement[]) => {
    const c = tree(id, title, ids, entry, [...groupChips(ids), ...chips]);
    c.querySelector('.lv-id')?.remove(); // The tree id under the title is noise; the group chips say where it belongs
    c.classList.add('lv-foldcard'); // a tree's skill table folds under its title
    const t = c.querySelector('header > h3 > .lv-title'); t?.replaceWith(t.textContent ?? ''); // its title folds, not opens a pop-up
    return c;
  };
  return [h('p', { class: 'hs-note' }, 'A tree is where a skill is learned. The group comes from the skill\'s functions (FUNCTION_GROUP in functionNames.ts) and decides the 40 perk +1 and the XP category, so a tree and its group can differ.'),
    h('div', { class: 'lv-grid wide' },
      Object.values(lib.trees).map((t) => treeCard(t.id, t.name, t.skills, t, access(t.access))),
      loose.length ? treeCard('no_tree', 'In no tree', loose, loose, []) : null)];
}

// ---------- Stand-ins ("show me how stand in is coded") ----------
/** every number here comes from standInTable / standInShare in src/ruleset/gear.ts, the functions effectiveSkill uses */
function standIns(): HTMLElement[] {
  const ids = Object.keys(lib.skills);
  const pct = (k: number) => `×${+k.toFixed(2)}`;
  const movers = [...Object.values(lib.perks), ...PERK_WRITEUPS, ...BOOST_PERKS].filter((d, i, all) => d.standIn && all.findIndex((x) => x.id === d.id) === i);
  const rule = h('article', { class: 'lv-card lv-fixed' }, h('header', {}, h('h3', {}, 'The rule'), chip('effectiveSkill · src/ruleset/gear.ts')),
    h('ol', { class: 'lv-steps' },
      h('li', {}, 'A roll asks for one skill. The code also tries every other skill that shares one of its functions.'),
      h('li', {}, `Each stand-in counts at a share of its true skill and gear: the flat share (CONFIG.SUBSTITUTE_EFFICIENCY = ${pct(CONFIG.SUBSTITUTE_EFFICIENCY)}), or the skill's own table if CONFIG.SUBSTITUTES lists it.`),
      h('li', {}, 'The owner\'s perks with standIn move a share up or down (kept between ×0 and ×1).'),
      h('li', {}, 'Each candidate is then multiplied by its own tier multiplier, and the highest value is used.'),
      h('li', {}, `Function rolls (FUNCTION_ROLLS: ${FUNCTION_ROLLS.map(functionName).join(', ')}) skip the share: every skill with that function counts at ×1, then its tier, and the best one rolls.`)),
    row('Own tables', Object.keys(CONFIG.SUBSTITUTES).length ? links('standIns', Object.keys(CONFIG.SUBSTITUTES).map((id): [string, string] => [id, skillName(id)])) : none('none')),
    row('Perks that move a share', movers.length ? links('perks', movers.map((d): [string, string] => [d.id, `${d.name} (${d.standIn!.add > 0 ? '+' : ''}${d.standIn!.add}${d.standIn!.fn ? ` ${functionName(d.standIn!.fn)}` : ''})`])) : none('none yet')));
  const fnRow = ([f, g]: [string, keyof typeof GROUP_NAMES]) => h('tr', {}, h('td', {}, chip(functionName(f), toneFor('Function', functionName(f)))), h('td', {}, chip(GROUP_NAMES[g], toneFor('Group', GROUP_NAMES[g]))),
    h('td', {}, ids.filter((id) => (lib.skills[id].functions as string[]).includes(f)).map(skillName).join(', ') || '—'));
  const fns = h('article', { class: 'lv-card lv-fixed' }, h('header', {}, h('h3', {}, 'Functions and groups'), chip('FUNCTION_GROUP · functionNames.ts')),
    h('table', { class: 'hs-tbl' }, h('thead', {}, h('tr', {}, ['Function', 'Group', 'Skills with it'].map((x) => h('th', {}, x)))),
      h('tbody', {}, (Object.entries(FUNCTION_GROUP) as [string, keyof typeof GROUP_NAMES][]).map(fnRow))));
  const how = h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, 'How the code picks a stand-in'), h('div', { class: 'lv-grid wide' }, rule, fns));
  const cards = ids.map((id) => {
    const table = standInTable(id);
    // a function roll passes fullValue = fnSkills(fn), as fnRoller and ruleset.roll do
    const rolledFn = FUNCTION_ROLLS.find((f) => (lib.skills[id].functions as string[]).includes(f));
    const fullValue = rolledFn ? fnSkills(rolledFn) : undefined;
    const subs = ids.filter((o) => o !== id).map((o) => ({ o, k: standInShare(id, o, table, fullValue) })).filter((x) => x.k > 0).sort((a, b) => b.k - a.k);
    const own = !!CONFIG.SUBSTITUTES[id];
    return card('standIns', id, { id, functions: lib.skills[id].functions, table, own, functionRoll: rolledFn ?? null }, skillName(id),
      [rolledFn ? chip(`${functionName(rolledFn)} roll ×1`) : chip(own ? 'own table' : `flat ${pct(CONFIG.SUBSTITUTE_EFFICIENCY)}`, toneFor('Rule', own ? 'own table' : 'flat share'))],
      rolledFn ? row('Rolled as', h('span', {}, `a ${functionName(rolledFn)} roll: every skill with ${functionName(rolledFn)} counts at ×1, then its tier, instead of the stand-in share. See `, link('standIns', `fn-${rolledFn}`, `${functionName(rolledFn)} check`))) : null,
      row('Looks for', h('span', { class: 'lv-chips' }, table.map((t) => chip(`${functionName(t.fn)} ${pct(t.fn === rolledFn ? 1 : t.k)}`, toneFor('Function', functionName(t.fn)))))),
      subs.length ? h('table', { class: 'hs-tbl' }, h('thead', {}, h('tr', {}, ['Stand-in', 'Shared function', 'Share', 'Its tier'].map((x) => h('th', {}, x)))),
        h('tbody', {}, subs.map(({ o, k }) => h('tr', {}, h('td', {}, link('skills', o, skillName(o))),
          h('td', {}, h('span', { class: 'lv-chips' }, table.filter((t) => (lib.skills[o].functions as string[]).includes(t.fn)).map((t) => chip(functionName(t.fn), toneFor('Function', functionName(t.fn)))))),
          h('td', {}, h('b', {}, pct(k))), h('td', {}, `×${CONFIG.SKILL_TIER_MULT[lib.skills[o].tier]}`))))) : row('Stand-ins', none('none: no other skill shares a function')));
  });
  // ---- function checks: a roll that passes fn (RollRequest.fn) counts every skill with it at ×1; the best one rolls ----
  const fnRule = h('article', { class: 'lv-card lv-fixed' }, h('header', {}, h('h3', {}, 'How a function check works'), chip('fnRoller · fnSkills · src/ruleset/gear.ts')),
    h('ol', { class: 'lv-steps' },
      h('li', {}, 'The roll names a function, not a skill (RollRequest.fn). It still asks for the function\'s default skill (SENSE_SKILL).'),
      h('li', {}, 'Every skill with that function counts at ×1 (fnSkills). No stand-in share applies, and stand-in perks don\'t change it.'),
      h('li', {}, 'Each one is multiplied by its own tier multiplier, plus true skill, gear and perks as usual. The highest value rolls.'),
      h('li', {}, 'Light and other situation modifiers come from the skill that rolls (fnRoller), so Tremor ignores darkness.')),
    row('Functions checked this way', `FUNCTION_ROLLS: ${FUNCTION_ROLLS.map(functionName).join(', ')}`),
    row('Rolls that use them', 'sneak and hide contests (stealthDetect), searches (searchFor) and noticing an ambush (resolveAmbush) in minds/state.ts; Look around in engine/resolve.ts'),
    row('After the roll', link('perks', PK.curiouser, 'Curiouser and Curiouser'), ': Success or better on any function check counts one tier higher (allSteps.ts)'));
  const fnCards = FUNCTION_ROLLS.map((f) => {
    const rows = fnSkills(f).map((id) => ({ id, tier: CONFIG.SKILL_TIER_MULT[lib.skills[id].tier] })).sort((a, b) => b.tier - a.tier);
    const asked = (SENSE_SKILL as Record<string, string>)[f];
    const adds = Object.values(lib.perks).filter((d) => d.fnSkill?.fn === f);
    const grp = GROUP_NAMES[FUNCTION_GROUP[f]];
    return card('standIns', `fn-${f}`, { function: f, functions: [f], asks: asked ?? null, skills: rows.map((r) => r.id) }, `${functionName(f)} check`,
      [chip(`${grp} group`, toneFor('Group', grp)), chip('every skill ×1')],
      row('Asks for', asked ? link('skills', asked, skillName(asked)) : none('no default skill')),
      h('table', { class: 'hs-tbl' }, h('thead', {}, h('tr', {}, ['Skill that counts', 'Share', 'Its tier'].map((x) => h('th', {}, x)))),
        h('tbody', {}, rows.map((r) => h('tr', {}, h('td', {}, link('skills', r.id, skillName(r.id))), h('td', {}, h('b', {}, '×1')),
          h('td', {}, `×${r.tier}`))))),
      row('Perks that add to it', adds.length ? links('perks', adds.map((d): [string, string] => [d.id, `${d.name} (+${d.fnSkill!.add} true skill to every ${functionName(f)} skill)`])) : none('none')));
  });
  return panes([
    { key: 'skill', title: 'Skill checks', n: cards.length, content: [how, h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, 'When a roll needs …'), h('div', { class: 'lv-grid' }, cards))] },
    { key: 'function', title: 'Function checks', n: fnCards.length, content: [
      h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, 'Function checks'), h('div', { class: 'lv-grid wide' }, fnRule)),
      h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, 'When a roll needs the function …'), h('div', { class: 'lv-grid' }, fnCards))] },
  ]);
}

// ---------- Stacking ----------
const FEED_SEC: Record<string, string> = { perks: 'perks', items: 'gear', achievements: 'achievements' };
function stacking(): HTMLElement[] {
  const r = CONFIG.STACK_RATIO;
  const x = (n: number) => `${+n.toFixed(3)}`;
  const shares = [0, 1, 2, 3].map((i) => `×${x(r ** i)}`).join(', ');
  const ex1 = [10, 10, 10], ex2 = [{ type: 'achievement', value: 10 }, { type: 'gear', value: 10 }];
  const rule = h('article', { class: 'lv-card lv-fixed' }, h('header', {}, h('h3', {}, 'How modifiers stack'), chip('modTotal · stackType · src/ruleset/index.ts')),
    h('ol', { class: 'lv-steps' },
      h('li', {}, 'Every modifier on a roll has a type (ModType in src/types/ruleset.ts). The sections below list what feeds each type.'),
      h('li', {}, `Within one type, the biggest counts in full and each next one at CONFIG.STACK_RATIO = ${x(r)} to the power of its place: ${shares} …`),
      h('li', {}, 'Bonuses and penalties of a type stack apart: the biggest bonus counts in full, and so does the biggest penalty.'),
      h('li', {}, 'The types then add together in full.'),
      h('li', {}, `A source given in skill points counts at CONFIG.SKILL_WEIGHT = ${x(CONFIG.SKILL_WEIGHT)} as a roll modifier, like skill itself (a +5 skill Bane is +${x(5 * CONFIG.SKILL_WEIGHT)} on the roll).`)),
    row('Example', `three +10 of one type: ${x(stackType(ex1))} on the roll (stackType)`),
    row('Example', `+10 achievement and +10 gear: ${x(modTotal(ex2 as { type: string; value: number }[]))} (two types, both in full)`));
  const outside = h('article', { class: 'lv-card lv-fixed' }, h('header', {}, h('h3', {}, 'Not stacked this way'), chip('tier shifts · effective skill')),
    h('ol', { class: 'lv-steps' },
      h('li', {}, 'Tier shifts move the result a whole tier after the roll and simply add up: cover, Hidden Strike, marks, falling short on gear, Curiouser and Curiouser.'),
      h('li', {}, 'Skill changes act before the roll, on effective skill: true skill and its perks, gear skill effects, the stand-in share and the skill tier. See the Stand-ins tab.')));
  const srcCard = (s: ModSource, i: number) => {
    const feeds = s.feeds?.(lib) ?? [];
    const c = card('stacking', `${s.roll}-${s.type}-${i}`, { type: s.type, roll: s.roll, source: s.source, when: s.when, value: s.value, at: s.at, ...(s.feeds ? { feeds } : {}) }, s.source,
      [chip(MOD_TYPE_NAMES[s.type], toneFor('Type', MOD_TYPE_NAMES[s.type])), chip(s.feeds ? `${feeds.length} from the library` : 'fixed number', toneFor('Fed by', s.feeds ? 'library entries' : 'a fixed number'))],
      row('Applies to', s.when), row('Roll modifier', s.value), row('Made in', h('code', {}, s.at)),
      s.feeds ? row('From', feeds.length ? h('div', { class: 'lv-sub' }, feeds.map((f) => h('div', {}, link(FEED_SEC[f.table], f.id, f.name), f.value ? ` · ${f.value}` : ''))) : none()) : null);
    c.querySelector('.lv-id')?.remove(); // the card id is only a link target
    return c;
  };
  const byType = (roll: ModSource['roll']) => {
    const mine = MOD_SOURCES.map((s, i) => [s, i] as const).filter(([s]) => s.roll === roll);
    return (Object.keys(MOD_TYPE_NAMES) as StackedType[]).filter((t) => mine.some(([s]) => s.type === t)).map((t) => {
      const of = mine.filter(([s]) => s.type === t);
      return h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, `${MOD_TYPE_NAMES[t]} (${of.length} source${of.length === 1 ? '' : 's'})`),
        h('div', { class: 'lv-grid' }, of.map(([s, i]) => srcCard(s, i))));
    });
  };
  const n = (roll: ModSource['roll']) => MOD_SOURCES.filter((s) => s.roll === roll).length;
  return [
    h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, 'The rule'), h('div', { class: 'lv-grid wide' }, rule, outside)),
    ...panes([
      { key: 'skill', title: 'Skill rolls', n: n('skill'), content: [h('p', { class: 'hs-note' }, 'Attack, defense, sense and every other roll made with a skill (ruleset.roll).'), ...byType('skill')] },
      { key: 'event', title: 'Event rolls', n: n('event'), content: [h('p', { class: 'hs-note' }, 'The no-skill roll for luck and circumstance (ruleset.eventRoll). Statuses will count here too once they have library entries.'), ...byType('event')] },
    ]),
  ];
}

// ---------- Equations ----------
const EQUATIONS = equations(lib);
function equationsView(): HTMLElement[] {
  return [
    h('p', { class: 'hs-note' }, 'The general equations the rules use. Numbers come from CONFIG, and the examples and chances are worked out by the same functions the game calls.'),
    ...panes(EQUATIONS.map((g) => ({ key: g.key, title: g.title, n: g.equations.length, content: [
      h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, g.title), h('p', { class: 'hs-note' }, g.about),
        h('div', { class: 'lv-grid wide' }, g.equations.map((e, i) => {
          const c = card('equations', `${g.key}-${i}`, e, e.name, [chip(e.at)],
            h('p', { class: 'lv-formula' }, e.formula),
            ...(e.terms ?? []).map(([k, v]) => row(k, v)),
            e.table ? h('table', { class: 'hs-tbl' }, h('thead', {}, h('tr', {}, e.table.head.map((x) => h('th', {}, x)))),
              h('tbody', {}, e.table.rows.map((r) => h('tr', {}, r.map((x) => h('td', {}, x)))))) : null,
            ...(e.notes ?? []).map((x) => h('p', { class: 'hs-note' }, x)));
          c.querySelector('.lv-id')?.remove(); // the card id is only a link target
          c.querySelector('.lv-raw')?.remove(); // the equation is text, not a library entry
          return c;
        }))),
    ] }))),
  ];
}

/** Quest rules: quests are made in play (no library table), so this page shows the rules that shape every one,
 * read from CONFIG, the quest scales and engine/quests.ts */
const QUEST_STATE_TEXT: Record<QuestState, string> = {
  active: 'Taken on; the goal is not met yet.',
  ready: 'The goal is met. Talk to the giver in person to hand it in (a delivery to the giver finishes at once).',
  done: 'Handed in: pays its XP, counts for quest achievements and warms the giver one stance step.',
  failed: 'Can no longer be done: the giver or the target died, the item is gone, or the deadline passed (only a missed deadline cools the giver).',
  abandoned: 'You gave it up, on the Quests page or by telling the giver. Cools the giver, who remembers it, and counts toward the scar Word Not Kept.',
  called_off: 'The giver called it off, in words you heard. No XP, no stance change.',
};
const GOAL_TEXT: Record<(typeof GOAL_KINDS)[number], string> = {
  defeat: 'Defeat a number of foes of one body type, one race, or one named person. Counted by code as each falls.',
  deliver: 'Give a number of an item (or one particular item) to someone. Counted by code from what you hand over.',
  reach: 'Get to a zone or place (a place counts from any zone inside it).',
  find: 'Get a clear sight of one person.',
  other: 'Anything code cannot check. The giver judges it when you report back.',
};
function questsView(): HTMLElement[] {
  const fixed = (c: HTMLElement) => { c.querySelector('.lv-id')?.remove(); c.querySelector('.lv-raw')?.remove(); return c; };
  const gainsFor = (lv: string) => GRADES.filter((g) => CONFIG.QUEST_GAIN_LEVEL[g] === lv);
  const tbl = (head: string[], rows: (string | Node)[][]) => h('table', { class: 'hs-tbl' }, h('thead', {}, h('tr', {}, head.map((x) => h('th', {}, x)))),
    h('tbody', {}, rows.map((r) => h('tr', {}, r.map((x) => h('td', {}, x))))));
  return [
    h('p', { class: 'hs-note' }, 'Quests have no fixed list: each one is a job someone gives you in play, held in a deal, and kept in your save (see them on the Play screen\'s Quests page or with /quests). These are the rules every quest follows. Quest achievements are under Achievements.'),
    h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, 'Rules'), h('div', { class: 'lv-grid wide' },
      fixed(card('quests', 'reward', {}, 'Reward levels and XP', [chip('QUEST_REWARD_XP · QUEST_GAIN_LEVEL')],
        h('p', { class: 'hs-note' }, 'A quest\'s reward level is set when you accept it, from how much the scenario stands to gain. Quests have their own XP table, apart from achievements.'),
        tbl(['Level', 'XP', 'Scenario gain when accepted'], QUEST_REWARD_LEVELS.keys.map((lv) => {
          const g = gainsFor(lv);
          return [QUEST_REWARD_LEVELS.name(lv), String(CONFIG.QUEST_REWARD_XP[lv] ?? 0), g.length ? g.join(', ') : 'none yet (kept for story quests)'];
        })))),
      fixed(card('quests', 'defeat-xp', {}, 'Defeat jobs against weak foes', [chip('questXp · weakFoeTaper')],
        h('p', { class: 'lv-formula' }, `XP × min(1, ${CONFIG.DEFEAT_XP_TAPER} × average foe power ÷ your power)`),
        h('p', { class: 'hs-note' }, 'A defeat job pays less when its foes were far weaker than you, using the same taper as defeat XP. Each foe\'s power is taken when it falls; yours is taken when you hand in.'))),
      fixed(card('quests', 'pay', {}, 'Pay', [chip('payText')],
        row('Promise', 'The giver may promise coin, an item, or both.'),
        row('Owed', 'Anything the giver hands you counts toward what they promised, oldest job first.'),
        row('Unpaid', 'Still owed when the talk you handed in during ends: a broken promise the giver remembers.'),
        row('No pay', 'A job done with nothing promised counts for the achievement For Nothing.'))),
      fixed(card('quests', 'more', {}, 'Deadlines, linked quests and limits', [],
        row('Deadline', 'Due in a number of days, at the end of that day or by a time of day. Missing it fails the quest and cools the giver. Done before half the time ran out counts as early.'),
        row('Linked', 'A quest can follow an earlier one. A run of follow-ups all done counts once for Saw It Through.'),
        row('One each', 'One open quest per giver at a time.'),
        row('Pinned', 'One quest can be pinned to the Play screen\'s quest line; otherwise it shows the newest open one.'))))),
    h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, 'States'), h('div', { class: 'lv-grid' },
      QUEST_STATES.map((st) => fixed(card('quests', `state-${st}`, {}, QUEST_STATE_NAME[st], [], h('p', {}, QUEST_STATE_TEXT[st])))))),
    h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, 'Goal kinds'), h('div', { class: 'lv-grid' },
      GOAL_KINDS.map((k) => fixed(card('quests', `goal-${k}`, {}, label(k), [], h('p', {}, GOAL_TEXT[k])))))),
  ];
}

/** Nerve lines (PL2, PL3, PL20): one ordered scale per line; the tier comes from raw Resolve (NERVE_TIER_FROM), the line
 * from Nerve points (PERSONALITY_LEAN) */
function nerveView(): HTMLElement[] {
  const from = CONFIG.NERVE_TIER_FROM, lines = Object.keys(NERVE_LINES) as NerveLine[], lean = CONFIG.PERSONALITY_LEAN;
  const when: Record<NerveLine, string> = { cautious: `Nerve −${lean} or lower`, steady: `Nerve −${lean - 1} to +${lean - 1}`, daring: `Nerve +${lean} or higher` };
  const tbl = h('table', { class: 'hs-tbl' }, h('thead', {}, h('tr', {}, h('th', {}, 'Raw Resolve'), lines.map((l) => h('th', {}, label(l))))),
    h('tbody', {}, from.map((r, i) => h('tr', {}, h('td', {}, i + 1 < from.length ? `${r}–${from[i + 1] - 1}` : `${r}+`),
      lines.map((l) => { const sc = NERVE_LINES[l] as Scale<string>; return h('td', {}, sc.name(sc.at(i))); })))));
  return [
    h('p', { class: 'hs-note' }, `A character's Nerve points pick its line; its raw Resolve picks the tier on that line. Past ${from[from.length - 1]} Resolve, every ${CONFIG.NERVE_BEYOND_STEP} more adds a + to the name (e.g. ${(NERVE_LINES.steady as Scale<string>).name((NERVE_LINES.steady as Scale<string>).at(from.length - 1))}+). A named line sets Nerve to ±${CONFIG.NERVE_LINE_POINTS}. The morale level is the mood; the tier never moves with it.`),
    h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, 'Tiers by line'), tbl),
    h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, 'Lines'), h('div', { class: 'lv-grid' },
      lines.map((l) => card('nerve', l, { line: l, tiers: (NERVE_LINES[l] as Scale<string>).keys }, label(l), [],
        row('When', when[l]), row('Tiers', (NERVE_LINES[l] as Scale<string>).keys.map((k) => (NERVE_LINES[l] as Scale<string>).name(k)).join(', ')))))),
  ];
}
/** a point or condition in words: "Pride +40", "Resolve (raw) 80 or more", "best fighting skill 19 or less" */
const FACT_NAMES: Record<string, string> = { nerve: 'Nerve', [SK.resolve]: 'Resolve (raw)', bestSkill: 'best skill', bestFight: 'best fighting skill', bestAttack: 'best attacking skill' };
const factName = (k: string) => FACT_NAMES[k] ?? lib.personalityAxes?.[k]?.name ?? k;
const signed = (k: string, n: number) => (lib.personalityAxes?.[k] || k === 'nerve' ? `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}` : String(n));
function personalityTypesView(): HTMLElement[] {
  return [h('p', { class: 'hs-note' }, `A character's archetype is the nearest row: the gap over every axis and Nerve (left out = 0), and how far its top values are from the row's, counted ${CONFIG.ARCHETYPE_VALUE_WEIGHT} times. The agent gets it with up to ${CONFIG.BUTS_SHOWN} traits it doesn't explain.`),
    h('div', { class: 'lv-grid' }, Object.values(lib.personalityTypes ?? {}).map((t) => card('personalityTypes', t.id, t, t.name, [],
      row('Target', Object.entries({ ...t.target, ...(t.nerve ? { nerve: t.nerve } : {}) }).map(([k, n]) => `${factName(k)} ${signed(k, n)}`).join(', ') || none('all 0')),
      row('Values', t.values?.length ? links('values', t.values.map((v): [string, string] => [v, lib.values?.[v]?.name ?? v])) : none('none')),
      row('Acts', t.hint))))];
}
function tensionsView(): HTMLElement[] {
  return [h('p', { class: 'hs-note' }, `Two parts of a character that pull against each other. The agent gets the first ${CONFIG.TENSIONS_SHOWN} met, in this order.`),
    h('div', { class: 'lv-grid' }, Object.values(lib.tensions ?? {}).map((t) => card('tensions', t.id, t, t.name, [],
      row('When', h('ul', { class: 'lv-names' }, [
        ...Object.entries(t.when.min ?? {}).map(([k, n]) => h('li', {}, `${factName(k)} ${signed(k, n)} or more`)),
        ...Object.entries(t.when.max ?? {}).map(([k, n]) => h('li', {}, `${factName(k)} ${signed(k, n)} or less`)),
        ...(t.when.nerveLine ? [h('li', {}, `${label(t.when.nerveLine)} nerve`)] : []),
        ...(t.when.ageStage ? [h('li', {}, LIFE_STAGES.name(t.when.ageStage))] : []),
        ...(t.when.drives ?? []).map((d) => h('li', {}, `values ${lib.values?.[d]?.name ?? d}`)),
        ...(t.when.anyDrive ? [h('li', {}, `values ${t.when.anyDrive.map((d) => lib.values?.[d]?.name ?? d).join(' or ')}`)] : []),
      ])),
      row('Acts', t.hint))))];
}
function personalityAxesView(): HTMLElement[] {
  const words = CONFIG.TRAIT_WORDS.map(([n, w]) => (w.trim() ? `"${w.trim()}" from ${n}` : `no word from ${n}`)).join(', ');
  return [h('p', { class: 'hs-note' }, `Each axis runs −100 to +100. A trait counts from ${CONFIG.PERSONALITY_LEAN} away from 0; the word before it comes from the distance: ${words}.`),
    h('div', { class: 'lv-grid' }, Object.values(lib.personalityAxes ?? {}).map((a) => card('personalityAxes', a.id, a, a.name, [],
      row('Low end', `${a.low} (${a.lowHint})`), row('High end', `${a.high} (${a.highHint})`),
      row('NPCs', ((ts) => ts.length ? links('templates', ts) : none('none lean here'))(Object.values(lib.templates).filter((t) => Math.abs(t.personality?.traits?.[a.id] ?? 0) >= CONFIG.PERSONALITY_LEAN).map((t): [string, string] => [t.id, t.label ?? t.id]))))))];
}

/** Threadbound items (D-218): one card per item. Its grants are drawn as unlock paths, one per achievement chain, in
 * chain order: each step is the achievement that opens it (with the engine's earnedAtText) and the perk it gives */
function threadboundView(): HTMLElement[] {
  const items = Object.values(lib.items).filter((i) => i.threadbound) as ItemDef[];
  const ach = lib.achievements ?? {};
  const rootOf = (id: string): string => { let k = id; for (let i = 0; i < 50 && ach[k]?.after; i++) k = ach[k].after!; return k; };
  const depth = (id: string): number => { let n = 0, k = id; while (ach[k]?.after && n < 50) { k = ach[k].after!; n++; } return n; };
  const givers = (rank: string) => Object.values(lib.perks).filter((pk) => pk.grantsThreadboundItem && THREADBOUND_RANKS.pos(rank as ThreadboundRankKey) >= THREADBOUND_RANKS.pos(pk.grantsThreadboundItem.minRank));
  const step = (g: { perk: string; achievement: string }, i: number) => {
    const a = ach[g.achievement], pk = lib.perks[g.perk], r = pk?.rules;
    return h('li', { class: 'lv-tb-step' },
      h('span', { class: 'lv-tb-n', 'aria-hidden': 'true' }, String(i + 1)),
      h('div', { class: 'lv-tb-body' },
        h('div', { class: 'lv-tb-unlock' }, h('span', { class: 'lv-k' }, 'Unlocks with '), a ? link('achievements', a.id, a.name) : g.achievement,
          a ? h('span', { class: 'lv-tb-at' }, ` · ${earnedAtText(NO_STATE, a)}`) : null, a?.scar ? chip('scar', toneFor('Kind', 'scar')) : null),
        h('div', { class: 'lv-tb-perk' }, pk ? link('perks', pk.id, pk.name) : g.perk, r ? chip(r.kind) : null, r?.cooldown ? h('span', { class: 'lv-tb-at' }, ` ${r.cooldown}`) : null),
        r ? h('p', { class: 'lv-tb-effect' }, r.effect.replace(/^./, (c) => c.toUpperCase()) + '.') : pk?.story ? h('p', { class: 'lv-tb-effect' }, pk.story) : null));
  };
  return [
    h('p', { class: 'hs-note' }, 'Each Threadbound item is one of a kind in the world. It binds to the first person who wears it, and no one else can wear it after that. Its owner can summon it from wherever it is. While the owner wears it, each ability opens once the owner has earned the achievement beside it, and stays open even after a higher level of that achievement replaces it. In anyone else\'s hands it does nothing. The Weaver does not place these items in scenes.'),
    h('div', { class: 'lv-grid wide' }, items.map((it) => {
      const tb = it.threadbound!;
      const chains = new Map<string, { perk: string; achievement: string }[]>();
      for (const g of tb.grants) { const k = rootOf(g.achievement); chains.set(k, [...(chains.get(k) ?? []), g]); }
      const giv = givers(tb.rank);
      return card('threadbound', it.id, it, it.name, [chip(THREADBOUND_RANKS.name(tb.rank)), chip(it.slot ?? it.kind), chip(`${tb.grants.length} abilities`)],
        it.look ? h('p', { class: 'lv-story' }, it.look) : null,
        h('div', { class: 'lv-tb-paths' }, [...chains].map(([root, gs]) => h('section', { class: 'lv-tb-path' },
          h('h4', { class: 'lv-chainlabel' }, `${ach[root]?.name ?? root} chain`),
          h('ol', { class: 'lv-tb-steps' }, gs.sort((x, y) => depth(x.achievement) - depth(y.achievement)).map(step))))),
        row('Value', `${it.value.toLocaleString('en')} coin${it.boon ? `, boon ${it.boon}` : ''}`),
        row('How to get it', giv.length ? h('span', {}, 'Found in the world, or given by ', links('perks', giv.map((pk) => [pk.id, pk.name])),
          ...giv.flatMap((pk) => pk.classLevel ? [` (${className(pk.classLevel.classId)} level ${pk.classLevel.level})`] : []),
          `, which hands over one Threadbound item of ${THREADBOUND_RANKS.name(giv[0].grantsThreadboundItem!.minRank)} or higher, picked at random from those not yet in the world`) : 'found in the world'));
    })),
  ];
}

/** Essences (growth proposal 2): what each one gives and where it comes from, read from the engine's own rules and numbers */
function essencesView(): HTMLElement[] {
  const C = CONFIG;
  const grades = ESSENCE_GRADES.keys.map((g) => `${ESSENCE_GRADES.name(g)} ×${C.ESSENCE_GRADE_MULT[g] ?? 1}`).join(', ');
  const fromText = (e: EssenceDef): Node | string => e.from.deed
    ? 'A deed: a scenario you resolve at Great Success or better, in which you beat no foe whose race or body type has essences. It is built on the skill you used most in that scenario.'
    : h('span', {}, 'Beating a notable ', e.from.race ? link('races', e.from.race, lib.races?.[e.from.race]?.name ?? e.from.race) : e.from.bodyType ? link('bodyTypes', e.from.bodyType, lib.bodyTypes[e.from.bodyType]?.name ?? e.from.bodyType) : '?',
      ` foe: one whose power is at least ${Math.round(C.ESSENCE_NOTABLE_SHARE * 100)}% of yours, or a notable or rolled NPC. Each such foe rolls once, ever. A scenario you resolve at Great Success or better can also offer one from the foes you beat in it.`);
  const split = (e: EssenceDef) => { const w = e.skills.reduce((n, x) => n + x.weight, 0) || 1;
    return e.skills.length ? e.skills.map((x) => `${skillName(x.skill)} ${Math.round((x.weight / w) * 100)}%`).join(', ') : 'the skill you used most in the scenario, all of it'; };
  const all = Object.values(lib.essences ?? {});
  return [
    h('p', { class: 'hs-note' }, `An essence is a package of true skill points (and later a trait) you can take into a slot. You have ${C.ESSENCE_SLOTS_BASE} slot, plus one every ${C.ESSENCE_SLOT_EVERY} character levels. When one is offered, an offer roll (d100 + base − ${C.ESSENCE_ROLL_NEEDED} on the tier table) sets its grade: Success gives Common, Great Success Fine, Critical Success Rare and so on; Near Miss or worse gives nothing. The base is ${C.ESSENCE_ROLL_BASE.foe} for a beaten foe and a Great Success scenario, ${C.ESSENCE_ROLL_BASE.critical_success} for a Critical Success one. Points = ${C.ESSENCE_SHARE} × the source's skill × the grade (${grades}; each grade past the last ×${C.ESSENCE_GRADE_PAST_MULT}), at least 1, split over the essence's skills by their shares. An offer waits ${C.ESSENCE_OFFER_ROUNDS * C.ROUND_S / 60} min of game time. Letting a held essence go (only at rest) costs ${C.ESSENCE_REMOVE_LEVELS} level's worth of XP.`),
    h('div', { class: 'lv-grid' }, all.map((e) => card('essences', e.id, e, e.name, [chip(e.from.deed ? 'deed' : 'foe')],
      h('p', { class: 'lv-story' }, e.story),
      row('Gives', h('span', {}, 'True skill: ', split(e))),
      row('Trait', e.trait ? link('perks', e.trait, lib.perks[e.trait]?.name ?? e.trait) : none('none yet: essence traits are not written')),
      e.quirk ? row('Quirk', link('perks', e.quirk, lib.perks[e.quirk]?.name ?? e.quirk)) : null,
      row('Comes from', fromText(e)),
      e.from.deed ? null : ((n) => row('Picked', n === 1 ? `always: the only essence of that ${e.from.race ? 'race' : 'body type'}` : `by weight ${e.weight} among the ${n} essences of that ${e.from.race ? 'race' : 'body type'}`))((e.from.race ? all.filter((x) => x.from.race === e.from.race) : all.filter((x) => x.from.bodyType === e.from.bodyType)).length)))),
  ];
}

// ---------- Page ----------
const CUSTOM: Section[] = [
  { key: 'gear', title: 'Gear', table: 'items', view: gear },
  { key: 'gearClasses', title: 'Gear classes', table: 'gearClasses', view: gearClasses },
  { key: 'essences', title: 'Essences', table: 'essences', view: essencesView },
  { key: 'threadbound', title: 'Threadbound', table: 'items', view: threadboundView, count: Object.values(lib.items).filter((i) => i.threadbound).length },
  { key: 'perks', title: 'Perks', table: 'perks', view: perks },
  { key: 'races', title: 'Races', table: 'races', view: races },
  { key: 'bodyTypes', title: 'Body types', table: 'bodyTypes', view: bodyTypes },
  { key: 'achievements', title: 'Achievements', table: 'achievements', view: achievements },
  { key: 'skills', title: 'Skills', table: 'skills', view: skills },
  { key: 'standIns', title: 'Stand-ins', table: 'skills', view: standIns },
  { key: 'classes', title: 'Classes', table: 'classes', view: classes },
  { key: 'healing', title: 'Healing', table: 'healing', view: healing },
  { key: 'composure', title: 'Composure', table: 'composure', view: composure },
  { key: 'fears', title: 'Fears', table: 'fears', view: fears },
  { key: 'nerve', title: 'Nerve lines', table: 'perks', view: nerveView, count: Object.keys(NERVE_LINES).length },
  { key: 'personalityAxes', title: 'Personality axes', table: 'personalityAxes', view: personalityAxesView },
  { key: 'personalityTypes', title: 'Archetypes', table: 'personalityTypes', view: personalityTypesView },
  { key: 'tensions', title: 'Tensions', table: 'tensions', view: tensionsView },
  { key: 'quests', title: 'Quests', table: 'perks', view: questsView, count: 4 + QUEST_STATES.length + GOAL_KINDS.length },
  { key: 'stacking', title: 'Stacking', table: 'perks', view: stacking, count: MOD_SOURCES.length },
  { key: 'equations', title: 'Equations', table: 'perks', view: equationsView, count: EQUATIONS.reduce((n, g) => n + g.equations.length, 0) },
];
const treeOf = (skill?: string) => (skill ? lib.trees[lib.skills[skill]?.treeId]?.name : undefined);
/** every skill a perk belongs to or changes: its ladder or write-up skill, its All-XX part, skills it adds to,
 * skills of the function it boosts, and both ends of an augment */
const perkSkills = (d: PerkDef & { skill?: string }): string[] => [...new Set([d.ladder?.skill, d.skill, d.allStep?.skill,
  ...Object.keys(d.trueSkillTo ?? {}), ...(d.fnSkill ? fnSkills(d.fnSkill.fn) : []), ...(d.augments ?? []).flatMap((a) => [a.from, a.skill])]
  .filter((x): x is string => !!x && !!lib.skills[x]))];
/** an achievement gives more than XP: a Bane skill bonus, the defeats roll bonus, or any reward line (free levels, perks…) */
const specialReward = (d: AchievementDef): boolean => (isBane(d) && baneSkill(d.id) > 0) || (d.rule === 'defeats' && !d.by && defeatsRoll(d.id) > 0) || rewardLines(d).length > 0;
const FACETS: Record<string, Facets> = {
  composure: (d: ComposureDef) => [['In fight', d.inFight ? 'yes' : 'no'], ['Kind', d.countOnly ? 'tally only' : d.hourly ? 'hourly' : 'one-off']],
  fears: (f: FearDef) => [['Roll', f.rolled ? 'rolled' : 'flat'], ['Cost', f.partCost || f.partCostOf ? 'by part' : f.perTier ? 'per tier' : f.cost < 0 ? 'restores' : 'flat cost'], ['Part', f.part && PART_STATES.name(f.part)]],
  gearClasses: (g: { use?: string }) => [['Use', g.use]],
  healing: (d: HealingDef) => [['Reach', d.reach], ['In fight', d.inFight ? 'yes' : 'no'], ['Restores', d.hourly ? 'health hourly' : undefined],
    ...(['hpPct', 'partPct', 'composure'] as const).filter((k) => d[k]).map((k): [string, string] => ['Restores', { hpPct: 'health', partPct: 'body parts', composure: 'morale' }[k]])],
  races: (r: { intelligence?: string }) => [['Intelligence', r.intelligence && INTELLIGENCE.name(r.intelligence as 'intelligent')]],
  classes: (c: ClassDef) => [['Tier', CLASS_TIERS.name(c.tier)], ['Kind', c.fallback ? 'default class' : c.creation ? 'starting class' : 'unlocked in play']],
  stacking: (e: { type?: StackedType; roll?: string; feeds?: unknown[] }) => [['Type', e.type && MOD_TYPE_NAMES[e.type]], ['Roll', e.roll && `${e.roll} rolls`],
    ['Fed by', e.type ? (e.feeds ? 'library entries' : 'a fixed number') : undefined]],
  standIns: (e: { id?: string; functions?: string[]; own?: boolean }) => [['Rule', e.id ? (e.own ? 'own table' : 'flat share') : undefined], ['Tree', treeOf(e.id)],
    ...(e.functions ?? []).map((f): [string, string] => ['Function', functionName(f)])],
  gear: (i: ItemDef) => [['Kind', i.kind], ['Gear class', i.gearClass && lib.gearClasses?.[i.gearClass]?.name], ...(i.weapon?.modes ?? []).flatMap((m): [string, string][] => [['Attack', m.tree], ['Class', m.class]]), ['Class', i.armor?.weight],
    ...[...(['concealed', 'stackable', 'consumable'] as const).filter((f) => i[f]), ...(i.tags ?? [])].filter((f) => f !== i.kind).map((f): [string, string] => ['Flag', f])], // a flag that repeats the kind says nothing new
  perks: (d: PerkDef & { place?: string; skill?: string; bankedAs?: string }) => [['Banked as', d.bankedAs && ({ milestone: 'milestone perk', allX: 'All-X candidate', other: 'other' } as Record<string, string>)[d.bankedAs]], ['Milestone', d.ladder ? ms(d) : d.place && label(d.place)], ['Effect', d.effect], ['State', d.built === undefined ? 'written only' : d.built ? 'built' : 'not built'],
    ['State', d.quirk ? 'quirk' : undefined], ['Tree', d.allStep ? lib.trees[d.allStep.treeId]?.name : treeOf(d.ladder?.skill ?? d.skill)],
    ...perkSkills(d).map((sk): [string, string] => ['Skill', skillName(sk)])],
  achievements: (d: AchievementDef) => [...achTags(d).map((t): [string, string] => ['Tag', achTagName(t)]), ['Kind', d.scar ? 'scar' : 'achievement'], ['Level', `Level ${rewardName(d.level)}`],
    ['Reward', specialReward(d) ? 'special reward' : 'XP only'], ['Personality', d.personality || d.personalityByKind ? 'gives points' : 'none']],
  bodyTypes: (c: BodyType) => [['Size', c.general.size], ['Figure', c.figure ? 'has figure' : 'no figure']],
  skills: (t: { skills?: string[]; access?: TreeAccess }) => [['Access', classTree(t.access) ? 'class tree' : t.access?.must?.length || t.access?.either?.length ? 'needs a source' : 'general'],
    ...(t.access?.blockedBy ?? []).map((c): [string, string] => ['Blocked by', condName(c)]),
    ...(t.skills ?? []).flatMap((id) => groupsOf(lib.skills[id]).map((g): [string, string] => ['Group', GROUP_NAMES[g]]))],
};
/** generic tables: a short field with 2–8 values shared by entries becomes a filter group */
function autoFacets(table: Record<string, Entry>): Facets {
  const rows = Object.values(table);
  const keys = [...new Set(rows.flatMap(Object.keys))].filter((k) => k !== 'id' && rows.every((r) => r[k] === undefined || ['string', 'number', 'boolean'].includes(typeof r[k])))
    .filter((k) => { const n = new Set(rows.map((r) => r[k]).filter((v) => v !== undefined)).size; return n >= 2 && n <= 8 && n < rows.length; })
    .sort((a, b) => Number(rows.some((r) => typeof r[a] !== 'string')) - Number(rows.some((r) => typeof r[b] !== 'string'))).slice(0, 4); // words before numbers
  // groups and values in words: raceId RC1 → Race: Human
  return (e: Entry) => keys.map((k) => [humanKey(k), typeof e[k] === 'string' ? typedId(e[k] as string)?.textContent ?? (e[k] as string) : (e[k] as string)]);
}

const NAMES: Partial<Record<keyof Library, string>> = { templates: 'NPCs', durations: 'Clock', routineSets: 'Routine sets', zoneKinds: 'Zone kinds', edgeKinds: 'Edge kinds', zoneSizes: 'Zone sizes', roadLengths: 'Road lengths', roadDangers: 'Road dangers', noiseLevels: 'Noise levels', visibilityLevels: 'Visibility levels', values: 'Values', layouts: 'Layouts' };
const SECTIONS: Section[] = [...CUSTOM, ...(Object.keys(lib) as (keyof Library)[])
  .filter((k) => typeof lib[k] === 'object' && !CUSTOM.some((c) => c.table === k) && k !== 'trees' && Object.keys(lib[k] as object).length)
  .map((k) => ({ key: k, title: NAMES[k] ?? humanKey(k), table: k }))];

// the rail in groups; a table not named here (a new one) lands in More
const RAIL_GROUPS: [string, string[] | null][] = [
  ['Library', ['gear', 'threadbound', 'gearClasses', 'perks', 'essences', 'races', 'bodyTypes', 'classes', 'skills', 'achievements']],
  ['Rules', ['standIns', 'stacking', 'equations', 'attackModes', 'durations', 'healing', 'composure', 'quests', 'fears', 'status']],
  ['Places', ['zoneKinds', 'zoneSizes', 'edgeKinds', 'barrierKinds', 'roadLengths', 'roadDangers', 'layouts', 'noiseLevels', 'visibilityLevels']],
  ['People', ['templates', 'roles', 'activities', 'routines', 'routineSets', 'services']],
  ['Personality', ['nerve', 'personalityAxes', 'personalityTypes', 'tensions', 'values']],
  ['More', null], // a table not named above (a new one) lands here
];
const railFolds = new Set<string>(remember<string[]>('lv-railfolds', []));
const sizeOf = (s: Section) => s.count ?? Object.keys(lib[s.table] as object).length;
const rail = h('nav', { class: 'hs-rail', 'aria-label': 'Library tables' }, h('div', { class: 'hs-brand' }, 'LIB', h('span', { class: 'ar' }, `v${lib.version}`)),
  RAIL_GROUPS.flatMap(([g, keys]) => {
    const list = keys ? keys.flatMap((k) => SECTIONS.filter((s) => s.key === k)) : SECTIONS.filter((s) => !RAIL_GROUPS.some(([, k]) => k?.includes(s.key)));
    const grp = g.toLowerCase(); // each group has its own colour (CSS [data-group]), so the breaks between them read at a glance
    const items = list.map((s) => { const n = sizeOf(s); return h('a', { href: `#${s.key}`, 'data-sec': s.key, 'data-group': grp, class: railFolds.has(grp) ? 'lv-railfold' : '', 'aria-label': `${s.title}, ${n} entries` }, s.title, h('span', { class: 'lv-n', 'aria-hidden': 'true' }, String(n))); });
    // clicking a group's label folds its tables away (the open table stays); remembered in this browser
    const head = h('button', { type: 'button', class: 'lv-railgroup', 'data-group': grp, 'aria-expanded': String(!railFolds.has(grp)), onclick: () => {
      const fold = !railFolds.delete(grp) && !!railFolds.add(grp);
      head.setAttribute('aria-expanded', String(!fold)); items.forEach((a) => a.classList.toggle('lv-railfold', fold)); keep('lv-railfolds', [...railFolds]);
    } }, g);
    return list.length ? [head, ...items] : [];
  }));
const picks = new Map<string, 'shown' | 'out'>();
// each table keeps its own filter picks, remembered across visits and reloads (this browser only)
const picksBy = remember<Record<string, [string, 'shown' | 'out'][]>>('lv-picks', {});
const bar = h('div', { class: 'lv-filters', 'aria-label': 'Filters' });
const search = h('input', { class: 'hs-input lv-search', type: 'search', placeholder: 'Filter this table', 'aria-label': 'Filter this table', oninput: filter });
const titleEl = h('h1', {});
const results = h('p', { class: 'lv-results', 'aria-live': 'polite' });
const empty = h('div', { class: 'lv-empty', hidden: true });
const body = h('div', { class: 'lv-body' });
// Refresh: posts a comment sent to Claude (the comments capability), which wakes the viewer's thread to rebuild
// from main and republish. Hidden when the page runs outside claude.ai or the viewer can't send to Claude.
const refreshNote = h('span', { class: 'lv-refresh-note' });
const refresh = h('button', { type: 'button', class: 'hs-btn-main lv-refresh', hidden: true }, 'Refresh from code');
type CommentsApi = { anchorFor(el: Element): Promise<unknown>; canSendToClaude(): Promise<string>; sendToClaude(t: { anchor: unknown; text: string }): Promise<unknown> };
const claudeRt = (window as unknown as { claude?: { use(n: string): Promise<CommentsApi | null> } }).claude;
claudeRt?.use('comments').then(async (api) => {
  if (!api || (await api.canSendToClaude().catch(() => 'off')) !== 'available') return;
  refresh.hidden = false;
  refresh.onclick = async () => {
    (refresh as HTMLButtonElement).disabled = true;
    refreshNote.textContent = 'Asking Claude to rebuild…';
    try {
      await api.sendToClaude({ anchor: await api.anchorFor(refresh), text: `Refresh the library viewer: rebuild from main and republish (this page is commit ${__BUILD__.sha}).` });
      refreshNote.textContent = 'Sent. Reload the page in a few minutes to see the new build.';
    } catch {
      refreshNote.textContent = 'Could not reach Claude from here. Leave a comment and send it to Claude instead.';
      (refresh as HTMLButtonElement).disabled = false;
    }
  };
}).catch(() => undefined);
const main = h('main', {}, h('div', { class: 'head' }, h('div', { class: 'lv-head-main' },
  h('div', { class: 'lv-titlerow' }, titleEl, h('p', { class: 'lv-build', title: 'Library as the code builds it (prototypeLibrary)' }, `Built from code · commit ${__BUILD__.sha} · ${fmtDate(__BUILD__.date)}`, ' ', refresh, ' ', refreshNote)),
  h('div', { class: 'lv-meta' }, results)), search), bar, body);
// sub-tabs live in a rail on the right, mirroring the table rail on the left; hidden when the tab has none
const subRail = h('nav', { class: 'hs-rail lv-subrail', 'aria-label': 'Sub-tabs' });
body.id = 'lv-content';
body.tabIndex = -1;
const skip = h('button', { type: 'button', class: 'lv-skip', onclick: () => body.focus() }, 'Skip to the entries');
document.body.append(skip, rail, main, subRail);
// "/" jumps to the search, as in most tools
addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target as HTMLElement;
  if (t.closest('input, textarea, [contenteditable]')) return;
  e.preventDefault();
  search.focus();
});

const cards = () => [...Array.from(body.querySelectorAll<HTMLElement>('.lv-card:not(.lv-fixed)'))].filter((c) => !c.closest('.lv-pane[hidden]'));
const facetsOf = (c: HTMLElement) => (c.dataset.f ? c.dataset.f.split('\n') : []);
// Filter bar: one chip-button per group ("Kind ▾", or "Kind: 2 shown, 1 left out") opens a popover with the
// value buttons, which cycle off → Shown → Left out (several Shown in a group = either), as on the game's tiles.
// One "Colour by" control picks the group the cards are tinted by; its key also shows beside the results line.
let openGroup = ''; // the group whose popover is open, kept across redraws
const keyEl = h('span', { class: 'lv-ckey', 'aria-label': 'Colour key' });
results.after(keyEl);
function popover(id: string, label: string, active: boolean, content: (Node | null)[]): HTMLElement[] {
  const pid = `lv-pop-${id.replace(/\W+/g, '-')}`;
  const btn = h('button', { type: 'button', class: `lv-fbtn${active ? ' on' : ''}`, popovertarget: pid, 'aria-haspopup': 'true' }, label, h('span', { class: 'lv-caret', 'aria-hidden': 'true' }, '▾'));
  const panel = h('div', { class: 'lv-fpop', id: pid, popover: 'auto', 'aria-label': label }, ...content);
  panel.addEventListener('toggle', (e) => {
    const open = (e as ToggleEvent).newState === 'open';
    if (open) { openGroup = id; const r = btn.getBoundingClientRect(); panel.style.left = `${Math.min(r.left, innerWidth - 16 - panel.offsetWidth)}px`; panel.style.top = `${r.bottom + 4}px`; }
    else if (openGroup === id && panel.isConnected) openGroup = '';
  });
  return [btn, panel];
}
function drawBar(): void {
  const groups = new Map<string, Map<string, number>>();
  const q = search.value.trim().toLowerCase();
  for (const c of cards()) for (const f of facetsOf(c)) {
    const [g] = f.split('\t');
    const vals = groups.get(g) ?? groups.set(g, new Map()).get(g)!;
    // each count is what clicking the chip would show: the other groups' filters and the search still apply
    vals.set(f, (vals.get(f) ?? 0) + (passes(c, q, g) ? 1 : 0));
  }
  const next = { off: 'shown', shown: 'out', out: 'off' } as const;
  const shownGroups = [...groups].filter(([, v]) => v.size > 1);
  const colourable = (g: string) => TONES?.has(g) ?? false;
  if (!shownGroups.some(([g]) => g === colourBy && colourable(g))) colourBy = shownGroups.find(([g]) => colourable(g))?.[0] ?? '';
  const sortVals = (vals: Map<string, number>) => [...vals].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  const swatches = (g: string) => sortVals(groups.get(g) ?? new Map()).map(([f]) => { const v = f.split('\t')[1]; return h('span', { class: 'lv-kv', style: `--tone: var(${toneFor(g, v) ?? '--c3'})` }, h('i', { class: 'lv-sw' }), v); });
  const groupEls = shownGroups.flatMap(([g, vals]) => {
    const sh = [...vals.keys()].filter((f) => picks.get(f) === 'shown').length;
    const out = [...vals.keys()].filter((f) => picks.get(f) === 'out').length;
    const label = sh || out ? `${g}: ${[sh ? `${sh} shown` : '', out ? `${out} left out` : ''].filter(Boolean).join(', ')}` : g;
    return popover(g, label, !!(sh || out), [h('div', { class: 'lv-fvals' }, sortVals(vals).map(([f, n]) => {
      const st = picks.get(f) ?? 'off';
      const v = f.split('\t')[1];
      return h('button', { type: 'button', class: `lv-fb${n ? '' : ' lv-zero'}`, 'data-st': st, 'aria-pressed': String(st !== 'off'), 'aria-label': `${v}, ${n} ${n === 1 ? 'entry' : 'entries'}${st === 'off' ? '' : st === 'shown' ? ', shown' : ', left out'}`,
        style: g === colourBy ? `--tone: var(${toneFor(g, v) ?? '--c3'})` : undefined,
        title: st === 'off' ? 'Click for Shown (several Shown = either)' : st === 'shown' ? 'Click for Left out' : 'Click to clear',
        onclick: () => { const to = next[st]; if (to === 'off') picks.delete(f); else picks.set(f, to); filter(); } },
      g === colourBy ? h('i', { class: 'lv-sw' }) : null, v, h('small', {}, String(n)), st === 'off' ? null : h('b', {}, st === 'shown' ? 'Shown' : 'Left out'));
    }))]);
  });
  const cgroups = shownGroups.map(([g]) => g).filter(colourable);
  const colourEls = cgroups.length ? popover('Colour by', `Colour by: ${colourBy}`, false, [
    h('div', { class: 'lv-fvals', role: 'group', 'aria-label': 'Colour the cards by' }, cgroups.map((g) => h('button', { type: 'button', class: 'lv-fb', 'aria-pressed': String(g === colourBy),
      'data-st': g === colourBy ? 'shown' : 'off', onclick: () => { colourBy = g; drawBar(); paint(); } }, g))),
    colourBy ? h('div', { class: 'lv-ckey' }, swatches(colourBy)) : null]) : [];
  bar.replaceChildren(...groupEls, ...(colourEls.length ? [h('span', { class: 'lv-fsep', 'aria-hidden': 'true' }), ...colourEls] : []),
    ...(picks.size ? [h('button', { type: 'button', class: 'hs-btn-text', onclick: clearFilters }, 'Clear filters')] : []));
  bar.hidden = !shownGroups.length;
  keyEl.replaceChildren(...(colourBy ? swatches(colourBy) : []));
  if (openGroup) {
    const panel = bar.querySelector<HTMLElement>(`#lv-pop-${openGroup.replace(/\W+/g, '-')}`);
    if (panel) { const was = openGroup; panel.showPopover(); openGroup = was; } else openGroup = '';
  }
}
/** tint each card by its value in the colour group */
function paint(): void {
  for (const c of cards()) {
    const f = facetsOf(c).find((x) => x.split('\t')[0] === colourBy);
    c.classList.toggle('lv-toned', !!f);
    if (f) c.style.setProperty('--tone', `var(${toneFor(colourBy, f.split('\t')[1]) ?? '--c3'})`);
    // a chip that only repeats the section heading or the colour-by value says nothing new
    const same = [c.closest('.lv-group')?.querySelector(':scope > h2')?.textContent ?? '', f?.split('\t')[1] ?? ''].map((x) => x.trim().toLowerCase()).filter(Boolean);
    c.querySelectorAll<HTMLElement>(':scope > header > .hs-tg').forEach((t) => { t.hidden = same.includes((t.textContent ?? '').trim().toLowerCase()); });
  }
  syncRows();
}
/** does a card pass the search and the filters (leaving out one group's own picks, for that group's counts) */
function passes(c: HTMLElement, q: string, skip?: string): boolean {
  const fs = new Set(facetsOf(c));
  // the search also reads the section a card sits in (an achievement chain's title, a gear kind …)
  if (q && !c.dataset.q!.includes(q) && !(c.closest('.lv-group')?.querySelector(':scope > h2')?.textContent ?? '').toLowerCase().includes(q)) return false;
  const shownBy = new Map<string, boolean>();
  for (const [f, st] of picks) {
    const g = f.split('\t')[0];
    if (g === skip) continue;
    if (st === 'out' && fs.has(f)) return false;
    if (st === 'shown') shownBy.set(g, (shownBy.get(g) ?? false) || fs.has(f));
  }
  return [...shownBy.values()].every(Boolean);
}
function clearFilters(): void { picks.clear(); filter(); }
function clearSearch(): void { search.value = ''; filter(); search.focus(); }
/** "Kind: melee shown, accessory left out" for each group with picks */
function pickWords(): string {
  const by = new Map<string, string[]>();
  for (const [f, st] of picks) { const [g, v] = f.split('\t'); by.set(g, [...(by.get(g) ?? []), `${v} ${st === 'shown' ? 'shown' : 'left out'}`]); }
  return [...by].map(([g, vs]) => `${g}: ${vs.join(', ')}`).join('; ');
}
function filter(): void {
  if (shown) { if (picks.size) picksBy[shown] = [...picks]; else delete picksBy[shown]; keep('lv-picks', picksBy); }
  const q = search.value.trim().toLowerCase();
  const allOn = allBox.checked && !!q;
  document.body.classList.toggle('lv-allmode', allOn);
  // while a search is typed every section shows unfolded; the folds themselves are untouched, so clearing restores them
  document.body.classList.toggle('lv-searching', !!q);
  body.querySelectorAll('.lv-foldbtn').forEach((fb) => fb.setAttribute('aria-expanded', String(!!q || !fb.closest('.lv-group, .lv-foldcard')?.classList.contains('lv-folded'))));
  if (allOn) {
    const n = searchAll(q);
    if (allRes.parentNode !== body) body.prepend(allRes);
    results.replaceChildren(`${n} match${n === 1 ? '' : 'es'} across all tables`, ' ', h('button', { type: 'button', class: 'hs-btn-text', onclick: () => { search.value = ''; filter(); } }, 'Clear'));
    return;
  }
  allRes.remove();
  const all = cards();
  for (const c of all) c.hidden = !passes(c, q);
  body.querySelectorAll<HTMLElement>('.lv-group').forEach((g) => { g.hidden = !!g.querySelector('.lv-card') && !g.querySelector('.lv-card:not([hidden])'); });
  body.querySelectorAll<HTMLAnchorElement>('.lv-cell').forEach((a) => a.classList.toggle('dim', !!document.getElementById(a.hash.slice(1))?.hidden));
  const n = all.filter((c) => !c.hidden).length;
  const filtering = !!q || picks.size > 0;
  results.replaceChildren(...(all.length ? [`${n} of ${all.length} shown`] : []),
    ...(filtering ? [' ', h('button', { type: 'button', class: 'hs-btn-text', onclick: () => { search.value = ''; clearFilters(); } }, 'Clear')] : []));
  empty.hidden = !(filtering && all.length && !n);
  if (!empty.hidden) {
    const what = `${q ? `matches “${search.value.trim()}”` : 'is left'}${picks.size ? ` with ${pickWords()}` : ''}`;
    empty.replaceChildren(h('p', {}, `Nothing in ${SECTIONS.find((x) => x.key === shown)?.title ?? ''} ${what}.`),
      h('p', { class: 'lv-empty-acts' }, q ? h('button', { type: 'button', class: 'hs-btn-main', onclick: clearSearch }, 'Clear the search') : null,
        picks.size ? h('button', { type: 'button', class: q ? 'hs-btn-text' : 'hs-btn-main', onclick: clearFilters }, 'Clear the filters') : null));
  }
  if (empty.parentNode !== body) body.prepend(empty);
  drawBar();
  syncRows();
}
const facetsFor = (sec: Section): Facets => FACETS[sec.key] ?? (sec.view ? () => [] : autoFacets(lib[sec.table] as Record<string, Entry>));
const viewOf = (sec: Section) => (sec.view ? sec.view() : [h('div', { class: 'lv-grid' }, generic(sec.key, lib[sec.table] as Record<string, Entry>))]).filter(Boolean) as HTMLElement[];
// build the colour table once: draw every tab off-screen and note which values of each group show together
TONES = (() => {
  const occ = new Map<string, Map<string, Set<string>>>();
  for (const sec of SECTIONS) {
    facetOf = facetsFor(sec);
    const groups = new Map<string, Set<string>>();
    for (const c of Array.from(h('div', {}, ...viewOf(sec)).querySelectorAll<HTMLElement>('.lv-card[data-f]'))) for (const f of facetsOf(c)) {
      const [g, v] = f.split('\t');
      (groups.get(g) ?? groups.set(g, new Set()).get(g)!).add(v);
    }
    occ.set(sec.key, groups);
  }
  facetOf = () => [];
  return toneTable(occ, TONE_ORDER);
})();

// Details pop-ups: clicking any entry link opens its full card in a floating panel that can be dragged and
// closed, so the page underneath stays where it is. Pinning keeps a pop-up open (up to MAX_PINS); the next entry
// opens beside it, and Compare lays the pinned entries out side by side in a dock under the content.
const MAX_PINS = 4;
type Pop = { el: HTMLElement; ref: string; title: string; card: HTMLElement; pinned: boolean; pin: HTMLButtonElement; opener?: HTMLElement };
let popSeq = 0;
const pops: Pop[] = []; // oldest first; at most one is not pinned
const pinned = () => pops.filter((p) => p.pinned);
const compareBtn = h('button', { type: 'button', class: 'hs-btn-text lv-compare', hidden: true, onclick: () => { dock.hidden = false; pinsChanged(); dock.scrollIntoView({ block: 'nearest' }); } }) as HTMLButtonElement;
const dockBody = h('div', { class: 'lv-dock-body' });
const dock = h('section', { class: 'lv-dock', hidden: true, 'aria-label': 'Compare pinned entries' },
  h('div', { class: 'lv-dock-head' }, h('h2', { class: 'hs-label' }, 'Compare'),
    h('button', { type: 'button', class: 'hs-icon-btn', 'aria-label': 'Close compare', title: 'Close compare', onclick: () => { dock.hidden = true; pinsChanged(); } }, '✕')), dockBody);
main.append(dock);
const headActs = h('div', { class: 'lv-head-acts' });
search.replaceWith(headActs);
headActs.append(compareBtn, search);
function closePop(p: Pop): void {
  pops.splice(pops.indexOf(p), 1);
  if (p.el.contains(document.activeElement) && p.opener?.isConnected) p.opener.focus(); // back to the link that opened it
  p.el.remove();
  pinsChanged();
}
function pinsChanged(): void {
  const n = pinned().length;
  compareBtn.hidden = !n;
  compareBtn.textContent = `Compare (${n})`;
  for (const p of pops) {
    p.pin.setAttribute('aria-pressed', String(p.pinned));
    p.pin.textContent = p.pinned ? 'Pinned' : 'Pin';
    p.pin.disabled = !p.pinned && n >= MAX_PINS;
    p.pin.title = p.pin.disabled ? `Unpin one first (${MAX_PINS} at most)` : p.pinned ? 'Unpin: the next entry replaces this pop-up' : 'Keep this pop-up open and add it to Compare';
  }
  if (!n) dock.hidden = true;
  // while the dock is open it shows the pinned entries, so their pop-ups step aside
  for (const p of pops) p.el.hidden = p.pinned && !dock.hidden;
  compareBtn.setAttribute('aria-pressed', String(!dock.hidden));
  if (!dock.hidden) drawDock();
}
function newPop(): Pop {
  const tid = `lv-pop-t${++popSeq}`;
  const title = h('span', { class: 'hs-label', id: tid });
  const open = h('a', { class: 'lv-link', href: '#' }, 'Open in its table');
  const pin = h('button', { type: 'button', class: 'hs-btn-text lv-pin', 'aria-pressed': 'false' }) as HTMLButtonElement;
  const x = h('button', { type: 'button', class: 'hs-icon-btn lv-pop-x', 'aria-label': 'Close', title: 'Close (Esc)' }, '✕');
  const head = h('div', { class: 'lv-pop-head' }, title, open, pin, x);
  const el = h('aside', { class: 'lv-pop', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': tid, tabindex: '-1' }, head, h('div', { class: 'lv-pop-body' }));
  const p: Pop = { el, ref: '', title: '', card: el, pinned: false, pin };
  pin.onclick = () => { p.pinned = !p.pinned; if (!p.pinned) pops.filter((o) => o !== p && !o.pinned).forEach(closePop); pinsChanged(); };
  x.addEventListener('click', () => closePop(p));
  open.addEventListener('click', () => closePop(p));
  // a new pop-up opens beside the ones already open
  const i = pops.length;
  el.style.right = `calc(var(--space-8) + ${(document.body.classList.contains('lv-has-sub') ? subRail.offsetWidth : 0) + i * 32}px)`; // inside the main column
  el.style.top = `${96 + i * 40}px`;
  // drag by the head
  head.addEventListener('pointerdown', (e) => {
    const ev = e as PointerEvent;
    if ((ev.target as Element).closest('a, button')) return;
    const r = el.getBoundingClientRect();
    const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
    const move = (m: PointerEvent) => {
      el.style.left = `${Math.max(0, Math.min(innerWidth - 80, m.clientX - dx))}px`;
      el.style.top = `${Math.max(0, Math.min(innerHeight - 40, m.clientY - dy))}px`;
      el.style.right = 'auto';
    };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  });
  el.addEventListener('pointerdown', () => { if (el.nextElementSibling?.classList.contains('lv-pop')) document.body.append(el); }); // clicked one comes to the front
  pops.push(p);
  document.body.append(el);
  return p;
}
function showPop(key: string, id: string): boolean {
  const sec = SECTIONS.find((s) => s.key === key);
  if (!sec) return false;
  const keep = facetOf;
  const src = (key === shown ? body : h('div', {}, viewOf(sec))).querySelector<HTMLElement>(`[id="${CSS.escape(`${key}/${id}`)}"]`);
  facetOf = keep;
  if (!src) return false;
  const ref = `${key}/${id}`;
  const already = pops.find((p) => p.ref === ref);
  if (already) { document.body.append(already.el); return true; }
  const copy = src.cloneNode(true) as HTMLElement;
  copy.removeAttribute('id');
  copy.hidden = false;
  copy.classList.remove('lv-hit');
  copy.querySelectorAll('[id]').forEach((x) => x.removeAttribute('id'));
  copy.querySelectorAll('details').forEach((d) => { d.open = false; });
  const p = pops.find((o) => !o.pinned) ?? newPop();
  p.ref = ref;
  p.title = copy.querySelector('h3')?.firstChild?.textContent?.trim() || id;
  p.card = copy;
  p.el.querySelector('.hs-label')!.textContent = sec.title;
  p.el.querySelector('.lv-link')!.setAttribute('href', `#${ref}`);
  p.el.querySelector('.lv-pop-body')!.replaceChildren(copy);
  document.body.append(p.el);
  pinsChanged();
  return true;
}
/** pinned entries as columns; rows lined up by label, a row whose values differ gets an accent edge */
function drawDock(): void {
  const list = pinned();
  const labels: string[] = [];
  const cells = list.map((p) => {
    const m = new Map<string, Element>();
    p.card.querySelectorAll(':scope .lv-row').forEach((r) => {
      const k = r.querySelector(':scope > .lv-k')?.textContent ?? '';
      if (!k || m.has(k)) return;
      m.set(k, r.querySelector(':scope > .lv-v')!);
      if (!labels.includes(k)) labels.push(k);
    });
    return m;
  });
  const cols = `104px repeat(${list.length}, minmax(0, 1fr))`;
  const tables = list.map((p) => SECTIONS.find((s) => s.key === p.ref.split('/')[0])?.title ?? '');
  dockBody.replaceChildren(h('div', { class: 'lv-cmp', style: `grid-template-columns: ${cols}` },
    h('span', {}), ...list.map((p, i) => h('div', { class: 'lv-cmp-h' }, h('a', { href: `#${p.ref}`, class: 'lv-link' }, p.title), h('small', {}, tables[i]),
      h('button', { type: 'button', class: 'hs-icon-btn', 'aria-label': `Unpin ${p.title}`, title: 'Unpin', onclick: () => closePop(p) }, '✕'))),
    ...labels.flatMap((k) => {
      const vals = cells.map((m) => m.get(k)?.textContent?.trim() ?? '');
      const diff = list.length > 1 && new Set(vals).size > 1;
      return [h('span', { class: `lv-k${diff ? ' lv-diff' : ''}` }, k),
        ...cells.map((m) => h('div', { class: 'lv-v' }, ...(m.get(k) ? Array.from(m.get(k)!.cloneNode(true).childNodes) : ['—'])))];
    })));
}
// Esc closes the top pop-up (the last one in the page)
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const top = Array.from(document.querySelectorAll('body > .lv-pop:not([hidden])')).pop();
  const p = pops.find((o) => o.el === top);
  if (p) closePop(p);
});
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('main a[href^="#"], .lv-pop-body a[href^="#"]');
  if (!a) return;
  const [key, ...rest] = decodeURIComponent(a.hash.slice(1)).split('/');
  if (rest.length && showPop(key, rest.join('/'))) {
    e.preventDefault();
    const p = pops.find((o) => o.ref === `${key}/${rest.join('/')}`);
    if (p) { p.opener = a; if (e.detail === 0) p.el.focus(); } // opened from the keyboard: the pop-up takes focus
  }
});

// Folding: clicking a section header, or the title of a foldable card (Skills trees), folds what is under it
const HEAD = '.lv-group > h2.hs-section, .lv-foldcard > header > h3';
const box = (head: Element): Element => head.closest('.lv-group, .lv-foldcard')!;
/** save: false opens a section for this view only (a jump to an entry inside it) and keeps the remembered fold */
function fold(head: Element, open?: boolean, save = true): void {
  const folded = box(head).classList.toggle('lv-folded', open === undefined ? undefined : !open);
  if (save) {
    const k = foldKey(head);
    if (FOLDED_FIRST.has(shown)) { if (folded) openedSet.delete(k); else openedSet.add(k); keep('lv-opened', [...openedSet]); }
    else { if (folded) foldedSet.add(k); else foldedSet.delete(k); keep('lv-folded', [...foldedSet]); }
    // the same section in the other sub-tabs follows
    body.querySelectorAll<HTMLElement>(HEAD).forEach((o) => {
      if (o === head || foldKey(o) !== k) return;
      box(o).classList.toggle('lv-folded', folded);
      o.querySelector(':scope > .lv-foldbtn')?.setAttribute('aria-expanded', String(!folded));
    });
  }
  head.querySelector(':scope > .lv-foldbtn')?.setAttribute('aria-expanded', String(!folded));
}
// tables whose sections start folded until opened; for them the remembered choice is which sections are open
const FOLDED_FIRST = new Set<string>([]); // achievements read as compact medal tracks now, so they open unfolded
const openedSet = new Set<string>(remember<string[]>('lv-opened', []));
const savedFolded = (k: string): boolean => (FOLDED_FIRST.has(shown) ? !openedSet.has(k) : foldedSet.has(k));
// keyed by tab and title without its count ("Perk (3 sources)" → "Perk"), so a fold survives the numbers changing in a new
// build, and a section folded in one sub-tab is folded in every sub-tab that shows it
const foldKey = (head: Element): string => `${shown}|${(head.textContent ?? '').replace(/\s*\(\d[^)]*\)\s*$/, '')}`;
function foldable(): void {
  body.querySelectorAll<HTMLElement>(HEAD).forEach((h2) => { if (savedFolded(foldKey(h2))) box(h2).classList.add('lv-folded'); });
  // the heading stays a heading; a button inside it does the folding
  body.querySelectorAll<HTMLElement>(HEAD).forEach((h2) => {
    const btn = h2.querySelector(':scope > .lv-foldbtn') ?? h('button', { type: 'button', class: 'lv-foldbtn', title: 'Fold or unfold' }, ...Array.from(h2.childNodes));
    if (!btn.parentNode) h2.append(btn);
    btn.setAttribute('aria-expanded', String(!box(h2).classList.contains('lv-folded')));
  });
}
body.addEventListener('click', (e) => { const h2 = (e.target as Element).closest(HEAD); if (h2 && !document.body.classList.contains('lv-searching')) fold(h2); });

// Table view (VR1, VR2): flat tables read as one row per entry. The cards stay in the page (hidden), so search,
// filters, colour and pins keep working on them; each row mirrors its card.
const TABLE_FIRST = new Set(['gear', 'status', 'services', 'roles', 'durations', 'zoneKinds', 'edgeKinds', 'zoneSizes', 'roadLengths', 'roadDangers', 'noiseLevels', 'visibilityLevels', 'activities', 'routines', 'healing', 'classes', 'stacking']);
const viewOfTable: Record<string, 'cards' | 'table'> = remember<Record<string, 'cards' | 'table'>>('lv-view', {});
const modeOf = (key: string) => viewOfTable[key] ?? (TABLE_FIRST.has(key) ? 'table' : 'cards');
const viewSwitch = h('div', { class: 'lv-seg', role: 'group', 'aria-label': 'Show entries as' });
compareBtn.before(viewSwitch);
// All tables (VR7): the search lists matches from every table, grouped by table; it stays on across tables
const allBox = h('input', { type: 'checkbox', onchange: () => filter() }) as HTMLInputElement;
search.after(h('label', { class: 'lv-all' }, allBox, 'All tables'));
const allRes = h('div', { class: 'lv-allres' });
function searchAll(q: string): number {
  const seen = new Set<string>();
  let n = 0;
  const groups = SECTIONS.flatMap((sec) => {
    if (seen.has(sec.table)) return [];
    seen.add(sec.table);
    const hits = Object.entries(lib[sec.table] as Record<string, Entry>).filter(([id, e]) => `${typedId(id)?.textContent ?? ''} ${JSON.stringify(e)}`.toLowerCase().includes(q));
    n += hits.length;
    return hits.length ? [h('section', { class: 'lv-allgroup' }, h('h2', {}, sec.title, h('span', { class: 'lv-size' }, ` · ${hits.length}`)),
      h('ul', { class: 'lv-hits' }, hits.map(([id]) => h('li', {}, typedId(id) ?? link(sec.key, id, id)))))] : [];
  });
  allRes.replaceChildren(...(groups.length ? groups : [h('p', { class: 'lv-empty' }, `Nothing in any table matches “${search.value.trim()}”.`)]));
  return n;
}
function drawSwitch(): void {
  const can = !!body.querySelector('.lv-grid > .lv-card:not(.lv-fixed)');
  viewSwitch.hidden = !can;
  viewSwitch.replaceChildren(...(['cards', 'table'] as const).map((m) => h('button', { type: 'button', 'aria-pressed': String(modeOf(shown) === m),
    onclick: () => { viewOfTable[shown] = m; keep('lv-view', viewOfTable); tablify(); drawSwitch(); } }, m === 'cards' ? 'Cards' : 'Table')));
}
const cellText = (n: Element | null | undefined) => (n?.textContent ?? '').replace(/\s+/g, ' ').trim();
const ALWAYS_COLS = new Set(['Reward', 'Effect', 'Restores']);
function tablify(): void {
  body.querySelectorAll('.lv-table').forEach((t) => t.remove());
  body.querySelectorAll('.lv-tabled').forEach((g) => g.classList.remove('lv-tabled'));
  if (modeOf(shown) !== 'table') return;
  // each section picks the fields all its entries share and that fit a cell; when the sections' picks together
  // are few enough, every section uses them all, so the tables of one tab read the same way
  const rowsOf = (c: HTMLElement) => new Map(Array.from(c.querySelectorAll(':scope > .lv-row, :scope > .lv-cbody > .lv-row')).map((r) => [cellText(r.querySelector(':scope > .lv-k')), r.querySelector(':scope > .lv-v')!] as const));
  const grids = Array.from(body.querySelectorAll<HTMLElement>('.lv-grid')).map((grid) => {
    const list = Array.from(grid.querySelectorAll<HTMLElement>(':scope > .lv-card:not(.lv-fixed)'));
    const maps = list.map(rowsOf);
    // a column that only repeats the entry's name or a raw id says nothing new; what an entry gives (Reward, Effect) always shows
    const echoes = (k: string) => maps.every((m, i) => { const v = cellText(m.get(k)); return v === cellText(list[i].querySelector(':scope > header > h3')) || v === list[i].id.split('/').pop() || /^[A-Z]{2,3}\d+\b/.test(v); });
    const own = list.length ? [...maps[0].keys()].filter((k) => maps.every((m) => m.has(k)) && !echoes(k)
      && (ALWAYS_COLS.has(k) || maps.reduce((n, m) => n + cellText(m.get(k)).length, 0) / maps.length <= 60)) : [];
    return { grid, list, maps, own };
  }).filter((g) => g.list.length);
  const union = [...new Set(grids.flatMap((g) => g.own))];
  grids.forEach(({ grid, list, maps, own }) => {
    const cols = (union.length <= 6 ? union : own).slice(0, 6);
    const sort = { col: -1, dir: 1 };
    const tbody = h('tbody', {});
    const rows = list.map((c, i) => {
      const t = c.querySelector(':scope > header > h3');
      const tr = h('tr', { 'data-ref': c.id }, h('th', { scope: 'row' }, h('a', { class: 'lv-link', href: `#${c.id}` }, cellText(t))),
        ...cols.map((k) => h('td', {}, ...(maps[i].has(k) ? Array.from(maps[i].get(k)!.cloneNode(true).childNodes) : ['—']))));
      return { tr, card: c, keys: [cellText(t), ...cols.map((k) => cellText(maps[i].get(k)))] };
    });
    const heads = ['Name', ...cols].map((k, ci) => h('th', { scope: 'col', 'aria-sort': 'none' }, h('button', { type: 'button', class: 'lv-sort', onclick: () => {
      sort.dir = sort.col === ci ? -sort.dir : 1; sort.col = ci;
      const num = (x: string) => (/^-?\d+(\.\d+)?/.test(x) ? parseFloat(x) : NaN);
      rows.sort((a, b) => { const x = a.keys[ci], y = b.keys[ci]; const nx = num(x), ny = num(y); return sort.dir * (!isNaN(nx) && !isNaN(ny) ? nx - ny : x.localeCompare(y, undefined, { numeric: true })); });
      tbody.replaceChildren(...rows.map((r) => r.tr));
      table.querySelectorAll('thead th').forEach((th, j) => th.setAttribute('aria-sort', j === ci ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'));
    } }, k)));
    tbody.append(...rows.map((r) => r.tr));
    const table = h('table', { class: 'lv-table' }, h('thead', {}, h('tr', {}, ...heads)), tbody);
    grid.classList.add('lv-tabled');
    grid.after(table);
  });
  syncRows();
}
/** rows follow their cards: hidden with them, toned with them */
function syncRows(): void {
  body.querySelectorAll<HTMLElement>('.lv-table tr[data-ref]').forEach((tr) => {
    const c = document.getElementById(tr.dataset.ref!);
    if (!c) return;
    tr.hidden = c.hidden;
    tr.classList.toggle('lv-toned', c.classList.contains('lv-toned'));
    tr.style.setProperty('--tone', c.style.getPropertyValue('--tone'));
  });
}

let shown = '';
let notice = ''; // one-line message for the next draw (an unknown deep link)
function route(): void {
  const [key, ...rest] = decodeURIComponent(location.hash.slice(1)).split('/');
  const found = SECTIONS.find((s) => s.key === key);
  const sec = found ?? SECTIONS[0];
  if (!found && key) { history.replaceState(null, '', `#${sec.key}`); notice = `There is no table called “${key}”, so this is ${sec.title}.`; shown = ''; }
  if (sec.key !== shown) {
    shown = sec.key;
    titleEl.replaceChildren(sec.title, h('span', { class: 'lv-size' }, ` · ${sizeOf(sec)}`));
    picks.clear();
    if (!allBox.checked) search.value = ''; // a new table starts unfiltered, unless the search covers all tables
    pane = paneOf[sec.key] ?? '';
    colourBy = COLOUR_BY[sec.key] ?? '';
    facetOf = facetsFor(sec);
    body.replaceChildren(...(notice ? [h('p', { class: 'lv-notice', role: 'status' }, notice)] : []), ...viewOf(sec));
    notice = '';
    const tabs = body.querySelector('.lv-tabs');
    subRail.replaceChildren(...(tabs ? [tabs] : []));
    document.body.classList.toggle('lv-has-sub', !!tabs);
    foldable();
    // bring back this table's remembered filters, leaving out values no entry has any more
    const present = new Set(cards().flatMap((c) => facetsOf(c)));
    for (const [f, st] of picksBy[sec.key] ?? []) if (present.has(f)) picks.set(f, st);
    tablify();
    drawSwitch();
    rail.querySelectorAll('a').forEach((a) => (a.dataset.sec === sec.key ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    drawBar();
    paint();
    filter();
    scrollTo(0, 0);
  }
  if (rest.length) {
    const el = document.getElementById(`${sec.key}/${rest.join('/')}`);
    const holder = el?.closest<HTMLElement>('.lv-pane[hidden]');
    if (holder) showPane(holder.dataset.pane!);
    const shutBox = el?.closest('.lv-folded');
    const shut = shutBox?.querySelector(':scope > h2.hs-section, :scope > header > h3');
    if (shut) fold(shut, true, false);
    if (el?.hidden) { picks.clear(); search.value = ''; filter(); } // a remembered filter hides the entry linked to: drop it
    body.querySelectorAll('.lv-hit').forEach((x) => x.classList.remove('lv-hit'));
    el?.classList.add('lv-hit');
    el?.scrollIntoView({ block: 'center' });
  }
}
addEventListener('hashchange', route);
route();
