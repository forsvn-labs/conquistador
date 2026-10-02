import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOT_PACK_MANIFEST, buildBotPack } from './bot-pack.mjs';
import { spawnCommand } from './spawn.mjs';

const repo = resolve(fileURLToPath(new URL('../', import.meta.url)));

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function fixture(t) {
  const directory = fs.mkdtempSync(join(tmpdir(), 'conquistador-bot-test-'));
  const root = join(directory, 'source');
  const home = join(directory, 'home');
  const privateRoot = join(directory, 'private');
  const out = join(directory, 'pack');

  const env = {
    CONQUISTADOR_HOME: home, CONQUISTADOR_CACHE: join(directory, 'cache'),
    CONQUISTADOR_PLAYBOOKS: privateRoot,
  };

  const original = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }

    fs.rmSync(directory, { recursive: true, force: true });
  });
  fs.mkdirSync(home);
  fs.mkdirSync(privateRoot);
  fs.writeFileSync(join(privateRoot, 'synthetic.md'), '# Synthetic private playbook\nSYNTHETIC_PRIVATE_BOT_MARKER\n');

  for (const method of ['conquistador', 'write-copy']) fs.mkdirSync(join(root, 'skills', method), { recursive: true });
  fs.writeFileSync(join(root, 'skills/conquistador/SKILL.md'), '# Synthetic parent\n');
  fs.writeFileSync(join(root, 'skills/write-copy/SKILL.md'), '# Synthetic copy method\n');
  fs.writeFileSync(join(root, 'skills/write-copy/reference.md'), '# Synthetic reference\nRead the supplied facts.\n');
  fs.writeFileSync(join(root, 'skills/conquistador/routing-contract.json'), JSON.stringify({
    schemaVersion: 'conquistador.routing-contract/v1', parentPath: 'skills/conquistador',
    methods: { 'write-copy': {
      name: 'write-copy', path: 'skills/write-copy/SKILL.md', label: 'Write copy', description: 'Write synthetic copy.',
      requiredResources: [], conditionalResources: [], optionalResources: [], intents: [], exclusions: [],
    } },
  }));
  const build = options => buildBotPack(out, { root, ...options });

  const invoke = (args = [], overrides = {}) => {
    const command = spawnCommand(process.execPath, [join(repo, 'runtime/bin/conquistador.js'), 'bot', '--out', out, ...args]);

    return spawnSync(command.file, command.args, { ...command.options, encoding: 'utf8', env: { ...process.env, ...env, ...overrides } });
  };

  return { directory, root, home, privateRoot, out, build, invoke };
}

function snapshot(directory) {
  const walk = (path, prefix = '') => fs.readdirSync(path).sort().flatMap(name => {
    const key = prefix ? `${prefix}/${name}` : name;
    const absolute = join(path, name);
    const stat = fs.lstatSync(absolute);

    if (stat.isSymbolicLink()) return [[key, `symlink:${fs.readlinkSync(absolute)}`]];

    return stat.isDirectory() ? [[`${key}/`, 'directory'], ...walk(absolute, key)] : [[key, sha256(fs.readFileSync(absolute))]];
  });

  return walk(directory);
}

function checkPack(out, result) {
  const manifest = JSON.parse(fs.readFileSync(join(out, BOT_PACK_MANIFEST), 'utf8'));
  assert.equal(manifest.schemaVersion, 'conquistador.bot-pack/v1');
  assert.deepEqual(manifest.knowledgeFiles, result.files);
  assert.equal(manifest.users, result.users);
  assert.deepEqual(fs.readdirSync(join(out, 'knowledge')).sort(), [...result.files].sort());
  assert.deepEqual(snapshot(out).filter(([key]) => !key.endsWith('/')).map(([key]) => key).sort(),
    [BOT_PACK_MANIFEST, ...manifest.files.map(file => file.path)].sort());

  for (const file of manifest.files) assert.equal(file.sha256, sha256(fs.readFileSync(join(out, file.path))));
  const readme = fs.readFileSync(join(out, 'README.md'), 'utf8');
  assert.deepEqual([...readme.matchAll(/^- knowledge\/(.+)$/gm)].map(match => match[1]), result.files);
  assert.match(readme, new RegExp(`\\(${result.files.length} files`));
  assert.doesNotMatch(readme, /Upload every file/);
  assert.match(readme, /does not remove files already uploaded/);

  return readme;
}

