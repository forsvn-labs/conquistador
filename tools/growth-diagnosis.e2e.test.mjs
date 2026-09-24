import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const prompt = 'Our B2B SaaS growth has stalled. Weekly unique visitors held at 10,000 in both 8-week periods. Free-trial signups fell from 800 to 500; paid upgrades from 160 to 75. We have no analytics access beyond these totals. What is going on and what should we do next? Do not make changes.';
const paraphrases = [
  'Signups and upgrades dropped while visitors are steady. Explain the stall.',
  'Why did trial-to-paid weaken?',
  'Revenue growth flattened after conversion fell.',
];

function run(cli, project, ...args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: project, encoding: 'utf8' });
}

function checked(result, label) {
  assert.equal(result.status, 0, `${label}: ${result.stdout}${result.stderr}`);
  return result.stdout;
}

function digest(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

test('installed growth route, first task, hook context, and removal work together', t => {
  const scratch = join(root, 'dist/e2e-tmp');
  mkdirSync(scratch, { recursive: true });
  const work = mkdtempSync(join(scratch, 'growth-diagnosis-'));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const distribution = join(work, 'distribution');
  mkdirSync(distribution);
  for (const name of readdirSync(root)) {
    if (['.git', 'node_modules', 'dist', '.scout'].includes(name)) continue;
    cpSync(join(root, name), join(distribution, name), { recursive: true });
  }
  const cli = join(distribution, 'runtime/bin/conquistador.js');
  const project = join(work, 'project');
  mkdirSync(project);
  writeFileSync(join(project, 'keep.txt'), 'Keep this project file.\n');

  const setup = checked(run(cli, project, '--host', 'codex', '--task', 'diagnose-growth', '--yes'), 'setup');
  assert.match(setup, /Use with: Codex/);
  assert.match(setup, /First task: Diagnose a growth stall/);
  assert.match(setup, /Activation: manual/);
  assert.match(setup, /Method use:/);
  assert.match(setup, /If discovery fails:/);
  assert.match(setup, /Hook trust:/);
  assert.ok(existsSync(join(project, '.conquistador/SKILL.md')));
  assert.ok(existsSync(join(project, '.agents/skills/conquistador/SKILL.md')));

  const before = JSON.parse(checked(run(cli, project, 'operator', 'doctor', '--json'), 'doctor before hook'));
  assert.equal(before.library.available, 38);
  assert.equal(before.operatorActivation, 'manual');
  assert.equal(before.hooks.find(item => item.host === 'codex').routingAvailable, false);
  assert.equal(before.taskExecutionVerified, false);

  const routes = [prompt, ...paraphrases].map(text => {
    const route = JSON.parse(checked(run(cli, project, 'route', '--prompt', text), `route: ${text}`));
    assert.deepEqual(route.selected, ['diagnose-growth']);
    return { prompt: text, selected: route.selected };
  });
  const unrelated = JSON.parse(checked(run(cli, project, 'route', '--prompt', 'Refactor the authentication middleware for readability.'), 'unrelated route'));
  assert.equal(unrelated.action, 'abstain');
  const incidental = JSON.parse(checked(run(cli, project, 'route', '--prompt',
    'I updated the trial signup code after growth stalled. Refactor the validation handler.'), 'incidental growth context'));
  assert.equal(incidental.action, 'abstain');
  const explicitShape = JSON.parse(checked(run(cli, project, 'route', '--prompt',
    'Growth stalled and signups fell. Shape this initiative for our team.'), 'explicit initiative shaping'));
  assert.deepEqual(explicitShape.selected, ['diagnose-growth', 'shape-initiative']);
  const launch = JSON.parse(checked(run(cli, project, 'route', '--prompt', 'Use Conquistador to draft a launch plan from product facts.'), 'launch route'));
  assert.deepEqual(launch.selected, ['plan-campaign']);

  const start = checked(run(cli, project, 'start', '--task', 'diagnose-growth'), 'start');
  assert.match(start, /First task: Diagnose a growth stall/);
  assert.match(start, /Activation: manual/);
  assert.match(start, /If discovery fails:/);
  assert.match(start, /Hook trust:/);
  assert.match(start, /conquistador doctor/);

  const config = join(project, 'proactive.json');
  writeFileSync(config, JSON.stringify({ schemaVersion: 1, enabled: true, events: ['prompt-submitted'] }));
  checked(run(cli, project, 'hooks', 'enable', '--host', 'codex', '--project', project, '--config', config,
    '--events', 'prompt-submitted'), 'enable hook');
  const handler = join(project, '.conquistador/tools/conquistador-mode.mjs');
  const handled = spawnSync(process.execPath, [handler, '--handle', '--host', 'codex', '--event', 'prompt-submitted',
    '--config', config], {
    cwd: project, encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt }),
  });
  const context = JSON.parse(checked(handled, 'installed hook')).hookSpecificOutput.additionalContext;
  assert.match(context, /Diagnose a growth problem \[diagnose-growth\]/);
  assert.doesNotMatch(context, /Shape an ambiguous initiative/);
  const methodPath = /Full method: ([^\n]+)/.exec(context)?.[1];
  assert.equal(methodPath, 'library/diagnose-growth/METHOD.md');
  const resources = /Required resources: ([^\n]+)/.exec(context)?.[1].split(', ');
  assert.ok(resources.length >= 3);
  const sourceReads = [methodPath, ...resources].map(path => {
    const location = join(project, '.conquistador', path);
    assert.ok(existsSync(location), `Missing installed resource: ${path}`);
    return { path, sha256: digest(readFileSync(location)) };
  });
  const after = JSON.parse(checked(run(cli, project, 'operator', 'doctor', '--json'), 'doctor after hook'));
  const hook = after.hooks.find(item => item.host === 'codex');
  assert.equal(hook.routingAvailable, true);
  assert.equal(hook.nativeActivationVerified, false);
  assert.equal(after.taskExecutionVerified, false);

  checked(run(cli, project, 'hooks', 'remove', '--host', 'codex', '--project', project), 'remove hook');
  checked(run(cli, project, 'operator', 'uninstall'), 'uninstall');
  assert.equal(existsSync(join(project, '.conquistador')), false);
  assert.equal(existsSync(join(project, '.agents/skills/conquistador')), false);
  assert.equal(readFileSync(join(project, 'keep.txt'), 'utf8'), 'Keep this project file.\n');

  if (process.env.CONQUISTADOR_E2E_ARTIFACT) {
    const artifact = resolve(process.env.CONQUISTADOR_E2E_ARTIFACT);
    mkdirSync(dirname(artifact), { recursive: true });
    writeFileSync(artifact, JSON.stringify({
      schemaVersion: 'conquistador.growth-diagnosis-e2e/v1',
      packageVersion: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version,
      prompt,
      routes,
      unrelated: unrelated.action,
      incidental: incidental.action,
      explicitShape: explicitShape.selected,
      launch: launch.selected,
      sourceReads,
      hookContextSha256: digest(context),
      before: { operatorActivation: before.operatorActivation, routingAvailable: false, taskExecutionVerified: before.taskExecutionVerified },
      after: { routingAvailable: hook.routingAvailable, nativeActivationVerified: hook.nativeActivationVerified,
        taskExecutionVerified: after.taskExecutionVerified },
      removed: true,
      projectFilePreserved: true,
    }, null, 2) + '\n');
  }
});
