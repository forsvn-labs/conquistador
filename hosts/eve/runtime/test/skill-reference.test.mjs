// Real pinned Eve sandbox, with synthetic reference files and no model or provider account.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import readSkillFile from '../agent/tools/read_skill_file.ts';

test('skill references retain exact text and enforce containment and size in the pinned Eve sandbox', async t => {
  const require = createRequire(import.meta.url);
  const implementation = new URL('dist/src/execution/sandbox/bindings/just-bash-runtime.js',
    pathToFileURL(require.resolve('eve/package.json')));
  const { createBashSandbox, createJustBashHandle } = await import(implementation.href);
  const { ContextContainer, contextStorage } = await import(new URL('../../../context/container.js', implementation));
  const scope = new ContextContainer();
  const work = await mkdtemp(join(tmpdir(), 'eve-skill-reference-'));
  t.after(() => rm(work, { recursive: true, force: true }));
  const provider = await createBashSandbox({ autoInstall: false, rootPath: join(work, 'filesystem'),
    storagePath: join(work, 'state'), sessionKey: 'skill-reference-acceptance',
    host: { resolveProjectPath: path => new URL(path, import.meta.url).pathname,
      loadOptionalPackage: input => input.importModule() } });
  t.after(() => provider.dispose());
  const { sandbox } = createJustBashHandle(provider);
  const context = { getSandbox: async () => sandbox, abortSignal: new AbortController().signal };
  const readReference = path => contextStorage.run(scope,
    () => readSkillFile.execute({ skill: 'conquistador', path }, context));
  const home = (await sandbox.run({ command: 'printf "%s" "$HOME"' })).stdout;
  assert.ok(home.startsWith('/'));
  const base = `${home}/.agents/skills/conquistador`;
  const samples = {
    'data.json': '{\n  "message": "Keep exact bytes"\n}\n',
    'data.csv': 'name,value\r\n"Hung, Vinh",42\r\n',
    'long.json': JSON.stringify({ content: 'x'.repeat(5000) }),
    'many-lines.txt': 'line\n'.repeat(2500),
    'empty.txt': '',
    'unicode.md': 'Tiếng Việt 👋\n',
    'boundary.txt': 'x'.repeat(64 * 1024),
  };
  for (const [path, text] of Object.entries(samples)) {
    await sandbox.writeTextFile({ path: `${base}/${path}`, content: text });
  }
  for (const [path, text] of Object.entries(samples)) {
    await t.test(path, async () => {
      assert.deepEqual(await readReference(path),
        { skill: 'conquistador', path, text });
    });
  }
  await sandbox.writeTextFile({ path: `${base}/oversized.txt`, content: 'x'.repeat(64 * 1024 + 1) });
  await assert.rejects(readReference('oversized.txt'), /64 KiB/);
  await sandbox.writeTextFile({ path: `${home}/outside.txt`, content: 'Must not leave the selected skill.' });
  const linked = await sandbox.run({ command: `ln -s "${home}/outside.txt" "${base}/escape.txt"` });
  assert.equal(linked.exitCode, 0);
  await assert.rejects(readReference('escape.txt'), /contained/);
});
