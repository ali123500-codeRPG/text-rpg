// Personality line prototype: builds the CHARACTER personality line from points, with no hand-written parts.
import {
  AXES, AXIS_ENDS, ARCHETYPES, ARCHETYPE_NO_VALUES_GAP, ARCHETYPE_VALUE_WEIGHT, DRIVE_RANK_WEIGHT, BUT_GAP, BUT_MIN, BUTS_SHOWN, DRIVES_SHOWN, NERVE_LEAN, NERVE_LINES, NERVE_PLUS_EVERY,
  NERVE_TIER_FROM, TENSIONS, TENSIONS_SHOWN, TRAIT_WORDS, VALUES, type Axes, type Axis, type Facts,
} from './tables';

export interface Character {
  key: string;
  /** blind name used in tests, so the model can't lean on the source */
  name: string;
  title?: string;
  role: string;
  bandGoals: string;
  temperament: string;
  tactics: string;
  nerve: number;
  resolve: number;
  axes: Axes;
  /** values ranked, strongest first */
  drives: string[];
  ageStage: Facts['ageStage'];
  skills: { name: string; value: number; fight?: boolean; attack?: boolean }[];
  /** hand-written if-then lines for unique characters; only shown in full mode */
  signatures?: string[];
  /** a unique template may pin its archetype instead of the nearest one */
  archetype?: string;
  /** which scenes to test: a folder under scenes/ and, optionally, only these scene files (no .json); default scenes/<key>/ */
  scenes?: { dir: string; only?: string[] };
}

const target = (a: (typeof ARCHETYPES)[number], axis: Axis) => a.target[axis] ?? 0;

/** how far the character's drives are from a type's values: 0 = the type's values are their top drives, 100 = none of them */
export function driveGap(drives: string[], values: string[] | undefined) {
  if (!values?.length) return ARCHETYPE_NO_VALUES_GAP;
  const w = (i: number) => DRIVE_RANK_WEIGHT[i] ?? DRIVE_RANK_WEIGHT[DRIVE_RANK_WEIGHT.length - 1];
  const got = values.reduce((s, v) => s + (drives.includes(v) ? w(drives.indexOf(v)) : 0), 0);
  const k = Math.min(values.length, drives.length);
  const best = Array.from({ length: k }, (_, i) => w(i)).reduce((a, b) => a + b, 0);
  return best ? 100 * (1 - got / best) : ARCHETYPE_NO_VALUES_GAP;
}

/** gap from each archetype over the six axes, Nerve and drives, nearest first (ties keep table order) */
export function archetypeGaps(c: Pick<Character, 'axes' | 'nerve' | 'drives'>) {
  return ARCHETYPES.map((a, i) => {
    const axes = AXES.reduce((s, ax) => s + Math.abs(c.axes[ax] - target(a, ax)), 0);
    const nerveGap = Math.abs(c.nerve - (a.nerve ?? 0));
    const drives = driveGap(c.drives, a.values);
    return { a, i, axes: axes / AXES.length, nerve: nerveGap, drives, gap: (axes + nerveGap + ARCHETYPE_VALUE_WEIGHT * drives) / (AXES.length + 1 + ARCHETYPE_VALUE_WEIGHT) };
  }).sort((x, y) => x.gap - y.gap || x.i - y.i);
}

/** axes far enough from the archetype to say "but": strong enough, far from the target, and not just a weaker version of it */
export function buts(axes: Axes, a: (typeof ARCHETYPES)[number]) {
  return AXES.map((ax, i) => ({ ax, i, v: axes[ax], t: target(a, ax), gap: Math.abs(axes[ax] - target(a, ax)) }))
    .filter((b) => Math.abs(b.v) >= BUT_MIN && b.gap >= BUT_GAP && (Math.sign(b.v) !== Math.sign(b.t) || Math.abs(b.v) > Math.abs(b.t)))
    .sort((x, y) => y.gap - x.gap || x.i - y.i)
    .slice(0, BUTS_SHOWN);
}

export function traitWord(ax: Axis, v: number) {
  const [word, hint] = v < 0 ? AXIS_ENDS[ax].low : AXIS_ENDS[ax].high;
  const strength = TRAIT_WORDS.find(([min]) => Math.abs(v) >= min)?.[1] ?? '';
  return `${strength}${word} (${hint})`;
}

export function nerve(c: Pick<Character, 'nerve' | 'resolve'>) {
  const line = c.nerve <= -NERVE_LEAN ? 'cautious' : c.nerve >= NERVE_LEAN ? 'daring' : 'steady';
  let tier = 0;
  NERVE_TIER_FROM.forEach((from, i) => { if (c.resolve >= from) tier = i; });
  const top = NERVE_TIER_FROM[NERVE_TIER_FROM.length - 1];
  const plus = c.resolve > top ? '+'.repeat(Math.floor((c.resolve - top) / NERVE_PLUS_EVERY)) : '';
  return { line: line as Facts['nerveLine'], word: NERVE_LINES[line].tiers[tier] + plus, hint: NERVE_LINES[line].hint };
}

export function facts(c: Character): Facts {
  const best = (ok: (s: Character['skills'][number]) => boolean) => Math.max(0, ...c.skills.filter(ok).map((s) => s.value));
  return {
    nerveLine: nerve(c).line, resolve: c.resolve, axes: c.axes, drives: c.drives, ageStage: c.ageStage,
    bestSkill: best(() => true), bestFight: best((s) => !!s.fight), bestAttack: best((s) => !!s.attack),
  };
}

const list = (xs: string[]) => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

/** everything the line is made from, for the explain report */
export function parts(c: Character) {
  const gaps = archetypeGaps(c);
  const arch = c.archetype ? ARCHETYPES.find((a) => a.key === c.archetype)! : gaps[0].a;
  if (!arch) throw new Error(`unknown archetype ${c.archetype}`);
  for (const d of c.drives) if (!VALUES[d]) throw new Error(`unknown value ${d}`);
  const f = facts(c);
  return {
    nerve: nerve(c), arch, pinned: !!c.archetype, gaps, buts: buts(c.axes, arch),
    drives: c.drives.slice(0, DRIVES_SHOWN),
    tensionsMet: TENSIONS.filter((t) => t.when(f)),
    tensions: TENSIONS.filter((t) => t.when(f)).slice(0, TENSIONS_SHOWN),
  };
}

/** the personality line the agent sees in CHARACTER; full mode puts signatures right after Nerve */
export function personalityLine(c: Character, opts: { morale?: string; full?: boolean } = {}) {
  const p = parts(c);
  const out: string[] = [`Nerve: ${p.nerve.word} (${p.nerve.hint}; ${opts.morale ?? 'Calm'} right now).`];
  if (opts.full && c.signatures?.length) out.push(...c.signatures);
  const butText = p.buts.length ? `, but ${list(p.buts.map((b) => traitWord(b.ax, b.v)))}` : '';
  out.push(`${p.arch.name} at heart (${p.arch.hint})${butText}.`);
  if (p.drives.length) {
    const d = p.drives.map((v, i) => `${v}${i === 0 && p.drives.length > 1 ? ' first' : ''} (${VALUES[v]})`);
    out.push(`Drives: ${d.join(', then ')}.`);
  }
  if (p.tensions.length) out.push(`Tensions: ${p.tensions.map((t) => `${t.name} (${t.hint})`).join('; ')}.`);
  return out.join(' ');
}
