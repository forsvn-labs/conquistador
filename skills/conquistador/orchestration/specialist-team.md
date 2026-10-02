# Specialist team execution

Use this contract when one request needs several distinct kinds of work. The Conquistador parent
owns the user's outcome, team design, integration, and final response.

## Choose the team

Start with the smallest team that can finish the requested result. A narrow task uses one specialist
or stays with the parent. A broad task can use as many specialists as the work needs and the host
can run. Do not create roles for status, coordination, display, or restating another specialist's
output.

Use [the specialist roster](../specialists/roster.md) for the named GTM roles. Public child titles and
receipts use those roster labels, never internal file paths. For another domain, assign an existing
outcome skill and its contained agent contracts. Do not create a new outcome when the library already
owns the method.

Split work only when a specialist has a distinct goal, input set, or acceptance check. Run independent
assignments in parallel when the host supports isolated contexts. Run dependent assignments in order.

## Give each specialist an assignment packet

Every assignment must name:

- the specialist role file;
- one goal and a verifiable finish state;
- the exact outcome skills and, when needed, one named composition workflow;
- the project knowledge and evidence the specialist may read;
- available tools, connections, and execution environment;
- dependencies and the expected handoff format;
- factual, budget, time, and retry limits;
- actions that require a human.

Pass the smallest useful context. Include the current artifact when the assignment revises or reviews
another specialist's work. Do not pass private or unrelated files for convenience.

Each specialist performs its assignment and returns evidence, the finished artifact or decision, and
unresolved gaps. A specialist must not delegate again, approve its own consequential action, or widen
its assigned scope.

## Integrate the result

The parent resolves conflicts against the user's outcome, accepted product facts, and a single
decision spine. It does not combine incompatible promises, audiences, measurement windows, or
authority assumptions.

Use `critique`, `factcheck`, or `decide` when the result needs a separate
review judgment. Claim independent review only when another isolated context reviewed the exact
artifact. Keep publication, spend, credentials, deployment, sends, and other external writes behind
the applicable human decision. If review returns `revise`, apply at most one targeted integration
correction, then one exact-digest re-review. A second unresolved material failure stays a gap.

Return one coherent deliverable, one next action, and an execution receipt when more than one
capability or any separate context ran. Do not return a pile of specialist reports.

## Sequential fallback

If the host cannot create isolated specialist contexts, run the same role files in dependency order
inside the parent context. Keep each assignment and result separate so the parent can detect conflicts.
Identify any review as same-context. Do not claim that another agent ran.

## Callable host contract

The complete distribution and plugin/harness installs include `hosts/coding-agent/orchestrate.mjs`
and a BB adapter in `hosts/coding-agent/bb.mjs`. Use them when the host exposes BB and an existing
project/environment. The BB adapter creates visible child threads with public roster titles, emits
the validated engagement brief before the first dispatch, then executes a parent integration
assignment and an isolated `critique` assignment. After a `revise` verdict it may run one
targeted correction and one exact-digest re-review. It passes only the selected method files, their
contained outcome agents and references, named workflow, allowed knowledge snippets, and required
predecessor results.

The executable protocol is `conquistador.specialist/v1`. Plans may include an optional `presentation`
object; plans without it remain valid. The master package is `conquistador.agent-package/v2`; the
original v1 schema and package remain available for old hosts. Operator activation is
`conquistador.operator-profile/v1` with `manual | project | off`. Installed copies default to
`manual`. `operator` is the setup target for the portable master package; `harness` remains compatible. A run declares one to
four concurrent contexts, a finite deadline, at most two attempts, an output limit, and at most
twelve dispatches including integration, review, and at most one correction cycle. Only a known
pre-dispatch failure can retry. An accepted or uncertain dispatch must be reconciled before another
attempt. Cancellation stops owned BB children. No specialist may recursively delegate.

A result contains a finished draft, evidence and gaps. The host binds its execution identity;
the model cannot choose that identity. The reviewer must echo the digest of the exact integrated
artifact. `draft`, `revise`, and `blocked` are valid results; none means human acceptance. The
deterministic `conquistador.execution-receipt/v1` is derived from the validated plan plus observed
host results. Its specialist list keeps every plan assignment, then any observed integration,
initial review, correction, and final-review child, each with host execution IDs and statuses.
Both review rows retain their own exact reviewedDigest. Skipped assignments are not-run, not
observed blocked executions. Public fields may
include capability labels, role labels, deliverable, evidence classes, execution mode, review
independence, child execution IDs/statuses, artifact digest, gaps, and external-action status.
External actions stay empty and `humanAccepted` stays false in this draft-only adapter.

A host without isolated contexts must provide the coordinator's explicit `parent.execute` callback.
That callback performs each role in the current context. The result records `sequential-in-context`
and `independentReview: false`. Do not substitute test responses for model execution. The brief must
disclose same-context review.

Load-time domain restrictions apply when an installed `domain-restriction.json` is present, including
the model and worker-context tools. Logical `scope:name` knowledge handles resolve through a
host-owned callback. Keep resolved paths and source bodies outside package metadata and receipts.
BB context isolation is not a filesystem sandbox. The host's permission system remains responsible
for file and tool access. This first BB adapter supports draft-only work with no external tools.

Public summaries must not quote private goals, prompts, method bodies, knowledge, or raw model
evidence and gaps. The executable receipt reports counts and public labels; the private result
retains the substantive findings. Presentation text must be approved for display by its caller.
Pattern checks cannot classify arbitrary confidential prose. Method selection and result counts
do not establish source verification, model quality, human acceptance, or absence of host tool use.
Setup does not register project routing. A host must call admitRequest at user turn start to use
project activation; off disables even explicit admission through that function.
