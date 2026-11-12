// D-226 (LF3) and the growth proposal (EG7, EG8, EG13): growth lands at the end of a scenario. While a scenario runs, the
// player's marks only count (owed rolls), achievements queue (grantAchievement), All-XXX steps and level-ups wait. When the
// scenario ends, closeScenario calls flushGrowth: the scenario pays its improvement rolls (payScenario, in rounds), levels are
// taken, then achievements and All-XXX are granted, and one gains summary is left (stage.gains, then LogLine.scenarioGains) for
// the ending moment's pop-up. In free roam achievements come at once (growthWaits); marks wait for the next scenario.
import type { GameState, Rng, ScenarioEnding, ScenarioFrame, ScenarioGains, Tier } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { grantAllSteps } from '../ruleset/allSteps';
import { owedBySkill, payRolls } from '../ruleset/improve';
import { achievementInfo, atScenarioEnd, charLevel, grantAchievement, spendXp, unlockClasses, xpToNext } from './xp';
import { logCode } from './effects';

type Part = NonNullable<ScenarioFrame['gains']>;
const empty = (): Part => ({ skills: [], perks: [], allPerks: [] });

/** the sheet's XP bar: level and fill (as the character sheet shows it) */
export function xpBar(state: GameState): { level: number; pct: number } {
  const p = state.player, need = xpToNext(p), xp = p.progression?.xp ?? 0;
  return { level: charLevel(p), pct: need > 0 ? Math.min(100, (xp / need) * 100) : 100 };
}

/** reads this turn's log (from index `from`) into the gains: skill raises, milestone unlocks and the player's All-XXX */
function readLog(state: GameState, g: Part, from = 0): void {
  const lib = getLibrary();
  for (const l of state.log.slice(from)) {
    if (l.turn !== state.turn) continue;
    const d = (l.detail ?? {}) as Record<string, unknown>;
    if (l.code === 'skill_improved') {
      const skill = String(d.skill), prev = g.skills.find((x) => x.skill === skill);
      if (prev) prev.to = Number(d.to); // one row per skill: its first from, its last to
      else g.skills.push({ skill, from: Number(d.from), to: Number(d.to) });
      if (d.milestone) g.perks.push({ skill, milestone: Number(d.milestone) });
    } else if (l.code === 'all_step_perk' && d.actorId === state.player.id) {
      const tree = String(d.treeId), step = Number(d.step);
      if (!g.allPerks.some((x) => x.tree === tree && x.step === step))
        g.allPerks.push({ tree, step, name: `All-${step}: ${lib.trees[tree]?.name ?? tree}` });
    }
  }
}

/** end of each turn, before the scenario closes: this turn's raises (and anything granted at once) go on the running scenario */
export function noteGains(state: GameState): void {
  const f = state.stage.scenario;
  if (!f || noted.get(f) === state.turn) return;
  noted.set(f, state.turn);
  readLog(state, (f.gains ??= empty()));
}
/** the turn each frame's gains were last noted (a scenario closed outside resolve still counts its last turn once) */
const noted = new WeakMap<ScenarioFrame, number>();

/** EG5/EG17: what an ending pays, kept between ENDING_FACTOR_MIN and ENDING_FACTOR_MAX */
export const endingFactor = (as: ScenarioEnding): number =>
  Math.min(CONFIG.ENDING_FACTOR_MAX, Math.max(CONFIG.ENDING_FACTOR_MIN, CONFIG.ENDING_FACTOR[as] ?? CONFIG.ENDING_FACTOR_MIN));

/** EG13: the improvement rolls a scenario pays for `owed` rolls marked in it: round(owed × tier share × ending factor), plus
 * GROWTH_ROLLS_PAST_CRIT per step past Critical Success, plus the low-level bonus (EG10). Nothing marked pays nothing.
 * Scaling: it counts rolls, not points, so it is the same at any skill; what a roll does at 50, 75, 100 is the improvement roll's. */
export function scenarioRolls(state: GameState, owed: number, tier: Tier, beyond: number | undefined, as: ScenarioEnding): number {
  if (owed <= 0) return 0;
  const past = tier === 'critical_success' ? (beyond ?? 0) * CONFIG.GROWTH_ROLLS_PAST_CRIT : 0;
  const low = charLevel(state.player) < CONFIG.GROWTH_LOW_LEVEL_BELOW ? CONFIG.GROWTH_LOW_LEVEL_BONUS : 0;
  return Math.round(owed * (CONFIG.GROWTH_TIER_SHARE[tier] ?? 0) * endingFactor(as)) + past + low;
}

