// Creation screen (Part 4 §4, approved layout B: tree grid). Point-buy over the open skills.
import { TR } from '../library/treeIds';
import type { Actor, CreationBuild, GameApi, Pronouns } from '../types';
import type { FreeWorld } from '../save';
import { threadboundStartBlocked } from '../ruleset/threadboundItems';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { classFloors, createPlayer, creationAge, creationAgeRange, creationPoints, newPlayer, recommendedBuild, startGives, startLevel } from '../library/spawn';
import { blessedClass, blessingGods } from '../ruleset/blessings';
import { lifeStage, stageName } from '../ruleset/age';
import { blankPersonality, personalityPicker } from './personality';
import { SKILL_NAMES, skillName } from '../library/skillNames';
import { classTree, skillOpen, treeOpen } from '../ruleset/access';
import { h, openPanel, readouts, type Readout } from './kit';
import { preview } from './sheet';
import { SK } from '../library/skillIds';
import { ST } from '../library/startIds';
import { BLESSING_TIERS, CLASS_TIERS } from '../scales';

export { SKILL_NAMES, skillName };
export const SKILL_SUB: Record<string, string> = { [SK.endurance]: 'sets HP', [SK.resolve]: 'sets morale', [SK.stamina]: 'sets stamina', [SK.riposte]: 'adds to Parry', [SK.blade_dance]: 'adds to Dodge' };

/** layout B's tree order and colours */
export const TREE_VIEW: { id: string; c: string }[] = [
  { id: TR.melee, c: 'c10' }, { id: TR.defense, c: 'c1' }, { id: TR.fortitude, c: 'c6' }, { id: TR.armor, c: 'c15' }, { id: TR.swordsman, c: 'c5' },
  { id: TR.perception, c: 'c12' }, { id: TR.ranged, c: 'c7' }, { id: TR.unarmed, c: 'c14' },
  { id: TR.stealth, c: 'c3' }, { id: TR.speech, c: 'c4' }, { id: TR.trickery, c: 'c9' },
];

const STEP = 5;
/** the practice swings behind the "Vs one slime" estimate: the start, and the most and fewest the panel takes */
const SWINGS = { start: 400, min: 50, max: 5000 };

/** The creation screen. Switching the Start swaps the screen inside one wrapper, so the app's
 * reference to this element stays valid and a later redraw never brings back the old Start's screen. */
export function creationScreen(api: GameApi, onStarted: () => void, startId: string = ST.swordsman): HTMLElement {
  const host = h('div', { class: 'creation-host' });
  const show = (id: string) => host.replaceChildren(startScreen(api, onStarted, id, show));
  show(startId);
  return host;
}

/** DX1: what a Start puts on the screen: its class's tier, or the blessing it rolls; and the classes it can begin in */
function startFacts(startId: string): { tier: string; classes: string[]; perks: string[]; blocked: string } {
  const lib = getLibrary(), s = lib.starts[startId], b = s?.blessing;
  const classes = b && !s.classId ? blessingGods(b.tier).map(blessedClass).filter((c): c is string => !!c) : [startGives(startId).classId].filter((c): c is string => !!c);
  const perks = classes.length === 1 ? [...Object.values(lib.classes[classes[0]]?.levelPerks ?? {}).flat(), ...(lib.classes[classes[0]]?.capstone ?? [])].map((p) => lib.perks[p]?.name ?? p) : [];
  return {
    tier: b ? `${BLESSING_TIERS.name(b.tier)} blessing` : classes[0] ? CLASS_TIERS.name(lib.classes[classes[0]].tier) : '',
    classes, perks: b ? [`a random god’s ${BLESSING_TIERS.name(b.tier)} blessing`, ...perks] : perks,
    blocked: b && !blessingGods(b.tier).length ? `no god gives a ${BLESSING_TIERS.name(b.tier)} blessing yet.` : '',
  };
}

