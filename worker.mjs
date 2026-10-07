// Cloudflare Worker for the hosted, read-only playbook MCP server. Modules and playbooks are
// uploaded unbundled, so the server reads skills/ from /bundle with node:fs as it does on disk.
// Every MCP request is refused until the CONQUISTADOR_MCP_TOKEN secret is set.
import { createMcpResponder, MAX_BODY } from './tools/mcp-http.mjs';

const responders = new Map();
const responderFor = token => {
  if (!responders.has(token)) responders.set(token, createMcpResponder({ token, requireToken: true }));
  return responders.get(token);
};

export default {
  async fetch(request, env) {
    const respond = responderFor(env.CONQUISTADOR_MCP_TOKEN ?? '');
    const readBody = async () => {
      if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return null;
      const text = await request.text();
      return new TextEncoder().encode(text).length > MAX_BODY ? null : text;
    };
    const result = await respond({ method: request.method, path: new URL(request.url).pathname, authorization: request.headers.get('authorization'), readBody });
    return new Response(result.body || null, { status: result.status, headers: result.headers });
  },
};
