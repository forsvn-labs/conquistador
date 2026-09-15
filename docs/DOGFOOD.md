# Private dogfooding

Use the complete private 0.1.0 distribution. Ask your coding agent to install Conquistador from
that folder into the current project using [the install guide](../INSTALL.md). Start a fresh host
session and select Conquistador. The host may use `/conquistador`, `$conquistador`, a picker or a
plugin namespace. Initial activation is the first thing to verify in your actual host.

Start with a real task you already need to do. Let the parent select methods and prepare missing
local tools. You do not need the optional HTTP runtime, MCP service, Docker or every integration to
use the skill library.

Useful first exercises:

- Ask for a finished product or marketing deliverable from real project context. Check whether
  routing is useful, the result is accurate and the agent finishes without unnecessary questions.
- Ask for a Lavish preview, make one concrete annotation, and check that the agent applies it to
  the canonical source. Confirm the browser link works from your machine and the agent resumes.
- Bring real results or a correction into a follow-up request. Check that Conquistador changes
  its recommendation using that evidence rather than repeating the previous output.

Keep notes in your private project outside the installed package. Record the build or install
receipt, host, request, failure or correction, and whether the revised result worked. Save only
what is useful; do not automatically copy entire transcripts. Source changes should follow a
reproducible problem or an observed improvement.

Memory is still an explicit user-approved workflow; automatic cross-run retrieval is absent.
[Proactive reminders](PROACTIVE.md) remain opt-in and require an actual host event.
[Preview setup](PREVIEW.md) handles the cached CLI, telemetry opt-out and attached polling.
Treat these as behaviors to try in the host, not as already proven by packaging tests.

The public `submit-feedback` path is deferred while dogfooding privately. It may prepare a local
redacted draft, but its public-destination requirement must not be relaxed to upload private notes.
Do not use the historical repository URL as proof that this build is installed or released.

Keep the repository private. The root npm package is marked `private: true`; local packing and
installation remain available. Do not publish packages, create public marketplace listings, change
repository visibility or share test artifacts without explicit authorization. Public release and
the landing page come later, after real use shows what needs fixing.
