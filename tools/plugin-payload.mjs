// The coding-agent plugin is a subset of the full distribution. Its own hash inventory
// includes every method/resource plus the Node-only server, hooks, and host metadata.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { briefFiles } from './operator-package.mjs';
import { methodPath } from './method-library.mjs';

export const pluginManifestPath = 'release/plugin-completeness.json';

export const pluginPayload = [
  '.claude-plugin', '.codex-plugin', '.cursor-plugin', '.agents', 'com.github.copilot', 'plugin.json', 'mcp.json', 'hooks', 'skills', 'assets',
  'agents/conquistador.md', 'package.json', 'LICENSE', 'NOTICE.md', 'README.md', 'SKILL.md',
  'mcp/server.mjs', 'tools/mcp-http.mjs', 'tools/check', ...briefFiles,
];

const schemaVersion = 'conquistador.plugin-completeness/v1';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');

const included = path => pluginPayload.some(item => path === item || path.startsWith(`${item}/`));

// oxlint-disable-next-line anti-slop/no-runtime-typeof -- Parse untrusted manifest paths at the filesystem boundary without string coercion.
const safePath = path => typeof path === 'string' && !/[\\:]/.test(path) && [...path].every(character => character.charCodeAt(0) > 31)
  && path.split('/').every(part => part && part !== '.' && part !== '..');

// Do not follow a symlink in any component below the selected package/install root.
export function payloadBytes(root, path) {
  if (!safePath(path)) throw Error(`Invalid plugin path: ${path}`);
  let current = root;
  const parts = path.split('/');

  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    const stat = lstatSync(current);

    if (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile()) throw Error(`Not a regular plugin file: ${path}`);
  }

  return readFileSync(current);
}

// Maintainer-only generation. Reuse the full release's method/resource hashes and the
// overlapping operator hashes; do not require runtime/operator files omitted by plugins.
export function buildPluginManifest(root, completeness) {
  const expected = new Map([
    ...[completeness.parent, ...completeness.outcomes].map(item => [`skills/${methodPath(item.name)}`, item.sha256]),
    ...completeness.requiredResources.map(item => [`skills/${item.path}`, item.sha256]),
    ...completeness.operatorResources.filter(item => included(item.path)).map(item => [item.path, item.sha256]),
  ]);

  const files = new Map();

  function collect(path) {
    const stat = lstatSync(join(root, path));

    if (stat.isDirectory()) {
      for (const name of readdirSync(join(root, path)).sort()) {
        if (name !== 'node_modules' && name !== '.git') collect(`${path}/${name}`);
      }

      return;
    }

    const sha256 = hash(payloadBytes(root, path));

    if (path.startsWith('skills/') && !expected.has(path)) throw Error(`Plugin resource is absent from release completeness: ${path}`);

    if (expected.has(path) && expected.get(path) !== sha256) throw Error(`Plugin resource differs from release completeness: ${path}`);
    files.set(path, sha256);
  }

  for (const item of pluginPayload) collect(item);

  for (const path of expected.keys()) if (!files.has(path)) throw Error(`Missing plugin resource: ${path}`);

  return {
    schemaVersion,
    version: JSON.parse(payloadBytes(root, 'package.json').toString('utf8')).version,
    files: [...files].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([path, sha256]) => ({ path, sha256 })),
  };
}

export function readPluginManifest(root, version) {
  const bytes = payloadBytes(root, pluginManifestPath);
  const manifest = JSON.parse(bytes.toString('utf8'));

  if (manifest.schemaVersion !== schemaVersion || manifest.version !== version || !Array.isArray(manifest.files) || !manifest.files.length) {
    throw Error(`Invalid ${pluginManifestPath}`);
  }

  const seen = new Set();

  for (const item of manifest.files) {
    if (!safePath(item?.path) || !included(item.path) || !/^[a-f0-9]{64}$/.test(item.sha256) || seen.has(item.path)) {
      throw Error(`Invalid plugin manifest entry: ${item?.path}`);
    }

    seen.add(item.path);
  }

  for (const item of pluginPayload) if (![...seen].some(path => path === item || path.startsWith(`${item}/`))) throw Error(`Plugin manifest omits ${item}`);

  // The installed manifest is content to verify, never the authority for its own files.
  return [...manifest.files, { path: pluginManifestPath, sha256: hash(bytes) }];
}

export function invalidPayload(root, expected) {
  const problems = [];

  for (const { path, sha256 } of expected) {
    try { if (hash(payloadBytes(root, path)) !== sha256) problems.push(`changed ${path}`); }
    catch (error) { problems.push(`${error.code === 'ENOENT' ? 'missing' : 'unreadable or non-regular'} ${path}`); }
  }

  return problems;
}
