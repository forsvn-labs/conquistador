// `conquistador doctor`: report drift between the installs, the hook manifests, and the project context.
// `--fix` repairs what a copy or a host command can repair. Project context files belong to
// `/conquistador init`, so doctor reports them and never writes them.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENTS, OWNED, applyAgent, copyPayload, copySkill, home, payloadCurrent, pluginHome, productRoot, projectFolders, projectRoot, readState, self, skillCurrent, tilde, version } from './agents.mjs';
import { isProject } from './launch.mjs';

const MANIFESTS = ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json', '.cursor-plugin/plugin.json'];
// GROWTH.md topics from the overhaul spec (D4). A heading that names the topic counts.
const GROWTH_TOPICS = [
  ['goals and metrics', /goal|metric/i], ['channels', /channel/i], ['proof and assets', /proof|asset/i],
  ['voice', /voice/i], ['budget and compliance', /budget|compliance|limit/i], ['connected stack', /stack|connect|tool/i],
];

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

// Problems in one plugin folder: each manifest's hook file must parse, and each script it runs must exist.
export function hookProblems(folder) {
  const problems = [];
  for (const manifest of MANIFESTS) {
    let hooks;
    try { hooks = readJson(join(folder, manifest)).hooks; } catch { problems.push(`${manifest} is missing or not JSON`); continue; }
    if (typeof hooks !== 'string') continue;
    const file = join(folder, hooks);
    let text;
    try { text = readFileSync(file, 'utf8'); JSON.parse(text); } catch { problems.push(`${manifest} names ${hooks}, which is missing or not JSON`); continue; }
    for (const [, script] of text.matchAll(/(hooks\/[\w.-]+\.m?js)/g)) if (!existsSync(join(folder, script))) problems.push(`${hooks} runs ${script}, which is missing`);
  }
  return [...new Set(problems)];
}

function hooksSetting() {
  if (String(process.env.CONQUISTADOR_HOOKS ?? '').toLowerCase() === 'off') return 'off (CONQUISTADOR_HOOKS=off)';
  try { if (readJson(join(home(), 'config.json')).hooks === false) return `off (${tilde(join(home(), 'config.json'))})`; } catch { /* No config. */ }
  return 'on';
}

