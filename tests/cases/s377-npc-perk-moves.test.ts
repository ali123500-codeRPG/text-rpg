// 377 NPC perk moves (TC49): an agent-run NPC is offered the perk moves it owns, as the player is, and its Planner may use one.
import { describe, expect, it } from 'vitest';
import { makeVillage, place, ScriptedClaude } from '../harness';
import { PK } from '../../src/library/perkIds';
import { buildOppositionView } from '../../src/views';
import { callPlanner, VirtualClock, FIXED, type AgentCtx } from '../../src/agents';
import { resetConfig } from '../../src/config';
import { act, play, plannerOut } from './w4-kit';
import type { Actor, GameState } from '../../src/types';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });

/** a hostile, agent-run patron next to the player that owns Battle Cry and Bluff */
function foe(s: GameState): Actor {
  const p = place(s, 'patron_1', s.player.zone);
  p.mind!.overrides = { player: 'hostile' };
  p.mind!.knowledge.player = { status: 'engaged', source: 'seen', revealed: [], lastKnownZone: s.player.zone, lastSeenTurn: s.turn };
  give(p, PK.battle_cry);
  give(p, PK.bluff);
  return p;
}

function ctxFor(out: unknown) {
  resetConfig();
  const clock = new VirtualClock();
  const claude = new ScriptedClaude(clock);
  claude.push('planner', out);
  const ctx: AgentCtx = { client: claude, clock, turn: 1, log: () => {}, onError: () => {} };
  return ctx;
}

const hold = { type: 'hold', target: null, skill: null, targetPart: null, aimed: false, defense: null, item: null, mode: null, intent: '' };

describe('377 NPC perk moves', () => {
  it('the NPC view lists its perk moves the way the player sees theirs, and the Planner is told how to use them', () => {
    const s = makeVillage();
    foe(s);
    const v = buildOppositionView(s, 'patron_1');
    const cry = v.self.perkMoves!.find((m) => m.id === PK.battle_cry)!;
    const bluff = v.self.perkMoves!.find((m) => m.id === PK.bluff)!;
    expect(cry.action).toBe(true);
    expect(cry.inRange).toBeUndefined(); // aimed at no one
    expect(bluff.inRange).toContain(s.player.id);
    expect(FIXED.planner).toContain('self.perkMoves');
    expect(FIXED.planner).toContain('"perkMove"?:{"perk":perk_id');
    expect(buildOppositionView(s, s.actors.find((x) => x.id !== 'patron_1' && !!x.mind)!.id).self.perkMoves).toBeUndefined(); // one without perk moves gets none
  });

  it('the Planner may use a perk move it owns: one that takes the turn drops its other action; one it does not own is dropped', async () => {
    const s = makeVillage();
    foe(s);
    const v = buildOppositionView(s, 'patron_1');
    const atk = { ...hold, type: 'attack', target: s.player.id };
    const r = await callPlanner(v, ctxFor({ action: atk, dialogue: null, gear: null, stance: null, planUpdate: null, perkMove: { perk: 'Battle Cry', target: null } }), { world: new Set() });
    expect(r.value!.perkMove).toEqual({ perk: PK.battle_cry, target: null });
    expect(r.value!.action.type).toBe('hold');
    const free = await callPlanner(v, ctxFor({ action: atk, dialogue: null, gear: null, stance: null, planUpdate: null, perkMove: { perk: PK.bluff, target: s.player.id } }), { world: new Set() });
    expect(free.value!.perkMove).toEqual({ perk: PK.bluff, target: s.player.id });
    expect(free.value!.action.type).toBe('attack'); // a free move goes beside the action
    const bad = await callPlanner(v, ctxFor({ action: hold, dialogue: null, gear: null, stance: null, planUpdate: null, perkMove: { perk: PK.rally, target: null } }), { world: new Set() });
    expect(bad.value!.perkMove).toBeNull();
    expect(bad.log.errors).toContain('invalid_perk_move');
  });

  it('a Planner perk move is played: the NPC roars its Battle Cry', () => {
    const s = makeVillage();
    foe(s);
    const ev = play(s, { agentOutputs: [plannerOut('patron_1', act('hold'), { perkMove: { perk: PK.battle_cry, target: null } })] });
    expect(ev.some((e) => e.kind === 'battle_cry' && e.actorId === 'patron_1')).toBe(true);
  });
});
