// Onboarding v2: the one first-run installer. `conquistador` (first run), `conquistador add`, and
// the install flags all come here. Five surfaces: coding agents, MCP apps, Hosted MCP, Executor,
// and chat bots. Steps: preflight, welcome, surfaces, details, review, install with a verify pass,
// project setup, first task, summary. Nothing changes before the user confirms the review.
// Every answer has a flag; without a terminal and without --yes the plan prints and exits 2.
import { spawn } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { AGENTS, OWNED, agentId, detectAgents, home, installOne, payloadCurrent, pluginHome, productRoot, projectFolders, projectRoot, readState,
  self, setHooks, skillCurrent, stageTargets, version, writeState } from './agents.mjs';
import { MCP_APPS, appById, applyApp, checkApp, detectApps, inspectApp } from './mcp-apps.mjs';
import { checkSource, executorStatus, manualSteps, registerSource, slugFor } from './executor-source.mjs';
import { reachable, shadowProblem, startUpdateCheck, updateNotice } from './preflight.mjs';
import { paint, plainUi, stepLabel, wordmark, wrapText } from './onboard-ui.mjs';
import { channel } from './self-update.mjs';

export const SURFACE_IDS = ['agents', 'mcp-apps', 'hosted', 'executor', 'bot'];
export const SURFACE_LABELS = { agents: 'Coding agents', 'mcp-apps': 'MCP apps', hosted: 'Hosted MCP', executor: 'Executor', bot: 'Chat bots' };
const SURFACE_ALIASES = { agent: 'agents', plugin: 'agents', skills: 'agents', mcp: 'mcp-apps', apps: 'mcp-apps', 'mcp-app': 'mcp-apps', remote: 'hosted', bots: 'bot' };
const DEFAULT_HOSTED_URL = 'https://mcp.forsvn.com/mcp';
const DOCS = 'https://github.com/forsvn-labs/conquistador#readme';
const TOTAL = 5;

// Old install flags. Each preselects a surface and prints one line about the new flag.
export const LEGACY = {
  '--mcp': { surfaces: ['mcp-apps'], notice: '--mcp is now --surface=mcp-apps. The old flag still works.' },
  '--plugin': { surfaces: ['agents'], scope: 'global', notice: '--plugin is now --surface=agents --scope=global. The old flag still works.' },
  '--skills': { surfaces: ['agents'], scope: 'project', notice: '--skills is now --surface=agents --scope=project. The old flag still works.' },
  '--bot': { surfaces: ['bot'], notice: '--bot is now --surface=bot. The old flag still works.' },
  '--advanced': { surfaces: null, notice: '--advanced now opens the one installer, the same as conquistador add.' },
};
// With any of these, an old flag keeps its old per-project route (tools/onboarding.mjs).
const LEGACY_ROUTE_OPTIONS = /^--(?:host|project|path|url|runtime-path|task|help|version)(?:=|$)|^-h$/;

// True when the arguments ask for the older per-project route, not the new installer.
export function legacyRoute(args) {
  const flags = args.filter(arg => Object.hasOwn(LEGACY, arg.split('=')[0]));
  if (!flags.length) return false;
  if (flags.length > 1 || args.some(arg => LEGACY_ROUTE_OPTIONS.test(arg)) || /^--bot=/.test(flags[0])) return true;
  const index = args.indexOf('--bot');
  return index >= 0 && args[index + 1] !== undefined && !args[index + 1].startsWith('-');
}