function noTemporaryOutputs(directory) {
  assert.deepEqual(fs.readdirSync(directory).filter(name => name.startsWith('.conquistador-bot-')), []);
}

test('default private export has an exact manifest and upload allowlist', t => {
  const { out, build, directory } = fixture(t);
  const result = build();
  assert.equal(result.users, 1);
  assert.equal(result.files.length, 13);
  assert.match(fs.readFileSync(join(out, 'knowledge/99-your-playbooks.md'), 'utf8'), /SYNTHETIC_PRIVATE_BOT_MARKER/);
  assert.match(checkPack(out, result), /including your private playbooks/);

  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(out).mode & 0o777, 0o700);
    assert.equal(fs.statSync(join(out, 'knowledge/99-your-playbooks.md')).mode & 0o777, 0o600);
  }

  noTemporaryOutputs(directory);
});

test('private then no-private replaces the complete pack and reports only included files', t => {
  const { out, build, directory } = fixture(t);
  build();
  const result = build({ includeUser: false });
  assert.equal(result.users, 0);
  assert.equal(result.files.length, 12);
  assert.equal(fs.existsSync(join(out, 'knowledge/99-your-playbooks.md')), false);
  assert.doesNotMatch(fs.readFileSync(join(out, 'knowledge/00-index.md'), 'utf8'), /99-your-playbooks|private playbooks/);
  const readme = checkPack(out, result);
  assert.match(readme, /No private playbooks are included/);
  assert.doesNotMatch(readme, /including your private playbooks|99-your-playbooks/);
  noTemporaryOutputs(directory);
});

test('two identical exports are byte-identical, with and without private files', t => {
  const { out, build, directory } = fixture(t);

  for (const includeUser of [true, false]) {
    const first = build({ includeUser });
    const bytes = snapshot(out);
    assert.deepEqual(build({ includeUser }), first);
    assert.deepEqual(snapshot(out), bytes);
  }

  noTemporaryOutputs(directory);
});

test('CLI no-private refresh excludes old files and private-count notices', t => {
  const { out, invoke } = fixture(t);
  const first = invoke();
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /includes 1 private playbooks/);
  const second = invoke(['--no-private']);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /12 files listed in README.md/);
  assert.doesNotMatch(second.stdout, /includes .*private playbooks/);
  assert.equal(fs.existsSync(join(out, 'knowledge/99-your-playbooks.md')), false);
});

for (const change of ['unconfigured', 'missing', 'empty']) {
  test(`CLI rebuild removes private output when its root is ${change}`, t => {
    const { out, invoke, privateRoot } = fixture(t);
    assert.equal(invoke().status, 0);

    if (change === 'missing') fs.rmSync(privateRoot, { recursive: true });

    if (change === 'empty') fs.rmSync(join(privateRoot, 'synthetic.md'));
    const result = invoke([], change === 'unconfigured' ? { CONQUISTADOR_PLAYBOOKS: '' } : {});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(join(out, 'knowledge/99-your-playbooks.md')), false);
    const manifest = JSON.parse(fs.readFileSync(join(out, BOT_PACK_MANIFEST), 'utf8'));
    assert.equal(manifest.users, 0);
    checkPack(out, { files: manifest.knowledgeFiles, users: 0 });
  });
}

test('a pre-existing empty output directory can be used', t => {
  const { out, build } = fixture(t);
  fs.mkdirSync(out);
  checkPack(out, build({ includeUser: false }));
});

