// Load checks (Part 4 §7–8): migration steps, library reconcile, shape, invariants, references.
import type { Actor, BlueprintPage, CreatureType, EnginePage, FactsPage, HiddenPage, ItemDef, Library, Place } from '../types';
import { resolveAlias } from '../library';
import type { Pages } from './pages';

export type CheckReport = { errors: string[]; repairs: string[]; warnings: string[]; changed: Set<string> };
export const newReport = (): CheckReport => ({ errors: [], repairs: [], warnings: [], changed: new Set() });

// ---------- migrations ----------
/** step from version v to v + 1, keyed by v. v1 is the baseline: no steps yet. Defaults for missing fields go only here. */
export const MIGRATIONS: Record<number, (pages: Pages) => void> = {};

/** run steps from → to in order; returns false (and an error) when a step is missing. */
export function migrate(pages: Pages, from: number, to: number, r: CheckReport): boolean {
  if (from > to) {
    r.errors.push(`schema: save is version ${from}, newer than this code (${to})`);
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
  engine: { storyId: 'string', turn: 'number', mode: 'string', rngSeed: 'number', rngState: 'number', pending: 'object', stage: 'object', sceneCaps: 'object', clocks: 'object', flags: 'object', bands: 'array', quests: 'array' },
  hidden: { storyId: 'string', plans: 'object', memory: 'object', secrets: 'array', firedLog: 'array', weaverNote: 'string', stage: 'object' },
  actor: { id: 'string', storyId: 'string', kind: 'string', names: 'object', label: 'string', placeId: 'string', zone: 'string', bandId: 'string', core: 'object' },
  core: { creatureTypeId: 'string', skills: 'object', classes: 'array', perks: 'array', condition: 'object', inventory: 'array', standingDefense: 'string' },
  place: { id: 'string', storyId: 'string', kind: 'string', names: 'object', zones: 'array', state: 'object', headlines: 'array' },
  facts: { storyId: 'string', placeId: 'string', facts: 'array' },
  blueprint: { storyId: 'string', id: 'string', kind: 'string', data: 'object' },
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
    if (kindOf(key) === 'engine' && !T((page as EnginePage).stage?.zoneIds, 'array')) fields.push('stage.zoneIds');
    if (fields.length) r.errors.push(`shape: ${key} bad ${fields.join(', ')}`);
  }
}

