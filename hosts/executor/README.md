# Executor connection client

This optional private package connects to an operator-configured Executor MCP
endpoint using the official `@modelcontextprotocol/sdk` client. The coding agent
remains the entrypoint. This package starts no daemon and registers no host tools.

## Install and check

Use Node 24 and Bun. From this directory:

```sh
bun install --frozen-lockfile --ignore-scripts
npm run check
npm test
```

The exact npm versions checked on 2026-09-16 are MCP SDK `1.30.0` and Executor
`1.6.8`. `bun.lock` records the resolved packages. The Executor CLI is a development
dependency for explicit operator use and version monitoring. The client never
starts it. Root build and tests do not import this optional package.

## CLI contract

The parent can route `conquistador connections` arguments to
`await run(argv, { stdout, stderr, env })` from `cli.mjs`. The optional streams
implement `write(string)`. `run` returns 0 or 1 and does not exit the process.
Direct invocation works too:

```sh
node hosts/executor/cli.mjs --help
node hosts/executor/cli.mjs prepare \
  --endpoint http://127.0.0.1:4788/mcp \
  --ui-url http://127.0.0.1:4788/ \
  --auth-env CONQUISTADOR_EXECUTOR_ACCESS
node hosts/executor/cli.mjs login --config /absolute/operator-owned/connection.json
node hosts/executor/cli.mjs probe --config /absolute/operator-owned/connection.json
```

`prepare` prints a non-secret JSON draft. It never writes or overwrites a file.
Save that draft outside Git with operator-only access. Help, preparation, and
login handoff work without the SDK installed. The config has exactly four fields:

| Field | Contract |
| --- | --- |
| `schema` | `conquistador.executor-connection/v1` |
| `endpoint` | HTTPS `/mcp` or `/mcp/toolkits/<slug>`; HTTP allowed only at numeric loopback |
| `uiUrl` | Root UI URL on the same origin as the endpoint |
| `authEnv` | Environment variable name beginning `CONQUISTADOR_EXECUTOR_` |

URL credentials, query strings, fragments, extra config fields, and credential
flags are rejected. Deployment URLs with other paths or cross-origin UI hosts
are currently unsupported. Do not rewrite a Cloud URL to fit this validator.
The operator must confirm that the selected endpoint belongs to Executor.

`login` returns `operator-action-required` and the validated UI URL. It does not
open a browser, claim login success, capture credentials, or implement OAuth.
Use Executor UI to authenticate the provider and configure connection policies.
Supply a scoped Executor access bearer through the named environment variable
using the operator's existing credential tooling. Do not put its value in shell
arguments, config JSON, chat, or committed files. If the deployment only supports
interactive MCP OAuth, complete that through an existing compatible host. This
client does not yet consume that host's OAuth session.

`probe` initializes MCP, reads at most three tool-list pages and 128 total tools,
and rejects any page above 64 tools. A 10-second client lifetime bounds network
waiting and each response body is limited to 256 KiB, including streamed bodies.
It never calls `tools/call`, invokes a provider, accepts elicitation, or runs code.
It reports only known MCP entrypoint names and schema/name fingerprints. Other
names, descriptions, schemas, server errors and cursors are not printed.
`connectionVerified: true` means MCP negotiation and listing succeeded against
the configured endpoint. `providerVerified` always remains false.

## API and authority

`createExecutorClient(config, { env })` from `client.mjs` returns a frozen object
with `probe()` and `close()`. `probe()` closes the client after success or failure.
Call `close()` when abandoning a client before probing. Cleanup attempts MCP
session termination within the same lifetime and then closes local transport.
An unreachable endpoint can leave a server-side session until Executor expires it.
The public client has no generic `callTool`, `execute`, or `invoke` API. The separate host-only callback below owns one fixed invocation.

### GitHub metadata callback

