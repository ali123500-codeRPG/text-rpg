import { describe, expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { TP } from '../../src/library/templateIds';
import { RO } from '../../src/library/npcLayerIds';
import { PF } from '../../src/library/npcLayerIds';
import { CL } from '../../src/library/classIds';
import { getLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';
import { spawnNpc, templateLevel } from '../../src/library/spawn';

const NEW = [TP.hunter, TP.healer, TP.headman, TP.knight, TP.bandit, TP.bandit_chief, TP.watch_sergeant, TP.pedlar, TP.hired_guard, TP.wolf, TP.boar, TP.bear, TP.dog, TP.dire_wolf];

describe('334 Named NPC presets for the rosters', () => {
  it('each new preset spawns as its race, role, theme and rank, with its level from the rank', () => {
    const s = makeVillage(), lib = getLibrary();
    for (const id of NEW) {
      const t = lib.templates[id];
      expect(t, id).toBeDefined();
      const kind = lib.npcRoles![t.roleId!].kind;
      expect(t.generation).toBe(kind === 'beast' ? 'copy' : 'rolled');
      expect(t.resolve).toBe(CONFIG.COMPOSED_NPC[kind].resolve);
      expect(templateLevel(t)).toBeGreaterThan(0);
      const a = spawnNpc(s, id, { id: `p_${id}`, zone: s.player.zone, placeId: s.player.placeId, bandId: 'b', storyId: s.storyId }, createRng(7));
      expect(a.core.templateId).toBe(id);
      expect(a.core.raceId).toBe(t.raceId);
    }
  });
  it('the knight is a Knight Trainee, the pedlar a Trader, the dire wolf a Dire wolf one rank above a wolf', () => {
    const t = getLibrary().templates;
    expect(t[TP.knight].classId).toBe(CL.knight_trainee);
    expect(t[TP.knight].roleId).toBe(RO.knight);
    expect(t[TP.pedlar].classId).toBe(CL.trader);
    expect(t[TP.dire_wolf].prefix).toBe(PF.dire);
    expect(t[TP.dire_wolf].raceId).toBe(t[TP.wolf].raceId);
  });
});
