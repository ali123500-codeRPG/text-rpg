// W3 — the six deny-by-default view builders (+ the combat packet). Copy whitelisted fields into new objects only.
import type { ActorView, CombatPacket, DialogueInput, DialogueView, GameEvent, GameState, Intent, NarrationView, OppositionView, PlayerView, WeaverView } from '../types';
import { todo } from '../todo';

export function buildPlayerView(state: GameState): PlayerView { return todo('buildPlayerView'); }
export function buildActorView(state: GameState, actorId: string): ActorView { return todo('buildActorView'); }
export function buildOppositionView(state: GameState, actorId: string): OppositionView { return todo('buildOppositionView'); }
export function buildDialogueView(state: GameState, actorId: string, input: DialogueInput): DialogueView { return todo('buildDialogueView'); }
/** events: this turn's events (the builder keeps only those the player perceived). */
export function buildNarrationView(state: GameState, events: GameEvent[], intent?: Intent | null): NarrationView { return todo('buildNarrationView'); }
export function buildWeaverView(state: GameState, target: WeaverView['target']): WeaverView { return todo('buildWeaverView'); }
/** Part 3 packet: no numbers. Others' Healthy→Damaged and Bruised–Injured stay hidden; the player's own condition is always visible. */
export function buildCombatPacket(state: GameState, event: GameEvent, viewerId: string): CombatPacket { return todo('buildCombatPacket'); }
