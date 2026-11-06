import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = resolve(process.argv[2] ?? join(root, 'dist/e2e/renderer-package'));
mkdirSync(out, { recursive: true });
const run = (cmd, args, cwd = root) => {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 4000000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout;
};
const pack = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', out]));
const archive = join(out, pack[0].filename);
const work = mkdtempSync(join(tmpdir(), 'cq-render-package-'));
try {
  writeFileSync(join(work, 'package.json'), '{"private":true}');
  run('bun', ['add', '--ignore-scripts', archive], work);
  const input = join(work, 'flow.mmd'), output = join(work, 'flow.svg');
  writeFileSync(input, 'flowchart LR\n A[Import] --> B[Review]');
  run(process.execPath, [join(work, 'node_modules/@forsvn/conquistador/tools/render-diagram.mjs'), input, output], work);
  assert.match(readFileSync(output, 'utf8'), /<svg/);
  writeFileSync(join(out, 'report.json'), JSON.stringify({ passed: true, archive, integrity: pack[0].integrity, checks: ['tarball installs with Bun', 'installed renderer resolves Pele and produces SVG'] }, null, 2));
  console.log('Installed package renderer passed.');
} finally { rmSync(work, { recursive: true, force: true }); }
