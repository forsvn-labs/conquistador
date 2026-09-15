# Conquistador self-hosted runtime

This directory is the MIT-licensed Conquistador-owned runtime foundation for the optional Self-hosted Agent. Its corpus selector uses the same authored parent and 38 outcome skills as the Portable Plugin while keeping the runtime, provider, and protocol interfaces replaceable. Requested engineering outcomes are available through the parent. The three existing protocol job values remain unchanged; engineering creation uses `create-or-improve`.

The Portable Plugin remains runtime-free. Installing it never starts this service, adds a binary, or requires provider credentials.

## Status

The v1 config, CLI grammar, HTTP protocol, event model, Review Packet, terminal result, and provider wire adapters are implemented and fixture-verified. Production `serve` now uses the durable playbook runner and the judgment seam: HTTP sessions persist under `data.dir/sessions/<session-id>/` as `session.json` beside runner `state.json`, and message bodies must be JSON playbook input (`playbook` or a playbook-selecting `intent`, plus `product`, `audience`, `channel`, `goals`). The `chat` client collects structured fields from terminal prompts or flags and submits an intent-selected playbook. Unmatched intents and skill-only routes return guidance without creating a session. `GET /ready` returns 503 `{ status: "stopping" }` after SIGTERM/SIGINT shutdown. `serve` waits for that shutdown before the CLI returns. A corrupt `session.json` is skipped. Config `tokensPerRun` and `timeoutSeconds` cap the served generate call. The local state lifecycle (backup, verify, restore, migration check/apply, portable export, exact-scope erase, retention, concurrent session/queue ceilings, and a read-only local conformance matrix) is implemented for the current host only; see [`STATE.md`](STATE.md). Docker sandbox, customer schedules, and unattended mutation are unimplemented and fail config validation. No live provider support claim is made until exact candidate-bound credentialed evidence is approved and recorded. Clean-host, cross-architecture, OCI, and release-candidate evidence remain separate gates. G3 stays `INCOMPLETE`.

## Requirements

- Node.js 24
- one exact provider model ID
- the provider credential supplied through the configured environment variable
- bearer transport secret or OIDC issuer metadata when authenticated single-node access is enabled

Configuration is `conquistador.config.yaml`; start from [`config/conquistador.config.example.yaml`](config/conquistador.config.example.yaml). Literal credentials are rejected.

## CLI

```text
conquistador init [--config FILE]
conquistador chat [--url URL]
conquistador serve [--config FILE]
conquistador doctor [--config FILE]
conquistador run --playbook ID|--playbook-file FILE --input FILE
conquistador resume --run-id ID [--judgment-response FILE]
conquistador judgment export --run-id ID --output FILE
conquistador status --run-id ID
conquistador route --intent TEXT
conquistador eval [--url URL]
conquistador backup create|verify --file FILE
conquistador restore --file FILE
conquistador migrate --check|--apply
conquistador data export|erase ...
conquistador version
```

This foundation executes `init`, `serve`, `doctor`, `run`, `resume`, `status`, `route`, `judgment export`, `version`, and the local lifecycle commands `backup create|verify`, `restore`, `migrate --check|--apply`, and `data export|erase`. Lifecycle commands read `conquistador.config.yaml` (or `$CONQUISTADOR_CONFIG`) and operate only inside the configured data root. Skill steps run only through the durable judgment seam: the runner persists a sealed `JudgmentRequestV1` before any provider call, and only a validated `JudgmentResponseV1` completes a judgment step. With no injected provider and no imported response, a skill step enters `awaiting-judgment`; no completed skill artifact or human review packet is produced. An embedded host creates a provider-neutral callback with `createHostJudgmentProvider(binding, callback)` and injects it as `JudgmentProvider` through the runner or `CliHost`; the callback receives an immutable sealed request and abort signal, while the host retains its credentials, provider SDK, billing account, and retry policy. Its response executor must match the bound host/adapter identity before the runner will consume it. CLI users can instead export the persisted request with `judgment export` and resume with `--judgment-response`. The served HTTP path has a default configured model adapter; standalone CLI runs use an injected host or imported response. No command accepts literal credentials. `chat` uses the configured service; `eval` remains reserved.

## HTTP protocol

