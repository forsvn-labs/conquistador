import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, writeFile, symlink, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareJob } from '../../jobs.mjs';

const source = fileURLToPath(new URL('../../../../', import.meta.url));
const baseOptions = { source, owner: 'test-owner', model: 'test/model' };

test('prepare copies canonical bytes and pinned lock into an unstarted private native app', async t => {
  const parent = await mkdtemp('/private/tmp/conquistador-eve-');
  t.after(() => rm(parent, { recursive: true, force: true }));
  const destination = join(parent, 'app');
  const result = await prepareJob({ ...baseOptions, destination });
  assert.equal(result.started, false);
  assert.equal(result.eve, '0.55.0');
  const skill = 'agent/skills/conquistador/SKILL.md';
  assert.deepEqual(await readFile(join(destination, skill)), await readFile(join(source, 'skills/conquistador/SKILL.md')));
  assert.deepEqual(await readFile(join(destination, 'bun.lock')), await readFile(new URL('../bun.lock', import.meta.url)));
  assert.equal((await stat(destination)).mode & 0o777, 0o700);
  const identity = JSON.parse(await readFile(join(destination, 'identity.json'), 'utf8'));
  assert.equal(identity.owner, baseOptions.owner);
  assert.match(identity.instance, /^[a-f0-9]{32}$/);
  await assert.rejects(stat(join(destination, 'node_modules')), { code: 'ENOENT' });
  await assert.rejects(stat(join(destination, '.eve')), { code: 'ENOENT' });
  await assert.rejects(prepareJob({ ...baseOptions, destination }), { code: 'EEXIST' });
});

test('prepare rejects symlinked skills and invalid destinations before writes', async t => {
  const parent = await mkdtemp('/private/tmp/conquistador-eve-');
  t.after(() => rm(parent, { recursive: true, force: true }));
  const local = join(parent, 'source');
  await mkdir(local);
  await mkdir(join(local, 'skills'));
  await symlink(join(source, 'skills/conquistador'), join(local, 'skills/conquistador'));
  await assert.rejects(prepareJob({ ...baseOptions, source: local, destination: join(parent, 'app') }), /Unsupported source/);
  await assert.rejects(stat(join(parent, 'app')), { code: 'ENOENT' });
  await writeFile(join(local, 'domain-restriction.json'), '{}');
  await assert.rejects(prepareJob({ ...baseOptions, source: local, destination: join(parent, 'app') }), /Domain-restricted/);
  await assert.rejects(prepareJob({ ...baseOptions, destination: 'relative' }), /absolute/);
  await assert.rejects(prepareJob({ ...baseOptions, destination: join(source, 'unwanted-app') }), /outside/);
});
