import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOnboarding, UsageError, SKILLS_PIN, SKILLS_AGENTS } from './onboarding-parse.mjs';
import { activeHosts, resolveHost, ACTIVE_SIGNALS, gitRoot } from './onboarding-hosts.mjs';
import { EventEmitter } from 'node:events';
import { cancellableUi } from './onboarding-ui.mjs';
import { confirmPlan, mcpHandoff, retrySkills } from './onboarding-routes.mjs';
import { treeDigest, projectIntegration } from './project-installation.mjs';
import { runOnboarding } from './onboarding.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, 'runtime/bin/conquistador.js');

function fakeUi(answers, notes = []) {
  return {
    intro() {}, outro(value) { notes.push(value); }, cancel(value) { notes.push(value); },
    note(value) { notes.push(value); }, isCancel: value => typeof value === 'symbol',
    select: async () => answers.shift(), confirm: async () => answers.shift(),
    log: { info() {}, error(value) { notes.push(value); } },
    spinner: () => ({ start() {}, stop() {} }),
  };
}

function fixture(t) {
  const project = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador onboard ')));
  t.after(() => rmSync(project, { recursive: true, force: true }));
  return project;
}

function invoke(project, args, env = {}) {
  const clean = { ...process.env, ...env, PATH: env.PATH ?? '/nonexistent' };
  for (const name of Object.values(ACTIVE_SIGNALS).flat()) {
    if (!Object.hasOwn(env, name)) delete clean[name];
  }
  return spawnSync(process.execPath, [cli, ...args], { cwd: project, encoding: 'utf8', env: clean });
}

test('shortcut parsing accepts space and equals forms and rejects conflicts', () => {
  assert.equal(parseOnboarding(['--bot', 'hermes']).bot, 'hermes');
  assert.equal(parseOnboarding(['--bot=grok-bot']).bot, 'grok-bot');
  assert.equal(parseOnboarding(['--bot']).bot, null);
  assert.equal(parseOnboarding(['--skills', '--host', 'cursor']).route, 'skills');
  assert.equal(parseOnboarding(['--plugin', '--host=none']).host, 'none');
  assert.equal(parseOnboarding(['--mcp', '--url', 'https://runtime.example']).url, 'https://runtime.example');
  assert.equal(parseOnboarding(['--advanced']).route, 'advanced');
  for (const args of [
    ['--skills', '--plugin'],
    ['--bot', 'hermes', '--host', 'codex'],
    ['--host', 'codex', '--host', 'cursor'],
    ['--skills', '--unknown'],
    ['--mcp', '--runtime-path', '/tmp'],
    ['--path', '/tmp'],
    ['setup', '--skills'],
    ['--advanced', '--yes'],
    ['--bot', 'eve'],
    ['--host', 'mystery'],
    ['--plugin', '--host', 'cursor'],
  ]) {
    assert.throws(() => parseOnboarding(args), UsageError);
  }
  assert.equal(parseOnboarding(['--yes', '--host', 'none']).yes, true);
});

test('host resolution prefers explicit, then BB over a provider, and ignores misleading directories', () => {
  assert.equal(resolveHost({ host: 'cursor', env: { CLAUDECODE: '1' } }).host, 'cursor');
  assert.deepEqual(activeHosts({ BB_THREAD_ID: 'thr_1', CURSOR_TRACE_ID: 'cursor', CLAUDECODE: '1' }), ['bb']);
  assert.equal(resolveHost({ env: { BB_THREAD_ID: 'thr_1', CURSOR_TRACE_ID: 'cursor' } }).host, 'bb');
  assert.equal(resolveHost({ env: { CLAUDECODE: '1' } }).host, 'claude-code');
  assert.equal(resolveHost({ env: { CLAUDECODE: '1', CURSOR_AGENT: '1' } }).reason, 'ambiguous-active');
  assert.equal(resolveHost({ env: {} }).reason, 'unresolved');
});

