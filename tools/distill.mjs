#!/usr/bin/env node
// Distillation workflow: pin permissively licensed sources, map them to Conquistador's routes, and
// check that public text written from them is in our own words. Sources, notes, and reports are
// private: every output folder is refused inside a Git work tree. Source code is read, never run.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createBrief } from './brief.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_SCHEMA = 'conquistador.distill-registry/v1';
const LOCK_SCHEMA = 'conquistador.distill-lock/v1';
const RUN_WORDS = 8;
// Each allowed license permits derived work; the signature identifies the license text.
const LICENSES = Object.freeze({
  MIT: /Permission is hereby granted, free of charge, to any person obtaining a copy/,
  'Apache-2.0': /Apache License\s+Version 2\.0, January 2004/,
});
// The own-words check compares prose. Source code shares import lines and idioms with any codebase.
const PROSE_FILE = /\.(md|mdx|markdown|txt)$/i;
const MAX_TEXT_BYTES = 1_000_000;

const fail = message => { throw Object.assign(new Error(message), { expected: true }); };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = (path, label) => {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { fail(`${label} is not readable JSON: ${path}`); }
};

function requirePrivatePath(path, label) {
  // Check the real path: a symlinked ancestor could otherwise lead into a repository unseen.
  // lstat sees a broken link that existsSync hides; a later mkdir would follow it, so refuse it.
  const present = candidate => { try { lstatSync(candidate); return true; } catch { return false; } };
  let probe = resolve(path);
  const missing = [];
  while (!present(probe)) { missing.unshift(basename(probe)); probe = dirname(probe); }
  let real;
  try { real = realpathSync(probe); } catch { fail(`${label} path goes through a broken link (${probe})`); }
  const target = join(real, ...missing);
  for (let dir = target; ; dir = dirname(dir)) {
    if (existsSync(join(dir, '.git'))) fail(`${label} is inside a Git work tree (${dir}); use a private folder outside any repository`);
    if (dirname(dir) === dir) return target;
  }
}

function readRegistry(path) {
  const registry = readJson(resolve(path), 'Registry');
  if (registry.schemaVersion !== REGISTRY_SCHEMA) fail(`Registry schemaVersion must be ${REGISTRY_SCHEMA}`);
  if (!Array.isArray(registry.sources) || !registry.sources.length) fail('Registry lists no sources');
  for (const source of registry.sources) {
    if (!/^[a-z0-9-]+$/.test(source.id ?? '')) fail(`Source id must be lowercase letters, digits, or dashes: ${source.id}`);
    if (!/^[0-9a-f]{40}$/.test(source.commit ?? '')) fail(`Source ${source.id} needs a full 40-character commit`);
    // A value that starts with "-" would reach git as an option, which can run a command.
    if (typeof source.url !== 'string' || !source.url || source.url.startsWith('-')) fail(`Source ${source.id} needs a URL or path that does not start with "-"`);
    if (!LICENSES[source.license]) fail(`Source ${source.id}: license ${source.license} is not allowed (allowed: ${Object.keys(LICENSES).join(', ')})`);
    if (!Array.isArray(source.units) || !source.units.length) fail(`Source ${source.id} declares no unit patterns`);
  }
  return registry;
}

/**
 * Names that must not appear in public text: declared names plus the owner handle of the hosted
 * repository. A repository name is often a plain word ("seo"), so it counts only when declared.
 */
function sourceNames(source) {
  const owner = /^https?:\/\/[^/]+\/([^/]+)\//.exec(source.homepage ?? source.url ?? '')?.[1];
  return [...new Set([...(source.names ?? []), ...(owner ? [owner] : [])].filter(name => name.length > 2))];
}

const checkoutOf = (out, source) => join(out, 'src', source.id);

