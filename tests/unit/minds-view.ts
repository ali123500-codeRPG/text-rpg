// Hand-built ActorView for W5 unit tests (the real builder is W3's buildActorView).
import type { ActorView, GameState } from '../../src/types';
import { actorById, isActive, hostile, stance } from '../../src/engine/relations';
import { getLibrary } from '../../src/library';

export function fakeView(state: GameState, id: string, self: Partial<ActorView['self']> = {}): ActorView {
  const a = actorById(state, id)!;
  const m = a.mind!;
  const tpl = a.core.templateId ? getLibrary().templates[a.core.templateId] : undefined;
  return {
    turn: state.turn,
    time: { day: 1, timeOfDay: 'Day' },
    personality: '',
    self: {
      id: a.id, label: a.label, name: a.names.current, kind: 'npc', zone: a.zone, placeId: a.placeId, bandId: a.bandId,
      health: 'unhurt', parts: [], morale: 'Calm', active: isActive(a), broken: m.moraleState === 'broken', surrendered: m.moraleState === 'surrendered',
      control: m.control, standingDefense: a.core.standingDefense, gear: [],
      attackSkill: tpl?.fallback?.attackSkill ?? getLibrary().bodyTypes[a.core.bodyTypeId].fallback.attackSkill,
      routine: m.routine ? { ...m.routine } : undefined,
      routines: (m.routines ?? []).map((r) => ({ id: r, brief: '' })),
      routineSetId: m.routineSetId, slots: { ...(m.slots ?? {}) }, alarm: m.alarm ? { ...m.alarm } : undefined,
      ...self,
    },
    beliefs: Object.entries(m.knowledge).map(([about, b]) => {
      const o = actorById(state, about)!;
      return { about, status: b.status, lastKnownZone: b.lastKnownZone, lastSeenTurn: b.lastSeenTurn, source: b.source, revealed: [], stance: stance(state, a, o), hostile: hostile(state, a, o), active: isActive(o), label: o.label };
    }),
    perceived: [], told: [], said: [], secrets: [], firedTriggers: [],
    band: { id: a.bandId, name: '', goals: '', temperament: '', tactics: 'simple', relations: {} },
    map: state.zones.filter((z) => state.stage.zoneIds.includes(z.id)).map((z) => ({ id: z.id, links: z.links.map((l) => ({ to: l.to, sight: l.sight, ...(l.frontier ? { frontier: true } : {}) })) })),
    zones: [], seen: [],
  };
}
