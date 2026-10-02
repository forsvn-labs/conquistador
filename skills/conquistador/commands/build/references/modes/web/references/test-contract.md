---
title: Web Test Contract
lifecycle: canonical
status: stable
produced_by: build
load_class: METHOD
---

# Web test contract

The test contract states, before implementation, which checks must run for a slice's risk class and
how results are reported. It replaces vibes ("looks done") with named evidence.

## Risk classes

| Class | Examples | Required minimum |
|---|---|---|
| **R1 — read-only UI** | marketing section, static content | types + lint + build; render check of changed routes; unit tests for new logic |
| **R2 — stateful slice** | forms, settings, CRUD on user data | R1 plus: validation tests both sides of the boundary; integration test for the data path; empty/error-state coverage |
| **R3 — trust boundary** | auth, payments, PII, permissions, admin | R2 plus: authorization tests per role; migration up/down on a scratch database; security checklist (secrets, injection surface, session handling); explicit note that automated checks do not certify security |
| **R4 — infrastructure** | migrations on shared data, deploy config, dependency upgrades | R3-appropriate checks plus: written rollback tested or rehearsed; staging verification before production; human approval gate named |

Classify the slice during planning. When in doubt, take the higher class. Downgrading a class after
implementation is a red flag and gets recorded with its reason.

## The reporting rules

1. Report the exact commands, environment (OS, runtime version), and result per check.
2. Every required check that could not run is an **untested cell** listed by name with the blocker.
   Untested cells are never silently omitted and never described as passing.
3. A green suite that does not cover the changed behavior counts as untested, not verified.
4. Browser-observed claims require an actual browser run (tooling, screenshot, or trace). Source
   inspection alone supports at most "implemented, not browser-verified".
5. Deployment or production claims require the deployment to have happened through approved channels.
   This skill does not deploy without explicit approval for the exact target.

## Failure handling

- Any required check fails → fix and rerun; if unfixable in scope, deliver as bounded handoff with
  the failure quoted verbatim.
- Test infrastructure itself is broken (pre-existing failures) → establish the baseline first,
  report which failures pre-date the change, never bury new failures inside old noise.
- Flaky test → rerun once, report both runs, flag the test by name; do not delete it as part of a
  build request.

## Greenfield minimum

A new project still gets a contract: framework's typecheck, lint, build, one integration test per
data path, and a rendered smoke check of the primary flow. "There were no tests when I arrived" is
the beginning of a contract, not an exemption from one.
