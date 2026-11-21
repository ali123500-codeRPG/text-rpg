// 415 BG-1493: the hero told to pull the essence out of a surrendered barkeep a step away stood still, and the extraction came
// to nothing as out of reach, 0 m short. The walk before a hands-on action reached as far as a hand-over does (both
// grip reaches), but an extraction needs the hero's own hand on them.
import { expect, it } from 'vitest';
import { beside, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { PK } from '../../src/library/perkIds';
import { distM } from '../../src/engine/position';
import { gripReachM } from '../../src/ruleset/body';

it('an extraction from someone surrendered a step away walks up to them and pulls the essence', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
  const g = beside(s, 'guard_1', 'player', 1.0);
  s.player.core.perks.push({ perkId: PK.extract_essence, source: 'class', gainedTurn: 0 });
  g.mind!.moraleState = 'surrendered';
  expect(distM(s, s.player, g)).toBeGreaterThan(gripReachM(s, s.player));
  const ev = play(s, { intent: intent({ action: { type: 'extract', target: 'guard_1' } }) });
  expect(ev.some((e) => e.actorId === 'player' && e.kind === 'wasted')).toBe(false);
  expect(ev.some((e) => e.actorId === 'player' && e.kind === 'extract')).toBe(true);
});
