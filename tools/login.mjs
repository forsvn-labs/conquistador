// `conquistador login`, `logout`, and `whoami`: a personal token for the hosted MCP server.
// GitHub's device flow proves who you are; the server checks the GitHub token with its client
// secret, issues a cq_ token, and keeps only the token's hash. The CLI never holds the client
// secret. The token lives in ~/.conquistador/mcp-token (mode 600).
// runLogin({ ui }) is also the onboarding entry: it resolves to { token, login }, or null when
// the person cancels.
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { clientConfigs } from './mcp-client-config.mjs';

export const DEFAULT_SERVER = 'https://mcp.forsvn.com';
const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

const HELP = `Usage:
  conquistador login [--server URL] [--no-open]
  conquistador whoami [--server URL] [--json]
  conquistador logout [--server URL]

login signs you in with GitHub and saves a personal token for the hosted MCP server
to ~/.conquistador/mcp-token. Signing in again replaces the token.
whoami shows who the saved token belongs to. logout revokes it and deletes your record.
The server is ${DEFAULT_SERVER} unless you pass --server or set CONQUISTADOR_MCP_URL.
`;

const home = env => env.CONQUISTADOR_HOME || join(env.HOME || env.USERPROFILE || homedir(), '.conquistador');
export const tokenPath = (env = process.env) => join(home(env), 'mcp-token');
const serverOf = (env, server) => (server || env.CONQUISTADOR_MCP_URL || DEFAULT_SERVER).replace(/\/+$/, '').replace(/\/mcp$/, '');
// CONQUISTADOR_GITHUB_URL exists for the offline E2E only.
const githubOf = env => (env.CONQUISTADOR_GITHUB_URL || 'https://github.com').replace(/\/+$/, '');
const origin = url => { try { return new URL(url).origin; } catch { return url; } };

export function readToken(env = process.env) {
  try { return readFileSync(tokenPath(env), 'utf8').trim() || null; } catch { return null; }
}

// Writes the token atomically, readable only by this user. Windows ignores the modes.
// A token that is not a personal one (for example the server's admin token) moves to
// mcp-token.previous instead of being lost; the function returns that path, or null.
export function saveToken(token, env = process.env) {
  const folder = home(env);
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') chmodSync(folder, 0o700);
  const file = tokenPath(env);
  const existing = readToken(env);
  let kept = null;
  if (existing && !existing.startsWith('cq_')) {
    kept = `${file}.previous`;
    if (existsSync(kept)) kept = `${file}.previous-${Date.now()}`;
    writeFileSync(kept, `${existing}\n`, { mode: 0o600, flag: 'wx' });
  }
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, `${token}\n`, { mode: 0o600, flag: 'w' });
  if (process.platform !== 'win32') chmodSync(temporary, 0o600);
  renameSync(temporary, file);
  return kept;
}

async function call(fetchImpl, url, init = {}, label = origin(url)) {
  let response;
  try {
    response = await fetchImpl(url, { ...init, headers: { accept: 'application/json', ...init.headers } });
  } catch {
    throw Error(`Could not reach ${label}. Check your connection, or set CONQUISTADOR_MCP_URL.`);
  }
  let body = {};
  try { body = await response.json(); } catch { /* Not JSON; the status says enough. */ }
  return { status: response.status, ok: response.ok, body };
}

const form = values => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values).toString() });

const sleep = (ms, signal) => new Promise(done => {
  if (signal?.aborted) return done(false);
  const timer = setTimeout(() => { signal?.removeEventListener('abort', stop); done(true); }, ms);
  const stop = () => { clearTimeout(timer); done(false); };
  signal?.addEventListener('abort', stop, { once: true });
});

