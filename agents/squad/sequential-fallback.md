# Sequential fallback

Use when the host cannot give advisor and worker separate contexts.

1. Worker produces from its assigned skill and named workflow.
2. Advisor critiques that artifact from its assigned skill and named workflow, in
   the same context, after the worker finishes.
3. Label the critique single-context. It is not an independent context and not
   independent corroboration.

Preserve the outcome and the human approval boundary. Reduce isolation, not
judgment. Do not install a runtime or invent a second agent process to mimic
isolation.

One terminal Review Packet. Advisor still cannot send, publish, spend, or
approve. Worker still cannot self-approve.
