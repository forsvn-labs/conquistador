import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safePath, sourceZip, committedFiles, packageSource } from './package.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'public source test '));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
  git('init', '-q'); git('config', 'user.name', 'Local Fixture'); git('config', 'user.email', 'fixture@example.invalid');
  writeFileSync(join(root, 'package.json'), JSON.stringify({name:'@forsvn/conquistador',version:'0.1.0',private:true,files:['README.md'],scripts:{prepack:'exit 71'}}));
  writeFileSync(join(root, 'README.md'), '# Synthetic package fixture\n');
  writeFileSync(join(root, '.gitignore'), 'dist/\n');
  git('add', '.'); git('commit', '-qm', 'synthetic source fixture');
  return { root, git, close: () => rmSync(root, { recursive: true, force: true }) };
}
test('ZIP is deterministic across input order and preserves payload and fixed timestamp', () => {
  const a = { bytes: Buffer.from('hello'), mode: '100644' }, b = { bytes: Buffer.from('bye'), mode: '100755' };
  const first = sourceZip({'a.txt':a,'space path/b.sh':b});
  assert.deepEqual(first, sourceZip({'space path/b.sh':b,'a.txt':a}));
  assert.equal(first.readUInt32LE(0),0x04034b50); assert.equal(first.readUInt16LE(12),33);
  assert.equal(first.readUInt32LE(14),0x3610a686); // Known CRC32 of hello.
  assert.ok(first.includes(Buffer.from('hello')));
});
test('ZIP refuses unsafe paths, collisions and symlinks', () => {
  for (const path of ['../private','/root/file','a\\b','a\nb','a/./b','.git/config','a:b']) assert.throws(() => safePath(path));
  assert.equal(safePath('space path/file.md'), 'space path/file.md');
  assert.throws(() => sourceZip({'a':{bytes:Buffer.from(''),mode:'120000'}}));
  assert.throws(() => sourceZip({'a':{bytes:Buffer.from(''),mode:'100644'},'A':{bytes:Buffer.from(''),mode:'100644'}}));
});
test('package reads exact clean Git bytes, ignores lifecycle scripts, writes unbound receipts and reproducible ZIP', () => {
  const f=fixture(), second=mkdtempSync(join(tmpdir(),'second pack '));
  try {
    const before=committedFiles(f.root);
    const first=packageSource(f.root), repeated=packageSource(f.root,second);
    assert.equal(first.sourceCommit,before.commit); assert.equal(first.authority,'UNBOUND'); assert.equal(first.published,false);
    assert.equal(first.humanVerdicts,0); assert.equal(first.liveExecutions,0);
    assert.equal(first.checksums['conquistador-0.1.0.zip'],repeated.checksums['conquistador-0.1.0.zip']);
    assert.match(readFileSync(join(first.output,'SHA256SUMS'),'utf8'),/forsvn-conquistador-0.1.0.tgz/);
    assert.throws(() => packageSource(f.root),/already exists/);
    writeFileSync(join(f.root,'README.md'),'edited');
    assert.throws(() => packageSource(f.root),/pending changes/);
  } finally { f.close(); rmSync(second,{recursive:true,force:true}); }
});
test('tracked symlink is refused without following it', () => {
  const f=fixture();
  try { symlinkSync('README.md',join(f.root,'alias')); f.git('add','.'); f.git('commit','-qm','symlink fixture'); assert.throws(() => committedFiles(f.root),/symlinks/); }
  finally { f.close(); }
});

test('public Codex icon and plugin installation resolve inside their own package', async () => {
  const { fileURLToPath } = await import('node:url');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const manifest = JSON.parse(readFileSync(join(root,'.codex-plugin/plugin.json'),'utf8'));
  assert.equal(manifest.interface.composerIcon,'./assets/conquistador-icon.png');
  assert.equal(manifest.interface.logo,manifest.interface.composerIcon);
  const bytes = readFileSync(join(root,'assets/conquistador-icon.png'));
  assert.deepEqual(bytes.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
  const destination=realpathSync(mkdtempSync(join(tmpdir(),'icon plugin install ')));
  // Installer requires a new destination; the parent directory is test-owned.
  try {
    const installed=join(destination,'plugin');
    execFileSync(process.execPath,[join(root,'tools/install.mjs'),'install','plugin',installed],{stdio:'pipe'});
    assert.deepEqual(readFileSync(join(installed,'assets/conquistador-icon.png')),bytes);
    const staged=JSON.parse(readFileSync(join(installed,'.codex-plugin/plugin.json'),'utf8'));
    assert.equal(staged.interface.logo,manifest.interface.logo);
  } finally { rmSync(destination,{recursive:true,force:true}); }
});
