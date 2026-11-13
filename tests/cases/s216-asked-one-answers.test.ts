// BG-122: "Thanks Hobb, I'll find it. Marta, which table did he sit at?" named Hobb first, so Hobb took the band's one
// spokesperson slot and Marta, the one asked, never answered. The action's target now speaks for its band, whether
// the player names it, its band or everyone.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { selectSpokespeople } from '../../src/engine';
import { SK } from '../../src/library/skillIds';
import { intent } from './w4-kit';

describe('BG-122 the one asked answers for its band', () => {
  const setUp = () => {
    const s = makeVillage({ without: ['slime_1', 'slime_2', 'guard_1'] });
    place(s, 'patron_1', 'tav_common');
    s.player.zone = 'tav_common';
    return s;
  };
  const ask = (addressees: string[]) => intent({ action: { type: 'talk', skill: SK.persuasion, target: 'trader' }, spoken: 'Mags, which table did he sit at?', addressees });
  it('named after a bandmate', () => expect(selectSpokespeople(setUp(), ask(['patron_1', 'trader']))).toEqual(['trader']));
  it('through its band or everyone', () => {
    expect(selectSpokespeople(setUp(), ask(['tavern_folk']))).toEqual(['trader']);
    expect(selectSpokespeople(setUp(), ask(['everyone']))).toEqual(['trader']);
  });
});
