import { TP } from '../../src/library/templateIds';
import { expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { spawnNpc } from '../../src/library/spawn';
import { installRoutines } from '../../src/minds';

function install(seed: number) {
  const s = makeVillage();
  s.turn = 50;
  const rng = createRng(seed);
  return ['g_a', 'g_b'].map((id) => {
    const g = spawnNpc(null, TP.guard, { id, zone: 'gate_inner', placeId: 'gate', bandId: 'village_watch' });
    installRoutines(g, 'gate_guard', { post: 'gate_inner' }, undefined, s.turn, rng);
    return g.mind!.routine!.anchorTurn;
  });
}

it('65 Phase from the RNG: seeded anchors, reproduced on replay', () => {
  const a = install(2024);
  for (const t of a) expect(t).toBeGreaterThan(50 - 12); // loop length: long = 12
  expect(install(2024)).toEqual(a);
  const many = new Set(Array.from({ length: 20 }, (_, i) => install(i).join(',')));
  expect(many.size).toBeGreaterThan(1);
});
