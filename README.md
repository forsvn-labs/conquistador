# Conquistador v0.1.0

Conquistador provides portable marketing skills, agent contracts, an optional durable playbook
runner, a typed tool catalog, and an Eval Lab. Ask for an outcome or install a skill on its own.

This is an unpublished local release candidate. The complete distribution includes all source
modules and local installation tools. The portable ZIP contains only the plugin and its skills. Live host compatibility, model output quality, provider support, human review,
and publication are not proved by its existence or by local tests.

Start with [installation and local use](INSTALL.md). The portable plugin needs no service or package
manager. The optional runner requires Node 24 and user-owned model access. External actions require
explicit human authority. Unsupported connections stop without dispatch.

The distribution is MIT. The separate desktop experiment, private research, internal release
records, and landing site are excluded. Internal module, skill, and contract versions can differ
from the public distribution version; their history is retained.

## Develop the product

The complete distribution is editable source as well as an installable package. The portable ZIP
omits the runtime and development commands below. In the complete distribution with Node 24, run `npm run bootstrap`,
`npm run build`, and `npm test` from the root. [CONTRIBUTING.md](CONTRIBUTING.md) explains local
packaging from an exact public Git commit. [AGENTS.md](AGENTS.md) gives contributor instructions.
These commands do not depend on private workspace records or authorize a release.
