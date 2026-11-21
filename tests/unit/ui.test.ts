import { describe, expect, it } from 'vitest';

describe('play screen extras (Voyage UI check)', async () => {
  const { makeVillage } = await import('../harness');
  const { buildPlayerView } = await import('../../src/views');
  const { deck } = await import('../../src/ui/deck');
  const { lineExtras, tierGap } = await import('../../src/agents/game');

  it('the action deck comes only from PlayerView: people in view, ways out, gear', () => {
    const s = makeVillage();
    const pv = buildPlayerView(s);
    const all = deck({ pv, s }).flatMap((g) => g.actions);
    const targets = (k: string) => { const a = all.find((x) => x.kind === k); return a && a.steps[0]?.key === 'target' ? a.steps[0].picks({}).map((p) => p.label) : []; };
    const seen = pv.actors.filter((a) => a.level === 'full').map((a) => (a.name ?? a.label).toLowerCase());
    expect(targets('talk').map((x) => x.toLowerCase())).toEqual(expect.arrayContaining(seen));
    expect(targets('go').map((x) => x.toLowerCase())).toEqual(expect.arrayContaining(pv.zone.links.filter((l) => !l.drop).map((l) => l.label.toLowerCase())));
    expect(all.map((a) => a.label)).toContain('Search'); // SE19, LX1: Search is the look around too
    expect(all.map((a) => a.label)).not.toContain('Look around');
    // nobody outside the view: slimes in the field are not in the tavern
    expect(JSON.stringify(all.flatMap((a) => a.steps.map((st) => (st.key === 'words' ? [] : st.picks({})))))).not.toMatch(/slime/i);
  });
});

describe('Journal page (U9)', async () => {
  const { makeVillage } = await import('../harness');
  const { journalPeople, journalPlaces } = await import('../../src/ui/pages');

  it('people: only clearly seen actors and learned names; no name until it is known', () => {
    const s = makeVillage();
    const people = journalPeople(s);
    expect(people.some((p) => p.id === 'slime_1')).toBe(false); // in the field, never met
    for (const p of people) if (!s.player.journal!.namesKnown.includes(p.id) && !s.actors.find((a) => a.id === p.id)!.knownOnSight) expect(p.name).toBe('–');
    s.player.journal!.namesKnown.push('slime_2');
    expect(journalPeople(s).find((p) => p.id === 'slime_2')).toMatchObject({ where: 'Not in view' });
  });
  it('places: where the character is and the places above it, plus places of witnessed facts', () => {
    const s = makeVillage();
    const names = journalPlaces(s).map((p) => p.id);
    expect(names).toContain(s.player.placeId);
    const other = s.places.find((p) => !names.includes(p.id))!;
    s.facts.push({ id: 'f1', storyId: 'test', placeId: other.id, turn: 1, text: 'The well is dry.', refs: [], source: 'rule', promotedTo: [] });
    expect(journalPlaces(s).map((p) => p.id)).not.toContain(other.id); // not witnessed
    s.player.journal!.factsWitnessed.push('f1');
    expect(journalPlaces(s).find((p) => p.id === other.id)?.facts).toEqual(['The well is dry.']);
  });
});
