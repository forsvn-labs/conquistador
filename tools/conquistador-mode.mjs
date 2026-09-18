import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { advisory, readConfig } from './proactive.mjs';

export const MODE_SCHEMA_VERSION = 'conquistador.mode/v1';
export const SUPPORTED_HOST = 'claude-code';
export const HOST_EVENTS = Object.freeze({
  'session-start': 'SessionStart',
  'prompt-submitted': 'UserPromptSubmit',
  'before-delivery': 'Stop',
});
export const HOST_EVIDENCE = Object.freeze({
  'claude-code': Object.freeze({
    label: 'Claude Code',
    settings: '.claude/settings.local.json',
    source: 'https://code.claude.com/docs/en/hooks',
    documentationReviewed: '2026-09-18',
    nativeActivationVerified: false,
  }),
  codex: Object.freeze({
    label: 'Codex',
    settings: '.codex/hooks.json',
    source: 'https://developers.openai.com/codex/hooks',
    documentationReviewed: '2026-09-18',
    nativeActivationVerified: false,
  }),
});
const EVENTS = Object.keys(HOST_EVENTS);
const fail = message => { throw new Error(message); };
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const script = fileURLToPath(import.meta.url);
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;

export function hostSupport(host) {
  const evidence = HOST_EVIDENCE[host];
  if (evidence) {
    return {
      supported: true,
      host,
      ...evidence,
      mapping: HOST_EVENTS,
      executorVerified: false,
    };
  }
  return {
    supported: false,
    host,
    nativeActivationVerified: false,
    explanation: host === 'grok-bot' || host === 'eve'
      ? 'Experimental import only. Native hook import and removal are unverified; Conquistador mode is not offered.'
      : 'Conquistador mode is implemented for Codex and Claude Code using SessionStart, UserPromptSubmit, and Stop. Other hosts keep the disabled proactive helper.',
  };
}

function absoluteFile(path, label) {
  if (typeof path !== 'string' || !isAbsolute(path) || /[\x00-\x1f\x7f]/.test(path)) fail(`${label} must be an absolute path.`);
  return resolve(path);
}

