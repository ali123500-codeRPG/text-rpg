// 152 Dread Presence (Intimidation 100): the first engagement aura (NT14; aura doc I1–I8; morale MB19, MB36–MB39).
// Each opposed-or-worse target aware of the owner in its zone or one link away checks once per engagement: the owner's
// Intimidation against the target's Resolve. A win leaves the target Shaken toward the owner (−5 × gap, the bigger
// stands) and costs it 10 morale per tier of gap. Both sides mark.
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage } from '../harness';
import { getLibrary } from '../../src/library';
import { BUILT_PERKS } from '../../src/library/builtPerks';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import { FN, GR } from '../../src/library/functionIds';
import { FUNCTION_GROUP, functionName } from '../../src/library/functionNames';
import { engagementAuras } from '../../src/engine/auras';
import { payFear } from '../../src/engine/morale';
import { moraleLost } from '../../src/ruleset/morale';
import { updateEngagements } from '../../src/engine/engagement';
import { CONFIG } from '../../src/config';
import type { Actor, GameState } from '../../src/types';
import { play } from './w4-kit';
import { ago, tick, turnsFor } from '../harness/time';
import { engagementEndS } from '../../src/ruleset/actionTime';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
/** the player owns Dread Presence; patron_1 is opposed to the player and aware of it, in `zone` */
const setup = (zone?: string) => {
  const s = makeVillage();
  give(s.player, PK.dread_presence);
  s.player.core.skills[SK.intimidation] = { raw: 80, state: 'normal' };
  const t = npc(s, 'patron_1');
  t.zone = zone ?? s.player.zone;
  t.mind!.overrides = { player: 'opposed' };
  t.mind!.knowledge.player = { ...({ source: 'seen', revealed: [] } as const), ...(t.mind!.knowledge.player ?? {}), status: 'aware', lastKnownZone: s.player.zone };
  return { s, t };
};
const run = (s: GameState, rolls: number[]) => engagementAuras(s, forcedRng(rolls), (a, id, gap) => payFear(s, forcedRng([50]), a, id, { gap }));

describe('152 Dread Presence', () => {
  it('is the Intimidation 100 perk; Battle Cry moves to 140; the aura functions sit in the Aura group', () => {
    const perks = getLibrary().perks;
    expect(perks[PK.dread_presence]?.ladder).toEqual({ skill: SK.intimidation, milestone: 100 });
    expect(BUILT_PERKS.has(PK.dread_presence)).toBe(true);
    expect(FUNCTION_GROUP[FN.engagement_aura]).toBe(GR.aura);
    expect(FUNCTION_GROUP[FN.offensive_aura]).toBe(GR.aura);
    expect(functionName(FN.engagement_aura)).toBe('Engagement aura');
  });

  it('a target that loses is Shaken toward the owner and pays 10 morale per tier, once per engagement', () => {
    const { s, t } = setup();
    const before = moraleLost(t);
    const [c] = run(s, [95, 5]);
    expect(c.took).toBe(true);
    expect(c.contest.a.skill).toBe(SK.intimidation);
    expect(c.contest.b.skill).toBe(SK.resolve);
    const gap = Math.abs(c.contest.gap);
    expect(t.pressure?.player?.shaken).toBe(CONFIG.SHAKEN_PER_TIER * gap); // stored as the penalty's size
    expect(moraleLost(t) - before).toBe(10 * gap);
    expect(run(s, [95, 5])).toEqual([]); // already checked this engagement
  });

  it('a target that wins takes nothing', () => {
    const { s, t } = setup();
    const [c] = run(s, [5, 95]);
    expect(c.took).toBe(false);
    expect(t.pressure).toBeUndefined();
    expect(moraleLost(t)).toBe(0);
  });

  it('reaches the owner\'s zone and one link away, only opposed-or-worse targets aware of the owner', () => {
    expect(run(setup('tav_counter').s, [95, 5])).toHaveLength(1); // one link
    expect(run(setup('tav_cellar').s, [95, 5])).toEqual([]); // two links
    const { s, t } = setup();
    t.mind!.overrides = {};
    expect(run(s, [95, 5])).toEqual([]); // not opposed
    const u = setup();
    u.t.mind!.knowledge.player = { ...u.t.mind!.knowledge.player, status: 'unaware' } as never;
    expect(run(u.s, [95, 5])).toEqual([]); // hasn't noticed the owner yet
  });

  it('checks again in a new engagement', () => {
    const { s, t } = setup();
    run(s, [95, 5]);
    t.engagement = { start: 0, last: s.turn, kinds: ['fight'] };
    tick(s, engagementEndS() + 1);
    updateEngagements(s, []);
    expect(t.auraChecks).toBeUndefined();
    expect(run(s, [95, 5])).toHaveLength(1);
  });

  it('runs at the start of a turn, before anyone acts, as an aura event', () => {
    const { s } = setup();
    const ev = play(s);
    const i = ev.findIndex((e) => e.kind === 'aura' && e.actorId === 'player' && e.target === 'patron_1');
    expect(i).toBe(0);
    expect(['aura_took', 'aura_resisted']).toContain(ev[i].effects[0].kind);
  });
});
