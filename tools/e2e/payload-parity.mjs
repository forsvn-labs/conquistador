#!/usr/bin/env node
// Compare the installed payload of every local install route between two commits.
//   node tools/e2e/payload-parity.mjs --base REF [--head REF] [--out DIR] [--allow PATH ...]
// Each commit is exported with `git archive`, so only committed bytes count. Every route is built
// from its own commit's tools in a child process with a disposable HOME. The report lists each
// route's file count, tree digest, and every added, removed, or changed path. The command exits 1
// when a route differs, except for paths named with --allow. It does not start a host or model.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const self = fileURLToPath(import.meta.url);

// Install modes from tools/install.mjs. Setup targets, prepared ZIPs, and operators reuse these.
const modes = ['conquistador', 'plugin', 'single-agent', 'squad', 'eve', 'grok-bot'];
const domainModes = ['conquistador', 'plugin', 'single-agent'];
// Domain subsets keep some copies of a shared file and omit others, so subset links are exercised.
const domains = [
  { id: 'domain:diagnosis', allowed: { roles: ['data-diagnosis'], skills: [], workflows: [], tools: ['host-model'], knowledgeHandles: [] } },
  { id: 'domain:video-measure', allowed: { roles: [], skills: ['video', 'social', 'measure', 'creative'], workflows: ['report'], tools: ['host-model'], knowledgeHandles: [] } },
  { id: 'domain:plan', allowed: { roles: [], skills: ['budget', 'shape', 'prioritize', 'convert'], workflows: [], tools: ['host-model'], knowledgeHandles: [] } },
];

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function tree(directory, prefix = '') {
  const files = {};
  for (const name of readdirSync(join(directory, prefix)).sort()) {
    const key = prefix ? `${prefix}/${name}` : name;
    const stat = lstatSync(join(directory, key));
    if (stat.isSymbolicLink()) throw Error(`Symlink in payload: ${key}`);
    if (stat.isDirectory()) Object.assign(files, tree(directory, key));
    else files[key] = sha(readFileSync(join(directory, key)));
  }
  return files;
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 1 << 28, timeout: 300_000, ...options });
  if (result.status !== 0) throw Error(`${command} ${args.join(' ')} failed: ${result.error?.message ?? ''}${result.stderr?.slice(-2000) ?? ''}`);
  return result;
}

// Child mode: build every route from one exported source and write {route: {path: sha256}}.
async function snapshot(source, output) {
  const work = realpathSync(mkdtempSync(join(tmpdir(), 'cq-parity-routes-')));
  const routes = {};
  try {
    const install = (mode, name, extra = []) => {
      const target = join(work, name.replace(/[^a-z0-9-]+/gi, '_'));
      run(process.execPath, [join(source, 'tools/install.mjs'), 'install', mode, target, ...extra], { cwd: work });
      routes[name] = tree(target);
    };
    for (const mode of modes) install(mode, `install:${mode}`);
    for (const domain of domains) {
      const file = join(work, `${domain.id.replace(':', '-')}.json`);
      writeFileSync(file, JSON.stringify({ schemaVersion: 'conquistador.domain-package/v1', agentPackageSchemaVersion: 'conquistador.agent-package/v2', ...domain }));
      for (const mode of domainModes) install(mode, `install:${mode}+${domain.id}`, ['--domain', file]);
    }
    // Local MCP connector bundle. connector.json holds machine paths, so only the bundle is compared.
    const { stageMcp } = await import(pathToFileURL(join(source, 'tools/setup-mcp.mjs')));
    const mcp = join(work, 'mcp');
    stageMcp(mcp, join(work, 'mcp-destination'), source);
    routes['mcp:bundle'] = tree(join(mcp, 'bundle'));
    // Upload-ready bot pack, built-in playbooks only.
    const { buildBotPack } = await import(pathToFileURL(join(source, 'tools/bot-pack.mjs')));
    buildBotPack(join(work, 'bot-pack'), { root: source, includeUser: false });
    routes['bot-pack'] = tree(join(work, 'bot-pack'));
    // npm tarball, unpacked.
    const packs = join(work, 'npm');
    mkdirSync(packs);
    const [packed] = JSON.parse(run('npm', ['pack', '--offline', '--ignore-scripts', '--json', '--pack-destination', packs], { cwd: source, env: { ...process.env, npm_config_cache: join(work, 'npm-cache') } }).stdout);
    run('tar', ['-xzf', join(packs, packed.filename), '-C', packs]);
    routes['npm:tarball'] = tree(join(packs, 'package'));
    writeFileSync(output, JSON.stringify(routes));
  } finally { rmSync(work, { recursive: true, force: true }); }
}

