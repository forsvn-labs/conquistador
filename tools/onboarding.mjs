import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { FIRST_TASKS, UsageError, parseOnboarding, requireNoninteractivePlan, routeHelp, topHelp } from './onboarding-parse.mjs';
import { destinationsFor, hostChoices, hostFolders, hostLabels, resolveHost, installedHosts } from './onboarding-hosts.mjs';
import { inspectProjectSkills, projectIntegration, treeDigest } from './project-installation.mjs';
import { operatorNextSteps } from './setup-surfaces.mjs';
import { shellCommand } from './install-paths.mjs';
import { assertNoDiscoveryConflict } from './onboarding-safety.mjs';
import { cancellableUi } from './onboarding-ui.mjs';
import { assertNode24, need, runBotRoute, runMcpRoute, runPluginRoute, runSetupAction, runSkillsRoute, resolveProject } from './onboarding-routes.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const tty = () => Boolean(process.stdin.isTTY && process.stdout.isTTY);

async function defaultRun(args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [join(root, 'tools/setup.mjs'), ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let interrupted = false;
    const interrupt = () => { interrupted = true; child.kill('SIGINT'); };
    process.once('SIGINT', interrupt);
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('error', error => { process.off('SIGINT', interrupt); reject(error); });
    child.on('close', (code, signal) => {
      process.off('SIGINT', interrupt);
      resolveRun({
        code: interrupted || signal === 'SIGINT' ? 130 : code ?? 1,
        output: interrupted || signal ? `${output}\nInterrupted during local setup. Preserve any recovery folders and inspect the destination with conquistador setup status --path PATH before retrying.` : output,
      });
    });
  });
}

export function inspectOperator(project) {
  const current = join(project, '.conquistador');
  const legacy = join(project, '.conquistador-operator');
  const currentExists = existsSync(current);
  const legacyExists = existsSync(legacy);
  if (currentExists && legacyExists) return { state: 'conflict', current, legacy };
  const path = currentExists ? current : legacyExists ? legacy : null;
  if (!path) return { state: 'absent', project };
  try {
    const receiptPath = join(path, '.conquistador-install.json');
    if (!existsSync(receiptPath)) return { state: 'unowned', path, project };
    const info = lstatSync(receiptPath);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 262144) return { state: 'unowned', path, project };
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    if (receipt.schemaVersion !== 'conquistador.public-install/v1' || receipt.mode !== 'single-agent') return { state: 'unowned', path, project };
    if (receipt.digest !== treeDigest(path)) return { state: 'modified', path, project, receipt };
    const integration = projectIntegration(path);
    try {
      if (integration) inspectProjectSkills(path);
    } catch {
      return { state: 'modified', path, project, receipt };
    }
    return {
      state: 'unchanged',
      path,
      project,
      receipt,
      integration,
      hosts: installedHosts(integration),
      legacy: path === legacy,
    };
  } catch {
    return { state: 'unowned', path, project };
  }
}

function versionNotice(inspection) {
  const { receipt, path } = inspection;
  let manifestChanged = false;
  try { manifestChanged = readFileSync(join(path, 'release/completeness.json'), 'utf8') !== readFileSync(join(root, 'release/completeness.json'), 'utf8'); } catch { manifestChanged = true; }
  if (receipt.productVersion === version && !manifestChanged) return null;

  return `This project's payload differs from the current CLI (installed ${receipt.productVersion ?? 'unknown'}; CLI ${version}). Files were not changed.\nUpdate with: ${shellCommand(['conquistador', 'operator', 'update', '--path', path])}`;
}

function printStart(inspection, task, cwd) {
  const hosts = inspection.hosts?.length ? inspection.hosts : ['none'];
  const firstTask = Object.hasOwn(FIRST_TASKS, task) ? FIRST_TASKS[task] : (task ?? FIRST_TASKS['launch-plan']);
  console.log(`Installed: ${inspection.path}`);
  console.log(`Use with: ${hosts.map(host => hostLabels[host] ?? host).join(', ')}`);
  console.log(operatorNextSteps(inspection.path, hosts, cwd, firstTask));
}

