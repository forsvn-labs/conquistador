import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
  assert.match(setup, /Local route preview: diagnose-growth/);
  assert.match(setup, /If discovery fails:/);
  assert.match(setup, /Hook trust:/);
  assert.ok(existsSync(join(project, '.conquistador/SKILL.md')));
  assert.ok(existsSync(join(project, '.agents/skills/conquistador/SKILL.md')));

  const otherProject = join(work, 'other-project');
  mkdirSync(otherProject);
  const otherSetup = checked(run(cli, project, '--project', otherProject, '--host', 'codex', '--yes'), 'other-project setup');
  assert.match(otherSetup, new RegExp(`Native skill: ${join(otherProject, '.agents/skills/conquistador/SKILL.md')}`));
  assert.match(otherSetup, new RegExp(`read ${join(otherProject, '.conquistador/SKILL.md')}`));
  const otherStart = checked(run(cli, project, 'start', '--project', otherProject), 'other-project start');
  assert.match(otherStart, new RegExp(`Native skill: ${join(otherProject, '.agents/skills/conquistador/SKILL.md')}`));
  const printedDoctor = otherStart.split('\n').find(line => line.startsWith("'conquistador' 'operator' 'doctor' '--path' "));
  assert.ok(printedDoctor, 'start must print a target-qualified doctor command');
  const bin = join(work, 'bin');
  mkdirSync(bin);
  const executable = join(bin, 'conquistador');
  writeFileSync(executable, `#!/bin/sh\nexec "${process.execPath}" "${cli}" "$@"\n`);
  chmodSync(executable, 0o755);

  const printedDoctorResult = spawnSync('/bin/sh', ['-c', `${printedDoctor} --json`], {
    cwd: project, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });

  const printedDoctorTarget = JSON.parse(checked(printedDoctorResult, 'printed other-project doctor')).path;
  assert.equal(printedDoctorTarget, join(otherProject, '.conquistador'));
  const callerReceipt = readFileSync(join(project, '.conquistador/.conquistador-install.json'), 'utf8');
  const selectedReceiptPath = join(otherProject, '.conquistador/.conquistador-install.json');
  const selectedReceipt = JSON.parse(readFileSync(selectedReceiptPath, 'utf8'));
  selectedReceipt.productVersion = '0.0.1';
  writeFileSync(selectedReceiptPath, JSON.stringify(selectedReceipt, null, 2) + '\n');
  const staleHandoff = checked(run(cli, project, '--project', otherProject, '--host', 'codex', '--yes'), 'stale selected-project handoff');
  const notice = staleHandoff.split('\n').find(line => line.startsWith('Update with: '));
  assert.ok(notice, 'stale installation must print an update command');
  const printedUpdate = notice.slice('Update with: '.length);
  assert.ok(printedUpdate.includes(`'--path' '${join(otherProject, '.conquistador')}'`));

  const printedUpdateResult = spawnSync('/bin/sh', ['-c', printedUpdate], {
    cwd: project, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });

  checked(printedUpdateResult, 'printed other-project update');
  assert.equal(JSON.parse(readFileSync(selectedReceiptPath, 'utf8')).productVersion, '0.2.0');
  assert.equal(readFileSync(join(project, '.conquistador/.conquistador-install.json'), 'utf8'), callerReceipt);
  const otherDoctor = JSON.parse(checked(run(cli, project, 'operator', 'doctor', '--project', otherProject, '--json'), 'other-project doctor'));
  assert.equal(otherDoctor.path, join(otherProject, '.conquistador'));
  const otherStatus = checked(run(cli, project, 'operator', 'status', '--project', otherProject), 'other-project status');
  assert.ok(otherStatus.includes(join(otherProject, '.conquistador')));
  checked(run(cli, project, 'operator', 'uninstall', '--project', otherProject), 'other-project uninstall');
  assert.equal(existsSync(join(otherProject, '.conquistador')), false);
  assert.ok(existsSync(join(project, '.conquistador')));

  const invalidProject = join(work, 'invalid-project');
  const invalidOperator = join(invalidProject, '.conquistador');
  const profile = join(invalidOperator, 'library/conquistador/operator-profile.json');
  mkdirSync(dirname(profile), { recursive: true });
  writeFileSync(join(invalidOperator, 'SKILL.md'), '# Conquistador\n');
  checked(spawnSync('mkfifo', [profile], { encoding: 'utf8' }), 'create invalid profile FIFO');

  const invalidStart = spawnSync(process.execPath, [cli, 'start', '--project', invalidProject], {
    cwd: project, encoding: 'utf8', timeout: 2000,
  });

  assert.equal(invalidStart.status, 0, `start blocked on invalid profile: ${invalidStart.error?.message}`);
  assert.match(invalidStart.stdout, /Activation: invalid profile;/);

  const before = JSON.parse(checked(run(cli, project, 'operator', 'doctor', '--json'), 'doctor before hook'));
  assert.equal(before.library.available, 38);
  assert.equal(before.operatorActivation, 'manual');
  assert.equal(before.hooks.find(item => item.host === 'codex').routingAvailable, false);
  assert.equal(before.taskExecutionVerified, false);
  const installedContract = JSON.parse(readFileSync(join(project, '.conquistador/library/conquistador/routing-contract.json'), 'utf8'));

  const methodRoutes = Object.entries(installedContract.methods).map(([name, method]) => {
    const text = `Use Conquistador to ${method.intents[0]}.`;
    const route = JSON.parse(checked(run(cli, project, 'route', '--prompt', text), `method route: ${name}`));
    assert.deepEqual(route.selected, [name], `${name}: ${JSON.stringify(route)}`);

    return { name, prompt: text, selected: route.selected };
  });

  assert.equal(methodRoutes.length, 38);

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

  const initiativeRoute = JSON.parse(checked(run(cli, project, 'route', '--prompt',
    'Growth stalled and signups fell. Shape this initiative for our team.'), 'explicit initiative shaping'));

  assert.deepEqual(initiativeRoute.selected, ['diagnose-growth', 'shape-initiative']);

  const namedMethods = JSON.parse(checked(run(cli, project, 'route', '--prompt',
    'Use shape-initiative and plan-campaign to decide a launch approach.'), 'named methods'));

  assert.deepEqual(namedMethods.selected, ['shape-initiative', 'plan-campaign']);

  const adversarialRoutes = [
    ['Use shape-initiative, then diagnose-growth.', ['shape-initiative', 'diagnose-growth']],
    ['Use Conquistador to plan-campaign and do not shape-initiative.', ['plan-campaign']],
    ['Use Conquistador to plan-campaign. "Use shape-initiative" is only a quoted example.', ['plan-campaign']],
    ['Use Conquistador for authority and freshness.', ['knowledge-review']],
    ['Use Conquistador to review knowledge freshness for this project.', ['knowledge-review']],
    ['Use Conquistador to design-pricing-and-packaging and do not write-copy.', ['design-pricing-and-packaging']],
    ['Use Conquistador to review authority and freshness and do not write-copy.', ['knowledge-review']],
    ['Use Conquistador to write readme and setup and do not write-copy.', ['write-technical-docs']],
    ['Use Conquistador for readme and setup.', ['write-technical-docs']],
    ['Why did signups drop after our campaign?', ['diagnose-growth']],
  ].map(([text, expected]) => {
    const route = JSON.parse(checked(run(cli, project, 'route', '--prompt', text), `adversarial route: ${text}`));
    assert.deepEqual(route.selected, expected, `${text}: ${JSON.stringify(route)}`);

    return { prompt: text, selected: route.selected };
  });

  const ciFailure = JSON.parse(checked(run(cli, project, 'route', '--prompt',
    'Our CI pipeline has slowed and deploy success fell. Diagnose the build failure.'), 'CI pipeline failure'));

  assert.equal(ciFailure.action, 'abstain');

  for (const text of ['Debug why the CI pipeline stalled after upgrading Node.',
    'Our CI pipeline is down. Explain the failing test.', 'Fix the stalled data pipeline.']) {
    const route = JSON.parse(checked(run(cli, project, 'route', '--prompt', text), `technical pipeline: ${text}`));
    assert.equal(route.action, 'abstain', `${text}: ${JSON.stringify(route)}`);
  }

  const technicalExplanations = [
    'Debug why the trial signup handler is down.',
    'Refactor the handler after growth stalled. Explain the code changes.',
    'I updated the trial signup code after growth stalled. Refactor the validation handler. Explain the code changes.',
  ];

  for (const text of technicalExplanations) {
    const route = JSON.parse(checked(run(cli, project, 'route', '--prompt', text), `technical explanation: ${text}`));
    assert.equal(route.action, 'abstain', `${text}: ${JSON.stringify(route)}`);
  }

  const explicitBusinessDiagnosis = JSON.parse(checked(run(cli, project, 'route', '--prompt',
    'Diagnose why trial signups fell, then refactor the validation handler.'), 'mixed business diagnosis and coding'));

  assert.ok(explicitBusinessDiagnosis.selected.includes('diagnose-growth'));

  const whollyNegated = JSON.parse(checked(run(cli, project, 'route', '--prompt',
    'Use Conquistador to do not design-pricing-and-packaging.'), 'wholly negated compound method'));

  assert.equal(whollyNegated.action, 'abstain');

  const literalMarker = 'Do not design-pricing-and-packaging. CQPHRASE0TOKEN';
  const markerRoute = JSON.parse(checked(run(cli, project, 'route', '--prompt', literalMarker), 'literal marker after negation'));

  assert.equal(markerRoute.action, 'abstain', JSON.stringify(markerRoute));

  const explicitReviewNames = [
    ['Use Conquistador to audit campaign performance with brief-creative.', 'brief-creative'],
    ['Use Conquistador to evaluate landing-page performance with improve-conversion.', 'improve-conversion'],
  ];

  for (const [text, expected] of explicitReviewNames) {
    const route = JSON.parse(checked(run(cli, project, 'route', '--prompt', text), `explicit review name: ${text}`));

    assert.ok(route.selected.includes(expected), `${text}: ${JSON.stringify(route)}`);
  }

  const pluralTestDebug = 'Debug why the signup tests are down.';
  const pluralTestRoute = JSON.parse(checked(run(cli, project, 'route', '--prompt', pluralTestDebug), 'plural signup tests'));

  assert.equal(pluralTestRoute.action, 'abstain', JSON.stringify(pluralTestRoute));

  const reviewPrompt = 'Use Conquistador to review the latest growth results in this project. Name the sources and baseline, separate observed changes from assumptions, and recommend one keep, drop, or test decision. Mark missing data.';
  const reviewRoute = JSON.parse(checked(run(cli, project, 'route', '--prompt', reviewPrompt), 'review growth first task'));
  assert.deepEqual(reviewRoute.selected, ['measure-growth']);

  const pricing = JSON.parse(checked(run(cli, project, 'route', '--prompt',
    'Use Conquistador to design pricing and packaging for our B2B SaaS.'), 'pricing and packaging'));

  assert.ok(pricing.selected.includes('design-pricing-and-packaging'));

  const namedPricing = JSON.parse(checked(run(cli, project, 'route', '--prompt',
    'Use design-pricing-and-packaging for this offer.'), 'named pricing method'));

  assert.ok(namedPricing.selected.includes('design-pricing-and-packaging'));
  const launch = JSON.parse(checked(run(cli, project, 'route', '--prompt', 'Use Conquistador to draft a launch plan from product facts.'), 'launch route'));
  assert.deepEqual(launch.selected, ['plan-campaign']);
  const runtimeRoute = checked(run(cli, project, 'runtime', 'route', '--intent', 'content intelligence loop'), 'runtime route');
  assert.match(runtimeRoute, /content-intelligence-loop/);

  const start = checked(run(cli, project, 'start', '--task', 'diagnose-growth'), 'start');
  assert.match(start, /First task: Diagnose a growth stall/);
  assert.match(start, /Local route preview: diagnose-growth/);
  assert.match(start, /Activation: manual/);
  assert.match(start, /If discovery fails:/);
  assert.match(start, /Hook trust:/);
  assert.match(start, /'conquistador' 'operator' 'doctor' '--path' /);

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

  const reviewHandled = spawnSync(process.execPath, [handler, '--handle', '--host', 'codex', '--event', 'prompt-submitted',
    '--config', config], {
    cwd: project, encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: reviewPrompt }),
  });

  const reviewContext = JSON.parse(checked(reviewHandled, 'review growth hook')).hookSpecificOutput.additionalContext;
  assert.match(reviewContext, /Learn from aggregate growth results \[measure-growth\]/);
  assert.match(reviewContext, /Full method: library\/measure-growth\/METHOD.md/);

  const namedHandled = spawnSync(process.execPath, [handler, '--handle', '--host', 'codex', '--event', 'prompt-submitted',
    '--config', config], {
    cwd: project, encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'UserPromptSubmit',
      prompt: 'Use shape-initiative and plan-campaign to decide a launch approach.' }),
  });

  const namedContext = JSON.parse(checked(namedHandled, 'named methods hook')).hookSpecificOutput.additionalContext;
  assert.match(namedContext, /Shape an ambiguous initiative \[shape-initiative\]/);
  assert.match(namedContext, /Plan a campaign or launch \[plan-campaign\]/);

  const ciHandled = spawnSync(process.execPath, [handler, '--handle', '--host', 'codex', '--event', 'prompt-submitted',
    '--config', config], {
    cwd: project, encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'UserPromptSubmit',
      prompt: 'Our CI pipeline has slowed and deploy success fell. Diagnose the build failure.' }),
  });

  assert.deepEqual(JSON.parse(checked(ciHandled, 'CI pipeline hook')), {});

  for (const { prompt: text, selected } of adversarialRoutes.filter(item => item.prompt.includes('do not write-copy'))) {
    const response = spawnSync(process.execPath, [handler, '--handle', '--host', 'codex', '--event', 'prompt-submitted',
      '--config', config], { cwd: project, encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: text }) });

    const routed = JSON.parse(checked(response, `compound intent hook: ${text}`)).hookSpecificOutput.additionalContext;

    assert.match(routed, new RegExp(`\\[${selected[0]}\\]`));
    assert.doesNotMatch(routed, /\[write-copy\]/);
  }

  for (const text of technicalExplanations) {
    const response = spawnSync(process.execPath, [handler, '--handle', '--host', 'codex', '--event', 'prompt-submitted',
      '--config', config], { cwd: project, encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: text }) });

    assert.deepEqual(JSON.parse(checked(response, `technical explanation hook: ${text}`)), {});
  }

  for (const [text, expected] of explicitReviewNames) {
    const response = spawnSync(process.execPath, [handler, '--handle', '--host', 'codex', '--event', 'prompt-submitted',
      '--config', config], { cwd: project, encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: text }) });

    assert.match(JSON.parse(checked(response, `explicit review name hook: ${text}`)).hookSpecificOutput.additionalContext,
      new RegExp(`\\[${expected}\\]`));
  }

  for (const text of [literalMarker, pluralTestDebug]) {
    const response = spawnSync(process.execPath, [handler, '--handle', '--host', 'codex', '--event', 'prompt-submitted',
      '--config', config], { cwd: project, encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: text }) });

    assert.deepEqual(JSON.parse(checked(response, `adversarial abstention hook: ${text}`)), {});
  }

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

  const mcpPath = join(project, '.conquistador-mcp');
  checked(run(cli, project, 'setup', 'install', '--target', 'mcp', '--path', mcpPath), 'local MCP install');
  const connector = JSON.parse(readFileSync(join(mcpPath, 'connector.json'), 'utf8'));

  const frames = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {
      protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'growth-e2e', version: '1' },
    } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: {
      name: 'conquistador_files', arguments: { method: 'conquistador' },
    } },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: {
      name: 'conquistador_read', arguments: { path: 'conquistador/routing-contract.json' },
    } },
  ];

  const mcp = spawnSync(connector.command, connector.args, {
    cwd: project, encoding: 'utf8', input: frames.map(frame => JSON.stringify(frame)).join('\n') + '\n',
  });

  const mcpMessages = checked(mcp, 'installed MCP read').trim().split('\n').map(JSON.parse);
  assert.equal(mcpMessages.length, 3);
  const mcpFiles = JSON.parse(mcpMessages[1].result.content[0].text).files;
  assert.ok(mcpFiles.includes('conquistador/routing-contract.json'));
  const mcpContractText = mcpMessages[2].result.content[0].text;
  assert.equal(Object.keys(JSON.parse(mcpContractText).methods).length, 38);
  checked(run(cli, project, 'setup', 'uninstall', '--target', 'mcp', '--path', mcpPath), 'local MCP uninstall');
  assert.equal(existsSync(mcpPath), false);
  assert.equal(readFileSync(join(project, 'keep.txt'), 'utf8'), 'Keep this project file.\n');

  if (process.env.CONQUISTADOR_E2E_ARTIFACT) {
    const artifact = resolve(process.env.CONQUISTADOR_E2E_ARTIFACT);
    mkdirSync(dirname(artifact), { recursive: true });
    writeFileSync(artifact, JSON.stringify({
      schemaVersion: 'conquistador.growth-diagnosis-e2e/v1',
      packageVersion: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version,
      prompt,
      routes,
      methodRoutes,
      crossProject: { doctorTarget: otherDoctor.path, printedDoctorTarget, absoluteHandoff: true,
        printedUpdateTarget: join(otherProject, '.conquistador'), removedOnlySelectedProject: true,
        invalidProfileNonblocking: true },
      unrelated: unrelated.action,
      incidental: incidental.action,
      initiativeRoute: initiativeRoute.selected,
      namedMethods: namedMethods.selected,
      adversarialRoutes,
      technicalExplanations,
      explicitReviewNames,
      literalMarker,
      pluralTestDebug,
      ciFailure: ciFailure.action,
      reviewRoute: reviewRoute.selected,
      pricing: pricing.selected,
      namedPricing: namedPricing.selected,
      reviewHookContextSha256: digest(reviewContext),
      namedHookContextSha256: digest(namedContext),
      ciHookAbstained: true,
      mcp: { listedRoutingContract: true, readRoutingContractSha256: digest(mcpContractText), methods: 38,
        removed: true },
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
