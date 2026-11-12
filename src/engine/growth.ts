// D-226 (LF3): growth lands at the end of a scenario. While a scenario runs, the player's achievements (grantAchievement
// queues them) and All-XXX steps wait; when the scenario ends, closeScenario calls flushGrowth, which grants them all at once
// and leaves one gains summary (stage.gains, then LogLine.scenarioGains) for the ending moment's pop-up. In free roam they come
// at once (growthWaits). The summary also lists what already landed during the scenario: skill raises, XP and levels.
import type { GameState, ScenarioFrame, ScenarioGains } from '../types';
import { getLibrary } from '../library';
import { grantAllSteps } from '../ruleset/allSteps';
import { achievementInfo, charLevel, grantAchievement, xpToNext } from './xp';

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

/** the scenario `f` ends: grant everything that waited, then add XP, levels and achievements, and leave the summary on stage.gains */
export function flushGrowth(state: GameState, f: ScenarioFrame): void {
  const live = state.stage.scenario === f || state.stage.outer === f;
  if (live && noted.get(f) !== state.turn) { noted.set(f, state.turn); readLog(state, (f.gains ??= empty())); }
  const pr = state.player.progression, mark = state.log.length;
  const g = f.gains ?? (live ? (f.gains = empty()) : empty());
  const start = f.xpStart ?? xpBar(state);
  const ids: string[] = [];
  if (pr) {
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
