// 324 PG3-PG9: what is half seen or half heard is made out by an automatic roll. Everyone rolls (PG3 a) the sense it half
// perceives by, against how faint it is (PG4 a: sight by how far past the clear range, darkness one step harder; sound by
// dB above the hearing floor), once a turn per person and sense (PG6 a); a success makes it a full perception (PG5 a); seen
// clearly with the words only a voice, Earshot rolls for the words (PG8 a); someone hiding is left to the stealth contests;
// it learns like a check (PG7 a, PG2 a); only Show rolls shows it (PG9 a). PG2 a: a passed check teaches however hard.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameEvent, GameState, RollResult, Tier } from '../../src/types';
import { createRng, lightAll, makeVillage } from '../harness';
import { ruleset } from '../../src/ruleset';
import { faintness } from '../../src/perception';
import { seesClearlyNow } from '../../src/views';
import { soundDb } from '../../src/perception/noise';
import { makeOut } from '../../src/engine/makeOut';
import { CONFIG } from '../../src/config';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';

const Y = -13.872983346207416; // field_mid spans x 90..130
function setUp(zone = 'field_mid') {
  const s = makeVillage({ playerZone: zone, without: ['slime_1', 'slime_2', 'patron_1'] });
  const g = s.actors.find((a) => a.id === 'guard_1')!;
  g.zone = zone; g.placeId = s.player.placeId;
  if (zone === 'field_mid') { s.player.pos = { x: 91, y: Y }; g.pos = { x: 126, y: Y }; } // 35 m apart
  else { g.pos = s.player.pos ? { ...s.player.pos, x: s.player.pos.x + 1 } : undefined; lightAll(s, 'dark'); } // no lamp up the steps lights the cellar
  delete s.player.core.skills[SK.eyesight]; delete s.player.core.skills[SK.earshot];
  s.player.progression!.marks = []; s.player.progression!.markCounts = {};
  return { s, g };
}
const ev = (s: GameState, over: Partial<GameEvent> = {}): GameEvent => {
  const g = s.actors.find((a) => a.id === 'guard_1')!;
  return { id: 'e1', turn: s.turn, actorId: g.id, kind: 'idle', zone: g.zone, pos: g.pos, effects: [], noise: 'quiet', visibility: 'low', perception: { [s.player.id]: { level: 'partial', cue: 'sight' } }, ...over } as GameEvent;
};
/** forces every perception roll to `tier`, counting them */
function rig(tier: Tier) {
  const real = ruleset.roll, calls: string[] = [];
  vi.spyOn(ruleset, 'roll').mockImplementation((req, st, rng) => {
    const r = real(req, st, rng);
    if (req.rollKind !== 'perception') return r;
    calls.push(`${req.actorId}:${req.skill}`);
    return { ...r, tier } as RollResult;
  });
  return calls;
}
afterEach(() => vi.restoreAllMocks());

