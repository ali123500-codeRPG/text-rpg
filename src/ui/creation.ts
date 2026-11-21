// Creation screen (Part 4 §4, approved layout B: tree grid). Point-buy over the open skills.
import { TR } from '../library/treeIds';
import type { Actor, CreationBuild, GameApi, Pronouns } from '../types';
import type { FreeWorld } from '../save';
import { threadboundStartBlocked } from '../ruleset/threadboundItems';
import { CONFIG } from '../config';
import { burdenTotal } from '../ruleset/burdenTotal';
import { getLibrary } from '../library';
import { classFloors, classlessStart, creationCap, startRaw, defaultClass, createPlayer, playableRaces, raceStartBlock, randomIdentity, creationAge, creationAgeRange, creationPoints, buildState, newPlayer, recommendedBuild, startGives, startLevel, classMaxLevel, classPerks } from '../library/spawn';
import { perkButton } from './perks';
import { blessedClass, blessingGods } from '../ruleset/blessings';
import { lifeStage, stageName } from '../ruleset/age';
import { personalityPicker } from './personality';
import { createRng } from '../rng';
import { SKILL_NAMES, skillName } from '../library/skillNames';
import { classTree, skillOpen, treeOpen } from '../ruleset/access';
import { h, openPanel } from './kit';
import { ICONS, skillMark, startIcon, treeIcon, type IconName } from './itemIcons';
import { preview } from './sheet';
import { DEFENSE_SKILL, SK } from '../library/skillIds';
import { ST } from '../library/startIds';
import { CLASS_TIERS } from '../scales';

export { SKILL_NAMES, skillName };
/** an icon from ICONS as a mark, its meaning in its tip and its accessible name */
export function markIcon(name: IconName, label: string, cls = 'mk-i'): HTMLElement {
  const el = h('span', { class: cls, role: 'img', title: label, 'aria-label': label });
  el.innerHTML = ICONS[name];
  return el;
}
/** the GM debug view is on (the rail's GM switch, src/ui/app.ts) */
export const gmView = (): boolean => { try { return localStorage.getItem('rpg.gmDebug') === '1'; } catch { return false; } };
export const SKILL_SUB: Record<string, string> = { [SK.endurance]: 'sets HP', [SK.resolve]: 'sets morale', [SK.stamina]: 'sets stamina', [SK.riposte]: 'adds to Parry', [SK.blade_dance]: 'adds to Dodge' };

/** layout B's tree order and colours */
export const TREE_VIEW: { id: string; c: string }[] = [
  { id: TR.melee, c: 'c10' }, { id: TR.defense, c: 'c1' }, { id: TR.fortitude, c: 'c6' }, { id: TR.armor, c: 'c15' }, { id: TR.swordsman, c: 'c5' },
  { id: TR.perception, c: 'c12' }, { id: TR.ranged, c: 'c7' }, { id: TR.unarmed, c: 'c14' },
  { id: TR.stealth, c: 'c3' }, { id: TR.speech, c: 'c4' }, { id: TR.trickery, c: 'c9' },
];

const STEP = 5;
/** Ctrl+click (Cmd+click on a Mac) on Raise or Lower moves the skill by 1 instead of STEP */
const stepOf = (e: MouseEvent) => (e.ctrlKey || e.metaKey ? 1 : STEP);
/** the practice swings behind the "Vs one slime" estimate: the start, and the most and fewest the panel takes */
const SWINGS = { start: 400, min: 50, max: 5000 };

/** The creation screen. Switching the Start swaps the screen inside one wrapper, so the app's
 * reference to this element stays valid and a later redraw never brings back the old Start's screen. */
export function creationScreen(api: GameApi, onStarted: () => void, startId: string = Object.keys(getLibrary().starts)[0] ?? ST.late_bloomer): HTMLElement {
  const host = h('div', { class: 'creation-host' });
  // CC8: a start whose class the picked race can't learn (a Slime can't hold a sword) gives way to the first one it can begin
  const fits = (id: string) => !raceStartBlock(id, identity.raceId);
  const show = (id: string) => host.replaceChildren(startScreen(api, onStarted, fits(id) ? id : Object.keys(getLibrary().starts).find(fits) ?? id, show));
  show(startId);
  return host;
}

