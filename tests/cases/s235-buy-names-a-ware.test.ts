// BG-145 (run 97): "I pay the barkeep four copper for Wen's bread and stew" gave a buy with no ware, so the barkeep
// refused it and the coins sat on the counter. A buy that names no ware is the seller's only ware, or the player is
// asked which, never a refused buy.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent } from './w4-kit';
import { buildPlayerView } from '../../src/views';
import { checkParserLegality, illegalClarify } from '../../src/agents/legality';
import { actorById } from '../../src/engine/relations';
import { SV } from '../../src/library/serviceIds';

it('BG-145: a buy with no ware named is asked about, or is the only ware', () => {
  const s = makeVillage({ playerZone: 'tav_counter' });
  const mags = actorById(s, 'trader')!;
  mags.wares = { items: [], services: [SV.drink, SV.clinic] };
  const pv = buildPlayerView(s);
  const leg = checkParserLegality(intent({ action: { type: 'buy', target: 'trader', item: null } }), pv);
  expect(leg.illegal).toEqual(['action.ware trader']);
  expect(illegalClarify(leg.illegal, pv)).toMatch(/^Which do you want to buy: .+ or .+\?$/);
  mags.wares = { items: [], services: [SV.drink] };
  const one = checkParserLegality(intent({ action: { type: 'buy', target: 'trader', item: null } }), buildPlayerView(s));
  expect(one.illegal).toEqual([]);
  expect(one.intent.action?.item).toBe(buildPlayerView(s).actors.find((a) => a.id === 'trader')!.wares![0].id);
});
