// Vercel function for the hosted, read-only playbook MCP server. It refuses every MCP
// request until CONQUISTADOR_MCP_TOKEN is set in the project's environment.
import { createMcpRequestHandler } from '../tools/mcp-http.mjs';

export default createMcpRequestHandler({ requireToken: true });
