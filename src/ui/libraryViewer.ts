// Library viewer (Ali, 08/11/2026): every library table drawn from the same modules the game runs, so it shows the
// library exactly as code sees it. Bundled into dist/library.html by scripts/build.mjs. Tables without a custom view
// get the generic cards, so a new table shows up with no edit here.
import './styles.css';
import './libraryViewer.css';
import type { AchievementDef, BodyType, ItemDef, ItemEffect, Library, PerkDef, PerkWriteup, TreeAccess } from '../types';
import { classTree, condName } from '../ruleset/access';
import { prototypeLibrary } from '../library/data';
import { PERK_WRITEUPS } from '../library/perks';
import { BOOST_PERKS } from '../library/boostPerks';
import { CONFIG } from '../config';
import { REWARD_LEVELS, SKILL_TIERS } from '../scales';
import { fmtDate, h } from './kit';
import { skillName } from './creation';
import { partName } from './healing';

declare const __BUILD__: { sha: string; date: string };
const lib: Library = prototypeLibrary();
type Entry = Record<string, unknown>;
type Section = { key: string; title: string; table: keyof Library; view?: () => (HTMLElement | null)[] };

const label = (id: string) => partName(id);
const chip = (text: string, tone?: string) => h('span', { class: 'hs-tg cap', style: tone ? `--tg: var(${tone})` : undefined }, text);
const link = (sec: string, id: string, text = id) => h('a', { class: 'lv-link', href: `#${sec}/${id}` }, text);
const none = (text = 'none yet') => h('span', { class: 'lv-none' }, text);
const row = (k: string, ...v: (Node | string | null)[]) => h('div', { class: 'lv-row' }, h('span', { class: 'lv-k' }, k), h('span', { class: 'lv-v' }, ...v));
const raw = (e: unknown) => h('details', { class: 'lv-raw' }, h('summary', {}, 'Code'), h('pre', {}, JSON.stringify(e, null, 2)));

/** filter buttons (Ali, 08/11/2026): each section names [group, value] pairs per entry; generic tables get them from their short fields */
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
const fields = (e: Entry, skip: string[]) => Object.entries(e).filter(([k]) => !skip.includes(k)).map(([k, v]) => row(k, val(v)));

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
function gear(): HTMLElement[] {
  const kinds = [...new Set(Object.values(lib.items).map((i) => i.kind))];
  const humanoid = lib.bodyTypes.humanoid;
  return kinds.map((kind) => h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, `${label(kind)}`),
    h('div', { class: 'lv-grid' }, Object.values(lib.items).filter((i) => i.kind === kind).map((i: ItemDef) => {
      const flags = (['concealed', 'stackable', 'consumable', 'visible'] as const).filter((f) => i[f]).map((f) => chip(f, '--c3'));
      const covers = new Set(i.armor?.covers ?? []);
      return card('gear', i.id, i, label(i.name), [chip(i.kind, '--c1'), ...flags, ...(i.tags ?? []).map((t) => chip(t, '--c7'))],
        h('p', { class: 'lv-look' }, i.look),
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
    }))));
}

