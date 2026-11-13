// UG1–UG17 (Goal-driven uniques): a goal holder keeps goals and a queue of steps code runs with no call; it thinks when the
// queue runs out or a step fails, when it perceives what a goal names, and as before when engaged or talked to. One think a
// turn, after fight calls. Steps run on through long turns; a step with no end stops after STEP_MAX_DAYS.
import { expect, it } from 'vitest';
import { makeVillage, place, createRng } from '../harness';
import { getLibrary, setLibrary } from '../../src/library';
import { echoSheet, uniqueTemplate } from '../../src/library/echo';
import { RC } from '../../src/library/raceIds';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { setupGame, narrateAll, npcAction, intent as turnIntent } from '../harness/turn';
import { act, play, plannerOut } from './w4-kit';
import { seedGoals, runSteps, noticeGoals } from '../../src/engine/goals';
import { hasAgenda, actorById } from '../../src/engine/relations';
import { goalThinkers } from '../../src/agents/game';
import { buildActorView, buildWeaverView } from '../../src/views';
import { checkPlanner } from '../../src/agents/schema';
import { PLANNER_INSTRUCTIONS, RESPONDER_INSTRUCTIONS, VOICE_INSTRUCTIONS } from '../../src/agents/prompts';
import { CONFIG } from '../../src/config';
import { DAY_MINUTES, now } from '../../src/time';

const village = () => makeVillage({ playerZone: 'street_square', without: ['slime_1', 'slime_2'] });

it('a cast goal holder holds its standing goal first, has an agenda and thinks on its first turn', () => {
  const s = village();
  const wim = actorById(s, 'patron_1')!;
  seedGoals(s, wim, [{ text: 'pay off my debt to Mags', about: ['trader'] }], 'never go hungry again');
  const d = s.hidden.drives!.patron_1;
  expect(d.goals.map((g) => g.text)).toEqual(['never go hungry again', 'pay off my debt to Mags']);
  expect(d.goals[0].standing).toBe(true);
  expect(hasAgenda(s, 'patron_1')).toBe(true); // the Responder voices it
  expect(goalThinkers(s, new Set())).toEqual(['patron_1']);
  expect(goalThinkers(s, new Set(['patron_1']))).toEqual([]); // already getting a Planner call
  const v = buildActorView(s, 'patron_1');
  expect(v.goals?.map((g) => g.n)).toEqual([1, 2]);
  expect(v.thinkWhy).toBe('cast');
});

it('nothing seeds a drive without goals; other NPCs never think by goals', () => {
  const s = village();
  seedGoals(s, actorById(s, 'patron_1')!, []);
  expect(s.hidden.drives?.patron_1).toBeUndefined();
  expect(goalThinkers(s, new Set())).toEqual([]);
});

it('its think queues steps: code walks it there, then the queue runs out and it thinks again', () => {
  const s = village();
  const wim = actorById(s, 'patron_1')!;
  seedGoals(s, wim, [{ text: 'see the square' }]);
  play(s, { agentOutputs: [plannerOut('patron_1', act('hold'), { steps: [{ go: 'street_square' }], goals: { met: [], failed: [], add: [] } })] });
  const d = s.hidden.drives!.patron_1;
  expect(d.think).toBeUndefined(); // it has thought
  for (let i = 0; i < 40 && d.steps.length; i++) play(s);
  expect(wim.zone).toBe('street_square');
  expect(d.steps).toEqual([]);
  expect(d.think).toBe('steps done'); // UG7 moment 1
  expect(wim.mind!.routines).toContain(wim.mind!.routine?.id); // back on its own routine (UG10)
});

it('a step that cannot begin is dropped and the next one begins', () => {
  const s = village();
  const wim = actorById(s, 'patron_1')!;
  seedGoals(s, wim, [{ text: 'wait for Mags' }]);
  play(s, { agentOutputs: [plannerOut('patron_1', act('hold'), { steps: [{ routine: 'no_such_routine' }, { wait: true, until: { arrival: 'trader' } }] })] });
  const d = s.hidden.drives!.patron_1;
  expect(s.log.some((l) => l.code === 'step_failed')).toBe(true);
  expect(d.steps).toEqual([{ wait: true, until: { arrival: 'trader' } }]);
  expect(wim.mind!.routine?.id).toBe('wait');
});

it('goals met are dropped, a standing goal survives failing, and at most GOALS_HELD are held', () => {
  const s = village();
  const wim = actorById(s, 'patron_1')!;
  seedGoals(s, wim, [{ text: 'a' }, { text: 'b' }], 'stand');
  play(s, { agentOutputs: [plannerOut('patron_1', act('hold'), { goals: { met: [2], failed: [1], add: [{ text: 'c' }, { text: 'd' }, { text: 'e' }] } })] });
  expect(s.hidden.drives!.patron_1.goals.map((g) => g.text)).toEqual(['stand', 'b', 'c'].slice(0, CONFIG.GOALS_HELD));
});

