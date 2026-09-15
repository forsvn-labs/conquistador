import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPackageBoundary } from './package-boundary.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function safePath(path) {
  if (!path || path.startsWith('/') || /[\\\x00-\x1f\x7f:]/.test(path) ||
      path.split('/').some(part => !part || part === '.' || part === '..' || part === '.git')) {
    throw new Error(`Unsafe tracked path: ${JSON.stringify(path)}`);
  }
  return path;
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
/** Stored ZIP with fixed 1980 date, UTF-8 paths, Unix file modes and no host metadata. */
export function sourceZip(files) {
  const local = [], central = [];
  let offset = 0;
  const names = Object.keys(files).sort();
  if (names.length > 65535) throw new Error('ZIP64 is not supported');
  const seen = new Set();
  for (const path of names) {
    safePath(path);
    const key = path.normalize('NFC').toLowerCase();
    if (seen.has(key)) throw new Error('Case/Unicode path collision');
    seen.add(key);
    const { bytes, mode } = files[path];
    if (!['100644', '100755'].includes(mode)) throw new Error('Only regular tracked files are packageable');
    const name = Buffer.from(path), content = Buffer.from(bytes), crc = crc32(content);
    if (name.length > 65535 || content.length > 0xffffffff || offset > 0xffffffff) throw new Error('ZIP64 is not supported');
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(33, 12); header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(content.length, 18); header.writeUInt32LE(content.length, 22); header.writeUInt16LE(name.length, 26);
    local.push(header, name, content);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50); record.writeUInt16LE(0x314, 4); record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0x800, 8); record.writeUInt16LE(33, 14); record.writeUInt32LE(crc, 16);
    record.writeUInt32LE(content.length, 20); record.writeUInt32LE(content.length, 24); record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE((parseInt(mode, 8) << 16) >>> 0, 38); record.writeUInt32LE(offset, 42);
    central.push(record, name); offset += header.length + name.length + content.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  if (offset + directory.length > 0xffffffff) throw new Error('ZIP64 is not supported');
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

export function committedFiles(root) {
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { maxBuffer: 128 * 1024 * 1024, timeout: 60_000 });
  if (realpathSync(git('rev-parse', '--show-toplevel').toString().trim()) !== realpathSync(root)) throw new Error('Run from the public Git repository root');
  if (git('status', '--porcelain', '--untracked-files=all').length) throw new Error('Commit or remove pending changes before packaging');
  const commit = git('rev-parse', 'HEAD').toString().trim();
  const entries = new TextDecoder('utf-8', { fatal: true }).decode(git('ls-tree', '-rz', '--full-tree', commit)).split('\0').filter(Boolean).map(line => {
    const match = /^(100644|100755) blob ([0-9a-f]{40,64})\t(.+)$/.exec(line);
    if (!match) throw new Error('Tracked symlinks, submodules and special files are not packageable');
    return { mode: match[1], object: match[2], path: safePath(match[3]) };
  });
  const objects = execFileSync('git', ['-C', root, 'cat-file', '--batch'], {
    input: entries.map(entry => entry.object).join('\n') + '\n', maxBuffer: 128 * 1024 * 1024, timeout: 60_000,
  });
  const files = Object.create(null); let offset = 0;
  for (const entry of entries) {
    const end = objects.indexOf(10, offset);
    const header = objects.subarray(offset, end).toString();
    const match = /^([0-9a-f]+) blob (\d+)$/.exec(header);
    if (!match || match[1] !== entry.object) throw new Error('Unexpected Git object response');
    const size = Number(match[2]);
    if (!Number.isSafeInteger(size) || end + 1 + size >= objects.length) throw new Error('Truncated Git object');
    files[entry.path] = { mode: entry.mode, bytes: objects.subarray(end + 1, end + 1 + size) };
    offset = end + size + 2;
  }
  return { commit, tree: git('rev-parse', 'HEAD^{tree}').toString().trim(), files };
}

export function packageSource(root, outputRoot = join(root, 'dist')) {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Use Node 24.');
  const { commit, tree, files } = committedFiles(root);
  checkPackageBoundary(files);
  const manifest = JSON.parse(files['package.json']?.bytes.toString() || '{}');
  if (manifest.name !== '@forsvn/conquistador' || !/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('Expected public product identity');
  for (const name of Object.keys(files)) {
    if (name.split('/').some(part => ['node_modules', '.conquistador', 'dist'].includes(part)) || /(?:^|\/)\.env(?:\.|$)/.test(name) && !name.endsWith('.env.example')) {
      throw new Error('Tracked dependency, local state, or credential file is not packageable');
    }
  }
  const output = resolve(outputRoot, commit);
  if (existsSync(output)) throw new Error('Output already exists; choose a fresh output root');
  const temp = mkdtempSync(join(tmpdir(), 'conquistador-public-pack-'));
  try {
    for (const [path, { bytes, mode }] of Object.entries(files)) {
      const target = join(temp, path); mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes); chmodSync(target, mode === '100755' ? 0o755 : 0o644);
    }
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const packed = JSON.parse(execFileSync(npm, ['pack', '--offline', '--ignore-scripts', '--json'], { cwd: temp, encoding: 'utf8', timeout: 120_000 }));
    if (packed.length !== 1 || packed[0].filename !== `forsvn-conquistador-${manifest.version}.tgz`) throw new Error('Unexpected npm artifact identity');
    const zipName = `conquistador-${manifest.version}.zip`, npmName = packed[0].filename;
    const zip = sourceZip(files), tarball = readFileSync(join(temp, npmName));
    const checksums = { [zipName]: hash(zip), [npmName]: hash(tarball) };
    const record = {
      schemaVersion: 'conquistador.public-source-assembly/v1', productVersion: manifest.version,
      sourceCommit: commit, sourceTree: tree, authority: 'UNBOUND', published: false,
      liveExecutions: 0, humanVerdicts: 0, proofClass: 'local-committed-source-packaging-only',
      toolchain: { node: process.version, npm: execFileSync(npm, ['--version'], { encoding: 'utf8' }).trim(), platform: process.platform, arch: process.arch },
      npmCrossToolchainReproducibility: 'not-claimed', checksums,
    };
    mkdirSync(dirname(output), { recursive: true }); mkdirSync(output);
    writeFileSync(join(output, zipName), zip, { flag: 'wx' });
    writeFileSync(join(output, npmName), tarball, { flag: 'wx' });
    writeFileSync(join(output, 'SHA256SUMS'), Object.entries(checksums).map(([name, digest]) => `${digest}  ${name}\n`).join(''), { flag: 'wx' });
    writeFileSync(join(output, 'assembly.json'), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
    return { output, ...record };
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [output, ...extra] = process.argv.slice(2);
  if (extra.length) throw new Error('Usage: node tools/package.mjs [OUTPUT_ROOT]');
  console.log(JSON.stringify(packageSource(fileURLToPath(new URL('../', import.meta.url)), output), null, 2));
}
