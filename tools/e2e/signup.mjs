#!/usr/bin/env node
// E2E for self-serve tokens on the hosted MCP server. Runs the real Worker in workerd
// (`wrangler dev` with a local KV namespace and the local rate limiter) and the real CLI
// (`conquistador login`, `whoami`, `logout`).
//
// Offline (default): a local GitHub test double answers in place of github.com and
// api.github.com. It is not GitHub; the report marks every step that depends on it.
// --live: real GitHub. Without --url it starts `wrangler dev` with GITHUB_CLIENT_ID and
// GITHUB_CLIENT_SECRET from the environment (the device flow works on any host). With
// --url https://mcp.forsvn.com it tests the deployed Worker. A person approves the device code.
//
// Wrangler: set WRANGLER_BIN to a wrangler 4.148.0 binary, or the script runs npx wrangler@4.148.0.
// Report: dist/e2e/signup/report.json and report.md.
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnCommand } from '../spawn.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const bin = join(root, 'runtime/bin/conquistador.js');
const args = process.argv.slice(2);
const option = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const live = args.includes('--live');
const out = resolve(option('--out') ?? join(root, 'dist/e2e/signup'));
const TOKEN = /cq_[A-Za-z0-9_-]{43}/;
const sha256 = text => createHash('sha256').update(text).digest('hex');
const wait = ms => new Promise(done => setTimeout(done, ms));

const steps = [];
const record = (name, passed, detail = {}) => {
  steps.push({ name, passed: Boolean(passed), ...detail });
  process.stderr.write(`${passed ? 'pass' : 'FAIL'}  ${name}\n`);
};

// --- Processes ------------------------------------------------------------------------------

