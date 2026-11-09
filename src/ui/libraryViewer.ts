// Library viewer: every library table drawn from the same modules the game runs, so it shows the
// library exactly as code sees it. Bundled into dist/library.html by scripts/build.mjs. Tables without a custom view
// get the generic cards, so a new table shows up with no edit here.
import './styles.css';
import './libraryViewer.css';
import type { AchievementDef, BodyType, ItemDef, ItemEffect, Library, PerkDef, PerkWriteup, TreeAccess } from '../types';
import { classTree, condName } from '../ruleset/access';
import { baneSkill, defeatsRoll } from '../ruleset/bane';
import { ACH_RULE_TEXT } from '../library/achievementIds';
import { MOD_SOURCES, MOD_TYPE_NAMES, type ModSource, type StackedType } from '../ruleset/modSources';
import { modTotal, stackType } from '../ruleset';
import { equations } from '../ruleset/equations';
import { fnSkills, standInShare, standInTable } from '../ruleset/gear';
import { prototypeLibrary } from '../library/data';
import { PERK_WRITEUPS } from '../library/perks';
import { BOOST_PERKS } from '../library/boostPerks';
import { FUNCTION_GROUP, FUNCTION_ROLLS, GROUP_NAMES, groupsOf, functionName } from '../library/functionNames';
import { CONFIG } from '../config';
import { EQUIP_LEVELS, REWARD_LEVELS, SKILL_TIERS } from '../scales';
import { requirement } from '../ruleset/requirements';
import { fmtDate, h } from './kit';
import { skillName } from './creation';
import { partName } from './healing';
import { SENSE_SKILL, SK } from '../library/skillIds';

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
  return h('article', { class: 'lv-card', id: `${sec}/${id}`, 'data-q': `${title} ${JSON.stringify(entry)}`.toLowerCase(), 'data-f': [...new Set(f)].join('\n') },
    h('header', {}, h('h3', {}, title), h('code', { class: 'lv-id' }, id), ...chips), ...body, raw(entry));
}

/** any value as code holds it: primitives as text, lists as chips, objects as nested rows */
function val(v: unknown, depth = 0): Node | string {
  if (v === null || v === undefined) return none('—');
  if (Array.isArray(v)) {
    if (!v.length) return none('empty');
    if (v.every((x) => typeof x !== 'object')) return h('span', { class: 'lv-chips' }, v.map((x) => chip(String(x))));
    return h('div', { class: 'lv-sub' }, v.map((x) => h('div', { class: 'lv-subitem' }, val(x, depth + 1))));
  }
  if (typeof v === 'object') return depth > 3 ? JSON.stringify(v) : h('div', { class: 'lv-sub' }, Object.entries(v).map(([k, x]) => row(k, val(x, depth + 1))));
  return String(v);
}
/** skill IDs are numbers: show a skill field, or a table keyed by skill, by the skill's name */
const SKILL_KEYED = new Set(['minimums', 'skills', 'trueSkillTo', 'gains']);
const named = (k: string, v: unknown): unknown => {
  if (k === 'skill' && typeof v === 'string') return skillName(v);
  if (Array.isArray(v)) return v.map((x) => (x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([a, b]) => [a, named(a, b)])) : SKILL_KEYED.has(k) && typeof x === 'string' ? skillName(x) : x));
  if (SKILL_KEYED.has(k) && v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([a, b]) => [skillName(a), b]));
  return v;
};
const fields = (e: Entry, skip: string[]) => Object.entries(e).filter(([k]) => !skip.includes(k)).map(([k, v]) => row(k, val(named(k, v))));

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
  f.innerHTML = `<svg viewBox="${ct.figure.viewBox}" role="img" aria-label="${ct.id} body">${Object.entries(ct.figure.parts)
    .map(([id, d]) => `<path class="${cls(id)}" d="${d}"><title>${id === 'general' ? ct.general.name : label(id)}</title></path>`).join('')}</svg>`;
  return f;
}
const impactOf = (ct: BodyType, part: string) => (part === 'general' ? 'essential' : ct.parts.find((p) => p.id === part)?.impact ?? 'normal');