// ---------- Perks: the ladder grid (skill × milestone), then every perk ----------
const EFFECT_TONE: Record<string, string> = { attack: '--c10', defense: '--c1', health: '--c2', speed: '--c15', senses: '--c5', speech: '--c4' };
const ms = (d: PerkDef) => (d.ladder ? `${d.ladder.milestone} perk` : 'no milestone');
function perkCard(sec: string, d: PerkDef | PerkWriteup): HTMLElement {
  const r = d.rules;
  return card(sec, d.id, d, d.name, [
    d.ladder ? chip(`${ms(d)} · ${skillName(d.ladder.skill)}`, '--c1') : chip(('place' in d ? d.place : '') || 'no milestone', '--c3'),
    d.effect ? chip(d.effect, EFFECT_TONE[d.effect]) : null,
    d.quirk ? chip('quirk', '--danger') : null,
    'built' in d && d.built !== undefined ? chip(d.built ? 'built' : 'not built', d.built ? '--ok' : '--warn') : null],
  d.story ? h('p', { class: 'lv-story' }, d.story) : null,
  r ? h('div', { class: 'lv-rules' }, row('Kind', r.kind), row('Trigger', r.trigger), r.conditions.length ? row('Conditions', h('div', { class: 'lv-sub' }, r.conditions.map((c) => h('div', {}, c)))) : null,
    row('Effect', r.effect), row('Lasts', r.lasts), r.cooldown ? row('Cooldown', r.cooldown) : null, r.needs ? row('Needs first', r.needs) : null, r.open ? row('Open', r.open) : null) : null,
  d.trueSkill ? row('True skill', `+${d.trueSkill} ${d.ladder ? skillName(d.ladder.skill) : ''}`) : null,
  d.functionBoost ? row('Same-function skills', `+${d.functionBoost} each`) : null,
  d.trueSkillTo ? row('True skill to', val(Object.fromEntries(Object.entries(d.trueSkillTo).map(([k, v]) => [skillName(k), `+${v}`])))) : null,
  d.numbers ? row('Numbers', val(d.numbers)) : null,
  ...fields(d as Entry, ['id', 'name', 'story', 'rules', 'ladder', 'effect', 'built', 'quirk', 'trueSkill', 'functionBoost', 'trueSkillTo', 'numbers', 'ref', 'skill', 'place']));
}
function perks(): HTMLElement[] {
  const all = Object.values(lib.perks);
  const skills = Object.keys(lib.skills).filter((s) => all.some((d) => d.ladder?.skill === s));
  const steps = [...new Set(all.map((d) => d.ladder!.milestone))].sort((a, b) => a - b);
  const at = (s: string, m: number) => all.filter((d) => d.ladder?.skill === s && d.ladder.milestone === m);
  const loose = [...PERK_WRITEUPS, ...BOOST_PERKS].filter((d) => !lib.perks[d.id]);
  const quirks = all.filter((d) => d.quirk).length;
  return [
    h('p', { class: 'hs-note' }, `${all.length} perks in the library · ${all.filter((d) => d.built).length} built · ${quirks} quirk${quirks === 1 ? '' : 's'} · ${loose.length} written with no milestone yet. A dashed cell is not built yet; a red edge is a quirk.`),
    h('p', { class: 'hs-note lv-chips' }, Object.entries(EFFECT_TONE).map(([e, t]) => chip(e, t))),
    h('div', { class: 'lv-ladder' }, h('table', { class: 'hs-tbl' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Skill'), steps.map((m) => h('th', {}, `${m} perk`)))),
      h('tbody', {}, skills.map((s) => h('tr', {}, h('td', {}, h('b', {}, skillName(s))), steps.map((m) => h('td', {}, at(s, m).map((d) =>
        h('a', { class: `lv-cell${d.built ? '' : ' unbuilt'}${d.quirk ? ' quirk' : ''}`, href: `#perks/${d.id}`, style: `--tg: var(${EFFECT_TONE[d.effect ?? ''] ?? '--c3'})` }, d.name))))))))),
    h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, 'In the library'), h('div', { class: 'lv-grid' }, all.map((d) => perkCard('perks', d)))),
    loose.length ? h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, 'Written, no milestone yet (not in the library)'),
      h('div', { class: 'lv-grid' }, loose.map((d) => perkCard('perks', d)))) : null,
  ].filter(Boolean) as HTMLElement[];
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
  const all = Object.entries(lib.achievements ?? {});
  const groups: [string, (d: AchievementDef) => boolean][] = [['Per body type', (d) => d.by === 'body_type'], ['Per race', (d) => d.by === 'race'],
    ['Total defeats', (d) => d.rule === 'defeats' && !d.by], ['Tree mastery', (d) => d.rule === 'mastery']];
  const name = (n: string) => h('span', {}, ...n.split(/(\{\w+\})/).map((p) => (p.startsWith('{') ? h('em', { class: 'lv-slot' }, p) : p)));
  return groups.map(([title, f]) => h('section', { class: 'lv-group' }, h('h2', { class: 'hs-section' }, title), h('div', { class: 'lv-grid' },
    all.filter(([, d]) => f(d)).map(([key, d]) => {
      const c = card('achievements', key, d, d.name, [chip(`Level ${REWARD_LEVELS.name(d.level as 'i')}`, '--c15'), chip(`${CONFIG.REWARD_XP[d.level] ?? '?'} XP`, '--c2')],
        row('Name', name(d.name)),
        row('Earned at', d.rule === 'mastery' ? `all three skills of a tree at ${d.count}` : `${d.count} defeat${d.count === 1 ? '' : 's'}${d.by ? `, once per ${d.by === 'body_type' ? 'body type' : 'race'}` : ''}`),
        row('Granted id', d.by || d.rule === 'mastery' ? `${d.id}:<${d.by ?? 'tree'}>` : d.id));
      return c;
    }))));
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
    h('table', { class: 'hs-tbl' }, h('thead', {}, h('tr', {}, ['Skill', 'Functions', 'Roles', 'Tier', 'XP', 'Tags'].map((x) => h('th', {}, x)))),
      h('tbody', {}, ids.map((s) => lib.skills[s]).filter(Boolean).map((s) => h('tr', { id: `skills/${s.id}` },
        h('td', {}, h('b', {}, skillName(s.id)), s.cue ? ` · ${s.cue} cue` : ''), h('td', {}, s.functions.join(', ') || '—'), h('td', {}, s.roles.join(', ') || '—'),
        h('td', {}, `${SKILL_TIERS.name(s.tier)} · ×${CONFIG.SKILL_TIER_MULT[s.tier]}`), h('td', {}, s.xpCategory), h('td', {}, (s.tags ?? []).join(', ') || '—'))))));
  return [h('div', { class: 'lv-grid wide' },
    Object.values(lib.trees).map((t) => tree(t.id, t.name, t.skills, t, access(t.access))),
    loose.length ? tree('no_tree', 'In no tree', loose, loose, []) : null)];
}

