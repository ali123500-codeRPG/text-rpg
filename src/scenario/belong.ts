// BEL-17, BB1 a, BB2 a: the organizations and ties code gives the people a plan casts. A recipe's people belong to the
// settlement's own body (its watch) or to a new one of their own (a gang, a company, a pack); a caravan's guards are hired
// by its master in person. Each settlement has a council for its rule, which holds the place and whose law runs there:
// the Leader heads it, the Warden is an officer, and a Seat of the Great holds the place over it.
import type { Actor, GameState, Organization, Place, Region, Site, StagePlan, Tie, TieEnd } from '../types';
import type { RecipeOrg } from '../types/library';
import type { Commitment } from '../scales';
import { getLibrary } from '../library';
import { SETTLEMENT_COUNCIL } from '../library/npcs';
import { rosterEntry } from '../land/roster';
import { orgById } from '../engine/belonging';
import { toSegment } from '../plan/geom';
import { now } from '../time';

type Cast = StagePlan['cast'][number];

/** a label as a title: "a watch captain" → "watch captain" (BEL-09: display and speech only) */
const titleOf = (label: string) => label.replace(/^(a|an|the) /i, '').trim();

const sameEnd = (x: TieEnd, y: TieEnd) => ('org' in x && 'org' in y && x.org === y.org) || ('person' in x && 'person' in y && x.person === y.person);

/** give `a` a tie, unless it already holds one to that end (its first stays first: BEL-06) */
function tieTo(state: GameState, a: Actor, to: TieEnd, commitment: Commitment, title: string | undefined, status: Tie['status'] = 'member'): void {
  if ((a.ties ??= []).some((t) => sameEnd(t.to, to))) return;
  a.ties.push({ to, status, commitment, cover: 'open', ...(title ? { title } : {}), since: now(state) });
}

function addOrg(state: GameState, o: Organization): Organization {
  (state.organizations ??= []).push(o);
  return o;
}

const regionOf = (state: GameState, pred: (r: Region) => boolean) => state.regions?.find(pred);

/** the settlement a place stands in: its top place's site */
function siteOfPlace(state: GameState, placeId: string | undefined): { site: Site; region: Region } | undefined {
  let p: Place | undefined = state.places.find((x) => x.id === placeId);
  for (let n = 0; p?.parentId && n < 64; n++) p = state.places.find((x) => x.id === p!.parentId);
  const id = p?.site;
  const r = id ? regionOf(state, (x) => x.sites.some((s) => s.id === id)) : undefined;
  return r && { site: r.sites.find((s) => s.id === id)!, region: r };
}

/** the settlement nearest (in metres) to a line or a point in one region */
function nearestSite(r: Region, pts: { x: number; y: number }[]): Site | undefined {
  const d = (s: Site) => pts.length > 1 ? Math.min(...pts.slice(1).map((b, i) => toSegment(s.at, pts[i], b).d)) : Math.hypot(s.at.x - pts[0].x, s.at.y - pts[0].y);
  return [...r.sites].sort((a, b) => d(a) - d(b))[0];
}

/** BB1 a: the settlement a cast entry belongs to: its roster's site; off a settlement (a road or a landmark), the nearest
 * one in metres; with no roster, the settlement its place stands in */
function settlementOf(state: GameState, roster: string | undefined, placeId: string): Site | undefined {
  const at = roster?.split('.')[0];
  if (at) {
    const r = regionOf(state, (x) => x.sites.some((s) => s.id === at) || x.roads.some((w) => w.id === at) || x.features.some((f) => f.id === at));
    if (r) {
      const site = r.sites.find((s) => s.id === at);
      if (site) return site;
      const road = r.roads.find((w) => w.id === at), f = r.features.find((x) => x.id === at);
      return nearestSite(r, road ? road.pts : [f!.at]);
    }
  }
  return siteOfPlace(state, placeId)?.site;
}

/** BB2 a: a settlement's council, made the first time it is needed; seated at, holding and giving law in its place once
 * that place is built */
function council(state: GameState, site: Site): Organization {
  const id = `org_${site.id}_council`;
  const o = orgById(state, id) ?? addOrg(state, { id, name: `the ${site.name} council`, kind: SETTLEMENT_COUNCIL.kind });
  const place = site.placeId ? state.places.find((p) => p.id === site.placeId) : undefined;
  if (place) {
    o.seat ??= place.id;
    // a Seat of the Great cast before the place was built still holds it
    const seat = (state.orgLinks ?? []).find((l) => 'org' in l.a && l.a.org === id && l.kind === 'registered_with')?.b;
    place.holder ??= seat ?? { org: id };
    place.law ??= { org: id };
  }
  return o;
}

