// Legality checks on accepted agent outputs (Leak prevention, validation and failure handling).
// Parser: against PlayerView. Planner / Responder / Voice: against the actor's own view.
import type { ActorView, GearOp, Intent, NpcAction, PlayerView, StanceStep } from '../types';
import { SPEECH_ACTIONS } from '../types';
import { TIME_OF_DAY } from '../scales';
import { meltAwayHere } from '../ruleset/perks';

// ---------------- Parser ----------------

export type ParserLegality = { illegal: string[]; gearErrors: string[]; intent: Intent };

/** P2: a question about the part of the input that failed, instead of the generic one */
export function illegalClarify(illegal: string[], view: PlayerView): string | null {
  const first = illegal[0] ?? '';
  const names = view.actors.map((a) => a.name || a.label).filter(Boolean);
  const who = names.length ? ` I can see ${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]}.` : '';
  if (first.startsWith('action.target') || first.startsWith('addressee')) return `Who do you mean?${who}`;
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
  const own = view.player.inventory;
  const ground = new Set([view.zone, ...view.zones].flatMap((z) => z.groundItems.map((g) => g.id)));
  const seenItems = new Set(view.actors.flatMap((a) => a.gear.map((g) => g.id)));
  const items = new Set([...own.map((i) => i.id), ...ground]);
  const illegal: string[] = [];
  const gearErrors: string[] = [];
  const out: Intent = { ...intent, action: intent.action ? { ...intent.action } : null };

  // a move to the zone the player already stands in is no move (runs 11–13: it was the most common clarify)
  if (out.move?.toZone === view.zone.id) out.move = null;
  if (out.move && !view.zone.links.some((l) => l.to === out.move!.toZone)) illegal.push(`move.toZone ${out.move.toZone}`);
  const a = out.action;
  if (a) {
    // T6 (run 18): a wait's target is a time of day, not an actor; "Who do you mean?" stopped every timed wait
    if (a.type === 'wait' || a.type === 'sleep') {
      if (a.type === 'sleep') a.target = null;
      else if (a.target !== null) {
        const k = TIME_OF_DAY.keyOf(a.target);
        if (k) a.target = k;
        else illegal.push(`action.time ${a.target}`);
      }
    } else if (a.target !== null && a.target !== 'player' && !actors.has(a.target) && !zones.has(a.target) && !items.has(a.target) && !seenItems.has(a.target))
      illegal.push(`action.target ${a.target}`);
    // P2: code picks a speech action's skill from its type (SPEECH_SKILL), so the Parser's skill there is dropped
    // hide and sneak: code picks the stealth skill (ST2), so the Parser's skill there is dropped
    if (a.type === 'hide' || a.type === 'sneak' || a.type === 'vanish') a.skill = '';
    else if ((SPEECH_ACTIONS as readonly string[]).includes(a.type)) a.skill = '';
    else if (a.skill && !view.player.skills.some((x) => x.id === a.skill)) illegal.push(`action.skill ${a.skill}`);
    if (a.item !== null && !items.has(a.item)) illegal.push(`action.item ${a.item}`);
    if (a.mode !== null) {
      const modes = a.item ? own.find((i) => i.id === a.item)?.modes ?? [] : own.flatMap((i) => (i.equippedIn.length ? i.modes : []));
      // unarmed / natural modes are not listed on gear; only a mode named against a listed item can be wrong
      if (a.item && own.some((i) => i.id === a.item) && !modes.includes(a.mode)) {
        gearErrors.push(`mode ${a.mode} not on ${a.item}`);
        a.mode = null;
      }
    }
  }
  // AE8: a perk move the player doesn't own, or aimed at no one in view, is dropped (the rest of the turn stands)
  // ST13/ST20: a Vanish moves you; with no move it asks where to
  if (a?.type === 'vanish' && !out.move && !(view.player.perks.includes('melt_away') && meltAwayHere(view.zone.cover, view.zone.light))) illegal.push('action.vanish'); // A19 Melt Away
  if (out.perkMove && (!view.player.perkMoves?.includes(out.perkMove.perk) || (out.perkMove.target !== null && !actors.has(out.perkMove.target)))) {
    gearErrors.push(`perkMove ${out.perkMove.perk}`);
    out.perkMove = null;
  }
  if (out.addressees) {
    const okAddr = (x: string) => x === 'everyone' || actors.has(x) || bandIds.includes(x);
    for (const x of out.addressees) if (!okAddr(x)) illegal.push(`addressee ${x}`);
  }
  if (out.gear) {
    out.gear = out.gear.filter((op) => {
      const ok = op.op === 'pick_up'
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
  introduces?: string[];
};

/**
 * Checks the order's target against the view (world = every real id, to tell view_leak from invalid_target),
 * then drops illegal gear ops, items, modes, stance steps and introduces in place.
 */
export function checkNpcLegality(out: NpcOut, view: NpcViewBase, world: Set<string>, alsoKnown: string[] = []): NpcLegality {
  const k = knownIds(view);
  for (const id of alsoKnown) k.actors.add(id);
  const errors: string[] = [];
  const a = out.action;
  let orderError: NpcLegality['orderError'] = null;
  const knows = (id: string) => k.actors.has(id) || k.zones.has(id) || k.own.has(id) || k.ground.has(id) || k.seenGear.has(id);
  if (a.target !== null && !knows(a.target)) orderError = world.has(a.target) ? 'view_leak' : 'invalid_target';

  if (a.item !== null && !k.own.has(a.item) && !k.ground.has(a.item)) {
    errors.push('invalid_gear');
    a.item = null;
    a.mode = null;
  }
  if (a.mode !== null && a.item !== null) {
    const g = view.self.gear.find((x) => x.id === a.item);
    if (g && !g.modes.includes(a.mode)) {
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
  if (out.introduces) {
    const keep = out.introduces.filter((id) => id === view.self.id || k.actors.has(id));
    if (keep.length !== out.introduces.length) errors.push('invalid_introduces');
    out.introduces = keep;
  }
  return { orderError, errors };
}

/** a routine switch must name a routine in the actor's own list (the slot check belongs to switchRoutine) */
export function routineAllowed(view: NpcViewBase, routine: string | null): boolean {
  return routine === null || view.self.routines.some((r) => r.id === routine);
}
