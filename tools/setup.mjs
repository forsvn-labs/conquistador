#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { parseKnowledgeRoots, readDomainManifestFile, resolveDomainSelection, resolveKnowledgeRoot } from './domain-package.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'tools/setup.mjs');
const receiptName = '.conquistador-install.json';
const schema = 'conquistador.public-install/v1';
const targets = {
  codex: 'conquistador', 'claude-code': 'conquistador', copilot: 'conquistador', cursor: 'conquistador', skill: 'conquistador',
  'claude-plugin': 'plugin', 'codex-plugin': 'plugin', 'copilot-plugin': 'plugin', 'agent-plugins': 'plugin',
  mcp: 'mcp', harness: 'single-agent', squad: 'squad', 'grok-bot': 'grok-bot', eve: 'eve',
};
const projectPaths = { codex: '.agents/skills/conquistador', 'claude-code': '.claude/skills/conquistador', copilot: '.github/skills/conquistador', cursor: '.cursor/skills/conquistador' };
const fail = message => { throw new Error(message); };
function stat(path) {
  try { return lstatSync(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function absolutePath(path) {
  if (!isAbsolute(path) || /[\x00-\x1f\x7f]/.test(path)) fail('Use an absolute path without control characters.');
  const target = resolve(path);
  for (let cursor = target; ; cursor = dirname(cursor)) {
    if (stat(cursor)?.isSymbolicLink()) fail('Destination must not cross a symlink.');
    if (cursor === dirname(cursor)) break;
  }
  return target;
}
function safePath(path) {
  const target = absolutePath(path);
  const inside = (a, b) => { const part = relative(a, b); return !part || (part !== '..' && !part.startsWith(`..${sep}`)); };
  if (inside(root, target) || inside(target, root)) fail('Choose a dedicated directory outside the distribution.');
  return target;
}
function serviceUrl(value) {
  let url;
  try { url = new URL(value); } catch { fail('Use an HTTP/HTTPS service origin.'); }
  if (!/^https?:\/\//.test(value) || /[\s\\?#]/.test(value) || url.username || url.password || url.pathname !== '/' ||
      !['http:', 'https:'].includes(url.protocol) ||
      (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    fail('Use an HTTPS origin or loopback HTTP origin without credentials, path, query, or fragment.');
  }
  return url.origin;
}
function parse(args) {
  const [action, ...rest] = args;
  if (!['install', 'status', 'update', 'uninstall'].includes(action)) fail('Use install, status, update, or uninstall.');
  const options = { action };
  for (let i = 0; i < rest.length; i += 2) {
    const flag = rest[i];
    if (!['--target', '--project', '--path', '--url', '--domain', '--knowledge-roots'].includes(flag) || options[flag.slice(2)] !== undefined || !rest[i + 1] || rest[i + 1].startsWith('--')) fail('Unknown, duplicate, or incomplete option.');
    options[flag.slice(2)] = rest[i + 1];
  }
  if (options.target !== undefined && !Object.hasOwn(targets, options.target)) fail('Unknown target.');
  if (!!options.project === !!options.path) fail('Supply exactly one of --project ABS or --path ABS.');
  if (options.project) {
    if (!Object.hasOwn(projectPaths, options.target ?? '')) fail('--project requires a named coding-agent target; use --path for other targets.');
    absolutePath(options.project);
    options.path = join(options.project, projectPaths[options.target]);
  }
  options.path = safePath(options.path);
  if (action === 'install' && !options.target) fail('Install requires --target.');
  if (options.url !== undefined) {
    if (options.target !== 'mcp' || !['install', 'update'].includes(action)) fail('--url requires install/update --target mcp.');
    options.url = serviceUrl(options.url);
  }
  if (options.domain !== undefined) {
    if (!['install', 'update'].includes(action)) fail('--domain requires install or update.');
    if (options.target && !['skill', 'codex', 'claude-code', 'copilot', 'cursor', 'claude-plugin', 'codex-plugin', 'copilot-plugin', 'agent-plugins', 'harness'].includes(options.target)) {
      fail('Domain packages apply to coding-agent, plugin, and harness installs.');
    }
    options.domain = absolutePath(options.domain);
    options.selection = resolveDomainSelection(root, readDomainManifestFile(options.domain));
  }
  if (options['knowledge-roots'] !== undefined) {
    if (!options.selection) fail('--knowledge-roots requires --domain.');
    const config = parseKnowledgeRoots(JSON.parse(readFileSync(absolutePath(options['knowledge-roots']), 'utf8')));
    for (const handle of options.selection.knowledgeHandles) resolveKnowledgeRoot(handle, config, { productRoot: root });
    options.knowledgeRoots = config;
  }
  return options;
}
// Match install.mjs receipt hashing, including rejection of links and special files.
function digest(directory) {
  const hash = createHash('sha256');
  function visit(prefix = '') {
    for (const name of readdirSync(join(directory, prefix)).sort()) {
      const key = prefix ? `${prefix}/${name}` : name;
      const path = join(directory, key);
      const info = lstatSync(path);
      if (info.isSymbolicLink()) fail('Install contains a symlink.');
      if (info.isDirectory()) visit(key);
      else if (!info.isFile()) fail('Install contains a special file.');
      else if (key !== receiptName) hash.update(key).update('\0').update(createHash('sha256').update(readFileSync(path)).digest('hex')).update('\n');
    }
  }
  visit();
  return hash.digest('hex');
}
function inspect(path, expectedMode) {
  if (!stat(path)) return { state: 'absent' };
  try {
    if (!stat(path).isDirectory() || !stat(join(path, receiptName))?.isFile() || stat(join(path, receiptName)).isSymbolicLink()) fail('Missing receipt.');
    const record = JSON.parse(readFileSync(join(path, receiptName), 'utf8'));
    if (record.schemaVersion !== schema || (!Object.values(targets).includes(record.mode) && !/^skill:[a-z][a-z0-9-]*$/.test(record.mode))) fail('Unknown receipt.');
    if (expectedMode && expectedMode !== record.mode) return { state: 'wrong-target', mode: record.mode, domainId: record.domainId };
    return { state: record.digest === digest(path) ? 'unchanged' : 'modified', mode: record.mode, domainId: record.domainId };
  } catch { return { state: 'modified', ownership: 'unverified' }; }
}
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const shellCommand = (...args) => args.map(quote).join(' ');
const command = (...args) => shellCommand(process.execPath, script, ...args);
function pluginNext(target, path, action) {
  const host = { 'claude-plugin': 'claude', 'codex-plugin': 'codex', 'copilot-plugin': 'copilot' }[target];
  if (!host) return;
  console.log('Manual host commands, subject to your host version and policy:');
  if (action === 'update') {
    if (host === 'claude') console.log(shellCommand(host, 'plugin', 'update', 'conquistador@conquistador', '--scope', 'local'));
    else if (host === 'codex') console.log(shellCommand(host, 'plugin', 'add', 'conquistador@conquistador'));
    else console.log('Use copilot plugin list, then copilot plugin update NAME with the listed name.');
    console.log('Match the original host scope and registration before updating.');
  } else {
    const scope = host === 'claude' ? ['--scope', 'local'] : [];
    console.log(shellCommand(host, 'plugin', 'marketplace', 'add', path, ...scope));
    console.log(shellCommand(host, 'plugin', host === 'codex' ? 'add' : 'install', 'conquistador@conquistador', ...scope));
  }
  console.log(shellCommand(host, 'plugin', 'list', ...(host === 'copilot' ? [] : ['--json'])));
}
function report(options, result) {
  const { path, target } = options;
  console.log(`Local state: ${result.state}. Path: ${path}`);
  if (options.action === 'uninstall') {
    console.log('Removed the unchanged owned local copy.');
    if (result.mode === 'plugin') console.log('Host registration and activated copies remain host-owned. Use the original manager and scope to uninstall; for Claude preserve data with --keep-data. Do not remove shared marketplaces.');
    if (result.mode === 'mcp') console.log('Client registration remains host-owned. Remove its connector entry separately. Service, runtime data, and secrets were preserved.');
    return;
  }
  if (result.state === 'unchanged') {
    console.log(result.mode === 'mcp'
      ? 'Connector configured locally. Client registration unverified. No service was installed or contacted.'
      : 'Prepared locally. Host activation unverified.');
    if (result.domainId) console.log(`Domain: ${result.domainId}. Load-time restriction is in domain-restriction.json.`);
    console.log('Next: ' + (result.mode === 'mcp'
      ? 'Add connector.json through your MCP client settings. With no --url, stdio serves bundled methods using your host model and tools. An explicit --url uses the separate runtime service; never pass human review or action tokens.'
      : result.mode === 'plugin'
        ? 'Use your host plugin manager to register and activate this local folder. Its activated copy, update, and uninstall remain host-owned.'
        : ['eve', 'grok-bot'].includes(result.mode)
          ? 'Experimental import only. Native app support and activation are unverified.'
          : 'Load the prepared contract or skill in your host, start a fresh session, and verify discovery with a small task.'));
    if (result.mode === 'plugin') pluginNext(target, path, options.action);
    console.log(`Update local copy: ${command('update', '--path', path)}`);
    console.log(`Uninstall local copy: ${command('uninstall', '--path', path)}`);
  } else if (result.state === 'absent' && target === 'mcp') {
    console.log('Next: install --target mcp --path prepares local stdio. Add --url only for an existing runtime service.');
  } else if (result.state === 'absent' && target) {
    const urlArgs = options.url ? ['--url', options.url] : [];
    console.log(`Install: ${command('install', '--target', target, '--path', path, ...urlArgs)}`);
  } else if (result.state !== 'absent') console.log('Preserve this folder. Ownership or file integrity does not permit update or removal.');
}
function mcpLifecycle(options) {
  const { action, path } = options;
  if (action === 'uninstall') { rmSync(path, { recursive: true }); return; }
  let url = options.url;
  if (action === 'update' && !url) {
    const prior = JSON.parse(readFileSync(join(path, 'connector.json'), 'utf8'));
    const priorArgs = prior.args;
    if (!Array.isArray(priorArgs) || priorArgs[1] !== 'mcp' ||
        !([2, 4].includes(priorArgs.length)) || (priorArgs.length === 4 && priorArgs[2] !== '--url')) fail('Unrecognized MCP connector. Preserve it and choose a new folder.');
    if (priorArgs.length === 4) url = serviceUrl(priorArgs[3]);
  }
  const connector = { command: process.execPath, args: [join(root, 'runtime/bin/conquistador.js'), 'mcp', ...(url ? ['--url', url] : [])] };
  mkdirSync(dirname(path), { recursive: true });
  const temporary = mkdtempSync(join(dirname(path), '.conquistador-connector-'));
  let previous;
  try {
    writeFileSync(join(temporary, 'connector.json'), JSON.stringify(connector, null, 2) + '\n');
    writeFileSync(join(temporary, receiptName), JSON.stringify({ schemaVersion: schema, mode: 'mcp', digest: digest(temporary), liveHostVerified: false }, null, 2) + '\n');
    if (action === 'update') {
      if (inspect(path, 'mcp').state !== 'unchanged') fail('Files changed during staging.');
      previous = mkdtempSync(join(dirname(path), '.conquistador-previous-'));
      renameSync(path, join(previous, 'install'));
    } else if (stat(path)) fail('Destination appeared during staging.');
    renameSync(temporary, path);
    if (previous) rmSync(previous, { recursive: true });
  } catch (error) {
    if (previous && !stat(path)) renameSync(join(previous, 'install'), path);
    throw error;
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
function removalReminder(mode) {
  if (mode === 'plugin') console.log('Before removing this folder: use the original host manager and scope to uninstall activated copies; for Claude preserve data with --keep-data. Do not remove shared marketplaces.');
  else if (mode === 'mcp') console.log('Before removing this folder: disconnect its connector entry in your MCP client. Service, runtime data, and secrets remain separate.');
  else if (['single-agent', 'squad'].includes(mode)) console.log('Before removing this folder: disconnect the contract from your custom agent host. Host configuration and running agents remain host-owned.');
}
function run(options, reminderShown = false) {
  const mode = options.target ? targets[options.target] : undefined;
  const result = inspect(options.path, mode);
  if (options.action === 'status') { report(options, result); return; }
  if (options.action === 'install') {
    if (result.state !== 'absent') fail('Destination exists. Use status, or choose a new directory.');
    if (['eve', 'grok-bot'].includes(mode)) {
      console.log('Experimental handoff only. No files installed. Native Grok/Eve app support and activation are unverified. Review hosts/' + mode + '/capabilities.md with your host operator.');
      return;
    }
  } else if (result.state !== 'unchanged') fail(`Refusing ${options.action}: ${result.state}; unowned or modified files are preserved.`);
  const ownedMode = mode ?? result.mode;
  if (options.action === 'uninstall' && !reminderShown) removalReminder(ownedMode);
  if (ownedMode === 'mcp') mcpLifecycle(options);
  else execFileSync(process.execPath, [join(root, 'tools/install.mjs'), { install: 'install', update: 'upgrade', uninstall: 'remove' }[options.action], ownedMode, options.path, ...(options.domain ? ['--domain', options.domain] : [])], { stdio: 'pipe' });
  const checked = inspect(options.path, ownedMode);
  report(options, { ...checked, mode: ownedMode });
}
async function guided() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) fail('Interactive setup requires a terminal. Use install|status|update|uninstall --target TARGET --path ABS.');
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const action = (await prompt.question('Action: install, status, update, uninstall [install]: ')).trim() || 'install';
    if (!['install', 'status', 'update', 'uninstall'].includes(action)) fail('Unknown action.');
    const args = [action];
    if (action === 'install') {
      console.log('Where will you use Conquistador?\n1. Coding agent (recommended)\n2. Host plugin\n3. MCP over stdio\n4. Custom agent host\n5. Experimental Grok/Eve');
      const groups = { 1: ['codex', 'claude-code', 'copilot', 'cursor', 'skill'], 2: ['claude-plugin', 'codex-plugin', 'copilot-plugin', 'agent-plugins'], 3: ['mcp'], 4: ['harness', 'squad'], 5: ['grok-bot', 'eve'] };
      const group = groups[(await prompt.question('Group [1]: ')).trim() || '1'];
      if (!Array.isArray(group)) fail('Unknown group.');
      console.log(group.join(', '));
      const target = (await prompt.question(`Target [${group[0]}]: `)).trim() || group[0];
      if (!group.includes(target)) fail('Choose a target from this group.');
      const location = Object.hasOwn(projectPaths, target) ? '--project' : '--path';
      const path = await prompt.question(location === '--project' ? 'Absolute project directory: ' : 'Absolute owned folder: ');
      args.push('--target', target, location, path);
      if (target === 'mcp') {
        const url = (await prompt.question('Runtime service origin, or Enter for local methods: ')).trim();
        if (url) args.push('--url', url);
      }
    } else args.push('--path', await prompt.question('Absolute owned folder: '));
    const options = parse(args);
    console.log(command(...args));
    if (action === 'uninstall') removalReminder(inspect(options.path).mode);
    if (action === 'status' || (await prompt.question('Apply this local action? [y/N]: ')).trim().toLowerCase() === 'y') run(options, action === 'uninstall');
    else console.log('Cancelled. No files changed.');
  } finally { prompt.close(); }
}
export async function runSetup(args) {
  try {
    if (args[0] === 'doctor') {
      const { runInstallationDoctor } = await import('./installation-doctor.mjs');
      return runInstallationDoctor(args.slice(1), inspect);
    }
    if (args.length === 0) await guided();
    else if (args.length === 1 && args[0] === '--help') console.log('Usage: node tools/setup.mjs [install|status|update|uninstall --target TARGET (--project ABS | --path ABS) [--url ORIGIN] [--domain ABS] [--knowledge-roots ABS]]\n       conquistador setup doctor --path ABS [--json]\nDoctor checks local library completeness, build identity where available, and saved MCP executable paths. It does not verify host activation or provider access.\nTargets: ' + Object.keys(targets).join(', ') + '\nOmit target with --path for receipt-owned status, update, or uninstall. --domain selects roles, outcomes, workflows, tools, and logical knowledge handles from the canonical library. Knowledge roots stay in operator-owned configuration. No arguments opens guided setup.');
    else run(parse(args));
    return 0;
  } catch (error) {
    console.error(`[conquistador-setup] ${error.message}`);
    return 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runSetup(process.argv.slice(2));
}
