# Context and behavior review

Reviewed 2026-10-23 against source commit `51944f9b84d18ee38899ded44babb4091e41ace1`.

Conquistador can mistake an engineering task about outreach for a request to write outreach.
It then requires marketing files and can block completion until the host reads them.
This is reproducible in the source. The problem starts before the model generates its answer.

The highest-value change is one shared decision about whether guidance applies, followed by
guidance sized to the requested result. Adding more keywords or shortening the hook text alone
will not fix the behavior. Keep the methods, but stop treating a topic match as an instruction
to run a method.

## Scope and evidence

This review covers prompt admission, command and play selection, retrieval, context packing,
plugin prompt and stop hooks, edit-hook eligibility, proactive advice, the parent skill,
MCP instructions, and the public app API. It follows the behavior path through the backend.
It is not a complete security or correctness audit of the separate execution runtime,
OAuth, provider dispatch, installation transactions, or the hosted deployment.

The [audit script](behavior-review-2026-10.mjs) calls the actual selectors, spawns the Codex
plugin hook, exercises a prompt-to-stop sequence, and calls the public app API.
The [recorded output](behavior-review-2026-10.json) contains synthetic prompts and measured
UTF-8 bytes. It contains no user transcripts. The script isolates configuration and removes
its temporary files. It does not call a model or provider.

Run from the repository root:

```sh
node docs/behavior-review-2026-10.mjs
node docs/behavior-review-2026-10.mjs --strict
```

The first command records current behavior and exits successfully if execution succeeds.
At the reviewed baseline, the strict command exited 1. The implementation below now passes it. It checks the proposed admission expectations,
disabled-profile behavior, and unrelated-task stop enforcement. Those failures are findings,
not a claim that the product has been fixed. It does not judge the quality of generated work.

Thirteen prompts produce five admission failures against the proposed expectations.
That is a small, deliberately adversarial sample, not a production error rate. Product-spec
selection is also wrong in this sample, although its admission check passes.

## Findings

### 1. High: fallback selection overrides an off profile and excluded text

In [createBrief](../tools/brief.mjs), `selectRequestContext` runs first. When it abstains,
the briefing engine can still continue on business vocabulary or a named platform.
It runs lexical selection against the original task text, without the clause exclusions
used by [requestClauses](../tools/request-text.mjs).

Confirmed cases:

- `activation: off` produces `activation-off` in the selector, but `brief` in the briefing engine.
- `Do not write cold email copy` produces outreach and copy commands with ten required files.
- A fixture containing the quoted text `write a cold email` produces nine required files.
- `Help me engineer a mail outreach system` first abstains, then selects outreach.

The separate `CONQUISTADOR_HOOKS=off` switch still suppresses the plugin hook. The defect is
the loss of the selector's policy decision inside `createBrief`, not failure of every off switch.

Make disabled and explicitly excluded requests final decisions. Lexical retrieval may rank
resources only after admission. Pass the same cleaned, requested clauses to each stage.
Do not use `force` to override a disabled policy or an explicit negative instruction.

### 2. High: phrase matching ignores the requested operation

[matchingMethods and finishMatches](../tools/context-selection.mjs) recognize phrases and
channel combinations. The technical-action check controls inferred growth diagnosis, but
does not veto normal phrase matches or channel selection.

`Implement the API handler for cold email retries` directly selects outreach. This does not
depend on the fallback defect. The [app API](../api/index.mjs) returns the same command through
`conquistador_brief`, so fixing only plugin hooks would leave the app behavior wrong.

Admission must distinguish the requested result from its subject. Engineering a sender,
writing a message, planning a campaign, and defining a product experience are different jobs.
Do this per requested clause so a mixed task can retain its legitimate marketing part.
Do not reject every prompt that mentions an API. Marketing copy about an API remains valid.

### 3. High: an inferred match can block an unrelated answer

[onPrompt](../hooks/conquistador-hook.mjs) saves the selected files as required reads.
`onStop` returns `decision: block` when a scoped transcript lacks complete reads.
The audit reproduces that block after the engineering-only request. The second stop is silent,
which confirms the existing one-correction limit.

This is intended enforcement in the current [product contract](PRODUCT-CONTRACT.md), but
incorrect admission turns it into an unrelated-task blocker. A full-file read proves that
bytes reached a tool result. It does not prove that the method applies or improves the answer.

