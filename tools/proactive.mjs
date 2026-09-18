import { constants, openSync, fstatSync, readSync, closeSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { selectRequestContext } from './context-selection.mjs';

export const MAX_CONFIG_BYTES = 4096;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const advice = Object.freeze({
  'session-start': 'Route through /conquistador to identify the current user outcome and select only the relevant available capabilities. Offer one useful next step within the existing user scope.',
  'prompt-submitted': null,
  'before-delivery': 'Route through /conquistador to review the current deliverable for usefulness, evidence gaps, and the smallest relevant quality checks before returning it.',
  'results-updated': 'Route through /conquistador to assess results already available in the authorized conversation and suggest one bounded next step. Do not infer missing results.',
});
const boundary = 'This is advisory only. The event grants no authority to read additional artifacts, publish, spend, send feedback, submit approvals or actions, or dispatch externally. Preserve explicit human authority and the current user scope.';
const fail = () => { throw new Error('Invalid proactive input. See docs/PROACTIVE.md.'); };

export function validateConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) fail();
  const keys = Object.keys(config);
  if (keys.length !== 3 || !['schemaVersion', 'enabled', 'events'].every(key => Object.hasOwn(config, key))) fail();
  if (config.schemaVersion !== 1 || typeof config.enabled !== 'boolean' || !Array.isArray(config.events)) fail();
  if (config.events.length > 4 || new Set(config.events).size !== config.events.length) fail();
  if (!config.events.every(event => typeof event === 'string' && Object.hasOwn(advice, event))) fail();
  return config;
}

// Only an explicitly supplied configuration is read. No discovery or artifact traversal.
export function readConfig(path) {
  if (typeof path !== 'string' || path.length === 0 || Buffer.byteLength(path) > 4096 || path.includes('\0')) fail();
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_CONFIG_BYTES) fail();
    const bytes = Buffer.alloc(MAX_CONFIG_BYTES + 1);
    let length = 0;
    while (length < bytes.length) {
      const count = readSync(fd, bytes, length, bytes.length - length, null);
      if (count === 0) break;
      length += count;
    }
    if (length > MAX_CONFIG_BYTES) fail();
    return validateConfig(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length))));
  } finally {
    closeSync(fd);
  }
}

export function advisory(event, config, { prompt, packageRoot = root } = {}) {
  if (typeof event !== 'string' || !Object.hasOwn(advice, event)) fail();
  if (config !== undefined) validateConfig(config);
  const enabled = config !== undefined && config.enabled && config.events.includes(event);
  if (enabled && event === 'prompt-submitted') {
    const selected = selectRequestContext(prompt, { root: packageRoot });
    return {
      schemaVersion: 1,
      event,
      enabled,
      instructions: selected.action === 'route' ? [selected.context] : [],
    };
  }
  return {
    schemaVersion: 1,
    event,
    enabled,
    instructions: enabled ? [advice[event], boundary] : [],
  };
}

export function main(args) {
  // No event payload, stdin, shell commands, or host-specific fields are accepted.
  if (args.length !== 2 && args.length !== 4) fail();
  if (args[0] !== '--event' || !Object.hasOwn(advice, args[1])) fail();
  if (args.length === 4 && args[2] !== '--config') fail();
  return advisory(args[1], args.length === 4 ? readConfig(args[3]) : undefined);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.stdout.write(`${JSON.stringify(main(process.argv.slice(2)))}\n`);
  } catch {
    // Never echo paths, file content, event text, or filesystem error details.
    process.stderr.write('Invalid proactive input. See docs/PROACTIVE.md.\n');
    process.exitCode = 2;
  }
}
