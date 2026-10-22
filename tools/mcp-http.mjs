// Streamable HTTP transport for the read-only Conquistador MCP server.
// Bots, remote apps, and deployed agents use this; coding agents use stdio.
// Stateless JSON responses: every POST carries one JSON-RPC message or a batch.
// One responder serves two adapters: Node's http server (`--http`) and the Cloudflare Worker.
import { timingSafeEqual } from 'node:crypto';
import { createMcpHandler, SUPPORTED_PROTOCOL_VERSIONS } from './skills-mcp.mjs';

export const MAX_BODY = 65_536;
const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };

// A hosted deployment sets requireToken, so a missing token fails closed instead of serving
// the playbooks openly. readBody returns the request text, or null when it exceeds MAX_BODY.
// A request can carry its own authorize(header), which returns null to allow it or a refusal
// ({ status, body, headers }); the Worker uses it for personal tokens and rate limits.
export function createMcpResponder({ token = process.env.CONQUISTADOR_MCP_TOKEN, root, requireToken = false, receiptKey = process.env.CONQUISTADOR_RECEIPT_KEY, bundledOnly = false, allowedOrigins = [] } = {}) {
  const handle = createMcpHandler({ ...(root ? { root } : {}), requireInitialize: false, hosted: true, bundledOnly, receiptKey });
  const authorized = header => {
    if (!token) return true;
    const expected = Buffer.from(`Bearer ${token}`);
    const actual = Buffer.from(String(header ?? ''));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  };
  const reply = (status, body, extra = {}) => ({ status, headers: { ...headers, ...extra }, body: body === undefined ? '' : JSON.stringify(body) });
  return async ({ method, path, authorization, origin, protocolVersion, readBody, authorize }) => {
    if (path === '/health') return reply(200, { ok: true, server: 'conquistador' });
    if (path !== '/mcp') return reply(404, { error: 'Use POST /mcp.' });
    if (origin !== undefined && origin !== null && !allowedOrigins.includes(origin)) return reply(403, { error: 'Origin is not allowed.' });
    if (protocolVersion !== undefined && protocolVersion !== null && !SUPPORTED_PROTOCOL_VERSIONS.includes(protocolVersion)) return reply(400, { error: 'Unsupported MCP protocol version.' });
    if (authorize) {
      const refusal = await authorize(authorization);
      if (refusal) return reply(refusal.status, refusal.body, refusal.headers);
    } else {
      if (requireToken && !token) return reply(503, { error: 'This server has no access token configured.' });
      if (!authorized(authorization)) return reply(401, { error: 'Missing or invalid bearer token.' }, { 'www-authenticate': 'Bearer' });
    }
    if (method === 'DELETE') return reply(200, {});
    if (method !== 'POST') return reply(405, { error: 'This server answers POST requests with JSON.' }, { allow: 'POST' });
    let text;
    try { text = await readBody(); }
    catch { return reply(400, { error: 'Cannot read request body.' }); }
    if (text === null) return reply(413, { error: 'Request too large.' });
    let message;
    try { message = JSON.parse(text); } catch { return reply(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON' } }); }
    if (Array.isArray(message)) return reply(400, { error: 'Send one JSON-RPC message per POST.' });
    const result = handle(message);
    return result ? reply(200, result) : reply(202);
  };
}

// Node adapter: stops reading once the body passes MAX_BODY.
export function createMcpRequestHandler(options = {}) {
  const respond = createMcpResponder(options);
  return async (request, response) => {
    const readBody = () => new Promise(resolve => {
      const chunks = [];
      let size = 0;
      request.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BODY) { request.pause(); resolve(null); return; }
        chunks.push(chunk);
      });
      request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      request.on('error', () => resolve(null));
      request.on('aborted', () => resolve(null));
    });
    const authorize = options.authorize ? () => authorizeAppRequest(options.authorize, request) : undefined;
    const result = await respond({ method: request.method, path: (request.url ?? '/').split('?')[0], authorization: request.headers.authorization, origin: request.headers.origin, protocolVersion: request.headers['mcp-protocol-version'], readBody, authorize });
    if (response.destroyed) return;
    response.writeHead(result.status, result.headers);
    response.end(result.body, () => { if (result.status === 413) request.destroy(); });
  };
}

// The app owns its authentication. Only an explicit true grants access; errors fail closed.
export async function authorizeAppRequest(authorize, request) {
  try { if (await authorize(request) === true) return null; } catch { /* Do not disclose authentication details. */ }
  return { status: 401, body: { error: 'App authentication did not grant access.' } };
}

export async function runMcpHttp(args) {
  const { createServer } = await import('node:http');
  const read = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  const port = Number(read('--port') ?? process.env.PORT ?? 8787);
  const host = read('--host') ?? (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Use --port 1-65535.');
  const publicHost = !['127.0.0.1', 'localhost', '::1'].includes(host);
  if (publicHost && !process.env.CONQUISTADOR_MCP_TOKEN) throw Error('Set CONQUISTADOR_MCP_TOKEN before serving on a public interface.');
  const allowedOrigins = (process.env.CONQUISTADOR_MCP_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  const server = createServer(createMcpRequestHandler({ requireToken: publicHost, allowedOrigins }));
  await new Promise(resolve => server.listen(port, host, resolve));
  process.stderr.write(`[conquistador] MCP server: http://${host}:${port}/mcp\n`);
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