For automatic guidance, use an advisory result and let the host reject it as irrelevant.
Reserve strict read enforcement for a deliberately selected workflow with that requirement.
Keep existing protections for transcript scope, recursion, failed reads, and unavailable files.
Do not weaken evidence checks to make false positives disappear.

### 4. High: context size follows the command, not the task

[createBrief](../tools/brief.mjs) promotes the primary command's entire Core list into required
reading. Core files bypass both checks in the ordinary `take` budget guard. Method membership
also earns a score bonus, and some files qualify without a lexical match.

The engineering request selects eight files containing 27,444 source bytes. Its full pack is
34,438 bytes. A one-line subject edit gets the same eight-file requirement and a 34,481-byte
pack. The GTM strategy sample selects twelve files and a 116,426-byte pack.

The hook itself injects a shorter reading list. For the engineering request this is about
4 KB on this checkout. The larger cost occurs when the host obeys the reading requirement
or calls the brief tool. Paths affect hook byte counts. Bytes are not model tokens.

`compact` returns a smaller first response, but still requires six separate Core reads for
the outreach sample. It reduces initial response size without establishing a smaller total
task context. Its MCP parameter description also says Core files are inlined, while the
implementation defers them to required reads.

Separate small edits, explanations, decisions, deliverables, and full workflows. Give each a
bounded initial selection. Split long command documents into a short entry and stage resources.
Enforce one total budget over command text, principles, project context, and selected resources.
Use file sections or small standalone rules when a task needs one constraint.

### 5. Medium: repeated prompts reload the same obligation

Each nonempty prompt clears the prior plugin state and computes a new reading list.
The audit gets identical context for the same prompt twice in one session. The read guard
checks the current task, so a complete earlier read does not establish current coverage.
The proactive helper explicitly has no deduplication or rate limit.

Resetting enforcement on a new task protects unrelated work. Keep that protection. Track
resource reuse separately from task enforcement. A reuse record needs resource identity,
digest, selected stage, and a host context boundary. Invalidate it after compaction or when
the host cannot confirm that the content remains available. A disk marker alone cannot
prove that the model still has the file in context.

### 6. Medium: two hook systems have different activation and enforcement rules

Native plugin manifests register [prompt, edit, and stop hooks](../hooks/README.md).
They run unless disabled through the plugin hook switch. The separate
[proactive helper](../tools/proactive.mjs) requires an explicit configuration and uses
`selectRequestContext` directly. Its enabled before-delivery event returns static advice
without checking whether the task is marketing work. The audit confirms two instruction
strings with no prompt supplied.

[PROACTIVE.md](PROACTIVE.md) describes opt-in behavior for that helper. It does not describe
the native plugin defaults. The product contract describes native enforcement. These are
different mechanisms, despite their similar names. If both are registered, both can run.
This review did not inspect Hung's host registration, so duplicate installation is a risk,
not a confirmed explanation for his exact session.

Use one policy and one event owner. Status should identify each active source, effective mode,
and exact disable action. Session-start and stop events should stay silent without an active,
relevant task. Check for duplicate registrations during installation and repair.

### 7. Medium: product requests can become copywriting requests

`Draft a product requirements document for an outreach system` selects the outreach command,
not a product-spec workflow. This is distinct from unwanted activation. The task belongs in
Conquistador's intended scope, but it receives the wrong method.

Preserve product work while tightening admission. Route by requested artifact and stage.
For a product specification, select the product experience method and include only relevant
outreach constraints. A full sequence-writing package is not a substitute for requirements.

For an outreach system, suppression, unsubscribe handling, sender identity, approval rules,
and measurement definitions can be useful product constraints when requested. Backend retry
code alone should not trigger a campaign or copywriting workflow.

### 8. Medium: global instructions promote process on every matching topic

The [MCP server instructions](../tools/skills-mcp.mjs), [parent skill](../skills/conquistador/SKILL.md),
brief header, and hook reading list repeat requirements to read, check, score when applicable,
and list applied playbooks. The skill setup prefers another MCP brief even when a hook already
supplied a reading list. The hook calls its selection an exact task match without calibrated
confidence evidence.