function fetchSources({ registry: registryPath, out: outPath }) {
  const registry = readRegistry(registryPath);
  const out = requirePrivatePath(outPath, 'Output folder');
  const sources = [];
  const created = [];
  for (const source of registry.sources) {
    const dest = checkoutOf(out, source);
    if (existsSync(dest) && readdirSync(dest).length) fail(`Checkout folder is not empty: ${dest}; fetch into a new empty folder`);
    mkdirSync(dirname(dest), { recursive: true });
    const env = { ...process.env, GIT_LFS_SKIP_SMUDGE: '1', GIT_TERMINAL_PROMPT: '0' };
    const git = (...args) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'advice.detachedHead=false', ...args], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    try {
      created.push(dest);
      git('clone', '--quiet', '--no-checkout', '--', source.url, dest);
      try { git('-C', dest, 'cat-file', '-e', `${source.commit}^{commit}`); } catch { fail(`Source ${source.id}: commit ${source.commit} not found`); }
      git('-C', dest, 'checkout', '--quiet', source.commit);
      const licenseFile = readdirSync(dest).find(name => /^(LICENSE|LICENCE|COPYING)(\.(md|txt))?$/i.test(name));
      if (!licenseFile) fail(`Source ${source.id}: no LICENSE file at ${source.commit}`);
      const licenseBytes = readFileSync(join(dest, licenseFile));
      if (!LICENSES[source.license].test(licenseBytes.toString('utf8'))) fail(`Source ${source.id}: LICENSE does not match ${source.license}`);
      const notice = readdirSync(dest).find(name => /^NOTICE(\.(md|txt))?$/i.test(name)) ?? null;
      sources.push({ id: source.id, url: source.url, commit: source.commit, license: source.license, licenseFile, licenseSha256: sha256(licenseBytes), notice });
    } catch (error) {
      // Remove every checkout from this run, so a rerun into the same folder starts clean.
      for (const path of created) rmSync(path, { recursive: true, force: true });
      throw error;
    }
  }
  const lock = { schemaVersion: LOCK_SCHEMA, fetchedAt: new Date().toISOString(), sources };
  writeFileSync(join(out, 'sources.lock.json'), `${JSON.stringify(lock, null, 2)}\n`);
  return lock;
}

function readLock(out, registry) {
  const lockPath = join(out, 'sources.lock.json');
  if (!existsSync(lockPath)) fail(`Sources not fetched: ${lockPath} is missing; run fetch first`);
  const lock = readJson(lockPath, 'Lock');
  for (const source of registry.sources) {
    const entry = lock.sources?.find(item => item.id === source.id);
    if (!entry || entry.commit !== source.commit || !existsSync(checkoutOf(out, source))) fail(`Source ${source.id} not fetched at ${source.commit}; run fetch first`);
  }
  return lock;
}

/** Expand a unit pattern; each `*` matches one path segment and names the unit. */
function expandUnits(base, pattern) {
  const parts = pattern.split('/');
  const walk = (dir, index, captures) => {
    if (index === parts.length) return existsSync(dir) && statSync(dir).isFile() ? [{ path: dir, captures }] : [];
    const part = parts[index];
    if (part !== '*') return walk(join(dir, part), index + 1, captures);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
    return readdirSync(dir).sort().flatMap(name => walk(join(dir, name), index + 1, [...captures, name]));
  };
  return walk(base, 0, []).map(item => ({ ...item, unit: item.captures.length ? item.captures.join('/') : basename(item.path).replace(/\.[^.]+$/, '') }));
}

function descriptionOf(text) {
  const front = /^---\n([\s\S]*?)\n---/.exec(text)?.[1];
  if (!front) return null;
  const lines = front.split('\n');
  const index = lines.findIndex(line => /^description:/.test(line));
  if (index < 0) return null;
  let value = lines[index].replace(/^description:\s*/, '');
  if (/^[>|][-+]?$/.test(value) || value === '') value = lines.slice(index + 1).filter((line, i, all) => /^\s+/.test(line) && all.slice(0, i).every(prior => /^\s+/.test(prior))).map(line => line.trim()).join(' ');
  value = value.trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();
  return value || null;
}

function practiceIndex() {
  const index = new Map();
  for (const practice of readJson(join(root, 'evals', 'practices.json'), 'Practices').practices) {
    for (const member of practice.members) index.set(member, { practice: practice.id, status: practice.status });
  }
  return index;
}

function routeOf(request) {
  const brief = createBrief(request, { root, persistCache: false, playbooks: [] });
  if (brief.action === 'none') return { ids: [], reason: brief.reason ?? 'none' };
  const play = brief.play?.name ?? brief.play;
  const ids = [...(play ? [`plays/${play}`] : []), ...brief.methods.map(method => `commands/${method.name ?? method}`)];
  return { ids, reason: ids.length ? null : (brief.reason ?? 'no-method') };
}