/** BB1 a: a settlement's watch, a unit of its council (BB2 a) */
function watchOf(state: GameState, site: Site, spec: RecipeOrg): Organization {
  const id = `org_${site.id}_${spec.kind}`, c = council(state, site);
  return orgById(state, id) ?? addOrg(state, { id, name: `the ${site.name} ${spec.kind[0].toUpperCase()}${spec.kind.slice(1)}`, kind: spec.kind, parentId: c.id,
    ...(c.seat ? { seat: c.seat } : {}), ...(spec.closeKnit ? { closeKnit: true as const } : {}) });
}

const officer = (o: Organization, a: Actor) => { if (o.headId !== a.id && !o.officerIds?.includes(a.id)) (o.officerIds ??= []).push(a.id); };

/** after a plan's cast is spawned (applyStagePlan): every cast entry's organization and ties (castActors[i] is cast[i]) */
export function fillBelonging(state: GameState, cast: Cast[], castActors: Actor[]): void {
  const lib = getLibrary(), byKey = new Map(cast.map((c, i) => [c.key, i]));
  const beast = (c: Cast) => !!c.compose && lib.npcRoles?.[c.compose.role]?.kind === 'beast';
  const own = new Map<string, Organization>(); // a recipe's lead key → the body it made
  cast.forEach((c, i) => {
    const a = castActors[i], leadKey = c.groupOf ?? c.key, lead = castActors[byKey.get(leadKey) ?? i], leadEntry = cast[byKey.get(leadKey) ?? i];
    const recipe = c.recipe ? lib.castRecipes?.[c.recipe] : undefined;
    const title = beast(c) ? undefined : titleOf(c.label);
    // BB2 a: a roster's Leader, Warden or Seat of the Great and the settlement's council
    const hook = c.roster ? lib.hookKinds?.[rosterEntry(state, c.roster)?.hook ?? ''] : undefined;
    if (hook?.council) {
      const site = settlementOf(state, c.roster, a.placeId);
      if (site) {
        const o = council(state, site);
        if (hook.council === 'holds') {
          const place = site.placeId ? state.places.find((p) => p.id === site.placeId) : undefined;
          if (place) place.holder = { person: a.id };
          if (!(state.orgLinks ?? []).some((l) => 'org' in l.a && l.a.org === o.id && l.kind === 'registered_with')) {
            (state.orgLinks ??= []).push({ id: `link_${o.id}_${a.id}`, a: { org: o.id }, b: { person: a.id }, kind: 'registered_with', cover: 'open' });
          }
        } else {
          if (hook.council === 'head') o.headId ??= a.id; else officer(o, a);
          tieTo(state, a, { org: o.id }, SETTLEMENT_COUNCIL.commitment, title);
        }
      }
    }
    if (!recipe) return;
    // BB1 a: a caravan's guards serve its master in person, by pay
    if (recipe.hired && c.groupOf && lead !== a) tieTo(state, a, { person: lead.id }, 'bound', title, 'hired');
    const spec = recipe.org;
    if (!spec) return;
    let o: Organization | undefined;
    if (spec.of === 'own') {
      o = own.get(leadKey);
      if (!o) {
        const g = state.bands.find((b) => b.id === lead.bandId);
        o = addOrg(state, { id: `org_${lead.id}`, name: g?.name ?? `the ${recipe.name.toLowerCase()}`, kind: spec.kind, headId: lead.id, ...(spec.closeKnit ? { closeKnit: true as const } : {}) });
        own.set(leadKey, o);
      }
    } else {
      const site = settlementOf(state, leadEntry.roster, lead.placeId);
      if (site) o = watchOf(state, site, spec);
    }
    if (!o) return;
    if (a === lead && (spec.of === 'own' || spec.heads)) o.headId ??= a.id;
    if (c.seat === 'officer') officer(o, a);
    tieTo(state, a, { org: o.id }, spec.commitment, title);
  });
  // BB2 a: every settlement this plan built has its council, holding the place and giving its law
  for (const r of state.regions ?? []) for (const s of r.sites) if (s.placeId && state.places.some((p) => p.id === s.placeId)) council(state, s);
}
