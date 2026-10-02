# Public-alpha acceptance checklist

The current published public alpha is **0.2.2**; `0.2.0` was the first public alpha. The repository
and npm package are public. This filename is retained for existing links, not as an access gate.
Unshipped source changes are listed in [PROGRESS.md](../PROGRESS.md); they do not change what a
registry installation of 0.2.2 does. See [shipped release records](../CHANGELOG.md).

Use exact release bytes and one real task in your actual host. A passing install, synthetic test,
playbook citation, or local package record is not model-quality proof, human acceptance, or
permission to publish. The examples in [Usage](USAGE.md) are author-written synthetic fixtures,
not completed acceptance runs.

## 1. Record the route and installation scope

1. Follow the [plugin installation](../INSTALL.md#plugin-for-coding-agents-recommended), unless
   you intentionally chose a different route. Record version, source commit if known, package
   digest if available, OS/architecture, Node version, host version, and exact command
2. For a scoped installation of published 0.2.2, preview `conquistador add AGENT --dry-run`, then
   run `conquistador add AGENT --yes`. Its bare interactive launcher still adds all detected
   hosts; do not record the unshipped selected-host behavior as released
3. Record the shared plugin path, selected host changes, hook/MCP trust requirements, and matching
   undo command. Check that no project manifest, dependencies, or lockfile appeared
4. Run `conquistador agents` and the host's own plugin listing. The standard plugin exposes one skill,
   `conquistador`, with its commands and plays under it
5. For an intentionally installed **project operator**, use `conquistador operator status` and
   `conquistador operator doctor --json` in its project. That route and staged compact packages
   use one entry with internal methods. Do not apply that one-entry assertion to the default plugin

## 2. Observe a task and one correction

Start a fresh host session. Record these as separate checks, with `passed`, `failed`, or `not run`:

- Installed files and recorded registration
- Native host discovery and any cache refresh required
- Hook trust and hook behavior, or explicit degraded mode if hooks are off/unavailable
- Selected playbooks actually loaded, using successful reads where observable
- A complete artifact grounded in the supplied facts, with correct calculations and honest gaps
- One same-thread correction applied without losing unchanged facts or adding unsupported claims
- Human verdict on usefulness: accepted, needs revision, or blocked, with a reason
- Live account operation only if separately authorized and actually observed

The first three checks cannot establish the later ones. Record unknowns as unknown. Same-context
review is not independent review. If a host cannot show file reads, mark reading unverified rather
than infer it from a citation. Account login and MCP discovery do not prove the required account
operation. No account connection should be a prerequisite for a supplied-context draft.

## 3. Bounded task acceptance

Use the full prompts, expected artifacts, and corrections in [Usage](USAGE.md):

| Task | Minimum useful result | Required correction check |
| --- | --- | --- |
| Marketing asset | Complete subject, preview, body, one CTA, eligibility/suppression, measurement limits, and unresolved facts; draft only | Signup-time activation suppresses the email; product facts remain unchanged |
| Growth experiment | Correct funnel rates, competing causes, one actual proposed change, one discriminating test, owner/window/guardrails/decision prerequisites; no causal claim | A three-day outage invalidates affected comparisons; unknown rates stay unknown |
| Product specification | Bounded flow/state map, input/retry behavior, accessibility, supplied tokens, testable acceptance criteria, explicit privacy decisions; no implementation | In-memory-only storage changes refresh/resume/tab-close behavior throughout the spec |

Also run a no-repository supplied-brief task, a missing-denominator growth case, and a hook-denied
or skills-only case. They should still deliver useful bounded work without invented data, dummy
projects, unnecessary account setup, or hidden publication/spend/implementation.

## 4. First-use lifecycle and recovery acceptance

For the unshipped source changes, use an isolated profile with the exact source commit and record
that source status explicitly. Before release, repeat applicable cases on the candidate package:

1. **Several hosts:** Choose or explicitly name one before install; excluded host registrations
   stay unchanged. Disclose that the shared plugin may also be read by previously registered hosts
2. **One host:** Show the selected scope, shared location, host commands/copy, and exact undo
3. **Explicit all-host choice:** `add --all --yes` names the discovered scope. No implicit expansion
   from a newly detected host, remembered launch choice, update, or ambiguous `--yes`
4. **Dry run:** No files, ownership records, remembered choice, host registrations, or launch;
   check the actual profile before and after, not just the exit code
5. **Missing/old Node or missing host:** Report the exact prerequisite and a bounded retry;
   no false install/ready claim
6. **Cancel/interruption/partial failure:** Cancel before selection creates nothing. A later cancel
   reports any completed installation. Preserve completed state and the last good payload;
   retry the failed target with `add AGENT --yes` without duplicating unrelated work
7. **Host trust declined/off:** Report the missing hook enforcement; explicitly invoking the
   task remains usable if the host permits it. Do not call host execution verified
8. **Update:** Update tracked installed hosts only; record old/new package identity and refresh
   the host. New detected hosts are not added automatically
9. **Removal:** Test named and all-tracked removal, unknown-name rejection, and failure recovery.
   Preserve personal playbooks, configuration, exports, project artifacts, and the npm executable.
   All-tracked removal deletes the owned shared plugin only when host removal succeeds. Separately
   test `npm uninstall -g @forsvn/conquistador` when CLI removal is intended
10. **First useful result:** Complete the task and correction; discovery or successful launch alone
    does not pass this check. Record elapsed time and the human verdict without inventing either

A preview is not an all-or-nothing transaction. A platform-level test without an actual interactive
host session does not certify that platform's interaction or model output. In particular, the
published 0.2.2 release records Linux/Windows installation checks but not Windows interactive
start verification. Keep exact historical evidence in CHANGELOG; do not retroactively broaden it.

## 5. Keep a small private acceptance record

Save the following outside the installed product and public repository:

```text
Build: exact version/commit/package digest; released or unshipped; unknown fields labeled
Environment: OS/architecture, Node, host name/version, model/version if exposed
Route: plugin, compact skill, MCP, or project operator; target and owned paths
Install: preview, actual changes, cancellation/retry, trust choices, observed state
Task: prompt and source references; no unnecessary private content
Artifact: first output and location; elapsed time if measured
Correction: exact requested change and revised artifact
Checks: each evidence class passed / failed / not run; actual commands or successful reads
Verdict: human accepted / needs revision / blocked; reviewer and reason
Lifecycle: update/remove result, preserved user files, residual state and smallest next check
```

Keep only what explains the result. Do not automatically collect transcripts, customer data, or
credentials. An observation applies to that build, host, model, and task; it does not prove every
method or provider. Store feedback as a redacted draft until exact-content disclosure is approved.
A correction is not permission to save reusable memory; see [memory and learning](LEARNING.md).

For optional connection, preview, or runtime acceptance, follow [integrations](INTEGRATIONS.md)
and [preview guidance](PREVIEW.md). Those checks are separate from the default first draft.
Repeat the smallest failed task after a repair and retain the earlier observation for comparison.

Publishing, changing visibility, sharing artifacts, sending, spending, and external writes still
need the applicable explicit authorization. Public source availability is not release authority.
