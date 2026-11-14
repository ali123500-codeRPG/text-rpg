// 281 BG-200: the roll line says what moved the result besides the two tiers. A same-tier arrow that only grazed showed
// "same tier → grazed" with no word of the cover that pushed it a tier the target's way.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { lineExtras } from '../../src/agents/game';
import { SK } from '../../src/library/skillIds';
import type { GameEvent, GameState, NarrationView, RollResult, TierShift } from '../../src/types';

const roll = (actorId: string, skill: string, tier: RollResult['tier']): RollResult =>
  ({ actorId, skill, d100: 50, margin: 0, tier, natural: 0, modifiers: [], tierShifts: [] });
const attackEv = (s: GameState, attackerId: string, targetId: string, gapShifts: TierShift[]): GameEvent => ({
  id: `e${attackerId}`, turn: s.turn, actorId: attackerId, kind: 'attack', target: targetId, zone: s.player.zone, effects: [], noise: 'quiet', visibility: 'normal',
  perception: { player: { level: 'full', cue: 'sight' } },
  attack: {
    attack: roll(attackerId, SK.ranged_light, 'success'), defense: roll(targetId, SK.dodge, 'success'), defenseType: 'dodge', gap: 1, gapShifts,
    outcome: 'grazed', location: 'torso', locationHow: 'rolled', multiplier: 0.5, damage: 2, deciding: { attack: [], defense: [], gap: gapShifts.map((x) => x.source) },
    attackerId, targetId, weaponId: '', modeId: '',
  },
} as unknown as GameEvent);
const nv = (e: GameEvent) => ({ events: [{ id: e.id, kind: 'attack', level: 'full', cue: 'sight', packet: { actor: 'an old man', outcome: 'grazed', location: { part: 'torso', how: 'rolled' }, changes: [] } }], heard: [] } as unknown as NarrationView);

describe('281 roll line shifts (BG-200)', () => {
  it("the player's shot names the cover that pushed it a tier the target's way", () => {
    const s = makeVillage();
    s.actors.find((a) => a.id === 'patron_1')!.pronouns = 'he';
    const e = attackEv(s, 'player', 'patron_1', [{ source: 'cover', value: 1 }]);
    expect(lineExtras(s, [e], nv(e), '').check?.shifts).toEqual(['cover: 1 tier his way']);
  });
  it("a blow at the player names whose way each shift went, and no shift adds nothing", () => {
    const s = makeVillage();
    s.actors.find((a) => a.id === 'patron_1')!.pronouns = 'she';
    const e = attackEv(s, 'patron_1', 'player', [{ source: 'heavy vs block', value: -1 }, { source: 'cover', value: 2 }]);
    expect(lineExtras(s, [e], nv(e), '').incomingChecks?.[0].shifts).toEqual(['heavy vs block: 1 tier her way', 'cover: 2 tiers your way']);
    const plain = attackEv(s, 'player', 'patron_1', []);
    expect(lineExtras(s, [plain], nv(plain), '').check).not.toHaveProperty('shifts');
  });
});
