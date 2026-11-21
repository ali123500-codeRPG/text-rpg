// MG4: a birth day is set where an actor is made, never filled in on load. Every spawn path of a race with life stages
// sets one: a library template (copy or rolled), an echo of a fallen hero (a unique), and the player at creation.
import { afterEach, describe, expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { getLibrary, setLibrary } from '../../src/library';
import { createPlayer, recommendedBuild, spawnNpc } from '../../src/library/spawn';
import { echoSheet, uniqueTemplate } from '../../src/library/echo';
import { RC } from '../../src/library/raceIds';

const lib0 = getLibrary();
afterEach(() => setLibrary(lib0));
const aged = (raceId?: string) => !!(raceId && getLibrary().races?.[raceId]?.ageStages);

describe('born day at spawn (MG4)', () => {
  it('every library template of a race with life stages spawns with a birth day, and the player is made with one', () => {
    const s = makeVillage();
    const ts = Object.values(getLibrary().templates).filter((t) => aged(t.raceId));
    expect(ts.length).toBeGreaterThan(0);
    for (const t of ts) {
      const a = spawnNpc(s, t.id, { id: `b_${t.id}`, zone: s.player.zone, placeId: s.player.placeId, bandId: 'b', storyId: s.storyId }, createRng(3));
      expect(a.core.bornDay, t.id).toBeTypeOf('number');
    }
    expect(createPlayer(recommendedBuild(), 's1').core.bornDay).toBeTypeOf('number'); // and the player at creation
  });

  it('an echo of a fallen hero spawns with a birth day', () => {
    const s = makeVillage();
    s.player.core.bornDay = -9000; // the hero's age at its fall
    const id = 'unique_born_day';
    setLibrary({ ...lib0, templates: { ...lib0.templates, [id]: uniqueTemplate(id, RC.human, 'a grim swordsman', echoSheet(s, s.player, id, 'test')) } });
    const e = spawnNpc(s, id, { id: 'echo_1', zone: s.player.zone, placeId: s.player.placeId, bandId: 'b', label: 'a grim swordsman', name: 'Echo' });
    expect(e.core.bornDay).toBeTypeOf('number');
  });
});