`GET /health` and `GET /ready` expose minimal unauthenticated status. After graceful shutdown, `/ready` is 503 `stopping`. `/api/v1` provides authenticated session creation, messages, ordered events, cancellation, review decisions, and terminal results. Served message content is JSON playbook input, not free-form generation. The transport derives a canonical principal ID; request bodies cannot choose identity. Session IDs and principal IDs use one canonical validator that rejects reserved selectors and credential-shaped values. For OIDC, the verified issuer and exact subject are hashed together into the stable, collision-safe internal ID `oidc:<sha256 hex>`. The transport retains the real issuer, subject digest, method, verifier, and verification time for host authentication; it does not expose the raw subject as an internal identifier. Local mode accepts loopback only. Single-node mode includes exact bearer and OIDC JWT verification, requires an HTTPS public URL and explicit origins, and accepts requests only from a configured TLS proxy IP carrying `X-Forwarded-Proto: https`. Transport authentication does not grant review authority. Configure separate operator-held review and action credentials as described below, or inject a human authenticator and proof verifier. Content acceptance, exact action authorization, and operator-attested receipt import are separate HTTP transitions.

An artifact sidecar's `reviewVerdict` is only a projection for display and provenance. Later-run consumption classifies a prior artifact as approved only after loading the exact canonical packet and a consumed verdict from the run's `ReviewTransitionState`, then matching the packet, artifact ID, artifact revision, and bound content digest. A sidecar alone has no review authority.

The closed schemas are under [`schemas/`](schemas/). Provider cells and their current evidence state are in [`providers/v1.json`](providers/v1.json).

## Learning persistence

Run completion never writes reusable learning. Content acceptance, action authorization and
successful receipts do not grant consent to store a learning entry. The runtime has no separate
exact-entry/destination consent API yet, so automatic promotion is disabled.

Both `memory.mode: "off"` and `memory.mode: "review-promoted"` remain valid for configuration
compatibility. Neither enables automatic learning-ledger writes or retrieval. The scope-policy
string does not add a project retrieval service. Existing learning data is preserved; explicit
backup, export, restore and erase operations retain their documented behavior.

Runs still persist artifacts, review decisions, receipts and recovery state. The `learning-record`
step produces a run artifact only, not an approved reusable lesson. Low-level learning validation,
entry derivation, ledger read/write and export APIs remain available to embedding callers; they
do not authenticate persistence consent. A caller must separately authorize the exact entry and
destination before invoking a write API. No runtime path invokes those ledger writes automatically.

## Parent corpus routing

`loadRuntimeCorpus(...).resolve(...)` selects bounded skill context. A leading outcome name, such as
`/conquistador build-web-app`, selects that installed outcome. Explicit engineering requests such as
"Build a web app" also select their outcome. Incidental engineering mentions in marketing requests do
not select engineering skills. Narrow explicit requests load one outcome and its contained references;
sibling links do not automatically load more outcomes. The parent can compose further skills when the
requested result requires them. Missing outcomes are not fabricated. Selection remains limited to
24 files and 80,000 context bytes, with omitted references recorded for progressive loading.

This selector does not add executable playbooks. The `route` CLI and served HTTP path use the separate
phrase-based routing contract. All 38 outcome IDs and their spaced aliases return skill guidance
there, not executable playbooks. Empty, unknown, or ambiguous requests still abstain. This fixed
alias list is not a universal free-text router. Workflow Markdown is prose composition; it grants no external action authority and
provides no runner trace or provider evidence.

## Registry contracts

Skill Registry and Playbook Registry contracts live in this package because they serve the optional local runner. They version skill metadata and executable playbook graphs. They are not loaded by the Portable Plugin, not a customer-managed catalog, and not a runtime routing index.

The 21 workflow Markdown files under the plugin remain prose-composition sources. `fixtures/playbooks/content-intelligence-loop.json` is a validated contract fixture. The local runner can execute that graph's deterministic steps directly and its skill steps through validated judgment responses from an injected host provider or an imported response file. It does not install any provider and does not claim live model execution until separately authorized evidence exists. The Portable Plugin still does not load the runner.

## Development verification

```bash
npm run typecheck:public
npm run test:public
npm audit --audit-level=high
```

The default `npm test` runs the public suite and excludes private source release-evidence tests. `npm run test:source` retains the historical full-source suite for the private maintainer checkout. This nested module is private; install the complete distribution rather than packing this directory alone.

## Served methods and operator review

