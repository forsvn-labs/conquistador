import { constants, closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { advisory, readConfig } from './proactive.mjs';

export const MODE_SCHEMA_VERSION = 'conquistador.mode/v1';
export const SUPPORTED_HOST = 'claude-code';
export const HOST_EVENTS = Object.freeze({
  'session-start': 'SessionStart',
  'before-delivery': 'Stop',
});
export const HOST_EVIDENCE = Object.freeze({
  host: SUPPORTED_HOST,
  source: 'https://code.claude.com/docs/en/hooks',
  mapping: HOST_EVENTS,
  nativeActivationVerified: false,
  executorVerified: false,
  documentationReviewed: '2026-09-15',
});
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
      : 'Conquistador mode is implemented only for Claude Code using SessionStart and Stop. Native activation remains unverified. Other hosts keep the disabled proactive helper.',
  };
}

function absoluteFile(path, label) {
  if (typeof path !== 'string' || !isAbsolute(path) || /[\x00-\x1f\x7f]/.test(path)) fail(`${label} must be an absolute path.`);
  return resolve(path);
}

function settingsPath(project) {
  return join(absoluteFile(project, 'Project'), '.claude/settings.local.json');
}

function tokenize(command) {
  if (typeof command !== 'string') return null;
  const tokens = [];
  let i = 0;
  while (i < command.length) {
    if (command[i] === ' ' || command[i] === '\t') {
      i += 1;
      continue;
    }
    let token = '';
    while (i < command.length && command[i] !== ' ' && command[i] !== '\t') {
      if (command[i] === "'") {
        i += 1;
        while (i < command.length && command[i] !== "'") token += command[i++];
        if (i >= command.length) return null;
        i += 1;
      } else if (command[i] === '\\' && i + 1 < command.length) {
        token += command[i + 1];
        i += 2;
      } else {
        token += command[i++];
      }
    }
    tokens.push(token);
  }
  return tokens;
}

function ownedCommand(command) {
  const tokens = tokenize(command);
  if (!tokens || tokens.length !== 9) return null;
  if (tokens[0] !== process.execPath || tokens[1] !== script) return null;
  if (tokens[2] !== '--handle' || tokens[3] !== '--host' || tokens[4] !== SUPPORTED_HOST) return null;
  // Recognize the removed TaskCompleted registration so upgrades can remove owned hooks.
  if (tokens[5] !== '--event' || (!Object.hasOwn(HOST_EVENTS, tokens[6]) && tokens[6] !== 'results-updated')) return null;
  if (tokens[7] !== '--config' || !isAbsolute(tokens[8])) return null;
  return resolve(tokens[8]);
}

function registeredConfig(settings) {
  const paths = new Set();
  if (!isObject(settings?.hooks)) return null;
  for (const groups of Object.values(settings.hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!Array.isArray(group?.hooks)) continue;
      for (const item of group.hooks) {
        const path = ownedCommand(item?.command);
        if (path) paths.add(path);
      }
    }
  }
  if (paths.size > 1) fail('Host hooks register more than one operator config.');
  return paths.values().next().value ?? null;
}

function assertRegisteredConfig(supplied, registered) {
  if (registered && supplied !== registered) fail('Operator config does not match the registered host hooks.');
}

function handler(event, configPath) {
  return {
    type: 'command',
    command: [quote(process.execPath), quote(script), '--handle', '--host', SUPPORTED_HOST, '--event', event, '--config', quote(configPath)].join(' '),
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
  if (!events.length || new Set(events).size !== events.length || events.some(event => !EVENTS.includes(event))) fail('Choose only session-start and before-delivery. results-updated has no Claude context-advice adapter.');
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
  const bound = registeredConfig(current);
  const supplied = config ? absoluteFile(config, 'Config') : null;
  if (supplied) assertRegisteredConfig(supplied, bound);
  let enabled = false;
  let state = 'disabled';
  if (bound) {
    if (!supplied) state = 'unknown';
    else {
      const record = readConfig(bound);
      enabled = record.enabled === true && record.events.some(event => registered.includes(event));
      state = enabled ? 'enabled' : 'registered-disabled';
    }
  }
  return {
    state,
    host: SUPPORTED_HOST,
    settings,
    config: bound,
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
    return inspectMode({ host, project });
  }
  const configPath = absoluteFile(config, 'Config');
  const bound = registeredConfig(current);
  if (action !== 'enable') assertRegisteredConfig(configPath, bound);
  const record = readConfig(configPath);
  const events = parseEvents(options.events);
  if (action === 'enable') {
    if (!record.enabled) fail('Enable requires an operator config with enabled true.');
    writeJsonAtomic(settings, withOwned(current, events, configPath));
  } else {
    writeJsonAtomic(bound ?? configPath, { schemaVersion: 1, enabled: false, events: record.events });
  }
  return inspectMode({ host, project, config: configPath });
}

function readStdinLimited() {
  let fd;
  try {
    fd = openSync('/dev/fd/0', constants.O_RDONLY | constants.O_NONBLOCK);
  } catch {
    return null;
  }
  try {
    const bytes = Buffer.alloc(8192);
    let length = 0;
    while (length < bytes.length) {
      let count;
      try {
        count = readSync(fd, bytes, length, bytes.length - length, null);
      } catch (error) {
        if (error.code === 'EAGAIN' || error.code === 'EWOULDBLOCK') break;
        return null;
      }
      if (!count) break;
      length += count;
    }
    if (!length || length === bytes.length) return null;
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length)));
    return isObject(value) ? value : null;
  } catch {
    return null;
  } finally {
    closeSync(fd);
  }
}

export function handleHostEvent({ host, event, config, input } = {}) {
  if (host !== SUPPORTED_HOST || !Object.hasOwn(HOST_EVENTS, event)) fail('Unsupported host event.');
  const payload = input === undefined ? readStdinLimited() : input;
  // Missing or truncated input must never bypass the host's recursion flag.
  if (!isObject(payload) || payload.hook_event_name !== HOST_EVENTS[event]) return {};
  if (event === 'before-delivery' && payload.stop_hook_active !== false) return {};
  const result = advisory(event, config ? readConfig(config) : undefined);
  if (!result.enabled) return {};
  const instructions = result.instructions.join('\n');
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
      if (!['--host', '--event', '--config'].includes(rest[i]) || options[rest[i].slice(2)] !== undefined || !rest[i + 1]) fail('Invalid mode handle arguments.');
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
  } catch {
    // Parser and filesystem errors can include private configuration content or paths.
    process.stderr.write('Invalid Conquistador mode input. See docs/PROACTIVE.md.\n');
    // Exit 2 blocks Stop/TaskCompleted in Claude. Advisory failures must not block work.
    process.exitCode = process.argv[2] === '--handle' ? 1 : 2;
  }
}
