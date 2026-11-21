// In-memory fake GameApi with canned lines, for building and screenshotting the screens until W7's pipeline lands.
import { drawTitles } from '../plan/draw';
import { middle } from '../plan/where';
import { seeSquares, seeWhole } from '../plan/fog';
import { boxOf } from '../plan/geom';
import { dropOnGround, groundIn } from '../engine/ground';
import { BK, PA, VL, WK } from '../library/tableIds';
import { roadShape } from '../scenario/apply';
import { HL } from '../library/tableIds';
import { TP } from '../library/templateIds';
import type { CreationBuild, GameApi, GameState, GmSnapshot, LogLine, Notice, TitleSpec, WayKind, XpPart } from '../types';
import { CONFIG, defaultSettings } from '../config';
import { maxMorale, isBrokenLevel, moraleLevel, setMoraleLost } from '../ruleset/morale';
import { getLibrary } from '../library';
import { takePerk, undoPerk } from '../ruleset';
import { abandonQuest, pinQuest } from '../engine/quests';
import { readVow, renounceVow, swearVow, type VowForm } from '../engine/vows';
import { setSignatures } from '../ruleset/personality';
import { newInstanceId, spawnNpc, validateBuild } from '../library/spawn';
import { zoneById } from '../engine/relations';
import { playerFromBuild } from './sheet';
import { SK } from '../library/skillIds';
import { IT } from '../library/itemIds';
import { ACH } from '../library/achievementIds';
import { barMax, lineMax } from '../ruleset/fatigue';
import { achievementInfo, grantAchievement, tally } from '../engine/xp';
import { FN } from '../library/functionIds';
import { actionNotes, doingSnap, NERVE_REFUSED, placeName } from '../agents/game';
import { buildPlayerView } from '../views';
import { passEssence, takeEssence } from '../engine/essence';
import { ES } from '../library/essenceIds';
import { now } from '../time';
import { DU, FU, ZK } from '../library/tableIds';
import { FAKE_STAGES, type FakeStage } from './fakeStages';
import { drawRegion } from '../land/generate';
import { cellsInSight } from '../land/sight';
import { pointAlong } from './mapData';
import { lineLength } from '../land/generate';
import { LM, RK } from '../library/tableIds';
import { deedSendId, type DeedSend } from '../save/sends';

const FAKE_DEEDS = [
  { turn: 3, label: 'Slime Wrangler', wanted: 'drive three slimes off a field without killing one (the slimes fled the field at the guard\'s horn)' },
  { turn: 4, label: 'Lantern Keeper', wanted: 'relight a doused lantern while a foe is in sight (you relit the tavern lantern with the slime at the door)' },
];
const fakeDeedSends = new Map<string, DeedSend>([[deedSendId('fake', { scenario: 1, ...FAKE_DEEDS[0] }), { id: deedSendId('fake', { scenario: 1, ...FAKE_DEEDS[0] }), storyId: 'fake', name: FAKE_DEEDS[0].label, at: '2026-11-10T21:00:00.000Z', verdict: 'approved' }]]);

const NARRATION = [
  'Rain needles the thatch of the Crooked Kettle. The common room smells of wet wool and old ale, and the barkeep watches you over a cup she has been wiping for some time.',
  'You step out past the gate. The field is streaked with silver trails, and something low and glistening shifts in the long grass by the trees.',
  'The slime lurches at you. You bring the round shield across, and the blow slaps wetly against the boards; your counter cuts a long furrow through its body.',
];

/** ?fake=achievements: chains with branches for the Achievements page (BG-215), the tallies of the save it was reported on
 * plus a few more chains, so trunks, branches, every-N rows and scars all show */
function seedAchievements(st: GameState) {
  const fn = (of: string, n: number) => { for (let i = 0; i < n; i++) tally(st, 'outmatched', { by: 'function', of }); };
  for (let i = 0; i < 11; i++) tally(st, 'outmatched');
  fn(FN.influence, 8); fn(FN.sight, 2);
  tally(st, 'spotted'); tally(st, 'spotted', { by: 'function', of: FN.sight });
  for (let i = 0; i < 62; i++) tally(st, 'defeats');
  for (let i = 0; i < 14; i++) tally(st, 'defeats', { by: 'race', of: 'RC1' });
  for (let i = 0; i < 3; i++) tally(st, 'defeats', { by: 'race', of: 'RC2' });
  for (let i = 0; i < 17; i++) tally(st, 'defeats', { by: 'body_type', of: 'BT1' });
  for (let i = 0; i < 6; i++) tally(st, 'speech_won', { by: 'skill', of: SK.persuasion });
  tally(st, 'zones', { to: 31 });
  tally(st, 'deals'); tally(st, 'essences_taken'); tally(st, 'char_level', { to: 20 });
  tally(st, 'defeated', { to: 6 });
  tally(st, 'achievements', { to: 12 });
  const pr = st.player.progression!;
  for (const q of pr.pendingAchievements ?? []) grantAchievement(st, q.key, q.of, q.reached, true, q.turn);
  pr.pendingAchievements = [];
}

/** a canned exchange of blows on the fake page: the player loses health and the right arm, and gains Block, XP and coin */
function fightTurn(st: GameState, out = 'heavy hit'): Partial<LogLine> {
  const p = st.player;
  p.core.condition.hpLostPct = Math.min(99, p.core.condition.hpLostPct + 35);
  p.core.condition.parts.right_arm = -10;
  const blk = p.core.skills[SK.block];
  if (blk) blk.raw += 2; else p.core.skills[SK.block] = { raw: 2, state: 'normal' } as typeof p.core.skills[string];
  if (p.progression) p.progression.xp += 40;
  const purse = p.core.inventory.find((i) => i.itemId === IT.coin);
  if (purse) purse.qty = (purse.qty ?? 1) + 15; else p.core.inventory.push({ id: 'player_coin', itemId: IT.coin, qty: 15 });
  // the late block cost the shield too, so its state on the gear line lands (Q2)
  const lib = getLibrary();
  const shield = p.core.inventory.find((i) => i.equippedIn?.length && lib.items[i.itemId]?.shield);
  if (shield) shield.pools = { ...shield.pools, shield: Math.min(40, (shield.pools?.shield ?? 100) - 60) };
  return {
    text: 'The slime rears and lashes down. You get the shield up late; the blow tears past it and something in your right arm gives with a wet crack. You answer anyway, a heavy cut that opens its side. It sags, steaming, and coins spill from its gut into the grass.',
    check: { kind: 'attack', skill: SK.melee_medium, tier: 'great_success', against: { what: 'slime’s', skill: SK.dodge, tier: 'failure' }, result: `${out}, body` },
    // the hit cards on Play, in the order the blows fell: the slime's on you, then yours
    hits: [{ mine: false, by: 'the slime', target: 'you', weapon: 'slam', result: 'crushing hit, right arm', changes: ['Your right arm is Crippled'] },
      { mine: true, by: 'you', target: 'a slime', weapon: 'arming sword', result: `${out}, body`, changes: ['The slime is Wounded'] }],
    incomingChecks: [{ kind: 'attack', skill: SK.melee_light, tier: 'critical_success', against: { what: 'your', skill: SK.block, tier: 'near_miss' }, result: 'crushing hit, right arm', by: 'the slime' }],
    changes: [{ kind: 'combat', text: 'Slime → you · crushing hit, right arm' }, { kind: 'combat', text: 'You → slime · heavy hit, body' }, { kind: 'condition', text: 'Your right arm is crippled' }],
    wounds: [{ id: 'right_arm', from: 'healthy', to: 'crippled' }], gains: { [SK.block]: 2 }, coin: 15,
  };
}

