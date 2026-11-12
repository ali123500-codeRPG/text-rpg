// 141 spar achievements (D-144): spars won (1/10/25/50/200), cruel spars won from 1, and the scar Sparring Dummy for
// spars lost; achievements for the total earned (scars and the totals themselves do not count, replaced levels do).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { startSpar, updateSpars } from '../../src/engine/spar';
import { achXp, grantAchievement } from '../../src/engine/xp';
import { fightEnded } from '../../src/engine/feats';
import { actor } from '../harness/village';
import { ACH } from '../../src/library/achievementIds';
import type { GameState } from '../../src/types';
import { CONFIG } from '../../src/config';

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

describe('141 lost fights and the first spar lost', () => {
  it('one spar lost leaves Flat on Your Back; ten replace it with Sparring Dummy', () => {
    const s = makeVillage();
    spar(s, false, false);
    expect(keys(s)).toContain(ACH.spar_losses_1);
    for (let i = 0; i < 9; i++) spar(s, false, false);
    const sd = s.player.progression!.achievements!.find((a) => a.key === ACH.spar_losses_1)!;
    expect(sd.replacedBy).toBe(ACH.spar_losses_10);
  });

  it('a fight lost by going Down, or by getting away from a foe still fighting you, counts toward Loser', () => {
    const s = makeVillage();
    const slime = actor(s, 'slime_1');
    slime.mind!.overrides = { [s.player.id]: 'hostile' };
    const xp = s.player.progression!.xp;
    fightEnded(s, { hp: 0, foes: [slime.id], most: 1, down: true }); // went Down (and woke)
    for (let i = 0; i < 3; i++) fightEnded(s, { hp: 0, foes: [slime.id], most: 1 }); // got away
    expect(keys(s)).not.toContain(ACH.defeated_5);
    slime.mind!.moraleState = 'broken';
    fightEnded(s, { hp: 0, foes: [slime.id], most: 1 }); // won: the foe broke
    expect(keys(s)).not.toContain(ACH.defeated_5);
    delete slime.mind!.moraleState;
    fightEnded(s, { hp: 0, foes: [slime.id], most: 1 });
    expect(keys(s)).toContain(ACH.defeated_5);
    expect(s.player.progression!.xp).toBe(xp + CONFIG.REWARD_XP.zero); // a level I scar pays level 0's XP
  });
});

describe('141 scars pay one reward level lower', () => {
  it('a scar pays the XP of the level below its own; a level 0 scar pays level −1 (25)', () => {
    expect(achXp({ level: 'zero', scar: true })).toBe(CONFIG.REWARD_XP.minus_1);
    expect(CONFIG.REWARD_XP.minus_1).toBe(25);
    expect(achXp({ level: 'i', scar: true })).toBe(CONFIG.REWARD_XP.zero);
    expect(achXp({ level: 'v', scar: true })).toBe(CONFIG.REWARD_XP.iv);
    expect(achXp({ level: 'ii' })).toBe(CONFIG.REWARD_XP.ii);
  });
});
