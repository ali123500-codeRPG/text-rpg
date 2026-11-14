// The stage map's layout (rpg-map): code places zones on the 1 m grid with buildings in one piece (MAP-10, MAP-12), then
// places every mark so none covers another (MAP-20..32), and the three test stages (MAP-52) come out clean.
import { describe, expect, it } from 'vitest';
import { checkReach, checkStage, planScene, roughMeasure, wrap, type Box, type Scene } from '../../src/ui/mapPlan';
import { knownMap, type MapZone } from '../../src/ui/mapData';
import { createFakeGame } from '../../src/ui/fakeGame';
import { FAKE_STAGES } from '../../src/ui/fakeStages';
import { wholeTurn } from '../harness/turn';
import { intent } from '../cases/w4-kit';
import type { GameState } from '../../src/types';
import { brokenLayouts, relayBroken } from '../../src/scenario/geometry';
import { noteLeft, noteZonesSeen, visitedZoneIds } from '../../src/engine/trail';

const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inside = (a: Box, b: Box, pad: number) => a.x0 >= b.x0 + pad && a.x1 <= b.x1 - pad && a.y0 >= b.y0 + pad && a.y1 <= b.y1 - pad;

/** the checkMap rules on the scene's own boxes: what the browser check measures, without a browser */
function findings(sc: Scene): string[] {
  const out: string[] = [];
  const marks: [string, Box][] = [...sc.labels.map((l) => [`label ${l.zoneId}`, l] as [string, Box]), ...sc.places.map((p) => [`title ${p.id}`, p.title] as [string, Box]),
    ...sc.exits.map((e) => [`note ${e.id}`, e.note] as [string, Box]), ...sc.tokens.map((t) => [`token ${t.id}`, t] as [string, Box]),
    ...sc.doors.map((d) => [`icon ${d.id}`, d] as [string, Box]), ...sc.stairs.map((s) => [`icon ${s.id}`, s] as [string, Box]), ...sc.furniture.map((f) => [`icon ${f.id}`, f] as [string, Box])];
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
  return { sc: planScene({ zones, every: m.places.flatMap((p) => p.zones), places, k, measure: roughMeasure, awayName: () => undefined }), zones, places, m };
}
const stageState = (key: string) => {
  const g = createFakeGame({ autoStart: true, stage: key });
  return g.state()!;
};

describe('MAP-52 test stages', () => {
  for (const key of ['bent-nail', 'one-room', 'long-names']) for (const k of [0.6, 1, 1.6]) {
    it(`${key} at zoom ${k}: no mark covers another, every exit named, zones on the grid and out of other buildings`, () => {
      const { sc, zones, places, m } = sceneOf(stageState(key), k);
      expect(findings(sc)).toEqual([]);
      expect(checkStage(zones, places)).toEqual([]);
      const all = m.places.flatMap((p) => p.zones), ids = new Set(all.map((z) => z.id));
      expect(checkReach([...ids], all.flatMap((z) => z.links.filter((l) => ids.has(l.to)).map((l) => [z.id, l.to] as [string, string])), m.zoneId)).toEqual([]);
    });
  }
  it('the Bent Nail is one building: the high lane runs beside it, and the bar sits north of the common room', () => {
    const st = stageState('bent-nail'), z = (id: string) => st.places.flatMap((p) => p.zones).find((x) => x.id === id)!.rect!;
    const common = z('tavern.common'), bar = z('tavern.bar');
    expect(bar.y - bar.d / 2).toBeCloseTo(common.y + common.d / 2); // touching, on the north wall
    const { zones, places } = sceneOf(st, 1);
    expect(checkStage(zones, places)).toEqual([]);
  });
  it('the layout as the live save stored it is caught: off the grid, and the lane through the tavern', () => {
    const { zones, places } = sceneOf(stageState('bent-nail-saved'), 1);
    const out = checkStage(zones, places);
    expect(out).toContain('MAP-12 zone high_lane runs through the building tavern');
    expect(out.some((f) => f.startsWith('MAP-10 zone tavern.common'))).toBe(true);
  });
  it('the stages exist as the fake preview names them', () => expect(Object.keys(FAKE_STAGES)).toEqual(['bent-nail', 'bent-nail-saved', 'one-room', 'long-names']));
});