const children = [];
function wrangler(wranglerArgs, options = {}) {
  const command = process.env.WRANGLER_BIN ? [process.env.WRANGLER_BIN, wranglerArgs] : ['npx', ['wrangler@4.148.0', ...wranglerArgs]];
  const { file, args: fileArgs, options: spawnOptions } = spawnCommand(command[0], command[1]);
  return spawn(file, fileArgs, { cwd: root, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' }, ...spawnOptions, ...options });
}

function collect(child) {
  return new Promise(done => {
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', chunk => { stdout += chunk; });
    child.stderr?.on('data', chunk => { stderr += chunk; });
    child.on('close', status => done({ status, stdout, stderr }));
  });
}

async function freePort() {
  const server = createServer();
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const { port } = server.address();
  await new Promise(done => server.close(done));
  return port;
}

// Starts `wrangler dev` with the repository's wrangler.toml and the given variables.
async function startWorker(name, vars) {
  const port = await freePort();
  const state = join(out, 'state', name);
  rmSync(state, { recursive: true, force: true });
  const varArgs = Object.entries(vars).flatMap(([key, value]) => ['--var', `${key}:${value}`]);
  const child = wrangler(['dev', '--port', String(port), '--ip', '127.0.0.1', '--persist-to', state, '--show-interactive-dev-session=false', ...varArgs], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  let log = '';
  child.stdout.on('data', chunk => { log += chunk; });
  child.stderr.on('data', chunk => { log += chunk; });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) break;
    try { if ((await fetch(`${base}/health`)).ok) return { base, state, child, log: () => log }; } catch { /* Not ready yet. */ }
    await wait(500);
  }
  writeFileSync(join(out, `wrangler-${name}.log`), log);
  throw Error(`wrangler dev (${name}) did not start. See ${join(out, `wrangler-${name}.log`)}.`);
}

async function kv(state, kvArgs) {
  const result = await collect(wrangler(['kv', 'key', ...kvArgs, '--binding', 'TOKENS', '--local', '--persist-to', state], { stdio: ['ignore', 'pipe', 'pipe'] }));
  if (result.status !== 0) throw Error(`wrangler kv ${kvArgs[0]} failed: ${result.stderr.slice(-400)}`);
  return result.stdout;
}

async function kvDump(state) {
  const text = await kv(state, ['list']);
  const keys = JSON.parse(text.slice(text.indexOf('['))).map(item => item.name);
  const entries = {};
  for (const key of keys) entries[key] = (await kv(state, ['get', key])).trim();
  return entries;
}

// Runs the real CLI. Asynchronous, so the GitHub test double in this process can answer it.
function cli(cliArgs, env, { inherit = false } = {}) {
  const child = spawn(process.execPath, [bin, ...cliArgs], { cwd: root, env: { ...process.env, ...env, NO_COLOR: '1' }, stdio: inherit ? ['inherit', 'pipe', 'inherit'] : ['ignore', 'pipe', 'pipe'] });
  if (inherit) child.stdout.on('data', chunk => process.stdout.write(chunk));
  return collect(child);
}

// --- GitHub test double (offline only) ------------------------------------------------------

function githubDouble({ clientId, clientSecret }) {
  const log = [];
  const codes = new Map();
  const tokens = new Map();
  const devices = new Map();
  const double = { log, tokens, nextUser: null, nextDevice: null };
  const body = request => new Promise(done => {
    let text = '';
    request.on('data', chunk => { text += chunk; });
    request.on('end', () => {
      if (!text) return done({});
      try { done(JSON.parse(text)); } catch { done(Object.fromEntries(new URLSearchParams(text))); }
    });
  });
  const json = (response, status, value) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(value)); };
  const issue = (user, client) => { const token = `gho_${randomBytes(18).toString('hex')}`; tokens.set(token, { user, clientId: client, revoked: false }); return token; };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://double');
    const input = await body(request);
    const raw = JSON.stringify({ headers: request.headers, url: request.url, input });
    log.push({ method: request.method, path: url.pathname, secretSent: raw.includes(clientSecret), basicAuth: /^Basic /.test(request.headers.authorization ?? '') });
    if (request.method === 'GET' && url.pathname === '/login/oauth/authorize') {
      if (url.searchParams.get('client_id') !== clientId) return json(response, 400, { error: 'unknown client' });
      const target = new URL(url.searchParams.get('redirect_uri'));
      if (double.nextUser === 'deny') {
        target.searchParams.set('error', 'access_denied');
      } else {
        const code = randomBytes(10).toString('hex');
        codes.set(code, double.nextUser);
        target.searchParams.set('code', code);
      }
      target.searchParams.set('state', url.searchParams.get('state'));
      response.writeHead(302, { location: target.href });
      return response.end();
    }
    if (request.method === 'POST' && url.pathname === '/login/device/code') {
      if (input.client_id !== clientId) return json(response, 200, { error: 'unauthorized_client' });
      const deviceCode = randomBytes(10).toString('hex');
      devices.set(deviceCode, { ...double.nextDevice, polls: 0 });
      return json(response, 200, { device_code: deviceCode, user_code: 'WDJB-MJHT', verification_uri: `http://127.0.0.1:${server.address().port}/login/device`, expires_in: 900, interval: 1 });
    }
    if (request.method === 'POST' && url.pathname === '/login/oauth/access_token') {
      if (input.grant_type === 'urn:ietf:params:oauth:grant-type:device_code') {
        const device = devices.get(input.device_code);
        if (!device || input.client_id !== clientId) return json(response, 200, { error: 'incorrect_device_code' });
        device.polls += 1;
        if (device.mode === 'deny') return json(response, 200, { error: 'access_denied' });
        if (device.mode === 'expire') return json(response, 200, { error: 'expired_token' });
        if (device.mode === 'slow' && device.polls === 1) return json(response, 200, { error: 'slow_down', interval: 6 });
        if (device.polls < 2) return json(response, 200, { error: 'authorization_pending' });
        devices.delete(input.device_code);
        return json(response, 200, { access_token: issue(device.user, clientId), token_type: 'bearer', scope: '' });
      }
      const user = codes.get(input.code);
      codes.delete(input.code);
      if (input.client_id !== clientId || input.client_secret !== clientSecret) return json(response, 200, { error: 'incorrect_client_credentials' });
      if (!user) return json(response, 200, { error: 'bad_verification_code' });
      return json(response, 200, { access_token: issue(user, clientId), token_type: 'bearer', scope: '' });
    }
    const application = url.pathname.match(/^\/applications\/([^/]+)\/token$/);
    if (application) {
      const [user, pass] = Buffer.from((request.headers.authorization ?? '').replace(/^Basic /, ''), 'base64').toString().split(':');
      if (user !== clientId || pass !== clientSecret || application[1] !== clientId) return json(response, 401, { message: 'Requires authentication' });
      const entry = tokens.get(input.access_token);
      if (!entry || entry.revoked || entry.clientId !== clientId) return json(response, 404, { message: 'Not Found' });
      if (request.method === 'DELETE') { entry.revoked = true; response.writeHead(204); return response.end(); }
      return json(response, 200, { token: input.access_token, user: { id: entry.user.id, login: entry.user.login } });
    }
    return json(response, 404, { message: 'Not Found' });
  });
  double.start = () => new Promise(done => server.listen(0, '127.0.0.1', () => { double.url = `http://127.0.0.1:${server.address().port}`; done(); }));
  double.stop = () => new Promise(done => server.close(done));
  return double;
}

// --- Helpers against the Worker --------------------------------------------------------------

