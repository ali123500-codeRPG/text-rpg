// Legality checks on accepted agent outputs (Leak prevention, validation and failure handling).
// Parser: against PlayerView. Planner / Responder / Voice: against the actor's own view.
import type { ActorView, GearOp, Intent, NpcAction, PlayerView, StanceStep } from '../types';
import { SPEECH_ACTIONS, WAY_ORDERS } from '../types';
import { TIME_OF_DAY } from '../scales';
import { meltAwayHere } from '../ruleset/perks';
import { PK } from '../library/perkIds';
import { modeIdOf } from '../ruleset/gear';
import { compassOf } from '../scenario/geometry';

// ---------------- Parser ----------------

export type ParserLegality = { illegal: string[]; gearErrors: string[]; intent: Intent };

/** P2: a question about the part of the input that failed, instead of the generic one */
export function illegalClarify(illegal: string[], view: PlayerView): string | null {
  const first = illegal[0] ?? '';
  const names = view.actors.filter((a) => a.health !== 'dead').map((a) => a.name || a.label).filter(Boolean);
  const who = names.length ? ` I can see ${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]}.` : '';
  if (first.startsWith('action.target_dead')) return `That one is already dead. Who do you mean?${who}`;
  if (first.startsWith('action.target') || first.startsWith('addressee')) return `Who do you mean?${who}`;
  if (first.startsWith('move.spot')) return `Where in ${view.zone.name} do you want to go? You can go to someone, to a way out (${view.zone.links.map((l) => l.label).join(', ') || 'none'}), away from one, or to one side, such as the north side.`;
  if (first.startsWith('action.item')) return 'Which item do you mean?';
  if (first.startsWith('move.toZone')) return `Where do you want to go? From here you can reach ${view.zone.links.map((l) => l.label).join(', ') || 'nowhere new'}.`;
  if (first.startsWith('action.time')) return `Until when? You can wait until ${TIME_OF_DAY.keys.map((k) => TIME_OF_DAY.name(k).toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' or $1')}.`;
  if (first.startsWith('action.skill')) return 'How do you want to do that?';
  if (first.startsWith('action.vanish')) return `Where do you slip away to? From here you can reach ${view.zone.links.map((l) => l.label).join(', ') || 'nowhere new'}.`;
  return null;
}