for (const modification of ['foreign directory', 'legacy export', 'added root file', 'added knowledge file', 'added directory', 'edited file', 'missing file', 'invalid manifest', 'traversal manifest']) {
  test(`preserves ${modification} instead of overwriting or deleting user data`, t => {
    const { out, build, directory } = fixture(t);

    if (modification === 'foreign directory') {
      fs.mkdirSync(out);
      fs.writeFileSync(join(out, 'mine.md'), 'Keep this personal file.');
    } else {
      build();

      if (modification === 'legacy export') fs.rmSync(join(out, BOT_PACK_MANIFEST));

      if (modification === 'added root file') fs.writeFileSync(join(out, 'mine.md'), 'Keep');

      if (modification === 'added knowledge file') fs.writeFileSync(join(out, 'knowledge/other-private.md'), 'Keep');

      if (modification === 'added directory') fs.mkdirSync(join(out, 'knowledge/empty'));

      if (modification === 'edited file') fs.writeFileSync(join(out, 'SYSTEM-PROMPT.md'), 'Personal edits');

      if (modification === 'missing file') fs.rmSync(join(out, 'SYSTEM-PROMPT.md'));

      if (modification === 'invalid manifest') fs.writeFileSync(join(out, BOT_PACK_MANIFEST), '{}');

      if (modification === 'traversal manifest') {
        const manifest = JSON.parse(fs.readFileSync(join(out, BOT_PACK_MANIFEST), 'utf8'));
        manifest.knowledgeFiles.push('../../private/synthetic.md');
        fs.writeFileSync(join(out, BOT_PACK_MANIFEST), JSON.stringify(manifest));
      }
    }

    const before = snapshot(out);
    assert.throws(() => build({ includeUser: false }), /Cannot replace bot pack/);
    assert.deepEqual(snapshot(out), before);
    noTemporaryOutputs(directory);
  });
}

for (const target of ['destination', 'knowledge', 'file', 'manifest']) {
  test(`refuses a symlink at ${target} without following or changing it`, t => {
    const { out, build, directory } = fixture(t);
    build();

    const path = target === 'destination' ? out : target === 'knowledge' ? join(out, 'knowledge')
      : target === 'manifest' ? join(out, BOT_PACK_MANIFEST) : join(out, 'SYSTEM-PROMPT.md');

    const outside = join(directory, `outside-${target}`);
    fs.renameSync(path, outside);

    try { fs.symlinkSync(outside, path, ['destination', 'knowledge'].includes(target) ? 'junction' : 'file'); }
    catch (error) { if (error.code === 'EPERM') { t.skip('symlink creation requires platform permission');

 return; }

 throw error; }

    const before = snapshot(directory);
    assert.throws(() => build({ includeUser: false }), /Cannot replace bot pack/);
    assert.deepEqual(snapshot(directory), before);
  });
}

for (const existing of [false, true]) {
  test(`interrupted staging cleans partial files and ${existing ? 'preserves the last good pack' : 'leaves no output pack'}`, t => {
    const { out, build, directory } = fixture(t);

    if (existing) build();
    const before = existing ? snapshot(out) : null;
    const original = fs.writeFileSync;

    const mock = t.mock.method(fs, 'writeFileSync', function (path, ...args) {
      if (basename(path) === 'README.md') throw Error('Synthetic interrupted staging');

      return original.call(this, path, ...args);
    });

    assert.throws(() => build(), /Synthetic interrupted staging/);
    mock.mock.restore();
    assert.deepEqual(fs.existsSync(out) ? snapshot(out) : null, before);
    noTemporaryOutputs(directory);
    checkPack(out, build());
  });
}

test('failed promotion rolls back the complete prior export and permits a retry', t => {
  const { out, build, directory } = fixture(t);
  build();
  const before = snapshot(out);
  const original = fs.renameSync;

  const mock = t.mock.method(fs, 'renameSync', function (source, target) {
    if (basename(source).startsWith('.conquistador-bot-stage-') && target === out) throw Error('Synthetic promotion failure');

    return original.call(this, source, target);
  });

  assert.throws(() => build({ includeUser: false }), /Synthetic promotion failure/);
  mock.mock.restore();
  assert.deepEqual(snapshot(out), before);
  noTemporaryOutputs(directory);
  checkPack(out, build({ includeUser: false }));
});

