// When no skill fits a deed the player types, the Parser
// still picks the closest and says so (noSkillFits), and the game flags it every time (skill_gap, filed on the Bugs page),
// so missing skills are found as play goes on.
import { describe, expect, it } from 'vitest';
import { intent } from '../harness/turn';
import { isBugCode } from '../../src/save/bugs';
import { checkIntent } from '../../src/agents/schema';
import { PARSER_INSTRUCTIONS } from '../../src/agents/prompts';
import { SK } from '../../src/library/skillIds';

const deed = (noSkillFits?: boolean) => intent({ action: { type: 'other', skill: SK.endurance, target: null, targetPart: null, item: null, mode: null, approach: 'pry the board off the hatch', ...(noSkillFits ? { noSkillFits } : {}) } });

describe('332 a deed no skill fits is flagged (skill_gap)', () => {
  it('the Parser may say noSkillFits, and is told when to', () => {
    expect(checkIntent(deed(true)).value.action?.noSkillFits).toBe(true);
    expect(checkIntent(deed()).value.action?.noSkillFits).toBeUndefined();
    expect(PARSER_INSTRUCTIONS).toContain('"noSkillFits": true');
    expect(isBugCode('skill_gap')).toBe(true);
  });
});
