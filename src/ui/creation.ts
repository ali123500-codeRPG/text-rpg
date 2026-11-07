// Creation screen (Part 4 §4, approved layout B: tree grid). Point-buy over the open skills.
import type { CreationBuild, GameApi } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { h, openPanel, readouts, type Readout } from './kit';
import { preview } from './sheet';

export const SKILL_NAMES: Record<string, string> = {
  melee_light: 'Light weapons', melee_medium: 'Medium weapons', melee_heavy: 'Heavy weapons',
  ranged_light: 'Light ranged', ranged_medium: 'Medium ranged', ranged_heavy: 'Heavy ranged',
  unarmed_strike: 'Strike', unarmed_grapple: 'Grapple', unarmed_improvised: 'Improvisation', unarmed_natural: 'Natural weapons',
  dodge: 'Dodge', block: 'Block', endurance: 'Endurance', sight: 'Sight', hearing: 'Hearing',
  persuasion: 'Persuasion', intimidation: 'Intimidation', barter: 'Barter', feint: 'Feint', riposte: 'Riposte', disarm: 'Disarm',
  tremor: 'Tremor', taste: 'Taste', lockpicking: 'Lockpicking',
};
export const skillName = (id: string) => SKILL_NAMES[id] ?? id;
export const SKILL_SUB: Record<string, string> = { endurance: 'sets HP', feint: 'effect not designed', riposte: 'effect not designed', disarm: 'effect not designed' };

// Layout B's tree order and colours. Locked rows are placeholders the spec leaves out of the first build.
// Skills the approved layout shows as a locked row instead of a slider.
const LOCKED = new Set(['unarmed_natural']);

export const TREE_VIEW: { id: string; c: string; locked?: [string, string] }[] = [
  { id: 'melee', c: 'c10' }, { id: 'defense', c: 'c1' }, { id: 'swordsman', c: 'c5' },
  { id: 'perception', c: 'c12', locked: ['Not chosen yet', 'Locked'] }, { id: 'ranged', c: 'c7' }, { id: 'unarmed', c: 'c14' },
  { id: 'stealth', c: 'c3', locked: ['No skills yet', 'Coming later'] }, { id: 'speech', c: 'c4' },
];

const STEP = 5;
// The approved layout's recommended build: 250 points, tags medium weapons, block, endurance.
const REC: Record<string, number> = { melee_medium: 50, block: 40, dodge: 30, endurance: 50, sight: 30, hearing: 30, feint: 10, riposte: 10 };
const REC_TAGS = ['melee_medium', 'block', 'endurance'];

