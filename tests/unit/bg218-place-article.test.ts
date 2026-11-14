// BG-218: the Character card read "In the the Crooked Kettle": "the" was put before a place name that already had it.
// One rule (theName) for every place or zone name in a phrase: the card, and the agent player's where-you-are line.
import { describe, expect, it } from 'vitest';
import { theName } from '../../src/words';
import { surroundings } from '../../src/agents/autopilot';
import { makeVillage } from '../harness';
import { zoneById } from '../../src/engine/relations';

describe('BG-218 place names in a phrase', () => {
  it('adds "the" only to a plain common name', () => {
    expect(theName('the Crooked Kettle')).toBe('the Crooked Kettle');
    expect(theName('Thornbury')).toBe('Thornbury');
    expect(theName('behind the counter')).toBe('behind the counter');
    expect(theName('an old mill')).toBe('an old mill');
    expect(theName('common room')).toBe('the common room');
  });

  it('the agent player is told where it stands without a doubled "the"', () => {
    const s = makeVillage();
    zoneById(s, s.player.zone)!.name = 'the village square';
    expect(surroundings(s)).toContain('Where you are: the village square.');
    expect(surroundings(s)).not.toMatch(/the the /);
  });
});
