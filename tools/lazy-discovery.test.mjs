import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalText, internalPath, methodLibrary, regularFiles, skillDiscovery } from './method-library.mjs';
import { shouldStageSkillPath, resolveDomainSelection } from './domain-package.mjs';
import { loadOperatorProfile } from '../hosts/coding-agent/operator.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, 'runtime/bin/conquistador.js');
const canonical = regularFiles(join(root, 'skills'));
const template = readFileSync(join(root, 'tools/entrypoint/SKILL.md'), 'utf8');
function invoke(project, ...args) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: project, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}
function temporary(t) {
  const project = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador lazy ')));
  t.after(() => rmSync(project, { recursive: true, force: true }));
  writeFileSync(join(project, 'AGENTS.md'), 'Preserve user instructions.\n');
  return project;
}
function checkLinks(library) {
  const files = regularFiles(library);
  for (const path of files.filter(path => path.endsWith('.md'))) {
    const text = readFileSync(join(library, path), 'utf8');
    for (const [, href] of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      if (/^(?:[a-z]+:|\/|#)/i.test(href)) continue;
      const target = posix.normalize(posix.join(posix.dirname(path), decodeURIComponent(href.split(/[?#]/)[0])));
      assert.ok(!target.startsWith('../'), `${path}: escapes library via ${href}`);
      assert.ok(existsSync(join(library, target)), `${path}: missing ${href}`);
    }
  }
}
function checkFullParity(library) {
  const files = regularFiles(library);
  assert.deepEqual([...files].sort(), [...canonical.map(internalPath), 'conquistador/catalog.md'].sort());
  for (const path of canonical) {
    const expected = readFileSync(join(root, 'skills', path));
    const actual = readFileSync(join(library, internalPath(path)));
    // Compare every byte after reversing only the declared internal filename adaptation.
    if (path.endsWith('.md')) assert.equal(canonicalText(actual.toString('utf8')), expected.toString('utf8'), path);
    else assert.deepEqual(actual, expected, path);
    if (process.platform !== 'win32') assert.equal(statSync(join(library, internalPath(path))).mode & 0o111, statSync(join(root, 'skills', path)).mode & 0o111, path);
  }
  checkLinks(library);
}
const assignment = (role, extra = {}) => ({ id: 'work', role, goal: 'Produce a bounded draft.', skills: [], workflows: [], knowledgeHandles: [], dependsOn: [], ...extra });
async function installedLoader(path) {
  return (await import(pathToFileURL(join(path, 'hosts/coding-agent/contracts.mjs')))).loadAssignment;
}

test('every native skill target exposes one concise parent and preserves all method/resource bytes', t => {
  const project = temporary(t);
  for (const target of ['codex', 'claude-code', 'copilot', 'cursor', 'skill']) {
    const path = join(project, 'owned');
    invoke(project, 'setup', 'install', '--target', target, '--path', path);
    const discovery = skillDiscovery(path);
    assert.deepEqual(discovery.entries.map(entry => entry.path), ['SKILL.md']);
    assert.equal(readFileSync(join(path, 'SKILL.md'), 'utf8'), template);
    assert.ok(discovery.entries[0].description.startsWith('Plan launches and growth'));
    assert.ok(discovery.entries[0].description.length < 180);
    assert.ok(discovery.metadataCharacters < 512, JSON.stringify(discovery));
    checkFullParity(join(path, 'library'));
    const report = JSON.parse(invoke(project, 'setup', 'doctor', '--path', path, '--json'));
    assert.equal(report.library.available, 38);
    assert.equal(report.discovery.count, 1);
    assert.equal(report.bbAdapterPresent, false);
    const before = report.receipt.digest;
    invoke(project, 'setup', 'update', '--path', path);
    assert.equal(JSON.parse(invoke(project, 'setup', 'doctor', '--path', path, '--json')).receipt.digest, before);
    assert.deepEqual(regularFiles(project).filter(file => !file.startsWith('owned/')), ['AGENTS.md']);
    invoke(project, 'setup', 'uninstall', '--path', path);
    assert.equal(readFileSync(join(project, 'AGENTS.md'), 'utf8'), 'Preserve user instructions.\n');
    assert.deepEqual(regularFiles(project), ['AGENTS.md']);
  }
});

test('plugin and operator packages expose one parent while retaining the complete adapter and profile', async t => {
  const project = temporary(t);
  for (const target of ['claude-plugin', 'codex-plugin', 'copilot-plugin', 'agent-plugins', 'operator', 'harness']) {
    const path = join(project, 'owned');
    invoke(project, 'setup', 'install', '--target', target, '--path', path);
    assert.equal(skillDiscovery(path).count, 1);
    const [library] = methodLibrary(path);
    checkFullParity(join(path, library.layout));
    assert.equal(loadOperatorProfile(path).activation, 'manual');
    const report = JSON.parse(invoke(project, 'setup', 'doctor', '--path', path, '--json'));
    assert.equal(report.library.available, 38);
    assert.equal(report.bbAdapterPresent, true);
    assert.equal(report.hostActivationVerified, false);
    const load = await installedLoader(path);
    for (const [task, expected] of [
      [assignment('parent'), 'conquistador/METHOD.md'],
      [assignment('copy'), 'conquistador/specialists/copy-agent.md'],
      [assignment('outcome', { skills: ['write-copy'] }), 'write-copy/METHOD.md'],
      [assignment('parent', { workflows: ['launch-product'] }), 'conquistador/workflows/launch-product.md'],
    ]) {
      const loaded = await load(path, task);
      assert.ok(loaded.methods.some(method => method.path === `${library.layout}/${expected}`));
      assert.ok(loaded.methods.every(method => method.path.startsWith(`${library.layout}/`)));
      if (task.skills.length) assert.ok(loaded.methods.length > 1, 'Selected outcome resources also load');
    }
    if (target.includes('plugin')) assert.match(readFileSync(join(path, 'agents/conquistador.md'), 'utf8'), /skills\/conquistador\/SKILL.md/);
    invoke(project, 'setup', 'update', '--path', path);
    invoke(project, 'setup', 'uninstall', '--path', path);
  }
});

test('domain copies have one parent, a filtered catalog, preserved allowed methods, and no links to omitted files', async t => {
  const project = temporary(t);
  const domain = { schemaVersion: 'conquistador.domain-package/v1', id: 'domain:diagnosis', agentPackageSchemaVersion: 'conquistador.agent-package/v2',
    allowed: { roles: ['data-diagnosis'], skills: [], workflows: [], tools: ['host-model'], knowledgeHandles: [] } };
  const file = join(project, 'domain.json');
  writeFileSync(file, JSON.stringify(domain));
  const selection = resolveDomainSelection(root, domain);
  const selected = canonical.filter(file => shouldStageSkillPath(`skills/${file}`, selection));
  for (const target of ['codex', 'claude-plugin', 'operator']) {
    const path = join(project, 'owned');
    invoke(project, 'setup', 'install', '--target', target, '--path', path, '--domain', file);
    assert.equal(skillDiscovery(path).count, 1);
    const library = join(path, methodLibrary(path)[0].layout);
    assert.deepEqual(regularFiles(library).sort(), [...selected.map(internalPath), 'conquistador/catalog.md'].sort());
    assert.equal(existsSync(join(library, 'write-copy')), false);
    const catalog = readFileSync(join(library, 'conquistador/catalog.md'), 'utf8');
    assert.match(catalog, /diagnose-growth/);
    assert.match(catalog, /fresh-eyes-review/);
    assert.doesNotMatch(catalog, /write-copy/);
    checkLinks(library);
    if (target !== 'codex') {
      const load = await installedLoader(path);
      await load(path, assignment('parent'));
      await load(path, assignment('data-diagnosis', { skills: ['diagnose-growth'] }));
      await assert.rejects(load(path, assignment('copy')), /forbids role copy/);
      await assert.rejects(load(path, assignment('outcome', { skills: ['write-copy'] })), /forbids skill write-copy/);
    }
    // These selected outcomes retain their entire canonical contract and supporting files.
    for (const source of selected.filter(file => !file.startsWith('conquistador/'))) {
      const actual = readFileSync(join(library, internalPath(source)));
      const expected = readFileSync(join(root, 'skills', source));
      if (source.endsWith('.md')) assert.equal(canonicalText(actual.toString('utf8')), expected.toString('utf8'), source);
      else assert.deepEqual(actual, expected, source);
    }
    invoke(project, 'setup', 'update', '--path', path);
    assert.deepEqual(JSON.parse(readFileSync(join(path, 'domain-restriction.json'))), selection.restriction);
    invoke(project, 'setup', 'uninstall', '--path', path);
  }
});

test('one explicitly selected specialist remains canonical and has its own owned lifecycle', t => {
  const project = temporary(t), path = join(project, 'specialist');
  const invalid = spawnSync(process.execPath, [cli, 'setup', 'install', '--target', 'skill:conquistador', '--path', path], { cwd: project, encoding: 'utf8' });
  assert.notEqual(invalid.status, 0);
  assert.equal(existsSync(path), false);
  invoke(project, 'setup', 'install', '--target', 'skill:write-copy', '--path', path);
  assert.deepEqual(skillDiscovery(path).entries.map(entry => entry.name), ['write-copy']);
  const files = regularFiles(join(root, 'skills/write-copy'));
  for (const file of files) assert.deepEqual(readFileSync(join(path, 'skills/write-copy', file)), readFileSync(join(root, 'skills/write-copy', file)));
  assert.equal(existsSync(join(path, 'skills/conquistador')), false);
  invoke(project, 'setup', 'update', '--path', path);
  invoke(project, 'setup', 'uninstall', '--path', path);
});

test('unchanged v1 canonical copies migrate without leaving legacy entries or widening a domain', t => {
  const project = temporary(t), path = join(project, 'owned');
  const domain = { schemaVersion: 'conquistador.domain-package/v1', id: 'domain:legacy', agentPackageSchemaVersion: 'conquistador.agent-package/v2',
    allowed: { roles: ['data-diagnosis'], skills: [], workflows: [], tools: ['host-model'], knowledgeHandles: [] } };
  for (const restricted of [false, true]) {
    mkdirSync(path);
    const selection = restricted ? resolveDomainSelection(root, domain) : undefined;
    for (const file of canonical.filter(file => shouldStageSkillPath(`skills/${file}`, selection))) {
      const destination = join(path, 'library', file);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(join(root, 'skills', file), destination);
    }
    writeFileSync(join(path, 'SKILL.md'), '---\nname: conquistador\ndescription: Legacy wrapper\n---\nLoad library/conquistador/SKILL.md.\n');
    if (restricted) writeFileSync(join(path, 'domain-restriction.json'), JSON.stringify(selection.restriction));
    // A legacy receipt authenticates the bytes/layout it owns, not a source version.
    const digest = createHash('sha256');
    for (const file of regularFiles(path)) digest.update(file).update('\0').update(createHash('sha256').update(readFileSync(join(path, file))).digest('hex')).update('\n');
    writeFileSync(join(path, '.conquistador-install.json'), JSON.stringify({ schemaVersion: 'conquistador.public-install/v1', mode: 'conquistador', digest: digest.digest('hex') }));
    assert.ok(skillDiscovery(path).count > 1);
    invoke(project, 'setup', 'update', '--path', path);
    assert.equal(skillDiscovery(path).count, 1);
    assert.equal(existsSync(join(path, 'library/conquistador/SKILL.md')), false);
    if (restricted) assert.deepEqual(JSON.parse(readFileSync(join(path, 'domain-restriction.json'))), selection.restriction);
    else checkFullParity(join(path, 'library'));
    assert.equal(JSON.parse(readFileSync(join(path, '.conquistador-install.json'))).mode, 'conquistador');
    invoke(project, 'setup', 'uninstall', '--path', path);
  }
});

test('workflow domains and each isolated squad member retain only their declared internal methods', async t => {
  const project = temporary(t), path = join(project, 'owned');
  const domain = { schemaVersion: 'conquistador.domain-package/v1', id: 'domain:launch', agentPackageSchemaVersion: 'conquistador.agent-package/v2',
    allowed: { roles: [], skills: [], workflows: ['launch-product'], tools: ['host-model'], knowledgeHandles: [] } };
  const file = join(project, 'domain.json');
  writeFileSync(file, JSON.stringify(domain));
  invoke(project, 'setup', 'install', '--target', 'operator', '--path', path, '--domain', file);
  const library = join(path, methodLibrary(path)[0].layout);
  const selection = resolveDomainSelection(root, domain);
  assert.deepEqual(regularFiles(library).sort(), [...canonical.filter(file => shouldStageSkillPath(`skills/${file}`, selection)).map(internalPath), 'conquistador/catalog.md'].sort());
  checkLinks(library);
  const load = await installedLoader(path);
  await load(path, assignment('parent', { workflows: ['launch-product'] }));
  await assert.rejects(load(path, assignment('parent', { workflows: ['paid-campaign-loop'] })), /forbids workflow/);
  invoke(project, 'setup', 'uninstall', '--path', path);
  invoke(project, 'setup', 'install', '--target', 'squad', '--path', path);
  assert.equal(skillDiscovery(path).count, 2, 'One parent per separate member context');
  for (const role of ['advisor', 'worker']) {
    const member = join(path, role), library = join(member, 'skills/conquistador/library');
    const manifest = JSON.parse(readFileSync(join(member, 'agent.json')));
    assert.equal(skillDiscovery(member).count, 1);
    const names = regularFiles(library).filter(file => /^[^/]+\/METHOD\.md$/.test(file)).map(file => file.split('/')[0]);
    assert.deepEqual(names.sort(), ['conquistador', ...manifest.mayLoadSkills].sort());
    checkLinks(library);
  }
  invoke(project, 'setup', 'update', '--path', path);
  invoke(project, 'setup', 'uninstall', '--path', path);
});

test('doctor rejects stale SKILL links or an added specialist entry even without a managed receipt', t => {
  const project = temporary(t), path = join(project, 'owned');
  invoke(project, 'setup', 'install', '--target', 'codex', '--path', path);
  rmSync(join(path, '.conquistador-install.json'));
  const parent = join(path, 'library/conquistador/METHOD.md');
  const original = readFileSync(parent, 'utf8');
  writeFileSync(parent, original.replace('../write-copy/METHOD.md', '../write-copy/SKILL.md'));
  const doctor = () => spawnSync(process.execPath, [cli, 'setup', 'doctor', '--path', path, '--json'], { encoding: 'utf8' });
  assert.equal(doctor().status, 1);
  writeFileSync(parent, original);
  mkdirSync(join(path, 'extra'));
  writeFileSync(join(path, 'extra/SKILL.md'), '---\nname: unwanted\ndescription: extra discovery\n---\n');
  const result = doctor();
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).discovery.count, 2);
  rmSync(path, { recursive: true });
  invoke(project, 'setup', 'install', '--target', 'operator', '--path', path);
  rmSync(join(path, 'agent/skills'), { recursive: true });
  const missing = doctor();
  assert.equal(missing.status, 1);
  const report = JSON.parse(missing.stdout);
  assert.equal(report.library.layout, null);
  assert.ok(report.issues.some(issue => issue.includes('Cannot identify')));
});
