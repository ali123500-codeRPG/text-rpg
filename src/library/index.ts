// Library access. Lookup order: the story's blueprints first, then the library (Part 4 §2), following aliases.
import type { ActivityDef, CreatureType, GameState, ItemDef, Library, NpcTemplate, Routine, RoutineSet } from '../types';
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

function blueprint<T>(state: GameState | null | undefined, kind: 'item' | 'creature' | 'npcTemplate', id: string): T | undefined {
  const bp = state?.blueprints?.find((b) => b.kind === kind && b.id === id);
  return bp ? (bp.data as T) : undefined;
}

export function itemDef(state: GameState | null | undefined, itemId: string): ItemDef {
  const d = blueprint<ItemDef>(state, 'item', itemId) ?? current.items[resolveAlias(itemId)];
  if (!d) throw new Error(`unknown item ${itemId}`);
  return d;
}
export function creatureType(state: GameState | null | undefined, id: string): CreatureType {
  const d = blueprint<CreatureType>(state, 'creature', id) ?? current.creatures[resolveAlias(id)];
  if (!d) throw new Error(`unknown creature type ${id}`);
  return d;
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
