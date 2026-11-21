import { describe, expect, it } from 'vitest';
import { keyCap, labelled, tint, tipEdge, tipPlain } from '../../src/ui/kit';
import { changeTone, TONE } from '../../src/ui/tipTones';

// PS-497/PS-498: a tip's coloured words, labels and keys are marks the page's tip draws; the words alone reach screen readers
describe('tip tints', () => {
  it('a tinted word reads as the word alone', () => {
    expect(tipPlain(`${tint('ok', 'Healthy')} and well`)).toBe('Healthy and well');
    expect(tint(undefined, 'plain')).toBe('plain');
  });
  it('HU7: a label keeps its colon for screen readers only', () => {
    const t = labelled('Health', tint('lv3', 'Hurt'));
    expect(tipPlain(t)).toBe('Health: Hurt');
    expect(t).not.toContain('Health:');
  });
  it('HU9: a key cap reads as the key', () => {
    expect(tipPlain(`Close ${keyCap('Esc')}`)).toBe('Close Esc');
  });
  it('HU8: the edge takes the first coloured word, never a label or a key', () => {
    expect(tipEdge(labelled('Morale', tint(TONE.morale, 'Shaken')))).toBe(TONE.morale);
    expect(tipEdge(`${keyCap('Ctrl')}+click, ${tint('c3', 'Alchemy')} then ${tint('ok', 'Free')}`)).toBe('c3');
    expect(tipEdge(`Close ${keyCap('Esc')}`)).toBeUndefined();
    expect(tipEdge('plain words')).toBeUndefined();
  });
  it('HU4: a gain is green, a loss red', () => {
    expect(changeTone(true)).toBe('ok');
    expect(changeTone(false)).toBe('danger');
  });
});
