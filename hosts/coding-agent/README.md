# BB specialist adapter

This adapter runs draft assignments in fresh, visible BB child threads. The coordinator enforces
ordering, concurrency, dispatch and output limits, cancellation, result validation, integration,
exact-artifact review, at most one targeted correction, engagement briefs, and execution receipts.
It uses the existing specialist and outcome methods. Child titles use the public specialist roster.

## Run a team

Use Node 24 from a full distribution or a plugin or operator/harness install that contains this adapter.
Supply an existing BB project and environment. Create or select that environment through the host
before starting parallel workers; concurrent checkout provisioning can collide.

```sh
node hosts/coding-agent/team.mjs /absolute/local/team.json PROJECT_ID ENVIRONMENT_ID /absolute/local/new-result.json
```

`BB_THREAD_ID` must identify the current parent. The host supplies model selection, billing and
permissions. The adapter invokes the official BB CLI with argument arrays and never invokes a
provider CLI. Keep the input and result outside the installed package. The output file must not
already exist; it is reserved before any host work starts. It is private and may contain raw drafts,
evidence, and gaps. Share only a reviewed public projection, not the full result file. SIGINT and SIGTERM cancel the team and stop its known children.

A minimal plan:

```json
{
  "schemaVersion": "conquistador.specialist/v1",
  "id": "draft-launch",
  "goal": "Prepare two ad variants and aligned landing copy using only the supplied product facts.",
  "assignments": [
    {
      "id": "ads", "role": "ads", "goal": "Draft two search ads and their intent boundaries.",
      "skills": ["create-paid-campaign"], "workflows": [], "knowledgeHandles": [], "dependsOn": []
    },
    {
      "id": "copy", "role": "copy", "goal": "Write landing copy aligned with the ad intent.",
      "skills": ["write-copy"], "workflows": [], "knowledgeHandles": [], "dependsOn": ["ads"]
    }
  ],
  "presentation": {
    "outcome": "the launch package",
    "deliverable": "two ad variants and aligned landing copy",
    "capabilities": [
      { "id": "paid-media", "label": "paid media" },
      { "id": "conversion-copy", "label": "conversion copy" }
    ],
    "specialists": [
      { "assignmentId": "ads", "label": "Ads" },
      { "assignmentId": "copy", "label": "Copy" }
    ],
    "evidence": ["supplied product facts"],
    "review": "independent"
  },
  "limits": { "concurrency": 2, "timeoutSeconds": 900, "maxAttempts": 1, "maxDispatches": 6, "maxOutputBytes": 16000 }
}
```

Add product facts to the goal or pass allowed knowledge through the host API. The CLI resolves only an explicitly supplied private knowledge index. `maxDispatches` includes one parent integration assignment and one
review assignment. Leave two extra dispatches if a `revise` verdict should receive one targeted
correction and one exact-digest re-review. The portable protocol supports arbitrary allowed
outcomes with role `outcome`.
The named roster covers ads, copy, dr-landing, saas-landing, data-diagnosis, campaign-data, and
creative-assets. Public titles look like `Conquistador: Campaign data`. No new outcome library is
created. An optional `presentation` object uses caller-approved public summaries. It must never contain private facts, prompts, raw knowledge, or credentials. Its labels are validated against the roster; the actual assignments and host determine the brief's specialist list and review mode. Capability labels come from selected methods. Plans
without it remain valid. The coordinator emits a compact engagement brief before the first dispatch
and writes `conquistador.execution-receipt/v1` beside the integrated artifact. Receipt execution IDs
and statuses come from the host, including observed integration, initial review, correction, and final-review children. Each review row retains its own reviewedDigest; a re-review never replaces the initial row. External actions stay empty and `humanAccepted` stays false. The receipt records no authorized external actions; host tool activity is not audited by this adapter.

## Embed in a host

`runSpecialistTeam({plan, root, host, parent, signal, onEvent, authorize, resolveKnowledge})` is the
coordinator API. A host declares `capabilities.isolatedContexts` and `maxConcurrency`. Its
`execute(packet, {signal})` returns `{executionId, isolated, result}`. Identity and isolation are
host-owned fields; the result has the closed shape checked by `validateResult` in `contracts.mjs`.
`createBbHost({projectId, environmentId, parentThreadId})` implements that callback using BB.
Operator activation is separate. Staged plugins store the profile at
skills/conquistador/library/conquistador; operator/harness copies use
library/conquistador at the installation root. Legacy operators also support
agent/skills/conquistador/library/conquistador. Compact copies use library/conquistador.
Canonical source and older managed layouts remain readable. Installed copies expose one SKILL.md
and keep selected method bodies as internal METHOD.md files. Logical method IDs stay unchanged. Call
`loadOperatorProfile(root)` and `admitRequest(profile, {text}, hostSettings)`. Hosts may store
`project` or `off` in their own settings. No host automatically calls this function after setup. The package does not edit instruction files. Use the parent file explicitly until your host has an adapter. The off setting disables admission, including explicit requests. Before removal, detach host routing and stop active teams.

