// A host-side connection to the Conquistador MCP server with the official MCP client, and a small
// CLI that verifies a delivery file. Any host that speaks MCP can gate handover this way: the
// host, not the agent, calls conquistador_verify before a person sees the drafts.
//
//   CONQUISTADOR_MCP_TOKEN=... node mcp-client.mjs --url https://mcp.forsvn.com/mcp \
//     --channel email --context context.md delivery.json
//
// delivery.json is `[{ "title": "...", "text": "...", "receipt": { ... } }]`. Exit 0 when the gate
// accepts every draft, 2 when it rejects the delivery, 1 when the host cannot verify.
import { readFileSync } from 'node:fs';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createHandoverGate } from './gate.mjs';

export async function connectConquistador({ url, token, name = 'conquistador-verify-gate' }) {
  const client = new Client({ name, version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { authorization: `Bearer ${token}` } } });
  await client.connect(transport);
  const callTool = async (tool, args) => {
    const result = await client.callTool({ name: tool, arguments: args });
    if (result.isError) throw Object.assign(new Error(result.content?.[0]?.text ?? 'The tool refused the call.'), { toolError: true });
    return result.structuredContent ?? JSON.parse(result.content[0].text);
  };
  return { client, callTool, close: () => client.close() };
}

async function cli(args) {
  const option = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const url = option('--url') ?? 'https://mcp.forsvn.com/mcp';
  const token = process.env.CONQUISTADOR_MCP_TOKEN;
  const file = args.filter((arg, index) => !arg.startsWith('--') && !args[index - 1]?.startsWith('--')).at(-1);
  if (!token || !file) {
    console.error('Usage: CONQUISTADOR_MCP_TOKEN=... node mcp-client.mjs [--url URL] [--channel NAME] [--context FILE] delivery.json');
    return 1;
  }
  const context = option('--context') ? readFileSync(option('--context'), 'utf8') : undefined;
  let connection;
  try {
    connection = await connectConquistador({ url, token });
    const gate = createHandoverGate({ callTool: connection.callTool, channel: option('--channel'), context });
    const review = await gate.review(JSON.parse(readFileSync(file, 'utf8')));
    console.log(review.feedback);
    return review.hostError ? 1 : review.accepted ? 0 : 2;
  } catch (failure) {
    console.error(`The host could not verify the delivery: ${failure.message}`);
    return 1;
  } finally {
    await connection?.close();
  }
}

if (argv[1] === fileURLToPath(import.meta.url)) process.exitCode = await cli(argv.slice(2));