/** Targets, items or skills not in PlayerView make the turn stop (illegal); a bad gear op or mode is dropped (invalid_gear). */
export function checkParserLegality(intent: Intent, view: PlayerView, bandIds: string[] = []): ParserLegality {
  const zones = new Set([view.zone.id, ...view.zone.links.map((l) => l.to), ...view.zones.map((z) => z.id)]);
  const actors = new Set(view.actors.map((a) => a.id));
  // BG-61: someone the player was just talking with can be spoken to though out of sight (a voice through a barred door)
  const talking = new Set([...actors, ...(view.talkingWith ?? []).map((t) => t.id)]);
  const isSpeechType = (t: string) => (SPEECH_ACTIONS as readonly string[]).includes(t);
  const dead = new Set(view.actors.filter((a) => a.health === 'dead').map((a) => a.id));
  const own = view.player.inventory;
  const ground = new Set([view.zone, ...view.zones].flatMap((z) => z.groundItems.map((g) => g.id)));
  const seenItems = new Set(view.actors.flatMap((a) => a.gear.map((g) => g.id)));
  const items = new Set([...own.map((i) => i.id), ...ground]);
  const illegal: string[] = [];
  const gearErrors: string[] = [];
  const out: Intent = { ...intent, move: intent.move ? { ...intent.move } : null, action: intent.action ? { ...intent.action } : null };
  if (out.spoken) out.spoken = spokenOnly(out.spoken) || null; // BG-93

  // a move to the zone the player already stands in is no move (runs 11–13: it was the most common clarify), unless it
  // goes to a spot in it (BG-12: "walk to the back of the cellar")
  const spot = out.move?.spot;
  if (out.move && !spot) delete out.move.spot;
  if (out.move?.toZone === view.zone.id && !spot) out.move = null;
  // BG-15: a move names where the player means to end up, any zone it knows; the walk finds the way through the rest
  const reachable = (id: string) => view.zone.links.some((l) => l.to === id) || view.zones.some((z) => z.id === id) || !!view.known?.some((k) => k.id === id);
  if (out.move && out.move.toZone !== view.zone.id && !reachable(out.move.toZone)) illegal.push(`move.toZone ${out.move.toZone}`);
  if (out.move && spot) {
    // one of near / awayFrom (someone in view, or a way out of that zone) / side (a compass word)
    const there = [view.zone, ...view.zones].find((z) => z.id === out.move!.toZone);
    // BG-19 (runs 37, 38): "the back of the cellar" came as awayFrom the cellar itself: the back is away from the way in
    const cameIn = view.cameFrom?.[0]?.zone;
    if (spot.awayFrom === out.move.toZone && cameIn && there?.links.some((l) => l.to === cameIn)) out.move.spot = { awayFrom: cameIn };
    // BG-125: someone out of sight now is gone to where the player last perceived them
    const lastSeen = (id: string) => !actors.has(id) && !!view.lastSeen?.some((l) => l.id === id);
    const ref = (id: string) => actors.has(id) || lastSeen(id) || !!there?.links.some((l) => l.to === id);
    const sp = out.move.spot!;
    if (sp.near && lastSeen(sp.near)) out.move.spot = { ...sp, lastSeen: true };
    const keys = (['near', 'awayFrom', 'side'] as const).filter((k) => sp[k]);
    const ok = keys.length === 1 && (sp.side ? !!compassOf(sp.side) : ref((sp.near ?? sp.awayFrom)!));
    // BG-31 (run 40): on a move to another zone the spot is only where to stop there; one that can't be checked (a zone
    // out of view) or doesn't fit is dropped and the move goes on, instead of asking where in the current zone to go
    if (!ok && out.move.toZone !== view.zone.id) delete out.move.spot;
    else if (!ok) illegal.push(`move.spot ${JSON.stringify(sp)}`);
  }
  const a = out.action;
  if (a?.mode) a.mode = modeIdOf(a.mode); // a mode named by its name maps to its AM id
  if (a) {
    // T6 (run 18): a wait's target is a time of day, not an actor; "Who do you mean?" stopped every timed wait
    if (a.type === 'wait' || a.type === 'sleep') {
      if (a.type === 'sleep') a.target = null;
      else if (a.target !== null) {
        const k = TIME_OF_DAY.keyOf(a.target);
        if (k) a.target = k;
        else illegal.push(`action.time ${a.target}`);
      }
    } else if (a.target !== null && a.target !== 'player' && !(isSpeechType(a.type) ? talking : actors).has(a.target) && !zones.has(a.target) && !items.has(a.target) && !seenItems.has(a.target))
      illegal.push(`action.target ${a.target}`);
    // BG-13: the dead can't be fought (the Parser aimed at a slime its view listed as Dead while a live one attacked)
    else if (a.type === 'attack' && a.target && dead.has(a.target)) illegal.push(`action.target_dead ${a.target}`);
    else if (WAY_ORDERS.includes(a.type) && a.target !== null && !zones.has(a.target)) illegal.push(`action.target ${a.target}`); // BG-128: a lock is on a way
    // P2: code picks a speech action's skill from its type (SPEECH_SKILL), so the Parser's skill there is dropped
    // hide and sneak: code picks the stealth skill (ST2), so the Parser's skill there is dropped
    if (a.type === 'hide' || a.type === 'sneak' || a.type === 'vanish' || a.type === 'search' || a.type === 'stash') a.skill = ''; // SE2/SE9: code picks the roll
    else if ((SPEECH_ACTIONS as readonly string[]).includes(a.type)) a.skill = '';
    else if (a.skill && !view.player.skills.some((x) => x.id === a.skill)) illegal.push(`action.skill ${a.skill}`);
    // a buy, or haggling over one, names a ware of the seller it targets (goods:… / service:…), not an item the player can reach
    const wares = a.type === 'buy' || a.type === 'barter' ? new Set(view.actors.find((x) => x.id === a.target)?.wares?.map((w) => w.id) ?? []) : null;
    if (a.item !== null && !(wares ? wares.has(a.item) : items.has(a.item))) illegal.push(`action.item ${a.item}`);
    if (a.mode !== null) {
      const modes = a.item ? own.find((i) => i.id === a.item)?.modes.map((m) => m.id) ?? [] : own.flatMap((i) => (i.equippedIn.length ? i.modes.map((m) => m.id) : []));
      // unarmed / natural modes are not listed on gear; only a mode named against a listed item can be wrong
      if (a.item && own.some((i) => i.id === a.item) && !modes.includes(a.mode)) {
        gearErrors.push(`mode ${a.mode} not on ${a.item}`);
        a.mode = null;
      }
    }
  }
  // AE8: a perk move the player doesn't own, or aimed at no one in view, is dropped (the rest of the turn stands)
  // ST13/ST20: a Vanish moves you; with no move it asks where to
  if (a?.type === 'vanish' && !out.move && !(view.player.perks.some((x) => x.id === PK.melt_away) && meltAwayHere(view.zone.cover, view.zone.light))) illegal.push('action.vanish'); // A19 Melt Away
  const move = out.perkMove && view.player.perkMoves?.find((m) => m.id === out.perkMove!.perk || m.name.toLowerCase() === out.perkMove!.perk.trim().toLowerCase());
  if (out.perkMove && move) out.perkMove.perk = move.id; // a perk move named instead of given by id is read as its id
  if (out.perkMove && (!move || (out.perkMove.target !== null && (!actors.has(out.perkMove.target) || dead.has(out.perkMove.target))))) {
    gearErrors.push(`perkMove ${out.perkMove.perk}`);
    out.perkMove = null;
  }
  if (out.addressees) {
    const okAddr = (x: string) => x === 'everyone' || talking.has(x) || bandIds.includes(x);
    for (const x of out.addressees) if (!okAddr(x)) illegal.push(`addressee ${x}`);
  }
  if (out.gear) {
    out.gear = out.gear.filter((op) => {
      const ok = op.op === 'summon' ? !!view.player.summonable?.some((x) => x.id === op.item) : op.op === 'pick_up'
        ? ground.has(op.item) || (!!op.from && actors.has(op.from) && view.actors.find((x) => x.id === op.from)!.gear.some((g) => g.id === op.item))
        : own.some((i) => i.id === op.item);
      if (!ok) gearErrors.push(`gear ${op.op} ${op.item}`);
      return ok;
    });
  }
  return { illegal, gearErrors, intent: out };
}

