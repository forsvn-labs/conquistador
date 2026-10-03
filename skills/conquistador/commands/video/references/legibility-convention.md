# Method and evidence note

A pack-consuming artifact must explain which local method informed the work and what evidence supports the platform constraints. Preserve the `pack_verified` and `applied_tactics` artifact fields for compatibility. `pack_verified: none` means platform mechanics were not verified; it does not mean the pack is absent.

## Required note

Under the Format Specification or channel execution brief, include a Legibility block:

- Pack: [local platform slug or absent]
- Method revision: [method_updated date or unknown]
- Platform verification: [task-local source/date/account scope or none]
- Status: [method-only, verified for this task, stale evidence, or absent]
- Decisions applied: [specific section, choice and evidence]
- Why these: [how those choices serve this user's task]
- Pending checks: [constraint, owner and whether it blocks production or publication]

When the pack is present but verification is unavailable, use method-only. Do not copy a historical pack date into the output as a new check. If prior evidence is too old or inapplicable to the selected account, name the unsupported constraint rather than claiming that every method expires at a fixed interval.

With no matching pack, use absent and state the general method used. Do not invent platform tailoring. A critic checks completeness and truthfulness of this note. Unverified hard constraints block an upload-ready claim; they need not prevent a draft or an evaluation of supplied observations.

This note explains channel and format decisions. A separate Why this works section, when required, explains the supported product/audience rationale. Neither section proves a ranking effect or a causal performance lift.