function robTurn(st: GameState): Partial<LogLine> {
  const purse = st.player.core.inventory.find((i) => i.itemId === IT.coin);
  const took = Math.min(purse?.qty ?? 0, 12);
  if (!purse || !took) return {};
  purse.qty = (purse.qty ?? 1) - took;
  return { coin: -took };
}

// "loot" drops Bren in the common room, turns out what he carries (a search found it) and sets an open chest and a sack by
// him, to show the loot pop-up
function lootTurn(st: GameState): void {
  const p = st.player, g = st.actors.find((a) => a.id === 'guard_1');
  if (!g) return;
  g.zone = p.zone; g.placeId = p.placeId;
  g.core.condition.hpLostPct = 100;
  const add = (itemId: string, qty = 1) => { const it = { id: newInstanceId(), itemId, qty }; g.core.inventory.push(it); return it; };
  const found = [add(IT.bandage), add(IT.healing_draught), add(IT.coin, 14), add(IT.key)];
  p.journal = { ...p.journal!, revealed: [...(p.journal?.revealed ?? []), ...found.map((i) => `item:${i.id}`)] };
  if (!groundIn(st, p.zone).some((i) => i.itemId === IT.chest)) {
    dropOnGround(st, p, { id: newInstanceId(), itemId: IT.chest, open: true, contents: [{ id: newInstanceId(), itemId: IT.lockpicks }, { id: newInstanceId(), itemId: IT.curio }] } as never,
      { id: newInstanceId(), itemId: IT.sack } as never);
  }
}

// "bandage" works at a 40 s bandage 15 s a turn while someone in view spans a crossbow (20 s), to show long actions (AT11a):
// Who's here, the action box and each turn's Actions row
function bandageTurn(st: GameState): Partial<LogLine> {
  const before = doingSnap(buildPlayerView(st));
  const p = st.player, other = st.actors.find((a) => a !== p && a.zone === p.zone && before.has(a.id));
  const step = (a: typeof p, row: string, need: number) => {
    const done = (a.busy?.row === row ? a.busy.done : 0) + 15;
    if (a.busy?.row === row && done >= need) { delete a.busy; return; }
    if (!a.busy || a.busy.row === row) a.busy = { row, key: row, order: { type: 'use_item', target: null, item: null }, done, need, turn: st.turn };
  };
  step(p, DU.bandage, 40);
  if (other && (other.busy || !p.busy || p.busy.done <= 15)) step(other, DU.span_crossbow, 20);
  const actions = actionNotes(st, before, doingSnap(buildPlayerView(st)));
  return actions.length ? { actions } : {};
}

function levelTurn(st: GameState): Partial<LogLine> {
  const p = st.player, c = p.core.classes[0];
  if (!c || !p.progression) return {};
  c.level += 1;
  p.progression.xp = 20;
  p.progression.unspentPerkPoints += 1;
  return { levelUps: [{ classId: c.classId, level: c.level }] };
}

/** grants achievements through the engine and returns them as the turn line carries them */
function earnTurn(st: GameState, keys: string[]): Partial<LogLine> {
  const pr = st.player.progression;
  const had = new Set((pr?.achievements ?? []).map((a) => a.id));
  for (const k of keys) grantAchievement(st, k, undefined, 1);
  return { achievements: (pr?.achievements ?? []).filter((a) => !had.has(a.id)).map((a) => achievementInfo(st, a)) };
}

/** "end" ends the scenario with a full set of gains, to show the scenario-end gains moment (D-226) */
function endTurn(st: GameState): Partial<LogLine> {
  const p = st.player;
  const raise = (k: string, by: number) => { const sk = p.core.skills[k]; const from = sk?.raw ?? 0; if (sk) sk.raw += by; else p.core.skills[k] = { raw: by, state: 'normal' } as typeof p.core.skills[string]; return { skill: k, from, to: from + by }; };
  const skills = [raise(SK.melee_medium, 3), raise(SK.block, 4), raise(SK.dodge, 2)];
  const fromLevel = p.core.classes[0]?.level ?? 1;
  const lvl = levelTurn(st);
  const earned = earnTurn(st, [ACH.flawless_1, ACH.brink_1]);
  const parts: XpPart[] = [{ kind: 'defeat', label: '3 foes defeated', amount: 90 }, ...(earned.achievements ?? []).map((a) => ({ kind: 'achievement' as const, label: a.name, amount: 25 })),
    { kind: 'quest', label: 'Clear the cellar for the barkeep', amount: 40 }];
  const scenarioGains: NonNullable<LogLine['scenarioGains']> = {
    skills, perks: [{ skill: SK.block, milestone: 20 }], allPerks: [{ tree: 'TR1', step: 50, name: 'All-50: Melee' }],
    achievements: earned.achievements ?? [], xp: { gained: parts.reduce((n, x) => n + x.amount, 0), fromLevel, fromPct: 62, toLevel: fromLevel + 1, toPct: 30, parts }, levelUps: lvl.levelUps ?? [],
    essences: [{ name: 'Gel Patience', grade: 'fine' }],
  };
  const closing = 'The cellar is quiet now, and the job is done.';
  (p.progression!.gainsLog ??= []).push({ ...scenarioGains, number: st.stage.scenarioNumber ?? 1, ending: 'resolved', endTurn: st.turn, closing });
  st.stage.scenarioNumber = (st.stage.scenarioNumber ?? 1) + 1;
  return {
    text: 'Dawn finds you on the far bank. The new road climbs west toward a town you have only heard of.',
    scenarioEnd: { as: 'resolved', name: 'resolved', closing },
    scenarioGains,
  };
}

export const validateBuildLocal = (b: CreationBuild): string[] => validateBuild(b);

