// W4 engine unit tests. Other workstreams' modules are replaced by small local fakes.
import { AM } from '../../src/library/tableIds';
import type { Tier } from '../../src/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor, AttackRequest, AttackResult, GameEvent, GameState, Intent, Order, RollRequest } from '../../src/types';
import { makeVillage, actor, place, createRng, beside } from '../harness';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';
import { PK } from '../../src/library/perkIds';

const F = vi.hoisted(() => ({
  init: {} as Record<string, number>,
  rollTier: {} as Record<string, Tier>, // tier per actor
  damage: 0,
  destroyPart: null as string | null,
  defended: true,
  surprise: true,
  morale: 'steady' as 'steady' | 'broken' | 'surrendered',
  alerts: [] as Order[],
  headTo: [] as unknown[][],
  attacks: [] as AttackRequest[],
}));

vi.mock('../../src/ruleset', async (orig) => {
  const real = await orig<typeof import('../../src/ruleset')>();
  const { itemDef, bodyType } = await import('../../src/library');
  const roll = (req: RollRequest) => {
    const tier = F.rollTier[req.actorId] ?? 'success';
    return { actorId: req.actorId, skill: req.skill, d100: 50, margin: 0, tier, natural: 0 as const, modifiers: [], tierShifts: [] };
  };
  const usableModes = (_s: GameState, a: Actor) => {
    const held = a.core.inventory.filter((i) => i.equippedIn?.some((x) => x.startsWith('grip:')));
    const modes = held.flatMap((i) => (itemDef(null, i.itemId).weapon?.modes ?? []).map((mode) => ({ itemId: i.id, mode: real.withRow(a, itemDef(null, i.itemId), mode) }))); // the Throw row adds its reach
    const nat = bodyType(null, a.core.bodyTypeId).naturalAttacks.map((mode) => ({ itemId: `natural:${mode.id}`, mode }));
    return [...modes, ...nat];
  };
  return {
    ...real,
    ruleset: {
      ...real.ruleset,
      initiative: (a: Actor) => F.init[a.id] ?? 50,
      roll,
      check: (req: { actorId: string; skill: string }) => ({ actorId: req.actorId, skill: req.skill, target: 50, passed: true, modifiers: [] }),
      attack: (req: AttackRequest): AttackResult => {
        F.attacks.push(req);
        return {
          attack: roll({ actorId: req.attackerId, skill: SK.melee_medium, modifiers: [], tierShifts: [] }), defense: F.defended ? roll({ actorId: req.targetId, skill: SK.block, modifiers: [], tierShifts: [] }) : null,
          defenseType: F.defended ? 'block' : null, gap: 0, gapShifts: [], outcome: 'full_hit', location: F.destroyPart ?? 'general', locationHow: 'rolled',
          multiplier: 1, damage: F.damage, deciding: { attack: [], defense: [], gap: [] },
          attackerId: req.attackerId, targetId: req.targetId, weaponId: req.weaponId, modeId: req.modeId ?? '',
        };
      },
      applyEffects: (res: AttackResult, state: GameState) => {
        if (!('targetId' in res)) return [];
        const t = state.player.id === res.targetId ? state.player : state.actors.find((a) => a.id === res.targetId)!;
        t.core.condition.hpLostPct = Math.min(100, t.core.condition.hpLostPct + res.damage);
        if (!F.destroyPart) return [{ kind: 'damage', actorId: t.id, data: {} }];
        // like the real applyEffects: a Destroyed arm drops what it held to the zone's ground
        t.core.condition.parts[F.destroyPart] = -100;
        const held = t.core.inventory.filter((i) => i.equippedIn?.includes(`grip:${F.destroyPart}`));
        const zone = state.zones.find((z) => z.id === t.zone)!;
        for (const i of held) { t.core.inventory.splice(t.core.inventory.indexOf(i), 1); delete i.equippedIn; zone.groundItems.push(i); }
        return [{ kind: 'damage', actorId: t.id, data: {} }, ...held.map((i) => ({ kind: 'item_dropped', actorId: t.id, data: { itemId: i.id, zone: t.zone } }))];
      },
      recordUse: () => {},
    },
    healthLevel: (a: Actor) => {
      const p = a.core.condition.hpLostPct;
      return p >= 100 ? 'incapacitated' : p > 75 ? 'critical' : p > 60 ? 'mauled' : p > 45 ? 'wounded' : p > 30 ? 'injured' : p > 0 ? 'hurt' : 'unhurt';
    },
    partStates: (_s: GameState, a: Actor) => Object.entries(a.core.condition.parts).map(([id, v]) => ({ id, state: v <= 0 ? 'destroyed' : 'healthy' })),
    // the morale roll's tier: steady = Critical Success (pays nothing), broken = Failure, surrendered = Critical Failure
    moraleRoll: () => ({ tier: F.morale === 'surrendered' ? 'critical_failure' : F.morale === 'broken' ? 'failure' : 'critical_success', beyond: 0 }),
    usableModes,
    defaultMode: (s: GameState, a: Actor, d: number) => usableModes(s, a).find((m) => m.mode.reach >= d) ?? usableModes(s, a).at(-1) ?? null,
  };
});