function inventory({ registry: registryPath, out: outPath }) {
  const registry = readRegistry(registryPath);
  const out = requirePrivatePath(outPath, 'Output folder');
  readLock(out, registry);
  const practices = practiceIndex();
  const units = [];
  for (const source of registry.sources) {
    const base = checkoutOf(out, source);
    for (const pattern of source.units) {
      for (const item of expandUnits(base, pattern)) {
        const text = readFileSync(item.path, 'utf8');
        const description = descriptionOf(text);
        const common = { source: source.id, unit: item.unit, path: relative(base, item.path), lines: text.split('\n').length, description };
        if (!description) { units.push({ ...common, route: null, reason: 'no-description', practice: null, practiceStatus: 'none' }); continue; }
        const route = routeOf(description);
        const lead = route.ids.find(id => practices.has(id));
        units.push({ ...common, route: route.ids.length ? route.ids : null, reason: route.reason, practice: lead ? practices.get(lead).practice : null, practiceStatus: lead ? practices.get(lead).status : 'none' });
      }
    }
  }
  const gaps = units.filter(unit => !unit.route).map(({ source, unit, reason }) => ({ source, unit, reason }));
  const report = { schemaVersion: 'conquistador.distill-inventory/v1', createdAt: new Date().toISOString(), units, gaps };
  writeFileSync(join(out, 'inventory.json'), `${JSON.stringify(report, null, 2)}\n`);
  const rows = units.map(unit => `| ${unit.source} | ${unit.unit} | ${unit.lines} | ${unit.route?.join(', ') ?? `none (${unit.reason})`} | ${unit.practice ?? '—'} | ${unit.practiceStatus} |`);
  writeFileSync(join(out, 'inventory.md'), ['# Distillation inventory', '', `Created ${report.createdAt}. ${units.length} units, ${gaps.length} unrouted.`, '',
    '| Source | Unit | Lines | Route | Practice | Status |', '| --- | --- | ---: | --- | --- | --- |', ...rows, ''].join('\n'));
  return report;
}

const TARGET = /\b(?:commands|plays|channels)\/[a-z0-9-]+/g;

function routes({ notes: notesPath }) {
  const notesDir = resolve(notesPath);
  const files = [];
  const walk = dir => { for (const name of readdirSync(dir).sort()) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else if (/\.md$/.test(name) && !/^(SUMMARY|AI-TELLS|SYSTEM-MAP)\.md$/.test(name)) files.push(path); } };
  walk(notesDir);
  const mismatches = []; const invalid = []; const gaps = []; let checked = 0;
  for (const note of files) {
    const text = readFileSync(note, 'utf8');
    const mapLine = /^Maps to Conquistador:(.*)$/m.exec(text)?.[1];
    const section = /^## Requests that should route here\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text)?.[1];
    const requests = (section ?? '').split('\n').map(line => /^\s*(?:[-*]|\d+\.)\s+(.+)$/.exec(line)?.[1]?.replace(/^["“]|["”]$/g, '').trim()).filter(Boolean);
    if (mapLine == null || !requests.length) { invalid.push({ note, reason: mapLine == null ? 'no Maps to Conquistador line' : 'no requests listed' }); continue; }
    const declared = new Set(mapLine.split('·')[0].match(TARGET) ?? []);
    for (const request of requests) {
      checked += 1;
      const route = routeOf(request);
      if (!declared.size) { gaps.push({ note, request, route: route.ids }); continue; }
      // A channel guide is reached through its command, so a declared channel accepts any route that loads it.
      const hit = route.ids.some(id => declared.has(id)) || ([...declared].some(id => id.startsWith('channels/')) && route.ids.length > 0);
      if (!hit) mismatches.push({ note, request, declared: [...declared], route: route.ids, reason: route.reason });
    }
  }
  return { checked, mismatches, invalid, gaps };
}

const words = text => text.toLowerCase().normalize('NFKC').replace(/[’']/g, '').match(/[\p{L}\p{N}]+/gu) ?? [];

function sourceFiles(dir) {
  const files = [];
  const walk = current => {
    // Symlinks are skipped: a dangling one would abort the run, and one that leaves the source would
    // pull unrelated local text into the corpus.
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.isSymbolicLink()) continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && PROSE_FILE.test(entry.name) && statSync(path).size <= MAX_TEXT_BYTES) files.push(path);
    }
  };
  walk(dir);
  return files;
}

