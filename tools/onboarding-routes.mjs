import { existsSync, readFileSync, lstatSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pluginNextSteps } from './setup-surfaces.mjs';
import { gitRoot, hostFolders, hostLabels } from './onboarding-hosts.mjs';
import { FIRST_PROMPT, PLUGIN_TARGETS, SKILLS_AGENTS, SKILLS_PIN, UsageError } from './onboarding-parse.mjs';
import { shellCommand, shellDirectory } from './install-paths.mjs';
import { assertUnrestrictedProject, validateManagerPaths, npxInvocation, verifyManagerCopy } from './onboarding-safety.mjs';

const NODE_FLOOR = 'Conquistador needs Node 22.18 or later. Switch Node versions and rerun this command.';

export function assertNodeFloor() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 18)) throw new Error(NODE_FLOOR);
}

export function resolveProject(value, cwd) {
  const project = resolve(cwd, value ?? cwd);
  if (/[\x00-\x1f\x7f]/.test(project)) throw new UsageError('Use a project path without control characters.');
  if (!existsSync(project) || !lstatSync(project).isDirectory()) throw new UsageError('Choose an existing project directory with --project PATH.');
  return project;
}

export function resolveDestination(project, fallback, pathOption) {
  if (!pathOption) return join(project, fallback);
  return isAbsolute(pathOption) ? pathOption : resolve(project, pathOption);
}

export async function confirmPlan({ ui, tty, yes, title, details, dryRun }) {
  if (dryRun) {
    console.log(title);
    if (details) console.log(details);
    console.log('Dry run. No files changed.');
    return 'dry-run';
  }
  if (yes) {
    console.log(title);
    if (details) console.log(details);
    return 'apply';
  }
  if (!tty) throw new UsageError('Noninteractive shortcuts need a resolved plan and either --yes or --dry-run.');
  if (details) ui.note(details, 'Installation plan');
  const checked = await need(ui, await ui.confirm({ message: title, initialValue: true }));
  if (!checked) {
    ui.cancel('Cancelled. No files changed.');
    return 'cancel';
  }
  return 'apply';
}

export async function need(ui, value) {
  if (ui.isCancel(value)) throw Object.assign(Error('Cancelled. No files changed.'), { cancelled: true });
  return value;
}

export async function runSetupAction(run, args) {
  const result = await run(args);
  const code = typeof result === 'number' ? result : result.code;
  if (code) throw Object.assign(Error(result.output?.trim() || 'The local installation step did not complete. Inspect the destination with conquistador setup status --path PATH before retrying.'), { setupCode: code, ...(code === 130 ? { exitCode: 130 } : {}) });
  return result.output ?? '';
}

export function retrySkills(project, source, agent, platform = process.platform) {
  const command = shellCommand([platform === 'win32' ? 'npx.cmd' : 'npx', '--yes', SKILLS_PIN, 'add', source, '--skill', 'conquistador', '--copy', '--agent', agent, '-y'], platform);
  const directory = shellDirectory(project, platform);
  return `${directory}\n${platform === 'win32' ? "$env:DO_NOT_TRACK='1'; $env:DISABLE_TELEMETRY='1'; " : 'DO_NOT_TRACK=1 DISABLE_TELEMETRY=1 '}${command}`;
}

export async function runBotRoute({ options, cwd, run, ui, tty, env = process.env, spawn = spawnSync, runRecommended }) {
  let bot = options.bot;
  if (bot === null) {
    if (!tty) throw new UsageError('Noninteractive --bot needs grok-bot or hermes, and either --yes or --dry-run.');
    bot = await need(ui, await ui.select({
      message: 'Which bot?',
      options: [
        { value: 'grok-bot', label: 'Grok Bot' },
        { value: 'hermes', label: 'Hermes Agent' },
      ],
    }));
  }
  if (bot === 'grok-bot') {
    console.log(`Install the Grok Bot app and sign in with a Cursor account:
https://docs.x.ai/grok-bot/get-started
Create a Bot, then use the documented Marketplace or private-skill controls:
https://docs.x.ai/grok-bot/skills-routines-and-automations
Plugin authorization is separate from installation:
https://prod.cursor.com/help/grok-bot/connect-plugins

A private Conquistador installation in Grok Bot has not been verified. No integration was activated.`);
    return 0;
  }
  return runHermesRoute({ options, cwd, run, ui, tty, env, spawn, runRecommended });
}