test('top-level help and route help load before runtime libraries', t => {
  const project = fixture(t);
  const help = invoke(project, ['--help']);
  assert.equal(help.status, 0, help.stderr);
  // Default help stays short; every other route is listed under --all.
  assert.ok(help.stdout.trim().split('\n').length <= 12, help.stdout);
  assert.doesNotMatch(help.stdout, /--advanced/);
  const all = invoke(project, ['help', '--all']);
  assert.equal(all.status, 0, all.stderr);
  assert.match(all.stdout, /--bot/);
  assert.match(all.stdout, /--advanced/);
  assert.match(all.stdout, /operator status/);
  assert.equal(invoke(project, ['--skills', '--help']).status, 0);
  assert.match(invoke(project, ['--bot', '--help']).stdout, /hermes/);
  assert.match(invoke(project, ['--plugin', '--help']).stdout, /user-level/);
  assert.match(invoke(project, ['--mcp', '--help']).stdout, /playbooks/);
  assert.match(invoke(project, ['--advanced', '--help']).stdout, /combination guide/i);
});

test('mixed shortcut and command flags fail with exit 2 before writes', t => {
  const project = fixture(t);
  writeFileSync(join(project, 'keep.txt'), 'keep');
  for (const args of [['install', '--skills'], ['setup', '--plugin'], ['mcp', '--mcp'], ['install', '--advanced'], ['--skills', '--plugin']]) {
    const result = invoke(project, args);
    assert.equal(result.status, 2, args.join(' ') + result.stderr);
  }
  assert.deepEqual(readdirSync(project), ['keep.txt']);
});

