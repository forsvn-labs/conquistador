import { isAbsolute } from 'node:path';
import { serviceUrl } from './install-paths.mjs';

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
    this.exitCode = 2;
  }
}

export const DEFAULT_HOSTS = ['codex', 'bb', 'cursor', 'copilot', 'claude-code', 'none'];
export const BOT_VALUES = ['grok-bot', 'hermes'];
export const PLUGIN_HOSTS = ['claude-code', 'codex', 'copilot', 'none'];
export const MCP_HOSTS = ['codex', 'claude-code', 'cursor', 'copilot', 'none'];
export const SKILLS_HOSTS = ['claude-code', 'cursor', 'copilot', 'codex'];
export const SKILLS_PIN = 'skills@1.5.26';
export const SKILLS_AGENTS = { 'claude-code': 'claude-code', cursor: 'cursor', copilot: 'github-copilot', codex: 'codex' };
export const PLUGIN_TARGETS = { 'claude-code': 'claude-plugin', codex: 'codex-plugin', copilot: 'copilot-plugin', none: 'agent-plugins' };
export const SHORTCUT_NAMES = ['bot', 'skills', 'plugin', 'mcp'];
const VALUE_FLAGS = new Set(['host', 'project', 'path', 'url', 'runtime-path']);
const BOOL_FLAGS = new Set(['skills', 'plugin', 'mcp', 'advanced', 'yes', 'dry-run', 'help', 'version']);
const ALIASES = { h: 'help' };

export const FIRST_PROMPT = 'Use Conquistador to draft a launch plan from the product facts in this project. Mark missing facts. Keep it as a draft.';

export function topHelp(version) {
  return `Conquistador ${version}

Usage:
  conquistador                       Set up the complete operator in this project
  conquistador --bot [grok-bot|hermes]
  conquistador --skills [--host HOST]
  conquistador --plugin [--host claude-code|codex|copilot|none]
  conquistador --mcp [--host codex|claude-code|cursor|copilot|none]
  conquistador --advanced            Combination guide for multiple hosts and custom packages
  conquistador operator status       Check the installed project operator

Route help: conquistador --skills --help
Detailed targets: conquistador setup list
Shared controls: --host, --project, --path, --dry-run, --yes
--path sets the staged source or connector folder for --skills, --plugin, and --mcp.
Noninteractive shortcuts need a resolved plan and --yes or --dry-run.
Without a terminal, conquistador prints this help and does not write files.

Also: conquistador start, skills, install, operator, setup, connections, jobs, version.`;
}

export function routeHelp(route) {
  if (route === 'bot') {
    return `Usage: conquistador --bot [grok-bot|hermes] [--project PATH] [--yes] [--dry-run]

Accepted values: grok-bot, hermes
Space or equals syntax: --bot hermes or --bot=hermes
With no value, choose exactly Grok Bot or Hermes Agent. A grok executable is not Grok Bot.

hermes prepares the complete operator plus .hermes/skills/conquistador in a Git project.
Trust is a separate host step: hermes skills trust <project>
Conquistador does not install Hermes, configure a model, start its gateway, or grant trust.

grok-bot prints the official Grok Bot app handoff. A private Conquistador installation in
Grok Bot has not been verified. No integration is activated.`;
  }
  if (route === 'skills') {
    return `Usage: conquistador --skills [--host HOST] [--project PATH] [--path PATH] [--yes] [--dry-run]

Accepted --host values: ${SKILLS_HOSTS.join(', ')}
Stages a transformed parent at PROJECT/.conquistador-skills-source, then runs the pinned
${SKILLS_PIN} local-source copier with --skill conquistador --copy --agent HOST.
That compact copy includes all methods and omits the BB adapter and portable schemas.
skills.sh owns the copied files and skills-lock.json. This is not a public skills.sh listing.`;
  }
  if (route === 'plugin') {
    return `Usage: conquistador --plugin [--host claude-code|codex|copilot|none] [--project PATH] [--path PATH] [--yes] [--dry-run]

Stages the complete native plugin source at PROJECT/.conquistador-plugin.
none means a generic Agent Plugins compatible source.
This prepares files and prints registration commands. It does not run a host manager.
Claude local scope is project-local. Codex and Copilot registration is user-level.`;
  }
  if (route === 'mcp') {
    return `Usage: conquistador --mcp [--host HOST] [--project PATH] [--path PATH] [--url ORIGIN] [--runtime-path ABS] [--yes] [--dry-run]

Accepted --host values: ${MCP_HOSTS.join(', ')}
Local stdio connector: PROJECT/.conquistador-mcp
--url ORIGIN selects the runtime connector at PROJECT/.conquistador-runtime-mcp
Local MCP reads methods; the host executes them. Runtime MCP runs supported playbooks only.
Does not start a service, edit host settings, or install Executor.
conquistador mcp still starts the stdio protocol server and never opens setup.`;
  }
  return `Usage: conquistador --advanced [--project PATH]

Opens the combination guide for multiple hosts, plugins, harnesses, squads,
specialist-only packages, both MCP modes, and experimental guidance.
Shortcut families are mutually exclusive; use this guide to combine them.`;
}

