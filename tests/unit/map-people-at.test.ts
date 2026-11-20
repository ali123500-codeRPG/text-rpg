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

  it('MAP-69 whole turn: each person’s disc shows what is seen on them first, else what they are; someone not made out a hood', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!;
    await g.turn(intent(), 'I look around');
    const pv = buildPlayerView(s), shown = people(s);
    expect(shown.length).toBeGreaterThan(0);
    for (const p of shown) {
      const a = pv.actors.find((x) => x.id === p.id);
      if (!a || a.level !== 'full') { expect(p.icon).toBe('someone'); continue; }
      const held = a.gear.some((x) => x.where === 'held' || x.where === 'shield');
      // RM15 c: a plain human by the life stage they look, else their pronouns
      const plain = /^(Old|Venerable|Ancient)/.test(a.age ?? '') ? 'elder' : a.pronouns === 'he' ? 'man' : a.pronouns === 'she' ? 'woman' : 'person';
      if (!held && !a.gear.some((x) => x.where === 'armor') && !a.wares?.length) expect(p.icon).toBe(plain);
      if (held) expect(['sword', 'dagger', 'axe', 'spear', 'bow', 'crossbow', 'club', 'shield']).toContain(p.icon);
    }
  });
});

// BG-327: someone out of sight shows on the Map in the zone where they were last seen or heard (MAP-45)
describe('people last seen on the Map', () => {
  it('whole turn: the people left behind in the tavern show in their rooms, with no point', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!;
    await g.turn(intent(), 'I look around');
    for (let i = 0; i < 4 && s.player.zone === 'tav_common'; i++) await g.turn(intent({ move: { toZone: 'street_door' }, action: null }), 'I step out');
    const left = buildPlayerView(s).lastSeen ?? [];
    expect(left.map((x) => x.id).sort()).toEqual(['patron_1', 'trader']);
    for (const x of left) expect(people(s).find((p) => p.id === x.id)).toMatchObject({ zone: s.actors.find((a) => a.id === x.id)!.zone, now: false });
    for (const p of people(s).filter((x) => !x.now)) expect(p.at).toBeUndefined();
  });
});
