# Use Conquistador

Ask for the result you need. Conquistador selects the relevant methods, produces one integrated
deliverable, reviews it, and gives you a next action. The complete install includes all 38 methods;
you do not need to learn their names or invoke them separately.

Your coding-agent host supplies the model, file access, tools, and permissions. A standalone method
install contains only that method. The examples here assume the complete entry point.

## Give it a task

After installation, start a fresh session in the receiving project. Select `/conquistador`,
`$conquistador`, or the host's skill picker. The Claude plugin uses `/conquistador:conquistador`.
A skill listing checks inventory; the installation doctor checks local files. This first task
checks whether the host can actually use Conquistador.

Include the outcome, audience, available facts or files, constraints, and output you want. Say
whether you need a draft, specification, or implementation. Use paths the host can read, or paste
relevant context. Keep outputs outside the installed product folder.

Conquistador should ask only when missing information changes the result or needs your authority.
It should finish useful work with available evidence and identify what remains blocked.

For missing skills, wrong scope, or stale sessions, see
[installation and recovery](https://github.com/forsvn-labs/conquistador/blob/dogfood/0.1.0/INSTALL.md).

## Prepare a beta launch

Supply the product, audience, offer, and approved claims:

```text
/conquistador Use docs/product.md and docs/audience.md to prepare our beta
launch. Deliver landing-page copy, one launch email and a two-week campaign
plan in docs/launch/. We have no testimonials yet. Use email and our existing
community only. Mark claims that need evidence. Keep this as a draft.
```

Expect finished copy and a plan with asset requirements, owners, timing, and measurement. The page,
email, and plan should use the same audience and promise. You verify product truth and decide
whether to publish or send. This example is a template, not a recorded successful run.

## Improve an onboarding flow

Supply the current behavior and code if you want an implementation:

```text
/conquistador Review docs/onboarding.md and the signup flow in this project.
Users lose entered details after a validation error. Trace the behavior, fix
the error recovery, and run the relevant tests. Deliver the local change and
a short before/after explanation. Do not deploy.
```

Expect a diagnosis grounded in code, the requested change, and checks that actually ran.
For a specification only, ask for the revised flow and acceptance criteria. A conversion benefit
remains a hypothesis until you measure it.

## Turn results into a next experiment

Supply results, definitions, dates, and known confounders:

```text
/conquistador Review docs/campaign-results.md against docs/campaign-plan.md.
Decide what to keep, drop and test next. The results cover two weeks; we changed
the audience halfway through. Deliver a recommendation and one experiment brief.
Do not claim the copy caused the change in conversion.
```

Expect evidence-linked decisions and a test with a hypothesis, measure, observation window, and
stop or continue rule. Missing denominators and incompatible periods should remain explicit gaps.

## Use your existing stack

Name the systems only when they contain information needed for the task:

```text
/conquistador Prepare our next paid-search test. Campaign history is in
Databricks, offer notes are in Confluence, and qualified customers are in HubSpot.
Reuse the permitted connections this host already has. Create drafts only.
Do not spend or enable a campaign.
```

Conquistador first checks the available tools and connections. Work based on supplied files needs
no account setup. If missing live access blocks the task, it explains Executor, helps install it
or use Cloud, connects the host, and guides you through adding the needed source. You sign in in
the service UI. Never paste credentials into chat.

The agent then verifies the specific account operation and resumes the original task. Finding an
MCP server does not prove a warehouse query or CRM read works. Naming a vendor does not establish
runtime adapter support. Existing connections remain subject to host policy, including any
Executor-only rule. [Connection guidance](https://github.com/forsvn-labs/conquistador/blob/dogfood/0.1.0/docs/INTEGRATIONS.md)
contains the official setup commands and limits.

## Review and continue

Check the deliverable against your facts, audience, and constraints. Conquistador should explain
material choices, mark assumptions, and distinguish completed checks from unverified work. For
larger tasks, it may use isolated specialists when the host supports them, or work sequentially.
Same-context review is not independent review. See [execution modes](MASTER-AGENT.md).

Reply in the same thread with a correction or the next authorized step. For example: "The offer
is a paid pilot. Revise the page and email." You do not need to select another method. Approval
of a draft does not authorize publication, spending, sends, or other external writes.

For visual feedback, ask Conquistador to preview the deliverable in Lavish and apply your
annotations. [Preview guidance](PREVIEW.md) explains the optional tool and private access needs.
If a reachable private preview is unavailable, review the source in chat.

## Memory and private feedback

Corrections apply to the current task. Saving them for later needs approval of the exact memory
entry and destination. [Memory and learning](LEARNING.md) explains the host-file workflow;
automatic cross-run retrieval and global learning are absent.

Keep dogfood feedback as a local redacted draft. No transcript collection or upload happens
automatically. The `submit-feedback` method requires an approved, verified public destination;
do not bypass that requirement to upload private notes. A private feedback handoff needs its own
agreed destination and exact content. Memory approval does not authorize disclosure.

## Optional tools and limits

Text work based on supplied context needs only your host and the installed methods. Plugins and
MCP offer other ways to load the library. The runtime executes four declared playbooks, not every
method. Eve jobs and [proactive hooks](PROACTIVE.md) require explicit setup; ordinary installation
starts neither a service nor a schedule.

Use the original installer to update or remove your copy. A compact skill folder is not a runtime
or development checkout. Build, package, and setup commands belong to a complete distribution.
Get those instructions from the private [installation guide](https://github.com/forsvn-labs/conquistador/blob/dogfood/0.1.0/INSTALL.md).
