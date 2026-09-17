import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

export const hostFolders = { codex: '.agents/skills/conquistador', cursor: '.cursor/skills/conquistador', copilot: '.github/skills/conquistador', 'claude-code': '.claude/skills/conquistador' };
const receipt = '.conquistador-install.json';
const integration = 'project-installation.json';
const read = path => {
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 262144) throw Error('Installation metadata must be a bounded regular file.');
  return JSON.parse(readFileSync(path, 'utf8'));
};
export function treeDigest(path) {
  const hash = createHash('sha256');
  function visit(prefix = '') {
    for (const name of readdirSync(join(path, prefix)).sort()) {
      const key = prefix ? `${prefix}/${name}` : name;
      const info = lstatSync(join(path, key));
      if (info.isSymbolicLink()) throw Error('Managed files must not be symlinks.');
      if (info.isDirectory()) visit(key);
      else if (!info.isFile()) throw Error('Managed files must be regular files.');
      else if (key !== receipt) hash.update(key).update('\0').update(createHash('sha256').update(readFileSync(join(path, key))).digest('hex')).update('\n');
    }
  }
  visit(); return hash.digest('hex');
}
function owned(path, mode, expected) {
  if (!existsSync(path) || lstatSync(path).isSymbolicLink()) throw Error(`Managed folder is missing or linked: ${path}`);
  const record = read(join(path, receipt));
  if (record.schemaVersion !== 'conquistador.public-install/v1' || record.mode !== mode || record.digest !== treeDigest(path) || (expected && record.digest !== expected)) throw Error(`Preserve modified or independently managed files: ${path}`);
  return record;
}
export function projectIntegration(path) {
  if (!existsSync(join(path, integration))) return null;
  const value = read(join(path, integration));
  if (!['.conquistador', '.conquistador-operator'].includes(basename(path)) || value.schemaVersion !== 'conquistador.project-installation/v1' || !Array.isArray(value.skills) || value.skills.length > 4) throw Error('Invalid project installation record.');
  const seen = new Set();
  for (const item of value.skills) {
    if (!Object.hasOwn(hostFolders, item.host) || seen.has(item.host) || !/^[a-f0-9]{64}$/.test(item.digest)) throw Error('Invalid owned skill entry.');
    seen.add(item.host);
  }
  return value;
}
export function inspectProjectSkills(path) {
  const value = projectIntegration(path);
  for (const item of value?.skills ?? []) owned(join(dirname(path), hostFolders[item.host]), 'conquistador', item.digest);
  return value?.skills ?? [];
}
function assertNoLinks(path) {
  for (let cursor = path; ; cursor = dirname(cursor)) {
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) throw Error(`Destination crosses a symlink: ${cursor}`);
    if (cursor === dirname(cursor)) break;
  }
}
function seal(path) {
  const record = read(join(path, receipt));
  record.digest = treeDigest(path);
  writeFileSync(join(path, receipt), JSON.stringify(record, null, 2) + '\n');
}
// Stage all owned directories before replacing any. Roll back every rename on error.
export function projectLifecycle(root, options, { rename = renameSync } = {}) {
  const { action, path } = options;
  const source = options.legacyPath ?? path;
  const project = dirname(path);
  const previous = action === 'install' ? null : owned(source, 'single-agent');
  const old = previous ? projectIntegration(source) : null;
  if (old) inspectProjectSkills(source);
  const hosts = options.host ? (options.host === 'none' ? [] : [options.host]) : old?.skills.map(item => item.host) ?? (options.project && action !== 'uninstall' ? ['codex'] : []);
  if (options.host && old && JSON.stringify(hosts) !== JSON.stringify(old.skills.map(item => item.host))) throw Error('Keep the current host during update. Uninstall the unchanged installation before selecting another host.');
  const slots = [{ target: path, source, mode: 'single-agent' }, ...hosts.map(host => ({ target: join(project, hostFolders[host]), source: join(project, hostFolders[host]), mode: 'conquistador', host }))];
  for (const slot of slots) {
    assertNoLinks(slot.target);
    if (action === 'install' && !slot.host && existsSync(slot.target)) throw Error(`Destination already exists: ${slot.target}. Preserve it or use its original update command.`);
    if (slot.host && existsSync(slot.target) && !old?.skills.some(item => item.host === slot.host)) slot.adoptedDigest = owned(slot.target, 'conquistador').digest;
    if (source !== path && existsSync(path)) throw Error('Both .conquistador and .conquistador-operator exist. Choose an explicit path; neither folder was changed.');
  }
  const temporary = mkdtempSync(join(project, '.conquistador-transaction-'));
  const backups = [], installed = [];
  let cleanup = true;
  const missingParents = new Set();
  try {
    if (action !== 'uninstall') {
      for (const [index, slot] of slots.entries()) {
        slot.stage = join(temporary, `stage-${index}`);
        if (existsSync(slot.source) && (action === 'update' || slot.host)) cpSync(slot.source, slot.stage, { recursive: true, dereference: false });
        // Copying the old operator carries its domain restriction into upgrade.
        if (slot.host && !existsSync(slot.stage) && existsSync(join(source, 'domain-restriction.json')) && !options.domain) {
          const restriction = read(join(source, 'domain-restriction.json'));
          const domain = { ...restriction, schemaVersion: 'conquistador.domain-package/v1', allowed: { ...restriction.allowed, skills: restriction.allowed.skills.filter(name => !['conquistador', 'fresh-eyes-review'].includes(name)) } };
          slot.domain = join(temporary, 'domain.json'); writeFileSync(slot.domain, JSON.stringify(domain));
        }
        execFileSync(process.execPath, [join(root, 'tools/install.mjs'), existsSync(slot.stage) ? 'upgrade' : 'install', slot.mode, slot.stage,
          ...((options.domain || slot.domain) ? ['--domain', options.domain || slot.domain] : [])], { stdio: 'pipe' });
      }
      for (const slot of slots.filter(slot => slot.host)) {
        const restriction = directory => existsSync(join(directory, 'domain-restriction.json')) ? read(join(directory, 'domain-restriction.json')) : null;
        if (JSON.stringify(restriction(slot.stage)) !== JSON.stringify(restriction(slots[0].stage))) throw Error('Existing skill and operator have different domain restrictions. Preserve both and choose a separate project.');
      }
      const skills = slots.filter(slot => slot.host).map(slot => ({ host: slot.host, digest: read(join(slot.stage, receipt)).digest, adopted: Boolean(slot.adoptedDigest || old?.skills.find(item => item.host === slot.host)?.adopted) }));
      writeFileSync(join(slots[0].stage, integration), JSON.stringify({ schemaVersion: 'conquistador.project-installation/v1', skills }, null, 2) + '\n');
      seal(slots[0].stage);
    }
    if (previous) { owned(source, 'single-agent', previous.digest); if (old) inspectProjectSkills(source); }
    for (const slot of slots) if (slot.adoptedDigest) owned(slot.source, slot.mode, slot.adoptedDigest);
    for (const [index, slot] of slots.entries()) {
      if (existsSync(slot.source)) {
        const backup = join(temporary, `old-${index}`); rename(slot.source, backup); backups.push({ source: slot.source, backup });
      }
      if (action !== 'uninstall') {
        for (let parent = dirname(slot.target); parent !== project && !existsSync(parent); parent = dirname(parent)) missingParents.add(parent);
        mkdirSync(dirname(slot.target), { recursive: true });
        if (existsSync(slot.target)) throw Error(`Destination appeared: ${slot.target}`);
        rename(slot.stage, slot.target); installed.push(slot.target);
      }
    }
    if (action === 'uninstall') {
      for (const slot of slots.filter(slot => slot.host)) {
        for (let parent = dirname(slot.target); parent !== project; parent = dirname(parent)) {
          try { rmdirSync(parent); } catch { break; }
        }
      }
    }
  } catch (error) {
    try {
      for (const target of installed.reverse()) rmSync(target, { recursive: true });
      for (const { source, backup } of backups.reverse()) rename(backup, source);
      for (const parent of [...missingParents].sort((a, b) => b.length - a.length)) { try { rmdirSync(parent); } catch {} }
    } catch (recovery) {
      cleanup = false;
      throw Error(`Setup failed and rollback needs attention. Preserve recovery files at ${temporary}. ${recovery.message}`, { cause: error });
    }
    throw error;
  } finally { if (cleanup) rmSync(temporary, { recursive: true, force: true }); }
}
