import { describe, expect, it, vi } from 'vitest';
import type { AttackResult, GameEvent, GameState, RollResult } from '../../src/types';
import { makeVillage, actor, place, createRng } from '../harness';
import { computePerception, updateBeliefs } from '../../src/perception';
import {
  buildActorView, buildCombatPacket, buildDialogueView, buildNarrationView, buildOppositionView, buildPlayerView, buildWeaverView,
} from '../../src/views';

// W2's healthLevel/partStates are stubs until integration: thin fakes from the health track.
vi.mock('../../src/ruleset', async (orig) => {
  const real = await orig<typeof import('../../src/ruleset')>();
  const { CONFIG } = await import('../../src/config');
  return {
    ...real,
    healthLevel: (a: import('../../src/types').Actor) => {
      const lost = a.core.condition.hpLostPct;
      if (lost >= 100) return 'Incapacitated';
      return CONFIG.HEALTH_TRACK.find(([, max]) => lost <= max)![0];
    },
    partStates: (_s: unknown, a: import('../../src/types').Actor) =>
      Object.entries(a.core.condition.parts).map(([id, pct]) => ({ id, state: pct >= 100 ? 'Healthy' : pct > 50 ? 'Damaged' : pct > 0 ? 'Crippled' : 'Destroyed' })),
  };
});

let n = 0;
const ev = (e: Partial<GameEvent> & Pick<GameEvent, 'actorId' | 'kind' | 'zone'>): GameEvent =>
  ({ id: `e${++n}`, turn: 1, effects: [], noise: 1, visibility: 2, perception: {}, ...e });
const run = (s: GameState, e: GameEvent) => {
  e.perception = computePerception(e, s, createRng(1));
  updateBeliefs(s, { kind: 'event', event: e });
  s.events.push(e);
  return e;
};
const npcViews = (s: GameState, id: string) => [buildActorView(s, id), buildOppositionView(s, id), buildDialogueView(s, id, [{ spoken: 'hello', impression: 'convincing' }])];
const roll = (tier: string, d100: number, margin: number, natural: RollResult['natural'] = 0): RollResult =>
  ({ actorId: 'x', skill: 'melee_medium', d100, margin, tierIndex: 3, tier, natural, modifiers: [{ source: 'aim', type: 'aim', value: -20 }], tierShifts: [] });

describe('NPC views', () => {
  it('never copy bark events (Leak prevention)', () => {
    const s = makeVillage();
    run(s, ev({ actorId: 'trader', kind: 'speak', zone: 'tav_counter', bark: true, line: { text: 'Get out, you oaf!', volume: 'shout' }, noise: 3 }));
    run(s, ev({ actorId: 'trader', kind: 'idle', zone: 'tav_counter', activity: 'tend_counter' }));
    for (const v of npcViews(s, 'patron_1')) {
      expect(JSON.stringify(v)).not.toContain('oaf');
      expect(v.perceived.some((e) => e.kind === 'speak')).toBe(false);
      expect(v.perceived.some((e) => e.kind === 'idle')).toBe(true);
    }
  });
  it('are deny-by-default: unknown fields on state, actor, mind, band and zone reach no view', () => {
    const s = makeVillage();
    const LEAK = 'zz_unknown_leak';
    Object.assign(s, { [LEAK]: LEAK });
    for (const a of [s.player, ...s.actors]) { Object.assign(a, { [LEAK]: LEAK }); Object.assign(a.core, { [LEAK]: LEAK }); if (a.mind) Object.assign(a.mind, { [LEAK]: LEAK }); }
    for (const b of s.bands) Object.assign(b, { [LEAK]: LEAK });
    for (const z of s.zones) Object.assign(z, { [LEAK]: LEAK });
    Object.assign(s.hidden, { [LEAK]: LEAK });
    run(s, ev({ actorId: 'trader', kind: 'move', zone: 'tav_common', [LEAK]: LEAK } as never));
    actor(s, 'trader').mind!.knowledge.patron_1 = { status: 'aware', source: 'seen', revealed: [], [LEAK]: LEAK } as never;
    const views = [
      ...npcViews(s, 'trader'), buildPlayerView(s), buildNarrationView(s, s.events, null),
      buildWeaverView(s, { kind: 'scene', placeId: 'tavern' }),
    ];
    for (const v of views) expect(JSON.stringify(v)).not.toContain(LEAK);
  });
  it('DialogueView whitelists nothing from state.hidden', () => {
    const s = makeVillage();
    s.hidden.plans.patron_1 = { goal: 'PLANGOAL', steps: ['STEP'], triggers: [], createdTurn: 1 };
    s.hidden.memory.patron_1 = 'MEMNOTE';
    s.hidden.secrets.push({ id: 'sec1', holderId: 'patron_1', fact: 'SECRETFACT', leakTerms: ['LEAKTERM'], revealWhen: { type: 'event_in_zone', kind: 'search', zone: 'tav_cellar' } });
    s.hidden.firedLog.push({ triggerId: 'TRIGID', turn: 1, ownerId: 'patron_1' });
    s.hidden.weaverNote = 'WEAVERNOTE';
    const dv = buildDialogueView(s, 'patron_1', [{ spoken: 'hi', impression: null }]);
    const text = JSON.stringify(dv);
    for (const w of ['PLANGOAL', 'STEP', 'MEMNOTE', 'SECRETFACT', 'LEAKTERM', 'TRIGID', 'WEAVERNOTE', 'sec1']) expect(text).not.toContain(w);
    expect(dv).not.toHaveProperty('plan');
    expect(dv).not.toHaveProperty('secrets');
    const ov = buildOppositionView(s, 'patron_1');
    expect(ov.plan?.goal).toBe('PLANGOAL');
    expect(ov.memory).toBe('MEMNOTE');
    expect(ov.secrets.map((x) => x.id)).toEqual(['sec1']);
    expect(ov.firedTriggers).toEqual([{ triggerId: 'TRIGID', turn: 1 }]);
  });
  it("others' health shows only from Wounded down; own health always", () => {
    const s = makeVillage();
    actor(s, 'trader').core.condition.hpLostPct = 40; // Injured
    place(s, 'trader', 'tav_common');
    const seen = () => buildActorView(s, 'patron_1').seen.find((x) => x.id === 'trader')!;
    expect(seen().health).toBeUndefined();
    expect(buildActorView(s, 'trader').self.health).toBe('Injured');
    actor(s, 'trader').core.condition.hpLostPct = 50;
    expect(seen().health).toBe('Wounded');
  });
  it('NPCs do not see an unaware-of player; stowed gear is never seen', () => {
    const s = makeVillage();
    expect(buildActorView(s, 'patron_1').seen.some((x) => x.id === 'player')).toBe(false);
    updateBeliefs(s, { kind: 'opening', observerId: 'patron_1', aboutId: 'player', status: 'aware', zone: 'tav_common' });
    const p = buildActorView(s, 'patron_1').seen.find((x) => x.id === 'player')!;
    expect(p.gear.map((g) => g.name).sort()).toEqual(['arming sword', 'gambeson', 'round shield']); // coin is stowed
  });
});