function settingsPath(project, host) {
  return join(absoluteFile(project, 'Project'), HOST_EVIDENCE[host].settings);
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

function ownedCommand(command, host, previous = []) {
  const tokens = tokenize(command);
  if (!tokens || tokens.length !== 9) return null;
  if (!isAbsolute(tokens[0]) || (tokens[1] !== script && !previous.includes(command))) return null;
  if (tokens[2] !== '--handle' || tokens[3] !== '--host' || tokens[4] !== host) return null;
  // Recognize the removed TaskCompleted registration so upgrades can remove owned hooks.
  if (tokens[5] !== '--event' || (!Object.hasOwn(HOST_EVENTS, tokens[6]) && tokens[6] !== 'results-updated')) return null;
  if (tokens[7] !== '--config' || !isAbsolute(tokens[8])) return null;
  return resolve(tokens[8]);
}

function registeredConfig(settings, host, previous = []) {
  const paths = new Set();
  if (!isObject(settings?.hooks)) return null;
  for (const groups of Object.values(settings.hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!Array.isArray(group?.hooks)) continue;
      for (const item of group.hooks) {
        const path = ownedCommand(item?.command, host, previous);
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

function handler(host, event, configPath) {
  const value = {
    type: 'command',
    command: [quote(process.execPath), quote(script), '--handle', '--host', host, '--event', event, '--config', quote(configPath)].join(' '),
  };
  // The selector already enforces a 7,500-character ceiling; keep the complete result inline.
  if (host === 'codex') value.additionalContextLimit = 0;
  return value;
}

function readJsonFile(path) {
  if (!existsSync(path)) return null;
  if (lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile()) fail('Host settings must be a regular file.');
  return JSON.parse(readFileSync(path, 'utf8'));
}

function ownershipCommands(settings) {
  const record = readJsonFile(`${settings}.conquistador.json`);
  if (record === null) return [];
  if (record.schemaVersion !== 'conquistador.hook-owner/v1' || !Array.isArray(record.commands) || record.commands.length > 4 || record.commands.some(value => typeof value !== 'string')) fail('Invalid hook ownership record.');
  return record.commands;
}
function commandsCurrent(settings, host, previous, expectedScript = script) {
  return Object.values(settings.hooks ?? {}).filter(Array.isArray).flatMap(groups => groups)
    .flatMap(group => Array.isArray(group?.hooks) ? group.hooks : [])
    .filter(item => ownedCommand(item?.command, host, previous))
    .every(item => { const tokens = tokenize(item.command); return tokens[0] === process.execPath && tokens[1] === expectedScript && existsSync(tokens[0]) && existsSync(tokens[1]); });
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

function withoutOwned(settings, host, previous = []) {
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
      const handlers = group.hooks.filter(item => !ownedCommand(item?.command, host, previous));
      if (handlers.length) kept.push({ ...group, hooks: handlers });
    }
    if (kept.length) hooks[event] = kept;
  }
  if (Object.keys(hooks).length) next.hooks = hooks;
  else delete next.hooks;
  return next;
}

function withOwned(settings, host, events, configPath, previous) {
  const next = withoutOwned(settings, host, previous);
  const hooks = { ...(isObject(next.hooks) ? next.hooks : {}) };
  for (const event of events) {
    const hostEvent = HOST_EVENTS[event];
    hooks[hostEvent] = [...(Array.isArray(hooks[hostEvent]) ? hooks[hostEvent] : []), { hooks: [handler(host, event, configPath)] }];
  }
  next.hooks = hooks;
  return next;
}

function parseEvents(value) {
  const events = value === undefined ? EVENTS : String(value).split(',').map(item => item.trim()).filter(Boolean);
  if (!events.length || new Set(events).size !== events.length || events.some(event => !EVENTS.includes(event))) fail('Choose only session-start, prompt-submitted, and before-delivery. results-updated has no supported hook context adapter.');
  return events;
}

export function inspectMode({ host, project, config, scriptPath = script } = {}) {
  const support = hostSupport(host);
  if (!support.supported) return { state: 'unsupported', ...support };
  const settings = settingsPath(project, host);
  const current = readJsonFile(settings) ?? {};
  const previous = ownershipCommands(settings);
  for (const groups of Object.values(current.hooks ?? {}).filter(Array.isArray)) {
    for (const group of groups) for (const item of group?.hooks ?? []) {
      if (tokenize(item?.command)?.[1] === scriptPath) previous.push(item.command);
    }
  }
  const registered = [];
  for (const [event, hostEvent] of Object.entries(HOST_EVENTS)) {
    const groups = current.hooks?.[hostEvent];
    if (Array.isArray(groups) && groups.some(group => Array.isArray(group?.hooks) && group.hooks.some(item => ownedCommand(item?.command, host, previous)))) {
      registered.push(event);
    }
  }
  const bound = registeredConfig(current, host, previous);
  const supplied = config ? absoluteFile(config, 'Config') : null;
  if (supplied) assertRegisteredConfig(supplied, bound);
  let enabled = false;
  let promptEnabled = false;
  let state = 'disabled';
  if (bound) {
    if (!supplied) state = 'unknown';
    else {
      const record = readConfig(bound);
      enabled = record.enabled === true && record.events.some(event => registered.includes(event));
      promptEnabled = record.enabled === true && record.events.includes('prompt-submitted');
      state = enabled ? 'enabled' : 'registered-disabled';
    }
  }
  return {
    state,
    host,
    settings,
    config: bound,
    registered,
    enabled,
    nativeActivationVerified: false,
    documentationReviewed: support.documentationReviewed ?? null,
    hookRegistered: registered.length > 0,
    routingAvailable: promptEnabled && registered.includes('prompt-submitted') && commandsCurrent(current, host, previous, scriptPath),
    repairRequired: registered.length > 0 && !commandsCurrent(current, host, previous, scriptPath),
    activationEvidence: 'unobserved',
    trust: 'host-managed-unverified',
    taskObservationVerified: false,
    unrelatedSettingsPreserved: true,
  };
}

export function applyMode(action, options) {
  const { host, project, config } = options;
  const support = hostSupport(host);
  if (!support.supported) fail(support.explanation);
  if (!['enable', 'disable', 'remove'].includes(action)) fail('Use enable, disable, or remove.');
  const settings = settingsPath(project, host);
  const current = readJsonFile(settings) ?? {};
  const previous = ownershipCommands(settings);
  if (action === 'remove') {
    const next = withoutOwned(current, host, previous);
    if (Object.keys(next).length) writeJsonAtomic(settings, next);
    else if (existsSync(settings)) rmSync(settings);
    if (existsSync(`${settings}.conquistador.json`)) rmSync(`${settings}.conquistador.json`);
    return inspectMode({ host, project });
  }
  const configPath = absoluteFile(config, 'Config');
  const bound = registeredConfig(current, host, previous);
  if (action !== 'enable') assertRegisteredConfig(configPath, bound);
  const record = readConfig(configPath);
  const events = parseEvents(options.events);
  if (action === 'enable') {
    if (!record.enabled) fail('Enable requires an operator config with enabled true.');
    writeJsonAtomic(settings, withOwned(current, host, events, configPath, previous));
    writeJsonAtomic(`${settings}.conquistador.json`, {
      schemaVersion: 'conquistador.hook-owner/v1',
      commands: events.map(event => handler(host, event, configPath).command),
    });
  } else {
    writeJsonAtomic(bound ?? configPath, { schemaVersion: 1, enabled: false, events: record.events });
  }
  return inspectMode({ host, project, config: configPath });
}

function readStdinLimited() {
  return new Promise(resolveInput => {
    const chunks = [];
    let length = 0;
    const finish = value => {
      clearTimeout(deadline);
      process.stdin.removeListener('data', onData);
      process.stdin.removeListener('end', onEnd);
      process.stdin.removeListener('error', onError);
      process.stdin.destroy();
      resolveInput(value);
    };
    const onData = chunk => {
      length += chunk.length;
      if (length >= 65536) return finish(null);
      chunks.push(chunk);
    };
    const onError = () => finish(null);
    const onEnd = () => {
      try {
        const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
        finish(isObject(value) ? value : null);
      } catch { finish(null); }
    };
    // Read the supplied stream directly: Linux cannot reopen a stdin socket through /dev/fd/0.
    // Require complete input within a deadline; partial or open streams must never inject advice.
    const deadline = setTimeout(() => finish(null), 1000);
    process.stdin.on('data', onData);
    process.stdin.once('end', onEnd);
    process.stdin.once('error', onError);
  });
}

export function handleHostEvent({ host, event, config, input } = {}) {
  if (!HOST_EVIDENCE[host] || !Object.hasOwn(HOST_EVENTS, event)) fail('Unsupported host event.');
  const payload = input;
  // Missing or truncated input must never bypass the host's recursion flag.
  if (!isObject(payload) || payload.hook_event_name !== HOST_EVENTS[event]) return {};
  if (event === 'before-delivery' && payload.stop_hook_active !== false) return {};
  const result = advisory(event, config ? readConfig(config) : undefined, {
    prompt: event === 'prompt-submitted' ? payload.prompt : undefined,
  });
  if (!result.enabled || result.instructions.length === 0) return {};
  const instructions = result.instructions.join('\n');
  return {
    hookSpecificOutput: {
      hookEventName: HOST_EVENTS[event],
      additionalContext: instructions,
    },
  };
}

export function main(args, input) {
  const options = {};
  const [action, ...rest] = args;
  if (action === '--handle') {
    for (let i = 0; i < rest.length; i += 2) {
      if (!['--host', '--event', '--config'].includes(rest[i]) || options[rest[i].slice(2)] !== undefined || !rest[i + 1]) fail('Invalid mode handle arguments.');
      options[rest[i].slice(2)] = rest[i + 1];
    }
    return handleHostEvent({ ...options, input });
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
    const input = process.argv[2] === '--handle' ? await readStdinLimited() : undefined;
    const value = main(process.argv.slice(2), input);
    process.stdout.write(`${JSON.stringify(value)}\n`);
  } catch {
    // Parser and filesystem errors can include private configuration content or paths.
    process.stderr.write('Invalid Conquistador mode input. See docs/PROACTIVE.md.\n');
    // Hook handlers are advisory. Their failures must not block host work.
    process.exitCode = process.argv[2] === '--handle' ? 1 : 2;
  }
}
