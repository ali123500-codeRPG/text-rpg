// The scenario-end gains moment (D-226, M-39 to M-39b): when a scenario ends, everything it gave the player opens in one
// panel over the story, between the old scenario's closing line and the new one's opening. A gold thread (XP is the
// Thread) runs down the panel and each gain is knotted onto it in turn, from the commonest to the rarest: skills, perks,
// All-XXX perks, achievements and scars, any essence offered, then the XP the Thread gathered, and last the levels it brought.
// Like every play-screen motion it plays on top of the final state (M-74): the panel is built complete, so skipping,
// finishing or motion off always shows every gain at once. Each step's length comes from the --m-* tokens, never from how
// long the turn took (M-03); only how many gains there are sets how long it runs, as long as the moment needs.
import { h, plural } from './kit';
import { arrive, bar as barMove, count, impact, later, measured, ms, paced, play, stamp } from './motion';
import { skillName } from './creation';
import { perkSeries } from './perks';
import { getLibrary } from '../library';
import { SCENARIO_ENDING_NAMES, SCENARIO_ENDING_OUTCOMES, type AchievementNote, type GameApi, type ScenarioEndNote, type ScenarioGains, type XpPart } from '../types';
import { cap } from '../words';

/** one way to write a number in the moment, counting or still, so a count never ends in a jump (XP can be fractional) */
const num = (v: number) => String(+v.toFixed(1));
const plus = (v: number) => `+${num(v)}`;

export { anyGains } from '../engine/growth'; // one test for "the scenario gave something", shared with the gains log

