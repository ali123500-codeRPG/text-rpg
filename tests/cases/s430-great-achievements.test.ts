// 430 GW: In the Shadow of the Great (the first person among the Great the player sees) and One of the Great (the player's
// Combat Power reaching CONFIG.GREAT_FROM's anchor). A beast past the limit earns the first's branch instead (GW2 a, GW6 a).
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { turnFeats } from '../../src/engine/feats';
import { ACH } from '../../src/library/achievementIds';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { rankRow } from '../../src/library/spawn';
import { combatPower, isGreat } from '../../src/ruleset/reportCard';
import { trueSkill } from '../../src/ruleset/perks';
import { intelligenceOf } from '../../src/ruleset/body';
import { seenIds } from '../../src/views';
import type { Actor, GameState } from '../../src/types';

const keys = (s: GameState) => [...(s.player.progression!.achievements ?? []), ...(s.player.progression!.pendingAchievements ?? [])].map((a) => a.key);
const great = () => rankRow(CONFIG.GREAT_FROM).anchor;
// a person swings a heavy weapon; a beast fights with what its body has (a slime's own attack)
const strong = (a: Actor, raw: number, skill: string | undefined = SK.melee_heavy) => { if (!skill) throw new Error('no fighting skill'); a.core.skills[skill] = { raw, state: 'normal' }; return a; };
const inSight = (s: GameState, person: boolean) => {
  const seen = new Set(seenIds(s, s.player));
  const a = s.actors.find((x) => seen.has(x.id) && (intelligenceOf(x) === 'intelligent') === person);
  if (!a) throw new Error(`no ${person ? 'person' : 'beast'} in sight`);
  return a;
};

describe('430 achievements for the Great', () => {
  it('one of the Great reads the report card\'s Combat Power against the Beyond anchor', () => {
    const s = makeVillage(), a = inSight(s, true);
    strong(a, great() - 1);
    expect(combatPower(a)).toBeLessThan(great());
    expect(isGreat(a)).toBe(false);
    strong(a, great());
    expect(isGreat(a)).toBe(true);
  });
  it('seeing a person among the Great earns In the Shadow of the Great once; a Great beast earns its branch instead', () => {
    const s = makeVillage();
    turnFeats(s, []);
    expect(keys(s)).not.toContain(ACH.great_seen_1);
    place(s, 'slime_1', s.player.zone);
    const slime = inSight(s, false);
    strong(slime, great() * 2, Object.keys(slime.core.skills).find((k) => trueSkill(slime, k) === combatPower(slime))); // its own best fighting skill
    turnFeats(s, []);
    expect(keys(s)).not.toContain(ACH.great_seen_1);
    expect(keys(s).filter((k) => k === ACH.great_beast_seen_1)).toHaveLength(1);
    strong(inSight(s, true), great());
    turnFeats(s, []);
    turnFeats(s, []);
    expect(keys(s).filter((k) => k === ACH.great_seen_1)).toHaveLength(1);
  });
  it('the player becomes One of the Great when a fighting true skill reaches the anchor', () => {
    const s = makeVillage();
    strong(s.player, great() - 1);
    turnFeats(s, []);
    expect(keys(s)).not.toContain(ACH.great_become_1);
    strong(s.player, great());
    turnFeats(s, []);
    turnFeats(s, []);
    expect(keys(s).filter((k) => k === ACH.great_become_1)).toHaveLength(1);
  });
});
