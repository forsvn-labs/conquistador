import type { Readable, Writable } from "node:stream";
export type McpOptions = {
    url?: string;
    token?: string;
    input?: Readable;
    output?: Writable;
    signal?: AbortSignal;
};
/** Narrow stdio MCP adapter. Only a service token crosses this boundary. */
export declare function runMcpStdio(options?: McpOptions): Promise<void>;
