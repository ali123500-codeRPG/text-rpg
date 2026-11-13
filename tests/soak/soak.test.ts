// TQ2: the soak run in every CI run (small) and nightly (large: SOAK_SEEDS, SOAK_TURNS), on the test village and on
// real Weaver worlds saved from playtests (tests/soak/worlds, added with scripts/soak-worlds.mjs).
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readdirSync, readFileSync } from 'node:fs';
import { makeVillage } from '../harness';
import { soak, type World } from './soak';

// @ts-expect-error Node types are not installed; vitest runs in Node
const env = process.env as Record<string, string | undefined>;
const SEEDS = Number(env.SOAK_SEEDS ?? 2), TURNS = Number(env.SOAK_TURNS ?? 25), FIRST = Number(env.SOAK_FIRST_SEED ?? 1);
const DIR = 'tests/soak/worlds';
const worlds: World[] = [
  { name: 'village', load: () => makeVillage() },
  ...(readdirSync(DIR) as string[]).filter((f) => f.endsWith('.json')).map((f): World => ({
    name: f.replace(/\.json$/, ''),
    load: (store) => { for (const [k, v] of Object.entries(JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) as Record<string, string>)) store.docs.set(k, v); return null; },
  })),
];

describe('soak run (TQ2)', () => {
  for (const w of worlds) for (let seed = FIRST; seed < FIRST + SEEDS; seed++) {
    it(`${w.name}, seed ${seed}: ${TURNS} random turns break no world rule`, async () => {
      expect(await soak(w, seed, TURNS)).toBeGreaterThan(0);
    }, 120_000);
  }
});