const list = (value, name, known, aliases = {}) => {
  const names = String(value ?? '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean).map(item => aliases[item] ?? item);
  if (!names.length) throw Error(`--${name} needs a value. Choose from: ${known.join(', ')}.`);
  const unknown = names.filter(item => !known.includes(item));
  if (unknown.length) throw Error(`Unknown ${name === 'surface' ? 'surface' : 'app'}: ${unknown.join(', ')}. Choose from: ${known.join(', ')}.`);
  return [...new Set(names)];
};

// Validate every flag before detecting anything, opening a UI, or writing state.
export function parseOnboard(args) {
  const options = { wanted: null, dryRun: false, noOpen: false, yes: false, task: '', providers: null, scope: null, hooks: true,
    surfaces: null, surfacesFrom: null, apps: null, json: false, plain: false, executorName: null, botOut: null, installer: false, notice: null };
  const words = [];
  let legacy = null;
  const value = (arg, name, index) => (arg === name ? args[index + 1] : arg.slice(name.length + 1));
  const valued = (arg, name) => arg === name || arg.startsWith(`${name}=`);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') { words.push(...args.slice(index + 1)); break; }
    if (valued(arg, '--in')) {
      if (options.wanted !== null) throw Error('Use --in only once.');
      const name = value(arg, '--in', index);
      if (arg === '--in') index += 1;
      if (!name || name.startsWith('-')) throw Error('--in requires an agent name. Example: --in codex');
      if (!agentId(name)) throw Error(`Unknown agent: ${name}. Choose from: ${AGENTS.map(agent => agent.id).join(', ')}.`);
      options.wanted = agentId(name);
    } else if (valued(arg, '--providers')) {
      if (options.providers !== null) throw Error('Use --providers only once.');
      const names = String(value(arg, '--providers', index) ?? '').split(',').map(item => item.trim()).filter(Boolean);
      if (arg === '--providers') index += 1;
      if (!names.length) throw Error('--providers needs agent names. Example: --providers=claude,codex');
      const invalid = names.filter(name => !agentId(name));
      if (invalid.length) throw Error(`Unknown agent: ${invalid.join(', ')}. Choose from: ${AGENTS.map(agent => agent.id).join(', ')}.`);
      options.providers = [...new Set(names.map(agentId))];
    } else if (valued(arg, '--scope')) {
      const scope = value(arg, '--scope', index);
      if (arg === '--scope') index += 1;
      options.scope = { project: 'project', local: 'project', repo: 'project', global: 'global', user: 'global', home: 'global' }[String(scope ?? '').trim().toLowerCase()] ?? null;
      if (!options.scope) throw Error(`Unknown scope: ${scope ?? ''}. Use --scope=project or --scope=global.`);
    } else if (valued(arg, '--surface')) {
      options.surfaces = list(value(arg, '--surface', index), 'surface', SURFACE_IDS, SURFACE_ALIASES);
      options.surfacesFrom = 'flag';
      if (arg === '--surface') index += 1;
    } else if (valued(arg, '--apps')) {
      options.apps = list(value(arg, '--apps', index), 'apps', MCP_APPS.map(app => app.id), { 'claude': 'claude-desktop', code: 'vscode', 'vs-code': 'vscode' });
      if (arg === '--apps') index += 1;
    } else if (valued(arg, '--executor-name')) {
      options.executorName = String(value(arg, '--executor-name', index) ?? '').trim();
      if (arg === '--executor-name') index += 1;
      if (!options.executorName || options.executorName.startsWith('-')) throw Error('--executor-name needs a name. Example: --executor-name=conquistador');
    } else if (valued(arg, '--bot-out')) {
      options.botOut = String(value(arg, '--bot-out', index) ?? '').trim();
      if (arg === '--bot-out') index += 1;
      if (!options.botOut || options.botOut.startsWith('-')) throw Error('--bot-out needs a folder. Example: --bot-out=./conquistador-bot');
    } else if (Object.hasOwn(LEGACY, arg)) legacy = LEGACY[arg];
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--no-open') options.noOpen = true;
    else if (arg === '--no-hooks') options.hooks = false;
    else if (arg === '--yes' || arg === '-y') options.yes = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--plain') options.plain = true;
    else if (arg.startsWith('-')) throw Error(`Unknown start option: ${arg}. Use conquistador help --all.`);
    else words.push(arg);
  }
  if (legacy) {
    options.installer = true;
    options.notice = legacy.notice;
    if (!options.surfaces && legacy.surfaces) { options.surfaces = [...legacy.surfaces]; options.surfacesFrom = 'legacy'; }
    options.scope ??= legacy.scope ?? null;
  }
  if (!options.surfaces) {
    // Answers given by flags imply their surface, so the surfaces question is skipped.
    const implied = [...(options.providers ? ['agents'] : []), ...(options.apps ? ['mcp-apps'] : []), ...(options.executorName ? ['executor'] : []), ...(options.botOut ? ['bot'] : [])];
    if (implied.length) { options.surfaces = implied; options.surfacesFrom = 'implied'; }
  }
  options.task = words.join(' ').trim();
  return options;
}

const realHome = () => { try { return realpathSync(homedir()); } catch { return homedir(); } };
const tilde = path => {
  if (typeof path !== 'string') return path;
  for (const base of [homedir(), realHome()]) if (path === base || path.startsWith(`${base}/`) || path.startsWith(`${base}\\`)) return `~${path.slice(base.length)}`;
  return path;
};
// The local MCP server every MCP app and Executor runs: this Node and the stable plugin copy.
export const localServer = () => ({ command: process.execPath, args: [join(pluginHome(), 'mcp', 'server.mjs')] });

// tools/login.mjs comes from the hosted sign-up work. The surface exists only when it does.
async function loadLogin() {
  try {
    const module = await import('./login.mjs');
    return typeof module.runLogin === 'function' ? module : null;
  } catch { return null; }
}
const hostedUrl = login => process.env.CONQUISTADOR_HOSTED_URL || login?.HOSTED_URL || DEFAULT_HOSTED_URL;

// What is on this computer. Previews run no agent command; Executor gets read-only status calls.
export async function detect({ cwd = process.cwd(), probe = true } = {}) {
  const root = projectRoot(cwd);
  const state = readState();
  const agents = detectAgents();
  const login = await loadLogin();
  const online = login && probe ? await reachable(hostedUrl(login)) : null;
  const project = projectFolders(root).filter(folder => existsSync(join(folder.path, OWNED)));
  return { cwd, root, state, agents, apps: detectApps(), executor: executorStatus(), login, online, project,
    found: agents.filter(agent => agent.found && !(state.removed ?? []).includes(agent.id)) };
}

// Apps that already get the MCP server from the plugin are left out (never two surfaces per app).
function duplicateApps(choices, ctx) {
  const pluginAgents = new Set([...(choices.surfaces.includes('agents') && choices.scope === 'global' ? choices.agents : []), ...Object.keys(ctx.state.agents ?? {})]);
  return MCP_APPS.filter(app => app.agent && pluginAgents.has(app.agent)).map(app => app.id);
}
const dedupeNote = id => `${appById(id).label} gets the plugin, which includes the MCP server. It is not configured twice.`;

// Answers from flags and detection. Interactive questions start from these.
export function defaultChoices(options, ctx, { interactive = false } = {}) {
  const agents = options.providers ?? (options.wanted ? [options.wanted] : ctx.found.map(agent => agent.id));
  const scope = options.scope ?? (ctx.project.length ? 'project' : 'global');
  let surfaces = options.surfaces;
  if (!surfaces) {
    if (!interactive) surfaces = ['agents'];
    else {
      const appsFound = ctx.apps.filter(app => app.found && !duplicateApps({ surfaces: ['agents'], scope, agents }, ctx).includes(app.id));
      surfaces = [...(agents.length ? ['agents'] : []), ...(appsFound.length ? ['mcp-apps'] : []), ...(ctx.executor.installed ? ['executor'] : [])];
    }
  }
  const choices = { surfaces, agents, scope, hooks: options.hooks, apps: [], executorName: options.executorName ?? 'conquistador', botOut: resolve(ctx.cwd, options.botOut ?? 'conquistador-bot') };
  const skip = duplicateApps(choices, ctx);
  choices.apps = options.apps ?? ctx.apps.filter(app => app.found && !skip.includes(app.id)).map(app => app.id);
  return choices;
}

