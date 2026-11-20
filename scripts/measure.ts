// Balance probe from the command line (tests/harness/measure.ts): how often a searcher finds a still hider at an exact
// distance, searching and waiting, with the search reach behind it. Same arguments, same result.
//   npm run measure -- --searcher guard --hider player --m 9 [--modes search,wait] [--trials 300] [--turns 1] [--seed 1]
//     [--zone street_square] [--searcher-id guard_x] [--hider-id …] [--searcher-perk <id or name>]… [--hider-perk …]…
//     [--set KEY=VALUE]… [--json]
import { measure, report, type Scenario } from '../tests/harness/measure';

const argv = process.argv.slice(2);
const arg = (k: string, d?: string): string => {
  const i = argv.indexOf(`--${k}`);
  if (i >= 0 && argv[i + 1] !== undefined) return argv[i + 1];
  if (d === undefined) throw new Error(`measure: --${k} is needed`);
  return d;
};
const all = (k: string): string[] => argv.flatMap((x, i) => (x === `--${k}` ? [argv[i + 1]] : []));
const num = (k: string, d: string): number => { const n = Number(arg(k, d)); if (!Number.isFinite(n)) throw new Error(`measure: --${k} must be a number`); return n; };
const value = (v: string): number | boolean | string => (v === 'true' ? true : v === 'false' ? false : Number.isNaN(Number(v)) ? v : Number(v));

const modes = arg('modes', 'search,wait').split(',') as Scenario['modes'];
if (modes.some((x) => x !== 'search' && x !== 'wait')) throw new Error('measure: --modes takes search and/or wait');
const m = measure({
  searcher: { who: arg('searcher'), id: arg('searcher-id', 'searcher'), perks: all('searcher-perk') },
  hider: { who: arg('hider'), id: arg('hider-id', 'hider'), perks: all('hider-perk') },
  distanceM: num('m', ''), modes,
  trials: num('trials', '300'), turns: num('turns', '1'), seed: num('seed', '1'), zone: arg('zone', 'street_square'),
  set: Object.fromEntries(all('set').map((x) => { const [k, v] = x.split('='); return [k, value(v)]; })),
});
console.log(argv.includes('--json') ? JSON.stringify(m, null, 2) : report(m));
if (m.deviations.length) process.exitCode = 2; // a deviation is never a clean result
