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
    // Stop reading once the body passes MAX_BODY; a client can omit Content-Length.
    const readBody = async () => {
      if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return null;
      if (!request.body) return '';
      const reader = request.body.getReader();
      const chunks = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY) { await reader.cancel(); return null; }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return new TextDecoder().decode(bytes);
    };
    const result = await respond({ method: request.method, path: new URL(request.url).pathname, authorization: request.headers.get('authorization'), readBody });
    return new Response(result.body || null, { status: result.status, headers: result.headers });
  },
};
