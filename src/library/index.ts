// Library access. Lookup order: the story's blueprints first, then the library (Part 4 §2), following aliases.
import type { ActivityDef, Actor, BodyType, GameState, ItemDef, Library, NaturalArmor, NpcTemplate, RaceDef, Routine, RoutineSet } from '../types';
import { prototypeLibrary } from './data';

let current: Library = prototypeLibrary();
export function getLibrary(): Library {
  return current;
}
export function setLibrary(lib: Library): void {
  current = lib;
}
export function resetLibrary(): void {
  current = prototypeLibrary();
}

/** follow renamed/replaced aliases; returns the final id */
export function resolveAlias(id: string, lib: Library = current): string {
  let seen = 0;
  let cur = id;
  while (seen++ < 16) {
    const s = lib.status[cur];
    if (s?.state === 'renamed') cur = s.to;
    else if (s?.state === 'replaced') cur = s.by;
    else break;
  }
  return cur;
}

function blueprint<T>(state: GameState | null | undefined, kind: 'item' | 'body_type' | 'npcTemplate', id: string): T | undefined {
  const bp = state?.blueprints?.find((b) => b.kind === kind && b.id === id);
  return bp ? (bp.data as T) : undefined;
}

export function itemDef(state: GameState | null | undefined, itemId: string): ItemDef {
  const d = blueprint<ItemDef>(state, 'item', itemId) ?? current.items[resolveAlias(itemId)];
  if (!d) throw new Error(`unknown item ${itemId}`);
  return d;
}
export function bodyType(state: GameState | null | undefined, id: string): BodyType {
  const d = blueprint<BodyType>(state, 'body_type', id) ?? current.bodyTypes[resolveAlias(id)];
  if (!d) throw new Error(`unknown body type ${id}`);
  return d;
}
/** BR3/BR5: an actor's shape merged with its race: the shape's attacks plus the race's, the race's speed (NR14), natural armor
 * and fallback skill (else the shape's), and the race's HP multiplier (BR2; 1 with no race). */
export type ActorBody = BodyType & { hpMultiplier: number; naturalArmor?: NaturalArmor };
export function race(id: string): RaceDef {
  const r = current.races?.[resolveAlias(id)];
  if (!r) throw new Error(`unknown race ${id}`);
  return r;
}
export function actorBody(state: GameState | null | undefined, actor: Actor): ActorBody {
  const b = bodyType(state, actor.core.bodyTypeId);
  const r = actor.core.raceId ? current.races?.[resolveAlias(actor.core.raceId)] : undefined;
  return {
    ...b,
    naturalAttacks: [...b.naturalAttacks, ...(r?.naturalAttacks ?? [])],
    fallback: r?.fallback ?? b.fallback,
    speed: r?.speed ?? b.speed,
    hpMultiplier: r?.hpMultiplier ?? 1,
    ...(r?.naturalArmor ? { naturalArmor: r.naturalArmor } : {}),
  };
}
export function npcTemplate(state: GameState | null | undefined, id: string): NpcTemplate {
  const d = blueprint<NpcTemplate>(state, 'npcTemplate', id) ?? current.templates[resolveAlias(id)];
  if (!d) throw new Error(`unknown template ${id}`);
  return d;
}
export function hasTemplate(state: GameState | null | undefined, id: string): boolean {
  return !!(blueprint(state, 'npcTemplate', id) ?? current.templates[resolveAlias(id)]);
}
export function routine(id: string): Routine {
  const r = current.routines[id];
  if (!r) throw new Error(`unknown routine ${id}`);
  return r;
}
export function routineSet(id: string): RoutineSet | undefined {
  return current.routineSets[id];
}
export function activity(id: string): ActivityDef {
  const a = current.activities[id];
  if (!a) throw new Error(`unknown activity ${id}`);
  return a;
}
