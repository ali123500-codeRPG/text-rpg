// TQ5: a PR body names the siblings it checked and its tests (the template's sections), so the check is not a habit.
const body = process.env.PR_BODY ?? '';
const section = (name) => (body.split(new RegExp(`^##\\s*${name}\\s*$`, 'mi'))[1] ?? '').split(/^##\s/m)[0].replace(/<!--[\s\S]*?-->/g, '').trim();
// docs/instructions.md section 7: a PR that changes src/ui also shows its look (## Design)
import { execSync } from 'node:child_process';
const n = process.env.PR_NUMBER;
const files = n ? execSync(`gh pr diff ${n} --name-only`, { encoding: 'utf8' }).split('\n') : [];
const ui = files.some((f) => f.startsWith('src/ui/'));
const missing = ['Siblings checked', 'Tests', ...(ui ? ['Design'] : [])].filter((s) => !section(s));
if (missing.length) {
  console.error(`The PR description needs a filled "## ${missing.join('" and "## ')}" section (see .github/pull_request_template.md).`);
  process.exit(1);
}
console.log(`PR rule: siblings and tests${ui ? ', and the design part,' : ''} are named.`);