These instructions help make method use visible, but create multiple reasons for the host to
expand a narrow task. The parent skill has a small-edit exception. The automatic brief does
not carry an equivalent task-size decision.

Put a short scope rule in global metadata. Put task-specific guidance in one selected result.
Return provenance in structured data, and mention it in the answer only when it helps review
or the user requests it. Preserve rules against invented facts and unauthorized actions.
Changing mandatory attribution requires an intentional product-contract update.

### 9. Medium: edit-hook eligibility uses file shape instead of task scope

[isMarketingFile](../tools/check/channels.mjs) classifies `outreach/architecture.md` and
`admin/index.html` as marketing files. The audit confirms these classifications.
The [edit hook](../hooks/check-hook.mjs) does not require a currently admitted marketing task.
It emits context only when the checker finds counted findings, so classification alone does
not establish that those two files always produce an injection.

Technical documents outside the excluded documentation folders and internal HTML screens
can therefore receive marketing advice. Require an admitted task or an explicit file/channel
declaration for automatic checking. Keep manual `conquistador check` available. Preserve the
existing duplicate-finding suppression.

## Proposed behavior contract

Conquistador should be quiet when it cannot identify a requested business or product result.
The host still answers the user normally. An explicit invocation should select a method or
report a mismatch, not force weak lexical matches into a workflow.

Use four decisions with explicit reasons:

1. `none`: unrelated work, excluded work, disabled policy, or uncertain automatic relevance.
2. `assist`: one small edit, definition, or bounded decision with a few relevant rules.
3. `command`: one requested deliverable with its current-stage method and checks.
4. `workflow`: a requested multi-stage outcome with only the current stage expanded.

For the supplied engineering example, the automatic decision is `none`. If the user asks for
business requirements, use `assist` or the product-spec command. If the user asks for a cold
email sequence, use outreach. If the user asks for a campaign, use the appropriate workflow.

Suggested starting budgets are 1,500 characters for an automatic hook, 4,000 UTF-8 bytes for
initial assistance, and 16,000 UTF-8 bytes for a command's initial context. Treat these as
design targets to evaluate, not measured optimal limits. Larger material remains available
through explicit stage expansion. Do not truncate essential rules and call the result complete.

## Implementation order

1. Fix admission first in `request-text.mjs`, `context-selection.mjs`, and `brief.mjs`.
   Preserve hard exclusions and the off profile. Separate operation from topic, and preserve
   mixed-task clauses. Use the same decision for plugin, proactive, CLI, MCP, and app calls.
2. Change automatic hooks to advisory behavior. Scope stop and edit events to an admitted task.
   Unify effective configuration and registration diagnostics before adding more hook options.
3. Refactor resource metadata and command entries for task size and stage. Remove Core budget
   exemptions. Carry reasons, estimated bytes, selected rules, and deferred resources in data.
4. Add context-aware reuse and explicit invalidation. Align tool descriptions, skill text,
   native hooks, proactive docs, and the product contract with the new behavior.
5. Evaluate task quality before release. Keep the existing library and compare useful results
   with and without the new selection policy. Do not replace the library with generic advice.

Do not add a separate model call to every prompt as the first fix. That adds latency and cost
before the shared admission contract is correct. Start with explicit intent, conservative
automatic admission, and host judgment on ambiguous cases. Revisit model routing only if a
labeled evaluation shows that it solves a remaining problem.

## Acceptance and verification limits

The candidate must pass the strict audit and preserve the positive marketing examples.
Extend it with requested product-spec selection, mixed-clause boundaries, small-edit budgets,
off/manual/project modes, domain restrictions, duplicate installations, long prompts, quoted
examples, multilingual requests, resource changes, and host compaction. Check behavior through
all public entry points, not only the lower-level selector.

Before changing code, add failing cases at those boundaries. Compare initial and total context
bytes, tool calls, repeat injection, selection precision, and missed relevant methods. Use a
fixed task set. Have a human judge usefulness, factual discipline, method application, and scope.
Read receipts and rubric arithmetic cannot establish those outcomes.

Existing focused tests passed, 83 tests across these six files:

```sh
node --test tools/conquistador-hook.test.mjs tools/context-selection.test.mjs \
  tools/proactive.test.mjs tools/skills-mcp.test.mjs tools/hosted-brief.test.mjs \
  tools/conquistador-mode.test.mjs
```

