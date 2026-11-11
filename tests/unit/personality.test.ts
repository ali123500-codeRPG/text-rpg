// Nerve and personality (PL1–PL19): Nerve line and tier, trait words, named types, rewards that add points, the agent's
// CHARACTER line, and the Weaver's pick.
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { getLibrary, npcTemplate } from '../../src/library';
import { spawnNpc } from '../../src/library/spawn';
import { PA, PY, VL } from '../../src/library/tableIds';
import { TP } from '../../src/library/templateIds';
import { ACH } from '../../src/library/achievementIds';
import { SK } from '../../src/library/skillIds';
import { nerveLine, nerveTier, personalityFrom, personalityOf, personalityText, personalityTypes, traitWords } from '../../src/ruleset/personality';
import { formatDialogueView, formatOppositionView } from '../../src/agents/format';
import type { Actor } from '../../src/types';
import { actorView } from './agent-views';

const npc = (tp: string) => spawnNpc(null, tp, { id: 'x', zone: 'z', placeId: 'p', bandId: 'b' });
const withResolve = (a: Actor, r: number) => { a.core.skills[SK.resolve] = { raw: r, state: 'normal' }; return a; };

describe('Nerve', () => {
  it('leans at PERSONALITY_LEAN: cautious, steady, daring', () => {
    expect(nerveLine({ nerve: -CONFIG.PERSONALITY_LEAN, traits: {}, values: [] })).toBe('cautious');
    expect(nerveLine({ nerve: CONFIG.PERSONALITY_LEAN - 1, traits: {}, values: [] })).toBe('steady');
    expect(nerveLine({ nerve: CONFIG.PERSONALITY_LEAN, traits: {}, values: [] })).toBe('daring');
  });
  it('the tier follows raw Resolve: timid at 30 becomes careful at 40; 100 is superhuman, + every 50 past it', () => {
    const barkeep = npc(TP.trader);
    expect(barkeep.core.skills[SK.resolve].raw).toBe(30);
    expect(nerveTier(barkeep)).toBe('Timid');
    expect(nerveTier(withResolve(barkeep, 40))).toBe('Careful');
    expect(nerveTier(withResolve(barkeep, 100))).toBe('Unflappable');
    expect(nerveTier(withResolve(barkeep, 150))).toBe('Unflappable+');
    expect(nerveTier(withResolve(barkeep, 210))).toBe('Unflappable++');
    expect(nerveTier(npc(TP.guard))).toBe('Steady');
  });
});

describe('personality', () => {
  it('trait words are graded, strongest first, and the middle is left out', () => {
    expect(traitWords({ nerve: 0, traits: { [PA.pride]: 75, [PA.honesty]: -45, [PA.sociability]: 25, [PA.curiosity]: 19 }, values: [] }))
      .toEqual(['very proud', 'deceitful', 'a bit talkative']);
  });
  it('named types are read from the points, Resolve included, at most PERSONALITY_TYPES_SHOWN', () => {
    const a = withResolve(npc(TP.guard), 50);
    a.core.personality = { nerve: 0, traits: { [PA.discipline]: 60, [PA.temper]: -30 }, values: [] };
    expect(personalityTypes(a).map((t) => t.id)).toEqual([PY.mature]);
    withResolve(a, 30);
    expect(personalityTypes(a)).toEqual([]); // Mature needs Resolve 40
    a.core.personality = { nerve: 0, traits: { [PA.pride]: 90, [PA.temper]: 80, [PA.honesty]: -50, [PA.sociability]: 50, [PA.curiosity]: 50 }, values: [] };
    expect(personalityTypes(a).length).toBe(CONFIG.PERSONALITY_TYPES_SHOWN);
    expect(personalityTypes(a)[0].id).toBe(PY.prideful); // 50 past its bar beats Bully's 30
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
      expect(p.traits[PA.discipline]).toBe(40);
      expect(a.core.personality!.nerve).toBe(0); // the stored points don't change
    } finally { lib.perks[perk].personality = before; }
  });
  it('the agent reads it in CHARACTER; the Voice never does', () => {
    const guard = npc(TP.guard);
    expect(personalityText(guard, 'Tense')).toBe('Nerve: Steady (Tense right now). Disciplined. Values: duty.');
    const v = actorView();
    expect(formatOppositionView(v)).toContain(`"personality":"${v.personality}"`);
    expect(formatOppositionView(v).split(v.personality).length).toBe(2); // once, in CHARACTER only
    expect(formatDialogueView({ ...v, knows: [], dialogue: [] })).not.toContain(v.personality);
  });
  it('the Weaver may name a line, types and values on top of the template (PL12)', () => {
    const t = npcTemplate(null, TP.guard);
    const p = personalityFrom(t.personality, { nerve: 'daring', types: [PY.childish, 'nonsense'], values: [VL.family, 'VL999'] });
    expect(p.nerve).toBe(CONFIG.NERVE_LINE_POINTS);
    expect(p.traits[PA.discipline]).toBe(-40); // Childish caps Discipline at −40
    expect(p.traits[PA.temper]).toBe(20);
    expect(p.values).toEqual([VL.family]);
    expect(t.personality.traits[PA.discipline]).toBe(40); // the template is untouched
  });
});

describe('achievement personality points (AP1-AP20)', () => {
  const STEP = CONFIG.ACH_PERSONALITY_STEP;
  const earn = (a: Actor, ...rows: { key: string; of?: string }[]) => {
    a.progression = { ...(a.progression ?? {}), achievements: rows.map((r) => ({ id: r.key, ...r, turn: 0 })) } as Actor['progression'];
    return a;
  };
  it('rows are written in steps of the ACH_PERSONALITY_STEP lever (AP2)', () => {
    const lib = getLibrary().achievements!;
    expect(lib[ACH.unaware_1].personality).toEqual({ [PA.honesty]: -STEP });
    expect(lib[ACH.outnumbered_1].personality).toEqual({ nerve: STEP });
    expect(lib[ACH.morale_breaks_1].personality).toEqual({ nerve: -STEP }); // a scar pushes its own way (AP3)
    expect(lib[ACH.no_blow_1].personality).toBeUndefined(); // AP8 turned down
  });
  it('a held chain level adds its own step plus every lower level by reference (AP1)', () => {
    const base = personalityOf(npc(TP.guard));
    const p = personalityOf(earn(npc(TP.guard), { key: ACH.unaware_50 }));
    expect((p.traits[PA.honesty] ?? 0) - (base.traits[PA.honesty] ?? 0)).toBe(-3 * STEP);
  });
  it('a by-skill row adds its per-skill points only for the skill it was earned with (AP12)', () => {
    const base = personalityOf(npc(TP.guard));
    const lie = personalityOf(earn(npc(TP.guard), { key: ACH.speech_10, of: SK.lying }));
    const talk = personalityOf(earn(npc(TP.guard), { key: ACH.speech_10, of: SK.persuasion }));
    const d = (p: typeof base, k: string) => (p.traits[k] ?? 0) - (base.traits[k] ?? 0);
    expect(d(lie, PA.sociability)).toBe(STEP);
    expect(d(lie, PA.honesty)).toBe(-STEP);
    expect(d(talk, PA.sociability)).toBe(STEP);
    expect(d(talk, PA.honesty)).toBe(0);
  });
});
