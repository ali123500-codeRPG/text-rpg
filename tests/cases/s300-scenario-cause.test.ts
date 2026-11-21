// 300 Why a scenario started (SW3 a, SW6 a, WB5-WB7). In free roam the roam keeps what happened (attacks included); danger
// starts a scenario at once, and anything else that matters (a job, a goal reached, a stale job, a quiet stretch past the rest)
// opens a window the Weaver may decline. The Weaver is told the reason, those lines and who saw the player.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness/village';
import { intent, narrateAll } from '../harness/turn';
import { ScriptedClaude } from '../harness/scripted';
import { createGame, VirtualClock } from '../../src/agents';
import { createDirector } from '../../src/agents/director';
import { memoryStore } from '../../src/save';
import { applyWindow, checkRoam, roamWindow } from '../../src/engine/chase';
import { closeScenario, frameOf } from '../../src/engine/scenarioEnd';
import { ScenarioDirector } from '../../src/scenario';
import { VirtualClock as SceneClock } from '../../src/scenario/fixtures';
import { now } from '../../src/time';
import { CONFIG } from '../../src/config';


describe('300 why a scenario started', () => {
  it('WB6 / SW6 a: a job taken opens a scenario window at once, even in the rest; with no window call wired it starts', () => {
    const s = makeVillage();
    delete s.stage.scenario;
    s.stage.roam = { since: s.turn - 1, sinceMin: now(s), rest: CONFIG.ROAM_REST_MIN.extreme };
    s.log.push({ turn: s.turn, code: 'quest_made', detail: { id: 'q1', giver: 'trader' } });
    checkRoam(s, []);
    expect(s.stage.breakCause).toBeUndefined(); // the Weaver is asked first
    expect(s.stage.window).toBe('due');
    expect(s.log.at(-1)).toMatchObject({ code: 'window_opened', detail: { why: 'job' } });
    const d = new ScenarioDirector({ weave: async () => null, clock: new SceneClock() });
    d.afterSave(s);
    expect(s.stage.window).toBe('asked');
    applyWindow(s, d.takeWindow()!);
    expect(s.stage.breakCause).toBe('roam');
    expect(s.stage.cause?.why).toBe('job');
    expect(s.stage.window).toBeUndefined();
  });

  it('WB6/WB7: a deal between NPCs alone opens nothing, one with the player does, and so does a job\'s goal reached; quiet and stale windows wait out the rest (longer after a harder scenario) and a declined window', () => {
    const s = makeVillage();
    delete s.stage.scenario;
    s.stage.roam = { since: s.turn - 1, sinceMin: now(s), rest: 0 };
    s.log.push({ turn: s.turn, code: 'agreement_made', detail: { id: 'd1', parties: ['trader', 'patron_1'] } });
    expect(roamWindow(s)).toBeNull();
    s.log.push({ turn: s.turn, code: 'agreement_made', detail: { id: 'd2', parties: ['trader', 'player'] } });
    expect(roamWindow(s)).toBe('job');
    s.log = s.log.filter((l) => l.code !== 'agreement_made');
    s.log.push({ turn: s.turn, code: 'quest_ready', detail: { id: 'q1' } });
    expect(roamWindow(s)).toBe('quest');
    s.log = s.log.filter((l) => l.code !== 'quest_ready');
    const t = now(s), rest = CONFIG.ROAM_REST_MIN.major;
    expect(rest).toBeGreaterThan(CONFIG.ROAM_REST_MIN.minor);
    s.stage.roam = { since: s.turn - 1, sinceMin: t - rest - CONFIG.ROAM_QUIET_MIN + 1, rest };
    expect(roamWindow(s)).toBeNull(); // a minute short of the rest plus the quiet stretch
    s.stage.roam.sinceMin! -= 1;
    expect(roamWindow(s)).toBe('quiet');
    s.quests.push({ id: 'q1', state: 'active', text: 'mend the gate', giver: 'trader', dealId: 'd1', goal: { kind: 'other' }, progress: 0, level: 'i', startTurn: 1, startAt: t - CONFIG.THREAD_STALE_MIN } as never);
    expect(roamWindow(s)).toBe('stale');
    s.stage.cause = { why: 'stale', happened: [], seenBy: [] };
    s.stage.window = 'asked';
    applyWindow(s, { start: false, note: 'let them explore' });
    expect(s.stage.breakCause).toBeUndefined();
    expect(s.stage.cause).toBeUndefined();
    expect(s.log.at(-1)).toMatchObject({ code: 'window_declined', detail: { why: 'stale' } });
    expect(roamWindow(s)).toBeNull(); // WINDOW_DECLINED_MIN after a decline
    s.stage.roam.declinedAt! -= CONFIG.WINDOW_DECLINED_MIN;
    expect(roamWindow(s)).toBe('stale');
  });

  it('WB7: a scenario that ends into free roam sets the rest by its challenge grade', () => {
    const s = makeVillage();
    s.hidden.stage = { ...s.hidden.stage, challenge: 'major' };
    s.stage.scenario = frameOf(s, { question: 'q', scale: 'situation', endings: [] }, 'success', (_k, r) => r);
    s.stage.ended = { as: 'resolved', text: '' };
    s.stage.breakCause = 'scenario_end';
    expect(closeScenario(s)).toBe('roam');
    expect(s.stage.roam).toMatchObject({ since: s.turn, sinceMin: now(s), rest: CONFIG.ROAM_REST_MIN.major });
  });

  it('SW3 a (whole turn): an attack in free roam starts a scenario whose Weaver view says why; the plan clears it once applied', async () => {
    const clock = new VirtualClock(), claude = new ScriptedClaude(clock);
    const game = createGame({ client: claude, clock, store: memoryStore(), director: createDirector(clock) });
    const state = makeVillage();
    state.pending = { turn: state.turn, mode: 'explore', engaged: [], fired: [] };
    delete state.stage.scenario;
    state.stage.roam = { since: state.turn - 1 };
    claude.defaults.narrator = narrateAll();
    game.adopt(state);
    const g = { claude, game };
    g.claude.push('parser', intent({ action: { type: 'attack', skill: '', target: 'patron_1', targetPart: null, item: null, mode: null, approach: '' } }));
    await g.game.submit('I punch the patron', { aimed: false });
    await g.game.settle();
    const call = g.claude.callsFor('weaver').at(-1)!;
    const data = call.input[1].content;
    const view = JSON.parse(data.slice(data.indexOf('WEAVER_VIEW:\n') + 13, data.indexOf('\n\nCATALOGS:') >= 0 ? data.indexOf('\n\nCATALOGS:') : undefined));
    expect(view.target.cause.why).toBe('attack');
    expect(view.target.cause.happened.map((h: { text: string }) => h.text)).toContain('the player attacked ' + g.game.state()!.actors.find((a) => a.id === 'patron_1')!.names.current);
    expect(call.input[0].content).toMatch(/target\.cause is set/);
    expect(g.game.state()!.stage.cause).toBeDefined(); // BG-238: planned in the background, applied after the next turn
    g.claude.push('parser', intent());
    await g.game.submit('look around', { aimed: false });
    await g.game.settle();
    expect(g.game.state()!.stage.cause).toBeUndefined();
  });

});