// the fake world for the Map page: a village, the tavern inside it and the field east of it (the cellar and the north road
// unexplored). Each title is listed by its ways, as the Weaver hands one over, and drawn on the plan by the game's own code
type FakeWay = [to: string, label: string, kind?: WayKind, frontier?: true];
const FZ = (id: string, placeId: string, name: string, look: string, ways: FakeWay[], extra: Partial<TitleSpec> = {}): TitleSpec =>
  ({ id, placeId, name, look, ways: ways.map(([to, label, kind = 'open', frontier]) => ({ to, label, kind, ...(frontier ? { frontier } : {}) })), light: 'dim', roof: true, ...extra });
const FP = (id: string, kind: string, parentId: string | null, name: string): GameState['places'][number] =>
  ({ id, storyId: 'fake', kind, parentId, names: { current: name, past: [] }, zones: [], state: {}, headlines: [] });
const OUT = { roof: false, light: 'bright' } as const;
const FAKE_PLACES = (): GameState['places'] => [FP('village', 'village', null, 'Millbrook'), FP('ashford', 'village', null, 'Ashford'), FP('west_road', 'road', null, 'the west road'),
  FP('tavern', 'tavern', 'village', 'the Crooked Kettle'), FP('field', 'field', 'village', 'the slime field')];
const FAKE_TITLES = (): TitleSpec[] => [
  FZ('v_square', 'village', 'village square', 'A muddy square around a well, with the tavern sign creaking over it.', [['tav_common', 'the Kettle’s front door', 'door'], ['field_edge', 'the east lane'], ['w_road', 'the west road']], { ...OUT, area: 1600 }),
  FZ('ash_gate', 'ashford', 'Ashford gate', 'A timber gate in a low wall, a day’s walk west of Millbrook.', [['w_road', 'the east road'], ['f_ash', 'the market, north', 'open', true]], { kind: ZK.gate,  ...OUT, area: 25, aspect: 2 }),
  // the west road, a day's walk (30 km) of real road from Millbrook's square to Ashford's gate, so the World shows the two
  // villages that far apart (CO9); "travel" sets you partway along it
  FZ('w_road', 'west_road', 'the west road', 'A rutted cart road between hedges.', [['v_square', 'Millbrook, east'], ['ash_gate', 'Ashford, west']], { ...OUT, ...roadShape('day', 'quiet') }),
  FZ('tav_common', 'tavern', 'common room', 'A low room with a hearth, benches and a scarred counter.', [['tav_kitchen', 'the kitchen door, west', 'door'], ['v_square', 'out the front door, south', 'door'], ['tav_yard', 'the back door, east', 'door'], ['tav_upstairs', 'the stairs up', 'up']],
    { kind: ZK.room, area: 64, furniture: [{ kind: FU.counter, name: 'scarred counter', at: 'n' }, { kind: FU.hearth, name: 'hearth', at: 'w' }, { kind: FU.table, name: 'long table' }, { kind: FU.bench, name: 'bench', at: 'se' }, { kind: FU.barrels, name: 'ale barrels', at: 'ne' }] }),
  FZ('tav_kitchen', 'tavern', 'kitchen', 'Copper pots, a long table and the smell of onions.', [['tav_common', 'the common room, east', 'door'], ['tav_cellar', 'the cellar hatch, down', 'down']], { area: 25 }),
  FZ('tav_yard', 'tavern', 'back yard', 'A walled yard of firewood and a rain barrel.', [['tav_common', 'the back door, west', 'door'], ['f_lane', 'the gate to the lane', 'open', true]],
    { kind: ZK.yard, roof: false, light: 'dim', area: 150, walls: { n: WK.low, e: WK.low, s: WK.low, w: WK.wall }, furniture: [{ kind: FU.woodpile, name: 'woodpile', at: 'nw' }, { kind: FU.water_barrel, name: 'rain barrel', at: 'sw' }, { kind: FU.cart, name: 'hand cart', at: 'e' }] }),
  FZ('tav_upstairs', 'tavern', 'upstairs landing', 'A narrow landing with three doors.', [['tav_common', 'the stairs down', 'down']], { kind: ZK.corridor,  light: 'dark', area: 9, aspect: 2 }),
  FZ('tav_cellar', 'tavern', 'cellar', 'A damp cellar of barrels.', [['tav_kitchen', 'the hatch, up', 'up']], { light: 'dark', area: 60 }),
  FZ('field_edge', 'field', 'field edge', 'Long grass streaked with silver trails.', [['v_square', 'the lane back west'], ['field_mid', 'into the field, north']], { kind: ZK.field,  ...OUT, area: 1600 }),
  FZ('field_mid', 'field', 'middle of the field', 'Trampled grass around a shallow pond.', [['field_edge', 'the field edge, south'], ['f_trees', 'the trees, east', 'open', true]], { kind: ZK.field,  ...OUT, area: 1600 }),
];
/** code draws every fake title on the plan, as applyStagePlan does for real ones */
function drawFake(st: GameState): void { st.places = FAKE_PLACES(); drawTitles(st, FAKE_TITLES()); }
/** moves every title and plan record of the world by (dx, dy) metres */
function shiftWorld(st: GameState, dx: number, dy: number): void {
  const m = <T extends { x: number; y: number }>(q: T): T => ({ ...q, x: q.x + dx, y: q.y + dy });
  for (const z of st.zones) { z.outline = z.outline.map(m); if (z.line) z.line = z.line.map(m); }
  for (const w of st.walls) { w.a = m(w.a); w.b = m(w.b); }
  for (const o of st.openings) { o.at = m(o.at); if (o.to) o.to = m(o.to); }
  for (const r of st.roofs) r.outline = r.outline.map(m);
  for (const l of st.lights) l.at = m(l.at);
  for (const f of st.furniture) f.pos = m(f.pos);
  for (const i of st.ground) if (i.at) i.at = m(i.at);
}
/** the opening between two titles (either way round) */
const wayBetween = (st: GameState, a: string, b: string) => st.openings.find((o) => (o.joins[0] === a && o.joins[1] === b) || (o.joins[0] === b && o.joins[1] === a));

/** WZ1/WZ4: the fake world's land, one region drawn from a fixed seed (drawn once: it takes about a second). Millbrook stands
 *  on its village site, the mill road runs along a road line out of it, and the player has made out the land around the
 *  village and along that road, so the World shows land, roads and you */
