// 429 D-1768 step 3 (BEL-51 to BEL-53): readers that asked "same band" now ask "one of yours" (group or crew) or "on your
// side of the fight". One of yours: in your group, a group yours sits inside or that sits inside yours, or a crew (a
// close-knit organization) of yours that you know them to be in (BEL-20). The fight's side: everyone fighting your foes
// who is not your foe (BEL-27).
import { describe, expect, it } from 'vitest';
import { makeVillage, actor } from '../harness';
import type { GameState, Tie } from '../../src/types';
import { ofOurs, sameCrew } from '../../src/engine/belonging';
import { knowsName } from '../../src/engine/relations';
import { cryAlly } from '../../src/engine/auras';
import { readyNames } from '../../src/engine/ready';
import { onFightSide } from '../../src/engine/engagement';

const tie = (org: string, more: Partial<Tie> = {}): Tie => ({ to: { org }, status: 'member', commitment: 'sworn', cover: 'open', ...more });

/** the village: the guard (village_watch) and the patron (tavern_folk) in different bands, with a gang and a guild */
function world(): GameState {
  const s = makeVillage();
  s.organizations = [{ id: 'gang', name: 'the gang', kind: 'gang', closeKnit: true }, { id: 'guild', name: 'the guild', kind: 'guild' }];
  return s;
}

describe('429 group or crew, and the fight side', () => {
  it('one of yours: the same group, nested groups, or a crew you know them to be in', () => {
    const s = world(), g = actor(s, 'guard_1'), p = actor(s, 'patron_1'), t = actor(s, 'trader');
    expect(ofOurs(s, p, t)).toBe(true); // same band
    expect(ofOurs(s, g, p)).toBe(false);
    s.bands.find((b) => b.id === 'tavern_folk')!.parentId = 'village_watch'; // a group inside the guard's
    expect(ofOurs(s, g, p)).toBe(true);
    delete s.bands.find((b) => b.id === 'tavern_folk')!.parentId;
    g.ties = [tie('gang')]; p.ties = [tie('gang')];
    expect(sameCrew(s, g, p)).toBe(true);
    expect(ofOurs(s, g, p)).toBe(true);
    p.ties = [tie('gang', { cover: 'secret' })];
    expect(ofOurs(s, g, p)).toBe(false); // a secret tie is unknown to the guard
    expect(ofOurs(s, p, g)).toBe(true); // the patron knows its own and the guard's open one
    g.ties = [tie('guild')]; p.ties = [tie('guild')];
    expect(ofOurs(s, g, p)).toBe(false); // a guild is not close-knit: not a crew
  });

  it("crew-mates know each other's names; others in no group with them do not", () => {
    const s = world(), g = actor(s, 'guard_1'), p = actor(s, 'patron_1');
    delete g.knownOnSight; delete p.knownOnSight;
    expect(knowsName(s, g, p)).toBe(false);
    g.ties = [tie('gang')]; p.ties = [tie('gang')];
    expect(knowsName(s, g, p)).toBe(true);
  });

  it("Battle Cry's allies and a readied 'anyone' read the crew", () => {
    const s = world(), g = actor(s, 'guard_1'), p = actor(s, 'patron_1');
    expect(cryAlly(s, p, g)).toBe(false);
    expect(readyNames(s, g, { on: 'comes', who: 'anyone' } as never, p)).toBe(true);
    g.ties = [tie('gang')]; p.ties = [tie('gang')];
    expect(cryAlly(s, p, g)).toBe(true);
    expect(readyNames(s, g, { on: 'comes', who: 'anyone' } as never, p)).toBe(false);
  });

  it("the fight's side: fighting your foe and not you, whatever the band", () => {
    const s = world(), g = actor(s, 'guard_1'), p = actor(s, 'patron_1'), slime = actor(s, 'slime_1');
    expect(onFightSide(s, g, p)).toBe(false);
    // the guard and the patron both fight the slime
    for (const [x, y] of [[g, slime], [p, slime]] as const) {
      x.mind!.overrides = { ...x.mind!.overrides, [y.id]: 'hostile' };
      y.mind!.overrides = { ...y.mind!.overrides, [x.id]: 'hostile' };
      x.mind!.knowledge[y.id] = { status: 'engaged', source: 'seen', revealed: [] } as never;
    }
    expect(onFightSide(s, g, p)).toBe(true);
    expect(onFightSide(s, g, slime)).toBe(false); // the foe is never on your side
    expect(cryAlly(s, p, g)).toBe(true);
  });
});
