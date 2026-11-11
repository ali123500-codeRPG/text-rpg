// 170 Real distances: every distance rule comes from real metres turned into zone links by one conversion (reachLinks).
// A walk covers 1.4 m/s and a run 5 m/s over a 6 s fight turn; ranged penalties grow with the distance as a share of the
// weapon's real range; a line's words carry only as far as its sound, however far the speaker is seen.
import { afterEach, describe, expect, it } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { resolveTurn } from '../../src/engine';
import { moveSpeed, slotMetres } from '../../src/engine/speed';
import { getLibrary } from '../../src/library';
import { IT } from '../../src/library/itemIds';
import { BT } from '../../src/library/raceIds';
import { rangeMod } from '../../src/ruleset';
import { reachLinks } from '../../src/ruleset/range';
import { hearsWords, perceptionOf } from '../../src/perception';
import { CONFIG, resetConfig } from '../../src/config';
import type { GameEvent, GameState, Intent } from '../../src/types';

const intent = (move: Intent['move']): Intent => ({ move, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, action: null });
const turn = (s: GameState, i: Intent) => { s.turn += 1; return resolveTurn(s, { intent: i, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1)); };

describe('170 real distances', () => {
  afterEach(() => resetConfig());

  it('one conversion: a link is LINK_PACES × PACE_M metres; anything shorter is the same zone', () => {
    expect(reachLinks(7.9)).toBe(0);
    expect(reachLinks(8)).toBe(1);
    expect(reachLinks(50)).toBe(6); // a shortbow
  });

  it('speed comes from the body type, less worn armor (flat, then a share); a walk is 1 link and a dash 2 more', () => {
    const s = makeVillage();
    for (const i of s.player.core.inventory) if (i.equippedIn?.includes('armor')) delete i.equippedIn;
    expect(moveSpeed(s, s.player)).toEqual({ walk: 1.4, run: 5 });
    expect(slotMetres(s, s.player, 'move')).toBeCloseTo(8.4); // 1.4 m/s × 6 s
    expect(slotMetres(s, s.player, 'main')).toBeCloseTo(21.6); // (5 − 1.4) m/s × 6 s
    place(s, 'player', 'street_door');
    turn(s, intent({ toZone: 'field_mid' })); // 4 links: a dash reaches 3
    expect(s.player.zone).toBe('field_edge');
    // heavy armor: (5 − 0.2) × 0.85 = 4.08 m/s run
    const t = makeVillage();
    for (const i of t.player.core.inventory) if (i.equippedIn?.includes('armor')) delete i.equippedIn;
    const heavy = Object.values(getLibrary().items).find((d) => d.armor?.weight === 'heavy')!;
    t.player.core.inventory.push({ id: 'hv', itemId: heavy.id, equippedIn: ['armor'] });
    const h = CONFIG.ARMOR_SPEED.heavy;
    expect(moveSpeed(t, t.player).run).toBeCloseTo((5 - h.flat) * (1 - h.pct));
    expect(getLibrary().bodyTypes[BT.amorphous].speed.walk).toBeLessThan(1.4); // a slime creeps
  });

  it('range penalty: by the distance as a share of the reach, so a longbow is barely stretched where a shortbow is at its limit', () => {
    expect(rangeMod(0, 50)).toBe(0);
    expect(rangeMod(8, 50)).toBe(0);
    expect(rangeMod(24, 50)).toBe(-5);
    expect(rangeMod(48, 50)).toBe(-15);
    expect(rangeMod(48, 90)).toBe(-10); // a longbow at the same 48 m
    expect(rangeMod(17.5, 17.5)).toBe(-15); // a spear thrown at its full range
  });

  it('words carry only by sound: a talker seen three zones off is seen, not heard', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    place(s, 'guard_1', 'field_mid');
    const said = { id: 'e', turn: 1, actorId: 'guard_1', kind: 'speak', zone: 'field_mid', effects: [], noise: 'normal', visibility: 'normal',
      line: { text: 'The captain said you could go.', volume: 'normal' }, perception: {} } as GameEvent;
    const p = perceptionOf(said, s, s.player);
    expect(p).toEqual({ level: 'full', cue: 'sight' });
    expect(hearsWords(p ?? undefined)).toBe(false);
    const near = perceptionOf({ ...said, zone: 'gate_inner' }, s, s.player);
    expect(hearsWords(near ?? undefined)).toBe(true);
  });

  it('a line said beside a quiet action is as loud as the voice', () => {
    const s = makeVillage();
    place(s, 'guard_1', 'tav_common');
    const act = { type: 'hold', target: null, skill: null, targetPart: null, aimed: false, defense: null, item: null, mode: null, intent: '' };
    s.turn += 1;
    const ev = resolveTurn(s, { intent: intent(null), aimed: false, spokespeople: [],
      agentOutputs: [{ agent: 'planner', actorId: 'guard_1', output: { action: act, dialogue: { line: 'Evening.', volume: 'normal' }, gear: null, stance: null, planUpdate: null } }] as never }, createRng(1));
    const bark = ev.find((e) => e.actorId === 'guard_1' && e.line)!;
    expect(bark.kind).toBe('hold');
    expect(bark.noise).toBe('normal');
  });
});
