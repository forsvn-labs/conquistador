import type { IncomingMessage, ServerResponse } from 'node:http';
export interface McpOptions<RequestType> {
  /** A server-owned bearer token. Without a token or authorize callback, MCP returns 503. */
  token?: string;
  /** A server-only key for signed check receipts. Callers must never receive it. */
  receiptKey?: string;
  /** Exact permitted browser origins. Default [] rejects requests that carry an Origin. */
  allowedOrigins?: string[];
  /** App-owned access check. Only true grants access. Exceptions and other values deny. */
  authorize?: (request: RequestType) => boolean | Promise<boolean>;
}
/** Mount /mcp and /health on a Node HTTP server. Does not listen or alter other routes. */
export function createMcpRequestHandler(options?: McpOptions<IncomingMessage>): (request: IncomingMessage, response: ServerResponse) => Promise<void>;
/** Mount /mcp and /health through Fetch on a server with Node filesystem support. */
export function createMcpFetchHandler(options?: McpOptions<Request>): (request: Request) => Promise<Response>;
