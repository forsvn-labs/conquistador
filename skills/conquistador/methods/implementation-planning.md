# Implementation planning method

Use privately after a product experience, campaign system, or production brief is accepted and the
user needs an executable implementation order.

- Start from accepted outcomes and acceptance criteria, not a speculative architecture.
- Map dependencies, critical path, ownership, data or content prerequisites, rollout, verification,
  rollback, and unresolved decisions.
- Slice vertically so each increment proves useful behavior; avoid infrastructure phases with no
  user-visible evidence.
- Preserve security, accessibility, consent, analytics, failure/recovery, and platform review needs.
- Name assumptions and stop when a missing authority decision would materially change the build.

Return an ordered implementation path, testable exit criteria, risks, reversible rollout, and the
single next build action. This method does not deploy or mutate production by implication.
