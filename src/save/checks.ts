// Load checks (Part 4 §7–8): migration steps, library reconcile, shape, invariants, references.
import type { Actor, BlueprintPage, BodyType, EnginePage, FactsPage, GameState, HiddenPage, ItemDef, Library, Opening, Place, TilePage } from '../types';
import { resolveAlias } from '../library';
import { CONFIG } from '../config';
import { tilePages, type Pages } from './pages';
import { ageYears, youngestAge } from '../ruleset/age';
import { gripSlot, gripsOf } from '../ruleset/slots';
import { BK, OP } from '../library/tableIds';
import { freshId } from '../ids';
import { keepInside, middleOf } from '../plan/geom';

export type CheckReport = { errors: string[]; repairs: string[]; warnings: string[]; changed: Set<string> };
export const newReport = (): CheckReport => ({ errors: [], repairs: [], warnings: [], changed: new Set() });

// ---------- migrations ----------
/** step from version v to v + 1, keyed by v. Defaults for missing fields go only here (D-116: before release, each change to
 * the save's shape adds its step here). */
export const MIGRATIONS: Record<number, (pages: Pages) => void> = {
  // BG-312: a doorway kept shut by its old fixed see-through flag gets the plain door it stood for (shut, unlocked), so a
  // world plays as before until someone opens one; one the flag left open stays doorless; the flag goes
  10: (pages) => {
    const engine = pages.engine as EnginePage;
    for (const [k, page] of Object.entries(pages)) {
      if (!k.startsWith('plan.')) continue;
      for (const o of (page as { openings: (Opening & { seeThrough?: boolean })[] }).openings) {
        if (o.kind === OP.doorway && !o.barrier && !o.frontier && o.seeThrough === false) {
          const id = freshId(`door_${o.joins[0]}_${o.joins[1]}`, new Set(Object.keys(engine.barriers ?? {})));
          (engine.barriers ??= {})[id] = { id, kind: BK.door, grade: 'minor' };
          o.barrier = id;
        }
        delete o.seeThrough;
      }
    }
  },
  // D-89 RP12: item pools got their own bands, Destroyed at −50% (was −100%): a shield kept between them comes back Broken,
  // 1 point above the Destroyed line, so a saved shield is never lost by the change
  11: (pages) => {
    for (const k of actorKeys(pages)) for (const i of (pages[k] as Actor).core.inventory) {
      if (i.pools?.shield !== undefined && i.pools.shield <= CONFIG.ITEM_STATE_ABOVE.broken) i.pools.shield = CONFIG.ITEM_STATE_ABOVE.broken + 1;
    }
  },
  // WT1 a: the floor plan (plan.<placeId>, in place order) and the ground (one page) move to tiles of the world frame
  12: (pages) => {
    const engine = pages.engine as EnginePage, order = engine.order?.places ?? [];
    const at = (k: string) => order.indexOf(k.slice('plan.'.length)) + 1 || Infinity;
    const lists: Pick<TilePage, 'walls' | 'openings' | 'roofs' | 'lights' | 'furniture' | 'items'> = { walls: [], openings: [], roofs: [], lights: [], furniture: [], items: [] };
    for (const k of Object.keys(pages).filter((x) => x.startsWith('plan.')).sort((a, b) => at(a) - at(b))) {
      const pp = pages[k] as Omit<typeof lists, 'items'>;
      for (const l of ['walls', 'openings', 'roofs', 'lights', 'furniture'] as const) (lists[l] as unknown[]).push(...(pp[l] ?? []));
      delete pages[k];
    }
    lists.items.push(...((pages.ground as { items?: TilePage['items'] } | undefined)?.items ?? []));
    delete pages.ground;
    Object.assign(pages, tilePages(engine.storyId, lists));
  },
  // KN1 b: knownOnSight names its reach; the old flag meant everyone
  13: (pages) => {
    for (const k of actorKeys(pages)) {
      const a = pages[k] as Omit<Actor, 'knownOnSight'> & { knownOnSight?: Actor['knownOnSight'] | boolean };
      if (a.knownOnSight === true) a.knownOnSight = 'everyone';
      else if (a.knownOnSight === false) delete a.knownOnSight;
    }
  },
  // D-1623 (WT4 a): everyone has a point and a height of their own: a point missing takes its title's middle, the height
  // its title's floor; an event's point takes its title's floor; a thing on the ground with no point lay in no title (none
  // could reach it) and goes
  14: (pages) => {
    const zones = new Map(Object.keys(pages).filter((k) => k.startsWith('place.')).flatMap((k) => (pages[k] as Place).zones.map((z) => [z.id, z] as const)));
    const floorOf = (zone: string) => zones.get(zone)?.floor ?? 0;
    for (const k of actorKeys(pages)) {
      const a = pages[k] as Omit<Actor, 'pos' | 'floor'> & { pos?: Actor['pos']; floor?: number }, z = zones.get(a.zone);
      if (!a.pos) a.pos = z?.outline?.length ? keepInside(middleOf(z.outline), z.outline, 0) : { x: 0, y: 0 };
      a.floor ??= floorOf(a.zone);
    }
    for (const e of (pages.engine as EnginePage).recentEvents ?? []) {
      if (e.pos && e.pos.floor === undefined) e.pos.floor = floorOf(e.zone);
      if (e.fromPos && e.fromPos.floor === undefined) e.fromPos.floor = floorOf(e.fromZone ?? e.zone);
    }
    for (const k of Object.keys(pages)) if (k.startsWith('tile.')) { const t = pages[k] as TilePage; t.items = t.items.filter((i) => i.at); }
  },
};