// ---------- Page ----------
const CUSTOM: Section[] = [
  { key: 'gear', title: 'Gear', table: 'items', view: gear },
  { key: 'perks', title: 'Perks', table: 'perks', view: perks },
  { key: 'races', title: 'Races', table: 'races', view: races },
  { key: 'bodyTypes', title: 'Body types', table: 'bodyTypes', view: bodyTypes },
  { key: 'achievements', title: 'Achievements', table: 'achievements', view: achievements },
  { key: 'skills', title: 'Skills', table: 'skills', view: skills },
];
const treeOf = (skill?: string) => (skill ? lib.trees[lib.skills[skill]?.treeId]?.name : undefined);
const FACETS: Record<string, Facets> = {
  gear: (i: ItemDef) => [['Kind', i.kind], ...(i.weapon?.modes ?? []).flatMap((m): [string, string][] => [['Attack', m.tree], ['Class', m.class]]), ['Class', i.armor?.weight],
    ...(['concealed', 'stackable', 'consumable'] as const).filter((f) => i[f]).map((f): [string, string] => ['Flag', f]), ...(i.tags ?? []).map((t): [string, string] => ['Flag', t])],
  perks: (d: PerkDef & { place?: string; skill?: string }) => [['Milestone', d.ladder ? ms(d) : d.place && label(d.place)], ['Effect', d.effect], ['State', d.built === undefined ? 'written only' : d.built ? 'built' : 'not built'],
    ['State', d.quirk ? 'quirk' : undefined], ['Tree', treeOf(d.ladder?.skill ?? d.skill)]],
  achievements: (d: AchievementDef) => [['Level', `Level ${REWARD_LEVELS.name(d.level as 'i')}`], ['Counts', d.rule === 'mastery' ? 'tree mastery' : d.by ? `per ${d.by.replace('_', ' ')}` : 'total defeats']],
  bodyTypes: (c: BodyType) => [['Size', c.general.size], ['Figure', c.figure ? 'has figure' : 'no figure']],
  skills: (t: { skills?: string[]; access?: TreeAccess }) => [['Tree', classTree(t.access) ? 'class tree' : t.access?.must?.length || t.access?.either?.length ? 'needs a source' : 'general'],
    ...(t.access?.blockedBy ?? []).map((c): [string, string] => ['Blocked by', condName(c)]),
    ...(t.skills ?? []).flatMap((id) => lib.skills[id]?.functions.map((fn): [string, string] => ['Function', fn]) ?? [])],
};
/** generic tables: a short field with 2–8 values shared by entries becomes a filter group */
function autoFacets(table: Record<string, Entry>): Facets {
  const rows = Object.values(table);
  const keys = [...new Set(rows.flatMap(Object.keys))].filter((k) => k !== 'id' && rows.every((r) => r[k] === undefined || ['string', 'number', 'boolean'].includes(typeof r[k])))
    .filter((k) => { const n = new Set(rows.map((r) => r[k]).filter((v) => v !== undefined)).size; return n >= 2 && n <= 8 && n < rows.length; })
    .sort((a, b) => Number(rows.some((r) => typeof r[a] !== 'string')) - Number(rows.some((r) => typeof r[b] !== 'string'))).slice(0, 4); // words before numbers
  return (e: Entry) => keys.map((k) => [k, e[k] as string]);
}

const NAMES: Partial<Record<keyof Library, string>> = { templates: 'NPCs', durations: 'Clock', routineSets: 'Routine sets' };
const SECTIONS: Section[] = [...CUSTOM, ...(Object.keys(lib) as (keyof Library)[])
  .filter((k) => typeof lib[k] === 'object' && !CUSTOM.some((c) => c.table === k) && k !== 'trees' && Object.keys(lib[k] as object).length)
  .map((k) => ({ key: k, title: NAMES[k] ?? label(k), table: k }))];

