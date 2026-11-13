// W7 pipeline unit tests with fake engine, views and save (the real ones are other workstreams' stubs for now).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState, Intent, Pending } from '../../src/types';
import type { TurnInput } from '../../src/engine';
import { makeVillage, ScriptedClaude, sentText } from '../harness';
import { createGame, VirtualClock, NEUTRAL_LINE, type Game } from '../../src/agents';
import { CONFIG } from '../../src/config';
import type { Store } from '../../src/save';
import { intentOf, plannerOut, voiceOut } from './agent-views';
import { SK } from '../../src/library/skillIds';

const H = vi.hoisted(() => ({
  engagedNext: [] as string[],
  resolved: [] as { at: number; input: TurnInput }[],
  clockNow: (): number => 0,
  firedOrders: [] as unknown[],
  beat: [] as string[],
  secrets: [] as unknown[],
  sets: [] as [string, unknown][],
  onResolve: null as ((s: GameState) => void) | null,
}));

vi.mock('../../src/engine', () => ({
  computePending: (s: GameState): Pending => ({ turn: s.turn + 1, mode: H.engagedNext.length ? 'tactical' : 'explore', engaged: [...H.engagedNext], fired: [] }),
  selectSpokespeople: (s: GameState, i: Intent) => (i.addressees ?? []).filter((id) => s.actors.some((a) => a.id === id)),
  unclearAddressee: () => null,
  fillSpeech: (_s: GameState, i: Intent) => i,
  quickWord: () => false,
  resolveSpeech: (_s: GameState, _i: Intent, sp: string[]) => ({ skill: SK.persuasion, playerTier: 'success', impression: 'convincing', perSpokesperson: Object.fromEntries(sp.map((id) => [id, {}])) }),
  firedOrders: () => H.firedOrders,
  beatSpeakers: () => H.beat,
  BEAT_OPENING: '(you speak first)',
  MUFFLED: '(muffled)',
  resolveTurn: (s: GameState, input: TurnInput) => {
    H.resolved.push({ at: H.clockNow(), input });
    H.onResolve?.(s);
    return [];
  },
}));
vi.mock('../../src/views', async () => {
  const f = await import('./agent-views');
  return {
    buildPlayerView: () => ({ ...f.playerView(), actors: [{ id: 'guard_1', label: 'a guard', zone: 'tav_common', level: 'full', gear: [] }] }),
    buildOppositionView: (_s: unknown, id: string) => ({ ...f.actorView(id), secrets: H.secrets }),
    buildDialogueView: (_s: unknown, id: string) => f.dialogueView(id),
    buildNarrationView: () => f.narrationView(),
    callName: () => 'player',
  };
});
vi.mock('../../src/save', () => ({
  saveTurn: vi.fn(async () => ({})),
  saveHistory: vi.fn(async () => {}),
  loadHistory: vi.fn(async () => []),
  loadStory: vi.fn(),
  undoTurn: vi.fn(),
  acquireTurnLock: (st: Store, id: string, owner: string) => st.acquireLease(`stories/${id}/control/lock`, owner, 1),
  releaseTurnLock: (st: Store, id: string, owner: string) => st.releaseLease(`stories/${id}/control/lock`, owner),
  listStories: vi.fn(async () => []),
}));

const store: Store = {
  get: async () => null, set: async (p, v) => { H.sets.push([p, v]); }, delete: async () => {}, list: async () => [],
  acquireLease: async () => true, releaseLease: async () => {},
};
const narr = { text: 'An old drinker nurses a mug.', narrated: ['e1'] };

let clock: VirtualClock;
let claude: ScriptedClaude;
let game: Game;
let state: GameState;

function start(engaged: string[] = []) {
  state = makeVillage();
  for (const a of state.actors) if (a.id === 'guard_1') Object.assign(a, { zone: 'tav_common' });
  state.pending = { turn: 1, mode: engaged.length ? 'tactical' : 'explore', engaged, fired: [] };
  game.adopt(state);
}
const parserTalk = (to: string) => intentOf({ action: { ...intentOf().action!, type: 'talk', skill: SK.persuasion, target: to }, spoken: 'Hello there.', addressees: [to] });

beforeEach(() => {
  clock = new VirtualClock();
  H.clockNow = () => clock.now();
  H.engagedNext = [];
  H.resolved = [];
  H.firedOrders = [];
  H.beat = [];
  H.secrets = [];
  H.sets = [];
  H.onResolve = null;
  claude = new ScriptedClaude(clock);
  game = createGame({ client: claude, clock, store });
});

