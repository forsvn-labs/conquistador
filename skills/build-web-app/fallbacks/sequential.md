# Sequential fallback — web app build

Use when the host cannot run implementers, reviewers, browser tooling, or CI as separate contexts.
Keep the same method and test contract; change only the machinery. Label the result
**single-context implementation**, not independent verification.

## Order of work

1. **Inspect.** Read repository instructions, package/lock files, architecture, schemas, migrations,
   tests, deployment config, and dirty worktree state per the
   [web engineering method](../references/web-engineering-method.md). For greenfield, write the stack
   decision record first.
2. **Validate intent.** Write the flow, states, trust boundaries, acceptance criteria, and non-goals.
   Surface unresolved product decisions as questions instead of guessing.
3. **Classify risk.** Assign R1–R4 from the [test contract](../references/test-contract.md) during
   planning; record the class with the slice plan.
4. **Implement one vertical slice at a time**, smallest useful outcome first. Keep behavior changes
   separate from maintenance; no opportunistic rewrites, deletions, or dependency upgrades without
   evidence and rollback.
5. **Self-review pass.** Re-read the diff as a hostile reviewer: trust-boundary crossings, missing
   failure states, secrets in code or logs, accessibility regressions, dead code added. Fix findings
   before verification.
6. **Run the contract.** Execute every check available in this environment for the risk class. List
   unavailable checks as named untested cells with blockers — never simulate a passing run.
7. **Deliver** implemented work or a bounded handoff: exact changes by slice ID, commands for the
   human to run, expected evidence, remaining risks, rollout/rollback plan.

## Stops

- **Missing input:** no runnable project, no dependency access, and no way to typecheck → deliver a
  bounded handoff with precise file-level changes; do not claim an implementation "should work".
- **Factual uncertainty:** product intent is ambiguous on a load-bearing decision → stop and ask;
  do not encode guesses into data models or auth logic.
- **Credential stop:** secrets, accounts, or environments you do not have → mark those cells
  untested; never fabricate credentials or read private stores.
- **External action:** deployments, domains, DNS, production data, destructive migrations, and
  third-party service mutation require explicit approval for the exact action — always out of scope
  for this skill alone.
- **Critic failure:** after one self-review cycle material findings remain → ship them listed as open
  risks, not silently resolved.
- **Human verdict:** completion claims end at the human who runs the untested cells; nothing here
  certifies its own delivery.