const rail = h('nav', { class: 'hs-rail', 'aria-label': 'Library tables' }, h('div', { class: 'hs-brand' }, 'LIB', h('span', { class: 'ar' }, `v${lib.version}`)),
  SECTIONS.map((s) => h('a', { href: `#${s.key}`, 'data-sec': s.key }, s.title, h('span', { class: 'lv-n' }, String(Object.keys(lib[s.table] as object).length)))));
const picks = new Map<string, 'shown' | 'out'>();
const bar = h('div', { class: 'lv-filters', 'aria-label': 'Filters' });
const search = h('input', { class: 'hs-input lv-search', type: 'search', placeholder: 'Filter this table', 'aria-label': 'Filter this table', oninput: filter });
const titleEl = h('h1', {});
const body = h('div', { class: 'lv-body' });
const main = h('main', {}, h('div', { class: 'head' }, h('div', {}, titleEl,
  h('p', {}, `Library as the code builds it (prototypeLibrary) · commit ${__BUILD__.sha} · ${fmtDate(__BUILD__.date)}`)), search), bar, body);
document.body.append(rail, main);

const cards = () => [...Array.from(body.querySelectorAll<HTMLElement>('.lv-card'))];
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
  bar.replaceChildren(...[...groups].filter(([, v]) => v.size > 1).map(([g, vals]) => h('div', { class: 'lv-fg' }, h('span', { class: 'hs-label' }, g),
    [...vals].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([f, n]) => {
      const st = picks.get(f) ?? 'off';
      return h('button', { type: 'button', class: 'lv-fb', 'data-st': st, 'aria-pressed': st === 'shown' ? 'true' : st === 'out' ? 'mixed' : 'false',
        title: st === 'off' ? 'Click for Shown (several Shown = either)' : st === 'shown' ? 'Click for Left out' : 'Click to clear',
        onclick: () => { const to = next[st]; if (to === 'off') picks.delete(f); else picks.set(f, to); drawBar(); filter(); } },
      f.split('\t')[1], h('small', {}, String(n)), st === 'off' ? null : h('b', {}, st === 'shown' ? 'Shown' : 'Left out'));
    }))),
  ...(picks.size ? [h('button', { type: 'button', class: 'hs-btn-text', onclick: () => { picks.clear(); drawBar(); filter(); } }, 'Clear filters')] : []));
  bar.hidden = !bar.childElementCount;
}
function filter(): void {
  const q = search.value.trim().toLowerCase();
  const shownBy = new Map<string, string[]>();
  for (const [f, st] of picks) if (st === 'shown') { const g = f.split('\t')[0]; shownBy.set(g, [...(shownBy.get(g) ?? []), f]); }
  for (const c of cards()) {
    const fs = new Set(facetsOf(c));
    c.hidden = (!!q && !c.dataset.q!.includes(q)) || [...picks].some(([f, st]) => st === 'out' && fs.has(f)) || [...shownBy.values()].some((fs2) => !fs2.some((f) => fs.has(f)));
  }
  body.querySelectorAll<HTMLElement>('.lv-group').forEach((g) => { g.hidden = !g.querySelector('.lv-card:not([hidden])'); });
  body.querySelectorAll<HTMLAnchorElement>('.lv-cell').forEach((a) => a.classList.toggle('dim', !!document.getElementById(a.hash.slice(1))?.hidden));
}
const viewOf = (sec: Section) => (sec.view ? sec.view() : [h('div', { class: 'lv-grid' }, generic(sec.key, lib[sec.table] as Record<string, Entry>))]).filter(Boolean) as HTMLElement[];

// Details pop-up (Ali, 08/11/2026): clicking any entry link opens its full card in a floating panel that can be dragged
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

let shown = '';
function route(): void {
  const [key, ...rest] = decodeURIComponent(location.hash.slice(1)).split('/');
  const sec = SECTIONS.find((s) => s.key === key) ?? SECTIONS[0];
  if (sec.key !== shown) {
    shown = sec.key;
    titleEl.textContent = sec.title;
    picks.clear();
    facetOf = FACETS[sec.key] ?? (sec.view ? () => [] : autoFacets(lib[sec.table] as Record<string, Entry>));
    body.replaceChildren(...viewOf(sec));
    rail.querySelectorAll('a').forEach((a) => (a.dataset.sec === sec.key ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    drawBar();
    filter();
    scrollTo(0, 0);
  }
  if (rest.length) {
    const el = document.getElementById(`${sec.key}/${rest.join('/')}`);
    body.querySelectorAll('.lv-hit').forEach((x) => x.classList.remove('lv-hit'));
    el?.classList.add('lv-hit');
    el?.scrollIntoView({ block: 'center' });
  }
}
addEventListener('hashchange', route);
route();