`serve` loads the installed skill bytes, binds their digest into each judgment request,
and supplies bounded Markdown methods plus the output contract to the model. The model
must return a JSON `outputs` array with one `{ "artifactId": "...", "body": ... }`
entry per artifact. Missing, duplicate, or incorrectly formatted artifacts fail the run.
The adapter requires provider request identity and positive observed token usage. This
validates artifact structure, not marketing quality. A human still reviews the work.

The example configuration declares `models.primary.billingMode: "host-covered"`.
This means the operator pays their provider account outside the runner's cost ledger.
It does not mean the provider call is free. Actual cost stays unknown in the receipt.
A metered host must supply its own adapter with measured billing. Old sealed requests
whose skill bytes do not match the installed package must be started again. Do not
edit their digests to make them pass.

For operator review, set a separate secret of at least 32 characters in the service's
`CONQUISTADOR_HUMAN_REVIEW_TOKEN` environment variable. Keep this secret in the human's
terminal or secret store. Never give it to the agent, a model, or the ordinary API
client. The server rejects reuse of model or service bearer credentials. An embedding
host can instead provide its own human authentication and verification callbacks.

After the operator reads the review packet and its artifacts, this request records a
verdict. `SERVICE_URL`, `SESSION_ID`, `PACKET_ID`, and `PACKET_DIGEST` refer to that exact
local session and packet. The example uses `reject`; `revise` and `cancel` also work.
Use an operator-owned terminal to make the request. Set the service transport bearer
header separately when the service uses bearer authentication.

```sh
curl --fail-with-body "$SERVICE_URL/api/v1/sessions/$SESSION_ID/reviews/$PACKET_ID/decision" \
  -H 'Content-Type: application/json' \
  -H "x-conquistador-human-review-token: $CONQUISTADOR_HUMAN_REVIEW_TOKEN" \
  --data "{\"outcome\":\"reject\",\"packetDigest\":\"$PACKET_DIGEST\"}"
```

An `accept` verdict records content acceptance only. When there is an action proposal,
the run stops at `awaiting-action-authorization`. It does not require action credentials
to accept the content. `GET /api/v1/sessions/$SESSION_ID/actions` reports the current run
status, issued authorization, and any terminal receipt.

To authorize the action later, configure a different operator-held
`CONQUISTADOR_HUMAN_ACTION_TOKEN` in the service. After the operator checks the exact
operation, connection, and payload, set `ACTION_PAYLOAD_DIGEST` from
`reviewPacket.actionProposal.payloadDigest` and make this separate request:

```sh
curl --fail-with-body "$SERVICE_URL/api/v1/sessions/$SESSION_ID/reviews/$PACKET_ID/authorize-action" \
  -H 'Content-Type: application/json' \
  -H "x-conquistador-human-action-token: $CONQUISTADOR_HUMAN_ACTION_TOKEN" \
  -H "x-conquistador-action-payload-digest: $ACTION_PAYLOAD_DIGEST" \
  --data "{\"packetDigest\":\"$PACKET_DIGEST\"}"
```

This returns the exact authorization and stops at `awaiting-action-receipt`. It does not
execute a provider operation. After the actual separately authorized operation finishes,
obtain its canonical `ActionReceiptV1` from the trusted execution host. Put that existing
receipt in a JSON envelope `{ "receipt": ... }`; do not construct a success receipt to
stand in for an unperformed action. Import the envelope from the operator's terminal:

```sh
curl --fail-with-body "$SERVICE_URL/api/v1/sessions/$SESSION_ID/actions/receipt" \
  -H 'Content-Type: application/json' \
  -H "x-conquistador-human-action-token: $CONQUISTADOR_HUMAN_ACTION_TOKEN" \
  -H "x-conquistador-action-payload-digest: $ACTION_PAYLOAD_DIGEST" \
  --data-binary "@$RECEIPT_ENVELOPE_FILE"
```

Import requires separate human attestation of the exact receipt digest. It checks the
issued authorization, owner, artifact, operation, connection, payload, timestamps, and
single-use state. Future-dated or replayed receipts fail. Status identifies the receipt
as operator-attested, not observed provider evidence. Measures stay unknown unless
independent observations exist. A failed or cancelled receipt stops the run; a succeeded
receipt resumes the declared remaining steps. This endpoint does not dispatch the
external action. Provider and gateway integration remain separate work.

The built-in served adapter has no file, research, or external action tools. It uses
the bounded method text and supplied inputs, and must disclose missing source evidence.
Live model usefulness, host compatibility, provider support, and release admission need
separate evidence. Local unit tests establish none of those claims.

