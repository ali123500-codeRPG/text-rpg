// Watch an agent play is a floating pop-up over the play screen, not a bar in the page: the header switch opens it, its head
// drags it, ✕ closes it and pauses the agent, and the agent's turns are still whole turns of the real game.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { wholeTurn } from '../harness/turn';
import { intent } from '../cases/w4-kit';

const src = (f: string): string => readFileSync(`src/ui/${f}`, 'utf8');

describe('agent pop-up', () => {
  it('the agent bar is a non-modal floating pop-up with a drag head and a close that pauses', () => {
    const a = src('autopilot.ts'), css = src('styles.css');
    expect(a).toMatch(/h\('aside', \{ class: 'auto', role: 'dialog', 'aria-modal': 'false'/);
    expect(a).toMatch(/el\.classList\.add\('dpop', 'auto-pop'\)/);
    expect(a).toMatch(/const close = \(\) => \{ pause\(''\); open = false; update\(\); \}/);
    expect(a).toMatch(/head\.addEventListener\('pointerdown'/);
    expect(css).not.toMatch(/\.playmain > \.auto\b/); // no longer a row of the play screen
  });

  it('whole turn: a turn the agent sends is an ordinary whole turn', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const t = g.game.state()!.turn;
    await g.turn(intent({ action: { type: 'wait' } }));
    expect(g.game.state()!.turn).toBe(t + 1);
  });
});