function openUrl(url) {
  const [command, args] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? [process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', 'start', '', url]]
      : ['xdg-open', [url]];
  try { spawn(command, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch { /* The URL is shown. */ }
}

// Signs in with the GitHub device flow and saves the new token. `ui` is Clack-compatible
// (note, spinner). Resolves to { token, login }, or null when the person cancels on GitHub or
// `signal` aborts. Throws an Error with a plain message for every other failure.
export async function runLogin({ ui, server, env = process.env, fetch: fetchImpl = globalThis.fetch, signal, open = false } = {}) {
  const base = serverOf(env, server);
  const github = githubOf(env);
  const config = await call(fetchImpl, `${base}/api/login`);
  if (!config.ok || !config.body.githubClientId) throw Error(config.body.error ?? `${base} does not offer sign-in (HTTP ${config.status}).`);
  const clientId = config.body.githubClientId;

  const device = (await call(fetchImpl, `${github}/login/device/code`, form({ client_id: clientId, scope: '' }), `GitHub (${github})`)).body;
  if (!device.device_code) throw Error(`GitHub refused the device sign-in (${device.error ?? 'no device code'}). The OAuth App must allow the device flow.`);
  ui.note(`Open ${device.verification_uri}\nEnter this code: ${device.user_code}`, 'Sign in with GitHub');
  if (open) openUrl(device.verification_uri);

  const spin = ui.spinner();
  spin.start('Waiting for you to approve the sign-in on GitHub');
  let interval = Math.max(Number(device.interval) || 5, 1) * 1000;
  const deadline = Date.now() + (Number(device.expires_in) || 900) * 1000;
  let githubToken = null;
  try {
    while (!githubToken) {
      if (!(await sleep(interval, signal))) { spin.stop('Sign-in cancelled.', 1); return null; }
      if (Date.now() > deadline) throw Error('The GitHub code expired. Run conquistador login again.');
      const { body } = await call(fetchImpl, `${github}/login/oauth/access_token`, form({ client_id: clientId, device_code: device.device_code, grant_type: DEVICE_GRANT }), `GitHub (${github})`);
      if (body.access_token) githubToken = body.access_token;
      else if (body.error === 'authorization_pending') continue;
      else if (body.error === 'slow_down') interval = Math.max((Number(body.interval) || 0) * 1000, interval + 5000);
      else if (body.error === 'access_denied') { spin.stop('Sign-in cancelled on GitHub.', 1); return null; }
      else if (body.error === 'expired_token') throw Error('The GitHub code expired. Run conquistador login again.');
      else throw Error(`GitHub refused the sign-in (${body.error ?? 'no access token'}).`);
    }
  } catch (error) {
    spin.stop('Sign-in failed.', 2);
    throw error;
  }
  spin.stop('Approved on GitHub.');

  const issued = await call(fetchImpl, `${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ githubToken }) });
  if (!issued.ok || !issued.body.token) throw Error(issued.body.error ?? `${base} did not issue a token (HTTP ${issued.status}).`);
  const kept = saveToken(issued.body.token, env);
  if (kept) ui.log.info(`The token file held another token, maybe the server admin token. It is now in ${kept}.`);
  return { token: issued.body.token, login: issued.body.login };
}

// The client configs as plain text, for a terminal.
export function formatConfigs({ url, token }) {
  return clientConfigs({ url, token }).map(item => `${item.client}. ${item.where}\n${item.text.split('\n').map(line => `  ${line}`).join('\n')}`).join('\n\n');
}

function parse(args, flags) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const [name, inline] = arg.split(/=(.*)/s, 2);
    if (name === '--server') { options.server = inline ?? args[++index]; if (!options.server) throw Error('--server needs a URL.'); }
    else if (flags.includes(arg)) options[arg.slice(2)] = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw Error(`Unknown option: ${arg}`);
  }
  return options;
}

export async function runLoginCommand(args, { env = process.env, stdout = process.stdout, stderr = process.stderr } = {}) {
  let options;
  try { options = parse(args, ['--no-open']); } catch (error) { stderr.write(`${error.message}\n${HELP}`); return 2; }
  if (options.help) { stdout.write(HELP); return 0; }
  const ui = await import('./vendor/clack.mjs');
  const base = serverOf(env, options.server);
  try {
    const result = await runLogin({ ui, server: options.server, env, open: !options['no-open'] && Boolean(process.stdout.isTTY) });
    if (!result) { stderr.write('Sign-in cancelled. No token was made.\n'); return 1; }
    stdout.write(`\nSigned in as @${result.login}.\nSaved your token to ${tokenPath(env)}. Only you can read that file.\nSigning in again replaces the token. conquistador logout revokes it.\n\nAdd the server to your MCP client:\n\n${formatConfigs({ url: `${base}/mcp`, token: result.token })}\n`);
    return 0;
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }
}

export async function runWhoami(args, { env = process.env, stdout = process.stdout, stderr = process.stderr, fetch: fetchImpl = globalThis.fetch } = {}) {
  let options;
  try { options = parse(args, ['--json']); } catch (error) { stderr.write(`${error.message}\n${HELP}`); return 2; }
  if (options.help) { stdout.write(HELP); return 0; }
  const token = readToken(env);
  if (!token) { stderr.write('Not signed in. Run conquistador login.\n'); return 1; }
  const base = serverOf(env, options.server);
  try {
    const { ok, body, status } = await call(fetchImpl, `${base}/api/whoami`, { headers: { authorization: `Bearer ${token}` } });
    if (!ok) { stderr.write(`${body.error ?? `HTTP ${status}`}\n`); return 1; }
    if (options.json) stdout.write(`${JSON.stringify({ server: base, ...body })}\n`);
    else if (body.kind === 'admin') stdout.write(`The saved token is the admin token of ${base}.\n`);
    else stdout.write(`Signed in as @${body.login} (GitHub id ${body.githubId}) on ${base}.\nToken made ${body.created}. Last used ${body.lastUsed ?? 'never'}.\n`);
    return 0;
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }
}

export async function runLogout(args, { env = process.env, stdout = process.stdout, stderr = process.stderr, fetch: fetchImpl = globalThis.fetch } = {}) {
  let options;
  try { options = parse(args, []); } catch (error) { stderr.write(`${error.message}\n${HELP}`); return 2; }
  if (options.help) { stdout.write(HELP); return 0; }
  const token = readToken(env);
  if (!token) { stdout.write('Not signed in. Nothing to revoke.\n'); return 0; }
  const base = serverOf(env, options.server);
  let result;
  try {
    result = await call(fetchImpl, `${base}/api/logout`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
  } catch {
    stderr.write(`Could not reach ${origin(base)}. The token is not revoked, and ${tokenPath(env)} is kept. Try again later.\n`);
    return 1;
  }
  if (result.ok) {
    rmSync(tokenPath(env), { force: true });
    stdout.write('Signed out. The server revoked the token and deleted your record.\n');
    return 0;
  }
  if (result.status === 401) {
    rmSync(tokenPath(env), { force: true });
    stdout.write('The server had already stopped accepting this token. Removed the local copy.\n');
    return 0;
  }
  stderr.write(`${result.body.error ?? `HTTP ${result.status}`} The local token is kept.\n`);
  return 1;
}
