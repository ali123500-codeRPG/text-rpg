// 110 Engagement (E1): one encounter per actor covering talk and fights. It starts on a fight or a
// spoken exchange, a talk that turns into a fight stays one engagement, it ends after ENGAGEMENT_END_TURNS turns with
// nothing engaging the actor, and the player's marked skills roll when it ends.
import { PK } from '../../src/library/perkIds';
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { updateEngagements, usableThisEngagement, useThisEngagement } from '../../src/engine';
import type { GameEvent, GameState } from '../../src/types';
import { SK } from '../../src/library/skillIds';

const speak = (s: GameState, from: string, to: string): GameEvent => ({
  id: `e${s.turn}`, turn: s.turn, actorId: from, kind: 'speak', zone: 'tav_common', effects: [], noise: 'quiet', visibility: 'low', perception: {},
  speech: { skill: SK.persuasion, addressees: [to] },
});
const next = (s: GameState, events: GameEvent[] = []) => { s.turn += 1; return updateEngagements(s, events); };

describe('110 engagement', () => {
  it('talk starts an engagement for both sides, a fight joins it, and it ends after the quiet turns', () => {
    const s = makeVillage();
    const wim = s.actors.find((a) => a.id === 'patron_1')!;
    expect(next(s, [speak(s, 'player', 'patron_1')])).toBe(false);
    const start = s.turn;
    expect(s.player.engagement).toEqual({ start, last: start, kinds: ['talk'] });
    expect(wim.engagement?.kinds).toEqual(['talk']);
    // the talk breaks down: Wim turns hostile and knows the player is there
    s.bands.find((b) => b.id === 'tavern_folk')!.relations.player_band = 'hostile';
    wim.mind!.knowledge = { player: { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] } };
    expect(next(s)).toBe(false);
    expect(s.player.engagement).toMatchObject({ start, kinds: ['talk', 'fight'] }); // one engagement
    wim.core.condition.hpLostPct = 100; // down: no longer engaged
    for (let i = 1; i < CONFIG.ENGAGEMENT_END_TURNS; i++) expect(next(s)).toBe(false);
    expect(next(s)).toBe(true);
    expect(s.player.engagement).toBeUndefined();
    expect(s.log.filter((l) => l.code === 'engagement_ended' && (l.detail as { actorId: string }).actorId === 'player')).toHaveLength(1);
  });
  it('a scene break ends it at once', () => {
    const s = makeVillage();
    next(s, [speak(s, 'player', 'patron_1')]);
    s.stage.breakCause = 'rest';
    expect(next(s)).toBe(true);
  });
  it('once-per-engagement uses reset with a new engagement', () => {
    const s = makeVillage();
    expect(usableThisEngagement(s.player, PK.battle_cry)).toBe(false); // not engaged
    next(s, [speak(s, 'player', 'patron_1')]);
    useThisEngagement(s.player, PK.battle_cry);
    expect(usableThisEngagement(s.player, PK.battle_cry)).toBe(false);
    s.stage.breakCause = 'rest'; next(s); delete s.stage.breakCause;
    next(s, [speak(s, 'player', 'patron_1')]);
    expect(usableThisEngagement(s.player, PK.battle_cry)).toBe(true);
  });
});
