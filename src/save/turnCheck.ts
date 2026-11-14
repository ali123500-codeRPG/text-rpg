// TQ1 turn checker: world rules that must hold after every turn, whatever feature ran. Tests fail on a broken rule
// (TURN_CHECK.strict), playtests stop on one, and the game files it as bug code turn_check without stopping play.
// Each rule is one line in RULES; a new feature adds its own rule here. A rule names what broke, never fixes it.
import type { Actor, GameEvent, GameState, ItemInstance } from '../types';
import { getLibrary } from '../library';
import { allActors, zoneById } from '../engine/relations';
import { fightRenewed } from '../engine/engagement';
import { healthLevel } from '../ruleset/body';
import { buildActorView, buildNarrationView, buildPlayerView } from '../views';
import { toPages } from './pages';
import { checkInvariants, newReport } from './checks';
import { secondsSince } from '../time';
import { engagementEndS } from '../ruleset/actionTime';

/** what the turn started from: where everyone stood and who was dead */
export type TurnSnap = { zones: Record<string, string>; dead: string[]; scenario: number };
export const snapTurn = (s: GameState): TurnSnap => ({
  zones: Object.fromEntries(allActors(s).map((a) => [a.id, a.zone])),
  dead: allActors(s).filter((a) => healthLevel(a) === 'dead').map((a) => a.id),
  scenario: s.stage.scenarioNumber,
});

export type Broken = { rule: string; detail: string };
type Ctx = { s: GameState; before: TurnSnap; events: GameEvent[] };

/** strict: throw on a broken rule (tests, playtests). skip: rules known broken by an open bug, so CI stays green until
 *  the fix lands, or '*' for a test with a fake engine (tests/harness/turnCheckSetup.ts fills it per test file) */
type TurnCheckMode = { strict: boolean; skip: () => string[] };
const g = globalThis as { turnCheck?: TurnCheckMode }; // set before any import by the test setup, which imports nothing from src
export const TURN_CHECK: TurnCheckMode = (g.turnCheck ??= { strict: false, skip: () => [] });

const fin = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
const inside = (s: GameState, a: Actor) => {
  const r = zoneById(s, a.zone)?.rect;
  return !r || !a.pos || (Math.abs(a.pos.x - r.x) <= r.w / 2 + 0.01 && Math.abs(a.pos.y - r.y) <= r.d / 2 + 0.01);
};
function items(s: GameState): ItemInstance[] {
  const out: ItemInstance[] = [];
  const add = (list: ItemInstance[] = []) => list.forEach((it) => { out.push(it); add(it.contents); });
  allActors(s).forEach((a) => add(a.core.inventory));
  s.places.forEach((p) => p.zones.forEach((z) => add(z.groundItems)));
  return out;
}
/** a view entry for someone clearly seen (by id, else by the name or label it shows) whose actor has pronouns carries them;
 *  a half-seen 'someone' has none on purpose */
type Entry = { id?: string; about?: string; name?: string; label?: string; pronouns?: string; level?: string };
function pronounGaps(s: GameState, where: string, list: Entry[] = []): string[] {
  const people = allActors(s);
  const who = (e: Entry) => { const id = e.id ?? e.about; return id ? people.filter((a) => a.id === id) : people.filter((a) => a.names.current === e.name || a.label === (e.name ?? e.label)); };
  return list.filter((e) => !e.pronouns && e.level !== 'partial' && who(e).length > 0 && who(e).every((a) => a.pronouns)).map((e) => `${where}: ${e.id ?? e.about ?? e.name ?? e.label}`);
}