Without isolation, provide `parent.execute` using the same contract. It must invoke the current
parent context for each packet, including integration and review. The coordinator executes one
assignment at a time and labels review as same-context. It does not fabricate a callback or launch
a hidden alternate provider when the host cannot supply one.

`resolveKnowledge(handle)` returns a bounded permitted snippet for a logical handle such as `project:offer` or `brand-notes`.
It is host code, not a model-supplied command or path. The loader enforces domain restrictions
before resolving handles or dispatching work. An additional `authorize(task)` callback can narrow
access but cannot bypass the installed restriction file.

## Evidence and limits

Private alpha 0.0.5 has one uninterrupted provider-backed run through two visible specialists,
integration, exact-digest review, one targeted correction and exact-digest re-review. All six BB
children completed and were checked idle. The first review found a word-count mismatch and an
unsupported activation-frequency claim; the correction removed both. Final provider review returned
a draft ready for a human decision. Human acceptance is not recorded. This proves the observed
manual BB/Codex sequence on macOS, not automatic request admission, native activation in other
hosts, or quality across every method. A fresh manual file invocation also selected the copy method
and explicitly labeled its review as same-context.

Earlier adapter work recorded a host-driven same-context run with independent review false.
Interrupted attempts remain partial historical evidence and are not counted as completed runs.
FOR-247 and FOR-248 retain their remaining human and host acceptance scope.

BB workers share their environment's filesystem and available host tools. Conversation isolation
is not an access-control sandbox. This adapter instructs workers to use supplied context and
return draft text, with no filesystem edits, external tools, credentials or delegation. The host
must enforce any stronger access restrictions. The coordinator's output and dispatch ceilings do
not measure model token usage or billing. Host policy owns those limits.

An interrupted or ambiguous spawn is never retried automatically. Inspect the recorded child IDs,
verify ownership, stop any remaining owned work and reconcile its state before another run.
Cleanup has a separate bounded wait. Unverified identities and unfinished cleanup remain explicit
in the failure report; an unverified returned ID is never stopped. The existing durable runtime
handles graph resume separately; this small team coordinator does not resume a failed team.

Public receipts omit raw goals and model evidence/gap text. They report counts of validated results
and reported limitations, which do not prove source use or output quality. Review the private
result for substantive findings. A blocked dependency skips its downstream assignments and records
not-run rows. A blocked correction retains the original draft digest and initial review only.

Assignment IDs `integrate` and `review` remain reserved. Correction and re-review use
`operator:correct` and `operator:final-review`, outside the user assignment ID grammar.
Existing user assignments named correct or final-review remain valid. Ordinary plans
without presentation remain supported. The result's review field still holds the latest review;
firstReview and finalReview preserve both observations after a correction. Receipt consumers must
accept not-run rows and the additional reviewedDigest and status fields. The receipt contract remains v1. Product version 0.0.5 and method versions are separate.

Correction and final re-review each have one attempt, even for a known pre-dispatch failure. This
reserves the two remaining dispatch slots and prevents a hidden correction retry loop. Other
assignments may retry once only for a known failure before any accepted dispatch.

## Progressive resources and optional knowledge

Assignments include required core resources and the parent quality, safety, and context standards.
Conditional resources are listed with their stage conditions. The host reads applicable resources
under `context.resourceRoot` before that stage, or returns a labeled blocked result. Embedders can
use `loadAssignmentResource(root, method, path)` for a bounded, contained read. The fixed 192 KiB /
100-file initial budget remains enforced. Split oversized assignments; never drop required text.
Composition workflows are instructions, not runtime graphs.

To supply project knowledge to a BB team, pass `--knowledge-index /absolute/private/index.json`
after the output argument. Keep this file and its source files outside the installed product:

```json
{
  "schemaVersion": "conquistador.knowledge-index/v1",
  "handles": [{
    "handle": "project:facts",
    "source": "Approved product brief",
    "scope": "Launch draft",
    "freshness": "2026-09-18",
    "path": "facts.md"
  }]
}
```

List `project:facts` in only the assignments that need it. Paths are relative to the index directory;
absolute paths, traversal, symlinks, duplicate handles, and sources inside the product are refused.
Domain restrictions still apply. The parent supplies source, scope, freshness and body to the selected
specialist. Missing sources become labeled gaps; the specialist must not invent their contents.
The index and source bodies never enter a release or public receipt. Omit the option to work from
the supplied task facts. No vault, private workspace, embedding service, or persistent memory is needed.
