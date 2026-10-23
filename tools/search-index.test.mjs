import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { knowledgeIndex, buildSearchSnapshot } from './brief.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

const portable = index => [...index.docs, ...index.users].map(({ absolute: _absolute, tf, nameTerms, ...doc }) => ({ ...doc, tf: [...tf], nameTerms: [...nameTerms] }));

function fixture(t) {
  const path = mkdtempSync(join(tmpdir(), 'cq-search-'));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  cpSync(join(root, 'skills'), join(path, 'skills'), { recursive: true });
  mkdirSync(join(path, 'tools'));

  return path;
}

test('packaged index is deterministic, portable and identical to runtime indexing', t => {
  const snapshot = buildSearchSnapshot(root);
  assert.equal(JSON.stringify(snapshot).includes(root), false);
  assert.deepEqual(snapshot, buildSearchSnapshot(root));
  const path = fixture(t);
  writeFileSync(join(path, 'tools/search-index.json'), JSON.stringify(snapshot));
  const options = { playbooks: [], persistCache: false };
  assert.deepEqual(portable(knowledgeIndex(path, options)), portable(knowledgeIndex(path, { ...options, packagedIndex: false })));
});

for (const change of ['edit', 'add', 'remove', 'corrupt', 'obsolete', 'missing']) {
  test(`packaged index falls back safely after ${change}`, t => {
    const path = fixture(t);
    const snapshot = buildSearchSnapshot(root);
    const target = join(path, 'tools/search-index.json');
    writeFileSync(target, JSON.stringify(snapshot));
    const resource = join(path, 'skills/conquistador/commands/outreach/references/performance-fixture.md');

    if (change === 'add') writeFileSync(resource, '# Việt outreach\nA distinct performance fixture.');

    if (change === 'edit') writeFileSync(join(path, 'skills/conquistador/channels/linkedin.md'), '# Changed LinkedIn\nA distinct cold email guide.');

    if (change === 'remove') rmSync(join(path, 'skills/conquistador/channels/linkedin.md'));

    if (change === 'corrupt') writeFileSync(target, '{broken');

    if (change === 'obsolete') writeFileSync(target, JSON.stringify({ ...snapshot, version: -1 }));

    if (change === 'missing') rmSync(target);
    const options = { playbooks: [], persistCache: false };
    assert.deepEqual(portable(knowledgeIndex(path, options)), portable(knowledgeIndex(path, { ...options, packagedIndex: false })));
  });
}

test('committed search snapshot matches current bundled sources', () => {
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'tools/search-index.json'), 'utf8')), buildSearchSnapshot(root));
});
