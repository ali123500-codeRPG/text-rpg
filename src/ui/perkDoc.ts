// docs/perks.md is generated from PERK_WRITEUPS (npm run perks-doc), so the doc, the game's Story view and its Rules view
// all come from one source (Ali, 07/11/2026). A test fails if the doc is out of date.
import { PERK_WRITEUPS } from '../library/perks';
import { BOOST_PERKS } from '../library/boostPerks';
import type { PerkWriteup } from '../types';
import { skillName } from './creation';

const PLACES: [PerkWriteup['place'], string][] = [['20', '20 milestone'], ['40', '40 milestone (boost perks)'], ['higher', 'Higher milestone'], ['very_high', 'Very high milestone'], ['banked', 'Banked, no milestone yet']];

export function perksMarkdown(): string {
  const out = ['# Perks: chosen and banked', '',
    '<!-- Generated from src/library/perks.ts by `npm run perks-doc`. Edit that file, not this one. -->', '',
    'Ladder perks by skill and milestone (Part 1 §5, Skill ladders), as Ali picked them on the 20 milestone page (https://claude.ai/artifact/WkMeSULi8AjSWxeK4jAdwg), 07/11/2026. Review page: https://claude.ai/artifact/DE4FDK98f9uBy7s9Ce41qn. Perks are coded, so each one states exactly when it applies (Ali).',
    '', 'Each perk has two views that must say the same thing (Ali, 07/11/2026). **Story** is what a player reads when choosing. **Rules** is exactly what code applies, and is the basis for building it. The Perks screen in the game switches between them.',
    '', '**Terms.** *Owner*: the actor who has the perk. *Hits*: an attack whose outcome is grazed, blocked, full hit, heavy hit or crushing hit (not missed or dodged). *Light/medium/heavy melee or ranged mode*: the attack mode\'s tree and class (Part 5 §5); thrown weapons are ranged. *Gap* and *tier shift*: Part 1 §4 and Part 3, Defense. *Next turn*: until the end of that actor\'s next turn. *Engagement*: Part 2, Encounter modes (E1). *Move*: an action the owner chooses on its turn.',
    '', 'Ability perks sit on 20/60/100/140 and change what a character can do. Boost perks sit on 40/80/120 and raise numbers only, with no conditions: +5 true skill in the skill, +1 in every other skill sharing a function with it, and one more number (Ali, 08/11/2026). Swordsman, lockpicking and slime skills have no perks for now.', ''];
  for (const [place, title] of PLACES) {
    out.push(`## ${title}`, '');
    for (const p of [...PERK_WRITEUPS, ...BOOST_PERKS].filter((d) => d.place === place)) {
      const r = p.rules;
      out.push(`### ${p.name} (${skillName(p.skill)}) · ${p.ref}`, '', `*Story:* ${p.story}`, '',
        `- **Kind:** ${r.kind}`, `- **Trigger:** ${r.trigger}`);
      if (r.conditions.length) out.push(`- **Conditions:** ${r.conditions.join(' ')}`);
      out.push(`- **Effect:** ${r.effect}`, `- **Lasts:** ${r.lasts}`);
      if (r.cooldown) out.push(`- **Cooldown:** ${r.cooldown}`);
      if (r.needs) out.push(`- **Needs first:** ${r.needs}`);
      if (r.open) out.push(`- **Open:** ${r.open}`);
      out.push('');
    }
  }
  return out.join('\n').trimEnd() + '\n';
}
