---
title: Web Engineering Method
lifecycle: canonical
status: stable
produced_by: build-web-app
load_class: METHOD
---

# Web engineering method

Implement one complete vertical slice with verified behavior, in the project's existing stack, with a
recorded architecture decision and a test contract that says what ran. This method exists to prevent
silent broad rewrites: every change traces to an approved outcome.

## 1. Inspect and record

Before writing code, read and record:

- repository instructions, package/lock files, scripts, and framework versions;
- existing architecture: routing, state management, data access, styling system;
- schemas, migrations, seed data, and environment variable contracts;
- test setup, CI configuration, and deployment configuration;
- dirty worktree state — uncommitted work belongs to someone; build around it or ask.

For greenfield work, choose the smallest justified stack from product needs and host constraints, and
write a **stack decision record**: chosen stack, alternatives rejected, one-line reason each, host
constraints honored, and what would force a revisit. Mandating a personal favorite framework,
builder, or cloud is a failure of this step.

## 2. Validate intent before implementing

Confirm the minimum set:

- the user flow, end to end, including who is authenticated and who is not;
- interface states: loading, empty, error, offline/retry, success;
- data model changes and trust boundaries (what crosses client/server, what is public);
- acceptance criteria phrased so a test or a human check can settle them;
- non-goals written down, so scope cannot drift silently.

Unresolved product decisions get surfaced as questions, not encoded as guesses in code.

## 3. Plan slices, not projects

Break the outcome into vertical slices with stable IDs (`settings-profile-avatar`), dependencies,
and risk-first ordering: spike the riskiest unknown first. Each slice names its tests, its rollback
(revert commit / migration down), and any human-owned prerequisite (credentials, DNS, third-party
account). Extract shared services only for two real callers; speculative abstraction is deferred.

## 4. Implement one slice at a time

Carry the slice through every layer it touches:

- semantic, responsive UI using the project's tokens and components;
- client/server state consistent with the existing patterns;
- validation on both sides of the trust boundary;
- authentication/authorization when the slice touches protected resources;
- security and privacy controls: secrets out of source and logs, input handling, least-privilege
  queries;
- complete failure states, not just the happy path.

Separate behavior changes from behavior-preserving maintenance. A build request is never inferred
cleanup authority: refactors ride along only when they serve the slice, and dependency upgrades need
their own justification and rollback.

## 5. Verify against the test contract

Run the checks the [test contract](test-contract.md) requires for the slice's risk class. Inspect
actual rendered behavior when tooling allows. Report exactly what ran.

## 6. Deliver the artifact

Return, in this order:

1. outcome status: implemented / partially implemented / bounded handoff;
2. changed files grouped by slice ID;
3. verification evidence: commands, environment, results, artifacts, untested cells;
4. architecture and data implications (including migration safety);
5. remaining risks and known gaps;
6. rollout and rollback plan;
7. human-owned next steps.

If the host lacks browser, dependency, or environment access, stop at a **bounded handoff** instead
of simulating verification: exact changes, files, commands to run, expected evidence, blockers, and
the human-owned next step. Never claim a browser, deployment, or production result that did not run.
