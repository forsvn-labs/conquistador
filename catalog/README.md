# Conquistador Founder Tool Catalog

This optional public module defines narrow provider operations, a shared
adapter contract, a deny-by-default gateway, and immutable redacted receipts.
It never enters Portable Plugin activation. Skills request declared capability
IDs; they cannot reach credentials, raw HTTP, MCP methods, shell commands, or
vendor SDK methods.

Catalog presence is not support. Verification advances per operation through:

```text
unknown → cataloged → researched → fixture-verified → live-verified → supported
```

Provider onboarding is demand-driven and operation-level. A closed
`conquistador.provider-onboarding/v1` record binds one versioned playbook step,
one requested outcome and capability, one exact operation and budget snapshot,
one support cell, durable owners, and a fail-closed failure policy. Its canonical
demand digest covers every demand field plus the exact requested operation.
Onboarding records promote one step at a time and cannot drift identity, demand,
budget, ownership, failure policy, or prior proof.

Demand and research digests use canonical object ordering. Authentication scopes
and each official-source group are sets: ordering is immaterial, while additions,
removals, and substitutions change the binding. Evidence must be chronological
from demand through research, fixture proof, receipt completion, live human
acceptance, release-matrix check, and support human acceptance.

Research must separately identify official API, terms, and authentication HTTPS
sources. It establishes only `researched`. Fixture promotion needs exact catalog
support evidence. Live promotion needs an exact candidate-bound, succeeded,
redacted, terminal receipt plus separate human supervision. Support additionally
needs an exact release-matrix cell, platform, architecture, and human acceptance
while the failure state is clear. Documentation, login, resolver success, or
earlier proof cannot establish a later stage. Each record advances independently;
there is no provider-count target or all-providers gate.

Live and support acceptance each carry `authenticatedHuman: true` plus a
non-empty authentication method; identity-string naming conventions are not a
security boundary. A separate immutable failure transition may assert
`blocked`/`degraded` from `none` or explicitly clear either state back to `none`.
It cannot change maturity, identity, demand, operation, proof, owners, fallback,
or retry policy. Maturity promotion remains forbidden while failure is asserted.

The public Search Console onboarding fixture is deliberately only `cataloged`.
It records demand from `playbook:content-intelligence-loop@1.0.0` step
`pull-signals`, the exact existing operation snapshot, the recorded next-proof route, and a human-action
manifest fallback. It adds no research, credential, connection, live proof, or
support claim.

The GitHub, Google Analytics Data, Search Console, PostHog, Semrush, and
Typefully adapters are fixture-verified catalog candidates. Their live proof remains unrun.
They are not advertised as supported; fixture checks grant no release acceptance.

The v1 release-blocking provider family is OpenSEO, limited to three exact
operations:

| Operation | Release boundary |
|---|---|
| `get_serp_results` | Bounded SERP/competitor signal; metered. A provider call alone is not accepted live proof. The receipt must bind the selected candidate and exact request, prove usage stayed within the credit ceiling, and receive authenticated human acceptance. |
| `get_search_console_performance` | Read-only owned search-performance signal; no OpenSEO credits. A successful call remains unqualified until its redacted receipt binds the selected candidate and receives authenticated human acceptance. |
| `get_google_analytics_organic_landing_pages` | Read-only owned outcome signal; no OpenSEO credits. `ga4_not_connected` is a typed unknown, not success. A successful call remains unqualified until its redacted receipt binds the selected candidate and receives authenticated human acceptance. |

Executor attempt records are private raw receipts under the ignored
`.conquistador/g4-live/` root. The durable exporter never embeds those records,
request values, response summaries, project IDs, keywords, site properties, or
provider URL paths. It retains only candidate/source identities, operation IDs,
cryptographic digests, bounded counts and credit usage, and stripped HTTPS
origins. Human acceptance remains a separate authority.

Typefully and all external publishing remain a human action manifest for v1
until playbook demand justifies live provider support. No provider operation may
be described as `supported` until its exact operation-level live proof and the
normal evidence promotion are complete. G4 remains unpassed and the release
remains `NO-GO`.

| Provider | Exact 1.0.0 operations | Deliberate limits |
|---|---|---|
| GitHub | repository get; release list; issue list; bounded signal aggregate | REST `2022-11-28`; pages at most 100; aggregate scans at most 100 issues and 100 releases |
| Google Analytics Data | `runReport` | 10,000 rows per request; 4 date ranges; 9 dimensions; 10 metrics |
| Search Console | search analytics query | allowlisted dimensions; 25,000 rows per request; 50,000-row traversal ceiling |
| PostHog | insight read; analytical query | fixed US/EU origins; Trends, Funnels, and Retention query kinds only; no HogQL |
| Semrush | v4 keyword metrics | one keyword, one row, exact 20-unit pre-dispatch ceiling; no generic report endpoint |
| Typefully | draft list; external X draft; exact schedule; exact publish | 50-row pages; four media IDs; schedule/publish require manifest-bound authenticated approval; publish uses one create plus at most three terminal-state polls |

