// Worlds (HF25, HF26, HF31, HF32): the Universe holds worlds and a world holds stories, one after another. A story is one
// character's life in a world. Carrying a world on copies its last save into a new story with a new character.
import type { GameState } from '../types';
import { CONFIG } from '../config';
import { itemHolders } from '../ruleset/threadboundItems';

/** every exact `from` string becomes `to`: in values, in arrays and as record keys. A `kind` is never an id. */
function renameIds<T>(v: T, map: Map<string, string>, key?: string): T {
  if (typeof v === 'string') return (key === 'kind' ? v : map.get(v) ?? v) as T;
  if (Array.isArray(v)) return v.map((x) => renameIds(x, map)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [map.get(k) ?? k, renameIds(x, map, k)])) as T;
  return v;
}

/** the actor id the world's last character keeps once the next one arrives */
export const pastCharacterId = (storyId: string) => `hero_${storyId.replace(/^story_/, '')}`;

/**
 * HF26/HF31: `fresh` (a new story's state, its new player standing nowhere yet) carried on in `world` (the world's last
 * save). Places, people, their memories, deals and things lying about stay. The last character stays where they fell,
 * dead (HF27: the original perished there), under their own id, so everything people knew of them stays theirs and
 * nothing of it passes to the newcomer. The story's own state (stage, plans, quests, fights) starts fresh, and the turn
 * count runs on from the world's. The world's clock is left as it was: the caller moves it to the Universe date (HF32).
 */
export function carryOn(world: GameState, fresh: GameState): GameState {
  const pastId = pastCharacterId(world.storyId), player = world.player;
  const map = new Map([[player.id, pastId], [player.bandId, `${pastId}_band`], [world.storyId, fresh.storyId]]);
  // field by field: the state's own field names (player) are not ids
  const w = Object.fromEntries(Object.entries(structuredClone(world)).map(([k, v]) => [k, renameIds(v, map, k)])) as GameState;
  const past = w.player;
  past.kind = 'npc';
  past.mind ??= { control: 'code', knowledge: {}, knows: [] };
  past.core.condition.hpLostPct = Math.max(past.core.condition.hpLostPct, CONFIG.HEALTH_TRACK.find(([l]) => l === 'incapacitated')![1] + 0.001);
  const band = w.bands.find((b) => b.id === past.bandId);
  if (band) band.name = player.names.current;
  for (const a of [past, ...w.actors]) {
    delete a.engagement; delete a.react; delete a.carry; delete a.busy;
    if (!a.mind) continue;
    delete a.mind.hitByPlayer; delete a.mind.hitUnaware; // flags about "the player", who is someone else now
    // code-made memory lines name the player by the word: they were about the last character
    const was = a.mind.namesKnown?.includes(pastId) ? player.names.current : 'a stranger';
    if (a.mind.earlier) a.mind.earlier.lines = a.mind.earlier.lines.map((l) => l.replace(/\bplayer\b/g, was));
  }
  const s: GameState = {
    ...fresh,
    turn: world.turn + 1,
    pending: { ...fresh.pending, turn: world.turn + 1 },
    actors: [...w.actors, past],
    bands: [...fresh.bands, ...w.bands],
    hidden: { ...w.hidden, plans: {}, stage: fresh.hidden.stage }, // plans and the stage brief were the last story's
    places: w.places, facts: w.facts, clocks: w.clocks, flags: w.flags, blueprints: w.blueprints,
    stage: { ...fresh.stage, scenarioNumber: world.stage.scenarioNumber, scenarioStartTurn: world.turn + 1 },
    ...(w.barriers ? { barriers: w.barriers } : {}), ...(w.turnEnds ? { turnEnds: w.turnEnds } : {}), ...(w.recentEvents ? { recentEvents: w.recentEvents } : {}),
  };
  // the newcomer's starting kit keeps ids no item in the world already has
  const p = s.player;
  const taken = new Set(itemHolders(s).filter((l) => l !== p.core.inventory).flat().map((i) => i.id));
  for (const i of p.core.inventory) if (taken.has(i.id)) i.id = `${i.id}_${fresh.storyId}`;
  return s;
}