describe('NarrationView and the packet', () => {
  it('partial events carry no actor, only the link label and cue', () => {
    const s = makeVillage({ playerZone: 'street_door' });
    run(s, ev({ actorId: 'trader', kind: 'move', zone: 'tav_counter', noise: 2 }));
    const v = buildNarrationView(s, s.events, null);
    expect(v.events).toEqual([{ id: s.events[0].id, kind: 'move', level: 'partial', cue: 'sound', where: 'inside the tavern' }]);
  });
  it("hides others' minor condition changes, shows the player's own", () => {
    const s = makeVillage();
    place(s, 'trader', 'tav_common');
    run(s, ev({ actorId: 'trader', kind: 'threshold_crossed', zone: 'tav_common', effects: [{ kind: 'threshold_crossed', actorId: 'trader', data: { from: 'Unhurt', to: 'Hurt' } }] }));
    run(s, ev({ actorId: 'player', kind: 'threshold_crossed', zone: 'tav_common', effects: [{ kind: 'threshold_crossed', actorId: 'player', data: { from: 'Unhurt', to: 'Bruised' } }] }));
    const v = buildNarrationView(s, s.events, null);
    expect(v.events.map((e) => e.changes)).toEqual([['player is Bruised']]);
  });
  it('packet: names, tiers and labels only, no numbers', () => {
    const s = makeVillage();
    place(s, 'guard_1', 'tav_common');
    const result: AttackResult = {
      attack: roll('Strong', 87, 13.5, 1), defense: roll('Success', 42, 7), defenseType: 'block', gap: -1, gapShifts: [],
      outcome: 'full_hit', location: 'general', locationHow: 'rolled', multiplier: 0.8, damage: 17,
      deciding: { attack: ['aim'], defense: [], gap: [] }, attackerId: 'player', targetId: 'guard_1', weaponId: 'player_arming_sword_1', modeId: 'cut',
    };
    const e = run(s, ev({ id: 'evt_a', actorId: 'player', kind: 'attack', zone: 'tav_common', target: 'guard_1', attack: result,
      effects: [{ kind: 'part_state_changed', actorId: 'guard_1', data: { part: 'left_arm', from: 'Healthy', to: 'Damaged' } }] }));
    const pk = buildCombatPacket(s, e, 'player');
    expect(pk).toEqual({
      event: 'evt_a', actor: 'player', target: 'a village guard', action: 'melee attack', weapon: 'arming sword', armor: 'mail hauberk', shield: null,
      attack: { tier: 'Strong', natural: 'lucky', deciding: ['aim'] }, defense: { type: 'block', tier: 'Success', natural: null, deciding: [] },
      outcome: 'full hit', location: { part: 'torso', how: 'rolled' }, changes: [], events: [],
    });
    expect(JSON.stringify(pk)).not.toMatch(/\d/);
  });
});

describe('place facts and headlines', () => {
  it('reach only PlayerView, NarrationView and WeaverView', () => {
    const s = makeVillage();
    s.facts.push({ id: 'f1', storyId: 'test', placeId: 'tavern', turn: 0, text: 'FACT the brawl broke a bench', refs: [], source: 'rule', promotedTo: ['village'] });
    s.facts.push({ id: 'f2', storyId: 'test', placeId: 'village', turn: 0, text: 'HEADLINE a brawl at {place:tavern}', refs: [], source: 'rule', promotedTo: [] });
    s.places.find((p) => p.id === 'village')!.headlines.push('f2');
    expect(buildPlayerView(s).facts).toEqual(['FACT the brawl broke a bench']);
    expect(buildPlayerView(s).headlines).toEqual(['HEADLINE a brawl at The Crooked Kettle']);
    expect(buildNarrationView(s, [], null).headlines).toHaveLength(1);
    expect(buildWeaverView(s, { kind: 'scene', placeId: 'tavern' }).headlines).toContain('HEADLINE a brawl at The Crooked Kettle');
    for (const v of npcViews(s, 'patron_1')) expect(JSON.stringify(v)).not.toMatch(/FACT|HEADLINE/);
  });
});
