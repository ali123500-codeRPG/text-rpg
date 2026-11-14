// WB9 a: every World builder, Weaver and Narrator call reads the one-page world lore first; other agents do not.
import { describe, expect, it } from 'vitest';
import { FIXED } from '../../src/agents/prompts';
import { WORLD_LORE } from '../../src/agents/worldLore';

describe('world lore in the fixed instructions', () => {
  it('leads the World builder, Weaver and Narrator instructions', () => {
    for (const k of ['narrator', 'weaver', 'checkin', 'window', 'region', 'world'] as const) expect(FIXED[k].startsWith(WORLD_LORE), k).toBe(true);
  });
  it('is not sent to the parser, planner, responder or voice', () => {
    for (const k of ['parser', 'planner', 'responder', 'voice'] as const) expect(FIXED[k]).not.toContain(WORLD_LORE);
  });
  it('stays short (calls are not cached)', () => {
    expect(WORLD_LORE.split(/\s+/).length).toBeLessThanOrEqual(350);
  });
  it('keeps the Thread hidden and gods away from it', () => {
    expect(WORLD_LORE).toMatch(/Never name or hint at it/);
    expect(WORLD_LORE).toMatch(/no god touches it/);
  });
});