function exportRef(ref, into) {
  const commit = run('git', ['-C', root, 'rev-parse', '--verify', `${ref}^{commit}`]).stdout.trim();
  mkdirSync(into, { recursive: true });
  const archive = join(into, '..', `${commit}.tar`);
  run('git', ['-C', root, 'archive', '--format=tar', '-o', archive, commit]);
  run('tar', ['-xf', archive, '-C', into]);
  rmSync(archive);
  return commit;
}

function build(ref, temp, side) {
  const source = join(temp, `source-${side}`);
  const commit = exportRef(ref, source);
  const home = join(temp, `home-${side}`);
  mkdirSync(home);
  const output = join(temp, `${side}.json`);
  run(process.execPath, [self, '--snapshot', source, output], { env: { ...process.env, HOME: home, USERPROFILE: home, CONQUISTADOR_HOME: join(home, '.conquistador'), NO_COLOR: '1', DISABLE_TELEMETRY: '1' } });
  return { ref, commit, routes: JSON.parse(readFileSync(output, 'utf8')) };
}

const digest = files => sha(Object.entries(files).map(([path, hash]) => `${path}\0${hash}\n`).join(''));

export function compare(base, head, allowed = []) {
  const routes = [...new Set([...Object.keys(base.routes), ...Object.keys(head.routes)])].sort();
  return routes.map(route => {
    const before = base.routes[route] ?? {}, after = head.routes[route] ?? {};
    const paths = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    const added = paths.filter(path => !(path in before));
    const removed = paths.filter(path => !(path in after));
    const changed = paths.filter(path => path in before && path in after && before[path] !== after[path]);
    const unexpected = [...added, ...removed, ...changed].filter(path => !allowed.some(item => path === item || path.endsWith(`/${item}`)));
    return { route, files: { before: Object.keys(before).length, after: Object.keys(after).length },
      digest: { before: digest(before), after: digest(after) }, added, removed, changed, identical: !added.length && !removed.length && !changed.length, unexpected };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === self) {
  const args = process.argv.slice(2);
  if (args[0] === '--snapshot') await snapshot(args[1], args[2]);
  else {
    const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
    const allowed = args.flatMap((arg, index) => arg === '--allow' ? [args[index + 1]] : []);
    const baseRef = option('--base'), headRef = option('--head') ?? 'HEAD';
    if (!baseRef) throw Error('Usage: node tools/e2e/payload-parity.mjs --base REF [--head REF] [--out DIR] [--allow PATH ...]');
    const out = resolve(option('--out') ?? join(root, 'dist/e2e/payload-parity'));
    const temp = realpathSync(mkdtempSync(join(tmpdir(), 'cq-parity-')));
    try {
      const base = build(baseRef, temp, 'base'), head = build(headRef, temp, 'head');
      const routes = compare(base, head, allowed);
      const report = { schemaVersion: 'conquistador.payload-parity/v1', base: { ref: base.ref, commit: base.commit }, head: { ref: head.ref, commit: head.commit },
        allowed, node: process.version, platform: process.platform, routes };
      mkdirSync(out, { recursive: true });
      writeFileSync(join(out, 'payload-parity.json'), JSON.stringify(report, null, 2) + '\n');
      const lines = routes.map(item => `${item.identical ? 'same' : item.unexpected.length ? 'DIFF' : 'allowed'}  ${item.route}  files ${item.files.before} -> ${item.files.after}  digest ${item.digest.before.slice(0, 12)} -> ${item.digest.after.slice(0, 12)}`
        + [...item.added.map(path => `\n    + ${path}`), ...item.removed.map(path => `\n    - ${path}`), ...item.changed.map(path => `\n    ~ ${path}`)].join(''));
      const summary = `Payload parity ${base.commit.slice(0, 12)} -> ${head.commit.slice(0, 12)} (${process.platform}, Node ${process.version})\n${lines.join('\n')}\n`;
      writeFileSync(join(out, 'payload-parity.txt'), summary);
      console.log(summary + `Report: ${join(out, 'payload-parity.json')}`);
      if (routes.some(item => item.unexpected.length)) process.exitCode = 1;
    } finally { rmSync(temp, { recursive: true, force: true }); }
  }
}