test('bare mcp remains the protocol server and does not open setup', t => {
  const result = spawnSync(process.execPath, [cli, 'mcp', '--help'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout + result.stderr, /Set up Conquistador/);
});

test('noninteractive unique host dry-run writes nothing', t => {
  const project = fixture(t);
  mkdirSync(join(project, '.agents'));
  mkdirSync(join(project, '.github'));
  const result = invoke(project, ['--host', 'none', '--dry-run'], { CLAUDECODE: '1' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Dry run|No files changed|Files only/);
  assert.equal(existsSync(join(project, '.conquistador')), false);
  assert.deepEqual(readdirSync(project).sort(), ['.agents', '.github']);
});

test('noninteractive unresolved host with --yes does not guess from directories or PATH', t => {
  const project = fixture(t);
  mkdirSync(join(project, '.agents'), { recursive: true });
  mkdirSync(join(project, '.github'), { recursive: true });
  const result = invoke(project, ['--yes'], { PATH: '/nonexistent' });
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stderr, /could not identify your coding agent/);
  assert.equal(existsSync(join(project, '.conquistador')), false);
});

test('BB active signal wins over a Cursor provider and installs no native skill', t => {
  const project = fixture(t);
  const result = invoke(project, ['--yes'], { BB_THREAD_ID: 'thr_test', CURSOR_TRACE_ID: 'cursor-session', PATH: '/nonexistent' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(join(project, '.conquistador/SKILL.md')));
  assert.equal(existsSync(join(project, '.cursor')), false);
  assert.equal(existsSync(join(project, '.agents')), false);
  const hosts = JSON.parse(readFileSync(join(project, '.conquistador/project-installation.json'), 'utf8')).hosts;
  assert.deepEqual(hosts, ['bb']);
});

test('recommended confirmation applies one complete installation', async t => {
  const project = fixture(t);
  const notes = [];
  const calls = [];
  const result = await runOnboarding(['--host', 'codex'], {
    cwd: project, tty: true, env: { PATH: '' }, ui: fakeUi(['setup'], notes),
    run: async args => { calls.push(args); return 0; },
  });
  assert.equal(result, 0);
  assert.deepEqual(calls.find(args => args[0] === 'install' && !args.includes('--dry-run')), ['install', '--target', 'operator', '--project', project, '--host', 'codex']);
  assert.ok(calls.some(args => args[0] === 'doctor'));
  assert.match(notes.join('\n'), /Conquistador files are ready/);
});

test('change host and view changes reconfirm only after the plan changes', async t => {
  const project = fixture(t);
  const notes = [];
  const calls = [];
  const result = await runOnboarding([], {
    cwd: project, tty: true, env: { CLAUDECODE: '1', PATH: '' },
    ui: fakeUi(['changes', 'host', 'cursor', 'setup'], notes),
    run: async args => { calls.push(args); return 0; },
  });
  assert.equal(result, 0);
  assert.match(notes.join('\n'), /Activation boundary/);
  assert.deepEqual(calls.find(args => args[0] === 'install' && !args.includes('--dry-run')), ['install', '--target', 'operator', '--project', project, '--host', 'cursor']);
});

test('escape before writes reports cancellation', async t => {
  const project = fixture(t);
  const notes = [];
  const calls = [];
  const result = await runOnboarding(['--host', 'none'], {
    cwd: project, tty: true, env: { PATH: '' }, ui: fakeUi([Symbol('cancel')], notes),
    run: async args => { calls.push(args); return 0; },
  });
  assert.equal(result, 0);
  assert.ok(calls.every(args => args[0] === 'doctor' || args.includes('--dry-run')));
  assert.equal(existsSync(join(project, '.conquistador')), false);
  assert.match(notes.join('\n'), /Cancelled. No files changed./);
});

test('repeat launch of a healthy install does not rewrite files', async t => {
  const project = fixture(t);
  const first = invoke(project, ['--host', 'none', '--yes']);
  assert.equal(first.status, 0, first.stderr);
  const receipt = readFileSync(join(project, '.conquistador/.conquistador-install.json'));
  const again = await runOnboarding([], { cwd: project, tty: true, env: { PATH: '' }, ui: fakeUi([]) });
  assert.equal(again, 0);
  assert.deepEqual(readFileSync(join(project, '.conquistador/.conquistador-install.json')), receipt);
});

test('old-version notice does not upgrade on plain launch', async t => {
  const project = fixture(t);
  assert.equal(invoke(project, ['--host', 'none', '--yes']).status, 0);
  const receiptPath = join(project, '.conquistador/.conquistador-install.json');
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  receipt.productVersion = '0.0.1';
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  const notes = [];
  const { inspect } = await import('node:util');
  const result = await runOnboarding([], { cwd: project, tty: true, env: { PATH: '' }, ui: fakeUi([], notes) });
  assert.equal(result, 0, inspect(notes));
  assert.equal(JSON.parse(readFileSync(receiptPath, 'utf8')).productVersion, '0.0.1');
});

test('legacy operator requires an explicit update and dry-run leaves it in place', t => {
  const project = fixture(t);
  spawnSync(process.execPath, [join(root, 'tools/install.mjs'), 'install', 'single-agent', join(project, '.conquistador-operator')], { encoding: 'utf8' });
  const dry = invoke(project, ['--dry-run']);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /Migrate with an explicit/);
  assert.ok(existsSync(join(project, '.conquistador-operator')));
  assert.equal(existsSync(join(project, '.conquistador')), false);
  assert.notEqual(invoke(project, ['--yes']).status, 0);
});

test('modified and unowned copies are preserved', t => {
  const project = fixture(t);
  mkdirSync(join(project, '.conquistador'));
  writeFileSync(join(project, '.conquistador/mine.txt'), 'Keep');
  const unowned = invoke(project, ['--host', 'none', '--yes']);
  assert.notEqual(unowned.status, 0);
  assert.match(unowned.stderr, /does not own/);
  assert.equal(readFileSync(join(project, '.conquistador/mine.txt'), 'utf8'), 'Keep');
  rmSync(join(project, '.conquistador'), { recursive: true });
  assert.equal(invoke(project, ['--host', 'none', '--yes']).status, 0);
  writeFileSync(join(project, '.conquistador/SKILL.md'), 'edits');
  const modified = invoke(project, ['--yes']);
  assert.notEqual(modified.status, 0);
  assert.match(modified.stderr, /local edits/);
  assert.equal(readFileSync(join(project, '.conquistador/SKILL.md'), 'utf8'), 'edits');
});

test('domain restriction is retained on the recommended path', async t => {
  const project = fixture(t);
  const domain = join(project, 'domain.json');
  writeFileSync(domain, JSON.stringify({
    schemaVersion: 'conquistador.domain-package/v1', id: 'domain:diagnosis',
    agentPackageSchemaVersion: 'conquistador.agent-package/v2',
    allowed: { roles: ['data-diagnosis'], skills: [], workflows: [], tools: ['host-model'], knowledgeHandles: [] },
  }));
  assert.equal(spawnSync(process.execPath, [cli, 'install', '--host', 'none', '--domain', domain], { cwd: project, encoding: 'utf8' }).status, 0);
  const restriction = readFileSync(join(project, '.conquistador/domain-restriction.json'), 'utf8');
  assert.equal(await runOnboarding([], { cwd: project, tty: true, env: { PATH: '' }, ui: fakeUi([]) }), 0);
  assert.equal(readFileSync(join(project, '.conquistador/domain-restriction.json'), 'utf8'), restriction);
});

test('native duplicate discovery refuses a second entry and preserves its owner', t => {
  const project = fixture(t);
  const existing = join(project, '.agents/skills/conquistador');
  mkdirSync(existing, { recursive: true });
  writeFileSync(join(existing, 'SKILL.md'), 'Keep');
  const cursor = invoke(project, ['--host', 'cursor', '--yes']);
  assert.equal(cursor.status, 1, cursor.stderr);
  assert.equal(readFileSync(join(existing, 'SKILL.md'), 'utf8'), 'Keep');
  assert.equal(existsSync(join(project, '.cursor/skills/conquistador/SKILL.md')), false);
  assert.match(cursor.stderr, /\.agents\/skills\/conquistador.*external or unverified owner/);
});

test('Grok Bot shortcut is guidance with an unverified boundary', t => {
  const project = fixture(t);
  assert.equal(invoke(project, ['--bot', 'grok-bot']).status, 2);
  const result = invoke(project, ['--bot', 'grok-bot', '--yes']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /has not been verified/);
  assert.match(result.stdout, /No integration was activated/);
  assert.equal(existsSync(join(project, '.conquistador')), false);
});

test('Hermes outside Git explains the profile path and does not initialize Git', t => {
  const project = fixture(t);
  const result = invoke(project, ['--bot', 'hermes', '--yes']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Git project root/);
  assert.match(result.stdout, /~\/.hermes\/skills/);
  assert.equal(existsSync(join(project, '.git')), false);
  assert.equal(existsSync(join(project, '.conquistador')), false);
});

test('Hermes below a Git root requires an explicit project choice', t => {
  const project = fixture(t);
  spawnSync('git', ['init', '-q'], { cwd: project });
  const nested = join(project, 'nested');
  mkdirSync(nested);
  const result = spawnSync(process.execPath, [cli, '--bot', 'hermes', '--yes'], {
    cwd: nested, encoding: 'utf8', env: { ...process.env, PATH: '/nonexistent' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Git root/);
  assert.equal(existsSync(join(project, '.conquistador')), false);
  const ok = spawnSync(process.execPath, [cli, '--bot', 'hermes', '--yes', '--project', project], {
    cwd: nested, encoding: 'utf8', env: { ...process.env, PATH: '/nonexistent' },
  });
  assert.equal(ok.status, 0, ok.stderr);
  assert.ok(existsSync(join(project, '.hermes/skills/conquistador/SKILL.md')));
  assert.match(ok.stdout, /'hermes' 'skills' 'trust'/);
});

test('--skills stages a transformed parent and invokes the pinned manager with telemetry disabled', async t => {
  const project = fixture(t);
  const spawned = [];
  const result = await runOnboarding(['--skills', '--host', 'claude-code', '--yes'], {
    cwd: project, tty: false, env: { PATH: '/usr/bin' },
    spawn: (command, args, options) => {
      spawned.push([command, ...args]);
      assert.equal(options.env.DO_NOT_TRACK, '1');
      assert.equal(options.env.DISABLE_TELEMETRY, '1');
      const source = join(project, '.conquistador-skills-source');
      cpSync(source, join(project, '.claude/skills/conquistador'), { recursive: true });
      writeFileSync(join(project, 'skills-lock.json'), JSON.stringify({ version: 1, skills: { conquistador: { sourceType: 'local', source } } }));
      return { status: 0, stdout: 'installed', stderr: '' };
    },
  });
  assert.equal(result, 0);
  assert.ok(existsSync(join(project, '.conquistador-skills-source/library/conquistador/commands/copy/COMMAND.md')));
  const npx = spawned.find(args => args[0] === 'npx');
  assert.ok(npx);
  assert.deepEqual(npx.slice(0, 3), ['npx', '--yes', SKILLS_PIN]);
  assert.ok(npx.includes('--copy'));
  assert.ok(npx.includes(SKILLS_AGENTS['claude-code']));
  assert.ok(npx.includes('-y'));
});

test('--skills dry-run does not download the manager or create folders', t => {
  const project = fixture(t);
  const result = invoke(project, ['--skills', '--host', 'codex', '--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /skills-lock.json/);
  assert.equal(existsSync(join(project, '.conquistador-skills-source')), false);
});

test('--plugin prepares a local source and does not run the host manager', t => {
  const project = fixture(t);
  const result = invoke(project, ['--plugin', '--host', 'claude-code', '--yes']);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(join(project, '.conquistador-plugin/.claude-plugin/plugin.json')));
  assert.match(result.stdout, /marketplace' 'add'/);
  assert.match(result.stdout, /--scope' 'local'/);
  assert.match(result.stdout, /Host registration is still required/);
  assert.doesNotMatch(result.stdout, /activated copy was created by setup/i);
  const repeat = invoke(project, ['--plugin', '--host', 'claude-code', '--yes']);
  assert.equal(repeat.status, 0, repeat.stderr);
  assert.match(repeat.stdout, /Host registration is unobserved/);
  assert.match(repeat.stdout, /marketplace' 'add'/);
  assert.match(repeat.stdout, /If already registered, retain the original manager and scope/);
});

test('--mcp prepares local and runtime connectors without starting a service', t => {
  const project = fixture(t);
  const local = invoke(project, ['--mcp', '--host', 'none', '--yes']);
  assert.equal(local.status, 0, local.stderr);
  assert.ok(existsSync(join(project, '.conquistador-mcp/connector.json')));
  assert.match(local.stdout, /lists and reads bundled methods|Local MCP/);
  rmSync(join(project, '.conquistador-mcp'), { recursive: true });
  const runtime = invoke(project, ['--mcp', '--host', 'cursor', '--url', 'https://runtime.example', '--runtime-path', root, '--yes']);
  assert.equal(runtime.status, 0, runtime.stderr);
  assert.ok(existsSync(join(project, '.conquistador-runtime-mcp/connector.json')));
  assert.match(runtime.stdout, /.cursor\/mcp.json/);
  assert.match(JSON.parse(readFileSync(join(project, '.conquistador-runtime-mcp/connector.json'), 'utf8')).args.join(' '), /--url/);
});

test('noninteractive shortcut without --yes or --dry-run returns 2', t => {
  const project = fixture(t);
  assert.equal(invoke(project, ['--plugin', '--host', 'none']).status, 2);
  assert.equal(existsSync(join(project, '.conquistador-plugin')), false);
});

test('route details precede confirmation, including manager download and scope', async () => {
  const events = [];
  const ui = { note: text => events.push(text), isCancel: () => false, confirm: async () => { events.push('confirm'); return true; } };
  await confirmPlan({ ui, tty: true, title: 'Install?', details: 'Download skills@1.5.26; project scope; writes skills-lock.json' });
  assert.deepEqual(events, ['Download skills@1.5.26; project scope; writes skills-lock.json', 'confirm']);
});

test('dry-run validates every shortcut destination and runtime URL before writing', t => {
  for (const [flags, folder] of [
    [['--skills', '--host', 'codex'], '.conquistador-skills-source'],
    [['--plugin', '--host', 'none'], '.conquistador-plugin'],
    [['--mcp', '--host', 'none'], '.conquistador-mcp'],
    [['--bot', 'hermes'], '.conquistador'],
  ]) {
    const project = fixture(t);
    mkdirSync(join(project, '.git'));
    writeFileSync(join(project, '.git', 'HEAD'), 'ref: refs/heads/main\n');
    mkdirSync(join(project, folder));
    writeFileSync(join(project, folder, 'keep'), 'untouched');
    const before = readdirSync(project);
    const result = invoke(project, [...flags, '--dry-run']);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.deepEqual(readdirSync(project), before);
    assert.equal(readFileSync(join(project, folder, 'keep'), 'utf8'), 'untouched');
  }
  const project = fixture(t);
  assert.equal(invoke(project, ['--mcp', '--host', 'none', '--url', 'not-an-origin', '--dry-run']).status, 2);
  assert.deepEqual(readdirSync(project), []);
});

test('local MCP cannot silently retain runtime mode through a custom path', t => {
  const project = fixture(t), path = join(project, 'connector');
  assert.equal(invoke(project, ['--mcp', '--host', 'none', '--url', 'https://runtime.example', '--path', path, '--yes']).status, 0);
  const before = treeDigest(path);
  const result = invoke(project, ['--mcp', '--host', 'none', '--path', path, '--dry-run']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /owns a runtime MCP connector/);
  assert.equal(treeDigest(path), before);
});

test('adoption is named on the initial confirmation and decline preserves its owner', async t => {
  const project = fixture(t);
  assert.equal(invoke(project, ['setup', 'install', '--target', 'codex', '--project', project]).status, 0);
  const native = join(project, '.agents/skills/conquistador'), before = treeDigest(native);
  const ui = fakeUi([]);
  ui.select = async options => {
    assert.match(options.message, /Adopt the unchanged independently managed skill/);
    assert.match(options.message, /operator uninstall will remove it too/);
    return Symbol('cancel');
  };
  assert.equal(await runOnboarding(['--host', 'codex'], { cwd: project, tty: true, ui }), 0);
  assert.equal(treeDigest(native), before);
  assert.equal(existsSync(join(project, '.conquistador')), false);
});

test('skills manager failure preserves staging and retry succeeds without switching managers', async t => {
  const project = fixture(t);
  const args = ['--skills', '--host', 'codex', '--yes'];
  assert.equal(await runOnboarding(args, { cwd: project, tty: false, spawn: () => ({ status: 1, stderr: 'download unavailable' }) }), 1);
  const source = join(project, '.conquistador-skills-source'), before = treeDigest(source);
  assert.equal(existsSync(join(project, 'skills-lock.json')), false);
  assert.equal(await runOnboarding(args, { cwd: project, tty: false, spawn: () => {
    cpSync(source, join(project, '.agents/skills/conquistador'), { recursive: true });
    writeFileSync(join(project, 'skills-lock.json'), JSON.stringify({ version: 1, skills: { conquistador: { sourceType: 'local', source: './.conquistador-skills-source' } } }));
    return { status: 0 };
  } }), 0);
  assert.equal(treeDigest(source), before);
  const copied = join(project, '.agents/skills/conquistador');
  for (const command of [
    ['--host', 'codex', '--yes'],
    ['setup', 'update', '--path', copied],
    ['setup', 'uninstall', '--path', copied],
  ]) {
    const result = invoke(project, command);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /skills.sh owns/);
  }
  assert.equal(treeDigest(copied), before);
});

test('skills wrapper refuses existing native copies, links, and overlapping staging paths', async t => {
  const project = fixture(t);
  assert.equal(invoke(project, ['install']).status, 0);
  const before = treeDigest(join(project, '.agents/skills/conquistador'));
  let spawned = false;
  assert.equal(await runOnboarding(['--skills', '--host', 'codex', '--yes'], { cwd: project, tty: false, spawn: () => { spawned = true; } }), 1);
  assert.equal(spawned, false);
  assert.equal(treeDigest(join(project, '.agents/skills/conquistador')), before);
  const empty = fixture(t);
  assert.equal(invoke(empty, ['--skills', '--host', 'cursor', '--path', '.agents', '--dry-run']).status, 1);
  assert.deepEqual(readdirSync(empty), []);
});

test('a manager exit zero without the promised copy or lockfile is not success', async t => {
  const project = fixture(t);
  assert.equal(await runOnboarding(['--skills', '--host', 'codex', '--yes'], { cwd: project, tty: false, spawn: () => ({ status: 0 }) }), 1);
  assert.ok(existsSync(join(project, '.conquistador-skills-source/SKILL.md')));
});

test('Hermes uses v2 ownership, retains it on repeat launch, and refuses duplicate shared discovery', t => {
  const project = fixture(t);
  mkdirSync(join(project, '.git'));
  writeFileSync(join(project, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  assert.equal(invoke(project, ['--bot', 'hermes', '--yes']).status, 0);
  const path = join(project, '.conquistador');
  assert.equal(projectIntegration(path).schemaVersion, 'conquistador.project-installation/v2');
  const before = treeDigest(path);
  assert.equal(invoke(project, ['--bot', 'hermes', '--yes']).status, 0);
  assert.equal(treeDigest(path), before);
  assert.equal(invoke(project, ['operator', 'update']).status, 0);
  assert.equal(invoke(project, ['operator', 'uninstall']).status, 0);
  mkdirSync(join(project, '.agents/skills/conquistador'), { recursive: true });
  writeFileSync(join(project, '.agents/skills/conquistador/SKILL.md'), 'keep');
  assert.equal(invoke(project, ['--bot', 'hermes', '--dry-run']).status, 1);
  assert.equal(existsSync(join(project, '.hermes/skills/conquistador')), false);
});

test('Ctrl-C exits 130 while Escape remains a clean cancellation', async () => {
  const input = new EventEmitter();
  const cancel = Symbol('cancel');
  const ui = { isCancel: value => value === cancel, select: async () => { input.emit('keypress', '\u0003', { ctrl: true, name: 'c' }); return cancel; } };
  await assert.rejects(cancellableUi(ui, input).select({}), error => error.cancelled && error.exitCode === 130);
  assert.equal(input.listenerCount('keypress'), 0);
  ui.select = async () => cancel;
  assert.equal(await cancellableUi(ui, input).select({}), cancel);
});

test('MCP handoffs and manager retries quote paths for POSIX and PowerShell', t => {
  const project = fixture(t), path = join(project, "connector's files");
  mkdirSync(path);
  writeFileSync(join(path, 'connector.json'), JSON.stringify({ command: '/node with spaces/node', args: [join(path, 'server.js'), 'mcp'] }));
  for (const platform of ['darwin', 'win32']) {
    const text = mcpHandoff('claude-code', path, false, project, platform);
    assert.match(text, /'--scope' 'local'/);
    assert.match(text, /'\/node with spaces\/node'/);
    assert.ok(text.includes(platform === 'win32' ? "connector''s files" : "connector'\\''s files"));
    const retry = retrySkills(project, path, 'codex', platform);
    assert.ok(retry.includes(platform === 'win32' ? "$env:DO_NOT_TRACK='1'" : 'DO_NOT_TRACK=1'));
    if (platform === 'win32') {
      assert.match(text, /Set-Location -LiteralPath '/);
      assert.match(retry, /& 'npx.cmd'/);
      assert.doesNotMatch(text + retry, /'-LiteralPath'/);
    }
  }
  assert.match(mcpHandoff('copilot', path, false), /~\/.copilot\/mcp-config.json[\s\S]*"type": "local"[\s\S]*"tools"/);
  assert.match(mcpHandoff('codex', path, false), /\[mcp_servers.conquistador\][\s\S]*args = \[/);
});

test('a wrong receipt mode cannot masquerade as a healthy installed operator', t => {
  const project = fixture(t);
  const path = join(project, '.conquistador');
  assert.equal(invoke(project, ['setup', 'install', '--target', 'skill', '--path', path]).status, 0);
  assert.equal(invoke(project, ['--yes']).status, 1);
});

test('ambiguous and absent active hosts ask one host question before one installation decision', async t => {
  for (const env of [{ PATH: '' }, { CLAUDECODE: '1', CURSOR_AGENT: '1', PATH: '' }]) {
    const project = fixture(t), questions = [];
    const ui = fakeUi([]);
    ui.select = async options => {
      questions.push(options);
      if (questions.length === 1) {
        assert.deepEqual(options.options.map(item => item.value), ['codex', 'bb', 'cursor', 'copilot', 'claude-code', 'none']);
        return 'none';
      }
      return Symbol('cancel');
    };
    assert.equal(await runOnboarding([], { cwd: project, tty: true, env, ui }), 0);
    assert.equal(questions.length, 2);
    assert.equal(questions[1].initialValue, 'setup');
    assert.deepEqual(readdirSync(project), []);
  }
});

test('domain restriction blocks shortcuts that would add an unrestricted parent', t => {
  const project = fixture(t);
  mkdirSync(join(project, '.conquistador'));
  writeFileSync(join(project, '.conquistador/domain-restriction.json'), '{}');
  for (const route of ['--skills', '--plugin', '--mcp']) {
    const result = invoke(project, [route, '--host', route === '--skills' ? 'codex' : 'none', '--dry-run']);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /domain-restricted operator/);
  }
  assert.deepEqual(readdirSync(project), ['.conquistador']);
});

test('first installation prints one prompt and explicit --project remains the receiving directory', t => {
  const invocation = fixture(t), project = join(invocation, 'receiving');
  mkdirSync(project);
  const result = invoke(invocation, ['--host', 'none', '--project', 'receiving', '--yes']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.match(/Use Conquistador to draft a marketing and growth plan/g)?.length, 1);
  assert.equal(existsSync(join(invocation, '.conquistador')), false);
  assert.ok(existsSync(join(project, '.conquistador/SKILL.md')));
  assert.equal(existsSync(join(project, 'package.json')), false);
  assert.equal(existsSync(join(project, 'skills-lock.json')), false);
});

test('local errors retain their cause and recovery state after application begins', async t => {
  const project = fixture(t), notes = [];
  const code = await runOnboarding(['--host', 'none'], { cwd: project, tty: true, ui: fakeUi(['setup'], notes), run: async args => {
    if (args[0] !== 'install' || args.includes('--dry-run')) return 0;
    mkdirSync(join(project, '.conquistador-transaction-recovery'));
    return { code: 1, output: 'Rollback needs attention. Preserve recovery files at .conquistador-transaction-recovery.' };
  } });
  assert.equal(code, 1);
  assert.ok(existsSync(join(project, '.conquistador-transaction-recovery')));
  assert.doesNotMatch(notes.join('\n'), /No files changed|files were restored/);
  const rerun = invoke(project, ['--host', 'none', '--yes']);
  assert.equal(rerun.status, 1);
  assert.match(rerun.stderr, /previous installation left recovery files/);
  assert.equal(existsSync(join(project, '.conquistador')), false);
  assert.ok(existsSync(join(project, '.conquistador-transaction-recovery')));
});


test('Git root discovery ignores empty markers and accepts valid worktree metadata', t => {
  const project = fixture(t);
  const marker = join(project, '.git');

  mkdirSync(marker);
  assert.notEqual(gitRoot(project), project);
  writeFileSync(join(marker, 'HEAD'), 'not a Git HEAD');
  assert.notEqual(gitRoot(project), project);
  writeFileSync(join(marker, 'HEAD'), 'ref: refs/heads/main\n');
  assert.equal(gitRoot(project), project);
  rmSync(marker, { recursive: true });
  const metadata = join(project, 'worktree-metadata');

  mkdirSync(metadata);
  writeFileSync(join(metadata, 'HEAD'), '0123456789abcdef0123456789abcdef01234567\n');
  writeFileSync(marker, 'gitdir: worktree-metadata\n');
  assert.equal(gitRoot(project), project);
  writeFileSync(marker, 'not a Git worktree file');
  assert.notEqual(gitRoot(project), project);
});