const list = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
const mcp = (base, authorization) => fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', ...(authorization === undefined ? {} : { authorization }) }, body: JSON.stringify(list) });
const errorOf = async response => { try { return (await response.json()).error ?? ''; } catch { return ''; } };

async function webSignIn(base, double, user) {
  double.nextUser = user;
  const start = await fetch(`${base}/signup/start`, { redirect: 'manual' });
  const cookie = (start.headers.get('set-cookie') ?? '').split(';')[0];
  const authorize = await fetch(start.headers.get('location'), { redirect: 'manual' });
  const callback = await fetch(authorize.headers.get('location'), { redirect: 'manual', headers: { cookie } });
  const html = await callback.text();
  return { start, cookie, callback, html, token: html.match(TOKEN)?.[0] ?? null };
}

// --- Offline run ---------------------------------------------------------------------------

async function offline() {
  const clientId = 'Iv1.e2etestclient';
  const clientSecret = randomBytes(20).toString('hex');
  const admin = randomBytes(24).toString('hex');
  const double = githubDouble({ clientId, clientSecret });
  await double.start();
  const users = {
    ada: { id: 1001, login: 'ada' },
    cli: { id: 1002, login: 'cli-user' },
    limit: { id: 1003, login: 'limit-user' },
    odd: { id: 1004, login: 'o\'k<b>&"x' },
    blocked: { id: 1005, login: 'blocked-user' },
  };
  const worker = await startWorker('configured', {
    CONQUISTADOR_MCP_TOKEN: admin,
    CONQUISTADOR_RECEIPT_KEY: randomBytes(24).toString('hex'),
    GITHUB_CLIENT_ID: clientId,
    GITHUB_CLIENT_SECRET: clientSecret,
    GITHUB_URL: double.url,
    GITHUB_API_URL: double.url,
  });
  const { base } = worker;
  const home = join(out, 'home');
  rmSync(home, { recursive: true, force: true });
  const cliEnv = { HOME: home, USERPROFILE: home, CONQUISTADOR_HOME: join(home, '.conquistador'), CONQUISTADOR_MCP_URL: base, CONQUISTADOR_GITHUB_URL: double.url };
  const tokenFile = join(home, '.conquistador', 'mcp-token');

  // 1. The page and the start of the web flow.
  const page = await fetch(`${base}/signup`);
  const pageHtml = await page.text();
  record('GET /signup shows a sign-in page with the privacy note', page.status === 200 && /Sign in with GitHub/.test(pageHtml) && /SHA-256/.test(pageHtml) && /conquistador logout/.test(pageHtml) && /text\/html/.test(page.headers.get('content-type') ?? ''), { status: page.status });

  const start = await fetch(`${base}/signup/start`, { redirect: 'manual' });
  const location = new URL(start.headers.get('location') ?? 'http://none');
  const setCookie = start.headers.get('set-cookie') ?? '';
  record('/signup/start redirects to GitHub with the client id, a state, and the callback URL', start.status === 302 && location.origin === double.url && location.searchParams.get('client_id') === clientId && (location.searchParams.get('state') ?? '').length >= 32 && location.searchParams.get('redirect_uri') === `${base}/signup/callback`, { status: start.status, location: location.href.replace(/state=[^&]+/, 'state=…') });
  record('the state cookie is HttpOnly, Secure, SameSite=Lax, path /signup, and short-lived', /HttpOnly/i.test(setCookie) && /Secure/i.test(setCookie) && /SameSite=Lax/i.test(setCookie) && /Path=\/signup/i.test(setCookie) && /Max-Age=600/i.test(setCookie), { setCookie: setCookie.replace(/=[^;]{16,}/, '=…') });

  // 2. Callback refusals.
  const noCookie = await fetch(`${base}/signup/callback?code=x&state=${location.searchParams.get('state')}`, { redirect: 'manual' });
  const noCookieHtml = await noCookie.text();
  const wrongState = await fetch(`${base}/signup/callback?code=x&state=${'a'.repeat(64)}`, { redirect: 'manual', headers: { cookie: setCookie.split(';')[0] } });
  const wrongStateHtml = await wrongState.text();
  record('a callback without the state cookie or with another state is refused and issues no token', noCookie.status === 400 && wrongState.status === 400 && !TOKEN.test(noCookieHtml + wrongStateHtml) && /start again/i.test(wrongStateHtml), { statuses: [noCookie.status, wrongState.status] });

  const denied = await webSignIn(base, double, 'deny');
  record('when the person cancels on GitHub, the page says so and issues no token', denied.callback.status === 400 && /cancelled/i.test(denied.html) && !denied.token, { status: denied.callback.status });
  record('the callback clears the state cookie', /Max-Age=0/i.test(denied.callback.headers.get('set-cookie') ?? ''), {});

  // A code that GitHub does not accept.
  const badStart = await fetch(`${base}/signup/start`, { redirect: 'manual' });
  const badState = new URL(badStart.headers.get('location')).searchParams.get('state');
  const badCode = await fetch(`${base}/signup/callback?code=not-a-code&state=${badState}`, { redirect: 'manual', headers: { cookie: (badStart.headers.get('set-cookie') ?? '').split(';')[0] } });
  const badCodeHtml = await badCode.text();
  record('a code that GitHub refuses gives 502 with the reason and no token', badCode.status === 502 && /GitHub/.test(badCodeHtml) && !TOKEN.test(badCodeHtml), { status: badCode.status });

  // 3. A full web sign-in.
  const first = await webSignIn(base, double, users.ada);
  const headers = first.callback.headers;
  record('a web sign-in shows one cq_ token (32 random bytes) and the four client configs', first.callback.status === 200 && first.token?.length === 46 && /claude mcp add/.test(first.html) && /claude_desktop_config\.json/.test(first.html) && /\.cursor\/mcp\.json/.test(first.html) && /Authorization: Bearer/.test(first.html) && /@ada/.test(first.html), { status: first.callback.status, tokenLength: first.token?.length });
  record('the token page is not cached, framed, or sent as a referrer', /no-store/.test(headers.get('cache-control') ?? '') && /default-src 'none'/.test(headers.get('content-security-policy') ?? '') && headers.get('x-frame-options') === 'DENY' && headers.get('referrer-policy') === 'no-referrer', { cacheControl: headers.get('cache-control'), csp: headers.get('content-security-policy') });
  record('the Worker revoked the GitHub access token after it read the user id', [...double.tokens.values()].every(entry => entry.revoked), { githubTokens: double.tokens.size });

  const firstOk = await mcp(base, `Bearer ${first.token}`);
  record('the personal token opens /mcp', firstOk.status === 200 && (await firstOk.json()).result?.tools?.length > 0, { status: firstOk.status });

  const whoFirst = await fetch(`${base}/api/whoami`, { headers: { authorization: `Bearer ${first.token}` } });
  const whoFirstBody = await whoFirst.json();
  record('GET /api/whoami names the GitHub user, the creation time, and the last use', whoFirst.status === 200 && whoFirstBody.kind === 'personal' && whoFirstBody.login === 'ada' && whoFirstBody.githubId === 1001 && whoFirstBody.status === 'active' && Boolean(Date.parse(whoFirstBody.created)) && Boolean(Date.parse(whoFirstBody.lastUsed)), { body: whoFirstBody });

  // 4. Storage: hashes only.
  let store = await kvDump(worker.state);
  const keys = Object.keys(store);
  const values = Object.values(store).join('\n');
  const userRecord = JSON.parse(store['user:1001'] ?? '{}');
  record('KV holds token:<sha256> and user:<github id> only, and never the token itself', keys.includes(`token:${sha256(first.token)}`) && keys.includes('user:1001') && keys.every(key => /^(?:token:[0-9a-f]{64}|user:\d+)$/.test(key)) && !keys.join('\n').includes(first.token) && !values.includes(first.token) && !values.includes(first.token.slice(3)), { keys: keys.map(key => key.replace(/[0-9a-f]{56}$/, '…')) });
  record('the user record has the GitHub id, login, token hash, created time, and status', userRecord.githubId === 1001 && userRecord.login === 'ada' && userRecord.tokenHash === sha256(first.token) && userRecord.status === 'active' && Boolean(Date.parse(userRecord.created)), { fields: Object.keys(userRecord) });

  // 5. Rotation.
  const second = await webSignIn(base, double, users.ada);
  const oldAfter = await mcp(base, `Bearer ${first.token}`);
  const oldReason = await errorOf(oldAfter);
  const newAfter = await mcp(base, `Bearer ${second.token}`);
  store = await kvDump(worker.state);
  const adaTokens = Object.entries(store).filter(([key, value]) => key.startsWith('token:') && JSON.parse(value).githubId === 1001);
  record('signing in again rotates the token: the old one stops, the new one works, one token record stays', second.token && second.token !== first.token && oldAfter.status === 401 && /not active|login/i.test(oldReason) && newAfter.status === 200 && adaTokens.length === 1 && JSON.parse(store['user:1001']).tokenHash === sha256(second.token), { oldStatus: oldAfter.status, oldReason, newStatus: newAfter.status, tokenRecords: adaTokens.length });

  // 6. HTML escaping of the GitHub login.
  const odd = await webSignIn(base, double, users.odd);
  record('the token page escapes the GitHub login', odd.callback.status === 200 && !odd.html.includes('<b>&') && odd.html.includes('&lt;b&gt;'), { status: odd.callback.status });

  // 7. CLI device flow.
  double.nextDevice = { user: users.cli, mode: 'approve' };
  const login = await cli(['login', '--no-open'], cliEnv);
  const saved = existsSync(tokenFile) ? readFileSync(tokenFile, 'utf8').trim() : '';
  const fileMode = existsSync(tokenFile) ? statSync(tokenFile).mode & 0o777 : null;
  const folderMode = existsSync(tokenFile) ? statSync(join(home, '.conquistador')).mode & 0o777 : null;
  record('conquistador login signs in with the device flow and saves a cq_ token', login.status === 0 && TOKEN.test(saved) && /@cli-user/.test(login.stdout) && /WDJB-MJHT/.test(login.stdout + login.stderr), { status: login.status, stderr: login.stderr.slice(-300) });
  record('the token file is mode 600 in a 700 folder', process.platform === 'win32' || (fileMode === 0o600 && folderMode === 0o700), { fileMode: fileMode?.toString(8), folderMode: folderMode?.toString(8) });
  record('login prints configs for Claude Code, Claude Desktop, Cursor, and a generic client', /claude mcp add --scope user --transport http conquistador/.test(login.stdout) && /mcp-remote/.test(login.stdout) && /\.cursor\/mcp\.json/.test(login.stdout) && /Any MCP client/.test(login.stdout) && login.stdout.includes(`${base}/mcp`), {});
  const devicePaths = double.log.filter(entry => entry.path === '/login/device/code' || (entry.path === '/login/oauth/access_token' && !entry.secretSent));
  record('the CLI never sends the client secret; the Worker checks the GitHub token with it', devicePaths.length >= 2 && double.log.filter(entry => entry.path === '/login/device/code').every(entry => !entry.secretSent) && double.log.some(entry => /^\/applications\//.test(entry.path) && entry.basicAuth), { githubCalls: double.log.length });

  const who = await cli(['whoami'], cliEnv);
  const whoJson = await cli(['whoami', '--json'], cliEnv);
  let whoParsed = {};
  try { whoParsed = JSON.parse(whoJson.stdout); } catch { /* Recorded as a failure below. */ }
  record('conquistador whoami names the user, in text and JSON', who.status === 0 && /@cli-user/.test(who.stdout) && whoParsed.login === 'cli-user' && whoParsed.githubId === 1002, { status: who.status, stdout: who.stdout.trim() });
  record('the CLI token opens /mcp', (await mcp(base, `Bearer ${saved}`)).status === 200, {});

  // A GitHub token that our OAuth App did not issue.
  const foreign = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ githubToken: 'gho_from_another_app' }) });
  record('POST /api/login refuses a GitHub token that this OAuth App did not issue', foreign.status === 401 && !TOKEN.test(JSON.stringify(await foreign.json().catch(() => ({})))), { status: foreign.status });
  const notJson = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' });
  const tooBig = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ githubToken: 'x'.repeat(10_000) }) });
  record('POST /api/login bounds bad JSON and large bodies', notJson.status === 400 && tooBig.status === 413, { statuses: [notJson.status, tooBig.status] });

  // Device-flow refusals: denied, expired, slow_down.
  const deniedHome = join(home, 'denied');
  double.nextDevice = { user: users.cli, mode: 'deny' };
  const deniedLogin = await cli(['login', '--no-open'], { ...cliEnv, CONQUISTADOR_HOME: deniedHome });
  record('a denied device code ends login without a token file', deniedLogin.status === 1 && /cancelled/i.test(deniedLogin.stdout + deniedLogin.stderr) && !existsSync(join(deniedHome, 'mcp-token')), { status: deniedLogin.status });
  double.nextDevice = { user: users.cli, mode: 'expire' };
  const expired = await cli(['login', '--no-open'], { ...cliEnv, CONQUISTADOR_HOME: deniedHome });
  record('an expired device code says to run conquistador login again', expired.status === 1 && /expired/i.test(expired.stderr) && /conquistador login/.test(expired.stderr) && !existsSync(join(deniedHome, 'mcp-token')), { status: expired.status, stderr: expired.stderr.trim().slice(-200) });
  double.nextDevice = { user: users.cli, mode: 'slow' };
  const slowStarted = performance.now();
  const slow = await cli(['login', '--no-open'], { ...cliEnv, CONQUISTADOR_HOME: join(home, 'slow') });
  const slowMs = Math.round(performance.now() - slowStarted);
  record('after slow_down the CLI waits longer and still signs in', slow.status === 0 && slowMs >= 6000 && existsSync(join(home, 'slow', 'mcp-token')), { status: slow.status, ms: slowMs });

  // A token file that holds the shared admin token is kept, not overwritten.
  const adminHome = join(home, 'admin-file');
  mkdirSync(adminHome, { recursive: true });
  writeFileSync(join(adminHome, 'mcp-token'), `${admin}\n`, { mode: 0o600 });
  double.nextDevice = { user: users.cli, mode: 'approve' };
  const overAdmin = await cli(['login', '--no-open'], { ...cliEnv, CONQUISTADOR_HOME: adminHome });
  const previous = join(adminHome, 'mcp-token.previous');
  record('login keeps an admin token that was in the token file and says where', overAdmin.status === 0 && existsSync(previous) && readFileSync(previous, 'utf8').trim() === admin && (process.platform === 'win32' || (statSync(previous).mode & 0o777) === 0o600) && TOKEN.test(readFileSync(join(adminHome, 'mcp-token'), 'utf8')) && /mcp-token\.previous/.test(overAdmin.stdout + overAdmin.stderr), { status: overAdmin.status });
  // That sign-in rotated cli-user's token again.
  double.nextDevice = { user: users.cli, mode: 'approve' };
  await cli(['login', '--no-open'], cliEnv);
  const current = readFileSync(tokenFile, 'utf8').trim();

  const unreachable = await cli(['login', '--no-open'], { ...cliEnv, CONQUISTADOR_HOME: join(home, 'unreachable'), CONQUISTADOR_MCP_URL: 'http://127.0.0.1:9' });
  record('login names the server it cannot reach and writes no file', unreachable.status === 1 && /127\.0\.0\.1:9/.test(unreachable.stderr) && !existsSync(join(home, 'unreachable', 'mcp-token')), { status: unreachable.status, stderr: unreachable.stderr.trim().slice(-200) });

  // 8. Bad tokens on /mcp.
  const bad = {
    'no header': undefined,
    'wrong scheme': `Basic ${Buffer.from('a:b').toString('base64')}`,
    'empty bearer': 'Bearer ',
    'malformed cq_ token': 'Bearer cq_short',
    'unknown well-formed token': `Bearer cq_${randomBytes(32).toString('base64url')}`,
    'valid token under another scheme': `Token ${current}`,
    'very long header': `Bearer ${'x'.repeat(5000)}`,
  };
  const badResults = {};
  for (const [label, header] of Object.entries(bad)) {
    const response = await mcp(base, header);
    badResults[label] = { status: response.status, error: await errorOf(response), challenge: response.headers.get('www-authenticate') };
  }
  record('bad tokens get 401 with a reason and a Bearer challenge', Object.values(badResults).every(item => item.status === 401 && item.error.length > 10 && /^Bearer/.test(item.challenge ?? '')), { results: badResults });

  // 9. The admin token.
  const adminMcp = await mcp(base, `Bearer ${admin}`);
  const adminWho = await (await fetch(`${base}/api/whoami`, { headers: { authorization: `Bearer ${admin}` } })).json();
  const adminLogout = await fetch(`${base}/api/logout`, { method: 'POST', headers: { authorization: `Bearer ${admin}` } });
  record('the shared admin token still opens /mcp, whoami says admin, and logout refuses it', adminMcp.status === 200 && adminWho.kind === 'admin' && adminLogout.status === 400, { mcp: adminMcp.status, whoami: adminWho, logout: adminLogout.status });

  // 10. Blocked user.
  const blocked = await webSignIn(base, double, users.blocked);
  const blockedRecord = JSON.parse((await kv(worker.state, ['get', 'user:1005'])).trim());
  await kv(worker.state, ['put', 'user:1005', JSON.stringify({ ...blockedRecord, status: 'blocked' })]);
  const blockedUse = await mcp(base, `Bearer ${blocked.token}`);
  const blockedUseReason = await errorOf(blockedUse);
  const blockedAgain = await webSignIn(base, double, users.blocked);
  record('a blocked GitHub user gets 403 on use and on a new sign-in', blockedUse.status === 403 && /blocked/i.test(blockedUseReason) && blockedAgain.callback.status === 403 && !blockedAgain.token, { use: blockedUse.status, signIn: blockedAgain.callback.status });

  // 11. Rate limit, per token.
  const limited = await webSignIn(base, double, users.limit);
  const burst = await Promise.all(Array.from({ length: 130 }, () => mcp(base, `Bearer ${limited.token}`)));
  const ok = burst.filter(response => response.status === 200).length;
  const refused = burst.filter(response => response.status === 429);
  const refusal = refused[0];
  const refusalBody = refusal ? await refusal.json() : {};
  const otherToken = await mcp(base, `Bearer ${current}`);
  record('a token over 60 requests a minute gets 429 with the reason and retry-after; others are not affected', refused.length > 0 && ok <= 120 && refusal.headers.get('retry-after') === '60' && /60 requests per minute/.test(refusalBody.error ?? '') && /60 seconds/.test(refusalBody.error ?? '') && refusalBody.retryAfter === 60 && otherToken.status === 200, { ok, refused: refused.length, body: refusalBody, otherToken: otherToken.status });

  // 12. Logout.
  const logout = await cli(['logout'], cliEnv);
  const afterLogout = await mcp(base, `Bearer ${current}`);
  store = await kvDump(worker.state);
  record('conquistador logout revokes the token, deletes the records, and removes the file', logout.status === 0 && /Signed out/.test(logout.stdout) && !existsSync(tokenFile) && afterLogout.status === 401 && !store['user:1002'] && !store[`token:${sha256(current)}`], { status: logout.status, afterLogout: afterLogout.status });
  const whoAfter = await cli(['whoami'], cliEnv);
  record('whoami without a token file says to run conquistador login', whoAfter.status === 1 && /Not signed in\. Run conquistador login\./.test(whoAfter.stderr + whoAfter.stdout), { status: whoAfter.status });

  // Logout with a token the server no longer accepts, and with an unreachable server.
  mkdirSync(join(home, '.conquistador'), { recursive: true });
  writeFileSync(tokenFile, `${first.token}\n`, { mode: 0o600 });
  const staleLogout = await cli(['logout'], cliEnv);
  record('logout with an invalid token removes the local file and says so', staleLogout.status === 0 && /already/i.test(staleLogout.stdout) && !existsSync(tokenFile), { status: staleLogout.status, stdout: staleLogout.stdout.trim() });
  writeFileSync(tokenFile, `${second.token}\n`, { mode: 0o600 });
  const offlineLogout = await cli(['logout'], { ...cliEnv, CONQUISTADOR_MCP_URL: 'http://127.0.0.1:9' });
  record('logout without the server keeps the file and says the token is not revoked', offlineLogout.status === 1 && existsSync(tokenFile) && /not revoked/i.test(offlineLogout.stderr), { status: offlineLogout.status, stderr: offlineLogout.stderr.trim().slice(-200) });

  // 13. The sign-up rate limit (per IP, on /signup/start and POST /api/login).
  let signupLimited = null;
  for (let attempt = 0; attempt < 70 && !signupLimited; attempt += 1) {
    const response = await fetch(`${base}/signup/start`, { redirect: 'manual' });
    if (response.status === 429) signupLimited = { attempt, retryAfter: response.headers.get('retry-after'), text: await response.text() };
  }
  record('sign-up requests from one address are rate limited with a reason', signupLimited && signupLimited.retryAfter === '60' && /Too many sign-in attempts/.test(signupLimited.text), { signupLimited });

  worker.child.kill();
  writeFileSync(join(out, 'wrangler-configured.log'), worker.log());

  // 14. Missing secrets fail closed: no GitHub app, no admin token.
  const bare = await startWorker('unconfigured', {});
  const bareSignup = await fetch(`${bare.base}/signup`);
  const bareStart = await fetch(`${bare.base}/signup/start`, { redirect: 'manual' });
  const bareConfig = await fetch(`${bare.base}/api/login`);
  const bareLogin = await fetch(`${bare.base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ githubToken: 'gho_x' }) });
  const bareMcp = await mcp(bare.base, 'Bearer anything');
  const bareNone = await mcp(bare.base, undefined);
  const bareGithubCalls = double.log.length;
  record('without GitHub secrets, sign-up answers 503 and never redirects', bareSignup.status === 503 && bareStart.status === 503 && !bareStart.headers.get('location') && bareConfig.status === 503 && bareLogin.status === 503 && /not set up/i.test(await bareSignup.text()), { statuses: [bareSignup.status, bareStart.status, bareConfig.status, bareLogin.status] });
  record('without an admin token, /mcp refuses every request that has no valid personal token', bareMcp.status === 401 && bareNone.status === 401 && double.log.length === bareGithubCalls, { statuses: [bareMcp.status, bareNone.status] });
  bare.child.kill();
  writeFileSync(join(out, 'wrangler-unconfigured.log'), bare.log());
  await double.stop();
}

// --- Live run --------------------------------------------------------------------------------

async function liveRun() {
  let base = option('--url')?.replace(/\/mcp\/?$/, '').replace(/\/$/, '');
  let worker = null;
  if (!base) {
    const { GITHUB_CLIENT_ID: id, GITHUB_CLIENT_SECRET: secret } = process.env;
    if (!id || !secret) throw Error('Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET from the real OAuth App, or pass --url https://mcp.forsvn.com.');
    worker = await startWorker('live', { GITHUB_CLIENT_ID: id, GITHUB_CLIENT_SECRET: secret, CONQUISTADOR_RECEIPT_KEY: randomBytes(24).toString('hex') });
    base = worker.base;
  }
  const home = join(out, 'live-home');
  rmSync(home, { recursive: true, force: true });
  const cliEnv = { HOME: home, USERPROFILE: home, CONQUISTADOR_HOME: join(home, '.conquistador'), CONQUISTADOR_MCP_URL: base, CONQUISTADOR_GITHUB_URL: '' };
  const tokenFile = join(home, '.conquistador', 'mcp-token');

  const page = await fetch(`${base}/signup`);
  record('GET /signup answers 200', page.status === 200, { status: page.status });
  const config = await fetch(`${base}/api/login`);
  record('GET /api/login gives a GitHub client id', config.status === 200 && Boolean((await config.json()).githubClientId), { status: config.status });

  process.stderr.write('\nApprove the code below on github.com in your browser.\n');
  const login = await cli(['login'], cliEnv, { inherit: true });
  const token = existsSync(tokenFile) ? readFileSync(tokenFile, 'utf8').trim() : '';
  record('conquistador login with real GitHub saves a cq_ token', login.status === 0 && TOKEN.test(token), { status: login.status });
  const who = await cli(['whoami', '--json'], cliEnv);
  let whoBody = {};
  try { whoBody = JSON.parse(who.stdout); } catch { /* Recorded below. */ }
  record('whoami names the real GitHub user', who.status === 0 && Boolean(whoBody.login), { login: whoBody.login });
  record('the token opens /mcp', (await mcp(base, `Bearer ${token}`)).status === 200, {});
  record('a well-formed unknown token gets 401', (await mcp(base, `Bearer cq_${randomBytes(32).toString('base64url')}`)).status === 401, {});
  const logout = await cli(['logout'], cliEnv);
  // KV is eventually consistent across locations: a revoked token can work for up to 60 seconds.
  let refused = false;
  for (let attempt = 0; attempt < 14 && !refused; attempt += 1) {
    refused = (await mcp(base, `Bearer ${token}`)).status === 401;
    if (!refused) await wait(5000);
  }
  record('logout revokes the token (within 70 seconds)', logout.status === 0 && refused && !existsSync(tokenFile), { status: logout.status });
  process.stderr.write(`\nCheck the web flow by hand: open ${base}/signup, sign in, and run\n  CONQUISTADOR_MCP_URL=${base} conquistador whoami\nafter you save the token. The web flow works only on the host in the OAuth App callback URL.\n`);
  worker?.child.kill();
}

// --- Report ----------------------------------------------------------------------------------

async function main() {
  mkdirSync(out, { recursive: true });
  const started = new Date().toISOString();
  let failure = null;
  try { await (live ? liveRun() : offline()); } catch (error) { failure = error; record(`the run finished (${error.message})`, false, {}); } finally { for (const child of children) if (child.exitCode === null) child.kill(); }
  const passed = steps.filter(step => step.passed).length;
  const report = {
    suite: 'signup',
    mode: live ? 'live (github.com)' : 'offline (local GitHub test double; not github.com)',
    worker: option('--url') ? option('--url') : 'wrangler 4.148.0 dev (workerd, local KV, local rate limiter)',
    started,
    finished: new Date().toISOString(),
    node: process.version,
    passed,
    total: steps.length,
    steps,
  };
  writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    '# Sign-up E2E',
    '',
    `- Mode: ${report.mode}`,
    `- Worker: ${report.worker}`,
    `- Started: ${started}`,
    `- Result: ${passed}/${steps.length} passed`,
    '',
    '| Result | Step |',
    '| --- | --- |',
    ...steps.map(step => `| ${step.passed ? 'pass' : 'FAIL'} | ${step.name.replace(/\|/g, '\\|')} |`),
    '',
  ];
  writeFileSync(join(out, 'report.md'), lines.join('\n'));
  process.stdout.write(`${passed}/${steps.length} passed. Report: ${join(out, 'report.md')}\n`);
  if (failure && process.env.CONQUISTADOR_DEBUG === '1') process.stderr.write(`${failure.stack}\n`);
  process.exitCode = passed === steps.length && !failure ? 0 : 1;
}

await main();
