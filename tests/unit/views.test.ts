import { AM } from '../../src/library/tableIds';
import type { Tier } from '../../src/types';
import { describe, expect, it, vi } from 'vitest';
import type { AttackResult, GameEvent, GameState, RollResult } from '../../src/types';
import { makeVillage, actor, place, createRng } from '../harness';
import { computePerception, updateBeliefs } from '../../src/perception';
import {
  buildActorView, buildCombatPacket, buildDialogueView, buildNarrationView, buildOppositionView, buildPlayerView, buildWeaverView,
} from '../../src/views';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';

// W2's healthLevel/partStates are stubs until integration: thin fakes from the health track.
vi.mock('../../src/ruleset', async (orig) => {
  const real = await orig<typeof import('../../src/ruleset')>();
  const { CONFIG } = await import('../../src/config');
  return {
    ...real,
    healthLevel: (a: import('../../src/types').Actor) => {
      const lost = a.core.condition.hpLostPct;
      if (lost >= 100) return 'incapacitated';
      return CONFIG.HEALTH_TRACK.find(([, max]) => lost <= max)![0];
    },
    partStates: (_s: unknown, a: import('../../src/types').Actor) =>
      Object.entries(a.core.condition.parts).map(([id, pct]) => ({ id, state: pct >= 100 ? 'healthy' : pct > 50 ? 'damaged' : pct > 0 ? 'crippled' : 'destroyed' })),
  };
});

let n = 0;
const ev = (e: Partial<GameEvent> & Pick<GameEvent, 'actorId' | 'kind' | 'zone'>): GameEvent =>
  ({ id: `e${++n}`, turn: 1, effects: [], noise: 'quiet', visibility: 'normal', perception: {}, ...e });
const run = (s: GameState, e: GameEvent) => {
  e.perception = computePerception(e, s, createRng(1));
  updateBeliefs(s, { kind: 'event', event: e });
  s.events.push(e);
  return e;
};
const npcViews = (s: GameState, id: string) => [buildActorView(s, id), buildOppositionView(s, id), buildDialogueView(s, id, [{ spoken: 'hello', impression: 'convincing' }])];
const roll = (tier: Tier, d100: number, margin: number, natural: RollResult['natural'] = 0): RollResult =>
  ({ actorId: 'x', skill: SK.melee_medium, d100, margin, tier, natural, modifiers: [{ source: 'aim', type: 'aim', value: -20 }], tierShifts: [] });

