# Share-card verification method

Use privately before a page launch or when a pasted link renders incorrectly.

1. Inspect the actual page response and metadata for canonical URL, title, description, `og:*`, and
   Twitter/X card fields; use `improve-conversion` to separate objective breakage from subjective copy
   preference.
2. Resolve every image to an absolute production URL. Verify reachability, content type, file size,
   and actual dimensions; declared dimensions must match the file.
3. Fix only the metadata/card surface when implementation is explicitly in scope, then re-fetch and
   verify. Treat platform cache lag separately from source correctness and stop after three failed
   cycles.

Load recovered OG checks under `conquistador/references/share-card-verification/` (fixes,
anti-patterns, walkthrough) instead of paraphrasing them.

Use `brief-creative` only when the card image or message needs a new production handoff.

Use an inspectable host or browser tool when available; no specific CLI or runtime is required. Return
observed defects, proposed or applied correction, objective verification, advisory items, and the
publish boundary.
