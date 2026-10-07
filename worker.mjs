// Cloudflare Worker for the hosted, read-only playbook MCP server. Modules and playbooks are
// uploaded unbundled, so the server reads skills/ from /bundle with node:fs as it does on disk.
// Every MCP request needs a bearer token: the shared admin token (CONQUISTADOR_MCP_TOKEN) or a
// personal cq_ token from /signup or `conquistador login` (tools/hosted-auth.mjs). With neither
// configured, every MCP request is refused.
import { createMcpResponder, MAX_BODY } from './tools/mcp-http.mjs';
import { authenticate, handleAuthRoute, readBounded } from './tools/hosted-auth.mjs';

// CONQUISTADOR_RECEIPT_KEY signs check receipts; callers hold the access token but never this key.
const responders = new Map();
const responderFor = receiptKey => {
  if (!responders.has(receiptKey)) responders.set(receiptKey, createMcpResponder({ token: '', receiptKey: receiptKey || undefined }));
  return responders.get(receiptKey);
};

export default {
  async fetch(request, env, ctx) {
    const page = await handleAuthRoute(request, env, ctx);
    if (page) return page;
    const url = new URL(request.url);
    const respond = responderFor(env.CONQUISTADOR_RECEIPT_KEY ?? '');
    const authorize = async header => (await authenticate(env, ctx, header, url.origin)).refusal ?? null;
    // Stop reading once the body passes MAX_BODY; a client can omit Content-Length.
    const result = await respond({ method: request.method, path: url.pathname, authorization: request.headers.get('authorization'), readBody: () => readBounded(request, MAX_BODY), authorize });
    return new Response(result.body || null, { status: result.status, headers: result.headers });
  },
};