/** DX1: what a Start puts on the screen: its class's tier, or the blessing it rolls; and the classes it can begin in */
function startFacts(startId: string): { tier: string; classes: string[]; perks: string[]; byLevel: [number, string[]][]; blocked: string } {
  const lib = getLibrary(), s = lib.starts[startId], b = s?.blessing;
  const classes = b && !s.classId ? blessingGods(b.tier).map(blessedClass).filter((c): c is string => !!c) : [startGives(startId).classId].filter((c): c is string => !!c);
  // the class's perks by the level that grants them, its capstone at its top level (classPerks)
  const byLevel: [number, string[]][] = classes.length !== 1 ? [] : Array.from({ length: classMaxLevel(classes[0]) }, (_, i) => [i + 1, classPerks(classes[0], i, i + 1).map((o) => o.perkId)] as [number, string[]]).filter(([, ids]) => ids.length);
  const perks = byLevel.flatMap(([, ids]) => ids).map((p) => lib.perks[p]?.name ?? p);
  return {
    // the card shows the class tier for every start; a blessing's tier is a game-side number and stays off the screen
    tier: classes[0] ? CLASS_TIERS.name(lib.classes[classes[0]].tier) : classlessStart(startId) ? 'no class' : '',
    classes, perks: b ? ['a random god’s blessing', ...perks] : perks, byLevel,
    blocked: b && !blessingGods(b.tier).length ? 'no god gives this blessing yet.' : '',
  };
}

// name and gender carry over when the player switches Start
const GENDERS: [Pronouns, string][] = [['he', 'Man'], ['she', 'Woman'], ['they', 'Other']];
// a new character opens on a random name, gender, age and personality, all editable; Random picks again
const roll = () => randomIdentity(createRng(Math.floor(Math.random() * 2 ** 31) || 1));
const first = roll();
const identity: { name: string; pronouns: Pronouns; raceId: string; age?: number } = { name: first.name, pronouns: first.pronouns, raceId: first.raceId, age: first.age }; // age: left out = the start's default (AG15)
const persona = { p: first.personality }; // PL14: carries over too
const world: { id?: string; list: FreeWorld[] } = { list: [] }; // HF31: the free world picked (left out = a new world); carries over too
const kept: { b?: Pick<CreationBuild, 'startId' | 'skills' | 'tagged' | 'flawed'> } = {}; // BG-264: the skill points carry over a race change

