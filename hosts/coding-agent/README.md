# BB specialist adapter

This adapter runs draft assignments in fresh, visible BB child threads. The coordinator enforces
ordering, concurrency, dispatch and output limits, cancellation, result validation, integration,
exact-artifact review, at most one targeted correction, engagement briefs, and execution receipts.
It uses the existing specialist and outcome methods. Child titles use the public specialist roster.

## Run a team

Use Node 24 from a full distribution or a plugin/harness install that contains this adapter.
Supply an existing BB project and environment. Create or select that environment through the host
before starting parallel workers; concurrent checkout provisioning can collide.

```sh
node hosts/coding-agent/team.mjs /absolute/local/team.json PROJECT_ID ENVIRONMENT_ID /absolute/local/new-result.json
```

`BB_THREAD_ID` must identify the current parent. The host supplies model selection, billing and
permissions. The adapter invokes the official BB CLI with argument arrays and never invokes a
provider CLI. Keep the input and result outside the installed package. The output file must not
already exist. SIGINT and SIGTERM cancel the team and stop its known children.

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

Add product facts to the goal or pass allowed knowledge through the host API. The CLI does not
resolve private knowledge. `maxDispatches` includes one parent integration assignment and one
review assignment. Leave two extra dispatches if a `revise` verdict should receive one targeted
correction and one exact-digest re-review. The portable protocol supports arbitrary allowed
outcomes with role `outcome`.
The named roster covers ads, copy, dr-landing, saas-landing, data-diagnosis, campaign-data, and
creative-assets. Public titles look like `Conquistador: Campaign data`. No new outcome library is
created. An optional `presentation` object on the plan is validated against that roster. Plans
without it remain valid. The coordinator emits a compact engagement brief before the first dispatch
and writes `conquistador.execution-receipt/v1` beside the integrated artifact. Receipt execution IDs
and statuses come from the host, including observed integration, correction, and the final review
child. External actions stay empty and `humanAccepted` stays false.

## Embed in a host

`runSpecialistTeam({plan, root, host, parent, signal, onEvent, authorize, resolveKnowledge})` is the
coordinator API. A host declares `capabilities.isolatedContexts` and `maxConcurrency`. Its
`execute(packet, {signal})` returns `{executionId, isolated, result}`. Identity and isolation are
host-owned fields; the result has the closed shape checked by `validateResult` in `contracts.mjs`.
`createBbHost({projectId, environmentId, parentThreadId})` implements that callback using BB.
Operator activation is separate: load `skills/conquistador/operator-profile.json` or call
`loadOperatorProfile(root)` and `admitRequest(profile, {text}, hostSettings)`. Hosts may store
`project` or `off` in their own settings. The package does not edit instruction files.

Without isolation, provide `parent.execute` using the same contract. It must invoke the current
parent context for each packet, including integration and review. The coordinator executes one
assignment at a time and labels review as same-context. It does not fabricate a callback or launch
a hidden alternate provider when the host cannot supply one.

`resolveKnowledge(handle)` returns a bounded permitted snippet for a logical handle such as `project:offer` or `brand-notes`.
It is host code, not a model-supplied command or path. The loader enforces domain restrictions
before resolving handles or dispatching work. An additional `authorize(task)` callback can narrow
access but cannot bypass the installed restriction file.

## Evidence and limits

Four separate BB contexts have been observed completing a two-specialist draft, integration, and
review. The reviewer returned a real revision finding against the exact integrated digest. A
separate host-driven same-context run completed with independent review false. These checks establish
that the adapter executes and preserves review identity; they do not establish general output
quality, native activation in other hosts, human acceptance or live-provider support. The operator
brief/receipt path is covered by synthetic protocol tests in this source. This worktree did not
observe a new live BB receipt run: specialist children share the implementation filesystem.

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