describe('pipeline timing', () => {
  it('resolution never starts before the previous display plus BACKGROUND_WINDOW (explore)', async () => {
    start();
    claude.push('parser', intentOf(), { delayMs: 1000 }).push('narrator', narr, { delayMs: 2000 });
    await game.submit('look around', { aimed: false });
    expect(H.resolved[0].at).toBe(CONFIG.BACKGROUND_WINDOW_MS);
    expect(claude.calls.map((c) => c.agent)).toEqual(['parser', 'narrator']);
    expect(game.lines().at(-1)).toMatchObject({ kind: 'narration', text: narr.text });
    expect(game.state()!.turn).toBe(2);
    expect(game.calls()).toBe(2); // the Play screen's Claude-call count
  });

  it('a Planner back in time is used; a late one is discarded and logged planner_late', async () => {
    claude.push('planner', plannerOut(), { actorId: 'guard_1', delayMs: 5000 });
    start(['guard_1']);
    claude.push('parser', intentOf()).push('narrator', narr);
    await game.submit('wait', { aimed: false });
    expect(H.resolved[0].input.agentOutputs).toEqual([{ agent: 'planner', actorId: 'guard_1', output: plannerOut() }]);

    claude.push('planner', plannerOut(), { actorId: 'guard_1', delayMs: CONFIG.BACKGROUND_WINDOW_MS + 1000 });
    start(['guard_1']);
    claude.push('parser', intentOf()).push('narrator', narr);
    await game.submit('wait', { aimed: false });
    expect(H.resolved[1].input.agentOutputs).toEqual([]);
    const late = game.gm().agentLog.find((l) => l.agent === 'planner')!;
    expect(late.status).toBe('late');
    expect(late.errors).toContain('planner_late');
  });

  it('call cap: at most MAX_PLANNER_CALLS significant actors, nearest the player first; minor actors get none', async () => {
    state = makeVillage();
    const g = state.actors.find((a) => a.id === 'guard_1')!;
    const clones = ['guard_2', 'guard_3', 'guard_4'].map((id, i) => ({ ...structuredClone(g), id, zone: ['tav_common', 'street_door', 'field_far'][i] }));
    state.actors.push(...clones);
    state.pending = { turn: 1, mode: 'tactical', engaged: ['guard_4', 'guard_1', 'guard_3', 'guard_2', 'slime_1'], fired: [] };
    game.adopt(state);
    // Q4: background calls keep a call slot free for the turn, so they start one after another, nearest first
    await game.settle();
    expect(claude.calls.map((c) => c.actorId)).toEqual(['guard_2', 'guard_3', 'guard_1']);
  });
});