// ---------- Gear ----------
const ACTIVE: Record<ItemEffect['active'], string> = { worn: 'when worn', held: 'when held', inUse: 'while in use', carried: 'when carried' };
function effectText(e: ItemEffect): string {
  const what = e.kind === 'skill' ? (e.skill === '$mode' ? 'skill of the attack mode used' : skillName(String(e.skill))) : `${e.roll} rolls`;
  return `${e.value > 0 ? '+' : ''}${e.value} ${what} · ${ACTIVE[e.active]}${e.scope === 'withItem' ? ' · with this item only' : ''}${e.kit ? ' · kit' : ''}`;
}
function gearCard(i: ItemDef, id = i.id): HTMLElement {
  const humanoid = lib.bodyTypes.humanoid;
  const req = requirement(i);
  const flags = (['concealed', 'stackable', 'consumable', 'visible'] as const).filter((f) => i[f]).map((f) => chip(f, '--c3'));
  const covers = new Set(i.armor?.covers ?? []);
  return card('gear', id, i, label(i.name), [chip(i.kind, '--c1'), ...flags, ...(i.tags ?? []).map((t) => chip(t, '--c7'))],
    h('p', { class: 'lv-look' }, i.look),
    req ? row('Needs', `${req.need} true skill in `, link('skills', req.skill, skillName(req.skill)), ` (${EQUIP_LEVELS.name(req.level)} item)`) : row('Needs', none('nothing')),
    row('Bulk · value', `${i.bulk} · ${i.value} coin`),
    i.hands !== undefined ? row('Hands', String(i.hands)) : null,
    i.slot ? row('Slot', i.slot) : null,
    i.weapon ? row('Modes', h('div', { class: 'lv-sub' }, i.weapon.modes.map((m) => h('div', {}, h('b', {}, m.id), ` · ${m.tree} ${m.class} · reach ${m.reach} · ${m.hands} hand${m.hands === 1 ? '' : 's'}`,
      m.skill ? ` · ${skillName(m.skill)}` : '', m.thrown ? ' · thrown' : '', m.hitAdj ? ` · hit ${m.hitAdj > 0 ? '+' : ''}${m.hitAdj}` : '')))) : null,
    i.armor ? h('div', { class: 'lv-armor' }, figure(humanoid, (p) => (covers.has(p) ? 'lv-on' : 'lv-off')),
      h('div', {}, row('Weight', i.armor.weight), row('Reduction', String(i.armor.reduction)), row('Multiplier', `×${i.armor.multiplier}`),
        row('Covers', val(i.armor.covers.map(label))), i.armor.pools ? row('Pools', val(i.armor.pools)) : null)) : null,
    i.shield ? row('Shield pool', String(i.shield.pool)) : null,
    i.effects?.length ? row('Effects', h('div', { class: 'lv-sub' }, i.effects.map((e) => h('div', {}, effectText(e))))) : null,
    i.heal ? row('Heals as', link('healing', i.heal, lib.healing?.[i.heal]?.name ?? i.heal)) : null);
}
function gear(): HTMLElement[] {
  const kinds = [...new Set(Object.values(lib.items).map((i) => i.kind))];
  const all = kinds.map((kind) => h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, `${label(kind)}`),
    h('div', { class: 'lv-grid' }, Object.values(lib.items).filter((i) => i.kind === kind).map((i) => gearCard(i)))));
  // the starter kit: every item tagged 'starter' (starterKit in src/library/spawn.ts)
  const kit = Object.values(lib.items).filter((i) => i.tags?.includes('starter'));
  const rule = h('article', { class: 'lv-card lv-fixed' }, h('header', {}, h('h3', {}, 'How the starter kit is given'), chip('starterKit · src/library/spawn.ts', '--c3')),
    h('ol', { class: 'lv-steps' },
      h('li', {}, 'After creation the player gets every item tagged starter whose equip requirement the build meets (shortBy = 0; a stand-in skill counts at its share).'),
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
const EFFECT_TONE: Record<string, string> = { attack: '--c10', defense: '--c1', health: '--c2', speed: '--c15', senses: '--c5', speech: '--c4' };
/** colour coding: fixed colours where a value has a meaning, else the palette in value order */
const PALETTE = ['--c1', '--c2', '--c7', '--c5', '--c12', '--c4', '--c15', '--c10', '--c14', '--c3'];
const FIXED: Record<string, Record<string, string>> = {
  Effect: EFFECT_TONE,
  State: { built: '--ok', 'not built': '--warn', 'written only': '--c3', quirk: '--danger' },
  Level: { 'Level I': '--c12', 'Level II': '--c1', 'Level III': '--c5', 'Level IV': '--c15' },
  Class: { light: '--c12', medium: '--c1', heavy: '--c10' },
  XP: { offensive: '--c10', defensive: '--c1', [SK.endurance]: '--c2', notice: '--c5', influence: '--c4', misc: '--c3' },
};
const TIER_TONE: Record<string, string> = { tier_0: '--warn', tier_1: '--c15', tier_2: '--c3' };
const seen = new Map<string, string[]>();
function toneOf(group: string, value: string): string {
  if (FIXED[group]?.[value]) return FIXED[group][value];
  const vals = seen.get(group) ?? seen.set(group, []).get(group)!;
  if (!vals.includes(value)) vals.push(value);
  return PALETTE[vals.indexOf(value) % PALETTE.length];
}
/** the filter group each table is coloured by at first; any group can be picked with its "Colour" button */
const COLOUR_BY: Record<string, string> = { gear: 'Kind', perks: 'Effect', achievements: 'Level', bodyTypes: 'Size', skills: 'Group', standIns: 'Function', stacking: 'Type' };
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
function perkCard(sec: string, d: PerkDef | PerkWriteup): HTMLElement {
  const r = d.rules;
  return card(sec, d.id, d, d.name, [
    d.ladder ? chip(`${ms(d)} · ${skillName(d.ladder.skill)}`, '--c1') : 'allStep' in d && d.allStep ? chip(`${ms(d)} · ${lib.trees[d.allStep.treeId]?.name ?? d.allStep.treeId}`, '--c12')
      : 'classLevel' in d && d.classLevel ? chip(`${ms(d)} · ${className(d.classLevel.classId)}`, '--c5')
      : chip(('place' in d ? d.place : '') || 'no milestone', '--c3'),
    'bankedAs' in d && d.bankedAs ? chip(bankedText(d), '--c14') : null,
    d.effect ? chip(d.effect, EFFECT_TONE[d.effect]) : null,
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
type Pane = { key: string; title: string; n: number; content: (HTMLElement | null)[] };
let pane = '';
// Remembered per viewer (this browser only): which sections are folded and which sub-tab each tab had open
const remember = <T>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? '') as T; } catch { return fallback; } };
const keep = (key: string, value: unknown): void => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: keep it for this visit only */ } };
const foldedSet = new Set<string>(remember<string[]>('lv-folded', []));
const paneOf: Record<string, string> = remember<Record<string, string>>('lv-pane', {});
function panes(list: Pane[]): HTMLElement[] {
  if (!list.some((p) => p.key === pane)) pane = list[0].key;
  const bar = h('div', { class: 'lv-tabs', role: 'tablist' }, list.map((p) => h('button', {
    type: 'button', role: 'tab', 'data-pane': p.key, 'aria-selected': String(p.key === pane), onclick: () => showPane(p.key),
  }, p.title, h('small', {}, String(p.n)))));
  return [bar, ...list.map((p) => h('div', { class: 'lv-pane', 'data-pane': p.key, hidden: p.key !== pane }, ...(p.content.filter(Boolean) as HTMLElement[])))];
}
function showPane(key: string): void {
  pane = key;
  paneOf[shown] = key; keep('lv-pane', paneOf);
  body.querySelectorAll<HTMLElement>('.lv-tabs [data-pane]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.pane === key)));
  body.querySelectorAll<HTMLElement>('.lv-pane').forEach((p) => { p.hidden = p.dataset.pane !== key; });
  drawBar(); paint(); filter();
}

const cell = (d: PerkDef) => h('a', { class: `lv-cell${d.built ? '' : ' unbuilt'}${d.quirk ? ' quirk' : ''}`, href: `#perks/${d.id}`, style: `--tg: var(${EFFECT_TONE[d.effect ?? ''] ?? '--c3'})` }, d.name);
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
  const classes = Object.values(lib.classes ?? {}); // every class gets a row, so one with no level perks shows as empty
  const classPerkIds = new Set(classes.flatMap((c) => Object.values(c.levelPerks ?? {}).flat()));
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
  const classRows = classes.map((c): [string, (col: string) => PerkDef[]] => [c.name, (col) => (c.levelPerks?.[+col] ?? []).map((id) => lib.perks[id]).filter(Boolean)]);
  return [
    h('p', { class: 'hs-note' }, `${all.length} perks in the library · ${all.filter((d) => d.built).length} built · ${quirks} quirk${quirks === 1 ? '' : 's'} · ${loose.length} written outside the library. A dashed cell is not built yet; a red edge is a quirk.`),
    h('p', { class: 'hs-note lv-chips' }, Object.entries(EFFECT_TONE).map(([e, t]) => chip(e, t))),
    ...panes([
      { key: 'milestone', title: 'Milestone perks (20, 40, 60 …)', n: ladder.length, content: [
        h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, 'By skill and milestone'), grid('Skill', steps.map((m) => `${m} perk`), ladderRows.map(([n, at]) => [n, (c: string) => at(c.replace(' perk', ''))]))),
        cardsOf('Built', ladder.filter((d) => d.built), 'None built yet.')] },
      { key: 'all', title: 'All-XX perks', n: allParts.length, content: [
        h('p', { class: 'hs-note' }, 'Granted when every skill of a tree reaches the step (allStep in src/library/allPerks.ts).'),
        h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, 'By tree and step'), grid('Tree', allSteps.map((m) => `All-${m}`), allRows.map(([n, at]) => [n, (c: string) => at(c.replace('All-', ''))]))),
        cardsOf('Built', allParts.filter((d) => d.built), 'None built yet.')] },
      { key: 'unused', title: 'Not in use', n: unused.length, content: [
        h('p', { class: 'hs-note' }, 'Written down but the game can\'t give them yet: not built (built: false), or not in the library at all.'),
        cardsOf('In the library, not built', all.filter((d) => !d.built), 'None.'),
        ...banked(loose)] },
      { key: 'class', title: 'Class perks', n: classPerks.length, content: [
        h('p', { class: 'hs-note' }, 'Granted by a class for reaching a class level (levelPerks on the class in src/library/data.ts).'),
        h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, 'By class and level'), grid('Class', classLevels.map((l) => `Level ${l}`), classRows.map(([n, at]) => [n, (c: string) => at(c.replace('Level ', ''))]))),
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
function races(): HTMLElement[] {
  return [h('div', { class: 'lv-grid' }, Object.values(lib.races ?? {}).map((r) => {
    const ct = lib.bodyTypes[r.bodyTypeId];
    return card('races', r.id, r, r.name, [],
      h('div', { class: 'lv-armor' }, figure(ct, (p) => IMPACT_TONE[impactOf(ct, p)]), h('div', {},
        row('Body', link('bodyTypes', r.bodyTypeId, label(r.bodyTypeId))),
        row('HP multiplier', `×${r.hpMultiplier}`),
        r.naturalAttacks?.length ? row('Own natural attacks', val(r.naturalAttacks.map((a) => `${a.name ?? a.id} (${skillName(a.skill ?? '')})`))) : null,
        r.naturalArmor ? row('Natural armor', val(r.naturalArmor)) : null,
        r.fallback ? row('Fallback attack', skillName(r.fallback.attackSkill)) : null,
        row('Innate perks', perkList(r.innatePerks)), row('Innate quirks', perkList(r.innateQuirks)),
        row('NPC templates', usedBy((t) => t.raceId === r.id)))),
      ...fields(r as unknown as Entry, ['id', 'name', 'bodyTypeId', 'hpMultiplier', 'naturalAttacks', 'naturalArmor', 'fallback', 'innatePerks', 'innateQuirks']));
  }))];
}
function bodyTypes(): HTMLElement[] {
  return [h('p', { class: 'hs-note' }, h('span', { class: 'lv-key lv-ess' }), 'essential ', h('span', { class: 'lv-key lv-norm' }), 'normal ', h('span', { class: 'lv-key lv-non' }), 'non-essential part'),
    h('div', { class: 'lv-grid wide' }, Object.values(lib.bodyTypes).map((c) => card('bodyTypes', c.id, c, label(c.id), [chip(c.general.size, '--c3')],
      h('div', { class: 'lv-armor' }, figure(c, (p) => IMPACT_TONE[impactOf(c, p)]), h('div', {},
        row('General area', `${c.general.name} · ${c.general.size}`),
        row('Natural attacks', c.naturalAttacks.length ? val(c.naturalAttacks.map((a) => `${a.name ?? a.id} (${skillName(a.skill ?? '')})`)) : none('none')),
        row('Fallback attack', skillName(c.fallback.attackSkill)),
        row('Races', links('races', Object.values(lib.races ?? {}).filter((r) => r.bodyTypeId === c.id).map((r) => [r.id, r.name]))),
        row('NPC templates', usedBy((t) => lib.races?.[t.raceId as string]?.bodyTypeId === c.id)))),
      c.parts.length ? h('table', { class: 'hs-tbl lv-parts' }, h('thead', {}, h('tr', {}, ['Part', 'Size', 'Impact', 'Roles', 'Next to'].map((x) => h('th', {}, x)))),
        h('tbody', {}, c.parts.map((p) => h('tr', {}, h('td', {}, h('span', { class: `lv-key ${IMPACT_TONE[p.impact]}` }), label(p.id)), h('td', {}, p.size),
          h('td', {}, label(p.impact)), h('td', {}, p.roles.join(', ') || '—'), h('td', {}, (p.adjacent ?? []).map(label).join(', ') || '—'))))) : row('Parts', none('general area only'))))),
  ];
}

