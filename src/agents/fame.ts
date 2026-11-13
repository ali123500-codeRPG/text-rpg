// Hall of fame: a fallen character, written into the story's meta when the fallen story is archived (src/save archiveStory).
import type { FameEntry, GameState, LogLine } from '../types';
import { getLibrary } from '../library';
import { skillName } from '../library/skillNames';
import { trueSkill } from '../ruleset/perks';
import { achievementName, charLevel, wornTitle } from '../engine/xp';
import { dayOf, now } from '../time';

const TOP_SKILLS = 8;

/** HF2: an echo's hidden past for the Weaver and the Narrator, from its Hall of fame entry */
export function echoPast(f: FameEntry): string {
  const who = `${f.name}${f.title ? `, ${f.title}` : ''}: level ${f.level}${f.classes.length ? ` ${f.classes.map((c) => `${c.name} ${c.level}`).join(', ')}` : ''}, ${f.defeats} defeated.`;
  const did = [f.achievements.length ? `Achievements: ${f.achievements.join(', ')}.` : '', f.scars.length ? `Scars: ${f.scars.join(', ')}.` : ''].filter(Boolean).join(' ');
  const d = f.downedBy, blow = d ? (d.unseen ? ', struck down by someone never seen' : `, struck down by ${d.by}${d.weapon ? `'s ${d.weapon}` : ''}${d.part ? ` to the ${d.part}` : ''}`) : '';
  return [who, did, `Fell on day ${f.day} at ${f.place || 'an unknown place'}${blow}.`].filter(Boolean).join(' ');
}

/** `place`: where the character fell, in words (placeName in game.ts) */
export function fameEntry(s: GameState, lines: LogLine[], place: string, at: string): FameEntry {
  const lib = getLibrary(), p = s.player;
  const achs = (p.progression?.achievements ?? []).filter((a) => !a.replacedBy);
  const isScar = (a: { key?: string }) => !!lib.achievements?.[a.key ?? '']?.scar;
  const tally = p.progression?.tally ?? {};
  return {
    name: p.names.current, ...(p.pronouns ? { pronouns: p.pronouns } : {}),
    ...(wornTitle(s) ? { title: wornTitle(s) } : {}),
    classes: p.core.classes.filter((c) => c.level > 0).map((c) => ({ name: lib.classes[c.classId]?.name ?? c.classId, level: c.level })),
    level: charLevel(p),
    skills: Object.keys(p.core.skills).map((id) => ({ name: skillName(id), value: Math.round(trueSkill(p, id)) })).filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value).slice(0, TOP_SKILLS),
    perks: p.core.perks.map((x) => lib.perks[x.perkId]?.name ?? x.perkId),
    achievements: achs.filter((a) => !isScar(a)).map((a) => achievementName(s, a)),
    scars: achs.filter(isScar).map((a) => achievementName(s, a)),
    defeats: tally.defeats ?? 0,
    turn: s.turn, day: dayOf(now(s)), place,
    ...((() => { const d = [...lines].reverse().find((l) => l.downedBy)?.downedBy; return d ? { downedBy: d } : {}; })()),
    fellAt: at,
  };
}