describe('NPC views', () => {
  it("P5: list each NPC's own last lines in said, capped at SAID_LINES", () => {
    const s = makeVillage();
    for (let i = 1; i <= 8; i++) run(s, ev({ actorId: 'trader', kind: 'speak', zone: 'tav_counter', line: { text: `line ${i}`, volume: 'normal' } }));
    run(s, ev({ actorId: 'patron_1', kind: 'speak', zone: 'tav_counter', line: { text: 'not mine', volume: 'normal' } }));
    for (const v of npcViews(s, 'trader')) expect(v.said).toEqual(['line 3', 'line 4', 'line 5', 'line 6', 'line 7', 'line 8']);
  });
  it('never copy bark events (Leak prevention)', () => {
    const s = makeVillage();
    run(s, ev({ actorId: 'trader', kind: 'speak', zone: 'tav_counter', bark: true, line: { text: 'Get out, you oaf!', volume: 'shout' }, noise: 'loud' }));
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
      buildWeaverView(s, { kind: 'scenario', placeId: 'tavern' }),
    ];
    for (const v of views) expect(JSON.stringify(v)).not.toContain(LEAK);
  });
  it('DialogueView whitelists nothing from state.hidden', () => {
    const s = makeVillage();
    s.hidden.plans.patron_1 = { goal: 'PLANGOAL', steps: ['STEP'], triggers: [], createdTurn: 1 };
    s.hidden.memory.patron_1 = [{ turn: 1, text: 'MEMNOTE' }];
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
    expect(ov.memory).toEqual([{ n: 1, turn: 1, text: 'MEMNOTE' }]);
    expect(ov.secrets.map((x) => x.id)).toEqual(['sec1']);
    expect(ov.firedTriggers).toEqual([{ triggerId: 'TRIGID', turn: 1 }]);
  });
  it('NPC views keep events perceived in earlier turns (recentEvents) and who last hit them', () => {
    const s = makeVillage();
    const hit = { id: 't0.1', turn: 0, actorId: 'player', kind: 'attack', target: 'patron_1', zone: 'tav_common', effects: [], noise: 'normal', visibility: 'normal',
      perception: { patron_1: { level: 'full', cue: 'sight' } }, attack: { outcome: 'full_hit' } } as unknown as GameEvent;
    s.recentEvents = [hit];
    const ov = buildOppositionView(s, 'patron_1');
    expect(ov.perceived.length).toBe(1);
    expect(ov.self.lastHitBy).toBe('player');
  });
  it("others' health shows only from Wounded down; own health always", () => {
    const s = makeVillage();
    actor(s, 'trader').core.condition.hpLostPct = 40; // Injured
    place(s, 'trader', 'tav_common');
    const seen = () => buildActorView(s, 'patron_1').seen.find((x) => x.id === 'trader')!;
    expect(seen().health).toBeUndefined();
    expect(buildActorView(s, 'trader').self.health).toBe('injured');
    actor(s, 'trader').core.condition.hpLostPct = 50;
    expect(seen().health).toBe('wounded');
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
  it('an observe aimed at a zone names the zone, never "someone"; an unseen actor target is left out (run 15)', () => {
    const s = makeVillage();
    run(s, ev({ actorId: 'player', kind: 'observe', zone: s.player.zone, target: s.player.zone }));
    const zoneName = s.zones.find((z) => z.id === s.player.zone)!.name;
    expect(buildNarrationView(s, s.events, null).events[0].target).toBe(zoneName);
    const hidden = s.actors.find((a) => a.id !== 'player' && a.zone !== s.player.zone)!;
    run(s, ev({ actorId: 'player', kind: 'observe', zone: s.player.zone, target: hidden.id }));
    expect(buildNarrationView(s, s.events, null).events.at(-1)!.target).toBeUndefined();
  });
  it('partial events carry no actor, only the link label and cue', () => {
    const s = makeVillage({ playerZone: 'street_door' });
    run(s, ev({ actorId: 'trader', kind: 'move', zone: 'tav_counter', noise: 'loud' }));
    const v = buildNarrationView(s, s.events, null);
    expect(v.events).toEqual([{ id: s.events[0].id, kind: 'move', level: 'partial', cue: 'sound', where: 'inside the tavern' }]);
  });
  it('an NPC\'s stored pronouns reach the Narrator and the Parser (run 14 Q3)', () => {
    const s = makeVillage();
    place(s, 'trader', 'tav_common');
    s.actors.find((a) => a.id === 'trader')!.pronouns = 'she';
    const trader = s.actors.find((x) => x.id === 'trader')!;
    expect(buildNarrationView(s, s.events, null).actors.find((a) => a.label === trader.label)?.pronouns).toBe('she');
    expect(buildPlayerView(s).actors.find((a) => a.id === 'trader')?.pronouns).toBe('she');
  });
  it("hides others' minor condition changes, shows the player's own", () => {
    const s = makeVillage();
    place(s, 'trader', 'tav_common');
    run(s, ev({ actorId: 'trader', kind: 'threshold_crossed', zone: 'tav_common', effects: [{ kind: 'threshold_crossed', actorId: 'trader', data: { from: 'unhurt', to: 'hurt' } }] }));
    run(s, ev({ actorId: 'player', kind: 'threshold_crossed', zone: 'tav_common', effects: [{ kind: 'threshold_crossed', actorId: 'player', data: { from: 'unhurt', to: 'bruised' } }] }));
    const v = buildNarrationView(s, s.events, null);
    expect(v.events.map((e) => e.changes)).toEqual([['player is Bruised']]);
  });
  it('packet: names, tiers and labels only, no numbers', () => {
    const s = makeVillage();
    place(s, 'guard_1', 'tav_common');
    const result: AttackResult = {
      attack: roll('great_success', 87, 13.5, 1), defense: roll('success', 42, 7), defenseType: 'block', gap: -1, gapShifts: [],
      outcome: 'full_hit', location: 'general', locationHow: 'rolled', multiplier: 0.8, damage: 17,
      deciding: { attack: ['aim'], defense: [], gap: [] }, attackerId: 'player', targetId: 'guard_1', weaponId: `player_${IT.arming_sword}_1`, modeId: AM.cut,
    };
    const e = run(s, ev({ id: 'evt_a', actorId: 'player', kind: 'attack', zone: 'tav_common', target: 'guard_1', attack: result,
      effects: [{ kind: 'part_state_changed', actorId: 'guard_1', data: { part: 'left_arm', from: 'healthy', to: 'damaged' } }] }));
    const pk = buildCombatPacket(s, e, 'player');
    expect(pk).toEqual({
      event: 'evt_a', actor: 'player', target: 'a village guard', action: 'melee attack', weapon: 'arming sword', armor: 'mail hauberk', shield: null,
      attack: { tier: 'Great Success', natural: 'lucky', deciding: ['aim'] }, defense: { type: 'block', tier: 'Success', natural: null, deciding: [] },
      outcome: 'full hit', location: { part: 'torso', how: 'rolled' }, changes: [], events: [],
    });
    expect(JSON.stringify(pk)).not.toMatch(/\d/);
  });
  it("packet: the other side's deciding keeps only what the player can see (F1)", () => {
    const s = makeVillage();
    place(s, 'guard_1', 'tav_common');
    const shown = ['fumble', 'light', 'Gear (held): arming sword'];
    const hidden = ['health: Hurt', 'torso wounds', 'Iron Will', 'Gear (worn): hidden blade'];
    const def: RollResult = { ...roll('success', 42, 7, -1), modifiers: [
      { source: 'light', type: 'situational', value: -10 }, { source: 'health: Hurt', type: 'wounds', value: -5 },
      { source: 'torso wounds', type: 'wounds', value: -5 }, { source: 'Iron Will', type: 'roll_perk', value: 10 },
    ] };
    const result: AttackResult = {
      attack: roll('great_success', 87, 13.5), defense: def, defenseType: 'block', gap: -1, gapShifts: [],
      outcome: 'full_hit', location: 'general', locationHow: 'rolled', multiplier: 0.8, damage: 17,
      deciding: { attack: ['aim'], defense: [...shown, ...hidden], gap: [] }, attackerId: 'player', targetId: 'guard_1', weaponId: `player_${IT.arming_sword}_1`, modeId: AM.cut,
    };
    const e = run(s, ev({ id: 'evt_b', actorId: 'player', kind: 'attack', zone: 'tav_common', target: 'guard_1', attack: result }));
    expect(buildCombatPacket(s, e, 'player').defense!.deciding).toEqual(shown);
    expect(buildCombatPacket(s, e, 'guard_1').defense!.deciding).toEqual([...shown, ...hidden]); // its own roll stays whole
  });
  it("actors carry the health the player can see: Wounded or worse (F11)", () => {
    const s = makeVillage();
    place(s, 'trader', 'tav_common');
    actor(s, 'trader').core.condition.hpLostPct = 40; // Injured: hidden
    const health = () => buildNarrationView(s, [], null).actors.find((a) => a.label === actor(s, 'trader').label)!.health;
    expect(health()).toBeUndefined();
    actor(s, 'trader').core.condition.hpLostPct = 100;
    expect(health()).toBe('incapacitated');
  });
  it('someone Down shows no mood (BG-29)', () => {
    const s = makeVillage();
    place(s, 'trader', 'tav_common');
    const t = actor(s, 'trader');
    t.core.condition.moraleLost = 1000; // as frightened as they get
    const morale = () => buildPlayerView(s).actors.find((a) => a.label === t.label)!.morale;
    expect(morale()).toBeDefined();
    t.core.condition.hpLostPct = 100;
    expect(morale()).toBeUndefined();
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
    expect(buildWeaverView(s, { kind: 'scenario', placeId: 'tavern' }).headlines).toContain('HEADLINE a brawl at The Crooked Kettle');
    for (const v of npcViews(s, 'patron_1')) expect(JSON.stringify(v)).not.toMatch(/FACT|HEADLINE/);
  });
});

describe('P3 seen clearly stays seen', () => {
  it('someone in a dark zone is half seen until the player fully perceives them this scenario', () => {
    const s = makeVillage();
    const zone = s.zones.find((z) => z.id === 'tav_common')!;
    zone.light = 'dark';
    const pat = actor(s, 'patron_1');
    pat.zone = 'tav_common';
    expect(buildPlayerView(s).actors.find((a) => a.id === 'patron_1')!.level).toBe('partial');
    s.events.push(ev({ actorId: 'patron_1', kind: 'speak', zone: 'tav_common', perception: { player: { level: 'full', cue: 'sound' } } }));
    expect(buildPlayerView(s).actors.find((a) => a.id === 'patron_1')!.level).toBe('full');
  });
});

describe('others health word', () => {
  it('shows Dead only when seen clearly, Down for any other fallen state', async () => {
    const { othersHealthWord } = await vi.importActual<typeof import('../../src/ruleset')>('../../src/ruleset');
    expect(othersHealthWord('dead', true)).toBe('Dead');
    expect(othersHealthWord('dead', false)).toBe('Down');
    expect(othersHealthWord('incapacitated', true)).toBe('Down');
    expect(othersHealthWord('wounded', true)).toBe('Wounded');
  });
});
