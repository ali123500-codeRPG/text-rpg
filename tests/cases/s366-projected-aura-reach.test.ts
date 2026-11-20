// 366 Projected aura reach (Tactics tree TC37 a, TC38 b): a projected aura (Battle Cry; Rally later) reaches whoever
// perceives it at any level, or anyone within PROJECTED_AURA_MULT × the owner's aura reach, heard or not. Offensive aura
// was renamed projected aura (TC29). SK31 is shown as Falsehood (TC27 a; its code key is falsehood since BG-321); FN11 is shown as Reaction (TC13 a).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { auraReachM, projectedReachM } from '../../src/engine/auras';
import { getLibrary } from '../../src/library';
import { PK } from '../../src/library/perkIds';

describe('366 Projected aura reach and Tactics renames', () => {
  it('projected reach is PROJECTED_AURA_MULT times the aura reach, Chorus included', () => {
    const s = makeVillage();
    expect(projectedReachM(s.player)).toBe(CONFIG.PROJECTED_AURA_MULT * CONFIG.AURA_REACH_M);
    s.player.core.perks.push({ perkId: PK.chorus, source: 'level', gainedTurn: 0 });
    expect(projectedReachM(s.player)).toBeCloseTo(CONFIG.PROJECTED_AURA_MULT * auraReachM(s.player));
    expect(projectedReachM(s.player)).toBeGreaterThan(CONFIG.PROJECTED_AURA_MULT * CONFIG.AURA_REACH_M);
  });

  it("Battle Cry's rules name the projected reach and the projected aura", () => {
    const r = getLibrary().perks[PK.battle_cry]!.rules!;
    expect(r.kind).toBe('Move (projected aura)');
    expect(r.effect).toContain(`${CONFIG.PROJECTED_AURA_MULT} × the aura reach`);
  });
});