`createExecutorGithubRepositoryRead(config, { env, connection,
allowedRepositories, binding })` returns `{ readRepository, credential }`.
Pass `readRepository` to the existing catalog
`createExecutorGithubRepositoryAdapter`. The host's Connection resolver must
return the same opaque `credential` object for that exact Connection. The object
contains no secret. Keep the factory and resolver in trusted host code.

The operator supplies and reviews this binding outside model-controlled input:

| Field | Contract |
| --- | --- |
| `integration` | Exactly `github` |
| `owner` | `org` or `user` |
| `connection` | Exact Executor connection name |
| `toolId` | Exact discovered `tools.github.<owner>.<connection>.<tool>` ID |
| `inputSchema` | Exact reviewed schema; an object with only required string `owner` and `repo` properties, and `additionalProperties: false` |

This intentionally supports one argument layout. Other imported OpenAPI or
GraphQL layouts require another audited mapping. The binding is host authority,
not proof that an arbitrary tool is safe. The operator must verify that the tool
really reads GitHub repository metadata before supplying it. Matching annotations
are a required check, not independent evidence of that semantic contract.

Each callback checks the Connection snapshot and opaque credential identity,
repository allowlist and deadline before network access. It appends the official
`?mode=passthrough` option internally, runs one bounded `search` for repository
metadata in that exact account, and requires a unique matching tool ID, exact
schema, `readOnlyHint: true`, and `destructiveHint: false`. It then calls `invoke`
with only `{ owner, repo }`. There is no arbitrary argument or execution API.
The response must be a successful Executor `completed` envelope with repository
metadata matching the requested full name. Other envelopes, redirects, schema
drift, policy errors, and mismatched identities fail closed. Errors and logs are
not forwarded. No automatic retries occur.

Use this callback only through the catalog Gateway and existing adapter. The
Gateway still owns approval, connection validation, budgets, receipts and candidate
verification. Direct callback use cannot grant catalog or release authority.
A generic Executor `execute` or `invoke` tool must never become an unrestricted
model tool through this package. No live GitHub binding was supplied or tested.

## Credential custody

Executor owns upstream provider credentials, OAuth registration, refresh and
policy enforcement. This package creates no secret store. It reads only the
operator-selected environment variable, retains that Executor bearer in process
memory for the client lifetime, and sends it only to the exact configured endpoint.
It rejects redirects, excludes ambient cookies, and performs no OAuth discovery.
The bearer is a gateway credential, not a provider token. The operator must scope
it and Executor policies to the intended account and operations. Local process
and environment access remain host security responsibilities.

## Verification and remaining prerequisites

Tests use the genuinely installed official MCP client and server SDK over a
short-lived loopback HTTP server with synthetic credentials. They verify protocol
compatibility, transport limits, cancellation, output filtering, config rejection,
redirect refusal, exact GitHub callback binding, and offline operation. These fixtures are not real Executor
server, provider-account, human-acceptance or release evidence. The Executor
binary is installed but is not launched in the suite.

Live prerequisites remain an operator-approved Executor endpoint, scoped access
bearer, provider connection and policies configured through Executor UI, a reviewed binding in the supported GitHub argument layout, and authorized catalog verification with observed receipts.
No third-party live account calls or external messages occur in these tests.

## Official sources

Research used the [Executor site](https://executor.sh/), the
[Executor README](https://github.com/UsefulSoftwareCo/executor/blob/6bbb2bb360620c921867a937c3cd731dfebac803/README.md),
[MCP proxy documentation](https://github.com/UsefulSoftwareCo/executor/blob/6bbb2bb360620c921867a937c3cd731dfebac803/apps/docs/mcp-proxy.mdx),
and the [MCP tool server source](https://github.com/UsefulSoftwareCo/executor/blob/6bbb2bb360620c921867a937c3cd731dfebac803/packages/hosts/mcp/src/tool-server.ts).
The installed SDK's `client/index.js`, `client/streamableHttp.js`, and
`server/streamableHttp.js` interfaces were exercised directly. Current upstream
source research does not establish compatibility of every deployed Executor version.
