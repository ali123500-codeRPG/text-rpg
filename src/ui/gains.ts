// The scenario-end gains moment (D-226, proposed M-39): when a scenario ends, everything it gave the player opens in one
// panel over the story, between the old scenario's closing line and the new one's opening. A gold thread (XP is the
// Thread) runs down the panel and each gain is knotted onto it in turn, from the commonest to the rarest: skills, perks,
// All-XXX perks, achievements and scars, then the XP the Thread gathered, and last the levels it brought.
// Like every play-screen motion it plays on top of the final state (M-74): the panel is built complete, so skipping,
// finishing or motion off always shows every gain at once. Each step's length comes from the --m-* tokens, never from how
// long the turn took (M-03); only how many gains there are sets how long it runs, as long as the moment needs.
import { h } from './kit';
import { arrive, bar as barMove, count, impact, later, motionOn, ms, play, stamp } from './motion';
import { skillName } from './creation';
import { perkSeries } from './perks';
import { getLibrary } from '../library';
import type { AchievementNote, ScenarioEndNote, ScenarioGains } from '../types';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/** anything worth the moment: a scenario that gave nothing opens no panel */
export const anyGains = (g: ScenarioGains | undefined): g is ScenarioGains =>
  !!g && (g.skills.length + g.perks.length + g.allPerks.length + g.achievements.length + g.levelUps.length > 0 || g.xp.gained > 0);

/** one line saying what the scenario gave, for the story's record of it and for screen readers */
export function gainsSummary(g: ScenarioGains): string {
  const scars = g.achievements.filter((a) => a.scar).length, achs = g.achievements.length - scars;
  return [
    g.skills.length ? `${plural(g.skills.length, 'skill')} up` : '',
    g.perks.length ? plural(g.perks.length, 'new perk') : '',
    ...g.allPerks.map((a) => a.name),
    achs ? plural(achs, 'achievement') : '',
    scars ? plural(scars, 'scar') : '',
    g.xp.gained ? `+${g.xp.gained} XP` : '',
    g.xp.toLevel > g.xp.fromLevel ? `level ${g.xp.toLevel}` : '',
  ].filter(Boolean).join(' · ');
}

/** M-38/M-38a, game-feel T4: an achievement or a level-up card is a milestone. Anticipation: a --m-hold pause. Then the
 * card rises in, its star lands in its struck pose and holds, one band of light sweeps across once, and an achievement's
 * tier lands. A scar comes in heavier and darker, with no light. Nothing on the card grows more than a few pixels, so its
 * text never slides. Returns how long it holds the cards after it. */
