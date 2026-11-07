// 105 Story pacing (P7): quiet turns count up; a quiet_turns beat fires when the clock fills and can end the scene;
// rest outside a fight ends the scene; a stall with no beat left ends it; the director then starts a new scene.
import { describe, expect, it, vi } from 'vitest';
import { createRng, makeVillage, ScriptedClaude } from '../harness';
import { resolveTurn } from '../../src/engine';
import { fireTurnStartTriggers } from '../../src/engine/triggers';
import { createDirector } from '../../src/agents/director';
import { ruleset } from '../../src/ruleset';
import { villageStagePlan, VirtualClock } from '../../src/scene/fixtures';
import { CONFIG } from '../../src/config';
import type { GameState, Intent, Trigger } from '../../src/types';

const act = (type: NonNullable<Intent['action']>['type'], target: string | null = null): Intent => ({
  move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
  action: { type, skill: type === 'attack' ? 'melee_medium' : '', target, targetPart: null, item: null, mode: null, approach: '', stance: 'normal' },
});
const turn = (s: GameState, intent: Intent | null, seed = 1) => { s.turn += 1; return resolveTurn(s, { intent, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(seed)); };
const beat = (endsScene: boolean): Trigger => ({
  id: 'watch_comes', ownerId: 'trader', when: { type: 'quiet_turns', turns: 2 },
  then: { type: 'talk', target: '$player', skill: null, intent: 'the watch is coming' } as Trigger['then'], once: true, ...(endsScene ? { endsScene: true as const } : {}),
});

// the field's slimes and guard fight on their own, and any attack on the stage breaks the quiet
const calm = () => makeVillage({ without: ['slime_1', 'slime_2'] });

describe('105 Story pacing', () => {
  it('quiet turns count up and an attack resets them', () => {
    const s = calm();
    turn(s, null);
    turn(s, null);
    expect(s.stage.quiet).toBe(2);
    turn(s, act('attack', 'patron_1'));
    expect(s.stage.quiet).toBe(0);
  });
  it('a beat fires when the clock fills, its turn is not quiet, and endsScene marks the break', () => {
    const s = calm();
    s.hidden.plans.trader = { goal: '', steps: [], triggers: [beat(true)], createdTurn: 0 };
    turn(s, null);
    expect(fireTurnStartTriggers(s, s.turn + 1).fired).toEqual([]);
    turn(s, null);
    const r = fireTurnStartTriggers(s, s.turn + 1);
    expect(r.fired).toEqual(['watch_comes']);
    expect(s.stage.breakCause).toBe('story_beat');
    turn(s, null);
    expect(s.stage.quiet).toBe(0);
  });
  it('rest outside a fight ends the scene', () => {
    const s = calm();
    turn(s, act('rest'));
    expect(s.stage.breakCause).toBe('rest');
  });
  it('a stall ends the scene only when no live beat is left', () => {
    const s = calm();
    s.hidden.plans.trader = { goal: '', steps: [], triggers: [{ ...beat(false), when: { type: 'quiet_turns', turns: 99 } }], createdTurn: 0 };
    for (let i = 0; i < CONFIG.STALL_TURNS; i++) turn(s, null);
    expect(s.stage.breakCause).toBeUndefined();
    s.hidden.plans.trader.triggers = [];
    turn(s, null);
    expect(s.stage.breakCause).toBe('story_beat');
  });
  it('the director starts a new scene on a break and resets the clock', async () => {
    const roll = vi.spyOn(ruleset, 'situation').mockReturnValue({ actorId: 'player', roll: 60, tier: 0, modifiers: [] });
    const s = calm();
    s.stage.breakCause = 'rest';
    s.stage.quiet = 5;
    const scene = s.stage.sceneNumber;
    const client = new ScriptedClaude().push('weaver', { ...villageStagePlan(0), places: [], bands: [], cast: [], rewards: [], frontiers: [], hiddenTerms: [] });
    const clock = new VirtualClock();
    await createDirector(clock).afterResolve(s, [], createRng(1), { client, clock, turn: s.turn, log: () => {} });
    expect(client.callsFor('weaver')).toHaveLength(1);
    expect(s.stage.sceneNumber).toBe(scene + 1);
    expect(s.stage.quiet).toBe(0);
    expect(s.stage.breakCause).toBeUndefined();
    roll.mockRestore();
  });
});