/** one line saying what the scenario gave, for the story's record of it and for screen readers */
export function gainsSummary(g: ScenarioGains): string {
  const scars = g.achievements.filter((a) => a.scar).length, achs = g.achievements.length - scars;
  return [
    g.skills.length ? `${plural(g.skills.length, 'skill')} up` : '',
    g.perks.length ? plural(g.perks.length, 'new perk') : '',
    ...g.allPerks.map((a) => a.name),
    achs ? plural(achs, 'achievement') : '',
    scars ? plural(scars, 'scar') : '',
    g.essences?.length ? plural(g.essences.length, 'essence') + ' offered' : '',
    g.xp.gained ? `${plus(g.xp.gained)} XP` : '',
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
  const end = o.end;
  return h('div', { class: 'gains-veil', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'gains-h', 'data-end': end?.as ?? '' },
    h('section', { class: 'gains' },
      end ? h('p', { class: 'pbreak end g-rule', 'data-end': end.as }, h('b', {}, cap(end.name))) : null,
      end ? h('p', { class: 'g-outcome', 'data-end': end.as }, SCENARIO_ENDING_OUTCOMES[end.as]) : null,
      // SD1: the old scenario's closing line sits under its ending, so the panel is that scenario's last word
      end?.closing ? h('p', { class: 'g-closing' }, end.closing) : null,
      h('h2', { id: 'gains-h', class: 'g-title' }, 'What you gained'),
      gainsSpine(g, o.achCard, true),
      h('div', { class: 'g-foot' }, h('button', { type: 'button', class: 'hs-btn-main', onclick: o.onContinue }, 'Continue'),
        h('span', { class: 'hs-note' }, 'or press Enter or Esc'))));
}

/** the knots and their gains, as the panel and the Gains page show them */
function gainsSpine(g: ScenarioGains, achCard: (a: AchievementNote) => HTMLElement, live = false): HTMLElement {
  const lib = getLibrary();
  const star = (mark = '✦') => h('span', { class: 'st', 'aria-hidden': 'true' }, mark);
  const sec = (key: string, label: string, ...items: HTMLElement[]) =>
    h('li', { class: 'g-sec', 'data-sec': key }, h('span', { class: 'g-node', 'aria-hidden': 'true' }, '✦'), h('p', { class: 'hs-label g-label' }, label), h('div', { class: 'g-items' }, ...items));
  const secs: HTMLElement[] = [];
  if (g.skills.length) secs.push(sec('skills', 'Skills', ...g.skills.map((s) => h('div', { class: 'g-skill', 'data-from': String(s.from), 'data-to': String(s.to) },
    h('b', { class: 'n' }, skillName(s.skill)), h('span', { class: 'num' }, num(s.to)),
    h('span', { class: 'g-up' }, `▲ ${plus(s.to - s.from)}`),
    h('div', { class: 'cs-bar' }, h('b', { style: `width:${Math.min(100, s.to)}%` }))))));
  if (g.perks.length) secs.push(sec('perks', g.perks.length === 1 ? 'New perk' : 'New perks', ...g.perks.map((p) =>
    h('div', { class: 'perk-new g-perk', 'data-series': perkSeries(p.milestone) }, star(), h('div', {}, 'New perk unlocked', h('small', {}, `${skillName(p.skill)} reached ${p.milestone}`))))));
  if (g.allPerks.length) secs.push(sec('all', 'Tree perks', ...g.allPerks.map((a) =>
    h('div', { class: 'perk-new g-all' }, star(), h('div', {}, a.name, h('small', {}, `${lib.trees[a.tree]?.name ?? 'A tree'}: its skills reached ${a.step}`))))));
  if (g.achievements.length) {
    const scars = g.achievements.every((a) => a.scar), achs = g.achievements.every((a) => !a.scar);
    secs.push(sec('ach', achs ? 'Achievements' : scars ? 'Scars' : 'Achievements and scars', ...g.achievements.map(achCard)));
  }
  // an essence is an offer, not yet taken: the player answers it with /essence after the moment
  if (g.essences?.length) secs.push(sec('ess', g.essences.length === 1 ? 'An essence is offered' : 'Essences are offered', ...g.essences.map((e) =>
    h('div', { class: 'perk-new g-ess' }, star('◆'), h('div', {}, e.name, h('small', {}, live ? `${cap(e.grade)} grade. Take it or let it go when this closes` : `${cap(e.grade)} grade`))))));
  const levelled = g.xp.toLevel > g.xp.fromLevel;
  const KIND: Record<XpPart['kind'], string> = { defeat: 'Defeats', achievement: 'Achievement', quest: 'Quest', other: 'Other' };
  const parts = (g.xp.parts ?? []).filter((x) => x.amount);
  if (g.xp.gained || levelled) secs.push(sec('xp', 'The Thread', h('div', { class: 'g-xp' },
    // the sum: where the XP came from, row by row, above the total it adds up to
    parts.length ? h('ul', { class: 'g-xp-sum' }, parts.map((x) => h('li', { 'data-amount': String(x.amount) },
      h('span', { class: 'k' }, KIND[x.kind]), h('span', { class: 'l' }, x.label), h('b', { class: 'a' }, plus(x.amount))))) : null,
    h('p', { class: 'g-xp-row' }, parts.length ? h('span', { class: 'k' }, 'Total') : null, h('b', { class: 'g-xp-n', 'data-m': 'gained' }, plus(g.xp.gained)), h('span', {}, ' XP')),
    h('div', { class: 'g-xp-line' }, h('div', { class: 'cs-bar g-xp-bar', 'data-m': 'xp-track' }, h('b', { style: `width:${g.xp.toPct}%` })),
      h('span', { class: 'g-xp-lv', 'data-m': 'lvl' }, `Level ${g.xp.toLevel}`)))));
  if (g.levelUps.length) secs.push(sec('level', g.levelUps.length === 1 ? 'Level up' : 'Levels up', h('div', { class: 'g-level' },
    h('p', { class: 'g-level-n' }, h('span', {}, 'Level'), h('b', {}, String(g.xp.toLevel))),
    h('ul', { class: 'g-level-l' }, g.levelUps.map((u) => h('li', {}, u.classId ? `${lib.classes[u.classId]?.name ?? 'Your class'} reached level ${u.level}` : `A bonus level: level ${u.level}`))),
    h('p', { class: 'hs-note' }, plural(g.levelUps.length, 'perk point'), ' to spend'))));
  return h('ol', { class: 'g-spine' }, ...secs);
}

/** the moment's motion, from t0; returns when the last gain has landed. Sections come one at a time; inside one, items
 * come one at a time at --m-gain-gap, each with the beat its rarity earns (game-feel GF-01): a skill counts and its bar
 * grows (T1), a perk's star lands in its struck pose (T3), a tree perk and an achievement get the honour beat (T4), the
 * Thread fills (and wraps for a level), and a level-up is the finale: the number lands, holds, and one ring of light
 * leaves it once. The thread draws down each section while its gains land, so it reaches the next knot as they finish. */
export function playGains(veil: HTMLElement, g: ScenarioGains, t0: number): number {
  // the moment runs slower than a turn's beats: every token inside it is stretched by --m-gains-pace, and further when the
  // gains are few, so the whole moment lasts at least --m-gains-min (a skip still lands it at once, M-12)
  const base = ms('--m-gains-pace') || 1, min = ms('--m-gains-min');
  const length = paced(base, () => measured(() => gainsTimeline(veil, g, t0))) - t0;
  const k = length > 0 && length < min ? base * (min / length) : base;
  return paced(k, () => gainsTimeline(veil, g, t0));
}
function gainsTimeline(veil: HTMLElement, g: ScenarioGains, t0: number): number {
  const state = ms('--m-state'), gap = ms('--m-gain-gap'), hold = ms('--m-hold'), scen = ms('--m-scenario');
  // the veil covers the screen at once (nothing behind it shows the ending first); its content fades in
  play(veil.querySelector('.gains'), [{ opacity: 0 }, { opacity: 1 }], { dur: state, delay: t0 });
  const rule = veil.querySelector('.g-rule');
  if (rule) {
    play(rule, [{ transform: 'scaleX(0)', transformOrigin: 'right' }, { transform: 'scaleX(1)', transformOrigin: 'right' }], { dur: scen, delay: t0, pseudo: '::before' });
    play(rule, [{ transform: 'scaleX(0)', transformOrigin: 'left' }, { transform: 'scaleX(1)', transformOrigin: 'left' }], { dur: scen, delay: t0, pseudo: '::after' });
  }
  impact(rule?.querySelector('b'), t0 + scen * 0.5); // the ending's word lands in its struck pose as the rules meet it
  play(veil.querySelector('.g-outcome'), [{ opacity: 0 }, { opacity: 1 }], { dur: state, delay: t0 + scen * 0.5 }); // said as the word lands
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
        count(it.querySelector<HTMLElement>('.num'), from, to, num, t + state);
        barMove(it.querySelector<HTMLElement>('.cs-bar'), it.querySelector<HTMLElement>('.cs-bar > b'), Math.min(100, from), Math.min(100, to), t + state);
        arrive(it.querySelector('.g-up'), t + state, 0);
        t += gap;
      } else if (key === 'perks' || key === 'ess') {
        arrive(it, t, 6);
        impact(it.querySelector('.st'), t + state);
        t += gap + hold;
      } else if (key === 'all' || key === 'ach') {
        t += honor(it, t) + gap;
      } else if (key === 'xp') {
        const levelled = g.xp.toLevel > g.xp.fromLevel;
        const total = it.querySelector<HTMLElement>('[data-m="gained"]');
        arrive(it, t);
        t += state;
        // the sum: each source lands in turn and the total counts on by its amount, so the final number is shown being made
        const rows = Array.from(it.querySelectorAll<HTMLElement>('.g-xp-sum > li'));
        if (rows.length) {
          let sum = 0;
          for (const r of rows) {
            const n = Number(r.dataset.amount);
            arrive(r, t, 6);
            count(total, sum, sum + n, plus, t + state);
            sum += n; t += gap + state;
          }
          // the rule under the sum draws, then the total lands in its struck pose
          play(it.querySelector('.g-xp-sum'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { dur: state * 2, delay: t, pseudo: '::after' });
          impact(total, t + state);
          t += state * 2 + hold;
        } else {
          count(total, 0, g.xp.gained, plus, t);
          t += ms('--m-count');
        }
        barMove(it.querySelector<HTMLElement>('[data-m="xp-track"]'), it.querySelector<HTMLElement>('[data-m="xp-track"] > b'), g.xp.fromPct, g.xp.toPct, t, levelled);
        if (levelled) stamp(it.querySelector<HTMLElement>('[data-m="lvl"]'), t + ms('--m-trail'), `Level ${g.xp.fromLevel}`);
        t += ms('--m-trail') * (levelled ? 2 : 1);
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

/** an achievement or scar as the Gains page lists it: the same card as the turn's, without its pop-up */
const achNote = (a: AchievementNote) => h('div', { class: `perk-new ach g-ach${a.scar ? ' scar' : ''}` },
  h('span', { class: 'st', 'aria-hidden': 'true' }, a.scar ? '✶' : '✦'),
  h('div', { class: 'ach-txt' }, h('span', { class: 'ach-k' }, a.scar ? 'Scar' : 'Achievement', a.levelName ? h('span', { class: 'ach-lv' }, `Tier ${a.levelName}`) : null),
    h('b', { class: 'ach-n' }, a.name), a.earnedAt ? h('small', {}, cap(a.earnedAt)) : null));

/** the Gains page: every scenario's gains kept on the character, newest first, each folded under one
 * line (its number, how it ended, the turn, what it gave); the newest starts open. All still: it is a record (M-60). */
export function gainsPage(api: GameApi): { el: HTMLElement; update: () => void } {
  const el = h('main', { class: 'gains-page' });
  const open = new Set<number>();
  let seen = -1;
  function update() {
    const s = api.state();
    const log = [...(s?.player.progression?.gainsLog ?? [])].reverse();
    if (log[0] && log[0].endTurn !== seen) { seen = log[0].endTurn; open.add(log[0].endTurn); }
    const rows = log.map((r) => {
      const d = h('details', { class: 'g-past', 'data-end': r.ending, ...(open.has(r.endTurn) ? { open: true } : {}) },
        h('summary', {}, h('b', { class: 'g-past-n' }, `Scenario ${r.number}`), h('span', { class: 'g-past-end' }, cap(SCENARIO_ENDING_NAMES[r.ending])),
          h('span', { class: 'hs-note' }, `Turn ${r.endTurn}`), h('span', { class: 'g-past-sum' }, gainsSummary(r))),
        h('div', { class: 'g-past-body' }, h('p', { class: 'g-outcome' }, SCENARIO_ENDING_OUTCOMES[r.ending]), r.closing ? h('p', { class: 'g-closing' }, r.closing) : null, gainsSpine(r, achNote)));
      d.addEventListener('toggle', () => { if (d.open) open.add(r.endTurn); else open.delete(r.endTurn); });
      return d;
    });
    el.replaceChildren(
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Gains'), h('p', {}, 'What each scenario gave you, newest first, as it showed when the scenario ended.'))),
      s ? (rows.length ? h('div', { class: 'g-past-list' }, ...rows) : h('p', { class: 'empty' }, 'No scenario has ended with a gain yet.'))
        : h('p', { class: 'empty' }, 'No story yet. Create your character first.'));
  }
  return { el, update };
}
