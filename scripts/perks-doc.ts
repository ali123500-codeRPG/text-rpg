// Writes docs/perks.md from src/library/perks.ts.
import { writeFileSync } from 'node:fs';
import { perksMarkdown } from '../src/ui/perkDoc';

writeFileSync('docs/perks.md', perksMarkdown());
console.log('docs/perks.md written');