test('a foreign destination appearing during staging is preserved', t => {
  const { out, build, directory } = fixture(t);
  const original = fs.writeFileSync;

  const mock = t.mock.method(fs, 'writeFileSync', function (path, ...args) {
    const result = original.call(this, path, ...args);

    if (basename(path) === BOT_PACK_MANIFEST) {
      fs.mkdirSync(out);
      original(join(out, 'foreign.txt'), 'Keep new data.');
    }

    return result;
  });

  assert.throws(() => build(), /Cannot replace bot pack|destination changed/);
  mock.mock.restore();
  assert.deepEqual(fs.readdirSync(out), ['foreign.txt']);
  assert.equal(fs.readFileSync(join(out, 'foreign.txt'), 'utf8'), 'Keep new data.');
  noTemporaryOutputs(directory);
});

test('failed rollback preserves both a newly occupied destination and the recovery pack', t => {
  const { out, build, directory } = fixture(t);
  build();
  const before = snapshot(out);
  const original = fs.renameSync;

  const mock = t.mock.method(fs, 'renameSync', function (source, target) {
    if (basename(source).startsWith('.conquistador-bot-stage-') && target === out) {
      fs.mkdirSync(out);
      fs.writeFileSync(join(out, 'foreign.txt'), 'Keep new data.');
      throw Error('Synthetic occupied destination');
    }

    return original.call(this, source, target);
  });

  assert.throws(() => build({ includeUser: false }), /Previous output is preserved at/);
  mock.mock.restore();
  assert.equal(fs.readFileSync(join(out, 'foreign.txt'), 'utf8'), 'Keep new data.');
  const recovery = fs.readdirSync(directory).filter(name => name.startsWith('.conquistador-bot-previous-'));
  assert.equal(recovery.length, 1);
  assert.deepEqual(snapshot(join(directory, recovery[0], 'pack')), before);
  assert.equal(fs.readdirSync(directory).some(name => name.startsWith('.conquistador-bot-stage-')), false);
});


test('concurrent edits between recheck and rename are preserved by rollback', t => {
  const { out, build, directory } = fixture(t);
  build();
  const original = fs.renameSync;

  const mock = t.mock.method(fs, 'renameSync', function (source, target) {
    if (source === out) fs.writeFileSync(join(out, 'new-personal-file.md'), 'Keep concurrent edits.');

    return original.call(this, source, target);
  });

  assert.throws(() => build({ includeUser: false }), /Cannot replace bot pack/);
  mock.mock.restore();
  assert.equal(fs.readFileSync(join(out, 'new-personal-file.md'), 'utf8'), 'Keep concurrent edits.');
  assert.match(fs.readFileSync(join(out, 'knowledge/99-your-playbooks.md'), 'utf8'), /SYNTHETIC_PRIVATE_BOT_MARKER/);
  noTemporaryOutputs(directory);
});

test('unsupported bot flags and missing output values do not create an export', t => {
  const { directory, home } = fixture(t);
  const cli = join(repo, 'runtime/bin/conquistador.js');

  for (const args of [['--dry-run'], ['--out'], ['--out='], ['--out', '--no-private'], ['--out', 'first', '--out', 'second']]) {
    const launch = spawnCommand(process.execPath, [cli, 'bot', ...args]);
    const result = spawnSync(launch.file, launch.args, { ...launch.options, cwd: directory, encoding: 'utf8', env: { ...process.env, CONQUISTADOR_HOME: home, CONQUISTADOR_PLAYBOOKS: '' } });

    assert.equal(result.status, 2, result.stderr);
    assert.equal(fs.existsSync(join(directory, 'conquistador-bot')), false);
    assert.equal(fs.existsSync(join(directory, 'first')), false);
  }
});
