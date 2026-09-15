export class ExecutorError extends Error {
  constructor(code) { super(code); this.name = 'ExecutorError'; this.code = code; }
}
export function requireCondition(value, code) {
  if (!value) throw new ExecutorError(code);
}

function safeUrl(value, endpoint) {
  requireCondition(typeof value === 'string' && value.length <= 512, 'INVALID_CONFIG');
  let url;
  try { url = new URL(value); } catch { throw new ExecutorError('INVALID_CONFIG'); }
  requireCondition(!url.username && !url.password && !url.hash && !url.search, 'INVALID_CONFIG');
  requireCondition(url.protocol === 'https:' || (url.protocol === 'http:' &&
    ['127.0.0.1', '[::1]'].includes(url.hostname)), 'INVALID_CONFIG');
  // Explicit known routes prevent credential-bearing arbitrary paths in output.
  requireCondition(endpoint ? /^\/mcp(?:\/toolkits\/[a-z0-9-]{1,64})?$/.test(url.pathname) : url.pathname === '/', 'INVALID_CONFIG');
  return url.href;
}

export function validateConfig(value) {
  requireCondition(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_CONFIG');
  requireCondition(Object.keys(value).sort().join(',') === 'authEnv,endpoint,schema,uiUrl', 'INVALID_CONFIG');
  requireCondition(value.schema === 'conquistador.executor-connection/v1', 'INVALID_CONFIG');
  requireCondition(typeof value.authEnv === 'string' && /^CONQUISTADOR_EXECUTOR_[A-Z][A-Z0-9_]{0,63}$/.test(value.authEnv), 'INVALID_CONFIG');
  const endpoint = safeUrl(value.endpoint, true);
  const uiUrl = safeUrl(value.uiUrl, false);
  requireCondition(new URL(endpoint).origin === new URL(uiUrl).origin, 'INVALID_CONFIG');
  return Object.freeze({ schema: value.schema, endpoint, uiUrl, authEnv: value.authEnv });
}

export function loginHandoff(config) {
  const checked = validateConfig(config);
  return { status: 'operator-action-required', uiUrl: checked.uiUrl,
    instruction: 'Open Executor UI, connect the provider, restrict its policies, and supply a scoped Executor bearer through the named environment variable. Then run probe.',
    connectionVerified: false, providerVerified: false };
}