describe('clarify and dialogue', () => {
  it('clarify: turn unchanged, no resolution; the answer resolves with the Planner output already logged', async () => {
    claude.push('planner', plannerOut(), { actorId: 'guard_1', delayMs: 100 });
    start(['guard_1']);
    claude.push('parser', intentOf({ action: null, clarify: 'Which way?' }));
    await game.submit('go', { aimed: false });
    expect(game.state()!.turn).toBe(1);
    expect(H.resolved).toHaveLength(0);
    expect(game.lines().at(-1)).toMatchObject({ kind: 'clarify', text: 'Which way?' });
    claude.push('parser', intentOf()).push('narrator', narr);
    await game.submit('north', { aimed: false });
    expect(claude.callsFor('planner')).toHaveLength(1);
    expect(H.resolved[0].input.agentOutputs).toHaveLength(1);
  });

  it('dialogue intent cancels the addressee\'s Planner (logged unused) and shows results no earlier than DIALOGUE_WINDOW', async () => {
    claude.push('planner', plannerOut(), { actorId: 'guard_1', delayMs: 60_000 });
    start(['guard_1']);
    claude.push('parser', parserTalk('guard_1')).push('voice', voiceOut(), { actorId: 'guard_1' }).push('narrator', narr);
    await game.submit('Hello there, guard.', { aimed: false });
    const log = game.gm().agentLog;
    expect(log.find((l) => l.agent === 'planner')?.status).toBe('unused');
    expect(claude.calls.map((c) => c.agent)).toEqual(['planner', 'parser', 'voice', 'narrator']);
    expect(H.resolved[0].input.agentOutputs.map((o) => o.agent)).toEqual(['voice']);
    expect(clock.now()).toBeGreaterThanOrEqual(CONFIG.DIALOGUE_WINDOW_MS);
    expect(H.resolved[0].input.spokespeople).toEqual(['guard_1']);
  });

  it('an agenda routes to the Responder; a failed dialogue call gives the neutral line', async () => {
    start();
    state.hidden.memory.guard_1 = [{ turn: 1, text: 'saw a stranger' }];
    claude.push('parser', parserTalk('guard_1')).pushResponse({ agent: 'responder', response: { ok: false, error: 'upstream_error' } }).push('narrator', narr);
    await game.submit('Hello there.', { aimed: false });
    const out = H.resolved[0].input.agentOutputs[0];
    expect(out.agent).toBe('responder');
    expect(out.agent === 'responder' && out.output.dialogue?.line).toBe(NEUTRAL_LINE);
  });

  it('COMMITTED names the fired order; an unlisted secret is revealed, logged and filed as a bug (F6, Q3)', async () => {
    start();
    state.hidden.memory.guard_1 = [{ turn: 1, text: 'saw a stranger' }];
    state.hidden.firedLog.push({ triggerId: 't_grab', turn: state.turn, ownerId: 'guard_1' });
    H.firedOrders = [{ actorId: 'guard_1', type: 'attack', target: 'player', skill: null, intent: '', source: 'trigger', triggerId: 't_grab' }];
    H.secrets = [{ id: 's_bribe', holderId: 'guard_1', fact: 'took a bribe', leakTerms: ['bribe'], revealWhen: { type: 'event_in_zone', kind: 'k', zone: 'z' } }];
    claude.push('parser', parserTalk('guard_1'))
      .push('responder', { ...plannerOut({ type: 'talk', target: 'player' }), dialogue: { line: 'The bribe was small.', volume: 'normal' }, reveals: [] })
      .push('narrator', narr);
    await game.submit('Hello there.', { aimed: false });
    expect(sentText(claude.calls.find((c) => c.agent === 'responder')!)).toContain('trigger t_grab: attack player');
    const out = H.resolved[0].input.agentOutputs[0];
    expect(out.agent === 'responder' && out.output.reveals).toEqual(['s_bribe']);
    const bug = H.sets.find(([p]) => p.startsWith('bugs/'));
    expect(bug?.[1]).toMatchObject({ code: 'unlisted_reveal', actorId: 'guard_1', secretIds: ['s_bribe'], line: 'The bribe was small.' });
  });
  it('BG-50: a fired talk beat at the player gets a Responder line, and only that output counts for its owner', async () => {
    start();
    H.firedOrders = [{ actorId: 'guard_1', type: 'talk', target: 'player', skill: null, intent: '', source: 'trigger', triggerId: 't_beat' }];
    H.beat = ['guard_1'];
    claude.push('parser', intentOf({ action: null }))
      .push('responder', { ...plannerOut({ type: 'talk', target: 'player' }), dialogue: { line: 'Fancy a bout?', volume: 'normal' }, reveals: [] })
      .push('narrator', narr);
    await game.submit('I wait.', { aimed: false });
    const call = claude.calls.find((c) => c.agent === 'responder');
    expect(call && sentText(call)).toContain('you speak first');
    const input = H.resolved[0].input;
    expect(input.beatSpeakers).toEqual(['guard_1']);
    expect(input.agentOutputs.some((o) => o.actorId === 'guard_1' && o.agent === 'responder')).toBe(true);
  });
});