const RULES: Record<string, (c: Ctx) => string[]> = {
  /** everyone stands in a zone that exists, on that zone's place */
  real_zone: ({ s }) => [
    ...allActors(s).filter((a) => zoneById(s, a.zone)?.placeId !== a.placeId).map((a) => `${a.id} in ${a.zone} (place ${a.placeId})`),
    ...s.stage.zoneIds.filter((id) => !zoneById(s, id)).map((id) => `stage zone ${id} does not exist`),
  ],
  /** ZR8: every zone on stage has a rectangle, and everyone's point lies inside their zone's */
  inside_zone: ({ s }) => [
    ...s.zones.filter((z) => !z.rect).map((z) => `zone ${z.id} has no rectangle`),
    ...allActors(s).filter((a) => (a.pos && !(fin(a.pos.x) && fin(a.pos.y))) || !inside(s, a)).map((a) => `${a.id} at ${JSON.stringify(a.pos)} outside ${a.zone}`),
  ],
  /** a zone change always shows as a move (fromZone), travel, or a logged silent catch-up; a new scenario places everyone */
  move_event: ({ s, before, events }) => before.scenario !== s.stage.scenarioNumber ? [] : allActors(s).filter((a) => {
    const from = before.zones[a.id];
    if (from === undefined || from === a.zone) return false;
    // a companion rides on the player's trip: from where the player set out to where the player arrived
    const travelled = events.some((e) => e.kind === 'travel' && e.actorId === s.player.id && s.player.zone === a.zone && before.zones[s.player.id] === from);
    return !travelled && !events.some((e) => e.actorId === a.id && e.fromZone === from)
      && !s.log.some((l) => l.code === 'caught_up' && l.detail?.actorId === a.id);
  }).map((a) => `${a.id} ${before.zones[a.id]} -> ${a.zone} with no move event`),
  /** no blow lands on the dead, and the dead do nothing */
  dead_still: ({ before, events }) => events.filter((e) => before.dead.includes(e.actorId) && !e.bark || e.kind === 'attack' && !!e.target && before.dead.includes(e.target))
    .map((e) => `${e.kind} ${e.actorId} -> ${e.target ?? ''}`),
  /** every event happens in a real zone, by someone who exists, with a unique id */
  event_refs: ({ s, events }) => {
    const ids = new Set(allActors(s).map((a) => a.id));
    const seen = new Set<string>();
    return events.flatMap((e) => [
      ...(zoneById(s, e.zone) ? [] : [`${e.id} ${e.kind} in unknown zone ${e.zone}`]),
      ...(ids.has(e.actorId) ? [] : [`${e.id} ${e.kind} by unknown actor ${e.actorId}`]),
      ...(seen.has(e.id) ? [`${e.id} used twice`] : (seen.add(e.id), [])),
    ]);
  },
  /** an engagement, or a hunt, that nothing renewed for ENGAGEMENT_END (engagementEndS) has ended (BG-5); hunts are dropped before the
   * turn's time passes, so they are judged at the end of the turn before */
  fight_ends: ({ s }) => allActors(s).flatMap((a) => [
    ...(a.engagement && secondsSince(s, a.engagement.last) >= engagementEndS() ? [`${a.id} engagement from turn ${a.engagement.last} still open`] : []),
    ...Object.entries(a.mind?.knowledge ?? {}).filter(([id, b]) => (b.status === 'engaged' || b.status === 'hunting') && b.closedTurn !== undefined && secondsSince(s, fightRenewed(s, a, id), s.turn - 1) >= engagementEndS())
      .map(([id, b]) => `${a.id} still ${b.status} ${id} since turn ${fightRenewed(s, a, id)}`),
  ]),
  /** the load checks hold mid-play too: one player, one current class, slots, grips, worn covers, stacks */
  invariants: ({ s }) => { const r = newReport(); checkInvariants(toPages(s), s.storyId, getLibrary(), r); return r.errors; },
  /** no item is in two places at once */
  one_item_one_place: ({ s }) => {
    const seen = new Set<string>();
    return items(s).filter((it) => (seen.has(it.id) ? true : (seen.add(it.id), false))).map((it) => `${it.id} (${it.itemId}) held twice`);
  },
  /** health, parts and morale stay numbers in range */
  condition_range: ({ s }) => allActors(s).flatMap((a) => {
    const c = a.core.condition;
    return [
      ...(fin(c.hpLostPct) && c.hpLostPct >= 0 ? [] : [`${a.id} hpLostPct ${c.hpLostPct}`]),
      ...Object.entries(c.parts).filter(([, v]) => !fin(v) || v > 100).map(([p, v]) => `${a.id} part ${p} ${v}`),
      ...(c.moraleLost === undefined || (fin(c.moraleLost) && c.moraleLost >= 0) ? [] : [`${a.id} moraleLost ${c.moraleLost}`]),
    ];
  }),
  /** beliefs, stances, bands and holds point at people and bands that exist; a hold is in one zone */
  links_real: ({ s }) => {
    const ids = new Set(allActors(s).map((a) => a.id));
    return allActors(s).flatMap((a) => [
      ...(s.bands.some((b) => b.id === a.bandId) ? [] : [`${a.id} band ${a.bandId} unknown`]),
      ...Object.keys(a.mind?.knowledge ?? {}).filter((id) => !ids.has(id)).map((id) => `${a.id} believes about unknown ${id}`),
      ...Object.keys(a.mind?.overrides ?? {}).filter((id) => !ids.has(id)).map((id) => `${a.id} stance toward unknown ${id}`),
      ...(a.heldBy && !allActors(s).some((h) => h.id === a.heldBy && h.zone === a.zone) ? [`${a.id} held by ${a.heldBy} from another zone`] : []),
    ]);
  },
  /** BG-33/60/97/130: every person in the Parser's, Narrator's and NPCs' views carries their pronouns */
  view_pronouns: ({ s, events }) => {
    const pv = buildPlayerView(s), nv = buildNarrationView(s, events, null);
    return [
      ...(s.player.pronouns && !pv.player.pronouns ? ['player view: the player'] : []),
      ...(s.player.pronouns && !nv.player.pronouns ? ['narration view: the player'] : []),
      ...pronounGaps(s, 'player view actors', pv.actors), ...pronounGaps(s, 'player view lastSeen', pv.lastSeen),
      ...pronounGaps(s, 'narration view actors', nv.actors),
      ...s.actors.filter((a) => a.mind?.control === 'agent').flatMap((a) => {
        const v = buildActorView(s, a.id);
        return [...pronounGaps(s, `${a.id} view seen`, v.seen), ...pronounGaps(s, `${a.id} view beliefs`, v.beliefs)];
      }),
    ];
  },
  /** the Narrator gets only words the player heard (an event whose sound reached the player, or the player's own) */
  heard_only: ({ s, events }) => buildNarrationView(s, events, null).heard
    .filter((h) => !events.some((e) => e.line?.text === h.text && (e.actorId === s.player.id || !!e.perception[s.player.id]?.heard)))
    .map((h) => `"${h.text.slice(0, 60)}" from ${h.speaker}`),
};
export const TURN_RULES = Object.keys(RULES);

/** every broken rule after a turn; strict throws them all at once */
export function checkTurn(s: GameState, before: TurnSnap, events: GameEvent[]): Broken[] {
  const skip = TURN_CHECK.skip();
  const out: Broken[] = [];
  if (skip.includes('*')) return out;
  for (const [rule, check] of Object.entries(RULES)) {
    if (skip.includes(rule)) continue;
    let found: string[];
    try { found = check({ s, before, events }); } catch (e) { found = [`threw ${(e as Error).message}`]; }
    out.push(...found.map((detail) => ({ rule, detail })));
  }
  if (out.length && TURN_CHECK.strict) throw new Error(`turn check, turn ${s.turn}:\n${out.map((b) => `  ${b.rule}: ${b.detail}`).join('\n')}`);
  return out;
}
