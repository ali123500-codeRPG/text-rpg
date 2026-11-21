// 426 D-1768 step 1 (BEL-61): the belonging records exist and are filled, and nothing reads them yet. A recipe's lead is
// its group's leader and its seconds the officers (BEL-09); organizations, links, ties and a place's holder and law are
// kept by the save (BEL-01 to BEL-15); the seat field is code's own, so the Weaver cannot set it.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import type { Head } from '../../src/types';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { fromPages, toPages } from '../../src/save/pages';
import { checkStagePlan } from '../../src/agents/schema';
import { GP } from '../../src/library/npcLayerIds';

const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };

describe('426 belonging records, step 1', () => {
  it("a recipe's lead leads its group and its seconds are the officers", () => {
    const s = toStoryStart(makeVillage());
    const p = villageStagePlan();
    p.cast.push({ key: 'co', group: { id: GP.bandit_company, rank: 'Trained' }, label: 'the bandit captain', name: 'Varn', appearance: 'a scarred man',
      band: 'village_watch', routineSetId: 'gate_guard', slots: { post: 'street_door' }, awarenessOfPlayer: 'unaware', motive: 'takes the road' } as never);
    expect(validateStagePlan(s, p, ctx)).toEqual([]);
    applyStagePlan(s, p, ctx, { entry: 'open' }, createRng(1));
    const captain = s.actors.find((a) => a.names.current === 'Varn')!;
    const g = s.bands.find((b) => b.id === captain.bandId)!;
    expect(g.leaderId).toBe(captain.id);
    const chiefs = s.actors.filter((a) => a.bandId === g.id && a.label === 'a gang chief').map((a) => a.id);
    expect(chiefs.length).toBe(2);
    expect(g.officerIds).toEqual(chiefs);
    // a band with no recipe in it has no leader: nothing is made up
    for (const b of s.bands) if (b.id !== g.id) expect(b.leaderId, b.id).toBeUndefined();
    // the Weaver's own output loses the code-only seat
    const w = villageStagePlan();
    (w.cast[0] as { seat?: string }).seat = 'leader';
    expect((checkStagePlan(structuredClone(w)).value.cast[0] as { seat?: string }).seat).toBeUndefined();
  });

  it('the save keeps organizations, links, ties, the group fields and a place holder', () => {
    const s = toStoryStart(makeVillage());
    const p = villageStagePlan();
    expect(validateStagePlan(s, p, ctx)).toEqual([]);
    applyStagePlan(s, p, ctx, { entry: 'open' }, createRng(1));
    const a = s.player, place = s.places[0], band = s.bands.find((b) => b.id === a.bandId)!;
    s.organizations = [
      { id: 'org_crown', name: 'the Crown', kind: 'realm', strangers: 'neutral' },
      { id: 'org_watch', name: 'the Watch', kind: 'watch', parentId: 'org_crown', headId: a.id, seat: place.id, closeKnit: true, stances: { org_gang: 'hostile' } },
    ];
    s.orgLinks = [{ id: 'lk1', a: { org: 'org_watch' }, b: { person: a.id }, kind: 'hired_by', cover: 'quiet' }];
    a.ties = [{ to: { org: 'org_watch' }, status: 'member', commitment: 'sworn', cover: 'open', title: 'captain', since: 0 }];
    Object.assign(band, { purpose: 'keep the gate', leaderId: a.id, officerIds: [], backer: { org: 'org_watch' } });
    place.holder = { org: 'org_crown' }; place.law = { person: a.id };
    const back = fromPages(s.meta, { libraryVersion: s.libraryVersion } as Head, toPages(s));
    expect(back.organizations).toEqual(s.organizations);
    expect(back.orgLinks).toEqual(s.orgLinks);
    expect(back.player.ties).toEqual(a.ties);
    expect(back.bands.find((b) => b.id === band.id)).toMatchObject({ purpose: 'keep the gate', leaderId: a.id, backer: { org: 'org_watch' } });
    expect(back.places.find((x) => x.id === place.id)).toMatchObject({ holder: { org: 'org_crown' }, law: { person: a.id } });
    // a story without any keeps no empty lists
    const bare = toStoryStart(makeVillage());
    const again = fromPages(bare.meta, { libraryVersion: bare.libraryVersion } as Head, toPages(bare));
    expect(again.organizations).toBeUndefined();
    expect(again.orgLinks).toBeUndefined();
  });
});
