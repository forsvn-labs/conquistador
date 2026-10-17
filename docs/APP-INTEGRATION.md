# Use Conquistador inside your app

Add Conquistador as a production dependency when your app already has an agent. The package
provides eight marketing tools and their playbooks. Your app supplies the model, each user's
context, authentication, and decisions to send, publish, or spend.

The public imports below require **0.7.0 or later**. The commands below target 0.8.0.
Versions before 0.7.0 provide the CLI and MCP server, with no public app import.

## Add the dependency

Run in your app folder:

```sh
npm i @forsvn/conquistador@^0.8.0
# Or:
bun add @forsvn/conquistador@^0.8.0
```

Keep the package in `dependencies`, so a production install includes it. Commit the updated
manifest and lockfile. Node 22.18 or later and Bun can load it on the server. Installation and
import start no TUI, agent setup, listener, or model call. You do not need a global CLI.

## Give your agent the tools

```js
import { createConquistador } from '@forsvn/conquistador';

const cq = createConquistador({
  receiptKey: process.env.CONQUISTADOR_RECEIPT_KEY,
});

const marketingTools = cq.tools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: tool.inputSchema,
  execute: args => cq.callTool(tool.name, args),
}));
```

Add `cq.instructions` to the agent's instructions. Register `marketingTools` with your existing
tool-calling layer. Adapt `inputSchema` to the field your model SDK expects. Each `execute`
function runs the actual packaged tool. Conquistador does not choose a provider or start an agent.

`cq.tools` contains the same definitions as MCP `tools/list`. `cq.callTool(name, args)` returns
the MCP tool result: `content`, optional `structuredContent`, and `isError` on a tool failure.
Unknown names or invalid argument types throw `TypeError`. A request over 65,536 encoded bytes
throws `RangeError`. Tool-specific limits, such as the 8,000-character context limit, return
`isError`. The imports include TypeScript declarations.

For a direct call:

```js
const brief = cq.callTool('conquistador_brief', {
  task: 'Write a cold email for this product.',
  context: 'Product: Ledgerline compares Stripe and HubSpot revenue. Proof: none supplied.',
  size: 'compact',
});
if (brief.isError) throw new Error(brief.content[0].text);
// Give the whole brief to the agent, then read its readNow files before drafting.
```

| Tool | Purpose |
|---|---|
| `conquistador_brief` | Route the task and return the selected playbooks and reading order |
| `conquistador_read` | Read a packaged playbook or relative link |
| `conquistador_search` | Find other relevant packaged playbooks |
| `conquistador_methods` | List the commands and plays |
| `conquistador_files` | List a command or play's readable files |
| `conquistador_check` | Check a draft against fixed writing and channel rules |
| `conquistador_score` | Apply a rubric's pass rules to the agent's self-score |
| `conquistador_verify` | Verify that the final draft matches its check receipt |

