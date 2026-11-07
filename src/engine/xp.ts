// XP and levels (Ali, 07/11/2026, XP proposal X1–X10). Code only: no agent sees or sends XP.
import type { Actor, GameEvent, GameState, XpAward } from '../types';
import { CONFIG } from '../config';
import { creatureType, getLibrary } from '../library';
import { fullParts } from '../library/spawn';
import { defaultMode, ruleset } from '../ruleset';
import { createRng } from '../rng';
import { isActive, wary } from './relations';
import { logCode } from './effects';

export const charLevel = (a: Actor) => a.core.classes.reduce((n, c) => n + c.level, 0);
export const xpToNext = (a: Actor) => CONFIG.LEVEL_XP * Math.max(1, charLevel(a));
/** Part 1 §6 Total: raw skills, Tagged excluded. */
export const skillTotal = (a: Actor) => Object.values(a.core.skills).reduce((n, s) => n + (s.state === 'tagged' ? 0 : s.raw), 0);

/** Award XP to the player with a trail entry; level up as often as the XP allows (X9: into the chosen class). */
export function awardXp(state: GameState, amount: number, source: string): void {
  const p = state.player, pr = p.progression;
  if (!pr || !(amount > 0)) return;
  pr.xp += amount;
  (pr.xpLog ??= []).push({ source, amount, turn: state.turn });
  while (pr.xp >= xpToNext(p)) {
    pr.xp -= xpToNext(p);
    const up = levelUp(p);
    pr.xpLog.push({ source: 'level', amount: 0, turn: state.turn, levelUp: up });
    logCode(state, 'level_up', up);
  }
}

function levelUp(p: Actor): XpAward['levelUp'] & {} {
  const pr = p.progression!;
  const cur = p.core.classes.find((c) => c.state === 'current');
  const pick = p.core.classes.find((c) => c.classId === pr.nextClass && c.state !== 'previous') ?? cur;
  if (!pick) return { classId: '', level: charLevel(p) };
  if (pick !== cur) { // Part 4: putting a level into an unlocked class makes it current
    if (cur) cur.state = 'previous';
    pick.state = 'current';
    delete pr.nextClass;
  }
  pick.level += 1;
  if (charLevel(p) % 2 === 0) pr.unspentPerkPoints += 1; // Part 1 §5: a perk point on every even level
  return { classId: pick.classId, level: charLevel(p) };
}

/** X4/X5: an opposed or hostile NPC that is down or surrendered pays once, if the player hit it or it surrendered. */
export function payDefeats(state: GameState, events: GameEvent[]): void {
  for (const e of events) {
    const a = e.attack;
    if (a && a.attackerId === state.player.id && a.damage > 0) {
      const t = state.actors.find((x) => x.id === a.targetId);
      if (t?.mind) t.mind.hitByPlayer = true;
    }
  }
  for (const t of state.actors) {
    const m = t.mind;
    if (!m || m.xpPaid || !wary(state, t, state.player)) continue;
    if (isActive(t) ? m.moraleState !== 'surrendered' : !m.hitByPlayer) continue; // fled or untouched: nothing
    m.xpPaid = true;
    awardXp(state, killXp(state, t), `defeat:${t.id}`);
    defeatAchievements(state, t);
  }
}

/** X11 (C, Danger): kill XP = the average share of the player's HP lost in DANGER_DUELS sandbox duels against this
 * foe, both at full health, × DANGER_XP. Weak foes taper on their own (X12); there is no hand-set override (X13). */
export function killXp(state: GameState, t: Actor): number {
  return Math.round(danger(state, t) * CONFIG.DANGER_XP * 10) / 10;
}

/** Sandbox duels with the real attack rules on copies of the two actors. Seeded from the story seed, the turn and
 * the foe, so it never touches the game's dice and a replay gives the same answer. Returns 0–1. */
export function danger(state: GameState, foe: Actor): number {
  let seed = (state.rngSeed ^ (state.turn * 2654435761)) >>> 0;
  for (const c of foe.id) seed = (Math.imul(seed, 31) + c.charCodeAt(0)) >>> 0;
  const rng = createRng(seed);
  let lost = 0;
  for (let i = 0; i < CONFIG.DANGER_DUELS; i++) {
    const fresh = (a: Actor): Actor => {
      const c = structuredClone(a);
      c.zone = state.player.zone;
      c.core.condition = { hpLostPct: 0, parts: fullParts(state, c.core.creatureTypeId), status: [] };
      return c;
    };
    const me = fresh(state.player), them = fresh(foe);
    const sand: GameState = { ...state, player: me, actors: [them], zones: structuredClone(state.zones), log: [], events: [] };
    const order = i % 2 ? [them, me] : [me, them]; // take turns going first
    for (let r = 0; r < CONFIG.DANGER_ROUNDS && isActive(me) && isActive(them); r++) {
      for (const a of order) {
        const d = a === me ? them : me;
        const m = defaultMode(sand, a, 0);
        if (!isActive(a) || !isActive(d) || !m) continue;
        const res = ruleset.attack({ attackerId: a.id, targetId: d.id, weaponId: m.itemId, modeId: m.mode.id, targetPart: null, aimed: false }, sand, rng);
        ruleset.applyEffects(res, sand);
      }
    }
    lost += Math.min(100, me.core.condition.hpLostPct) / 100;
  }
  return lost / CONFIG.DANGER_DUELS;
}

function defeatAchievements(state: GameState, t: Actor): void {
  const lib = Object.values(getLibrary().achievements ?? {});
  const fd = lib.find((d) => d.rule === 'first_defeat');
  if (fd) {
    let creature = t.core.creatureTypeId;
    try { creature = (creatureType(state, creature) as { name?: string }).name ?? creature; } catch { /* keep the id */ }
    grantAchievement(state, `${fd.id}:${t.core.creatureTypeId}`, fd.name.replace('{creature}', creature.replace(/_/g, ' ')), fd.xp);
  }
  const n = (state.player.progression?.xpLog ?? []).filter((x) => x.source.startsWith('defeat:')).length;
  for (const d of lib) if (d.rule === 'defeats' && d.count !== undefined && n >= d.count) grantAchievement(state, d.id, d.name, d.xp);
}

/** Each achievement is granted once (B4). */
export function grantAchievement(state: GameState, id: string, name: string, xp: number): void {
  const pr = state.player.progression;
  if (!pr || pr.achievements?.some((x) => x.id === id)) return;
  (pr.achievements ??= []).push({ id, name, turn: state.turn });
  logCode(state, 'achievement', { id, xp });
  awardXp(state, xp, `achievement:${id}`);
}