// ---------- Achievements ----------
function achievements(): HTMLElement[] {
  // numeric keys list in number order, so show each rule's rows by count, rules in the order they first appear
  const rows = Object.entries(lib.achievements ?? {});
  const first = (r: string) => rows.findIndex(([, d]) => d.rule === r);
  const all = rows.sort(([, a], [, b]) => first(a.rule) - first(b.rule) || (a.count ?? 0) - (b.count ?? 0));
  const groups: [string, (d: AchievementDef) => boolean][] = [['Per body type', (d) => d.by === 'body_type'], ['Per race', (d) => d.by === 'race'],
    ['Total defeats', (d) => d.rule === 'defeats' && !d.by], ['Tree mastery', (d) => d.rule === 'mastery']];
  const isDeed = (d: AchievementDef) => d.rule !== 'defeats' && d.rule !== 'mastery';
  const name = (n: string) => h('span', {}, ...n.split(/(\{\w+\})/).map((p) => (p.startsWith('{') ? h('em', { class: 'lv-slot' }, p) : p)));
  const achCard = ([key, d]: [string, AchievementDef]) => {
    const kind = d.by === 'body_type' ? 'body type' : 'race';
    const bane = d.by === 'body_type' || d.by === 'race' ? baneSkill(key) : 0; // D-111: the same function the rolls use
    const total = d.rule === 'defeats' && !d.by ? defeatsRoll(key) : 0; // D-119
    return card('achievements', key, d, d.name, [chip(`Level ${REWARD_LEVELS.name(d.level as 'i')}`, '--c15'), chip(`${CONFIG.REWARD_XP[d.level] ?? '?'} XP`, '--c2'),
      bane ? chip(`+${bane} skill vs that ${kind}`, '--c10') : null, total ? chip(`+${total} combat rolls`, '--c10') : null],
      row('Name', name(d.name)),
      row('Roll bonus', bane ? `+${bane} skill on every roll against that ${kind}`
        : total ? `+${total} on every attack and defense roll` : none('none, XP only')),
      d.after ? row('Builds on', link('achievements', d.after, lib.achievements?.[d.after]?.name ?? d.after)) : null,
      row('Earned at', `${d.count} ${ACH_RULE_TEXT[d.rule]}${d.by ? `, once per ${d.by.replace('_', ' ')}` : ''}`),
      row('Granted id', d.by || d.rule === 'mastery' ? `${d.id}:<${d.by ?? 'tree'}>` : d.id));
  };
  const section = (title: string, list: [string, AchievementDef][]) =>
    h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, title), h('div', { class: 'lv-grid' }, list.map(achCard)));
  // a deed line: one rule counted one way (rule + by), its levels in count order
  const deeds = all.filter(([, d]) => isDeed(d));
  const lines = [...new Set(deeds.map(([, d]) => `${d.rule}|${d.by ?? ''}`))];
  const lineTitle = (k: string) => { const [rule, by] = k.split('|'); const t = ACH_RULE_TEXT[rule as AchievementDef['rule']] ?? rule; return `${t[0].toUpperCase()}${t.slice(1)}${by ? ` (per ${by.replace('_', ' ')})` : ''}`; };
  const counted = all.filter(([, d]) => !isDeed(d));
  return panes([
    { key: 'defeats', title: 'Defeats and mastery', n: counted.length, content: groups.map(([title, f]) => section(title, all.filter(([, d]) => f(d)))) },
    { key: 'deeds', title: 'Deeds', n: deeds.length, content: [
      h('p', { class: 'hs-note' }, 'One section per deed line: what the player does, counted by tally in src/engine/xp.ts and turnFeats in src/engine/feats.ts.'),
      ...lines.map((k) => section(lineTitle(k), deeds.filter(([, d]) => `${d.rule}|${d.by ?? ''}` === k)))] },
  ]);
}