describe('324 making out what is half seen or half heard', () => {
  it('PG4 a: sight grade by how far past the clear range; darkness one step harder; Night Eyes cancels it', () => {
    const { s, g } = setUp();
    expect(faintness(s, ev(s), s.player, 'sight')).toBe('moderate'); // low: clear 15, glimpse 60; 35 m is 44% of the way
    g.pos = { x: 100, y: Y }; // 9 m: inside the clear range
    expect(faintness(s, ev(s), s.player, 'sight')).toBe('minor');
    g.pos = { x: 129, y: Y }; // 38 m: 51%
    expect(faintness(s, ev(s), s.player, 'sight')).toBe('major');
    expect(faintness(s, ev(s, { visibility: 'faint' }), s.player, 'sight')).toBeNull(); // past the glimpse range: nothing to make out
    const d = setUp('tav_cellar');
    expect(faintness(d.s, ev(d.s), d.s.player, 'sight')).toBe('moderate'); // close, but dark
    d.s.player.core.perks.push({ perkId: PK.night_eyes, source: 'level', gainedTurn: 0 });
    expect(faintness(d.s, ev(d.s), d.s.player, 'sight')).toBe('minor');
  });

  it('PG4 a: sound grade by the dB it reaches above the hearing floor', () => {
    const { s, g } = setUp();
    for (const noise of ['faint', 'hushed', 'quiet', 'normal'] as const) {
      const db = soundDb(s, noise, g, s.player);
      const above = db === null ? null : db - CONFIG.HEARING_FLOOR_DB;
      const want = above === null || above < 0 ? null : CONFIG.MAKE_OUT_SOUND_GRADES.find(([n]) => above >= n)![1];
      expect(faintness(s, ev(s, { noise }), s.player, 'sound')).toBe(want);
    }
  });

  it('PG5 a/PG7 a/PG2 a: a success makes it out and a 0 Eyesight learns from the pass; a failure leaves it half seen', () => {
    const { s } = setUp();
    rig('success');
    const e = ev(s);
    makeOut(s, e, createRng(1));
    expect(e.perception[s.player.id]).toEqual({ level: 'full', cue: 'sight' });
    expect(e.madeOut).toMatchObject({ target: CONFIG.DIFFICULTY.moderate, passed: true });
    expect(s.player.progression!.marks).toContain(SK.eyesight); // Moderate 50 is far above a 0 skill's window, but passed
    vi.restoreAllMocks();
    const t = setUp().s;
    rig('failure');
    const f = ev(t);
    makeOut(t, f, createRng(1));
    expect(f.perception[t.player.id].level).toBe('partial');
    expect(f.madeOut?.passed).toBe(false);
    expect(t.player.progression!.marks).not.toContain(SK.eyesight); // failed, and outside the window: no mark
  });

  it('PG6 a: once a turn for each person and sense; PG3 a: NPCs roll too; someone hiding is left to the stealth contests', () => {
    const { s, g } = setUp();
    const calls = rig('success');
    const other = s.actors.find((a) => a.id !== g.id && a.mind)!;
    const a = ev(s, { perception: { [s.player.id]: { level: 'partial', cue: 'sight' } } });
    makeOut(s, a, createRng(1));
    const b = ev(s, { id: 'e2', perception: { [s.player.id]: { level: 'partial', cue: 'sight' } } });
    makeOut(s, b, createRng(1));
    expect(calls.filter((c) => c.startsWith(s.player.id))).toHaveLength(1);
    expect(b.perception[s.player.id].level).toBe('full'); // the turn's result holds for its other events
    other.zone = 'field_mid'; other.placeId = s.player.placeId; other.pos = { x: 92, y: Y };
    const n = ev(s, { id: 'e3', perception: { [other.id]: { level: 'partial', cue: 'sight' } } });
    makeOut(s, n, createRng(1));
    expect(n.perception[other.id].level).toBe('full');
    g.posture = 'stealthy';
    s.turn++;
    const h = ev(s, { id: 'e4' });
    makeOut(s, h, createRng(1));
    expect(h.perception[s.player.id].level).toBe('partial');
    expect(calls.filter((c) => c.startsWith(s.player.id))).toHaveLength(1);
  });

  it('PG8 a: seen clearly but the words only a voice, Earshot rolls for the words', () => {
    const { s, g } = setUp();
    g.pos = { x: 126, y: Y };
    const calls = rig('success');
    // a voice 35 m off that reaches as a voice, not words
    const noise = (['hushed', 'quiet', 'murmur', 'normal', 'raised'] as const).find((n) => { const db = soundDb(s, n, g, s.player); return db !== null && db >= CONFIG.HEARING_FLOOR_DB && db < CONFIG.HEARING_FLOOR_DB + CONFIG.CLEAR_ABOVE_FLOOR_DB; })!;
    const e = ev(s, { kind: 'speak', noise, line: { text: 'Over here.', volume: 'normal' }, perception: { [s.player.id]: { level: 'full', cue: 'sight' } } });
    expect(faintness(s, e, s.player, 'sound')).not.toBeNull();
    makeOut(s, e, createRng(1));
    expect(calls).toEqual([`${s.player.id}:${SK.earshot}`]);
    expect(e.perception[s.player.id].heard).toBe(true);
  });

});

// BG-252 (PG11 a): someone made out by sight is seen clearly everywhere that turn (Who's here, the Narrator's people, name
// learning), for every observer; the player keeps them named while they stay put and can still be glimpsed
describe('324 BG-252 someone made out is named in Who\'s here', () => {
  const talk = (s: GameState, id = 'e1', over: Partial<GameEvent> = {}) => ev(s, { id, kind: 'speak', visibility: 'normal', noise: 'normal', ...over }); // normal: clear to 25 m, glimpsed to 200 m

  it('an NPC that makes someone out sees them clearly that turn', () => {
    const { s, g } = setUp();
    rig('success');
    const other = s.actors.find((a) => a.id !== g.id && a.mind)!;
    other.zone = 'field_mid'; other.placeId = s.player.placeId; other.pos = { x: 91, y: Y + 1 };
    expect(seesClearlyNow(s, other, g.id)).toBe(false);
    const e = talk(s, 'e1', { perception: { [other.id]: { level: 'partial', cue: 'sight' } } });
    makeOut(s, e, createRng(1));
    expect(seesClearlyNow(s, other, g.id)).toBe(true);
  });
});
