// FL1–FL7, TN1, TN2, TN4, CT4, CT5: filching, taking what someone carries or owns without being caught.
// One Filching roll F per try (a Filching function roll: Lockpicking stands in at 0.3). Everyone outside the filcher's band
// who sees the act (CONFIG.FILCH_VISIBILITY, the sight rules: metres, walls, dark) rolls Sight against F, with their
// attention (CONFIG.FILCH_ATTENTION, from what they are doing) and the item's size (CONFIG.FILCH_SIZE, by bulk) on their
// side. The act then makes a Hushed sound, one level louder per tier F fell below Near Miss (TN1); everyone it reaches who
// did not catch it by sight rolls Hearing against the same F, with the same modifiers. A watcher who wins and made the act
// out clearly (seen clearly, or heard clearly) catches the filcher; a win only glimpsed or heard partly, or a tie, makes
// them suspicious (TN2). The worst result across everyone decides (FL4): caught, nothing taken; suspicious, a fumble,
// nothing taken and the owner suspicious too; else it is taken unseen. Caught (FL5): the owner turns colder by
// FILCH_CAUGHT_OWNER_STEPS, every other catcher by FILCH_CAUGHT_WITNESS_STEPS, and all remember. A taken item keeps who it
// was taken from (FL6, ItemInstance.stolenFrom).
import type { Actor, GameEvent, GameState, ItemInstance, Mod, Perception, Rng, RollResult } from '../types';
import { CONFIG } from '../config';
import { FN } from '../library/functionIds';
import { SENSE_SKILL } from '../library/skillIds';
import { IT } from '../library/itemIds';
import { activity, itemDef } from '../library';
import { NOISE, type AttentionKey, type NoiseKey } from '../scales';
import { markUse, ruleset, situational, fnRoller, tierLevel, toContest } from '../ruleset';
import { perkSum } from '../ruleset/perks';
import { hearingOf } from '../perception/noise';
import { sightLevel } from '../perception/sight';
import { seeingM, type Located } from './position';
import { zoneLight } from '../time';
import { allActors, isActive, isAsleep, nameFor, zoneById } from './relations';
import { talkingWith } from './speech';
import { stepStance } from './effects';
import { applyMemoryOps } from './memory';
import { matchedCritFeat } from './feats';

export type FilchOutcome = 'taken' | 'fumbled' | 'caught';
export type Filched = { outcome: FilchOutcome; roll: RollResult; noise: NoiseKey; caught: Actor[]; suspicious: Actor[]; perception: GameEvent['perception'] };

/** TN4/D-200: how closely `w` is watching: alert while talking with the filcher, else its latest activity's attention */
function attentionOf(state: GameState, w: Actor, thief: Actor, events: GameEvent[]): AttentionKey {
  const p = state.player;
  if ((thief === p && talkingWith(state).includes(w.id)) || (w === p && talkingWith(state).includes(thief.id))) return 'alert';
  const e = [...events].reverse().find((x) => x.actorId === w.id && x.activity);
  return e ? activity(e.activity!).attention : 'normal';
}

/** TN4: what an item of this bulk adds to a watcher's roll; null when it is too big to filch (FILCH_MAX_BULK) */
export const filchSize = (bulk: number): number | null => (bulk <= CONFIG.FILCH_MAX_BULK ? CONFIG.FILCH_SIZE[bulk] ?? null : null);

