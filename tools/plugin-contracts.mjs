import assert from 'node:assert/strict';
import { readFileSync, realpathSync, statSync, readdirSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const schema = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
const strings = ['version', 'description', 'homepage', 'repository', 'license'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function keys(value, allowed) {
  assert.ok(object(value), 'Expected an object');
  for (const key of Object.keys(value)) assert.ok(allowed.includes(key), `Unknown field: ${key}`);
}

// Implements the published 1.0.0 manifest schema, not a host activation check.
export function validatePortableManifest(manifest) {
  keys(manifest, ['$schema', 'name', ...strings, 'author', 'keywords', 'extensions']);
  assert.equal(manifest.$schema, schema);
  assert.equal(typeof manifest.name, 'string');
  assert.ok(manifest.name.length <= 64 && /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(manifest.name), 'Invalid plugin name');
  for (const key of strings) if (key in manifest) assert.equal(typeof manifest[key], 'string', key);
  if ('author' in manifest) {
    keys(manifest.author, ['name', 'email', 'url']);
    for (const value of Object.values(manifest.author)) assert.equal(typeof value, 'string');
  }
  if ('keywords' in manifest) {
    assert.ok(Array.isArray(manifest.keywords));
    for (const value of manifest.keywords) assert.equal(typeof value, 'string');
  }
  if ('extensions' in manifest) {
    assert.ok(object(manifest.extensions));
    for (const value of Object.values(manifest.extensions)) assert.ok(object(value));
  }
}

export function containedPath(root, path, kind) {
  assert.ok(typeof path === 'string' && path.startsWith('./'), 'Expected a plugin-relative path');
  assert.ok(!/[\\\x00-\x1f]/.test(path) && !path.split('/').includes('..'), 'Unsafe package path');
  const base = realpathSync(root);
  const target = realpathSync(resolve(base, path));
  const delta = relative(base, target);
  assert.ok(delta !== '..' && !delta.startsWith(`..${sep}`) && !isAbsolute(delta), 'Path escapes package');
  const stat = statSync(target);
  assert.ok(kind === 'directory' ? stat.isDirectory() : stat.isFile(), `Expected ${kind}: ${path}`);
  return target;
}

function json(root, path) {
  return JSON.parse(readFileSync(containedPath(root, path, 'file'), 'utf8'));
}

export function validatePluginContracts(root) {
  root = realpathSync(root);
  const portable = json(root, './plugin.json');
  validatePortableManifest(portable);
  const claude = json(root, './.claude-plugin/plugin.json');
  const codex = json(root, './.codex-plugin/plugin.json');
  for (const host of [claude, codex]) {
    for (const key of ['name', 'version', 'description']) assert.equal(host[key], portable[key], key);
    // This package intentionally declares only metadata and skills, with no automatic execution.
    keys(host, ['name', ...strings, 'author', 'keywords', 'displayName', 'skills', 'interface']);
    if ('skills' in host) containedPath(root, host.skills, 'directory');
  }
  for (const key of ['composerIcon', 'logo']) containedPath(root, codex.interface[key], 'file');
  containedPath(root, './skills/conquistador/SKILL.md', 'file');
  const skills = containedPath(root, './skills/', 'directory');
  for (const entry of readdirSync(skills)) {
    const folder = containedPath(root, `./skills/${entry}`, 'directory');
    containedPath(root, `./skills/${entry}/SKILL.md`, 'file');
    // Reject escapes in bundled references as well as in the discovered SKILL.md.
    function walk(directory) {
      for (const item of readdirSync(directory, { withFileTypes: true })) {
        const path = `./${relative(root, resolve(directory, item.name)).split(sep).join('/')}`;
        assert.ok(!item.isSymbolicLink(), `Symlink in skill package: ${path}`);
        const target = containedPath(root, path, item.isDirectory() ? 'directory' : 'file');
        if (item.isDirectory()) walk(target);
      }
    }
    walk(folder);
  }
  const marketplace = json(root, './.claude-plugin/marketplace.json');
  keys(marketplace, ['$schema', 'name', 'owner', 'metadata', 'plugins']);
  assert.equal(marketplace.name, portable.name);
  assert.equal(marketplace.plugins.length, 1);
  assert.equal(marketplace.plugins[0].name, portable.name);
  assert.equal(containedPath(root, marketplace.plugins[0].source, 'directory'), realpathSync(root));
  const codexMarket = json(root, './.agents/plugins/marketplace.json');
  keys(codexMarket, ['name', 'interface', 'plugins']);
  assert.equal(codexMarket.plugins.length, 1);
  const entry = codexMarket.plugins[0];
  assert.equal(entry.name, portable.name);
  assert.deepEqual(entry.policy, { installation: 'AVAILABLE', authentication: 'ON_USE' });
  assert.equal(entry.source.source, 'local');
  assert.equal(containedPath(root, entry.source.path, 'directory'), realpathSync(root));
  const agent = readFileSync(containedPath(root, './agents/conquistador.md', 'file'), 'utf8');
  const frontmatter = agent.match(/^---\n([\s\S]+?)\n---\n/);
  assert.ok(frontmatter, 'Agent needs YAML frontmatter');
  const fields = Object.fromEntries(frontmatter[1].split('\n').map(line => {
    const match = line.match(/^([a-z]+): (.+)$/);
    assert.ok(match, 'Agent supports simple string frontmatter only');
    return [match[1], match[2]];
  }));
  keys(fields, ['name', 'description', 'model']);
  assert.equal(fields.name, portable.name);
  assert.ok(fields.description?.length > 0);
  assert.equal(fields.model, 'inherit');
  assert.ok(agent.includes('${CLAUDE_PLUGIN_ROOT}/skills/conquistador/SKILL.md'), 'Agent must load the bundled parent');
  return { manifestSchema: schema, nativeAgent: 'claude', hostActivationVerified: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(validatePluginContracts(resolve(process.argv[2] ?? '.')), null, 2));
}
