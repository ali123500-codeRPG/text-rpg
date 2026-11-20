// 403 D-20 b: the rest of a long order (the Parser's deferred) is queued and plays one step per turn when the player sends
// it (Enter in the empty box sends the next step). The queue stops the moment anything new happens to the player: they are
// seen, hit or spoken to, someone comes into view, or a step fails; the rest is then only offered (next), as before.
import { describe, expect, it } from 'vitest';
import type { GameEvent, LogLine } from '../../src/types';
import { intent, wholeTurn } from '../harness/turn';
import { makeVillage } from '../harness/village';
import { orderStops, queuedSteps, watchOrder } from '../../src/engine';

const ev = (e: Partial<GameEvent>): GameEvent => ({ id: 'e1', turn: 1, actorId: 'guard_1', kind: 'idle', zone: 'tav_common', effects: [], noise: 'normal', visibility: 'normal', perception: {}, ...e } as GameEvent);

describe('403 the rest of a long order is queued, one step per turn', () => {
  it('each step plays as the next turn and keeps the rest; a new order drops it', async () => {
    const g = wholeTurn({ without: ['slime_1', 'slime_2', 'guard_1'] });
    const pass = intent({ action: null });
    await g.turn({ ...pass, deferred: ['I wait a moment', 'I look at the hearth'] }, 'I wait, wait again, then look at the hearth');
    expect(g.game.lines().at(-1)).toMatchObject({ kind: 'narration', queue: ['I wait a moment', 'I look at the hearth'] });
    expect(g.game.lines().at(-1)!.next).toBeUndefined();

    await g.turn(pass, 'I wait a moment'); // the step as sent: the Parser reads it as typed, and the rest is kept
    expect(g.claude.callsFor('parser').at(-1)!.input.map((m) => m.content).join('\n')).toContain('I wait a moment');
    expect(queuedSteps(g.game.lines())).toEqual(['I look at the hearth']);

    await g.turn(pass, 'I hum a tune'); // something new: the rest is dropped
    expect(queuedSteps(g.game.lines())).toEqual([]);
    expect(g.game.lines().at(-1)!.next).toBeUndefined();
  });

  it('a / command leaves the queue as it is; a question or a new order after it ends it', () => {
    const n: LogLine = { turn: 1, kind: 'narration', text: 'x', queue: ['go to the inn'] };
    expect(queuedSteps([n, { turn: 2, kind: 'player', text: '/inv' }, { turn: 2, kind: 'command', text: 'a sword' }])).toEqual(['go to the inn']);
    expect(queuedSteps([n, { turn: 2, kind: 'player', text: 'I sing' }, { turn: 2, kind: 'clarify', text: 'Sing what?' }])).toEqual([]);
  });

  it('stops when the player is hit or spoken to, a step fails, someone ill-disposed comes into view, or they are seen sneaking', () => {
    const s = makeVillage({ without: ['slime_1', 'slime_2'] });
    const quiet = watchOrder(s);
    expect(orderStops(s, quiet, [], [])).toBe(false);
    expect(orderStops(s, quiet, [ev({ kind: 'attack', target: 'player', perception: { player: { level: 'full', cue: 'sight' } } as GameEvent['perception'] })], [])).toBe(true);
    const words = ev({ kind: 'speak', line: { text: 'You there!', volume: 'normal', to: 'player' }, perception: { player: { level: 'full', cue: 'sight', heard: true } } as GameEvent['perception'] });
    expect(orderStops(s, quiet, [words], [])).toBe(true);
    expect(orderStops(s, quiet, [words], ['guard_1'])).toBe(false); // the answer to the player's own words is no news
    expect(orderStops(s, quiet, [ev({ actorId: 'player', kind: 'wasted', reason: 'out_of_reach' } as Partial<GameEvent>)], [])).toBe(true);
    expect(orderStops(s, quiet, [ev({ actorId: 'player', kind: 'interact', tier: 'failure' })], [])).toBe(true);
    expect(orderStops(s, quiet, [ev({ actorId: 'player', kind: 'interact', tier: 'success' })], [])).toBe(false);
    // someone who knew nothing of the player and wishes them ill now sees them
    const unseen = { ...quiet, senses: new Set<string>(), aware: new Set<string>() };
    const wim = s.actors.find((a) => a.id === 'patron_1')!;
    (wim.mind!.overrides ??= {}).player = 'opposed';
    expect(orderStops(s, unseen, [], [])).toBe(true);
    delete wim.mind!.overrides!.player;
    (wim.mind!.knowledge ??= {}).player = { status: 'aware', source: 'seen', revealed: [] }; // Wim now knows of the player
    expect(orderStops(s, { ...unseen, senses: quiet.senses }, [], [])).toBe(false); // newly aware of a plain walker: no news
    expect(orderStops(s, { ...unseen, senses: quiet.senses, sneaking: true }, [], [])).toBe(true); // seen while sneaking
  });
});
