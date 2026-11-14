// AD9: the suggested action. Code scores what the deck offers right now from what the character knows (danger in reach,
// its own wounds and nerve, a walk under way, something held out, things to take, new ground) and the character's
// leanings; no Claude call, so it can never hint at anything hidden. Scores read levels and words, never raw skill
// numbers, so they behave the same at 50, 100 and 200. Every weight is a SUGGEST_* lever in config.
import { CONFIG } from '../config';
import type { PlayerView } from '../types';
import { HEALTH_LEVELS, MORALE_LEVELS } from '../scales';
import { isDownLevel, othersHealthWord } from '../ruleset';
import { pullOf, type IdeaKind } from './ideaLeans';
import { cap } from '../words';
import type { Choice, DeckAction, DeckCtx, deck } from './deck';

export type Suggestion = { action: DeckAction; choice: Choice; reason: string; score: number };

/** every suggestion worth making, best first (Another walks down the list) */
export function suggestions(groups: ReturnType<typeof deck>, ctx: DeckCtx): Suggestion[] {
  const { pv, s } = ctx;
  const W = CONFIG.SUGGEST;
  const all = groups.flatMap((g) => g.actions);
  const find = (kind: DeckAction['kind']) => all.find((a) => a.kind === kind);
  const out: Suggestion[] = [];
  const put = (kind: DeckAction['kind'], choice: Choice, score: number, reason: string) => { const action = find(kind); if (action) out.push({ action, choice, reason, score }); };
  const fight = s?.mode === 'tactical';
  const me = pv.player;
  const hurt = HEALTH_LEVELS.pos(me.health);
  const nerve = MORALE_LEVELS.pos(me.morale as never);
  const reach = me.reaches?.[0];
  const up = pv.actors.filter((a) => a.health !== 'dead' && !(a.health && isDownLevel(a.health)));
  // foes the character knows of: those fighting it (they can be talked down or made to yield) or the other side of a spar
  const foes = up.filter((a) => a.talkDown || a.demandYield || me.spar?.opponents.includes(a.name ?? a.label));
  const nameOf = (a: PlayerView['actors'][number]) => a.name ?? a.label;

  if (ctx.broken) put('yield', {}, W.broken, 'Your nerve is broken: no attack or walk can come, and yielding ends the fight if they take it.');
  for (const o of me.standDownOffers ?? []) put('stand_down', {}, W.offer, `${o.name} offered to stop fighting.`);
  const held = up.find((a) => a.holdsOut);
  if (held) put('take', { target: held.id, item: held.holdsOut!.item }, W.heldOut, `${cap(nameOf(held))} is holding out ${held.holdsOut!.name} to you.`);
  if (fight && nerve >= MORALE_LEVELS.pos(CONFIG.SUGGEST_STEADY_FROM)) put('steady', {}, W.steady + nerve, `Your nerve is ${MORALE_LEVELS.name(me.morale as never)}: a steadying breath wins some of it back.`);
  if (hurt >= HEALTH_LEVELS.pos(CONFIG.SUGGEST_HEAL_FROM)) {
    const heal = find('use_item');
    if (heal) out.push({ action: heal, choice: { target: '' }, score: W.heal + hurt - (fight ? W.healInFight : 0), reason: `You are ${HEALTH_LEVELS.name(me.health)} and carry something to treat it.` });
  }
  if (fight && foes.length) {
    // the most hurt foe in reach, else the nearest
    const inReach = foes.filter((a) => reach && a.distanceM !== undefined && a.distanceM <= reach.metres);
    const pick = [...(inReach.length ? inReach : foes)].sort((a, b) => HEALTH_LEVELS.pos(b.health ?? 'unhurt') - HEALTH_LEVELS.pos(a.health ?? 'unhurt') || (a.distanceM ?? 1e9) - (b.distanceM ?? 1e9))[0];
    const look = pick.health && pick.health !== 'unhurt' ? `${cap(nameOf(pick))} is ${othersHealthWord(pick.health, pick.level === 'full')}` : `${cap(nameOf(pick))} is fighting you`;
    put('attack', { target: pick.id }, W.attack + (inReach.includes(pick) ? W.inReach : 0), `${look}${inReach.includes(pick) && reach ? ` and within your ${reach.name}'s reach` : ''}.`);
  }
  if (me.walking) put('keep_walking', {}, W.walking, `You are on your way to ${me.walking.to}.`);
  if (!fight) {
    if (find('loot')) put('loot', {}, W.loot, 'There are things here you can take.');
    const fresh = pv.zone.links.find((l) => l.frontier && !l.drop);
    if (fresh) put('go', { target: fresh.to }, W.newGround, `${cap(fresh.label)} leads somewhere you haven't been.`);
    const ready = s?.quests.find((q) => q.state === 'ready');
    if (ready && up.length) put('talk', { target: up[0].id }, W.quest, `Your job "${ready.text}" is done: tell whoever gave it.`);
  }
  put('look', {}, W.look, 'Nothing presses: take in what is around you.');
  // the character's leanings tip close calls
  const p = ctx.self;
  const LEAN: Partial<Record<DeckAction['kind'], IdeaKind>> = { attack: 'attack', steady: 'steady', yield: 'yield', go: 'go_new', look: 'look', talk: 'talk', take: 'pick_up', loot: 'pick_up' };
  for (const x of out) if (p && LEAN[x.action.kind]) x.score += pullOf(LEAN[x.action.kind]!, p) * W.leanShare;
  return out.sort((a, b) => b.score - a.score);
}
