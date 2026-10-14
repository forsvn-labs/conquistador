// Public server-side app interface. The MCP engine owns the tools and their validation.
import { createMcpHandler, LIMITS, SERVER_INSTRUCTIONS } from '../tools/skills-mcp.mjs';

const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export function createConquistador({ receiptKey } = {}) {
  if (receiptKey !== undefined && (typeof receiptKey !== 'string' || !receiptKey.trim())) throw new TypeError('receiptKey must be a nonempty string.');
  const handle = createMcpHandler({ requireInitialize: false, hosted: true, bundledOnly: true, receiptKey: receiptKey ?? null });
  const tools = freeze(structuredClone(handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }).result.tools));
  return Object.freeze({
    instructions: SERVER_INSTRUCTIONS,
    tools,
    callTool(name, args = {}) {
      if (!tools.some(tool => tool.name === name)) throw new TypeError('Unknown Conquistador tool. Use a name from tools.');
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new TypeError('Pass an object for tool arguments.');
      const message = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } };
      if (Buffer.byteLength(JSON.stringify(message)) > LIMITS.request) throw new RangeError(`Tool request exceeds the ${LIMITS.request}-byte limit.`);
      const response = handle(message);
      if (response.error) throw new TypeError(response.error.message);
      return response.result;
    },
  });
}