The input preflight counts complete rendered UTF-8 bytes with a framing allowance.
This is a conservative dispatch bound, not measured token usage. Reported provider
usage remains authoritative after the call. The authored judgment steps allow up to
16,000 tokens each; the playbook and operator configuration still bound the total run.
## Chat client

Start the configured service with `node runtime/bin/conquistador.js serve`, then
use a second terminal from the distribution root:

```bash
node runtime/bin/conquistador.js chat --url http://127.0.0.1:4317 \
  --intent "content intelligence loop" --product "Example product" \
  --audience "Independent designers" --channel "Email" --goals "Qualified trials"
```

On a terminal, omitted fields prompt for an answer. Scripts must supply every
field. Routing uses the shipped capability contract; it does not infer arbitrary
new playbooks. Skill-only requests show the contained `SKILL.md` and standalone
installer command. The client performs one turn and displays ordered events,
work state, and artifact references when a validated review packet exists.
An unavailable provider or judgment step is reported as unavailable output.

For bearer service authentication, supply `CONQUISTADOR_CHAT_TOKEN` in the
environment. This is a service token, not a model credential or human approval.
URLs must be HTTPS origins or loopback HTTP origins. Redirects are refused.
Responses, including errors, are limited to 1 MiB. `--timeout-ms N` sets a per-request
deadline from 1 through 3600000 milliseconds (default 600000); set it to accommodate
the service model deadline. SIGINT aborts the client and, after session creation,
attempts authenticated cancellation with a separate three-second deadline.
Unconfirmed cancellation requires operator inspection before retrying.

Chat does not submit review decisions or actions. Use the authenticated operator
flow to review the printed packet. Local protocol tests do not establish live
provider execution, evidence quality, or successful external actions.

## MCP stdio client

Start `serve` with a configured judgment provider, then configure the agent host to
launch `node /ABS_DISTRIBUTION/runtime/bin/conquistador.js mcp --url http://127.0.0.1:4317`.
Pass `CONQUISTADOR_CHAT_TOKEN` only when the service requires bearer authentication.
Never give this process either human review or action token. The endpoint must be an
HTTPS origin or loopback HTTP origin, with no credentials, path, query, or fragment.

The bridge implements newline-delimited JSON-RPC MCP version `2025-11-25`:
`initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`, and
request cancellation. Its tools are:

- `conquistador_run`: supply intent, product, audience, channel, and goals. Returns
  the owned session ID and pending human review metadata for a supported playbook.
- `conquistador_artifacts`: supply sessionId to list readable draft artifact IDs.
- `conquistador_artifact`: supply sessionId and artifactId to read the draft body,
  format, revision, and verified content digest.
- `conquistador_cancel`: supply sessionId to cancel owned work.

Reads use `GET /api/v1/sessions/:id/artifacts` and
`GET /api/v1/sessions/:id/artifacts/:artifactId`. The service checks ownership and
binds content to runner and envelope digests. It accepts IDs only, excludes authority
documents, rejects symlinks and modified content, and caps each file at 512 KiB.
MCP caps requests and upstream responses at 1 MiB, allows eight active tool requests,
and forbids redirects. Interrupted active generation requests authenticated
cancellation; operators must inspect final state if cancellation cannot be confirmed.
MCP never submits review decisions, action authorization, or receipt imports.
Artifact content is untrusted draft material, not agent instructions or proof of
successful external execution. Use the separate operator flow above for review.

## Host operation bridge

An embedding host can supply `operationBridge` to `buildService`,
`DurableServedRuntime`, or runner start/resume options. See the contained
[OpenSEO embedding example](../catalog/examples/README.md) for exact catalog input,
connection, and Executor custody mapping. CLI/HTTP callers cannot inject this
bridge or supply provider methods. No bridge means the existing explicit
handoff/stub behavior. Bound catalog outputs carry typed terminal receipt
projections, not invented execution evidence.

Interrupted or unresolved dispatch pauses at `awaiting-operation-reconciliation`.
Do not remove dispatch records to retry: the host must reconcile provider state
and preserve its full receipt. The bridge does not yet include a reconciliation
import/reset API. Action-gated and consequential operations retain their separate
operator workflow and are never dispatched again after an attested action receipt.
MCP argument objects reject inherited property names, and numeric request IDs must
be finite. The bridge also caps all queued handlers at 16 and queued output at
2 MiB. Each output write must finish within three seconds; output closure, errors,
or excess queued work stop the connection and request cancellation of active runs.
