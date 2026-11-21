// 431 what the play screens show of hierarchy and belonging (src/views/belonging.ts): only the ties the player knows
// (BEL-20: open ones; the player holds no ties, so a quiet tie is never a fellow member's to it, and a secret one never
// shows), never a commitment (BEL-08), the organizations those ties reach with the ones they are units of (BEL-03), who
// heads them, and who holds the player's place and whose law runs there (BEL-15).
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import type { GameState, PlayerView, Tie } from '../../src/types';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { belongingView, ruleText, tieText } from '../../src/views/belonging';

const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
const tie = (org: string, more: Partial<Tie> = {}): Tie => ({ to: { org }, status: 'member', commitment: 'devoted', cover: 'open', ...more });

function world(): GameState {
  const s = toStoryStart(makeVillage());
  const p = villageStagePlan();
  expect(validateStagePlan(s, p, ctx)).toEqual([]);
  applyStagePlan(s, p, ctx, { entry: 'open' }, createRng(1));
  s.organizations = [{ id: 'council', name: 'the Millbrook council', kind: 'council' },
    { id: 'watch', name: 'the Millbrook Watch', kind: 'watch', parentId: 'council', headId: s.actors[0].id },
    { id: 'cult', name: 'the Pale Hand', kind: 'cult' }, { id: 'guild', name: 'the Thieves', kind: 'guild' }];
  return s;
}
/** a view in which the player sees every actor clearly */
const seeing = (s: GameState) => ({ actors: s.actors.map((a) => ({ id: a.id, level: 'full' })) }) as unknown as PlayerView;

describe('431 belonging as the player sees it', () => {
  it('open ties show, with title; quiet and secret ones never; no commitment anywhere', () => {
    const s = world(), [a] = s.actors;
    a.ties = [tie('watch', { title: 'watch captain' }), tie('guild', { cover: 'quiet' }), tie('cult', { cover: 'secret' })];
    const v = belongingView(s, seeing(s));
    expect(v.people[a.id].map(tieText)).toEqual(['The Millbrook Watch · watch captain']);
    expect(JSON.stringify(v)).not.toMatch(/devoted|commitment|Pale Hand|Thieves/);
  });

  it('a unit brings the organization it is part of; its head is marked', () => {
    const s = world(), [a] = s.actors;
    a.ties = [tie('watch')];
    const v = belongingView(s, seeing(s));
    expect(v.orgs.map((o) => [o.name, o.parentId ?? null])).toEqual([['the Millbrook council', null], ['the Millbrook Watch', 'council']]);
    expect(v.orgs[1].people).toEqual([expect.objectContaining({ id: a.id, head: true })]);
  });

  it('someone the player does not see clearly shows nothing', () => {
    const s = world(), [a] = s.actors;
    a.ties = [tie('watch')];
    expect(belongingView(s, { actors: [] } as unknown as PlayerView)).toEqual({ people: {}, orgs: [] });
  });

  it("the place's holder and law, read from the nearest place up that names one", () => {
    const s = world(), here = s.places.find((x) => x.id === s.player.placeId)!;
    const top = s.places.find((x) => x.id === here.parentId) ?? here;
    top.holder = { org: 'council' }; top.law = { org: 'council' };
    expect(ruleText(belongingView(s, seeing(s)).rule!)).toBe('Held by the Millbrook council, whose law runs here');
    here.law = { org: 'watch' };
    expect(here).not.toBe(top);
    expect(ruleText(belongingView(s, seeing(s)).rule!)).toBe('Held by the Millbrook council · The Millbrook Watch’s law runs here');
  });
});