it('a step with no end stops after STEP_MAX_DAYS', () => {
  const s = village();
  const wim = actorById(s, 'patron_1')!;
  seedGoals(s, wim, [{ text: 'keep watch' }]);
  play(s, { agentOutputs: [plannerOut('patron_1', act('hold'), { steps: [{ wait: true }] })] });
  const d = s.hidden.drives!.patron_1;
  expect(d.endsAt! - now(s)).toBeLessThanOrEqual(CONFIG.STEP_MAX_DAYS * DAY_MINUTES);
  s.clocks.time = d.endsAt!; // the days pass (a long turn runs runSteps on its clock)
  runSteps(s);
  expect(d.steps).toEqual([]);
  expect(d.think).toBe('steps done');
});

it('perceiving what a goal names wakes a think once, until it is lost from sight again', () => {
  const s = village();
  const wim = actorById(s, 'patron_1')!;
  seedGoals(s, wim, [{ text: 'catch the player alone', about: ['player'] }]);
  place(s, 'patron_1', 'street_square');
  play(s, { agentOutputs: [plannerOut('patron_1', act('hold'), { steps: [{ wait: true }] })] }); // its think, then it sees the player
  const d = s.hidden.drives!.patron_1;
  expect(d.think).toBe('noticed player');
  delete d.think;
  noticeGoals(s);
  expect(d.think).toBeUndefined(); // still in sight: no new think
  place(s, 'patron_1', 'tav_cellar');
  noticeGoals(s);
  place(s, 'patron_1', 'street_square');
  noticeGoals(s);
  expect(d.think).toBe('noticed player'); // lost and seen again
});

it('the Planner and Responder are told about goals and steps; the Voice is not', () => {
  const v = checkPlanner({ action: act('hold'), dialogue: null, gear: null, stance: null, planUpdate: null,
    goals: { met: [1], add: [{ text: 'find the smith', about: ['smith'] }] }, steps: [{ go: 'z1', lead: 'player' }, { routine: 'patron', until: { at: 'Dusk' } }] });
  expect(v.errors).toEqual([]);
  expect(v.value.goals).toEqual({ met: [1], failed: [], add: [{ text: 'find the smith', about: ['smith'] }] });
  expect(v.value.steps?.[1].until?.at).toBe('dusk');
  for (const p of [PLANNER_INSTRUCTIONS, RESPONDER_INSTRUCTIONS]) expect(p).toContain('If your view lists goals');
  expect(VOICE_INSTRUCTIONS).not.toContain('If your view lists goals');
});

it('whole turn: a goal holder away from any fight gets its one think in the background, and its steps apply', async () => {
  const g = setupGame({ playerZone: 'street_square', without: ['slime_1', 'slime_2'] });
  g.claude.defaults.narrator = narrateAll();
  seedGoals(g.state, actorById(g.state, 'patron_1')!, [{ text: 'see who is in the square', about: ['street_square'] }]);
  g.claude.push('planner', { action: npcAction('hold', null), dialogue: null, gear: null, stance: null, planUpdate: null,
    steps: [{ go: 'street_square' }] }, { actorId: 'patron_1' });
  g.start();
  g.claude.push('parser', turnIntent());
  await g.game.submit('look around', { aimed: false });
  await g.game.settle();
  const req = g.claude.callsFor('planner', 'patron_1')[0] as { input: { content: string }[] };
  expect(req.input[1].content).toContain('see who is in the square');
  const d = g.game.state()!.hidden.drives!.patron_1;
  expect(d.think).toBeUndefined();
  expect(d.steps).toEqual([{ go: 'street_square' }]);
});

it('the Weaver casts a unique from catalogs.uniques with goals: it arrives holding them, its standing goal first, and thinks first', () => {
  const s = toStoryStart(makeVillage());
  const ECHO = 'TP_echo_goals', lib = getLibrary();
  const t = { ...uniqueTemplate(ECHO, RC.human, 'a grim swordsman', echoSheet(s, s.player, ECHO, 'fell to a slime in the east field')), standingGoal: 'never fall again' };
  setLibrary({ ...lib, templates: { ...lib.templates, [ECHO]: t } });
  try {
    expect(buildWeaverView(s, { kind: 'scenario', placeId: 'tavern' }).catalogs.uniques.map((u) => u.id)).toContain(ECHO);
    const plan = villageStagePlan();
    plan.cast.push({ ...plan.cast[0], key: 'echo', template: ECHO, name: 'Aldric', goals: [{ text: 'finish what began in the east field', about: ['player', 'tavern'] }] });
    const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
    expect(validateStagePlan(s, plan, ctx)).toEqual([]);
    applyStagePlan(s, plan, ctx, { entry: 'open' }, createRng(1));
    const echo = s.actors.find((a) => a.core.templateId === ECHO)!;
    expect(echo.core.generation).toBe('unique');
    const d = s.hidden.drives![echo.id];
    expect(d.goals.map((g) => g.text)).toEqual(['never fall again', 'finish what began in the east field']);
    expect(d.goals[1].about).toEqual([s.player.id, 'tavern']);
    expect(d.think).toBe('cast');
    expect(goalThinkers(s, new Set())).toContain(echo.id);
    const others = s.actors.filter((a) => a.kind !== 'player' && a.id !== echo.id).map((a) => a.id);
    expect(others.some((id) => s.hidden.drives?.[id])).toBe(false); // only the unique holds goals
  } finally { setLibrary(lib); }
});
