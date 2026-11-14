// Playtest runs 101, 77h and 79b: nothing warned the player as morale fell, nothing said Broken stops attacks or for how
// long, and nothing said what still works. The sheet's stakes line, the Ideas panel and the turn log say it now.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { buildPlayerView } from '../../src/views';
import { ideas } from '../../src/ui/play';
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

  it('with a broken nerve, Ideas trades Fight for a yield; no Flee (BF37)', () => {
    const s = makeVillage();
    const pv = buildPlayerView(s);
    expect(ideas(pv).some((g) => g.group === 'Fight')).toBe(true);
    const out = ideas(pv, true);
    expect(out.some((g) => g.group === 'Fight')).toBe(false);
    const away = out.find((g) => g.group.startsWith('Your nerve is broken'))!;
    expect(away.items.map((i) => i.text)).toEqual(['Yield', 'Hide']);
    expect(away.items.some((i) => /^Attack /.test(i.text))).toBe(false);
  });
});
