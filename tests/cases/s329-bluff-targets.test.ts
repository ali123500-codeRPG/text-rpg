// BG-329: a perk move's target list holds only those the engine would let it be used on. Bluff needs a foe (wary either
// way, perkMoves.ts), so an ally in reach is not offered, for the player's view and for an NPC agent's alike.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { buildPlayerView } from '../../src/views';
import { actorById } from '../../src/engine/relations';
import { PK } from '../../src/library/perkIds';

const fightWithAlly = () => {
  const s = makeVillage({ without: ['slime_1', 'slime_2', 'trader'] });
  const p = s.player, wim = actorById(s, 'patron_1')!;
  wim.mind!.overrides = { player: 'hostile' };
  wim.mind!.knowledge.player = { status: 'engaged', lastKnownZone: p.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  s.mode = 'tactical';
  p.engagement = { start: s.turn, last: s.turn, kinds: ['fight'] };
  p.core.perks.push({ perkId: PK.bluff, source: 'level', gainedTurn: 0 });
  const ally = place(s, 'guard_1', p.zone);
  ally.pos = { x: p.pos!.x - 0.8, y: p.pos!.y };
  ally.bandId = p.bandId;
  delete ally.asleep;
  ally.mind!.knowledge.player = { status: 'aware', source: 'seen', revealed: [], lastKnownZone: p.zone, lastSeenTurn: s.turn };
  return s;
};

describe('BG-329 Bluff targets', () => {
  it('the player is offered the foe in reach, not the ally beside them', () => {
    const s = fightWithAlly();
    const bluff = buildPlayerView(s).player.perkMoves?.find((m) => m.id === PK.bluff);
    expect(bluff?.inRange).toContain('patron_1');
    expect(bluff?.inRange).not.toContain('guard_1');
  });
});
