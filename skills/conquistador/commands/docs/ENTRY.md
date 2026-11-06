# Write documentation readers can use

Write product guides, DevRel explanations, and technical references from verified behavior.
Default to the product user or non-technical teammate unless the request identifies another reader.
Lead with their goal. Use "you," plain words, exact UI labels, and concrete examples.
For task guides, build a visual walkthrough: show the result first, then short action → visual → expected-result
sections. For UI tasks, capture the real starting screen, unfamiliar controls, changed states,
and success or recovery states. Crop to the task and add numbered callouts beside the matching
steps. Use short recordings for motion or timing; keep still frames and text as a fallback.
Use Cap when available, otherwise the host's capture tool. Never invent product screenshots.
Keep originals, capture date/version, captions, alt text, and editable annotations. Hide private
data before capture. If capture access is missing, mark the draft's visual gaps; do not call it
ready. Inspect the rendered document at reading size and a narrow width, then walk the task
using the guide alone. A reader must know where to act and how to recognize success.
For procedures, explain prerequisites, actions, expected results, and recovery. Include a focused flow diagram
when it clarifies decisions or handoffs. Prefer Pele to render editable Mermaid source as SVG,
with a text explanation alongside it. Report when rendering could not be verified.

Keep small edits small. Reuse verified project facts and guidance already in context.
Read the [complete method](COMMAND.md) for source checks and mode-specific guidance.
Load only references needed for the requested document; do not preload roles or the library.

For existing docs, read the documents and current source evidence first. Check substantive
accuracy, reader tasks, structure, and visual gaps. Repair what is needed; preserve working
sections. Link or warning-note cleanup alone is not a complete docs update unless requested.
Use product sources and connected documents when there is no code repository. State missing
evidence rather than inventing it. Reading or drafting does not authorize external publication.

Preserve the document type. A company or product knowledge reference needs a clear overview,
audiences, supported claims, comparisons, and sources; it is not automatically a tutorial or
a positioning exercise. Use annotated product captures for visible behavior and a Pele map
for meaningful relationships or choices. Do not add artificial procedures or decorative media.
Report source, visual/render, and reader-task verification separately from automated checks.