vi.mock('../../src/perception', async () => {
  const { hearingOf } = await import('../../src/perception/noise');
  return {
  hearsWords: (p?: { heard?: true }) => !!p?.heard,
  // the real sound reach, without hearing perks
  hearsClearly: (state: GameState, from: Actor, l: Actor, noise: string) => hearingOf(state, noise as never, from, l) === 'full',
  // everyone in the event's zone (or the zone it left) perceives it fully
  computePerception: (ev: GameEvent, state: GameState) =>
    Object.fromEntries([state.player, ...state.actors].filter((a) => a.zone === ev.zone || a.zone === ev.fromZone).map((a) => [a.id, { level: 'full', cue: 'sight' }])),
  updateBeliefs: (state: GameState, u: { kind: string; event: GameEvent }) => {
    if (u.kind !== 'event') return;
    for (const a of state.actors) {
      if (!u.event.perception[a.id] || a.id === u.event.actorId) continue;
      a.mind!.knowledge[u.event.actorId] = { status: 'aware', lastKnownZone: u.event.zone, lastSeenTurn: u.event.turn, source: 'seen', revealed: [] };
    }
  },
  applyBeliefDecay: () => {},
  hears: (state: GameState, o: Actor, at: string | { zone: string }, noise: string) => o.zone === (typeof at === 'string' ? at : at.zone) && noise !== 'silent',
  noteSightings: () => {},
  // the old rule: NPCs read their knowledge; the player sees everyone
  beliefStatus: (_s: GameState, o: Actor, about: Actor) => (o.kind === 'player' ? 'aware' : o.mind?.knowledge[about.id]?.status ?? 'unaware'),
  stealthStart: () => {},
  stealthEnd: () => {},
  lookAround: () => [],
  noticeCue: () => undefined,
  };
});

vi.mock('../../src/views', () => ({
  seesClearlyNow: () => true,
  buildActorView: (state: GameState, id: string) => {
    const a = state.actors.find((x) => x.id === id)!;
    return { turn: state.turn, self: { id, zone: a.zone, broken: a.mind?.moraleState === 'broken', surrendered: a.mind?.moraleState === 'surrendered' }, perceived: [] };
  },
}));

vi.mock('../../src/minds', () => {
  const o = (v: { self: { id: string } }, type: string, source: Order['source']): Order => ({ actorId: v.self.id, type, target: null, skill: null, intent: '', source });
  return {
    routineOrder: (v: { self: { id: string } }) => o(v, 'idle', 'routine'),
    followMove: () => null,
    staying: () => false,
    fallbackOrder: (v: { self: { id: string } }) => o(v, 'hold', 'fallback'),
    brokenOrder: (v: { self: { id: string } }) => o(v, 'hold', 'broken'),
    bindTemplate: (tpl: Order, v: { self: { id: string } }, ctx: { triggerZone?: string; source: Order['source']; triggerId?: string }) => ({
      ...tpl, actorId: v.self.id, target: tpl.target === '$triggerZone' ? ctx.triggerZone : tpl.target === '$player' ? 'player' : tpl.target, source: ctx.source, triggerId: ctx.triggerId,
    }),
    alertOrders: (_s: GameState, views: { self: { id: string } }[]) => F.alerts.filter((a) => views.some((v) => v.self.id === a.actorId)),
    updateAlarms: () => {},
    searchFor: () => [],
    searchItems: () => ({ found: [], hint: false }),
    searchPerson: () => ({ found: [] }),
    headArrivals: () => {},
    desiredState: () => null,
    headTo: (...a: unknown[]) => (F.headTo.push(a), true),
    detectPlayer: () => {},
    resolveAmbush: () => ({ surprised: F.surprise }),
    switchRoutine: (state: GameState, a: Actor, id: string) => {
      if (!a.mind?.routines?.includes(id)) return false;
      a.mind.routine = { id, anchorTurn: state.turn, at: 420 };
      return true;
    },
  };
});

import { computePending, firedOrders, fromIntent, resolveSpeech, resolveTurn, selectSpokespeople, unclearAddressee, impressionWords } from '../../src/engine';
import type { TurnInput } from '../../src/engine';
import { hostile, stance, wary } from '../../src/engine/relations';

