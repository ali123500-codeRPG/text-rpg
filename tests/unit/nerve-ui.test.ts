// Playtest runs 101, 77h and 79b: nothing warned the player as morale fell, nothing said Broken stops attacks or for how
// long, and nothing said what still works. The sheet's stakes line, the action deck and the turn log say it now.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { buildPlayerView } from '../../src/views';
import { deck } from '../../src/ui/deck';
import { moraleHint } from '../../src/ui/charsheet';
import { CONFIG } from '../../src/config';
import { MORALE_LEVELS } from '../../src/scales';
import { engagementEndS } from '../../src/ruleset/actionTime';

describe('morale stakes and a broken nerve on the play screen', () => {
  it('the stakes line starts at MORALE_HINT_FROM, names the roll penalty, and says what Broken stops and how it passes', () => {
    const from = MORALE_LEVELS.pos(CONFIG.MORALE_HINT_FROM as never);
    for (const k of MORALE_LEVELS.keys) expect(moraleHint(k) === null).toBe(MORALE_LEVELS.pos(k) < from);
    expect(moraleHint('terrified')).toMatch(/^−10 on every roll\. If your nerve breaks: you won't be able to walk away or attack\.$/);
    expect(moraleHint('panicking')).toMatch(/^−15 on every roll\. One more fright and your nerve breaks/);
    expect(moraleHint('broken')).toContain(`no one has fought you for ${engagementEndS()} s`);
    expect(moraleHint('broken')).toContain('You can still talk, beg, yield, give, hide'); // BF37
  });

  it('with a broken nerve, the deck trades Fight and Move for a yield and a sneak; no Flee (BF37)', () => {
    const s = makeVillage();
    const pv = buildPlayerView(s);
    expect(deck({ pv, s }).some((g) => g.group === 'fight')).toBe(true);
    const out = deck({ pv, s, broken: true });
    expect(out.some((g) => g.group === 'fight' || g.group === 'move')).toBe(false);
    expect(out[0].name).toMatch(/^Your nerve is broken/);
    expect(out[0].actions.map((a) => a.kind)).toEqual(['yield', 'sneak']);
    expect(out.flatMap((g) => g.actions).some((a) => a.kind === 'attack')).toBe(false);
  });
});
