// Self-serve personal tokens for the hosted MCP server (Cloudflare Worker). GitHub proves who a
// person is; the Worker issues a random cq_ token, stores only its SHA-256 hash in KV, and keeps
// one active token per GitHub user. The shared admin token (CONQUISTADOR_MCP_TOKEN) keeps working.
//
// KV (binding TOKENS):
//   token:<sha256 hex>  { githubId, created, lastUsed }   expires after a year without use
//   user:<github id>    { githubId, login, tokenHash, created, status: 'active' | 'blocked' }
// A token is valid only when its user record points back at its hash, so a rotation or a revoke
// wins over a late "last used" write, and two sign-ins at once leave one working token.
// KV is eventually consistent: another Cloudflare location can accept a replaced or revoked token
// for up to 60 seconds.
//
// Every route fails closed: without the GitHub secrets, KV, or the limiters, sign-up answers 503,
// and a personal token never gets an unlimited or unchecked request.
import { clientConfigs } from './mcp-client-config.mjs';

const TOKEN_PATTERN = /^cq_[A-Za-z0-9_-]{43}$/;
const STATE_COOKIE = 'cq_signup_state';
const TOKEN_TTL = 365 * 24 * 3600;
const LAST_USED_EVERY = 3_600_000;
const MAX_HEADER = 512;
const MAX_LOGIN_BODY = 4096;
const RETRY_AFTER = 60;
const encoder = new TextEncoder();

const toHex = bytes => [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const digest = async text => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
export const newToken = () => `cq_${base64url(crypto.getRandomValues(new Uint8Array(32)))}`;
export const hashToken = async token => toHex(await digest(token));

// Compares the digests, so the time does not depend on where the strings differ or on their length.
async function sameSecret(a, b) {
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let difference = 0;
  for (let index = 0; index < x.length; index += 1) difference |= x[index] ^ y[index];
  return difference === 0;
}

// Reads a request body as text, or returns null once it passes `limit` bytes.
export async function readBounded(request, limit) {
  if (Number(request.headers.get('content-length') ?? 0) > limit) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

const later = (ctx, promise) => (ctx?.waitUntil ? ctx.waitUntil(promise) : promise);
const limitText = env => Number(env.RATE_LIMIT_PER_MINUTE) || 60;
const challenge = error => ({ 'www-authenticate': `Bearer realm="conquistador"${error ? ', error="invalid_token"' : ''}` });
const refuse = (status, error, headers = {}, extra = {}) => ({ status, body: { error, ...extra }, headers });

// --- Bearer tokens -------------------------------------------------------------------------------

// Returns { kind: 'admin' } or { kind: 'personal', ... }, or { refusal } with the status and reason.
export async function authenticate(env, ctx, header, origin) {
  const admin = env.CONQUISTADOR_MCP_TOKEN;
  if (!admin && !env.TOKENS) return { refusal: refuse(503, 'This server has no access token configured.') };
  const value = String(header ?? '');
  const getOne = `Get a token at ${origin}/signup or with: conquistador login`;
  if (!value) return { refusal: refuse(401, `Missing bearer token. Send "Authorization: Bearer <token>". ${getOne}`, challenge(false)) };
  if (value.length > MAX_HEADER) return { refusal: refuse(401, 'The Authorization header is too long. Send "Authorization: Bearer <token>".', challenge(true)) };
  const token = /^Bearer +(\S+)$/i.exec(value)?.[1];
  if (!token) return { refusal: refuse(401, `Use the Bearer scheme: "Authorization: Bearer <token>". ${getOne}`, challenge(true)) };

  if (admin && await sameSecret(token, admin)) {
    if (env.MCP_LIMITER && !(await env.MCP_LIMITER.limit({ key: 'admin' })).success) return { refusal: rateLimited(env) };
    return { kind: 'admin' };
  }
  if (!token.startsWith('cq_')) return { refusal: refuse(401, `Invalid bearer token. ${getOne}`, challenge(true)) };
  if (!TOKEN_PATTERN.test(token)) return { refusal: refuse(401, `Malformed token: a personal token is cq_ and 43 more characters. ${getOne}`, challenge(true)) };
  if (!env.TOKENS) return { refusal: refuse(503, 'Personal tokens are not set up on this server.') };
  if (!env.MCP_LIMITER) return { refusal: refuse(503, 'Personal tokens need the rate limiter, which is not set up on this server.') };

  const hash = await hashToken(token);
  const record = await env.TOKENS.get(`token:${hash}`, 'json');
  const user = record ? await env.TOKENS.get(`user:${record.githubId}`, 'json') : null;
  if (!record || !user || user.tokenHash !== hash) {
    return { refusal: refuse(401, `This token is not active. It was revoked, or a newer sign-in replaced it. Run conquistador login, or sign in again at ${origin}/signup.`, challenge(true)) };
  }
  if (user.status !== 'active') return { refusal: refuse(403, 'This GitHub account is blocked on this server.') };
  if (!(await env.MCP_LIMITER.limit({ key: hash })).success) return { refusal: rateLimited(env) };

  // Write "last used" at most once an hour; each write also restarts the one-year expiry.
  let { lastUsed } = record;
  if (!lastUsed || Date.now() - Date.parse(lastUsed) > LAST_USED_EVERY) {
    lastUsed = new Date().toISOString();
    later(ctx, env.TOKENS.put(`token:${hash}`, JSON.stringify({ ...record, lastUsed }), { expirationTtl: TOKEN_TTL }));
  }
  return { kind: 'personal', hash, user, created: record.created, lastUsed };
}

function rateLimited(env) {
  const limit = limitText(env);
  return refuse(429, `Rate limit reached: ${limit} requests per minute for each token. Retry after ${RETRY_AFTER} seconds.`, { 'retry-after': String(RETRY_AFTER) }, { retryAfter: RETRY_AFTER });
}

// --- GitHub --------------------------------------------------------------------------------------

// GITHUB_URL and GITHUB_API_URL exist for the offline E2E only; they must be HTTPS or loopback.
const allowedBase = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  } catch { return false; }
};

