// 141 spar achievements (D-144): spars won (1/10/25/50/200), cruel spars won from 1, and the scar Sparring Dummy for
// spars lost; achievements for the total earned (scars and the totals themselves do not count, replaced levels do).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { startSpar, updateSpars } from '../../src/engine/spar';
import { grantAchievement } from '../../src/engine/xp';
import { ACH } from '../../src/library/achievementIds';
import type { GameState } from '../../src/types';

const keys = (s: GameState) => (s.player.progression?.achievements ?? []).map((a) => a.key);
const spar = (s: GameState, cruel: boolean, playerWins: boolean) => {
  startSpar(s, [['player'], ['patron_1']], cruel, 'test');
  s.spars![0].out[playerWins ? 'patron_1' : 'player'] = s.turn;
  updateSpars(s, []);
};

describe('141 spar achievements and achievement totals', () => {
  it('a cruel spar won counts for both chains; a spar lost counts toward the scar', () => {
    const s = makeVillage();
    spar(s, false, true);
    expect(keys(s)).toContain(ACH.spar_1);
    expect(keys(s)).not.toContain(ACH.cruel_spar_1);
    spar(s, true, true);
    expect(keys(s)).toContain(ACH.cruel_spar_1);
    for (let i = 0; i < 9; i++) spar(s, false, false);
    expect(keys(s)).not.toContain(ACH.spar_losses_10);
    spar(s, false, false);
    expect(keys(s)).toContain(ACH.spar_losses_10);
  });

  it('ten other achievements earn A Few Threads; scars do not count', () => {
    const s = makeVillage();
    grantAchievement(s, ACH.quests_abandoned_5); // a scar
    const plain = [ACH.clean_10, ACH.unseen_10, ACH.vanished_5, ACH.spotted_10, ACH.talked_down_1, ACH.outmatched_1, ACH.enemy_friend_1, ACH.no_blow_1, ACH.mended_1];
    for (const k of plain) grantAchievement(s, k);
    expect(keys(s)).not.toContain(ACH.total_10);
    grantAchievement(s, ACH.holds_10);
    expect(keys(s)).toContain(ACH.total_10);
  });
});
