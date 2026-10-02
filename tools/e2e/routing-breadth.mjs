// Routing breadth: does the brief pick the right command or play for marketing work on any platform,
// inside the product, and in any service, while staying silent on coding prompts? Old IDs must
// still route, filler words must not select a command, and a multi-step outcome must return a play.
// Deterministic and offline. No agent session, no tokens.
//   node tools/e2e/routing-breadth.mjs [--out DIR] [--json]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrief } from '../brief.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const out = resolve(option('--out', join(root, 'dist/e2e/routing-breadth')));

export async function loadCases() {
  const corpus = JSON.parse(readFileSync(join(root, 'tools/e2e/routing-breadth.json'), 'utf8'));
  const cases = [...corpus.cases];
  // Every example the onboarding tour advertises is also a case, so the tour cannot drift (O6).
  if (existsSync(join(root, 'tools/tour.mjs'))) {
    const { AREAS } = await import('../tour.mjs');
    for (const area of AREAS) for (const example of area.examples) cases.push({ area: `tour:${area.id}`, task: example.prompt, any: example.any, none: example.none, platforms: example.platforms });
  }
  // The start picker's tasks, as the full prompt the agent receives (in and outside a project).
  if (existsSync(join(root, 'tools/launch.mjs'))) {
    const { STARTS, promptFor } = await import('../launch.mjs');
    const expect = [['copy'], ['diagnose'], ['flow']];

    if (STARTS.length !== expect.length) throw Error('Update first-use routing expectations when changing starter tasks.');
    const agent = { slash: '/conquistador ' };
    const tasks = [...STARTS.map((task, index) => [task, expect[index]]), ['Plan marketing and growth for my product', ['campaign']]];
    for (const [task, any] of tasks) for (const cwd of [root, dirname(root)]) cases.push({ area: 'start', task: promptFor(agent, task, cwd), any });
  }
  return cases;
}

export function judge(item, { playbooks = [] } = {}) {
  const brief = createBrief(item.task, { force: !item.silent, root, playbooks });
  const play = brief.play?.name ?? null;
  // A play counts as a selected command for `any` and `none`; its first step command is also listed.
  const methods = [...(play ? [play] : []), ...brief.methods.map(method => method.name)];
  const must = brief.must.map(file => basename(file.path, '.md'));
  const problems = [];
  if (item.silent) {
    if (brief.action !== 'none') problems.push(`expected no brief, got ${methods.join(', ') || 'platform-only brief'}`);
  } else {
    if (!methods.length && !item.allowEmpty) problems.push('no method (R1)');
    else if (item.any && !methods.some(name => item.any.includes(name))) problems.push(`none of [${item.any.join(', ')}] (R2)`);
    for (const name of item.none ?? []) if (methods.includes(name)) problems.push(`forbidden ${name} (R3)`);
    for (const stem of item.platforms ?? []) if (!brief.platforms.includes(stem)) problems.push(`platform ${stem} not detected`);
    for (const stem of item.mustNot ?? []) if (must.includes(stem)) problems.push(`must-read includes ${stem} (R4)`);
    if (item.play && play !== item.play) problems.push(`expected play ${item.play}, got ${play ?? 'none'} (R5)`);
    if (item.play && brief.play && !brief.play.steps.some(step => step.now)) problems.push('play has no first step (R5)');
    if (item.noPlay && play) problems.push(`expected a single command, got play ${play} (R6)`);
  }
  return { ...item, pass: problems.length === 0, problems, methods, must, play };
}

// The tour may only name real specialists, and the agent-facing welcome must match the tour.
async function tourChecks() {
  if (!existsSync(join(root, 'tools/tour.mjs'))) return [];
  const { AREAS, SPECIALISTS, welcomeMarkdown, welcomePath } = await import('../tour.mjs');
  const { loadRoutingContract } = await import('../routing-contract.mjs');
  const contract = loadRoutingContract(root);
  const known = new Set([...Object.keys(contract.methods), ...(contract.plays ?? []).map(item => item.name)]);
  const unknown = AREAS.flatMap(area => area.methods.filter(name => !known.has(name) || !SPECIALISTS[name]));
  const fresh = existsSync(welcomePath()) && readFileSync(welcomePath(), 'utf8') === await welcomeMarkdown();
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  const missing = AREAS.filter(area => !readme.includes(`| ${area.title} | ${area.covers} |`)).map(area => area.title);
  const row = (task, problems) => ({ area: 'tour', task, pass: !problems.length, problems, methods: [], must: [] });
  return [
    row('Tour names only real commands and plays', unknown.map(name => `unknown command ${name}`)),
    row('welcome.md matches tools/tour.mjs', fresh ? [] : ['stale: run node tools/tour.mjs --write (O6)']),
    row('README area table matches tools/tour.mjs', missing.map(title => `README row differs: ${title}`)),
  ];
}

export async function run() {
  const cases = await loadCases();
  // Built-in knowledge only: a user's own playbooks must not change the verdict.
  const results = cases.map(item => judge(item));
  results.push(...await tourChecks());
  const failed = results.filter(item => !item.pass);
  const areas = [...new Set(results.map(item => item.area))];
  const summary = areas.map(area => {
    const rows = results.filter(item => item.area === area);
    return { area, pass: rows.filter(item => item.pass).length, total: rows.length };
  });
  return { schema: 'conquistador.routing-breadth-result/v1', createdAt: new Date().toISOString(), total: results.length, passed: results.length - failed.length, summary, results };
}

function markdown(report) {
  const lines = [`# Routing breadth: ${report.passed}/${report.total} pass`, '', `Run: ${report.createdAt}`, '', '| Area | Pass |', '| --- | --- |'];
  for (const row of report.summary) lines.push(`| ${row.area} | ${row.pass}/${row.total} |`);
  lines.push('', '| Result | Area | Task | Play | Commands | Problems |', '| --- | --- | --- | --- | --- | --- |');
  for (const item of report.results) lines.push(`| ${item.pass ? 'pass' : 'FAIL'} | ${item.area} | ${item.task.replace(/\|/g, '/')} | ${item.play ?? '—'} | ${item.methods.filter(name => name !== item.play).join(', ') || '—'} | ${item.problems.join('; ')} |`);
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await run();
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(out, 'report.md'), markdown(report));
  if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    for (const row of report.summary) console.log(`${String(row.pass).padStart(3)}/${String(row.total).padEnd(3)} ${row.area}`);
    for (const item of report.results.filter(entry => !entry.pass)) console.log(`FAIL ${item.task}\n     got: ${item.methods.join(', ') || '—'}\n     ${item.problems.join('; ')}`);
    console.log(`\n${report.passed}/${report.total} pass. Report: ${join(out, 'report.md')}`);
  }
  process.exitCode = report.passed === report.total ? 0 : 1;
}