function startScreen(api: GameApi, onStarted: () => void, startId: string, switchTo: (id: string) => void): HTMLElement {
  const lib = getLibrary();
  const start = lib.starts[startId], facts = startFacts(startId);
  const cls = facts.classes.length === 1 ? lib.classes[facts.classes[0]] : undefined; // a blessed start's class waits for its god
  const floors = classFloors(cls?.id).all; // the class floors plus its unlock conditions
  const who = { core: newPlayer(startId, undefined, identity.raceId) } as Actor; // CC7 a: tree access reads the race too
  const view = TREE_VIEW.filter((t) => !lib.trees[t.id] || treeOpen(who, t.id)); // TA10: trees a new player can't access are hidden
  const open = view.flatMap((t) => lib.trees[t.id]?.skills ?? []).filter((k) => skillOpen(who, k));
  const st = { v: {} as Record<string, number>, tags: new Set<string>(), flaws: new Set<string>(), swings: SWINGS.start };
  const total = () => creationPoints(startId), cap = (k?: string) => creationCap(!!k && st.tags.has(k), !!k && st.flaws.has(k));
  const maxTags = () => CONFIG.CREATION_TAGS, maxFlaws = () => CONFIG.CREATION_FLAWS;
  // A6: Reset and the recommended build replace the build in one click, so they don't ask: the build before is kept for Undo
  let before: { v: Record<string, number>; tags: string[]; flaws: string[] } | null = null;
  const undoBtn = h('button', { class: 'hs-btn-text', type: 'button', 'data-act': 'undo', hidden: true, title: 'Back to the build before', onclick: () => { undo(); render(); } }, 'Undo');
  const buildKey = () => JSON.stringify([st.v, [...st.tags], [...st.flaws]]);
  let afterKey = ''; // the build the Reset made: any other change after it ends the Undo
  const snap = () => { before = { v: { ...st.v }, tags: [...st.tags], flaws: [...st.flaws] }; undoBtn.hidden = false; };
  const undo = () => { if (!before) return; st.v = { ...before.v }; st.tags = new Set(before.tags); st.flaws = new Set(before.flaws); before = null; undoBtn.hidden = true; };
  const reset = () => { open.forEach((k) => (st.v[k] = floors[k] ?? 0)); st.tags.clear(); st.flaws.clear(); };
  const recommended = () => { const r = recommendedBuild(startId, identity.raceId); reset(); Object.assign(st.v, r.skills); r.tagged.forEach((k) => st.tags.add(k)); r.flawed.forEach((k) => st.flaws.add(k)); };
  const left = () => total() - open.reduce((a, k) => a + st.v[k], 0);
  const build = (): CreationBuild => ({ name: identity.name.trim(), pronouns: identity.pronouns, startId, skills: { ...st.v }, tagged: [...st.tags], flawed: [...st.flaws], personality: structuredClone(persona.p), age: identity.age ?? creationAge(startId), raceId: identity.raceId });
  const picker = personalityPicker(persona, () => createPlayer(build(), 'preview', { preview: true }));
  const keep = () => { kept.b = { startId, skills: { ...st.v }, tagged: [...st.tags], flawed: [...st.flaws] }; };
  const setVal = (k: string, n: number) => { st.v[k] = Math.max(floors[k] ?? 0, Math.min(cap(k), st.v[k] + left(), Math.round(n))); render(); };

  const figs = h('div', { class: 'bb-figs' }); // the build bar's figures, redrawn by render()
  const msg = h('p', { class: 'msg', role: 'status' });
  const rows = new Map<string, HTMLElement>();
  const sums = new Map<string, HTMLElement>();

  const groups = h('div', { class: 'groups' }, view.map((t) => {
    const def = lib.trees[t.id];
    const sum = h('span', { class: 'tot hs-num' });
    sums.set(t.id, sum);
    const name = def?.name ?? t.id;
    const sec = h('section', { style: `--t:var(--${t.c})` }, h('div', { class: 'grp-h' }, h('h2', { class: 'hs-section' }, treeIcon(t.id, name) ?? name),
      classTree(def?.access) ? h('span', { class: 'hs-chip' }, 'Class tree') : null, sum));
    for (const k of (def?.skills ?? []).filter((k) => open.includes(k))) {
      // the tag and flaw toggles sit right after the name: dim until set, then lit
      const tg = (act: 'tag' | 'flaw') => { const b = h('button', { class: `tg-btn tg-${act}`, type: 'button', 'data-act': act, 'aria-pressed': 'false' }); b.innerHTML = ICONS[act === 'flaw' ? 'flawed' : 'tagged']; return b; };
      const marks = h('span', { class: 'tagc', onclick: (e: Event) => {
        const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
        if (!b || b.disabled) return;
        const fit = () => { st.v[k] = Math.max(floors[k] ?? 0, Math.min(st.v[k], cap(k))); }; // untagged or flawed: back down to its cap
        if (b.dataset.act === 'flaw') { if (st.flaws.has(k)) st.flaws.delete(k); else { st.flaws.add(k); fit(); } }
        else if (st.tags.has(k)) { st.tags.delete(k); fit(); } else st.tags.add(k);
        render();
      } }, tg('tag'), tg('flaw'));
      const nm = h('div', { class: 'nm' }, h('span', { class: 'nm-l' }, skillMark(k, skillName(k) + (SKILL_SUB[k] ? ` · ${SKILL_SUB[k]}` : '')), marks),
        floors[k] ? h('small', {}, `class floor ${floors[k]}`) : null);
      const range = h('input', { type: 'range', min: '0', max: '100', 'aria-label': skillName(k), oninput: (e: Event) => setVal(k, +(e.target as HTMLInputElement).value - (st.tags.has(k) ? CONFIG.CREATION_TAG_BONUS : 0)) });
      const row = h('div', { class: 'row', 'data-k': k }, nm,
        h('div', { class: 'bar' }, h('div', { class: 'tr' }, h('i', { class: 's' }), h('i', { class: 'f' })),
          h('span', { class: 'tk', style: 'left:50%' }), h('span', { class: 'tk cap', style: `left:${cap(k)}%` }), range),
        h('div', { class: 'step' },
          h('button', { class: 'hs-icon-btn mi', type: 'button', title: `Lower by ${STEP} (Ctrl+click: by 1)`, 'aria-label': `Lower ${skillName(k)}`, onclick: (e: MouseEvent) => setVal(k, st.v[k] - stepOf(e)) }, '−'),
          h('span', { class: 'val hs-num' }),
          h('button', { class: 'hs-icon-btn pl', type: 'button', title: `Raise by ${STEP} (Ctrl+click: by 1)`, 'aria-label': `Raise ${skillName(k)}`, onclick: (e: MouseEvent) => setVal(k, st.v[k] + stepOf(e)) }, '+')));
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
      { k: 'Swings', v: inp, picked: true },
    ], 'More swings give a steadier estimate. Only this screen changes.');
    inp.focus();
  }

  function render() {
    if (before && buildKey() !== afterKey) { before = null; undoBtn.hidden = true; }
    const L = left(), b = build(), p = preview(b, st.swings);
    const dash = (n: number | null, d = 0) => (n === null ? '—' : n.toFixed(d));
    // the build bar: what is left to spend, then what the build does; every word is in a figure's tip (show, don't tell)
    const icon = (name: IconName) => { const el = h('span', { class: 'mk-i', 'aria-hidden': 'true' }); el.innerHTML = ICONS[name]; return el; };
    const fig = (cls: string, tip: string, ...kids: (Node | string | null)[]) => h('span', { class: cls, role: 'img', title: tip, 'aria-label': tip }, ...kids);
    const pips = (n: number, of: number, name: IconName, cls: string, tip: string) =>
      fig('bb-pips', tip, ...Array.from({ length: of }, (_, i) => { const el = icon(name); el.classList.add(i < n ? cls : 'off'); return el; }));
    const startTotal = +burdenTotal(Object.fromEntries(open.map((k) => [k, { raw: startRaw(b, k), state: buildState(b, k) }]))).toFixed(2);
    const names = (s: Set<string>) => [...s].map(skillName).join(', ') || 'none yet';
    const defIcon = (() => { // the defense that wins shows as its own skill's icon; its name is in the tip
      if (!p.defense) return icon('fig_defense');
      const el = skillMark(DEFENSE_SKILL[p.defense.kind]); ['title', 'role', 'aria-label'].forEach((a) => el.removeAttribute(a)); el.setAttribute('aria-hidden', 'true');
      return el;
    })();
    const slime = `≈ an estimate from ${st.swings} practice swings each way with the game’s attack rules: the slime’s HP (${dash(p.slimeHp)}) over your average damage per swing, and its slam’s average damage against your HP.`;
    figs.replaceChildren(
      fig(`bb-pts ${L ? 'warn' : 'ok'}`, `${L} of ${total()} points left. Spend ${total()} points. Your class sets floors, an untagged skill starts at most ${CONFIG.CREATION_MAX_UNTAGGED}, a tagged one ${CONFIG.CREATION_MAX_TAGGED} (its tag adds ${CONFIG.CREATION_TAG_BONUS} on top) and a flawed one ${CONFIG.CREATION_MAX_FLAWED}. Starting total ${startTotal} of Potential ${CONFIG.POTENTIAL}: the sum of your skills when the story starts, each tag taking ${CONFIG.TAG_BURDEN_GROUP_PCT}% off every skill in its group (a lone tag counts 0) and each flaw adding ${CONFIG.FLAW_BURDEN_GROUP_PCT}% to every skill in its group.`,
        h('b', {}, String(L)), h('small', {}, `of ${total()} left`), h('span', { class: 'bb-meter' }, h('i', { style: `width:${((total() - L) / total()) * 100}%` }))),
      pips(st.tags.size, maxTags(), 'tagged', 'tag', `${st.tags.size} of ${maxTags()} tagged: ${names(st.tags)}. Tagged skills ignore Burden.`),
      pips(st.flaws.size, maxFlaws(), 'flawed', 'flaw', `${st.flaws.size} of ${maxFlaws()} flawed: ${names(st.flaws)}. A flawed skill learns slower and stops at ${CONFIG.SKILL_CAP - CONFIG.FLAW_CAP_PENALTY}.`),
      h('span', { class: 'bb-sep' }),
      fig('bb-fig', `HP ${dash(p.hp)}: the base ${CONFIG.HP_BASE} plus endurance, times the body’s HP multiplier`, h('b', {}, dash(p.hp)), h('small', {}, 'HP')),
      fig('bb-fig', `Standing attack ${dash(p.attack)}${p.weapon ? ` · ${p.weapon.skill} · ${p.weapon.name}` : ''}: the effective skill of your starting weapon, or bare hands when the kit has none (raw skill plus gear)`, icon('fig_attack'), h('b', {}, dash(p.attack))),
      fig('bb-fig', `Standing defense ${dash(p.defense?.value ?? null)} · ${p.defense ? (p.guard ? `${p.defense.kind} + ${p.guard}` : p.defense.kind) : 'none'}: the highest of effective block (needs a starting shield), parry (needs a starting melee weapon) and dodge`, defIcon, h('b', {}, dash(p.defense?.value ?? null))),
      h('span', { class: 'bb-sep' }),
      // HS6: the estimate's input is set from the estimate itself
      h('button', { class: 'hs-btn-text bb-duel', type: 'button', title: slime, onclick: editSwings,
        'aria-label': `Vs one slime: about ${dash(p.swingsToKill, 1)} swings to kill it, about ${dash(p.slamsToDown)} of its slams to down you. Change the estimate` },
        icon('slime'), h('b', {}, p.swingsToKill === null ? '—' : '≈ ' + dash(p.swingsToKill, 1)), h('small', {}, 'swings'),
        h('span', { class: 'vs' }, ':'), h('b', {}, p.slamsToDown === null ? '—' : '≈ ' + dash(p.slamsToDown)), h('small', {}, 'its slams')));
    for (const k of open) {
      const row = rows.get(k)!, v = st.v[k], f = floors[k] ?? 0, on = st.tags.has(k), bad = st.flaws.has(k);
      const add = on ? CONFIG.CREATION_TAG_BONUS : 0; // YB1: a tag's +10 shows like any point added; its points are in the tip
      const sv = row.querySelector<HTMLElement>('.val')!;
      sv.textContent = String(v + add); sv.title = add ? `${v} points + ${add} for the tag` : '';
      (row.querySelector('input') as HTMLInputElement).value = String(v + add);
      (row.querySelector('.s') as HTMLElement).style.width = v + add + '%';
      (row.querySelector('.f') as HTMLElement).style.width = f + add + '%';
      (row.querySelector('.mi') as HTMLButtonElement).disabled = v <= f;
      (row.querySelector('.pl') as HTMLButtonElement).disabled = v >= cap(k) || L <= 0;
      (row.querySelector('.tk.cap') as HTMLElement).style.left = cap(k) + add + '%'; // a tagged skill's cap is higher, a flawed one's lower
      row.classList.toggle('flawed', bad);
      const noTag = bad ? 'A flawed skill can’t be tagged' : st.tags.size >= maxTags() ? `${maxTags()} skills are tagged already` : '';
      const noFlaw = on ? 'A tagged skill can’t be flawed' : st.flaws.size >= maxFlaws() ? `${maxFlaws()} skills are flawed already` : f > CONFIG.CREATION_MAX_FLAWED ? `Its class floor is above ${CONFIG.CREATION_MAX_FLAWED}` : '';
      // a set one is lit; the other one steps out of sight (it keeps its place, so nothing moves)
      const toggle = (b: HTMLButtonElement, set: boolean, word: string, unword: string, no: string, other: boolean) => {
        b.setAttribute('aria-pressed', String(set)); b.disabled = !set && !!no; b.classList.toggle('away', other);
        b.title = set ? unword : no || word; b.setAttribute('aria-label', `${set ? unword : word} ${skillName(k)}`);
      };
      const tb = row.querySelectorAll<HTMLButtonElement>('.tg-btn');
      toggle(tb[0], on, 'Tag', 'Untag', noTag, bad);
      toggle(tb[1], bad, 'Flaw', 'Remove flaw', noFlaw, on);
    }
    for (const t of view) {
      const ks = (lib.trees[t.id]?.skills ?? []).filter((k) => open.includes(k));
      sums.get(t.id)!.textContent = ks.length ? `${ks.reduce((a, k) => a + st.v[k], 0)} pts` : '';
    }
    picker.refresh(); // the Nerve tier reads Resolve
    msg.textContent = ''; msg.className = 'msg';
  }

  async function go() {
    const L = left(), need = maxTags() - st.tags.size, needF = maxFlaws() - st.flaws.size;
    const fail = (t: string) => { msg.textContent = 'Needs attention: ' + t; msg.className = 'msg bad'; };
    if (L > 0) return fail(`spend your last ${L} points first.`);
    if (need > 0) return fail(`tag ${need} more skill${need > 1 ? 's' : ''} first.`);
    if (needF > 0) return fail(`flaw ${needF} more skill${needF > 1 ? 's' : ''} first.`);
    const errs = api.validateBuild(build());
    if (errs.length) return fail(errs.join(' '));
    if (blockedWhy(startId)) return fail(blockedWhy(startId));
    msg.textContent = 'Starting the story…'; msg.className = 'msg ok';
    await api.newStory(build(), world.id ? { worldId: world.id } : undefined);
    onStarted();
  }

  const carry = kept.b?.startId === startId ? kept.b : undefined; kept.b = undefined;
  if (carry) { // skills the new race can't open drop; their points come back to spend
    reset();
    for (const k of open) if (carry.tagged.includes(k) && st.tags.size < maxTags()) st.tags.add(k);
    for (const k of open) if (carry.flawed.includes(k) && st.flaws.size < maxFlaws()) st.flaws.add(k);
    for (const k of open) if (k in carry.skills) st.v[k] = Math.max(floors[k] ?? 0, Math.min(cap(k), carry.skills[k]));
  } else recommended();
  render();
  const stopped = api.notices().find((n) => n.kind === 'stop_play');
  const starts = h('div', { class: 'actions', role: 'group', 'aria-label': 'Start' }, Object.values(lib.starts).map((s) =>
    h('button', { class: s.id === startId ? 'hs-btn-main' : 'hs-btn-text', type: 'button', 'aria-pressed': String(s.id === startId), 'data-start': s.id,
      title: [startFacts(s.id).tier, `${creationPoints(s.id)} points, level ${startLevel(s.id)}`, ...startFacts(s.id).perks].filter(Boolean).join(' · '),
      onclick: () => { if (s.id !== startId) switchTo(s.id); } }, startIcon(s, s.name),
    // the icon's colour shows the class tier, so its name is only in the tip; "no class" has no colour and stays
    [classlessStart(s.id) ? startFacts(s.id).tier : '', `${creationPoints(s.id)} pts`, `level ${startLevel(s.id)}`].filter(Boolean).join(' · '))));
  /** why this start can't begin: no god gives its blessing (DX1), or no Threadbound item free in the picked world (WP2 b); '' if it can */
  function blockedWhy(id: string): string {
    if (startFacts(id).blocked) return startFacts(id).blocked;
    if (raceStartBlock(id, identity.raceId)) return raceStartBlock(id, identity.raceId);
    const w = world.list.find((x) => x.worldId === world.id);
    if (!w || !threadboundStartBlocked(id, w.threadbound)) return '';
    return `no Threadbound item is free in ${w.name}: ${w.threadbound.map((t) => lib.items[t]?.name ?? t).join(', ')} ${w.threadbound.length > 1 ? 'lie' : 'lies'} there already.`;
  }
  const worldNote = h('p', { class: 'hs-note', hidden: true });
  function paintStarts(): void {
    starts.querySelectorAll<HTMLButtonElement>('[data-start]').forEach((b) => { const why = blockedWhy(b.dataset.start!); b.disabled = !!why; if (why) b.title = `${startFacts(b.dataset.start!).blocked ? 'Not yet' : raceStartBlock(b.dataset.start!, identity.raceId) ? 'Not for this race' : 'Not in this world'}: ${why}`; });
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
    // CC7 a: the playable races; picking one rolls an age in its range and builds the screen again (its trees and ages)
    const race = h('div', { class: 'hs-picker', role: 'group', 'aria-label': 'Race' }, playableRaces().map((id) =>
      h('button', { type: 'button', 'aria-pressed': String(identity.raceId === id), title: lib.races?.[id]?.name ?? id,
        onclick: () => { if (id === identity.raceId) return; identity.raceId = id; identity.age = randomIdentity(createRng(Math.floor(Math.random() * 2 ** 31) || 1), id).age; keep(); switchTo(startId); } },
      lib.races?.[id]?.name ?? id)));
    const row: HTMLElement = h('div', { class: 'who-row' },
      h('label', { class: 'hs-label' }, 'Name ', h('input', { class: 'hs-input', type: 'text', maxLength: CONFIG.NAME_CAP, value: identity.name, 'aria-label': 'Name', autocomplete: 'off',
        oninput: (e: Event) => { identity.name = (e.target as HTMLInputElement).value; } })),
      h('span', { class: 'hs-label' }, 'Race'), race, h('span', { class: 'hs-label' }, 'Gender'), gender, ageField(),
      h('button', { class: 'hs-btn-text', type: 'button', title: 'Pick a new random race, name, gender, age and personality', onclick: () => {
        const r = roll(), same = r.raceId === identity.raceId;
        Object.assign(identity, { name: r.name, pronouns: r.pronouns, raceId: r.raceId, age: r.age }); persona.p = r.personality;
        if (!same) { keep(); return switchTo(startId); } // a new race can open other trees and ages: the screen is built again
        row.replaceWith(whoRow()); picker.refresh(); // the skill points stay as they are
      } }, 'Random'));
    return row;
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
          : classlessStart(startId) ? h('p', {}, `You begin with no class, at level 0. ${lib.classes[defaultClass() ?? '']?.name ?? 'The default class'} is open to pick, and your levels wait until you pick a class.`)
          : facts.byLevel.length ? h('p', {}, facts.byLevel.flatMap(([n, ids], i) => [i ? ' ' : '',
            `${n === classMaxLevel(facts.classes[0]) ? 'Capstone' : 'Class perk'} at level ${n}: `, ...ids.flatMap((id, j) => [j ? ', ' : '', perkButton(id)]), '.'])) : null),
      h('div', { class: 'actions' },
        h('button', { class: 'hs-btn-text', type: 'button', onclick: () => { snap(); recommended(); afterKey = buildKey(); render(); } }, 'Use recommended build'),
        h('button', { class: 'hs-btn-text', type: 'button', onclick: () => { snap(); reset(); afterKey = buildKey(); render(); } }, 'Reset'),
        undoBtn)),
    // the build bar stays in view while the points are spent, with the button they gate
    h('div', { class: 'build-bar' }, figs, msg,
      h('button', { class: 'hs-btn-main', type: 'button', id: 'btn-go', onclick: go, disabled: !!stopped, title: stopped ? 'The story can’t start until Claude and the save database are available' : null }, 'Begin the story')),
    groups,
    h('div', { class: 'key', 'aria-label': 'Colour key' },
      h('span', {}, h('i', { class: 'sw', style: 'background:var(--accent)' }), 'Points you spent'),
      h('span', {}, h('i', { class: 'sw', style: 'background:var(--faint)' }), 'Class floor'),
      h('span', {}, h('i', { class: 'tick' }), '50 = average fighter'),
      h('span', {}, h('i', { class: 'tick cap' }), `Creation cap ${CONFIG.CREATION_MAX_UNTAGGED}, tagged ${CONFIG.CREATION_MAX_TAGGED}, flawed ${CONFIG.CREATION_MAX_FLAWED}`),
      h('span', {}, markIcon('tagged', 'Tagged', 'mk-i tag'), 'Tagged skill'),
      h('span', {}, markIcon('flawed', 'Flawed', 'mk-i flaw'), 'Flawed skill'),
      h('span', {}, h('i', { class: 'hs-sq', style: 'background:var(--c5)' }), 'Class tree')),
    picker.el,
    !gmView() ? null : h('div', { class: 'hs-hl ask ph' }, h('span', { class: 'hs-hl-b', 'data-kind': 'Placeholders' },
      `${total()} points, cap ${CONFIG.CREATION_MAX_UNTAGGED} (tagged ${CONFIG.CREATION_MAX_TAGGED}, flawed ${CONFIG.CREATION_MAX_FLAWED}), floors medium weapons ${floors[SK.melee_medium] ?? 0} and block ${floors[SK.block] ?? 0}, ${maxTags()} tags, ${maxFlaws()} flaws, Potential fixed at ${CONFIG.POTENTIAL}. `
      + `Figures use the starting kit this build gets. Odds use the game’s attack rules against the library’s slime.`)));
  return root;
}