type IntentArg = Omit<Partial<Intent>, 'action'> & { action?: Partial<NonNullable<Intent['action']>> };
const intent = ({ action, ...p }: IntentArg): Intent => ({
  move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, ...p,
  action: action ? { type: 'other', skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance: 'normal', ...action } : null,
});
const input = (p: Partial<TurnInput> = {}): TurnInput => ({ intent: null, aimed: false, agentOutputs: [], spokespeople: [], ...p });
const npcAction = (type: string, target: string | null = null) => ({ type, target, skill: null, targetPart: null, aimed: false, defense: null, item: null, mode: null, intent: '' }) as never;
const planner = (actorId: string, action: unknown, extra: Record<string, unknown> = {}) =>
  ({ agent: 'planner', actorId, output: { action, dialogue: null, gear: null, stance: null, planUpdate: null, ...extra } }) as never;

let s: GameState;
beforeEach(() => {
  s = makeVillage();
  Object.assign(F, { init: {}, rollTier: {}, damage: 0, destroyPart: null, defended: true, surprise: true, morale: 'steady', alerts: [], attacks: [] });
});

describe('turn start (computePending)', () => {
  it('fires a turn_reached trigger once, logs it, removes it, and binds its order', () => {
    s.hidden.plans.guard_1 = { goal: 'g', steps: [], createdTurn: 3, triggers: [
      { id: 'amb', ownerId: 'guard_1', when: { type: 'turn_reached', turn: 7 }, then: { type: 'move', target: 'street_square', skill: null, intent: 'ambush' }, once: true },
    ] };
    for (let t = 3; t < 6; t++) { s.turn = t; expect(computePending(s).fired).toEqual([]); }
    s.turn = 6;
    const p = computePending(s);
    expect(p).toMatchObject({ turn: 7, fired: ['amb'], mode: 'explore' });
    expect(s.hidden.firedLog).toEqual([{ triggerId: 'amb', turn: 7, ownerId: 'guard_1' }]);
    expect(s.hidden.plans.guard_1.triggers).toEqual([]);
    expect(firedOrders(s)).toEqual([expect.objectContaining({ actorId: 'guard_1', type: 'move', target: 'street_square', source: 'trigger' })]);
    s.turn = 7;
    expect(computePending(s).fired).toEqual([]);
  });
  it('triggers of inactive owners stay armed', () => {
    s.hidden.plans.guard_1 = { goal: 'g', steps: [], createdTurn: 1, triggers: [
      { id: 't', ownerId: 'guard_1', when: { type: 'turn_reached', turn: 1 }, then: { type: 'hold', target: null, skill: null, intent: '' }, once: true },
    ] };
    actor(s, 'guard_1').core.condition.hpLostPct = 100;
    expect(computePending(s).fired).toEqual([]);
    expect(s.hidden.plans.guard_1.triggers).toHaveLength(1);
  });
  it('mode is tactical with an engaged actor, side-neutral', () => {
    expect(computePending(s).mode).toBe('explore');
    place(s, 'slime_1', 'gate_inner');
    actor(s, 'guard_1').mind!.knowledge.slime_1 = { status: 'suspicious', source: 'seen', revealed: [] };
    expect(computePending(s)).toMatchObject({ mode: 'tactical', engaged: ['guard_1'] });
  });
});

describe('order priority', () => {
  it('fired trigger > agent > routine; broken > agent', () => {
    const fired: Order[] = [{ actorId: 'guard_1', type: 'search', target: null, skill: null, intent: '', source: 'trigger' }];
    actor(s, 'trader').mind!.moraleState = 'broken';
    const ev = resolveTurn(s, input({ fired, agentOutputs: [planner('guard_1', npcAction('hold')), planner('trader', npcAction('call_help'))] }), createRng(1));
    const byActor = (id: string) => ev.filter((e) => e.actorId === id).map((e) => e.kind);
    expect(byActor('guard_1')).toEqual(['search']);
    expect(byActor('trader')).toEqual(['hold']);
    expect(byActor('patron_1')).toEqual(['idle']);
    expect(byActor('player')).toEqual(['hold']);
  });
  it('inactive actors get no order', () => {
    actor(s, 'guard_1').core.condition.hpLostPct = 100;
    const ev = resolveTurn(s, input({ agentOutputs: [planner('guard_1', npcAction('call_help'))] }), createRng(1));
    expect(ev.some((e) => e.actorId === 'guard_1')).toBe(false);
  });
  it('acts in initiative order', () => {
    F.init = { player: 10, guard_1: 90, trader: 70, patron_1: 60, slime_1: 40, slime_2: 30 };
    const ev = resolveTurn(s, input(), createRng(1));
    expect(ev.map((e) => e.actorId)).toEqual(['guard_1', 'trader', 'patron_1', 'slime_1', 'slime_2', 'player']);
  });
  it('an actor unaware of someone attacking it this turn acts last (INIT_UNAWARE)', () => {
    F.init = { player: 10, guard_1: 90, trader: 70, patron_1: 60, slime_1: 40, slime_2: 30 };
    const order = (aware: boolean) => {
      const t = makeVillage();
      if (aware) actor(t, 'guard_1').mind!.knowledge.player = { status: 'aware', source: 'seen', revealed: [] };
      const ev = resolveTurn(t, input({ intent: intent({ action: { type: 'attack', target: 'guard_1' } }) }), createRng(1));
      return [...new Set(ev.map((e) => e.actorId))];
    };
    expect(order(false).at(-1)).toBe('guard_1');
    expect(order(true)[0]).toBe('guard_1');
  });
  it('C1 Never Surprised: an unaware owner that hears the attack keeps its initiative and takes no unaware defense penalty', () => {
    F.init = { player: 10, guard_1: 90, trader: 70, patron_1: 60, slime_1: 40, slime_2: 30 };
    F.attacks = [];
    const t = makeVillage();
    place(t, 'guard_1', t.player.zone);
    actor(t, 'guard_1').core.perks.push({ perkId: PK.never_surprised, source: 'level', gainedTurn: 0 });
    const ev = resolveTurn(t, input({ intent: intent({ action: { type: 'attack', target: 'guard_1' } }) }), createRng(1));
    expect([...new Set(ev.map((e) => e.actorId))][0]).toBe('guard_1');
    const blow = F.attacks.find((r) => r.targetId === 'guard_1');
    expect(blow?.context?.defenderUnaware).toBe(false);
  });

});