describe('MR2: a stored layout that breaks the map rules is placed again once', () => {
  it('the live save\'s Bent Nail is re-placed: on the grid, the lane beside the tavern, people keep their spot', () => {
    const st = stageState('bent-nail-saved');
    expect(brokenLayouts(st).map((b) => b.placeId).sort()).toEqual(['tavern', 'thornbury']);
    const zoneOf = (id: string) => st.places.flatMap((p) => p.zones).find((z) => z.id === id)!;
    const guard = st.actors.find((a) => a.zone === 'high_lane' && a.pos)!, r0 = { ...zoneOf('high_lane').rect! };
    const share = { x: (guard.pos!.x - r0.x) / r0.w, y: (guard.pos!.y - r0.y) / r0.d };
    expect(relayBroken(st).length).toBe(2);
    expect(brokenLayouts(st)).toEqual([]);
    const { zones, places } = sceneOf(st, 1);
    expect(checkStage(zones, places)).toEqual([]);
    const r1 = zoneOf('high_lane').rect!;
    expect((guard.pos!.x - r1.x) / r1.w).toBeCloseTo(share.x);
    expect((guard.pos!.y - r1.y) / r1.d).toBeCloseTo(share.y);
    expect(relayBroken(st)).toEqual([]); // once: nothing moves on the next load
  });
  it('a layout already clean never moves (MAP-03)', () => {
    const st = stageState('bent-nail'), before = JSON.stringify(st.places);
    expect(relayBroken(st)).toEqual([]);
    expect(JSON.stringify(st.places)).toBe(before);
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
  it('the map draws a zone only seen apart from one stood in, from the saved list', () => {
    const st = stageState('long-names'), m = knownMap(st);
    expect(m.visited).toContain('g.drive');
    expect(m.visited).not.toContain('g.orchard');
  });
});

describe('labels, doors and exits', () => {
  it('a long name breaks over lines at spaces, never inside a word, fewest lines first', () => {
    expect(wrap('common room', 'label', 400, 3, roughMeasure)).toEqual(['common room']);
    const two = wrap('the great entrance hall with its galleried stair', 'label', 200, 3, roughMeasure)!;
    expect(two.length).toBe(2);
    expect(two.join(' ')).toBe('the great entrance hall with its galleried stair');
    expect(wrap('unbreakablelongword', 'label', 40, 3, roughMeasure)).toBeNull();
  });
  it('MAP-24: an exit to somewhere unknown is an arrow with "→ its name · state", and a locked one shows its lock on the wall', () => {
    const { sc } = sceneOf(stageState('one-room'), 1.6);
    expect(sc.exits.map((e) => e.note.full)).toEqual(['→ the door, south · unexplored, locked']);
    const e = sc.exits[0], room = sc.zones[0].box;
    expect(e.y2).toBeGreaterThan(e.y1); // south: down the screen
    const lock = sc.doors.find((d) => d.way?.shut === 'locked')!;
    expect(lock.cy).toBeCloseTo(room.y1); // on the south wall
    expect(sc.used.has('way:locked')).toBe(true);
  });
  it('MAP-21: a cut name keeps its full name for the tooltip', () => {
    const z: MapZone = { id: 'z', placeId: 'p', name: 'a very long name for a tiny cupboard under the stairs', look: '', outdoor: false, here: false, inView: true, height: 0,
      rect: { x: 0.5, y: 0.5, w: 1, d: 1 }, links: [], people: [], items: [] };
    const sc = planScene({ zones: [z], every: [z], places: [], k: 1, measure: roughMeasure, awayName: () => undefined });
    const l = sc.labels[0];
    expect(l.full).toBe(z.name);
    expect(l.placement).toBe('outside');
    expect(l.leader).toBeDefined();
  });
  it('MAP-33: with a record of visits, a zone only seen is drawn apart from one stood in; without it, none is', () => {
    const { m, zones } = sceneOf(stageState('long-names'), 1);
    const base = { every: zones, places: [], k: 1, measure: roughMeasure, awayName: () => undefined };
    expect(new Set(planScene({ ...base, zones }).zones.map((x) => x.state))).toEqual(new Set(['current', 'explored']));
    const st = planScene({ ...base, zones, visits: new Set([m.zoneId, 'g.drive']) }).zones;
    expect(st.find((x) => x.z.id === 'g.orchard')!.state).toBe('seen');
    expect(st.find((x) => x.z.id === 'g.drive')!.state).toBe('explored');
  });
});

describe('whole turn', () => {
  it('after a turn in the village, the map of what the player knows lays out with no mark covering another', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    await g.turn(intent({ action: { type: 'wait' } }));
    const { sc, zones, places } = sceneOf(g.game.state()!, 1);
    expect(sc.zones.length).toBeGreaterThan(0);
    expect(findings(sc)).toEqual([]);
    expect(checkStage(zones, places)).toEqual([]);
  });
});
