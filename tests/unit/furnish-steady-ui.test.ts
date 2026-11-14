// FR5 and SY1 on the play screen: every furniture kind has its map glyph; Steady yourself is offered in Ideas only while it
// can be done (in a fight, above Broken, not within its cooldown), and the turn that steadies takes it away again.
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/types';
import { FU } from '../../src/library/tableIds';
import { FURN_GLYPH } from '../../src/ui/furnitureIcons';
import { deck } from '../../src/ui/deck';
import { buildPlayerView } from '../../src/views';
import { cantSteady } from '../../src/engine/steady';
import { actorById } from '../../src/engine/relations';
import { wholeTurn, intent } from '../harness/turn';

const fightOf = (g: ReturnType<typeof wholeTurn>) => g.game.state()!;
const foe = (s: GameState): GameState => {
  const m = actorById(s, 'patron_1')!.mind!;
  m.overrides = { player: 'hostile' };
  m.knowledge.player = { status: 'engaged', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  return s;
};
const offered = (s: GameState) => deck({ pv: buildPlayerView(s), s }).flatMap((g) => g.actions).some((a) => a.kind === 'steady');

describe('furnished rooms and steady yourself on the play screen', () => {
  it('FR5: every furniture kind has a glyph of its own', () => {
    for (const id of Object.values(FU)) expect(FURN_GLYPH[id]?.length, id).toBeGreaterThan(0);
  });

  it('SY1 whole turn: Ideas offers Steady yourself in a fight, and not again within its cooldown', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
    const s = foe(fightOf(g));
    expect(offered(s)).toBe(true);
    await g.turn(intent({ action: { type: 'steady' } as never }), 'I steady myself');
    foe(s);
    expect(cantSteady(s, s.player)).toBe('too_soon');
    expect(offered(s)).toBe(false);
  });

  it('SY1: no Steady yourself outside a fight', () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
    expect(offered(fightOf(g))).toBe(false);
  });
});
