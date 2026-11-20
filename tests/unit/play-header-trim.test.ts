// The sun tip's clock: seconds rounded from fractional minutes, wrapping at midnight.
import { describe, expect, it } from 'vitest';
import { clockSecondsText } from '../../src/time';

describe('sun tip with the clock', () => {
  it('the tip reads the day, the time of day and the clock to the second', () => {
    expect(clockSecondsText(7 * 60 + 30.25)).toBe('07:30:15');
    expect(clockSecondsText(24 * 60 + 5 / 60)).toBe('00:00:05');
  });
});
