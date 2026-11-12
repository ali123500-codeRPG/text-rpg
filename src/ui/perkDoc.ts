// docs/perks.md is generated from PERK_WRITEUPS (npm run perks-doc), so the doc, the game's Story view and its Rules view
// all come from one source. A test fails if the doc is out of date.
import { PERK_WRITEUPS } from '../library/perks';
import { BOOST_PERKS } from '../library/boostPerks';
import { ALL_BUNDLES, ALL_PARTS } from '../library/allPerks';
import { getLibrary } from '../library';
import { BUILT_PERKS } from '../library/builtPerks';
import type { PerkWriteup } from '../types';
import { skillName } from './creation';

const PLACES: [PerkWriteup['place'], string][] = [['20', '20 milestone'], ['40', '40 milestone'], ['higher', 'Higher milestone'], ['very_high', 'Very high milestone'], ['banked', 'Banked, no milestone yet'], ['all50', 'All-X parts (All-50, All-100, All-150)'], ['linked', 'Linked perks']];

const bankedLabel = (p: PerkWriteup) => p.bankedAs === 'milestone' ? `a later ${skillName(p.skill)} perk${p.aimAt ? `, suggested for the ${p.aimAt} perk` : ''}`
  : p.bankedAs === 'allX' ? `an All-X candidate for the ${treeName(getLibrary().skills[p.skill]?.treeId ?? '')} tree${p.aimAt ? `, suggested for All-${p.aimAt}` : ''}` : 'other';

const treeName = (id: string) => getLibrary().trees[id]?.name ?? id;

export function perksMarkdown(): string {
  const out = ['# Perks: chosen and banked', '',
    '<!-- Generated from src/library/perks.ts by `npm run perks-doc`. Edit that file, not this one. -->', '',
    'Ladder perks by skill and milestone (Part 1 §5, Skill ladders), as picked on the 20 milestone page (https://claude.ai/artifact/WkMeSULi8AjSWxeK4jAdwg). Review page: https://claude.ai/artifact/DE4FDK98f9uBy7s9Ce41qn. Perks are coded, so each one states exactly when it applies.',
    '', 'Each perk has two views that must say the same thing. **Story** is what a player reads when choosing. **Rules** is exactly what code applies, and is the basis for building it. The Perks screen in the game switches between them.',
    '', '**Terms.** *Owner*: the actor who has the perk. *Hits*: an attack whose outcome is grazed, blocked, full hit, heavy hit or crushing hit (not missed or dodged). *Light/medium/heavy melee or ranged mode*: the attack mode\'s tree and class (Part 5 §5); thrown weapons are ranged. *Gap* and *tier shift*: Part 1 §4 and Part 3, Defense. *Next turn*: until the end of that actor\'s next turn. *Engagement*: Part 2, Encounter modes (E1). *Move*: an action the owner chooses on its turn.',
    '', 'The 20, 60, 100 and 140 perks change what a character can do. The 40, 80 and 120 perks raise numbers only, with no conditions: +5 true skill in the skill, +1 to every skill of its group, itself included, and one more number. Thievery and slime skills have no perks for now.', ''];
  for (const [place, title] of PLACES) {
    out.push(`## ${title}`, '');
    if (place === 'all50') out.push('All-50, All-100 and All-150 work alike. Granted free once enough skills of the tree reach the step in true skill, by the tree\'s rating (inferior never, normal 3, superior 2, legendary 1): the tree\'s passive for that step plus the part of each skill at it; a further skill reaching the step adds its part. Each part once it is built. Bundles: ' +
      ALL_BUNDLES.map((b) => `${treeName(b.treeId)} All-${b.step}: ${b.name}`).join('; ') + '.', '');
    for (const p of [...PERK_WRITEUPS, ...BOOST_PERKS, ...ALL_PARTS].filter((d) => d.place === place)) {
      const r = p.rules;
      out.push(`### ${p.name} (${p.allStep ? `${treeName(p.skill)}, ${p.allStep.skill ? skillName(p.allStep.skill) : 'passive'}` : skillName(p.skill)}) · ${p.ref}`, '', `*Story:* ${p.story}`, '',
        `- **Kind:** ${r.kind}`, `- **Trigger:** ${r.trigger}`);
      if (r.conditions.length) out.push(`- **Conditions:** ${r.conditions.join(' ')}`);
      out.push(`- **Effect:** ${r.effect}`, `- **Lasts:** ${r.lasts}`);
      if (r.cooldown) out.push(`- **Cooldown:** ${r.cooldown}`);
      if (r.needs) out.push(`- **Needs first:** ${r.needs}`);
      if (r.open) out.push(`- **Open:** ${r.open}`);
      if (p.bankedAs) out.push(`- **Banked as:** ${bankedLabel(p)}`);
      if (p.allStep) out.push(`- **Built:** ${BUILT_PERKS.has(p.id) ? 'yes' : 'not yet'}`);
      out.push('');
    }
  }
  return out.join('\n').trimEnd() + '\n';
}