// ---------------- Planner / Responder / Voice ----------------

export type NpcLegality = {
  /** null: the order stands. Otherwise the order is dropped and this code is logged. */
  orderError: 'view_leak' | 'invalid_target' | null;
  errors: string[]; // log codes for dropped fields (invalid_gear, invalid_routine, invalid_reveal, ...)
};

/** the parts of ActorView every NPC view shares (OppositionView and DialogueView both have them) */
export type NpcViewBase = Pick<ActorView, 'self' | 'beliefs' | 'seen' | 'map' | 'zones'>;

/** what the actor can name: its own beliefs, actors it sees, itself, zones on its map, its gear and ground items it sees */
export function knownIds(view: NpcViewBase) {
  const actors = new Set([view.self.id, ...view.beliefs.map((b) => b.about), ...view.seen.map((s) => s.id)]);
  const zones = new Set([...view.map.flatMap((z) => [z.id, ...z.links.map((l) => l.to)]), ...view.zones.map((z) => z.id), view.self.zone]);
  const own = new Set(view.self.gear.map((g) => g.id));
  const ground = new Set(view.zones.flatMap((z) => z.groundItems.map((g) => g.id)));
  const seenGear = new Set(view.seen.flatMap((s) => s.gear.map((g) => g.id)));
  return { actors, zones, own, ground, seenGear };
}

type NpcOut = {
  action: NpcAction;
  gear: GearOp[] | null;
  stance: StanceStep | null;
};

/** BG-93: a spoken line holds only the words said aloud. Stage directions an agent writes into it (*takes a bite*,
 * [laughs]) are cut, for every speaker, NPC or player; the deed belongs in the action. '' = nothing was said. */
export function spokenOnly(text: string): string {
  return text.replace(/\*[^*]*\*|\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Checks the order's target against the view (world = every real id, to tell view_leak from invalid_target),
 * then drops illegal gear ops, items, modes and stance steps in place.
 */
export function checkNpcLegality(out: NpcOut, view: NpcViewBase, world: Set<string>, alsoKnown: string[] = []): NpcLegality {
  const k = knownIds(view);
  for (const id of alsoKnown) k.actors.add(id);
  const errors: string[] = [];
  const a = out.action;
  if (a.mode) a.mode = modeIdOf(a.mode);
  let orderError: NpcLegality['orderError'] = null;
  const knows = (id: string) => k.actors.has(id) || k.zones.has(id) || k.own.has(id) || k.ground.has(id) || k.seenGear.has(id);
  if (a.target !== null && !knows(a.target)) orderError = world.has(a.target) ? 'view_leak' : 'invalid_target';
  else if (WAY_ORDERS.includes(a.type) && a.target !== null && !k.zones.has(a.target)) orderError = 'invalid_target'; // BG-128

  if (a.item !== null && !k.own.has(a.item) && !k.ground.has(a.item)) {
    errors.push('invalid_gear');
    a.item = null;
    a.mode = null;
  }
  if (a.mode !== null && a.item !== null) {
    const g = view.self.gear.find((x) => x.id === a.item);
    if (g && !g.modes.some((m) => m.id === a.mode)) {
      errors.push('invalid_gear');
      a.mode = null;
    }
  }
  if (out.gear) {
    out.gear = out.gear.filter((op) => {
      const ok = op.op === 'pick_up' ? k.ground.has(op.item) || (!!op.from && k.actors.has(op.from) && k.seenGear.has(op.item)) : k.own.has(op.item);
      if (!ok) errors.push('invalid_gear');
      return ok;
    });
  }
  if (out.stance && !k.actors.has(out.stance.toward)) {
    errors.push(world.has(out.stance.toward) ? 'view_leak' : 'invalid_target');
    out.stance = null;
  }
  return { orderError, errors };
}

/** a routine switch must name a routine in the actor's own list (the slot check belongs to switchRoutine) */
export function routineAllowed(view: NpcViewBase, routine: string | null): boolean {
  return routine === null || view.self.routines.some((r) => r.id === routine);
}