/** run steps from → to in order; returns false (and an error) when the save is too old, too new or a step is missing. */
export function migrate(pages: Pages, from: number, to: number, r: CheckReport): boolean {
  if (from > to) {
    r.errors.push(`schema: save is version ${from}, newer than this code (${to})`);
    return false;
  }
  if (from < CONFIG.OLDEST_SAVE_SCHEMA) {
    r.errors.push(`schema: this save was made ${CONFIG.OLDEST_SAVE_REASON}; start a new character`);
    return false;
  }
  for (let v = from; v < to; v++) {
    const step = MIGRATIONS[v];
    if (!step) {
      r.errors.push(`schema: no migration step v${v} -> v${v + 1}`);
      return false;
    }
    step(pages);
    r.repairs.push(`migrated v${v} -> v${v + 1}`);
  }
  if (from < to) Object.keys(pages).forEach((k) => r.changed.add(k));
  return true;
}

// ---------- shape ----------
type Kind = 'string' | 'number' | 'object' | 'array' | 'boolean';
const T = (v: unknown, k: Kind) => (k === 'array' ? Array.isArray(v) : k === 'object' ? !!v && typeof v === 'object' && !Array.isArray(v) : typeof v === k);
const SHAPES: Record<string, Record<string, Kind>> = {
  engine: { storyId: 'string', turn: 'number', mode: 'string', rngSeed: 'number', rngState: 'number', pending: 'object', stage: 'object', scenarioCaps: 'object', clocks: 'object', bands: 'array', quests: 'array' },
  hidden: { storyId: 'string', plans: 'object', memory: 'object', secrets: 'array', firedLog: 'array', weaverNote: 'string', stage: 'object' },
  actor: { id: 'string', storyId: 'string', kind: 'string', names: 'object', label: 'string', placeId: 'string', zone: 'string', pos: 'object', floor: 'number', bandId: 'string', core: 'object' },
  core: { bodyTypeId: 'string', skills: 'object', classes: 'array', perks: 'array', condition: 'object', inventory: 'array', standingDefense: 'string' },
  place: { id: 'string', storyId: 'string', kind: 'string', names: 'object', zones: 'array', state: 'object', headlines: 'array' },
  facts: { storyId: 'string', placeId: 'string', facts: 'array' },
  blueprint: { storyId: 'string', id: 'string', kind: 'string', data: 'object' },
  region: { id: 'string', storyId: 'string', kind: 'string', heights: 'array', cover: 'string', waters: 'array', roads: 'array', nodes: 'array', sites: 'array', features: 'array' },
  tile: { storyId: 'string', tx: 'number', ty: 'number', size: 'number', walls: 'array', openings: 'array', roofs: 'array', lights: 'array', furniture: 'array', items: 'array' }, // WT1 a
};
const kindOf = (key: string) => key.split('.')[0];