function signupConfig(env) {
  const web = (env.GITHUB_URL || 'https://github.com').replace(/\/+$/, '');
  const api = (env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '');
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.TOKENS || !env.SIGNUP_LIMITER || !env.MCP_LIMITER) return null;
  if (!allowedBase(web) || !allowedBase(api)) return null;
  return { id: env.GITHUB_CLIENT_ID, secret: env.GITHUB_CLIENT_SECRET, web, api };
}

class GitHubError extends Error {}

async function github(url, init = {}) {
  let response;
  try {
    response = await fetch(url, { ...init, headers: { accept: 'application/json', 'user-agent': 'conquistador-mcp', ...init.headers } });
  } catch { throw new GitHubError('GitHub did not answer. Try again in a minute.'); }
  let body = null;
  try { body = await response.json(); } catch { /* Some answers have no body. */ }
  return { status: response.status, body };
}

const appHeaders = gh => ({
  authorization: `Basic ${btoa(`${gh.id}:${gh.secret}`)}`,
  accept: 'application/vnd.github+json',
  'content-type': 'application/json',
  'x-github-api-version': '2022-11-28',
});

async function exchangeCode(gh, code, redirectUri) {
  const { body } = await github(`${gh.web}/login/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: gh.id, client_secret: gh.secret, code, redirect_uri: redirectUri }),
  });
  if (!body?.access_token) throw new GitHubError(`GitHub refused the sign-in code (${body?.error ?? 'no access token'}).`);
  return body.access_token;
}

// GitHub's application token API answers only for tokens that this OAuth App issued, and needs
// the client secret. So a token from another app, or a made-up one, is refused here.
async function identify(gh, accessToken) {
  const { status, body } = await github(`${gh.api}/applications/${encodeURIComponent(gh.id)}/token`, { method: 'POST', headers: appHeaders(gh), body: JSON.stringify({ access_token: accessToken }) });
  if (status === 404 || status === 422) return null;
  if (status !== 200 || !Number.isInteger(body?.user?.id) || typeof body.user.login !== 'string') throw new GitHubError(`GitHub could not confirm the sign-in (HTTP ${status}).`);
  return { githubId: body.user.id, login: body.user.login };
}

// The Worker needs only the user id and login, so it revokes the GitHub token at once.
const revokeGithubToken = (gh, accessToken) => github(`${gh.api}/applications/${encodeURIComponent(gh.id)}/token`, { method: 'DELETE', headers: appHeaders(gh), body: JSON.stringify({ access_token: accessToken }) }).catch(() => {});

// Issues a new token and replaces the user's previous one. Returns null for a blocked user.
async function issue(env, { githubId, login }) {
  const previous = await env.TOKENS.get(`user:${githubId}`, 'json');
  if (previous?.status === 'blocked') return null;
  const token = newToken();
  const tokenHash = await hashToken(token);
  const created = new Date().toISOString();
  await env.TOKENS.put(`token:${tokenHash}`, JSON.stringify({ githubId, created, lastUsed: null }), { expirationTtl: TOKEN_TTL });
  await env.TOKENS.put(`user:${githubId}`, JSON.stringify({ githubId, login, tokenHash, created, status: 'active' }));
  if (previous?.tokenHash) await env.TOKENS.delete(`token:${previous.tokenHash}`);
  return { token, login, githubId, created };
}

// --- Pages ---------------------------------------------------------------------------------------

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const pageHeaders = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'",
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
};
const clearState = `${STATE_COOKIE}=; Path=/signup; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

const style = `body{font:16px/1.5 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#1b1b1b}
h1{font-size:1.6rem}h2{font-size:1.15rem;margin-top:2rem}
a.button{display:inline-block;background:#1b1b1b;color:#fff;padding:.7rem 1.2rem;border-radius:6px;text-decoration:none;font-weight:600}
pre,code{font:14px/1.45 ui-monospace,Menlo,monospace}pre{background:#f4f4f4;padding:.8rem;border-radius:6px;overflow-x:auto;white-space:pre-wrap;word-break:break-all}
.token{background:#fff7d6;border:1px solid #e3c65a}.muted{color:#555}`;

function page(status, title, body, headers = {}) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title><style>${style}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
  return new Response(html, { status, headers: { ...pageHeaders, ...headers } });
}

const privacy = (env, origin) => `<h2>What the server stores</h2>
<ul><li>Your GitHub user id and login.</li><li>A SHA-256 hash of your token. The token itself is not stored, so nobody can read it back.</li><li>When the token was made, when it was last used, and its status.</li></ul>
<p>The server does not store your GitHub access token, email address, or repositories. It asks GitHub for no permissions beyond your public profile, and revokes the GitHub access token as soon as it reads your user id.</p>
<p>Each token can send ${limitText(env)} requests per minute. A token that is not used for a year stops working.</p>
<h2>Delete your record</h2>
<p>Run <code>conquistador logout</code>, or send:</p>
<pre>curl -X POST ${escapeHtml(origin)}/api/logout -H "Authorization: Bearer YOUR_TOKEN"</pre>
<p>Both revoke the token and delete your record. Signing in again replaces your token with a new one.</p>`;

const errorPage = (status, title, message, headers = {}) => page(status, title, `<p>${escapeHtml(message)}</p><p><a href="/signup">Start again</a></p>`, headers);

function landingPage(env, origin) {
  return page(200, 'Conquistador MCP access', `<p>Sign in with GitHub to get a personal access token for the hosted Conquistador MCP server.</p>
<p><a class="button" href="/signup/start">Sign in with GitHub</a></p>
<p class="muted">In a terminal with Conquistador installed, you can run <code>conquistador login</code> instead.</p>${privacy(env, origin)}`);
}

function tokenPage(env, origin, { token, login }) {
  const configs = clientConfigs({ url: `${origin}/mcp`, token })
    .map(item => `<h2>${escapeHtml(item.client)}</h2><p>${escapeHtml(item.where)}</p><pre>${escapeHtml(item.text)}</pre>`).join('\n');
  return page(200, 'Your Conquistador MCP token', `<p>Signed in as <strong>@${escapeHtml(login)}</strong>.</p>
<p>Copy the token now. This page shows it once. The server keeps only its hash.</p>
<pre class="token"><code id="token">${escapeHtml(token)}</code></pre>
<p class="muted">Signing in again replaces this token. Keep it secret: anyone with it can use the server as you.</p>
${configs}${privacy(env, origin)}`, { 'set-cookie': clearState });
}

// --- Routes --------------------------------------------------------------------------------------

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
const fromRefusal = refusal => json(refusal.status, refusal.body, refusal.headers);
const notSetUp = 'Sign-up is not set up on this server.';
const tooMany = `Too many sign-in attempts from your network. Retry after ${RETRY_AFTER} seconds.`;
const clientAddress = request => request.headers.get('cf-connecting-ip') || 'unknown';
const signupAllowed = async (env, request) => (await env.SIGNUP_LIMITER.limit({ key: clientAddress(request) })).success;

function readCookie(request, name) {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}

// Answers /signup, /signup/start, /signup/callback, and /api/*. Returns null for other paths.
export async function handleAuthRoute(request, env, ctx) {
  const url = new URL(request.url);
  const { pathname } = url;
  if (pathname !== '/signup' && !pathname.startsWith('/signup/') && !pathname.startsWith('/api/')) return null;
  const gh = signupConfig(env);
  const method = request.method;

  if (pathname === '/signup') {
    if (method !== 'GET') return errorPage(405, 'Method not allowed', 'Open this page in a browser.', { allow: 'GET' });
    return gh ? landingPage(env, url.origin) : errorPage(503, 'Sign-up is not available', `${notSetUp} Ask the server owner, or use a token they gave you.`);
  }

  if (pathname === '/signup/start') {
    if (!gh) return errorPage(503, 'Sign-up is not available', notSetUp);
    if (!(await signupAllowed(env, request))) return errorPage(429, 'Too many attempts', tooMany, { 'retry-after': String(RETRY_AFTER) });
    const state = toHex(crypto.getRandomValues(new Uint8Array(32)));
    const target = new URL(`${gh.web}/login/oauth/authorize`);
    target.searchParams.set('client_id', gh.id);
    target.searchParams.set('redirect_uri', `${url.origin}/signup/callback`);
    target.searchParams.set('state', state);
    target.searchParams.set('allow_signup', 'true');
    return new Response(null, { status: 302, headers: { location: target.href, 'cache-control': 'no-store', 'set-cookie': `${STATE_COOKIE}=${state}; Path=/signup; HttpOnly; Secure; SameSite=Lax; Max-Age=600` } });
  }

  if (pathname === '/signup/callback') {
    const clear = { 'set-cookie': clearState };
    if (!gh) return errorPage(503, 'Sign-up is not available', notSetUp, clear);
    const expected = readCookie(request, STATE_COOKIE);
    const state = url.searchParams.get('state') ?? '';
    if (!expected || !state || !(await sameSecret(expected, state))) return errorPage(400, 'Sign-in expired', 'This sign-in link expired, or it came from another page. Start again.', clear);
    if (url.searchParams.get('error')) return errorPage(400, 'Sign-in cancelled', 'You cancelled the sign-in on GitHub. No token was made.', clear);
    const code = url.searchParams.get('code');
    if (!code) return errorPage(400, 'Sign-in failed', 'GitHub did not send a sign-in code. Start again.', clear);
    let identity;
    try {
      const accessToken = await exchangeCode(gh, code, `${url.origin}/signup/callback`);
      identity = await identify(gh, accessToken);
      later(ctx, revokeGithubToken(gh, accessToken));
    } catch (error) {
      if (error instanceof GitHubError) return errorPage(502, 'Sign-in failed', `${error.message} No token was made.`, clear);
      throw error;
    }
    if (!identity) return errorPage(502, 'Sign-in failed', 'GitHub did not confirm the sign-in. No token was made.', clear);
    const issued = await issue(env, identity);
    if (!issued) return errorPage(403, 'Account blocked', 'This GitHub account is blocked on this server. No token was made.', clear);
    return tokenPage(env, url.origin, issued);
  }

  if (pathname === '/api/login') {
    if (method === 'GET') return gh ? json(200, { githubClientId: gh.id, signup: `${url.origin}/signup` }) : json(503, { error: notSetUp });
    if (method !== 'POST') return json(405, { error: 'Use GET or POST.' }, { allow: 'GET, POST' });
    if (!gh) return json(503, { error: notSetUp });
    if (!(await signupAllowed(env, request))) return json(429, { error: tooMany, retryAfter: RETRY_AFTER }, { 'retry-after': String(RETRY_AFTER) });
    const text = await readBounded(request, MAX_LOGIN_BODY);
    if (text === null) return json(413, { error: 'Request too large.' });
    let githubToken;
    try { githubToken = JSON.parse(text).githubToken; } catch { return json(400, { error: 'Send JSON: {"githubToken": "..."}.' }); }
    if (typeof githubToken !== 'string' || !githubToken || githubToken.length > 255) return json(400, { error: 'Send JSON: {"githubToken": "..."}.' });
    let identity;
    try {
      identity = await identify(gh, githubToken);
    } catch (error) {
      if (error instanceof GitHubError) return json(502, { error: error.message });
      throw error;
    }
    if (!identity) return json(401, { error: 'GitHub did not confirm this sign-in. Run conquistador login again.' });
    later(ctx, revokeGithubToken(gh, githubToken));
    const issued = await issue(env, identity);
    return issued ? json(200, issued) : json(403, { error: 'This GitHub account is blocked on this server.' });
  }

  if (pathname === '/api/whoami' || pathname === '/api/logout') {
    const wanted = pathname === '/api/whoami' ? 'GET' : 'POST';
    if (method !== wanted) return json(405, { error: `Use ${wanted}.` }, { allow: wanted });
    const identity = await authenticate(env, ctx, request.headers.get('authorization'), url.origin);
    if (identity.refusal) return fromRefusal(identity.refusal);
    if (pathname === '/api/whoami') {
      if (identity.kind === 'admin') return json(200, { kind: 'admin' });
      const { user, created, lastUsed } = identity;
      return json(200, { kind: 'personal', login: user.login, githubId: user.githubId, created, lastUsed, status: user.status });
    }
    if (identity.kind === 'admin') return json(400, { error: 'The admin token is a server secret. Change it with wrangler secret put CONQUISTADOR_MCP_TOKEN.' });
    await env.TOKENS.delete(`user:${identity.user.githubId}`);
    await env.TOKENS.delete(`token:${identity.hash}`);
    return json(200, { revoked: true, login: identity.user.login });
  }

  return json(404, { error: 'Unknown route. See /signup.' });
}
