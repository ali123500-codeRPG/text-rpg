// UG1–UG17: goal holders (uniques). Each keeps 1 to GOALS_HELD goals and a queue of steps code runs with no call (go,
// routine, wait). It thinks (one Planner call, src/agents/game.ts goalThinkers) when its queue runs out or a step fails,
// when it perceives something a goal names, or whenever it would get a Planner call anyway (engaged, talked to, a deal).
// No call runs inside a long turn: queued steps run on through it by code (runSteps in the night and stretch loops).
import type { Actor, Drive, GameState, GoalOps, GoalStep } from '../types';
import { CONFIG } from '../config';
import { DAY_MINUTES, minutesUntil, now } from '../time';
import { headTo, switchRoutine } from '../minds';
import { HEAD_TO } from '../minds/routines';
import { actorById, isActive, zoneById } from './relations';
import { logCode } from './effects';
import { buildActorView } from '../views';

/** the shared routine a wait step runs: it stays where it stands (slot 'here') */
const WAIT = 'wait';

const addGoals = (state: GameState, d: Drive, add: GoalOps['add']) => {
  for (const g of add) if (d.goals.length < CONFIG.GOALS_HELD && g.text.trim()) d.goals.push({ text: g.text.trim(), ...(g.about?.length ? { about: [...g.about] } : {}), turn: state.turn });
};

/** UG3: a cast actor's goals: its template's standing goal first, then the Weaver's; it thinks on its first turn */
export function seedGoals(state: GameState, a: Actor, add: GoalOps['add'], standing?: string): void {
  const drives = (state.hidden.drives ??= {});
  const d = (drives[a.id] ??= { goals: [], steps: [] });
  if (standing && !d.goals.some((g) => g.standing)) d.goals.unshift({ text: standing, standing: true, turn: state.turn });
  addGoals(state, d, add);
  if (!d.goals.length) delete drives[a.id];
  else d.think ??= 'cast';
}

/** UG5/UG16: a goal holder's Planner or Responder output: goals met, failed or added; a new queue of steps. A standing goal
 * is dropped only when met. Any output counts as its think, so a pending think is cleared. */
export function applyGoals(state: GameState, a: Actor, ops: GoalOps | null | undefined, steps: GoalStep[] | null | undefined): void {
  const d = state.hidden.drives?.[a.id];
  if (!d) return;
  delete d.think;
  if (ops) {
    d.goals = d.goals.filter((g, i) => !ops.met.includes(i + 1) && !(ops.failed.includes(i + 1) && !g.standing));
    addGoals(state, d, ops.add);
    logCode(state, 'goals_changed', { actorId: a.id, met: ops.met, failed: ops.failed, added: ops.add.length });
  }
  if (steps) {
    d.steps = steps.slice(0, CONFIG.STEPS_QUEUED);
    startStep(state, a, d);
  }
}

/** UG11: begin the first step it can; one that can't begin is dropped (logged step_failed). None left: the queue is done. */
function startStep(state: GameState, a: Actor, d: Drive): void {
  const m = a.mind;
  if (m?.routine && m.routines?.includes(m.routine.id) && !d.back) d.back = { ...m.routine };
  let failed = false;
  while (d.steps.length) {
    const s = d.steps[0];
    if (m && begin(state, a, s)) {
      const t = now(state);
      const cap = CONFIG.STEP_MAX_DAYS * DAY_MINUTES;
      d.endsAt = t + (s.until?.at ? Math.min(minutesUntil(t, s.until.at), cap) : cap);
      return;
    }
    logCode(state, 'step_failed', { actorId: a.id, step: s });
    d.steps.shift();
    failed = true;
  }
  endQueue(a, d, failed ? 'steps failed' : 'steps done');
}

function begin(state: GameState, a: Actor, s: GoalStep): boolean {
  if (s.go) return headTo(state, a, s.go, 'agent', s.lead);
  if (s.routine) return switchRoutine(state, a, s.routine, 'agent');
  if (!s.wait) return false;
  a.mind!.routine = { id: WAIT, anchorTurn: state.turn, at: now(state) };
  a.mind!.slots = { ...a.mind!.slots, here: a.zone };
  return true;
}

/** UG10: the queue ran out: back to its own routine (after a walk or a wait), and it thinks next if it holds goals (UG7 1) */
function endQueue(a: Actor, d: Drive, why: string): void {
  d.steps = [];
  delete d.endsAt;
  const m = a.mind;
  if (m && d.back && !(m.routine && m.routines?.includes(m.routine.id)) && m.routine?.id !== HEAD_TO) m.routine = d.back;
  delete d.back;
  if (d.goals.length) d.think ??= why;
}

const stepDone = (state: GameState, a: Actor, d: Drive): boolean => {
  const s = d.steps[0];
  if (now(state) >= (d.endsAt ?? Infinity)) return true;
  if (s.go) return a.mind?.routine?.id !== HEAD_TO; // headArrivals ended the walk
  return !!s.until?.arrival && actorById(state, s.until.arrival)?.zone === a.zone;
};

/** UG16: each goal holder's step that is over gives way to the next; runs at the end of a turn and inside long turns */
export function runSteps(state: GameState): void {
  for (const [id, d] of Object.entries(state.hidden.drives ?? {})) {
    const a = actorById(state, id);
    if (!a || a.kind === 'player' || !isActive(a) || !d.steps.length || !stepDone(state, a, d)) continue;
    logCode(state, 'step_done', { actorId: id, step: d.steps[0] });
    d.steps.shift();
    startStep(state, a, d);
  }
}

/** UG7 moment 3: a goal holder that comes to perceive something one of its goals names (a person in sight, the zone or
 * place it stands in, an item it holds or that lies where it is) thinks next. It must lose it first to be woken by it again. */
export function noticeGoals(state: GameState): void {
  for (const [id, d] of Object.entries(state.hidden.drives ?? {})) {
    const named = new Set(d.goals.flatMap((g) => g.about ?? []));
    const a = actorById(state, id);
    if (!named.size || !a || a.kind === 'player' || !isActive(a) || a.asleep) continue;
    const z = zoneById(state, a.zone);
    const here = new Set<string>([
      a.zone, ...(z ? [z.placeId, ...z.groundItems.flatMap((i) => [i.id, i.itemId])] : []),
      ...a.core.inventory.flatMap((i) => [i.id, i.itemId]),
      ...buildActorView(state, id).seen.map((s) => s.id),
    ]);
    const now_ = [...named].filter((x) => here.has(x));
    const fresh = now_.filter((x) => !d.noticed?.includes(x));
    if (now_.length) d.noticed = now_;
    else delete d.noticed;
    if (fresh.length) d.think ??= `noticed ${fresh.join(', ')}`;
  }
}