export function checkShape(pages: Pages, r: CheckReport): void {
  for (const need of ['engine', 'hidden']) if (!(need in pages)) r.errors.push(`shape: missing page ${need}`);
  for (const [key, page] of Object.entries(pages)) {
    const shape = SHAPES[kindOf(key)];
    if (!shape) { r.errors.push(`shape: unknown page key ${key}`); continue; }
    const bad = (o: unknown, s: Record<string, Kind>) => Object.entries(s).filter(([f, k]) => !T((o as Record<string, unknown>)?.[f], k)).map(([f]) => f);
    const fields = bad(page, shape);
    if (kindOf(key) === 'actor' && !fields.includes('core')) fields.push(...bad((page as Actor).core, SHAPES.core).map((f) => `core.${f}`));
    if (kindOf(key) === 'place' && !((page as Place).parentId === null || typeof (page as Place).parentId === 'string')) fields.push('parentId');
    if (fields.length) r.errors.push(`shape: ${key} bad ${fields.join(', ')}`);
  }
}

// ---------- library lookups (story blueprints first) ----------
function lookups(pages: Pages, lib: Library) {
  const bps = Object.keys(pages).filter((k) => k.startsWith('blueprint.')).map((k) => pages[k] as BlueprintPage);
  const bp = (kind: BlueprintPage['kind'], id: string) => bps.find((b) => b.kind === kind && b.id === id)?.data;
  return {
    item: (id: string) => (bp('item', id) as ItemDef | undefined) ?? lib.items[resolveAlias(id, lib)],
    bodyType: (id: string) => (bp('body_type', id) as BodyType | undefined) ?? lib.bodyTypes[resolveAlias(id, lib)],
    hasTemplate: (id: string) => !!(bp('npcTemplate', id) ?? lib.templates[resolveAlias(id, lib)]),
    hasItem: (id: string) => !!(bp('item', id) ?? lib.items[resolveAlias(id, lib)]),
    isBlueprint: (id: string) => bps.some((b) => b.id === id),
  };
}
const actorKeys = (pages: Pages) => Object.keys(pages).filter((k) => k.startsWith('actor.'));

// ---------- library reconcile (§7) ----------
/** Follow aliases, mark deleted entries dormant, sync body-part pools. Idempotent, so it runs on every load. */
export function reconcile(pages: Pages, lib: Library, r: CheckReport): void {
  const L = lookups(pages, lib);
  const gone = (id: string, exists: boolean) => lib.status[id]?.state === 'deleted' || !exists;
  const follow = (id: string) => (L.isBlueprint(id) ? id : resolveAlias(id, lib));
  for (const key of actorKeys(pages)) {
    const a = pages[key] as Actor;
    const c = a.core;
    let touched = false;
    const note = (msg: string) => { r.repairs.push(`reconcile: ${a.id} ${msg}`); touched = true; };
    for (const [id, entry] of Object.entries(c.skills)) {
      const to = follow(id);
      if (to !== id) {
        delete c.skills[id];
        if (!c.skills[to]) c.skills[to] = entry;
        note(`skill ${id} -> ${to}`);
      }
      const e = c.skills[to];
      if (!e.dormant && gone(to, !!lib.skills[to])) { e.dormant = true; note(`skill ${to} dormant`); }
    }
    for (const cl of c.classes) {
      const to = follow(cl.classId);
      if (to !== cl.classId) { note(`class ${cl.classId} -> ${to}`); cl.classId = to; }
      if (!cl.dormant && gone(to, !!lib.classes[to])) { cl.dormant = true; note(`class ${to} dormant`); }
    }
    for (const p of c.perks) {
      const to = follow(p.perkId);
      if (to !== p.perkId) { note(`perk ${p.perkId} -> ${to}`); p.perkId = to; }
      if (!p.dormant && gone(to, !!lib.perks[to])) { p.dormant = true; note(`perk ${to} dormant`); }
    }
    for (const it of c.inventory) {
      const to = follow(it.itemId);
      if (to !== it.itemId) { note(`item ${it.itemId} -> ${to}`); it.itemId = to; }
    }
    for (const f of ['bodyTypeId', 'templateId'] as const) {
      const id = c[f];
      if (id && follow(id) !== id) { note(`${f} ${id} -> ${follow(id)}`); c[f] = follow(id); }
    }
    const ct = L.bodyType(c.bodyTypeId);
    if (ct) {
      const ids = new Set(ct.parts.map((p) => p.id));
      for (const pid of Object.keys(c.condition.parts)) if (!ids.has(pid)) { delete c.condition.parts[pid]; note(`part ${pid} dropped`); }
      for (const pid of ids) if (!(pid in c.condition.parts)) { c.condition.parts[pid] = 100; note(`part ${pid} added Healthy`); }
    }
    if (touched) r.changed.add(key);
  }
}