// ---------- Skills, by tree ----------
/** tree access (TA1–TA11): Must, Either of and Blocked by as chips; a tree with no rule is open to everyone */
const access = (r?: TreeAccess): HTMLElement[] => !r ? [chip('open to everyone', '--c1')] : [
  ...(r.must ?? []).map((c) => chip(`must: ${condName(c)}`, '--c5')),
  ...(r.either?.length ? [chip(`either of: ${r.either.map(condName).join(', ')}`, '--c5')] : []),
  ...(r.blockedBy ?? []).map((c) => chip(`blocked by: ${condName(c)}`, '--c10'))];
function skills(): HTMLElement[] {
  const inTree = new Set(Object.values(lib.trees).flatMap((t) => t.skills));
  const loose = Object.keys(lib.skills).filter((s) => !inTree.has(s));
  const tree = (id: string, title: string, ids: string[], entry: unknown, chips: HTMLElement[]) => card('skills', id, entry, title, chips,
    h('table', { class: 'hs-tbl' }, h('thead', {}, h('tr', {}, ['Skill', 'Functions', 'Group', 'Roles', 'Tier', 'XP', 'Tags'].map((x) => h('th', {}, x)))),
      h('tbody', {}, ids.map((s) => lib.skills[s]).filter(Boolean).map((s) => h('tr', { id: `skills/${s.id}` },
        h('td', {}, h('b', {}, skillName(s.id)), s.cue ? ` · ${s.cue} cue` : '', ...(s.access ? access(s.access) : [])), h('td', {}, s.functions.length ? h('span', { class: 'lv-chips' }, s.functions.map((f) => chip(functionName(f), toneOf('Function', functionName(f))))) : '—'),
        h('td', {}, groupsOf(s).length ? h('span', { class: 'lv-chips' }, groupsOf(s).map((g) => chip(GROUP_NAMES[g], toneOf('Group', GROUP_NAMES[g])))) : '—'), h('td', {}, s.roles.join(', ') || '—'),
        h('td', {}, chip(`${SKILL_TIERS.name(s.tier)} · ×${CONFIG.SKILL_TIER_MULT[s.tier]}`, TIER_TONE[s.tier])), h('td', {}, chip(s.xpCategory, toneOf('XP', s.xpCategory))), h('td', {}, (s.tags ?? []).join(', ') || '—'))))));
  // the header says which group(s) the code puts the tree's skills in (FUNCTION_GROUP)
  const groupChips = (ids: string[]) => [...new Set(ids.flatMap((s) => groupsOf(lib.skills[s])))].map((g) => chip(`${GROUP_NAMES[g]} group`, toneOf('Group', GROUP_NAMES[g])));
  const treeCard = (id: string, title: string, ids: string[], entry: unknown, chips: HTMLElement[]) => {
    const c = tree(id, title, ids, entry, [...groupChips(ids), ...chips]);
    c.querySelector('.lv-id')?.remove(); // The tree id under the title is noise; the group chips say where it belongs
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
  const rule = h('article', { class: 'lv-card lv-fixed' }, h('header', {}, h('h3', {}, 'The rule'), chip('effectiveSkill · src/ruleset/gear.ts', '--c3')),
    h('ol', { class: 'lv-steps' },
      h('li', {}, 'A roll asks for one skill. The code also tries every other skill that shares one of its functions.'),
      h('li', {}, `Each stand-in counts at a share of its true skill and gear: the flat share (CONFIG.SUBSTITUTE_EFFICIENCY = ${pct(CONFIG.SUBSTITUTE_EFFICIENCY)}), or the skill's own table if CONFIG.SUBSTITUTES lists it.`),
      h('li', {}, 'The owner\'s perks with standIn move a share up or down (kept between ×0 and ×1).'),
      h('li', {}, 'Each candidate is then multiplied by its own tier multiplier, and the highest value is used.'),
      h('li', {}, `Function rolls (FUNCTION_ROLLS: ${FUNCTION_ROLLS.map(functionName).join(', ')}) skip the share: every skill with that function counts at ×1, then its tier, and the best one rolls.`)),
    row('Own tables', Object.keys(CONFIG.SUBSTITUTES).length ? links('standIns', Object.keys(CONFIG.SUBSTITUTES).map((id): [string, string] => [id, skillName(id)])) : none('none')),
    row('Perks that move a share', movers.length ? links('perks', movers.map((d): [string, string] => [d.id, `${d.name} (${d.standIn!.add > 0 ? '+' : ''}${d.standIn!.add}${d.standIn!.fn ? ` ${functionName(d.standIn!.fn)}` : ''})`])) : none('none yet')));
  const fnRow = ([f, g]: [string, keyof typeof GROUP_NAMES]) => h('tr', {}, h('td', {}, chip(functionName(f), toneOf('Function', functionName(f)))), h('td', {}, chip(GROUP_NAMES[g], toneOf('Group', GROUP_NAMES[g]))),
    h('td', {}, ids.filter((id) => (lib.skills[id].functions as string[]).includes(f)).map(skillName).join(', ') || '—'));
  const fns = h('article', { class: 'lv-card lv-fixed' }, h('header', {}, h('h3', {}, 'Functions and groups'), chip('FUNCTION_GROUP · functionNames.ts', '--c3')),
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
      [rolledFn ? chip(`${functionName(rolledFn)} roll ×1`, '--c2') : chip(own ? 'own table' : `flat ${pct(CONFIG.SUBSTITUTE_EFFICIENCY)}`, own ? '--c5' : '--c3')],
      rolledFn ? row('Rolled as', h('span', {}, `a ${functionName(rolledFn)} roll: every skill with ${functionName(rolledFn)} counts at ×1, then its tier, instead of the stand-in share. See `, link('standIns', `fn-${rolledFn}`, `${functionName(rolledFn)} check`))) : null,
      row('Looks for', h('span', { class: 'lv-chips' }, table.map((t) => chip(`${functionName(t.fn)} ${pct(t.fn === rolledFn ? 1 : t.k)}`, toneOf('Function', functionName(t.fn)))))),
      subs.length ? h('table', { class: 'hs-tbl' }, h('thead', {}, h('tr', {}, ['Stand-in', 'Shared function', 'Share', 'Its tier'].map((x) => h('th', {}, x)))),
        h('tbody', {}, subs.map(({ o, k }) => h('tr', {}, h('td', {}, link('skills', o, skillName(o))),
          h('td', {}, h('span', { class: 'lv-chips' }, table.filter((t) => (lib.skills[o].functions as string[]).includes(t.fn)).map((t) => chip(functionName(t.fn), toneOf('Function', functionName(t.fn)))))),
          h('td', {}, h('b', {}, pct(k))), h('td', {}, `×${CONFIG.SKILL_TIER_MULT[lib.skills[o].tier]}`))))) : row('Stand-ins', none('none: no other skill shares a function')));
  });
  // ---- function checks: a roll that passes fn (RollRequest.fn) counts every skill with it at ×1; the best one rolls ----
  const fnRule = h('article', { class: 'lv-card lv-fixed' }, h('header', {}, h('h3', {}, 'How a function check works'), chip('fnRoller · fnSkills · src/ruleset/gear.ts', '--c3')),
    h('ol', { class: 'lv-steps' },
      h('li', {}, 'The roll names a function, not a skill (RollRequest.fn). It still asks for the function\'s default skill (SENSE_SKILL).'),
      h('li', {}, 'Every skill with that function counts at ×1 (fnSkills). No stand-in share applies, and stand-in perks don\'t change it.'),
      h('li', {}, 'Each one is multiplied by its own tier multiplier, plus true skill, gear and perks as usual. The highest value rolls.'),
      h('li', {}, 'Light and other situation modifiers come from the skill that rolls (fnRoller), so Tremor ignores darkness.')),
    row('Functions checked this way', `FUNCTION_ROLLS: ${FUNCTION_ROLLS.map(functionName).join(', ')}`),
    row('Rolls that use them', 'sneak and hide contests (stealthDetect) and noticing an ambush (resolveAmbush) in minds/state.ts; Look around in engine/resolve.ts'),
    row('After the roll', link('perks', 'curiouser', 'Curiouser and Curiouser'), ': Success or better on any function check counts one tier higher (allSteps.ts)'));
  const fnCards = FUNCTION_ROLLS.map((f) => {
    const rows = fnSkills(f).map((id) => ({ id, tier: CONFIG.SKILL_TIER_MULT[lib.skills[id].tier] })).sort((a, b) => b.tier - a.tier);
    const asked = (SENSE_SKILL as Record<string, string>)[f];
    const adds = Object.values(lib.perks).filter((d) => d.fnSkill?.fn === f);
    const grp = GROUP_NAMES[FUNCTION_GROUP[f]];
    return card('standIns', `fn-${f}`, { function: f, functions: [f], asks: asked ?? null, skills: rows.map((r) => r.id) }, `${functionName(f)} check`,
      [chip(`${grp} group`, toneOf('Group', grp)), chip('every skill ×1', '--c2')],
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
  const rule = h('article', { class: 'lv-card lv-fixed' }, h('header', {}, h('h3', {}, 'How modifiers stack'), chip('modTotal · stackType · src/ruleset/index.ts', '--c3')),
    h('ol', { class: 'lv-steps' },
      h('li', {}, 'Every modifier on a roll has a type (ModType in src/types/ruleset.ts). The sections below list what feeds each type.'),
      h('li', {}, `Within one type, the biggest counts in full and each next one at CONFIG.STACK_RATIO = ${x(r)} to the power of its place: ${shares} …`),
      h('li', {}, 'Bonuses and penalties of a type stack apart: the biggest bonus counts in full, and so does the biggest penalty.'),
      h('li', {}, 'The types then add together in full.'),
      h('li', {}, `A source given in skill points counts at CONFIG.SKILL_WEIGHT = ${x(CONFIG.SKILL_WEIGHT)} as a roll modifier, like skill itself (a +5 skill Bane is +${x(5 * CONFIG.SKILL_WEIGHT)} on the roll).`)),
    row('Example', `three +10 of one type: ${x(stackType(ex1))} on the roll (stackType)`),
    row('Example', `+10 achievement and +10 gear: ${x(modTotal(ex2 as { type: string; value: number }[]))} (two types, both in full)`));
  const outside = h('article', { class: 'lv-card lv-fixed' }, h('header', {}, h('h3', {}, 'Not stacked this way'), chip('tier shifts · effective skill', '--c3')),
    h('ol', { class: 'lv-steps' },
      h('li', {}, 'Tier shifts move the result a whole tier after the roll and simply add up: cover, Hidden Strike, marks, falling short on gear, Curiouser and Curiouser.'),
      h('li', {}, 'Skill changes act before the roll, on effective skill: true skill and its perks, gear skill effects, the stand-in share and the skill tier. See the Stand-ins tab.')));
  const srcCard = (s: ModSource, i: number) => {
    const feeds = s.feeds?.(lib) ?? [];
    const c = card('stacking', `${s.roll}-${s.type}-${i}`, { type: s.type, roll: s.roll, source: s.source, when: s.when, value: s.value, at: s.at, ...(s.feeds ? { feeds } : {}) }, s.source,
      [chip(MOD_TYPE_NAMES[s.type], toneOf('Type', MOD_TYPE_NAMES[s.type])), chip(s.feeds ? `${feeds.length} from the library` : 'fixed number', s.feeds ? '--c1' : '--c3')],
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
      { key: 'situation', title: 'Situation rolls', n: n('situation'), content: [h('p', { class: 'hs-note' }, 'The no-skill roll for luck and circumstance (ruleset.situation). Statuses will count here too once they have library entries.'), ...byType('situation')] },
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
          const c = card('equations', `${g.key}-${i}`, e, e.name, [chip(e.at, '--c3')],
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

// ---------- Page ----------
const CUSTOM: Section[] = [
  { key: 'gear', title: 'Gear', table: 'items', view: gear },
  { key: 'perks', title: 'Perks', table: 'perks', view: perks },
  { key: 'races', title: 'Races', table: 'races', view: races },
  { key: 'bodyTypes', title: 'Body types', table: 'bodyTypes', view: bodyTypes },
  { key: 'achievements', title: 'Achievements', table: 'achievements', view: achievements },
  { key: 'skills', title: 'Skills', table: 'skills', view: skills },
  { key: 'standIns', title: 'Stand-ins', table: 'skills', view: standIns },
  { key: 'stacking', title: 'Stacking', table: 'perks', view: stacking, count: MOD_SOURCES.length },
  { key: 'equations', title: 'Equations', table: 'perks', view: equationsView, count: EQUATIONS.reduce((n, g) => n + g.equations.length, 0) },
];
const treeOf = (skill?: string) => (skill ? lib.trees[lib.skills[skill]?.treeId]?.name : undefined);
const FACETS: Record<string, Facets> = {
  stacking: (e: { type?: StackedType; roll?: string; feeds?: unknown[] }) => [['Type', e.type && MOD_TYPE_NAMES[e.type]], ['Roll', e.roll && `${e.roll} rolls`],
    ['Fed by', e.type ? (e.feeds ? 'library entries' : 'a fixed number') : undefined]],
  standIns: (e: { id?: string; functions?: string[]; own?: boolean }) => [['Rule', e.id ? (e.own ? 'own table' : 'flat share') : undefined], ['Tree', treeOf(e.id)],
    ...(e.functions ?? []).map((f): [string, string] => ['Function', functionName(f)])],
  gear: (i: ItemDef) => [['Kind', i.kind], ...(i.weapon?.modes ?? []).flatMap((m): [string, string][] => [['Attack', m.tree], ['Class', m.class]]), ['Class', i.armor?.weight],
    ...(['concealed', 'stackable', 'consumable'] as const).filter((f) => i[f]).map((f): [string, string] => ['Flag', f]), ...(i.tags ?? []).map((t): [string, string] => ['Flag', t])],
  perks: (d: PerkDef & { place?: string; skill?: string; bankedAs?: string }) => [['Banked as', d.bankedAs && ({ milestone: 'milestone perk', allX: 'All-X candidate', other: 'other' } as Record<string, string>)[d.bankedAs]], ['Milestone', d.ladder ? ms(d) : d.place && label(d.place)], ['Effect', d.effect], ['State', d.built === undefined ? 'written only' : d.built ? 'built' : 'not built'],
    ['State', d.quirk ? 'quirk' : undefined], ['Tree', d.allStep ? lib.trees[d.allStep.treeId]?.name : treeOf(d.ladder?.skill ?? d.skill)]],
  achievements: (d: AchievementDef) => [['Level', `Level ${REWARD_LEVELS.name(d.level as 'i')}`], ['Counts', d.rule === 'mastery' ? 'tree mastery' : d.rule !== 'defeats' ? 'deed' : d.by ? `per ${d.by.replace('_', ' ')}` : 'total defeats']],
  bodyTypes: (c: BodyType) => [['Size', c.general.size], ['Figure', c.figure ? 'has figure' : 'no figure']],
  skills: (t: { skills?: string[]; access?: TreeAccess }) => [['Tree', classTree(t.access) ? 'class tree' : t.access?.must?.length || t.access?.either?.length ? 'needs a source' : 'general'],
    ...(t.access?.blockedBy ?? []).map((c): [string, string] => ['Blocked by', condName(c)]),
    ...(t.skills ?? []).flatMap((id) => groupsOf(lib.skills[id]).map((g): [string, string] => ['Group', GROUP_NAMES[g]]))],
};
/** generic tables: a short field with 2–8 values shared by entries becomes a filter group */
function autoFacets(table: Record<string, Entry>): Facets {
  const rows = Object.values(table);
  const keys = [...new Set(rows.flatMap(Object.keys))].filter((k) => k !== 'id' && rows.every((r) => r[k] === undefined || ['string', 'number', 'boolean'].includes(typeof r[k])))
    .filter((k) => { const n = new Set(rows.map((r) => r[k]).filter((v) => v !== undefined)).size; return n >= 2 && n <= 8 && n < rows.length; })
    .sort((a, b) => Number(rows.some((r) => typeof r[a] !== 'string')) - Number(rows.some((r) => typeof r[b] !== 'string'))).slice(0, 4); // words before numbers
  return (e: Entry) => keys.map((k) => [k, e[k] as string]);
}

const NAMES: Partial<Record<keyof Library, string>> = { templates: 'NPCs', durations: 'Clock', routineSets: 'Routine sets', zoneKinds: 'Zone kinds' };
const SECTIONS: Section[] = [...CUSTOM, ...(Object.keys(lib) as (keyof Library)[])
  .filter((k) => typeof lib[k] === 'object' && !CUSTOM.some((c) => c.table === k) && k !== 'trees' && Object.keys(lib[k] as object).length)
  .map((k) => ({ key: k, title: NAMES[k] ?? label(k), table: k }))];

const rail = h('nav', { class: 'hs-rail', 'aria-label': 'Library tables' }, h('div', { class: 'hs-brand' }, 'LIB', h('span', { class: 'ar' }, `v${lib.version}`)),
  SECTIONS.map((s) => h('a', { href: `#${s.key}`, 'data-sec': s.key }, s.title, h('span', { class: 'lv-n' }, String(s.count ?? Object.keys(lib[s.table] as object).length)))));
const picks = new Map<string, 'shown' | 'out'>();
const bar = h('div', { class: 'lv-filters', 'aria-label': 'Filters' });
const search = h('input', { class: 'hs-input lv-search', type: 'search', placeholder: 'Filter this table', 'aria-label': 'Filter this table', oninput: filter });
const titleEl = h('h1', {});
const body = h('div', { class: 'lv-body' });
const main = h('main', {}, h('div', { class: 'head' }, h('div', {}, titleEl,
  h('p', {}, `Library as the code builds it (prototypeLibrary) · commit ${__BUILD__.sha} · ${fmtDate(__BUILD__.date)}`)), search), bar, body);
document.body.append(rail, main);

const cards = () => [...Array.from(body.querySelectorAll<HTMLElement>('.lv-card:not(.lv-fixed)'))].filter((c) => !c.closest('.lv-pane[hidden]'));
const facetsOf = (c: HTMLElement) => (c.dataset.f ? c.dataset.f.split('\n') : []);
/** buttons cycle off → Shown → Left out (several Shown in a group = either), as on the game's tiles */
function drawBar(): void {
  const groups = new Map<string, Map<string, number>>();
  for (const c of cards()) for (const f of facetsOf(c)) {
    const [g] = f.split('\t');
    const vals = groups.get(g) ?? groups.set(g, new Map()).get(g)!;
    vals.set(f, (vals.get(f) ?? 0) + 1);
  }
  const next = { off: 'shown', shown: 'out', out: 'off' } as const;
  const shownGroups = [...groups].filter(([, v]) => v.size > 1);
  if (!shownGroups.some(([g]) => g === colourBy)) colourBy = shownGroups[0]?.[0] ?? '';
  bar.replaceChildren(...shownGroups.map(([g, vals]) => h('div', { class: 'lv-fg' }, h('span', { class: 'hs-label' }, g),
    h('button', { type: 'button', class: 'lv-cb', 'aria-pressed': String(g === colourBy), title: g === colourBy ? 'Cards are coloured by this group' : `Colour the cards by ${g}`,
      onclick: () => { colourBy = g; drawBar(); paint(); } }, g === colourBy ? 'Colour key' : 'Colour by this'),
    [...vals].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([f, n]) => {
      const st = picks.get(f) ?? 'off';
      const v = f.split('\t')[1];
      return h('button', { type: 'button', class: 'lv-fb', 'data-st': st, 'aria-pressed': st === 'shown' ? 'true' : st === 'out' ? 'mixed' : 'false',
        style: g === colourBy ? `--tone: var(${toneOf(g, v)})` : undefined,
        title: st === 'off' ? 'Click for Shown (several Shown = either)' : st === 'shown' ? 'Click for Left out' : 'Click to clear',
        onclick: () => { const to = next[st]; if (to === 'off') picks.delete(f); else picks.set(f, to); drawBar(); filter(); } },
      g === colourBy ? h('i', { class: 'lv-sw' }) : null, v, h('small', {}, String(n)), st === 'off' ? null : h('b', {}, st === 'shown' ? 'Shown' : 'Left out'));
    }))),
  ...(picks.size ? [h('button', { type: 'button', class: 'hs-btn-text', onclick: () => { picks.clear(); drawBar(); filter(); } }, 'Clear filters')] : []));
  bar.hidden = !bar.childElementCount;
}
/** tint each card by its value in the colour group */
function paint(): void {
  for (const c of cards()) {
    const f = facetsOf(c).find((x) => x.split('\t')[0] === colourBy);
    c.classList.toggle('lv-toned', !!f);
    if (f) c.style.setProperty('--tone', `var(${toneOf(colourBy, f.split('\t')[1])})`);
  }
}
function filter(): void {
  const q = search.value.trim().toLowerCase();
  const shownBy = new Map<string, string[]>();
  for (const [f, st] of picks) if (st === 'shown') { const g = f.split('\t')[0]; shownBy.set(g, [...(shownBy.get(g) ?? []), f]); }
  for (const c of cards()) {
    const fs = new Set(facetsOf(c));
    c.hidden = (!!q && !c.dataset.q!.includes(q)) || [...picks].some(([f, st]) => st === 'out' && fs.has(f)) || [...shownBy.values()].some((fs2) => !fs2.some((f) => fs.has(f)));
  }
  body.querySelectorAll<HTMLElement>('.lv-group').forEach((g) => { g.hidden = !!g.querySelector('.lv-card') && !g.querySelector('.lv-card:not([hidden])'); });
  body.querySelectorAll<HTMLAnchorElement>('.lv-cell').forEach((a) => a.classList.toggle('dim', !!document.getElementById(a.hash.slice(1))?.hidden));
}
const viewOf = (sec: Section) => (sec.view ? sec.view() : [h('div', { class: 'lv-grid' }, generic(sec.key, lib[sec.table] as Record<string, Entry>))]).filter(Boolean) as HTMLElement[];

// Details pop-up: clicking any entry link opens its full card in a floating panel that can be dragged
// and closed, so the page underneath stays where it is.
const popBody = h('div', { class: 'lv-pop-body' });
const popTitle = h('span', { class: 'hs-label' });
const popOpen = h('a', { class: 'lv-link', href: '#' }, 'Open in its table');
const pop = h('aside', { class: 'lv-pop', hidden: true, 'aria-label': 'Details' },
  h('div', { class: 'lv-pop-head' }, popTitle, popOpen,
    h('button', { type: 'button', class: 'hs-icon-btn lv-pop-x', 'aria-label': 'Close', title: 'Close (Esc)', onclick: () => { pop.hidden = true; } }, '✕')), popBody);
document.body.append(pop);
function showPop(key: string, id: string): boolean {
  const sec = SECTIONS.find((s) => s.key === key);
  if (!sec) return false;
  const keep = facetOf;
  const src = (key === shown ? body : h('div', {}, viewOf(sec))).querySelector<HTMLElement>(`[id="${CSS.escape(`${key}/${id}`)}"]`);
  facetOf = keep;
  if (!src) return false;
  const copy = src.cloneNode(true) as HTMLElement;
  copy.removeAttribute('id');
  copy.hidden = false;
  copy.classList.remove('lv-hit');
  copy.querySelectorAll('[id]').forEach((x) => x.removeAttribute('id'));
  copy.querySelectorAll('details').forEach((d) => { d.open = false; });
  popTitle.textContent = sec.title;
  popOpen.setAttribute('href', `#${key}/${id}`);
  popBody.replaceChildren(copy);
  pop.hidden = false;
  return true;
}
// drag by the head; the spot is kept for the next pop-up
pop.firstElementChild!.addEventListener('pointerdown', (e) => {
  const ev = e as PointerEvent;
  if ((ev.target as Element).closest('a, button')) return;
  const r = pop.getBoundingClientRect();
  const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
  const move = (m: PointerEvent) => {
    pop.style.left = `${Math.max(0, Math.min(innerWidth - 80, m.clientX - dx))}px`;
    pop.style.top = `${Math.max(0, Math.min(innerHeight - 40, m.clientY - dy))}px`;
    pop.style.right = 'auto';
  };
  const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') pop.hidden = true; });
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('main a[href^="#"], .lv-pop-body a[href^="#"]');
  if (!a) return;
  const [key, ...rest] = decodeURIComponent(a.hash.slice(1)).split('/');
  if (rest.length && showPop(key, rest.join('/'))) e.preventDefault();
});
popOpen.addEventListener('click', () => { pop.hidden = true; });

// Folding: clicking a section header (or Enter/Space on it) folds what is under it
const HEAD = '.lv-group > h2.hs-section';
function fold(head: Element, open?: boolean): void {
  const folded = head.parentElement!.classList.toggle('lv-folded', open === undefined ? undefined : !open);
  const k = foldKey(head);
  if (folded) foldedSet.add(k); else foldedSet.delete(k);
  keep('lv-folded', [...foldedSet]);
  head.setAttribute('aria-expanded', String(!folded));
}
const foldKey = (head: Element): string => `${shown}|${head.closest<HTMLElement>('.lv-pane')?.dataset.pane ?? ''}|${head.textContent}`;
function foldable(): void {
  body.querySelectorAll<HTMLElement>(HEAD).forEach((h2) => { if (foldedSet.has(foldKey(h2))) h2.parentElement!.classList.add('lv-folded'); });
  body.querySelectorAll<HTMLElement>(HEAD).forEach((h2) => { h2.tabIndex = 0; h2.setAttribute('role', 'button'); h2.setAttribute('aria-expanded', String(!h2.parentElement!.classList.contains('lv-folded'))); h2.title = 'Click to fold or unfold'; });
}
body.addEventListener('click', (e) => { const h2 = (e.target as Element).closest(HEAD); if (h2) fold(h2); });
body.addEventListener('keydown', (e) => {
  const h2 = (e.target as Element).closest(HEAD);
  if (h2 && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fold(h2); }
});

let shown = '';
function route(): void {
  const [key, ...rest] = decodeURIComponent(location.hash.slice(1)).split('/');
  const sec = SECTIONS.find((s) => s.key === key) ?? SECTIONS[0];
  if (sec.key !== shown) {
    shown = sec.key;
    titleEl.textContent = sec.title;
    picks.clear();
    pane = paneOf[sec.key] ?? '';
    colourBy = COLOUR_BY[sec.key] ?? '';
    facetOf = FACETS[sec.key] ?? (sec.view ? () => [] : autoFacets(lib[sec.table] as Record<string, Entry>));
    body.replaceChildren(...viewOf(sec));
    foldable();
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
    const shut = el?.closest('.lv-folded')?.querySelector(':scope > h2.hs-section');
    if (shut) fold(shut, true);
    body.querySelectorAll('.lv-hit').forEach((x) => x.classList.remove('lv-hit'));
    el?.classList.add('lv-hit');
    el?.scrollIntoView({ block: 'center' });
  }
}
addEventListener('hashchange', route);
route();
