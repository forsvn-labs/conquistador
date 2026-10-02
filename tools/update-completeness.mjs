// Maintainer command: regenerate the release baseline after intentional method edits.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { methodIdentity } from './installation-doctor.mjs';
import { commandNames, methodPath } from './method-library.mjs';

import { operatorFiles } from './operator-package.mjs';
import { writeRoutingContract } from './routing-contract.mjs';
import { buildPluginManifest, pluginManifestPath } from './plugin-payload.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
writeRoutingContract(root);
const skills = join(root, 'skills');
const digest = path => createHash('sha256').update(readFileSync(join(skills, path))).digest('hex');
const methods = ['conquistador', ...commandNames(skills)].sort().map(name => {
  const path = methodPath(name);
  const identity = methodIdentity(readFileSync(join(skills, path), 'utf8'));
  if (identity.name !== name || !identity.version) throw Error(`Invalid method identity: ${path}`);
  return { ...identity, sha256: digest(path) };
});
function resources(directory = '') {
  return readdirSync(join(skills, directory)).sort().filter(name => !name.startsWith('.')).flatMap(name => {
    const path = directory ? `${directory}/${name}` : name;
    const stat = lstatSync(join(skills, path));
    if (stat.isDirectory()) return resources(path);
    if (!stat.isFile()) throw Error(`Not a regular method resource: ${path}`);
    if (path === methodPath('conquistador') || /^conquistador\/commands\/[^/]+\/COMMAND\.md$/.test(path)) return [];
    if (/(^|\/)\./.test(path)) return [];
    return [{ path, sha256: digest(path) }];
  });
}
const manifest = {
  schemaVersion: 'conquistador.install-completeness/v1',
  parent: methods.find(method => method.name === 'conquistador'),
  outcomes: methods.filter(method => method.name !== 'conquistador'),
  requiredResources: resources(),
  operatorResources: operatorFiles.map(path => ({ path, sha256: createHash('sha256').update(readFileSync(join(root, path))).digest('hex') })),
};
if (!manifest.parent || manifest.outcomes.length !== 35) throw Error('Expected the parent and 35 commands; review the release contract before changing this count.');
writeFileSync(join(root, 'release/completeness.json'), JSON.stringify(manifest, null, 2) + '\n');

writeFileSync(join(root, pluginManifestPath), JSON.stringify(buildPluginManifest(root, manifest), null, 2) + '\n');
