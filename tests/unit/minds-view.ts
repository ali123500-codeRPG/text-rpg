// Hand-built ActorView for W5 unit tests (the real builder is W3's buildActorView).
import { now, timeOfDay } from '../../src/time';
import type { ActorView, GameState } from '../../src/types';
import { actorById, isActive, hostile, seesAcross, stance } from '../../src/engine/relations';
import { fallbackAttackSkill } from '../../src/ruleset';
import { waysOut } from '../../src/plan/where';

export function fakeView(state: GameState, id: string, self: Partial<ActorView['self']> = {}): ActorView {
  const a = actorById(state, id)!;
  const m = a.mind!;
  return {
    turn: state.turn, tacticsWord: 'simple',
    time: { day: 1, timeOfDay: 'Morning' },
    personality: '',
    self: {
      id: a.id, label: a.label, name: a.names.current, kind: 'npc', zone: a.zone, placeId: a.placeId, bandId: a.bandId,
      health: 'unhurt', parts: [], morale: 'Calm', fatigue: 'Rested', active: isActive(a), broken: m.moraleState === 'broken', surrendered: m.moraleState === 'surrendered',
      control: m.control, standingDefense: a.core.standingDefense, gear: [],
      attackSkill: fallbackAttackSkill(state, a),
      routine: m.routine ? { ...m.routine, elapsed: Math.max(0, now(state) - m.routine.at), dayPart: timeOfDay(now(state)) } : undefined,
      routines: (m.routines ?? []).map((r) => ({ id: r, brief: '' })),
      routineSetId: m.routineSetId, slots: { ...(m.slots ?? {}) }, alarm: m.alarm ? { ...m.alarm } : undefined,
      ...self,
    },
    beliefs: Object.entries(m.knowledge).map(([about, b]) => {
      const o = actorById(state, about)!;
      return { about, status: b.status, lastKnownZone: b.lastKnownZone, lastSeenTurn: b.lastSeenTurn, source: b.source, revealed: [], stance: stance(state, a, o), hostile: hostile(state, a, o), active: isActive(o), label: o.label };
    }),
    perceived: [], told: [], said: [], secrets: [], firedTriggers: [],
    band: { id: a.bandId, name: '', goals: '', temperament: '', relations: {} },
    map: state.zones.map((z) => ({ id: z.id, links: waysOut(state, z.id).map((l) => ({ to: l.to, sight: seesAcross(state, l), ...(l.frontier ? { frontier: true } : {}) })) })),
    zones: [], seen: [],
  };
}
