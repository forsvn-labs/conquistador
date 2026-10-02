// First run: signals on real fixture repositories, pin and unpin in an isolated home, the
// .gitignore block, and the brief's context files. Runs the real CLI; no agent, no tokens.
// It never runs an Executor command; the live Executor cases need --live and report "not run" otherwise.
//   node tools/e2e/first-run.mjs [--out DIR] [--json] [--live]
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GITIGNORE_BLOCK } from '../context-files.mjs';
import { PIN_MARKER } from '../pin.mjs';
import { spawnCommand } from '../spawn.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = join(root, 'runtime/bin/conquistador.js');
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const out = resolve(option('--out', join(root, 'dist/e2e/first-run')));
const live = args.includes('--live');
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

const work = mkdtempSync(join(tmpdir(), 'conquistador-first-run-'));
const home = join(work, 'home');
const write = (path, text = '') => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); };
const read = path => { try { return readFileSync(path, 'utf8'); } catch { return null; } };
const files = folder => { try { return readdirSync(folder, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).map(entry => relative(folder, join(entry.parentPath, entry.name))).sort(); } catch { return []; } };

function run(command, commandArgs, { cwd, env = {} } = {}) {
  const { file, args: fileArgs, options } = spawnCommand(command, commandArgs);
  const result = spawnSync(file, fileArgs, { cwd, encoding: 'utf8', timeout: 60_000, env: { ...process.env, ...env }, ...options });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}