// --- The plan ------------------------------------------------------------------------------------
const stepCommands = (agent, action) => agent[action === 'update' ? 'update' : 'install'](tilde(pluginHome()))
  .map(item => (item.copy ? `copy plugin to ${tilde(item.copy())}` : item.skill ? `copy skill to ${tilde(item.skill())}` : `${item.command} ${item.args.join(' ')}`));

export function buildPlan(choices, ctx) {
  const surfaces = [];
  const warnings = [];
  const chosen = AGENTS.filter(agent => choices.agents.includes(agent.id));
  if (choices.surfaces.includes('agents')) {
    const steps = [];
    if (choices.scope === 'project') {
      for (const folder of projectFolders(ctx.root, chosen)) {
        const exists = existsSync(join(folder.path, OWNED));
        steps.push({ agents: folder.agents.map(agent => agent.id), label: folder.agents.map(agent => agent.label).join(', '), action: !exists ? 'install' : skillCurrent(folder.path) ? 'reinstall' : 'update',
          commands: [`copy skill to ${tilde(folder.path)}`] });
      }
    } else {
      const found = new Set(ctx.agents.filter(agent => agent.found).map(agent => agent.id));
      for (const agent of chosen) {
        const recorded = ctx.state.agents?.[agent.id]?.version;
        if (agent.how !== 'skill' && agent.id !== 'cursor' && !found.has(agent.id)) {
          steps.push({ agent: agent.id, label: agent.label, action: 'blocked', reason: `${agent.command} is not on PATH. Install ${agent.label} first, or choose the project scope.` });
          continue;
        }
        const action = !recorded ? 'install' : recorded !== version ? 'update' : 'reinstall';
        steps.push({ agent: agent.id, label: agent.label, action, ...(action === 'update' ? { from: recorded } : {}), commands: stepCommands(agent, action) });
      }
    }
    // Two copies for one agent: the global plugin and a project skill folder (F5).
    for (const agent of chosen) {
      const folder = ctx.project.find(item => item.agents.includes(agent));
      const global = ctx.state.agents?.[agent.id] || choices.scope === 'global';
      if (folder && global && agent.how !== 'skill') warnings.push(`${agent.label} loads both the global plugin and the project copy in ./${relative(ctx.root, folder.path)}. Keep one: ${self} remove --scope=project`);
    }
    const plugins = chosen.some(agent => agent.how !== 'skill') && choices.scope === 'global';
    surfaces.push({ id: 'agents', label: SURFACE_LABELS.agents, scope: choices.scope, hooks: plugins ? choices.hooks : null, steps,
      notes: chosen.some(agent => agent.id === 'grok') && choices.scope === 'global' ? ['Grok installation trusts the bundled plugin scripts (--trust).'] : [] });
  }
  if (choices.surfaces.includes('mcp-apps')) {
    const skip = duplicateApps(choices, ctx);
    const server = localServer();
    const steps = choices.apps.map(id => {
      if (skip.includes(id)) return { app: id, label: appById(id).label, action: 'skip', reason: dedupeNote(id) };
      const inspected = inspectApp(id, server);
      return { app: id, label: appById(id).label, action: inspected.action, target: inspected.path, ...(inspected.reason ? { reason: inspected.reason } : {}) };
    });
    surfaces.push({ id: 'mcp-apps', label: SURFACE_LABELS['mcp-apps'], server: { command: server.command, args: server.args }, steps,
      notes: steps.length ? [] : [`No MCP app found. Name one: --apps=${MCP_APPS.map(app => app.id).join(',')}`] });
  }
  if (choices.surfaces.includes('hosted')) {
    surfaces.push({ id: 'hosted', label: SURFACE_LABELS.hosted, steps: ctx.login
      ? [{ action: 'sign-in', target: hostedUrl(ctx.login), detail: 'Sign in with GitHub in your browser. Conquistador then prints the client config.' }]
      : [{ action: 'blocked', reason: 'This version cannot sign in to Hosted MCP yet.' }], notes: [] });
  }
  if (choices.surfaces.includes('executor')) {
    const name = choices.executorName;
    const steps = !ctx.executor.installed
      ? [{ action: 'manual', reason: 'Executor is not installed. Install it (npm i -g executor), then run conquistador --surface=executor.' }]
      : [...(ctx.executor.running === false ? [{ action: 'start', detail: 'Executor is not running. This step starts it: executor daemon run' }] : []),
        { action: 'add', name, slug: slugFor(name), detail: `Add the source "${name}": executor call executor mcp addServer\n  Executor asks to approve it. Conquistador says yes for this one change.` }];
    surfaces.push({ id: 'executor', label: SURFACE_LABELS.executor, version: ctx.executor.version, steps, notes: [] });
  }
  if (choices.surfaces.includes('bot')) {
    surfaces.push({ id: 'bot', label: SURFACE_LABELS.bot, steps: [{ action: existsSync(choices.botOut) ? 'update' : 'write', target: choices.botOut, detail: 'SYSTEM-PROMPT.md, knowledge files, and README.md with steps for each chat app' }], notes: [] });
  }
  return {
    version, root: ctx.root, scope: choices.scope, surfaces, warnings,
    unchanged: ['Your project files' + (choices.surfaces.includes('agents') && choices.scope === 'project' ? ', except the skill folders above' : ''),
      'Other MCP servers and settings in each app config', 'Agent settings outside the Conquistador plugin', 'Personal playbooks and config in ~/.conquistador'],
    undo: `${self} remove`,
  };
}

