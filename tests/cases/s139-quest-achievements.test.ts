// 139 quest achievements (QT19): finished quests earn Job Done (1, level 0) up to The One They Send For (50); giving up
// five quests earns the scar Word Not Kept, which pays the XP of one reward level lower.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { abandonQuest, handInQuests } from '../../src/engine/quests';
import { ACH } from '../../src/library/achievementIds';
import { CONFIG } from '../../src/config';
import type { GameState, Quest } from '../../src/types';

const quest = (s: GameState, n: number, state: Quest['state']): Quest => {
  const q: Quest = { id: `q${n}`, state, text: 'a job', giver: 'trader', dealId: `d${n}`, goal: { kind: 'other' }, progress: 0, level: 'i' as Quest['level'], startTurn: 0 };
  s.quests.push(q);
  return q;
};
const earned = (s: GameState) => (s.player.progression?.achievements ?? []).filter((a) => !a.replacedBy).map((a) => a.key);

describe('139 quest achievements', () => {
  it('finished quests climb the chain from Job Done', () => {
    const s = makeVillage();
    quest(s, 1, 'ready');
    handInQuests(s, () => true);
    expect(earned(s)).toContain(ACH.quests_1);
    for (let n = 2; n <= 5; n++) quest(s, n, 'ready');
    handInQuests(s, () => true);
    expect(earned(s)).toContain(ACH.quests_5);
    expect(earned(s)).not.toContain(ACH.quests_1);
  });
  it('giving up five quests leaves the scar Word Not Kept, paying one reward level lower', () => {
    const s = makeVillage();
    for (let n = 1; n <= 4; n++) abandonQuest(s, quest(s, n, 'active').id);
    expect(earned(s)).not.toContain(ACH.quests_abandoned_5);
    const xp = s.player.progression!.xp;
    abandonQuest(s, quest(s, 5, 'active').id);
    expect(earned(s)).toContain(ACH.quests_abandoned_5);
    expect(s.player.progression!.xp).toBe(xp + CONFIG.REWARD_XP.zero); // level I scar: level 0's XP
  });
});
