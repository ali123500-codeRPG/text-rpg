// 427 D-1768 step 2 (BEL-25): the default attitude reads organizations under the group. With no override, a's stance
// toward b is its group's word on b (or the groups above it), then its ties' organizations, highest commitment first,
// nearest unit first, then its first organization's stance toward strangers, then neutral. Only ties a knows count
// (BEL-20): open ones, quiet ones of fellow members, never another's secret one. The player holds no stances (BEL-22).
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import type { Actor, GameState, Organization, Tie } from '../../src/types';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { stance, hostile } from '../../src/engine/relations';

const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
const tie = (org: string, more: Partial<Tie> = {}): Tie => ({ to: { org }, status: 'member', commitment: 'sworn', cover: 'open', ...more });

/** two NPCs of the village in bands of their own, with no relations, and the organizations given */
function world(orgs: Organization[]): { s: GameState; a: Actor; b: Actor } {
  const s = toStoryStart(makeVillage());
  const p = villageStagePlan();
  expect(validateStagePlan(s, p, ctx)).toEqual([]);
  applyStagePlan(s, p, ctx, { entry: 'open' }, createRng(1));
  const [a, b] = s.actors;
  s.bands.push({ id: 'g_a', name: 'A', goals: '', temperament: '', lethal: true, relations: {} }, { id: 'g_b', name: 'B', goals: '', temperament: '', lethal: true, relations: {} });
  a.bandId = 'g_a'; b.bandId = 'g_b';
  delete a.mind!.overrides; delete b.mind!.overrides;
  s.organizations = orgs;
  return { s, a, b };
}

describe('427 default attitude reads organizations', () => {
  it('no ties and no group word: neutral, as before', () => {
    const { s, a, b } = world([]);
    expect(stance(s, a, b)).toBe('neutral');
  });

  it("an organization's word on another, inherited by its units, the nearest entry winning", () => {
    const crown: Organization = { id: 'crown', name: 'the Crown', kind: 'realm', stances: { gang: 'hostile' } };
    const watch: Organization = { id: 'watch', name: 'the Watch', kind: 'watch', parentId: 'crown' };
    const { s, a, b } = world([crown, watch, { id: 'gang', name: 'the gang', kind: 'gang', closeKnit: true }]);
    a.ties = [tie('watch')]; b.ties = [tie('gang')];
    expect(stance(s, a, b)).toBe('hostile');
    expect(hostile(s, a, b)).toBe(true);
    expect(stance(s, b, a)).toBe('neutral'); // the gang says nothing of the Watch
    watch.stances = { gang: 'unfriendly' }; // one unit can differ from its parent
    expect(stance(s, a, b)).toBe('unfriendly');
    // an entry on a person
    watch.stances = { [b.id]: 'friend' };
    expect(stance(s, a, b)).toBe('friend');
  });

  it('only known ties count: a secret one never, a quiet one for fellow members', () => {
    const { s, a, b } = world([{ id: 'watch', name: 'the Watch', kind: 'watch', stances: { gang: 'hostile' } }, { id: 'gang', name: 'the gang', kind: 'gang', closeKnit: true }]);
    a.ties = [tie('watch')];
    b.ties = [tie('gang', { cover: 'secret' })];
    expect(stance(s, a, b)).toBe('neutral'); // the infiltrator reads as no one
    b.ties = [tie('gang', { cover: 'quiet' })];
    expect(stance(s, a, b)).toBe('neutral');
    a.ties = [tie('gang', { cover: 'quiet' })]; // fellow members know each other's quiet ties: same crew
    expect(stance(s, a, b)).toBe('friendly');
  });

  it('the highest commitment decides, then list order; a group word comes before any', () => {
    const { s, a, b } = world([
      { id: 'x', name: 'X', kind: 'guild', stances: { y: 'hostile' } },
      { id: 'z', name: 'Z', kind: 'order', stances: { y: 'friend' } },
      { id: 'y', name: 'Y', kind: 'house' }]);
    b.ties = [tie('y')];
    a.ties = [tie('x', { commitment: 'feigned' }), tie('z', { commitment: 'devoted' })];
    expect(stance(s, a, b)).toBe('friend');
    a.ties = [tie('x'), tie('z')];
    expect(stance(s, a, b)).toBe('hostile');
    s.bands.find((g) => g.id === 'g_a')!.relations.g_b = 'neutral'; // this job's own word
    expect(stance(s, a, b)).toBe('neutral');
  });

  it("a's first organization's stance toward strangers, then a group inside a bigger one", () => {
    const { s, a, b } = world([{ id: 'x', name: 'X', kind: 'cult', strangers: 'unfriendly' }]);
    a.ties = [tie('x')];
    expect(stance(s, a, b)).toBe('unfriendly');
    s.bands.find((g) => g.id === 'g_b')!.parentId = 'g_a'; // b's group sits inside a's
    expect(stance(s, a, b)).toBe('friendly');
    expect(stance(s, b, a)).toBe('friendly');
  });

  it('the player holds no stances from organizations', () => {
    const { s, b } = world([{ id: 'x', name: 'X', kind: 'guild', stances: { y: 'hostile' }, strangers: 'unfriendly' }, { id: 'y', name: 'Y', kind: 'house' }]);
    s.player.ties = [tie('x')]; b.ties = [tie('y')];
    expect(stance(s, s.player, b)).toBe(s.bands.find((g) => g.id === s.player.bandId)?.relations.g_b ?? 'neutral');
  });
});
