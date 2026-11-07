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
