# Use Conquistador

Describe the result you need and supply the relevant project context. Conquistador selects the
methods, produces the work, reviews it and gives you a next action. All 38 outcome methods are
included in the complete Conquistador install. A standalone method install contains only that
method; the examples below assume the complete entry point.

Your coding-agent host supplies the model, file access, tools and permission controls. Use
`/conquistador`, `$conquistador`, the host's skill picker, or `/conquistador:conquistador` for the
Claude plugin. Portable agent packages need a host adapter before they can run.

## Give it a task

1. Select Conquistador in your host. If it is missing, check installation scope and start a fresh
   host session. Installation is complete only when your host can discover and use the entry point.
2. State the outcome, intended audience, relevant files, constraints and desired output. Use paths
   your host can read. Say whether you want a specification, implementation or draft for review.
3. Review the deliverable and its evidence gaps. Reply with a correction or the next authorized
   step in the same thread. You do not need to select another method.

The examples below are task templates and expected deliverables, not recorded successful runs.
Replace the example paths and details with your own. Keep outputs in your project, outside the
installed product. No runtime service, MCP server or provider account is needed for text work
based on supplied context and your host's model.

## Prepare a beta launch

Supply a product description, audience, current offer and any approved claims:

```text
/conquistador Use docs/product.md and docs/audience.md to prepare a beta launch
for our appointment tool for independent tutors. Deliver landing-page copy,
one launch email and a two-week campaign plan in docs/launch/. We have no
customer testimonials yet. Use email and our existing community only.
Keep all work as drafts for review.
```

Expect paste-ready copy, a campaign plan with asset requirements and owners, a schedule, and a
measurement plan with a decision date. Claims without evidence should be marked for review.
Conquistador should carry the same audience and promise through the copy and plan. You review
product truth and decide when to publish or send.

## Improve an onboarding flow

Supply the current flow, observed problems and access to the code if you want implementation:

```text
/conquistador Review docs/onboarding.md and the signup flow in this project.
Users report losing entered details after a validation error. Trace the current
behavior, fix the error recovery, and verify the change with the relevant tests.
Deliver the local code change and a short before/after explanation. Ask only
if a product decision cannot be inferred. Do not deploy.
```

Expect a diagnosis tied to the code, the requested local change and verification results.
Conquistador should distinguish checks it ran from checks it could not run. A proposed conversion
benefit remains a hypothesis until observed results support it. For a specification-only task,
replace the implementation request with "deliver the revised flow and acceptance criteria."

## Turn results into a next experiment

Supply aggregate results, their definitions, observation window and known confounders:

```text
/conquistador Review docs/campaign-results.md against docs/campaign-plan.md.
Decide what to keep, drop and test next. The results cover the last two weeks;
we changed the audience halfway through. Deliver a recommendation and one
experiment brief. Do not claim the copy caused the change in conversion.
```

Expect a decision tied to the supplied evidence, attribution limits and one test with a hypothesis,
primary measure, guardrails, observation window and stop or continue rule. Missing denominators
or incompatible periods should remain gaps. You supply actual measurements; Conquistador must
not invent them or describe a proposed test as an observed result.

## Write documentation people can follow

Supply the code and name the reader's job:

```text
/conquistador Update README.md and docs/setup.md for a new developer using this
checkout. Check commands against the scripts and configuration. Include a quick
start, expected results and recovery for common setup errors. Report what you
verified and what still needs a real account or host check.
```

Expect documentation grounded in the current code, usable commands with prerequisites, and an
honest verification report. Conquistador should preserve the requested file scope. A documentation
request does not authorize changes to deployment, accounts or publication.

## Review a visual deliverable

After Conquistador produces a page, brief or other visual work, ask:

```text
/conquistador Preview this deliverable in Lavish and apply my annotations to
its source. Keep the preview private and keep the source file canonical.
```

The agent prepares the optional Lavish CLI, starts a preview and polls for annotations. You open
the reachable browser link and mark changes; the agent revises the source and preview.
A remote host needs authorized private port access. If that is unavailable, review the source
in chat. Hosted sharing requires separate permission. [Preview setup](PREVIEW.md) explains the
launcher, telemetry opt-out and polling. Text-only work needs no preview tool.

## Who does what

| You provide or decide | Conquistador handles through the host |
| --- | --- |
| The outcome and available project context | Selects the smallest set of methods needed for the result |
| Product facts, audience constraints and corrections | Grounds claims in supplied or authorized sources and labels assumptions |
| The desired deliverable and destination | Produces the requested work, reviews it and reports remaining gaps |
| Account access and host-required approvals | Checks tools and prepares routine local prerequisites when permitted |
| Permission for publication, spend or external writes | Prepares a reviewable result and pauses at the applicable action boundary |
| Approval for a specific memory entry or feedback disclosure | Previews the exact content and destination before the approved write |

Conquistador should ask only when missing information changes the result or needs your authority.
It should complete useful work with the available context and identify any remaining dependency.
It cannot supply credentials, grant itself account access or make a missing integration work by
claiming that it ran.

## Continue, correct and remember

Reply in the same thread with a concrete correction, such as "The offer is a paid pilot, not a
free trial. Revise the page and email." Conquistador should apply that correction to the current
work. Accepting a revision does not automatically save it as durable memory.

For later use, ask it to propose a private project memory entry. Review the exact entry and
location before saving. The host can read relevant approved entries on a later request; automatic
cross-run retrieval and global learning are absent. The documented working limit starts with at
most five entries and 8,000 characters of recalled text. It is a context guideline, not an enforced
retrieval system. See [memory and learning](LEARNING.md).

Keep private dogfood feedback as a local redacted draft. The `submit-feedback` method requires a
verified public destination for submission, so it must not upload private notes by bypassing that
requirement. Feedback disclosure is separate from memory approval. No transcript collection or
feedback upload happens automatically.

## Optional tools and limits

The optional runtime runs declared playbooks and stores run artifacts. It does not execute every
method. MCP provides run, artifact-list, artifact-read and cancel access to that configured runtime;
it grants no human approval or publishing authority. Its built-in model adapter has no browser,
file-editing or external action tools.

The [proactive helper](PROACTIVE.md) returns advice for selected host events. It is disabled by
default and cannot schedule or execute work. Some compact packages include its guide without the
helper executable. Your host must invoke it and deliver the advice for it to affect a task.

Build, runtime setup, packaging and installation-helper commands require the complete distribution.
They are not commands for a compact skill or agent folder. Get the complete installation guide
from the private [dogfood source branch](https://github.com/forsvn-labs/conquistador/blob/dogfood/0.1.0/INSTALL.md).
Updates and removal belong to the installer or host plugin manager that created the copy.
Keep outputs and memory outside that copy so replacement does not mix them with product files.

There is no hosted Conquistador SaaS or automatic global learning service. Experimental Eve/Grok
packages do not establish native activation. Judge the actual host, task and result separately;
local package checks do not prove live execution or human acceptance.
