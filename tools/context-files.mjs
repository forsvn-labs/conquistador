// Durable project context: PRODUCT.md (product truth, shared with Impeccable) and GROWTH.md
// (growth truth). Every command reads them through the brief; /conquistador init writes them.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const GROWTH_SCHEMA = 1;
export const GROWTH_MARKER = `<!-- conquistador:growth-schema ${GROWTH_SCHEMA} -->`;
export const CONTEXT_NAMES = Object.freeze({ product: 'PRODUCT.md', growth: 'GROWTH.md' });

const isFile = path => { try { return statSync(path).isFile(); } catch { return false; } };

// The nearest folder at or above cwd that holds .git; otherwise cwd itself.
export function projectRoot(cwd = process.cwd()) {
  const start = resolve(cwd);
  for (let dir = start; ; dir = dirname(dir)) {
    if (existsSync(join(dir, '.git'))) return dir;
    if (dirname(dir) === dir) return start;
  }
}

// The existing context files, nearest first: a child app's own file wins over the root's.
// Returns [{ kind, name, path }] in reading order, product before growth.
export function contextFiles(cwd = process.cwd()) {
  const root = projectRoot(cwd);
  const found = [];
  for (const [kind, name] of Object.entries(CONTEXT_NAMES)) {
    for (let dir = resolve(cwd); ; dir = dirname(dir)) {
      if (isFile(join(dir, name))) { found.push({ kind, name, path: join(dir, name) }); break; }
      if (dir === root || dirname(dir) === dir) break;
    }
  }
  return found;
}

// Which tool wrote PRODUCT.md, and which GROWTH.md schema the file follows.
export function describeContext(file) {
  let text = '';
  try { text = readFileSync(file.path, 'utf8'); } catch { return { ...file, readable: false }; }
  const schema = /<!--\s*(impeccable:product|conquistador:growth)-schema\s+(\d+)\s*-->/.exec(text);
  const platform = /^##\s+Platform\s*\n+\s*([a-z]+)/im.exec(text)?.[1]?.toLowerCase() ?? null;
  const open = (text.match(/^\s*[-*]\s+(?:Open|Undecided)\b/gim) ?? []).length;
  return { ...file, readable: true, schema: schema ? { owner: schema[1].split(':')[0], version: Number(schema[2]) } : null, platform, open, bytes: Buffer.byteLength(text) };
}

// The .gitignore block for Conquistador's ephemeral per-project files.
export const GITIGNORE_START = '# conquistador:start';
export const GITIGNORE_END = '# conquistador:end';
export const GITIGNORE_BLOCK = [
  GITIGNORE_START,
  '# Ephemeral Conquistador files. PRODUCT.md, GROWTH.md, and .conquistador/config.json stay in Git.',
  '.conquistador/runs/',
  '.conquistador/cache/',
  '.conquistador/logs/',
  '.conquistador/tmp/',
  '.conquistador/*.local.json',
  GITIGNORE_END,
].join('\n');

// Adds the block once, or replaces an older block in place. Other lines stay as they are.
// Returns 'added', 'updated', or 'unchanged'.
export function ensureGitignore(root = projectRoot()) {
  const path = join(root, '.gitignore');
  const before = isFile(path) ? readFileSync(path, 'utf8') : '';
  const start = before.indexOf(GITIGNORE_START);
  const end = start < 0 ? -1 : before.indexOf(GITIGNORE_END, start);
  let after;
  if (start >= 0 && end >= 0) after = before.slice(0, start) + GITIGNORE_BLOCK + before.slice(end + GITIGNORE_END.length);
  else after = `${before}${before && !before.endsWith('\n') ? '\n' : ''}${before ? '\n' : ''}${GITIGNORE_BLOCK}\n`;
  if (after === before) return { path, result: 'unchanged' };
  writeFileSync(path, after);
  return { path, result: start >= 0 && end >= 0 ? 'updated' : 'added' };
}

// conquistador context [--json] [--gitignore]
export function runContext(args, cwd = process.cwd()) {
  const unknown = args.filter(arg => !['--json', '--gitignore'].includes(arg));
  if (unknown.length) { process.stderr.write('Usage: conquistador context [--json] [--gitignore]\n'); return 2; }
  const root = projectRoot(cwd);
  const gitignore = args.includes('--gitignore') ? ensureGitignore(root) : null;
  const files = contextFiles(cwd).map(describeContext);
  if (args.includes('--json')) {
    console.log(JSON.stringify({ root, files, gitignore }, null, 2));
    return 0;
  }
  if (!files.length) console.log('No PRODUCT.md or GROWTH.md here. Run /conquistador init in your agent.');
  for (const file of files) console.log(`${file.name}: ${file.path}${file.schema ? ` (${file.schema.owner} schema ${file.schema.version})` : ''}`);
  if (gitignore) console.log(`.gitignore: ${gitignore.result} (${gitignore.path})`);
  return 0;
}