async function runHermesRoute({ options, cwd, run, ui, tty, runRecommended }) {
  const invocation = resolveProject(options.project, cwd);
  const root = gitRoot(invocation);
  if (!root) {
    console.log(`Hermes project skills require a Git project root. This folder is not inside a Git checkout.
Conquistador did not initialize Git or change your Hermes profile.
Install Hermes Agent from https://hermes-agent.nousresearch.com then run hermes setup.
Profile skills live in ~/.hermes/skills/; Conquistador will not write there.
See https://hermes-agent.nousresearch.com/docs/user-guide/features/skills/`);
    return 0;
  }
  let project = invocation;
  if (root !== invocation) {
    if (options.project) {
      throw new UsageError(`Hermes discovers project skills from the Git root ${root}. Pass --project with that root, not a subdirectory.`);
    }
    if (!tty || options.yes) {
      throw new UsageError(`Hermes discovers project skills from the Git root ${root}. Re-run with ${shellCommand(['conquistador', '--bot', 'hermes', '--project', root, '--yes'])}.`);
    }
    const choice = await need(ui, await ui.select({
      message: `Hermes discovers skills from the Git project root. Install Conquistador in ${root}?`,
      options: [
        { value: 'root', label: 'Use Git root' },
        { value: 'cancel', label: 'Cancel' },
      ],
    }));
    if (choice !== 'root') {
      ui.cancel('Cancelled. No files changed.');
      return 0;
    }
    project = root;
  }
  return runRecommended({ options: { ...options, project, host: 'hermes' } });
}