/** Line numbers added since `ref`, or null when the file is untracked (check it whole). */
function addedLines(file, ref) {
  const cwd = dirname(file);
  const run = args => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try { run(['ls-files', '--error-unmatch', basename(file)]); } catch { return null; }
  const added = new Set();
  for (const match of run(['diff', '-U0', ref, '--', basename(file)]).matchAll(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(match[1]);
    for (let line = start; line < start + Number(match[2] ?? 1); line += 1) added.add(line);
  }
  return added;
}

function check({ registry: registryPath, out: outPath, allow, diff, files }) {
  if (!files.length) fail('Name at least one file to check');
  const registry = readRegistry(registryPath);
  const out = requirePrivatePath(outPath, 'Corpus folder');
  readLock(out, registry);
  const shingles = new Set();
  for (const source of registry.sources) {
    for (const file of sourceFiles(checkoutOf(out, source))) {
      const list = words(readFileSync(file, 'utf8'));
      for (let i = 0; i + RUN_WORDS <= list.length; i += 1) shingles.add(list.slice(i, i + RUN_WORDS).join(' '));
    }
  }
  if (!shingles.size) fail('Source corpus is empty; run fetch first');
  const allowed = allow ? readFileSync(resolve(allow), 'utf8').split('\n').map(line => words(line).join(' ')).filter(Boolean) : [];
  const names = registry.sources.flatMap(sourceNames);
  const findings = [];
  for (const file of files.map(path => resolve(path))) {
    const lines = readFileSync(file, 'utf8').split('\n');
    const added = diff ? addedLines(file, diff) : null;
    const inScope = line => !added || added.has(line);
    const tokens = lines.flatMap((line, index) => words(line).map(word => ({ word, line: index + 1 })));
    let i = 0;
    while (i + RUN_WORDS <= tokens.length) {
      if (!shingles.has(tokens.slice(i, i + RUN_WORDS).map(token => token.word).join(' '))) { i += 1; continue; }
      let end = i + RUN_WORDS;
      while (end < tokens.length && shingles.has(tokens.slice(end - RUN_WORDS + 1, end + 1).map(token => token.word).join(' '))) end += 1;
      const run = tokens.slice(i, end).map(token => token.word).join(' ');
      const touched = tokens.slice(i, end).some(token => inScope(token.line));
      if (touched && !allowed.some(phrase => phrase.includes(run))) findings.push({ file, line: tokens[i].line, kind: 'shared-run', words: end - i, text: run });
      i = end;
    }
    lines.forEach((line, index) => {
      if (!inScope(index + 1)) return;
      for (const name of names) {
        const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s-]+/g, '[\\s-]+')}($|[^\\p{L}\\p{N}])`, 'iu');
        if (pattern.test(line)) findings.push({ file, line: index + 1, kind: 'source-name', text: name });
      }
    });
  }
  return { runWords: RUN_WORDS, checked: files.length, findings };
}

function parseArgs(argv) {
  const options = { files: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (['--registry', '--out', '--notes', '--allow', '--diff'].includes(arg)) {
      if (!argv[i + 1]) fail(`${arg} needs a value`);
      options[arg.slice(2)] = argv[++i];
    } else if (arg.startsWith('--')) fail(`Unknown option ${arg}`);
    else options.files.push(arg);
  }
  return options;
}

const USAGE = `Usage:
  node tools/distill.mjs fetch     --registry <file> --out <private folder>
  node tools/distill.mjs inventory --registry <file> --out <private folder>
  node tools/distill.mjs routes    --notes <notes folder> [--json]
  node tools/distill.mjs check     --registry <file> --out <private folder> [--allow <file>] [--diff <git ref>] [--json] <public files...>`;

function main([command, ...rest]) {
  const options = parseArgs(rest);
  const need = (...keys) => { for (const key of keys) if (!options[key]) fail(`${command} needs --${key}\n${USAGE}`); };
  if (command === 'fetch') {
    need('registry', 'out');
    const lock = fetchSources(options);
    for (const source of lock.sources) console.log(`${source.id}  ${source.commit.slice(0, 12)}  ${source.license}${source.notice ? ` (keeps ${source.notice})` : ''}`);
    return 0;
  }
  if (command === 'inventory') {
    need('registry', 'out');
    const report = inventory(options);
    console.log(`${report.units.length} units; ${report.gaps.length} unrouted. Wrote inventory.json and inventory.md.`);
    return 0;
  }
  if (command === 'routes') {
    need('notes');
    const report = routes(options);
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else {
      for (const item of report.mismatches) console.log(`MISMATCH  ${basename(item.note)}  "${item.request}"  wants ${item.declared.join(', ')}  got ${item.route.join(', ') || `none (${item.reason})`}`);
      for (const item of report.invalid) console.log(`INVALID   ${basename(item.note)}  ${item.reason}`);
      console.log(`${report.checked} requests checked; ${report.mismatches.length} mismatches; ${report.gaps.length} in declared gaps; ${report.invalid.length} invalid notes.`);
    }
    return report.mismatches.length || report.invalid.length ? 1 : 0;
  }
  if (command === 'check') {
    need('registry', 'out');
    const report = check(options);
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else {
      for (const item of report.findings) console.log(`${relative(process.cwd(), item.file)}:${item.line}  ${item.kind}  ${item.kind === 'shared-run' ? `${item.words} words: "${item.text}"` : item.text}`);
      console.log(`${report.checked} files checked; ${report.findings.length} findings (runs of ${report.runWords}+ shared words, source names).`);
    }
    return report.findings.length ? 1 : 0;
  }
  console.log(USAGE);
  return command ? 2 : 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(error.expected ? error.message : error.stack);
  process.exitCode = 2;
}