function planText(project, host, task) {
  const creates = destinationsFor(project, host);
  const adoption = hostFolders[host] && existsSync(join(project, hostFolders[host]))
    ? ` Adopt the unchanged independently managed skill at ${join(project, hostFolders[host])}; operator uninstall will remove it too.` : '';

  return `Set up Conquistador in ${project}? All 38 methods through one Conquistador entry. Use with: ${hostLabels[host]}. First task: ${task.label}. Creates: ${creates.join(' and ')}.${adoption}`;
}

function viewChanges(project, host, inspection) {
  const creates = destinationsFor(project, host);
  return [
    `Payload: complete operator, all 38 methods, profile, contracts, schemas, and BB adapter.`,
    hostFolders[host] ? `Native parent skill for ${hostLabels[host]}.` : host === 'bb' ? 'BB uses the complete operator and explicit team adapter. No native skill is registered.' : 'Files only. Read .conquistador/SKILL.md explicitly.',
    `Ownership: Conquistador setup owns ${creates.join(' and ')}.`,
    `Source version: ${version}.`,
    'Activation boundary: this step prepares and verifies local files. Host registration, discovery, and the first task stay unverified.',
    inspection?.integration?.skills?.some(item => item.adopted) ? 'An independently managed copy is adopted only when this confirmation names it.' : '',
    hostFolders[host] && existsSync(join(project, hostFolders[host]))
      ? `Adopt the unchanged managed ${hostLabels[host]} skill. Operator uninstall will remove that copy too.`
      : '',
  ].filter(Boolean).join('\n');
}

async function chooseHost(ui, resolved, env) {
  const message = resolved.reason === 'unresolved'
    ? 'I could not identify your coding agent. Choose one, or use --host none.'
    : 'Choose one host. Conquistador installs into a single host.';
  return need(ui, await ui.select({ message, options: hostChoices(env), initialValue: resolved.candidates?.[0] ?? 'none' }));
}

async function chooseFirstTask(ui, initial = 'launch-plan') {
  const id = await need(ui, await ui.select({
    message: 'What do you want to do first in your coding agent?',
    initialValue: initial,
    options: [...Object.entries(FIRST_TASKS).map(([value, details]) => ({ value, label: details.label })),
      { value: 'custom', label: 'Describe another task' }],
  }));

  if (!id) return { id: initial, task: FIRST_TASKS[initial] };

  if (id !== 'custom') return { id, task: FIRST_TASKS[id] };
  const input = await need(ui, await ui.text({ message: 'What should Conquistador help you do?' }));
  const request = input?.trim();

  // Control characters cannot appear in a printable first-task handoff.
  if (!request || request.length > 2000 || /[\x00-\x1f\x7f]/.test(request)) throw new UsageError('Describe one task in 1–2000 characters on one line.');
  const outcome = request.replace(/^use\s+conquistador\s+to\s+/i, '');

  return { id, task: { label: 'Your task', prompt: `Use Conquistador to ${outcome}` } };
}

