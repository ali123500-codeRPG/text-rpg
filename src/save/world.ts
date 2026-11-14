// Worlds (HF25, HF26, HF31, HF32): the Universe holds worlds and a world holds stories, one after another. A story is one
// character's life in a world. Carrying a world on copies its last save into a new story with a new character.
import type { GameState, Head } from '../types';
import { getLibrary } from '../library';
import { fromPages, toPages } from './pages';
import { newReport, repairReferences } from './checks';
import { CONFIG } from '../config';
import { itemHolders } from '../ruleset/threadboundItems';
import { isActive, stance } from '../engine/relations';
import { itemValue } from '../engine/trade';
import { itemDef } from '../library';
import { IT } from '../library/itemIds';
import type { Actor } from '../types';

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
 * WP1 b: a last character reset while standing (`fell` false) left the world for good, with everything they carried;
 * what pointed at them is dropped as for anyone gone (the load's reference repair). WP6 a: before the newcomer arrives,
 * the foes who downed the one who fell loot the body (lootTheFallen).
 */
export function carryOn(world: GameState, fresh: GameState, fell = true): GameState {
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
  if (fell) lootTheFallen(w, past);
  const s: GameState = {
    ...fresh,
    turn: world.turn + 1,
    pending: { ...fresh.pending, turn: world.turn + 1 },
    actors: fell ? [...w.actors, past] : w.actors,
    bands: [...fresh.bands, ...w.bands],
    hidden: { ...w.hidden, plans: {}, stage: fresh.hidden.stage }, // plans and the stage brief were the last story's
    places: w.places, ...(w.regions ? { regions: w.regions } : {}), facts: w.facts, clocks: w.clocks, flags: w.flags, blueprints: w.blueprints,
    stage: { ...fresh.stage, scenarioNumber: world.stage.scenarioNumber, scenarioStartTurn: world.turn + 1 },
    ...(w.barriers ? { barriers: w.barriers } : {}), ...(w.turnEnds ? { turnEnds: w.turnEnds } : {}), ...(w.recentEvents ? { recentEvents: w.recentEvents } : {}),
  };
  // the newcomer's starting kit keeps ids no item in the world already has
  const p = s.player;
  const taken = new Set(itemHolders(s).filter((l) => l !== p.core.inventory).flat().map((i) => i.id));
  for (const i of p.core.inventory) if (taken.has(i.id)) i.id = `${i.id}_${fresh.storyId}`;
  if (fell) return s;
  const pages = toPages(s);
  repairReferences(pages, getLibrary(), newReport());
  return fromPages(s.meta, { libraryVersion: s.libraryVersion } as Head, pages);
}

/**
 * WP6 a: the foes who downed `past` loot the body: everyone standing, hostile to them and in the same place, those in the
 * same zone first. The first takes all the coin; then each in turn takes the most valuable thing left, until each has
 * LOOT_TAKE_MAX or nothing of value is left. Worn containers and soulbound gear stay. A Threadbound item keeps its dead
 * owner's bond, which no longer holds (WP2), so whoever later takes it from the looter can wear it. No foe: all stays.
 */
export function lootTheFallen(state: GameState, past: Actor): void {
  const foes = state.actors.filter((a) => a !== past && a.mind && isActive(a) && a.placeId === past.placeId && stance(state, a, past) === 'hostile')
    .sort((a, b) => Number(b.zone === past.zone) - Number(a.zone === past.zone));
  if (!foes.length) return;
  const take = (a: Actor, i: (typeof past.core.inventory)[number]) => {
    past.core.inventory = past.core.inventory.filter((x) => x !== i);
    delete i.equippedIn;
    const purse = i.itemId === IT.coin ? a.core.inventory.find((x) => x.itemId === IT.coin) : undefined;
    if (purse) purse.qty = (purse.qty ?? 1) + (i.qty ?? 1);
    else a.core.inventory.push(i);
  };
  for (const i of past.core.inventory.filter((x) => x.itemId === IT.coin)) take(foes[0], i);
  const worth = (i: (typeof past.core.inventory)[number]) => itemValue(state, i.itemId) * (i.qty ?? 1);
  const left = past.core.inventory.filter((i) => !i.soulbound && !itemDef(state, i.itemId).container && worth(i) > 0).sort((a, b) => worth(b) - worth(a));
  const count = new Map<Actor, number>();
  for (let k = 0; left.length; k++) {
    const open = foes.filter((f) => (count.get(f) ?? 0) < CONFIG.LOOT_TAKE_MAX);
    if (!open.length) break;
    const f = open[k % open.length];
    take(f, left.shift()!);
    count.set(f, (count.get(f) ?? 0) + 1);
  }
}
