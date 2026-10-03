import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hostFolders, projectSkillOwner, skillsManagerOwner, treeDigest } from './project-installation.mjs';
import { duplicateDiscovery } from './onboarding-hosts.mjs';
import { containsPath } from './install-paths.mjs';

const distribution = fileURLToPath(new URL('../', import.meta.url));

const present = path => {
  try { lstatSync(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
};

export function installationOwner(path) {
  const manager = skillsManagerOwner(path);
  if (manager) return `skills.sh (${manager})`;
  const operator = projectSkillOwner(path);
  if (operator) return `operator at ${operator}`;
  if (present(join(path, '.conquistador-install.json'))) return 'independent Conquistador setup copy';
  return 'external or unverified owner';
}

export function assertNoDiscoveryConflict(project, host) {
  const conflicts = duplicateDiscovery(project, host);
  if (!conflicts.length) return;
  throw Error(`Another Conquistador entry is already discoverable: ${conflicts.map(folder => `${join(project, folder)} (${installationOwner(join(project, folder))})`).join(', ')}. Existing copies were preserved. Use the original installer and choose one discovery route before adding another.`);
}

export function assertUnrestrictedProject(project) {
  for (const folder of ['.conquistador', '.conquistador-operator']) {
    if (present(join(project, folder, 'domain-restriction.json'))) throw Error('This project has a domain-restricted operator. This shortcut would expose the full library. Preserve its boundary and use an explicitly scoped setup command in a separate project.');
  }
}

// skills@1.5.26 uses the shared directory for these three agents, including Cursor.
export function skillsDestinations(project, host) {
  return [join(project, host === 'claude-code' ? hostFolders['claude-code'] : hostFolders.codex)];
}

export function validateManagerPaths(project, source, host) {
  assertUnrestrictedProject(project);
  const destinations = skillsDestinations(project, host);
  // A manager is permitted to overwrite its copies. The wrapper never transfers an
  // existing copy's ownership or authorizes overwriting edits on the user's behalf.
  for (const folder of Object.values(hostFolders)) {
    if (containsPath(join(project, dirname(folder)), source)) throw Error('Keep the staged source outside native skill discovery folders. Choose a separate --path.');
  }
  for (const path of [...destinations, join(project, 'skills-lock.json')]) {
    if (containsPath(distribution, path) || containsPath(path, distribution)) throw Error('Choose a receiving project outside the distribution.');
    for (let cursor = path; ; cursor = dirname(cursor)) {
      if (present(cursor) && lstatSync(cursor).isSymbolicLink()) throw Error(`Destination crosses a symlink: ${cursor}. Nothing was changed.`);
      if (cursor === dirname(cursor)) break;
    }
    if (containsPath(source, path) || containsPath(path, source)) throw Error('The staged source overlaps skills.sh output. Choose a separate --path.');
  }
  for (const folder of Object.values(hostFolders)) {
    const path = join(project, folder);
    if (present(path)) throw Error(`Existing skill at ${path} (${installationOwner(path)}). Nothing was changed. Inspect it through its original manager before installing through skills.sh.`);
  }
  const lock = join(project, 'skills-lock.json');
  if (present(lock)) {
    const info = lstatSync(lock);
    if (!info.isFile() || info.size > 1048576) throw Error('Preserve the existing skills-lock.json; it is not a supported manager file.');
    let record;
    try { record = JSON.parse(readFileSync(lock, 'utf8')); } catch { throw Error('Preserve the invalid skills-lock.json. Repair it through skills.sh before retrying.'); }
    if (record.version !== 1 || !record.skills || typeof record.skills !== 'object' || Array.isArray(record.skills)) throw Error('Preserve the unsupported skills-lock.json. Inspect it through skills.sh before retrying.');
    if (record.skills?.conquistador) throw Error('skills.sh already records Conquistador in skills-lock.json. Use its original manager to inspect or repair that installation.');
  }
  if (present(join(source, 'domain-restriction.json'))) throw Error('This staged skill has a domain restriction. Use its original scoped installer.');
  return destinations;
}

export function npxInvocation(env = process.env, platform = process.platform) {
  if (platform !== 'win32') return { command: 'npx', prefix: [] };
  // Execute npm's JS entry with Node. Passing user paths through cmd.exe would
  // reinterpret shell metacharacters and .cmd cannot be spawned directly.
  const candidates = [
    ...(env.npm_execpath ? [join(dirname(env.npm_execpath), 'npx-cli.js')] : []),
    ...[dirname(process.execPath), ...(env.PATH ?? '').split(';')]
      .filter(Boolean).map(folder => join(folder, 'node_modules/npm/bin/npx-cli.js')),
  ];
  const entry = candidates.find(path => existsSync(path));
  if (!entry) throw Error('Cannot locate npm npx-cli.js. Install npm with Node 22.18 or later and rerun; the staged source is preserved.');
  return { command: process.execPath, prefix: [entry] };
}

export function verifyManagerCopy(project, source, destinations) {
  const record = JSON.parse(readFileSync(join(project, 'skills-lock.json'), 'utf8')).skills?.conquistador;
  if (record?.sourceType !== 'local' || typeof record.source !== 'string' || resolve(project, record.source) !== source) throw Error('skills.sh did not record the expected local source in skills-lock.json.');
  const expected = treeDigest(source);
  for (const path of destinations) {
    if (lstatSync(path).isSymbolicLink() || treeDigest(path) !== expected) throw Error(`The skills.sh copy differs from the staged payload: ${path}.`);
  }
}
