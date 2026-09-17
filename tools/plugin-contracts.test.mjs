import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePortableManifest, containedPath, validatePluginContracts } from './plugin-contracts.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'plugin.json'), 'utf8'));

test('portable schema rejects unknown fields, invalid names and incorrect metadata types', () => {
  validatePortableManifest(manifest);
  for (const patch of [
    { $schema: 'https://example.invalid/schema' }, { name: 'UPPER' },
    { name: 'two--words' }, { name: 'a'.repeat(65) }, { name: '' },
    { skills: './skills/' }, { author: { name: 42 } }, { author: { unknown: '' } },
    { keywords: 'skills' }, { keywords: [false] }, { version: 1 },
    { extensions: [] }, { extensions: { 'com.example': null } },
  ]) assert.throws(() => validatePortableManifest({ ...manifest, ...patch }), JSON.stringify(patch));
  const missing = { ...manifest }; delete missing.$schema;
  assert.throws(() => validatePortableManifest(missing));
});

test('package paths reject traversal, absent files, wrong kinds and symlink escapes', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'plugin paths '));
  try {
    const packageRoot = join(fixture, 'package'); mkdirSync(packageRoot);
    writeFileSync(join(fixture, 'outside.md'), 'outside');
    writeFileSync(join(packageRoot, 'inside.md'), 'inside');
    symlinkSync('../outside.md', join(packageRoot, 'escape.md'));
    assert.equal(containedPath(packageRoot, './inside.md', 'file'), realpathSync(join(packageRoot, 'inside.md')));
    for (const path of ['../outside.md', './sub/../../outside.md', '/outside.md', './escape.md', './missing.md', './bad\\path']) {
      assert.throws(() => containedPath(packageRoot, path, 'file'), path);
    }
    assert.throws(() => containedPath(packageRoot, './inside.md', 'directory'));
    assert.throws(() => containedPath(packageRoot, './', 'file'));
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test('source package metadata resolves local marketplaces, native agent and bundled skills', () => {
  assert.deepEqual(validatePluginContracts(root), {
    manifestSchema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
    nativeAgent: 'claude', discovery: 'canonical-specialists', hostActivationVerified: false,
  });
});