const sortKeys = value => (Array.isArray(value) ? value.map(sortKeys) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys(value[key])])) : value);
const tildeAll = (value, base) => (typeof value === 'string' ? value.split(base).join('~') : Array.isArray(value) ? value.map(item => tildeAll(item, base))
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, tildeAll(item, base)])) : value);

// The plan as stable JSON: sorted keys, ~ for the home folder, no timestamps.
export function planJson(plan, { home: base = homedir() } = {}) {
  return `${JSON.stringify(sortKeys({ schema: 'conquistador.onboarding-plan/v1', ...tildeAll(plan, base) }), null, 2)}\n`;
}

const ACTION_TEXT = { install: 'install', reinstall: 'already installed; reinstall and check', update: 'update', add: 'add the server entry', unchanged: 'already set; no change',
  manual: 'add by hand', skip: 'skip', blocked: 'cannot install', write: 'write files', 'sign-in': 'sign in with GitHub', start: 'start Executor' };

// The plan as text lines: the review card in a terminal, the preview without one.
export function planLines(plan) {
  const lines = [];
  for (const surface of plan.surfaces) {
    const how = surface.id === 'agents' ? ` (${surface.scope === 'global' ? 'all projects' : 'this project only'}${surface.hooks === null ? '' : `, hooks ${surface.hooks ? 'on' : 'off'}`})` : '';
    lines.push(`${surface.label}${how}`);
    for (const step of surface.steps) {
      if (surface.id === 'agents') {
        lines.push(`  ${step.label}: ${ACTION_TEXT[step.action]}${step.from ? ` from ${step.from} to ${plan.version}` : ''}`);
        for (const command of step.commands ?? []) lines.push(`    ${command}`);
      } else if (surface.id === 'mcp-apps') {
        lines.push(`  ${step.label}: ${ACTION_TEXT[step.action]}${['add', 'update'].includes(step.action) && existsSync(step.target) ? ' (backup first)' : ''}`);
        if (step.target && step.action !== 'skip') lines.push(`    ${tilde(step.target)}`);
      } else if (surface.id === 'bot') lines.push(`  ${ACTION_TEXT[step.action]} to ${tilde(step.target)}: ${step.detail}`);
      else lines.push(`  ${step.detail ?? ACTION_TEXT[step.action]}`);
      if (step.reason) lines.push(`    ${step.reason}`);
    }
    for (const note of surface.notes) lines.push(`  ${note}`);
  }
  if (plan.warnings.length) lines.push('', 'Warning', ...plan.warnings.map(item => `  ${item}`));
  lines.push('', `Unchanged: ${plan.unchanged.join('; ')}.`, `Undo: ${plan.undo}`);
  return lines;
}

// --- Install and verify ----------------------------------------------------------------------------
const retryFor = (surface, step, plan) => (surface === 'agents' ? `${self} --providers=${step.agent ?? step.agents?.join(',')} --scope=${plan.scope} -y`
  : surface === 'mcp-apps' ? `${self} --surface=mcp-apps --apps=${step.app} -y` : `${self} --surface=${surface} -y`);

// Run every step. A failed surface never stops the others (F7). `progress` draws one line per step.
export async function applyPlan(plan, choices, { ui, progress, login }) {
  const results = [];
  const record = item => { results.push(item); return item; };
  const agents = plan.surfaces.find(surface => surface.id === 'agents');
  const needsPayload = plan.surfaces.some(surface => ['mcp-apps', 'executor'].includes(surface.id));
  const runnable = agents?.steps.filter(step => step.action !== 'blocked') ?? [];
  for (const step of agents?.steps.filter(item => item.action === 'blocked') ?? []) record({ surface: 'agents', label: step.label, ok: false, error: step.reason, agent: step.agent });
  if (runnable.length || needsPayload) {
    const targets = AGENTS.filter(agent => runnable.some(step => step.agent === agent.id || step.agents?.includes(agent.id)));
    const error = stageTargets(targets, { scope: plan.scope, plugin: needsPayload && !payloadCurrent(pluginHome()) });
    if (error) {
      for (const step of runnable) record({ surface: 'agents', label: step.label, ok: false, error: `${error} Nothing installed.`, agent: step.agent });
      return results.concat(plan.surfaces.filter(surface => surface.id !== 'agents').map(surface => ({ surface: surface.id, label: surface.label, ok: false, error })));
    }
    // --no-hooks is always recorded, as before; turning hooks back on applies where a plugin installs.
    if (agents && !choices.hooks) setHooks(false);
    else if (agents && targets.some(agent => agent.how !== 'skill') && plan.scope === 'global') setHooks(true);
    const done = new Set();
    for (const step of runnable) {
      const agent = AGENTS.find(item => item.id === (step.agent ?? step.agents[0]));
      const result = await progress(step.label, () => installOne(agent, { scope: plan.scope, root: plan.root, done }));
      record({ surface: 'agents', label: step.label, agent: agent.id, agents: step.agents, ok: result.ok, error: result.error, retry: result.ok ? null : retryFor('agents', step, plan) });
    }
  }
  const apps = plan.surfaces.find(surface => surface.id === 'mcp-apps');
  for (const step of apps?.steps ?? []) {
    if (step.action === 'skip') { record({ surface: 'mcp-apps', label: step.label, app: step.app, ok: true, skipped: true, note: step.reason }); continue; }
    const result = await progress(step.label, () => applyApp(step.app, apps.server));
    if (result.ok) {
      const state = readState();
      writeState({ ...state, mcpApps: { ...(state.mcpApps ?? {}), [step.app]: { path: result.path, version, at: new Date().toISOString() } } });
    }
    record({ surface: 'mcp-apps', label: step.label, app: step.app, ok: result.ok, manual: result.manual, error: result.error, backup: result.backup, retry: result.ok || result.manual ? null : retryFor('mcp-apps', step, plan) });
  }
  const executor = plan.surfaces.find(surface => surface.id === 'executor');
  if (executor) {
    const add = executor.steps.find(step => step.action === 'add');
    if (!add) record({ surface: 'executor', label: 'Executor', ok: false, manual: true, error: executor.steps[0].reason });
    else {
      const server = localServer();
      const result = await progress('Executor', () => registerSource(add.name, server, { start: executor.steps.some(step => step.action === 'start') }));
      if (result.ok) writeState({ ...readState(), executor: { slug: add.slug, name: add.name, version, at: new Date().toISOString() } });
      record({ surface: 'executor', label: 'Executor', ok: result.ok, manual: result.status === 'manual', slug: add.slug, status: result.status,
        error: result.status === 'manual' ? `${result.error}\n${manualSteps(add.name, server).join('\n')}` : result.error, retry: result.ok || result.status === 'manual' ? null : retryFor('executor') });
    }
  }
  const hosted = plan.surfaces.find(surface => surface.id === 'hosted');
  if (hosted) {
    if (!login) record({ surface: 'hosted', label: 'Hosted MCP', ok: false, error: hosted.steps[0].reason });
    else {
      let signedIn = null, error = null;
      try { signedIn = await login.runLogin({ ui }); } catch (failure) { error = failure.message; }
      if (signedIn?.token) record({ surface: 'hosted', label: 'Hosted MCP', ok: true, login: signedIn.login, token: signedIn.token, url: hosted.steps[0].target });
      else record({ surface: 'hosted', label: 'Hosted MCP', ok: false, skipped: !error, error: error ?? `Sign-in skipped. Try again: ${self} --surface=hosted` });
    }
  }
  const bot = plan.surfaces.find(surface => surface.id === 'bot');
  if (bot) {
    const target = bot.steps[0].target;
    const result = await progress('Chat bots', async () => {
      try { const { buildBotPack } = await import('./bot-pack.mjs'); const pack = buildBotPack(target, { includeUser: true }); return { ok: true, files: pack.files.length }; } catch (failure) { return { ok: false, error: failure.message }; }
    });
    record({ surface: 'bot', label: 'Chat bots', ok: result.ok, error: result.error, target, files: result.files, retry: result.ok ? null : `${self} bot --out ${target}` });
  }
  return results;
}