export function inspect(cwd = process.cwd()) {
  const checks = [];
  const add = (area, status, detail, fix = null) => checks.push({ area, status, detail, fix });
  const state = readState();
  const tracked = AGENTS.filter(agent => state.agents?.[agent.id]);
  const plugins = tracked.filter(agent => agent.how !== 'skill');
  const root = projectRoot(cwd);

  // Install: the shared plugin copy, each tracked global host, and each project skill copy.
  if (plugins.length) {
    if (payloadCurrent(pluginHome())) add('install', 'ok', `Plugin copy ${tilde(pluginHome())} matches ${version}`);
    else add('install', 'fail', `Plugin copy ${tilde(pluginHome())} is missing, damaged, or not ${version}`, () => copyPayload(pluginHome()));
  }
  for (const agent of tracked) {
    const recorded = state.agents[agent.id].version;
    const registered = agent.installed();
    const healthy = agent.healthy?.() ?? true;
    if (registered && healthy && recorded === version) add('install', 'ok', `${agent.label}: global ${agent.how} install is current`);
    else {
      const why = !registered ? 'not registered with the host' : !healthy ? 'files changed or missing' : `recorded ${recorded ?? 'unknown'}, package ${version}`;
      add('install', 'fail', `${agent.label}: ${why}`, () => {
        const result = applyAgent(agent, registered ? 'update' : 'install', { source: pluginHome() });
        if (!result.ok) throw Error(result.error);
      });
    }
  }
  for (const folder of projectFolders(root).filter(item => existsSync(join(item.path, OWNED)))) {
    const hosts = folder.agents.map(agent => agent.label).join(', ');
    if (skillCurrent(folder.path)) add('install', 'ok', `Project skill ${tilde(folder.path)} is current (${hosts})`);
    else add('install', 'fail', `Project skill ${tilde(folder.path)} is damaged or not ${version}`, () => copySkill(folder.path));
  }
  if (!tracked.length && !checks.length) add('install', 'warn', `Not installed for any agent here. Run: ${self}`);

  // Hook manifests: in the package, and in the copy the hosts run.
  for (const [label, folder] of [['Package', productRoot], ...(plugins.length && existsSync(pluginHome()) ? [['Plugin copy', pluginHome()]] : [])]) {
    const problems = hookProblems(folder);
    if (!problems.length) add('hooks', 'ok', `${label}: hook manifests and scripts agree`);
    else add('hooks', 'fail', `${label}: ${problems.join('; ')}`, label === 'Plugin copy' ? () => copyPayload(pluginHome()) : null);
  }
  add('hooks', 'ok', `Prompt hooks: ${hooksSetting()}`);

  // Project context: PRODUCT.md, GROWTH.md, and .conquistador/.
  if (!isProject(cwd)) add('project', 'ok', 'Not in a project folder; project checks skipped');
  else {
    for (const name of ['PRODUCT.md', 'GROWTH.md']) {
      if (existsSync(join(root, name))) add('project', 'ok', `${name} found`);
      else add('project', 'warn', `${name} is missing. In your agent, run: /conquistador init`);
    }
    if (existsSync(join(root, 'GROWTH.md'))) {
      const headings = readFileSync(join(root, 'GROWTH.md'), 'utf8').split('\n').filter(line => /^#{1,4}\s/.test(line)).join('\n');
      const missing = GROWTH_TOPICS.filter(([, pattern]) => !pattern.test(headings)).map(([topic]) => topic);
      if (missing.length) add('project', 'warn', `GROWTH.md has no section for: ${missing.join(', ')}. Run /conquistador init to add them`);
    }
    if (existsSync(join(root, '.conquistador'))) {
      let ignore = '';
      try { ignore = readFileSync(join(root, '.gitignore'), 'utf8'); } catch { /* No .gitignore. */ }
      if (/^[^#\n]*\.conquistador/m.test(ignore)) add('project', 'ok', '.gitignore covers .conquistador/ ephemeral files');
      else add('project', 'warn', '.conquistador/ exists, but .gitignore has no entry for it. Run /conquistador init to add the block');
    }
  }
  return checks;
}

export function runDoctor(args) {
  const unknown = args.filter(arg => !['--fix', '--json'].includes(arg));
  if (unknown.length) { console.error('Usage: conquistador doctor [--fix] [--json]'); return 2; }
  let checks = inspect();
  const fixed = [];
  if (args.includes('--fix')) {
    for (const check of checks.filter(item => item.status === 'fail' && item.fix)) {
      try { check.fix(); fixed.push(check.detail); } catch (error) { check.detail += ` (repair failed: ${error.message})`; }
    }
    if (fixed.length) checks = inspect();
  }
  const failed = checks.filter(item => item.status === 'fail');
  if (args.includes('--json')) {
    console.log(JSON.stringify({ version, node: process.version, fixed, checks: checks.map(({ fix, ...item }) => ({ ...item, fixable: Boolean(fix) })) }, null, 2));
    return failed.length ? 1 : 0;
  }
  console.log(`Conquistador ${version} on Node ${process.versions.node}`);
  for (const area of ['install', 'hooks', 'project']) {
    console.log(`\n${area[0].toUpperCase()}${area.slice(1)}`);
    for (const item of checks.filter(check => check.area === area)) console.log(`  ${{ ok: '✓', warn: '!', fail: '✗' }[item.status]} ${item.detail}`);
  }
  for (const item of fixed) console.log(`\nRepaired: ${item}`);
  if (failed.length) console.log(`\n${failed.length} problem(s). ${failed.some(item => item.fix) && !args.includes('--fix') ? `Repair: ${self} doctor --fix` : 'See the lines above.'}`);
  return failed.length ? 1 : 0;
}
