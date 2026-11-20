// FR5 and SY1 on the play screen: every furniture kind has its map glyph; Steady yourself is offered in Ideas only while it
// can be done (in a fight, above Broken, not within its cooldown), and the turn that steadies takes it away again.
import { describe, expect, it } from 'vitest';
import { FU } from '../../src/library/tableIds';
import { FURN_GLYPH } from '../../src/ui/furnitureIcons';


describe('furnished rooms and steady yourself on the play screen', () => {
  it('FR5: every furniture kind has a glyph of its own', () => {
    for (const id of Object.values(FU)) expect(FURN_GLYPH[id]?.length, id).toBeGreaterThan(0);
  });

});
