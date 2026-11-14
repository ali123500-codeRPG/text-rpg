// The Journal's People table lists names heard of people the player has never met (PlayerView.heardOf), under "Heard of";
// once the player knows the person, they move up to People and leave the Heard of list.
import { describe, expect, it } from 'vitest';
import { wholeTurn, intent } from '../harness/turn';
import { place } from '../harness';
import { heardOfNames, journalPeople } from '../../src/ui/pages';

describe('Heard of on the Journal', () => {
  it('whole turn: a name heard of someone out of sight is listed; once met and known, it is listed with People instead', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!;
    const mags = s.actors.find((a) => a.id === 'trader')!;
    mags.knownOnSight = undefined;
    place(s, 'trader', 'tav_cellar');
    s.player.journal!.heardOf = ['trader'];
    await g.turn(intent(), 'I look around');
    expect(heardOfNames(g.game.state()!)).toEqual(['Mags']);
    expect(journalPeople(g.game.state()!).some((p) => p.name === 'Mags')).toBe(false);
    s.player.journal!.namesKnown.push('trader');
    s.player.journal!.heardOf = ['trader']; // still on the heard list, but known now: the table shows Mags once, with People
    await g.turn(intent(), 'I look around');
    expect(journalPeople(g.game.state()!).some((p) => p.name === 'Mags')).toBe(true);
    expect(heardOfNames(g.game.state()!)).toEqual([]);
  });
});
