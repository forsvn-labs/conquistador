import { randomBytes } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, renameSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { hostFolders, installedHosts, projectIntegration, skillsManagerOwner } from './project-installation.mjs';
import { duplicateDiscovery } from './onboarding-hosts.mjs';

function assertLocalPath(project, path) {
  for (let cursor = path; cursor !== project; cursor = dirname(cursor)) {
    if (cursor === dirname(cursor)) throw Error(`Recovery path leaves the project: ${path}`);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) throw Error(`Recovery path crosses a symlink: ${cursor}`);
  }
}

export function recoveryPlan(project, inspection, version) {
  if (inspection.state !== 'modified' || !inspection.receipt) return null;
  const integration = projectIntegration(inspection.path);
  const hosts = integration ? installedHosts(integration) : ['none'];
  const paths = [inspection.path, ...(integration?.skills ?? []).map(item => join(project, hostFolders[item.host]))]
    .filter(path => existsSync(path));
  if (inspection.receipt.domainId || paths.some(path => existsSync(join(path, 'domain-restriction.json')))) return null;
  for (const path of paths) {
    assertLocalPath(project, path);
    if (path !== inspection.path && skillsManagerOwner(path)) return null;
  }
  for (const host of hosts) {
    if (duplicateDiscovery(project, host).some(folder => !paths.includes(join(project, folder)))) return null;
  }
  const backup = join(project, `.conquistador-backup-${new Date().toISOString().replace(/[:.]/g, '')}-${randomBytes(4).toString('hex')}`);
  const identities = paths.map(path => {
    const { dev, ino } = lstatSync(path);
    return { path, dev, ino };
  });
  return { project, backup, paths, identities, hosts, version };
}

export function preserveForReset(plan, { writeManifest = writeFileSync } = {}) {
  const { project, backup, paths, identities, hosts, version } = plan;
  for (const { path, dev, ino } of identities) {
    const current = lstatSync(path);
    if (current.dev !== dev || current.ino !== ino) throw Error(`Conquistador files changed during confirmation: ${path}. Inspect them and retry.`);
  }
  mkdirSync(backup, { mode: 0o700 });
  const moved = [];
  try {
    for (const source of paths) {
      const target = join(backup, relative(project, source));
      mkdirSync(dirname(target), { recursive: true });
      renameSync(source, target);
      moved.push({ source, target });
    }
    writeManifest(join(backup, 'backup.json'), JSON.stringify({
      schemaVersion: 'conquistador.setup-backup/v1', createdAt: new Date().toISOString(),
      project, cliVersion: version, hosts, entries: moved,
    }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return backup;
  } catch (error) {
    try {
      for (const { source, target } of moved.reverse()) renameSync(target, source);
      rmSync(join(backup, 'backup.json'), { force: true });
      for (const { target } of moved.sort((a, b) => b.target.length - a.target.length)) {
        for (let parent = dirname(target); parent !== backup; parent = dirname(parent)) {
          try { rmdirSync(parent); } catch { break; }
        }
      }
      rmdirSync(backup);
    } catch (rollback) {
      throw Error(`Backup stopped and rollback needs attention at ${backup}: ${rollback.message}`, { cause: error });
    }
    throw error;
  }
}
