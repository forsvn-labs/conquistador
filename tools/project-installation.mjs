import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

export const hostFolders = { codex: '.agents/skills/conquistador', cursor: '.cursor/skills/conquistador', copilot: '.github/skills/conquistador', 'claude-code': '.claude/skills/conquistador', hermes: '.hermes/skills/conquistador' };
export const hostLabels = { codex: 'Codex', bb: 'BB', cursor: 'Cursor', copilot: 'GitHub Copilot', 'claude-code': 'Claude Code', hermes: 'Hermes Agent', none: 'Files only' };
export function parseHosts(value) {
  const hosts = value.split(',');
  if (!hosts.length || hosts.some(host => !Object.hasOwn(hostLabels, host)) || new Set(hosts).size !== hosts.length || (hosts.includes('none') && hosts.length > 1)) throw Error('Choose distinct hosts: codex, bb, cursor, copilot, claude-code, hermes; or none alone.');
  return hosts;
}
export const installedHosts = record => record?.hosts ?? record?.skills.map(item => item.host) ?? [];
const receipt = '.conquistador-install.json';
const integration = 'project-installation.json';
const present = path => { try { lstatSync(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
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
  if (!present(path) || lstatSync(path).isSymbolicLink()) throw Error(`Managed folder is missing or linked: ${path}`);
  const record = read(join(path, receipt));
  if (record.schemaVersion !== 'conquistador.public-install/v1' || record.mode !== mode || record.digest !== treeDigest(path) || (expected && record.digest !== expected)) throw Error(`Preserve modified or independently managed files: ${path}`);
  return record;
}
export function projectIntegration(path) {
  assertNoLinks(path);
  if (!present(join(path, integration))) return null;
  const value = read(join(path, integration));
  if (!['.conquistador', '.conquistador-operator'].includes(basename(path)) || !['conquistador.project-installation/v1', 'conquistador.project-installation/v2'].includes(value.schemaVersion) || !Array.isArray(value.skills) || value.skills.length > 5) throw Error('Invalid project installation record.');
  const seen = new Set();
  for (const item of value.skills) {
    if (!Object.hasOwn(hostFolders, item.host) || seen.has(item.host) || !/^[a-f0-9]{64}$/.test(item.digest)) throw Error('Invalid owned skill entry.');
    seen.add(item.host);
  }
  if (value.hosts !== undefined) {
    if (!Array.isArray(value.hosts) || !value.hosts.length || value.hosts.length > 6 || value.hosts.some(host => typeof host !== 'string')) throw Error('Invalid project host choices.');
    parseHosts(value.hosts.join(','));
    if (JSON.stringify(value.hosts.filter(host => Object.hasOwn(hostFolders, host)).sort()) !== JSON.stringify([...seen].sort())) throw Error('Project host choices differ from owned skills.');
  }
  return value;
}
// Native copies owned by an operator must never acquire a second lifecycle owner.
export function projectSkillOwner(path) {
  for (const [host, folder] of Object.entries(hostFolders)) {
    let project = resolve(path);
    for (const _part of folder.split('/')) project = dirname(project);
    if (join(project, folder) !== resolve(path)) continue;
    for (const name of ['.conquistador', '.conquistador-operator']) {
      const operator = join(project, name);
      if (present(join(operator, integration)) && projectIntegration(operator)?.skills.some(item => item.host === host)) return operator;
    }
  }
  return null;
}
// The skills CLI copies our receipt as part of its payload. That receipt does
// not transfer lifecycle ownership back from the manager to Conquistador.
export function skillsManagerOwner(path) {
  for (const folder of [hostFolders.codex, hostFolders['claude-code']]) {
    let project = resolve(path);
    for (const _part of folder.split('/')) project = dirname(project);
    if (join(project, folder) !== resolve(path)) continue;
    const lock = join(project, 'skills-lock.json');
    if (present(lock) && read(lock).skills?.conquistador) return lock;
  }
  return null;
}
export function inspectProjectSkills(path) {
  const value = projectIntegration(path);
  for (const item of value?.skills ?? []) owned(join(dirname(path), hostFolders[item.host]), 'conquistador', item.digest);
  return value?.skills ?? [];
}
function assertNoLinks(path) {
  for (let cursor = path; ; cursor = dirname(cursor)) {
    if (present(cursor) && lstatSync(cursor).isSymbolicLink()) throw Error(`Destination crosses a symlink: ${cursor}`);
    if (cursor === dirname(cursor)) break;
  }
}
function seal(path) {
  const record = read(join(path, receipt));
  record.digest = treeDigest(path);
  writeFileSync(join(path, receipt), JSON.stringify(record, null, 2) + '\n');
}
export function projectPlan(options) {
  const { action, path } = options;
  const source = options.legacyPath ?? path;
  const project = dirname(path);
  const previous = action === 'install' ? null : owned(source, 'single-agent');
  const old = previous ? projectIntegration(source) : null;
  if (old) inspectProjectSkills(source);
  const hosts = options.hosts ? parseHosts(options.hosts) : options.host ? parseHosts(options.host) : old ? installedHosts(old) : options.project && action !== 'uninstall' ? ['codex'] : [];
  const nativeHosts = hosts.filter(host => Object.hasOwn(hostFolders, host));
  if (hosts.includes('hermes') && action !== 'uninstall' && !present(join(project, '.git'))) throw Error('Hermes project skills require the Git root. Use conquistador --bot hermes from that root; no files changed.');
  if (old?.skills.some(item => !nativeHosts.includes(item.host))) throw Error('Keep existing owned native hosts during update. Uninstall the unchanged operator before removing or replacing hosts.');
  if (options.host && old && JSON.stringify(nativeHosts) !== JSON.stringify(old.skills.map(item => item.host))) throw Error('Keep the current host with --host. Use --hosts to add hosts, or uninstall before replacing them.');
  const slots = [{ target: path, source, mode: 'single-agent' }, ...nativeHosts.map(host => ({ target: join(project, hostFolders[host]), source: join(project, hostFolders[host]), mode: 'conquistador', host }))];
  for (const slot of slots) {
    assertNoLinks(slot.target);
    if (action === 'install' && !slot.host && present(slot.target)) throw Error(`Destination already exists: ${slot.target}. Preserve it or use its original update command.`);
    if (slot.host && present(slot.target) && !old?.skills.some(item => item.host === slot.host)) {
      if (skillsManagerOwner(slot.target)) throw Error('skills.sh owns the existing Conquistador skill. Preserve it and use that manager before changing installation owners.');
      slot.adoptedDigest = owned(slot.target, 'conquistador').digest;
    }
    if (source !== path && present(path)) throw Error('Both .conquistador and .conquistador-operator exist. Choose an explicit path; neither folder was changed.');
    if (slot.host && present(slot.target) && !options.domain) {
      const restriction = directory => present(join(directory, 'domain-restriction.json')) ? read(join(directory, 'domain-restriction.json')) : null;
      if (JSON.stringify(restriction(slot.target)) !== JSON.stringify(restriction(source))) throw Error('Existing skill and operator have different domain restrictions. Preserve both and choose a separate project.');
    }
  }
  return { source, project, previous, old, hosts, slots };
}
// Stage all owned directories before replacing any. Roll back every rename on error.
export function projectLifecycle(root, options, { rename = renameSync } = {}) {
  const { action, path } = options;
  const { source, project, previous, old, hosts, slots } = projectPlan(options);
  const temporary = mkdtempSync(join(project, '.conquistador-transaction-'));
  const backups = [], installed = [];
  let cleanup = true;
  const missingParents = new Set();
  try {
    if (action !== 'uninstall') {
      for (const [index, slot] of slots.entries()) {
        slot.stage = join(temporary, `stage-${index}`);
        if (present(slot.source) && (action === 'update' || slot.host)) cpSync(slot.source, slot.stage, { recursive: true, dereference: false });
        if (slot.mode === 'single-agent' && present(join(slot.stage, integration))) {
          rmSync(join(slot.stage, integration)); seal(slot.stage);
        }
        // Copying the old operator carries its domain restriction into upgrade.
        if (slot.host && !present(slot.stage) && present(join(source, 'domain-restriction.json')) && !options.domain) {
          const restriction = read(join(source, 'domain-restriction.json'));
          const domain = { ...restriction, schemaVersion: 'conquistador.domain-package/v1', allowed: { ...restriction.allowed, skills: restriction.allowed.skills.filter(name => !['conquistador', 'critique'].includes(name)) } };
          slot.domain = join(temporary, 'domain.json'); writeFileSync(slot.domain, JSON.stringify(domain));
        }
        execFileSync(process.execPath, [join(root, 'tools/install.mjs'), present(slot.stage) ? 'upgrade' : 'install', slot.mode, slot.stage,
          ...((options.domain || slot.domain) ? ['--domain', options.domain || slot.domain] : [])], { stdio: 'pipe' });
      }
      for (const slot of slots.filter(slot => slot.host)) {
        const restriction = directory => present(join(directory, 'domain-restriction.json')) ? read(join(directory, 'domain-restriction.json')) : null;
        if (JSON.stringify(restriction(slot.stage)) !== JSON.stringify(restriction(slots[0].stage))) throw Error('Existing skill and operator have different domain restrictions. Preserve both and choose a separate project.');
      }
      const skills = slots.filter(slot => slot.host).map(slot => ({ host: slot.host, digest: read(join(slot.stage, receipt)).digest, adopted: Boolean(slot.adoptedDigest || old?.skills.find(item => item.host === slot.host)?.adopted) }));
      writeFileSync(join(slots[0].stage, integration), JSON.stringify({ schemaVersion: hosts.includes('hermes') ? 'conquistador.project-installation/v2' : 'conquistador.project-installation/v1', hosts: hosts.length ? hosts : ['none'], skills }, null, 2) + '\n');
      seal(slots[0].stage);
    }
    if (previous) { owned(source, 'single-agent', previous.digest); if (old) inspectProjectSkills(source); }
    for (const slot of slots) if (slot.adoptedDigest) owned(slot.source, slot.mode, slot.adoptedDigest);
    for (const [index, slot] of slots.entries()) {
      if (present(slot.source)) {
        const backup = join(temporary, `old-${index}`); rename(slot.source, backup); backups.push({ source: slot.source, backup });
      }
      if (action !== 'uninstall') {
        for (let parent = dirname(slot.target); parent !== project && !present(parent); parent = dirname(parent)) missingParents.add(parent);
        mkdirSync(dirname(slot.target), { recursive: true });
        if (present(slot.target)) throw Error(`Destination appeared: ${slot.target}`);
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