/** EG6 a: deal `rolls` to the marked skills by their owed rolls (largest remainder; ties go to the skill marked more, then first) */
export function dealRolls(owed: [string, number][], rolls: number): [string, number][] {
  const total = owed.reduce((n, [, m]) => n + m, 0);
  if (!total || rolls <= 0) return [];
  const out = owed.map(([id, m], i) => ({ id, m, i, n: Math.floor((rolls * m) / total), r: ((rolls * m) / total) % 1 }));
  let left = rolls - out.reduce((n, x) => n + x.n, 0);
  for (const x of [...out].sort((a, b) => b.r - a.r || b.m - a.m || a.i - b.i)) { if (left <= 0) break; x.n++; left--; }
  return out.filter((x) => x.n > 0).map((x) => [x.id, x.n]);
}

/** EG7: the scenario's payout: its owed rolls become improvement rolls (scenarioRolls), dealt by marks and made in rounds */
export function payScenario(state: GameState, rng: Rng, f: ScenarioFrame, as: ScenarioEnding): void {
  const pr = state.player.progression;
  if (!pr || !pr.marks.length) return;
  const owed = owedBySkill(state.player);
  const rolls = scenarioRolls(state, pr.marks.length, f.tier, f.beyond, as);
  const dealt = dealRolls(owed, rolls);
  pr.marks = [];
  logCode(state, 'growth_paid', { owed: owed.reduce((n, [, m]) => n + m, 0), rolls, tier: f.tier, as, dealt });
  payRolls(state, rng, dealt);
}

/** the scenario `f` ends with `as`: pay its rolls, take levels, grant everything that waited, and leave the summary on stage.gains */
export function flushGrowth(state: GameState, f: ScenarioFrame, as: ScenarioEnding = 'interrupted', rng?: Rng): void { atScenarioEnd(() => flush(state, f, as, rng)); }
function flush(state: GameState, f: ScenarioFrame, as: ScenarioEnding, rng?: Rng): void {
  const live = state.stage.scenario === f || state.stage.outer === f;
  if (live && noted.get(f) !== state.turn) { noted.set(f, state.turn); readLog(state, (f.gains ??= empty())); }
  const pr = state.player.progression, mark = state.log.length;
  const g = f.gains ?? (live ? (f.gains = empty()) : empty());
  const start = f.xpStart ?? xpBar(state);
  const ids: string[] = [];
  if (pr) {
    if (rng) payScenario(state, rng, f, as);
    spendXp(state); // EG8: levels waited for this moment
    unlockClasses(state);
    const q = pr.pendingAchievements ?? [];
    delete pr.pendingAchievements;
    const had = new Set((pr.achievements ?? []).map((x) => x.id));
    for (const x of q) grantAchievement(state, x.key, x.of, x.reached, true);
    grantAllSteps(state, state.player, true);
    for (const x of pr.achievements ?? []) if (!had.has(x.id)) ids.push(x.id);
    readLog(state, g, mark);
  }
  const since = (pr?.xpLog ?? []).slice(f.xpFrom ?? 0);
  const end = xpBar(state);
  const achievements = (pr?.achievements ?? []).filter((a) => ids.includes(a.id)).map((a) => achievementInfo(state, a));
  state.stage.gains = {
    ...g, achievements, number: f.number, turn: state.turn,
    xp: { gained: since.reduce((n, x) => n + x.amount, 0), fromLevel: start.level, fromPct: start.pct, toLevel: end.level, toPct: end.pct },
    levelUps: since.filter((x) => x.levelUp).map((x) => ({ classId: x.levelUp!.classId, level: x.levelUp!.level })),
  };
}

/** the gains of the scenario that ended this turn, as the play page reads them (LogLine.scenarioGains) */
export function scenarioGainsNow(state: GameState): ScenarioGains | undefined {
  const g = state.stage.gains;
  if (!g || g.turn !== state.turn) return undefined;
  const { number: _n, turn: _t, ...rest } = g;
  return rest;
}