describe('mid-turn triggers', () => {
  it('a player_seen_in_zone trigger replaces the order of an owner that has not acted, once', () => {
    F.init = { player: 90 };
    s.player.zone = 'street_square';
    s.hidden.plans.guard_1 = { goal: 'g', steps: [], createdTurn: 1, triggers: [
      { id: 'spring', ownerId: 'guard_1', when: { type: 'player_seen_in_zone', zone: 'gate_inner' }, then: { type: 'call_help', target: null, skill: null, intent: 'raise' }, once: true },
    ] };
    const ev = resolveTurn(s, input({ intent: intent({ move: { toZone: 'gate_inner' } }) }), createRng(1));
    expect(ev.filter((e) => e.actorId === 'guard_1').map((e) => e.kind)).toEqual(['call_help']);
    expect(s.hidden.firedLog).toEqual([{ triggerId: 'spring', turn: 1, ownerId: 'guard_1' }]);
    expect(s.hidden.plans.guard_1.triggers).toEqual([]);
    expect(computePending(s).fired).toEqual([]);
  });
});

describe('dialogue', () => {
  it('impressions come from the table', () => {
    expect(impressionWords('deceive', 'great_success')).toBe('very convincing');
    expect(impressionWords('intimidate', 'critical_failure')).toBe('laughable');
  });
  it('spokespeople: one per band, named member, never inactive, capped', () => {
    s.actors.push({ ...structuredClone(actor(s, 'patron_1')), id: 'patron_2' });
    const i = intent({ action: { type: 'talk' }, addressees: ['patron_2', 'tavern_folk', 'guard_1'], spoken: 'hi' });
    expect(selectSpokespeople(s, i)).toEqual(['patron_2']); // BG-84: the guard out at the gate cannot hear a normal voice
    actor(s, 'guard_1').zone = s.player.zone;
    expect(selectSpokespeople(s, i)).toEqual(['patron_2', 'guard_1']);
    actor(s, 'guard_1').zone = 'gate_inner';
    expect(selectSpokespeople(s, intent({ action: { type: 'attack' }, addressees: ['patron_1'] }))).toEqual([]);
    actor(s, 'patron_1').core.condition.hpLostPct = 100;
    expect(selectSpokespeople(s, intent({ action: { type: 'talk' }, addressees: ['patron_1'] }))).toEqual([]);
    expect(selectSpokespeople(s, intent({ action: { type: 'talk' }, addressees: ['everyone'] }))).toEqual(['patron_2']);
  });
  it('OQ-27 (c): the sticky partner answers for its band; with no partner and two members in sight, ask', () => {
    // patron_1 sits in the player's zone; the barkeep (trader) is one link away; both are tavern_folk
    const talk = intent({ action: { type: 'talk' }, addressees: ['tavern_folk'], spoken: 'hi' });
    expect(selectSpokespeople(s, talk)).toEqual(['patron_1']);
    expect(unclearAddressee(s, talk, ['patron_1', 'trader'])).toEqual(['patron_1', 'trader']);
    expect(unclearAddressee(s, talk, ['patron_1'])).toBeNull(); // only one seen
    // BG-143: words aimed at one of them (the action's target) are clear
    expect(unclearAddressee(s, intent({ action: { type: 'talk', target: 'trader' }, addressees: ['tavern_folk'], spoken: 'hi' }), ['patron_1', 'trader'])).toBeNull();
    s.stage.partner = 'trader';
    expect(selectSpokespeople(s, talk)).toEqual(['trader']);
    expect(unclearAddressee(s, talk, ['patron_1', 'trader'])).toBeNull();
    expect(unclearAddressee(s, intent({ action: { type: 'talk' }, addressees: ['everyone'] }), ['patron_1', 'trader'])).toBeNull();
  });
  it('one player roll, contested per spokesperson; SLIPS when the contest meets a check_passed reveal', () => {
    F.rollTier = { player: 'great_success', trader: 'near_miss', patron_1: 'critical_success' };
    s.hidden.secrets.push({ id: 'sec', holderId: 'trader', fact: 'x', leakTerms: [], revealWhen: { type: 'check_passed', skill: SK.persuasion, minTier: 'great_success', againstActorId: 'trader' } });
    const ex = resolveSpeech(s, intent({ action: { type: 'persuade' }, spoken: 'tell me' }), ['trader', 'patron_1'], createRng(1));
    expect(ex).toMatchObject({ skill: SK.persuasion, playerTier: 'great_success', impression: 'very convincing' });
    expect(ex.perSpokesperson.trader).toMatchObject({ contest: { winner: 'a', gap: -2 }, slips: ['sec'] });
    expect(ex.perSpokesperson.patron_1).toMatchObject({ contest: { winner: 'b' }, slips: [] });
    resolveTurn(s, input({ intent: intent({ action: { type: 'persuade' }, spoken: 'tell me' }), spokespeople: ['trader'], exchange: ex }), createRng(1));
    expect(s.player.journal!.secretsKnown).toEqual(['sec']);
  });
  it('exchange slot: player speech first, then spoken replies in initiative order; a deed resolves at its own initiative', () => {
    place(s, 'player', 'tav_counter');
    place(s, 'patron_1', 'tav_counter');
    F.init = { trader: 80, patron_1: 90, guard_1: 95 };
    const say = (actorId: string, line: string) => ({ agent: 'voice', actorId, output: { action: npcAction('talk', 'player'), line, volume: 'normal', shares: [], gear: null, stance: null, routine: null } }) as never;
    const ex = resolveSpeech(s, intent({ action: { type: 'talk' } }), ['trader', 'patron_1'], createRng(1));
    const ev = resolveTurn(s, input({ intent: intent({ action: { type: 'talk' }, spoken: 'evening' }), spokespeople: ['trader', 'patron_1'], exchange: ex,
      agentOutputs: [say('trader', 'what?'), say('patron_1', 'hm')] }), createRng(1));
    expect(ev.slice(0, 3).map((e) => [e.actorId, e.kind, e.line?.text])).toEqual([['player', 'speak', 'evening'], ['patron_1', 'speak', 'hm'], ['trader', 'speak', 'what?']]);
    // deed instead of a reply
    const s2 = makeVillage();
    place(s2, 'player', 'tav_counter');
    beside(s2, 'trader'); // within arm's reach: the deed is the blow itself
    F.init = { player: 99, trader: 10, guard_1: 50 };
    actor(s2, 'trader').mind!.knowledge.player = { status: 'aware', source: 'seen', revealed: [] };
    s2.bands.find((b) => b.id === 'tavern_folk')!.relations.player_band = 'hostile';
    const resp = { agent: 'responder', actorId: 'trader', output: { action: npcAction('attack', 'player'), dialogue: { line: 'die', volume: 'shout' }, gear: null, stance: null, reveals: [], planUpdate: null } } as never;
    const ev2 = resolveTurn(s2, input({ intent: intent({ action: { type: 'talk' }, spoken: 'hi' }), spokespeople: ['trader'], exchange: resolveSpeech(s2, intent({ action: { type: 'talk' } }), ['trader'], createRng(2)), agentOutputs: [resp] }), createRng(1));
    expect(ev2.filter((e) => e.kind === 'speak').map((e) => e.actorId)).toEqual(['player']);
    const atk = ev2.find((e) => e.actorId === 'trader')!;
    expect(atk).toMatchObject({ kind: 'attack', bark: true, line: { text: 'die' } });
    expect(ev2.indexOf(atk)).toBe(ev2.length - 1); // initiative 10: last
  });
  it('words beside an attack are a bark', () => {
    place(s, 'patron_1', 'tav_common');
    const o = fromIntent(s, intent({ action: { type: 'attack', target: 'patron_1' }, spoken: 'take that' }), true);
    expect(o).toMatchObject({ type: 'attack', aimed: true, line: { text: 'take that' } });
    const ev = resolveTurn(s, input({ intent: intent({ action: { type: 'attack', target: 'patron_1' }, spoken: 'take that' }) }), createRng(1));
    expect(ev.find((e) => e.actorId === 'player')).toMatchObject({ kind: 'attack', bark: true });
  });
});

