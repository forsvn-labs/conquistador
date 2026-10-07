// MCP apps: desktop and editor apps that run the local Conquistador MCP server from their own
// config file. Only apps without the plugin are configured here; an agent with the plugin already
// has the server (see onboard.mjs). Each change keeps the app's other settings and writes a backup
// first. A file that is not plain JSON (for example JSON with comments) is never rewritten.
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { posix, win32 } from 'node:path';

export const SERVER_NAME = 'conquistador';
export const BACKUP_SUFFIX = '.conquistador-backup';

const paths = ctx => (ctx.platform === 'win32' ? win32 : posix);
const xdg = ctx => ctx.env.XDG_CONFIG_HOME || paths(ctx).join(ctx.home, '.config');
// The per-user application data folder: %APPDATA% on Windows, Application Support on macOS.
function appData(ctx, ...parts) {
  const { join } = paths(ctx);
  if (ctx.platform === 'win32') return join(ctx.env.APPDATA || join(ctx.home, 'AppData', 'Roaming'), ...parts);
  if (ctx.platform === 'darwin') return join(ctx.home, 'Library', 'Application Support', ...parts);
  return join(xdg(ctx), ...parts);
}

// Config locations and entry keys from each app's documentation (checked 2026-10-07).
// `agent` names the coding agent that already gets the plugin for the same app.
export const MCP_APPS = [
  { id: 'claude-desktop', label: 'Claude Desktop', key: 'mcpServers', file: 'claude_desktop_config.json', folder: ctx => appData(ctx, 'Claude') },
  { id: 'vscode', label: 'VS Code', key: 'servers', file: 'mcp.json', folder: ctx => appData(ctx, 'Code', 'User') },
  { id: 'windsurf', label: 'Windsurf', key: 'mcpServers', file: 'mcp_config.json', folder: ctx => paths(ctx).join(ctx.home, '.codeium', 'windsurf') },
  { id: 'zed', label: 'Zed', key: 'context_servers', file: 'settings.json', folder: ctx => (ctx.platform === 'win32' ? appData(ctx, 'Zed') : paths(ctx).join(xdg(ctx), 'zed')) },
  { id: 'cursor', label: 'Cursor', key: 'mcpServers', file: 'mcp.json', agent: 'cursor', folder: ctx => paths(ctx).join(ctx.home, '.cursor') },
];

const context = (ctx = {}) => ({ platform: process.platform, home: homedir(), env: process.env, ...ctx });
export const appById = id => MCP_APPS.find(app => app.id === id) ?? null;
export const appConfigPath = (id, ctx) => { const app = appById(id), full = context(ctx); return paths(full).join(app.folder(full), app.file); };

// The entry each app expects for a local stdio server.
export function serverEntry(id, { command, args }) {
  if (id === 'vscode') return { type: 'stdio', command, args };
  if (id === 'zed') return { source: 'custom', command, args, env: {} };
  return { command, args };
}

