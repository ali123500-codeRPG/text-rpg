// TQ5: a PR body names the siblings it checked and its tests (the template's sections), so the check is not a habit.
const body = process.env.PR_BODY ?? '';
const section = (name) => (body.split(new RegExp(`^##\\s*${name}\\s*$`, 'mi'))[1] ?? '').split(/^##\s/m)[0].replace(/<!--[\s\S]*?-->/g, '').trim();
const missing = ['Siblings checked', 'Tests'].filter((s) => !section(s));
if (missing.length) {
  console.error(`The PR description needs a filled "## ${missing.join('" and "## ')}" section (see .github/pull_request_template.md).`);
  process.exit(1);
}
console.log('PR rule: siblings and tests are named.');