These tests confirm useful protections, including transcript scoping, one-time correction,
protocol handling, and hosted briefing behavior. They did not catch the new cross-layer cases.
The local run used Node v26.9.0, not the documented Node 24 baseline. No native host session,
installed-package version, live hosted deployment, or model quality was certified by this review.
Production behavior is unchanged. This report and its reproducer are the review deliverables.


## Implementation candidate

Draft PR #86 implements the review across the shared selector, brief engine, native hooks,
project helper, and app tools. It changes automatic enforcement to advisory guidance and adds
short command entries. Detailed procedures and the full library remain available on demand.
The [candidate output](behavior-review-2026-10.after.json) uses the same thirteen requests with
an explicit project profile for automatic-hook checks. The baseline JSON remains unchanged.
The updated script also verifies read-based reuse, transcript rotation, and resource changes.

Both global off and an off profile remain final. Manual is the installed default. Explicit
project-hook enablement is a supported opt-in for automatic advice without editing managed
package files. Status distinguishes configured activation, effective advice, observed event
sources, and possible duplicate registration. Native registrations outside project settings
remain host-managed and are not claimed as inspected.

The total public tool result includes provenance within its budget. Assistance uses 4,000 bytes,
compact commands use 8,000 bytes, and commands and workflows use 16,000 bytes. Full resources
are included only when they fit. Deferred resources do not become required reads. Oversized
caller context remains with the caller and receives an explicit status.

Verification is local and deterministic. No model quality, native host activation, deployment,
or production audience outcome is established. STATUS.md owns current check and release state.

### Candidate verification

The implementation source is `a59ce1d`. The repeatable strict audit above passes all thirteen
requests and verifies reuse, transcript rotation, and changed-resource invalidation. The
engineering outreach request emits zero guidance bytes. In this fixed audit, cold outreach
brief text falls from 34,481 to 7,221 bytes; the subject-line edit uses 1,676 bytes. These are
context measurements, not model quality or latency measurements.

Run these source checks from the repository root:

```sh
node tools/dev.mjs build
node tools/dev.mjs test
node tools/e2e/routing-breadth.mjs
node tools/e2e/check.mjs
node tools/e2e/social-style.mjs
node tools/e2e/app-integration.mjs --installer bun
node tools/e2e/installer.mjs
```

The routing runner now uses the current launcher's `nextStep` API and the command reference,
rather than the retired task picker and the shortened README. Installer staging copies shared
advice dependencies once across compact, plugin, and single-agent packages.

The installed Bun consumer report records clean source `a59ce1d` and tarball SHA-256
`852414a1699c650cc3743b0a653b0a0a9419a7a05896a217947f1cc4daccad7b`.
All 38 checks pass, including public imports, MCP clients, caller isolation, receipts, and strict
TypeScript use. The local reports under `dist/e2e/` are regenerated by the commands above.

The Node 26 installer run hit an internal runtime error while copying its hosted fixture,
which also left the next scenario without that fixture. Both affected scenarios (`offline`
and `hosted`) pass when rerun with Node 24. The eighteen focused behavior and routing tests
also pass on Node 24. Native client delivery and human task-quality comparison remain release
acceptance work; no provider or external account was used to simulate those results.

Final source validation passes 969 tests: 445 tools/operator tests, 294 runtime tests,
167 catalog tests, and 63 evaluation-contract tests. Build, catalog validation, and the local
evaluation example pass. Routing passes 142/142, checker E2E 44/44, and social-style E2E 15/15.
The broad installer run passes 64/67; the third failure is `update` (exit 1), which also passes
in an isolated Node 24 rerun. The broad installer run began before the final source commit;
its mixed-run evidence is not a clean 67/67 certification of that commit. Before release, run
the full installer suite on the supported Node 24 runtime with unchanged source.

### Release preparation

The 0.10.0 candidate also corrects `tools/entrypoint/SKILL.md`, the template used by staged
installations. Its old mandatory Core reads and appendix could override the bounded brief.
A failing installed-entry regression test was added before this correction; all 40 targeted
installer, integrity, and installed growth-workflow tests then pass. The parent method version
is 3.1.0. Product, native plugin, host, portable-role, and CLI-alias versions are 0.10.0.