describe('errors and commands', () => {
  it('rate_limited: fallbacks, a notice, no background Planners until the next player action', async () => {
    start();
    H.engagedNext = ['trader'];
    state.actors.find((a) => a.id === 'trader')!.mind!.control = 'agent';
    claude.push('parser', parserTalk('guard_1')).pushResponse({ agent: 'voice', response: { ok: false, error: 'rate_limited' } }).push('narrator', narr);
    await game.submit('Hello there.', { aimed: false });
    expect(game.notices().map((n) => n.kind)).toContain('rate_limited');
    expect(claude.callsFor('planner')).toHaveLength(0); // skipped after the save
    const out = H.resolved[0].input.agentOutputs[0];
    expect(out.agent === 'voice' && out.output.line).toBe(NEUTRAL_LINE);
    expect(H.sets.find(([p]) => p.startsWith('bugs/'))?.[1]).toMatchObject({ code: 'agent_fallback', agent: 'voice', actorId: 'guard_1' }); // Q9: flagged for review
    claude.push('planner', plannerOut(), { actorId: 'trader' });
    claude.push('parser', intentOf()).pushResponse({ agent: 'narrator', response: { ok: false, error: 'upstream_error' } });
    await game.submit('look', { aimed: false });
    expect(game.notices().map((n) => n.kind)).not.toContain('rate_limited');
    expect(claude.callsFor('planner')).toHaveLength(1);
    expect(game.lines().at(-1)!.text).toContain('An old drinker is here'); // templated fallback narration
  });

  it('not_granted stops play', async () => {
    start();
    claude.pushResponse({ agent: 'parser', response: { ok: false, error: 'not_granted' } });
    await game.submit('look', { aimed: false });
    expect(game.notices().map((n) => n.kind)).toContain('stop_play');
    await game.submit('look', { aimed: false });
    expect(claude.calls).toHaveLength(1);
  });

  it('/stats marks tagged skills with ✦ and lists skills used that are not on the sheet', async () => {
    start();
    const p = game.state()!.player;
    delete p.core.skills[SK.unarmed_strike];
    p.progression!.used = [SK.unarmed_strike];
    await game.submit('/stats', { aimed: false });
    const t = game.lines().filter((l) => l.kind === 'command').at(-1)!.text;
    expect(t).not.toMatch(/\d\+/);
    if (Object.values(p.core.skills).some((v) => v.state === 'tagged')) expect(t).toContain('✦ tagged');
    expect(t).toContain('Also used, not on your sheet yet: Strike 0.');
  });

  it('commands make no Claude call; /aim sets aimed for one turn only', async () => {
    start();
    await game.submit('/stats', { aimed: false });
    await game.submit('/inv', { aimed: false });
    await game.submit('/help', { aimed: false });
    expect(claude.calls).toHaveLength(0);
    expect(game.lines().filter((l) => l.kind === 'command')).toHaveLength(3);
    await game.submit('/aim', { aimed: false });
    claude.push('parser', intentOf()).push('narrator', narr).push('parser', intentOf()).push('narrator', narr);
    await game.submit('strike', { aimed: false });
    await game.submit('strike', { aimed: false });
    expect(H.resolved.map((r) => r.input.aimed)).toEqual([true, false]);
    expect(game.lines().filter((l) => l.kind === 'player').map((l) => l.aimed)).toEqual([true, undefined]); // shown after a reload
  });

  it('a narration line keeps the turn\'s gear rows, the place it ended in and the scenario number', async () => {
    start();
    H.onResolve = (s) => {
      const inv = s.player.core.inventory;
      const coin = inv.find((i) => i.id === 'player_coin')!;
      coin.qty = 15;
      const sword = inv.find((i) => i.equippedIn?.some((x) => x.startsWith('grip:')))!;
      sword.equippedIn = [];
      inv.push({ id: 'found_1', itemId: 'odd_stone', qty: 1 });
      s.stage.scenarioNumber = 3;
    };
    claude.push('parser', intentOf()).push('narrator', narr);
    await game.submit('look around', { aimed: false });
    const l = game.lines().at(-1)!;
    expect(l.gear).toEqual(['Put away: arming sword', 'Used: coin', 'Picked up: odd_stone']);
    expect(l.place).toEqual({ id: state.player.placeId, name: expect.stringMatching(/^[A-Z]/), zone: 'common room' });
    expect(l.scenario).toBe(3);
  });
});

describe('story text (Q18)', () => {
  it('saves the story column after each turn, from the first unsaved line', async () => {
    const save = await import('../../src/save');
    const sh = vi.mocked(save.saveHistory);
    sh.mockClear();
    start();
    claude.push('parser', intentOf()).push('narrator', narr);
    await game.submit('look around', { aimed: false });
    expect(sh).toHaveBeenCalledTimes(1);
    const [, id, lines, from] = sh.mock.calls[0];
    expect(id).toBe(state.storyId);
    expect(from).toBe(0);
    expect(lines.map((l) => l.kind)).toEqual(['player', 'narration']);
    await game.submit('/stats', { aimed: false });
    expect(sh).toHaveBeenCalledTimes(1); // commands are saved with the next turn
    claude.push('parser', intentOf()).push('narrator', narr);
    await game.submit('look around', { aimed: false });
    expect(sh.mock.calls[1][3]).toBe(2);
  });
});

describe('SD1 scenario ending moment', () => {
  it('a turn that ends a scenario says how while its calls run, and its line carries the ending and the closing line', async () => {
    start();
    H.onResolve = (s) => { s.stage.scenario = { number: 1 } as NonNullable<GameState['stage']['scenario']>; s.stage.ended = { as: 'escaped', text: 'hidden' }; s.stage.breakCause = 'scenario_end'; };
    const seen: unknown[] = [];
    game.subscribe(() => seen.push(game.scenarioEnding()));
    claude.push('parser', intentOf()).push('narrator', { ...narr, closing: 'The cellar door slams behind you.' });
    await game.submit('run', { aimed: false });
    expect(seen).toContainEqual({ as: 'escaped', name: 'escaped' });
    expect(game.scenarioEnding()).toBeNull();
    expect(game.lines().at(-1)).toMatchObject({ kind: 'narration', text: narr.text, scenarioEnd: { as: 'escaped', name: 'escaped', closing: 'The cellar door slams behind you.' } });
    expect(sentText(claude.calls.at(-1)!)).toContain('"scenarioEnded":"escaped"');
    expect(sentText(claude.calls.at(-1)!)).not.toContain('hidden');
  });
  it('a closing line on any other turn is dropped', async () => {
    start();
    claude.push('parser', intentOf()).push('narrator', { ...narr, closing: 'Stray.' });
    await game.submit('wait', { aimed: false });
    expect(game.lines().at(-1)).not.toHaveProperty('scenarioEnd');
  });
});
