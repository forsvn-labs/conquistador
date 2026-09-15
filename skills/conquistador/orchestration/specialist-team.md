# Specialist team execution

Use this contract when one request needs several distinct kinds of work. The Conquistador parent
owns the user's outcome, team design, integration, and final response.

## Choose the team

Start with the smallest team that can finish the requested result. A narrow task uses one specialist.
A broad task can use as many specialists as the work needs and the host can run. Do not create roles
for status, coordination, or restating another specialist's output.

Use [the specialist roster](../specialists/roster.md) for the named GTM roles. For another domain,
assign an existing outcome skill and its contained agent contracts. Do not create a new outcome when
the library already owns the method.

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

Use `fresh-eyes-review`, `knowledge-review`, or `decision-panel` when the result needs a separate
review judgment. Claim independent review only when another isolated context reviewed the exact
artifact. Keep publication, spend, credentials, deployment, sends, and other external writes behind
the applicable human decision.

Return one coherent deliverable and one next action. Do not return a pile of specialist reports.

## Sequential fallback

If the host cannot create isolated specialist contexts, run the same role files in dependency order
inside the parent context. Keep each assignment and result separate so the parent can detect conflicts.
Identify any review as same-context. Do not claim that another agent ran.

## Callable host contract

The complete distribution and plugin/harness installs include `hosts/coding-agent/orchestrate.mjs`
and a BB adapter in `hosts/coding-agent/bb.mjs`. Use them when the host exposes BB and an existing
project/environment. The BB adapter creates visible child threads with separate conversation
contexts, then executes a parent integration assignment and an isolated `fresh-eyes-review`
assignment. It passes only the selected method files, their contained outcome agents and references,
named workflow, allowed knowledge snippets, and required predecessor results.

The executable protocol is `conquistador.specialist/v1`. The master package is
`conquistador.agent-package/v2`; the original v1 schema and package remain available for old hosts.
A run declares one to four concurrent contexts, a finite deadline, at most two attempts, an output
limit, and at most twelve dispatches including integration and review. Only a known pre-dispatch
failure can retry. An accepted or uncertain dispatch must be reconciled before another attempt.
Cancellation stops owned BB children. No specialist may recursively delegate.

A result contains a finished draft, evidence and gaps. The host binds its execution identity;
the model cannot choose that identity. The reviewer must echo the digest of the exact integrated
artifact. `draft`, `revise`, and `blocked` are valid results; none means human acceptance.

A host without isolated contexts must provide the coordinator's explicit `parent.execute` callback.
That callback performs each role in the current context. The result records `sequential-in-context`
and `independentReview: false`. Do not substitute test responses for model execution.

Load-time domain restrictions apply when an installed `domain-restriction.json` is present, including
the model and worker-context tools. Logical `scope:name` knowledge handles resolve through a
host-owned callback. Keep resolved paths and source bodies outside package metadata and receipts.
BB context isolation is not a filesystem sandbox. The host's permission system remains responsible
for file and tool access. This first BB adapter supports draft-only work with no external tools.