// ---------- invariants (refuse) and references (repair) ----------
export function checkInvariants(pages: Pages, storyId: string, lib: Library, r: CheckReport): void {
  const L = lookups(pages, lib);
  for (const [key, page] of Object.entries(pages)) if ((page as { storyId?: string }).storyId !== storyId) r.errors.push(`invariant: ${key} carries another story id`);
  const places = Object.keys(pages).filter((k) => k.startsWith('place.')).map((k) => pages[k] as Place);
  const zonePlace = new Map(places.flatMap((p) => p.zones.map((z) => [z.id, p.id] as const)));
  const actors = actorKeys(pages).map((k) => pages[k] as Actor);
  if (actors.filter((a) => a.kind === 'player').length !== 1) r.errors.push('invariant: exactly one player actor');
  for (const a of actors) {
    const c = a.core;
    // SHEET-50: at most one current class; a classless start holds only Commoner unlocked (CC6 b)
    if (c.classes.filter((x) => x.state === 'current').length > 1) r.errors.push(`invariant: ${a.id} has more than one current class`);
    if (zonePlace.get(a.zone) !== a.placeId) r.errors.push(`invariant: ${a.id} placeId ${a.placeId} is not the place of zone ${a.zone}`);
    const ct = L.bodyType(c.bodyTypeId);
    if (!ct) { r.errors.push(`invariant: ${a.id} body type ${c.bodyTypeId} unknown`); continue; }
    const parts = new Set(ct.parts.map((p) => p.id).filter((p) => !c.condition.destroyed?.includes(p)));
    const slots = new Set<string>();
    const covered = new Set<string>();
    for (const it of c.inventory) {
      const def = L.item(it.itemId);
      for (const slot of it.equippedIn ?? []) {
        if (slots.has(slot) && slot !== 'armor') r.errors.push(`invariant: ${a.id} slot ${slot} used twice`); // IR19: several armor pieces; no part twice (below)
        slots.add(slot);
        if (slot === 'armor') for (const p of def?.armor?.covers ?? []) {
          if (covered.has(p)) r.errors.push(`invariant: ${a.id} part ${p} covered by two worn items`);
          covered.add(p);
        }
      }
      for (const g of gripsOf(it)) if (!parts.has(g)) r.errors.push(`invariant: ${a.id} slot ${gripSlot(g)} names a part it lacks`);
      if (def?.stackable && !((it.qty ?? 0) >= 1)) r.errors.push(`invariant: ${a.id} stack ${it.id} holds qty < 1`);
    }
  }
}

/** No children: an NPC under its race's youngest age (after a library change) leaves the world (the links to it are dropped
 * below). A player is never under it: creation keeps to the race's creation ages */
function dropChildren(pages: Pages, r: CheckReport): void {
  const clock = { clocks: (pages.engine as EnginePage | undefined)?.clocks ?? {} } as GameState;
  for (const k of actorKeys(pages)) {
    const a = pages[k] as Actor, years = ageYears(clock, a), min = youngestAge(a.core.raceId);
    if (a.kind !== 'npc' || years === undefined || min === undefined || years >= min) continue;
    delete pages[k]; r.repairs.push(`reference: dropped child ${a.id}`);
  }
}