// One MCP handshake with the local server: initialize, then tools/list. True when the brief tool is listed.
export function handshake(server, timeout = 15_000) {
  return new Promise(done => {
    let child;
    try { child = spawn(server.command, server.args, { stdio: ['pipe', 'pipe', 'ignore'] }); } catch { done(false); return; }
    let buffer = '';
    let settled = false;
    const finish = value => { if (settled) return; settled = true; clearTimeout(timer); child.kill(); done(value); };
    const timer = setTimeout(() => finish(false), timeout);
    child.on('error', () => finish(false));
    // A server that exits before it answers fails at once, not after the timeout.
    child.on('exit', () => finish(false));
    child.stdout.on('data', chunk => {
      buffer += chunk;
      for (let index = buffer.indexOf('\n'); index >= 0; index = buffer.indexOf('\n')) {
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
        try {
          const message = JSON.parse(line);
          if (message.id === 1) child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`);
          if (message.id === 2) finish(Boolean(message.result?.tools?.some(tool => tool.name === 'conquistador_brief')));
        } catch { /* Not a protocol line. */ }
      }
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'conquistador-verify', version } } })}\n`);
  });
}

// The verify pass: the doctor checks for each installed surface (F8).
export async function verifyResults(results, plan, { progress }) {
  const checks = [];
  const add = (label, ok, detail, fix = null) => checks.push({ label, ok, detail, fix });
  for (const result of results.filter(item => item.ok && !item.skipped)) {
    if (result.surface === 'agents') {
      if (plan.scope === 'project') {
        for (const folder of projectFolders(plan.root, AGENTS.filter(agent => (result.agents ?? [result.agent]).includes(agent.id)))) {
          const ok = skillCurrent(folder.path);
          add(result.label, ok, ok ? 'project skill copy is complete' : `skill copy ${tilde(folder.path)} is damaged`, ok ? null : `${self} doctor --fix`);
        }
        continue;
      }
      const agent = AGENTS.find(item => item.id === result.agent);
      const outcome = await progress(`Checking ${agent.label}`, () => {
        const registered = agent.installed(), healthy = agent.healthy?.() ?? true;
        return { registered, healthy };
      }, { quiet: true });
      const ok = outcome.registered && outcome.healthy && (agent.how === 'skill' || payloadCurrent(pluginHome()));
      add(agent.label, ok, ok ? (agent.how === 'skill' ? 'skill copy is complete' : 'plugin is registered') : !outcome.registered ? 'not registered with the agent' : 'installed files are damaged', ok ? null : `${self} doctor --fix`);
      continue;
    }
    if (result.surface === 'mcp-apps') {
      const check = checkApp(result.app, localServer());
      add(result.label, check.ok, check.ok ? 'server entry is current' : check.detail, check.ok ? null : retryFor('mcp-apps', result, plan));
      continue;
    }
    if (result.surface === 'executor') {
      const check = await progress('Checking Executor', () => checkSource(result.slug), { quiet: true });
      add('Executor', check.ok, check.detail, check.ok ? null : retryFor('executor'));
      continue;
    }
    if (result.surface === 'bot') add('Chat bots', existsSync(join(result.target, 'SYSTEM-PROMPT.md')), `${result.files} knowledge files in ${tilde(result.target)}`);
    if (result.surface === 'hosted') add('Hosted MCP', true, `signed in as ${result.login}`);
  }
  if (results.some(item => item.ok && item.surface === 'mcp-apps' && !item.skipped) || results.some(item => item.ok && item.surface === 'executor')) {
    const ok = await progress('Checking the MCP server', () => handshake(localServer()), { quiet: true });
    add('MCP server', ok, ok ? 'answers and lists its tools' : 'did not answer an MCP handshake', ok ? null : `${self} doctor --fix`);
  }
  return checks;
}

// --- Summary -----------------------------------------------------------------------------------------
export function summaryLines({ results, checks, plan, notice, p }) {
  const lines = [];
  const failedChecks = new Set(checks.filter(item => !item.ok).map(item => item.label));
  const done = results.filter(item => item.ok && !item.skipped && !failedChecks.has(item.label));
  const failed = results.filter(item => !item.ok);
  const badChecks = checks.filter(item => !item.ok);
  if (done.length) {
    lines.push(p.bold('Installed'));
    for (const item of done) {
      const where = item.surface === 'agents' ? (plan.scope === 'global' ? 'all projects' : 'this project') : item.surface === 'mcp-apps' ? 'local MCP server'
        : item.surface === 'executor' ? `source "${item.slug}"` : item.surface === 'bot' ? tilde(item.target) : `signed in as ${item.login}`;
      lines.push(`  ${p.ok('✓')} ${item.label}: ${where}`);
    }
  }
  for (const item of results.filter(entry => entry.skipped && entry.note)) lines.push(`  ${p.dim('-')} ${item.note}`);
  if (failed.length || badChecks.length) {
    lines.push('', p.bold('Needs attention'));
    for (const item of failed) {
      lines.push(`  ${item.skipped ? p.warn('!') : p.bad('✗')} ${item.label}: ${item.skipped ? 'skipped. ' : ''}${item.error ?? 'failed'}`);
      if (item.retry) lines.push(`    Retry: ${item.retry}`);
    }
    for (const check of badChecks) lines.push(`  ${p.bad('✗')} ${check.label}: ${check.detail}`, ...(check.fix ? [`    Fix: ${check.fix}`] : []));
  }
  for (const warning of plan.warnings) lines.push('', `${p.warn('!')} ${warning}`);
  const hosted = results.find(item => item.surface === 'hosted' && item.ok);
  if (hosted) {
    lines.push('', p.bold('Hosted MCP client config'), 'Add this to your remote app or deployed agent. The token is secret: do not commit or share it.',
      JSON.stringify({ mcpServers: { conquistador: { type: 'http', url: hosted.url, headers: { Authorization: `Bearer ${hosted.token}` } } } }, null, 2));
  }
  const agents = done.some(item => item.surface === 'agents');
  lines.push('', p.bold('Next'));
  if (agents) lines.push(`  /conquistador          in your agent`);
  lines.push(`  ${self} doctor    check every install`, `  ${self} update    get the newest version`, `  ${self} remove    undo all of this`, `  Docs: ${DOCS}`);
  if (notice) lines.push('', `${p.warn('!')} ${notice}`);
  return lines;
}

// --- The terminal flow -------------------------------------------------------------------------------
const PREFLIGHT_TITLE = 'Before you start';

function preflightNotes(update) {
  const notes = [];
  const problem = shadowProblem({ self: { root: realpathSync(productRoot), version } });
  if (problem) notes.push([problem.message, ...problem.fix].join('\n'));
  const notice = updateNotice(update.cached, version, channel().kind);
  if (notice) notes.push(notice);
  return notes;
}

// Ask, or return the cancel symbol. Clack and the plain UI share this API.
async function ask(ui, kind, options) { return ui[kind](options); }

// The interactive installer. Returns { code } or { code, launch } (the caller opens the agent).
export async function runInstaller(options, { cwd = process.cwd(), ui, width, interactive = true, updateCheck = true } = {}) {
  const p = paint(options.plain ? 'none' : undefined);
  const cols = () => Math.max(40, Math.min(width?.() ?? process.stdout.columns ?? 80, 100));
  const wrap = text => wrapText(text, cols() - 6);
  const update = updateCheck ? startUpdateCheck({ file: join(home(), 'update-check.json') }) : { cached: null, latest: async () => null, persist() {} };
  const cancelled = () => { ui.cancel('Cancelled. No files changed.'); return { code: 130 }; };

  // 0-1. Preflight and welcome.
  ui.intro(wordmark(p, version));
  ui.log.message(wrap('Growth, marketing, and sales playbooks for your AI agents.\nAbout a minute. Nothing changes until you confirm.'));
  for (const note of preflightNotes(update)) ui.log.warn(wrap(note));
  const ctx = await detect({ cwd });
  const choices = defaultChoices(options, ctx, { interactive: true });

  // 2. Surfaces.
  if (options.surfacesFrom !== 'flag' && options.surfacesFrom !== 'implied') {
    const found = [
      ['Agents', ctx.found.map(agent => agent.label).join(', ') || 'none found'],
      ['MCP apps', ctx.apps.filter(app => app.found).map(app => app.label).join(', ') || 'none found'],
      ['Executor', ctx.executor.installed ? `${ctx.executor.version ?? 'found'}${ctx.executor.running ? ', running' : ', not running'}` : 'not installed'],
    ];
    ui.log.message(wrap(`Found on this computer\n${found.map(([name, value]) => `  ${name.padEnd(9)} ${value}`).join('\n')}`));
    if (!ctx.found.length) ui.log.warn(wrap('No coding agent found on PATH or in your home folder.'));
    if (ctx.login && ctx.online === false) ui.log.warn(wrap('Hosted MCP needs a network connection. It is not offered now.'));
    const surfaceOptions = [
      { value: 'agents', label: 'Coding agents', hint: ctx.found.length ? 'recommended; plugin or skill in each agent' : 'No coding agent found' },
      { value: 'mcp-apps', label: 'MCP apps', hint: 'local server in Claude Desktop, VS Code, Zed, and more' },
      ...(ctx.login && ctx.online !== false ? [{ value: 'hosted', label: 'Hosted MCP', hint: 'deployed agents and remote apps; sign in with GitHub' }] : []),
      { value: 'executor', label: 'Executor', hint: 'one source for every Executor-connected agent' },
      { value: 'bot', label: 'Chat bots', hint: 'prompt and files for GPTs, Claude Projects, Gems' },
    ];
    const picked = await ask(ui, 'multiselect', { message: `${stepLabel(p, 1, TOTAL)}Where do you want Conquistador?`, options: surfaceOptions,
      initialValues: choices.surfaces.filter(id => surfaceOptions.some(item => item.value === id)), required: true });
    if (ui.isCancel(picked)) return cancelled();
    choices.surfaces = SURFACE_IDS.filter(id => picked.includes(id));
  }

  // 3. Details for each chosen surface.
  // Step 2 can hold several questions; only the first one shows the step counter.
  let stepShown = false;
  const detail = () => { if (stepShown) return ''; stepShown = true; return stepLabel(p, 2, TOTAL); };
  if (choices.surfaces.includes('agents')) {
    if (!options.providers && !options.wanted) {
      const ids = await ask(ui, 'multiselect', { message: `${detail()}Which agents?`, required: true, initialValues: choices.agents,
        options: AGENTS.map(agent => { const found = ctx.agents.find(item => item.id === agent.id)?.found; return { value: agent.id, label: agent.label, hint: `${agent.how === 'skill' ? 'skill copy' : 'plugin'}${found ? '' : '; not found'}` }; }) });
      if (ui.isCancel(ids)) return cancelled();
      choices.agents = AGENTS.filter(agent => ids.includes(agent.id)).map(agent => agent.id);
    }
    if (!options.scope) {
      const scope = await ask(ui, 'select', { message: `${detail()}All projects, or only this one?`, initialValue: choices.scope, options: [
        { value: 'global', label: 'All projects', hint: 'plugin with hooks and the MCP server where the agent has one' },
        { value: 'project', label: 'Only this project', hint: 'one skill folder you can commit' },
      ] });
      if (ui.isCancel(scope)) return cancelled();
      choices.scope = scope;
    }
    const plugins = AGENTS.some(agent => choices.agents.includes(agent.id) && agent.how !== 'skill');
    if (plugins && choices.scope === 'global' && options.hooks && !options.yes) {
      ui.log.message(wrap('Prompt hooks give the agent the playbooks to read for growth, marketing, and sales prompts. Turn them off later with CONQUISTADOR_HOOKS=off.'));
      const hooks = await ask(ui, 'confirm', { message: `${detail()}Turn on prompt hooks?`, initialValue: true });
      if (ui.isCancel(hooks)) return cancelled();
      choices.hooks = hooks;
    }
  }
  if (choices.surfaces.includes('mcp-apps') && !options.apps) {
    const skip = duplicateApps(choices, ctx);
    for (const id of skip) if (ctx.apps.find(app => app.id === id)?.found) ui.log.message(wrap(dedupeNote(id)));
    const available = MCP_APPS.filter(app => !skip.includes(app.id));
    const apps = await ask(ui, 'multiselect', { message: `${detail()}Which MCP apps?`, required: true,
      initialValues: available.filter(app => ctx.apps.find(item => item.id === app.id)?.found).map(app => app.id),
      options: available.map(app => ({ value: app.id, label: app.label, hint: ctx.apps.find(item => item.id === app.id)?.found ? 'found' : 'not found' })) });
    if (ui.isCancel(apps)) return cancelled();
    choices.apps = apps;
  }
  if (choices.surfaces.includes('executor') && ctx.executor.installed && !options.executorName && !options.yes) {
    const name = await ask(ui, 'text', { message: `${detail()}Name for the source in Executor`, initialValue: choices.executorName, placeholder: 'conquistador' });
    if (ui.isCancel(name)) return cancelled();
    choices.executorName = String(name || 'conquistador').trim() || 'conquistador';
  }
  if (choices.surfaces.includes('bot') && !options.botOut && !options.yes) {
    const out = await ask(ui, 'text', { message: `${detail()}Folder for the bot files`, initialValue: `./${relative(ctx.cwd, choices.botOut) || '.'}`, placeholder: './conquistador-bot' });
    if (ui.isCancel(out)) return cancelled();
    choices.botOut = resolve(ctx.cwd, String(out || 'conquistador-bot').replace(/^~(?=$|[\\/])/, homedir()));
  }

  // 4. Review.
  const plan = buildPlan(choices, ctx);
  ui.note(wrap(planLines(plan).join('\n')), `${stepLabel(p, 3, TOTAL)}Review`);
  if (!options.yes) {
    const consent = await ask(ui, 'confirm', { message: 'Install now?', initialValue: true });
    if (ui.isCancel(consent) || !consent) return cancelled();
  }

  // 5. Install, then verify.
  ui.log.step(`${stepLabel(p, 4, TOTAL)}Installing`);
  const progress = async (label, work, { quiet = false } = {}) => {
    const spin = ui.spinner();
    spin.start(label);
    await new Promise(next => setTimeout(next, 20));
    const result = await work();
    const ok = result?.ok ?? (typeof result === 'boolean' ? result : true);
    if (quiet) spin.stop(label.replace(/^Checking /, 'Checked '), 0);
    else spin.stop(`${ok ? p.ok('✓') : result?.manual || result?.status === 'manual' ? p.warn('!') : p.bad('✗')} ${label}${ok ? '' : result?.manual || result?.status === 'manual' ? ': needs a step by hand' : ': failed'}`, ok ? 0 : 1);
    return result;
  };
  const results = await applyPlan(plan, choices, { ui, progress, login: ctx.login });
  const spin = ui.spinner();
  spin.start('Checking the installs');
  const checks = await verifyResults(results, plan, { progress: async (label, work) => { spin.message?.(label); await new Promise(next => setTimeout(next, 20)); return work(); } });
  const bad = checks.filter(check => !check.ok).length;
  spin.stop(bad ? `${p.bad('✗')} ${bad} of ${checks.length} ${checks.length === 1 ? 'check' : 'checks'} found a problem` : `${p.ok('✓')} ${checks.length} ${checks.length === 1 ? 'check' : 'checks'} passed`, bad ? 1 : 0);
  if (checks.length) ui.log.message(wrap(checks.map(check => `${check.ok ? p.ok('✓') : p.bad('✗')} ${check.label}: ${check.detail}${check.fix ? `\n    Fix: ${check.fix}` : ''}`).join('\n')));
  update.persist();
  const problems = results.some(item => !item.ok) || checks.some(item => !item.ok);
  const latest = await update.latest(1500);
  const finish = () => ui.note(wrap(summaryLines({ results, checks, plan, notice: updateNotice(latest, version, channel().kind), p }).join('\n')), 'Summary');

  // 6-7. Project setup and first task, with an agent that installed and passed its check.
  const failedChecks = new Set(checks.filter(item => !item.ok).map(item => item.label));
  const ready = AGENTS.filter(agent => results.some(item => item.surface === 'agents' && item.ok && (item.agent === agent.id || item.agents?.includes(agent.id))) && !failedChecks.has(agent.label)
    && ctx.agents.find(item => item.id === agent.id)?.found);
  return { code: problems ? 1 : 0, ready, finish, plan, results, checks, interactive };
}

// --- Without a terminal --------------------------------------------------------------------------------
export async function printPlan(options, { cwd = process.cwd(), launchLine = null } = {}) {
  const ctx = await detect({ cwd, probe: false });
  const choices = defaultChoices(options, ctx);
  const plan = buildPlan(choices, ctx);
  if (options.json) { process.stdout.write(planJson(plan)); return 0; }
  const width = Math.max(40, Math.min(process.stdout.columns || 80, 100));
  const problem = shadowProblem({ self: { root: realpathSync(productRoot), version } });
  if (problem) process.stderr.write(`${wrapText([problem.message, ...problem.fix].join('\n'), width)}\n`);
  const detected = ctx.found.map(agent => agent.label).join(', ') || 'no agent';
  const lines = [`${options.dryRun ? 'Dry run. ' : ''}Conquistador ${version} install plan`, `Detected: ${detected}. MCP apps: ${ctx.apps.filter(app => app.found).map(app => app.label).join(', ') || 'none'}. Executor: ${ctx.executor.installed ? `${ctx.executor.version ?? 'found'}${ctx.executor.running ? ', running' : ', not running'}` : 'not installed'}.`, '',
    'Plan:', ...planLines(plan)];
  if (launchLine) lines.push(...launchLine);
  const flags = [`--surface=${choices.surfaces.join(',')}`, ...(choices.surfaces.includes('agents') ? [`--providers=${choices.agents.join(',') || 'NAME'}`, `--scope=${choices.scope}`] : []),
    ...(choices.surfaces.includes('mcp-apps') && choices.apps.length ? [`--apps=${choices.apps.join(',')}`] : []), ...(choices.hooks ? [] : ['--no-hooks'])];
  lines.push('', `To install: ${self} ${flags.join(' ')} --yes`, 'No files changed, commands executed, or agent opened.');
  console.log(wrapText(lines.join('\n'), width));
  return options.dryRun ? 0 : 2;
}

// -y without a terminal: install, verify, and print the summary. Opens no agent.
export async function installWithoutTerminal(options, { cwd = process.cwd() } = {}) {
  const ui = plainUi();
  const p = paint('none');
  const ctx = await detect({ cwd });
  const choices = defaultChoices(options, ctx);
  if (choices.surfaces.includes('agents') && !choices.agents.length) { console.error(`No supported agent found. Name one: ${self} --providers=claude -y`); return 1; }
  const plan = buildPlan(choices, ctx);
  const problem = shadowProblem({ self: { root: realpathSync(productRoot), version } });
  if (problem) process.stderr.write(`${[problem.message, ...problem.fix].join('\n')}\n`);
  console.log(`Installing Conquistador ${version}\n${planLines(plan).join('\n')}\n`);
  const progress = async (label, work, { quiet = false } = {}) => {
    const result = await work();
    const ok = result?.ok ?? (typeof result === 'boolean' ? result : true);
    if (!quiet) console.log(`  ${ok ? '✓' : result?.manual || result?.status === 'manual' ? '!' : '✗'} ${label}`);
    return result;
  };
  const results = await applyPlan(plan, choices, { ui, progress, login: ctx.login });
  const checks = await verifyResults(results, plan, { progress });
  ui.close();
  const next = AGENTS.filter(agent => results.some(item => item.surface === 'agents' && item.ok && (item.agent === agent.id || item.agents?.includes(agent.id))));
  const lead = next.find(agent => agent.slash) ?? next[0];
  console.log(`\nSummary\n${summaryLines({ results, checks, plan, notice: null, p }).join('\n')}`);
  if (lead) {
    const { needsInit, initPrompt } = await import('./launch.mjs');
    console.log(`\nNext: start ${lead.label} and ${lead.slash ? 'type' : 'say'}: ${needsInit(cwd) ? initPrompt(lead) : lead.slash ? lead.slash.trim() : 'Use Conquistador.'}`);
  }
  return results.some(item => !item.ok) || checks.some(item => !item.ok) ? 1 : 0;
}
