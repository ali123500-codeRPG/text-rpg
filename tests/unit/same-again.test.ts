// BG-190: Same again offers the last order that played out, skipping a clarify and / commands.
import { describe, expect, it } from 'vitest';
import { lastOrder } from '../../src/ui/play';
import type { LogLine } from '../../src/types';
import { wholeTurn, intent } from '../harness/turn';

const L = (kind: string, text: string): LogLine => ({ turn: 1, kind, text } as LogLine);

describe('Same again', () => {
  it('skips an order the game asked about and / commands', () => {
    expect(lastOrder([])).toBeNull();
    expect(lastOrder([L('player', 'I sneak while following the lean man'), L('narration', 'You slip out…'), L('player', 'continue'), L('clarify', 'Continue with what?')])).toBe('I sneak while following the lean man');
    expect(lastOrder([L('player', 'I look around'), L('narration', 'The room…'), L('player', '/stats'), L('narration', 'Stats…')])).toBe('I look around');
  });

  it('whole turn: after a played turn it offers that turn\'s words', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    await g.turn(intent(), 'I watch the door');
    expect(lastOrder(g.game.lines())).toBe('I watch the door');
  });
});
