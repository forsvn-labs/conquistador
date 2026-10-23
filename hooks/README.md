# Advisory plugin hooks

Native plugin prompt hooks call `tools/prompt-advice.mjs`. Project-mode hooks use the same
helper. Both respect the global hook switch and the installed operator profile.

- `manual`, the default, requires an explicit invocation or an explicitly enabled project prompt event.
- `project` permits advice for a requested business or product deliverable.
- `off` suppresses selection, including explicit requests.

Engineering about an outreach system does not request outreach copy. Quoted examples,
negative instructions, and uncertain topic matches stay silent. A relevant prompt receives
at most 1,500 characters of optional advice. Stop and session-start hooks return no advice
and never block completion. No hook runs a workflow or starts a specialist.

Use `conquistador hooks off` or `CONQUISTADOR_HOOKS=off` to disable both adapters. See
[project configuration](../docs/PROACTIVE.md) for the additional project event configuration.
A configured hook is not proof that the host trusts or runs it.

The shared helper suppresses an identical event only when the session, project, prompt,
resource digests, and transcript boundary match. It reuses complete resources only when paired
successful tool results after a verified transcript boundary contain their current full bytes.
A changed or rotated transcript invalidates reuse. Missing transcript evidence never counts
as a read. Stored state expires after twelve hours. It contains hashes and task state, not
prompt text or transcript content. Source and project hooks share this state.

The edit hook checks only a declared `channel` or a marketing-shaped file in an active
marketing task. A directory named `outreach` and an arbitrary HTML file no longer suffice.
The checker keeps its per-file duplicate-finding suppression. Manual checks remain available.

`tools/read-evidence.mjs` retains the full-file evidence checks used for resource reuse.
Evidence establishes returned bytes, not attention, applicability, quality, or approval.

Verify with:

```sh
node --test tools/behavior-contract.test.mjs tools/conquistador-hook.test.mjs
node docs/behavior-review-2026-10.mjs --strict
```

These are offline checks against real modules and hook processes. They do not certify native
host activation or the quality of a generated marketing deliverable.
