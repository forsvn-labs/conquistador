import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PassThrough, Readable, Writable } from 'node:stream';
import { createMcpHandler, createMethodAccess, runSkillsMcp, LIMITS } from './skills-mcp.mjs';
import { briefFiles } from './operator-package.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const rpc = (id, method, params = {}) => ({ jsonrpc: '2.0', id, method, params });
const start = [rpc(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } }), { jsonrpc: '2.0', method: 'notifications/initialized' }];
const call = (id, name, args = {}) => rpc(id, 'tools/call', { name, arguments: args });
function temporary(t) {
  const path = mkdtempSync(join(tmpdir(), 'conquistador-mcp-'));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}
function cold(t) {
  const path = temporary(t);
  for (const file of ['package.json', 'runtime/bin/conquistador.js', ...briefFiles]) {
    const target = join(path, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(root, file), target);
  }
  cpSync(join(root, 'skills'), join(path, 'skills'), { recursive: true });
  assert.equal(existsSync(join(path, 'node_modules')), false);
  assert.equal(existsSync(join(path, 'runtime/lib')), false);
  return path;
}
async function run(path, input, args = ['mcp']) {
  const child = spawn(process.execPath, [join(path, 'runtime/bin/conquistador.js'), ...args], { env: { PATH: process.env.PATH }, stdio: ['pipe', 'pipe', 'pipe'] });
  const out = [], err = [];
  child.stdout.on('data', chunk => out.push(chunk));
  child.stderr.on('data', chunk => err.push(chunk));
  child.stdin.on('error', () => {});
  child.stdin.end(input);
  const timer = setTimeout(() => child.kill('SIGKILL'), 7000);
  const code = await new Promise(resolve => child.on('close', resolve));
  clearTimeout(timer);
  const stdout = Buffer.concat(out).toString('utf8');
  return { code, stderr: Buffer.concat(err).toString('utf8'), stdout, messages: stdout.trim() ? stdout.trim().split('\n').map(line => JSON.parse(line)) : [] };
}
const lines = messages => messages.map(message => JSON.stringify(message)).join('\n') + '\n';

test('cold spawned stdio lists methods and reads the parent, outcome, and routing contract', async t => {
  const path = cold(t);
  const result = await run(path, lines([...start, rpc(2, 'tools/list'), call(3, 'conquistador_methods'), call(4, 'conquistador_files', { method: 'conquistador' }), call(5, 'conquistador_read', { path: 'conquistador/SKILL.md' }), call(6, 'conquistador_read', { path: 'conquistador/commands/copy/COMMAND.md' }), call(7, 'conquistador_read', { path: 'conquistador/routing-contract.json' })]));
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
  assert.equal(result.messages.length, 7);
  assert.match(result.messages[0].result.instructions, /conquistador_brief/);
  assert.deepEqual(result.messages[1].result.tools.map(tool => tool.name), ['conquistador_brief', 'conquistador_check', 'conquistador_verify', 'conquistador_score', 'conquistador_search', 'conquistador_methods', 'conquistador_files', 'conquistador_read']);
  const methods = JSON.parse(result.messages[2].result.content[0].text);
  assert.equal(methods.guide, 'conquistador/SKILL.md');
  // 35 method commands plus 6 meta commands (init, pin, check, connect, review, doctor).
  assert.equal(methods.methods.length, 41);
  assert.equal(methods.plays.length, 21);
  assert.ok(JSON.parse(result.messages[3].result.content[0].text).files.includes('conquistador/standards/safety.md'));
  assert.match(result.messages[4].result.content[0].text, /^name: conquistador$/m);
  assert.match(result.messages[5].result.content[0].text, /name: copy/);
  const routing = JSON.parse(result.messages[6].result.content[0].text);
  assert.equal(routing.schemaVersion, 'conquistador.routing-contract/v1');
  assert.equal(Object.keys(routing.methods).length, 41);
});

