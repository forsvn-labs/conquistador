import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkIntegrationReleases, integrationPins, runIntegrationReleases } from './integration-releases.mjs';

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'integration versions '));
  for (const [path, name] of [['hosts/eve/runtime', 'eve'], ['hosts/executor', 'executor']]) {
    mkdirSync(join(directory, path), { recursive: true });
    writeFileSync(join(directory, path, 'package.json'), JSON.stringify({ private: true, dependencies: { [name]: '1.2.3' } }));
    writeFileSync(join(directory, path, 'bun.lock'), '// Synthetic lock bytes for manifest validation.\n');
  }
  return { directory, close: () => rmSync(directory, { recursive: true, force: true }) };
}
const metadata = (name, version = '1.2.3') => new Response(JSON.stringify({ name, version, dist: { integrity: 'sha512-c3ludGhldGlj' } }));

test('offline status identifies exact private pins and lock digests without changing files', async () => {
  const f = fixture();
  try {
    const before = readFileSync(join(f.directory, 'hosts/executor/bun.lock'));
    const pins = integrationPins(f.directory);
    assert.equal(pins[0].packages[0].name, 'eve');
    assert.match(pins[1].lockDigest, /^[a-f0-9]{64}$/);
    let output = '';
    assert.equal(await runIntegrationReleases(['status'], { directory: f.directory, stdout: { write: text => { output += text; } } }), 0);
    assert.equal(JSON.parse(output).modified, false);
    assert.deepEqual(readFileSync(join(f.directory, 'hosts/executor/bun.lock')), before);
  } finally { f.close(); }
});

test('release checking treats every different version as review, never an automatic upgrade or downgrade', async () => {
  const f = fixture();
  try {
    const calls = [];
    const result = await checkIntegrationReleases(integrationPins(f.directory), { fetchImpl: async (url, options) => {
      calls.push(url);
      assert.equal(options.redirect, 'error');
      const name = decodeURIComponent(new URL(url).pathname.split('/')[1]);
      return metadata(name, name === 'eve' ? '0.1.0' : '1.2.3');
    } });
    assert.equal(result[0].packages[0].state, 'review-required');
    assert.equal(result[1].packages[0].state, 'current');
    assert.ok(calls.every(url => url.startsWith('https://registry.npmjs.org/')));
  } finally { f.close(); }
});

test('ranges, git dependencies and publication-enabled manifests fail closed', () => {
  const f = fixture();
  try {
    const path = join(f.directory, 'hosts/eve/runtime/package.json');
    for (const manifest of [
      { private: true, dependencies: { eve: '^1.2.3' } },
      { private: true, dependencies: { eve: 'github:vercel/eve' } },
      { private: false, dependencies: { eve: '1.2.3' } },
      { private: true, dependencies: { other: '1.2.3' } },
    ]) {
      writeFileSync(path, JSON.stringify(manifest));
      assert.throws(() => integrationPins(f.directory));
    }
  } finally { f.close(); }
});

test('malformed, oversized, mismatched and failed registry replies stay unknown and redact errors', async () => {
  const f = fixture();
  try {
    for (const fetchImpl of [
      async () => metadata('wrong-package'),
      async () => new Response('not-json'),
      async () => new Response('x'.repeat(512 * 1024 + 1)),
      async () => { throw new Error('private-proxy-token'); },
    ]) {
      const result = await checkIntegrationReleases(integrationPins(f.directory), { fetchImpl });
      assert.ok(result.every(module => module.packages[0].state === 'unknown'));
      assert.ok(!JSON.stringify(result).includes('private-proxy-token'));
    }
  } finally { f.close(); }
});

test('the registry deadline bounds a transport that ignores cancellation', async () => {
  const f = fixture();
  try {
    const result = await checkIntegrationReleases(integrationPins(f.directory), { timeoutMs: 20, fetchImpl: () => new Promise(() => {}) });
    assert.ok(result.every(module => module.packages[0].state === 'unknown'));
  } finally { f.close(); }
});

test('help and invalid arguments do not require optional packages or read a supplied URL', async () => {
  let errors = '';
  const io = { directory: '/does-not-exist', stdout: { write() {} }, stderr: { write: text => { errors += text; } } };
  assert.equal(await runIntegrationReleases(['--help'], io), 0);
  assert.equal(await runIntegrationReleases(['check-updates', '--url', 'https://example.invalid'], io), 2);
  assert.ok(!errors.includes('example.invalid'));
});
