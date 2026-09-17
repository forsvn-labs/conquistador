import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { operatorFiles } from './operator-package.mjs';
import { methodIdentity } from './installation-doctor.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, 'runtime/bin/conquistador.js');
const manifest = JSON.parse(readFileSync(join(root, 'release/completeness.json')));
const hash = value => createHash('sha256').update(value).digest('hex');
const run = (...args) => spawnSync(process.execPath, [cli, 'setup', ...args], { encoding: 'utf8' });
function install(path, target = 'skill') {
  const result = run('install', '--target', target, '--path', path);
  assert.equal(result.status, 0, result.stderr);
}
function doctor(path, code = 0) {
  const result = run('doctor', '--path', path, '--json');
  assert.equal(result.status, code, result.stdout + result.stderr);
  assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout);
  assert.equal(report.hostActivationVerified, false);
  assert.equal(report.taskExecutionVerified, false);
  assert.equal(report.providerVerified, false);
  return report;
}
function temporary(check) {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador doctor ')));
  try { check(join(parent, 'install'), parent); } finally { rmSync(parent, { recursive: true, force: true }); }
}
function rootBundle(path) {
  mkdirSync(path, { recursive: true });
  for (const file of operatorFiles) {
    mkdirSync(dirname(join(path, file)), { recursive: true });
    cpSync(join(root, file), join(path, file));
  }
  for (const name of ['SKILL.md', 'skills', 'release']) cpSync(join(root, name), join(path, name), { recursive: true });
}
function rewriteConnector(path, connector) {
  // These cases model the legacy connector-only receipt, still supported.
  rmSync(join(path, 'bundle'), { recursive: true, force: true });
  writeFileSync(join(path, 'connector.json'), JSON.stringify(connector));
  const receipt = JSON.parse(readFileSync(join(path, '.conquistador-install.json')));
  receipt.digest = hash(`connector.json\0${hash(readFileSync(join(path, 'connector.json')))}\n`);
  writeFileSync(join(path, '.conquistador-install.json'), JSON.stringify(receipt));
}