test('contained reads refuse traversal, symlinks, hidden files, binary and oversized resources', t => {
  const path = temporary(t);
  mkdirSync(join(path, 'skills/conquistador/commands/test/references'), { recursive: true });
  const write = (name, body) => writeFileSync(join(path, 'skills/conquistador/commands/test', name), body);
  write('COMMAND.md', 'valid');
  write('references/utf8.md', 'Tiếng Việt');
  write('large.md', Buffer.alloc(LIMITS.file + 1, 97));
  write('boundary.md', 'é'.repeat(LIMITS.file / 2));
  write('invalid.md', Buffer.from([0xc3, 0x28]));
  write('binary.md', 'a\0b');
  write('.secret.md', 'secret');
  write('secret.env', 'secret');
  writeFileSync(join(path, 'outside.md'), 'secret');
  symlinkSync(join(path, 'outside.md'), join(path, 'skills/conquistador/commands/test/link.md'));
  symlinkSync(path, join(path, 'skills/conquistador/commands/test/escape'));
  const access = createMethodAccess(join(path, 'skills'));
  assert.equal(access.read('conquistador/commands/test/references/utf8.md'), 'Tiếng Việt');
  assert.equal(Buffer.byteLength(access.read('conquistador/commands/test/boundary.md')), LIMITS.file);
  for (const name of ['../outside.md', '/etc/passwd', 'conquistador/commands/test/../../../../outside.md', 'conquistador/commands/test//COMMAND.md', 'conquistador/commands/test/./COMMAND.md', 'conquistador\\commands\\test\\COMMAND.md', 'conquistador/commands/test/%2e%2e/outside.md', 'conquistador/commands/test/.secret.md', 'conquistador/commands/test/secret.env', 'conquistador/commands/test/link.md', 'conquistador/commands/test/escape/outside.md', 'conquistador/commands/test/large.md', 'conquistador/commands/test/invalid.md', 'conquistador/commands/test/binary.md', 'conquistador/commands/test/references', `conquistador/commands/test/${'a'.repeat(401)}.md`]) assert.throws(() => access.read(name), name);
  assert.ok(!access.files('test').files.includes('conquistador/commands/test/link.md'));
  assert.throws(() => access.files('../test'));
  rmSync(join(path, 'skills/conquistador/commands/test/references'), { recursive: true });
  symlinkSync(path, join(path, 'skills/conquistador/commands/test/references'));
  assert.throws(() => access.read('conquistador/commands/test/references/outside.md'));
});

// Failure modes: a long-lived app indexes a valid playbook, then that file or an ancestor
// becomes a symlink, binary, invalid UTF-8, or oversized. Brief packing must enforce the
// same boundary as conquistador_read, including when the ranking index is already warm.
test('warm briefs refuse resources that cease to be bounded regular text files', async t => {
  for (const kind of ['file-symlink', 'directory-symlink', 'binary', 'invalid-utf8', 'oversized']) {
    await t.test(kind, t => {
      const path = cold(t);
      const handle = createMcpHandler({ root: join(path, 'skills'), requireInitialize: false, hosted: true, bundledOnly: true });
      const brief = () => handle(call(1, 'conquistador_brief', { task: 'Write the first cold email to RevOps leads at B2B SaaS companies.' })).result;
      const before = brief();
      assert.ok(!before.isError);
      const selected = before.structuredContent.inlined.find(item => item.path.includes('/references/'));
      assert.ok(selected, 'The fixture must inline a real selected playbook.');
      const target = join(path, selected.path);
      const outside = join(path, 'outside');
      mkdirSync(outside);
      const canary = 'PRIVATE_OUTSIDE_BUNDLE_CANARY';
      if (kind === 'file-symlink') {
        const secret = join(outside, 'secret.md');
        writeFileSync(secret, canary);
        rmSync(target);
        symlinkSync(secret, target);
      } else if (kind === 'directory-symlink') {
        cpSync(dirname(target), outside, { recursive: true });
        writeFileSync(join(outside, target.split(/[\\/]/).at(-1)), canary);
        rmSync(dirname(target), { recursive: true });
        symlinkSync(outside, dirname(target), process.platform === 'win32' ? 'junction' : 'dir');
      } else {
        writeFileSync(target, kind === 'binary' ? `${canary}\0binary` : kind === 'invalid-utf8' ? Buffer.from([0xc3, 0x28]) : 'x'.repeat(LIMITS.file + 1));
      }
      const read = handle(call(2, 'conquistador_read', { path: selected.path })).result;
      assert.equal(read.isError, true, 'Direct reads must refuse this resource.');
      const after = brief();
      assert.doesNotMatch(JSON.stringify(after), new RegExp(canary));
      assert.ok(!after.isError, 'Other safe playbooks must remain usable.');
      assert.ok(after.structuredContent.readNow.includes(selected.path));
      assert.ok(!after.structuredContent.inlined.some(item => item.path === selected.path));
      assert.ok(after.content[0].text.includes(JSON.stringify({ id: selected.path, status: 'unavailable' })));
    });
  }
});

