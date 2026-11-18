// TQ2: the soak run in every CI run (small) and nightly (large: SOAK_SEEDS, SOAK_TURNS), on the test village and on
// real Weaver worlds saved from playtests (tests/soak/worlds, added with scripts/soak-worlds.mjs).
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readdirSync, readFileSync } from 'node:fs';
import { makeVillage } from '../harness';
import { soak, type World } from './soak';
import { TURN_CHECK } from '../../src/save/turnCheck';
import { CONFIG } from '../../src/config';

// @ts-expect-error Node types are not installed; vitest runs in Node
const env = process.env as Record<string, string | undefined>;
const SEEDS = Number(env.SOAK_SEEDS ?? 2), TURNS = Number(env.SOAK_TURNS ?? 25), FIRST = Number(env.SOAK_FIRST_SEED ?? 1);
const DIR = 'tests/soak/worlds';
/** a saved world's schema version (its head's), 0 when it has none */
const schemaOf = (docs: Record<string, string>): number => {
  const head = Object.entries(docs).find(([k]) => k.endsWith('/control/head'))?.[1];
  return head ? Number((JSON.parse(head) as { schemaVersion?: number }).schemaVersion ?? 0) : 0;
};
const saved = (readdirSync(DIR) as string[]).filter((f) => f.endsWith('.json')).map((f) => ({ f, docs: JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) as Record<string, string> }));
// MG2: a world saved before OLDEST_SAVE_SCHEMA can't be loaded (the prototype keeps no old saves); its file stays, and its
// runs are skipped until a playtest on today's schema saves a world to soak instead
const tooOld = saved.filter((w) => schemaOf(w.docs) < CONFIG.OLDEST_SAVE_SCHEMA).map((w) => w.f.replace(/\.json$/, ''));
const worlds: World[] = [
  { name: 'village', load: () => makeVillage() },
  ...saved.filter((w) => schemaOf(w.docs) >= CONFIG.OLDEST_SAVE_SCHEMA).map(({ f, docs }): World => ({
    name: f.replace(/\.json$/, ''),
    load: (store) => { for (const [k, v] of Object.entries(docs)) store.docs.set(k, v); return null; },
  })),
];

describe('soak run (TQ2)', () => {
  it('runs with the strict turn checker, so a broken world rule fails it', () => expect(TURN_CHECK.strict).toBe(true));
  it('is repeatable: the same world and seed play the same turns', async () => {
    const [a, b] = [await soak(worlds[0], 7, 15), await soak(worlds[0], 7, 15)];
    expect(a.fingerprint).toBe(b.fingerprint);
  }, 120_000);
  for (const name of tooOld) it.skip(`${name}: saved before schema ${CONFIG.OLDEST_SAVE_SCHEMA}, so it can't be loaded`, () => {});
  for (const w of worlds) for (let seed = FIRST; seed < FIRST + SEEDS; seed++) {
    it(`${w.name}, seed ${seed}: ${TURNS} random turns break no world rule`, async () => {
      const r = await soak(w, seed, TURNS);
      expect(r.played).toBe(TURNS); // a fall starts the world again, so every seed plays the whole budget
    }, 120_000);
  }
});
