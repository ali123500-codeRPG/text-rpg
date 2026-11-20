// Nerve and personality (PL1–PL19): Nerve line and tier, trait words, the archetype, "but" traits, tensions, rewards that
// add points, the agent's CHARACTER line (rows checked against the voice-tested prototype), and the Weaver's pick.
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { getLibrary, npcTemplate } from '../../src/library';
import { presetPersonality, spawnNpc } from '../../src/library/spawn';
import { PA, PY, VL } from '../../src/library/tableIds';
import { TP } from '../../src/library/templateIds';
import { ACH } from '../../src/library/achievementIds';
import { SK } from '../../src/library/skillIds';
import { archetypeOf, butsOf, nerveLine, personalityFrom, personalityOf, personalityText } from '../../src/ruleset/personality';
import { makeVillage } from '../harness';
import { formatDialogueView, formatOppositionView } from '../../src/agents/format';
import type { Actor } from '../../src/types';
import { actorView } from './agent-views';

// the preset's centre personality, without the copy's spread (NG14), so the words below are the layers'
const npc = (tp: string) => { const a = spawnNpc(null, tp, { id: 'x', zone: 'z', placeId: 'p', bandId: 'b' }); a.core.personality = presetPersonality(npcTemplate(null, tp)); return a; };

describe('Nerve', () => {
  it('leans at PERSONALITY_LEAN: cautious, steady, daring', () => {
    expect(nerveLine({ nerve: -CONFIG.PERSONALITY_LEAN, traits: {}, values: [] })).toBe('cautious');
    expect(nerveLine({ nerve: CONFIG.PERSONALITY_LEAN - 1, traits: {}, values: [] })).toBe('steady');
    expect(nerveLine({ nerve: CONFIG.PERSONALITY_LEAN, traits: {}, values: [] })).toBe('daring');
  });
});

describe('personality', () => {
  it('the archetype is the nearest type, drives counted twice; "but" traits are the ones it does not explain', () => {
    // Corin (the Mera voice tests): Mature at heart, but humble and earnest
    const corin = { nerve: -10, traits: { [PA.honesty]: 50, [PA.pride]: -40, [PA.temper]: -40, [PA.discipline]: 70, [PA.levity]: -40 }, values: [VL.loyalty, VL.duty, VL.family] };
    expect(archetypeOf(corin).id).toBe(PY.mature);
    expect(butsOf(corin, archetypeOf(corin))).toEqual([{ axis: PA.pride, v: -40 }, { axis: PA.levity, v: -40 }]);
    // no lean at all is Ordinary, the first row (ties go to the earlier row)
    expect(archetypeOf({ nerve: 0, traits: {}, values: [] }).id).toBe(PY.ordinary);
  });
  it('perks, the current class and achievements add points while held (PL15, PL16)', () => {
    const a = npc(TP.guard);
    const lib = getLibrary();
    const perk = a.core.perks[0]?.perkId ?? Object.keys(lib.perks)[0];
    if (!a.core.perks.length) a.core.perks.push({ perkId: perk, source: 'template', gainedTurn: 0 });
    const before = lib.perks[perk].personality;
    lib.perks[perk].personality = { nerve: 10, [PA.pride]: 15 };
    try {
      const p = personalityOf(a);
      expect(p.nerve).toBe(10);
      expect(p.traits[PA.pride]).toBe(15);
      expect(p.traits[PA.discipline]).toBe(40 + CONFIG.ACH_PERSONALITY_STEP); // the template's 40, and the current Guard class's step (PN5)
      expect(a.core.personality!.nerve).toBe(0); // the stored points don't change
    } finally { lib.perks[perk].personality = before; }
  });
  it('the agent reads it in CHARACTER; the Voice never does', () => {
    const s = makeVillage(), guard = npc(TP.guard);
    expect(personalityText(s, guard, 'Tense')).toBe('Nerve: Steady (neither seeks nor flees danger; Tense right now). Mature at heart (thinks before acting, keeps a cool head, owns their mistakes). Drives: duty (does what is expected of them, sees obligations through).');
    const v = actorView();
    expect(formatOppositionView(v)).toContain(`"personality":"${v.personality}"`);
    expect(formatOppositionView(v).split(v.personality).length).toBe(2); // once, in CHARACTER only
    expect(formatDialogueView({ ...v, knows: [], dialogue: [] })).not.toContain(v.personality);
  });
  it('the Weaver may name a line, types and values on top of the template (PL12)', () => {
    const t = npcTemplate(null, TP.guard);
    const p = personalityFrom(presetPersonality(t), { nerve: 'daring', types: [PY.childish, 'nonsense'], values: [VL.family, 'VL999'] });
    expect(p.nerve).toBe(CONFIG.NERVE_LINE_POINTS);
    expect(p.traits[PA.discipline]).toBe(-70); // Childish's target
    expect(p.traits[PA.temper]).toBe(30);
    expect(personalityFrom({ nerve: 0, traits: { [PA.temper]: 50 }, values: [] }, { types: [PY.childish] }).traits[PA.temper]).toBe(50); // already past it
    expect(p.values).toEqual([VL.family]);
    expect(presetPersonality(t).traits[PA.discipline]).toBe(40); // the layers are untouched (the soldier role's lean)
  });
});

describe('achievement personality points (AP1-AP20)', () => {
  const STEP = CONFIG.ACH_PERSONALITY_STEP;
  const earn = (a: Actor, ...rows: { key: string; of?: string }[]) => {
    a.progression = { ...(a.progression ?? {}), achievements: rows.map((r) => ({ id: r.key, ...r, turn: 0 })) } as Actor['progression'];
    return a;
  };
  it('a held chain level adds its own step plus every lower level by reference (AP1)', () => {
    const base = personalityOf(npc(TP.guard));
    const p = personalityOf(earn(npc(TP.guard), { key: ACH.unaware_50 }));
    expect((p.traits[PA.honesty] ?? 0) - (base.traits[PA.honesty] ?? 0)).toBe(-3 * STEP);
  });
  it('a by-skill row adds its per-skill points only for the skill it was earned with (AP12)', () => {
    const base = personalityOf(npc(TP.guard));
    const lie = personalityOf(earn(npc(TP.guard), { key: ACH.speech_10, of: SK.falsehood }));
    const talk = personalityOf(earn(npc(TP.guard), { key: ACH.speech_10, of: SK.persuasion }));
    const d = (p: typeof base, k: string) => (p.traits[k] ?? 0) - (base.traits[k] ?? 0);
    expect(d(lie, PA.sociability)).toBe(STEP);
    expect(d(lie, PA.honesty)).toBe(-STEP);
    expect(d(talk, PA.sociability)).toBe(STEP);
    expect(d(talk, PA.honesty)).toBe(0);
  });
});
