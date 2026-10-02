import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { capabilityCatalog, internalPath, internalText, regularFiles, subsetLinks } from './method-library.mjs';
import { writeRoutingContract } from './routing-contract.mjs';

// Transform a selected canonical library inside its one discoverable parent entry.
export function stageMethodLibrary(source, entry, { include = () => true, subset = false, template } = {}) {
  const allFiles = regularFiles(source);
  const files = allFiles.filter(include);
  const partial = subset && files.length !== allFiles.length;
  for (const file of files) {
    const destination = join(entry, 'library', internalPath(file));
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(source, file), destination);
    if (file.endsWith('.md')) {
      const text = readFileSync(join(source, file), 'utf8');
      writeFileSync(destination, internalText(partial ? subsetLinks(text, file, files) : text));
    }
  }
  if (!files.includes('conquistador/SKILL.md')) throw Error('Lazy library requires its parent.');
  const names = ['conquistador', ...files.map(file => /^conquistador\/commands\/([^/]+)\/COMMAND\.md$/.exec(file)?.[1]).filter(Boolean)];
  writeFileSync(join(entry, 'library/conquistador/catalog.md'), capabilityCatalog(source, names));
  writeFileSync(join(entry, 'SKILL.md'), template);
  mkdirSync(join(entry, 'agents'), { recursive: true });
  copyFileSync(join(source, 'conquistador/agents/openai.yaml'), join(entry, 'agents/openai.yaml'));
  writeRoutingContract(entry);
}