describe('agent side effects', () => {
  it('planUpdate replaces plan and memory; stance only toward heard speakers; reveals only own secrets', () => {
    s.hidden.secrets.push({ id: 'mine', holderId: 'trader', fact: 'x', leakTerms: [], revealWhen: { type: 'event_in_zone', kind: 'x', zone: 'x' } });
    s.hidden.secrets.push({ id: 'theirs', holderId: 'guard_1', fact: 'y', leakTerms: [], revealWhen: { type: 'event_in_zone', kind: 'x', zone: 'x' } });
    s.player.zone = 'tav_counter';
    const ex = resolveSpeech(s, intent({ action: { type: 'talk' } }), ['trader'], createRng(1));
    const resp = { agent: 'responder', actorId: 'trader', output: {
      action: npcAction('talk', 'player'), dialogue: { line: "I'm Mags", volume: 'normal' }, gear: null,
      stance: { toward: 'player', step: 'friendlier' }, reveals: ['mine', 'theirs'],
      planUpdate: { goal: 'sell', steps: [], memoryNote: 'met them', routine: null, triggers: [{ id: 'bad', when: { type: 'nope' } }] },
    } } as never;
    const p = planner('guard_1', npcAction('hold'), { stance: { toward: 'player', step: 'colder' } });
    resolveTurn(s, input({ intent: intent({ action: { type: 'talk' }, spoken: 'hi' }), spokespeople: ['trader'], exchange: ex, agentOutputs: [resp, p] }), createRng(1));
    expect(s.hidden.plans.trader).toEqual({ goal: 'sell', steps: [], triggers: [], createdTurn: 1 });
    expect(s.hidden.memory.trader).toEqual([{ turn: 1, text: 'met them' }]);
    expect(actor(s, 'trader').mind!.overrides).toEqual({ player: 'friendly' });
    expect(actor(s, 'guard_1').mind!.overrides).toBeUndefined();
    expect(s.player.journal!.secretsKnown).toEqual(['mine']);
    expect(s.log.map((l) => l.code)).toEqual(expect.arrayContaining(['invalid_stance', 'invalid_reveal']));
  });
  it('RS4: one colder step from neutral is unfriendly (not on guard); the next is opposed (wary)', () => {
    s.player.zone = 'tav_counter';
    const colder = () => {
      const ex = resolveSpeech(s, intent({ action: { type: 'talk' } }), ['trader'], createRng(1));
      const resp = { agent: 'responder', actorId: 'trader', output: {
        action: npcAction('talk', 'player'), dialogue: { line: 'watch it', volume: 'normal' }, gear: null,
        stance: { toward: 'player', step: 'colder' }, reveals: [], planUpdate: null,
      } } as never;
      resolveTurn(s, input({ intent: intent({ action: { type: 'talk' }, spoken: 'you cheat' }), spokespeople: ['trader'], exchange: ex, agentOutputs: [resp] }), createRng(1));
      s.turn++;
    };
    expect(stance(s, actor(s, 'trader'), s.player)).toBe('neutral');
    colder();
    expect(stance(s, actor(s, 'trader'), s.player)).toBe('unfriendly');
    expect(wary(s, actor(s, 'trader'), s.player)).toBe(false);
    colder();
    expect(stance(s, actor(s, 'trader'), s.player)).toBe('opposed');
    expect(wary(s, actor(s, 'trader'), s.player)).toBe(true);
  });
  it('RS3: a loyal actor is hostile to whoever is hostile to the one it is loyal to, unless it is friendly or warmer to them', () => {
    const g = actor(s, 'guard_1'), p = actor(s, 'patron_1');
    g.mind!.overrides = { player: 'loyal' };
    p.mind!.overrides = { player: 'hostile' };
    expect(hostile(s, g, p)).toBe(true);
    g.mind!.overrides = { player: 'loyal', patron_1: 'friend' };
    expect(hostile(s, g, p)).toBe(false);
    g.mind!.overrides = { player: 'friend' };
    expect(hostile(s, g, p)).toBe(false);
  });
  it('a friend turns on whoever is hostile to its friend only if it is already opposed or colder to them', () => {
    const g = actor(s, 'guard_1'), p = actor(s, 'patron_1');
    p.mind!.overrides = { player: 'hostile' };
    for (const [toPatron, want] of [['opposed', true], ['unfriendly', false], ['neutral', false], ['friendly', false]] as const) {
      g.mind!.overrides = { player: 'friend', patron_1: toPatron };
      expect(hostile(s, g, p), toPatron).toBe(want);
    }
    p.mind!.overrides = { player: 'opposed' }; // the patron isn't hostile to the player: no side to take
    g.mind!.overrides = { player: 'friend', patron_1: 'opposed' };
    expect(hostile(s, g, p)).toBe(false);
  });
});

