// The action deck's Defense row: the player picks a standing defense (dodge, parry, block) for free, saved at once (CS12).
// A defense that can't be used now is locked; a chosen one that gear has since made unusable stays chosen while the
// roll falls back to the best usable one, and the Character page shows the one actually used.
import { describe, expect, it } from 'vitest';
import { ScriptedClaude, makeVillage } from '../harness';
import { createGame, VirtualClock, type ScenarioDirector } from '../../src/agents';
import { memoryStore, saveTurn } from '../../src/save';
import { canDefend, defenseValue, usableDefense } from '../../src/ruleset/gear';
import { standing } from '../../src/ui/charsheet';
import { IT } from '../../src/library/itemIds';
import type { GameState, TurnRecord } from '../../src/types';

const rec = (s: GameState): TurnRecord => ({ storyId: s.storyId, turn: s.turn, libraryVersion: s.libraryVersion, rngBefore: 0, playerInput: '', agentLog: [], events: [], factsAdded: [] });
const idle: ScenarioDirector = { startStory: () => new Promise(() => {}), afterResolve: async () => [], afterSave: () => {} };
const tick = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); };

describe('the Defense row', () => {
  it('a pick changes the standing defense at once and survives a reload', async () => {
    const clock = new VirtualClock(), store = memoryStore();
    const s = makeVillage();
    s.turn = 1;
    s.player.core.standingDefense = 'block';
    await saveTurn(store, s, rec(s));
    const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
    await g.resume();
    const turn = g.state()!.turn;
    g.setDefense('parry');
    expect(g.state()!.player.core.standingDefense).toBe('parry');
    await tick();
    const again = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
    await again.resume();
    expect(again.state()!.player.core.standingDefense).toBe('parry');
    expect(again.state()!.turn).toBe(turn); // no turn was played
  });

  it('Parry needs a melee weapon and never meets a missile; without a shield Block is locked, a chosen Block falls back and the Character page shows the fallback; Dodge always works', () => {
    const s = makeVillage(), p = s.player;
    p.core.standingDefense = 'parry';
    expect(canDefend(s, p, 'parry')).toBe(true);
    expect(usableDefense(s, p, true)).not.toBe('parry');
    p.core.standingDefense = 'block';
    expect(canDefend(s, p, 'block')).toBe(true);
    expect(standing(s, p).kind).toBe('block');
    p.core.inventory = p.core.inventory.filter((i) => i.itemId !== IT.round_shield);
    expect(canDefend(s, p, 'block')).toBe(false);
    const used = usableDefense(s, p, false);
    expect(used).not.toBe('block');
    expect(p.core.standingDefense).toBe('block'); // the choice is kept for when the shield is back
    expect(standing(s, p)).toEqual({ kind: used, value: defenseValue(s, p, used) });
    p.core.inventory = p.core.inventory.filter((i) => i.itemId !== IT.arming_sword);
    expect(canDefend(s, p, 'dodge')).toBe(true);
    expect(canDefend(s, p, 'parry')).toBe(false);
  });
});
