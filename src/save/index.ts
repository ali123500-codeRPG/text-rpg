// W1 — Save, load, undo, backups (Part 4 §6–8, §10–11).
import type { GameState, Head, TurnRecord } from '../types';
import type { Library } from '../types';
import { todo } from '../todo';

/** the artifact database, or an in-memory fake for tests. Paths have an even segment count. */
export interface Store {
  get<T = unknown>(path: string): Promise<T | null>;
  set(path: string, value: unknown): Promise<void>;
  delete(path: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  /** single-writer lease; returns false when held by another window */
  acquireLease(path: string, owner: string, ms: number): Promise<boolean>;
  releaseLease(path: string, owner: string): Promise<void>;
}

export function memoryStore(): Store { return todo('memoryStore'); }
/** Save, once per turn (Part 4 §10). Writing control/head is the commit. */
export async function saveTurn(store: Store, state: GameState, record: TurnRecord): Promise<Head> { return todo('saveTurn'); }
/** Load: checksums, migrations, library reconcile, invariants, references; then build GameState. */
export async function loadStory(store: Store, storyId: string, library: Library): Promise<{ state: GameState; report: string[] }> { return todo('loadStory'); }
/** Undo one turn: head back to the undo bookmark; RNG state carried forward (not rolled back). */
export async function undoTurn(store: Store, storyId: string): Promise<void> { return todo('undoTurn'); }
export async function readTurnRecord(store: Store, storyId: string, turn: number): Promise<TurnRecord | null> { return todo('readTurnRecord'); }
