#!/usr/bin/env node
// E2E: `conquistador update` gets the newest version from an npm registry, the way users will get it.
// A local Verdaccio registry (real registry software, other packages proxied from npmjs.org) holds
// two versions packed from the Git commit: this version and a patch bump. Every detected agent's
// real plugin manager runs inside isolated homes. Your own agent settings are never touched.
//   node tools/e2e/update-latest.mjs [OUT_DIR]
//   CONQUISTADOR_E2E_REF=b560488 node tools/e2e/update-latest.mjs dist/e2e/update-latest-before
// Writes OUT_DIR/report.json. Exit 1 when any check fails. The case IDs (U1–U13) are in
// docs/REVIEW-2026-09-SURFACES.md, Part 5.
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const out = resolve(process.argv[2] ?? join(root, 'dist/e2e/update-latest'));
const v1 = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const v2 = v1.replace(/^(\d+)\.(\d+)\.(\d+).*$/, (_, major, minor, patch) => `${major}.${minor}.${Number(patch) + 1}`);
// CONQUISTADOR_E2E_REF packs another commit, for example a negative control from before the change.
const sha = spawnSync('git', ['-C', root, 'rev-parse', `${process.env.CONQUISTADOR_E2E_REF || 'HEAD'}^{commit}`], { encoding: 'utf8' }).stdout.trim();
const dirty = spawnSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' }).stdout.trim() !== '';
const work = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador-e2e-update-')));
const which = command => spawnSync('/bin/sh', ['-c', `command -v ${command}`], { encoding: 'utf8' }).stdout.trim();
const toolDirs = [...new Set(['claude', 'codex', 'cursor-agent', 'copilot', 'grok', 'git', 'npm'].map(which).filter(Boolean).map(dirname))];

const checks = [];
const log = [];
function check(id, name, ok, detail = '') {
  checks.push({ id, name, ok: Boolean(ok), detail });
  console.log(`${ok ? '✓' : '✗'} ${id} ${name}${detail && !ok ? `  ${detail}` : ''}`);
}
function run(command, args, { env, cwd = work, timeout = 600_000 } = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, { env, cwd, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  log.push(`$ ${command} ${args.join(' ')}\n${output.trim()}\n[exit ${result.status}, ${Date.now() - started} ms]\n`);
  return { status: result.status, output, stdout: result.stdout ?? '', ms: Date.now() - started };
}
const tail = (text, lines = 3) => text.trim().split('\n').slice(-lines).join(' | ');
const count = (text, pattern) => (text.match(new RegExp(pattern, 'g')) ?? []).length;
const freePort = () => new Promise(done => { const server = createServer().listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => done(port)); }); });

