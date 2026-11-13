// The to-scale Map puts each person in full sight at their own point (Actor.pos); someone only heard or glimpsed, or last
// seen, has no point, since the player can't tell where in the zone they are.
import { describe, expect, it } from 'vitest';
import { knownMap } from '../../src/ui/mapData';
import { buildPlayerView } from '../../src/views';
import { wholeTurn, intent } from '../harness/turn';
import type { GameState } from '../../src/types';

const people = (s: GameState) => knownMap(s).places.flatMap((p) => p.zones).flatMap((z) => z.people.map((x) => ({ ...x, zone: z.id })));

describe('people at their own points on the Map', () => {
  it('whole turn: someone in full sight stands at their position; anyone not in full sight has no point', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!;
    await g.turn(intent(), 'I look around');
    const pv = buildPlayerView(s);
    const full = pv.actors.filter((a) => a.level === 'full' && s.actors.find((x) => x.id === a.id)?.pos);
    expect(full.length).toBeGreaterThan(0);
    for (const a of full) expect(people(s).find((p) => p.id === a.id)?.at).toEqual(s.actors.find((x) => x.id === a.id)!.pos);
    for (const a of pv.actors.filter((x) => x.level !== 'full')) expect(people(s).find((p) => p.id === a.id)?.at).toBeUndefined();
    for (const p of people(s).filter((x) => !x.now)) expect(p.at).toBeUndefined();
  });
});
