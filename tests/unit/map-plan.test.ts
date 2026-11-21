// The stage map's layout (rpg-map): code places zones on the 1 m grid with buildings in one piece (MAP-10, MAP-12), then
// places every mark so none covers another (MAP-20..32), and the four test stages (MAP-52) come out clean.
import { describe, expect, it } from 'vitest';
import { TEXT, checkReach, checkStage, planScene, roughMeasure, type Box, type Scene } from '../../src/ui/mapPlan';
import { knownMap, type MapZone } from '../../src/ui/mapData';
import { createFakeGame } from '../../src/ui/fakeGame';
import type { GameState } from '../../src/types';
import { brokenLayouts } from '../../src/scenario/geometry';
import { roofed } from '../../src/plan/where';
import { noteLeft, noteZonesSeen, visitedZoneIds } from '../../src/engine/trail';

const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inside = (a: Box, b: Box, pad: number) => a.x0 >= b.x0 + pad && a.x1 <= b.x1 - pad && a.y0 >= b.y0 + pad && a.y1 <= b.y1 - pad;

/** the checkMap rules on the scene's own boxes: what the browser check measures, without a browser */
function findings(sc: Scene): string[] {
  const out: string[] = [];
  // zone names are a background layer the marks may sit on (MZ4): only the marks themselves may not overlap; people and your
  // pin stand at their own point and may overlap anything (MAP-25, OM4b a)
  const marks: [string, Box][] = [...sc.places.map((p) => [`title ${p.id}`, p.title] as [string, Box]),
    ...sc.exits.map((e) => [`note ${e.id}`, e.note] as [string, Box]),
    ...sc.doors.map((d) => [`icon ${d.id}`, d] as [string, Box]), ...sc.stairs.map((s) => [`icon ${s.id}`, s] as [string, Box]), ...sc.furniture.map((f) => [`icon ${f.id}`, f] as [string, Box]), ...sc.items.map((t) => [`icon ${t.id}`, t] as [string, Box])];
  for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) if (hit(marks[i][1], marks[j][1])) out.push(`MAP-22/31 ${marks[i][0]} overlaps ${marks[j][0]}`);
  for (const l of sc.labels) { const z = sc.zones.find((x) => x.z.id === l.zoneId)!; if (l.placement === 'inside' && !inside(l, z.box, 6)) out.push(`MAP-20 label ${l.zoneId} does not fit`); }
  for (const a of sc.zones) for (const b of sc.zones) if (a !== b && hit(a.box, b.box) && !inside(a.box, b.box, 0) && !inside(b.box, a.box, 0)) out.push(`MAP-11 ${a.z.id} ${b.z.id}`);
  for (const e of sc.exits) if (!e.target) out.push(`MAP-32 exit ${e.id} has no target`);
  return [...out, ...sc.lost.map((id) => `MAP-32 lost ${id}`)];
}
function sceneOf(st: GameState, k: number) {
  const m = knownMap(st), root = m.places.find((p) => !p.parentId || !m.places.some((q) => q.id === p.parentId))!;
  const inPlace = (id: string, anc: string): boolean => id === anc || (!!m.places.find((p) => p.id === id)?.parentId && inPlace(m.places.find((p) => p.id === id)!.parentId!, anc));
  const zones = m.places.flatMap((p) => p.zones).filter((z) => z.height === 0);
  const places = m.places.filter((p) => p.id !== root.id).map((p) => ({ id: p.id, name: p.name, depth: p.depth, zones: zones.filter((z) => inPlace(z.placeId, p.id)) })).filter((p) => p.zones.length);
  return { sc: planScene({ zones, every: m.places.flatMap((p) => p.zones), places, people: m.people.filter((w) => w.root === root.id && w.height === 0), k, measure: roughMeasure, awayName: () => undefined }), zones, places, m };
}
const stageState = (key: string) => {
  const g = createFakeGame({ autoStart: true, stage: key });
  return g.state()!;
};