Use the [MCP tool reference](https://conquistador.app/docs/reference/mcp-tools) for the arguments.
The app imports and app MCP mounts read only the bundled library. They never discover local
`PRODUCT.md`, `GROWTH.md`, home playbooks, or a disk cache. Send the correct user's facts in
`context` on each brief and check. Calls do not retain that context. The app decides which facts
the user may access and which facts are verified.

## Verify before handover

Set a server-only `CONQUISTADOR_RECEIPT_KEY`. The access token and receipt key must be different.
Give the agent tool results, never the signing key. The agent checks the draft and returns its
receipt. Your app then verifies the final text with the same context and channel:

```js
const result = cq.callTool('conquistador_verify', {
  text: finalText,
  receipt: checkReceipt,
  context: userContext,
  channel: 'email',
});
const gate = result.structuredContent;
if (result.isError || !gate?.valid || !gate.clean || !gate.signed) {
  throw new Error('The final draft needs another check.');
}
// The app can now hand the checked draft to its user.
```

A receipt proves that the exact text passed the fixed checks with those inputs. It does not
prove writing quality, the truth of the supplied context, or permission to send the draft.
Without a key, receipts are unsigned. A host that depends on receipts must require `signed`.

## Mount MCP beside the app

When another agent should connect to your app over MCP, mount the server on the same port:

```js
import { createServer } from 'node:http';
import { createMcpRequestHandler } from '@forsvn/conquistador/mcp';

const mcp = createMcpRequestHandler({
  token: process.env.CONQUISTADOR_MCP_TOKEN,
  receiptKey: process.env.CONQUISTADOR_RECEIPT_KEY,
});

const server = createServer((request, response) => {
  const path = (request.url ?? '/').split('?')[0];
  if (path === '/mcp' || path === '/health') {
    void mcp(request, response);
    return;
  }
  // Your app's existing route handler goes here.
  response.end('App running');
});
server.listen(Number(process.env.PORT ?? 8787), '127.0.0.1');
```

Creating a handler never opens a port. The app owns listening, routing, and shutdown. Mount it
before middleware consumes the request body. For deployment, keep the package and its `skills/`
files in the server build, use the platform's port and network binding, and let the platform
provide HTTPS. See the [runnable example](../examples/app-integration/README.md).

The mount uses stateless Streamable HTTP. `POST /mcp` handles one JSON-RPC message. `GET /mcp`
returns 405 because it has no SSE stream. `GET /health` returns a public health result. It supports
the advertised 2025-11-25 protocol and the earlier revisions listed by the server. The current
official MCP client can use it through its compatibility path. This is not a claim of the full
2026-07-28 protocol.

MCP returns 503 when neither a token nor an app access check is configured. Requests without
valid credentials return 401. An unsupported protocol header returns 400. A body over 65,536
bytes returns 413. Browser requests with an `Origin` return 403 by default. Set
`allowedOrigins: ['https://your-app.example']` only for the browser origins the app permits.
The mount does not add CORS headers or an OAuth login flow.

## Use the app's authentication

An app can check its own user session instead of sharing a bearer token:

```js
const mcp = createMcpRequestHandler({
  receiptKey: process.env.CONQUISTADOR_RECEIPT_KEY,
  authorize: async request => {
    const user = await authenticateAppRequest(request);
    return Boolean(user?.canUseMarketingTools);
  },
});
```

`authenticateAppRequest` is your app's authentication function. Only an explicit `true` grants
access. Exceptions and other return values deny access. If both `authorize` and `token` are
set, the app's `authorize` callback controls access. Keep rate limits and tenant access in the
app. The Conquistador MCP mount contains no user database or stored context.

For a server that uses `Request` and `Response`, use the Fetch adapter:

```js
import { createMcpFetchHandler } from '@forsvn/conquistador/mcp';
const handleMcp = createMcpFetchHandler({
  token: process.env.CONQUISTADOR_MCP_TOKEN,
  receiptKey: process.env.CONQUISTADOR_RECEIPT_KEY,
});
// At /mcp, pass the original Request and return await handleMcp(request).
```

Its `authorize` callback receives a Fetch `Request`. The Node adapter's callback receives
`IncomingMessage`. Both use the same tool engine, limits, and receipts. Fetch is a request
interface here; it does not make the filesystem library a browser or arbitrary Edge bundle.
Keep the package external when a server bundler would otherwise omit its playbooks. Use
[hosted MCP](https://conquistador.app/docs/install/hosted-mcp) if your runtime cannot retain
and read those files.

## Run MCP as a separate service

The dependency also provides the local `conquistador` executable. An npm script finds that
executable without a global installation:

```json
{
  "scripts": {
    "mcp": "conquistador mcp --http --host 0.0.0.0"
  }
}
```

Set `CONQUISTADOR_MCP_TOKEN`, `CONQUISTADOR_RECEIPT_KEY`, and the platform's `PORT`, then run
`npm run mcp` or `bun run mcp`. The CLI refuses a public network binding without a token.
Set `CONQUISTADOR_MCP_ORIGINS` to a comma-separated list of exact permitted browser origins
when needed. This CLI path retains personal playbook support; the public app imports use only
the bundled library. Do not point a shared CLI service at an operator's private playbooks.

## Verify your integration

From a source checkout, run `node tools/e2e/app-integration.mjs --package /path/package.tgz`.
Add `--installer bun` for a real Bun dependency install, or `--runtime /path/to/node` to test
another supported Node. Each run writes a package digest, toolchain, command log, and individual
results. It checks real local tools and official MCP clients with fixed drafts. It invokes no
model and does not certify your deployed authentication, model quality, or publishing flow.
