// Applies the linked perks table (src/library/perkLinks.ts) to one actor: a link whose set is owned adds its perk
// (source 'link'); a merge also puts the set to sleep (dormant, mergedInto). A link that no longer holds is undone.
// Runs after a perk is taken or undone, at spawn and at the end of every turn.
import type { Actor, Turn } from '../types';
import { PERK_LINKS } from '../library/perkLinks';

/** the actor owns the perk for a link: it is active, or asleep only because a merge took it */
const holds = (a: Actor, id: string) => a.core.perks.some((p) => p.perkId === id && (!p.dormant || !!p.mergedInto));

export function syncPerkLinks(a: Actor, turn: Turn): void {
  for (let pass = 0; pass < PERK_LINKS.length + 1; pass++) {
    let changed = false;
    for (const l of PERK_LINKS) {
      const met = l.needs.every((id) => holds(a, id));
      const has = a.core.perks.find((p) => p.perkId === l.perk && p.source === 'link');
      if (met && !has) {
        a.core.perks.push({ perkId: l.perk, source: 'link', gainedTurn: turn });
        if (l.kind === 'merge') for (const p of a.core.perks) if (l.needs.includes(p.perkId) && !p.dormant) { p.dormant = true; p.mergedInto = l.perk; }
        changed = true;
      } else if (!met && has) {
        a.core.perks = a.core.perks.filter((p) => p !== has);
        for (const p of a.core.perks) if (p.mergedInto === l.perk) { delete p.dormant; delete p.mergedInto; }
        changed = true;
      }
    }
    if (!changed) return;
  }
}
