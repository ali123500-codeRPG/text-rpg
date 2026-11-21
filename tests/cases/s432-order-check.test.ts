// 432 D-1768 step 4: the order check (BEL-30 to BEL-34, BB7 a, BB8 a). A right to order rests on Command (a seat over
// the receiver in its organization), Link (seat to seat), Lead (its group's leader or officer) or Ground (acting for
// whoever holds the place or gives its law); each covers some kinds of order. A higher tie the order goes against takes
// the right away, or makes a secret one pretend. The will step then picks the verdict, first match wins. Command from
// orders (TC7) reads it once a group has a leader (BB6 a); a Weaver cast entry can lead its band.
import { afterEach, describe, expect, it } from 'vitest';
import { makeVillage, actor, createRng } from '../harness';
import type { GameState, Tie } from '../../src/types';
import { checkOrder, orderBases, orderNote, orderRight } from '../../src/engine/orders';
import { commandLent } from '../../src/views/tactics';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { SK } from '../../src/library/skillIds';
import { CONFIG } from '../../src/config';

const tie = (to: Tie['to'], more: Partial<Tie> = {}): Tie => ({ to, status: 'member', commitment: 'sworn', cover: 'open', ...more });
const defy = CONFIG.ORDER_DEFY_POWER;
const setDefy = (n: number) => { (CONFIG as { ORDER_DEFY_POWER: number }).ORDER_DEFY_POWER = n; };
afterEach(() => setDefy(defy));

/** the village with a council over a watch, and a gang */
function world(): GameState {
  const s = makeVillage();
  s.organizations = [{ id: 'council', name: 'the council', kind: 'council' }, { id: 'watch', name: 'the watch', kind: 'watch', parentId: 'council' },
    { id: 'gang', name: 'the gang', kind: 'gang', closeKnit: true }];
  setDefy(1e9); // power aside unless a test sets it
  return s;
}

describe('432 the order check', () => {
  it('no basis, no right; Lead covers fight, move and task, not conduct', () => {
    const s = world(), t = actor(s, 'trader'), p = actor(s, 'patron_1');
    expect(checkOrder(s, t, p, { kind: 'fight' }).right).toBe(false);
    s.bands.find((b) => b.id === 'tavern_folk')!.leaderId = t.id;
    expect(orderBases(s, t, p).map((b) => b.basis)).toEqual(['lead']);
    expect(orderRight(s, t, p, 'conduct')).toBeUndefined();
    expect(checkOrder(s, t, p, { kind: 'task' })).toMatchObject({ right: true, basis: 'lead', verdict: 'obeys' });
  });

  it('Command: a seat in the receiver unit or above; the tie behind it sets obeys, the letter or pretends', () => {
    const s = world(), g = actor(s, 'guard_1'), p = actor(s, 'patron_1');
    s.organizations!.find((o) => o.id === 'council')!.headId = g.id;
    p.ties = [tie({ org: 'watch' })];
    expect(checkOrder(s, g, p, { kind: 'conduct' })).toMatchObject({ basis: 'command', verdict: 'obeys' });
    p.ties = [tie({ org: 'watch' }, { commitment: 'bound' })];
    expect(checkOrder(s, g, p, { kind: 'conduct' }).verdict).toBe('letter');
    p.ties = [tie({ org: 'watch' }, { commitment: 'feigned' })];
    expect(checkOrder(s, g, p, { kind: 'conduct' }).verdict).toBe('pretends');
  });

  it('a higher tie the order goes against: no right if open, pretends if secret', () => {
    const s = world(), g = actor(s, 'guard_1'), p = actor(s, 'patron_1'), t = actor(s, 'trader');
    s.organizations!.find((o) => o.id === 'watch')!.headId = g.id;
    t.ties = [tie({ org: 'gang' })];
    p.ties = [tie({ org: 'watch' }), tie({ org: 'gang' }, { commitment: 'devoted' })];
    expect(checkOrder(s, g, p, { kind: 'fight', against: t }).right).toBe(false);
    p.ties[1].cover = 'secret';
    expect(checkOrder(s, g, p, { kind: 'fight', against: t }).verdict).toBe('pretends');
    expect(checkOrder(s, g, p, { kind: 'fight' }).verdict).toBe('obeys'); // against no one of the gang
  });

  it('Ground: one acting for the law of the place covers conduct only, to the letter', () => {
    const s = world(), g = actor(s, 'guard_1'), p = actor(s, 'patron_1');
    g.ties = [tie({ org: 'watch' })];
    s.places.find((x) => x.id === p.placeId)!.law = { org: 'council' };
    expect(orderBases(s, g, p).map((b) => b.basis)).toEqual(['ground']);
    expect(checkOrder(s, g, p, { kind: 'conduct' })).toMatchObject({ basis: 'ground', verdict: 'letter' });
    expect(checkOrder(s, g, p, { kind: 'fight' }).right).toBe(false);
  });

  it('refuses: afraid of a fight order, cold regard, or far stronger unless devoted', () => {
    const s = world(), t = actor(s, 'trader'), p = actor(s, 'patron_1');
    s.bands.find((b) => b.id === 'tavern_folk')!.leaderId = t.id;
    p.mind!.overrides = { ...(p.mind!.overrides ?? {}), [t.id]: 'opposed' };
    expect(checkOrder(s, t, p, { kind: 'task' }).verdict).toBe('refuses');
    p.mind!.overrides = { ...(p.mind!.overrides ?? {}), [t.id]: 'unfriendly' };
    expect(checkOrder(s, t, p, { kind: 'task' }).verdict).toBe('letter');
    delete p.mind!.overrides![t.id];
    setDefy(1e-9);
    expect(checkOrder(s, t, p, { kind: 'task' }).verdict).toBe('refuses');
    p.ties = [tie({ person: t.id }, { commitment: 'devoted' })];
    expect(checkOrder(s, t, p, { kind: 'task' }).verdict).toBe('obeys');
  });

  it("the agent is told the right and the verdict; a player with no basis has none", () => {
    const s = world(), p = actor(s, 'patron_1');
    expect(orderNote(s, 'conduct', p)).toMatch(/no right/);
    expect(orderNote(s, null, p)).toBeUndefined();
  });

  it("BB6 a: once a group has a leader, only a basis lends Command; a leaderless group lends any bandmate's", () => {
    const s = world(), t = actor(s, 'trader'), p = actor(s, 'patron_1');
    t.core.skills[SK.command] = { raw: 90, state: 'normal' };
    const free = commandLent(s, p);
    expect(free).toBe(90); // heard across the tavern
    p.core.skills[SK.command] ??= { raw: 0, state: 'normal' };
    s.bands.find((b) => b.id === 'tavern_folk')!.leaderId = p.id; // the patron leads: the trader holds no basis over it
    expect(commandLent(s, p)).toBe(0);
    s.bands.find((b) => b.id === 'tavern_folk')!.leaderId = t.id;
    expect(commandLent(s, p)).toBe(free);
  });

  it('BB6 a: a Weaver cast entry marked leads is its band leader', () => {
    const s = toStoryStart(makeVillage()), plan = villageStagePlan(), ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
    const c = plan.cast.find((x) => !x.group && !x.actor)!;
    c.leads = true;
    expect(validateStagePlan(s, plan, ctx)).toEqual([]);
    applyStagePlan(s, plan, ctx, { entry: 'open' }, createRng(1));
    const a = s.actors.find((x) => x.id === c.key || x.id.startsWith(`${c.key}_`))!;
    expect(s.bands.find((b) => b.id === a.bandId)?.leaderId).toBe(a.id);
  });
});