test('protocol errors are bounded and do not echo supplied paths, secrets, or invalid IDs', async t => {
  const path = cold(t);
  const result = await run(path, lines([
    rpc(0, 'tools/list'), ...start,
    call(2, 'conquistador_read', { path: '../../secret-token.md' }),
    call(3, 'conquistador_files', { method: '../secret-token' }),
    call(4, 'conquistador_read', { path: `test/${'x'.repeat(401)}.md` }),
    call(5, 'conquistador_read', { path: 'conquistador/commands/copy/COMMAND.md', constructor: 'secret-token' }),
    rpc(null, 'ping'), rpc({}, 'ping'), rpc('x'.repeat(129), 'ping'), [],
    { jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 2 } }, rpc(6, 'ping'),
  ]) + '{secret-token}\n' + '{"jsonrpc":"2.0","id":1e400,"method":"ping"}\n');
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
  assert.doesNotMatch(result.stdout, /secret-token|x{129}/);
  assert.equal(result.messages[0].error.code, -32600);
  assert.equal(result.messages[2].result.isError, true);
  assert.ok(result.messages.some(message => message.error?.code === -32602));
  assert.ok(result.messages.some(message => message.error?.code === -32700));
  assert.deepEqual(result.messages.find(message => message.id === 6).result, {});
});

test('oversized JSONL, invalid UTF8, incomplete EOF and unknown CLI flags fail without stdout noise', async t => {
  const path = cold(t);
  const large = await run(path, 'x'.repeat(LIMITS.request + 1));
  assert.equal(large.messages.length, 1);
  assert.equal(large.messages[0].error.code, -32600);
  const invalid = await run(path, Buffer.from([0xc3, 0x28, 10]));
  assert.equal(invalid.messages[0].error.code, -32700);
  const eof = await run(path, '{');
  assert.equal(eof.messages[0].error.code, -32700);
  const flag = await run(path, '', ['mcp', '--unexpected-secret']);
  assert.equal(flag.code, 2);
  assert.equal(flag.stdout, '');
  assert.doesNotMatch(flag.stderr, /unexpected-secret/);
});

test('explicit --url still dispatches the existing runtime module', t => {
  const path = cold(t);
  mkdirSync(join(path, 'runtime/lib'));
  // Dispatch sentinel only: no HTTP service or provider behavior is simulated.
  writeFileSync(join(path, 'runtime/lib/main.js'), 'export async function runCli(args) { process.stdout.write(JSON.stringify(args)); return 0; }');
  for (const args of [['mcp', '--url', 'http://127.0.0.1:4317'], ['mcp', '--url=http://127.0.0.1:4317']]) {
    const result = spawnSync(process.execPath, [join(path, 'runtime/bin/conquistador.js'), ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.stdout), args);
  }
});