/** Drop dangling links and list them (§8 References). */
export function repairReferences(pages: Pages, lib: Library, r: CheckReport): void {
  dropChildren(pages, r);
  const L = lookups(pages, lib);
  const keys = Object.keys(pages);
  const placeIds = new Set(keys.filter((k) => k.startsWith('place.')).map((k) => (pages[k] as Place).id));
  const actorIds = new Set(actorKeys(pages).map((k) => (pages[k] as Actor).id));
  const factIds = new Set(keys.filter((k) => k.startsWith('facts.')).flatMap((k) => (pages[k] as FactsPage).facts.map((f) => f.id)));
  const bands = (pages.engine as EnginePage | undefined)?.bands.map((b) => b.id) ?? [];
  const fix = (key: string, msg: string) => { r.repairs.push(`reference: ${key} ${msg}`); r.changed.add(key); };
  const keep = <T>(key: string, list: T[], ok: (x: T) => boolean, what: string): T[] => {
    const bad = list.filter((x) => !ok(x));
    if (bad.length) fix(key, `dropped ${what} ${bad.map((x) => (typeof x === 'object' && x && 'itemId' in x ? (x as { itemId: string }).itemId : String(x))).join(', ')}`);
    return list.filter(ok);
  };
  for (const k of keys) {
    const page = pages[k];
    if (k.startsWith('place.')) {
      const p = page as Place;
      if (p.parentId !== null && !placeIds.has(p.parentId)) { fix(k, `dropped parent ${p.parentId}`); p.parentId = null; }
      p.headlines = keep(k, p.headlines, (f) => factIds.has(f), 'headlines');
    } else if (k.startsWith('tile.')) {
      // an item the library no longer has would make every title's view throw: drop it, as for inventories
      const g = page as TilePage;
      g.items = keep(k, g.items ?? [], (it) => L.hasItem(it.itemId), 'unknown ground items');
      for (const c of g.items) if (c.contents) c.contents = keep(k, c.contents, (it) => L.hasItem(it.itemId), `unknown items in ${c.id}`); // CT1
    } else if (k.startsWith('facts.')) {
      for (const f of (page as FactsPage).facts) f.promotedTo = keep(k, f.promotedTo, (p) => placeIds.has(p), `promotions of ${f.id}`);
    } else if (k.startsWith('actor.')) {
      const a = page as Actor;
      if (a.journal) {
        a.journal.factsWitnessed = keep(k, a.journal.factsWitnessed, (f) => factIds.has(f), 'witnessed facts');
        a.journal.namesKnown = keep(k, a.journal.namesKnown, (id) => actorIds.has(id), 'names known');
      }
      if (a.mind) {
        for (const id of Object.keys(a.mind.knowledge)) if (id !== a.id && !actorIds.has(id)) { delete a.mind.knowledge[id]; fix(k, `dropped belief about ${id}`); }
        for (const id of Object.keys(a.mind.overrides ?? {})) if (!actorIds.has(id)) { delete a.mind.overrides![id]; fix(k, `dropped stance toward ${id}`); }
        // a routine the library no longer has would make every view of this actor throw: drop it
        if (a.mind.routines) a.mind.routines = keep(k, a.mind.routines, (id) => !!lib.routines[id], 'unknown routines');
        if (a.mind.routine && !lib.routines[a.mind.routine.id]) { fix(k, `dropped current routine ${a.mind.routine.id}`); delete a.mind.routine; }
      }
      a.core.inventory = keep(k, a.core.inventory, (it) => L.hasItem(it.itemId), 'unknown items');
      for (const c of a.core.inventory) if (c.contents) c.contents = keep(k, c.contents, (it) => L.hasItem(it.itemId), `unknown items in ${c.id}`); // CT1
      if (a.core.templateId && !L.hasTemplate(a.core.templateId)) r.warnings.push(`${a.id} template ${a.core.templateId} unknown`);
      if (!bands.includes(a.bandId)) r.warnings.push(`${a.id} band ${a.bandId} unknown`);
    } else if (k === 'hidden') {
      const h = page as HiddenPage;
      for (const id of Object.keys(h.plans)) if (!actorIds.has(id)) { delete h.plans[id]; fix(k, `dropped plan of ${id}`); }
      for (const id of Object.keys(h.memory)) if (!actorIds.has(id)) { delete h.memory[id]; fix(k, `dropped memory of ${id}`); }
      if (h.agreements) h.agreements = keep(k, h.agreements, (g) => g.parties.every((p) => actorIds.has(p)), 'agreements with unknown actors');
    }
  }
}
