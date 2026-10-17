# Notices

Copyright (c) 2026 forsvn. Conquistador is licensed under MIT.

The complete distribution includes portable skills and host/agent contracts, the optional runtime,
typed tool catalog, and Eval Lab. The portable ZIP excludes the runtime, catalog, Eval Lab, and install
helper. Installing a portable package starts no service and invokes no provider. Individual outcomes
can require tools or external model access when invoked, as declared in their instructions.

CHANGELOG.md records public releases. Product versions are separate from internal module, skill,
schema, and projector versions.

The public methods operate without private course records or practitioner source collections.
Technical provider and platform names identify compatibility or documented interfaces; they do not
state affiliation or endorsement. Third-party dependency license obligations remain applicable.

The optional Eve job host depends on the upstream `eve` package, licensed under Apache-2.0.
The optional Executor connection host depends on upstream `executor`, licensed under MIT, and
the official MCP SDK. These dependencies are installed separately through their exact manifests
and lockfiles. Their source and license notices remain with the upstream packages; the root MIT
license does not relicense them. Hosted services have separate terms and are not included by
installing the Conquistador skill. Upstream identities are https://github.com/vercel/eve and
https://github.com/UsefulSoftwareCo/executor.

The separate app is UNLICENSED and excluded. Private course records, internal planning and review
documents, source release authority, and landing are also excluded. Dependency notices and rights
checks are separate acceptance evidence and must be verified for the exact artifact before release.

The optional interactive setup bundles Clack prompts and its MIT-licensed dependencies.
Exact versions are pinned in tools/tui/package-lock.json. Their notices are retained in
`tools/vendor/NOTICE.txt` in the complete source distribution. The bundle runs locally and is loaded only
for the terminal guide.

Hosted OAuth includes `@cloudflare/workers-oauth-provider` 1.2.3, copyright (c) 2025 Cloudflare,
Inc., under the MIT license. Its unmodified distribution is `tools/vendor/oauth-provider.mjs`.
The full license is retained in `tools/vendor/OAUTH-PROVIDER-LICENSE`. The upstream source is
https://github.com/cloudflare/workers-oauth-provider. Local skill installs and app imports do
not load this Worker-only module.