async function recommended({ options, cwd, run, ui, env, tty: interactive }) {
  const project = resolveProject(options.project, cwd);
  console.log(`Project: ${project}`);
  const recovery = readdirSync(project).filter(name => name.startsWith('.conquistador-transaction-'));
  if (recovery.length) throw Error(`A previous installation left recovery files: ${recovery.map(name => join(project, name)).join(', ')}. Preserve them and inspect the receipts with conquistador operator status before retrying. No new files were changed.`);
  const inspection = inspectOperator(project);
  if (inspection.state === 'conflict') {
    throw new Error('Both .conquistador and .conquistador-operator exist. Use conquistador operator status --path ABS to select one explicitly. Neither folder was changed.');
  }
  if (inspection.state === 'unowned') {
    throw new Error('This folder contains files Conquistador does not own. Nothing was changed. Check its original installer or choose another folder.');
  }
  if (inspection.state === 'modified') {
    throw new Error('Your Conquistador files have local edits. They were preserved. Inspect them with conquistador operator status before updating.');
  }
  if (inspection.state === 'unchanged' && !inspection.legacy) {
    const notice = versionNotice(inspection);
    if (notice) console.log(notice);
    const restricted = existsSync(join(inspection.path, 'domain-restriction.json'));
    if (restricted) console.log('Domain restriction retained. Receipt integrity checked; full-library readiness and host enforcement are unverified.');
    else if (!notice) {
      await runSetupAction(run, ['doctor', '--path', inspection.path]);
      console.log('Local files verified. Host discovery and task execution remain unverified.');
    } else console.log('Installed receipt integrity checked. Use the doctor from the installed release to verify completeness.');
    if (options.host && !inspection.hosts?.includes(options.host)) console.log('Recorded hosts were preserved. Use conquistador --advanced to review adding a host.');

    const task = interactive && !options.task && !options.yes && !options['dry-run']
      ? (await chooseFirstTask(ui)).task : options.task;

    printStart(inspection, task, cwd);
    return 0;
  }
  if (inspection.legacy) {
    if (options['dry-run']) {
      console.log(`Unchanged .conquistador-operator in ${project}. Migrate with an explicit conquistador operator update. No files changed.`);
      return 0;
    }
    if (options.yes || !interactive) {
      throw new Error('An older operator exists. Run conquistador operator update to migrate it to .conquistador.');
    }
    const hosts = inspection.hosts.length ? inspection.hosts : ['none'];
    const args = ['update', '--target', 'operator', '--project', project, '--hosts', hosts.join(',')];
    await runSetupAction(run, [...args, '--dry-run']);
    ui.note(`Move ${inspection.path} to ${join(project, '.conquistador')}. Update its unchanged owned files from CLI ${version}. Preserve hosts: ${hosts.join(', ')} and any domain restriction. Owned native folders: ${hosts.filter(host => hostFolders[host]).map(host => join(project, hostFolders[host])).join(', ') || 'none'}.`, 'Existing installation');
    if (!await need(ui, await ui.confirm({ message: `Migrate the unchanged operator in ${project} to .conquistador?`, initialValue: false }))) {
      ui.cancel('Cancelled. No files changed.');
      return 0;
    }
    await runSetupAction(run, args);
    const after = inspectOperator(project);
    if (!existsSync(join(after.path, 'domain-restriction.json'))) {
      await runSetupAction(run, ['doctor', '--path', after.path]);
      console.log('Local files verified.');
    } else console.log('Domain restriction retained. Receipt integrity checked; subset readiness remains unverified.');
    printStart(after, options.task, cwd);
    return 0;
  }

  let resolved = resolveHost({ host: options.host, existingHosts: inspection.hosts, env });
  if (options.yes && !resolved.host) {
    throw new UsageError('I could not identify your coding agent. Choose one, or use --host none.');
  }
  if (!resolved.host) {
    if (!interactive) throw new UsageError('I could not identify your coding agent. Choose one, or use --host none.');
    resolved = { host: await chooseHost(ui, resolved, env), reason: 'chosen' };
  }

  await runSetupAction(run, ['doctor', '--path', root]);
  const preflight = async host => {
    assertNoDiscoveryConflict(project, host);
    await runSetupAction(run, ['install', '--target', 'operator', '--project', project, '--host', host, '--dry-run']);
  };
  const apply = async host => {
    await preflight(host);
    const args = ['install', '--target', 'operator', '--project', project, '--host', host];
    if (options['dry-run']) {
      console.log(planText(project, host, FIRST_TASKS[options.task ?? 'launch-plan']));
      console.log(viewChanges(project, host, inspection));
      console.log('Dry run. No files changed.');
      return 0;
    }
    if (options.yes) {
      console.log(planText(project, host, FIRST_TASKS[options.task ?? 'launch-plan']));
      await runSetupAction(run, args);
      await runSetupAction(run, ['doctor', '--path', join(project, '.conquistador')]);
      finish(project, host, options.task);
      return 0;
    }
    return interactiveApply(host);
  };

  const finish = (dest, host, task) => {
    console.log('Local files verified. Host discovery and task execution remain unverified.');
    printStart({ project: dest, path: join(dest, '.conquistador'), hosts: [host] }, task, cwd);
  };

  const interactiveApply = async host => {
    ui.intro(`Conquistador ${version}`);
    ui.log.info('Other integrations: conquistador --help');
    let current = host;
    let firstTask = { id: options.task ?? 'launch-plan', task: FIRST_TASKS[options.task ?? 'launch-plan'] };
    for (;;) {
      const action = await need(ui, await ui.select({
        message: planText(project, current, firstTask.task),
        initialValue: 'setup',
        options: [
          { value: 'setup', label: 'Set up Conquistador' },
          { value: 'host', label: 'Change host' },
          { value: 'task', label: 'Choose first task' },
          { value: 'changes', label: 'View changes' },
        ],
      }));
      if (action === 'host') {
        current = await chooseHost(ui, { reason: 'unresolved' }, env);
        await preflight(current);
        continue;
      }

      if (action === 'task') {
        firstTask = await chooseFirstTask(ui, firstTask.id);
        continue;
      }
      if (action === 'changes') {
        ui.note(viewChanges(project, current, inspection), 'Installation plan');
        continue;
      }
      await runSetupAction(run, ['install', '--target', 'operator', '--project', project, '--host', current]);
      try {
        await runSetupAction(run, ['doctor', '--path', join(project, '.conquistador')]);
      } catch (error) {
        console.log('Local files are ready. conquistador operator doctor is still required.');
        throw error;
      }

      finish(project, current, firstTask.task);
      ui.outro('Conquistador files are ready.');
      return 0;
    }
  };

  return apply(resolved.host);
}

