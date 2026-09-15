import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

test('the installed setup command works before runtime libraries or dependencies are present', () => {
  const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador setup entry ')));
  try {
    const source = join(temporary, 'distribution');
    for (const file of ['package.json', 'runtime/bin/conquistador.js', 'tools/setup.mjs', 'tools/domain-package.mjs']) {
      const target = join(source, file);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(root, file), target);
    }
    assert.equal(existsSync(join(source, 'runtime/lib')), false);
    assert.equal(existsSync(join(source, 'node_modules')), false);
    const run = (...args) => execFileSync(process.execPath, [join(source, 'runtime/bin/conquistador.js'), 'setup', ...args], { encoding: 'utf8' });
    assert.match(run('--help'), /install\|status\|update\|uninstall/);
    const destination = join(temporary, 'missing skill');
    assert.match(run('status', '--path', destination), /Local state: absent/);
    assert.equal(existsSync(destination), false);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