`typefully.post.delete` remains cataloged as prohibited and has no adapter,
fixture promotion, live-proof route, or support route. There is no arbitrary
HTTP, MCP, shell, delete, billing, account-management, audience-upload,
unbounded-spend, spam, or silent-publish operation.

The frozen FOR-149 six-provider matrix is
`fixtures/v1/six-provider-matrix-v1.json`. It records 13 fixture-verified
operations plus the prohibited Typefully delete. Every live cell is `not-run`
and every support claim is `forbidden`. Ordinary `Gateway.execute` stays
`unsupported` (or `prohibited` for delete). Live verification needs operator-supplied opaque Connection references, exact targets,
applicable provider/spend approval, and authenticated review of observed evidence.
Approval for OpenSEO does not authorize other provider cells.

Each research evidence digest is the canonical SHA-256 of
`{ operationId, officialSources, checkedAt, providerApiVersion, provenance }`.
Later lifecycle stages must add their own fixture, candidate-bound terminal
receipt, and release-matrix evidence; research digests cannot promote support.

## Public development and conformance

Use Node 24. The default suite uses included contracts and local fixtures:

```bash
npm ci --ignore-scripts
npm run typecheck
npm test
npm run catalog:check
node src/cli.ts onboarding check --file fixtures/v1/onboarding/search-console.analytics.query.cataloged.json --catalog operations/v1.json
```

`test:public` names the same default suite. `test:source` retains the historical full-source
suite, including private candidate/G4 checks where available. `candidate:build`, fixture/matrix
maintenance, and `lint:for-149` belong to that private maintainer setup and are not required by this
public checkout. The private lint plugin and evidence authority are not bundled; do not fabricate
them to make a historical gate pass. Default build and tests do not require them.

The CLI exposes only catalog, adapter, extension, onboarding, and receipt conformance commands. There
is deliberately no generic `run`, URL, method, MCP, shell, send, or publish
command. Live execution must enter through the gateway API with a declared
operation, scoped Connection reference, exact budgets, and—when
consequential—one authenticated, digest-bound, expiring human approval.
Consequential execution also requires a host-owned `verifyHumanApproval`
callback; self-asserted approval data is denied when that verifier is absent.

Credential material is injected only by a host-resolved Connection reference.
It is never accepted in a capability request, captured in a fixture request, or
included in a result, error, evidence record, or receipt. The fetch transport
allows only the six exact provider origins, rejects redirects and arbitrary
paths, caps response bodies, and exposes only safe response headers.

Live proof is a separate candidate-verification mode, not a support bypass.
The candidate command emits a reproducible record binding one exact Git
commit/tree, raw catalog and fixture bytes, all committed Tool Module files,
adapter version, provider API versions, and operation inventory. The record is
a Tool Module proof candidate; it is not a complete product release candidate. `createLiveVerificationGateway` verifies that full record, an
explicit operation allowlist, matching adapter version, and prior fixture
evidence. Ordinary gateway calls continue to reject every unsupported cell.
Only a succeeded, redacted, terminal receipt can become live evidence;
consequential receipts additionally require approval, manifest, and payload
digests. A later release matrix is still required before support.

Receipts contain hashes, non-secret principals, provider correlation IDs,
bounded usage, safe excerpts, and terminal attempt state. They never contain
credentials or unnecessary personal data and cannot grant semantic memory or
release authority.

## Legacy compatibility identifiers

`FOR_149_*`, `For149ProviderId`, `conquistador.for-149-six-provider-matrix/v1`,
`roadmapDestination: FOR-149`, the legacy status literal
`deferred-missing-hung-credentials` (meaning operator credentials are unavailable),
and the G4 historical-owner identifier remain exact
protocol and stored-record compatibility values. They do not depend on access to a
private issue tracker and do not confer approval. Current local fixtures describe
fixture assertions only; revised descriptive text does not revalidate historical
receipts, promote provider support, or bind a new release candidate.

Current operation-description digests identify the maintained metadata snapshot. Editing provenance
text changes that digest; it does not repeat source research or revalidate a historical execution.
Existing check dates and fixture assertion identities remain historical metadata. A new candidate
and observed terminal evidence are required for any later live or support claim.
