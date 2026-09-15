import { existsSync, lstatSync, mkdirSync, readFileSync, readSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { advisory, readConfig } from './proactive.mjs';

export const MODE_SCHEMA_VERSION = 'conquistador.mode/v1';
export const SUPPORTED_HOST = 'claude-code';
export const HOST_EVENTS = Object.freeze({
  'session-start': 'SessionStart',
  'before-delivery': 'Stop',
  'results-updated': 'TaskCompleted',
});
export const HOST_EVIDENCE = Object.freeze({
  host: SUPPORTED_HOST,
  source: 'https://code.claude.com/docs/en/hooks',
  mapping: HOST_EVENTS,
  nativeActivationVerified: false,
  executorVerified: false,
});
const MARKER = 'conquistador-mode.mjs';
const EVENTS = Object.keys(HOST_EVENTS);
const fail = message => { throw new Error(message); };
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const script = fileURLToPath(import.meta.url);
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;

export function hostSupport(host) {
  if (host === SUPPORTED_HOST) {
    return { supported: true, host, ...HOST_EVIDENCE };
  }
  return {
    supported: false,
    host,
    nativeActivationVerified: false,
    explanation: host === 'grok-bot' || host === 'eve'
      ? 'Experimental import only. Native hook import and removal are unverified; Conquistador mode is not offered.'
      : 'Conquistador mode is implemented only for Claude Code using its documented SessionStart, Stop, and TaskCompleted events. Other hosts keep the disabled proactive helper.',
  };
}

function absoluteFile(path, label) {
  if (typeof path !== 'string' || !isAbsolute(path) || /[\x00-\x1f\x7f]/.test(path)) fail(`${label} must be an absolute path.`);
  return resolve(path);
}

function settingsPath(project) {
  return join(absoluteFile(project, 'Project'), '.claude/settings.local.json');
}

function ownedCommand(command) {
  if (typeof command !== 'string') return false;
  const tokens = [];
  for (const match of command.matchAll(/'([^']*)'|[^\s]+/g)) tokens.push(match[1] ?? match[0]);
  if (!tokens.includes('--handle')) return false;
  return tokens.some(token => basename(token) === MARKER);
}

function handler(event, configPath) {
  return {
    type: 'command',
    command: [process.execPath, quote(script), '--handle', '--host', SUPPORTED_HOST, '--event', event, '--config', quote(configPath)].join(' '),
  };
}

function readJsonFile(path) {
  if (!existsSync(path)) return null;
  if (lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile()) fail('Host settings must be a regular file.');
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.conquistador-mode-stage`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  try { renameSync(temporary, path); }
  catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function withoutOwned(settings) {
  if (!isObject(settings)) return {};
  const next = { ...settings };
  if (!isObject(settings.hooks)) return next;
  const hooks = {};
  for (const [event, groups] of Object.entries(settings.hooks)) {
    if (!Array.isArray(groups)) {
      hooks[event] = groups;
      continue;
    }
    const kept = [];
    for (const group of groups) {
      if (!isObject(group) || !Array.isArray(group.hooks)) {
        kept.push(group);
        continue;
      }
      const handlers = group.hooks.filter(item => !ownedCommand(item?.command));
      if (handlers.length) kept.push({ ...group, hooks: handlers });
    }
    if (kept.length) hooks[event] = kept;
  }
  if (Object.keys(hooks).length) next.hooks = hooks;
  else delete next.hooks;
  return next;
}

function withOwned(settings, events, configPath) {
  const next = withoutOwned(settings);
  const hooks = { ...(isObject(next.hooks) ? next.hooks : {}) };
  for (const event of events) {
    const hostEvent = HOST_EVENTS[event];
    hooks[hostEvent] = [...(Array.isArray(hooks[hostEvent]) ? hooks[hostEvent] : []), { hooks: [handler(event, configPath)] }];
  }
  next.hooks = hooks;
  return next;
}

function parseEvents(value) {
  const events = value === undefined ? EVENTS : String(value).split(',').map(item => item.trim()).filter(Boolean);
  if (!events.length || new Set(events).size !== events.length || events.some(event => !EVENTS.includes(event))) fail('Choose only session-start, before-delivery, and results-updated.');
  return events;
}

export function inspectMode({ host, project, config } = {}) {
  const support = hostSupport(host);
  if (!support.supported) return { state: 'unsupported', ...support };
  const settings = settingsPath(project);
  const current = readJsonFile(settings) ?? {};
  const registered = [];
  for (const [event, hostEvent] of Object.entries(HOST_EVENTS)) {
    const groups = current.hooks?.[hostEvent];
    if (Array.isArray(groups) && groups.some(group => Array.isArray(group?.hooks) && group.hooks.some(item => ownedCommand(item?.command)))) {
      registered.push(event);
    }
  }
  let enabled = false;
  if (config) {
    const record = readConfig(config);
    enabled = record.enabled === true && record.events.length > 0;
  }
  return {
    state: registered.length ? (enabled ? 'enabled' : 'registered-disabled') : 'disabled',
    host: SUPPORTED_HOST,
    settings,
    registered,
    enabled,
    nativeActivationVerified: false,
    unrelatedSettingsPreserved: true,
  };
}

export function applyMode(action, options) {
  const { host, project, config } = options;
  const support = hostSupport(host);
  if (!support.supported) fail(support.explanation);
  if (!['enable', 'disable', 'remove'].includes(action)) fail('Use enable, disable, or remove.');
  const settings = settingsPath(project);
  const current = readJsonFile(settings) ?? {};
  if (action === 'remove') {
    const next = withoutOwned(current);
    if (Object.keys(next).length) writeJsonAtomic(settings, next);
    else if (existsSync(settings)) rmSync(settings);
    return inspectMode({ host, project, config });
  }
  const configPath = absoluteFile(config, 'Config');
  const record = readConfig(configPath);
  const events = parseEvents(options.events);
  if (action === 'enable') {
    if (!record.enabled) fail('Enable requires an operator config with enabled true.');
    writeJsonAtomic(settings, withOwned(current, events, configPath));
  } else {
    writeJsonAtomic(configPath, { schemaVersion: 1, enabled: false, events: record.events });
  }
  return inspectMode({ host, project, config: configPath });
}

function readStdinLimited() {
  const fd = 0;
  const bytes = Buffer.alloc(8192);
  let length = 0;
  try {
    while (length < bytes.length) {
      const count = readSync(fd, bytes, length, bytes.length - length, null);
      if (!count) break;
      length += count;
    }
  } catch {
    return {};
  }
  if (!length) return {};
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length)));
    return isObject(value) ? value : {};
  } catch {
    return {};
  }
}

export function handleHostEvent({ host, event, config, input } = {}) {
  if (host !== SUPPORTED_HOST || !Object.hasOwn(HOST_EVENTS, event)) fail('Unsupported host event.');
  const payload = input === undefined ? readStdinLimited() : input;
  if (payload.stop_hook_active === true) {
    return { hookSpecificOutput: { hookEventName: HOST_EVENTS[event], additionalContext: '' } };
  }
  const result = advisory(event, config ? readConfig(config) : undefined);
  const instructions = result.enabled ? result.instructions.join('\n') : '';
  return {
    hookSpecificOutput: {
      hookEventName: HOST_EVENTS[event],
      additionalContext: instructions,
    },
  };
}

export function main(args) {
  const options = {};
  const [action, ...rest] = args;
  if (action === '--handle') {
    for (let i = 0; i < rest.length; i += 2) {
      if (!['--host', '--event', '--config'].includes(rest[i]) || !rest[i + 1]) fail('Invalid mode handle arguments.');
      options[rest[i].slice(2)] = rest[i + 1];
    }
    return handleHostEvent(options);
  }
  if (!['enable', 'disable', 'status', 'remove'].includes(action)) fail('Usage: enable|disable|status|remove --host HOST --project ABS [--config ABS] [--events LIST]');
  for (let i = 0; i < rest.length; i += 2) {
    if (!['--host', '--project', '--config', '--events'].includes(rest[i]) || options[rest[i].slice(2)] !== undefined || !rest[i + 1]) {
      fail('Unknown, duplicate, or incomplete option.');
    }
    options[rest[i].slice(2)] = rest[i + 1];
  }
  if (!options.host || !options.project) fail('Host and project are required.');
  if (action === 'status') return inspectMode(options);
  if (action !== 'remove' && !options.config) fail('Operator config is required.');
  return applyMode(action, options);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const value = main(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(value)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
