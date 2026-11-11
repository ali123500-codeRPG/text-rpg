// 176 From playtest run 39 (BG-22): "open the tavern door and step inside" walked 8.4 m along the lane, then into the
// common room, and the Narrator told it as stepping out into the lane and coming back in: a move event said only where
// each leg ended. Now a leg that leaves a zone says where it came from, and a leg inside a zone is marked within it.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { placeZones } from '../../src/scene/geometry';
import { placeAll } from '../../src/engine/position';
import { buildNarrationView } from '../../src/views';
import { fallbackNarration } from '../../src/agents/narration';
import { NARRATOR_INSTRUCTIONS } from '../../src/agents/prompts';
import { CONFIG } from '../../src/config';

describe('176 a move says where it came from (BG-22)', () => {
  it('a walk along the street to the tavern door, then inside: within the street, heading for the room; then from the street', () => {
    const s = makeVillage({ playerZone: 'street_door' });
    const zs = s.places.flatMap((p) => p.zones);
    for (const z of zs) z.area = CONFIG.ZONE_SIZE_M2[z.id.startsWith('field') ? 'open' : z.id.startsWith('street') || z.id.startsWith('gate') ? 'yard' : 'room'];
    placeZones(s, zs);
    placeAll(s);
    const street = zs.find((z) => z.id === 'street_door')!.rect!, room = zs.find((z) => z.id === 'tav_common')!.rect!;
    // the far side of the street from the tavern
    s.player.pos = { x: street.x + Math.sign(street.x - room.x) * (street.w / 2 - 0.5), y: street.y + Math.sign(street.y - room.y) * (street.d / 2 - 0.5) };
    const ev = play(s, { intent: intent({ move: { toZone: 'tav_common' } }) });
    expect(s.player.zone).toBe('tav_common');
    const v = buildNarrationView(s, ev, null);
    const moves = v.events.filter((e) => ev.some((g) => g.id === e.id && g.kind === 'move' && g.actorId === s.player.id));
    expect(moves.length).toBeGreaterThanOrEqual(2);
    const [first, last] = [moves[0], moves[moves.length - 1]];
    expect(first.within).toBe(true);
    expect(first.heading).toBe('common room');
    expect(first.from).toBeUndefined();
    expect(last.from).toBe(zs.find((z) => z.id === 'street_door')!.name);
    expect(last.where).toBe('common room');
    expect(last.within).toBeUndefined();
    const text = fallbackNarration(v).text;
    expect(text).toContain('toward common room');
    expect(text).toContain(`from ${last.from} to common room`);
  });

  it('the Narrator is told how to read from, within and heading', () => {
    expect(NARRATOR_INSTRUCTIONS).toMatch(/17\. A move event with from goes out of that zone into where\. One marked within stays inside where/);
  });
});
