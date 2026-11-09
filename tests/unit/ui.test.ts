import { BT } from '../../src/library/raceIds';
import { describe, expect, it } from 'vitest';
import { fmtDate, visPass } from '../../src/ui/kit';
import { validateBuildLocal } from '../../src/ui/fakeGame';
import { SK } from '../../src/library/skillIds';

describe('ui helpers', () => {
  it('visibility: several Shown = either, Left out never passes', () => {
    expect(visPass('a', {})).toBe(true);
    expect(visPass('a', { a: 'shown', b: 'shown' })).toBe(true);
    expect(visPass('c', { a: 'shown' })).toBe(false);
    expect(visPass('a', { a: 'out' })).toBe(false);
    expect(visPass('b', { a: 'out' })).toBe(true);
  });
  it('dates are DD/MM/YYYY', () => {
    expect(fmtDate('2026-11-07T12:00:00')).toBe('07/11/2026');
  });
  it('the recommended build is valid and a short build is not', () => {
    const skills = { [SK.melee_medium]: 50, [SK.block]: 40, [SK.dodge]: 30, [SK.endurance]: 50, [SK.eyesight]: 30, [SK.earshot]: 30, [SK.feint]: 10, [SK.riposte]: 10 };
    expect(validateBuildLocal({ name: 'A', skills, tagged: [SK.melee_medium, SK.block, SK.endurance] })).toEqual([]);
    expect(validateBuildLocal({ name: 'A', skills: { ...skills, [SK.feint]: 0 }, tagged: [SK.block] }).length).toBe(2);
  });
});

describe('play screen extras (Voyage UI check)', async () => {
  const { makeVillage } = await import('../harness');
  const { buildPlayerView } = await import('../../src/views');
  const { ideas } = await import('../../src/ui/play');
  const { lineExtras, tierGap } = await import('../../src/agents/game');
  const { narrationView } = await import('./agent-views');

  it('ideas come only from PlayerView: people in view, exits, gear', () => {
    const s = makeVillage();
    const pv = buildPlayerView(s);
    const g = Object.fromEntries(ideas(pv).map((x) => [x.group, x.items.map((i) => i.text)]));
    const seen = pv.actors.filter((a) => a.level === 'full').map((a) => a.name ?? a.label);
    expect(g.Talk).toEqual(seen.slice(0, 3).map((n) => `Talk to ${n}`));
    expect(g.Move).toEqual(pv.zone.links.slice(0, 3).map((l) => `Go ${l.label}`));
    expect(g.Use.at(-1)).toBe('Look around');
    for (const list of Object.values(g)) expect(list.length).toBeLessThanOrEqual(3);
    // nobody outside the view: slimes in the field are not in the tavern
    expect(JSON.stringify(g)).not.toMatch(/slime/i);
  });
  it('tier gap in words', () => {
    expect(tierGap({ tier: 'great_success' }, { tier: 'success' })).toBe('1 tier ahead');
    expect(tierGap({ tier: 'failure' }, { tier: 'great_success' })).toBe('3 tiers behind');
    expect(tierGap({ tier: 'success' }, { tier: 'success' })).toBe('same tier');
  });
  it('heard lines show word for word unless the narration already quotes them; packets become turn changes', () => {
    const s = makeVillage();
    const nv = { ...narrationView(),
      heard: [{ speaker: 'a guard', text: 'Halt!', volume: 'shout' as const }, { speaker: 'Mags', text: 'Mind the step.', volume: 'normal' as const }],
      events: [{ id: 'e9', kind: 'attack', level: 'full' as const, cue: 'sight' as const, packet: {
        event: 'e9', actor: 'a slime', target: 'player', action: 'melee attack', weapon: null, armor: null, shield: null,
        attack: { tier: 'Success', natural: null, deciding: [] }, defense: null, outcome: 'full hit', location: { part: 'left arm', how: 'rolled' },
        changes: ['player is Bruised', "player's left arm is Damaged", 'a slime is Wounded'], events: [] } }] };
    const x = lineExtras(s, [], nv, 'Mags says, "Mind the step." The guard bellows.');
    expect(x.speech).toEqual([{ speaker: 'a guard', volume: 'shout', text: 'Halt!' }]);
    expect(x.changes).toEqual([
      { kind: 'combat', text: 'A slime → you · full hit, left arm' },
      { kind: 'health', text: 'You are Bruised' },
      { kind: 'condition', text: 'Your left arm is Damaged' },
      { kind: 'condition', text: 'A slime is Wounded' },
    ]);
    expect(x.check).toBeUndefined();
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

import { BODY_TYPES } from '../../src/library/data';
describe('body figure data', () => {
  it('a figure draws every part of its body type and the general area, and nothing else', () => {
    for (const ct of Object.values(BODY_TYPES)) {
      if (!ct.figure) continue;
      expect(Object.keys(ct.figure.parts).sort()).toEqual([...ct.parts.map((p) => p.id), 'general'].sort());
    }
    expect(BODY_TYPES[BT.humanoid].figure).toBeTruthy();
  });
});
