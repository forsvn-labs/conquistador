# Runtime host embedding

`runtime-host.ts` exports `createOpenseoRuntimeHost`. Importing it performs no
network request. It maps the runtime's `signals.pull-bounded` operation to the
catalog's `openseo.get-serp-results`, with one exact project/target, location,
language, and explicit credit/cost ceilings.
There is no arbitrary URL, provider method, or account selected by model text.
The catalog input and output schemas remain enforced by Gateway.

Use Node 24 from the extracted distribution root. This import check needs no
credentials and makes no provider call:

```bash
node -e 'import("./catalog/examples/runtime-host.ts").then(m => console.log(typeof m.createOpenseoRuntimeHost))'
```

An embedding application must supply real reviewed catalog evidence and a current
host connection. The shipped catalog may have no supported cell for the desired
operation; in that case Gateway returns a blocked receipt. Do not promote evidence
or use a fixture connection to make the example execute.

```typescript
import { createOpenseoRuntimeHost } from "./catalog/examples/runtime-host.ts";
import { buildService } from "./runtime/lib/service.js";

// These values belong to your embedding host, not to a chat request.
const { operationBridge, receipts } = createOpenseoRuntimeHost({
  catalog: reviewedCatalog,
  candidateBuildId: exactCandidateBuildId,
  connection: activeOpenseoConnection,
  projectId: allowedProjectId,
  target: allowedTarget,
  locationCode: approvedLocation,
  languageCode: approvedLanguage,
  maximumCredits: approvedCreditCeiling,
  maximumCost: approvedCostCeiling,
  transport: approvedExecutorTransport,
  resolveConnection: (reference) => hostConnectionStore.resolve(reference),
});
const service = buildService({ config: runtimeConfig, operationBridge });
// Start service.server using your application's existing listener lifecycle.
// Archive receipts.list() with your host's durable receipt storage policy.
```

`activeOpenseoConnection` is the typed catalog `ConnectionReference`: it binds
provider, exact account/workspace principal, environment, revision, scopes, and
allowed operation IDs. `hostConnectionStore.resolve` returns the typed
`HostConnectionResolution`, including current authority and a credential from the
host secure store. Runtime inputs and artifacts never receive that credential.
The resolver must honor revocation; Gateway rechecks authority, cancellation,
deadline, and idempotency after resolution. The host must review account and scope
selection and provide its real existing connection implementation. No resolver or
credential is invented here.

The runtime writes and fsyncs a dispatch intent before host preparation. A terminal
receipt projection records status, request digest, catalog receipt digest, and
Gateway-redacted output. The complete typed receipt stays in the host receipt store.
Artifact envelopes bind the catalog receipt digest and status. Pending, unknown, or
interrupted dispatch pauses at `awaiting-operation-reconciliation`; restarting or
omitting the bridge does not repeat it. The host must inspect provider state and
retain the full receipt. There is no automatic reconciliation/reset API in this
slice; do not delete dispatch records to force a retry.

Consequential and prohibited operations always return handoffs. A runtime observe
step cannot map to a draft operation. Steps behind an existing action gate retain
the operator flow, including its separately attested receipt, and do not dispatch
again through this bridge. Other explicitly bound draft steps retain the same
persistent replay protection. Missing bindings preserve the existing handoff.

Synthetic tests establish dispatch gating and crash behavior only. They do not
establish live support, provider correctness, or release evidence.

The approved first-live scope is the OpenSEO SERP, Search Console, and Analytics
reads. This example is a construction contract, not permission to run them.
`approvedExecutorTransport` is your existing host implementation of
`ProviderTransport` backed by the approved Executor MCP/API/GraphQL path. The
example supplies no alternate HTTP transport, credentials, or Executor client.
Keep secret custody and dispatch receipts in that host; propagate the provided
signal and deadline through Executor. A future live run still requires its own
exact candidate evidence and operator authorization.

To use another approved OpenSEO read, replace the single binding with the exact
operation and input mapping below. Do not bind the same runtime operation twice.

| Catalog operation | Required host-selected input |
| --- | --- |
| `openseo.get-serp-results` | `projectId`, `target`, `locationCode`, `languageCode`; positive finite credit ceiling |
| `openseo.get-search-console-performance` | `projectId`, `domain`, `startDate`, `endDate` |
| `openseo.get-google-analytics-organic-landing-pages` | `projectId`, `propertyId`, `startDate`, `endDate` |

Date windows are exact ascending calendar dates. The mapped connection must allow
that exact operation and its scopes; a missing Analytics connection is not a zero
result or successful observation. Preserve the catalog's typed unknown outcome.

Host ceilings cannot widen playbook budgets. A host cost ceiling greater than the
remaining run cost returns a handoff before connection resolution; canonical
zero-cost playbooks therefore do not dispatch paid bindings. Per-operation units
are accumulated across steps. Measured usage, including a provider's reported
budget overage, is charged once before artifact persistence. Unknown usage is
stored as null with `usageKnown: false`, and the run marks cost incomplete and
pauses reconciliation. A terminal status alone does not establish zero cost.
