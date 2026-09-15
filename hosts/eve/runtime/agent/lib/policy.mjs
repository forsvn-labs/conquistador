import { createHash, timingSafeEqual } from 'node:crypto';

export function requireIdentity(identity) {
  if (!identity || identity.schemaVersion !== 'conquistador.eve-app/v1' ||
      typeof identity.owner !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/.test(identity.owner) ||
      typeof identity.instance !== 'string' || !/^[a-f0-9]{32}$/.test(identity.instance)) {
    throw new Error('Prepare a separate app for this owner before starting Eve.');
  }
  return identity;
}

export function safeOrigin(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new Error('Use an HTTPS origin or an explicit loopback HTTP origin, without credentials.');
  }
  return url.origin;
}

function equal(a, b) {
  const digest = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

// These are app access credentials, not upstream provider credentials. The operator
// secret must never be supplied to the coding agent or its job client environment.
export async function authenticate(request, identity, env = process.env) {
  requireIdentity(identity);
  const caller = env.CONQUISTADOR_EVE_CALLER_TOKEN;
  const operator = env.CONQUISTADOR_EVE_OPERATOR_TOKEN;
  if (!caller || !operator || caller.length < 32 || operator.length < 32 || equal(caller, operator)) return null;
  const header = request.headers.get('authorization') ?? '';
  const role = equal(header, `Bearer ${operator}`) ? 'operator' : equal(header, `Bearer ${caller}`) ? 'caller' : null;
  if (!role) return null;
  const pathname = new URL(request.url).pathname;
  // Only the documented inspection/session routes are available to these credentials.
  // No callbacks, task input, delegated identity, or future routes inherit authority.
  const sessionPath = /^\/eve\/v1\/session\/[A-Za-z0-9_-]+$/;
  if (request.method === 'GET') {
    if (pathname !== '/eve/v1/info' && !/^\/eve\/v1\/session\/[A-Za-z0-9_-]+\/stream$/.test(pathname)) return null;
  } else if (request.method === 'POST') {
    let body;
    try {
      const raw = await request.clone().text();
      if (Buffer.byteLength(raw) > 64 * 1024) return null;
      body = JSON.parse(raw);
    } catch { return null; }
    if (!body || Array.isArray(body) || typeof body !== 'object') return null;
    if (role === 'operator') {
      if (!sessionPath.test(pathname) || Object.keys(body).some(k => !['inputResponses'].includes(k)) ||
          !Array.isArray(body.inputResponses) || body.inputResponses.length === 0) return null;
    } else {
      if (pathname !== '/eve/v1/session' && !sessionPath.test(pathname)) return null;
      if (Object.keys(body).some(k => !['message', 'turnPolicy'].includes(k)) ||
          typeof body.message !== 'string' || !body.message.trim() ||
          (body.turnPolicy !== undefined && body.turnPolicy !== 'queue')) return null;
    }
  } else return null;
  return {
    authenticator: 'conquistador-eve-owner-token',
    principalId: identity.owner,
    principalType: 'user',
    issuer: `urn:conquistador:eve:${identity.instance}`,
    attributes: { role },
  };
}

export function executorSettings(identity, session, env = process.env) {
  requireIdentity(identity);
  for (const principal of [session.auth.current, session.auth.initiator]) {
    if (!principal || principal.principalId !== identity.owner || principal.principalType !== 'user' ||
        principal.issuer !== `urn:conquistador:eve:${identity.instance}`) {
      throw new Error('Executor requires the prepared app owner on the current and initiating turn.');
    }
  }
  const endpoint = env.CONQUISTADOR_EXECUTOR_MCP_URL;
  const token = env.CONQUISTADOR_EXECUTOR_TOKEN;
  const allow = env.CONQUISTADOR_EXECUTOR_TOOLS;
  const account = env.CONQUISTADOR_EXECUTOR_ACCOUNT;
  if (!endpoint && !token && !allow && !account) return null;
  if (!endpoint || !token || token.length < 32 || !allow || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(account ?? '')) throw new Error('Executor requires a host endpoint, scoped token, account ID, and explicit tool allow-list.');
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Executor MCP requires HTTPS without embedded credentials.');
  const tools = allow.split(',');
  if (tools.length > 32 || tools.some(t => !/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(t)) || new Set(tools).size !== tools.length) {
    throw new Error('Executor tools must be a comma-separated list of exact tool names.');
  }
  if ([env.CONQUISTADOR_EVE_CALLER_TOKEN, env.CONQUISTADOR_EVE_OPERATOR_TOKEN].includes(token)) throw new Error('Executor must use a separate scoped credential.');
  const credentialFingerprint = createHash('sha256').update(token).digest('hex');
  return { url: url.href, token, tools, account, credentialFingerprint };
}