// The registry.
const port = await freePort();
const registry = `http://127.0.0.1:${port}/`;
const storage = join(work, 'verdaccio');
mkdirSync(storage, { recursive: true });
writeFileSync(join(storage, 'config.yaml'), `storage: ${join(storage, 'storage')}
auth:
  htpasswd:
    file: ${join(storage, 'htpasswd')}
    max_users: 10
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
packages:
  '@forsvn/*':
    access: $all
    publish: $authenticated
  '**':
    access: $all
    proxy: npmjs
web:
  enable: false
log: { type: stdout, format: pretty, level: warn }
`);
const verdaccio = spawn('npx', ['--yes', '--cache', join(work, 'npm-cache-tools'), 'verdaccio@6', '--config', join(storage, 'config.yaml'), '--listen', `127.0.0.1:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
let registryLog = '';
verdaccio.stdout.on('data', chunk => { registryLog += chunk; });
verdaccio.stderr.on('data', chunk => { registryLog += chunk; });
const stop = () => { try { verdaccio.kill(); } catch { /* Already stopped. */ } };
process.on('exit', stop);
let up = false;
for (let attempt = 0; attempt < 120 && !up; attempt += 1) {
  try { up = (await fetch(`${registry}-/ping`)).ok; } catch { await new Promise(done => setTimeout(done, 1000)); }
}
check('R0', `Verdaccio registry on ${registry}`, up, tail(registryLog));
const user = await fetch(`${registry}-/user/org.couchdb.user:e2e`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'e2e', password: `e2e-${port}` }) }).then(response => response.json()).catch(error => ({ error: error.message }));
const npmrc = join(work, 'npmrc');
writeFileSync(npmrc, `registry=${registry}\n//127.0.0.1:${port}/:_authToken=${user.token ?? ''}\n`);
check('R0', 'a registry user can publish', Boolean(user.token), JSON.stringify(user));
const registryEnv = { npm_config_registry: registry, npm_config_userconfig: npmrc };

function isolated(name) {
  const home = join(work, name);
  mkdirSync(join(home, '.cursor'), { recursive: true });
  mkdirSync(join(home, 'acme'), { recursive: true });
  writeFileSync(join(home, 'acme', 'README.md'), '# Acme Invoices\n\nInvoicing for freelance designers.\n');
  const env = { ...process.env, ...registryEnv, npm_config_cache: join(work, `npm-cache-${name}`), HOME: home, XDG_CONFIG_HOME: join(home, '.config'), CLAUDE_CONFIG_DIR: join(home, '.claude'), CODEX_HOME: join(home, '.codex'), CONQUISTADOR_HOME: join(home, '.conquistador'), CURSOR_HOME: join(home, '.cursor'), TERM: 'xterm-256color', PATH: [...toolDirs, dirname(process.execPath), '/usr/bin', '/bin'].join(':') };
  for (const key of ['CONQUISTADOR_PLAYBOOKS', 'CONQUISTADOR_DEBUG', 'CONQUISTADOR_UPDATED_FROM', 'CLAUDECODE', 'CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_CODE_ENTRYPOINT', 'npm_config_prefix']) delete env[key];
  const plugin = join(home, '.conquistador', 'plugin');
  return { home, env, plugin };
}
const pluginVersion = box => { try { return JSON.parse(readFileSync(join(box.plugin, 'package.json'), 'utf8')).version; } catch { return null; } };
const agentVersions = (cli, box) => { try { return JSON.parse(run(cli[0], [...cli.slice(1), 'agents', '--json'], { env: box.env }).stdout).agents.filter(agent => agent.installed).map(agent => agent.version); } catch { return []; } };
const allAt = (versions, value) => versions.length > 0 && versions.every(item => item === value);

// Two packages from a clean clone of the commit, the way npm publish builds them. The npm private
// guard stays in source until the first public release, so the packed copies drop it.
function pack(name, packageVersion) {
  const clone = join(work, name);
  run('git', ['clone', '--quiet', root, clone]);
  run('git', ['-C', clone, 'checkout', '--quiet', sha]);
  const manifest = JSON.parse(readFileSync(join(clone, 'package.json'), 'utf8'));
  delete manifest.private;
  manifest.version = packageVersion;
  writeFileSync(join(clone, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  // The synthetic version changes package bytes; regenerate its plugin integrity inventory.
  const generated = run(process.execPath, ['tools/update-completeness.mjs'], { cwd: clone });

  if (generated.status !== 0) return '';
  const packed = run('npm', ['pack', '--json', '--pack-destination', work, '--cache', join(work, 'npm-cache-pack')], { cwd: clone });
  try { return join(work, JSON.parse(packed.stdout)[0].filename); } catch { return ''; }
}
const tarball1 = pack('clone-1', v1);
const tarball2 = pack('clone-2', v2);
check('R0', `packed ${v1} and ${v2} from ${sha.slice(0, 7)}`, existsSync(tarball1) && existsSync(tarball2));
const publish = tarball => run('npm', ['publish', tarball, '--access', 'public', '--cache', join(work, 'npm-cache-pack')], { env: { ...process.env, ...registryEnv } });

console.log(`Conquistador ${v1} -> ${v2} at ${sha.slice(0, 7)}${dirty ? ' (uncommitted changes are not tested)' : ''}\nWork folder: ${work}\n`);

// Route A: a global install. It starts from a tarball, as a Git install does, before any publication.
const a = isolated('home-a');
const prefix = join(work, 'prefix');
a.env.PATH = `${join(prefix, 'bin')}:${a.env.PATH}`;
const cli = [join(prefix, 'bin', 'conquistador')];
let result = run('npm', ['install', '--global', '--ignore-scripts', '--prefix', prefix, tarball1], { env: a.env });
check('A0', `npm install -g ${v1} (${Math.round(result.ms / 1000)} s)`, result.status === 0 && run(cli[0], ['--version'], { env: a.env }).output.trim() === v1, tail(result.output));

result = run(cli[0], ['add', '--all', '--yes'], { env: a.env });
const agents = agentVersions(cli, a);

check('A0', `add --all --yes installs ${agents.length} agents at ${v1}`, result.status === 0 && allAt(agents, v1), tail(result.output));

result = run(cli[0], ['update'], { env: a.env });
check('U3', 'package not on the registry: one line, reinstall, exit 0', result.status === 0 && /not on the npm registry yet\. Reinstalling/.test(result.output) && /Updated to /.test(result.output) && allAt(agentVersions(cli, a), v1), tail(result.output));

result = publish(tarball1);
check('R1', `publish ${v1}`, result.status === 0, tail(result.output));
result = run(cli[0], ['update'], { env: a.env });
check('U4', 'same version on the registry: "latest", no install, exit 0', result.status === 0 && new RegExp(`${v1.replaceAll('.', '\\.')} is the latest version`).test(result.output) && !/Updating /.test(result.output) && allAt(agentVersions(cli, a), v1), tail(result.output));

result = publish(tarball2);
check('R2', `publish ${v2}`, result.status === 0, tail(result.output));
result = run(cli[0], ['update', '--dry-run'], { env: a.env });

check('U10', '--dry-run previews the registry check and changes nothing', result.status === 0 && /Would check the configured registry/.test(result.output) && /Preview only/.test(result.output) && run(cli[0], ['--version'], { env: a.env }).output.trim() === v1 && pluginVersion(a) === v1, tail(result.output));

const locked = [join(prefix, 'lib', 'node_modules', '@forsvn'), join(prefix, 'bin')];
for (const folder of locked) chmodSync(folder, 0o555);
result = run(cli[0], ['update'], { env: a.env });
for (const folder of locked) chmodSync(folder, 0o755);
check('U6', 'npm cannot write the prefix: error lines, retry command, exit 1', result.status === 1 && /Could not install/.test(result.output) && /To retry: npm install/.test(result.output) && !/\n\s+at .+:\d+:\d+/.test(result.output), tail(result.output, 4));
check('U6', `${v1} and the agents are unchanged`, run(cli[0], ['--version'], { env: a.env }).output.trim() === v1 && pluginVersion(a) === v1 && allAt(agentVersions(cli, a), v1));

const closed = await freePort();
result = run(cli[0], ['update'], { env: { ...a.env, npm_config_registry: `http://127.0.0.1:${closed}/` } });
check('U2', 'registry unreachable: one line, reinstall, exit 0', result.status === 0 && /Could not check for a newer version: .*Reinstalling/.test(result.output) && /Updated to /.test(result.output) && pluginVersion(a) === v1, tail(result.output));

result = run(cli[0], ['update'], { env: a.env });
check('U1', `update installs ${v2} into the same prefix (${Math.round(result.ms / 1000)} s)`, result.status === 0 && run(cli[0], ['--version'], { env: a.env }).output.trim() === v2, tail(result.output, 4));
check('U1', `the new version registers every agent at ${v2}`, pluginVersion(a) === v2 && allAt(agentVersions(cli, a), v2) && agentVersions(cli, a).length === agents.length && new RegExp(`Updated from ${v1.replaceAll('.', '\\.')} to ${v2.replaceAll('.', '\\.')}`).test(result.output), JSON.stringify(agentVersions(cli, a)));
check('U7', 'the new version does not ask the registry again', count(result.output, 'Updating ') === 1 && !/is the latest version|Could not check/.test(result.output), tail(result.output, 4));
// v2 exists only in the local registry, so U1 could only get it through the configured registry.
check('U13', `${v2} is not on npmjs.org, so the update used the configured registry`, run('npm', ['view', `@forsvn/conquistador@${v2}`, 'version', '--registry', 'https://registry.npmjs.org/', '--cache', join(work, 'npm-cache-pack')]).stdout.trim() === '');

// A source checkout is behind the registry: it must not replace any installation.
result = run(process.execPath, [join(root, 'runtime', 'bin', 'conquistador.js'), 'update'], { env: a.env });
check('U9', 'a source checkout prints the install command and changes no installation', result.status === 0 && /is available\. This copy runs from /.test(result.output) && /npm install -g @forsvn\/conquistador/.test(result.output) && run(cli[0], ['--version'], { env: a.env }).output.trim() === v2, tail(result.output, 4));

// Route B: npx, pinned to the older version. No global install may appear.
const b = isolated('home-b');
const prefixB = join(work, 'prefix-b');
mkdirSync(prefixB, { recursive: true });
b.env.npm_config_prefix = prefixB;
const npx = ['npx', '--yes', `@forsvn/conquistador@${v1}`];

result = run(npx[0], [...npx.slice(1), 'add', '--all', '--yes'], { env: b.env });

check('B0', `npx @forsvn/conquistador@${v1} add --all --yes`, result.status === 0 && pluginVersion(b) === v1, tail(result.output));
result = run(npx[0], [...npx.slice(1), 'update'], { env: b.env });
check('U8', `npx update registers ${v2} through npx`, result.status === 0 && pluginVersion(b) === v2 && allAt(agentVersions(npx, b), v2), tail(result.output, 4));
check('U8', 'no global install was created', !existsSync(join(prefixB, 'lib', 'node_modules', '@forsvn')) && !existsSync(join(prefixB, 'bin', 'conquistador')));

for (const [box, command] of [[a, cli], [b, npx]]) run(command[0], [...command.slice(1), 'remove'], { env: box.env });
stop();

const report = { schema: 'conquistador.e2e.update-latest/v1', at: new Date().toISOString(), from: v1, to: v2, sha, dirty, node: process.version, platform: `${process.platform}-${process.arch}`, agents: agents.length, work, checks, ok: checks.every(item => item.ok) };
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(out, 'commands.log'), log.join('\n'));
writeFileSync(join(out, 'registry.log'), registryLog);
console.log(`\n${report.ok ? 'PASS' : 'FAIL'} ${checks.filter(item => item.ok).length}/${checks.length}: ${join(out, 'report.json')}`);
process.exit(report.ok ? 0 : 1);
