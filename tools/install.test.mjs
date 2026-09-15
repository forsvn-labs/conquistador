import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  assert.match(readFileSync(join(target, 'SKILL.md'), 'utf8'), /library\/conquistador\/SKILL.md/);
  assert.deepEqual(readdirSync(join(target, 'library')).sort(), skills);
  for (const name of skills) assert.deepEqual(readFileSync(join(target, 'library', name, 'SKILL.md')), readFileSync(join(root, 'skills', name, 'SKILL.md')));
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

test('single agent contains declared outcomes and an existing canonical parent', () => temporary(target => {
  install('install', 'single-agent', target);
  const agent = JSON.parse(readFileSync(join(target, 'agent/agent.json')));
  assert.equal(agent.pluginVersion, '0.1.0');
  assert.ok(existsSync(join(target, agent.canonicalSkillRoot, 'SKILL.md')));
  assert.deepEqual(readdirSync(join(target, 'agent/skills')).sort(), skills);
  for (const name of agent.mayLoadSkills) assert.ok(existsSync(join(target, 'agent/skills', name, 'SKILL.md')));
  install('remove', 'single-agent', target);
  assert.equal(existsSync(target), false);
}));

test('native plugin install contains discoverable marketplaces and only its native agent', () => temporary(target => {
  install('install', 'plugin', target);
  assert.equal(validatePluginContracts(target).hostActivationVerified, false);
  assert.deepEqual(readdirSync(join(target, 'agents')), ['conquistador.md']);
  assert.match(readFileSync(join(target, 'SKILL.md'), 'utf8'), /skills\/conquistador\/SKILL.md/);
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
        for (const name of agent.mayLoadSkills) assert.ok(existsSync(join(target, role, 'skills', name, 'SKILL.md')));
      }
    } else {
      const host = JSON.parse(readFileSync(join(target, 'host.json')));
      assert.equal(host.pluginVersion, '0.1.0');
      assert.deepEqual(readdirSync(join(target, host.canonicalSkillsRoot)).sort(), skills);
    }
    install('remove', mode, target);
    assert.equal(existsSync(target), false);
  });
});
