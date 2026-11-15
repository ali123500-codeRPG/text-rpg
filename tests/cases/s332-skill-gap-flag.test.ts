// When no skill fits a deed the player types, the Parser
// still picks the closest and says so (noSkillFits), and the game flags it every time (skill_gap, filed on the Bugs page),
// so missing skills are found as play goes on.
import { describe, expect, it, vi } from 'vitest';
import { intent, wholeTurn } from '../harness/turn';
import { openBugs, isBugCode } from '../../src/save/bugs';
import { checkIntent } from '../../src/agents/schema';
import { PARSER_INSTRUCTIONS } from '../../src/agents/prompts';
import { SK } from '../../src/library/skillIds';

const deed = (noSkillFits?: boolean) => intent({ action: { type: 'other', skill: SK.endurance, target: null, targetPart: null, item: null, mode: null, approach: 'pry the board off the hatch', stance: 'normal', ...(noSkillFits ? { noSkillFits } : {}) } });

describe('332 a deed no skill fits is flagged (skill_gap)', () => {
  it('the Parser may say noSkillFits, and is told when to', () => {
    expect(checkIntent(deed(true)).value.action?.noSkillFits).toBe(true);
    expect(checkIntent(deed()).value.action?.noSkillFits).toBeUndefined();
    expect(PARSER_INSTRUCTIONS).toContain('"noSkillFits": true');
    expect(isBugCode('skill_gap')).toBe(true);
  });
  it('a whole turn with noSkillFits files a skill_gap report with the player\'s words; one that fits files none', async () => {
    const t = wholeTurn();
    await t.turn(deed(), 'I lean on the door');
    await t.turn(deed(true), 'I pry the board off the hatch');
    await vi.waitFor(async () => {
      const gaps = (await openBugs(t.store)).filter((b) => b.code === 'skill_gap');
      expect(gaps.map((b) => b.words)).toEqual(['I pry the board off the hatch']);
      expect(gaps[0]).toMatchObject({ type: 'other', skill: SK.endurance });
    });
  });
});
