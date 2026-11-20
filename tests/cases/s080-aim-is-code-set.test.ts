// Test 80: /aim (the Aim button) sets aimed for one turn only. Since BG-200 (BF26) the Parser may also mark an attack
// aimed when the player's words aim at a part (tests/cases/s282); a top-level aimed is still stripped, and the turn
// record's aimed is the button's.
import { describe, expect, it } from 'vitest';
import { checkIntent } from '../../src/agents';
import { intent } from './_w7';
import { SK } from '../../src/library/skillIds';

const attack = (over: Record<string, unknown> = {}) =>
  intent({ action: { type: 'attack', skill: SK.melee_medium, target: 'guard_1', targetPart: 'head', item: null, mode: null, approach: 'a cut at the head', ...over } });

describe('80 Aim is code-set', () => {
  it('a top-level "aimed" from the Parser is stripped by the schema; the action keeps its own (BG-200)', () => {
    const r = checkIntent({ ...attack({ aimed: true }), aimed: true });
    expect(r.errors).toEqual([]);
    expect(r.value).not.toHaveProperty('aimed');
    expect(r.value.action?.aimed).toBe(true);
  });

});