// ---------- library lookups (story blueprints first) ----------
function lookups(pages: Pages, lib: Library) {
  const bps = Object.keys(pages).filter((k) => k.startsWith('blueprint.')).map((k) => pages[k] as BlueprintPage);
  const bp = (kind: BlueprintPage['kind'], id: string) => bps.find((b) => b.kind === kind && b.id === id)?.data;
  return {
    item: (id: string) => (bp('item', id) as ItemDef | undefined) ?? lib.items[resolveAlias(id, lib)],
    creature: (id: string) => (bp('creature', id) as CreatureType | undefined) ?? lib.creatures[resolveAlias(id, lib)],
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
    for (const f of ['creatureTypeId', 'templateId'] as const) {
      const id = c[f];
      if (id && follow(id) !== id) { note(`${f} ${id} -> ${follow(id)}`); c[f] = follow(id); }
    }
    const ct = L.creature(c.creatureTypeId);
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
  for (const z of (pages.engine as EnginePage).stage.zoneIds) if (!zonePlace.has(z)) r.errors.push(`invariant: stage zone ${z} is on no place page`);
  for (const a of actors) {
    const c = a.core;
    if (c.classes.length && c.classes.filter((x) => x.state === 'current').length !== 1) r.errors.push(`invariant: ${a.id} must have exactly one current class`);
    if (zonePlace.get(a.zone) !== a.placeId) r.errors.push(`invariant: ${a.id} placeId ${a.placeId} is not the place of zone ${a.zone}`);
    for (const [s, e] of Object.entries(c.skills)) if (e.raw > 100) r.warnings.push(`${a.id} raw ${s} ${e.raw} above 100`);
    const ct = L.creature(c.creatureTypeId);
    if (!ct) { r.errors.push(`invariant: ${a.id} creature type ${c.creatureTypeId} unknown`); continue; }
    const parts = new Set(ct.parts.map((p) => p.id).filter((p) => !c.condition.destroyed?.includes(p)));
    const slots = new Set<string>();
    const covered = new Set<string>();
    for (const it of c.inventory) {
      const def = L.item(it.itemId);
      for (const slot of it.equippedIn ?? []) {
        if (slots.has(slot)) r.errors.push(`invariant: ${a.id} slot ${slot} used twice`);
        slots.add(slot);
        if (slot.startsWith('hand:') && !parts.has(slot.slice(5))) r.errors.push(`invariant: ${a.id} slot ${slot} names a part it lacks`);
        if (slot === 'armor') for (const p of def?.armor?.covers ?? []) {
          if (covered.has(p)) r.errors.push(`invariant: ${a.id} part ${p} covered by two worn items`);
          covered.add(p);
        }
      }
      if (def?.stackable && !((it.qty ?? 0) >= 1)) r.errors.push(`invariant: ${a.id} stack ${it.id} holds qty < 1`);
    }
  }
}

/** Drop dangling links and list them (§8 References). */
export function repairReferences(pages: Pages, lib: Library, r: CheckReport): void {
  const L = lookups(pages, lib);
  const keys = Object.keys(pages);
  const placeIds = new Set(keys.filter((k) => k.startsWith('place.')).map((k) => (pages[k] as Place).id));
  const actorIds = new Set(actorKeys(pages).map((k) => (pages[k] as Actor).id));
  const factIds = new Set(keys.filter((k) => k.startsWith('facts.')).flatMap((k) => (pages[k] as FactsPage).facts.map((f) => f.id)));
  const fix = (key: string, msg: string) => { r.repairs.push(`reference: ${key} ${msg}`); r.changed.add(key); };
  const keep = <T>(key: string, list: T[], ok: (x: T) => boolean, what: string): T[] => {
    const bad = list.filter((x) => !ok(x));
    if (bad.length) fix(key, `dropped ${what} ${bad.join(', ')}`);
    return list.filter(ok);
  };
  for (const k of keys) {
    const page = pages[k];
    if (k.startsWith('place.')) {
      const p = page as Place;
      if (p.parentId !== null && !placeIds.has(p.parentId)) { fix(k, `dropped parent ${p.parentId}`); p.parentId = null; }
      p.headlines = keep(k, p.headlines, (f) => factIds.has(f), 'headlines');
      // an item the library no longer has would make every zone view throw: drop it, as for inventories
      for (const z of p.zones) z.groundItems = keep(k, z.groundItems ?? [], (it) => L.hasItem(it.itemId), `unknown ground items in ${z.id}`);
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
        for (const id of [a.mind.routine?.id, ...(a.mind.routines ?? [])]) if (id && !lib.routines[id]) r.warnings.push(`${a.id} routine ${id} unknown`);
      }
      a.core.inventory = keep(k, a.core.inventory, (it) => L.hasItem(it.itemId), 'unknown items');
      if (a.core.templateId && !L.hasTemplate(a.core.templateId)) r.warnings.push(`${a.id} template ${a.core.templateId} unknown`);
      const bands = (pages.engine as EnginePage).bands.map((b) => b.id);
      if (!bands.includes(a.bandId)) r.warnings.push(`${a.id} band ${a.bandId} unknown`);
    } else if (k === 'hidden') {
      const h = page as HiddenPage;
      for (const id of Object.keys(h.plans)) if (!actorIds.has(id)) { delete h.plans[id]; fix(k, `dropped plan of ${id}`); }
      for (const id of Object.keys(h.memory)) if (!actorIds.has(id)) { delete h.memory[id]; fix(k, `dropped memory of ${id}`); }
    }
  }
}
