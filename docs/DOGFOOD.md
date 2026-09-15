# Private dogfooding

Use this guide to check whether Conquistador works for your real tasks in your actual host.
Start with one task you already need to finish. Record the result separately from package checks.

## Get the private build

1. Follow [installation](../INSTALL.md#recommended-quick-start) using an authenticated account with
   access to `forsvn-labs/conquistador`, branch `dogfood/0.1.0`, or a supplied private distribution.
   Expect a clean source folder and record its exact commit or package identity.
2. Install the complete entry point for your host. Start a fresh host session and select
   Conquistador. Expect the host to discover the skill or namespaced plugin entry point.
3. Use a request from [the usage guide](USAGE.md) with your own files. Expect a finished deliverable,
   its evidence gaps and a next action. Check these yourself before marking the task accepted.

The agent can handle routine local setup. You handle account sign-in and host-required approvals.
You do not need the HTTP runtime, MCP, Docker, hooks or every integration to use the skill library.

## Check the first tasks

| Exercise | What to inspect | Record separately |
| --- | --- | --- |
| Produce a launch or product deliverable | Correct use of context, finished work, useful review, unnecessary questions | Whether the host activated the method and whether you accepted the actual result |
| Preview a visual deliverable | Reachable private link, one annotation returned through polling, source revision | Whether browser review worked in your host; a started server alone is insufficient |
| Supply a correction or measured result | Revised recommendation, preserved facts, stated uncertainty | Whether the revision fixed the observed problem |

Use [Lavish setup](PREVIEW.md) for previews and telemetry opt-out. The
[proactive helper](PROACTIVE.md) is disabled by default and requires a real host event.
These are behaviors to test, not proof already supplied by a ZIP, manifest or local fixture.

## Keep useful private notes

Keep notes in your private project outside the installed package. A small record is enough:

```text
Build: exact source commit or supplied package identity
Host: name, version, installation route and scope
Task: request and selected source references
Observed result: what happened, including any failure
Correction: what changed in the request or output
Verdict: accepted, needs revision, or blocked, with a reason
Next check: the smallest task that can confirm the correction
```

Store only the material needed to explain the observation. Do not automatically copy full
transcripts, customer data or credentials. A source commit identifies what you tested; it does
not imply that another host or later build will behave the same way.

## Memory and feedback

Corrections in the current task do not automatically become memory. The
[memory workflow](LEARNING.md) requires approval for the exact entry and destination. Reuse through
host file tools starts with at most five relevant entries and 8,000 characters of recalled text.
Automatic cross-run retrieval, enforced project isolation and global learning are absent.

Keep product feedback as local redacted drafts during private dogfooding. `submit-feedback` may
prepare a draft, but its public-destination requirement must not be relaxed to upload private
notes. Memory approval is not permission to disclose feedback. A maintainer can review a draft
through a separately authorized private process; drafting it does not send it anywhere.

## Update and retry

Use the [installation owner's update procedure](../INSTALL.md#update-or-remove-an-installation).
Record the new build identity and repeat the smallest task that exposed the problem. Keep the
original observation so you can compare the revised result. Preserve user outputs outside the
installed copy; uninstalling the product does not erase those files or runtime state.

Keep the repository and installed copies private. The root package has `private: true`; local
packing and installation remain available. Public packages, marketplace listings, repository
visibility changes and artifact sharing need explicit authorization. No hosted SaaS, native
Eve/Grok activation, live-provider support or release acceptance follows from these local checks.