/** the contest for one try at `at` (where the hand goes in), against everyone who could notice it */
export function filchContest(state: GameState, a: Actor, owner: Actor | undefined, at: Located, bulk: number, rng: Rng, events: GameEvent[]): Filched {
  const F = ruleset.roll({ actorId: a.id, skill: FN.filching, fn: FN.filching, modifiers: [], tierShifts: [], rollKind: 'stealth', contest: true }, state, rng);
  const noise = NOISE.at(NOISE.pos(CONFIG.FILCH_NOISE) + Math.max(0, tierLevel('near_miss') - tierLevel(F)));
  const perception: GameEvent['perception'] = { [a.id]: { level: 'full', cue: 'sight' } };
  const caught: Actor[] = [], suspicious: Actor[] = [];
  const zone = zoneById(state, at.zone);
  const size = CONFIG.FILCH_SIZE[bulk] ?? 0;
  for (const w of allActors(state)) {
    if (w === a || w.bandId === a.bandId || (!w.mind && w.kind !== 'player') || !isActive(w) || isAsleep(w)) continue;
    const mods: Mod[] = [{ source: 'attention', type: 'situational', value: CONFIG.FILCH_ATTENTION[attentionOf(state, w, a, events)] ?? 0 }, { source: 'size', type: 'situational', value: size }];
    /** one sense's contest: the watcher's roll against F; made out clearly and won catches, else won or tied is suspicion */
    const contest = (sense: 'sight' | 'hearing', level: Perception): 'caught' | 'suspicious' | null => {
      const fn = sense === 'sight' ? FN.sight : FN.hearing;
      const sit = situational(state, fnRoller(state, w, fn), { light: sense === 'sight' ? zone : undefined, actor: w });
      const r = ruleset.roll({ actorId: w.id, skill: SENSE_SKILL[fn], fn, modifiers: [...sit.modifiers, ...mods], tierShifts: sit.tierShifts, rollKind: 'perception', contest: true }, state, rng);
      const res = toContest(F, r), gap = res.gap;
      matchedCritFeat(state, res); // D-292
      markUse(state, a, F.skill, res);
      markUse(state, w, r.skill, res);
      if (gap < 0) return null;
      perception[w.id] = { level, cue: sense === 'sight' ? 'sight' : 'sound' };
      return gap > 0 && level === 'full' ? 'caught' : 'suspicious';
    };
    const sl = sightLevel(CONFIG.FILCH_VISIBILITY, seeingM(state, w, at));
    const seen = sl && (zoneLight(state, zone) === 'dark' ? 'partial' : sl);
    let got = seen ? contest('sight', seen) : null;
    if (got !== 'caught') {
      const heard = hearingOf(state, noise, at, w, perkSum(w, 'hearingDb'));
      const byEar = heard ? contest('hearing', heard) : null;
      got = byEar === 'caught' ? 'caught' : got ?? byEar;
    }
    if (got === 'caught') caught.push(w);
    else if (got === 'suspicious') suspicious.push(w);
  }
  const outcome: FilchOutcome = caught.length ? 'caught' : suspicious.length ? 'fumbled' : 'taken';
  // FL4: a fumble is felt by its owner
  if (outcome === 'fumbled' && owner && owner !== a && isActive(owner) && !isAsleep(owner) && !suspicious.includes(owner)) {
    suspicious.push(owner);
    perception[owner.id] ??= { level: 'partial', cue: 'touch' };
  }
  return { outcome, roll: F, noise, caught, suspicious, perception };
}

/** FL5: caught: the owner turns colder by FILCH_CAUGHT_OWNER_STEPS, every other catcher by FILCH_CAUGHT_WITNESS_STEPS, and
 * each remembers; FL4: a fumble leaves the suspicious remembering it */
export function filchAftermath(state: GameState, a: Actor, owner: Actor | undefined, what: string, f: Filched): void {
  const whose = (w: Actor) => (owner === w ? 'my' : owner ? `${nameFor(state, w, owner) ?? 'someone'}'s` : 'the');
  for (const w of f.outcome === 'caught' ? f.caught : f.suspicious) {
    const who = nameFor(state, w, a) ?? 'a stranger';
    if (f.outcome === 'caught') for (let i = 0; i < (w === owner ? CONFIG.FILCH_CAUGHT_OWNER_STEPS : CONFIG.FILCH_CAUGHT_WITNESS_STEPS); i++) stepStance(state, w, a, 'colder');
    if (w.mind) applyMemoryOps(state, w, { add: [f.outcome === 'caught' ? `I caught ${who} trying to steal ${whose(w)} ${what}.` : `I think ${who} tried to steal ${whose(w)} ${what}.`], drop: [] });
  }
  if (f.outcome === 'caught' && owner && owner !== a && !f.caught.includes(owner)) {
    for (let i = 0; i < CONFIG.FILCH_CAUGHT_OWNER_STEPS; i++) stepStance(state, owner, a, 'colder');
    if (owner.mind) applyMemoryOps(state, owner, { add: [`${nameFor(state, owner, a) ?? 'A stranger'} was caught trying to steal my ${what}.`], drop: [] });
  }
}

/** FL2/FL6: move what was filched from `list` to `a`: one item, marked with who it was taken from; from a purse,
 * FILCH_PURSE_SHARE of its coin (coin is not marked). Returns the instance `a` now holds. */
export function takeFilched(state: GameState, a: Actor, list: ItemInstance[], inst: ItemInstance, from: string | undefined): ItemInstance {
  if (inst.itemId === IT.coin) {
    const n = Math.max(1, Math.ceil((inst.qty ?? 1) * CONFIG.FILCH_PURSE_SHARE));
    inst.qty = (inst.qty ?? 1) - n;
    if (inst.qty <= 0) list.splice(list.indexOf(inst), 1);
    const purse = a.core.inventory.find((x) => x.itemId === IT.coin);
    if (purse) { purse.qty = (purse.qty ?? 1) + n; return { ...purse, qty: n }; }
    const got = { id: `${inst.id}_${a.id}`, itemId: IT.coin, qty: n };
    a.core.inventory.push(got);
    return got;
  }
  list.splice(list.indexOf(inst), 1);
  if (from && inst.stolenFrom === undefined) inst.stolenFrom = from;
  a.core.inventory.push(inst);
  return inst;
}

/** FL2: what can be filched from someone: what they carry that is not held or worn (in a pack or loose), small enough */
export const filchable = (state: GameState, t: Actor): ItemInstance[] =>
  t.core.inventory.filter((i) => !i.equippedIn?.length && !i.soulbound && filchSize(itemDef(state, i.itemId).bulk) !== null);
