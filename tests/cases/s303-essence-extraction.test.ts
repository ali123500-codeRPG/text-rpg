// 303 DX1-DX6 ("Essences: bested foes, extraction, balance"): the blessing Extract Essence lets the player, as their action
// and within arm's reach, take the essence of someone Down who has broken or surrendered. No roll: it always appears and never
// fades, comes from the target's own list, is measured from its skills before the quirk, and uses up its one essence roll.
// The target is left Hollowed: double the essence's share lost in its skills, 10% off every skill, for good. DX6 a: it counts as an attack on the target.
import { expect, it } from 'vitest';
import type { Actor, GameState } from '../../src/types';
import { beside, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { CONFIG } from '../../src/config';
import { PK } from '../../src/library/perkIds';
import { trueSkill } from '../../src/ruleset/perks';
import { cantExtract } from '../../src/engine/extract';
import { gradeMult, rowsFor } from '../../src/engine/essence';

const down = (a: Actor) => { a.core.condition.hpLostPct = CONFIG.HEALTH_TRACK.find(([l]) => l === 'incapacitated')![1]; };
const setup = () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
  const g = beside(s, 'guard_1', 'player', 0.5);
  s.player.core.perks.push({ perkId: PK.extract_essence, source: 'class', gainedTurn: 0 });
  return { s, g };
};
const pull = (s: GameState) => play(s, { intent: intent({ action: { type: 'extract', target: 'guard_1' } }) });

it('DX2 c: only someone Down who has broken or surrendered; only with the blessing; within reach', () => {
  const { s, g } = setup();
  expect(cantExtract(s, s.player, g)).toBe('not_helpless'); // up and calm
  down(g);
  expect(cantExtract(s, s.player, g)).toBe('not_helpless'); // Down but not broken
  g.mind!.moraleState = 'surrendered';
  expect(cantExtract(s, s.player, g)).toBeNull();
  s.player.core.perks = s.player.core.perks.filter((p) => p.perkId !== PK.extract_essence);
  expect(cantExtract(s, s.player, g)).toBe('no_power');
});

it('DX3-DX5: the essence is offered with no roll and never fades; the target is Hollowed and its essence roll is spent', () => {
  const { s, g } = setup();
  down(g);
  g.mind!.moraleState = 'surrendered';
  const row = rowsFor(s, g)[0], sk = row.skills[0].skill, other = Object.keys(g.core.skills).find((k) => !row.skills.some((r) => r.skill === k) && trueSkill(g, k) > 0)!;
  const before = trueSkill(g, sk), otherBefore = trueSkill(g, other);
  const ev = pull(s);
  expect(ev.find((e) => e.kind === 'extract')?.target).toBe('guard_1');
  const o = s.player.progression!.essenceOffers!.find((x) => x.source === 'extract')!;
  expect(o.essence).toBe(row.id);
  expect(g.mind!.essenceRolled).toBe(true);
  expect(g.core.perks.some((p) => p.perkId === PK.hollowed)).toBe(true);
  const share = CONFIG.ESSENCE_SHARE * gradeMult(o.grade) * CONFIG.HOLLOWED_SHARE_MULT;
  expect(trueSkill(g, sk)).toBeCloseTo(before * (1 - share) * (1 - CONFIG.HOLLOWED_ALL_LOSS));
  expect(trueSkill(g, other)).toBeCloseTo(otherBefore * (1 - CONFIG.HOLLOWED_ALL_LOSS));
  expect(cantExtract(s, s.player, g)).toBe('no_essence'); // one essence, ever
});

it('DX6 a: extraction is an attack: the target and bandmates who see it turn hostile, with no second fear', () => {
  const { s, g } = setup();
  const mate = s.actors.find((x) => x.id === 'patron_1')!;
  g.bandId = mate.bandId; // a bandmate in the same room, watching the player
  mate.mind!.knowledge.player = { status: 'aware', source: 'seen', revealed: [] };
  down(g);
  mate.mind!.bodiesFound = [g.id]; // it watched g fall (BF65: so it does not come upon the body later)
  g.mind!.moraleState = 'surrendered';
  g.mind!.overrides = { player: 'yielded' };
  const lost = mate.core.condition.moraleLost ?? 0;
  const ev = pull(s).find((e) => e.kind === 'extract')!;
  expect(ev.perception[mate.id]?.level).toBe('full');
  expect(g.mind!.overrides!.player).toBe('hostile'); // Down, but it knows who did it
  expect(mate.mind!.overrides!.player).toBe('hostile');
  expect(mate.core.condition.moraleLost ?? 0).toBe(lost); // it already fell: "A bandmate goes down" is not paid again
});
