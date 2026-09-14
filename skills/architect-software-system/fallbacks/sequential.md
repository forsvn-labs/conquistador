# Sequential fallback

Use when the host cannot run stack-selection, infrastructure, schema, api, integration, scaling,
and critic as separate agents.

Keep the same method. Change only the machinery. Label this single-context. Do not call it
independent corroboration.

1. Establish mode and constraints per `SKILL.md` (greenfield / brownfield / migration). Gather product
   flow, near-term load, team, budget, latency, availability, privacy, compliance, and deployment
   facts. Separate facts, estimates, assumptions, and unresolved choices. Use
   [`../references/intake-prompts.md`](../references/intake-prompts.md) when answers are missing.
2. Apply the recovered lenses in this order, using each matching file as a sequential pass:
   1. [stack-selection](../agents/stack-selection-agent.md)
   2. [infrastructure](../agents/infrastructure-agent.md)
   3. [schema](../agents/schema-agent.md)
   4. [api](../agents/api-agent.md)
   5. [integration](../agents/integration-agent.md)
   6. [scaling](../agents/scaling-agent.md)
   7. [critic](../agents/critic-agent.md)
3. Enforce all eight critical gates from the critic before delivery. On FAIL, rework the named weak
   unit (max two cycles). Classify every external dependency with
   [`../references/dependency-classification.md`](../references/dependency-classification.md).
4. Follow [`../references/system-architecture-method.md`](../references/system-architecture-method.md),
   [`../references/report-template.md`](../references/report-template.md), and
   [`../references/anti-patterns.md`](../references/anti-patterns.md). Pattern catalogs live under
   `../references/` (tech-stack, database, API, auth, deployment, security, failure modes).
5. Return the artifact inline by default. Use a host-provided durable location only when one exists
   and the operator asks for persistence.

Do not provision infrastructure, migrate production data, rotate secrets, deploy, or make destructive
changes without explicit approval for the exact action.