function parse(text) {
  if (!String(text ?? '').trim()) return {};
  let value;
  try { value = JSON.parse(text); } catch { throw Error('not plain JSON'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('not plain JSON');
  return value;
}

// Add or update the Conquistador entry in a config file's text. Other keys stay as they are.
export function mergeEntry(text, id, server) {
  const config = parse(text), { key } = appById(id), entry = serverEntry(id, server);
  if (config[key] !== undefined && (typeof config[key] !== 'object' || config[key] === null || Array.isArray(config[key]))) throw Error(`not plain JSON (${key} is not an object)`);
  const servers = config[key] ?? {};
  const existing = servers[SERVER_NAME];
  if (existing && JSON.stringify(existing) === JSON.stringify(entry)) return { status: 'unchanged', text };
  config[key] = { ...servers, [SERVER_NAME]: entry };
  return { status: existing ? 'updated' : 'added', text: `${JSON.stringify(config, null, 2)}\n` };
}

export function removeEntry(text, id) {
  const config = parse(text), { key } = appById(id);
  if (!config[key]?.[SERVER_NAME]) return { status: 'absent', text };
  delete config[key][SERVER_NAME];
  return { status: 'removed', text: `${JSON.stringify(config, null, 2)}\n` };
}

// The entry to add by hand when a file cannot be rewritten safely.
export const manualEntry = (id, server) => JSON.stringify({ [appById(id).key]: { [SERVER_NAME]: serverEntry(id, server) } }, null, 2);

const read = path => { try { return readFileSync(path, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return ''; throw error; } };

// Detected means the app's config folder exists.
export function detectApps(ctx) {
  const full = context(ctx);
  return MCP_APPS.map(app => {
    const folder = app.folder(full);
    let found = false;
    try { found = statSync(folder).isDirectory(); } catch { /* Not installed. */ }
    return { ...app, path: paths(full).join(folder, app.file), found };
  });
}

// What applying would do, without writing: add, update, unchanged, or manual (with the reason).
export function inspectApp(id, server, ctx) {
  const path = appConfigPath(id, ctx);
  try {
    const { status } = mergeEntry(read(path), id, server);
    return { path, action: status === 'added' ? 'add' : status === 'updated' ? 'update' : 'unchanged' };
  } catch (error) {
    return { path, action: 'manual', reason: `${path.split(/[\\/]/).pop()} is ${error.message}; add the entry by hand` };
  }
}

// Write the entry. The first backup holds the file as it was before Conquistador changed it.
export function applyApp(id, server, ctx) {
  const path = appConfigPath(id, ctx);
  try {
    const before = read(path);
    let merged;
    try { merged = mergeEntry(before, id, server); }
    catch (error) { return { ok: false, manual: true, path, error: `${path.split(/[\\/]/).pop()} is ${error.message}. Add this entry by hand:\n${manualEntry(id, server)}` }; }
    if (merged.status === 'unchanged') return { ok: true, path, status: 'unchanged' };
    mkdirSync(paths(context(ctx)).dirname(path), { recursive: true });
    let backup = null;
    if (existsSync(path)) {
      backup = `${path}${BACKUP_SUFFIX}`;
      if (!existsSync(backup)) copyFileSync(path, backup);
    }
    const temporary = `${path}.conquistador-${process.pid}.tmp`;
    writeFileSync(temporary, merged.text);
    renameSync(temporary, path);
    return { ok: true, path, status: merged.status, backup };
  } catch (error) { return { ok: false, path, error: error.message }; }
}

export function removeApp(id, ctx) {
  const path = appConfigPath(id, ctx);
  try {
    if (!existsSync(path)) return { ok: true, path, status: 'absent' };
    const result = removeEntry(read(path), id);
    if (result.status === 'removed') {
      if (!existsSync(`${path}${BACKUP_SUFFIX}`)) copyFileSync(path, `${path}${BACKUP_SUFFIX}`);
      const temporary = `${path}.conquistador-${process.pid}.tmp`;
      writeFileSync(temporary, result.text);
      renameSync(temporary, path);
    }
    return { ok: true, path, status: result.status };
  } catch (error) { return { ok: false, path, error: `${error.message}. Remove "${SERVER_NAME}" from ${path} by hand.` }; }
}

// The installed entry matches, and the command and server script it names exist.
export function checkApp(id, server, ctx) {
  const path = appConfigPath(id, ctx);
  let config;
  try { config = parse(read(path)); } catch (error) { return { ok: false, detail: `${path} is ${error.message}` }; }
  const entry = config[appById(id).key]?.[SERVER_NAME];
  if (!entry) return { ok: false, detail: `no "${SERVER_NAME}" entry in ${path}` };
  if (JSON.stringify(entry) !== JSON.stringify(serverEntry(id, server))) return { ok: false, detail: `the "${SERVER_NAME}" entry in ${path} points elsewhere` };
  for (const file of [server.command, ...server.args]) if (!existsSync(file)) return { ok: false, detail: `${file} is missing` };
  return { ok: true, detail: path };
}