const isolated = { HOME: home, USERPROFILE: home, CONQUISTADOR_HOME: join(home, '.conquistador'), CLAUDE_CONFIG_DIR: '', CODEX_HOME: '', CURSOR_HOME: '', COPILOT_HOME: '', GROK_HOME: '', GEMINI_CLI_HOME: '', EXECUTOR_DATA_DIR: '' };
const conquistador = (commandArgs, cwd, env = {}) => run(process.execPath, [cli, ...commandArgs], { cwd, env: { ...isolated, ...env } });
const git = (gitArgs, cwd) => run('git', ['-c', 'user.name=E2E', '-c', 'user.email=e2e@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...gitArgs], { cwd });

// Fixtures: a web SaaS (PostHog, Stripe) on a feature branch, an iOS app, and an empty folder.
function fixtures() {
  const saas = join(work, 'saas');
  write(join(saas, 'package.json'), JSON.stringify({ name: 'ledgerly', private: true, dependencies: { next: '15.0.0', react: '19.0.0', 'react-dom': '19.0.0', 'posthog-js': '1.0.0', stripe: '17.0.0', '@stripe/stripe-js': '5.0.0', resend: '4.0.0', '@clerk/nextjs': '6.0.0', '@sanity/client': '6.0.0' } }, null, 2));
  write(join(saas, 'app/page.tsx'), 'export default function Home() { return <h1>Close the books in a day</h1>; }\n');
  write(join(saas, 'app/pricing/page.tsx'), 'export default function Pricing() { return <h1>Pricing</h1>; }\n');
  write(join(saas, 'content/blog/hello.mdx'), '# Hello\n');
  write(join(saas, 'docs/getting-started.md'), '# Getting started\n');
  write(join(saas, 'lib/billing.ts'), 'export const plans = [];\n');
  write(join(saas, 'CHANGELOG.md'), `# Changelog\n\n## [Unreleased]\n\n- Team workspaces\n\n## [1.2.0] - ${today}\n\n- Annual plans\n`);
  write(join(saas, 'PRODUCT.md'), '# Product\n\n<!-- impeccable:product-schema 1 -->\n\n## Platform\n\nweb\n\n## Users\n\nFinance leads at seed-stage startups.\n');
  write(join(saas, 'GROWTH.md'), '# Growth\n\n<!-- conquistador:growth-schema 1 -->\n\n## Goals and Metrics\n\n- Open: the 90-day activation target.\n');
  write(join(saas, '.gitignore'), 'node_modules/\n');
  git(['init', '-q', '-b', 'main'], saas);
  git(['add', '-A'], saas);
  git(['commit', '-q', '-m', 'Initial'], saas);
  git(['tag', 'v1.2.0'], saas);
  git(['checkout', '-q', '-b', 'feature/pricing'], saas);
  write(join(saas, 'app/pricing/page.tsx'), 'export default function Pricing() { return <h1>Plans for every team</h1>; }\n');
  write(join(saas, 'lib/billing.ts'), 'export const plans = ["team"];\n');
  git(['commit', '-q', '-am', 'Rewrite pricing'], saas);
  write(join(saas, 'content/blog/hello.mdx'), '# Hello, annual plans\n');
  // Project docs, agent files, and code change too; only the blog post and the channel draft count.
  write(join(saas, 'README.md'), '# Ledgerly\n\nNow with annual plans.\n');
  write(join(saas, 'PROGRESS.md'), '# Progress\n\n- Annual plans\n');
  write(join(saas, 'docs/getting-started.md'), '# Getting started\n\nPick a plan.\n');
  write(join(saas, 'drafts/launch-post.md'), '---\nchannel: x\n---\n\nAnnual plans are live.\n');
  write(join(saas, 'drafts/notes.md'), 'Ideas for later.\n');

  const ios = join(work, 'ios');
  write(join(ios, 'Shop.xcodeproj/project.pbxproj'), '// !$*UTF8*$!\n');
  write(join(ios, 'Shop/Info.plist'), '<?xml version="1.0"?><plist version="1.0"><dict/></plist>\n');
  write(join(ios, 'Podfile'), "platform :ios, '17.0'\ntarget 'Shop' do\n  pod 'FirebaseAnalytics'\n  pod 'Mixpanel-swift'\n  pod 'RevenueCat'\nend\n");
  write(join(ios, 'fastlane/metadata/en-US/description.txt'), 'Shop the drop.\n');

  const empty = join(work, 'empty');
  mkdirSync(empty, { recursive: true });
  return { saas, ios, empty };
}

const results = [];
const check = (area, name, problems, detail = {}) => results.push({ area, name, pass: problems.length === 0, problems, ...detail });
const expect = (problems, condition, message) => { if (!condition) problems.push(message); };
const includes = (list, value) => Array.isArray(list) && list.some(item => item === value || String(item).startsWith(value));

function signalsChecks({ saas, ios, empty }) {
  const report = {};
  for (const [name, folder] of Object.entries({ saas, ios, empty })) {
    const result = conquistador(['signals', '--json'], folder);
    let json = null;
    try { json = JSON.parse(result.stdout); } catch { /* Checked below. */ }
    const problems = [];
    expect(problems, result.status === 0 && json, `signals exited ${result.status}: ${result.stderr.trim().slice(0, 200)}`);
    if (json) {
      report[name] = { ...json, root: `<${name}>` };
      // An Executor CLI call would create its data folder in this home; signals must not.
      expect(problems, !existsSync(join(home, '.executor')), 'an Executor data folder appeared in the isolated home');
      expect(problems, ['not running', 'not installed'].includes(json.executor.status), `executor status ${json.executor.status}`);
      expect(problems, json.executor.integrations === null, 'integrations counted without a running Executor');
    }
    if (json && name === 'saas') {
      expect(problems, json.context.product?.schema?.owner === 'impeccable' && json.context.product.platform === 'web', 'PRODUCT.md (Impeccable, web) not read');
      expect(problems, json.context.growth?.schema?.version === 1 && json.context.growth.open === 1, 'GROWTH.md schema 1 with one open fact not read');
      expect(problems, JSON.stringify(json.platform.found) === '["web"]', `platform ${json.platform.found}`);
      for (const [key, provider] of [['productAnalytics', 'PostHog'], ['payments', 'Stripe'], ['email', 'Resend'], ['auth', 'Clerk'], ['cms', 'Sanity']]) expect(problems, includes(json.stack[key], provider), `stack.${key} lacks ${provider}`);
      for (const [key, path] of [['landing', 'app/page.tsx'], ['pricing', 'app/pricing'], ['blog', 'content/blog'], ['docs', 'docs'], ['changelog', 'CHANGELOG.md']]) expect(problems, includes(json.surfaces[key].paths, path), `surfaces.${key} lacks ${path}`);
      expect(problems, json.launch.hint === 'unreleased' && json.launch.latest?.version && json.launch.latest.daysAgo === 0, `launch ${JSON.stringify(json.launch)}`);
      expect(problems, json.git.base === 'main', `git base ${json.git.base}`);
      expect(problems, JSON.stringify(json.git.changedMarketingFiles) === '["content/blog/hello.mdx","drafts/launch-post.md"]', `changed ${json.git.changedMarketingFiles}`);
      const text = conquistador(['signals', '--no-executor'], folder).stdout;
      expect(problems, !/Stack.*none found/.test(text) && !/^Stack analytics/m.test(text) && /^Stack payments: Stripe$/m.test(text), 'text output lists empty stack groups');
    }
    if (json && name === 'ios') {
      expect(problems, JSON.stringify(json.platform.found) === '["ios"]', `platform ${json.platform.found}`);
      for (const [key, provider] of [['analytics', 'Firebase Analytics'], ['productAnalytics', 'Mixpanel'], ['payments', 'RevenueCat']]) expect(problems, includes(json.stack[key], provider), `stack.${key} lacks ${provider}`);
      expect(problems, includes(json.surfaces.appStore.paths, 'fastlane/metadata'), 'app store metadata not found');
      expect(problems, json.git.isRepo === false && json.launch.hint === null && json.context.growth === null, 'ios fixture reported git, launch, or growth context');
    }
    if (json && name === 'empty') {
      expect(problems, json.hasCode === false && json.platform.found.length === 0 && Object.values(json.stack).every(list => list.length === 0) && Object.values(json.surfaces).every(item => item.count === 0), 'empty folder reported signals');
      const text = conquistador(['signals'], folder);
      expect(problems, text.status === 0 && text.stdout.includes('Next: run /conquistador init'), 'text output does not lead with init');
      expect(problems, text.stdout.split('\n').filter(line => line.startsWith('Stack')).join('|') === 'Stack: none found', 'empty stack is not one line');
    }
    check('signals', `signals --json: ${name} fixture`, problems);
  }
  return report;
}

function pinChecks({ saas }) {
  mkdirSync(join(home, '.claude'), { recursive: true });
  mkdirSync(join(home, '.codex'), { recursive: true });
  const userCopy = '---\nname: copy\ndescription: "My own copy skill."\n---\n\nKeep this.\n';
  write(join(home, '.claude/skills/copy/SKILL.md'), userCopy);
  const claude = name => join(home, '.claude/skills', name, 'SKILL.md');
  const codex = name => join(home, '.agents/skills', name, 'SKILL.md');
  const pinJson = (commandArgs, cwd = saas, env) => { const result = conquistador(commandArgs, cwd, env); let json = null; try { json = JSON.parse(result.stdout); } catch { /* Text or error. */ } return { ...result, json }; };

  let problems = [];
  let result = pinJson(['pin', 'outreach', '--json']);
  expect(problems, result.status === 0, `exit ${result.status}`);
  expect(problems, read(claude('outreach'))?.includes(PIN_MARKER) && read(claude('outreach')).includes('user-invocable: true') && read(claude('outreach')).includes('/conquistador outreach'), 'Claude Code shortcut wrong');
  expect(problems, read(codex('outreach'))?.includes(PIN_MARKER) && read(codex('outreach')).includes('$conquistador outreach'), 'Codex shortcut wrong');
  check('pin', 'pin outreach writes a marked skill for Claude Code and Codex', problems);

  problems = [];
  result = pinJson(['pin', 'copy', '--json']);
  expect(problems, result.json?.results?.find(item => item.agent === 'claude-code')?.result === 'skipped', 'existing user skill was not skipped');
  expect(problems, read(claude('copy')) === userCopy, 'user skill changed');
  expect(problems, read(codex('copy'))?.includes(PIN_MARKER), 'Codex copy shortcut missing');
  check('pin', 'pin copy skips a skill the user wrote', problems);

  problems = [];
  result = conquistador(['pin', 'init'], saas);
  expect(problems, result.status === 2 && /built-in/.test(result.stderr), `reserved name accepted: exit ${result.status}`);
  result = conquistador(['pin', 'init', '--as', 'init-growth'], saas);
  expect(problems, result.status === 0 && read(claude('init-growth'))?.includes('/conquistador init'), '--as did not pin under the new name');
  result = conquistador(['pin', 'nosuch'], saas);
  expect(problems, result.status === 2 && /Unknown command/.test(result.stderr), 'unknown command accepted');
  check('pin', 'pin refuses built-in names and unknown commands; --as renames', problems);

  problems = [];
  result = conquistador(['pin', 'outreach', '--project'], saas);
  expect(problems, result.status === 0 && read(join(saas, '.claude/skills/outreach/SKILL.md'))?.includes(PIN_MARKER) && read(join(saas, '.agents/skills/outreach/SKILL.md'))?.includes(PIN_MARKER), 'project shortcuts missing');
  check('pin', 'pin --project writes into the repository', problems);

  problems = [];
  const before = files(work).filter(path => !path.startsWith('home'));
  result = conquistador(['pin', 'outreach'], saas, { HOME: '', USERPROFILE: '' });
  expect(problems, result.status === 1 && JSON.stringify(files(work).filter(path => !path.startsWith('home'))) === JSON.stringify(before), 'pin wrote files without HOME');
  check('pin', 'pin with an empty HOME writes nothing', problems);

  problems = [];
  for (const commandArgs of [['unpin', 'outreach'], ['unpin', 'copy'], ['unpin', 'init-growth'], ['unpin', 'outreach', '--project']]) {
    result = conquistador(commandArgs, saas);
    expect(problems, [0, 1].includes(result.status), `${commandArgs.join(' ')} exited ${result.status}`);
  }
  const left = files(join(home, '.claude/skills')).concat(files(join(home, '.agents/skills')).map(path => `agents:${path}`));
  expect(problems, JSON.stringify(left) === JSON.stringify(['copy/SKILL.md']), `left after unpin: ${left.join(', ')}`);
  expect(problems, read(claude('copy')) === userCopy, 'unpin changed the user skill');
  expect(problems, !existsSync(join(saas, '.claude/skills/outreach')) && !existsSync(join(saas, '.agents/skills/outreach')), 'project shortcuts left');
  check('pin', 'unpin removes only marked files', problems, { left });
}

function gitignoreChecks({ saas, empty }) {
  const count = text => text.split('# conquistador:start').length - 1;
  let problems = [];
  const outcomes = [1, 2].map(() => JSON.parse(conquistador(['context', '--gitignore', '--json'], saas).stdout).gitignore.result);
  const text = read(join(saas, '.gitignore'));
  expect(problems, JSON.stringify(outcomes) === '["added","unchanged"]', `results ${outcomes}`);
  expect(problems, count(text) === 1 && text.startsWith('node_modules/\n') && text.includes(GITIGNORE_BLOCK), '.gitignore block not added once with existing lines kept');
  check('gitignore', 'context --gitignore is idempotent and keeps existing lines', problems);

  problems = [];
  writeFileSync(join(saas, '.gitignore'), text.replace('.conquistador/cache/\n', '') + 'secrets.env\n');
  const updated = JSON.parse(conquistador(['context', '--gitignore', '--json'], saas).stdout).gitignore.result;
  const after = read(join(saas, '.gitignore'));
  expect(problems, updated === 'updated' && count(after) === 1 && after.includes(GITIGNORE_BLOCK) && after.endsWith('secrets.env\n'), 'an old block was not replaced in place');
  check('gitignore', 'context --gitignore replaces an older block in place', problems);

  problems = [];
  conquistador(['context', '--gitignore'], empty);
  expect(problems, read(join(empty, '.gitignore')) === `${GITIGNORE_BLOCK}\n`, 'new .gitignore is not exactly the block');
  check('gitignore', 'context --gitignore creates a missing .gitignore', problems);
}

function briefChecks({ saas }) {
  const problems = [];
  const result = conquistador(['brief', 'write a launch email for annual plans'], saas);
  const reads = result.stdout.split('\n').filter(line => line.startsWith('- '));
  expect(problems, result.status === 0 && reads[0]?.includes('PRODUCT.md') && reads[1]?.includes('GROWTH.md'), `first reads: ${reads.slice(0, 2).join(' | ')}`);
  check('brief', 'brief lists PRODUCT.md and GROWTH.md first', problems);
}

// Live cases read the real Executor state. They never run an Executor command.
async function liveChecks({ saas }) {
  const hold = 'Not run: the captain has not cleared Executor CLI calls.';
  if (!live) {
    check('executor', 'signals reads the running Executor through the connect probe and starts nothing', [], { status: 'not run', reason: 'Pass --live to read the real ~/.executor records.' });
  } else {
    const data = join(homedir(), '.executor');
    const records = () => files(data).filter(name => /^daemon-.*\.json$/.test(name));
    const before = records();
    const { executorSignals } = await import('../signals.mjs');
    const status = await executorSignals(saas, { home: homedir(), call: false });
    const problems = [];
    expect(problems, ['running', 'not running', 'not installed'].includes(status.status), `status ${status.status}`);
    if (status.status === 'running') expect(problems, ['service', 'folder'].includes(status.scope) && status.integrations === null, `scope ${status.scope}: ${status.advice}`);
    expect(problems, JSON.stringify(records()) === JSON.stringify(before), 'a daemon record appeared');
    check('executor', 'signals reads the running Executor through the connect probe and starts nothing', problems, { status: status.status, scope: status.scope });
  }
  check('executor', 'signals counts integrations when this folder\'s Executor answers', [], { status: 'not run', reason: hold });
  check('executor', 'signals reports "not running" and starts nothing when Executor is installed but stopped', [], { status: 'not run', reason: `${hold} The isolated-home signals cases cover the no-record path.` });
}

function markdown(report) {
  const lines = [`# First run: ${report.passed}/${report.total} pass, ${report.notRun} not run`, '', `Run: ${report.createdAt}`, '', '| Result | Area | Check | Problems |', '| --- | --- | --- | --- |'];
  for (const item of report.results) lines.push(`| ${item.status === 'not run' ? 'not run' : item.pass ? 'pass' : 'FAIL'} | ${item.area} | ${item.name} | ${(item.problems.join('; ') || item.reason || '').replace(/\|/g, '/')} |`);
  lines.push('', '## Signals per fixture', '');
  for (const [name, value] of Object.entries(report.signals)) {
    lines.push(`### ${name}`, '', `- Platform: ${value.platform.found.join(', ') || 'none'}`, `- Stack: ${Object.entries(value.stack).filter(([, list]) => list.length).map(([key, list]) => `${key}: ${list.join(', ')}`).join('; ') || 'none'}`,
      `- Surfaces: ${Object.entries(value.surfaces).filter(([, item]) => item.count).map(([key, item]) => `${key}: ${item.paths.join(', ')}`).join('; ') || 'none'}`,
      `- Launch: ${value.launch.hint ?? 'none'}`, `- Changed marketing files: ${value.git.changedMarketingFiles.join(', ') || 'none'}`, `- Executor: ${value.executor.status}`, '');
  }
  return `${lines.join('\n')}\n`;
}

export async function runFirstRun() {
  try {
    const folders = fixtures();
    const signals = signalsChecks(folders);
    pinChecks(folders);
    gitignoreChecks(folders);
    briefChecks(folders);
    await liveChecks(folders);
    const ran = results.filter(item => item.status !== 'not run');
    return { schema: 'conquistador.first-run-result/v1', createdAt: new Date().toISOString(), total: ran.length, passed: ran.filter(item => item.pass).length, notRun: results.length - ran.length, results, signals };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await runFirstRun();
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(out, 'report.md'), markdown(report));
  if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    for (const item of report.results) console.log(`${item.status === 'not run' ? 'not run' : item.pass ? 'pass   ' : 'FAIL   '} ${item.area}: ${item.name}${item.problems.length ? `\n        ${item.problems.join('; ')}` : ''}`);
    console.log(`\n${report.passed}/${report.total} pass, ${report.notRun} not run. Report: ${join(out, 'report.md')}`);
  }
  process.exitCode = report.passed === report.total ? 0 : 1;
}
