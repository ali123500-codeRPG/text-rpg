// 300 Why a scenario started (SW3 a, SW6 a). In free roam the roam keeps what
// happened (attacks included); the start that ends it hands the Weaver the reason, those lines and who saw the player.
// Taking a job or making a deal starts a scenario about it once ROAM_MIN_TURNS have passed.
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage } from '../harness/village';
import { intent, narrateAll } from '../harness/turn';
import { ScriptedClaude } from '../harness/scripted';
import { createGame, VirtualClock } from '../../src/agents';
import { createDirector } from '../../src/agents/director';
import { memoryStore } from '../../src/save';
import { checkRoam } from '../../src/engine/chase';
import { noteHappened } from '../../src/engine/happened';
import { buildWeaverView } from '../../src/views';
import { CONFIG } from '../../src/config';

const ev = (turn: number, e: Partial<GameEvent>): GameEvent => ({ id: `e${Math.random()}`, turn, actorId: 'player', kind: 'idle', zone: 'tav_common', effects: [], noise: 'normal', visibility: 'normal', perception: {}, ...e } as GameEvent);

describe('300 why a scenario started', () => {
  it('SW6 a: a job taken in free roam starts a scenario about it once ROAM_MIN_TURNS have passed, even with nothing else going on', () => {
    const s = makeVillage();
    delete s.stage.scenario;
    s.stage.roam = { since: s.turn - 1 };
    s.log.push({ turn: s.turn, code: 'quest_made', detail: { id: 'q1', giver: 'trader' } });
    checkRoam(s, []);
    expect(s.stage.breakCause).toBeUndefined(); // too soon: remembered, not started
    expect(s.stage.roam.job).toBe(s.turn);
    s.turn = s.stage.roam.since + CONFIG.ROAM_MIN_TURNS;
    checkRoam(s, []);
    expect(s.stage.breakCause).toBe('roam');
    expect(s.log.at(-1)).toMatchObject({ code: 'roam_scenario', detail: { why: 'job' } });
  });

  it('SW6 a: a deal between NPCs alone starts nothing; one with the player does', () => {
    const s = makeVillage();
    delete s.stage.scenario;
    s.stage.roam = { since: s.turn - CONFIG.ROAM_MIN_TURNS };
    s.log.push({ turn: s.turn, code: 'agreement_made', detail: { id: 'd1', parties: ['trader', 'patron_1'] } });
    checkRoam(s, []);
    expect(s.stage.breakCause).toBeUndefined();
    s.log.push({ turn: s.turn, code: 'agreement_made', detail: { id: 'd2', parties: ['trader', 'player'] } });
    checkRoam(s, []);
    expect(s.stage.cause?.why).toBe('job');
  });

  it('SW3 a: free roam keeps what happened, attacks included; the start hands it to the Weaver with who saw the player', () => {
    const s = makeVillage();
    delete s.stage.scenario;
    s.stage.roam = { since: s.turn - 1 };
    s.actors.find((a) => a.id === 'trader')!.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    const events = [ev(s.turn, { kind: 'attack', target: 'patron_1' })];
    noteHappened(s, events, []);
    checkRoam(s, events);
    expect(s.stage.cause).toMatchObject({ why: 'attack', happened: [{ turn: s.turn, text: expect.stringMatching(/^the player attacked /) }] });
    expect(s.stage.cause!.seenBy).toContain('trader');
    const v = buildWeaverView(s, { kind: 'scenario', placeId: s.player.placeId });
    expect(v.target.cause).toEqual(s.stage.cause);
    expect(buildWeaverView(s, { kind: 'checkin', placeId: s.player.placeId }).target.cause).toBeUndefined();
  });

  it('SW3 a (whole turn): an attack in free roam starts a scenario whose Weaver view says why; the plan clears it', async () => {
    const clock = new VirtualClock(), claude = new ScriptedClaude(clock);
    const game = createGame({ client: claude, clock, store: memoryStore(), director: createDirector(clock) });
    const state = makeVillage();
    state.pending = { turn: state.turn, mode: 'explore', engaged: [], fired: [] };
    delete state.stage.scenario;
    state.stage.roam = { since: state.turn - 1 };
    claude.defaults.narrator = narrateAll();
    game.adopt(state);
    const g = { claude, game };
    g.claude.push('parser', intent({ action: { type: 'attack', skill: '', target: 'patron_1', targetPart: null, item: null, mode: null, approach: '', stance: 'normal' } }));
    await g.game.submit('I punch the patron', { aimed: false });
    await g.game.settle();
    const call = g.claude.callsFor('weaver').at(-1)!;
    const data = call.input[1].content;
    const view = JSON.parse(data.slice(data.indexOf('WEAVER_VIEW:\n') + 13, data.indexOf('\n\nCATALOGS:') >= 0 ? data.indexOf('\n\nCATALOGS:') : undefined));
    expect(view.target.cause.why).toBe('attack');
    expect(view.target.cause.happened.map((h: { text: string }) => h.text)).toContain('the player attacked ' + g.game.state()!.actors.find((a) => a.id === 'patron_1')!.names.current);
    expect(call.input[0].content).toMatch(/target\.cause is set/);
    expect(g.game.state()!.stage.cause).toBeUndefined();
  });
});
