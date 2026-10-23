// Spawn real CLI and hook entrypoints in an isolated home. No agent/provider process.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const args = process.argv.slice(2);

const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;

const root = resolve(option('--source-root', fileURLToPath(new URL('../../', import.meta.url))));

const out = resolve(option('--out', 'dist/e2e/surface-performance/report.json'));

const reference = option('--reference') ? JSON.parse(readFileSync(option('--reference'), 'utf8')) : null;

const git = (...argv) => {
  const result = spawnSync('git', argv, { cwd: root, encoding: 'utf8' });

  return result.status === 0 ? (result.stdout ?? '').trim() : '';
};

const ownsGit = git('rev-parse', '--show-toplevel') === root;

const source = option('--source-revision', ownsGit ? git('rev-parse', 'HEAD') : null);

const work = mkdtempSync(join(tmpdir(), 'cq-surface-'));

const task = '/conquistador outreach Write a cold email to RevOps leads';

const cases = [
  { id: 'cli-brief', file: 'runtime/bin/conquistador.js', args: ['brief', task] },
  { id: 'cli-unrelated', file: 'runtime/bin/conquistador.js', args: ['brief', 'Refactor the email queue handler'] },
  { id: 'hook-relevant', file: 'hooks/conquistador-hook.mjs', args: ['claude', 'prompt'], prompt: task },
  { id: 'hook-unrelated', file: 'hooks/conquistador-hook.mjs', args: ['claude', 'prompt'], prompt: 'Refactor the email queue handler' },
];

try {
  const measurements = [];

  for (const item of cases) {
    const rawMs = [];
    let expected;

    for (let i = 0; i < 7; i++) {
      const cache = join(work, 'cache');
      rmSync(cache, { recursive: true, force: true });
      const start = performance.now();

      const result = spawnSync(process.execPath, [join(root, item.file), ...item.args], {
        cwd: work, encoding: 'utf8', timeout: 30000,
        input: JSON.stringify({ prompt: item.prompt, cwd: work }),
        env: { ...process.env, CONQUISTADOR_HOME: work, CONQUISTADOR_PLAYBOOKS: '', CONQUISTADOR_CACHE: cache, CONQUISTADOR_STATE: join(work, 'state'), CONQUISTADOR_HOOKS: 'on' },
      });

      rawMs.push(performance.now() - start);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '');
      const text = result.stdout.replaceAll(root, '<source>').replaceAll(work, '<home>');
      const sha256 = createHash('sha256').update(text).digest('hex');
      expected ??= { sha256, bytes: Buffer.byteLength(text) };
      assert.equal(sha256, expected.sha256, `${item.id}: nondeterministic output`);
    }

    if (reference) assert.equal(expected.sha256, reference.measurements.find(row => row.id === item.id)?.sha256, `${item.id}: changed output`);
    const ordered = [...rawMs].sort((a, b) => a - b);
    measurements.push({ id: item.id, ...expected, medianMs: ordered[3], p95Ms: ordered[6], rawMs });
    console.log(`${item.id}: ${ordered[3].toFixed(2)} ms`);
  }

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ schema: 'conquistador.surface-performance/v1', source, harnessSha256: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'), node: process.version, platform: process.platform, arch: process.arch, date: new Date().toISOString(), limits: 'Local fresh processes and empty disk cache; no provider calls. Source/home paths normalized only for output comparison.', measurements }, null, 2) + '\n');
} finally { rmSync(work, { recursive: true, force: true }); }
