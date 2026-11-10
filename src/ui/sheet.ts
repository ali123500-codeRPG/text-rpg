// Creation-screen preview: builds a throwaway sheet and a one-zone duel state, then asks the ruleset (W2) for the numbers.
// Every figure is null until the ruleset helper behind it exists (stubs throw), and the screen shows "—".
import { AM } from '../library/tableIds';
import { TP } from '../library/templateIds';
import type { Actor, CreationBuild, DefenseKind, GameState } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { createPlayer, spawnNpc } from '../library/spawn';
import { defaultMode, defaultStandingDefense, effectiveSkill, modeSkill, ruleset, totalHp } from '../ruleset';
import { defenseItem } from '../ruleset/gear';
import { itemDef } from '../library';
import { skillName } from '../library/skillNames';
import { createRng } from '../rng';
import { SK, DEFENSE_SKILL } from '../library/skillIds';

/** The preview's sheet: the game's own builder (library createPlayer), placed in the duel zone. */
export function playerFromBuild(build: CreationBuild, storyId = 'preview', zone = 'duel', placeId = 'duel'): Actor {
  return { ...createPlayer(build, storyId, { preview: true }), zone, placeId };
}

function duelState(build: CreationBuild): GameState {
  const s = duelBase(build);
  s.player.core.standingDefense = defaultStandingDefense(s, s.player); // as the game picks it at the start
  return s;
}

function duelBase(build: CreationBuild): GameState {
  const zone = { id: 'duel', placeId: 'duel', name: 'field', look: 'open grass', links: [], cover: 'none' as const, light: 'bright' as const, groundItems: [] };
  const settings = { difficulty: 'normal', showMechanics: CONFIG.SHOW_MECHANICS, tone: CONFIG.STYLE.tone };
  return {
    storyId: 'preview', turn: 0, mode: 'tactical', zones: [zone], player: playerFromBuild(build),
    actors: [spawnNpc(null, TP.slime, { id: 'slime', zone: 'duel', placeId: 'duel', bandId: 'slimes', storyId: 'preview' })],
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
  hp: number | null; attack: number | null; weapon: { name: string; skill: string } | null; guard: string | null; defense: { kind: DefenseKind; value: number } | null;
  swingsToKill: number | null; slamsToDown: number | null; slimeHp: number | null;
};

/** Average damage per swing over `swings` seeded attacks (ruleset.attack is pure apart from the rng). */
function avgDamage(state: GameState, attackerId: string, targetId: string, weaponId: string, swings: number, modeId?: string): number {
  const rng = createRng(7);
  let sum = 0;
  for (let i = 0; i < swings; i++) sum += ruleset.attack({ attackerId, targetId, weaponId, modeId, targetPart: null, aimed: false }, state, rng).damage;
  return sum / swings;
}

export function preview(build: CreationBuild, swings: number): Preview {
  const state = safe(() => duelState(build));
  if (!state) return { hp: null, attack: null, weapon: null, guard: null, defense: null, swingsToKill: null, slamsToDown: null, slimeHp: null };
  const p = state.player, slime = state.actors[0];
  // the kit this build actually gets: its first weapon, or bare hands when it has none (the late bloomer starts unarmed)
  const atk = safe(() => defaultMode(state, p, 0));
  const held = atk && p.core.inventory.find((i) => i.id === atk.itemId);
  const weapon = atk ? { name: held ? itemDef(state, held.itemId).name : (atk.mode.name ?? 'bare hands'), skill: skillName(modeSkill(atk.mode)) } : null;
  const hp = safe(() => totalHp(state, p));
  const slimeHp = safe(() => totalHp(state, slime));
  const attack = atk ? safe(() => effectiveSkill(state, p, modeSkill(atk.mode), { itemId: held?.id }).value) : null;
  // the same rule the game starts with: the usable defense with the highest effective skill (block, parry, dodge on a tie)
  const kind = safe(() => defaultStandingDefense(state, p));
  const guardInst = kind ? safe(() => defenseItem(state, p, kind)) : null;
  const value = kind ? safe(() => effectiveSkill(state, p, DEFENSE_SKILL[kind], { itemId: guardInst?.id }).value) : null;
  const defense = kind && value !== null ? { kind, value } : null;
  const mine = atk ? safe(() => avgDamage(state, 'player', 'slime', atk.itemId, swings, atk.mode.id)) : null;
  const theirs = safe(() => avgDamage(state, 'slime', 'player', `natural:${AM.slam}`, swings));
  return {
    hp, attack, weapon, guard: guardInst ? itemDef(state, guardInst.itemId).name : null, defense, slimeHp,
    swingsToKill: mine && slimeHp ? slimeHp / mine : null,
    slamsToDown: theirs && hp ? hp / theirs : null,
  };
}
