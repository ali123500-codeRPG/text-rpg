// Creation-screen preview: builds a throwaway sheet and a one-zone duel state, then asks the ruleset (W2) for the numbers.
// Every figure is null until the ruleset helper behind it exists (stubs throw), and the screen shows "—".
import type { Actor, CreationBuild, GameState } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { createPlayer, spawnNpc } from '../library/spawn';
import { effectiveSkill, ruleset, totalHp } from '../ruleset';
import { createRng } from '../rng';

/** The preview's sheet: the game's own builder (library createPlayer), placed in the duel zone. */
export function playerFromBuild(build: CreationBuild, storyId = 'preview', zone = 'duel', placeId = 'duel'): Actor {
  return { ...createPlayer(build, storyId, { preview: true }), zone, placeId };
}

function duelState(build: CreationBuild): GameState {
  const zone = { id: 'duel', placeId: 'duel', name: 'field', look: 'open grass', links: [], cover: 'none' as const, light: 'bright' as const, groundItems: [] };
  const settings = { difficulty: 'normal', showMechanics: CONFIG.SHOW_MECHANICS, tone: CONFIG.STYLE.tone };
  return {
    storyId: 'preview', turn: 0, mode: 'tactical', zones: [zone], player: playerFromBuild(build),
    actors: [spawnNpc(null, 'slime', { id: 'slime', zone: 'duel', placeId: 'duel', bandId: 'slimes', storyId: 'preview' })],
    bands: [], hidden: { plans: {}, memory: {}, secrets: [], firedLog: [], weaverNote: '', stage: { eventSummary: '', challenge: 'none', gain: 'none', hiddenTerms: [] } },
    events: [], agentLog: [], log: [], rngSeed: 1, rngState: 1, pending: { turn: 0, mode: 'tactical', engaged: [], fired: [] },
    places: [{ id: 'duel', storyId: 'preview', kind: 'place', parentId: null, names: { current: 'field', past: [] }, zones: [zone], state: {}, headlines: [] }],
    facts: [], stage: { zoneIds: ['duel'], tier: 'success', sceneNumber: 0, sceneStartTurn: 0 }, sceneCaps: { promotions: 0, minted: 0 },
    clocks: {}, flags: {}, quests: [], settings, libraryVersion: getLibrary().version, blueprints: [],
    meta: { storyId: 'preview', title: 'preview', schemaVersion: CONFIG.SCHEMA_VERSION, createdAt: '', settings },
  };
}

const safe = <T>(f: () => T): T | null => { try { const v = f(); return v ?? null; } catch { return null; } };

export type Preview = {
  hp: number | null; attack: number | null; defense: { kind: 'block' | 'dodge'; value: number } | null;
  swingsToKill: number | null; slamsToDown: number | null; slimeHp: number | null;
};

/** Average damage per swing over `swings` seeded attacks (ruleset.attack is pure apart from the rng). */
function avgDamage(state: GameState, attackerId: string, targetId: string, weaponId: string, swings: number): number {
  const rng = createRng(7);
  let sum = 0;
  for (let i = 0; i < swings; i++) sum += ruleset.attack({ attackerId, targetId, weaponId, targetPart: null, aimed: false }, state, rng).damage;
  return sum / swings;
}

export function preview(build: CreationBuild, swings: number): Preview {
  const state = safe(() => duelState(build));
  if (!state) return { hp: null, attack: null, defense: null, swingsToKill: null, slamsToDown: null, slimeHp: null };
  const p = state.player, slime = state.actors[0];
  const sword = p.core.inventory.find((i) => i.itemId === 'arming_sword')!.id;
  const shield = p.core.inventory.find((i) => i.itemId === 'round_shield')!.id;
  const hp = safe(() => totalHp(state, p));
  const slimeHp = safe(() => totalHp(state, slime));
  const attack = safe(() => effectiveSkill(state, p, 'melee_medium', { itemId: sword }).value);
  const block = safe(() => effectiveSkill(state, p, 'block', { itemId: shield }).value);
  const dodge = safe(() => effectiveSkill(state, p, 'dodge').value);
  const defense = block === null || dodge === null ? null : block >= dodge ? { kind: 'block' as const, value: block } : { kind: 'dodge' as const, value: dodge };
  const mine = safe(() => avgDamage(state, 'player', 'slime', sword, swings));
  const theirs = safe(() => avgDamage(state, 'slime', 'player', 'natural:slam', swings));
  return {
    hp, attack, defense, slimeHp,
    swingsToKill: mine && slimeHp ? slimeHp / mine : null,
    slamsToDown: theirs && hp ? hp / theirs : null,
  };
}
