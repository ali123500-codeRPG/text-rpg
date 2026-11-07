import { describe, expect, it } from 'vitest';
import { fmtDate, visPass } from '../../src/ui/kit';
import { validateBuildLocal } from '../../src/ui/fakeGame';

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
    const skills = { melee_medium: 50, block: 40, dodge: 30, endurance: 50, sight: 30, hearing: 30, feint: 10, riposte: 10 };
    expect(validateBuildLocal({ name: 'A', skills, tagged: ['melee_medium', 'block', 'endurance'] })).toEqual([]);
    expect(validateBuildLocal({ name: 'A', skills: { ...skills, feint: 0 }, tagged: ['block'] }).length).toBe(2);
  });
});

describe('play screen extras (Voyage UI check, 07/11/2026)', async () => {
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
    expect(tierGap(1, 0)).toBe('1 tier ahead');
    expect(tierGap(-2, 1)).toBe('3 tiers behind');
    expect(tierGap(0, 0)).toBe('same tier');
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