export async function runOnboarding(args, extra = {}) {
  const cwd = extra.cwd ?? process.cwd();
  const run = extra.run ?? defaultRun;
  const env = extra.env ?? process.env;
  let ui = extra.ui;
  const interactive = extra.tty ?? tty();
  try {
    const options = parseOnboarding(args);
    if (options.help) {
      console.log(options.route === 'default' ? topHelp(version) : routeHelp(options.route));
      return 0;
    }
    if (options.version) {
      console.log(version);
      return 0;
    }
    assertNode24();
    requireNoninteractivePlan(options, interactive);
    if ((options.route === 'default' && !options.yes && !options['dry-run']) || options.route === 'advanced' || (options.route === 'bot' && options.bot === null)) {
      if (!interactive) throw new Error('Interactive setup requires a terminal. Use conquistador --host HOST --yes, or conquistador --help.');
    }
    if (!ui && interactive) ui = cancellableUi(await import('./vendor/clack.mjs'));
    ui ??= {
      intro() {}, outro() {}, cancel() {}, note() {}, isCancel: () => false,
      select: async () => { throw new Error('Interactive setup requires a terminal.'); },
      confirm: async () => { throw new Error('Interactive setup requires a terminal.'); },
      log: { info() {}, error() {} },
    };
    const ctx = { options, cwd, run, ui, tty: interactive, env, spawn: extra.spawn ?? spawnSync };
    ctx.runRecommended = overrides => recommended({ ...ctx, ...overrides });
    if (options.route === 'advanced') {
      const { runSetupGuide } = await import('./setup-guide.mjs');
      return await runSetupGuide({
        cwd: resolveProject(options.project, cwd),
        version,
        run: args => runSetupAction(run, args),
        ui,
      });
    }
    if (options.route === 'bot') return await runBotRoute(ctx);
    if (['skills', 'plugin', 'mcp'].includes(options.route) && !options.url) await runSetupAction(run, ['doctor', '--path', root]);
    if (options.route === 'skills') return await runSkillsRoute(ctx);
    if (options.route === 'plugin') return await runPluginRoute(ctx);
    if (options.route === 'mcp') return await runMcpRoute(ctx);
    return await recommended(ctx);
  } catch (error) {
    if (error.cancelled) {
      ui?.cancel?.(error.message);
      return error.exitCode ?? 0;
    }
    console.error(`[conquistador] ${error.message}`);
    return error instanceof UsageError ? 2 : error.exitCode ?? 1;
  }
}
