// 169 Who counts as fighting you (YD1–YD3, YD6, YD7; BG-4, BG-5). Awareness gains hunting and engaged: a blow engages
// the two, closing in hunts, and both drop to tracking after ENGAGEMENT_END_TURNS quiet turns. Only engaged hostiles
// are in the fight. A yield reaches the foes fighting you; a taken yield covers the taker's bandmates who are together
// with it; once everyone who heard it has taken it, the fight ends.
import { describe, expect, it } from 'vitest';
import type { Actor, GameEvent, GameState } from '../../src/types';
import { actor, makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { fightingWith, noteFighting, updateEngagements } from '../../src/engine/engagement';
import { answerYield, playerYields, together } from '../../src/engine/yield';
import { hostile } from '../../src/engine/relations';

const belief = (status: 'tracking' | 'engaged', zone: string, turn: number) =>
  ({ status, lastKnownZone: zone, lastSeenTurn: turn, ...(status === 'engaged' ? { closedTurn: turn } : {}), source: 'seen' as const, revealed: [] });
const hit = (s: GameState, a: Actor, t: Actor): GameEvent =>
  ({ id: `e${s.turn}`, turn: s.turn, actorId: a.id, kind: 'attack', target: t.id, zone: t.zone, noise: 'loud', visibility: 'normal', perception: { [t.id]: { level: 'full', cue: 'sight' } } }) as unknown as GameEvent;

/** Tam (patron_1) has traded blows with the player in the common room; Moss (the trader), his bandmate, is hostile too */
function tavernFight(mossZone: string): GameState {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
  const tam = actor(s, 'patron_1'), moss = actor(s, 'trader');
  moss.zone = mossZone;
  for (const x of [tam, moss]) { x.mind!.overrides = { player: 'hostile' }; x.mind!.control = 'agent'; }
  tam.mind!.knowledge.player = belief('engaged', 'tav_common', s.turn);
  moss.mind!.knowledge.player = belief('tracking', 'tav_common', s.turn);
  updateEngagements(s, []);
  return s;
}

describe('169 who counts as fighting you', () => {
  it('BG-4: a hostile bandmate in another room is not in the fight, does not hear the yield, and the fight ends when Tam takes it', () => {
    const s = tavernFight('tav_cellar');
    const tam = actor(s, 'patron_1'), moss = actor(s, 'trader');
    expect(fightingWith(s, tam, s.player)).toBe(true);
    expect(fightingWith(s, moss, s.player)).toBe(false); // tracking, not engaged
    playerYields(s);
    expect(s.yielding).toMatchObject({ pending: ['patron_1'], accepted: [], refused: [] });
    s.turn += 1;
    answerYield(s, tam, true);
    expect(together(s, tam, moss)).toBe(false);
    expect(s.yielding!.accepted).toEqual(['patron_1']); // Moss is apart: the band's faction, still hostile
    expect(hostile(s, moss, s.player)).toBe(true);
    expect(updateEngagements(s, [])).toBe(true); // YD3: everyone who heard it took it, so the fight ends now
    expect(s.player.engagement).toBeUndefined();
  });

  it('YD2: a taken yield covers the taker\'s bandmates who are together with it', () => {
    const s = tavernFight('tav_common');
    const tam = actor(s, 'patron_1'), moss = actor(s, 'trader');
    playerYields(s);
    expect(s.yielding!.pending).toEqual(['patron_1']); // Moss never struck: not in the fight, not asked
    s.turn += 1;
    answerYield(s, tam, true);
    expect(s.yielding!.accepted).toEqual(['patron_1', 'trader']);
    expect(hostile(s, moss, s.player)).toBe(false); // the truce covers him too
  });

  it('BG-5: walking away from a fight ends it after the quiet turns, though the foe stays hostile and aware', () => {
    const s = makeVillage({ playerZone: 'field_mid', without: ['slime_2'] });
    const slime = actor(s, 'slime_1');
    slime.zone = 'field_mid';
    slime.mind!.knowledge.player = belief('tracking', 'field_mid', s.turn);
    s.turn += 1;
    const blow = [hit(s, slime, s.player)];
    noteFighting(s, blow);
    expect(slime.mind!.knowledge.player.status).toBe('engaged');
    updateEngagements(s, blow);
    expect(s.player.engagement?.kinds).toContain('fight');
    s.player.zone = 'tav_common'; // the player walks off; the slime keeps to the field
    let turns = 0;
    while (s.player.engagement && turns < 10) { s.turn += 1; turns++; noteFighting(s, []); updateEngagements(s, []); }
    expect(turns).toBe(CONFIG.ENGAGEMENT_END_TURNS);
    expect(slime.mind!.knowledge.player.status).toBe('tracking');
    expect(hostile(s, slime, s.player)).toBe(true);
  });

  it('YD6 B: a hostile that knows where you are and moves closer is hunting you, not yet engaged', () => {
    const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const g = actor(s, 'guard_1');
    g.mind!.overrides = { player: 'hostile' };
    g.mind!.knowledge.player = belief('tracking', 'tav_common', s.turn);
    const from = g.zone;
    g.zone = 'street_door';
    s.turn += 1;
    noteFighting(s, [{ id: 'm', turn: s.turn, actorId: g.id, kind: 'move', zone: g.zone, fromZone: from, noise: 'normal', visibility: 'normal', perception: {} } as unknown as GameEvent]);
    expect(g.mind!.knowledge.player.status).toBe('hunting');
    expect(fightingWith(s, g, s.player)).toBe(false);
  });
});
