import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'tools/setup.mjs');
function setup(...args) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, PATH: '/nonexistent' } });
  return { code: result.status, text: result.stdout + result.stderr };
}
function good(...args) { const result = setup(...args); assert.equal(result.code, 0, result.text); return result.text; }
function bad(...args) { const result = setup(...args); assert.notEqual(result.code, 0, result.text); return result.text; }
async function temporary(run) {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador setup spaces ')));
  try { await run(join(parent, 'owned folder'), parent); } finally { rmSync(parent, { recursive: true, force: true }); }
}

test('compact lifecycle uses receipt mode without target and reports local truth', () => temporary(path => {
  assert.match(good('status', '--path', path), /absent/);
  assert.match(good('install', '--target', 'skill', '--path', path), /Prepared locally\. Host activation unverified/);
  assert.ok(existsSync(join(path, 'SKILL.md')));
  assert.match(good('status', '--path', path), /unchanged/);
  assert.match(good('update', '--path', path), /unchanged/);
  assert.match(good('uninstall', '--path', path), /absent/);
  assert.equal(existsSync(path), false);
}));

test('host project mappings install complete compact bundles', () => temporary((path, parent) => {
  const mappings = { codex: '.agents', 'claude-code': '.claude', copilot: '.github', cursor: '.cursor' };
  for (const [target, folder] of Object.entries(mappings)) {
    const project = join(parent, target);
    good('install', '--target', target, '--project', project);
    const installed = join(project, folder, 'skills/conquistador');
    assert.ok(existsSync(join(installed, 'library/conquistador/METHOD.md')));
    good('uninstall', '--path', installed);
  }
}));

test('modified and unowned folders and wrong modes refuse mutation', () => temporary(path => {
  good('install', '--target', 'skill', '--path', path);
  assert.match(good('status', '--target', 'harness', '--path', path), /wrong-target/);
  bad('uninstall', '--target', 'harness', '--path', path);
  writeFileSync(join(path, 'operator-notes.md'), 'preserve');
  assert.match(good('status', '--path', path), /modified/);
  for (const action of ['update', 'uninstall']) bad(action, '--path', path);
  assert.equal(readFileSync(join(path, 'operator-notes.md'), 'utf8'), 'preserve');
  rmSync(join(path, '.conquistador-install.json'));
  bad('uninstall', '--path', path);
  assert.match(good('status', '--path', path), /modified/);
}));

test('malformed input fails before creating paths', () => temporary((path, parent) => {
  for (const args of [
    ['install', '--target', 'unknown', '--path', path],
    ['install', '--target', 'skill', '--path', path, '--unknown', 'x'],
    ['install', '--target', 'skill', '--path', path, '--path', path],
    ['install', '--target', 'skill', '--path', path, '--url', 'https://example.com'],
    ['install', '--target', 'skill', '--path', 'relative'],
    ['install', '--target', 'skill', '--path', path, '--project', parent],
    ['install', '--target', 'skill', '--project', parent],
    ['install', '--target', 'skill', '--path', path, '--target'],
    ['status', '--path', path, '--url', 'https://example.com'],
  ]) bad(...args);
  assert.deepEqual(readdirSync(parent), []);
}));

test('MCP origin validation rejects credentials and malformed URLs without writes', () => temporary((path, parent) => {
  for (const url of ['garbage', 'https:example.com', 'file:///tmp/foo', 'http://example.com', 'https://user:secret@example.com', 'https://example.com?token=secret', 'https://example.com?', 'https://example.com/#fragment', 'https://example.com/path', 'https://example.com\\evil', ' https://example.com', 'https://example.com/\n']) {
    const output = bad('install', '--target', 'mcp', '--path', path, '--url', url);
    assert.doesNotMatch(output, /user:secret|token=secret/);
  }
  assert.deepEqual(readdirSync(parent), []);
}));

