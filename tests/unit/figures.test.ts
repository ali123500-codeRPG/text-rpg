// BV10 a, BV11 a, BV15 a: every figure file the game can load is there, and its parts are the body type's part ids.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getLibrary } from '../../src/library';
import { FIGURE_KEYS, figureKey } from '../../src/library/figureModels';

const file = (key: string) => `assets/figures/${key}.json`;
const parts = (key: string): string[] => Object.keys(JSON.parse(readFileSync(file(key), 'utf8')).parts);

describe('body figures', () => {
  it('has a file for every figure key', () => {
    for (const key of FIGURE_KEYS) expect(existsSync(file(key)), key).toBe(true);
  });
  it('splits each race figure into its body type part ids', () => {
    const lib = getLibrary();
    for (const [raceId, race] of Object.entries(lib.races ?? {})) {
      const body = lib.bodyTypes[race.bodyTypeId], key = figureKey(raceId, race.bodyTypeId);
      const ids = new Set(['general', ...body.parts.map((p) => p.id)]);
      expect(parts(key).filter((p) => !ids.has(p)), `${raceId} ${key}`).toEqual([]);
      // every part the rules can hit shows on the figure (a click names it)
      expect([...ids].filter((p) => !parts(key).includes(p)), `${raceId} ${key}`).toEqual([]);
    }
  });
});
