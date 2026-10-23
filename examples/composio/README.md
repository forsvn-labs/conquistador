# Conquistador through Composio

This runnable example registers a remote Conquistador server, opens a connection,
discovers tools, and runs a read-only method-catalog check. It follows Composio's
experimental [Custom MCP lifecycle](https://docs.composio.dev/docs/extending-sessions/custom-mcp)
and pins `@composio/core` to 0.27.0. Composio hosts the connection; it does not host
Conquistador. Use a deployed public HTTPS MCP server.

## Prepare

Use Node 22.18 or later. From this folder, run `bun install --frozen-lockfile`.
Supply `COMPOSIO_API_KEY` through your environment or secret manager. It is your
Composio project key, not a Conquistador access token. Do not put secrets in source,
command arguments, screenshots, or shared transcripts.

Every command previews its plan until you add `--apply`. Applied commands use the
real Composio API. No sample or replayed service responses are used.

## Register

```sh
node setup.mjs register
node setup.mjs register --apply
```

Defaults: `https://mcp.forsvn.com/mcp`, DCR OAuth, and `CUSTOM_CONQUISTADOR`.
Set `CONQUISTADOR_MCP_URL` for your own endpoint. Set
`CONQUISTADOR_OAUTH_DISCOVERY_URL` if its authorization server uses another origin.
The discovery URL must name authorization-server metadata, not protected-resource metadata.

For API-key authentication, set `CONQUISTADOR_AUTH=api-key` and use a distinct
`COMPOSIO_TOOLKIT`, such as `CUSTOM_CONQUISTADOR_APIKEY`. The registration contains
only a Bearer header template. Enter the personal Conquistador token on the
Composio Connect Link in the next step. Do not use a shared admin token.

Keep the returned `slug` as `COMPOSIO_TOOLKIT` for all later commands. Registration
is project-wide. Changing an existing toolkit's URL or auth scheme returns 409;
this example never deletes or replaces connections automatically.

## Connect once per user

Set `COMPOSIO_USER_ID` to your application's stable identifier for the intended user.

```sh
node setup.mjs connect
node setup.mjs connect --apply
```

Open the returned `redirectUrl` and finish sign-in. Keep the returned
`connectedAccountId` as `COMPOSIO_ACCOUNT_ID`. Do not rerun `connect` to check status:
it creates a new connection flow. Composio's first tool sync starts after activation.
Its [authentication guide](https://docs.composio.dev/docs/authentication) explains
Connect Links and account ownership.

## Discover and verify

```sh
node setup.mjs discover --apply
```

This creates a session restricted to the selected toolkit and account. It searches
for the Conquistador method-catalog tool. Set `COMPOSIO_METHODS_TOOL` to its exact
returned slug, then run:

```sh
node setup.mjs verify
node setup.mjs verify --apply
```

The check only permits the selected toolkit's `CONQUISTADOR_METHODS` tool and
passes an empty argument object. For other work, use the discovered schemas in
your agent; it supplies the model and task context. If discovery is empty, confirm
the account is active and the initial sync has finished. For failed initial sync
or later server tool changes, run `node setup.mjs sync --apply`.

## Evidence and limits

`node --test tools/composio-example.test.mjs` from the repository root checks request
previews, identity selection, missing credentials, unsafe endpoints, and read-test
restrictions without network access. SDK methods were checked against the pinned
package declarations. These are local contract checks, not a completed Composio
account test. A live pass requires registration, consent, discovery, and a successful
`verify` response in the intended project. Production apps must derive `COMPOSIO_USER_ID`
from authenticated server-side identity, not an untrusted request parameter.