export async function runSkillsRoute({ options, cwd, run, ui, tty, env = process.env, spawn = spawnSync }) {
  const project = resolveProject(options.project, cwd);
  let host = options.host;
  if (!host) {
    if (!tty) throw new UsageError('Noninteractive --skills needs --host and either --yes or --dry-run.');
    host = await need(ui, await ui.select({
      message: 'Which host should skills.sh copy into?',
      options: Object.entries(SKILLS_AGENTS).map(([value, agent]) => ({ value, label: hostLabels[value], hint: `--agent ${agent}` })),
    }));
  }
  const source = resolveDestination(project, '.conquistador-skills-source', options.path);
  const agent = SKILLS_AGENTS[host];
  const destinations = validateManagerPaths(project, source, host);
  const action = existsSync(source) ? 'update' : 'install';
  const args = [action, '--target', 'skill', '--path', source];
  await runSetupAction(run, [...args, '--dry-run']);
  const title = `Install the compact Conquistador parent through skills.sh for ${hostLabels[host]} in ${project}?`;
  const details = [
    `Staged source: ${source} (Conquistador-owned; all 38 methods; no BB adapter or portable schemas)`,
    `Manager: npx --yes ${SKILLS_PIN} (download required)`,
    `Agent: ${agent}  Scope: this project  Copy: --copy`,
    `Manager destination: ${destinations.join(', ')}`,
    'Creates skills-lock.json owned by skills.sh. This is not a public skills.sh listing.',
    'The untransformed source checkout is not installed.',
  ].join('\n');
  const decision = await confirmPlan({ ui, tty, yes: options.yes, dryRun: options['dry-run'], title, details });
  if (decision !== 'apply') return 0;
  await runSetupAction(run, args);
  let result;
  try {
    const manager = npxInvocation(env);
    result = spawn(manager.command, [...manager.prefix, '--yes', SKILLS_PIN, 'add', source, '--skill', 'conquistador', '--copy', '--agent', agent, '-y'], {
      cwd: project,
      env: { ...env, DO_NOT_TRACK: '1', DISABLE_TELEMETRY: '1' },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) { result = { status: null, error }; }
  if (result.status !== 0) {
    console.error('The skills manager step did not complete. The staged source was preserved. Inspect any partial host copy and skills-lock.json through skills.sh before retrying.');
    console.error(`Retry: ${retrySkills(project, source, agent)}`);
    if (result.error) console.error(result.error.message);
    if (result.stderr) console.error(result.stderr.trim());
    return result.signal === 'SIGINT' ? 130 : 1;
  }
  try { verifyManagerCopy(project, source, destinations); }
  catch (error) {
    console.error(`${error.message} Staged and copied files were preserved. Inspect them through skills.sh before retrying.`);
    return 1;
  }
  console.log(`Copied payload verified: ${destinations.join(', ')}`);
  console.log(`Local files are ready. Start a fresh ${hostLabels[host]} session and select Conquistador.`);
  console.log(`Staged source remains at ${source}. Copied files and skills-lock.json are owned by skills.sh.`);
  console.log(FIRST_PROMPT);
  return 0;
}

export async function runPluginRoute({ options, cwd, run, ui, tty }) {
  const project = resolveProject(options.project, cwd);
  let host = options.host;
  if (!host) {
    if (!tty) throw new UsageError('Noninteractive --plugin needs --host and either --yes or --dry-run.');
    host = await need(ui, await ui.select({
      message: 'Which plugin manager?',
      options: [
        { value: 'claude-code', label: 'Claude Code', hint: 'local project scope' },
        { value: 'codex', label: 'Codex', hint: 'user-level registration' },
        { value: 'copilot', label: 'GitHub Copilot', hint: 'user-level registration' },
        { value: 'none', label: 'Generic compatible source' },
      ],
    }));
  }
  const target = PLUGIN_TARGETS[host];
  const path = resolveDestination(project, '.conquistador-plugin', options.path);
  assertUnrestrictedProject(project);
  if (host !== 'none' && Object.values(hostFolders).some(folder => existsSync(join(project, folder)))) throw Error('An existing Conquistador skill may duplicate this plugin. Preserve it and choose one discovery route through the original manager.');
  if (existsSync(join(path, 'domain-restriction.json'))) throw Error('This plugin source has a domain restriction. Use its original scoped setup command to update it.');
  const action = existsSync(path) ? 'update' : 'install';
  const args = [action, '--target', target, '--path', path];
  await runSetupAction(run, [...args, '--dry-run']);
  const title = `Prepare a Conquistador plugin source in ${path} for ${hostLabels[host]} in ${project}?`;
  const details = [
    'Complete native plugin with manifests. Setup owns this source; the manager owns any activated copy.',
    host === 'claude-code' ? 'Claude registration uses local project scope.' : host === 'none' ? 'No host manager command is known for a generic source.' : `${hostLabels[host]} plugin registration is user-level.`,
    'This phase prepares files. It does not run host-manager commands or claim activation.',
  ].join('\n');
  const decision = await confirmPlan({ ui, tty, yes: options.yes, dryRun: options['dry-run'], title, details });
  if (decision !== 'apply') return 0;
  await runSetupAction(run, args);
  await runSetupAction(run, ['doctor', '--path', path]);
  console.log(`Run the host commands from ${project}:`);
  console.log(shellDirectory(project));
  // Updating the staged source is not evidence of an activated manager copy.
  console.log('Host registration is unobserved. For initial registration:');
  console.log(pluginNextSteps(target, path, 'install'));
  if (action === 'update') console.log('If already registered, retain the original manager and scope and use its update procedure in docs/PLATFORMS.md. Updating this source does not register or refresh that copy.');
  console.log('Local files are ready. Host registration is still required.');
  return 0;
}

export async function runMcpRoute({ options, cwd, run, ui, tty }) {
  const project = resolveProject(options.project, cwd);
  let host = options.host;
  if (!host) {
    if (!tty) throw new UsageError('Noninteractive --mcp needs --host and either --yes or --dry-run.');
    host = await need(ui, await ui.select({
      message: 'Which MCP client?',
      options: [
        { value: 'claude-code', label: 'Claude Code' },
        { value: 'codex', label: 'Codex' },
        { value: 'cursor', label: 'Cursor' },
        { value: 'copilot', label: 'GitHub Copilot' },
        { value: 'none', label: 'Generic connector' },
      ],
    }));
  }
  const runtime = Boolean(options.url);
  const folder = runtime ? '.conquistador-runtime-mcp' : '.conquistador-mcp';
  const path = resolveDestination(project, folder, options.path);
  if (!runtime) assertUnrestrictedProject(project);
  const extra = [];
  if (options.url) extra.push('--url', options.url);
  if (options['runtime-path']) extra.push('--runtime-path', options['runtime-path']);
  const action = existsSync(path) ? 'update' : 'install';
  const args = [action, '--target', 'mcp', '--path', path, ...extra];
  await runSetupAction(run, [...args, '--dry-run']);
  if (action === 'update' && !runtime && JSON.parse(readFileSync(join(path, 'connector.json'), 'utf8')).args?.includes('--url')) {
    throw Error('That folder owns a runtime MCP connector. Pass its --url or choose a different local MCP folder.');
  }
  const title = `Prepare a ${runtime ? 'runtime MCP connector' : 'local MCP method server'} in ${path} for ${hostLabels[host]} in ${project}?`;
  const details = runtime
    ? `Runtime MCP executes only supported playbooks against ${options.url}. Setup will not start that service or install Executor.`
    : 'Local MCP copies the method server. The client reads methods; the host executes them. No HTTP service is started.';
  const decision = await confirmPlan({ ui, tty, yes: options.yes, dryRun: options['dry-run'], title, details });
  if (decision !== 'apply') return 0;
  await runSetupAction(run, args);
  await runSetupAction(run, ['doctor', '--path', path]);
  console.log(mcpHandoff(host, path, runtime, project));
  console.log(runtime
    ? 'Local files are ready. Client registration and the existing runtime service are still required.'
    : 'Local files are ready. Client registration is still required.');
  return 0;
}

export function mcpHandoff(host, path, runtime, project = dirname(path), platform = process.platform) {
  const connector = join(path, 'connector.json');
  const config = JSON.parse(readFileSync(connector, 'utf8'));
  const command = args => shellCommand(args, platform);
  const lines = [`Connector: ${connector}`, runtime
    ? 'This runtime connector needs its existing service. Service, data, credentials and approvals remain separate.'
    : 'This local connector lists and reads bundled methods. Your host supplies the model and execution.'];
  if (platform === 'win32') lines.push('Commands below use PowerShell.');
  if (host === 'claude-code') {
    lines.push('Claude Code local registration, scoped to the receiving project. Run from:',
      shellDirectory(project, platform),
      command(['claude', 'mcp', 'add', '--transport', 'stdio', '--scope', 'local', 'conquistador', '--', config.command, ...config.args]),
      `Check: ${command(['claude', 'mcp', 'list'])}`,
      `If add is unavailable, merge this project-scope entry into ${join(project, '.mcp.json')} and approve it in Claude:`,
      JSON.stringify({ mcpServers: { conquistador: { type: 'stdio', ...config } } }, null, 2));
  } else if (host === 'codex') {
    lines.push('Codex user-level settings: ~/.codex/config.toml. Merge this table:',
      '[mcp_servers.conquistador]', `command = ${JSON.stringify(config.command)}`, `args = ${JSON.stringify(config.args)}`,
      `Check: ${command(['codex', 'mcp', 'list'])}. Restart Codex and check /mcp.`);
  } else if (host === 'cursor') {
    lines.push(`Cursor project settings: ${join(project, '.cursor/mcp.json')}. Merge this entry:`,
      JSON.stringify({ mcpServers: { conquistador: config } }, null, 2),
      'Restart Cursor and check Settings > Tools & MCP for Conquistador.');
  } else if (host === 'copilot') {
    lines.push('GitHub Copilot CLI user-level settings: ~/.copilot/mcp-config.json. Merge this entry:',
      JSON.stringify({ mcpServers: { conquistador: { type: 'local', ...config, tools: ['*'] } } }, null, 2),
      'Restart Copilot CLI and check /mcp show conquistador.');
  } else {
    lines.push('Merge this connector into your MCP client under its server name:', JSON.stringify(config, null, 2));
  }
  lines.push('Setup did not edit client settings or run these commands. A discovery listing does not prove method execution.');
  return lines.join('\n');
}
