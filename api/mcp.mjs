// Mount the packaged tool engine beside an app. Creating a handler never opens a port.
import { createMcpRequestHandler as nodeHandler, createMcpResponder, authorizeAppRequest, MAX_BODY } from '../tools/mcp-http.mjs';

function optionsFor({ token, receiptKey, allowedOrigins = [], authorize } = {}) {
  for (const [name, value] of Object.entries({ token, receiptKey })) {
    if (value !== undefined && (typeof value !== 'string' || !value.trim())) throw new TypeError(`${name} must be a nonempty string.`);
  }
  if (authorize !== undefined && typeof authorize !== 'function') throw new TypeError('authorize must be a function.');
  if (!Array.isArray(allowedOrigins) || allowedOrigins.some(origin => {
    try { const url = new URL(origin); return !['http:', 'https:'].includes(url.protocol) || origin !== url.origin; } catch { return true; }
  })) throw new TypeError('allowedOrigins must contain exact HTTP or HTTPS origins.');
  return { token: token ?? null, receiptKey: receiptKey ?? null, allowedOrigins: [...allowedOrigins], authorize, requireToken: true, bundledOnly: true };
}

export function createMcpRequestHandler(options) {
  return nodeHandler(optionsFor(options));
}

async function readBody(request) {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { reader.releaseLock(); }
}

export function createMcpFetchHandler(options) {
  const configured = optionsFor(options);
  const respond = createMcpResponder(configured);
  return async request => {
    const authorize = configured.authorize ? () => authorizeAppRequest(configured.authorize, request) : undefined;
    const result = await respond({ method: request.method, path: new URL(request.url).pathname, authorization: request.headers.get('authorization'), origin: request.headers.get('origin'), protocolVersion: request.headers.get('mcp-protocol-version'), readBody: () => readBody(request), authorize });
    return new Response(result.body || null, { status: result.status, headers: result.headers });
  };
}
