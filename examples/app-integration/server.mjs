// An app and Conquistador MCP in one process. Your agent can call the library directly.
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createConquistador } from '@forsvn/conquistador';
import { createMcpRequestHandler } from '@forsvn/conquistador/mcp';

export function createAppServer({ token, receiptKey } = {}) {
  if (!token?.trim() || !receiptKey?.trim()) throw Error('Set CONQUISTADOR_MCP_TOKEN and CONQUISTADOR_RECEIPT_KEY.');
  const cq = createConquistador({ receiptKey });
  const mcp = createMcpRequestHandler({ token, receiptKey });
  const routes = { '/api/brief': 'conquistador_brief', '/api/check': 'conquistador_check', '/api/verify': 'conquistador_verify' };
  return createServer(async (request, response) => {
    const path = (request.url ?? '/').split('?')[0];
    const reply = (status, body) => {
      response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify(body));
    };
    try {
      if (path === '/mcp' || path === '/health') { await mcp(request, response); return; }
      if (path === '/' && request.method === 'GET') { reply(200, { app: 'Conquistador app example', mcp: '/mcp', routes: Object.keys(routes) }); return; }
      if (!Object.hasOwn(routes, path)) { reply(404, { error: 'Route not found.' }); return; }
      if (request.headers.origin !== undefined) { reply(403, { error: 'This example accepts server requests.' }); return; }
      const actual = Buffer.from(request.headers.authorization ?? '');
      const expected = Buffer.from(`Bearer ${token}`);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) { reply(401, { error: 'Missing or invalid bearer token.' }); return; }
      if (request.method !== 'POST') { reply(405, { error: 'Use POST.' }); return; }
      const chunks = [];
      let bytes = 0;
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > 65_536) { reply(413, { error: 'Request too large.' }); return; }
        chunks.push(chunk);
      }
      const result = cq.callTool(routes[path], JSON.parse(Buffer.concat(chunks).toString('utf8')));
      reply(result.isError ? 422 : 200, result);
    } catch {
      if (!response.headersSent && !response.destroyed) reply(400, { error: 'Invalid request. Use the tool arguments in the app guide.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createAppServer({ token: process.env.CONQUISTADOR_MCP_TOKEN, receiptKey: process.env.CONQUISTADOR_RECEIPT_KEY });
  const port = Number(process.env.PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw Error('PORT must be 1-65535.');
  server.listen(port, process.env.HOST ?? '127.0.0.1', () => process.stderr.write(`App and MCP listening on port ${port}.\n`));
  process.once('SIGINT', () => server.close());
  process.once('SIGTERM', () => server.close());
}