test('MCP config lifecycle retains service/data and never connects or edits host configuration', () => temporary(async (path, parent) => {
  let requests = 0;
  const server = createServer((req, res) => { requests++; res.end('unexpected'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const sentinel = join(parent, 'host-config.json');
  writeFileSync(sentinel, '{"keep":"model and data settings"}');
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    assert.match(good('install', '--target', 'mcp', '--path', path, '--url', url), /configured locally\. Client registration unverified/);
    const config = JSON.parse(readFileSync(join(path, 'connector.json')));
    assert.deepEqual(config, { command: process.execPath, args: [join(root, 'runtime/bin/conquistador.js'), 'mcp', '--url', url] });
    assert.deepEqual(readdirSync(path).sort(), ['.conquistador-install.json', 'connector.json']);
    good('update', '--path', path);
    good('update', '--target', 'mcp', '--path', path, '--url', 'https://example.com');
    assert.equal(JSON.parse(readFileSync(join(path, 'connector.json'))).args.at(-1), 'https://example.com');
    good('uninstall', '--path', path);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests, 0);
    assert.equal(server.listening, true);
    assert.equal(readFileSync(sentinel, 'utf8'), '{"keep":"model and data settings"}');
    assert.deepEqual(readdirSync(parent), ['host-config.json']);
  } finally { await new Promise(resolve => server.close(resolve)); }
}));

test('MCP local edits prevent removal and update', () => temporary(path => {
  good('install', '--target', 'mcp', '--path', path, '--url', 'http://[::1]:4317');
  writeFileSync(join(path, 'connector.json'), '{"operator":"edit"}');
  assert.match(good('status', '--path', path), /modified/);
  bad('update', '--target', 'mcp', '--path', path, '--url', 'https://example.com');
  bad('uninstall', '--path', path);
  assert.equal(readFileSync(join(path, 'connector.json'), 'utf8'), '{"operator":"edit"}');
}));

test('plugin and harness staging use shared receipt modes; experiments are handoff only', () => temporary(path => {
  for (const target of ['claude-plugin', 'codex-plugin', 'copilot-plugin', 'agent-plugins', 'harness', 'squad']) {
    const output = good('install', '--target', target, '--path', path);
    assert.match(output, /Host activation unverified/);
    if (target.includes('plugin')) assert.match(output, /remain host-owned/);
    if (target === 'claude-plugin') {
      assert.match(output, /'claude' 'plugin' 'marketplace' 'add'/);
      assert.match(output, /'--scope' 'local'/);
    }
    if (target === 'codex-plugin') assert.match(output, /'codex' 'plugin' 'add'/);
    if (target === 'copilot-plugin') assert.match(output, /'copilot' 'plugin' 'install'/);
    good('update', '--path', path);
    good('uninstall', '--path', path);
  }
  for (const target of ['grok-bot', 'eve']) {
    assert.match(good('install', '--target', target, '--path', path), /Experimental handoff only\. No files installed/);
    assert.equal(existsSync(path), false);
  }
}));

test('symlink ancestors and payloads are refused', () => temporary((path, parent) => {
  symlinkSync(parent, path);
  bad('install', '--target', 'skill', '--path', join(path, 'install'));
  unlinkSync(path);
  good('install', '--target', 'mcp', '--path', path, '--url', 'https://example.com');
  symlinkSync(join(path, 'connector.json'), join(path, 'link'));
  assert.match(good('status', '--path', path), /modified/);
  bad('uninstall', '--path', path);
}));

test('module is import-safe and no-argument nonterminal input explains guided usage', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `const m = await import(${JSON.stringify(script)}); if (typeof m.runSetup !== 'function') throw Error('missing API');`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.match(bad(), /Interactive setup requires a terminal/);
});


test('exported API returns numeric failure without terminating embedding process', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `const { runSetup } = await import(${JSON.stringify(script)}); const code = await runSetup(['unknown']); if (code !== 1) throw Error('wrong return'); console.log('embedding continued');`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /embedding continued/);
});


