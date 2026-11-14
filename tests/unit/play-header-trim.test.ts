// Two trims of the Play screen: the heading names the zone you are in instead of the story's premise, and the turn that
// ends a scenario with gains leaves its Skills and XP rows out of the story, since the gains pop-up shows them in full.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { wholeTurn } from '../harness/turn';
import { intent } from '../cases/w4-kit';
import { buildPlayerView } from '../../src/views';

const play = (): string => readFileSync('src/ui/play.ts', 'utf8');

describe('play header and scenario-end trims', () => {
  it('the heading is the zone, with its place after the turn; the story title is not shown on Play', () => {
    const p = play();
    expect(p).toMatch(/h\('h1', \{\}, here\?\.here \|\| 'Play'/);
    expect(p).toMatch(/`Turn \$\{lastTurn\}`, here\?\.where \? ` · \$\{here\.where\}` : ''/);
    expect(p).not.toMatch(/meta\.title/);
  });

  it('a scenario-end turn with gains has no Skills or XP rows; other turns keep them', () => {
    const p = play();
    expect(p).toMatch(/const ended = anyGains\(l\.scenarioGains\);/);
    expect(p).toMatch(/const xp = ended \? \[\] :/);
    expect(p).toMatch(/const gains = ended \? \[\] :/);
  });

  it('a whole turn still names the zone the heading reads', async () => {
    const g = wholeTurn();
    await g.turn(intent({ action: { type: 'wait' } } as never));
    const pv = buildPlayerView(g.game.state()!);
    expect(pv?.zone.name).toBeTruthy();
  });
});

describe('sun tip with the clock', () => {
  it('the tip reads the day, the time of day and the clock to the second', async () => {
    const { todBadge } = await import('../../src/ui/timeOfDay');
    const { clockSecondsText } = await import('../../src/time');
    expect(clockSecondsText(7 * 60 + 30.25)).toBe('07:30:15');
    expect(clockSecondsText(24 * 60 + 5 / 60)).toBe('00:00:05');
    expect(readFileSync('src/ui/play.ts', 'utf8')).toMatch(/todBadge\(timeView\(s\)\.day, timeOfDay\(now\(s\)\), now\(s\)\)/);
    expect(typeof todBadge).toBe('function');
  });
});
