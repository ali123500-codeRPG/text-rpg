// YB2 to YB4: the player's band in PlayerView. A band-mate is anyone in the player's band (the engine's rule: the same
// bandId). In clear sight its health and morale show at every level (YB3 c); out of sight, the place it was last seen.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { buildPlayerView } from '../../src/views';
import { intent, play } from './w4-kit';

describe('YB2/YB3: band-mates in the player view', () => {
  it('a band-mate in sight shows health and morale a stranger keeps hidden; out of sight it is last seen, still marked', () => {
    const s = makeVillage({ without: ['slime_1', 'slime_2', 'guard_1'] });
    s.player.zone = 'tav_common';
    const wim = place(s, 'patron_1', 'tav_common'), mags = place(s, 'trader', 'tav_common');
    wim.bandId = s.player.bandId;
    for (const a of [wim, mags]) a.core.condition.hpLostPct = 20; // hurt, but above Wounded: hidden from strangers
    play(s, { intent: intent({ action: { type: 'observe', target: null } }) });
    let pv = buildPlayerView(s);
    const seenWim = pv.actors.find((a) => a.id === wim.id)!, seenMags = pv.actors.find((a) => a.id === mags.id)!;
    expect(seenWim).toMatchObject({ band: true, health: expect.any(String), morale: expect.any(String) });
    expect(seenMags.band).toBeUndefined();
    expect(seenMags.health).toBeUndefined();

    wim.zone = 'tav_cellar'; // he goes below, out of sight
    play(s, { intent: intent({ action: { type: 'observe', target: null } }) });
    pv = buildPlayerView(s);
    expect(pv.actors.some((a) => a.id === wim.id && a.level === 'full')).toBe(false);
    expect(pv.lastSeen?.find((x) => x.id === wim.id)).toMatchObject({ band: true, zone: 'tav_common' });
    expect(pv.lastSeen?.find((x) => x.id === mags.id)?.band).toBeUndefined();
  });
});
