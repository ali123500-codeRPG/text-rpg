// Worlds (HF25, HF26, HF31, CW1–CW7): the Universe holds worlds and a world holds stories, one after another. A story is one
// character's life in a world. Carrying a world on copies its last save into a new story with a new character.
import type { GameState, Head } from '../types';
import { getLibrary } from '../library';
import { fromPages, toPages } from './pages';
import { newReport, repairReferences } from './checks';
import { CONFIG } from '../config';
import { itemHolders } from '../ruleset/threadboundItems';
import { stance } from '../engine/relations';
import { lootersOf, stripBody } from '../engine/loot';
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
 * HF26/HF31, CW1–CW7: `fresh` (a new story's state, its new player standing nowhere yet) carried on in `world` (the world's
 * last save), which goes on as the file left it. The last character stays as the save left them (CW2 a: down or dead), an
 * NPC under their own id, so everything people knew of them stays theirs and nothing of it passes to the newcomer. Only
 * what involved them ends (CW6 a): their own action under way, their fight's yields, mercy and spars, and offers made to or
 * by them; everyone else's fights and long actions go on. The world keeps its clock (CW4 a) and its settings (CW7 a). The
 * new story's own scenario, plans and quests start fresh (CW5 b), and the turn count runs on from the world's.
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
  const band = w.bands.find((b) => b.id === past.bandId);
  if (band) band.name = player.names.current;
  // CW6 a: what they were doing ends with them; others keep theirs, except a long action or an offer aimed at them
  delete past.engagement; delete past.react; delete past.carry; delete past.busy; delete past.walking; delete past.followLost; delete past.offer;
  for (const a of [past, ...w.actors]) {
    if (a.busy?.order.target === pastId) delete a.busy;
    if (a.offer?.to === pastId) delete a.offer;
    if (!a.mind) continue;
    delete a.mind.hitByPlayer; delete a.mind.hitUnaware; // flags about "the player", who is someone else now
    // code-made memory lines name the player by the word: they were about the last character
    const was = a.mind.namesKnown?.includes(pastId) ? player.names.current : 'a stranger';
    if (a.mind.earlier) a.mind.earlier.lines = a.mind.earlier.lines.map((l) => l.replace(/\bplayer\b/g, was));
  }
  if (fell) lootTheFallen(w, past);
  // BG-332: everything is the world's unless named here as the story's own, so world state added later stays by itself.
  // The player's yield, mercy and night were the last character's; spars and stand-downs keep those without them (CW6 a).
  const { yielding: _y, mercy: _m, night: _n, scratch: _sc, spars: _sp, offers: _of, ...kept } = w;
  const spars = w.spars?.filter((sp) => !sp.sides.flat().includes(pastId));
  const offers = w.offers && {
    pending: w.offers.pending.filter((o) => o.from !== pastId && o.to !== pastId),
    truces: Object.fromEntries(Object.entries(w.offers.truces).filter(([k]) => k !== pastId).map(([k, ids]) => [k, ids.filter((i) => i !== pastId)])),
  };
  const { storyId, player: newcomer, meta, libraryVersion, rngSeed, rngState, mode, events, agentLog, log, scenarioCaps, quests } = fresh;
  const s: GameState = {
    ...kept, ...(spars?.length ? { spars } : {}), ...(offers ? { offers } : {}),
    storyId, player: newcomer, meta: { ...meta, settings: structuredClone(w.settings) }, libraryVersion, rngSeed, rngState, mode, events, agentLog, log, scenarioCaps, quests,
    turn: world.turn + 1,
    pending: { ...fresh.pending, turn: world.turn + 1 },
    actors: fell ? [...w.actors, past] : w.actors,
    bands: [...fresh.bands, ...w.bands],
    ...(fresh.organizations?.length || w.organizations?.length ? { organizations: [...(fresh.organizations ?? []), ...(w.organizations ?? [])] } : {}), // BEL-01: lasting bodies outlive a character
    ...(fresh.orgLinks?.length || w.orgLinks?.length ? { orgLinks: [...(fresh.orgLinks ?? []), ...(w.orgLinks ?? [])] } : {}),
    hidden: { ...w.hidden, plans: {}, stage: fresh.hidden.stage }, // plans and the stage brief were the last story's
    zones: w.places.flatMap((pl) => pl.zones), // WI8 a: the whole built world is live
    stage: { ...fresh.stage, scenarioNumber: world.stage.scenarioNumber, scenarioStartTurn: world.turn + 1 },
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
 * WP6 a: the foes who downed `past` loot the body: every hostile foe standing who saw them fall, nearest first
 * (lootersOf, the rule for any body found), by stripBody's rule. A Threadbound item keeps its dead owner's bond, which no
 * longer holds (WP2), so whoever later takes it from the looter can wear it. No such foe: all stays.
 */
export function lootTheFallen(state: GameState, past: Actor): void {
  stripBody(state, past, lootersOf(state, past, (a) => stance(state, a, past) === 'hostile'));
}
