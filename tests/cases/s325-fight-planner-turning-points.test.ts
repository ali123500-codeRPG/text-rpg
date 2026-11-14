// 325 NV1 b, NV5 (Value of agent-run NPCs): an AI-run fighter in a fight gets a Planner call only at a turning point of its
// fight (it starts or a newcomer joins, someone in it goes down, breaks, surrenders or yields, or an offer waits for its
// answer); between them code runs its deeds. Schemers and goal holders keep a call every turn (NV2). A creature that
// cannot understand words (a slime) is never asked to answer them: no Claude call, and the story says it does not understand.
import { describe, expect, it } from 'vitest';
import { intent, speech, wholeTurn } from '../harness/turn';
import { actorById } from '../../src/engine/relations';
import { plansEveryTurn } from '../../src/agents/game';
import { buildNarrationView } from '../../src/views';
import { place } from '../harness';
import { SK } from '../../src/library/skillIds';
import type { GameState } from '../../src/types';

const strike = (target: string) => intent({ action: { type: 'attack', skill: SK.melee_medium, target, targetPart: null, item: null, mode: null, approach: '', stance: 'normal' } });

/** the guard in the tavern, hostile and already trading blows with the player */
const fight = () => {
  const g = wholeTurn({ playerZone: 'tav_common', engaged: ['guard_1'] });
  const s = g.state;
  const guard = place(s, 'guard_1', 'tav_common');
  guard.mind!.overrides = { player: 'hostile' };
  guard.mind!.knowledge.player = { status: 'engaged', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  return g;
};
const plannerCalls = (g: ReturnType<typeof wholeTurn>) => g.claude.callsFor('planner', 'guard_1').length;

describe('325 fight Planner at turning points', () => {
  it('a fighter is asked when its fight starts, not on a turn where nothing changed, and again when the player yields', async () => {
    const g = fight();
    const before = plannerCalls(g); // wholeTurn adopted the village before the guard came in: at its post, in no fight
    g.start(); // the guard now in the tavern, trading blows with the player
    await g.game.settle();
    expect(plannerCalls(g)).toBe(before + 1); // the fight is new to it
    await g.turn(intent({}));
    expect(plannerCalls(g)).toBe(before + 1); // nothing changed: code ran its deeds
    await g.turn(intent({ action: null, yields: true, spoken: 'Enough, I yield', addressees: ['guard_1'] }));
    expect(plannerCalls(g)).toBe(before + 2); // the player's yield waits for its answer
  });

  it('schemers and goal holders keep a call every turn', () => {
    const s: GameState = fight().state;
    const guard = actorById(s, 'guard_1')!;
    expect(plansEveryTurn(s, guard)).toBe(false);
    s.hidden.secrets.push({ id: 'sec1', holderId: 'guard_1', text: 'took a bribe', about: [], kind: 'fact' } as never);
    expect(plansEveryTurn(s, guard)).toBe(true);
  });

  it('a slime spoken to gets no talk call, and the story says it does not understand', async () => {
    const g = wholeTurn({ playerZone: 'field_mid' });
    g.start();
    const { events } = await g.turn(speech('talk', 'slime_1', 'Easy now, I mean you no harm'));
    expect(g.claude.callsFor('voice').length + g.claude.callsFor('responder').length).toBe(0);
    const said = events.find((e) => e.kind === 'speak' && e.actorId === g.state.player.id)!;
    expect(said.effects).toContainEqual(expect.objectContaining({ kind: 'not_understood', actorId: 'slime_1' }));
    const nv = buildNarrationView(g.game.state()!, events, null);
    expect(JSON.stringify(nv.events)).toContain('does not understand words');
  });
});