test('ancestor projects allow sibling skill installs while source-containing targets fail closed', () => temporary((path, parent) => {
  function distribution(destination) {
    mkdirSync(destination, { recursive: true });
    for (const name of ['tools', 'skills', 'docs', 'release', 'LICENSE', 'NOTICE.md', 'package.json']) {
      cpSync(join(root, name), join(destination, name), { recursive: true });
    }
    return join(destination, 'tools/setup.mjs');
  }
  const project = join(parent, 'project with nested source');
  const nestedScript = distribution(join(project, '0-projects', 'source'));
  const invoke = (scriptPath, ...args) => spawnSync(process.execPath, [scriptPath, ...args], { encoding: 'utf8' });
  const install = invoke(nestedScript, 'install', '--target', 'codex', '--project', project);
  assert.equal(install.status, 0, install.stderr);
  const destination = join(project, '.agents/skills/conquistador');
  assert.ok(existsSync(join(destination, 'SKILL.md')));
  assert.ok(existsSync(nestedScript));
  assert.equal(invoke(nestedScript, 'uninstall', '--path', destination).status, 0);
  assert.ok(existsSync(nestedScript));

  const unsafeProject = join(parent, 'source inside target');
  const unsafeScript = distribution(join(unsafeProject, '.agents/skills/conquistador/source'));
  const before = readFileSync(unsafeScript, 'utf8');
  for (const action of ['install', 'status', 'update', 'uninstall']) {
    const result = invoke(unsafeScript, action, '--target', 'codex', '--project', unsafeProject);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /outside the distribution/);
  }
  assert.equal(readFileSync(unsafeScript, 'utf8'), before);
}));

test('plugin, MCP, and harness cleanup reminders precede the removal result', () => temporary(path => {
  for (const target of ['claude-plugin', 'mcp', 'harness', 'squad']) {
    good('install', '--target', target, '--path', path, ...(target === 'mcp' ? ['--url', 'http://127.0.0.1:4317'] : []));
    const output = good('uninstall', '--path', path);
    const reminder = output.indexOf('Before removing this folder:');
    assert.ok(reminder >= 0, output);
    assert.ok(reminder < output.indexOf('Removed the unchanged owned local copy.'), output);
    assert.equal(existsSync(path), false);
  }
}));


test('default MCP connector uses local stdio with no server and preserves mode during update', () => temporary(path => {
  const output = good('install', '--target', 'mcp', '--path', path);
  assert.match(output, /stdio serves bundled methods/);
  const expected = { command: process.execPath, args: [join(path, 'bundle/runtime/bin/conquistador.js'), 'mcp'] };
  assert.deepEqual(JSON.parse(readFileSync(join(path, 'connector.json'))), expected);
  good('update', '--path', path);
  assert.deepEqual(JSON.parse(readFileSync(join(path, 'connector.json'))), expected);
  good('uninstall', '--path', path);
  assert.equal(existsSync(path), false);
}));

test('domain install records the restriction; knowledge roots stay outside the product', () => temporary((path, parent) => {
  const manifest = join(parent, 'domain.json');
  const rootsFile = join(parent, 'roots.json');
  const notes = join(parent, 'notes');
  mkdirSync(notes);
  writeFileSync(manifest, JSON.stringify({
    schemaVersion: 'conquistador.domain-package/v1',
    id: 'domain:diagnosis',
    agentPackageSchemaVersion: 'conquistador.agent-package/v2',
    allowed: {
      roles: ['data-diagnosis'],
      skills: [],
      workflows: [],
      tools: ['host-model'],
      knowledgeHandles: ['vault:notes'],
    },
  }));
  writeFileSync(rootsFile, JSON.stringify({
    schemaVersion: 'conquistador.knowledge-roots/v1',
    roots: { 'vault:notes': notes },
  }));
  assert.match(good('install', '--target', 'skill', '--path', path, '--domain', manifest, '--knowledge-roots', rootsFile), /Domain: domain:diagnosis/);
  assert.ok(existsSync(join(path, 'domain-restriction.json')));
  assert.ok(existsSync(join(path, 'library/diagnose-growth/METHOD.md')));
  assert.equal(existsSync(join(path, 'library/write-copy')), false);
  good('uninstall', '--path', path);
  const inside = join(root, 'skills');
  writeFileSync(join(parent, 'inside-roots.json'), JSON.stringify({
    schemaVersion: 'conquistador.knowledge-roots/v1',
    roots: { 'vault:notes': inside },
  }));
  assert.match(bad('install', '--target', 'skill', '--path', path, '--domain', manifest, '--knowledge-roots', join(parent, 'inside-roots.json')), /outside the product package/);
  assert.equal(existsSync(path), false);
}));

