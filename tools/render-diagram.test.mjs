import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
// Failure modes: invalid/empty input, lost source, overwritten output, unusable SVG.
test('renderer creates SVG, preserves source, rejects errors and existing output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cq-diagram-'));
  const input = join(dir, 'flow.mmd'), output = join(dir, 'flow.svg');
  const run = () => spawnSync(process.execPath, ['tools/render-diagram.mjs', input, output], { encoding: 'utf8' });
  try {
    const source = 'flowchart LR\n A[Import contacts] --> B{Valid?}\n B -->|Yes| C[Review contacts]\n B -->|No| D[Fix the file]';
    writeFileSync(input, source);
    assert.equal(run().status, 0);
    assert.match(readFileSync(output, 'utf8'), /<svg/);
    assert.match(readFileSync(output, 'utf8'), /Review contacts/);
    assert.equal(readFileSync(input, 'utf8'), source);
    const svg = readFileSync(output, 'utf8');
    assert.notEqual(run().status, 0);
    assert.equal(readFileSync(output, 'utf8'), svg);
    rmSync(output);
    for (const bad of ['', 'not a diagram', 'flowchart LR\n A[Unclosed']) {
      writeFileSync(input, bad);
      assert.notEqual(run().status, 0);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Failure: installed package paths can resolve through symlinks (including Bun installs).
test('renderer runs through a linked installation path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cq-diagram-link-'));
  try {
    const link = join(dir, 'render.mjs'), input = join(dir, 'input.mmd'), output = join(dir, 'out.svg');
    symlinkSync(resolve('tools/render-diagram.mjs'), link);
    writeFileSync(input, 'flowchart LR\n A --> B');
    const run = spawnSync(process.execPath, [link, input, output], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.match(readFileSync(output, 'utf8'), /<svg/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('import works when the host entry path no longer exists', () => {
  const code = `process.argv[1] = '/nonexistent/conquistador-host.mjs'; await import(${JSON.stringify(new URL('./render-diagram.mjs', import.meta.url).href)});`;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});
