// 353 BG-283: in deck playtest run 15 a slime crippled the hero's right arm, the arm that held the hand axe. The deck still
// offered "Attack → Hand axe"; the order came to nothing (wasted, not in hand) and the next slam killed the hero. A weapon
// still held but no usable grip can swing it (usableModes) is marked, and the deck leaves it out of "With what?".
import { expect, it } from 'vitest';
import { beside, makeVillage } from '../harness';
import { buildPlayerView } from '../../src/views';
import { deck } from '../../src/ui/deck';
import { IT } from '../../src/library/itemIds';

const armed = () => {
  const s = makeVillage({ playerZone: 'gate_inner', without: ['slime_2'] });
  s.player.core.inventory = s.player.core.inventory.filter((i) => !i.equippedIn?.some((x) => x.startsWith('grip:')));
  s.player.core.inventory.push({ id: 'axe_1', itemId: IT.hand_axe, equippedIn: ['grip:right_arm'] });
  beside(s, 'slime_1', 'player', 0.5);
  return s;
};
const withWhat = (s: ReturnType<typeof armed>): string[] => {
  const a = deck({ pv: buildPlayerView(s), s }).flatMap((g) => g.actions).find((x) => x.kind === 'attack')!;
  const step = a.steps.find((x) => x.key === 'item');
  return step && 'picks' in step && step.picks ? step.picks({ target: 'slime_1' }).map((p) => p.id) : [];
};

it('an axe in a crippled hand is marked and never offered to attack with', () => {
  const s = armed();
  expect(buildPlayerView(s).player.inventory.find((i) => i.id === 'axe_1')?.cantSwing).toBeUndefined();
  expect(withWhat(s)).toContain('axe_1');
  s.player.core.condition.parts.right_arm = -10; // Crippled
  expect(buildPlayerView(s).player.inventory.find((i) => i.id === 'axe_1')?.cantSwing).toBe(true);
  expect(withWhat(s)).not.toContain('axe_1');
});
