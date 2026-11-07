// Hand-built ActorView for W5 unit tests (the real builder is W3's buildActorView).
import type { ActorView, GameState } from '../../src/types';
import { actorById, isActive, opposed } from '../../src/engine/relations';
import { getLibrary } from '../../src/library';

export function fakeView(state: GameState, id: string, self: Partial<ActorView['self']> = {}): ActorView {
  const a = actorById(state, id)!;
  const m = a.mind!;
  const tpl = a.core.templateId ? getLibrary().templates[a.core.templateId] : undefined;
  return {
    turn: state.turn,
    self: {
      id: a.id, label: a.label, name: a.names.current, kind: 'npc', zone: a.zone, placeId: a.placeId, bandId: a.bandId,
      health: 'Unhurt', parts: [], active: isActive(a), broken: m.moraleState === 'broken', surrendered: m.moraleState === 'surrendered',
      fearless: !!m.fearless, control: m.control, standingDefense: a.core.standingDefense, gear: [],
      attackSkill: tpl?.fallback?.attackSkill ?? getLibrary().creatures[a.core.creatureTypeId].fallback.attackSkill,
      routine: m.routine ? { ...m.routine } : undefined,
      routines: (m.routines ?? []).map((r) => ({ id: r, brief: '' })),
      routineSetId: m.routineSetId, slots: { ...(m.slots ?? {}) }, alarm: m.alarm ? { ...m.alarm } : undefined,
      ...self,
    },
    beliefs: Object.entries(m.knowledge).map(([about, b]) => {
      const o = actorById(state, about)!;
      return { about, status: b.status, lastKnownZone: b.lastKnownZone, lastSeenTurn: b.lastSeenTurn, source: b.source, revealed: [], opposed: opposed(state, a, o), active: isActive(o), label: o.label };
    }),
    perceived: [], told: [], secrets: [], firedTriggers: [],
    band: { id: a.bandId, name: '', goals: '', temperament: '', tacticsLevel: 1, relations: {} },
    map: state.zones.filter((z) => state.stage.zoneIds.includes(z.id)).map((z) => ({ id: z.id, links: z.links.map((l) => ({ to: l.to, sight: l.sight, ...(l.frontier ? { frontier: true } : {}) })) })),
    zones: [], seen: [],
  };
}