describe('MAP-52 test stages', () => {
  for (const key of ['bent-nail', 'one-room', 'long-names', 'two-towns']) for (const k of [0.6, 1, 1.6]) {
    it(`${key} at zoom ${k}: no mark covers another, every exit named, zones on the grid and out of other buildings`, () => {
      const { sc, zones, places, m } = sceneOf(stageState(key), k);
      expect(findings(sc)).toEqual([]);
      expect(checkStage(zones, places)).toEqual([]);
      const all = m.places.flatMap((p) => p.zones), ids = new Set(all.map((z) => z.id));
      expect(checkReach([...ids], all.flatMap((z) => z.links.filter((l) => ids.has(l.to)).map((l) => [z.id, l.to] as [string, string])), m.zoneId)).toEqual([]);
    });
  }
});

describe('MR2: a stored layout that breaks the map rules is named, never moved (PZ16 b: plans are kept as drawn)', () => {
  it('the live save\'s Bent Nail is named: off the grid, and the lane through the tavern; nothing moves', () => {
    const st = stageState('bent-nail-saved'), before = JSON.stringify(st.zones.map((z) => z.outline));
    expect(brokenLayouts(st, (z) => roofed(st, z)).map((b) => b.placeId).sort()).toEqual(['tavern', 'thornbury']);
    expect(JSON.stringify(st.zones.map((z) => z.outline))).toBe(before);
  });
});

describe('MR1: the zones the player has stood in', () => {
  it('a save without the list starts it from the trail and where the player stands; then each zone stood in joins it once', () => {
    const st = stageState('bent-nail');
    delete st.player.journal!.zonesVisited;
    expect(visitedZoneIds(st).sort()).toEqual(['high_lane', 'midden_yard', 'tavern.common', 'tavern.kitchen']);
    noteZonesSeen(st);
    noteZonesSeen(st);
    expect(st.player.journal!.zonesVisited!.filter((z) => z === 'midden_yard').length).toBe(1);
    st.player.zone = 'tavern.yard';
    noteLeft(st, 'midden_yard');
    noteZonesSeen(st);
    expect(st.player.journal!.zonesVisited).toContain('tavern.yard');
    expect(st.player.journal!.zonesSeen).not.toEqual(st.player.journal!.zonesVisited);
  });
});

describe('labels, doors and exits', () => {
  it('MAP-20: every zone name is at the one small size inside its box, and takes no room from the marks', () => {
    const { sc } = sceneOf(stageState('bent-nail'), 1.6);
    expect(sc.labels.map((l) => l.zoneId)).toContain('tavern.common');
    const { ascent, descent } = roughMeasure.line('label');
    for (const l of sc.labels) {
      const z = sc.zones.find((x) => x.z.id === l.zoneId)!;
      expect(l.placement).toBe('inside');
      expect(l.x0).toBeGreaterThanOrEqual(z.box.x0 + 6);
      expect(l.x1).toBeLessThanOrEqual(z.box.x1 - 6);
      expect(l.y0).toBeGreaterThanOrEqual(z.box.y0 + 6);
      expect(l.y1).toBeLessThanOrEqual(z.box.y1 - 6);
      // BG-346: the box holds the letters as the font sets them, ascent to descent
      expect(l.base - ascent).toBeGreaterThanOrEqual(l.y0);
      expect(l.base + (l.lines.length - 1) * TEXT.label.line + descent).toBeLessThanOrEqual(l.y1);
      expect(l.lines.join(' ')).toBe(l.full);
    }
  });
  it('MAP-20, MAP-21: a long name wraps to up to three lines at that size; a zone too small for it shows its name on hover only', () => {
    const z: MapZone = { id: 'z', placeId: 'p', name: 'a very long name for a tiny cupboard under the stairs', look: '', outdoor: false, here: false, inView: true, height: 0,
      rect: { x: 1.5, y: 1.5, w: 3, d: 3 }, links: [], items: [] };
    const at = (k: number, w = 3) => planScene({ zones: [{ ...z, rect: { ...z.rect!, w } }], every: [z], places: [], people: [], k, measure: roughMeasure, awayName: () => undefined }).labels;
    expect(at(2.5)).toEqual([]);
    const l = at(2.5, 12)[0];
    expect(l.lines.length).toBeLessThanOrEqual(3);
    expect(l.lines.join(' ')).toBe(z.name);
  });
});