export function honor(g: HTMLElement, d0: number): number {
  const dur = ms('--m-honor'), beat = ms('--m-beat'), d = d0 + ms('--m-hold');
  if (g.classList.contains('scar')) {
    play(g, [{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { dur: beat, delay: d });
    impact(g.querySelector('.st'), d + beat);
    stamp(g.querySelector<HTMLElement>('.ach-lv'), d + beat);
    return beat + ms('--m-hold');
  }
  play(g, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { dur: ms('--m-state') * 2, delay: d });
  play(g, [{ transform: 'translateX(-100%)' }, { transform: 'translateX(100%)' }], { dur, delay: d + ms('--m-state'), pseudo: '::after' });
  impact(g.querySelector('.st'), d + ms('--m-state'));
  stamp(g.querySelector<HTMLElement>('.ach-lv'), d + dur / 2);
  return dur / 2 + ms('--m-hold');
}

type Opts = {
  end: ScenarioEndNote | undefined;
  achCard: (a: AchievementNote) => HTMLElement;
  onContinue: () => void;
};

/** the panel, complete: every gain is in it from the start, so it reads the same with motion off */
export function gainsPanel(g: ScenarioGains, o: Opts): HTMLElement {
  const lib = getLibrary();
  const star = (mark = '✦') => h('span', { class: 'st', 'aria-hidden': 'true' }, mark);
  const sec = (key: string, label: string, ...items: HTMLElement[]) =>
    h('li', { class: 'g-sec', 'data-sec': key }, h('span', { class: 'g-node', 'aria-hidden': 'true' }, '✦'), h('p', { class: 'hs-label g-label' }, label), h('div', { class: 'g-items' }, ...items));
  const secs: HTMLElement[] = [];
  if (g.skills.length) secs.push(sec('skills', 'Skills', ...g.skills.map((s) => h('div', { class: 'g-skill', 'data-from': String(s.from), 'data-to': String(s.to) },
    h('b', { class: 'n' }, skillName(s.skill)), h('span', { class: 'num' }, String(s.to)),
    h('span', { class: 'g-up' }, `▲ +${+(s.to - s.from).toFixed(2)}`),
    h('div', { class: 'cs-bar' }, h('b', { style: `width:${Math.min(100, s.to)}%` }))))));
  if (g.perks.length) secs.push(sec('perks', g.perks.length === 1 ? 'New perk' : 'New perks', ...g.perks.map((p) =>
    h('div', { class: 'perk-new g-perk', 'data-series': perkSeries(p.milestone) }, star(), h('div', {}, 'New perk unlocked', h('small', {}, `${skillName(p.skill)} reached ${p.milestone}`))))));
  if (g.allPerks.length) secs.push(sec('all', 'Tree perks', ...g.allPerks.map((a) =>
    h('div', { class: 'perk-new g-all' }, star(), h('div', {}, a.name, h('small', {}, `${lib.trees[a.tree]?.name ?? 'A tree'}: its skills reached ${a.step}`))))));
  if (g.achievements.length) {
    const scars = g.achievements.every((a) => a.scar), achs = g.achievements.every((a) => !a.scar);
    secs.push(sec('ach', achs ? 'Achievements' : scars ? 'Scars' : 'Achievements and scars', ...g.achievements.map(o.achCard)));
  }
  const levelled = g.xp.toLevel > g.xp.fromLevel;
  if (g.xp.gained || levelled) secs.push(sec('xp', 'The Thread', h('div', { class: 'g-xp' },
    h('p', { class: 'g-xp-row' }, h('b', { class: 'g-xp-n', 'data-m': 'gained' }, `+${g.xp.gained}`), h('span', {}, ' XP'),
      h('span', { class: 'g-xp-lv', 'data-m': 'lvl' }, `Level ${g.xp.toLevel}`)),
    h('div', { class: 'cs-bar g-xp-bar', 'data-m': 'xp-track' }, h('b', { style: `width:${g.xp.toPct}%` })))));
  if (g.levelUps.length) secs.push(sec('level', g.levelUps.length === 1 ? 'Level up' : 'Levels up', h('div', { class: 'g-level' },
    h('p', { class: 'g-level-n' }, h('span', {}, 'Level'), h('b', {}, String(g.xp.toLevel))),
    h('ul', { class: 'g-level-l' }, g.levelUps.map((u) => h('li', {}, u.classId ? `${lib.classes[u.classId]?.name ?? 'Your class'} reached level ${u.level}` : `A bonus level: level ${u.level}`))),
    h('p', { class: 'hs-note' }, plural(g.levelUps.length, 'perk point'), ' to spend'))));
  const end = o.end;
  return h('div', { class: 'gains-veil', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'gains-h', 'data-end': end?.as ?? '' },
    h('section', { class: 'gains' },
      end ? h('p', { class: 'pbreak end g-rule', 'data-end': end.as }, h('b', {}, cap(end.name))) : null,
      // SD1: the old scenario's closing line sits under its ending, so the panel is that scenario's last word
      end?.closing ? h('p', { class: 'g-closing' }, end.closing) : null,
      h('h2', { id: 'gains-h', class: 'g-title' }, 'What you gained'),
      h('ol', { class: 'g-spine' }, ...secs),
      h('div', { class: 'g-foot' }, h('button', { type: 'button', class: 'hs-btn-main', onclick: o.onContinue }, 'Continue'),
        h('span', { class: 'hs-note' }, 'or press Enter or Esc'))));
}

/** the moment's motion, from t0; returns when the last gain has landed. Sections come one at a time; inside one, items
 * come one at a time at --m-gain-gap, each with the beat its rarity earns (game-feel GF-01): a skill counts and its bar
 * grows (T1), a perk's star lands in its struck pose (T3), a tree perk and an achievement get the honour beat (T4), the
 * Thread fills (and wraps for a level), and a level-up is the finale: the number lands, holds, and one ring of light
 * leaves it once. The thread draws down each section while its gains land, so it reaches the next knot as they finish. */
export function playGains(veil: HTMLElement, g: ScenarioGains, t0: number): number {
  if (!motionOn()) return 0;
  const state = ms('--m-state'), gap = ms('--m-gain-gap'), hold = ms('--m-hold'), scen = ms('--m-scenario');
  play(veil, [{ opacity: 0 }, { opacity: 1 }], { dur: state, delay: t0 });
  const rule = veil.querySelector('.g-rule');
  if (rule) {
    play(rule, [{ transform: 'scaleX(0)', transformOrigin: 'right' }, { transform: 'scaleX(1)', transformOrigin: 'right' }], { dur: scen, delay: t0, pseudo: '::before' });
    play(rule, [{ transform: 'scaleX(0)', transformOrigin: 'left' }, { transform: 'scaleX(1)', transformOrigin: 'left' }], { dur: scen, delay: t0, pseudo: '::after' });
  }
  play(veil.querySelector('.g-closing'), [{ opacity: 0 }, { opacity: 1 }], { dur: state * 2, delay: t0 + scen * 0.3 });
  arrive(veil.querySelector('.g-title'), t0 + scen * 0.6, 6);
  let t = t0 + scen * 0.9 + hold; // anticipation: the title settles, a breath, then the first knot
  const scroller = veil;
  for (const s of Array.from(veil.querySelectorAll<HTMLElement>('.g-sec'))) {
    const start = t, key = s.dataset.sec;
    // bring the section into view as it starts; skipping leaves the scroll where it is
    later(() => { const top = s.offsetTop - scroller.clientHeight * 0.25; if (top > scroller.scrollTop) scroller.scrollTo({ top, behavior: 'smooth' }); }, start);
    play(s.querySelector('.g-node'), [{ opacity: 0 }, { opacity: 1 }], { dur: ms('--m-feedback'), delay: t });
    impact(s.querySelector('.g-node'), t);
    play(s.querySelector('.g-label'), [{ opacity: 0 }, { opacity: 1 }], { dur: state, delay: t });
    t += state;
    const items = Array.from(s.querySelectorAll<HTMLElement>(':scope > .g-items > *'));
    for (const it of items) {
      if (key === 'skills') {
        arrive(it, t);
        const from = Number(it.dataset.from), to = Number(it.dataset.to);
        count(it.querySelector<HTMLElement>('.num'), from, to, (n) => String(Math.round(n)), t + state);
        barMove(it.querySelector<HTMLElement>('.cs-bar'), it.querySelector<HTMLElement>('.cs-bar > b'), Math.min(100, from), Math.min(100, to), t + state);
        arrive(it.querySelector('.g-up'), t + state, 0);
        t += gap;
      } else if (key === 'perks') {
        arrive(it, t, 6);
        impact(it.querySelector('.st'), t + state);
        t += gap + hold;
      } else if (key === 'all' || key === 'ach') {
        t += honor(it, t) + gap;
      } else if (key === 'xp') {
        const levelled = g.xp.toLevel > g.xp.fromLevel;
        arrive(it, t);
        count(it.querySelector<HTMLElement>('[data-m="gained"]'), 0, g.xp.gained, (n) => `+${Math.round(n)}`, t + state);
        barMove(it.querySelector<HTMLElement>('[data-m="xp-track"]'), it.querySelector<HTMLElement>('[data-m="xp-track"] > b'), g.xp.fromPct, g.xp.toPct, t + state, levelled);
        if (levelled) stamp(it.querySelector<HTMLElement>('[data-m="lvl"]'), t + state + ms('--m-trail'), `Level ${g.xp.fromLevel}`);
        t += state + ms('--m-trail') * (levelled ? 2 : 1);
      } else if (key === 'level') {
        // the finale: a held breath, the number rises in and lands in its struck pose, then one ring of light leaves it
        t += hold;
        const n = it.querySelector('.g-level-n b');
        play(it.querySelector('.g-level-n'), [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { dur: state * 2, delay: t });
        impact(n, t + state);
        play(n, [{ opacity: 0.8, transform: 'scale(0.95)' }, { opacity: 0, transform: 'scale(1.6)' }], { dur: ms('--m-honor'), delay: t + state + hold, pseudo: '::after' });
        Array.from(it.querySelectorAll(':scope > ul > li, :scope > .hs-note')).forEach((x, i) => arrive(x, t + state * 2 + gap * i));
        t += state * 2 + ms('--m-honor') / 2;
      }
    }
    // the thread runs down this section while its gains land
    play(s, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { dur: Math.max(state, t - start), delay: start, pseudo: '::before' });
    t += hold;
  }
  arrive(veil.querySelector('.g-foot'), t);
  return t + state;
}
