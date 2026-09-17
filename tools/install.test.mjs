import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalText } from './method-library.mjs';
import { validatePluginContracts } from './plugin-contracts.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skills = readdirSync(join(root, 'skills')).sort();
const install = (...args) => execFileSync(process.execPath, [join(root, 'tools/install.mjs'), ...args], { stdio: 'pipe' });
function temporary(run) {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador install ')));
  try { run(join(parent, 'owned')); } finally { rmSync(parent, { recursive: true, force: true }); }
}

test('one entry point contains every method and upgrades without losing user changes', () => temporary(target => {
  install('install', 'conquistador', target);
  assert.match(readFileSync(join(target, 'SKILL.md'), 'utf8'), /library\/conquistador\/METHOD.md/);
  assert.deepEqual(readdirSync(join(target, 'library')).sort(), skills);
  for (const name of skills) assert.deepEqual(canonicalText(readFileSync(join(target, 'library', name, 'METHOD.md'), 'utf8')), readFileSync(join(root, 'skills', name, 'SKILL.md'), 'utf8'));
  assert.ok(existsSync(join(target, 'tools/proactive.mjs')));
  assert.ok(existsSync(join(target, 'docs/PROACTIVE.md')));
  assert.deepEqual(readFileSync(join(target, 'docs/PREVIEW.md')), readFileSync(join(root, 'docs/PREVIEW.md')));
  assert.ok(existsSync(join(target, 'library/conquistador/standards/preview.md')));
  install('upgrade', 'conquistador', target);
  writeFileSync(join(target, 'operator-note.md'), 'Keep this note.');
  assert.throws(() => install('upgrade', 'conquistador', target), /files were modified/);
  assert.throws(() => install('remove', 'conquistador', target), /files were modified/);
  assert.equal(readFileSync(join(target, 'operator-note.md'), 'utf8'), 'Keep this note.');
}));

test('portable master contains specialist contracts, declared outcomes and its canonical parent', () => temporary(target => {
  install('install', 'single-agent', target);
  const agent = JSON.parse(readFileSync(join(target, 'agent/agent.json')));
  assert.equal(agent.pluginVersion, '0.0.8');
  assert.equal(agent.kind, 'master-agent');
  assert.equal(agent.role, 'orchestrator');
  assert.equal(agent.schemaVersion, 'conquistador.agent-package/v2');
  assert.equal(agent.delegation.maxDelegationsPerRun, 12);
  assert.ok(existsSync(join(target, agent.canonicalSkillRoot, 'SKILL.md')));
  assert.ok(existsSync(join(target, agent.canonicalSkillRoot, 'library/conquistador/operator-profile.json')));
  for (const name of ['ads', 'copy', 'dr-landing', 'saas-landing', 'data-diagnosis', 'campaign-data', 'creative-assets']) {
    assert.ok(existsSync(join(target, agent.canonicalSkillRoot, 'library/conquistador/specialists', `${name}-agent.md`)));
  }
  assert.deepEqual(readdirSync(join(target, 'library')).sort(), skills);
  for (const name of agent.mayLoadSkills) assert.ok(existsSync(join(target, 'library', name, 'METHOD.md')));
  install('remove', 'single-agent', target);
  assert.equal(existsSync(target), false);
}));

test('native plugin install contains discoverable marketplaces and only its native agent', () => temporary(target => {
  install('install', 'plugin', target);
  assert.equal(validatePluginContracts(target).hostActivationVerified, false);
  assert.equal(validatePluginContracts(target).discovery, 'parent-first');
  assert.deepEqual(readdirSync(join(target, 'agents')).sort(), ['agent-package-v2.schema.json', 'agent-package.schema.json', 'conquistador', 'conquistador.md', 'execution-receipt.schema.json', 'operator-profile.schema.json']);
  assert.equal(existsSync(join(target, 'SKILL.md')), false);
  assert.match(readFileSync(join(target, 'skills/conquistador/SKILL.md'), 'utf8'), /library\/conquistador\/METHOD.md/);
  install('remove', 'plugin', target);
  assert.equal(existsSync(target), false);
}));

test('host and squad declarations resolve inside each staged package', () => {
  for (const mode of ['eve', 'grok-bot', 'squad']) temporary(target => {
    install('install', mode, target);
    if (mode === 'squad') {
      for (const role of ['advisor', 'worker']) {
        const agent = JSON.parse(readFileSync(join(target, role, 'agent.json')));
        assert.ok(existsSync(join(target, agent.canonicalSkillRoot, 'SKILL.md')));
        if (role === 'advisor') {
          assert.deepEqual(agent.mayLoadWorkflows, []);
          assert.deepEqual([...agent.mayLoadSkills].sort(), ['decision-panel', 'fresh-eyes-review', 'knowledge-review']);
        }
        for (const name of agent.mayLoadSkills) assert.ok(existsSync(join(target, role, 'skills/conquistador/library', name, 'METHOD.md')));
      }
    } else {
      const host = JSON.parse(readFileSync(join(target, 'host.json')));
      assert.equal(host.pluginVersion, '0.0.8');
      assert.deepEqual(readdirSync(join(target, host.canonicalSkillsRoot)).sort(), skills);
    }
    install('remove', mode, target);
    assert.equal(existsSync(target), false);
  });
});


