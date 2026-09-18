// Maintainer command: regenerate the release baseline after intentional method edits.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { methodIdentity } from './installation-doctor.mjs';

import { operatorFiles } from './operator-package.mjs';
import { writeRoutingContract } from './routing-contract.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
writeRoutingContract(root);
const skills = join(root, 'skills');
const digest = path => createHash('sha256').update(readFileSync(join(skills, path))).digest('hex');
const methods = readdirSync(skills).sort().map(name => {
  const path = `${name}/SKILL.md`;
  const identity = methodIdentity(readFileSync(join(skills, path), 'utf8'));
  if (identity.name !== name || !identity.version) throw Error(`Invalid method identity: ${path}`);
  return { ...identity, sha256: digest(path) };
});
function resources(directory = '') {
  return readdirSync(join(skills, directory)).sort().flatMap(name => {
    const path = directory ? `${directory}/${name}` : name;
    const stat = lstatSync(join(skills, path));
    if (stat.isDirectory()) return resources(path);
    if (!stat.isFile()) throw Error(`Not a regular method resource: ${path}`);
    if (/^[^/]+\/SKILL\.md$/.test(path)) return [];
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
if (!manifest.parent || manifest.outcomes.length !== 38) throw Error('Expected the parent and 38 outcomes; review the release contract before changing this count.');
writeFileSync(join(root, 'release/completeness.json'), JSON.stringify(manifest, null, 2) + '\n');