let fakeRegion: import('../types').Region | undefined;
function fakeLand(st: GameState): void {
  const r = structuredClone(fakeRegion ??= drawRegion('rg_fake', 0, 0, 2007, {
    kind: RK.river_valley, name: 'the Wend valley', look: '', river: { name: 'the Wend' },
    settlements: [{ size: 'village', name: 'Millbrook', look: '', where: 'river' }, { size: 'town', name: 'Marbury', look: '', where: 'crossing' },
      { size: 'village', name: 'Thornbury', look: '' }, { size: 'hamlet', name: 'Hob End', look: '' }, { size: 'hamlet', name: 'Sallow', look: '', where: 'woods' }],
    features: [{ kind: LM.mill, name: 'the old mill', look: '', where: 'river' }, { kind: LM.ruin, name: 'the burnt tower', look: '', where: 'hill' }],
  }));
  const site = r.sites.find((x) => x.name === 'Millbrook')!, sq = middle(st.zones.find((z) => z.id === 'v_square')!);
  // the fake places keep their shapes and move as one, so the village square sits on its site
  shiftWorld(st, site.at.x - sq.x, site.at.y - sq.y);
  site.placeId = 'village';
  st.places.find((p) => p.id === 'village')!.site = site.id;
  // the longest road line out of Millbrook, as the mill road's zone
  const node = r.nodes.find((n) => n.site === site.id)!;
  const line = r.roads.filter((x) => x.ends.includes(node.id)).sort((a, b) => b.length - a.length)[0];
  const pts = line.ends[0] === node.id ? line.pts : [...line.pts].reverse();
  if (pts !== line.pts) line.ends = [line.ends[1], line.ends[0]];
  line.pts = pts; line.zone = 'm_road';
  st.places.push(FP('mill_road', 'road', null, 'the mill road'));
  drawTitles(st, [FZ('m_road', 'mill_road', 'the mill road', 'A cart track along the valley, rutted where the mill carts go.', [['v_square', 'back to Millbrook'], ['m_road_far', 'on along the road', 'open', true]],
    { ...OUT, road: line.id, line: pts.map((q) => ({ ...q })) })]);
  // what the character has made out: the land round the village, and along the road as far as they have walked it
  const N = Math.round(r.size / r.cell), bits = new Uint8Array(Math.ceil((N * N) / 8));
  const look = (at: { x: number; y: number }, range: number) => { for (const i of cellsInSight(r, at, CONFIG.LAND_EYE_M, range)) bits[i >> 3] |= 1 << (i & 7); };
  look(site.at, 3000);
  for (let m = 0; m <= line.length * 0.6; m += 400) look(pointAlong(pts, m), 1500);
  st.regions = [r];
  (st.player.journal!.landSeen ??= {})[r.id] = btoa(String.fromCharCode(...bits));
  st.player.journal!.zonesSeen!.push('m_road');
}

/** barriers on the fake map's exits, so the Map shows its marks: the kitchen door (locked, tried), the back door (barred
 *  from the yard, tried), the front door (locked, the player holds its key) and the yard gate to the lane (blocked) */
function fakeBarriers(st: GameState): void {
  const put = (id: string, a: string, b: string, rec: Omit<import('../types').Barrier, 'id'>) => {
    (st.barriers ??= {})[id] = { id, ...rec };
    const o = wayBetween(st, a, b);
    if (o) o.barrier = id;
  };
  put('fb_kitchen', 'tav_common', 'tav_kitchen', { kind: BK.door, grade: 'moderate', lock: { locked: true }, tried: [st.player.id] });
  put('fb_back', 'tav_common', 'tav_yard', { kind: BK.door, grade: 'minor', bar: { side: 'tav_yard', drawn: true }, tried: [st.player.id] });
  put('fb_front', 'tav_common', 'v_square', { kind: BK.door, grade: 'minor', lock: { locked: true } });
  put('fb_lane', 'tav_yard', 'f_lane', { kind: BK.gate, grade: 'minor', blocked: true });
  st.player.core.inventory.push({ id: 'fake_key', itemId: IT.key, qty: 1, opens: ['fb_front'] } as typeof st.player.core.inventory[number]);
}

/** MAP-52: swap the fake world for a map test stage: its places, where you stand, what you know and who is about */
function useStage(st: GameState, stage: FakeStage): void {
  const p = st.player;
  st.places = stage.places;
  Object.assign(st, structuredClone(stage.plan)); // its titles and floor plan
  st.mode = 'explore';
  st.pending = { ...st.pending!, mode: 'explore', engaged: [] };
  p.zone = stage.zone; p.placeId = stage.placeId;
  p.journal = { ...p.journal!, zonesSeen: stage.seen, trail: stage.trail.map((zone, i) => ({ zone, left: st.turn - 1 - i })), clearSight: {} };
  const at = (id: string, d: [number, number]) => { const z = st.zones.find((q) => q.id === id); if (!z?.outline.length) return undefined; const c = middle(z); return { x: c.x + d[0], y: c.y + d[1] }; };
  p.pos = at(stage.zone, stage.you);
  st.actors = stage.people.map((x) => {
    const zone = st.zones.find((z) => z.id === x.zone)!;
    const a = spawnNpc(null, TP.patron, { id: x.id, zone: x.zone, placeId: zone.placeId, bandId: `band_${x.id}`, storyId: 'fake', label: x.label });
    const pos = x.at ? at(x.zone, x.at) : undefined;
    if (pos) a.pos = pos;
    if (x.race) { a.core.raceId = x.race; a.core.bodyTypeId = getLibrary().races![x.race].bodyTypeId; }
    if (x.facing) a.facing = x.facing;
    const last = x.last === 'zone' ? undefined : x.last && at(x.zone, x.last);
    if (x.last) (p.journal!.lastKnown ??= {})[x.id] = x.zone;
    if (last) (p.journal!.lastSpot ??= {})[x.id] = { ...last, floor: zone.floor };
    return a;
  });
  st.hidden.plans = {}; st.hidden.agreements = []; st.quests = [];
  for (const t of stage.things ?? []) {
    const pos = at(t.zone, t.at), z = st.zones.find((q) => q.id === t.zone);
    if (pos && z) st.ground.push({ id: t.id, itemId: t.itemId, at: { ...pos, floor: z.floor }, ...(t.locked ? { lock: { locked: true } } : {}) });
  }
  st.barriers ??= {}; // the plan's plain doors (BG-355)
  for (const b of stage.barriers) {
    st.barriers[b.id] = { id: b.id, ...b.rec, ...(b.rec.tried ? { tried: [p.id] } : {}) };
    const o = wayBetween(st, b.a, b.b);
    if (o) { if (o.barrier) delete st.barriers[o.barrier]; o.barrier = b.id; }
  }
}