test('project operator and harness alias share lifecycle without changing host routing or user work', () => temporary((path, project) => {
  const sentinel = join(project, 'AGENTS.md');
  writeFileSync(sentinel, 'Existing host instructions.');
  const installed = join(project, '.conquistador-operator');
  const output = good('install', '--target', 'operator', '--project', project);
  assert.match(output, /agent\/skills\/conquistador\/SKILL.md/);
  assert.match(output, /Project routing needs a host adapter/);
  assert.ok(existsSync(join(installed, 'agents/execution-receipt.schema.json')));
  assert.ok(existsSync(join(installed, 'agents/conquistador/compatibility/v1.json')));
  assert.equal(JSON.parse(readFileSync(join(installed, '.conquistador-install.json'))).mode, 'single-agent');
  assert.match(good('status', '--target', 'harness', '--path', installed), /unchanged/);
  good('update', '--target', 'harness', '--path', installed);
  assert.match(good('doctor', '--path', installed), /38 methods available/);
  good('uninstall', '--target', 'operator', '--project', project);
  assert.equal(existsSync(installed), false);
  assert.equal(readFileSync(sentinel, 'utf8'), 'Existing host instructions.');
  assert.deepEqual(readdirSync(project), ['AGENTS.md']);
}));

test('short operator commands default to the current project and preserve the complete package', () => temporary((path, parent) => {
  const cli = join(root, 'runtime/bin/conquistador.js');
  const project = join(parent, 'short operator project');
  const directProject = join(parent, 'direct operator project');
  mkdirSync(project); mkdirSync(directProject);
  const short = (...args) => spawnSync(process.execPath, [cli, ...args], {
    cwd: project, encoding: 'utf8', env: { ...process.env, PATH: '/nonexistent' },
  });
  const ok = (...args) => {
    const result = short(...args);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return result.stdout;
  };
  assert.match(ok('install'), /Prepared locally/);
  const installed = join(project, '.conquistador-operator');
  const report = JSON.parse(ok('operator', 'doctor', '--json'));
  assert.equal(report.library.available, 38);
  assert.equal(report.bbAdapterPresent, true);
  assert.equal(report.operatorProfilePresent, true);
  assert.equal(report.operatorActivation, 'manual');
  assert.equal(report.hostActivationVerified, false);
  assert.equal(report.taskExecutionVerified, false);
  assert.match(ok('operator', 'status'), /Local state: unchanged/);
  assert.match(ok('operator', 'update', '--project', '.'), /Prepared locally/);

  good('install', '--target', 'operator', '--project', directProject);
  const shortReceipt = JSON.parse(readFileSync(join(installed, '.conquistador-install.json')));
  const directReceipt = JSON.parse(readFileSync(join(directProject, '.conquistador-operator', '.conquistador-install.json')));
  assert.equal(shortReceipt.mode, 'single-agent');
  assert.equal(shortReceipt.digest, directReceipt.digest);

  assert.match(ok('operator', 'uninstall'), /Local state: absent/);
  assert.equal(existsSync(installed), false);
  good('uninstall', '--target', 'operator', '--project', directProject);
}));

test('setup lists routes and requires an explicit lifecycle target', () => temporary((path, project) => {
  const invoke = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: project, encoding: 'utf8' });
  const routes = JSON.parse(invoke('list', '--json').stdout);
  assert.equal(routes.length, 7);
  for (const action of ['status', 'doctor', 'update', 'uninstall']) {
    const result = invoke(action);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Choose --target/);
  }
  assert.equal(invoke('install').status, 0);
  assert.match(invoke('status', '--target', 'operator').stdout, /unchanged/);
  assert.equal(JSON.parse(invoke('doctor', '--target', 'operator', '--json').stdout).library.available, 38);
  assert.equal(invoke('uninstall', '--target', 'operator').status, 0);
  assert.deepEqual(readdirSync(project), []);
}));

