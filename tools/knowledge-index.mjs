import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const HANDLE = /^[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)?$/;
const inside = (root, path) => { const delta = relative(root, path); return !delta || (delta !== '..' && !delta.startsWith(`..${sep}`) && !isAbsolute(delta)); };
function regular(path, limit) {
  for (let cursor = path; ; cursor = dirname(cursor)) {
    if (lstatSync(cursor).isSymbolicLink()) throw Error('Knowledge sources must not cross symlinks.');
    if (cursor === dirname(cursor)) break;
  }
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size > limit) throw Error('Knowledge source must be a bounded regular file.');
  return readFileSync(path, 'utf8');
}

// Only an explicitly supplied private index grants retrieval. Never crawl or persist knowledge.
export function createKnowledgeResolver(indexPath, { productRoot }) {
  const path = resolve(indexPath);
  const product = realpathSync(productRoot);
  if (inside(product, path)) throw Error('Keep the knowledge index outside the installed product.');
  const value = JSON.parse(regular(path, 65536));
  if (value.schemaVersion !== 'conquistador.knowledge-index/v1' || !Array.isArray(value.handles) || value.handles.length > 20) throw Error('Invalid private knowledge index.');
  const records = new Map();
  for (const item of value.handles) {
    if (!HANDLE.test(item.handle) || records.has(item.handle) || typeof item.path !== 'string' || isAbsolute(item.path) || item.path.split(/[\\/]/).includes('..') || !item.source || !item.scope || typeof item.freshness !== 'string') throw Error('Invalid scoped knowledge entry.');
    const source = resolve(dirname(path), item.path);
    if (!inside(dirname(path), source) || inside(product, source)) throw Error('Knowledge source is outside the authorized scope.');
    records.set(item.handle, { ...item, path: source });
  }
  return async handle => {
    const item = records.get(handle);
    if (!item) throw Error('Knowledge handle is outside the authorized index.');
    return `Source: ${item.source}\nScope: ${item.scope}\nFreshness: ${item.freshness}\n\n${regular(item.path, 28000)}`;
  };
}
