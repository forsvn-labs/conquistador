import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';

export const methodDocument = 'METHOD.md';
export const commandDocument = 'COMMAND.md';
export const parentName = 'conquistador';
// Library-relative locations. The parent is the only skill; each command lives under it.
export const methodDirectory = name => name === parentName ? parentName : `${parentName}/commands/${name}`;
export const methodPath = (name, { internal = false } = {}) => name === parentName
  ? `${parentName}/${internal ? methodDocument : 'SKILL.md'}` : `${methodDirectory(name)}/${commandDocument}`;
export const playPath = name => `${parentName}/plays/${name}.md`;
// The method that owns a library-relative path, or null for shared parent files.
export function methodOwner(key) {
  const match = /^conquistador\/(?:commands|plays)\/([a-z][a-z0-9-]*)(?:\/|\.md$)/.exec(key);
  return match ? match[1] : null;
}
export function commandNames(libraryRoot) {
  const directory = join(libraryRoot, parentName, 'commands');
  if (!existsSync(directory)) return [];
  return readdirSync(directory).sort().filter(name => /^[a-z][a-z0-9-]*$/.test(name) && existsSync(join(directory, name, commandDocument)));
}
export const internalPath = path => path.replace(/(^|\/)SKILL\.md$/, `$1${methodDocument}`);

// Keep directory structure and all method metadata. Only the internal document name changes.
// URLs are not package paths. The reserved name makes normalization unambiguous.
export function internalText(text) {
  if (/\bMETHOD\.md\b/.test(text)) throw Error('Canonical methods must not use the reserved internal METHOD.md name.');
  return text.replace(/https?:\/\/[^\s)>]+|(?:agent\/)?skills\/conquistador\/SKILL\.md|\bSKILL\.md\b/g, token => token === 'SKILL.md' ? methodDocument : token);
}
export function canonicalText(text) {
  return text.replace(/https?:\/\/[^\s)>]+|\bMETHOD\.md\b/g, token => token === methodDocument ? 'SKILL.md' : token);
}

export function regularFiles(root, prefix = '') {
  return readdirSync(join(root, prefix)).sort().flatMap(name => {
    const key = prefix ? `${prefix}/${name}` : name;
    const stat = lstatSync(join(root, key));
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) throw Error(`Not a regular method resource: ${key}`);
    return stat.isDirectory() ? regularFiles(root, key) : [key];
  });
}

// Fixed layouts, not paths supplied by an installation receipt.
export function methodLibrary(root) {
  const candidates = [
    { layout: 'library', entry: 'SKILL.md', internal: true },
    { layout: 'skills/conquistador/library', entry: 'skills/conquistador/SKILL.md', internal: true },
    { layout: 'agent/skills/conquistador/library', entry: 'agent/skills/conquistador/SKILL.md', internal: true },
    ...['skills', 'library', 'agent/skills'].map(layout => ({ layout, entry: layout === 'agent/skills' ? 'agent/skills/conquistador/SKILL.md' : 'SKILL.md', internal: false })),
  ];
  const present = candidates.filter(candidate => existsSync(join(root, candidate.layout, 'conquistador', candidate.internal ? methodDocument : 'SKILL.md')));
  const internal = present.filter(candidate => candidate.internal);
  return internal.length ? internal : present;
}

export function capabilityCatalog(source, names) {
  const contract = JSON.parse(readFileSync(join(source, 'conquistador/routing-contract.json'), 'utf8'));
  const labels = new Map(Object.values(contract.methods).map(method => [method.name, method.label]));
  const rows = names.filter(name => name !== 'conquistador').sort().map(name => {
    if (!labels.has(name)) throw Error(`Missing public capability label: ${name}`);
    return `| ${labels.get(name)} | [${name}](commands/${name}/${commandDocument}) |`;
  });
  return '# Available capabilities\n\nSelect only the methods needed for this request. Show the relevant public capability and specialist\nlabels during work. Load a method and its resources only after routing. This catalog lists only the\nmethods included in this package; it grants no permission beyond its domain restriction or host.\n\n| Public capability | Internal method |\n| --- | --- |\n' + rows.join('\n') + '\n';
}

// Domain/squad subsets must not link to omitted methods, roles, or workflows.
export function subsetLinks(text, sourceKey, files) {
  const available = new Set(files);
  for (const file of files) {
    for (let directory = posix.dirname(file); directory !== '.'; directory = posix.dirname(directory)) available.add(directory);
  }
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (link, label, href) => {
    if (/^(?:[a-z]+:|\/|#)/i.test(href)) return link;
    const path = decodeURIComponent(href.split(/[?#]/)[0]);
    const target = posix.normalize(posix.join(posix.dirname(sourceKey), path)).replace(/\/$/, '');
    return available.has(target) ? link : `${label} (not included in this package)`;
  });
}

export function skillDiscovery(root) {
  const entries = regularFiles(root).filter(file => /(^|\/)SKILL\.md$/.test(file)).map(path => {
    const frontmatter = /^---\n([\s\S]*?)\n---/.exec(readFileSync(join(root, path), 'utf8'))?.[1] ?? '';
    const name = /^name: (.+)$/m.exec(frontmatter)?.[1] ?? '';
    const description = /^description: (.+)$/m.exec(frontmatter)?.[1] ?? '';
    return { path, name, description };
  });
  return { entries, count: entries.length,
    metadataCharacters: entries.reduce((size, entry) => size + entry.name.length + entry.description.length + join(root, entry.path).length, 0) };
}