test('local MCP survives loss of the launching cache and does not add project dependencies', () => temporary((path, parent) => {
  const source = join(parent, '_npx', 'cached-package');
  mkdirSync(source, { recursive: true });
  for (const name of ['package.json', 'LICENSE', 'NOTICE.md', 'SKILL.md', 'skills', 'release', 'tools', 'agents', 'hosts/coding-agent', 'runtime/bin']) {
    mkdirSync(dirname(join(source, name)), { recursive: true });
    cpSync(join(root, name), join(source, name), { recursive: true });
  }
  const runCached = (...args) => spawnSync(process.execPath, [join(source, 'tools/setup.mjs'), ...args], { encoding: 'utf8' });
  const denied = runCached('install', '--target', 'mcp', '--path', path, '--url', 'https://runtime.example');
  assert.equal(denied.status, 1);
  assert.match(denied.stderr, /stable installation/);
  assert.equal(existsSync(path), false);
  const result = runCached('install', '--target', 'mcp', '--path', path);
  assert.equal(result.status, 0, result.stderr);
  const connector = JSON.parse(readFileSync(join(path, 'connector.json')));
  renameSync(source, `${source}-removed`);
  const messages = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'lifecycle-test', version: '1' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'conquistador_methods', arguments: {} } },
  ];
  const processResult = spawnSync(connector.command, connector.args, { encoding: 'utf8', input: messages.map(message => JSON.stringify(message)).join('\n') + '\n' });
  assert.equal(processResult.status, 0, processResult.stderr);
  const response = JSON.parse(processResult.stdout.trim().split('\n').at(-1));
  assert.equal(JSON.parse(response.result.content[0].text).methods.length, 39);
  assert.equal(JSON.parse(good('doctor', '--path', path, '--json')).library.available, 38);
  for (const name of ['node_modules', 'package.json', 'package-lock.json', 'bun.lock']) assert.equal(existsSync(join(parent, name)), false);
  good('update', '--path', path);
  good('uninstall', '--path', path);
}));

test('runtime MCP can use an explicit stable distribution and rejects runtime flags on other routes', () => temporary(path => {
  good('install', '--target', 'mcp', '--path', path, '--url', 'https://runtime.example', '--runtime-path', root);
  assert.equal(JSON.parse(readFileSync(join(path, 'connector.json'))).args[0], join(root, 'runtime/bin/conquistador.js'));
  good('uninstall', '--path', path);
  assert.match(bad('install', '--target', 'skill', '--path', path, '--runtime-path', root), /MCP/);
  assert.match(bad('install', '--target', 'mcp', '--path', path, '--runtime-path', root), /--url/);
  assert.equal(existsSync(path), false);
}));

test('unchanged legacy local MCP receipts migrate even when the old source is missing', () => temporary(path => {
  mkdirSync(path);
  const connector = JSON.stringify({ command: process.execPath, args: ['/missing/runtime/bin/conquistador.js', 'mcp'] });
  writeFileSync(join(path, 'connector.json'), connector);
  const hash = value => createHash('sha256').update(value).digest('hex');
  writeFileSync(join(path, '.conquistador-install.json'), JSON.stringify({
    schemaVersion: 'conquistador.public-install/v1', mode: 'mcp',
    digest: hash(`connector.json\0${hash(connector)}\n`), liveHostVerified: false,
  }));
  assert.match(good('status', '--path', path), /unchanged/);
  assert.equal(setup('doctor', '--path', path).code, 1);
  good('update', '--path', path);
  assert.equal(JSON.parse(good('doctor', '--path', path, '--json')).library.available, 38);
  assert.ok(existsSync(join(path, 'bundle/tools/skills-mcp.mjs')));
  good('uninstall', '--path', path);
}));
