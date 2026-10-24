// Maintainer command: keep declared byte-identical method files in step with their one source.
// Each installed command keeps its own complete copy (an isolated skill must not link to a
// sibling), so the copies stay on disk. tools/method-copies.json names the one editable source of
// each group, its copies, and the source hash at the last sync.
//   node tools/method-copies.mjs          copy each edited source to its copies, record its hash
//   node tools/method-copies.mjs --check  exit 1 on drift, a missing file, or an undeclared duplicate
// Sync refuses to overwrite a copy that was edited directly, and writes nothing in that case.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const copyManifestPath = 'tools/method-copies.json';
const schemaVersion = 'conquistador.method-copies/v1';
const sync = 'node tools/method-copies.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

// Manifest keys are repository-relative, forward-slash paths inside skills/.
// oxlint-disable-next-line anti-slop/no-runtime-typeof -- Parse untrusted manifest paths at the filesystem boundary without string coercion.
const safeKey = key => typeof key === 'string' && key.startsWith('skills/') && !/[\\:]/.test(key)
  && [...key].every(character => character.charCodeAt(0) > 31) && key.split('/').every(part => part && part !== '.' && part !== '..');

export function repoPath(root, key, paths = path) {
  if (!safeKey(key)) throw Error(`Invalid method copy path: ${key}`);
  return paths.join(root, ...key.split('/'));
}

export function validateCopyManifest(manifest) {
  const fail = message => { throw Error(`${copyManifestPath}: ${message}`); };
  if (manifest?.schemaVersion !== schemaVersion || Object.keys(manifest).join() !== 'schemaVersion,groups' || !Array.isArray(manifest.groups)) {
    fail(`expected {"schemaVersion": "${schemaVersion}", "groups": [...]}`);
  }
  const seen = new Set();
  for (const group of manifest.groups) {
    if (Object.keys(group ?? {}).join() !== 'source,sha256,copies' || !/^[a-f0-9]{64}$/.test(group.sha256) || !Array.isArray(group.copies) || !group.copies.length) {
      fail(`each group needs exactly source, sha256, and at least one copy: ${JSON.stringify(group)}`);
    }
    for (const key of [group.source, ...group.copies]) {
      if (!safeKey(key)) fail(`invalid path ${JSON.stringify(key)}`);
      if (seen.has(key)) fail(`${key} is declared more than once`);
      seen.add(key);
    }
  }
  return manifest;
}

const manifestFile = root => path.join(root, ...copyManifestPath.split('/'));

export function readCopyManifest(root) {
  return validateCopyManifest(JSON.parse(readFileSync(manifestFile(root), 'utf8')));
}

function files(root, prefix = 'skills') {
  return readdirSync(path.join(root, ...prefix.split('/'))).sort().flatMap(name => {
    const key = `${prefix}/${name}`;
    const stat = lstatSync(path.join(root, ...key.split('/')));
    if (stat.isDirectory()) return files(root, key);
    return stat.isFile() ? [key] : [];
  });
}

// Every set of two or more byte-identical files under skills/, compared by SHA-256 of raw bytes.
export function findDuplicateGroups(root) {
  const byHash = new Map();
  for (const key of files(root)) {
    const digest = sha(readFileSync(repoPath(root, key)));
    byHash.set(digest, [...byHash.get(digest) ?? [], key]);
  }
  return [...byHash.values()].filter(keys => keys.length > 1).map(keys => keys.sort());
}

function inspect(root, manifest) {
  const problems = [], writes = [], recorded = [];
  for (const group of manifest.groups) {
    const read = key => existsSync(repoPath(root, key)) ? readFileSync(repoPath(root, key)) : null;
    const source = read(group.source);
    if (!source) { problems.push(`Missing source ${group.source}. Restore it, or move its declaration in ${copyManifestPath}.`); continue; }
    const current = sha(source);
    for (const copy of group.copies) {
      const bytes = read(copy);
      if (!bytes) problems.push(`Missing copy ${copy} of ${group.source}. Restore it from the source, or remove it from ${copyManifestPath}.`);
      else if (Buffer.compare(bytes, source) === 0) continue;
      else if (sha(bytes) === group.sha256) writes.push({ copy, source: group.source, bytes: source });
      else problems.push(`${copy} was edited directly. Move the edit to its source ${group.source}, restore the copy, then run ${sync}.`);
    }
    if (current !== group.sha256) recorded.push(group);
  }
  return { problems, writes, recorded };
}

export function checkCopies(root, manifest = readCopyManifest(root)) {
  const { problems, writes, recorded } = inspect(root, manifest);
  for (const { copy, source } of writes) problems.push(`${source} changed and ${copy} is out of date. Run ${sync}.`);
  for (const group of recorded) if (!writes.some(item => item.source === group.source)) problems.push(`${group.source} changed after the last sync. Run ${sync}.`);
  // Identical files must all belong to one declared group. A group that drifted apart is reported above.
  const owner = new Map(manifest.groups.flatMap(group => [group.source, ...group.copies].map(key => [key, group.source])));
  for (const keys of findDuplicateGroups(root)) {
    if (keys.every(key => owner.has(key)) && new Set(keys.map(key => owner.get(key))).size === 1) continue;
    problems.push(`Undeclared byte-identical files: ${keys.join(', ')}. Declare one source and its copies in ${copyManifestPath}.`);
  }
  return problems;
}

export function syncCopies(root) {
  const manifest = readCopyManifest(root);
  const { problems, writes, recorded } = inspect(root, manifest);
  if (problems.length) throw Error(`Method copies were not synced:\n${problems.join('\n')}`);
  for (const { copy, bytes } of writes) writeFileSync(repoPath(root, copy), bytes);
  for (const group of recorded) group.sha256 = sha(readFileSync(repoPath(root, group.source)));
  if (recorded.length) writeFileSync(manifestFile(root), JSON.stringify(manifest, null, 2) + '\n');
  return { written: writes.map(item => item.copy), recorded: recorded.map(group => group.source) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && args[0] !== '--check')) throw Error('Usage: node tools/method-copies.mjs [--check]');
  if (args[0] === '--check') {
    const problems = checkCopies(root);
    if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
    console.log(`Method copies match their sources (${readCopyManifest(root).groups.length} groups).`);
  } else {
    try {
      const { written, recorded } = syncCopies(root);
      console.log(`Synced ${written.length} copies from ${recorded.length} edited sources.`);
    } catch (error) { console.error(error.message); process.exit(1); }
  }
}