test('release manifest names every authored outcome, exact method contents, and required setup/specialist contracts', () => {
  assert.equal(manifest.schemaVersion, 'conquistador.install-completeness/v1');
  assert.equal(manifest.outcomes.length, 38);
  const names = readdirSync(join(root, 'skills')).filter(name => name !== 'conquistador').sort();
  assert.deepEqual(manifest.outcomes.map(method => method.name).sort(), names);
  for (const method of [manifest.parent, ...manifest.outcomes]) {
    const text = readFileSync(join(root, 'skills', method.name, 'SKILL.md'), 'utf8');
    assert.deepEqual(methodIdentity(text), { name: method.name, version: method.version });
    assert.equal(hash(text), method.sha256, method.name);
  }
  const resources = manifest.requiredResources.map(resource => resource.path);
  const specialists = readdirSync(join(root, 'skills/conquistador/specialists')).map(name => `conquistador/specialists/${name}`);
  for (const required of [...specialists, 'conquistador/orchestration/specialist-team.md', 'conquistador/methods/connect-accounts.md', 'conquistador/methods/stack-setup.md', 'conquistador/standards/setup.md', 'conquistador/operator-profile.json']) assert.ok(resources.includes(required), required);
  assert.equal(new Set(resources).size, resources.length);
  // Compare the whole resource inventory, including references below individual outcomes.
  const declared = new Set([...manifest.outcomes, manifest.parent].map(method => `${method.name}/SKILL.md`).concat(resources));
  for (const entry of readdirSync(join(root, 'skills'), { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) assert.ok(declared.has(join(entry.parentPath, entry.name).slice(join(root, 'skills').length + 1)), entry.name);
  }
  for (const resource of manifest.requiredResources) assert.equal(hash(readFileSync(join(root, 'skills', resource.path))), resource.sha256, resource.path);
});

test('root bundle and installer-owned host link pass without claiming source identity or model loading', () => temporary((path, parent) => {
  rootBundle(path);
  symlinkSync(path, join(parent, 'host-link'));
  const report = doctor(join(parent, 'host-link'));
  assert.equal(report.library.available, 38);
  assert.equal(report.library.layout, 'skills');
  assert.equal(report.identity.sourceCommit, null);
  assert.equal(report.receipt.state, 'absent');
  assert.equal(report.path, path);
  assert.match(report.summary, /^38 methods available;/);
  const text = run('doctor', '--path', path).stdout;
  assert.match(text, /No methods were loaded into the model context/);
  assert.ok(text.includes(`Parent version: ${manifest.parent.version}`));
  assert.match(text, /Operator profile: present \(activation manual\)/);
}));

test('compact, plugin, and harness payloads include the manifest and distinguish BB adapter availability', () => temporary(path => {
  for (const [target, layout, adapter] of [['skill', 'library', false], ['claude-plugin', 'skills/conquistador/library', true], ['harness', 'library', true]]) {
    install(path, target);
    const receipt = readFileSync(join(path, '.conquistador-install.json'));
    const report = doctor(path);
    assert.equal(report.library.layout, layout);
    assert.equal(report.library.available, 38);
    assert.equal(report.manifest.packaged, 'matches');
    assert.equal(report.receipt.state, 'unchanged');
    assert.equal(report.receipt.productVersion, '0.0.8');
    assert.equal(report.bbAdapterPresent, adapter);
    assert.equal(report.operatorProfilePresent, true);
    assert.equal(report.operatorActivation, 'manual');
    assert.deepEqual(readFileSync(join(path, '.conquistador-install.json')), receipt);
    rmSync(path, { recursive: true });
  }
}));

test('missing and nested-parent-only installations cannot pass', () => temporary(path => {
  assert.equal(doctor(path, 1).library.available, 0);
  assert.equal(existsSync(path), false);
  cpSync(join(root, 'skills/conquistador'), path, { recursive: true });
  assert.equal(doctor(path, 1).library.available, 0);
}));

test('missing outcomes and truncated methods fail even when frontmatter is intact', () => temporary(path => {
  rootBundle(path);
  rmSync(join(path, 'skills/write-copy/SKILL.md'));
  const method = join(path, 'skills/plan-campaign/SKILL.md');
  const original = readFileSync(method, 'utf8');
  writeFileSync(method, original.slice(0, original.indexOf('\n---', 4) + 4));
  const report = doctor(path, 1);
  assert.equal(report.library.available, 36);
  assert.ok(report.issues.some(issue => issue.includes('write-copy')));
  assert.ok(report.issues.some(issue => issue.includes('plan-campaign')));
}));

test('parent version, missing contracts, entrypoint drift, and manifest drift are visible independently', () => temporary(path => {
  rootBundle(path);
  const parent = join(path, 'skills/conquistador/SKILL.md');
  writeFileSync(parent, readFileSync(parent, 'utf8').replace(`version: ${manifest.parent.version}`, 'version: 0.0.0'));
  rmSync(join(path, 'skills/conquistador/methods/connect-accounts.md'));
  writeFileSync(join(path, 'SKILL.md'), '# A wrapper with no operating contract');
  writeFileSync(join(path, 'release/completeness.json'), '{}');
  const report = doctor(path, 1);
  assert.equal(report.library.available, 38);
  assert.equal(report.library.methods[0].version, '0.0.0');
  assert.ok(report.issues.some(issue => issue.includes('connect-accounts')));
  assert.ok(report.issues.some(issue => issue.includes('Entry point')));
  assert.equal(report.manifest.packaged, 'differs');
}));

test('modified receipts fail without changing user files', () => temporary(path => {
  install(path);
  writeFileSync(join(path, 'operator-note.md'), 'preserve');
  const report = doctor(path, 1);
  assert.equal(report.library.available, 38);
  assert.equal(report.receipt.state, 'modified');
  assert.equal(readFileSync(join(path, 'operator-note.md'), 'utf8'), 'preserve');
}));

test('an invalid operator profile fails closed without claiming activation', () => temporary(path => {
  rootBundle(path);
  writeFileSync(join(path, 'skills/conquistador/operator-profile.json'), JSON.stringify({
    schemaVersion: 'conquistador.operator-profile/v1',
    activation: 'watch',
    admittedDomains: ['product'],
    disclosure: 'capabilities-and-specialists',
    backgroundWatch: false,
    externalMutation: 'human-gated',
  }));
  const report = doctor(path, 1);
  assert.equal(report.operatorProfilePresent, true);
  assert.equal(report.operatorActivation, null);
  assert.ok(report.issues.some(issue => issue.includes('Operator profile is present but invalid')));
}));

test('missing supporting resources fail for unmanaged installs even when all method bodies match', () => temporary(path => {
  rootBundle(path);
  for (const resource of ['conquistador/standards/learning.md', 'conquistador/standards/context.md', 'write-copy/references/copy-review.md']) rmSync(join(path, 'skills', resource));
  const report = doctor(path, 1);
  assert.equal(report.library.available, 38);
  assert.equal(report.issues.filter(issue => issue.startsWith('Missing or unreadable resource:')).length, 3);
}));

test('symlinked method bodies are refused even when they point at the expected bytes', () => temporary(path => {
  rootBundle(path);
  rmSync(join(path, 'skills/write-copy/SKILL.md'));
  symlinkSync(join(root, 'skills/write-copy/SKILL.md'), join(path, 'skills/write-copy/SKILL.md'));
  assert.equal(doctor(path, 1).library.available, 37);
}));

test('managed MCP checks the source library and saved paths independently from its unchanged receipt', () => temporary((path, parent) => {
  install(path, 'mcp');
  const initial = doctor(path);
  assert.equal(initial.library.available, 38);
  assert.deepEqual(initial.connector, { nodeExecutable: true, packageExecutable: true, mode: 'local-methods' });
  const connector = JSON.parse(readFileSync(join(path, 'connector.json')));
  connector.command = join(parent, 'node');
  // An executable fixture must never be invoked by this read-only diagnostic.
  writeFileSync(connector.command, '#!/bin/sh\nexit 99\n', { mode: 0o755 });
  const source = join(parent, 'source');
  rootBundle(source);
  mkdirSync(join(source, 'runtime/bin'), { recursive: true });
  cpSync(cli, join(source, 'runtime/bin/conquistador.js'));
  connector.args[0] = join(source, 'runtime/bin/conquistador.js');
  rewriteConnector(path, connector);
  assert.equal(doctor(path).receipt.state, 'unchanged');
  rmSync(connector.command);
  const missingNode = doctor(path, 1);
  assert.equal(missingNode.receipt.state, 'unchanged');
  assert.equal(missingNode.connector.nodeExecutable, false);
  assert.equal(missingNode.connector.packageExecutable, true);
  rmSync(connector.args[0]);
  const missingPackage = doctor(path, 1);
  assert.equal(missingPackage.receipt.state, 'unchanged');
  assert.equal(missingPackage.connector.packageExecutable, false);
  assert.equal(missingPackage.library.available, 0);
}));

test('managed MCP rejects non-executable Node paths and malformed connectors without running them', () => temporary((path, parent) => {
  install(path, 'mcp');
  const connector = JSON.parse(readFileSync(join(path, 'connector.json')));
  connector.command = join(parent, 'node');
  writeFileSync(connector.command, 'must not execute');
  chmodSync(connector.command, 0o644);
  rewriteConnector(path, connector);
  assert.equal(doctor(path, 1).connector.nodeExecutable, false);
  rewriteConnector(path, { command: process.execPath, args: ['unrelated', 'other-command'] });
  assert.ok(doctor(path, 1).issues.some(issue => issue.includes('malformed')));
}));

test('managed MCP follows the package script to the library Node would import', () => temporary((path, parent) => {
  install(path, 'mcp');
  const sources = [join(parent, 'A'), join(parent, 'B')];
  for (const source of sources) {
    rootBundle(source);
    mkdirSync(join(source, 'runtime/bin'), { recursive: true });
  }
  const [a, b] = sources.map(source => join(source, 'runtime/bin/conquistador.js'));
  cpSync(cli, b);
  symlinkSync(b, a);
  rmSync(join(sources[1], 'skills/write-copy/SKILL.md'));
  rewriteConnector(path, { command: process.execPath, args: [a, 'mcp'] });
  const report = doctor(path, 1);
  assert.equal(report.receipt.state, 'unchanged');
  assert.equal(report.bundleRoot, sources[1]);
  assert.equal(report.library.available, 37);
}));

test('Git identity belongs only to an exact source root and marks modified checkouts', () => temporary((path, parent) => {
  rootBundle(path);
  const git = (...args) => execFileSync('git', ['-C', path, ...args], { stdio: 'pipe' }).toString().trim();
  git('init');
  git('add', '.');
  git('-c', 'user.name=Local Test', '-c', 'user.email=test@example.invalid', '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Local fixture');
  const clean = doctor(path);
  assert.equal(clean.identity.sourceCommit, git('rev-parse', 'HEAD'));
  assert.equal(clean.identity.sourceClean, true);
  const index = readFileSync(join(path, '.git/index'));
  utimesSync(join(path, 'SKILL.md'), new Date(), new Date());
  assert.equal(doctor(path).identity.sourceClean, true);
  assert.deepEqual(readFileSync(join(path, '.git/index')), index);
  writeFileSync(join(path, 'local-note'), 'local');
  assert.equal(doctor(path).identity.sourceClean, false);
  const nested = join(path, '.agents/skills/conquistador');
  rootBundle(nested);
  assert.equal(doctor(nested).identity.sourceCommit, null);
}));

test('doctor is usable before runtime libraries and dependencies exist and rejects invalid flags', () => temporary((path, parent) => {
  rootBundle(path);
  for (const file of ['runtime/bin/conquistador.js', 'tools/setup.mjs', 'tools/domain-package.mjs', 'tools/installation-doctor.mjs',
    'tools/install-paths.mjs', 'tools/setup-routes.mjs', 'tools/method-library.mjs', 'tools/stage-method-library.mjs', 'tools/setup-guide.mjs', 'tools/setup-mcp.mjs', 'tools/operator-package.mjs', 'tools/project-installation.mjs', 'tools/setup-surfaces.mjs']) {
    mkdirSync(dirname(join(path, file)), { recursive: true });
    cpSync(join(root, file), join(path, file));
  }
  const result = spawnSync(process.execPath, [join(path, 'runtime/bin/conquistador.js'), 'setup', 'doctor', '--path', path, '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(path, 'runtime/lib')), false);
  assert.equal(existsSync(join(path, 'node_modules')), false);
  for (const args of [[], ['--path', 'relative'], ['--path', path, '--path', path], ['--path', path, '--json', '--json'], ['--path', path, '--target', 'unknown']]) assert.equal(run('doctor', ...args).status, 1);
  assert.match(run('--help').stdout, /setup doctor --path ABS \[--json\]/);
}));

test('doctor verifies the executable operator inventory and rewritten portable contract', () => temporary(path => {
  rootBundle(path);
  rmSync(join(path, 'hosts/coding-agent/receipt.mjs'));
  let report = doctor(path, 1);
  assert.equal(report.bbAdapterPresent, false);
  assert.ok(report.issues.some(issue => issue.includes('hosts/coding-agent/receipt.mjs')));
  rmSync(path, { recursive: true });
  install(path, 'operator');
  const agentPath = join(path, 'agent/agent.json');
  const agent = JSON.parse(readFileSync(agentPath));
  agent.delegation.maxDelegationsPerRun = 100;
  writeFileSync(agentPath, JSON.stringify(agent));
  report = doctor(path, 1);
  assert.ok(report.issues.some(issue => issue.includes('operator contract differs')));
}));

test('doctor rejects unknown and duplicate operator domains with the same validator as activation', () => temporary(path => {
  rootBundle(path);
  const file = join(path, 'skills/conquistador/operator-profile.json');
  const profile = JSON.parse(readFileSync(file));
  for (const admittedDomains of [['unknown'], ['product', 'product']]) {
    writeFileSync(file, JSON.stringify({ ...profile, admittedDomains }));
    const report = doctor(path, 1);
    assert.equal(report.operatorActivation, null);
    assert.ok(report.issues.some(issue => issue.includes('Operator profile is present but invalid')));
  }
}));
