// Streamable HTTP transport for the read-only Conquistador MCP server.
// Bots and remote apps (Grok, Muse, ChatGPT connectors) use this; coding agents use stdio.
// Stateless JSON responses: every POST carries one JSON-RPC message or a batch.
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { createMcpHandler } from './skills-mcp.mjs';

const MAX_BODY = 65_536;

// One request handler for `--http` and the hosted function. A hosted deployment sets
// requireToken, so a missing token fails closed instead of serving the playbooks openly.
export function createMcpRequestHandler({ token = process.env.CONQUISTADOR_MCP_TOKEN, root, requireToken = false } = {}) {
  const handle = createMcpHandler({ ...(root ? { root } : {}), requireInitialize: false });
  const authorized = header => {
    if (!token) return true;
    const expected = Buffer.from(`Bearer ${token}`);
    const actual = Buffer.from(String(header ?? ''));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  };
  return (request, response) => {
    const reply = (status, body, headers = {}) => {
      response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers });
      response.end(body === undefined ? '' : JSON.stringify(body));
    };
    const path = (request.url ?? '/').split('?')[0];
    // A hosting rewrite can deliver /mcp as /api/mcp.
    if (path === '/health' || path === '/api/health') return reply(200, { ok: true, server: 'conquistador' });
    if (path !== '/mcp' && path !== '/api/mcp') return reply(404, { error: 'Use POST /mcp.' });
    if (requireToken && !token) return reply(503, { error: 'This server has no access token configured.' });
    if (!authorized(request.headers.authorization)) return reply(401, { error: 'Missing or invalid bearer token.' }, { 'www-authenticate': 'Bearer' });
    if (request.method === 'DELETE') return reply(200, {});
    if (request.method !== 'POST') return reply(405, { error: 'This server answers POST requests with JSON.' }, { allow: 'POST' });
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) { reply(413, { error: 'Request too large.' }); request.destroy(); return; }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (response.headersSent) return;
      let message;
      try { message = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON' } }); }
      const batch = Array.isArray(message);
      const results = (batch ? message.slice(0, 32) : [message]).map(item => handle(item)).filter(Boolean);
      if (!results.length) return reply(202);
      return reply(200, batch ? results : results[0]);
    });
  };
}

export function createMcpHttpServer(options = {}) {
  return createServer(createMcpRequestHandler(options));
}

export async function runMcpHttp(args) {
  const read = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  const port = Number(read('--port') ?? process.env.PORT ?? 8787);
  const host = read('--host') ?? (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Use --port 1-65535.');
  if (host !== '127.0.0.1' && host !== 'localhost' && !process.env.CONQUISTADOR_MCP_TOKEN) {
    process.stderr.write('[conquistador] Warning: serving on a public interface without CONQUISTADOR_MCP_TOKEN. The server is read-only, but anyone can read the playbooks.\n');
  }
  const server = createMcpHttpServer();
  await new Promise(resolve => server.listen(port, host, resolve));
  process.stderr.write(`[conquistador] MCP server: http://${host}:${port}/mcp\n`);
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
