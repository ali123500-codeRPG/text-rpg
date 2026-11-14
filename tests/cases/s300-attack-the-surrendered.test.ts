// 300 AS1–AS11 (D-304): attacking a foe who already gave up. Striking a surrendered foe (surrendered to anyone) counts on
// the No Quarter line; striking a broken foe as it flees counts on its own branch line; killing a surrendered foe you
// struck counts on another branch. Each foe counts once per line, hit or miss, and only when the player sees it in that
// visible state. AS3: others see a foe who surrendered marked Surrendered.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, wholeTurn } from '../harness/turn';
import { gaveUpFeats, killedSurrenderedFeat } from '../../src/engine/feats';
import { actorById } from '../../src/engine/relations';
import { buildPlayerView } from '../../src/views';
import { maxMorale, setMoraleLost } from '../../src/ruleset/morale';
import { getLibrary } from '../../src/library';
import { rewardLines } from '../../src/ruleset/achRewards';
import { ACH } from '../../src/library/achievementIds';
import { SK } from '../../src/library/skillIds';
import { AM, PA } from '../../src/library/tableIds';
import { IT } from '../../src/library/itemIds';
import { CONFIG } from '../../src/config';
import type { Actor, GameState } from '../../src/types';

const ids = (s: GameState) => (s.player.progression!.achievements ?? []).map((a) => a.id);
const giveUp = (a: Actor, st: 'surrendered' | 'broken') => { a.mind!.moraleState = st; setMoraleLost(a, maxMorale(a)); };
const setup = () => { const s = makeVillage({ playerZone: 'tav_common' }); CONFIG.GROWTH_AT_SCENARIO_END = false; return s; };

describe('300 attacking a foe who gave up', () => {
  it('a surrendered foe struck counts once; a broken one counts on the fleeing line; an unseen one or an NPC striker never', () => {
    const s = setup();
    const patron = actorById(s, 'patron_1')!;
    place(s, 'guard_1', 'tav_common');
    giveUp(patron, 'surrendered');
    gaveUpFeats(s, patron, patron); // an NPC striking counts nothing for the player
    expect(ids(s)).not.toContain(ACH.struck_surrendered_1);
    gaveUpFeats(s, s.player, patron);
    gaveUpFeats(s, s.player, patron); // the same foe again
    expect(ids(s)).toContain(ACH.struck_surrendered_1);
    expect(s.player.progression!.tally!.struck_surrendered).toBe(1);
    const fleeing = actorById(s, 'guard_1')!;
    giveUp(fleeing, 'broken');
    gaveUpFeats(s, s.player, fleeing);
    expect(ids(s)).toContain(ACH.struck_fleeing_1);
    const far = actorById(s, 'slime_1')!; // out in the field, out of sight
    giveUp(far, 'surrendered');
    gaveUpFeats(s, s.player, far);
    expect(s.player.progression!.tally!.struck_surrendered).toBe(1);
  });

  it('killing a surrendered foe counts on its branch only if you struck it while it surrendered', () => {
    const s = setup();
    const patron = actorById(s, 'patron_1')!;
    killedSurrenderedFeat(s, patron);
    expect(ids(s)).not.toContain(ACH.killed_surrendered_1);
    giveUp(patron, 'surrendered');
    gaveUpFeats(s, s.player, patron);
    killedSurrenderedFeat(s, patron);
    expect(ids(s)).toContain(ACH.killed_surrendered_1);
  });

  it('the chains: 1 / 5 / 10 / 25 / 50 with Temper +5 a level; kill branch 1 / 5 / 25; the fleeing line is a branch', () => {
    const L = getLibrary().achievements!;
    const counts = (rule: string) => Object.values(L).filter((d) => d.rule === rule).map((d) => d.count);
    expect(counts('struck_surrendered')).toEqual([1, 5, 10, 25, 50]);
    expect(counts('struck_fleeing')).toEqual([1, 5, 10, 25, 50]);
    expect(counts('killed_surrendered')).toEqual([1, 5, 25]);
    expect(L[ACH.struck_fleeing_1].branchOf).toBe(ACH.struck_surrendered_1);
    expect(L[ACH.killed_surrendered_1].branchOf).toBe(ACH.struck_surrendered_1);
    expect(rewardLines(L[ACH.struck_surrendered_50]).filter((l) => l.includes('Temper'))).toHaveLength(5);
    expect(L[ACH.struck_surrendered_1].personality).toEqual({ [PA.temper]: CONFIG.ACH_PERSONALITY_STEP });
    expect(CONFIG.ACH_PERSONALITY_STEP).toBe(5);
  });

  it('AS3: a foe who surrendered shows as Surrendered to the player, a broken one as Broken', () => {
    const s = setup();
    const patron = actorById(s, 'patron_1')!;
    giveUp(patron, 'surrendered');
    expect(buildPlayerView(s).actors.find((a) => a.id === 'patron_1')?.morale).toBe('Surrendered');
    giveUp(patron, 'broken');
    expect(buildPlayerView(s).actors.find((a) => a.id === 'patron_1')?.morale).toBe('Broken');
  });

  it('whole turn: striking a surrendered patron earns No Quarter, and the Narrator sees them as Surrendered', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!;
    giveUp(actorById(s, 'patron_1')!, 'surrendered');
    await g.turn(intent(), 'I look around');
    const data = (g.claude.callsFor('narrator').at(-1) as { input: { content: string }[] }).input.map((m) => m.content).join('\n');
    expect(data).toMatch(/"label":"a tavern patron"[^}]*"morale":"Surrendered"/);
    await g.turn(intent({ action: { type: 'attack', skill: SK.melee_medium, target: 'patron_1', targetPart: null, item: `player_${IT.arming_sword}_1`, mode: AM.cut, approach: 'a quick cut', stance: 'normal' } }), 'I cut down the man who gave up');
    expect((g.game.state()!.player.progression!.achievements ?? []).map((a) => a.key)).toContain(ACH.struck_surrendered_1);
  });
});