export function parseOnboarding(args) {
  const options = { route: 'default' };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const raw = args[i];
    if (!raw.startsWith('-') || raw === '-' || raw === '--') {
      throw new UsageError(`Unexpected argument: ${raw}. Do not mix route flags with commands. Use conquistador --advanced to combine installation families.`);
    }
    let name;
    let value;
    let hadEquals = false;
    if (raw.startsWith('--')) {
      const eq = raw.indexOf('=');
      if (eq >= 0) {
        name = raw.slice(2, eq);
        value = raw.slice(eq + 1);
        hadEquals = true;
      } else name = raw.slice(2);
    } else {
      if (raw.length !== 2 || !ALIASES[raw.slice(1)]) throw new UsageError(`Unknown option: ${raw}.`);
      name = ALIASES[raw.slice(1)];
    }
    if (seen.has(name)) throw new UsageError(`Repeated option: --${name}.`);
    seen.add(name);
    if (BOOL_FLAGS.has(name)) {
      if (hadEquals) throw new UsageError(`--${name} does not take a value.`);
      options[name] = true;
      continue;
    }
    if (name === 'bot' || VALUE_FLAGS.has(name)) {
      if (!hadEquals) {
        const next = args[i + 1];
        if (name === 'bot' && (next === undefined || next.startsWith('-'))) {
          options.bot = null;
          continue;
        }
        if (next === undefined || next.startsWith('-')) throw new UsageError(`--${name} needs a value.`);
        value = next;
        i += 1;
      }
      if (value === undefined || value === '' || String(value).startsWith('--')) throw new UsageError(`--${name} needs a value.`);
      options[name] = value;
      continue;
    }
    throw new UsageError(`Unknown option: --${name}.`);
  }

  const selected = SHORTCUT_NAMES.filter(name => name === 'bot' ? Object.hasOwn(options, 'bot') : options[name]);
  if (selected.length > 1) throw new UsageError('The --bot, --skills, --plugin, and --mcp routes are mutually exclusive. Use conquistador --advanced to combine installation families.');
  if (options.advanced && selected.length) throw new UsageError('Do not mix --advanced with --bot, --skills, --plugin, or --mcp.');
  if (options.advanced && (options.yes || options['dry-run'] || options.host || options.path || options.url || options['runtime-path'])) {
    throw new UsageError('--advanced opens the combination guide. It accepts only --project.');
  }
  if (options.version && Object.keys(options).some(key => !['version', 'help', 'route'].includes(key))) {
    throw new UsageError('conquistador --version accepts no other options.');
  }

  options.route = options.advanced ? 'advanced' : selected[0] ?? 'default';
  if (options.path && !['skills', 'plugin', 'mcp'].includes(options.route)) {
    throw new UsageError('--path applies to --skills, --plugin, and --mcp. Complete-operator paths stay on conquistador setup install --path.');
  }
  if (options.url && options.route !== 'mcp') throw new UsageError('--url requires conquistador --mcp.');
  if (options['runtime-path'] && options.route !== 'mcp') throw new UsageError('--runtime-path requires conquistador --mcp.');
  if (options.route === 'mcp' && options['runtime-path'] && !options.url) throw new UsageError('--runtime-path needs a runtime MCP connector with --url.');
  if (Object.hasOwn(options, 'bot') && options.bot !== null && !BOT_VALUES.includes(options.bot)) {
    throw new UsageError('Use --bot grok-bot or --bot hermes. With no value, those two choices are listed.');
  }
  if (options.url) {
    try { options.url = serviceUrl(options.url); } catch (error) { throw new UsageError(error.message); }
  }
  if (options['runtime-path'] && !isAbsolute(options['runtime-path'])) throw new UsageError('--runtime-path needs an absolute distribution path.');
  for (const name of ['project', 'path', 'runtime-path']) {
    if (options[name] && /[\x00-\x1f\x7f]/.test(options[name])) throw new UsageError(`--${name} must not contain control characters.`);
  }
  if (options.host) validateHost(options.route, options.host);
  if (options.route === 'bot' && options.host) throw new UsageError('Choose the bot with --bot. Do not pass --host.');
  return options;
}

function validateHost(route, host) {
  const allowed = route === 'skills' ? SKILLS_HOSTS : route === 'plugin' ? PLUGIN_HOSTS : route === 'mcp' ? MCP_HOSTS : DEFAULT_HOSTS;
  if (!allowed.includes(host)) throw new UsageError(`Unknown host: ${host}. Accepted: ${allowed.join(', ')}.`);
}

export function requireNoninteractivePlan(options, tty) {
  if (tty || options.help || options.version) return;
  if (options.route === 'advanced') throw new UsageError('Interactive setup requires a terminal. Use conquistador --help.');
  if (options.route === 'default' && !options.yes && !options['dry-run'] && !options.host) return;
  if (!options.yes && !options['dry-run']) {
    throw new UsageError('Noninteractive shortcuts need a resolved plan and either --yes or --dry-run.');
  }
}