export function creationScreen(api: GameApi, onStarted: () => void): HTMLElement {
  const lib = getLibrary();
  const floors = lib.classes.swordsman?.floors ?? {};
  const open = TREE_VIEW.flatMap((t) => lib.trees[t.id]?.skills ?? []).filter((k) => lib.skills[k]?.playerOpen && !LOCKED.has(k));
  const st = { v: {} as Record<string, number>, tags: new Set<string>(), name: 'Aldric', swings: 400 };
  const total = () => CONFIG.CREATION_POINTS, cap = () => CONFIG.CREATION_MAX_SKILL, maxTags = () => CONFIG.CREATION_TAGS;
  const reset = () => { open.forEach((k) => (st.v[k] = floors[k] ?? 0)); st.tags.clear(); };
  const recommended = () => { reset(); Object.assign(st.v, REC); REC_TAGS.forEach((k) => st.tags.add(k)); };
  const left = () => total() - open.reduce((a, k) => a + st.v[k], 0);
  const build = (): CreationBuild => ({ name: st.name.trim(), skills: { ...st.v }, tagged: [...st.tags] });
  const setVal = (k: string, n: number) => { st.v[k] = Math.max(floors[k] ?? 0, Math.min(cap(), st.v[k] + left(), Math.round(n))); render(); };

  const tilesHost = h('div');
  const how = h('p', { class: 'how', hidden: true });
  const src = h('p', { class: 'subline' });
  const msg = h('p', { class: 'msg', role: 'status' });
  const rows = new Map<string, HTMLElement>();
  const sums = new Map<string, HTMLElement>();

  const groups = h('div', { class: 'groups' }, TREE_VIEW.map((t) => {
    const def = lib.trees[t.id];
    const sum = h('span', { class: 'tot hs-num' });
    sums.set(t.id, sum);
    const name = def?.name ?? 'Stealth';
    const sec = h('section', {}, h('div', { class: 'grp-h' }, h('i', { class: 'hs-sq', style: `background:var(--${t.c})` }), h('h2', { class: 'hs-section' }, name),
      def?.classId ? h('span', { class: 'hs-chip' }, 'Class tree') : null, sum));
    for (const k of (def?.skills ?? []).filter((x) => !LOCKED.has(x))) {
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
    if (t.locked) sec.append(h('div', { class: 'row locked' }, h('div', { class: 'nm' }, h('b', {}, t.locked[0])), h('span', { class: 'lockw' }, t.locked[1])));
    return sec;
  }));

  function editSwings() {
    const inp = h('input', { class: 'hs-input', type: 'number', min: '50', max: '5000', step: '50', value: String(st.swings), id: 'swings',
      onchange: (e: Event) => { st.swings = Math.max(50, Math.min(5000, +(e.target as HTMLInputElement).value || 400)); render(); } });
    openPanel('Estimate', [
      { k: 'Figure', v: 'Vs one slime' },
      { k: 'Source', v: 'The game’s attack rules, run as seeded practice swings: you with the arming sword against one slime, and its slam against you with your standing defense.' },
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
      { label: 'Sword attack', value: dash(p.attack), unit: 'skill', sub: `medium weapons + sword ${CONFIG.KIT_BONUS}`, how: 'Effective medium weapons skill with the arming sword in hand (raw skill plus gear).' },
      { label: 'Standing defense', value: dash(p.defense?.value ?? null), unit: p.defense?.kind ?? 'skill',
        sub: p.defense ? (p.defense.kind === 'block' ? `block + shield ${CONFIG.KIT_BONUS}` : 'dodge (higher than block)') : 'block or dodge, the higher',
        how: 'The higher of effective block (with the round shield) and effective dodge.' },
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
    for (const t of TREE_VIEW) {
      const ks = (lib.trees[t.id]?.skills ?? []).filter((k) => open.includes(k));
      sums.get(t.id)!.textContent = ks.length ? `${ks.reduce((a, k) => a + st.v[k], 0)} pts` : '';
    }
    msg.textContent = ''; msg.className = 'msg';
  }

  async function go() {
    const L = left(), need = maxTags() - st.tags.size;
    const fail = (t: string) => { msg.textContent = 'Needs attention: ' + t; msg.className = 'msg bad'; };
    if (L > 0) return fail(`spend your last ${L} points first.`);
    if (need > 0) return fail(`tag ${need} more skill${need > 1 ? 's' : ''} first.`);
    const errs = api.validateBuild(build());
    if (errs.length) return fail(errs.join(' '));
    msg.textContent = 'Starting the story…'; msg.className = 'msg ok';
    await api.newStory(build());
    onStarted();
  }

  recommended();
  render();
  const stopped = api.notices().find((n) => n.kind === 'stop_play');
  return h('main', {},
    stopped ? h('div', { class: 'hs-hl bad', role: 'status' }, h('span', { class: 'hs-hl-b', 'data-kind': 'Play stopped' }, stopped.text)) : null,
    h('div', { class: 'head' },
      h('div', {}, h('h1', {}, 'Create your swordsman'),
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
    h('div', { class: 'hs-hl ask ph' }, h('span', { class: 'hs-hl-b', 'data-kind': 'Placeholders' },
      `${total()} points, cap ${cap()}, floors medium weapons ${floors.melee_medium ?? 0} and block ${floors.block ?? 0}, ${maxTags()} tags, Potential fixed at ${CONFIG.POTENTIAL}. `
      + `Kit assumed: sword +${CONFIG.KIT_BONUS}, shield +${CONFIG.KIT_BONUS}, gambeson. Swordsman skills have no effects yet. Odds use the game’s attack rules against the library’s slime.`)));
}
