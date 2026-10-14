# App integration contract

Conquistador must work as a production dependency in an app that already has an agent.
The app supplies its model, user context, access rules, and publication decisions. Conquistador
supplies the same eight marketing tools as its MCP server. It starts no UI or server at install
or import time.

## Failure modes, before implementation

- A local dependency has no public import, missing files, or unusable TypeScript declarations.
- npm or Bun installation starts the TUI, changes agent settings, or needs a global CLI.
- Import starts a listener, logs on stdout, reads project context, or writes user state.
- Briefs or search expose the server operator's home playbooks or project context to a caller.
- Calls retain another user's context, change shared tool definitions, or run a bundled script.
- Unknown tools, invalid arguments, large requests, or escaping paths fail without a useful limit.
- The app gets different routing, checks, rubric scores, or receipts from the MCP client.
- A host accepts an edited draft, changed context, changed channel, forged clean flag, wrong
  signing key, or unsigned receipt as signed evidence.
- Mounting MCP takes over the app's other routes, starts another port, or prevents shutdown.
- Missing authentication exposes the library; a failed custom access check grants access.
- A browser Origin, unsupported protocol version, invalid JSON, batch, or oversized streamed
  request bypasses the HTTP checks.
- An example closes an oversized upload before its 413 response finishes, or retains the
  CI checkout credential while running package-controlled code.
- Fetch and Node handlers disagree, or the official MCP clients cannot use the mounted server.
- Published examples use internal package paths, unshipped imports, browser code, or a runtime
  that cannot read the packaged library.
- The website adds visible default controls, changes the one-command default, loses other
  methods, or advertises the new imports before npm can serve their version.

## Acceptance

`tools/e2e/app-integration.mjs` installs a real npm tarball into an isolated app. Its consumer
crosses the public imports, runs the tools against packaged playbooks, mounts MCP with the app
on one loopback port, uses official MCP clients, compiles a TypeScript caller, and checks the
failure modes above. npm and Bun installations and Node 22.18 are separate runs. Reports bind
the tarball digest, source commit, toolchain, and individual results. No model or external
publishing tool runs. Fixed drafts test the contract, not writing quality.

The library supports server-side Node and Bun. Browser imports and arbitrary Edge bundlers are
outside this contract. A hosted MCP connection remains available when the app cannot ship the
Node filesystem library. A deployed host must enforce its own user access, rate limits, model
loop, and decisions to send, publish, or spend.
