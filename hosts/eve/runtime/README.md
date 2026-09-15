# Optional native Eve runtime

This private package pins `eve` to **0.55.0**. It is separate from the zero-runtime
portable Eve host contract. `ai` and `just-bash` are exact direct dependencies; `bun.lock`
pins the full install. Node 24 is required. This is an optional native integration,
not a claim of credentialed provider execution or deployment acceptance.

## Prepare and run

From the complete Conquistador checkout:

```sh
node hosts/eve/jobs.mjs prepare --destination /absolute/new-owner-app \
  --owner stable-owner-id --model provider/explicit-model-id
```

Use a real supported AI Gateway model ID. The sample value is deliberately not a model
recommendation. Preparation writes files only. In the optional source package, install
its client dependencies explicitly:

```sh
cd hosts/eve/runtime
bun install --frozen-lockfile --ignore-scripts
npm run check
npm test
```

In the newly prepared app, explicitly install and build:

```sh
bun install --frozen-lockfile --ignore-scripts
bun run check
bun run build
```

Supply the host configuration below through the operator's secret store or process
launcher, then explicitly run `bun run dev`. It starts Eve on loopback with no TUI and
no daemon registration. No command here enables a service at login. Keep the process
running to execute local durable jobs. Restart using the same app and its `.eve/` state.
For production self-hosting, persist `.eve/.workflow-data` and sandbox state, and
forward both `/eve/` and `/.well-known/workflow/` without path rewriting as required by the [pinned self-hosting docs](https://eve.dev/docs/guides/deployment/self-hosting.md).
This change does not provision or deploy that infrastructure.

## Host configuration and isolation

One app directory, process, state root, and unique pair of access credentials belong
to exactly one owner. Do not share the app across users, tenants, or owners. Do not
change `identity.json` on an app with sessions. Prepare a new app instead.
Eve route authentication does not itself enforce session ownership, so this template
admits only the single prepared owner. Isolation across owners requires separate app
state and credentials. OS administrators remain trusted.

The host supplies these values. Never put their values in source, message files, the
skill library, or a coding-agent prompt:

| Variable | Purpose |
| --- | --- |
| `AI_GATEWAY_API_KEY` or supported host `VERCEL_OIDC_TOKEN` | Eve model access, held by the Eve host; upstream tool credentials never go here |
| `CONQUISTADOR_EVE_CALLER_TOKEN` | Unique random app access secret of at least 32 characters; caller can submit, inspect, and queue follow-ups |
| `CONQUISTADOR_EVE_OPERATOR_TOKEN` | Different random secret of at least 32 characters; human-only input responses and inspection |
| `CONQUISTADOR_EXECUTOR_MCP_URL` | Optional operator-configured HTTPS MCP endpoint speaking Streamable HTTP or SSE |
| `CONQUISTADOR_EXECUTOR_TOKEN` | Optional separate Executor access token of at least 32 characters, scoped to this owner/account |
| `CONQUISTADOR_EXECUTOR_ACCOUNT` | Optional stable non-secret Executor account identity |
| `CONQUISTADOR_EXECUTOR_TOOLS` | Optional comma-separated exact MCP tool names approved for discovery |

All four Executor variables must be present together. With none, the app has no external
tools and can produce drafts from supplied context. Partial or invalid configuration
fails closed. The operator must verify the endpoint is Executor, that the token selects
the intended account, and that Executor enforces the required upstream action policies.
An HTTPS hostname alone cannot prove that it is Executor. Do not expose an unrestricted
Executor execute tool without those policies. No endpoint or upstream schema is invented.

The native connection uses `defineMcpClientConnection`, user-scoped authentication,
an explicit allow-list, and `approval: always()`. Every call, including discovery-result
reads exposed as tools, requires human approval. Executor owns upstream credentials,
connections, and authorization. Connection discovery itself contacts the configured MCP
endpoint when the model asks for discovery; it is not proof any upstream action ran.
Changing the endpoint, account, or token fingerprint changes Eve's durable connection
identity. Only the SHA-256 fingerprint participates in that identity; no token is
persisted there. Mid-turn changes fail before token use. Stop and reconcile outstanding
actions before rotation, and prepare a new app for changed account scope.

Default tools are disabled. Only `load_skill`, `read_skill_file`, `ask_question`, and Eve's required
connection discovery are available. The read_skill_file tool reads bounded text references
inside installed skill packages only. No shell, general filesystem, web search, web fetch,
subagents, schedules, hooks, memory, or provider-specific tool connection is configured.
The pure-JS just-bash backend holds skill assets; it has no exposed command tool and
cannot auto-install. It is not an OS security sandbox. Do not add arbitrary tools and
continue to assume these restrictions hold.

## Submit, inspect, and resume

The root jobs wrapper uses the installed optional package. The prepared app also has
its own client, so a standalone operator can run these from that app directory:

```sh
node client.mjs submit --url http://127.0.0.1:2000 --message-file /absolute/job.txt
node client.mjs status --url http://127.0.0.1:2000 --session wrun_RETURNED_ID
node client.mjs resume --url http://127.0.0.1:2000 --session wrun_RETURNED_ID \
  --message-file /absolute/follow-up.txt
```

Use the actual port printed by Eve. The client calls documented `Client.sessions.create`,
`attach`, `stream({follow:false})`, and `send` APIs with redirects refused. Submit returns
the accepted durable ID without waiting for model completion. Status returns up to 1,000
events from the durable stream; `truncated` means more events exist. Resume queues a
follow-up on the exact session. It never starts a replacement. A terminal or unknown
session fails. A 30-second request deadline does not cancel an accepted remote job.

Keep the returned session ID. An unconfirmed submit may already have started work.
Inspect operator state before retrying. There is no automatic create retry or invented
idempotency layer. `accepted`, `session.waiting`, and successful local tests do not mean
that a deliverable passed human review.

## Human responses and action approval

The caller credential cannot send Eve `inputResponses`, use callback routes, assert a
forwarded identity, or access future routes. The operator credential cannot send new
model messages. No default local-development or shared admin identity is admitted.

A human reviews the actual `input.requested` event in the status output, including tool
name and input. In an operator-owned terminal with only the operator app credential,
write the exact documented Eve responses to a private file, then run:

```sh
node client.mjs respond --url http://127.0.0.1:2000 --session wrun_RETURNED_ID \
  --responses-file /absolute/operator-response.json
```

The file is an array of Eve input responses, for example
`[{"requestId":"EXACT_PENDING_ID","optionId":"EXACT_SELECTED_OPTION"}]`.
Use the request and option IDs that Eve actually emitted. Do not invent an approval ID.
`respond` uses documented `ClientSession.respond`. The root `conquistador jobs` wrapper
does not expose this command. Missing human approval leaves the action parked. Executor
must still authorize the exact upstream action; Eve approval alone grants no additional
upstream rights. The operator secret must never enter the coding agent environment.

## Development and evidence

```sh
bun install --frozen-lockfile --ignore-scripts
npm run check
npm test
bun run build
```

Policy tests use labeled synthetic credentials and inputs. They exercise denial rules,
owner binding, safe URLs, and preparation. Native import/build checks use the published
package without paid model calls or third-party writes. The explicit smoke command
`node test/native-smoke.mjs /absolute/prepared-app` starts and stops that built app
on loopback with synthetic app tokens and no provider credentials. It checks native
SDK inspection, denied caller approvals, missing-session responses, and absent callback
routes without creating a job. Run it from this source package after building the
prepared app. These checks do not demonstrate
live Executor connectivity, model quality, approval through a live session, or production
recovery. Keep `.eve/`, `.output/`, dependencies, and private prepared apps out of Git.

## Official API references

These were checked against npm `eve@0.55.0` and current official documentation. Installed
`node_modules/eve/docs/` is authoritative for this pin when eve.dev advances.

- [Getting started](https://eve.dev/docs/getting-started.md)
- [Built-in tools](https://eve.dev/docs/concepts/built-in-tools.md)
- [MCP connections](https://eve.dev/docs/connections/mcp.md)
- [Dynamic connection identity and recovery](https://eve.dev/docs/guides/dynamic-capabilities.md)
- [Authentication and session ownership](https://eve.dev/docs/guides/auth-and-route-protection.md)
- [Client SDK](https://eve.dev/docs/guides/client/overview.md)
- [Durable continuation](https://eve.dev/docs/guides/client/continuations.md)
- [HTTP routes and human responses](https://eve.dev/docs/channels/eve.md)
- [Self-hosting](https://eve.dev/docs/guides/deployment/self-hosting.md)