// name and gender carry over when the player switches Start
const GENDERS: [Pronouns, string][] = [['he', 'Man'], ['she', 'Woman'], ['they', 'Other']];
const identity: { name: string; pronouns: Pronouns; age?: number } = { name: 'Aldric', pronouns: 'he' }; // age: left out = the start's default (AG15)
const persona = { p: blankPersonality() }; // PL14: carries over too
const world: { id?: string; list: FreeWorld[] } = { list: [] }; // HF31: the free world picked (left out = a new world); carries over too

function startScreen(api: GameApi, onStarted: () => void, startId: string, switchTo: (id: string) => void): HTMLElement {
  const lib = getLibrary();
  const start = lib.starts[startId], facts = startFacts(startId);
  const cls = facts.classes.length === 1 ? lib.classes[facts.classes[0]] : undefined; // a blessed start's class waits for its god
  const floors = classFloors(cls?.id).all; // the class floors plus its unlock conditions
  const who = { core: newPlayer(startId) } as Actor;
  const view = TREE_VIEW.filter((t) => !lib.trees[t.id] || treeOpen(who, t.id)); // TA10: trees a new player can't access are hidden
  const open = view.flatMap((t) => lib.trees[t.id]?.skills ?? []).filter((k) => skillOpen(who, k));
  const st = { v: {} as Record<string, number>, tags: new Set<string>(), swings: SWINGS.start };
  const total = () => creationPoints(startId), cap = () => CONFIG.CREATION_MAX_SKILL, maxTags = () => CONFIG.CREATION_TAGS;
  const reset = () => { open.forEach((k) => (st.v[k] = floors[k] ?? 0)); st.tags.clear(); };
  const recommended = () => { const r = recommendedBuild(startId); reset(); Object.assign(st.v, r.skills); r.tagged.forEach((k) => st.tags.add(k)); };
  const left = () => total() - open.reduce((a, k) => a + st.v[k], 0);
  const build = (): CreationBuild => ({ name: identity.name.trim(), pronouns: identity.pronouns, startId, skills: { ...st.v }, tagged: [...st.tags], personality: structuredClone(persona.p), age: identity.age ?? creationAge(startId) });
  const picker = personalityPicker(persona, () => createPlayer(build(), 'preview', { preview: true }));
  const setVal = (k: string, n: number) => { st.v[k] = Math.max(floors[k] ?? 0, Math.min(cap(), st.v[k] + left(), Math.round(n))); render(); };

  const tilesHost = h('div');
  const how = h('p', { class: 'how', hidden: true });
  const src = h('p', { class: 'subline' });
  const msg = h('p', { class: 'msg', role: 'status' });
  const rows = new Map<string, HTMLElement>();
  const sums = new Map<string, HTMLElement>();

  const groups = h('div', { class: 'groups' }, view.map((t) => {
    const def = lib.trees[t.id];
    const sum = h('span', { class: 'tot hs-num' });
    sums.set(t.id, sum);
    const name = def?.name ?? t.id;
    const sec = h('section', {}, h('div', { class: 'grp-h' }, h('i', { class: 'hs-sq', style: `background:var(--${t.c})` }), h('h2', { class: 'hs-section' }, name),
      classTree(def?.access) ? h('span', { class: 'hs-chip' }, 'Class tree') : null, sum));
    for (const k of (def?.skills ?? []).filter((k) => open.includes(k))) {
      const nm = h('div', { class: 'nm' }, h('b', {}, skillName(k)), SKILL_SUB[k] ? h('small', {}, SKILL_SUB[k]) : null, floors[k] ? h('small', {}, `class floor ${floors[k]}`) : null);
      const range = h('input', { type: 'range', min: '0', max: '100', 'aria-label': skillName(k), oninput: (e: Event) => setVal(k, +(e.target as HTMLInputElement).value) });
      const row = h('div', { class: 'row', 'data-k': k }, nm,
        h('div', { class: 'bar' }, h('div', { class: 'tr' }, h('i', { class: 's' }), h('i', { class: 'f' })),
          h('span', { class: 'tk', style: 'left:50%' }), h('span', { class: 'tk cap', style: `left:${cap()}%` }), range),
        h('div', { class: 'step' },
          h('button', { class: 'hs-icon-btn mi', type: 'button', title: `Lower by ${STEP}`, 'aria-label': `Lower ${skillName(k)}`, onclick: () => setVal(k, st.v[k] - STEP) }, '−'),
          h('span', { class: 'val hs-num' }),
          h('button', { class: 'hs-icon-btn pl', type: 'button', title: `Raise by ${STEP}`, 'aria-label': `Raise ${skillName(k)}`, onclick: () => setVal(k, st.v[k] + STEP) }, '+')),
        h('div', { class: 'tagc', onclick: (e: Event) => {
          const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
          if (!b || b.disabled) return;
          st.tags.has(k) ? st.tags.delete(k) : st.tags.add(k); render();
        } }));
      rows.set(k, row);
      sec.append(row);
    }
    return sec;
  }));

  function editSwings() {
    const inp = h('input', { class: 'hs-input', type: 'number', min: String(SWINGS.min), max: String(SWINGS.max), step: String(SWINGS.min), value: String(st.swings), id: 'swings',
      onchange: (e: Event) => { st.swings = Math.max(SWINGS.min, Math.min(SWINGS.max, +(e.target as HTMLInputElement).value || SWINGS.start)); render(); } });
    openPanel('Estimate', [
      { k: 'Figure', v: 'Vs one slime' },
      { k: 'Source', v: 'The game’s attack rules, run as seeded practice swings: you with your starting weapon (or bare hands) against one slime, and its slam against you with your standing defense.' },
      { k: 'Swings', v: inp, edit: true },
    ], 'More swings give a steadier estimate. Only this screen changes.');
    inp.focus();
  }

  function render() {
    const L = left(), b = build(), p = preview(b, st.swings);
    const dash = (n: number | null, d = 0) => (n === null ? '—' : n.toFixed(d));
    const tiles: Readout[] = [
      { label: 'Points left', value: String(L), unit: `of ${total()}`, sub: L ? 'Spend them all to begin' : 'All spent', tone: L ? 'warn' : 'ok',
        how: `You have ${total()} points for the open skills. No skill goes above ${cap()} at creation, and the class floors are the minimums.` },
      { label: 'HP', value: dash(p.hp), unit: 'HP', sub: `${CONFIG.HP_BASE} + endurance`, how: 'Total HP from the ruleset: the base plus endurance, times the body’s HP multiplier.' },
      { label: 'Attack', value: dash(p.attack), unit: 'skill', sub: p.weapon ? `${p.weapon.skill} · ${p.weapon.name}` : '—',
        how: 'Effective skill of your starting attack: the first weapon in your starting kit, or bare hands when the kit has none (raw skill plus gear).' },
      { label: 'Standing defense', value: dash(p.defense?.value ?? null), unit: p.defense?.kind ?? 'skill',
        sub: p.defense ? (p.guard ? `${p.defense.kind} + ${p.guard}` : p.defense.kind) : 'block, parry or dodge, the highest',
        how: 'The highest of effective block (needs a starting shield), parry (needs a starting melee weapon) and dodge.' },
      { label: 'Vs one slime', value: p.swingsToKill === null ? '—' : '≈ ' + dash(p.swingsToKill, 1), unit: 'swings to kill',
        sub: p.slamsToDown === null ? 'Its slams to down you: —' : `It downs you in about ${Math.round(p.slamsToDown)} slams`,
        how: `Estimated: the slime’s HP (${dash(p.slimeHp)}) over your average damage per swing, from ${st.swings} practice swings with the game’s attack rules.` },
      { label: 'Potential', value: String(CONFIG.POTENTIAL), unit: 'pts',
        sub: `StartingTotal ${open.filter((k) => !st.tags.has(k)).reduce((a, k) => a + st.v[k], 0)} · ${st.tags.size} of ${maxTags()} tagged`,
        how: `Tagged: ${[...st.tags].map(skillName).join(', ') || 'none yet'}. StartingTotal is the sum of your untagged skills when the story starts. Tagged skills ignore Burden.` },
    ];
    tilesHost.replaceChildren(readouts(tiles, how));
    src.replaceChildren('≈ Vs one slime is an estimate from ', h('b', {}, `${st.swings} practice swings`), ' each way with the game’s attack rules · ',
      h('button', { class: 'hs-btn-text', type: 'button', onclick: editSwings, style: 'min-height:0' }, 'Change the estimate'));
    for (const k of open) {
      const row = rows.get(k)!, v = st.v[k], f = floors[k] ?? 0, on = st.tags.has(k);
      row.querySelector('.val')!.textContent = String(v);
      (row.querySelector('input') as HTMLInputElement).value = String(v);
      (row.querySelector('.s') as HTMLElement).style.width = v + '%';
      (row.querySelector('.f') as HTMLElement).style.width = f + '%';
      (row.querySelector('.mi') as HTMLButtonElement).disabled = v <= f;
      (row.querySelector('.pl') as HTMLButtonElement).disabled = v >= cap() || L <= 0;
      row.querySelector('.tagc')!.replaceChildren(on
        ? h('button', { class: 'hs-tg cap', style: '--tg:var(--c15)', title: 'Untag', type: 'button' }, 'Tagged')
        : h('button', { class: 'hs-btn-text', type: 'button', disabled: st.tags.size >= maxTags(), title: st.tags.size >= maxTags() ? `${maxTags()} skills are tagged already` : 'Tag this skill' }, 'Tag'));
    }
    for (const t of view) {
      const ks = (lib.trees[t.id]?.skills ?? []).filter((k) => open.includes(k));
      sums.get(t.id)!.textContent = ks.length ? `${ks.reduce((a, k) => a + st.v[k], 0)} pts` : '';
    }
    picker.refresh(); // the Nerve tier reads Resolve
    msg.textContent = ''; msg.className = 'msg';
  }

  async function go() {
    const L = left(), need = maxTags() - st.tags.size;
    const fail = (t: string) => { msg.textContent = 'Needs attention: ' + t; msg.className = 'msg bad'; };
    if (L > 0) return fail(`spend your last ${L} points first.`);
    if (need > 0) return fail(`tag ${need} more skill${need > 1 ? 's' : ''} first.`);
    const errs = api.validateBuild(build());
    if (errs.length) return fail(errs.join(' '));
    if (blockedWhy(startId)) return fail(blockedWhy(startId));
    msg.textContent = 'Starting the story…'; msg.className = 'msg ok';
    await api.newStory(build(), world.id ? { worldId: world.id } : undefined);
    onStarted();
  }

  recommended();
  render();
  const stopped = api.notices().find((n) => n.kind === 'stop_play');
  const starts = h('div', { class: 'actions', role: 'group', 'aria-label': 'Start' }, Object.values(lib.starts).map((s) =>
    h('button', { class: s.id === startId ? 'hs-btn-main' : 'hs-btn-text', type: 'button', 'aria-pressed': String(s.id === startId), 'data-start': s.id,
      title: [`${creationPoints(s.id)} points, level ${startLevel(s.id)}`, ...startFacts(s.id).perks].join(' · '),
      onclick: () => { if (s.id !== startId) switchTo(s.id); } },
    [s.name, startFacts(s.id).tier, `${creationPoints(s.id)} pts`, `level ${startLevel(s.id)}`].filter(Boolean).join(' · '))));
  /** why this start can't begin: no god gives its blessing (DX1), or no Threadbound item free in the picked world (WP2 b); '' if it can */
  function blockedWhy(id: string): string {
    if (startFacts(id).blocked) return startFacts(id).blocked;
    const w = world.list.find((x) => x.worldId === world.id);
    if (!w || !threadboundStartBlocked(id, w.threadbound)) return '';
    return `no Threadbound item is free in ${w.name}: ${w.threadbound.map((t) => lib.items[t]?.name ?? t).join(', ')} ${w.threadbound.length > 1 ? 'lie' : 'lies'} there already.`;
  }
  const worldNote = h('p', { class: 'hs-note', hidden: true });
  function paintStarts(): void {
    starts.querySelectorAll<HTMLButtonElement>('[data-start]').forEach((b) => { const why = blockedWhy(b.dataset.start!); b.disabled = !!why; if (why) b.title = `${startFacts(b.dataset.start!).blocked ? 'Not yet' : 'Not in this world'}: ${why}`; });
    const why = blockedWhy(startId);
    worldNote.hidden = !why;
    worldNote.textContent = !why ? '' : facts.blocked ? `This start can’t begin yet: ${why} Pick another start.` : `This start can’t begin here: ${why} Pick another start or world.`;
  }
  /** HF31: every free world (no one lives in it) and "New world"; shown only when there is a world to carry on. WP5: the
   * picked world can be retitled */
  function worldRow(): HTMLElement {
    const row = h('div', { class: 'actions', role: 'group', 'aria-label': 'World', hidden: true });
    const lived = (w: FreeWorld) => w.past.map((p) => `${p.name} ${p.fell ? 'fell' : 'left'}`).join(', ');
    function paint(renaming = false): void {
      const ws = world.list;
      if (!ws.some((w) => w.worldId === world.id)) world.id = undefined;
      row.hidden = !ws.length;
      const btn = (id: string | undefined, text: string, title: string) => h('button', { class: world.id === id ? 'hs-btn-main' : 'hs-btn-text', type: 'button', 'aria-pressed': String(world.id === id), title,
        onclick: () => { world.id = id; paint(); paintStarts(); } }, text);
      const picked = ws.find((w) => w.worldId === world.id);
      const input = h('input', { class: 'hs-input', type: 'text', maxLength: CONFIG.WORLD_TITLE_CAP, value: picked?.name ?? '', 'aria-label': 'World title', autocomplete: 'off' }) as HTMLInputElement;
      const save = async () => { await api.titleWorld(picked!.worldId, input.value).catch(() => {}); world.list = await api.worlds().catch(() => world.list); paint(); paintStarts(); };
      row.replaceChildren(h('span', { class: 'hs-label' }, 'World'),
        btn(undefined, 'New world', 'A world no one has lived in, starting the day after the furthest day any world has reached'),
        ...ws.map((w) => btn(w.worldId, `${w.name} · day ${w.day} · ${lived(w)}`,
          'Carry on in this world: its places, people and everything left lying about are as they were, and its date jumps to the Universe date')),
        ...(!picked ? [] : renaming
          ? [input, h('button', { class: 'hs-btn-text', type: 'button', onclick: save }, 'Save title'), h('button', { class: 'hs-btn-text', type: 'button', onclick: () => paint() }, 'Cancel')]
          : [h('button', { class: 'hs-btn-text', type: 'button', title: 'Give this world a title of your own (leave it empty for the default)', onclick: () => paint(true) }, 'Rename')]));
      if (renaming) input.focus();
    }
    void api.worlds().then((ws) => { world.list = ws; paint(); paintStarts(); }).catch(() => {});
    return row;
  }
  function whoRow(): HTMLElement {
    const gender = h('div', { class: 'hs-picker', role: 'group', 'aria-label': 'Gender' }, GENDERS.map(([p, label]) =>
      h('button', { type: 'button', 'aria-pressed': String(identity.pronouns === p), title: `Others speak of you as “${p}”`,
        onclick: (e: Event) => { identity.pronouns = p; (e.currentTarget as HTMLElement).parentElement!.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, label)));
    return h('div', { class: 'who-row' },
      h('label', { class: 'hs-label' }, 'Name ', h('input', { class: 'hs-input', type: 'text', maxLength: CONFIG.NAME_CAP, value: identity.name, 'aria-label': 'Name', autocomplete: 'off',
        oninput: (e: Event) => { identity.name = (e.target as HTMLInputElement).value; } })),
      h('span', { class: 'hs-label' }, 'Gender'), gender, ageField());
  }
  /** AG15: whole years from the race's Youth start to its Venerable start, with the life stage it gives */
  function ageField(): HTMLElement | null {
    const raceId = who.core.raceId, range = creationAgeRange(raceId);
    if (!range) return null;
    const word = (n: number) => { const s = lifeStage(raceId, n); return s ? stageName(s) : ''; };
    const stage = h('span', { class: 'hs-note' }, word(identity.age ?? creationAge(startId)));
    return h('label', { class: 'hs-label' }, 'Age ', h('input', { class: 'hs-input', type: 'number', min: range.min, max: range.max, step: 1, value: identity.age ?? creationAge(startId), 'aria-label': 'Age', style: 'width:5em',
      oninput: (e: Event) => { const n = Math.round(Number((e.target as HTMLInputElement).value)); if (Number.isFinite(n)) { identity.age = Math.max(range.min, Math.min(range.max, n)); stage.textContent = word(identity.age); } } }), ' ', stage);
  }
  const root = h('main', {},
    stopped ? h('div', { class: 'hs-hl bad', role: 'status' }, h('span', { class: 'hs-hl-b', 'data-kind': 'Play stopped' }, stopped.text)) : null,
    h('div', { class: 'head' },
      h('div', {}, h('h1', {}, `Create your ${(!start?.blessing && cls?.name) || 'character'}`), whoRow(), starts, worldRow(), worldNote,
        start?.story ?? cls?.story ? h('p', { class: 'story-line' }, start?.story ?? cls?.story) : null,
        start?.blessing ? h('p', {}, `You begin with ${facts.perks[0]}, in that god’s Blessed class${facts.classes.length ? `: ${facts.classes.map((c) => `${lib.classes[c].name} (${CLASS_TIERS.name(lib.classes[c].tier)})`).join(' or ')}` : ''}.`)
          : facts.perks.length ? h('p', {}, `Class perk at level 1: ${facts.perks.join(', ')}.`) : null,
        h('p', {}, 'Spend ', h('b', {}, String(total())), ` points. Your class sets floors, no skill starts above ${cap()}, and you tag ${maxTags()} skills.`)),
      h('div', { class: 'actions' },
        h('button', { class: 'hs-btn-text', type: 'button', onclick: () => { recommended(); render(); } }, 'Use recommended build'),
        h('button', { class: 'hs-btn-text', type: 'button', onclick: () => { reset(); render(); } }, 'Reset'),
        h('button', { class: 'hs-btn-main', type: 'button', id: 'btn-go', onclick: go, disabled: !!stopped, title: stopped ? 'The story can’t start until Claude and the save database are available' : null }, 'Begin the story'))),
    h('div', { class: 'sec' }, tilesHost, src, how),
    msg, groups,
    h('div', { class: 'key', 'aria-label': 'Colour key' },
      h('span', {}, h('i', { class: 'sw', style: 'background:var(--accent)' }), 'Points you spent'),
      h('span', {}, h('i', { class: 'sw', style: 'background:var(--faint)' }), 'Class floor'),
      h('span', {}, h('i', { class: 'tick' }), '50 = average fighter'),
      h('span', {}, h('i', { class: 'tick cap' }), `Creation cap ${cap()}`),
      h('span', {}, h('span', { class: 'hs-tg cap', style: '--tg:var(--c15)' }, 'Tagged'), ' tagged skill'),
      h('span', {}, h('i', { class: 'hs-sq', style: 'background:var(--c5)' }), 'Class tree')),
    picker.el,
    h('div', { class: 'hs-hl ask ph' }, h('span', { class: 'hs-hl-b', 'data-kind': 'Placeholders' },
      `${total()} points, cap ${cap()}, floors medium weapons ${floors[SK.melee_medium] ?? 0} and block ${floors[SK.block] ?? 0}, ${maxTags()} tags, Potential fixed at ${CONFIG.POTENTIAL}. `
      + `Figures use the starting kit this build gets. Odds use the game’s attack rules against the library’s slime.`)));
  return root;
}