test('every staged mode includes usage docs with contained existing Markdown links', () => {
  for (const mode of ['conquistador', 'plugin', 'single-agent', 'squad', 'eve', 'grok-bot', 'skill:write-copy']) temporary(target => {
    install('install', mode, target);
    const readme = readFileSync(join(target, 'README.md'), 'utf8');
    assert.match(readme, /\[Use Conquistador\]\(docs\/USAGE.md\)/);
    assert.match(readme, /complete distribution, not this folder/);
    assert.equal(existsSync(join(target, 'runtime')), false);
    assert.equal(existsSync(join(target, 'tools/install.mjs')), false);
    for (const name of ['USAGE.md', 'PREVIEW.md', 'LEARNING.md', 'MASTER-AGENT.md', 'PROACTIVE.md']) {
      assert.deepEqual(readFileSync(join(target, 'docs', name)), readFileSync(join(root, 'docs', name)));
    }
    for (const path of ['README.md', ...readdirSync(join(target, 'docs')).map(name => `docs/${name}`)]) {
      const markdown = readFileSync(join(target, path), 'utf8');
      for (const [, link] of markdown.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
        if (/^(?:https?:|mailto:|#)/.test(link)) continue;
        const resolved = resolve(dirname(join(target, path)), decodeURIComponent(link.split(/[?#]/)[0]));
        const local = relative(target, resolved);
        assert.ok(local !== '..' && !local.startsWith(`..${sep}`), `${mode}: ${path} escapes through ${link}`);
        assert.ok(existsSync(resolved), `${mode}: ${path} has missing link ${link}`);
      }
    }
    writeFileSync(join(target, 'docs/USAGE.md'), 'A user correction.');
    assert.throws(() => install('upgrade', mode, target), /files were modified/);
    assert.throws(() => install('remove', mode, target), /files were modified/);
    assert.equal(readFileSync(join(target, 'docs/USAGE.md'), 'utf8'), 'A user correction.');
  });
});

test('plugin and harness copy native dispatch; compact skill states full distribution', () => temporary(target => {
  install('install', 'plugin', target);
  assert.deepEqual(readdirSync(join(target, 'agents')).sort(), ['agent-package-v2.schema.json', 'agent-package.schema.json', 'conquistador', 'conquistador.md', 'execution-receipt.schema.json', 'operator-profile.schema.json']);
  assert.ok(existsSync(join(target, 'agents/conquistador/agent.json')));
  for (const name of ['contracts.mjs', 'operator.mjs', 'receipt.mjs', 'orchestrate.mjs', 'bb.mjs', 'team.mjs', 'host.json', 'README.md']) {
    assert.ok(existsSync(join(target, 'hosts/coding-agent', name)));
  }
  assert.ok(existsSync(join(target, 'skills/conquistador/library/conquistador/operator-profile.json')));
  assert.ok(existsSync(join(target, 'tools/domain-package.mjs')));
  assert.ok(existsSync(join(target, 'tools/plugin-contracts.mjs')));
  assert.match(readFileSync(join(target, 'README.md'), 'utf8'), /hosts\/coding-agent/);
  install('remove', 'plugin', target);
  install('install', 'conquistador', target);
  assert.equal(existsSync(join(target, 'hosts/coding-agent')), false);
  assert.ok(existsSync(join(target, 'tools/domain-package.mjs')));
  assert.ok(existsSync(join(target, 'tools/conquistador-mode.mjs')));
  assert.match(readFileSync(join(target, 'README.md'), 'utf8'), /complete distribution, not this compact folder/);
}));

test('domain install writes restriction with mandatory review and omits undeclared outcomes', () => temporary(target => {
  const parent = dirname(target);
  const manifest = join(parent, 'domain.json');
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
  install('install', 'plugin', target, '--domain', manifest);
  const restriction = JSON.parse(readFileSync(join(target, 'domain-restriction.json')));
  assert.ok(restriction.allowed.skills.includes('conquistador'));
  assert.ok(restriction.allowed.skills.includes('fresh-eyes-review'));
  assert.ok(restriction.allowed.skills.includes('diagnose-growth'));
  assert.equal(restriction.allowed.skills.includes('write-copy'), false);
  assert.ok(existsSync(join(target, 'skills/conquistador/library/diagnose-growth/METHOD.md')));
  assert.equal(existsSync(join(target, 'skills/conquistador/library/write-copy')), false);
  assert.ok(existsSync(join(target, 'skills/conquistador/library/conquistador/specialists/data-diagnosis-agent.md')));
  assert.equal(existsSync(join(target, 'skills/conquistador/library/conquistador/specialists/copy-agent.md')), false);
  assert.match(readFileSync(join(target, 'README.md'), 'utf8'), /domain-restriction.json is the load-time allowlist/);
}));
