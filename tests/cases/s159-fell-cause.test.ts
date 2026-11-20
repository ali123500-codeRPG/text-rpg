// "You fell": the turn that leaves the player down names the last blow that hurt them, as the player knew it, and the
// screen turns it into one sassy line plus the plain facts.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { lineExtras } from '../../src/agents/game';
import { fellFacts, fellLine } from '../../src/ui/fell';
import { SK } from '../../src/library/skillIds';
import type { GameEvent, GameState, NarrationView, RollResult } from '../../src/types';

const roll = (actorId: string, skill: string, tier: RollResult['tier']): RollResult =>
  ({ actorId, skill, d100: 50, margin: 0, tier, natural: 0, modifiers: [], tierShifts: [] });
const hit = (s: GameState, damage: number): GameEvent => ({
  id: `e${damage}`, turn: s.turn, actorId: 'patron_1', kind: 'attack', target: 'player', zone: s.player.zone, effects: [], noise: 'quiet', visibility: 'normal',
  perception: { player: { level: 'full', cue: 'sight' } },
  attack: { attack: roll('patron_1', SK.unarmed_strike, 'success'), defense: null, defenseType: null, gap: null, gapShifts: [], outcome: 'heavy_hit',
    location: 'head', locationHow: 'rolled', multiplier: 1, damage, deciding: { attack: [], defense: [], gap: [] }, attackerId: 'patron_1', targetId: 'player', weaponId: '', modeId: '' },
} as GameEvent);
const down = (s: GameState) => { s.player.core.condition.hpLostPct = 100; };

describe('159 what dropped you', () => {
  it('an unseen attacker stays someone, but the player still feels where it landed', () => {
    const s = makeVillage();
    down(s);
    const d = lineExtras(s, [hit(s, 5)], { events: [], heard: [] } as unknown as NarrationView, '').downedBy;
    expect(d).toEqual({ by: 'someone', weapon: null, part: 'head', outcome: 'heavy hit', unseen: true });
    for (let t = 0; t < 3; t++) expect(fellLine(d, t)).not.toMatch(/someone’s|patron|Wim/);
    expect(fellFacts(d)).toBe('Last blow: heavy hit · head · someone you never saw');
    expect(fellLine(undefined, 0)).toMatch(/nobody/);
  });
});