test('fragmented UTF8 requests and output closure complete without background work', async () => {
  const input = new PassThrough();
  const chunks = [];
  const output = new Writable({ write(chunk, encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
  const running = runSkillsMcp({ input, output });
  const bytes = Buffer.from(lines([...start, rpc('Việt', 'ping')]));
  for (const byte of bytes) input.write(Buffer.from([byte]));
  input.end();
  await running;
  const responses = Buffer.concat(chunks).toString('utf8').trim().split('\n').map(JSON.parse);
  assert.equal(responses.at(-1).id, 'Việt');
  const closedInput = new PassThrough();
  const closedOutput = new Writable({ write(chunk, encoding, callback) { callback(new Error('closed')); } });
  const closed = runSkillsMcp({ input: closedInput, output: closedOutput });
  closedInput.write(lines(start));
  await closed;
  assert.equal(closedInput.destroyed, true);
});

// Failure mode: a valid near-limit frame arrives one byte at a time. Re-copying the
// accumulated prefix on every chunk makes a 64 KiB request copy about 2 GiB.
test('fragmented near-limit frames require only linear copying and preserve UTF8', async t => {
  const bytes = Buffer.from(lines([rpc('fragmented', 'ping', { padding: 'é'.repeat(30_000) })]));
  assert.ok(bytes.length < LIMITS.request);
  const input = Readable.from((function* () {
    for (let i = 0; i < bytes.length; i++) yield bytes.subarray(i, i + 1);
  })());
  let copied = 0;
  const concat = Buffer.concat;
  t.mock.method(Buffer, 'concat', function(chunks, length) {
    copied += length ?? chunks.reduce((total, chunk) => total + chunk.length, 0);
    return concat(chunks, length);
  });
  const output = [];
  await runSkillsMcp({ input, output: new Writable({ write(chunk, encoding, callback) { output.push(chunk.toString()); callback(); } }) });
  assert.deepEqual(JSON.parse(output.join('')), { jsonrpc: '2.0', id: 'fragmented', result: {} });
  assert.ok(copied <= bytes.length * 2, `${bytes.length} input bytes caused ${copied} copied bytes`);
});

test('framing preserves message boundaries, byte limits, and incomplete EOF errors', async t => {
  const collect = async (bytes, size) => {
    const input = Readable.from((function* () {
      for (let offset = 0; offset < bytes.length; offset += size) yield bytes.subarray(offset, offset + size);
    })());
    const output = [];
    await runSkillsMcp({ input, output: new Writable({ write(chunk, encoding, done) { output.push(chunk.toString()); done(); } }) });
    return output.join('').trim().split('\n').map(JSON.parse);
  };
  for (const size of [1, 7, 65_536]) await t.test(`multiple frames in ${size}-byte chunks`, async () => {
    const result = await collect(Buffer.from(lines([...start, rpc('Tiếng Việt', 'ping'), rpc(4, 'ping')])), size);
    assert.deepEqual(result.map(item => item.id), [1, 'Tiếng Việt', 4]);
    assert.deepEqual(result.at(-1).result, {});
  });
  await t.test('the exact byte limit is accepted and the next byte stops the stream', async () => {
    const empty = JSON.stringify(rpc(7, 'ping', { padding: '' }));
    const padding = 'x'.repeat(LIMITS.request - Buffer.byteLength(empty));
    const exact = JSON.stringify(rpc(7, 'ping', { padding }));
    assert.equal(Buffer.byteLength(exact), LIMITS.request);
    assert.deepEqual(await collect(Buffer.from(`${exact}\n`), 64), [{ jsonrpc: '2.0', id: 7, result: {} }]);
    const over = await collect(Buffer.from(`${exact} \n${lines([rpc(8, 'ping')])}`), 64);
    assert.equal(over.length, 1);
    assert.equal(over[0].error.code, -32600);
  });
  await t.test('incomplete fragmented EOF stays an error', async () => {
    const result = await collect(Buffer.from(JSON.stringify(rpc(8, 'ping'))), 1);
    assert.equal(result.length, 1);
    assert.equal(result[0].error.code, -32700);
  });
});

test('resource enumeration and encoded responses enforce their own limits', async t => {
  const path = temporary(t);
  mkdirSync(join(path, 'skills/test'), { recursive: true });
  writeFileSync(join(path, 'skills/test/SKILL.md'), 'test');
  for (let i = 0; i < LIMITS.files; i++) writeFileSync(join(path, 'skills/test', `file-${i}.md`), 'test');
  assert.throws(() => createMethodAccess(join(path, 'skills')).files('test'));
  writeFileSync(join(path, 'skills/test/escaped.md'), '\x01'.repeat(LIMITS.file));
  const input = new PassThrough();
  const chunks = [];
  const output = new Writable({ write(chunk, encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
  const running = runSkillsMcp({ input, output, root: join(path, 'skills') });
  input.end(lines([...start, call(2, 'conquistador_read', { path: 'test/escaped.md' }), rpc(3, 'ping')]));
  await running;
  const responses = Buffer.concat(chunks).toString('utf8').trim().split('\n').map(JSON.parse);
  assert.equal(responses[1].result.isError, true);
  assert.deepEqual(responses[2].result, {});
});

test('a blocked stdout writer stops within its deadline without accumulating requests', async () => {
  const input = new PassThrough();
  let writes = 0;
  const output = new Writable({ write() { writes++; } });
  const running = runSkillsMcp({ input, output });
  input.end(lines([...start, ...Array.from({ length: 20 }, (_, i) => rpc(i + 2, 'tools/list'))]));
  await running;
  assert.equal(writes, 1);
  assert.equal(input.destroyed, true);
  assert.equal(output.destroyed, true);
});

test('initialization negotiates a supported version for older and unknown client versions', async t => {
  const path = cold(t);
  for (const protocolVersion of ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25', '2099-01-01']) {
    const initialization = rpc(1, 'initialize', { protocolVersion, capabilities: {}, clientInfo: { name: 'test', version: '1' } });
    const result = await run(path, lines([initialization, start[1], rpc(2, 'tools/list')]));
    assert.equal(result.code, 0);
    assert.equal(result.stderr, '');
    assert.equal(result.messages[0].result.protocolVersion, protocolVersion === '2099-01-01' ? '2025-11-25' : protocolVersion);
    assert.equal(result.messages[1].result.tools.length, 8);
  }
});


test('bundled iOS resources with internal spaces are listed and readable, but ambiguous segments are refused', () => {
  const access = createMethodAccess();
  const files = access.files('build').files;
  const spacedResources = [
    'App NameUITests/App_NameUITests.swift',
    'App NameUITests/App_NameUITestsLaunchTests.swift',
    'App NameTests/App_NameTests.swift',
    'App Name.xcodeproj/project.pbxproj',
    'App Name/Item.swift',
    'App Name/App_NameApp.swift',
    'App Name/ContentView.swift',
    'App Name/Assets.xcassets/Contents.json',
    'App Name/Assets.xcassets/AppIcon.appiconset/Contents.json',
    'App Name/Assets.xcassets/AccentColor.colorset/Contents.json',
    'App Name.xcodeproj/project.xcworkspace/contents.xcworkspacedata',
  ].map(path => `conquistador/commands/build/references/modes/ios/template/${path}`);
  for (const path of spacedResources) {
    assert.ok(files.includes(path), path);
    assert.ok(access.read(path).length > 0);
  }
  for (const path of ['conquistador/commands/build/references/modes/ios/template/ App Name/ContentView.swift', 'conquistador/commands/build/references/modes/ios/template/App Name /ContentView.swift', 'conquistador/commands/build/references/modes/ios/template/App Name./ContentView.swift', 'conquistador/commands/build/references/modes/ios/template/../SKILL.md']) assert.throws(() => access.read(path), path);
});
