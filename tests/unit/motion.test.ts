// Play screen motion (Motion Rules Review): the pieces that don't need a browser. The turn line names the body parts
// that got worse (M-30), narration splits into sentences without changing its text (M-10), the sheet's before/after
// values see what changed (M-74), and every duration is a --m-* token with no glows anywhere (M-50, M-70).
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { partsWorse } from '../../src/agents/game';
import { partStates } from '../../src/ruleset';
import { sentences } from '../../src/ui/motion';
import { shownValues } from '../../src/ui/charsheet';

describe('play screen motion', () => {
  it('a turn line names only the parts that got worse', () => {
    const s = makeVillage();
    const before = partStates(s, s.player);
    s.player.core.condition.parts.right_arm = -10; // Crippled
    s.player.core.condition.parts.left_leg = 40; // Damaged
    expect(partsWorse(before, partStates(s, s.player))).toEqual([
      { id: 'left_leg', from: 'Healthy', to: 'Damaged' },
      { id: 'right_arm', from: 'Healthy', to: 'Crippled' },
    ].sort((a, b) => before.findIndex((p) => p.id === a.id) - before.findIndex((p) => p.id === b.id)));
    // getting better is the heal card's job, not this one
    const hurt = partStates(s, s.player);
    s.player.core.condition.parts.right_arm = 100;
    expect(partsWorse(hurt, partStates(s, s.player))).toEqual([]);
  });

  it('narration splits into sentences that rejoin to the same text', () => {
    const text = 'The slime lurches. “Watch your left!” the guard shouts… You raise the shield? It holds';
    const parts = sentences(text);
    expect(parts.length).toBe(4);
    expect(parts.join(' ')).toBe(text);
    expect(sentences('No end mark')).toEqual(['No end mark']);
  });

  it('the sheet’s shown values change with the state, so only real changes animate', () => {
    const s = makeVillage();
    const a = shownValues(s, s.player);
    expect(shownValues(s, s.player)).toEqual(a);
    s.player.core.condition.hpLostPct = 50;
    s.player.core.condition.parts.right_arm = -10;
    const b = shownValues(s, s.player);
    expect(b.level).not.toBe(a.level);
    expect(b.hpFill).toBeLessThan(a.hpFill);
    expect(b.parts.right_arm).toBe('Crippled');
    // the rail's perk-point badge is one of them, so it changes with the level-up beat, not before it
    s.player.progression = { ...(s.player.progression ?? {}), unspentPerkPoints: 1 } as typeof s.player.progression;
    expect(shownValues(s, s.player).points).toBe(1);
  });

  it('durations are --m-* tokens and nothing animates a glow or a shadow', () => {
    const css: string = readFileSync('src/ui/styles.css', 'utf8');
    for (const t of ['--m-feedback', '--m-state', '--m-beat', '--m-sentence', '--m-reveal-cap', '--m-stagger', '--m-results-cap', '--m-count', '--m-trail', '--m-scene', '--m-fall', '--m-ease', '--m-ease-exit'])
      expect(css).toContain(`${t}:`);
    for (const f of ['src/ui/motion.ts', 'src/ui/play.ts']) {
      const src: string = readFileSync(f, 'utf8');
      expect(src).not.toMatch(/box-?shadow|boxShadow|text-?shadow|drop-shadow/i);
      expect(src.match(/\b\d+(\.\d+)?m?s\b['"`]/g) ?? []).toEqual([]); // no literal "300ms" or "1.4s" strings
    }
  });
});