export function createFakeGame(opts: { autoStart?: boolean; fell?: boolean; notices?: Notice[]; banner?: boolean; stage?: string; achievements?: boolean; band?: boolean } = {}): GameApi {
  let state: GameState | null = null;
  let lines: LogLine[] = [];
  const KETTLE = { id: 'tavern', name: 'The Crooked Kettle' };
  const placeOf = (st: GameState) => ({ id: st.player.placeId, name: placeName(st) });
  let busy = false, fell = !!opts.fell, n = 0, asks = 0;
  let ending: import('../types').ScenarioEndNote | null = null;
  const notices: Notice[] = opts.notices ?? [];
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((f) => f());

  function start(b: CreationBuild) {
    const player = playerFromBuild(b, 'fake', 'tav_common', 'tavern');
    player.journal = { ...(player.journal ?? { secretsKnown: [], factsWitnessed: [], remembered: {}, namesKnown: [] }), zonesSeen: ['ash_gate', 'w_road', 'v_square', 'field_edge', 'field_mid', 'tav_common', 'tav_kitchen', 'tav_yard', 'tav_upstairs'], clearSight: { slime_1: 'field_mid' } };
    const settings = defaultSettings();
    const slime = spawnNpc(null, TP.slime, { id: 'slime_1', zone: 'field_mid', placeId: 'field', bandId: 'slimes', storyId: 'fake', name: 'slime' });
    slime.mind!.knowledge = { player: { status: 'aware', lastKnownZone: 'field_edge', lastSeenTurn: 2, source: 'seen', revealed: [] } };
    const guard = spawnNpc(null, TP.guard, { id: 'guard_1', zone: 'tav_common', placeId: 'tavern', bandId: 'village_watch', storyId: 'fake', name: 'Bren' });
    state = {
      storyId: 'fake', turn: 4, mode: 'tactical', zones: [], walls: [], openings: [], roofs: [], lights: [], furniture: [], ground: [], player, actors: [slime, guard], bands: [], events: [],
      hidden: { plans: { slime_1: { goal: 'drive the stranger off the field', steps: ['slam', 'retreat to the trees'], triggers: [], createdTurn: 2 } }, memory: {}, secrets: [], firedLog: [], agreements: [{ id: 'ag_1', parties: ['player', 'guard_1'], text: 'He lets you back in after dark; you tell him if you see the thief.', madeTurn: 2, madeBy: 'guard_1' }], weaverNote: 'the slimes are fleeing something in the woods',
        // AA-108: deed ideas for the GM view's Wanted list (the first one already approved in the fake send list)
        templateWants: [{ turn: 2, scenario: 1, actorId: 'player', label: 'a travelling tinker', wanted: 'someone to mend the broken lantern', template: 'patron' },
          ...FAKE_DEEDS.map((d) => ({ turn: d.turn, scenario: 1, actorId: 'player', label: d.label, wanted: d.wanted, template: '', of: 'deed' as const }))], stage: { eventSummary: 'slimes trouble the village', challenge: 'moderate', gain: 'minor', hiddenTerms: ['woods_beast'] } },
      agentLog: [{ turn: 3, agent: 'narrator', input: { view: 'NarrationView…' }, output: { text: NARRATION[2] }, status: 'ok', errors: [], modelTierApplied: 'complex' } as GameState['agentLog'][number],
        { turn: 3, agent: 'parser', input: { text: 'block and cut back' }, output: { intent: 'attack', target: 'slime_1' }, status: 'ok', errors: [], modelTierApplied: 'quick' } as GameState['agentLog'][number],
        { turn: 3, agent: 'voice', actorId: 'guard_1', input: { view: 'DialogueView…', heard: 'block and cut back' }, output: { dialogue: { line: 'That’s one! Watch your left!' } }, status: 'ok', errors: [], modelTierApplied: 'quick' } as GameState['agentLog'][number]],
      log: [{ turn: 3, code: 'planner_late' }, { turn: 3, code: 'skill_improved', detail: { skill: SK.block, from: 37, to: 40, milestone: 40 } }], rngSeed: 1, rngState: 1, pending: { turn: 3, mode: 'tactical', engaged: ['slime_1'], fired: [] },
      places: [], facts: [], stage: { tier: 'success', scenarioNumber: 2, scenarioStartTurn: 2, ...(opts.banner ? { fallback: { reason: 'Scenario planning failed: placeholder area', turn: 2 } } : {}) },
      scenarioCaps: { promotions: 0, minted: 0 }, clocks: {},
      quests: [
        { id: 'q0', state: 'done', text: 'Find a bed for the night', giver: 'guard_1', dealId: 'deal_0', goal: { kind: 'other' }, progress: 0, level: 'zero', startTurn: 1, endTurn: 2 },
        { id: 'q1', state: 'active', text: 'Clear the slimes from the field', giver: 'guard_1', dealId: 'ag_1', goal: { kind: 'defeat', by: 'race', of: slime.core.raceId!, count: 3, noun: 'slimes' }, progress: 1, level: 'i', startTurn: 2, after: 'q0', pay: { coin: 10 }, paid: { coin: 0, qty: 0 }, due: 3 * 1440 + 1080, dueBy: 'dusk' },
      ],
      settings, libraryVersion: 1, blueprints: [{ storyId: 'fake', id: `${IT.short_sword}_m2_1`, kind: 'item', data: { id: `${IT.short_sword}_m2_1`, kind: 'weapon', name: 'Wim’s old blade', look: 'a notched short sword with a wire-bound grip', base: { itemId: IT.short_sword, quality: 'fine' } } }], meta: { storyId: 'fake', title: 'The slime field', schemaVersion: CONFIG.SCHEMA_VERSION, createdAt: '2026-11-07', settings },
    };
    if (player.progression) { player.progression.marks = [SK.dodge, SK.eyesight]; player.progression.unspentPerkPoints = 1; }
    drawFake(state);
    fakeBarriers(state);
    if (opts.achievements) seedAchievements(state);
    // ?fake=band: two band-mates, one beside you (hurt and uneasy) and one last seen in the yard (YB2 to YB4)
    if (opts.band) {
      const mira = spawnNpc(null, TP.patron, { id: 'mate_1', zone: 'tav_common', placeId: 'tavern', bandId: player.bandId, storyId: 'fake', name: 'Mira' });
      const kael = spawnNpc(null, TP.patron, { id: 'mate_2', zone: 'tav_yard', placeId: 'tavern', bandId: player.bandId, storyId: 'fake', name: 'Kael' });
      mira.core.condition.hpLostPct = 45; mira.core.condition.moraleLost = 12;
      state.actors.push(mira, kael);
      player.journal!.clearSight = { ...player.journal!.clearSight, mate_1: 'tav_common', mate_2: 'tav_yard' };
      player.journal!.namesKnown = [...(player.journal!.namesKnown ?? []), 'mate_1', 'mate_2'];
    }
    // KT18: an unknown ?stage= name fails loudly, so the Map's browser check never passes on the default page
    if (opts.stage && !FAKE_STAGES[opts.stage]) throw new Error(`unknown test stage: ${opts.stage}`);
    const stage = opts.stage ? FAKE_STAGES[opts.stage] : undefined;
    if (stage) useStage(state, stage());
    else fakeLand(state);
    // where people stand in the common room (Actor.pos), so the to-scale Map shows each at their own point
    const commonZ = state.zones.find((z) => z.id === 'tav_common'), common = commonZ?.outline.length ? boxOf(commonZ.outline) : undefined;
    if (common) { player.pos = { x: common.x - common.w / 4, y: common.y - common.d / 4 }; guard.pos = { x: common.x + common.w / 3, y: common.y + common.d / 5 }; }
    // BG-313: the ground you know is remembered whole on the Map's fog
    const known = (player.journal?.zonesSeen ?? []).map((id) => zoneById(state!, id)!).filter(Boolean);
    seeWhole(state, known);
    seeSquares(state, known); // MAP-33: and what of it is in sight from where you stand
    // a little move time carried from last turn (TP4)
    if (state.mode === 'tactical') player.carry = [{ main: 0, move: 2.4, turn: state.turn - 1 }];
    player.core.inventory.push({ id: 'player_draught', itemId: IT.healing_draught, qty: 2 }, { id: 'player_draught_2', itemId: IT.healing_draught, qty: 1 }, { id: 'player_bandage', itemId: IT.bandage, qty: 2 },
      { id: 'player_shield', itemId: IT.round_shield, qty: 1, equippedIn: ['grip:left_arm'], pools: { shield: 70 } }); // the shield the story says you raise
    // a sack carried in the pack, with a dagger, a bandage and a smaller sack inside it, to show containers on the Inventory (CT1)
    player.core.inventory.push({ id: 'player_sack', itemId: IT.sack, qty: 1, contents: [{ id: 'sack_dagger', itemId: IT.dagger, qty: 1 }, { id: 'sack_bandage', itemId: IT.bandage, qty: 1 },
      { id: 'sack_inner', itemId: IT.sack, qty: 1, contents: [{ id: 'inner_draught', itemId: IT.healing_draught, qty: 1 }] }] });
    // Varo's Loop worn and bound, one power awake (its first deed earned), to show a Threadbound item's sealed powers
    // a Street Instinct essence waiting on offer, to show the offer pop-up and the Character page's Essences section
    if (player.progression) player.progression.essenceOffers = [{ essence: ES.street_instinct, grade: 'common', points: { [SK.dodge]: 1, [SK.insight]: 1 }, turn: 2, source: 'foe', untilMin: now(state) + 240 }];
    player.core.inventory.push({ id: 'player_loop', itemId: IT.varos_loop, qty: 1, boundTo: player.id });
    if (player.progression) (player.progression.achievements ??= []).push({ id: 'fake_ach_loop', key: ACH.event_crit_1, turn: 2 });
    player.core.condition.hpLostPct = 10; // healed from Hurt to Bruised on turn 3
    player.core.condition.fatigue = { debt: 6, line: 8 }; // a long day's walk and the fight with the slime (FT20)
    guard.core.condition.fatigue = { debt: barMax(guard) * 0.62, line: 0 }; // Bren stood the night watch and has not slept: Exhausted, so Who's here shows it (FT17)
    lines = [
      { turn: 1, kind: 'narration', text: NARRATION[0], place: KETTLE, scenario: 1 },
      { turn: 2, kind: 'player', text: 'I head out through the gate to the field' },
      { turn: 2, kind: 'narration', text: NARRATION[1], place: KETTLE, scenario: 2, gear: ['Now held: right hand · Arming sword', 'Now held: left hand · Round shield'] },
      { turn: 3, kind: 'player', text: 'I raise my shield and cut back at it', aimed: true },
      { turn: 3, kind: 'narration', text: NARRATION[2], place: KETTLE, scenario: 2,
        check: { kind: 'attack', skill: SK.melee_medium, tier: 'great_success', against: { what: 'slime’s', skill: SK.dodge, tier: 'success' }, result: 'full hit, body' },
        speech: [{ speaker: 'a gate guard', volume: 'shout', text: 'That’s one! Watch your left!' }],
        heals: [{ source: HL.bandage, from: 'hurt', to: 'bruised', parts: [{ id: 'left_leg', from: 'damaged', to: 'healthy' }] }],
        unlocks: [{ skill: SK.block, milestone: 40 }], gains: { [SK.block]: 3 },
        incomingChecks: [{ kind: 'attack', skill: SK.melee_light, tier: 'great_success', against: { what: 'your', skill: SK.block, tier: 'success' }, result: 'blocked, shield', by: 'the slime' }],
        changes: [{ kind: 'combat', text: 'Slime → you · blocked, shield' }, { kind: 'combat', text: 'You → slime · full hit, body' }, { kind: 'health', text: 'You are Bruised' }],
        mechanics: ['Slime slam: d100 71 + 30×0.5 + 10 → Great Success', 'Your block: d100 64 + 65×0.5 → Success · gap −1 · blocked (shield 30 → 18)', 'Your cut: d100 82 + 75×0.5 → Great Success · dodge 0 · full hit · 25 damage to body'] },
    ];
  }
  if (opts.autoStart) start({ name: 'Aldric', skills: { [SK.melee_medium]: 50, [SK.parry]: 40, [SK.dodge]: 30, [SK.endurance]: 50, [SK.eyesight]: 30, [SK.earshot]: 30, [SK.riposte]: 20, [SK.resolve]: 45 }, tagged: [SK.melee_medium, SK.parry, SK.endurance], flawed: [SK.persuasion, SK.barter, SK.sneaking],
    personality: { nerve: 40, traits: { [PA.honesty]: 50, [PA.pride]: 25, [PA.sociability]: -30 }, values: [VL.duty, VL.freedom] } });

  return {
    state: () => state,
    lines: () => lines,
    notices: () => notices,
    busy: () => busy,
    scenarioEnding: () => ending,
    fell: () => fell,
    subscribe(cb) { subs.add(cb); return () => subs.delete(cb); },
    validateBuild: validateBuildLocal,
    async newStory(b) { start(b); emit(); },
    async resume() { return state !== null; },
    async hallOfFame() {
      return [{ name: 'Aldric', pronouns: 'he', title: 'Slime-Bane', classes: [{ name: 'Swordsman', level: 6 }], level: 6, owner: 'player' as const, storyId: 'story_fake',
        skills: [{ name: 'Medium weapons', value: 58 }, { name: 'Parry', value: 47 }, { name: 'Endurance', value: 50 }, { name: 'Dodge', value: 31 }],
        perks: ['Keen Ear', 'Turn the Blade'], achievements: ['First Blood', 'Slime-Bane'], scars: ['First Crack'], defeats: 12, turn: 48, day: 3,
        place: 'The back yard · The Lantern & Ladle', downedBy: { by: 'a lanky youth', weapon: 'dagger', part: 'neck', outcome: 'crushing hit' }, card: { combat: 'rank_2', achievements: 'rank_1', reputation: 'rank_1' }, fellAt: '2026-11-10T21:00:00.000Z' }];
    },
    async sendHero(storyId: string) { return { id: `unique_${storyId}` }; },
    async fallenSheet() { return state ? { ...structuredClone(state), meta: { ...state.meta, archivedAt: '2026-11-10T21:00:00.000Z' } } : null; },
    async sendBlueprint(id: string) { return { id: `item_story_fake_${id}` }; },
    async librarySends() { return []; },
    async deedSends() { return [...fakeDeedSends.values()]; },
    async markDeedsSent(ideas) { for (const w of ideas) { const id = deedSendId('fake', w); fakeDeedSends.set(id, { id, storyId: 'fake', name: w.label, at: '2026-11-10T21:00:00.000Z' }); } },
    async clearRuledDeeds() { const ruled = [...fakeDeedSends.values()].filter((d) => d.verdict && !d.cleared); for (const d of ruled) d.cleared = true; return ruled.length; },
    async worlds() { return [{ worldId: 'story_fake', name: 'Aldric’s world', lastStoryId: 'story_fake', day: 3, past: [{ name: 'Aldric', fell: true }], threadbound: [IT.varos_loop] }]; },
    async titleWorld() {},
    async reportBug() { return 'new-1'; },
    async openBugs() { return [{ id: 'BG-12', code: 'player_report', storyId: 'story_fake', turn: 4, status: 'open' as const, at: Date.now(), note: 'Walking to the back of the cellar did nothing.' }]; },
    // guided mode: every other move is a question (screenshots and UI checks)
    async agentMove(_persona, _style, guided) {
      if (guided?.answered) return { command: 'I talk to the barkeep.', say: 'Okay, your way!' };
      if (guided && (guided.mustAsk || ++asks % 2)) return { command: '', say: 'The barkeep offers a job: clear the cellar for 5 silver. Take it?', ask: { kind: guided.mustAsk?.kind ?? 'deal', about: `the barkeep ${asks}`, choices: ['I take the job.', 'I turn it down.', 'I ask for more.'], pick: 0 } };
      return { command: 'I look around.', say: '<sigh> Getting my bearings first. The room is quiet, too quiet, and I do not like it.', direction: 'calm, a little curious' };
    },
    async act(order, o) { return this.submit(order.line, o); }, // the fake reads only the line
    async submit(text, o) {
      if (busy || !state) return;
      // numbered like the game: the turn's lines carry state.turn, then the turn advances; /undo steps back one
      const t = state.turn;
      // 2.5: /essence take N [give M] and /essence pass N run the real rules, like the game's command (no turn)
      const ess = /^\/essence (take|pass) (\d+)(?: give (\d+))?$/i.exec(text);
      if (ess) {
        const err = ess[1].toLowerCase() === 'take' ? takeEssence(state, Number(ess[2]) - 1, true, ess[3] ? Number(ess[3]) - 1 : undefined) : passEssence(state, Number(ess[2]) - 1);
        lines = [...lines, { turn: t, kind: 'command', text }, { turn: t, kind: 'command', text: err ?? (ess[1].toLowerCase() === 'take' ? 'Taken. It is part of you now.' : 'You let it go.') }];
        emit(); return;
      }
      if (text === '/undo') { fell = false; state.turn = Math.max(1, t - 1); lines = [...lines, { turn: state.turn, kind: 'command', text: 'Turn undone.' }]; emit(); return; }
      lines = [...lines, { turn: t, kind: text.startsWith('/') ? 'command' : 'player', text, ...(o?.aimed ? { aimed: true } : {}) }];
      busy = true;
      if (/^end\b/i.test(text)) ending = { as: 'resolved', name: 'resolved' }; // the ending's rule draws while the turn runs (SD1)
      emit();
      // NB5: with a broken nerve a punch is turned away before the turn, as the game does (no time passes)
      if (/^(i )?punch\b/i.test(text) && isBrokenLevel(moraleLevel(state.player))) { lines = [...lines, { turn: t, kind: 'clarify', text: NERVE_REFUSED }]; busy = false; emit(); return; }
      // "punch the man": the game asks back which man, naming the guard and the field, to show the tappable names (no turn)
      if (/^(i )?punch the man\b/i.test(text)) { lines = [...lines, { turn: t, kind: 'clarify', text: 'Which man do you mean to punch: the village guard by the door, or do you mean the slime?' }]; busy = false; emit(); return; }
      await new Promise((r) => setTimeout(r, 600));
      ending = null;
      const ended = /^end\b/i.test(text) ? endTurn(state) : null;
      // "door" tries and opens doors, to show the play screen's Way rows
      const ways = /^door\b/i.test(text) ? { ways: ['Door to kitchen: locked', 'Door to back yard: barred from the other side', 'Door to village square: unlocked with your key on the way through'] } : null;
      state.turn = t + 1;
      if (/^sneak\b/i.test(text)) state.player.posture = 'stealthy'; // shows the stealthy badge and bar
      const drop = /^charge\b/i.test(text); // "charge" drops the player, to show the fall on the fake page
      if (drop) fell = true;
      // "attack" trades blows, to show the play screen's motion: health and a crippled arm lost, a skill, XP and coin gained
      // "attack" lands a heavy hit; "attack hard" a crushing one and "attack light" a full one, to show the hit cards' tiers
      const hurt = /^attack\b/i.test(text) ? fightTurn(state, /hard/i.test(text) ? 'crushing hit' : /light/i.test(text) ? 'full hit' : 'heavy hit') : null;
      // "travel" sets you partway along the west road, to show your point on the road on the Map (TV7); "travel mill" on the
      // mill road, a road bound to the land (WZ1)
      const mill = state.places.find((x) => x.id === 'mill_road')?.zones[0], line = mill?.road && state.regions?.[0]?.roads.find((x) => x.id === mill.road);
      if (/^travel mill\b/i.test(text) && mill && line) {
        state.player.zone = mill.id; state.player.placeId = mill.placeId;
        state.player.pos = pointAlong(line.pts, line.length * 0.45);
      } else if (/^travel\b/i.test(text)) {
        const road = state.places.find((x) => x.id === 'west_road')!.zones[0];
        state.player.zone = road.id; state.player.placeId = road.placeId;
        if (road.line) state.player.pos = pointAlong(road.line, lineLength(road.line) * 0.4);
        (state.player.journal?.zonesSeen ?? []).push(road.id);
      }
      // "fear" drops the player's morale to the next level down (Terrified, Panicking, Broken), and "calm" brings back a quarter,
      // to show the nerve's warning on the play screen (MW1–MW3)
      const wasBroken = isBrokenLevel(moraleLevel(state.player));
      if (/^(fear|calm)\b/i.test(text)) {
        const p = state.player, max = maxMorale(p), lostPct = (100 * (p.core.condition.moraleLost ?? 0)) / max;
        const next = CONFIG.MORALE_TRACK.find(([, at]) => at > lostPct + 0.001)?.[1] ?? 100;
        setMoraleLost(p, /^fear/i.test(text) ? (Math.min(100, next) / 100) * max : (p.core.condition.moraleLost ?? 0) - max / 4);
      }
      // the turn "fear" breaks the nerve shows the Nerve broken card; "punch" while Broken is refused (MB12)
      const nerve = !wasBroken && isBrokenLevel(moraleLevel(state.player)) ? { nerveBroke: true as const } : null;
      // "rob" has a pickpocket lift coin from the purse, to show the Coin row and the sheet's coin losing it
      const robbed = /^rob\b/i.test(text) ? robTurn(state) : null;
      if (/^loot\b/i.test(text)) lootTurn(state);
      const bandaged = /^bandage\b/i.test(text) ? bandageTurn(state) : null;
      // "walk" leaves a walk to the upstairs landing still on its way, to show the move order in the action box and on the Map
      // (AT49); "stop" ends it
      if (/^walk\b/i.test(text)) {
        state.player.walking = { toZone: text.split(/\s+/)[1] || 'tav_upstairs' };
      }
      if (/^stop\b/i.test(text)) { delete state.player.walking; delete state.player.followLost; }
      // "follow" has you following Bren up to the landing (BG-190); "lose" loses him there, slipped out of sight
      if (/^follow\b/i.test(text)) {
        delete state.player.followLost;
        state.player.walking = { toZone: 'tav_upstairs', spot: { near: 'guard_1', follow: true } };
      }
      if (/^lose\b/i.test(text)) { delete state.player.walking; state.player.followLost = { who: 'guard_1', why: 'slipped_away', zone: 'tav_upstairs' }; }
      // "tire" adds sleep debt (a fatigue level's worth) and spends half the breath line; "breathe" fills the line again, to
      // show the stamina bar (FT20)
      if (/^tire\b/i.test(text)) { const f = state.player.core.condition.fatigue ?? { debt: 0, line: 0 }; state.player.core.condition.fatigue = { debt: Math.min(barMax(state.player), f.debt + barMax(state.player) * 0.16), line: f.line + lineMax(state.player) / 2 }; }
      if (/^breathe\b/i.test(text) && state.player.core.condition.fatigue) state.player.core.condition.fatigue.line = 0;
      // "steady" leaves you Mentally steady, to show the chip beside Morale (SY1); any "fear" after it uses it up
      if (/^steady\b/i.test(text)) state.player.core.condition.mentallySteady = true;
      if (/^fear\b/i.test(text)) delete state.player.core.condition.mentallySteady;
      // "train" levels the current class up, to show the level-up beat and the rail's perk-point badge landing with it
      const lvl = /^train\b/i.test(text) ? levelTurn(state) : null;
      // the attack earns an achievement; "spar" loses a spar and earns a scar, to show both gold cards and their pop-ups
      const earned = hurt || /^spar\b/i.test(text) ? earnTurn(state, hurt ? [ACH.crippled_1] : [ACH.spar_losses_1]) : null;
      lines = [...lines, { turn: t, kind: 'narration', text: `(Canned narration ${++n}.) The grass hisses as the slime gathers itself again.`, mechanics: [`Turn ${t}: d100 ${40 + n} → Success`],
        place: placeOf(state), scenario: state.stage.scenarioNumber, ...(drop ? { downedBy: { by: 'the slime', weapon: 'acid lash', part: 'left leg', outcome: 'crushing hit' } } : {}), ...(hurt ?? {}), ...(lvl ?? {}), ...(earned ?? {}), ...(ended ?? {}), ...(ways ?? {}), ...(robbed ?? {}), ...(nerve ?? {}), ...(bandaged ?? {}),
        // "… then …": the part after "then" is put off to next turn, offered back in the empty box (Q16)
        ...(/\bthen\b/i.test(text) ? { next: text.split(/\bthen\b/i).slice(1).join('then').trim() } : {}) }];
      busy = false; emit();
    },
    async reset() { state = null; lines = []; fell = false; emit(); },
    endScenario() {},
    calls: () => n * 3 + 4,
    working: () => [],
    gm(): GmSnapshot { return { state, agentLog: state?.agentLog ?? [], log: state?.log ?? [], fallbackBanner: !!state?.stage.fallback, backups: state ? [{ turn: 0, path: 'stories/fake/backups/0' }] : [] }; },
    // the GM pop-up's older calls: Bren's deal with the player on turn 2 and his look round on turn 1
    async agentHistory(id) {
      const older = id === 'guard_1' ? [
        { turn: 2, agent: 'responder', actorId: id, input: { view: 'OppositionView…', heard: 'I’ll keep an eye out for the thief' }, output: { dialogue: { line: 'Then I’ll let you in after dark.' }, agreement: 'ag_1' }, status: 'ok', errors: [], modelTierApplied: 'complex' },
        { turn: 1, agent: 'planner', actorId: id, input: { view: 'OppositionView…' }, output: { goal: 'keep the gate', steps: ['watch the road'] }, status: 'ok', errors: [], modelTierApplied: 'complex' },
      ] as GameState['agentLog'] : [];
      return [...(state?.agentLog ?? []).filter((l) => l.actorId === id), ...older].slice(0, CONFIG.GM_AGENT_CALLS_SHOWN);
    },
    async restoreBackup() { emit(); },
    async recoverLoad() { emit(); },
    takePerk(id) { if (state) { takePerk(state, state.player, id); emit(); } },
    undoPerk(id) { if (state) { undoPerk(state, state.player, id); emit(); } },
    abandonQuest(id) { if (state && abandonQuest(state, id)) emit(); },
    pinQuest(id) { if (state) { pinQuest(state, id); emit(); } },
    // D-141, the stand-in Witness: its first answer asks, every later one offers the same restraint vow
    async witness(chat) {
      if (!state) return null;
      if (chat.filter((l) => l.by === 'player').length < 2) return { reply: 'What do you mean to hold yourself to, and by when?' };
      const form: VowForm = { line: 'Steal nothing for three days', goal: { kind: 'restraint', act: 'filch' }, stake: 'II', days: 3 };
      const r = readVow(state, form);
      return 'vow' in r ? { reply: 'Then swear it: no stealing for three days, at stake II.', form, vow: r.vow } : { reply: `That cannot be sworn: ${r.error}.` };
    },
    swearVow(form) { if (!state) return 'No story.'; const err = swearVow(state, form); if (!err) emit(); return err; },
    renounceVow(id) { if (state && renounceVow(state, id)) emit(); },
    setSignatures(lines) { if (state) { setSignatures(state.player, lines); emit(); } },
    setDefense(kind) { if (state) { state.player.core.standingDefense = kind; emit(); } },
  };
}
