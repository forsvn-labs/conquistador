# App and MCP example

`server.mjs` runs an app and Conquistador MCP on one port. `/api/brief`, `/api/check`, and
`/api/verify` call the public library directly. `/mcp` serves the same eight tools to an MCP
client. There is no model in this example. Your existing agent supplies it.

From an app folder, after Conquistador 0.7.0 is released:

```sh
npm i @forsvn/conquistador@^0.7.0
cp node_modules/@forsvn/conquistador/examples/app-integration/server.mjs ./server.mjs
```

Or install with `bun add @forsvn/conquistador@^0.7.0`, then copy the same file. Keep Conquistador
in `dependencies` so production installs include it. Set two different secrets in your shell or
hosting platform: `CONQUISTADOR_MCP_TOKEN` for client access and `CONQUISTADOR_RECEIPT_KEY` for
server-only receipt signing. Then:

```sh
node server.mjs
# Or: bun server.mjs
```

The app listens on `127.0.0.1:8787`. Set `HOST=0.0.0.0` and your platform's `PORT` when deploying.
The platform must provide HTTPS. `GET /health` is the health check. Clients send
`Authorization: Bearer <CONQUISTADOR_MCP_TOKEN>` to `/mcp` and the `/api/` routes.
`conquistador mcp --http` can also run as a separate service from an npm script, using the same
production dependency. A second service is optional.

For your own app, put the direct calls behind its existing user authentication and supply each
user's context from your trusted app data. Add Conquistador's tool definitions to the agent's
available tools, execute their calls on your server, and enforce signed verification before
handover. Keep publication tools and their user decisions in the app. See
[the app guide](../../docs/APP-INTEGRATION.md).

The E2E runner installs the npm tarball in an isolated app, copies this file, and checks direct
calls and MCP on the same port. It uses fixed drafts and no model. Node and Bun are supported;
browser bundles and arbitrary Edge runtimes are outside this example.
