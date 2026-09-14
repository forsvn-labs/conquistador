# Social publishing handoff

Use privately when ready-to-post social work must become an operator-ready export, scheduler draft, or
approved live action.

1. Use `write-social` for final channel-native copy, disclosure, reply plan, and media references.
2. Validate current platform limits and required fields. Preserve exact copy and UTF-8 text; never
   silently truncate.
3. Default to a plain per-platform bundle. Emit scheduler-specific JSON or CSV only when its current
   schema is verified, then parse the generated file before delivery.
4. If the host exposes a verified draft tool, create drafts only when the user requested that exact
   action. A draft is not a live post.
5. Publishing requires explicit action-time approval after the final body, account, platforms, and
   schedule are shown. Never log credentials or infer approval from earlier strategy work.

Load recovered publishing method under `conquistador/references/social-publishing-handoff/`
(formatter, confirmation gate, per-platform schemas, automation flows). Publishing still requires
explicit action-time approval. Never run automation that posts live.

If a tool, credential, schema, or approval is missing, return the validated export bundle and exact
next action. Record per-platform success or fallback; never claim a live post without destination
confirmation.
