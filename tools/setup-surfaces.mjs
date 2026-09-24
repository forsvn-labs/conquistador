import { basename, dirname, join } from 'node:path';
import { loadOperatorProfile } from './operator-profile.mjs';
import { containsPath, shellCommand } from './install-paths.mjs';
import { hostFolders, hostLabels } from './project-installation.mjs';
import { inspectMode } from './conquistador-mode.mjs';
import { explainRoute, selectRequestContext } from './context-selection.mjs';

export const pluginHosts = { 'codex-plugin': 'codex', 'claude-plugin': 'claude-code', 'copilot-plugin': 'copilot' };

export function pluginNextSteps(target, path, action) {
  const host = { 'claude-plugin': 'claude', 'codex-plugin': 'codex', 'copilot-plugin': 'copilot' }[target];
  const lines = [`Register this source through your plugin manager: ${path}`, 'The manager owns activation, cached copies and scope. Setup owns only this source folder.'];
  if (host) {
    lines.push('Manual host commands, subject to your host version and policy:');
    if (action === 'update') {
      if (host === 'claude') lines.push(shellCommand([host, 'plugin', 'update', 'conquistador@conquistador', '--scope', 'local']));
      else if (host === 'codex') lines.push(shellCommand([host, 'plugin', 'add', 'conquistador@conquistador']));
      else lines.push('Use copilot plugin list, then copilot plugin update NAME with the listed name.');
      lines.push('Match the original host scope and registration before updating.');
    } else {
      const scope = host === 'claude' ? ['--scope', 'local'] : [];
      lines.push(shellCommand([host, 'plugin', 'marketplace', 'add', path, ...scope]), shellCommand([host, 'plugin', host === 'codex' ? 'add' : 'install', 'conquistador@conquistador', ...scope]));
    }
    lines.push(shellCommand([host, 'plugin', 'list', ...(host === 'copilot' ? [] : ['--json'])]));
  }
  lines.push('First task: start a fresh host session, select Conquistador, and request a draft launch email from supplied product facts.');
  lines.push(...['update', 'uninstall'].map(action => shellCommand(['conquistador', 'setup', action, '--path', path])));
  return lines.join('\n');
}

export function validateSurfacePlan(items) {
  const destinations = [], nativeHosts = new Set();
  for (const item of items) {
    if (item.route === 'experimental') continue;
    const paths = [item.path];
    if (item.target === 'operator') {
      for (const host of item.hosts) if (hostFolders[host]) {
        paths.push(join(item.project, hostFolders[host])); nativeHosts.add(host);
      }
    } else if (hostFolders[item.target]) nativeHosts.add(item.target);
    for (const path of paths) {
      if (destinations.some(other => containsPath(other, path) || containsPath(path, other))) throw Error(`Installation folders overlap: ${path}. Choose separate folders; each copy needs one owner.`);
      destinations.push(path);
    }
  }
  for (const item of items.filter(item => item.route === 'plugin')) {
    for (const target of item.targets) if (nativeHosts.has(pluginHosts[target])) throw Error(`Choose either the ${pluginHosts[target]} native skill or plugin for this setup. The plugin already contains the same parent skill.`);
  }
}

function activationAt(path) {
  try {
    return loadOperatorProfile(path, { allowMissing: true })?.activation ?? 'unknown; run doctor for the selected installation';
  } catch {
    return 'invalid profile; run doctor for the selected installation';
  }
}

function hookState(path, host, project) {
  try {
    const input = { host, project, scriptPath: join(path, 'tools/conquistador-mode.mjs') };
    const registered = inspectMode(input);

    if (!registered.hookRegistered) return 'not registered';
    const current = registered.config ? inspectMode({ ...input, config: registered.config }) : registered;

    if (current.repairRequired) return 'registered; saved command needs repair';

    if (current.routingAvailable) return 'configured; host trust and delivery unverified';

    return 'registered but disabled or unverified';
  } catch {
    return 'needs inspection; run conquistador doctor';
  }
}

function taskRoute(path, prompt) {
  try {
    const route = explainRoute(selectRequestContext(prompt, { root: path }));

    return route.selected.length ? route.selected.join(', ') : 'parent selection required';
  } catch {
    return 'unavailable; run doctor for the selected installation';
  }
}

export function operatorNextSteps(path, hosts, cwd = process.cwd(), task = {
  label: 'Plan a launch',
  prompt: 'Use Conquistador to draft a launch plan from the product facts in this project. Mark missing facts. Keep it as a draft.',
}) {
  const local = dirname(path) === cwd;
  const display = local ? basename(path) : path;
  const doctor = shellCommand(['conquistador', 'operator', 'doctor', '--path', path]);
  const lines = [];
  if (hosts.includes('bb')) lines.push(
    `BB: open or create a thread in ${dirname(path)} and its environment.`,
    `Ask its agent to read ${join(display, 'SKILL.md')} and follow it for your task.`,
    `For an explicit specialist team, follow ${join(display, 'hosts/coding-agent/README.md')}.`,
    'BB owns the provider, model, permissions and child threads. Setup did not install a BB plugin or request router. Native provider discovery is separate.');
  for (const host of hosts.filter(host => hostFolders[host])) lines.push(
    `${hostLabels[host]}: start a fresh session in ${local ? 'this project' : dirname(path)}, select Conquistador, or name it in your prompt.`,
    `Native skill: ${local ? join(hostFolders[host], 'SKILL.md') : join(path, '..', hostFolders[host], 'SKILL.md')}.`);
  if (hosts.includes('hermes')) lines.push('Hermes trust is separate: ' + shellCommand(['hermes', 'skills', 'trust', dirname(path)]) + '. Setup did not grant trust or install Hermes.');
  if (!hosts.some(host => hostFolders[host]) && !hosts.includes('bb')) lines.push(`Ask your coding agent or custom host to read ${join(display, 'SKILL.md')} and follow it.`);
  lines.push(`Activation: ${activationAt(path)}. The host owns skill discovery and model selection; setup did not run a task.`);

  for (const host of hosts.filter(value => ['codex', 'claude-code'].includes(value))) {
    lines.push(`${hostLabels[host]} request-time hook: ${hookState(path, host, dirname(path))}.`);
  }

  lines.push(`First task: ${task.label}`, task.prompt,
    `Local route preview: ${taskRoute(path, task.prompt)}. The host must discover and read the method before use.`,
    `Method use: check the host trace for the selected full method and required resource reads; then review the result. Local doctor cannot verify this.`,
    `If discovery fails: refresh the host session, run ${doctor}, or ask the host to read ${join(display, 'SKILL.md')} and follow it.`);

  if (hosts.includes('codex')) lines.push(`Hook trust: if prompt routing is enabled, review the project and exact hook in Codex; run ${doctor} to check registration. Registration does not prove delivery.`);
  lines.push(`Run ${shellCommand(['conquistador', 'start', '--task', 'ID', '--project', dirname(path)])} to choose another first task; conquistador skills lists the capabilities. Use conquistador --help for other integration forms and their owners.`,
    ...['doctor', 'update', 'uninstall'].map(action => shellCommand(['conquistador', 'operator', action, '--path', path])));
  return lines.join('\n');
}
