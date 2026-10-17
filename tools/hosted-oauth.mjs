// OAuth 2.1 for hosted MCP. The pinned provider owns protocol validation and token storage.
// This module runs only in workerd; local CLI and app imports do not load cloudflare:workers.
import OAuthProvider, { authorizationErrorRedirect, OAuthError } from './vendor/oauth-provider.mjs';
import { exchangeCode, GitHubError, hashToken, identify, readBounded, revokeGithubToken, sameSecret, signupConfig } from './hosted-auth.mjs';
import { createMcpResponder, MAX_BODY } from './mcp-http.mjs';

const SCOPE = 'mcp:read';
const providers = new Map();
const responders = new Map();
const responderFor = key => {
  if (!responders.has(key)) responders.set(key, createMcpResponder({ token: '', receiptKey: key || undefined }));
  return responders.get(key);
};
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const json = (status, body, headers = {}) => Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
const page = (status, content, headers = new Headers()) => {
  for (const [key, value] of Object.entries({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" })) headers.set(key, value);
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Connect Conquistador</title><style>body{font:17px/1.6 system-ui;max-width:38rem;margin:4rem auto;padding:0 24px;color:#eee;background:#100d13}h1{line-height:1.2}p{color:#c5b9c9}button{font:inherit;padding:12px 24px;margin:12px 12px 0 0;border:1px solid #b9a4c7;border-radius:8px;cursor:pointer}button[value=allow]{background:#ffbf41;color:#100d13}code{overflow-wrap:anywhere}</style>${content}</html>`, { status, headers });
};
const errorPage = (status, text, headers) => page(status, `<h1>Could not connect</h1><p>${escape(text)}</p><p>Return to your MCP client and try again.</p>`, headers);
// Start a new document before following the validated OAuth redirect. Browsers apply
// form-action to the entire HTTP redirect chain, including a client's later frontend hop.
// Meta refresh works without JavaScript; the link also supports manual navigation.
const redirectPage = (target, headers, title = 'Continue sign-in') => {
  headers.set('location', target);
  return page(200, `<meta http-equiv="refresh" content="0;url=${escape(target)}"><h1>${escape(title)}</h1><p><a href="${escape(target)}">Continue</a></p>`, headers);
};
const issuerFor = env => {
  const url = new URL(env.OAUTH_ISSUER || 'https://mcp.forsvn.com');
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error('OAUTH_ISSUER must be an HTTPS origin (HTTP loopback is allowed for local tests).');
  return url.origin;
};

async function authorize(request, env, ctx) {
  const url = new URL(request.url); const oauth = env.OAUTH_PROVIDER; const gh = signupConfig(env);
  try {
    if (url.pathname === '/authorize' && request.method === 'GET') {
      const auth = await oauth.parseAuthRequest(request);
      if (auth.scope.some(scope => ![SCOPE, 'offline_access'].includes(scope))) return errorPage(400, 'Request the mcp:read scope.');
      if (!auth.scope.includes(SCOPE)) auth.scope = [SCOPE, ...auth.scope];
      const description = await oauth.describeConsent(auth); const consent = await oauth.beginConsent(auth);
      return page(200, `<h1>Connect to Conquistador</h1><p><strong>${escape(description.clientName)}</strong> wants to read marketing playbooks and run checks.</p>${description.clientDomain ? `<p>Client domain: <strong>${escape(description.clientDomain)}</strong>.</p>` : '<p>The client supplied this name. Check the return address before you allow access.</p>'}<p>Return address: <code>${escape(description.redirectHost)}</code>.</p>${description.redirectIsLoopback ? '<p>This connects to a local app. Check which app you started.</p>' : ''}<p>Your client can stay connected for up to 30 days. Remove the connection in your client to revoke access.</p><p>This grants access to Conquistador tools. It does not grant access to your GitHub repositories or permission to publish.</p><form method="post" action="/authorize"><input type="hidden" name="handle" value="${escape(consent.handle)}"><button name="action" value="allow">Allow and sign in</button><button name="action" value="deny">Cancel</button></form>`, consent.headers);
    }
    if (url.pathname === '/authorize' && request.method === 'POST') {
      if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return errorPage(415, 'Submit the connection form.');
      const text = await readBounded(request, 4096); if (text === null) return errorPage(413, 'The form is too large.');
      const form = new URLSearchParams(text); const handle = form.get('handle') || '';
      if (form.get('action') === 'deny') {
        const denied = await oauth.denyConsent(request, handle);
        return redirectPage(denied.redirectTo, denied.headers, 'Connection cancelled');
      }
      if (form.get('action') !== 'allow') return errorPage(400, 'Choose Allow or Cancel.');
      const approved = await oauth.approveConsent(request, handle);
      const verifier = crypto.randomUUID() + crypto.randomUUID();
      const upstream = await oauth.beginUpstream(approved.request, { data: { verifier }, headers: approved.headers });
      const target = new URL(`${gh.web}/login/oauth/authorize`);
      const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
      const challenge = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      // Reuse the existing GitHub OAuth App callback. The marker keeps API-key signup separate.
      target.search = new URLSearchParams({ client_id: gh.id, redirect_uri: `${issuerFor(env)}/signup/callback`, state: `oauth.${upstream.state}`, code_challenge: challenge, code_challenge_method: 'S256' });
      return redirectPage(target.href, upstream.headers);
    }
    if (url.pathname === '/signup/callback' && request.method === 'GET') {
      url.searchParams.set('state', (url.searchParams.get('state') || '').slice(6));
      const upstream = await oauth.finishUpstream(new Request(url, request));
      if (url.searchParams.get('error')) {
        upstream.headers.set('location', authorizationErrorRedirect(upstream.request, 'access_denied'));
        return new Response(null, { status: 302, headers: upstream.headers });
      }
      const code = url.searchParams.get('code'); if (!code || code.length > 2048) return errorPage(400, 'GitHub did not return a valid sign-in code.', upstream.headers);
      let accessToken, identity;
      try { accessToken = await exchangeCode(gh, code, `${issuerFor(env)}/signup/callback`, upstream.data.verifier); identity = await identify(gh, accessToken); }
      catch (error) { if (error instanceof GitHubError) return errorPage(502, `${error.message} No connection was made.`, upstream.headers); throw error; }
      finally { if (accessToken) ctx.waitUntil(revokeGithubToken(gh, accessToken)); }
      if (!identity) return errorPage(502, 'GitHub did not confirm this sign-in.', upstream.headers);
      const previous = await env.TOKENS.get(`user:${identity.githubId}`, 'json');
      if (previous?.status === 'blocked') return errorPage(403, 'This account is blocked.', upstream.headers);
      // OAuth must not rotate or revoke an existing personal API key.
      const completed = await oauth.completeAuthorization({ request: upstream.request, userId: String(identity.githubId), metadata: { login: identity.login }, scope: upstream.request.scope, props: { kind: 'oauth', ...identity } });
      upstream.headers.set('location', completed.redirectTo); return new Response(null, { status: 302, headers: upstream.headers });
    }
    return json(405, { error: 'method_not_allowed' }, { allow: url.pathname === '/authorize' ? 'GET, POST' : 'GET' });
  } catch (error) {
    const invalid = error.name === 'AuthorizationError' || error instanceof OAuthError;
    return errorPage(invalid ? 400 : 502, invalid ? 'The connection request expired or is invalid. Start again in your client.' : 'Sign-in is temporarily unavailable. Try again.');
  }
}

function providerFor(env) {
  const issuer = issuerFor(env);
  if (providers.has(issuer)) return providers.get(issuer);
  const provider = new OAuthProvider({
    apiRoute: '/mcp', authorizeEndpoint: '/authorize', tokenEndpoint: '/oauth/token', clientRegistrationEndpoint: '/oauth/register',
    accessTokenTTL: 3600, refreshTokenTTL: 30 * 86400, clientRegistrationTTL: 90 * 86400,
    scopesSupported: [SCOPE, 'offline_access'], requiredScopes: [SCOPE],
    // The Worker flag global_fetch_strictly_public blocks private-network CIMD fetches.
    clientIdMetadataDocumentEnabled: true,
    allowPrivateUseRedirectUris: true,
    resourceMetadata: { resource: `${issuer}/mcp`, authorization_servers: [issuer] },
    tokenExchangeCallback: async ({ env, userId }) => {
      const user = await env.TOKENS.get(`user:${userId}`, 'json');
      if (user && user.status !== 'active') throw new OAuthError('invalid_grant', { description: 'This account no longer has access.' });
    },
    apiHandler: { async fetch(request, env, ctx) {
      if (!ctx.auth?.scope?.includes(SCOPE)) return json(403, { error: 'insufficient_scope' });
      const user = await env.TOKENS.get(`user:${ctx.props.githubId}`, 'json');
      if (user && user.status !== 'active') return json(403, { error: 'Account access is disabled.' });
      const key = await hashToken(request.headers.get('authorization') || '');
      if (!(await env.MCP_LIMITER.limit({ key: `oauth:${key}` })).success) return json(429, { error: 'Rate limit reached.' }, { 'retry-after': '60' });
      const respond = responderFor(env.CONQUISTADOR_RECEIPT_KEY || '');
      const url = new URL(request.url);
      const result = await respond({ method: request.method, path: url.pathname, origin: request.headers.get('origin'), protocolVersion: request.headers.get('mcp-protocol-version'), readBody: () => readBounded(request, MAX_BODY), authorize: async () => null });
      return new Response(result.body || null, { status: result.status, headers: result.headers });
    } },
    defaultHandler: { fetch: authorize },
  });
  if (providers.size >= 4) providers.clear(); providers.set(issuer, provider); return provider;
}

export async function handleOAuth(request, env, ctx) {
  const path = new URL(request.url).pathname;
  if (path === '/.well-known/oauth-protected-resource') request = new Request(new URL('/.well-known/oauth-protected-resource/mcp', request.url), request);
  const oauthCallback = path === '/signup/callback' && (new URL(request.url).searchParams.get('state') || '').startsWith('oauth.');
  const oauthRoute = oauthCallback || path === '/authorize' || path.startsWith('/oauth/') || path.startsWith('/.well-known/oauth-');
  if (!env.OAUTH_KV || !signupConfig(env)) return oauthRoute ? json(503, { error: 'OAuth is not configured on this server.' }) : null;
  const header = request.headers.get('authorization') || '';
  const token = /^Bearer +(\S+)$/i.exec(header)?.[1];
  if (path === '/mcp' && (/^Bearer +cq_/i.test(header) || (token && env.CONQUISTADOR_MCP_TOKEN && await sameSecret(token, env.CONQUISTADOR_MCP_TOKEN)))) return null;
  if (!oauthRoute && path !== '/mcp') return null;
  if (oauthRoute && !path.startsWith('/.well-known/') && !(await env.SIGNUP_LIMITER.limit({ key: request.headers.get('cf-connecting-ip') || 'unknown' })).success) return json(429, { error: 'Too many sign-in requests.' }, { 'retry-after': '60' });
  if (oauthRoute && Number(request.headers.get('content-length') || 0) > 16_384) return json(413, { error: 'Request too large.' });
  if (oauthRoute && request.body) {
    const text = await readBounded(request, 16_384); if (text === null) return json(413, { error: 'Request too large.' });
    request = new Request(request.url, { method: request.method, headers: request.headers, body: text });
  }
  return providerFor(env).fetch(request, env, ctx);
}