describe('gear and combat', () => {
  const engage = (id: string) => {
    actor(s, id).mind!.knowledge.player = { status: 'aware', source: 'seen', revealed: [] };
    s.bands.find((b) => b.id === actor(s, id).bandId)!.relations.player_band = 'hostile';
  };
  it('reach counts links with sight; no sight is a wasted action', () => {
    s.player.core.inventory.push({ id: 'bw', itemId: IT.shortbow });
    s.player.core.inventory.forEach((i) => { if (i.equippedIn?.some((x) => x.startsWith('grip:'))) delete i.equippedIn; });
    s.player.zone = 'tav_common';
    // tav_counter linked with sight; street_door linked without sight
    place(s, 'patron_1', 'tav_counter');
    place(s, 'trader', 'street_door');
    const r1 = resolveTurn(s, input({ intent: intent({ gear: [{ op: 'draw', item: 'bw' }], action: { type: 'attack', target: 'patron_1', mode: AM.shoot } }) }), createRng(1));
    expect(r1.find((e) => e.actorId === 'player')).toMatchObject({ kind: 'attack', target: 'patron_1' });
    s.turn = 2;
    const r2 = resolveTurn(s, input({ intent: intent({ action: { type: 'attack', target: 'trader', mode: AM.shoot } }) }), createRng(1));
    expect(r2.find((e) => e.actorId === 'player')).toMatchObject({ kind: 'wasted', target: 'trader' });
  });
  it('a thrown dagger lands on the target zone ground, hit or miss', () => {
    s.player.core.inventory.push({ id: 'dg', itemId: IT.dagger, equippedIn: ['grip:left_arm'] });
    s.player.core.inventory.find((i) => i.itemId === IT.round_shield)!.equippedIn = undefined;
    place(s, 'patron_1', s.player.zone); // a knife throw (7 m) reaches its own zone
    F.defended = false;
    resolveTurn(s, input({ intent: intent({ action: { type: 'attack', target: 'patron_1', item: 'dg', mode: AM.throw } }) }), createRng(1));
    expect(s.zones.find((z) => z.id === s.player.zone)!.groundItems.map((i) => i.id)).toEqual(['dg']);
    expect(s.player.core.inventory.some((i) => i.id === 'dg')).toBe(false);
  });
  it('a Destroyed sword arm drops the sword; pick up is free and returns it', () => {
    place(s, 'guard_1', 'tav_common');
    F.destroyPart = 'right_arm';
    const ev = resolveTurn(s, input({ intent: intent({ action: { type: 'attack', target: 'guard_1' } }) }), createRng(1));
    const drop = ev.find((e) => e.kind === 'item_dropped')!;
    expect(drop).toMatchObject({ actorId: 'guard_1', itemId: `guard_1_${IT.arming_sword}_1` });
    expect(drop.perception.player).toBeTruthy();
    F.destroyPart = null;
    s.turn = 2;
    const ev2 = resolveTurn(s, input({ intent: intent({ gear: [{ op: 'pick_up', item: `guard_1_${IT.arming_sword}_1` }], action: { type: 'attack', target: 'guard_1' } }) }), createRng(1));
    expect(s.player.core.inventory.some((i) => i.id === `guard_1_${IT.arming_sword}_1`)).toBe(true);
    expect(ev2.filter((e) => e.actorId === 'player').map((e) => e.kind)).toEqual(['pick_up', 'attack']);
  });
  it('equip on armor takes the main action', () => {
    const ev = resolveTurn(s, input({ intent: intent({ action: { type: 'equip', item: `player_${IT.gambeson}_3` } }) }), createRng(1));
    expect(ev.filter((e) => e.actorId === 'player').map((e) => e.kind)).toEqual(['equip']);
    expect(s.player.core.inventory.find((i) => i.id === `player_${IT.gambeson}_3`)!.equippedIn).toBeUndefined();
  });
  it('second defense counts as outnumbered; morale breaks an engaged NPC reaching Injured', () => {
    place(s, 'guard_1', 'tav_common');
    engage('guard_1');
    actor(s, 'patron_1').mind!.knowledge.guard_1 = { status: 'aware', source: 'seen', revealed: [] };
    actor(s, 'patron_1').mind!.overrides = { guard_1: 'hostile' };
    F.init = { player: 90, patron_1: 80, guard_1: 10 };
    F.damage = 20;
    F.morale = 'broken';
    actor(s, 'guard_1').core.condition.moraleLost = 90; // near Broken: Injured's fear (25 × 1.5) breaks it
    resolveTurn(s, input({ intent: intent({ action: { type: 'attack', target: 'guard_1' } }), agentOutputs: [planner('patron_1', npcAction('attack', 'guard_1'))] }), createRng(1));
    expect(F.attacks.map((a) => a.context?.defensesThisTurn)).toEqual([0, 1]);
    expect(actor(s, 'guard_1').mind!.moraleState).toBe('broken');
    expect(actor(s, 'guard_1').mind!.overrides?.player).toBe('yielded'); // Q4: broken shares the yielded stance
    expect(s.player.progression!.xpLog?.some((x) => x.source === 'defeat:guard_1')).toBe(true); // a break is a defeat: it pays
  });
  it('a surrender yields (Q1): no more blocking rest, still pays XP; attacked again it is hostile; at the scenario end a grudge and it leaves', async () => {
    place(s, 'guard_1', 'tav_common');
    engage('guard_1');
    F.init = { player: 90, guard_1: 10 };
    F.damage = 45;
    F.morale = 'surrendered';
    actor(s, 'guard_1').core.condition.moraleLost = 90; // Injured's fear at Critical Failure (25 × 2) breaks it: a surrender
    resolveTurn(s, input({ intent: intent({ action: { type: 'attack', target: 'guard_1' } }) }), createRng(1));
    const g = actor(s, 'guard_1');
    expect(g.mind!.moraleState).toBe('surrendered');
    expect(g.mind!.overrides?.player).toBe('yielded');
    expect(s.player.progression!.xpLog?.some((x) => x.source === 'defeat:guard_1')).toBe(true);
    s.turn += 1;
    s.player.core.condition.hpLostPct = 50;
    resolveTurn(s, input({ intent: intent({ action: { type: 'rest' } }) }), createRng(1));
    expect(s.log.some((l) => l.code === 'rest_blocked' && l.turn === s.turn)).toBe(false);
    // scenario end: opposed, surrender over, off to its exit on foot (NW1: head_to, never a jump)
    const { beginScenario } = await import('../../src/scenario/apply');
    g.mind!.slots = { ...(g.mind!.slots ?? {}), exit: 'street_door' };
    F.headTo.length = 0;
    beginScenario(s, 'success');
    expect(g.mind!.overrides?.player).toBe('opposed');
    expect(g.mind!.moraleState).toBeUndefined();
    expect(g.zone).toBe('tav_common');
    expect(F.headTo.map(([, a, dest, by]) => [(a as { id: string }).id, dest, by])).toEqual([[g.id, 'street_door', 'yield']]);
  });
  it('a yielded actor attacked again turns hostile (Q1)', () => {
    place(s, 'guard_1', 'tav_common');
    actor(s, 'guard_1').mind!.overrides = { player: 'yielded' };
    resolveTurn(s, input({ intent: intent({ action: { type: 'attack', target: 'guard_1' } }) }), createRng(1));
    expect(actor(s, 'guard_1').mind!.overrides?.player).toBe('hostile');
  });
  const atLeastAware = (a: Actor) => ['aware', 'tracking'].includes(a.mind!.knowledge.player?.status ?? '');
  it('RS6: a target turns hostile only toward an attacker it knows of', () => {
    // a dagger thrown from hiding (a ranged blow keeps you hidden, ST5/ST7)
    s.player.core.inventory.push({ id: 'dg', itemId: IT.dagger, equippedIn: ['grip:left_arm'] });
    s.player.core.inventory.find((i) => i.itemId === IT.round_shield)!.equippedIn = undefined;
    place(s, 'patron_1', 'tav_counter');
    const p = actor(s, 'patron_1');
    s.player.posture = 'stealthy';
    p.mind!.knowledge = {};
    F.rollTier.player = 'critical_success'; // the player stays unseen
    F.rollTier.patron_1 = 'critical_failure';
    resolveTurn(s, input({ intent: intent({ action: { type: 'attack', target: 'patron_1', item: 'dg', mode: AM.throw } }) }), createRng(1));
    expect(atLeastAware(p)).toBe(false);
    expect(p.mind!.overrides?.player).toBeUndefined();
    // seen: now it knows who it is, and a blow makes it hostile
    s.player.posture = 'open';
    p.mind!.knowledge.player = { status: 'aware', source: 'seen', revealed: [] };
    place(s, 'patron_1', 'tav_common');
    s.turn++;
    resolveTurn(s, input({ intent: intent({ action: { type: 'attack', target: 'patron_1' } }) }), createRng(1));
    expect(p.mind!.overrides?.player).toBe('hostile');
  });
  it('rest heals once per cooldown, never beside an opposed actor', () => {
    s.player.core.condition.hpLostPct = 50;
    resolveTurn(s, input({ intent: intent({ action: { type: 'rest' } }) }), createRng(1));
    expect(s.player.core.condition.hpLostPct).toBeCloseTo(25, 0); // H12: plus a little natural recovery
    s.turn = 2;
    resolveTurn(s, input({ intent: intent({ action: { type: 'rest' } }) }), createRng(1));
    expect(s.player.core.condition.hpLostPct).toBeGreaterThan(20); // blocked: only natural recovery
    expect(s.log.some((l) => l.code === 'rest_blocked')).toBe(true);
  });
});
