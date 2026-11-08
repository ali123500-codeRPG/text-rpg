// 122 NPC memory and agreements (Ali, 08/11/2026, PM1–PM8): a memory list of up to MEMORY_ENTRIES the agent edits
// without resending its plan; deals between the player and an NPC or between NPCs, recorded only when the other party
// heard them said; a companion in a deal gets a Planner call; events that fall out of the recent window become
// code-made earlier lines.
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { resolveTurn } from '../../src/engine';
import { hasAgenda } from '../../src/engine/relations';
import { plannerActors } from '../../src/agents';
import { pruneRecent } from '../../src/agents/game';
import { buildOppositionView, buildPlayerView } from '../../src/views';
import { CONFIG } from '../../src/config';
import type { GameEvent, GameState, Intent, NpcAction, PlannerOutput } from '../../src/types';

const hold: Intent = { move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, action: null };
const act = (type: NpcAction['type'] = 'hold', target: string | null = null): NpcAction =>
  ({ type, target, skill: null, targetPart: null, aimed: false, defense: null, item: null, mode: null, intent: '' });
const turn = (s: GameState, outs: Record<string, Partial<PlannerOutput>>) => {
  s.turn += 1;
  const agentOutputs = Object.entries(outs).map(([actorId, o]) =>
    ({ agent: 'planner', actorId, output: { action: act(), dialogue: null, gear: null, stance: null, planUpdate: null, ...o } }) as never);
  return resolveTurn(s, { intent: hold, aimed: false, agentOutputs, spokespeople: [] }, createRng(1));
};
const line = (text: string) => ({ line: text, volume: 'normal' as const });
const codes = (s: GameState, code: string) => s.log.filter((l) => l.code === code);

describe('122 NPC memory and agreements', () => {
  it('PM1/PM2: entries are added and dropped by number without a plan; past the limit the oldest go', () => {
    const s = makeVillage();
    turn(s, { guard_1: { memory: { add: ['the stranger asked about the mill', 'slimes came at dusk'], drop: [] } } });
    expect(s.hidden.plans.guard_1).toBeUndefined();
    expect(buildOppositionView(s, 'guard_1').memory).toEqual([
      { n: 1, turn: 2, text: 'the stranger asked about the mill' }, { n: 2, turn: 2, text: 'slimes came at dusk' },
    ]);
    expect(hasAgenda(s, 'guard_1')).toBe(true);
    turn(s, { guard_1: { memory: { add: [], drop: [1] } } });
    expect(s.hidden.memory.guard_1.map((m) => m.text)).toEqual(['slimes came at dusk']);
    turn(s, { guard_1: { memory: { add: Array.from({ length: CONFIG.MEMORY_ENTRIES }, (_, i) => `note ${i}`), drop: [] } } });
    expect(s.hidden.memory.guard_1).toHaveLength(CONFIG.MEMORY_ENTRIES);
    expect(s.hidden.memory.guard_1[0].text).toBe('note 0');
    expect(codes(s, 'memory_full')).toHaveLength(1);
    turn(s, { guard_1: { memory: { add: [], drop: Array.from({ length: CONFIG.MEMORY_ENTRIES }, (_, i) => i + 1) } } });
    expect(s.hidden.memory.guard_1).toBeUndefined();
  });

  it('PM3/PM5: a deal with the player, said where you hear it, shows for both sides', () => {
    const s = makeVillage();
    place(s, 'player', 'gate_inner');
    turn(s, { guard_1: { dialogue: line('Fine: you draw them off, I take the healer.'), agreement: { with: 'player', text: 'The player charges; Bertram sneaks round to the healer.' } } });
    const [g] = s.hidden.agreements!;
    expect(g).toMatchObject({ parties: ['guard_1', 'player'], madeBy: 'guard_1', text: 'The player charges; Bertram sneaks round to the healer.' });
    expect(buildPlayerView(s).agreements).toEqual([{ id: g.id, with: 'a village guard', withId: 'guard_1', text: g.text, madeTurn: 2 }]);
    expect(buildOppositionView(s, 'guard_1').agreements?.[0]).toMatchObject({ with: 'player', withId: 'player' });
    turn(s, { guard_1: { endAgreements: [{ id: g.id, outcome: 'done' }] } });
    expect(s.hidden.agreements).toEqual([]);
    expect(codes(s, 'agreement_ended')[0].detail).toMatchObject({ outcome: 'done', by: 'guard_1' });
  });

  it('PM3: no deal unless the other party heard it said this turn', () => {
    const s = makeVillage();
    place(s, 'player', 'field_far');
    turn(s, { guard_1: { agreement: { with: 'player', text: 'a deal' } } }); // no line at all
    turn(s, { guard_1: { dialogue: line('Deal.'), agreement: { with: 'player', text: 'a deal' } } }); // said out of earshot
    expect(s.hidden.agreements ?? []).toEqual([]);
    expect(codes(s, 'invalid_agreement')).toHaveLength(2);
  });

  it('PM4: NPCs make deals with each other; only a party can end one', () => {
    const s = makeVillage();
    place(s, 'guard_1', 'tav_common');
    turn(s, { guard_1: { dialogue: line('Keep the cellar locked tonight, Wim.'), agreement: { with: 'patron_1', text: 'Old Wim keeps the cellar locked; Bertram pays his tab.' } } });
    const [g] = s.hidden.agreements!;
    expect(g.parties).toEqual(['guard_1', 'patron_1']);
    expect(buildOppositionView(s, 'patron_1').agreements?.[0].withId).toBe('guard_1');
    expect(buildPlayerView(s).agreements).toBeUndefined();
    turn(s, { trader: { endAgreements: [{ id: g.id, outcome: 'broken' }] } });
    expect(s.hidden.agreements).toHaveLength(1);
    expect(codes(s, 'invalid_agreement_end')).toHaveLength(1);
  });

  it('PM8: an agent NPC in a deal gets a Planner call even when not engaged', () => {
    const s = makeVillage();
    expect(plannerActors(s)).toEqual([]);
    s.hidden.agreements = [{ id: 'd1', parties: ['guard_1', 'player'], text: 'meet at the gate', madeTurn: 1, madeBy: 'guard_1' }];
    expect(plannerActors(s)).toEqual(['guard_1']);
  });

  it('PM6: events that fall out of the window become earlier lines; repeats are counted', () => {
    const s = makeVillage();
    const ev = (n: number, extra: Partial<GameEvent> = {}): GameEvent => ({
      id: `t${n}.1`, turn: n, actorId: 'player', kind: 'search', zone: 'gate_inner', effects: [], noise: 'quiet', visibility: 'normal',
      perception: { guard_1: { level: 'full', cue: 'sight' } }, ...extra,
    });
    const all = [ev(1, { kind: 'speak', line: { text: 'Seen any slimes?', volume: 'normal' } }), ev(2), ev(3),
      ...Array.from({ length: CONFIG.RECENT_EVENTS }, (_, i) => ev(4 + i, { kind: 'hold' }))];
    const kept = pruneRecent(s, all);
    expect(kept).not.toContain(all[1]);
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    expect(g.mind!.earlier!.lines).toEqual(['turn 1: player speak: "Seen any slimes?"', 'turn 2–3: player search ×2']);
    expect(buildOppositionView(s, 'guard_1').earlier).toEqual(g.mind!.earlier!.lines);
    pruneRecent(s, kept); // nothing new falls out: no line is written twice
    expect(g.mind!.earlier!.lines).toHaveLength(2);
  });
});
